import { githubDigest } from "./github-adapter.ts";
import { MitigationProjectionSchema, type AdvisoryCollection, type AdvisoryEvidence, type AdvisoryHistory, type MitigationOrigin, type AdvisoryDevelopment } from "./github-advisory-contracts.ts";
import type { QuotationUse, QuotationPolicy } from "./github-quotations.ts";

export const previousMitigations = (history: AdvisoryHistory, evidence: AdvisoryEvidence) => history.mitigations
  .filter((entry) => entry.origin.evidence.nodeId === evidence.nodeId && entry.origin.evidence.ghsaId === evidence.ghsaId)
  .sort((a, b) => a.projection.projectionId < b.projection.projectionId ? -1 : a.projection.projectionId > b.projection.projectionId ? 1 : 0);

export function mitigationQuotationUses(origins: MitigationOrigin[]): QuotationUse[] {
  return origins.flatMap(({ origin, projection }) => [projection.quote.text, ...(projection.state.state === "measures" ? projection.state.measures.map((entry) => entry.effect) : [])]
    .map((text) => ({ policy: origin.evidence.policy, text })));
}
export function mitigationOutputQuotationUses(evidence: AdvisoryEvidence, receipt: AdvisoryCollection["assessments"][number]): QuotationUse[] {
  const draft = "formatVersion" in receipt ? receipt.verification?.mitigation?.projection : undefined;
  if (!draft || draft.state === "unknown") return [];
  return [draft.quote.text, ...(draft.state === "measures" ? draft.measures.map((entry) => entry.effect) : [])].map((text) => ({ policy: evidence.policy, text }));
}
export function textChangeQuotationUses(change: AdvisoryDevelopment["change"], afterPolicy: QuotationPolicy, history: AdvisoryHistory): QuotationUse[] {
  if (!change || !("representation" in change)) return [];
  const before = history.mitigations.find((entry) => entry.projection.projectionId === change.beforeProjectionId);
  if (!before) throw new Error("github-mitigation-origin-unavailable");
  return [...(change.before.state === "measures" ? change.before.measures.map((entry) => ({ policy: before.origin.evidence.policy, text: entry.effect })) : []),
    ...(change.after.state === "measures" ? change.after.measures.map((entry) => ({ policy: afterPolicy, text: entry.effect })) : [])];
}

export function textMitigationChange(evidence: AdvisoryEvidence, history: AdvisoryHistory, receipt: AdvisoryCollection["assessments"][number]) {
  const assessment = receipt.verification?.assessment, change = assessment?.change;
  if (!assessment || assessment.conclusion !== "supported" || assessment.relation.kind !== "new-material" || !change || !("representation" in change)) return null;
  const current = projectMitigation(evidence, history, receipt);
  const previous = previousMitigations(history, evidence), before = previous.find((entry) => entry.projection.projectionId === change.beforeProjectionId);
  const firstCurrent = current && previous.find((entry) => entry.projection.projectionId === current.projectionId);
  if (!current || !before || current.state.state !== "measures" || githubDigest(change.before) !== githubDigest(before.projection.state) ||
    githubDigest(change.after) !== githubDigest(current.state) || githubDigest(change.before.scope) !== githubDigest(change.after.scope) ||
    githubDigest(change.after.scope) !== githubDigest(evidence.vulnerabilities) || before.origin.availableAtUtc >= (firstCurrent?.origin.availableAtUtc ?? evidence.availableAtUtc)) return null;
  if (change.before.state === "explicit-none") return change.basis === "none-to-measure" ? change : null;
  if (change.basis === "none-to-measure" || change.before.assertion === "mentioned" && change.basis !== "replacement") return null;
  // Lexical difference is only a necessary guard; the external supported
  // assertion still supplies the substantive protection/replacement judgment.
  return current.state.measures.some((entry) => change.before.state === "measures" && !change.before.measures.some((old) => old.effect === entry.effect)) ? change : null;
}

/** A short projection is a derived member of a real accepted receipt, not a
 * separate bank or proof of semantic truth. The original body check is made
 * during collection; storage later authenticates that exact receipt member. */
export function projectMitigation(evidence: AdvisoryEvidence, history: AdvisoryHistory, receipt: AdvisoryCollection["assessments"][number]) {
  if (!("formatVersion" in receipt) || !receipt.verification || history.unavailableNodeIds.includes(evidence.nodeId)) return null;
  const assessment = receipt.verification.mitigation;
  if (!assessment || assessment.conclusion !== "supported" || assessment.projection.state === "unknown" || assessment.relation.kind === "unknown") return null;
  const previous = previousMitigations(history, evidence), draft = assessment.projection;
  if (githubDigest(receipt.previousMitigationIds) !== githubDigest(previous.map((entry) => entry.projection.projectionId))) return null;
  if (!evidence.vulnerabilities || draft.scopeIndexes.some((index) => !evidence.vulnerabilities![index])) return null;
  const scope = draft.scopeIndexes.map((index) => evidence.vulnerabilities![index]!);
  if (scope.some((entry) => !entry.package?.name || !entry.vulnerable_version_range)) return null;
  const state = draft.state === "explicit-none" ? { state: draft.state, scope } : { state: draft.state, scope, assertion: draft.assertion, measures: draft.measures };
  const related = previous.find((entry) => entry.projection.projectionId === assessment.relation.previousProjectionId);
  if (assessment.relation.previousProjectionId !== null && !related || assessment.relation.kind === "same" && !related) return null;
  if (assessment.relation.kind === "same" && githubDigest(related!.projection.state.scope) !== githubDigest(scope)) return null;
  const canonical = assessment.relation.kind === "same" ? related!.projection.state : state;
  return MitigationProjectionSchema.parse({ schemaVersion: 1, projectionId: githubDigest([evidence.nodeId, evidence.ghsaId, "mitigation-state-v1", canonical]),
    observationId: evidence.observationId, state: canonical, quote: draft.quote, inputSha256: receipt.inputSha256, completedAtUtc: receipt.completedAtUtc });
}

export function mitigationBodyMatches(description: string | null, receipt: AdvisoryCollection["assessments"][number]): boolean {
  const draft = "formatVersion" in receipt ? receipt.verification?.mitigation?.projection : undefined;
  if (!draft || draft.state === "unknown") return true;
  if (description === null) return false;
  const { start, text } = draft.quote, end = start + text.length;
  const splitPair = (offset: number) => offset > 0 && offset < description.length && /[\uD800-\uDBFF]/.test(description[offset - 1]!) && /[\uDC00-\uDFFF]/.test(description[offset]!);
  return !splitPair(start) && !splitPair(end) && description.slice(start, end) === text;
}
