import type { SourcePolicy } from "./collection.ts";
import { policyDigest } from "./collection.ts";
import { githubDigest, githubFailure, type GitHubAccess, type GitHubAdapter } from "./github-adapter.ts";
import type { GitHubRun } from "./github-contracts.ts";
import { collectAdvisories } from "./github-advisories.ts";
import type { AdvisoryHistory } from "./github-advisory-contracts.ts";
import { quotationBudget, type QuotationPolicy } from "./github-quotations.ts";
import { DevelopmentRunSchema, DevelopmentVerificationSchema, ReleaseDevelopmentSchema, type DevelopmentConfiguration, type DevelopmentRun, type GitHubDevelopmentVerifier,
  type ReleaseDevelopment, type ReleaseEvidence, type DevelopmentAssessment, type DevelopmentContext, type PreviousDevelopmentEvidence } from "./github-development-contracts.ts";

export function validPreviousEvidence(previous: ReleaseDevelopment[], evidence: PreviousDevelopmentEvidence[], frozenAtUtc: string): boolean {
  return previous.length === evidence.length && new Set(previous.map((entry) => entry.developmentId)).size === previous.length &&
    new Set(evidence.map((entry) => entry.evidence.observationId)).size === evidence.length && previous.every((development) => {
      const origin = evidence.find((entry) => entry.evidence.observationId === development.observationId);
      if (!origin) return false;
      const { observationId, ...metadata } = origin.evidence;
      return origin.evidence.nodeId === development.nodeId && origin.githubConfiguration.sourceId === origin.evidence.policy.sourceId &&
        origin.configuration.sourceId === origin.evidence.policy.sourceId && origin.availableAtUtc <= frozenAtUtc && origin.evidence.availableAtUtc <= origin.availableAtUtc &&
        origin.evidence.observedAtUtc <= origin.evidence.availableAtUtc && origin.slot <= origin.evidence.observedAtUtc &&
        origin.githubRunId === githubDigest([origin.slot, origin.githubConfiguration, origin.evidence.policy]) && observationId === githubDigest([origin.githubRunId, metadata]);
    });
}

export function developmentPermission(source: SourcePolicy | undefined, configuration: Pick<DevelopmentConfiguration, "sourceId">, atUtc: string, kind: "release" | "security" = "release"): boolean {
  const fields = ["url", "title", "content", "contentSha256"] as const;
  return !!source && source.sourceId === configuration.sourceId && source.review.status === "approved" && source.review.reviewedAtUtc !== null && source.review.reviewedAtUtc <= atUtc &&
    source.collection.enabled && source.collection.readBody && fields.every((field) => source.collection.fields.includes(field) && source.storage.fields.includes(field)) && source.storage.retentionHours > 0 &&
    !!source.github?.events && (kind === "release" ? source.github.events.allowReleaseMetadata && source.github.events.allowReleaseBodyProcessing : source.github.events.allowAdvisoryMetadata && source.github.events.allowAdvisoryBodyProcessing === true) && source.github.events.allowMaterialityModelProcessing &&
    source.github.events.allowMaterialEvidenceProjection && source.github.events.allowEventIdentityHistory && source.model.enabled && fields.every((field) => source.model.fields.includes(field)) &&
    source.distribution.enabled && source.distribution.allowDerivedText && source.distribution.allowPermanentArchive && source.citation.enabled && source.citation.maxCharacters > 0 &&
    source.github.allowDerivedPublication && source.github.irrevocableExportAllowed && source.github.deletionScope === "raw-only";
}

export function developmentRunPermission(source: SourcePolicy | undefined, run: DevelopmentRun, atUtc: string): boolean {
  return (!(run.evidence.length || run.assessments.length || run.developments.length) || developmentPermission(source, run.configuration, atUtc)) &&
    (!(run.security && (run.security.evidence.length || run.security.risks.length || run.security.developments.length || run.security.history.entries.length || run.security.history.materials.length || run.security.assessments.length)) || developmentPermission(source, run.configuration, atUtc, "security"));
}

function projectDevelopment(evidence: ReleaseEvidence, assessment: DevelopmentAssessment, previous: ReleaseDevelopment[]): ReleaseDevelopment | null {
  if (assessment.conclusion !== "supported" || assessment.materiality !== "major" || !assessment.change || !assessment.evidenceExcerpt || assessment.relation.kind === "unknown" ||
    evidence.draft || evidence.prerelease || evidence.publishedAtUtc === null || evidence.publishedAtUtc > evidence.availableAtUtc) return null;
  const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  const known = previous.find((entry) => entry.developmentId === assessment.relation.previousDevelopmentId && entry.nodeId === evidence.nodeId);
  if (assessment.relation.kind === "same" && !known || assessment.relation.kind === "new-material" && assessment.relation.previousDevelopmentId !== null && !known) return null;
  const developmentId = known && assessment.relation.kind === "same" ? known.developmentId : githubDigest([evidence.nodeId, assessment.change.category, normalize(assessment.change.object), normalize(assessment.change.scope)]);
  const eventId = githubDigest([evidence.nodeId, "release", evidence.releaseId]);
  return ReleaseDevelopmentSchema.parse({ nodeId: evidence.nodeId, kind: "release", eventId, developmentId, revisionId: githubDigest([eventId, developmentId]), observationId: evidence.observationId,
    change: assessment.change, evidenceExcerpt: assessment.evidenceExcerpt });
}

export function reconstructDevelopments(run: DevelopmentRun): ReleaseDevelopment[] {
  const output: ReleaseDevelopment[] = [];
  for (const receipt of run.assessments) {
    const evidence = receipt.evidenceIds.map((id) => run.evidence.find((entry) => entry.observationId === id));
    if (evidence.some((entry) => !entry) || !validPreviousEvidence(receipt.previous, receipt.previousEvidence, run.startedAtUtc) ||
      githubDigest({ schemaVersion: 1, evidence, previous: receipt.previous, previousEvidence: receipt.previousEvidence, contextFreeze: receipt.contextFreeze }) !== receipt.inputSha256 || receipt.completedAtUtc > run.availableAtUtc ||
      receipt.contextFreeze.slot !== run.slot || receipt.contextFreeze.frozenAtUtc !== run.startedAtUtc || evidence.some((entry) => entry!.nodeId !== receipt.contextFreeze.nodeId) ||
      !run.contextFreezes.some((entry) => githubDigest(entry) === githubDigest(receipt.contextFreeze))) throw new Error("github-development-input-invalid");
    const verification = receipt.verification;
    if (!verification) continue;
    if (verification.inputSha256 !== receipt.inputSha256 || verification.assessments.length !== evidence.length || new Set(verification.assessments.map((entry) => entry.observationId)).size !== evidence.length) throw new Error("github-development-input-invalid");
    for (const assessment of verification.assessments) {
      const source = evidence.find((entry) => entry!.observationId === assessment.observationId);
      if (!source) throw new Error("github-development-input-invalid");
      const result = projectDevelopment(source, assessment, receipt.previous); if (result) output.push(result);
    }
  }
  return output;
}

export async function collectDevelopments(options: { run: GitHubRun; configuration: DevelopmentConfiguration; source: SourcePolicy | undefined;
  adapter: GitHubAdapter; access: GitHubAccess | undefined; verifier?: GitHubDevelopmentVerifier; clock: () => string;
  contexts: Map<string, DevelopmentContext>; authorizePrevious: (evidence: PreviousDevelopmentEvidence[]) => boolean;
  quotationLimit: (policy: QuotationPolicy) => number | null;
  advisoryHistory: AdvisoryHistory; authorizeAdvisoryHistory: (history: AdvisoryHistory) => boolean }): Promise<DevelopmentRun> {
  const { run, configuration, source, adapter, clock } = options;
  const identity = source ? { sourceId: source.sourceId, policyVersion: source.version, policySha256: policyDigest(source) } : null;
  const reserveUses = quotationBudget(options.quotationLimit);
  const reserveQuotes = (excerpts: string[]) => !!identity && reserveUses(excerpts.map((text) => ({ policy: identity, text })));
  const result: DevelopmentRun = { schemaVersion: 1, id: "0".repeat(64), slot: run.scheduledAtUtc, githubRunId: run.id, configuration,
    configurationSha256: githubDigest(configuration), policy: identity, startedAtUtc: run.startedAtUtc, availableAtUtc: clock(), contextFreezes: [...options.contexts.values()].flatMap((entry) => entry.freeze ? [entry.freeze] : []), reasons: [], evidence: [], assessments: [], developments: [] };
  if (!configuration.releases) result.reasons.push("github-release-disabled");
  else if (!source || !options.access || !developmentPermission(source, configuration, clock())) result.reasons.push("github-development-permission-unavailable");
  else {
    const access = { ...options.access, authorize: () => options.access!.authorize() ?? (developmentPermission(source, configuration, clock()) ? null : "github-permission-changed" as const) };
    for (const repository of run.observations.filter((entry) => entry.reason === null)) {
      const previous = options.contexts.get(repository.nodeId) ?? { previous: [], previousEvidence: [], unavailable: true, freeze: null };
      if (previous.unavailable || !previous.freeze || !options.authorizePrevious(previous.previousEvidence)) { result.reasons.push("github-development-history-unavailable"); continue; }
      const material: (ReleaseEvidence & { body: string })[] = [];
      try {
        for (let page = 1; page <= 2; page++) {
          const response = await adapter.releases(repository.fullName, page, access);
          for (const release of response.releases) {
            const body = release.body ?? "";
            const metadata = { nodeId: repository.nodeId, fullName: repository.fullName, releaseId: release.id, releaseNodeId: release.node_id, tag: release.tag_name,
              draft: release.draft, prerelease: release.prerelease, publishedAtUtc: release.published_at === null ? null : new Date(release.published_at).toISOString(),
              updatedAtUtc: release.updated_at == null ? null : new Date(release.updated_at).toISOString(), observedAtUtc: response.observedAtUtc, availableAtUtc: clock(),
              responseSha256: response.responseSha256, bodySha256: githubDigest(body), policy: identity! };
            const evidence = { observationId: githubDigest([run.id, metadata]), ...metadata };
            result.evidence.push(evidence);
            if (!release.draft && !release.prerelease && evidence.publishedAtUtc !== null && evidence.publishedAtUtc <= evidence.availableAtUtc && body) material.push({ ...evidence, body });
          }
          if (!response.paginationValid || response.nextPage !== null && page === 2) { result.reasons.push("github-release-pagination-incomplete"); break; }
          if (response.nextPage === null) break;
        }
      } catch (error) { result.reasons.push(githubFailure(error)); continue; }
      if (!material.length) continue;
      const previousQuotes = previous.previous.map((entry) => ({ text: entry.evidenceExcerpt,
        policy: previous.previousEvidence.find((origin) => origin.evidence.observationId === entry.observationId)!.evidence.policy }));
      // This receipt retains its own complete previous projection. A later
      // model call is a second, actual use of those same quoted characters.
      if (!reserveUses(previousQuotes)) { result.reasons.push("github-development-citation-limit"); continue; }
      const evidence = material.map(({ body: _body, ...entry }) => entry);
      const context = { schemaVersion: 1 as const, evidence, previous: previous.previous, previousEvidence: previous.previousEvidence, contextFreeze: previous.freeze };
      const inputSha256 = githubDigest(context);
      let verification: DevelopmentRun["assessments"][number]["verification"] = null;
      const remaining = Math.min((options.access.deadline ?? Date.now()) - Date.now(), source.storage.retentionHours * 3600000 - (Date.parse(clock()) - Date.parse(material[0]!.observedAtUtc)));
      if (options.verifier && remaining > 0 && !access.authorize() && options.authorizePrevious(previous.previousEvidence)) {
        if (!reserveUses(previousQuotes)) result.reasons.push("github-development-citation-limit");
        else {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const output = await Promise.race([options.verifier.assess({ ...context, inputSha256, evidence: structuredClone(material) }),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("github-timeout")), remaining); })]);
          const parsed = DevelopmentVerificationSchema.safeParse(output);
          if (parsed.success && parsed.data.inputSha256 === inputSha256 && parsed.data.assessments.length === material.length &&
            new Set(parsed.data.assessments.map((entry) => entry.observationId)).size === material.length && parsed.data.assessments.every((entry) => {
              const original = material.find((item) => item.observationId === entry.observationId);
              return !!original && original.body.includes(entry.evidenceExcerpt) && [...entry.evidenceExcerpt].length <= Math.min(500, source.citation.maxCharacters);
            }) && !access.authorize() && options.authorizePrevious(previous.previousEvidence)) {
            const projected = parsed.data.assessments.flatMap((assessment) => {
              const original = evidence.find((entry) => entry.observationId === assessment.observationId)!;
              const development = projectDevelopment(original, assessment, previous.previous); return development ? [development.evidenceExcerpt] : [];
            });
            if (reserveQuotes([...parsed.data.assessments.map((entry) => entry.evidenceExcerpt), ...projected])) verification = parsed.data;
            else result.reasons.push("github-development-citation-limit");
          }
        } catch { /* Source and external error bodies never enter persistent receipts. */ }
        finally { clearTimeout(timer); }
        }
      }
      if (!options.authorizePrevious(previous.previousEvidence)) { result.reasons.push("github-development-history-unavailable"); continue; }
      result.assessments.push({ inputSha256, evidenceIds: evidence.map((entry) => entry.observationId), previous: context.previous, previousEvidence: context.previousEvidence, contextFreeze: context.contextFreeze, verification, completedAtUtc: clock() });
      if (!verification) result.reasons.push("github-release-major-unconfirmed");
      else for (const assessment of verification.assessments) {
        if (assessment.materiality === "routine") result.reasons.push("github-release-not-material");
        else if (assessment.conclusion !== "supported" || assessment.materiality !== "major" || !assessment.change || assessment.relation.kind === "unknown") result.reasons.push("github-release-major-unconfirmed");
      }
    }
  }
  if (configuration.advisories) {
    if (options.access && source && developmentPermission(source, configuration, clock(), "security")) {
      const access = { ...options.access, authorize: () => options.access!.authorize() ?? (developmentPermission(source, configuration, clock(), "security") && options.authorizeAdvisoryHistory(options.advisoryHistory) ? null : "github-permission-changed" as const) };
      result.security = await collectAdvisories(run, adapter, access, clock, options.advisoryHistory, result.contextFreezes, reserveUses, options.verifier?.assessSecurity?.bind(options.verifier));
      result.reasons.push(...result.security.reasons);
    } else result.reasons.push("github-advisory-permission-unavailable");
  }
  result.availableAtUtc = clock();
  result.developments = reconstructDevelopments(result);
  result.reasons = [...new Set(result.reasons)];
  const { id: _id, ...receipt } = result;
  result.id = githubDigest(receipt);
  return DevelopmentRunSchema.parse(result);
}
