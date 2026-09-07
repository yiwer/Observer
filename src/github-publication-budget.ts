import { githubDigest } from "./github-adapter.ts";
import { GitHubRepromotionSnapshotSchema, type DevelopmentRun, type DevelopmentSnapshot, type GitHubPublicationContext, type GitHubRepromotionSnapshot } from "./github-development-contracts.ts";
import { rankGitHubRepromotions } from "./github-repromotion.ts";
import { securityDevelopmentQuotationUses, securityMaterialQuotationUses } from "./github-advisories.ts";
import { mitigationOutputQuotationUses, mitigationQuotationUses, textChangeQuotationUses } from "./github-mitigations.ts";
import type { QuotationPolicy, QuotationUse } from "./github-quotations.ts";

type Group = { nodeId: string; kind: "release" | "security" };
type Use = Group & QuotationUse;
const compare = (a: Group, b: Group) => {
  if (a.kind !== b.kind) return a.kind === "release" ? -1 : 1;
  const left = [...a.nodeId], right = [...b.nodeId];
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const difference = left[i]!.codePointAt(0)! - right[i]!.codePointAt(0)!;
    if (difference) return difference;
  }
  return left.length - right.length;
};
function developmentUses(run: DevelopmentRun, development: DevelopmentRun["developments"][number] | NonNullable<DevelopmentRun["security"]>["developments"][number]): Use[] {
  if (development.kind === "release") {
    const evidence = run.evidence.find((entry) => entry.observationId === development.observationId);
    if (!evidence) throw new Error("github-publication-quotation-origin");
    return [{ nodeId: development.nodeId, kind: "release", policy: evidence.policy, text: development.evidenceExcerpt }];
  }
  const evidence = run.security?.evidence.find((entry) => entry.observationId === development.observationId);
  if (!run.security || !evidence) throw new Error("github-publication-quotation-origin");
  return securityDevelopmentQuotationUses(evidence, run.security, development).map((use) => ({ ...use, nodeId: development.nodeId, kind: "security" }));
}
function inventory(snapshot: GitHubRepromotionSnapshot, context: GitHubPublicationContext): Use[] {
  const uses: Use[] = [];
  for (const run of snapshot.developments.runs) {
    for (const receipt of run.assessments) {
      for (const previous of receipt.previous) {
        const origin = receipt.previousEvidence.find((entry) => entry.evidence.observationId === previous.observationId);
        if (!origin) throw new Error("github-publication-quotation-origin");
        uses.push({ nodeId: previous.nodeId, kind: "release", policy: origin.evidence.policy, text: previous.evidenceExcerpt });
      }
      for (const assessment of receipt.verification?.assessments ?? []) {
        const evidence = run.evidence.find((entry) => entry.observationId === assessment.observationId);
        if (!evidence) throw new Error("github-publication-quotation-origin");
        uses.push({ nodeId: evidence.nodeId, kind: "release", policy: evidence.policy, text: assessment.evidenceExcerpt });
      }
    }
    uses.push(...run.developments.flatMap((entry) => developmentUses(run, entry)));
    if (run.security) {
      for (const origin of run.security.history.mitigations) uses.push(...mitigationQuotationUses([origin]).map((use) => ({ ...use, nodeId: origin.origin.evidence.nodeId, kind: "security" as const })));
      for (const material of [...run.security.history.materials, ...run.security.assessments.flatMap((receipt) => receipt.previous)]) {
        uses.push(...securityMaterialQuotationUses([material], run.security.history).map((use) => ({ ...use, nodeId: material.origin.evidence.nodeId, kind: "security" as const })));
      }
      for (const receipt of run.security.assessments) if (receipt.verification) {
        const evidence = run.security.evidence.find((entry) => entry.observationId === receipt.evidenceId);
        if (!evidence) throw new Error("github-publication-quotation-origin");
        uses.push({ nodeId: evidence.nodeId, kind: "security", policy: evidence.policy, text: receipt.verification.assessment.evidenceExcerpt });
        uses.push(...mitigationOutputQuotationUses(evidence, receipt).map((use) => ({ ...use, nodeId: evidence.nodeId, kind: "security" as const })));
        uses.push(...textChangeQuotationUses(receipt.verification.assessment.change, evidence.policy, run.security.history).map((use) => ({ ...use, nodeId: evidence.nodeId, kind: "security" as const })));
      }
      uses.push(...run.security.developments.flatMap((entry) => developmentUses(run, entry)));
    }
  }
  const ranking = rankGitHubRepromotions({ snapshot, ...context });
  // These are actual distinct Record fields, including unselected candidates.
  for (const development of [...ranking.candidates.flatMap((entry) => entry.developments), ...ranking.reportedDevelopments]) {
    if (development.kind === "momentum") continue;
    const run = snapshot.developments.runs.find((entry) => development.kind === "release" ? entry.developments.some((item) => item.observationId === development.observationId) : entry.security?.developments.some((item) => item.observationId === development.observationId));
    if (!run) throw new Error("github-publication-quotation-origin");
    uses.push(...developmentUses(run, development));
  }
  for (const development of ranking.reportedDevelopments) {
    if (development.kind === "momentum") continue;
    const run = snapshot.developments.runs.find((entry) => development.kind === "release" ? entry.developments.some((item) => item.observationId === development.observationId) : entry.security?.developments.some((item) => item.observationId === development.observationId))!;
    if (development.kind === "release") uses.push(...developmentUses(run, development));
    else if (development.change && "representation" in development.change && development.change.after.state === "measures") {
      const policy = developmentUses(run, development)[0]!.policy;
      uses.push(...[development.evidenceExcerpt!, ...development.change.after.measures.map((entry) => entry.effect)].map((text) => ({ nodeId: development.nodeId, kind: "security" as const, policy, text })));
    }
  }
  return uses;
}
function omit(original: GitHubRepromotionSnapshot, omissions: Group[]): GitHubRepromotionSnapshot {
  if (!omissions.length) return structuredClone(original);
  const snapshot = structuredClone(original);
  for (const run of snapshot.developments.runs) {
    for (const group of omissions) {
      if (group.kind === "release") {
        run.assessments = run.assessments.filter((entry) => entry.contextFreeze.nodeId !== group.nodeId);
        run.developments = run.developments.filter((entry) => entry.nodeId !== group.nodeId);
      } else if (run.security) {
        run.security.history.entries = run.security.history.entries.filter((entry) => entry.evidence.nodeId !== group.nodeId);
        run.security.history.materials = run.security.history.materials.filter((entry) => entry.origin.evidence.nodeId !== group.nodeId);
        run.security.history.mitigations = run.security.history.mitigations.filter((entry) => entry.origin.evidence.nodeId !== group.nodeId);
        run.security.assessments = run.security.assessments.filter((receipt) => !run.security!.evidence.some((entry) => entry.observationId === receipt.evidenceId && entry.nodeId === group.nodeId));
        run.security.developments = run.security.developments.filter((entry) => entry.nodeId !== group.nodeId);
        if (!run.security.history.unavailableNodeIds.includes(group.nodeId)) run.security.history.unavailableNodeIds.push(group.nodeId);
        run.security.reasons = [...new Set([...run.security.reasons, "github-development-citation-limit"])];
      }
    }
    run.reasons = [...new Set([...run.reasons, "github-development-citation-limit"])];
    const { id: _id, ...metadata } = run; run.id = githubDigest(metadata);
  }
  snapshot.developments.reasons = [...new Set([...snapshot.developments.reasons, "github-development-citation-limit"])];
  snapshot.developments.publicationProjection = { schemaVersion: 1, origins: original.developments.runs.map((run) => ({ slot: run.slot, runId: run.id })), omissions: [...omissions].sort(compare) };
  return GitHubRepromotionSnapshotSchema.parse(snapshot);
}

/** Internal publication facet: supplied limits remain a source-authority check,
 * never caller data or semantic authority. No I/O and no speculative citations. */
export function projectGitHubPublication(original: GitHubRepromotionSnapshot, context: GitHubPublicationContext, limit: (policy: QuotationPolicy) => number | null): DevelopmentSnapshot {
  if (original.developments.publicationProjection) throw new Error("github-publication-projection-origin");
  const omissions: Group[] = [];
  for (let step = 0; step <= 100; step++) {
    const snapshot = omit(original, omissions), uses = inventory(snapshot, context);
    const totals = new Map<string, number>(), maxima = new Map<string, number>();
    for (const use of uses) {
      const maximum = limit(use.policy);
      if (maximum === null) throw new Error("github-publication-quotation-permission");
      totals.set(use.policy.sourceId, (totals.get(use.policy.sourceId) ?? 0) + [...use.text].length);
      maxima.set(use.policy.sourceId, Math.min(500, maximum));
    }
    const exceeded = new Set([...totals].filter(([sourceId, count]) => count > maxima.get(sourceId)!).map(([sourceId]) => sourceId));
    if (!exceeded.size) return snapshot.developments;
    const group = uses.filter((use) => use.text && exceeded.has(use.policy.sourceId)).sort(compare)[0];
    if (!group || step === 100 || omissions.some((entry) => compare(entry, group) === 0)) throw new Error("github-publication-quotation-limit");
    omissions.push({ nodeId: group.nodeId, kind: group.kind });
  }
  throw new Error("github-publication-quotation-limit");
}
