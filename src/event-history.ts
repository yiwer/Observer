import type { EditionResearch, ReportRecord } from "./contracts.ts";
import { editionNames } from "./contracts.ts";
import { arrangeEditions } from "./six-edition.ts";
import { inputDigest } from "./publication-gate.ts";
import type { InterestSnapshot } from "./interest-contracts.ts";
import { selectInterests, interestCoverage } from "./interest-selection.ts";

type GatedRecord = Parameters<typeof arrangeEditions>[0];
type EventRecord = Extract<ReportRecord, { schemaVersion: 4 | 5 | 6 | 7 | 8 }>;
export interface LegacyHistory { versionIds: string[]; fingerprints: Set<string>; }
export function legacyFingerprint(claim: { text: string; kind?: string; publisherSourceId?: string; evidenceIds: string[] }, evidence: ReadonlyArray<{ id: string; sourceId: string; url?: string | undefined; contentSha256?: string | undefined; publishedAtUtc?: string | null | undefined; eventTimeUtc?: string | null | undefined }>): string | null {
  if (claim.kind !== "fact" && claim.kind !== "statement" || claim.kind === "statement" && !claim.publisherSourceId) return null;
  const identities = claim.evidenceIds.map((id) => evidence.find((item) => item.id === id));
  if (!identities.length || identities.some((item) => !item?.url || !item.contentSha256 || !item.publishedAtUtc)) return null;
  return inputDigest([claim.kind, claim.kind === "statement" ? claim.publisherSourceId : null, claim.text.normalize("NFKC").trim().replace(/\s+/g, " "),
    identities.map((item) => [item!.sourceId, item!.url, item!.contentSha256, item!.publishedAtUtc, item!.eventTimeUtc ?? null]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  ]);
}
function identityClaims(story: GatedRecord["stories"][number]) {
  const facts = story.claims.filter((claim) => claim.kind === "fact");
  return facts.length ? facts : story.claims.filter((claim) => claim.kind === "statement");
}
export function arrangeEvents(record: GatedRecord, research: EditionResearch, history: EventRecord[] = [], legacyHistory: LegacyHistory = { versionIds: [], fingerprints: new Set() }, withheldHistory = new Set<string>(), interestProfile?: InterestSnapshot): EventRecord {
  const gate = record.publicationGate;
  const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
  const groups = new Map<string, typeof record.stories>();
  const gaps: EventRecord["coverageGaps"] = [];
  for (const story of record.stories) {
    if (story.edition === "github-projects") continue;
    const facts = identityClaims(story);
    const labels = facts.map((claim) => assessments.find((entry) => entry.storyId === story.id && entry.claimId === claim.id));
    if (!facts.length || labels.some((assessment) => !assessment?.eventProjection || assessment.conclusion !== "supported")) {
      gaps.push({ edition: story.edition, reason: `event-selection:${story.id}:event-assessment-unavailable` }); continue;
    }
    if (labels.some((assessment, index) => [assessment!.eventProjection!.occurrenceEvidenceId, assessment!.eventProjection!.disclosureEvidenceId, assessment!.eventProjection!.developmentEvidenceId].some((id) => id !== null && (!facts[index]!.evidenceIds.includes(id) || !assessment!.evidence.some((evidence) => evidence.evidenceId === id && evidence.relation === "supports" && evidence.reliability === "reliable")))) || new Set(labels.map((assessment) => assessment!.eventProjection!.identitySha256)).size !== 1) {
      gaps.push({ edition: story.edition, reason: `event-selection:${story.id}:event-assessment-invalid` }); continue;
    }
    if (labels.some((assessment) => {
      const label = assessment!.eventProjection!;
      const disclosure = record.evidenceBundle.evidence.find((item) => item.id === label.disclosureEvidenceId);
      return [label.occurrenceEvidenceId, label.developmentEvidenceId].some((id) => {
        const occurred = record.evidenceBundle.evidence.find((item) => item.id === id)?.eventTimeUtc;
        return occurred != null && (occurred > record.evidenceBundle.cutoffUtc || disclosure?.publishedAtUtc != null && occurred > disclosure.publishedAtUtc);
      }) || disclosure?.publishedAtUtc != null && disclosure.publishedAtUtc > disclosure.retrievedAtUtc;
    })) { gaps.push({ edition: story.edition, reason: `event-selection:${story.id}:event-time-conflict` }); continue; }
    const clusterId = `event-${labels[0]!.eventProjection!.identitySha256}`;
    if (labels.some((assessment) => {
      const relation = assessment!.eventProjection!.relationToPrior;
      return relation && (story.eventClusterId !== relation.clusterId || relation.clusterId === clusterId ||
        !history.some((old) => old.eventClusters.some((cluster) => cluster.id === relation.clusterId && cluster.primary.versionId === relation.versionId)) ||
        !relation.basisClaimIds.includes(assessment!.claimId) || relation.basisClaimIds.some((id) => !facts.some((claim) => claim.id === id)));
    })) { gaps.push({ edition: story.edition, reason: `event-selection:${story.id}:event-assessment-invalid` }); continue; }
    groups.set(clusterId, [...groups.get(clusterId) ?? [], story]);
  }
  const eventClusters: EventRecord["eventClusters"] = [];
  const selected: typeof record.stories = record.stories.filter((story) => story.edition === "github-projects");
  for (const [id, members] of groups) {
    const facts = members.flatMap((story) => identityClaims(story).map((claim) => ({ story, claim,
      label: assessments.find((entry) => entry.storyId === story.id && entry.claimId === claim.id)!.eventProjection! })));
    const labels = facts.map((fact) => fact.label);
    const proposed = labels[0]!.primaryEdition;
    const versionId = `${record.businessDate}-v1`;
    const previous = history.flatMap((old) => old.eventClusters.filter((cluster) => cluster.id === id));
    const last = previous.at(-1);
    const evidenceIds = [...new Set(members.flatMap((story) => story.claims.flatMap((claim) => claim.evidenceIds)))];
    const time = (ids: Array<string | null>, field: "eventTimeUtc" | "publishedAtUtc") => {
      const evidence = record.evidenceBundle.evidence.filter((item) => ids.includes(item.id) && evidenceIds.includes(item.id) && item[field] != null);
      return { atUtc: evidence.map((item) => item[field]!).sort()[0] ?? null, evidenceIds: evidence.map((item) => item.id), versionId };
    };
    const developments = facts.map(({ story, claim, label }) => ({ id: `development-${inputDigest([id, label.factSha256])}`, storyId: story.id, claimId: claim.id,
      disclosure: time([label.disclosureEvidenceId], "publishedAtUtc"),
      materialityClaimIds: label.materiality === "material" && label.materialityClaimIds.every((id) => story.claims.some((claim) => claim.id === id && claim.kind === "analysis")) ? label.materialityClaimIds : [],
    }));
    const unseen = developments.filter((development, index) => !previous.some((cluster) => cluster.developmentIds.includes(development.id)) &&
      !legacyHistory.fingerprints.has(legacyFingerprint(facts[index]!.claim, record.evidenceBundle.evidence) ?? ""));
    const known = unseen.filter((development) => development.disclosure.atUtc !== null);
    const inWindow = (at: string | null) => at !== null && at > record.evidenceBundle.windowStartUtc && at <= record.evidenceBundle.cutoffUtc;
    const eligible = known.filter((development) => !last && inWindow(development.disclosure.atUtc) || development.materialityClaimIds.length > 0);
    const occurrenceTimes = [...previous.map((cluster) => cluster.occurrence.atUtc), ...record.evidenceBundle.evidence.filter((item) => labels.some((label) => label.occurrenceEvidenceId === item.id)).map((item) => item.eventTimeUtc)].filter((value) => value != null);
    const reason = new Set(occurrenceTimes).size > 1 ? "identity-conflict" : !unseen.length ? "no-new-development" : !known.length ? "unknown-disclosure" : !eligible.length ? "not-material" : null;
    if (reason) { gaps.push(...members.map((story) => ({ edition: story.edition, reason: `event-selection:${story.id}:${reason}` }))); continue; }
    const eligibleMembers = members.filter((story) => eligible.some((development) => development.storyId === story.id));
    const primary = eligibleMembers.find((story) => story.edition === proposed) ?? [...eligibleMembers].sort((a, b) => Object.keys(editionNames).indexOf(a.edition) - Object.keys(editionNames).indexOf(b.edition))[0]!;
    selected.push({ ...primary, eventClusterId: id });
    const occurrence = time(labels.map((label) => label.occurrenceEvidenceId), "eventTimeUtc");
    const primaryDevelopments = new Set(developments.filter((development) => development.storyId === primary.id).map((development) => development.id));
    const supportingClaims: EventRecord["eventClusters"][number]["supportingClaims"] = [];
    for (const development of eligible) {
      if (primaryDevelopments.has(development.id)) continue;
      primaryDevelopments.add(development.id);
      const member = members.find((story) => story.id === development.storyId)!;
      supportingClaims.push(...member.claims.filter((claim) => (claim.id === development.claimId || development.materialityClaimIds.includes(claim.id)) && !supportingClaims.some((entry) => entry.storyId === member.id && entry.claim.id === claim.id)).map((claim) => ({ storyId: member.id, claim })));
    }
    const disclosure = time(labels.map((label) => label.disclosureEvidenceId), "publishedAtUtc");
    const firstDisclosure = [...previous.map((cluster) => cluster.firstDisclosure), disclosure].filter((time) => time.atUtc !== null).sort((a, b) => a.atUtc!.localeCompare(b.atUtc!))[0] ?? disclosure;
    const historyUnavailable = previous.some((cluster) => withheldHistory.has(cluster.primary.versionId) || cluster.historyMetadata === "source-policy-withheld");
    const noHistoricalTime = { atUtc: null, evidenceIds: [], versionId };
    const displayedDevelopmentIds = developments.filter((development) => development.storyId === primary.id || supportingClaims.some((entry) => entry.storyId === development.storyId && entry.claim.id === development.claimId)).map((development) => development.id);
    eventClusters.push({ id, eventKind: labels[0]!.eventKind, memberStoryIds: members.map((story) => story.id), evidenceIds,
      primary: { storyId: primary.id, versionId, edition: primary.edition, reason: "verified-edition-then-fixed-order" },
      occurrence: occurrence.atUtc === null && last ? historyUnavailable ? noHistoricalTime : last.occurrence : occurrence, firstDisclosure: historyUnavailable ? noHistoricalTime : firstDisclosure,
      firstDiscoveredAtUtc: historyUnavailable ? null : [...previous.flatMap((cluster) => cluster.firstDiscoveredAtUtc === null ? [] : [cluster.firstDiscoveredAtUtc]), ...record.evidenceBundle.evidence.filter((item) => evidenceIds.includes(item.id)).map((item) => item.discoveredAtUtc)].sort()[0]!,
      historyMetadata: historyUnavailable ? "source-policy-withheld" : "available",
      historyPolicies: historyUnavailable ? [] : [...new Map(history.filter((old) => old.eventClusters.some((cluster) => cluster.id === id)).flatMap((old) => [
        ...old.eventClusters.filter((cluster) => cluster.id === id).flatMap((cluster) => cluster.historyPolicies),
        ...old.evidenceBundle.evidence.filter((evidence) => old.eventClusters.some((cluster) => cluster.id === id && cluster.evidenceIds.includes(evidence.id))).flatMap((evidence) => evidence.origin.kind === "collected" ? [{ sourceId: evidence.sourceId, policyVersion: evidence.origin.policyVersion, policySha256: evidence.origin.policySha256 }] : []),
      ]).map((dependency) => [inputDigest(dependency), dependency])).values()],
      materialDevelopment: time(labels.map((label) => label.developmentEvidenceId), "eventTimeUtc"), coverage: eligible.some((development) => inWindow(development.disclosure.atUtc)) ? last ? "material-update" : "new-disclosure" : "late-discovered",
      developmentIds: [...new Set(displayedDevelopmentIds)], developments: developments.map((development) => ({ ...development,
        coverage: !unseen.includes(development) ? "previously-covered" : !known.includes(development) ? "unknown-disclosure" : !eligible.includes(development) ? "not-material" : inWindow(development.disclosure.atUtc) ? "current-disclosure" : "late-discovered",
      })), supportingClaims, previousCoverage: last ? { versionId: last.primary.versionId, storyId: last.primary.storyId } : null,
      separatedFrom: facts.flatMap(({ story, label }) => label.relationToPrior ? [{ clusterId: label.relationToPrior.clusterId, versionId: label.relationToPrior.versionId,
        basis: label.relationToPrior.basisClaimIds.map((claimId) => ({ storyId: story.id, claimId })) }] : []),
      impactNotes: [...new Set(members.map((story) => story.edition))].filter((edition) => edition !== primary.edition).map((edition) => ({ edition,
        claims: members.filter((story) => story.edition === edition).flatMap((story) => story.claims.filter((claim) => claim.kind === "analysis" && facts.some((fact) => fact.story.id === story.id && fact.label.materialityClaimIds.includes(claim.id))).map((claim) => ({ storyId: story.id, claim }))).slice(0, 1),
      })),
    });
  }
  const interest = interestProfile ? selectInterests(record.publicationGate, selected, interestProfile, eventClusters) : undefined;
  const arranged = arrangeEditions({ ...record, stories: interest?.stories ?? selected }, research);
  const retained = eventClusters.filter((cluster) => arranged.stories.some((story) => story.id === cluster.primary.storyId));
  const eventSelections: EventRecord["eventSelections"] = research.editions.flatMap((run) => run.status === "completed" && run.result.status === "succeeded" ? run.result.stories.map((story) => {
    const cluster = retained.find((cluster) => cluster.memberStoryIds.includes(story.id));
    const gap = gaps.find((gap) => gap.edition === story.edition && gap.reason.startsWith(`event-selection:${story.id}:`));
    return { storyId: story.id, proposedClusterId: story.eventClusterId, eventClusterId: cluster?.id ?? null,
      outcome: story.edition === "github-projects" ? "deferred" : cluster ? cluster.primary.storyId === story.id ? "primary" : "impact-note" : "withheld",
      reason: story.edition === "github-projects" ? "github-rules-deferred" : cluster ? "verified-event-membership" : gap?.reason.slice(`event-selection:${story.id}:`.length) ?? "gate-or-capacity-unavailable",
    };
  }) : []);
  const eventRecord: Extract<ReportRecord, { schemaVersion: 4 }> = { ...arranged, schemaVersion: 4, editorialContract: "observer-canonical-v2", coverageGaps: [...arranged.coverageGaps, ...gaps,
    ...(legacyHistory.versionIds.length ? Object.keys(editionNames).filter((edition) => edition !== "github-projects").map((edition) => ({ edition: edition as keyof typeof editionNames, reason: "legacy-history-unclassified" })) : []),
  ], eventClusters: retained, eventSelections, historyCoverage: { status: legacyHistory.versionIds.length ? "legacy-unclassified" : "classified", versionIds: legacyHistory.versionIds } };
  return interestProfile && interest ? { ...eventRecord, schemaVersion: 5, editorialContract: "observer-canonical-v3", interestProfile,
    coverageGaps: eventRecord.coverageGaps.map((gap) => gap.reason === "below-story-target" ? { ...gap, reason: "below-interest-selection-target" } : gap),
    interestSelections: interest.interestSelections, coverage: interestCoverage(eventRecord, interestProfile) } : eventRecord;
}
