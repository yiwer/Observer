import type { CandidateV2, Verification } from "./gate-contracts.ts";
import type { InterestSnapshot } from "./interest-contracts.ts";
import type { ReportRecord } from "./contracts.ts";
import { interestHash, interestKeyHash } from "./interest-profile.ts";

export function projectSelectionReceipt(verification: Verification | null, stories: CandidateV2[], enabled: boolean, modelEvidence: ReadonlyArray<{ id: string; title?: string | undefined; content?: string | undefined }>, nativeSocialStoryIds: ReadonlySet<string> = new Set()): Verification | null {
  if (!verification) return null;
  return { ...verification, assessments: verification.assessments.map((assessment) => {
    const { selection, selectionProjection: _untrusted, ...original } = assessment;
    const story = stories.find((story) => story.id === assessment.storyId);
    const native = !!story && nativeSocialStoryIds.has(story.id);
    const claim = story?.claims.find((claim) => claim.id === assessment.claimId && (claim.kind === "fact" || claim.kind === "statement" || native && claim.kind === "analysis"));
    const readable = (id: string) => modelEvidence.some((evidence) => evidence.id === id && !!(evidence.title?.trim() || evidence.content?.trim()));
    if (!enabled || !selection || !claim || assessment.conclusion !== "supported" || assessment.wording !== "original" ||
      !assessment.evidence.some((evidence) => evidence.relation === "supports" && evidence.reliability === "reliable" && readable(evidence.evidenceId)) ||
      selection.evidenceLanguages.some((item) => !claim.evidenceIds.includes(item.evidenceId) || !assessment.evidence.some((evidence) => evidence.evidenceId === item.evidenceId && evidence.relation === "supports" && evidence.reliability === "reliable"))) return original;
    const { topics, entities, ...metadata } = selection;
    if (native) {
      const { impactBasis: _impactBasis, ...restricted } = metadata;
      return { ...original, selectionProjection: { ...restricted, regions: [], impact: "ordinary" as const, impactClaimIds: [],
        evidenceLanguages: metadata.evidenceLanguages.filter((item) => readable(item.evidenceId)), provenance: "observer-final-selection-projection-v1" as const,
        annotationSha256: interestHash(selection), topicSha256s: [...new Set(topics.map(interestKeyHash))], entitySha256s: [...new Set(entities.map(interestKeyHash))] } };
    }
    const validImpact = original.eventProjection?.materiality === "material" && selection.impactClaimIds.length > 0 && selection.impactClaimIds.every((id) => story!.claims.some((claim) => claim.id === id && claim.kind === "analysis")) &&
      (claim.kind === "statement" ? selection.impactBasis === "statement-act" : selection.impactBasis === "observed-event");
    return { ...original, selectionProjection: { ...metadata, evidenceLanguages: metadata.evidenceLanguages.filter((item) => readable(item.evidenceId)), impact: validImpact ? metadata.impact : "ordinary", impactClaimIds: validImpact ? metadata.impactClaimIds : [], provenance: "observer-final-selection-projection-v1" as const,
      annotationSha256: interestHash(selection), topicSha256s: [...new Set(topics.map(interestKeyHash))], entitySha256s: [...new Set(entities.map(interestKeyHash))] } };
  }) };
}

type GatedRecord = Extract<ReportRecord, { schemaVersion: 2 }>;
type EventRecord = Extract<ReportRecord, { schemaVersion: 4 }>;
export function selectInterests(gate: GatedRecord["publicationGate"] | EventRecord["publicationGate"], stories: CandidateV2[], snapshot: InterestSnapshot, clusters: EventRecord["eventClusters"]) {
  const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
  const interestSelections = stories.map((story) => {
    const cluster = clusters.find((cluster) => cluster.primary.storyId === story.id);
    const visible = [{ storyId: story.id, claims: story.claims }, ...(cluster?.supportingClaims.map((entry) => ({ storyId: entry.storyId, claims: [entry.claim] })) ?? [])];
    const labels = assessments.filter((item) => visible.some((entry) => entry.storyId === item.storyId && entry.claims.some((claim) => claim.id === item.claimId)) &&
      (!cluster || cluster.developments.some((development) => development.storyId === item.storyId && development.claimId === item.claimId && ["current-disclosure", "late-discovered"].includes(development.coverage))))
      .flatMap((item) => item.selectionProjection ? [{ ...item.selectionProjection, storyId: item.storyId }] : []);
    const baseline = !!cluster && labels.some((label) => label.impact !== "ordinary" && label.impactClaimIds.length > 0 &&
      label.impactClaimIds.every((id) => visible.some((entry) => entry.storyId === label.storyId && entry.claims.some((claim) => claim.id === id && claim.kind === "analysis"))));
    const matches = {
      topics: snapshot.profile.topics.filter((item) => labels.some((label) => label.topicSha256s.includes(interestKeyHash(item.key)))),
      entities: snapshot.profile.entities.filter((item) => labels.some((label) => label.entitySha256s.includes(interestKeyHash(item.key)))),
      regions: snapshot.profile.regions.filter((item) => labels.some((label) => label.regions.includes(item.key))),
    };
    const excluded = snapshot.profile.exclusions.topics.some((key) => labels.some((label) => label.topicSha256s.includes(interestKeyHash(key)))) ||
      snapshot.profile.exclusions.entities.some((key) => labels.some((label) => label.entitySha256s.includes(interestKeyHash(key)))) ||
      snapshot.profile.exclusions.regions.some((key) => labels.some((label) => label.regions.includes(key)));
    const score = Object.values(matches).flat().reduce((total, item) => total + item.priority, 0);
    const regularRegion = labels.some((label) => label.regions.some((region) => ["CN", "US", "EU"].includes(region)));
    const unknownRegion = !labels.some((label) => label.regions.length);
    const outcome = !baseline && excluded ? "excluded" : story.edition !== "github-projects" && !baseline && !regularRegion && !unknownRegion && !Object.values(matches).some((items) => items.length) ? "outside-region-scope" : "eligible";
    return { storyId: story.id, score, baseline, outcome: outcome as "eligible" | "excluded" | "outside-region-scope" };
  });
  const decision = (id: string) => interestSelections.find((item) => item.storyId === id)!;
  return { interestSelections, stories: stories.filter((story) => decision(story.id).outcome === "eligible").sort((a, b) => Number(decision(b.id).baseline) - Number(decision(a.id).baseline) || decision(b.id).score - decision(a.id).score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) };
}

export function interestCoverage(record: Extract<ReportRecord, { schemaVersion: 4 | 5 | 6 | 7 }>, snapshot: InterestSnapshot): Extract<ReportRecord, { schemaVersion: 5 }>["coverage"] {
  const gate = record.publicationGate;
  const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
  const permitted = new Set(record.evidenceBundle.evidence.map((evidence) => evidence.id));
  const inputIds = [...new Set(gate.input.dispatchedEvidenceIds ?? [])];
  const regions = new Map<string, Set<string>>();
  const languages = new Map<string, Set<string>>();
  for (const assessment of assessments) {
    const label = assessment.selectionProjection;
    if (!label) continue;
    for (const evidence of assessment.evidence.filter((item) => item.relation === "supports" && item.reliability === "reliable" && permitted.has(item.evidenceId))) {
      const known = regions.get(evidence.evidenceId) ?? new Set<string>();
      for (const region of label.regions) known.add(["CN", "US", "EU"].includes(region) ? region : "other");
      regions.set(evidence.evidenceId, known);
    }
    for (const item of label.evidenceLanguages.filter((item) => permitted.has(item.evidenceId))) {
      const known = languages.get(item.evidenceId) ?? new Set<string>();
      known.add(item.language.toLowerCase()); languages.set(item.evidenceId, known);
    }
  }
  const entry = (key: string, map: Map<string, Set<string>>, kind: "region" | "language") => {
    const evidenceIds = inputIds.filter((id) => map.get(id)?.has(key)).sort();
    const selectedStoryIds = record.stories.filter((story) => {
      const visible = [{ storyId: story.id, claims: story.claims }, ...record.eventClusters.filter((cluster) => cluster.primary.storyId === story.id).flatMap((cluster) => cluster.supportingClaims.map((entry) => ({ storyId: entry.storyId, claims: [entry.claim] })))];
      return assessments.some((assessment) => {
        const label = assessment.selectionProjection;
        return label && visible.some((entry) => entry.storyId === assessment.storyId && entry.claims.some((claim) => claim.id === assessment.claimId)) &&
          (kind === "region" ? label.regions.some((region) => (["CN", "US", "EU"].includes(region) ? region : "other") === key) : label.evidenceLanguages.some((item) => item.language.toLowerCase() === key && evidenceIds.includes(item.evidenceId)));
      });
    }).map((story) => story.id);
    return { key, evidenceIds, selectedStoryIds };
  };
  return { scope: "model-input-and-final-gate-annotations", inputEvidenceCount: inputIds.length,
    regions: ["CN", "US", "EU", "other"].map((key) => entry(key, regions, "region")),
    languages: [...new Set([...snapshot.profile.coverageLanguages.map((language) => language.toLowerCase()), ...[...languages.values()].flatMap((keys) => [...keys])])].sort().map((key) => entry(key, languages, "language")),
    unknownRegionEvidenceIds: inputIds.filter((id) => !regions.get(id)?.size).sort(), unknownLanguageEvidenceIds: inputIds.filter((id) => !languages.get(id)?.size).sort(),
  };
}

// Recheck the published projection without reopening source material or the mutable profile.
export function consistentInterests(record: Extract<ReportRecord, { schemaVersion: 5 | 6 | 7 }>): boolean {
  if (interestHash(record.interestProfile.profile) !== record.interestProfile.sha256 || new Set(record.interestSelections.map((entry) => entry.storyId)).size !== record.interestSelections.length) return false;
  const gate = record.publicationGate;
  const receipts = gate.schemaVersion === 1 ? [gate] : gate.batches;
  if (gate.input.dispatchedEvidenceIds === undefined || receipts.some((receipt) => receipt.input.dispatchedEvidenceIds === undefined ||
    receipt.input.dispatchedEvidenceIds.some((id) => !receipt.input.verificationEvidenceIds.includes(id)) ||
    new Set(receipt.input.dispatchedEvidenceIds).size !== receipt.input.dispatchedEvidenceIds.length) ||
    interestHash(gate.input.dispatchedEvidenceIds) !== interestHash([...new Set(receipts.flatMap((receipt) => receipt.input.dispatchedEvidenceIds ?? []))])) return false;
  const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
  if (assessments.some((assessment) => assessment.selection !== undefined || assessment.selectionProjection && (
    !gate.decisions.some((decision) => decision.storyId === assessment.storyId && decision.claimId === assessment.claimId && decision.outcome === "published") ||
    assessment.selectionProjection.evidenceLanguages.some((item) => !assessment.evidence.some((evidence) => evidence.evidenceId === item.evidenceId && evidence.relation === "supports" && evidence.reliability === "reliable"))))) return false;
  const selected = selectInterests(gate, record.stories, record.interestProfile, record.eventClusters);
  return record.interestSelections.every((entry) => record.editions.some((edition) => edition.candidateStoryIds.includes(entry.storyId))) &&
    selected.interestSelections.every((entry) => interestHash(entry) === interestHash(record.interestSelections.find((item) => item.storyId === entry.storyId))) &&
    interestHash(selected.stories.map((story) => story.id)) === interestHash(record.stories.map((story) => story.id)) &&
    interestHash(interestCoverage(record, record.interestProfile)) === interestHash(record.coverage);
}
