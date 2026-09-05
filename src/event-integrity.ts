import type { PublishedReport, ReportRecord } from "./contracts.ts";
import type { Claim } from "./gate-contracts.ts";
import { inputDigest } from "./publication-gate.ts";

type EventRecord = Extract<ReportRecord, { schemaVersion: 4 }>;
export function consistentEvents(record: EventRecord, lookup: (versionId: string) => PublishedReport | undefined): boolean {
  const versionId = `${record.businessDate}-v1`;
  const gate = record.publicationGate;
  const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
  if (assessments.some((assessment) => assessment.event !== undefined || assessment.eventProjection && !gate.decisions.some((decision) => decision.storyId === assessment.storyId && decision.claimId === assessment.claimId && decision.outcome === "published"))) return false;
  const validClaim = (storyId: string, claim: Claim) => gate.decisions.some((decision) => decision.storyId === storyId && decision.claimId === claim.id && decision.outcome === "published" && decision.inputClaimSha256 === inputDigest(claim)) && claim.evidenceIds.every((id) => record.evidenceBundle.evidence.some((evidence) => evidence.id === id && evidence.url && evidence.title));
  const earlier = (id: string) => {
    const report = lookup(id);
    return report?.record.schemaVersion === 4 && report.version.id === id && report.record.businessDate < record.businessDate && report.version.publishedAtUtc <= record.evidenceBundle.cutoffUtc && report.record.evidenceBundle.cutoffUtc <= record.evidenceBundle.cutoffUtc ? report.record : undefined;
  };
  const validTime = (time: EventRecord["eventClusters"][number]["occurrence"], field: "eventTimeUtc" | "publishedAtUtc") => {
    if (time.atUtc === null) return time.evidenceIds.length === 0;
    const source = time.versionId === versionId ? record : earlier(time.versionId);
    if (!source || !time.evidenceIds.length || time.atUtc > record.evidenceBundle.cutoffUtc) return false;
    const values = time.evidenceIds.map((id) => source.evidenceBundle.evidence.find((evidence) => evidence.id === id)?.[field]);
    return values.every((value) => value != null) && values.sort()[0] === time.atUtc;
  };
  const news = record.stories.filter((story) => story.edition !== "github-projects");
  if (new Set(record.eventClusters.map((cluster) => cluster.id)).size !== record.eventClusters.length || news.length !== record.eventClusters.length || !news.every((story) => record.eventClusters.some((cluster) => cluster.primary.storyId === story.id && cluster.id === story.eventClusterId))) return false;
  return record.eventClusters.every((cluster) => {
    const primary = news.find((story) => story.id === cluster.primary.storyId);
    if (!primary || primary.edition !== cluster.primary.edition || cluster.primary.versionId !== versionId || !cluster.memberStoryIds.includes(primary.id) || new Set(cluster.memberStoryIds).size !== cluster.memberStoryIds.length ||
      cluster.memberStoryIds.some((id) => !record.editions.some((entry) => entry.candidateStoryIds.includes(id))) || cluster.evidenceIds.some((id) => !record.evidenceBundle.evidence.some((item) => item.id === id))) return false;
    if (cluster.supportingClaims.some((entry) => !cluster.memberStoryIds.includes(entry.storyId) || entry.storyId === primary.id || !validClaim(entry.storyId, entry.claim))) return false;
    if (new Set(cluster.impactNotes.map((note) => note.edition)).size !== cluster.impactNotes.length || cluster.impactNotes.some((note) => note.edition === primary.edition || note.claims.some((entry) => entry.claim.kind !== "analysis" || !cluster.memberStoryIds.includes(entry.storyId) || !record.editions.some((edition) => edition.edition === note.edition && edition.candidateStoryIds.includes(entry.storyId)) || !validClaim(entry.storyId, entry.claim)))) return false;
    if (cluster.developments.some((development) => {
      const assessment = assessments.find((entry) => entry.storyId === development.storyId && entry.claimId === development.claimId);
      const projection = assessment?.eventProjection;
      return !projection || `event-${projection.identitySha256}` !== cluster.id || projection.eventKind !== cluster.eventKind || development.id !== `development-${inputDigest([cluster.id, projection.factSha256])}` || !cluster.memberStoryIds.includes(development.storyId) ||
        !validTime(development.disclosure, "publishedAtUtc") || development.disclosure.versionId !== versionId || development.disclosure.evidenceIds.some((id) => id !== projection.disclosureEvidenceId) ||
        development.materialityClaimIds.some((id) => !projection.materialityClaimIds.includes(id));
    })) return false;
    const visible = [{ storyId: primary.id, claims: primary.claims }, ...cluster.supportingClaims.map((entry) => ({ storyId: entry.storyId, claims: [entry.claim] }))];
    const visibleIds = [...new Set(cluster.developments.filter((development) => visible.some((entry) => entry.storyId === development.storyId && entry.claims.some((claim) => claim.id === development.claimId))).map((development) => development.id))];
    if (inputDigest(visibleIds) !== inputDigest(cluster.developmentIds) || !validTime(cluster.occurrence, "eventTimeUtc") || !validTime(cluster.firstDisclosure, "publishedAtUtc") || !validTime(cluster.materialDevelopment, "eventTimeUtc")) return false;
    if (cluster.historyMetadata === "source-policy-withheld" && (cluster.firstDisclosure.atUtc !== null || cluster.firstDiscoveredAtUtc !== null || cluster.historyPolicies.length !== 0)) return false;
    if (cluster.previousCoverage) {
      const previous = earlier(cluster.previousCoverage.versionId);
      const priorCluster = previous?.eventClusters.find((entry) => entry.id === cluster.id && entry.primary.storyId === cluster.previousCoverage!.storyId);
      if (!previous || !priorCluster) return false;
      if (cluster.historyMetadata === "available") {
        const required = [...priorCluster.historyPolicies, ...previous.evidenceBundle.evidence.filter((evidence) => priorCluster.evidenceIds.includes(evidence.id)).flatMap((evidence) => evidence.origin.kind === "collected" ? [{ sourceId: evidence.sourceId, policyVersion: evidence.origin.policyVersion, policySha256: evidence.origin.policySha256 }] : [])];
        if (required.some((dependency) => !cluster.historyPolicies.some((entry) => inputDigest(entry) === inputDigest(dependency)))) return false;
      }
    } else if (cluster.coverage === "material-update" || cluster.historyPolicies.length) return false;
    if (cluster.separatedFrom.some((relation) => !earlier(relation.versionId)?.eventClusters.some((prior) => prior.id === relation.clusterId && prior.id !== cluster.id) || relation.basis.some((basis) => !cluster.developments.some((development) => development.storyId === basis.storyId && development.claimId === basis.claimId)))) return false;
    return cluster.memberStoryIds.every((storyId) => record.eventSelections.some((selection) => selection.storyId === storyId && selection.eventClusterId === cluster.id && selection.outcome === (storyId === primary.id ? "primary" : "impact-note")));
  });
}
