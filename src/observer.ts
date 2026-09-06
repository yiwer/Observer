import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AgentResultSchema, ProduceRequestSchema, PublishedReportSchema, SixEditionRequestSchema, EventEditionRequestSchema, InterestEditionRequestSchema, DomainEditionRequestSchema, DiscourseEditionRequestSchema, GitHubEditionRequestSchema, EditionResearchSchema, EditionResearchEnvelopeSchema, ReportRecordSchema,
  editionNames, type AgentRunner, type AgentResult, type PublishedReport, type ReportRecord, type EditionRunner, type EditionResearch,
} from "./contracts.ts";
import { SourcePolicySchema, policyDigest, sourceFields, type SourcePolicy } from "./collection.ts";
import type { Claim, SemanticVerifier } from "./gate-contracts.ts";
import { evaluatePublication, gatedMarkdown } from "./publication-gate.ts";
import { evaluateBatchedPublication } from "./batched-publication-gate.ts";
import { arrangeEditions, sixEditionMarkdown, consistentRecord } from "./six-edition.ts";
import { arrangeEvents, legacyFingerprint, type LegacyHistory } from "./event-history.ts";
import { projectEventReceipt } from "./event-projection.ts";
import { consistentEvents } from "./event-integrity.ts";
import { consistentArchive } from "./archive-integrity.ts";
import { interestConfiguration } from "./interest-profile.ts";
import { projectSelectionReceipt } from "./interest-selection.ts";
import { projectDomainReceipt } from "./domain-evidence.ts";
import { DiscourseConfigurationSchema } from "./discourse-contracts.ts";
import { prepareDiscourse, type DiscourseOptions } from "./discourse.ts";
import { GitHubSnapshotSchema, type GitHubObservationReader } from "./github-contracts.ts";
import { emptyGitHubSnapshot, githubMarkdown, consistentGitHubRecord, priorEditorialRecord } from "./github-publication.ts";

export class ObserverError extends Error {
  code: string;
  agentRun?: AgentResult;
  constructor(code: string, agentRun?: AgentResult) {
    super(code); this.code = code;
    if (agentRun) this.agentRun = agentRun;
  }
}

export interface ObserverOptions {
  databasePath: string;
  ownerToken: string;
  mode: "production" | "test-fixture";
  clock?: () => string;
  runner?: AgentRunner;
  editionRunner?: EditionRunner;
  sourcePolicies?: SourcePolicy[];
  verifier?: SemanticVerifier;
  discourse?: DiscourseOptions;
  github?: GitHubObservationReader;
  sourcePolicyReader?: () => unknown;
}

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function markdown(record: ReportRecord): string {
  if (record.schemaVersion === 8) return githubMarkdown(record);
  if (record.schemaVersion === 3 || record.schemaVersion === 4 || record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) return sixEditionMarkdown(record);
  if (record.schemaVersion === 2) return gatedMarkdown(record);
  const story = record.stories[0]!;
  const overview = Object.entries(editionNames).map(([edition, label]) =>
    `- ${label}：${edition === story.edition ? story.title : "Coverage Gap（本票尚未实现该栏）"}`,
  );
  const claims = story.claims.map((claim) => `${claim.text}\n\n${claim.evidenceIds.map((evidenceId) => {
    const evidence = record.evidenceBundle.evidence.find((item) => item.id === evidenceId)!;
    const decision = record.sourcePolicyDecisions.find((item) => item.evidenceId === evidenceId)!;
    return `来源：${decision.decision === "source-policy-v1" ? decision.attribution + " — " : ""}[${evidence.title}](${evidence.url}) [${evidence.id}]`;
  }).join("\n\n")}`);
  return [
    `# Observer Daily Brief — ${record.businessDate}`,
    "> 自动化测试固定替身产物；未经过真实研究或生产准入。",
    "## Today Overview", overview.join("\n"),
    `## ${editionNames[story.edition]}`, `### ${story.title}`, ...claims,
    ...(story.quotations ?? []).map((quote) => `引文 [${quote.evidenceId}]：${quote.text}`),
  ].join("\n\n") + "\n";
}

export function createObserver(options: ObserverOptions) {
  const interest = interestConfiguration(options.databasePath);
  const policies = (options.sourcePolicies ?? []).map((source) => SourcePolicySchema.parse(source));
  const currentPolicies = () => options.sourcePolicyReader ? SourcePolicySchema.array().parse(options.sourcePolicyReader()) : policies;
  function checkedPolicy(evidence: { sourceId: string; policyVersion: number; policySha256: string }, authority = currentPolicies()) {
    const source = authority.find((source) => source.sourceId === evidence.sourceId);
    if (!source || source.review.status !== "approved" || !source.collection.enabled || source.version !== evidence.policyVersion || policyDigest(source) !== evidence.policySha256) throw new ObserverError("source-policy-invalid");
    return source;
  }
  if (Buffer.byteLength(options.ownerToken) < 32) throw new ObserverError("invalid-owner-token");
  mkdirSync(dirname(options.databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(options.databasePath);
  database.exec("PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;");
  const storageVersion = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (storageVersion > 1) { database.close(); throw new ObserverError("unsupported-storage-version"); }
  if (storageVersion === 0) {
    database.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE reports (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END;
      CREATE TRIGGER immutable_report_delete BEFORE DELETE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END;
      PRAGMA user_version = 1;
      COMMIT;
    `);
  }

  const historicalReport = (versionId: string): PublishedReport | undefined => {
    const row = database.prepare("SELECT payload FROM reports WHERE id = ?").get(versionId);
    if (!row) return undefined;
    const report = PublishedReportSchema.parse(JSON.parse(String(row.payload)));
    if ((report.record.schemaVersion !== 4 && report.record.schemaVersion !== 5 && (report.record.schemaVersion !== 6 && report.record.schemaVersion !== 7 && report.record.schemaVersion !== 8)) || !consistentArchive(report, versionId)) throw new ObserverError("history-integrity-failed");
    return report;
  };

  return {
    importInterestProfile(filePath: string) { return interest.import(filePath); },
    exportInterestProfile(filePath: string) { return interest.export(filePath); },
    async produce(input: unknown, runOptions?: { signal?: AbortSignal }) {
      if (options.mode !== "test-fixture") throw new ObserverError("publication-disabled");
      const parsedRequest = ProduceRequestSchema.or(SixEditionRequestSchema).or(EventEditionRequestSchema).or(InterestEditionRequestSchema).or(DomainEditionRequestSchema).or(DiscourseEditionRequestSchema).or(GitHubEditionRequestSchema).safeParse(input);
      if (!parsedRequest.success) throw new ObserverError("invalid-request");
      const request = parsedRequest.data;
      const requestPolicies = () => { try { return currentPolicies(); } catch (error) { if (request.schemaVersion === 7) return []; throw error; } };
      const frozenAtUtc = (request.schemaVersion === 6 || request.schemaVersion === 7) ? (options.clock ?? (() => new Date().toISOString()))() : undefined;
      const discourseConfiguration = (request.schemaVersion === 6 || request.schemaVersion === 7) ? DiscourseConfigurationSchema.parse(options.discourse?.configuration ?? { schemaVersion: 1, version: 1, groups: [] }) : undefined;
      const github = request.schemaVersion === 7 ? (() => {
        try { return GitHubSnapshotSchema.parse(options.github?.snapshot(request.evidenceBundle.cutoffUtc) ?? emptyGitHubSnapshot(request.evidenceBundle.cutoffUtc)); }
        catch { return { ...emptyGitHubSnapshot(request.evidenceBundle.cutoffUtc), reasons: ["github-observation-unavailable" as const] }; }
      })() : undefined;
      let unsupportedGitHubInput = false;
      if (request.schemaVersion === 7) {
        const githubSources = new Set(requestPolicies().filter((source) => source.edition === "github-projects").map((source) => source.sourceId));
        if (github?.configuration) githubSources.add(github.configuration.sourceId);
        const rejectedIds = new Set([...request.editions.filter((entry) => entry.edition === "github-projects").flatMap((entry) => entry.evidenceIds),
          ...request.evidenceBundle.evidence.filter((evidence) => githubSources.has(evidence.sourceId)).map((evidence) => evidence.id)]);
        unsupportedGitHubInput = rejectedIds.size > 0;
        if (request.evidenceBundle.schemaVersion === 1) request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        else request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !rejectedIds.has(id)) }));
      }
      const interestProfile = request.schemaVersion === 4 || request.schemaVersion === 5 || (request.schemaVersion === 6 || request.schemaVersion === 7) ? interest.snapshot() : undefined;
      if ((request.schemaVersion === 6 || request.schemaVersion === 7)) {
        // Ordinary Evidence cannot declare itself an eligible social sample. Only the
        // separately captured, policy-bound sample path can populate this Edition.
        const socialSourceIds = new Set([...requestPolicies().filter((source) => source.edition === "social-discourse").map((source) => source.sourceId), ...discourseConfiguration!.groups.map((group) => group.sourceId)]);
        const socialIds = new Set([...request.editions.filter((entry) => entry.edition === "social-discourse").flatMap((entry) => entry.evidenceIds), ...request.evidenceBundle.evidence.filter((evidence) => socialSourceIds.has(evidence.sourceId)).map((evidence) => evidence.id)]);
        if (request.evidenceBundle.schemaVersion === 1) request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !socialIds.has(evidence.id));
        else request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !socialIds.has(evidence.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !socialIds.has(id)) }));
      }
      const discourse = (request.schemaVersion === 6 || request.schemaVersion === 7) ? await prepareDiscourse({ request, configuration: discourseConfiguration!, frozenAtUtc: frozenAtUtc!,
        adapter: options.discourse?.adapter, policies: requestPolicies, clock: options.clock ?? (() => new Date().toISOString()), ...(runOptions?.signal ? { signal: runOptions.signal } : {}) }) : undefined;
      if (discourse && (request.schemaVersion === 6 || request.schemaVersion === 7) && request.evidenceBundle.schemaVersion === 2) {
        request.evidenceBundle.evidence.push(...discourse.evidence);
        request.editions.find((entry) => entry.edition === "social-discourse")!.evidenceIds.push(...discourse.evidence.map((evidence) => evidence.id));
      }
      const modelPolicies = (request.schemaVersion === 6 || request.schemaVersion === 7) ? requestPolicies() : undefined;
      if ((request.schemaVersion === 6 || request.schemaVersion === 7)) {
        // Classification and grants share the final pre-model authority after sample I/O.
        const capturedIds = new Set(discourse!.evidence.map((evidence) => evidence.id));
        const socialSources = new Set(modelPolicies!.filter((source) => source.edition === "social-discourse").map((source) => source.sourceId));
        const rejectedIds = new Set(request.evidenceBundle.evidence.filter((evidence) => socialSources.has(evidence.sourceId) && !capturedIds.has(evidence.id)).map((evidence) => evidence.id));
        if (request.evidenceBundle.schemaVersion === 1) request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        else request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !rejectedIds.has(id)) }));
      }
      if (request.schemaVersion === 7) {
        const githubSources = new Set(modelPolicies!.filter((source) => source.edition === "github-projects").map((source) => source.sourceId));
        const rejectedIds = new Set(request.evidenceBundle.evidence.filter((evidence) => githubSources.has(evidence.sourceId)).map((evidence) => evidence.id));
        unsupportedGitHubInput ||= rejectedIds.size > 0;
        if (request.evidenceBundle.schemaVersion === 1) request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        else request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !rejectedIds.has(id)) }));
      }
      if (request.schemaVersion === 1 ? !options.runner : request.evidenceBundle.evidence.length > 0 && !options.editionRunner) throw new ObserverError("runner-unavailable");
      const bundle = request.evidenceBundle;
      const modelRequest = structuredClone(request);
      if ((modelRequest.schemaVersion === 6 || modelRequest.schemaVersion === 7)) delete modelRequest.discourseSamples;
      if (!bundle.evidence.length && request.schemaVersion === 1) throw new ObserverError("evidence-unavailable");
      if (request.schemaVersion !== 1 && (new Set(request.editions.map((entry) => entry.edition)).size !== 6 || request.editions.some((entry) => new Set(entry.evidenceIds).size !== entry.evidenceIds.length || entry.evidenceIds.some((id) => !bundle.evidence.some((evidence) => evidence.id === id))))) throw new ObserverError("invalid-edition-input");
      if (modelRequest.evidenceBundle.schemaVersion === 2) {
        for (const evidence of modelRequest.evidenceBundle.evidence) {
          const source = checkedPolicy(evidence, modelPolicies);
          if (!source.model.enabled) throw new ObserverError("model-forbidden");
          if (evidence.expiresAtUtc <= (options.clock ?? (() => new Date().toISOString()))()) throw new ObserverError("evidence-expired");
          for (const field of sourceFields) if (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.model.fields.includes(field)) delete evidence[field];
        }
      }
      if (bundle.businessDate !== request.businessDate || bundle.configurationId !== request.configurationId ||
        new Set(bundle.evidence.map((evidence) => evidence.id)).size !== bundle.evidence.length) {
        throw new ObserverError("invalid-bundle-identity");
      }
      if (bundle.windowStartUtc >= bundle.cutoffUtc || bundle.evidence.some((evidence) =>
        evidence.discoveredAtUtc > evidence.retrievedAtUtc || evidence.retrievedAtUtc > bundle.cutoffUtc ||
        (evidence.publishedAtUtc != null && evidence.publishedAtUtc > bundle.cutoffUtc))) {
        throw new ObserverError("invalid-evidence-window");
      }
      if (request.evidenceBundle.evidence.some((evidence) => evidence.content !== undefined && evidence.contentSha256 !== undefined && digest(evidence.content) !== evidence.contentSha256)) {
        throw new ObserverError("evidence-integrity-failed");
      }
      let runnerOutput: unknown;
      try { runnerOutput = modelRequest.schemaVersion === 1 ? await options.runner!.run(structuredClone(modelRequest), runOptions) : bundle.evidence.length ? await options.editionRunner!.run(structuredClone(modelRequest), runOptions) : {
        schemaVersion: 2, taskId: request.taskId, evidenceBundleId: bundle.id, configurationId: request.configurationId,
        editions: modelRequest.editions.map((entry) => ({ edition: entry.edition, status: "no-evidence" })),
      }; }
      catch { throw new ObserverError("agent-unknown"); }
      let research: EditionResearch | undefined;
      let results: AgentResult[];
      let publishedAtUtc = (options.clock ?? (() => new Date().toISOString()))();
      const validFixtureRun = (result: AgentResult) => {
        const protocolFixture = ["codex", "claude"].includes(result.provider) && result.execution?.provenance === "protocol-fixture" && options.verifier;
        return (result.provider === "fixture" || !!protocolFixture) && result.startedAtUtc >= bundle.cutoffUtc &&
          result.startedAtUtc <= result.finishedAtUtc && result.finishedAtUtc <= publishedAtUtc;
      };
      if (request.schemaVersion !== 1) {
        const parsed = EditionResearchEnvelopeSchema.safeParse(runnerOutput);
        if (!parsed.success) throw new ObserverError("agent-invalid-output");
        research = { ...parsed.data, editions: parsed.data.editions.map((entry) => {
          const checked = EditionResearchSchema.shape.editions.element.safeParse(entry);
          return checked.success ? checked.data : { edition: entry.edition, status: "invalid-output" as const };
        }) };
        if (research.taskId !== request.taskId || research.evidenceBundleId !== bundle.id || research.configurationId !== request.configurationId ||
          new Set(research.editions.map((entry) => entry.edition)).size !== 6 || new Set(request.editions.map((entry) => entry.edition)).size !== 6) throw new ObserverError("uncorrelated-agent-result");
        research.editions = research.editions.map((inputEntry) => {
          const entry = discourse && inputEntry.edition === "social-discourse" && inputEntry.status === "completed" && inputEntry.result.status === "succeeded" ? {
            ...inputEntry, result: { ...inputEntry.result, stories: inputEntry.result.stories.filter((story) => !(story.schemaVersion === 2 && story.edition === "social-discourse" &&
              story.claims.every((claim) => claim.kind === "analysis" && claim.evidenceIds.length === 1 && claim.evidenceIds[0] === `discourse-${story.eventClusterId}`) &&
              discourse.modelFailure([`discourse-${story.eventClusterId}`]))) },
          } : inputEntry;
          const assigned = request.editions.find((item) => item.edition === entry.edition)!;
          const invalid = { edition: entry.edition, status: "invalid-output" as const };
          if (entry.status === "no-evidence") return assigned.evidenceIds.length ? invalid : entry;
          if (entry.status === "invalid-output") return entry;
          if (!assigned.evidenceIds.length || entry.result.taskId !== `${request.taskId}:${entry.edition}` ||
            entry.result.evidenceBundleId !== bundle.id || entry.result.configurationId !== request.configurationId ||
            !validFixtureRun(entry.result) ||
            entry.result.status === "succeeded" && entry.result.stories.some((story) => story.edition !== entry.edition || story.claims.some((claim) => claim.evidenceIds.some((id) => !assigned.evidenceIds.includes(id))))) return invalid;
          return entry;
        });
        results = research.editions.flatMap((entry) => entry.status === "completed" ? [entry.result] : []);
      } else {
        const parsedResult = AgentResultSchema.safeParse(runnerOutput);
        if (!parsedResult.success) throw new ObserverError("agent-invalid-output");
        results = [parsedResult.data];
      }
      for (const result of results) {
        if (!validFixtureRun(result)) throw new ObserverError("invalid-fixture-run");
        if ((request.schemaVersion === 1 && result.taskId !== request.taskId) || result.evidenceBundleId !== request.evidenceBundle.id || result.configurationId !== request.configurationId) {
          throw new ObserverError("uncorrelated-agent-result");
        }
        if (request.schemaVersion === 1 && result.status !== "succeeded") throw new ObserverError(`agent-${result.failure.category}`, result);
      }
      const stories = results.flatMap((result) => result.status === "succeeded" ? result.stories : []);
      if ((options.verifier || research) && stories.some((story) => story.schemaVersion === 1)) throw new ObserverError("legacy-candidate-disabled");
      const evidenceIds = new Set(request.evidenceBundle.evidence.map((evidence) => evidence.id));
      if (stories.some((story) => story.schemaVersion === 1 && story.claims.some((claim) => claim.evidenceIds.some((id) => !evidenceIds.has(id))))) {
        throw new ObserverError("unknown-evidence-reference");
      }
      if (stories.some((story) => story.schemaVersion === 1 && story.quotations?.some((quote) => !evidenceIds.has(quote.evidenceId)))) throw new ObserverError("unknown-evidence-reference");
      const gatedCandidates = stories.every((story) => story.schemaVersion === 2);
      if (bundle.schemaVersion === 2 && !gatedCandidates) {
        const quotationTotals = new Map<string, number>();
        for (const quotation of stories.flatMap((story) => story.schemaVersion === 1 ? story.quotations ?? [] : [])) {
          const evidence = bundle.evidence.find((item) => item.id === quotation.evidenceId)!;
          const total = (quotationTotals.get(evidence.sourceId) ?? 0) + [...quotation.text].length;
          if (total > checkedPolicy(evidence).citation.maxCharacters) throw new ObserverError("citation-limit");
          quotationTotals.set(evidence.sourceId, total);
        }
        for (const evidence of bundle.evidence) {
          const source = checkedPolicy(evidence);
          if (!source.distribution.enabled || !source.distribution.allowDerivedText) throw new ObserverError("distribution-forbidden");
          if (!source.distribution.allowPermanentArchive) throw new ObserverError("archive-forbidden");
          if (!source.citation.enabled) throw new ObserverError("citation-forbidden");
          const quotations = stories.flatMap((story) => story.schemaVersion === 1 ? story.quotations ?? [] : []).filter((quote) => quote.evidenceId === evidence.id);
          const researchContent = modelRequest.evidenceBundle.evidence.find((item) => item.id === evidence.id)?.content;
          if (quotations.some((quote) => !evidence.content?.includes(quote.text) || !researchContent?.includes(quote.text))) throw new ObserverError("quotation-unverified");
          for (const field of sourceFields) if (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.distribution.fields.includes(field)) delete evidence[field];
          // The mutable source cache is the only place that retains source body text.
          delete evidence.content;
          if (!evidence.url || !evidence.title) throw new ObserverError("citation-unavailable");
        }
      }
      if (discourse) await discourse.refresh();
      const story = stories[0];
      const commonRecord = {
        schemaVersion: 1, id: `${request.businessDate}-v1-record`,
        businessDate: request.businessDate, businessTimezone: "Asia/Shanghai",
        configurationId: request.configurationId, taskId: request.taskId, applicationVersion: "0.1.0",
        evidenceBundle: request.evidenceBundle, stories,
        coverageGaps: (Object.keys(editionNames) as Array<keyof typeof editionNames>)
          .filter((edition) => edition !== story?.edition)
          .map((edition) => ({ edition, reason: "not-implemented-in-fixture-spine" })),
        sourcePolicyDecisions: bundle.schemaVersion === 1 ? bundle.evidence.map((evidence) => ({ evidenceId: evidence.id, decision: "test-fixture-only" })) : bundle.evidence.filter((evidence) => !discourse?.modelFailure([evidence.id])).map((evidence) => ({ evidenceId: evidence.id, decision: "source-policy-v1", sourceId: evidence.sourceId, policyVersion: evidence.policyVersion, policySha256: evidence.policySha256, attribution: checkedPolicy(evidence).citation.attribution })),
        agentResult: results[0],
      };
      let record: ReportRecord;
      if (stories.every((story) => story.schemaVersion === 2)) {
        const discourseMembers = discourse ? stories.filter((story) => story.edition === "social-discourse").map((story) => ({ id: story.id, groupId: story.eventClusterId, claimIds: story.claims.map((claim) => claim.id) })) : [];
        const quotationTotals = new Map<string, number>();
        for (const claim of stories.flatMap((story) => story.claims)) {
          if (claim.kind !== "quotation") continue;
          const evidence = bundle.evidence.find((item) => item.id === claim.evidenceIds[0]);
          if (!evidence) continue;
          quotationTotals.set(evidence.sourceId, (quotationTotals.get(evidence.sourceId) ?? 0) + [...claim.originalText].length + (claim.translated ? [...claim.text].length : 0));
        }
        const modelPolicyCheck = (ids: string[], atUtc: string): string | null => {
          if (request.schemaVersion === 7 && ids.some((id) => bundle.evidence.some((evidence) => evidence.id === id && requestPolicies().some((source) => source.sourceId === evidence.sourceId && source.edition === "github-projects")))) {
            unsupportedGitHubInput = true; return "github-ordinary-candidate-unsupported";
          }
          const socialFailure = discourse?.modelFailure(ids);
          if (socialFailure) return socialFailure;
          if (bundle.schemaVersion === 1) return null;
          for (const id of ids) {
            const evidence = bundle.evidence.find((item) => item.id === id)!;
            let source: SourcePolicy;
            try { source = checkedPolicy(evidence); } catch { return "source-policy-invalid"; }
            if (evidence.sourceType !== source.sourceType) return "source-policy-invalid";
            if (evidence.expiresAtUtc <= atUtc) return "evidence-expired";
            if (!source.model.enabled) return "model-forbidden";
          }
          return null;
        };
        const policyCheck = (ids: string[], claim: Claim, atUtc: string): string | null => {
          const modelFailure = modelPolicyCheck(ids, atUtc);
          if (modelFailure) return modelFailure;
          if (bundle.schemaVersion === 1) return null;
          for (const id of ids) {
            const evidence = bundle.evidence.find((item) => item.id === id)!;
            let source: SourcePolicy;
            try { source = checkedPolicy(evidence); } catch { return "source-policy-invalid"; }
            if (evidence.sourceType !== source.sourceType) return "source-policy-invalid";
            if (!source.distribution.enabled || !source.distribution.allowDerivedText) return "distribution-forbidden";
            if (!source.distribution.allowPermanentArchive) return "archive-forbidden";
            if (!source.citation.enabled) return "citation-forbidden";
            if (claim.kind === "quotation" && (quotationTotals.get(source.sourceId) ?? 0) > source.citation.maxCharacters) return "citation-limit";
            if (!["url", "title"].every((field) => source.collection.fields.includes(field as "url" | "title") && source.storage.fields.includes(field as "url" | "title") && source.distribution.fields.includes(field as "url" | "title")) || !evidence.url || !evidence.title) return "citation-unavailable";
          }
          return null;
        };
        const { completedAtUtc, ...gated } = await (research ? evaluateBatchedPublication : evaluatePublication)({ request: { ...modelRequest, schemaVersion: 1 }, stories, verifier: options.verifier,
          ...(request.schemaVersion === 4 || request.schemaVersion === 5 || (request.schemaVersion === 6 || request.schemaVersion === 7) ? { recordVerifierDispatch: true } : {}),
          ...(request.schemaVersion === 5 || (request.schemaVersion === 6 || request.schemaVersion === 7) ? { domainRules: true } : {}),
          ...(discourse ? { beforeVerification: discourse.refresh, afterVerification: discourse.refresh, claimEligibility: discourse.claimEligibility, semanticEligibility: discourse.semanticEligibility } : {}),
          clock: options.clock ?? (() => new Date().toISOString()), modelPolicyCheck, publicationPolicyCheck: policyCheck });
        publishedAtUtc = completedAtUtc;
        const finalPolicyFailures = new Set<string>();
        if (discourse) {
          await discourse.refresh();
          publishedAtUtc = (options.clock ?? (() => new Date().toISOString()))();
          gated.publicationGate.checkedAtUtc = publishedAtUtc;
          for (const decision of gated.publicationGate.decisions) {
            const claim = stories.find((story) => story.id === decision.storyId)?.claims.find((claim) => claim.id === decision.claimId);
            const failure = discourse.modelFailure(decision.evidenceIds) ?? (decision.outcome !== "quarantined" && claim ? policyCheck(decision.evidenceIds, claim, publishedAtUtc) : null);
            if (failure) { finalPolicyFailures.add(JSON.stringify([decision.storyId, decision.claimId])); decision.outcome = "quarantined"; decision.reason = failure; decision.policy = { status: "failed", reason: failure }; decision.semantic = { status: "not-evaluated", reason: "policy-failed" }; }
          }
          gated.stories = gated.stories.flatMap((story) => { const claims = story.claims.filter((claim) => gated.publicationGate.decisions.some((decision) => decision.storyId === story.id && decision.claimId === claim.id && decision.outcome === "published")); return claims.length ? [{ ...story, claims, title: claims.find((claim) => claim.kind === "fact")?.text ?? "陈述级核验" }] : []; });
          gated.publicationGate.unconfirmedItems = gated.publicationGate.unconfirmedItems.filter((item) => gated.publicationGate.decisions.some((decision) => decision.storyId === item.storyId && decision.claimId === item.claimId && decision.outcome === "unconfirmed"));
        }
        const project = (verification: Parameters<typeof projectEventReceipt>[0]) => {
          const projected = projectDomainReceipt(projectSelectionReceipt(projectEventReceipt(verification, gated.stories, request.schemaVersion >= 3), gated.stories, request.schemaVersion >= 4, modelRequest.evidenceBundle.evidence, discourse?.nativeStoryIds(gated.stories)), gated.publicationGate.decisions, request.schemaVersion >= 5, modelRequest.evidenceBundle.evidence);
          return projected ? { ...projected, assessments: projected.assessments.filter((assessment) => !finalPolicyFailures.has(JSON.stringify([assessment.storyId, assessment.claimId])) && (!discourse || !assessment.evidence.some((entry) => discourse.modelFailure([entry.evidenceId])))).map(({ discourse: _discourse, ...assessment }) => assessment) } : null;
        };
        if (gated.publicationGate.schemaVersion === 1) gated.publicationGate.verification = project(gated.publicationGate.verification);
        else for (const batch of gated.publicationGate.batches) batch.verification = project(batch.verification);
        const eligibleIds = new Set([...gated.stories.flatMap((story) => story.claims.flatMap((claim) => claim.evidenceIds)), ...gated.publicationGate.unconfirmedItems.flatMap((item) => item.evidenceIds)]);
        // The input digest and permitted Evidence identities preserve review correlation without raw text.
        const archiveBundle = { ...bundle, schemaVersion: 3 as const, sourceBundleSchemaVersion: bundle.schemaVersion, coverageGaps: bundle.schemaVersion === 2 ? bundle.coverageGaps : [], evidence: bundle.evidence.filter((evidence) => eligibleIds.has(evidence.id)).map((evidence) => {
          const { content: _content, ...metadata } = structuredClone(evidence);
          if ("policyVersion" in metadata) {
            const source = checkedPolicy(metadata);
            for (const field of sourceFields) if (field !== "content" && (!source.collection.fields.includes(field) || !source.storage.fields.includes(field) || !source.distribution.fields.includes(field))) delete metadata[field];
            const { policyVersion, policySha256, expiresAtUtc: _expiry, trust: _trust, ...retained } = metadata;
            return { ...retained, origin: { kind: "collected" as const, policyVersion, policySha256 } };
          }
          return { ...metadata, origin: { kind: "fixture" as const } };
        }) };
        const result = results[0];
        const agentMetadata = result?.status === "succeeded" ? (({ stories: _stories, ...metadata }) => metadata)(result) : result;
        record = { ...commonRecord, schemaVersion: 2, evidenceBundle: archiveBundle, agentResult: agentMetadata, ...gated,
          sourcePolicyDecisions: commonRecord.sourcePolicyDecisions.filter((decision) => eligibleIds.has(decision.evidenceId)),
          coverageGaps: Object.keys(editionNames).filter((edition) => !gated.stories.some((story) => story.edition === edition)).map((edition) => ({ edition, reason: "no-publishable-claims" })),
        } as ReportRecord;
        if (research) {
          if (request.schemaVersion === 3 || request.schemaVersion === 4 || request.schemaVersion === 5 || (request.schemaVersion === 6 || request.schemaVersion === 7)) {
            const legacyHistory: LegacyHistory = { versionIds: [], fingerprints: new Set() };
            const withheldHistory = new Set<string>();
            const history = database.prepare("SELECT id, payload FROM reports WHERE id < ? ORDER BY id").all(`${request.businessDate}-v1`).flatMap((row) => {
              const old = PublishedReportSchema.parse(JSON.parse(String(row.payload)));
              if (!consistentArchive(old, String(row.id))) throw new ObserverError("history-integrity-failed");
              if (old.record.businessDate >= request.businessDate || old.version.publishedAtUtc > bundle.cutoffUtc || old.record.evidenceBundle.cutoffUtc > bundle.cutoffUtc) return [];
              if (old.record.schemaVersion !== 4 && old.record.schemaVersion !== 5 && (old.record.schemaVersion !== 6 && old.record.schemaVersion !== 7 && old.record.schemaVersion !== 8)) {
                if (old.record.stories.some((story) => story.edition !== "github-projects")) legacyHistory.versionIds.push(old.version.id);
                for (const story of old.record.stories) if (story.edition !== "github-projects") for (const claim of story.claims) {
                  const fingerprint = legacyFingerprint(claim, old.record.evidenceBundle.evidence);
                  if (fingerprint) legacyHistory.fingerprints.add(fingerprint);
                }
                return [];
              }
              if (!consistentEvents(old.record, historicalReport)) throw new ObserverError("history-integrity-failed");
              for (const evidence of [...old.record.evidenceBundle.evidence.flatMap((evidence) => evidence.origin.kind === "collected" ? [{ sourceId: evidence.sourceId, ...evidence.origin }] : []), ...old.record.eventClusters.flatMap((cluster) => cluster.historyPolicies)]) {
                try {
                  const source = checkedPolicy(evidence);
                  if (!source.distribution.enabled || !source.distribution.allowDerivedText || !source.distribution.allowPermanentArchive || !source.citation.enabled) withheldHistory.add(old.version.id);
                } catch { withheldHistory.add(old.version.id); }
              }
              return [old.record];
            });
            record = arrangeEvents({ ...record, stories: discourse ? record.stories.filter((story) => story.edition !== "social-discourse") : record.stories } as Parameters<typeof arrangeEvents>[0], research, history, legacyHistory, withheldHistory, interestProfile);
            if (request.schemaVersion >= 5 && record.schemaVersion === 5) record = { ...record, schemaVersion: 6, editorialContract: "observer-canonical-v4", domainRules: "observer-domain-evidence-v1" };
            if ((request.schemaVersion === 6 || request.schemaVersion === 7) && record.schemaVersion === 6) record = discourse!.project(record, gated.stories, discourseMembers);
          } else record = arrangeEditions(record as Parameters<typeof arrangeEditions>[0], research);
        }
      } else {
        if (stories.some((story) => story.schemaVersion !== 1)) throw new ObserverError("agent-invalid-output");
        record = commonRecord as ReportRecord;
      }
      if (request.schemaVersion === 7 && record.schemaVersion === 7) {
        const failure = github?.configuration ? options.github ? options.github.authorize(github) : "github-observation-unavailable" : null;
        const snapshot = failure ? { ...github!, runs: [], identities: [], watchItems: [], exclusions: [], reasons: [failure] } : github!;
        if (unsupportedGitHubInput) snapshot.reasons = [...snapshot.reasons, "github-ordinary-candidate-unsupported"];
        record = { ...record, schemaVersion: 8, editorialContract: "observer-canonical-v6", github: snapshot,
          coverageGaps: [...record.coverageGaps.filter((gap) => gap.edition !== "github-projects"),
            ...snapshot.reasons.map((reason) => ({ edition: "github-projects" as const, reason })),
            ...(unsupportedGitHubInput ? [{ edition: "github-projects" as const, reason: "github-ordinary-candidate-unsupported" }] : [])] };
        if (!consistentGitHubRecord(record)) throw new ObserverError("canonical-github-record-invalid");
      }
      record = ReportRecordSchema.parse(record);
      if ((record.schemaVersion === 3 || record.schemaVersion === 4 || record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) && !consistentRecord(record)) throw new ObserverError("canonical-record-invalid");
      if ((record.schemaVersion === 4 || record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) && !consistentEvents(record, historicalReport)) throw new ObserverError("canonical-event-record-invalid");
      const canonicalMarkdown = markdown(record);
      const report = PublishedReportSchema.parse({
        version: {
          schemaVersion: 1, id: `${request.businessDate}-v1`, briefId: request.businessDate,
          businessDate: request.businessDate, version: 1,
          publishedAtUtc,
          revisionReason: "initial", previousVersionId: null, provenance: "test-fixture",
          reportRecordId: record.id, canonicalMarkdownSha256: digest(canonicalMarkdown),
          ...(record.schemaVersion === 8 || record.schemaVersion === 3 || record.schemaVersion === 4 || record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7) ? { schemaVersion: record.schemaVersion - 1, editorialContract: record.editorialContract, reportRecordSha256: digest(JSON.stringify(record)) } : {}),
        },
        record, canonicalMarkdown,
      });
      const insertion = database.prepare("INSERT INTO reports (id, payload) VALUES (?, ?) ON CONFLICT(id) DO NOTHING")
        .run(report.version.id, JSON.stringify(report));
      if (insertion.changes === 0) throw new ObserverError("version-already-exists");
      return report.version;
    },
    readReport(versionId: string, credential: string | undefined): PublishedReport {
      if (!credential || !timingSafeEqual(Buffer.from(digest(credential)), Buffer.from(digest(options.ownerToken)))) {
        throw new ObserverError("unauthorized");
      }
      const row = database.prepare("SELECT payload FROM reports WHERE id = ?").get(versionId);
      if (!row) throw new ObserverError("not-found");
      const report = PublishedReportSchema.parse(JSON.parse(String(row.payload)));
      if (options.mode === "production" && report.version.provenance === "test-fixture") throw new ObserverError("not-found");
      if (!consistentArchive(report, versionId)) throw new ObserverError("canonical-integrity-failed");
      if (report.record.schemaVersion === 8) {
        if (!consistentEvents(priorEditorialRecord(report.record), historicalReport)) throw new ObserverError("canonical-integrity-failed");
        try {
          for (const run of report.record.github.runs) {
            if (!run.policy) continue;
            const source = checkedPolicy(run.policy);
            if (!source.github?.allowRepositorySnapshots || !source.github.allowIdentityHistory || !source.github.allowDerivedPublication || !source.github.irrevocableExportAllowed ||
              source.github.deletionScope !== "raw-only" || !source.distribution.enabled || !source.distribution.allowDerivedText || !source.distribution.allowPermanentArchive || !source.citation.enabled) throw new Error("revoked");
          }
        } catch { throw new ObserverError("not-found"); }
      }
      if ((report.record.schemaVersion === 4 || report.record.schemaVersion === 5 || (report.record.schemaVersion === 6 || report.record.schemaVersion === 7 || report.record.schemaVersion === 8)) && !consistentEvents(report.record, historicalReport)) throw new ObserverError("canonical-integrity-failed");
      if (report.record.evidenceBundle.schemaVersion !== 1) {
        try {
          const identities = report.record.evidenceBundle.schemaVersion === 2 ? report.record.evidenceBundle.evidence : [...report.record.evidenceBundle.evidence.flatMap((evidence) => evidence.origin.kind === "collected" ? [{ sourceId: evidence.sourceId, ...evidence.origin }] : []), ...(report.record.schemaVersion === 4 || report.record.schemaVersion === 5 || (report.record.schemaVersion === 6 || report.record.schemaVersion === 7 || report.record.schemaVersion === 8) ? report.record.eventClusters.flatMap((cluster) => cluster.historyPolicies) : [])];
          for (const evidence of identities) {
            const source = checkedPolicy(evidence);
            if (!source.distribution.enabled || !source.distribution.allowDerivedText || !source.distribution.allowPermanentArchive || !source.citation.enabled) throw new Error("revoked");
          }
        } catch { throw new ObserverError("not-found"); }
      }
      return report;
    },
    close() { database.close(); },
  };
}
export type Observer = ReturnType<typeof createObserver>;
