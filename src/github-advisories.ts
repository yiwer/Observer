import { z } from "zod";
import { githubDigest, githubFailure, type GitHubAccess, type GitHubAdapter } from "./github-adapter.ts";
import { GlobalAdvisorySchema, AdvisoryEvidenceSchema, AdvisoryCollectionSchema, AdvisoryDevelopmentSchema, SecurityVerificationV1Schema, SecurityVerificationV2Schema, ghsaIdSchema,
  type AdvisoryEvidence, type AdvisoryCollection, type AdvisoryHistory, type SecurityVerificationInput } from "./github-advisory-contracts.ts";
import type { GitHubRun, ContextFreeze } from "./github-contracts.ts";
import type { QuotationUse } from "./github-quotations.ts";
import { mitigationBodyMatches, mitigationOutputQuotationUses, mitigationQuotationUses, previousMitigations, projectMitigation, textMitigationChange, textChangeQuotationUses } from "./github-mitigations.ts";

export const advisoryOrigins = (collection: AdvisoryCollection) => [...collection.history.entries, ...collection.history.materials.map((entry) => entry.origin),
  ...collection.history.mitigations.map((entry) => entry.origin),
  ...collection.assessments.flatMap((receipt) => receipt.previous.map((entry) => entry.origin))];

export function advisoryRisk(evidence: AdvisoryEvidence): AdvisoryCollection["risks"][number] {
  const complete = evidence.vulnerabilities !== null && evidence.vulnerabilities.length > 0 && evidence.vulnerabilities.every((entry) =>
    entry.package?.name && entry.package.ecosystem && entry.vulnerable_version_range);
  const status = evidence.withdrawnAtUtc !== null ? "withdrawn" : evidence.type !== "reviewed" || evidence.severity === "unknown" || !complete ? "unknown" :
    evidence.severity === "high" || evidence.severity === "critical" ? "high-risk" : "lower-risk";
  return { nodeId: evidence.nodeId, ghsaId: evidence.ghsaId, status, reason: `github-advisory-${status}` };
}
export function initialAdvisoryDevelopment(evidence: AdvisoryEvidence) {
  if (advisoryRisk(evidence).status !== "high-risk" || evidence.publishedAtUtc > evidence.availableAtUtc || evidence.updatedAtUtc > evidence.availableAtUtc) return null;
  const eventId = githubDigest([evidence.nodeId, "security", evidence.ghsaId]);
  const developmentId = githubDigest([eventId, "initial-risk"]);
  return AdvisoryDevelopmentSchema.parse({ nodeId: evidence.nodeId, eventId, developmentId, revisionId: githubDigest([eventId, developmentId]), kind: "security",
    observationId: evidence.observationId, materialRevision: "initial-risk", change: null, evidenceExcerpt: null });
}
const materialSignature = (evidence: AdvisoryEvidence) => githubDigest([evidence.type, evidence.severity, evidence.withdrawnAtUtc, evidence.vulnerabilities]);
const previousMaterials = (history: AdvisoryHistory, evidence: AdvisoryEvidence) => history.materials.filter((entry) => entry.origin.evidence.nodeId === evidence.nodeId && entry.origin.evidence.ghsaId === evidence.ghsaId);
function projectSecurity(evidence: AdvisoryEvidence, collection: AdvisoryCollection) {
  if (!initialAdvisoryDevelopment(evidence) || collection.history.unavailableNodeIds.includes(evidence.nodeId) ||
    collection.risks.some((risk) => risk.nodeId === evidence.nodeId && risk.ghsaId === evidence.ghsaId && risk.reason === "github-development-citation-limit" && risk.status === "unknown")) return null;
  const previous = previousMaterials(collection.history, evidence);
  const receipt = collection.assessments.find((entry) => entry.evidenceId === evidence.observationId);
  const currentMitigation = receipt && projectMitigation(evidence, collection.history, receipt);
  if (currentMitigation) {
    const known = previous.find((entry) => entry.development.change && "representation" in entry.development.change && githubDigest(entry.development.change.after) === githubDigest(currentMitigation.state));
    if (known) return { ...known.development, observationId: evidence.observationId };
    const change = receipt && textMitigationChange(evidence, collection.history, receipt);
    if (change && receipt.verification?.assessment.evidenceExcerpt && previous.some((entry) => entry.development.developmentId === receipt.verification!.assessment.relation.previousDevelopmentId)) {
      const eventId = githubDigest([evidence.nodeId, "security", evidence.ghsaId]), developmentId = githubDigest([eventId, "text-mitigation", change.after]);
      return AdvisoryDevelopmentSchema.parse({ nodeId: evidence.nodeId, eventId, developmentId, revisionId: githubDigest([eventId, developmentId]), kind: "security", observationId: evidence.observationId,
        materialRevision: "new-remediation", change, evidenceExcerpt: receipt.verification.assessment.evidenceExcerpt });
    }
  }
  const exact = previous.find((entry) => materialSignature(entry.origin.evidence) === materialSignature(evidence));
  if (exact) return { ...exact.development, observationId: evidence.observationId };
  if (!previous.length) return initialAdvisoryDevelopment(evidence);
  const assessment = collection.assessments.find((entry) => entry.evidenceId === evidence.observationId)?.verification?.assessment;
  if (!assessment || assessment.conclusion !== "supported" || assessment.observationId !== evidence.observationId || assessment.relation.kind === "unknown") return null;
  const baseline = previous.find((entry) => entry.development.developmentId === assessment.relation.previousDevelopmentId);
  if (!baseline) return null;
  if (assessment.relation.kind === "same") return { ...baseline.development, observationId: evidence.observationId };
  const change = assessment.change;
  if (!change || "representation" in change || !assessment.evidenceExcerpt) return null;
  // Nontrivial range expansion is asserted by the external verifier; these
  // exact old/new checks bind that assertion to the actual supplied material.
  if (change.category === "severity-escalation") {
    if (baseline.origin.evidence.severity !== change.before || evidence.severity !== change.after) return null;
  } else {
    if (githubDigest(change.before) !== githubDigest(baseline.origin.evidence.vulnerabilities) || githubDigest(change.after) !== githubDigest(evidence.vulnerabilities)) return null;
    const changed = change.category === "new-package" ? change.after.some((current) => !change.before.some((old) => githubDigest(old.package) === githubDigest(current.package))) :
      change.after.some((current) => change.before.some((old) => githubDigest(old.package) === githubDigest(current.package) && (change.category === "new-remediation" ?
        !!current.first_patched_version && old.first_patched_version !== current.first_patched_version :
        old.vulnerable_version_range && current.vulnerable_version_range && old.vulnerable_version_range !== current.vulnerable_version_range)));
    if (!changed) return null;
  }
  const eventId = githubDigest([evidence.nodeId, "security", evidence.ghsaId]), developmentId = githubDigest([eventId, change]);
  return AdvisoryDevelopmentSchema.parse({ nodeId: evidence.nodeId, eventId, developmentId, revisionId: githubDigest([eventId, developmentId]), kind: "security", observationId: evidence.observationId,
    materialRevision: change.category, change, evidenceExcerpt: assessment.evidenceExcerpt });
}
export function consistentAdvisories(collection: AdvisoryCollection, run: GitHubRun, availableAtUtc: string, freezes: ContextFreeze[]): boolean {
  if ([...collection.history.entries, ...collection.history.materials.map((entry) => entry.origin), ...collection.history.mitigations.map((entry) => entry.origin)].some((entry) => {
    const { observationId, ...metadata } = entry.evidence;
    return entry.githubRunId !== githubDigest([entry.slot, entry.configuration, entry.evidence.policy]) || observationId !== githubDigest([entry.githubRunId, metadata]) ||
      entry.configuration.sourceId !== entry.evidence.policy.sourceId || entry.developmentConfiguration.sourceId !== entry.evidence.policy.sourceId || entry.availableAtUtc > run.startedAtUtc || entry.slot >= run.scheduledAtUtc ||
      entry.evidence.availableAtUtc > entry.availableAtUtc || entry.evidence.observedAtUtc > entry.evidence.availableAtUtc;
  })) return false;
  for (const evidence of collection.evidence) {
    const { observationId, ...metadata } = evidence;
    if (observationId !== githubDigest([run.id, metadata]) || evidence.availableAtUtc > availableAtUtc || evidence.observedAtUtc > evidence.availableAtUtc || evidence.observedAtUtc < run.startedAtUtc ||
      githubDigest(evidence.policy) !== githubDigest(run.policy) || !run.observations.some((entry) => entry.nodeId === evidence.nodeId && entry.reason === null) ||
      evidence.mapping.some((entry) => entry.nodeId !== evidence.nodeId || entry.availableAtUtc > evidence.availableAtUtc || entry.observedAtUtc > entry.availableAtUtc) ||
      !collection.risks.some((risk) => githubDigest(risk) === githubDigest(advisoryRisk(evidence)))) return false;
  }
  for (const receipt of collection.assessments) {
    const evidence = collection.evidence.find((entry) => entry.observationId === receipt.evidenceId);
    const mitigations = evidence ? previousMitigations(collection.history, evidence) : [];
    const context = "formatVersion" in receipt ? { schemaVersion: 1, formatVersion: 2, evidence, previous: receipt.previous, previousMitigations: mitigations, contextFreeze: receipt.contextFreeze } :
      { schemaVersion: 1, evidence, previous: receipt.previous, contextFreeze: receipt.contextFreeze };
    if (!evidence || receipt.completedAtUtc > availableAtUtc || githubDigest(previousMaterials(collection.history, evidence)) !== githubDigest(receipt.previous) ||
      receipt.contextFreeze.nodeId !== evidence.nodeId || receipt.contextFreeze.slot !== run.scheduledAtUtc || receipt.contextFreeze.frozenAtUtc !== run.startedAtUtc ||
      !freezes.some((entry) => githubDigest(entry) === githubDigest(receipt.contextFreeze)) ||
      "formatVersion" in receipt && githubDigest(receipt.previousMitigationIds) !== githubDigest(mitigations.map((entry) => entry.projection.projectionId)) ||
      githubDigest(context) !== receipt.inputSha256 ||
      receipt.verification && (receipt.verification.inputSha256 !== receipt.inputSha256 || receipt.verification.assessment.observationId !== evidence.observationId ||
        (receipt.verification.assessment.relation.previousDevelopmentId === null ? receipt.verification.assessment.relation.kind !== "unknown" :
          !receipt.previous.some((entry) => entry.development.developmentId === receipt.verification!.assessment.relation.previousDevelopmentId)))) return false;
  }
  return githubDigest(collection.evidence.flatMap((evidence) => { const result = projectSecurity(evidence, collection); return result ? [result] : []; })) === githubDigest(collection.developments);
}

export const securityMaterialQuotationUses = (materials: AdvisoryHistory["materials"], history: AdvisoryHistory): QuotationUse[] => materials.flatMap((entry) => [
  ...(entry.development.evidenceExcerpt ? [{ policy: entry.origin.evidence.policy, text: entry.development.evidenceExcerpt }] : []),
  ...textChangeQuotationUses(entry.development.change, entry.origin.evidence.policy, history)]);
export function securityDevelopmentQuotationUses(evidence: AdvisoryEvidence, collection: AdvisoryCollection, development: ReturnType<typeof projectSecurity>): QuotationUse[] {
  if (!development?.evidenceExcerpt) return [];
  const previous = previousMaterials(collection.history, evidence);
  const reused = previous.find((entry) => entry.development.developmentId === development.developmentId);
  const policy = reused?.origin.evidence.policy ?? evidence.policy;
  return [{ policy, text: development.evidenceExcerpt }, ...textChangeQuotationUses(development.change, policy, collection.history)];
}
export async function collectAdvisories(run: GitHubRun, adapter: GitHubAdapter, access: GitHubAccess, clock: () => string, originalHistory: AdvisoryHistory, freezes: ContextFreeze[], reserveQuotes: (uses: QuotationUse[]) => boolean, assessSecurity?: (input: SecurityVerificationInput) => Promise<unknown>): Promise<AdvisoryCollection> {
  const history = structuredClone(originalHistory);
  let historyQuoteLimited = false;
  for (const freeze of freezes) {
    if (!reserveQuotes([...securityMaterialQuotationUses(history.materials.filter((entry) => entry.origin.evidence.nodeId === freeze.nodeId), history),
      ...mitigationQuotationUses(history.mitigations.filter((entry) => entry.origin.evidence.nodeId === freeze.nodeId))])) {
      history.entries = history.entries.filter((entry) => entry.evidence.nodeId !== freeze.nodeId);
      history.materials = history.materials.filter((entry) => entry.origin.evidence.nodeId !== freeze.nodeId);
      history.mitigations = history.mitigations.filter((entry) => entry.origin.evidence.nodeId !== freeze.nodeId);
      if (!history.unavailableNodeIds.includes(freeze.nodeId)) history.unavailableNodeIds.push(freeze.nodeId);
      historyQuoteLimited = true;
    }
  }
  const result: AdvisoryCollection = { evidence: [], developments: [], history, assessments: [], risks: [], reasons: history.unavailableNodeIds.length ? ["github-advisory-history-unavailable"] : [] };
  if (historyQuoteLimited) result.reasons.push("github-development-citation-limit");
  const descriptions = new Map<string, string | null>();
  const nodes = new Set(run.observations.filter((entry) => entry.reason === null).map((entry) => entry.nodeId));
  let cursor: string | null = null;
  const seen = new Set<string>();
  const listed = new Map<string, string>();
  const signature = (raw: unknown) => {
    const parsed = GlobalAdvisorySchema.safeParse(raw);
    if (!parsed.success) return githubDigest(raw);
    const { source_code_location: _source, repository_advisory_url: _repository, ...material } = parsed.data;
    return githubDigest(material);
  };
  const consume = async (response: { advisories: unknown[]; observedAtUtc: string; responseSha256: string }) => {
      for (const raw of response.advisories) {
        const header = z.object({ ghsa_id: ghsaIdSchema, source_code_location: z.string().nullable(), repository_advisory_url: z.string().nullable() }).safeParse(raw);
        if (!header.success) { result.reasons.push("github-advisory-unmapped"); continue; }
        const mapping: AdvisoryEvidence["mapping"] = [];
        let failed = false;
        for (const field of ["source_code_location", "repository_advisory_url"] as const) {
          const location = header.data[field]; if (location === null) continue;
          try {
            const url = new URL(location);
            const pattern = field === "source_code_location" ? /^\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/ : new RegExp(`^/repos/([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+)/security-advisories/${header.data.ghsa_id}$`);
            const route = url.pathname.match(pattern);
            if (!route || url.origin !== (field === "source_code_location" ? "https://github.com" : "https://api.github.com") || url.username || url.password || url.search || url.hash) { failed = true; continue; }
            const verified = await adapter.repository(route[1]!, access);
            mapping.push({ field, url: location, fullName: verified.repository.full_name, nodeId: verified.repository.node_id, responseSha256: verified.responseSha256,
              observedAtUtc: verified.observedAtUtc, availableAtUtc: clock() });
          } catch { failed = true; }
        }
        const associated = [...new Set(mapping.map((entry) => entry.nodeId))].filter((nodeId) => nodes.has(nodeId));
        if (!associated.length) { result.reasons.push("github-advisory-unmapped"); continue; }
        if (failed || mapping.some((entry) => entry.nodeId !== associated[0])) {
          result.risks.push(...associated.map((nodeId) => ({ nodeId, ghsaId: header.data.ghsa_id, status: "unknown" as const, reason: "github-advisory-mapping-conflict" })));
          result.reasons.push("github-advisory-mapping-conflict"); continue;
        }
        const parsed = GlobalAdvisorySchema.safeParse(raw);
        if (!parsed.success || parsed.data.url !== `https://api.github.com/advisories/${header.data.ghsa_id}` || parsed.data.html_url !== `https://github.com/advisories/${header.data.ghsa_id}`) {
          result.risks.push({ nodeId: associated[0]!, ghsaId: header.data.ghsa_id, status: "unknown", reason: "github-advisory-scope-unavailable" }); result.reasons.push("github-advisory-scope-unavailable"); continue;
        }
        const advisory = parsed.data;
        const normalize = (value: string) => new Date(value).toISOString();
        const vulnerabilities = advisory.vulnerabilities === null ? null : [...new Map(advisory.vulnerabilities.map((entry) => {
          const value = { ...entry, vulnerable_functions: entry.vulnerable_functions === null ? null : [...entry.vulnerable_functions].sort() };
          return [JSON.stringify(value), value] as const;
        })).entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, entry]) => entry);
        const metadata = { nodeId: associated[0]!, ghsaId: advisory.ghsa_id, sourceRepresentation: "global" as const, type: advisory.type, severity: advisory.severity, vulnerabilities,
          publishedAtUtc: normalize(advisory.published_at), updatedAtUtc: normalize(advisory.updated_at), withdrawnAtUtc: advisory.withdrawn_at === null ? null : normalize(advisory.withdrawn_at),
          observedAtUtc: response.observedAtUtc, availableAtUtc: clock(), responseSha256: response.responseSha256, bodySha256: githubDigest(advisory.description), policy: run.policy!, mapping };
        if (Buffer.byteLength(JSON.stringify(metadata)) > 32768) { result.risks.push({ nodeId: associated[0]!, ghsaId: advisory.ghsa_id, status: "unknown", reason: "github-advisory-projection-limit" }); result.reasons.push("github-advisory-projection-limit"); continue; }
        const evidence = AdvisoryEvidenceSchema.parse({ observationId: githubDigest([run.id, metadata]), ...metadata });
        const identity = `${evidence.nodeId}:${evidence.ghsaId}`;
        if (seen.has(identity)) { result.reasons.push("github-advisory-duplicate-observation"); continue; }
        seen.add(identity);
        result.evidence.push(evidence); result.risks.push(advisoryRisk(evidence));
        descriptions.set(evidence.observationId, advisory.description);
      }
  };
  for (let page = 0; page < 3; page++) {
    try {
      const response = await adapter.advisories(cursor, access);
      for (const raw of response.advisories) {
        const header = z.object({ ghsa_id: ghsaIdSchema }).safeParse(raw);
        if (header.success) listed.set(header.data.ghsa_id, signature(raw));
      }
      await consume(response);
      if (!response.paginationValid || response.nextCursor !== null && page === 2) result.reasons.push("github-advisory-pagination-incomplete");
      if (response.nextCursor === null || !response.paginationValid) break;
      cursor = response.nextCursor;
    } catch (error) { result.reasons.push(githubFailure(error)); break; }
  }
  const known = [...new Set(history.entries.map((entry) => entry.evidence.ghsaId))].sort();
  for (const [index, ghsaId] of known.entries()) {
    const associated = [...new Set(history.entries.filter((entry) => entry.evidence.ghsaId === ghsaId).map((entry) => entry.evidence.nodeId))];
    const unknown = (reason: string) => {
      result.risks.push(...associated.map((nodeId) => ({ nodeId, ghsaId, status: "unknown" as const, reason })));
      result.reasons.push(reason);
    };
    if (index >= 50) { unknown("github-advisory-known-limit"); continue; }
    try {
      const response = await adapter.advisory(ghsaId, access);
      const listNodes = [...new Set(result.risks.filter((entry) => entry.ghsaId === ghsaId).map((entry) => entry.nodeId))].sort();
      result.evidence = result.evidence.filter((entry) => entry.ghsaId !== ghsaId);
      result.developments = result.developments.filter((entry) => !associated.includes(entry.nodeId) || entry.eventId !== githubDigest([entry.nodeId, "security", ghsaId]));
      result.risks = result.risks.filter((entry) => entry.ghsaId !== ghsaId);
      for (const nodeId of associated) seen.delete(`${nodeId}:${ghsaId}`);
      await consume({ advisories: [response.advisory], observedAtUtc: response.observedAtUtc, responseSha256: response.responseSha256 });
      const detailNodes = [...new Set(result.risks.filter((entry) => entry.ghsaId === ghsaId).map((entry) => entry.nodeId))].sort();
      if (listed.has(ghsaId) && (listed.get(ghsaId) !== signature(response.advisory) || githubDigest(listNodes) !== githubDigest(detailNodes))) {
        result.risks.push(...[...new Set([...associated, ...listNodes, ...detailNodes])].map((nodeId) => ({ nodeId, ghsaId, status: "unknown" as const, reason: "github-advisory-list-detail-conflict" })));
        result.reasons.push("github-advisory-list-detail-conflict");
      }
      for (const nodeId of associated) if (!result.risks.some((entry) => entry.nodeId === nodeId && entry.ghsaId === ghsaId)) {
        result.risks.push({ nodeId, ghsaId, status: "unknown", reason: "github-advisory-refresh-unmapped" }); result.reasons.push("github-advisory-refresh-unmapped");
      }
    } catch { unknown("github-advisory-refresh-failed"); }
  }
  for (const evidence of result.evidence) {
    let developmentQuoteReserved = false;
    const previous = previousMaterials(history, evidence), contextFreeze = freezes.find((entry) => entry.nodeId === evidence.nodeId);
    const needsAssessment = previous.length && !previous.some((entry) => materialSignature(entry.origin.evidence) === materialSignature(evidence));
    if (needsAssessment && contextFreeze && initialAdvisoryDevelopment(evidence) && !history.unavailableNodeIds.includes(evidence.nodeId)) {
      const previousQuotes = securityMaterialQuotationUses(previous, history);
      if (!reserveQuotes(previousQuotes)) { result.reasons.push("github-development-citation-limit"); continue; }
      const context = { schemaVersion: 1 as const, evidence, previous, contextFreeze }, inputSha256 = githubDigest(context);
      const description = descriptions.get(evidence.observationId) ?? null;
      let verification: z.infer<typeof SecurityVerificationV1Schema> | null = null;
      const remaining = Math.min((access.deadline ?? Date.now()) - Date.now(), access.source.storage.retentionHours * 3600000 - (Date.parse(clock()) - Date.parse(evidence.observedAtUtc)));
      if (assessSecurity && remaining > 0 && !access.authorize()) {
        if (!reserveQuotes(previousQuotes)) result.reasons.push("github-development-citation-limit");
        else {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const output = await Promise.race([assessSecurity({ ...structuredClone(context), inputSha256, evidence: { ...structuredClone(evidence), description } }),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("github-timeout")), remaining); })]);
          const parsed = SecurityVerificationV1Schema.safeParse(output);
          if (parsed.success && parsed.data.inputSha256 === inputSha256 && parsed.data.assessment.observationId === evidence.observationId &&
            (parsed.data.assessment.relation.previousDevelopmentId === null ? parsed.data.assessment.relation.kind === "unknown" :
              previous.some((entry) => entry.development.developmentId === parsed.data.assessment.relation.previousDevelopmentId)) &&
            description?.includes(parsed.data.assessment.evidenceExcerpt) && !access.authorize()) {
            const projectedCollection = { ...result, assessments: [...result.assessments, { evidenceId: evidence.observationId, inputSha256, previous, contextFreeze, verification: parsed.data, completedAtUtc: clock() }] };
            const projected = projectSecurity(evidence, projectedCollection);
            if (reserveQuotes([{ policy: evidence.policy, text: parsed.data.assessment.evidenceExcerpt }, ...securityDevelopmentQuotationUses(evidence, projectedCollection, projected)])) {
              verification = parsed.data; developmentQuoteReserved = true;
            } else result.reasons.push("github-development-citation-limit");
          }
        } catch { /* External body/error strings never become retained receipts. */ }
        finally { clearTimeout(timer); }
        }
      }
      if (!access.authorize()) result.assessments.push({ evidenceId: evidence.observationId, inputSha256, previous, contextFreeze, verification, completedAtUtc: clock() });
    }
    const development = projectSecurity(evidence, result);
    if (development && (developmentQuoteReserved || reserveQuotes(securityDevelopmentQuotationUses(evidence, result, development)))) result.developments.push(development);
    else if (development) {
      result.reasons.push("github-development-citation-limit");
      result.risks.push({ nodeId: evidence.nodeId, ghsaId: evidence.ghsaId, status: "unknown", reason: "github-development-citation-limit" });
    }
    else if (needsAssessment) result.reasons.push("github-advisory-revision-unconfirmed");
    // Optional baseline is ordered after the already valid structural material.
    // The initial risk never calls the model; unchanged scheduled refreshes can
    // establish actual old evidence without inventing a new event.
    if (!needsAssessment && previous.length && contextFreeze && development && assessSecurity && !history.unavailableNodeIds.includes(evidence.nodeId)) {
      const mitigations = previousMitigations(history, evidence);
      const context = { schemaVersion: 1 as const, formatVersion: 2 as const, evidence, previous, previousMitigations: mitigations, contextFreeze };
      const inputSha256 = githubDigest(context), description = descriptions.get(evidence.observationId) ?? null;
      const remaining = Math.min((access.deadline ?? Date.now()) - Date.now(), access.source.storage.retentionHours * 3600000 - (Date.parse(clock()) - Date.parse(evidence.observedAtUtc)));
      if (remaining > 0 && !access.authorize() && reserveQuotes([...securityMaterialQuotationUses(previous, history), ...mitigationQuotationUses(mitigations)])) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const output = await Promise.race([assessSecurity({ ...structuredClone(context), inputSha256, evidence: { ...structuredClone(evidence), description } }),
            new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("github-timeout")), remaining); })]);
          const parsed = SecurityVerificationV2Schema.safeParse(output);
          if (parsed.success && parsed.data.inputSha256 === inputSha256 && parsed.data.assessment.observationId === evidence.observationId &&
            (parsed.data.assessment.relation.previousDevelopmentId === null ? parsed.data.assessment.relation.kind === "unknown" :
              previous.some((entry) => entry.development.developmentId === parsed.data.assessment.relation.previousDevelopmentId)) &&
            description?.includes(parsed.data.assessment.evidenceExcerpt) && !access.authorize()) {
            const receipt = { evidenceId: evidence.observationId, inputSha256, previous, contextFreeze, formatVersion: 2 as const,
              previousMitigationIds: mitigations.map((entry) => entry.projection.projectionId), verification: parsed.data, completedAtUtc: clock() };
            const projectedCollection = { ...result, assessments: [...result.assessments, receipt] }, projected = projectSecurity(evidence, projectedCollection);
            const changed = projected && projected.developmentId !== development.developmentId;
            if (mitigationBodyMatches(description, receipt) && projectMitigation(evidence, history, receipt) &&
              reserveQuotes([...securityMaterialQuotationUses(previous, history), { policy: evidence.policy, text: parsed.data.assessment.evidenceExcerpt },
                ...textChangeQuotationUses(parsed.data.assessment.change, evidence.policy, history), ...mitigationOutputQuotationUses(evidence, receipt),
                ...(changed ? securityDevelopmentQuotationUses(evidence, projectedCollection, projected) : [])])) {
              result.assessments.push(receipt);
              if (changed) result.developments = result.developments.map((entry) => entry.observationId === evidence.observationId ? projected : entry);
            }
          }
        } catch { /* An unavailable optional projection cannot rewrite the base risk. */ }
        finally { clearTimeout(timer); }
      }
    }
  }
  result.reasons = [...new Set(result.reasons)];
  return AdvisoryCollectionSchema.parse(result);
}
