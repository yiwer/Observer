import type { Claim, Verification, GateDecision } from "./gate-contracts.ts";
import { inputDigest, escapeMarkdown } from "./publication-gate.ts";
import type { ReportRecord } from "./contracts.ts";

type Assessment = Verification["assessments"][number];
type Evidence = { id: string; sourceId: string; sourceType: "primary" | "secondary"; retrievedAtUtc: string; title?: string | undefined; content?: string | undefined };
function independentCompanyEvidence(domain: NonNullable<Assessment["domain"]>, assessment: Assessment, evidence: readonly Evidence[]): Set<string> {
  const company = assessment.evidence.filter((entry) => domain.research.some((item) => item.evidenceId === entry.evidenceId && item.role === "company-capability-claim"));
  return new Set(domain.research.filter((item) => item.independentValidation === "yes" && item.role !== "company-capability-claim" &&
    assessment.evidence.some((entry) => entry.evidenceId === item.evidenceId && entry.relation === "supports" && entry.reliability === "reliable" && entry.basis !== "publisher-statement" && entry.upstreamOriginId !== null &&
      company.length > 0 && company.every((publisher) => publisher.upstreamOriginId !== null && publisher.upstreamOriginId !== entry.upstreamOriginId &&
        evidence.find((source) => source.id === publisher.evidenceId)?.sourceId !== evidence.find((source) => source.id === entry.evidenceId)?.sourceId))).map((item) => item.evidenceId));
}
export function domainFailure(claim: Claim, assessment: Assessment, evidence: readonly Evidence[], cutoffUtc: string): { reason: string; outcome: "quarantined" | "unconfirmed" } | null {
  if (assessment.conclusion === "unsafe" || assessment.wording === "unsafe") return { reason: "unsafe-material", outcome: "quarantined" };
  if (assessment.evidence.some((item) => item.relation === "irrelevant")) return { reason: "irrelevant-evidence", outcome: "quarantined" };
  const domain = assessment.domain;
  if (!domain || domain.risk.level === "unknown" || domain.assertion === "unknown" ||
    new Set(domain.domains).size !== domain.domains.length || new Set(domain.risk.categories).size !== domain.risk.categories.length ||
    (domain.risk.level === "high") !== (domain.risk.categories.length > 0)) return { reason: "domain-assessment-unavailable", outcome: "quarantined" };
  if (claim.kind === "fact" && domain.assertion !== "event-fact" ||
    domain.assertion === "interpretation" && claim.kind !== "analysis") return { reason: "domain-assertion-inconsistent", outcome: "quarantined" };
  if (domain.materials.length !== claim.evidenceIds.length || new Set(domain.materials.map((item) => item.evidenceId)).size !== domain.materials.length ||
    domain.materials.some((item) => !claim.evidenceIds.includes(item.evidenceId) || !["text", "verified-media-description"].includes(item.kind))) {
    return { reason: "publication-material-forbidden", outcome: "quarantined" };
  }
  if (!["not-financial", "informational"].includes(domain.financialContent) ||
    (domain.domains.includes("finance") || domain.risk.categories.includes("finance-sensitive")) && domain.financialContent !== "informational") return { reason: "financial-content-forbidden", outcome: "quarantined" };
  const researchRequired = domain.domains.some((value) => value === "ai" || value === "frontier-technology");
  if (new Set(domain.research.map((item) => item.evidenceId)).size !== domain.research.length ||
    researchRequired && domain.research.length !== claim.evidenceIds.length ||
    domain.research.some((item) => !claim.evidenceIds.includes(item.evidenceId) || !evidence.some((entry) => entry.id === item.evidenceId && (entry.title?.trim() || entry.content?.trim())))) {
    return { reason: "research-assessment-unavailable", outcome: "quarantined" };
  }
  if (domain.numbers.status === "unknown" || (domain.numbers.status === "dynamic") !== (domain.numbers.statistics.length > 0) ||
    domain.numbers.statistics.some((item) => item.statisticsAtUtc === null || item.statisticsAtUtc > cutoffUtc ||
      new Set(item.evidenceIds).size !== item.evidenceIds.length || item.evidenceIds.some((id) => {
        const source = evidence.find((entry) => entry.id === id);
        return !claim.evidenceIds.includes(id) || !source || !source.title?.trim() && !source.content?.trim() || item.statisticsAtUtc! > source.retrievedAtUtc ||
          !assessment.evidence.some((entry) => entry.evidenceId === id && entry.relation !== "irrelevant" && entry.reliability === "reliable");
      }))) return { reason: "statistics-time-unavailable", outcome: "quarantined" };
  for (const statistic of domain.numbers.statistics) {
    const references = assessment.evidence.filter((item) => statistic.evidenceIds.includes(item.evidenceId));
    const independent = references.filter((item) => item.reliability === "reliable" && item.basis !== "publisher-statement" && item.upstreamOriginId !== null);
    const corroborated = independent.some((a) => independent.some((b) => a.upstreamOriginId !== b.upstreamOriginId && evidence.find((item) => item.id === a.evidenceId)?.sourceId !== evidence.find((item) => item.id === b.evidenceId)?.sourceId));
    if (statistic.publisherSourceId === null ? !corroborated :
      !statistic.evidenceIds.some((id) => evidence.some((item) => item.id === id && item.sourceId === statistic.publisherSourceId))) {
      return { reason: "statistics-attribution-unavailable", outcome: "quarantined" };
    }
  }
  if (assessment.conclusion === "conflicting" || assessment.evidence.some((item) => item.relation === "contradicts")) return { reason: "source-conflict", outcome: "unconfirmed" };
  if (domain.assertion === "event-fact" && domain.research.some((item) => item.role === "company-capability-claim") &&
    independentCompanyEvidence(domain, assessment, evidence).size === 0) {
    return { reason: "company-capability-unconfirmed", outcome: "unconfirmed" };
  }
  if (domain.assertion === "event-fact" && domain.risk.level === "high") {
    const support = assessment.evidence.filter((item) => item.relation === "supports" && item.reliability === "reliable" && item.basis !== "publisher-statement" && item.upstreamOriginId !== null);
    const pair = support.some((a) => support.some((b) => a.upstreamOriginId !== b.upstreamOriginId && evidence.find((item) => item.id === a.evidenceId)?.sourceId !== evidence.find((item) => item.id === b.evidenceId)?.sourceId));
    if (!pair) return { reason: "high-risk-independent-sources-required", outcome: "unconfirmed" };
    if ((domain.domains.includes("finance") || domain.risk.categories.includes("finance-sensitive")) && !support.some((item) => item.basis === "direct-observation" && evidence.some((entry) => entry.id === item.evidenceId && entry.sourceType === "primary"))) return { reason: "finance-primary-corroboration-required", outcome: "unconfirmed" };
  }
  return null;
}

export function domainLabels(record: Extract<ReportRecord, { schemaVersion: 6 }>, storyId: string, claimId: string): string {
  const gate = record.publicationGate;
  const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
  const projection = assessments.find((entry) => entry.storyId === storyId && entry.claimId === claimId)?.domainProjection;
  if (!projection) return "";
  const status = { yes: "是", no: "否", unknown: "未知" };
  return [...projection.numbers.statistics.map((item) => `统计时间：${item.statisticsAtUtc}；依据：${item.evidenceIds.map(escapeMarkdown).join("、")}${item.publisherSourceId ? `；单方归因：${escapeMarkdown(item.publisherSourceId)}` : ""}。`),
    ...projection.research.map((item) => `证据成熟度 ${escapeMarkdown(item.evidenceId)}：预印本：${status[item.preprint]}；官方发布：${status[item.officialRelease]}；独立验证：${status[item.independentValidation]}；同行评审：${status[item.peerReview]}。`),
  ].join("\n\n");
}

// Only final policy-eligible decisions retain the bounded Observer projection.
export function projectDomainReceipt(verification: Verification | null, decisions: GateDecision[], enabled: boolean, evidence: readonly Evidence[]): Verification | null {
  if (!verification) return null;
  return { ...verification, assessments: verification.assessments.map((assessment) => {
    const { domain, domainProjection: _untrusted, ...original } = assessment;
    const decision = decisions.find((entry) => entry.storyId === assessment.storyId && entry.claimId === assessment.claimId);
    if (!enabled || !domain || !decision || decision.outcome === "quarantined") return original;
    const independent = independentCompanyEvidence(domain, assessment, evidence);
    const research = domain.research.some((item) => item.role === "company-capability-claim") ? domain.research.map((item) =>
      item.independentValidation === "yes" && !independent.has(item.evidenceId) ? { ...item, independentValidation: "unknown" as const } : item) : domain.research;
    return { ...original, domainProjection: { ...domain, research, provenance: "observer-final-domain-projection-v1" as const, annotationSha256: inputDigest(domain) } };
  }) };
}
