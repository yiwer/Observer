import type { CandidateV2, Verification } from "./gate-contracts.ts";
import { inputDigest } from "./publication-gate.ts";

// A local final-Gate projection, never presented as the Verifier's raw response.
// Only hashes of semantic normalization text survive; no annotation prose is archived.
export function projectEventReceipt(verification: Verification | null, stories: CandidateV2[], enabled: boolean): Verification | null {
  if (!verification) return null;
  return { ...verification, assessments: verification.assessments.map((assessment) => {
    const { event, eventProjection: _untrustedProjection, ...original } = assessment;
    const story = stories.find((story) => story.id === assessment.storyId);
    const fact = story?.claims.find((claim) => claim.id === assessment.claimId && (claim.kind === "fact" || claim.kind === "statement"));
    if (!enabled || !event || !fact || assessment.wording !== "original" || assessment.conclusion !== "supported") return original;
    const eventKind = event.eventKind ?? "observed-event";
    if (fact.kind === "statement" ? eventKind !== "publisher-statement" || event.identity.subject !== fact.publisherSourceId || event.identity.action !== "published-statement" || event.occurrenceEvidenceId !== null || event.developmentEvidenceId !== null : eventKind !== "observed-event") return original;
    if ([event.occurrenceEvidenceId, event.disclosureEvidenceId, event.developmentEvidenceId].some((id) => id !== null && !fact.evidenceIds.includes(id)) ||
      event.relationToPrior && (!/^event-[a-f0-9]{64}$/.test(event.relationToPrior.clusterId) || !/^\d{4}-\d{2}-\d{2}-v1$/.test(event.relationToPrior.versionId) || event.relationToPrior.basisClaimIds.some((id) => !story!.claims.some((claim) => claim.id === id && claim.kind === "fact")))) return original;
    const { identity, fact: normalizedFact, ...references } = event;
    const normalized = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
    return { ...original, eventProjection: { ...references, eventKind, materialityClaimIds: [...new Set(references.materialityClaimIds)].filter((id) => story!.claims.some((claim) => claim.id === id && claim.kind === "analysis")), provenance: "observer-final-event-projection-v1" as const,
      annotationSha256: inputDigest(event), identitySha256: inputDigest([eventKind, Object.fromEntries(Object.entries(identity).map(([key, value]) => [key, normalized(value)]))]), factSha256: inputDigest(normalized(normalizedFact)),
    } };
  }) };
}
