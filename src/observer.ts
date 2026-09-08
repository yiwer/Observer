import { createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AgentResultSchema, ProduceRequestSchema, PublishedReportSchema, SixEditionRequestSchema, EventEditionRequestSchema, InterestEditionRequestSchema, DomainEditionRequestSchema, DiscourseEditionRequestSchema, GitHubEditionRequestSchema, GitHubHeatRequestSchema, GitHubRepromotionRequestSchema, RoutedRequestSchema, EditionResearchSchema, EditionResearchEnvelopeSchema, ReportRecordSchema,
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
import { GitHubSnapshotSchema, GitHubRankingSnapshotSchema, type GitHubObservationReader, type DevelopmentHistoryReadScope, type SyncResult } from "./github-contracts.ts";
import { emptyGitHubSnapshot, githubMarkdown, consistentGitHubRecord } from "./github-publication.ts";
import { rankGitHub, consistentGitHubRanking, githubRankingMarkdown, type GitHubCoverageHistory } from "./github-ranking.ts";
import { githubPermission } from "./github-observations.ts";
import { GitHubRepromotionSnapshotSchema, type GitHubEventHistory, type GitHubRepromotionSnapshot } from "./github-development-contracts.ts";
import { consistentGitHubRepromotion, emptyDevelopments, githubRepromotionMarkdown, rankGitHubRepromotions } from "./github-repromotion.ts";
import { developmentPermission, developmentRunPermission } from "./github-developments.ts";
import { advisoryOrigins } from "./github-advisories.ts";
import { projectGitHubPublication } from "./github-publication-budget.ts";
import { createProviderRouting, RoutingBoundaryError, type RoutingOptions } from "./provider-routing.ts";
import { MAX_ROUTING_AUDIT_BYTES, RoutingReceiptSchema } from "./routing-contracts.ts";
import { finalizeRoutedRecord, routedMarkdown } from "./routed-publication.ts";

export class ObserverError extends Error {
  code: string;
  agentRun?: AgentResult;
  runId?: string;
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
  routing?: RoutingOptions;
}

function digest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function developmentCapture(versionId: string, businessDate: string, cutoffUtc: string, snapshot: GitHubRepromotionSnapshot): string {
  const current = snapshot.github.runs.at(-1);
  return digest(JSON.stringify({ schemaVersion: 1, versionId, businessDate, cutoffUtc,
    githubConfigurationSha256: snapshot.github.configurationSha256,
    currentGitHubRun: current ? { id: current.id, slot: current.scheduledAtUtc, policy: current.policy } : null,
    developmentConfiguration: snapshot.developments.configuration, developmentConfigurationSha256: snapshot.developments.configurationSha256,
    origins: snapshot.developments.publicationProjection?.origins ?? snapshot.developments.runs.map((run) => ({ slot: run.slot, runId: run.id })),
    ...(snapshot.developments.momentum ? { momentumFreeze: snapshot.developments.momentum.freeze } : {}) }));
}

/** This commitment belongs to the independently stored row, not the mutable
 * archive projection. Local hash consistency alone cannot prove its capture. */
function reportFromRow(row: Record<string, unknown>): PublishedReport {
  const report = PublishedReportSchema.parse(JSON.parse(String(row.payload)));
  const routingCapture = row.routing_capture_sha256 ?? null;
  if (report.record.schemaVersion === 11 ? routingCapture !== digest(JSON.stringify(report.record.routing)) : routingCapture !== null) throw new ObserverError("routing-integrity-failed");
  if (row.id !== report.version.id) throw new ObserverError("history-integrity-failed");
  const capture = row.development_capture_sha256;
  if ((report.record.schemaVersion === 10 || report.record.schemaVersion === 11)) {
    if (typeof capture !== "string" || !/^[a-f0-9]{64}$/.test(capture) || capture !== developmentCapture(report.version.id, report.record.businessDate,
      report.record.evidenceBundle.cutoffUtc, { schemaVersion: 1, github: report.record.github, developments: report.record.githubDevelopments })) throw new ObserverError("history-integrity-failed");
  } else if (capture !== null) throw new ObserverError("history-integrity-failed");
  return report;
}

function markdown(record: ReportRecord): string {
  if (record.schemaVersion === 11) return routedMarkdown(record);
  if (record.schemaVersion === 10) return githubRepromotionMarkdown(record);
  if (record.schemaVersion === 9) return githubRankingMarkdown(record);
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

  database.exec("BEGIN IMMEDIATE");
  try {
    const column = () => database.prepare("PRAGMA table_xinfo(reports)").all().find((entry) => entry.name === "development_capture_sha256");
    if (!column()) database.exec("ALTER TABLE reports ADD COLUMN development_capture_sha256 TEXT");
    const installed = column()!;
    if (String(installed.type).trim().toUpperCase() !== "TEXT" || installed.hidden !== 0 || installed.pk !== 0 || installed.notnull !== 0 ||
      installed.dflt_value !== null && String(installed.dflt_value).trim().toUpperCase() !== "NULL") throw new ObserverError("unsupported-development-capture-storage");
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); database.close(); throw error; }

  try {
    database.exec("BEGIN IMMEDIATE");
    const terminalTrigger = "CREATE TRIGGER immutable_routing_terminal BEFORE UPDATE ON routing_runs WHEN json_extract(OLD.payload, '$.status') IN ('published','failed') BEGIN SELECT RAISE(ABORT, 'immutable routing terminal'); END";
    const column = () => database.prepare("PRAGMA table_xinfo(reports)").all().find((entry) => entry.name === "routing_capture_sha256");
    const table = () => database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='routing_runs'").get();
    if (!column() && !table() && options.routing) {
      database.exec("ALTER TABLE reports ADD COLUMN routing_capture_sha256 TEXT");
      database.exec("CREATE TABLE routing_runs (id TEXT PRIMARY KEY, payload TEXT NOT NULL)");
      database.exec(terminalTrigger);
    }
    if (Boolean(column()) !== Boolean(table())) throw new ObserverError("unsupported-routing-storage");
    if (column()) {
      const installed = column()!;
      const columns = database.prepare("PRAGMA table_xinfo(routing_runs)").all();
      if (database.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='immutable_routing_terminal'").get()?.sql !== terminalTrigger) throw new ObserverError("unsupported-routing-storage");
      if (installed.type !== "TEXT" || installed.hidden !== 0 || installed.notnull !== 0 || installed.dflt_value !== null ||
        columns.length !== 2 || columns[0]!.name !== "id" || columns[0]!.type !== "TEXT" || columns[0]!.pk !== 1 ||
        columns[1]!.name !== "payload" || columns[1]!.type !== "TEXT" || columns[1]!.notnull !== 1 || columns.some((entry) => entry.hidden !== 0 || entry.dflt_value !== null)) throw new ObserverError("unsupported-routing-storage");
    }
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); database.close(); throw error; }

  const routingInstalled = database.prepare("PRAGMA table_xinfo(reports)").all().some((entry) => entry.name === "routing_capture_sha256");
  const reportColumns = `id,payload,development_capture_sha256,${routingInstalled ? "routing_capture_sha256" : "NULL AS routing_capture_sha256"}`;

  function storedRun(runId: string) {
    if (!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='routing_runs'").get()) throw new ObserverError("not-found");
    const header = database.prepare("SELECT id,length(CAST(payload AS BLOB)) AS bytes FROM routing_runs WHERE id=?").get(runId);
    if (!header) throw new ObserverError("not-found");
    if (Number(header.bytes) > MAX_ROUTING_AUDIT_BYTES) throw new ObserverError("routing-integrity-failed");
    const row = database.prepare("SELECT id,payload FROM routing_runs WHERE id=?").get(runId)!;
    try {
      const receipt = RoutingReceiptSchema.parse(JSON.parse(String(row.payload)));
      if (Number(header.bytes) > receipt.configuration.limits.maxAuditBytes) throw new Error("audit-budget");
      if (receipt.runId !== row.id || receipt.configurationSha256 !== digest(JSON.stringify(receipt.configuration))) throw new Error("identity");
      return receipt;
    } catch { throw new ObserverError("routing-integrity-failed"); }
  }

  function storedReport(row: Record<string, unknown>) {
    const report = reportFromRow(row);
    if (report.record.schemaVersion === 11) {
      const run = storedRun(report.record.routing.runId);
      if (run.status !== "published" || run.reportVersionId !== report.version.id ||
        digest(JSON.stringify({ ...run, status: "ready", reportVersionId: null })) !== digest(JSON.stringify(report.record.routing))) throw new ObserverError("routing-integrity-failed");
    }
    return report;
  }

  const historicalReport = (versionId: string): PublishedReport | undefined => {
    const row = database.prepare(`SELECT ${reportColumns} FROM reports WHERE id = ?`).get(versionId);
    if (!row) return undefined;
    const report = storedReport(row);
    if ((report.record.schemaVersion !== 4 && report.record.schemaVersion !== 5 && (report.record.schemaVersion !== 6 && report.record.schemaVersion !== 7 && (report.record.schemaVersion !== 8 && report.record.schemaVersion !== 9 && (report.record.schemaVersion !== 10 && report.record.schemaVersion !== 11)))) || !consistentArchive(report, versionId)) throw new ObserverError("history-integrity-failed");
    return report;
  };

  function githubHistory(businessDate: string, cutoffUtc: string): GitHubCoverageHistory {
    const history: GitHubCoverageHistory = { entries: [], unavailableVersionIds: [] };
    for (const row of database.prepare(`SELECT ${reportColumns} FROM reports WHERE id < ? ORDER BY id`).all(`${businessDate}-v1`)) {
      let old: PublishedReport;
      try {
        old = storedReport(row);
        if (!consistentArchive(old, String(row.id))) throw new Error("invalid-history");
      } catch {
        // An invalid archive cannot establish its own age or node identity. Do not
        // guess novelty, and do not make another edition's current output fail.
        history.unavailableVersionIds.push(String(row.id));
        continue;
      }
      if (old.record.businessDate >= businessDate || old.version.publishedAtUtc > cutoffUtc || old.record.evidenceBundle.cutoffUtc > cutoffUtc) continue;
      // At 90 days all ordinary decay and novelty effects have expired. Rights on
      // the old report still protect its own read path, not an unrelated new issue.
      if (Date.parse(old.version.publishedAtUtc) <= Date.parse(cutoffUtc) - 90 * 86400000) continue;
      if (old.record.schemaVersion !== 8 && old.record.schemaVersion !== 9 && (old.record.schemaVersion !== 10 && old.record.schemaVersion !== 11)) {
        if (Date.parse(old.version.publishedAtUtc) > Date.parse(cutoffUtc) - 90 * 86400000 && old.record.stories.some((story) => story.edition === "github-projects")) history.unavailableVersionIds.push(old.version.id);
        continue;
      }
      const nodeIds = (old.record.schemaVersion === 10 || old.record.schemaVersion === 11) ? old.record.githubRepromotion.selectedNodeIds : old.record.schemaVersion === 8 ? old.record.github.watchItems.map((item) => item.nodeId) : old.record.githubRanking.selectedNodeIds;
      if (!nodeIds.length) continue;
      const policies = [...new Map(old.record.github.runs.flatMap((run) => run.policy ? [[run.policy.policySha256, run.policy] as const] : [])).values()];
      try {
        if (!old.record.github.configuration || !policies.length) throw new Error("missing-authority");
        for (const policy of policies) if (!githubPermission(checkedPolicy(policy), old.record.github.configuration, (options.clock ?? (() => new Date().toISOString()))(), true)) throw new Error("revoked");
      } catch { history.unavailableVersionIds.push(old.version.id); continue; }
      history.entries.push({ versionId: old.version.id, businessDate: old.record.businessDate, publishedAtUtc: old.version.publishedAtUtc,
        reportRecordSha256: digest(JSON.stringify(old.record)), nodeIds, policies });
    }
    return history;
  }

  function developmentHistoryRead<T>(use: (scope: DevelopmentHistoryReadScope) => T & SyncResult<T>): T {
    if (!options.github?.withDevelopmentHistoryRead) throw new ObserverError("github-development-history-unavailable");
    return options.github.withDevelopmentHistoryRead<T>(use);
  }
  function githubEventHistory(businessDate: string, cutoffUtc: string, scope: DevelopmentHistoryReadScope): GitHubEventHistory {
    const history: GitHubEventHistory = { entries: [], unavailableVersionIds: [] };
    const rows = database.prepare(`SELECT ${reportColumns} FROM reports WHERE id < ? ORDER BY id LIMIT 10001`).all(`${businessDate}-v1`);
    if (rows.length > 10000) return { entries: [], unavailableVersionIds: rows.map((row) => String(row.id)) };
    for (const row of rows) {
      let old: PublishedReport;
      try { old = storedReport(row); if (!consistentArchive(old, String(row.id))) throw new Error("invalid-history"); }
      catch { history.unavailableVersionIds.push(String(row.id)); continue; }
      if (old.record.businessDate >= businessDate || old.version.publishedAtUtc > cutoffUtc || old.record.evidenceBundle.cutoffUtc > cutoffUtc || (old.record.schemaVersion !== 10 && old.record.schemaVersion !== 11)) continue;
      if (!old.record.githubRepromotion.reportedDevelopments.length) continue;
      const ownPolicies = [...new Map(old.record.githubDevelopments.runs.flatMap((run) => run.policy ? [[run.policy.policySha256, run.policy] as const] : [])).values()];
      const previousEvidence = old.record.githubDevelopments.runs.flatMap((run) => run.assessments.flatMap((receipt) => receipt.previousEvidence));
      const securityOrigins = old.record.githubDevelopments.runs.flatMap((run) => run.security ? advisoryOrigins(run.security) : []);
      const required = [...new Map([...ownPolicies, ...previousEvidence.map((entry) => entry.evidence.policy), ...securityOrigins.map((entry) => entry.evidence.policy)].map((identity) => [identity.policySha256, identity] as const)).values()];
      try {
        if (!old.record.githubDevelopments.configuration || !required.length) throw new Error("missing-authority");
        for (const run of old.record.githubDevelopments.runs) if (!run.policy || !developmentRunPermission(checkedPolicy(run.policy), run, (options.clock ?? (() => new Date().toISOString()))())) throw new Error("revoked");
        for (const run of old.record.githubDevelopments.runs) for (const receipt of run.assessments) for (const previous of receipt.previousEvidence) {
          if (!developmentPermission(checkedPolicy(previous.evidence.policy), previous.configuration, (options.clock ?? (() => new Date().toISOString()))())) throw new Error("revoked");
        }
        for (const previous of securityOrigins) if (!developmentPermission(checkedPolicy(previous.evidence.policy), previous.developmentConfiguration,
          (options.clock ?? (() => new Date().toISOString()))(), "security")) throw new Error("revoked");
        if (scope.authorizeDevelopmentHistory({ schemaVersion: 1, github: old.record.github, developments: old.record.githubDevelopments },
          { interestProfile: old.record.interestProfile, coverageHistory: old.record.githubRanking.history, eventHistory: old.record.githubRepromotion.eventHistory,
            algorithmVersion: old.record.githubRepromotion.algorithmVersion }) !== null) throw new Error("invalid-development-history");
      } catch { history.unavailableVersionIds.push(old.version.id); continue; }
      history.entries.push({ versionId: old.version.id, businessDate: old.record.businessDate, publishedAtUtc: old.version.publishedAtUtc, reportRecordSha256: digest(JSON.stringify(old.record)),
        nodeIds: old.record.githubRepromotion.selectedNodeIds, developments: old.record.githubRepromotion.reportedDevelopments.map(({ nodeId, kind, eventId, developmentId, revisionId, observationId }) =>
          ({ nodeId, kind, eventId, developmentId, revisionId, observationId })), policies: required });
    }
    return history;
  }

  return {
    importInterestProfile(filePath: string) { return interest.import(filePath); },
    exportInterestProfile(filePath: string) { return interest.export(filePath); },
    async produce(input: unknown, runOptions?: { signal?: AbortSignal }) {
      if (options.mode !== "test-fixture") throw new ObserverError("publication-disabled");
      const parsedRequest = ProduceRequestSchema.or(SixEditionRequestSchema).or(EventEditionRequestSchema).or(InterestEditionRequestSchema).or(DomainEditionRequestSchema).or(DiscourseEditionRequestSchema).or(GitHubEditionRequestSchema).or(GitHubHeatRequestSchema).or(GitHubRepromotionRequestSchema).or(RoutedRequestSchema).safeParse(input);
      if (!parsedRequest.success) throw new ObserverError("invalid-request");
      const routed = parsedRequest.data.schemaVersion === 10;
      const request = parsedRequest.data.schemaVersion === 10 ? { ...parsedRequest.data, schemaVersion: 9 as const } : parsedRequest.data;
      if (routed && !options.routing) throw new ObserverError("routing-unavailable");
      const collectedInput = routed ? structuredClone(request.evidenceBundle) : undefined;
      const routing = routed && request.schemaVersion === 9 ? createProviderRouting(options.routing!, request, (receipt) => {
        const safe = RoutingReceiptSchema.parse(receipt);
        const payload = JSON.stringify(safe);
        if (Buffer.byteLength(payload) > Math.min(MAX_ROUTING_AUDIT_BYTES, safe.configuration.limits.maxAuditBytes)) throw new ObserverError("routing-audit-capacity-exceeded");
        database.prepare("INSERT INTO routing_runs (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(safe.runId, payload);
      }, () => {
        const bundle = collectedInput!;
        const linkEvidenceIds = bundle.evidence.filter((evidence) => {
          if (!evidence.url) return false;
          if (bundle.schemaVersion === 1) return true; // Explicit Owned fixture input only; production produce remains disabled.
          if (!("policyVersion" in evidence)) return false;
          try {
            const source = checkedPolicy(evidence);
            return source.storage.fields.includes("url") && source.distribution.enabled && source.distribution.fields.includes("url") && source.citation.enabled && evidence.expiresAtUtc > (options.clock ?? (() => new Date().toISOString()))();
          } catch { return false; }
        }).map((evidence) => evidence.id);
        return { linkEvidenceIds, status: !linkEvidenceIds.length ? "unavailable" : linkEvidenceIds.length < bundle.evidence.length || bundle.schemaVersion === 2 && bundle.coverageGaps.length ? "partial" : "available" };
      }, (ids) => {
        if (request.evidenceBundle.schemaVersion === 1) return;
        for (const id of ids) {
          const evidence = request.evidenceBundle.evidence.find((entry) => entry.id === id);
          if (!evidence) throw new RoutingBoundaryError("evidence-unavailable");
          let source: SourcePolicy;
          try { source = checkedPolicy(evidence); } catch { throw new RoutingBoundaryError("source-policy-invalid"); }
          if (!source.collection.enabled || !source.model.enabled) throw new RoutingBoundaryError("model-forbidden");
          if (evidence.expiresAtUtc <= (options.clock ?? (() => new Date().toISOString()))()) throw new RoutingBoundaryError("evidence-expired");
        }
      }, runOptions?.signal) : undefined;
      const editionRunner = routing ?? options.editionRunner;
      const verifier = routing ?? options.verifier;
      try {
      const requestPolicies = () => { try { return currentPolicies(); } catch (error) { if ((request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) return []; throw error; } };
      const frozenAtUtc = (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) ? (options.clock ?? (() => new Date().toISOString()))() : undefined;
      const discourseConfiguration = (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) ? DiscourseConfigurationSchema.parse(options.discourse?.configuration ?? { schemaVersion: 1, version: 1, groups: [] }) : undefined;
      const repromotion = request.schemaVersion === 9 ? (() => {
        try { return GitHubRepromotionSnapshotSchema.parse(options.github?.repromotionSnapshot?.(request.evidenceBundle.cutoffUtc) ?? { schemaVersion: 1, github: { ...emptyGitHubSnapshot(request.evidenceBundle.cutoffUtc), schemaVersion: 2 }, developments: emptyDevelopments(request.evidenceBundle.cutoffUtc) }); }
        catch { return GitHubRepromotionSnapshotSchema.parse({ schemaVersion: 1, github: { ...emptyGitHubSnapshot(request.evidenceBundle.cutoffUtc), schemaVersion: 2, reasons: ["github-observation-unavailable"] }, developments: emptyDevelopments(request.evidenceBundle.cutoffUtc) }); }
      })() : undefined;
      const capturedDevelopment = repromotion ? developmentCapture(`${request.businessDate}-v1`, request.businessDate, request.evidenceBundle.cutoffUtc, repromotion) : null;
      const github = repromotion?.github ?? ((request.schemaVersion === 7 || request.schemaVersion === 8) ? (() => {
        try {
          return request.schemaVersion === 8 ? GitHubRankingSnapshotSchema.parse(options.github?.rankingSnapshot?.(request.evidenceBundle.cutoffUtc) ?? { ...emptyGitHubSnapshot(request.evidenceBundle.cutoffUtc), schemaVersion: 2 }) :
            GitHubSnapshotSchema.parse(options.github?.snapshot(request.evidenceBundle.cutoffUtc) ?? emptyGitHubSnapshot(request.evidenceBundle.cutoffUtc));
        }
        catch {
          const unavailable = { ...emptyGitHubSnapshot(request.evidenceBundle.cutoffUtc), reasons: ["github-observation-unavailable" as const] };
          return request.schemaVersion === 8 ? GitHubRankingSnapshotSchema.parse({ ...unavailable, schemaVersion: 2 }) : unavailable;
        }
      })() : undefined);
      let unsupportedGitHubInput = false;
      if ((request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) {
        const githubSources = new Set(requestPolicies().filter((source) => source.edition === "github-projects").map((source) => source.sourceId));
        if (github?.configuration) githubSources.add(github.configuration.sourceId);
        const rejectedIds = new Set([...request.editions.filter((entry) => entry.edition === "github-projects").flatMap((entry) => entry.evidenceIds),
          ...request.evidenceBundle.evidence.filter((evidence) => githubSources.has(evidence.sourceId)).map((evidence) => evidence.id)]);
        unsupportedGitHubInput = rejectedIds.size > 0;
        if (request.evidenceBundle.schemaVersion === 1) request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        else request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !rejectedIds.has(id)) }));
      }
      const interestProfile = request.schemaVersion === 4 || request.schemaVersion === 5 || (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) ? interest.snapshot() : undefined;
      const rankingHistory = request.schemaVersion === 8 || request.schemaVersion === 9 ? githubHistory(request.businessDate, request.evidenceBundle.cutoffUtc) : undefined;
      const eventHistory = request.schemaVersion === 9 ? developmentHistoryRead((scope) => {
        if (repromotion!.github.runs.length && scope.authorize(repromotion!) !== null) throw new ObserverError("github-publication-input-changed");
        return githubEventHistory(request.businessDate, request.evidenceBundle.cutoffUtc, scope);
      }) : undefined;
      if ((request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9))) {
        // Ordinary Evidence cannot declare itself an eligible social sample. Only the
        // separately captured, policy-bound sample path can populate this Edition.
        const socialSourceIds = new Set([...requestPolicies().filter((source) => source.edition === "social-discourse").map((source) => source.sourceId), ...discourseConfiguration!.groups.map((group) => group.sourceId)]);
        const socialIds = new Set([...request.editions.filter((entry) => entry.edition === "social-discourse").flatMap((entry) => entry.evidenceIds), ...request.evidenceBundle.evidence.filter((evidence) => socialSourceIds.has(evidence.sourceId)).map((evidence) => evidence.id)]);
        if (request.evidenceBundle.schemaVersion === 1) request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !socialIds.has(evidence.id));
        else request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !socialIds.has(evidence.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !socialIds.has(id)) }));
      }
      const discourse = (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) ? await prepareDiscourse({ request, configuration: discourseConfiguration!, frozenAtUtc: frozenAtUtc!,
        adapter: options.discourse?.adapter, policies: requestPolicies, clock: options.clock ?? (() => new Date().toISOString()), ...(runOptions?.signal ? { signal: runOptions.signal } : {}) }) : undefined;
      if (discourse && (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) && request.evidenceBundle.schemaVersion === 2) {
        request.evidenceBundle.evidence.push(...discourse.evidence);
        request.editions.find((entry) => entry.edition === "social-discourse")!.evidenceIds.push(...discourse.evidence.map((evidence) => evidence.id));
      }
      const modelPolicies = (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) ? requestPolicies() : undefined;
      if ((request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9))) {
        // Classification and grants share the final pre-model authority after sample I/O.
        const capturedIds = new Set(discourse!.evidence.map((evidence) => evidence.id));
        const socialSources = new Set(modelPolicies!.filter((source) => source.edition === "social-discourse").map((source) => source.sourceId));
        const rejectedIds = new Set(request.evidenceBundle.evidence.filter((evidence) => socialSources.has(evidence.sourceId) && !capturedIds.has(evidence.id)).map((evidence) => evidence.id));
        if (request.evidenceBundle.schemaVersion === 1) request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        else request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !rejectedIds.has(id)) }));
      }
      if ((request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) {
        const githubSources = new Set(modelPolicies!.filter((source) => source.edition === "github-projects").map((source) => source.sourceId));
        const rejectedIds = new Set(request.evidenceBundle.evidence.filter((evidence) => githubSources.has(evidence.sourceId)).map((evidence) => evidence.id));
        unsupportedGitHubInput ||= rejectedIds.size > 0;
        if (request.evidenceBundle.schemaVersion === 1) request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        else request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((evidence) => !rejectedIds.has(evidence.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !rejectedIds.has(id)) }));
      }
      if (request.schemaVersion === 1 ? !options.runner : request.evidenceBundle.evidence.length > 0 && !editionRunner) throw new ObserverError("runner-unavailable");
      if (routing && request.schemaVersion === 9 && request.evidenceBundle.schemaVersion === 2) {
        const rejected = new Set<string>();
        for (const evidence of request.evidenceBundle.evidence) {
          try {
            const source = checkedPolicy(evidence, modelPolicies);
            if (source.model.enabled && evidence.expiresAtUtc > (options.clock ?? (() => new Date().toISOString()))()) continue;
          } catch { /* A stale or revoked source cannot enter any Provider. */ }
          rejected.add(evidence.id);
          for (const entry of request.editions.filter((entry) => entry.evidenceIds.includes(evidence.id))) request.evidenceBundle.coverageGaps.push({ sourceId: evidence.sourceId, edition: entry.edition, reason: "model-forbidden" });
        }
        request.evidenceBundle.evidence = request.evidenceBundle.evidence.filter((entry) => !rejected.has(entry.id));
        request.editions = request.editions.map((entry) => ({ ...entry, evidenceIds: entry.evidenceIds.filter((id) => !rejected.has(id)) }));
      }
      const bundle = request.evidenceBundle;
      const modelRequest = structuredClone(request);
      if ((modelRequest.schemaVersion === 6 || (modelRequest.schemaVersion === 7 || modelRequest.schemaVersion === 8 || modelRequest.schemaVersion === 9))) delete modelRequest.discourseSamples;
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
      try { runnerOutput = modelRequest.schemaVersion === 1 ? await options.runner!.run(structuredClone(modelRequest), runOptions) : bundle.evidence.length ? await editionRunner!.run(structuredClone(modelRequest), runOptions) : {
        schemaVersion: 2, taskId: request.taskId, evidenceBundleId: bundle.id, configurationId: request.configurationId,
        editions: modelRequest.editions.map((entry) => ({ edition: entry.edition, status: "no-evidence" })),
      }; }
      catch (error) { if (routing && error instanceof RoutingBoundaryError) throw error; throw new ObserverError(routing && runOptions?.signal?.aborted ? "agent-cancelled" : "agent-unknown"); }
      let research: EditionResearch | undefined;
      let results: AgentResult[];
      let publishedAtUtc = (options.clock ?? (() => new Date().toISOString()))();
      const validFixtureRun = (result: AgentResult) => {
        const protocolFixture = ["codex", "claude"].includes(result.provider) && result.execution?.provenance === "protocol-fixture" && verifier;
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
      if ((verifier || research) && stories.some((story) => story.schemaVersion === 1)) throw new ObserverError("legacy-candidate-disabled");
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
          if ((request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9) && ids.some((id) => bundle.evidence.some((evidence) => evidence.id === id && requestPolicies().some((source) => source.sourceId === evidence.sourceId && source.edition === "github-projects")))) {
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
        const { completedAtUtc, ...gated } = await (research ? evaluateBatchedPublication : evaluatePublication)({ request: { ...modelRequest, schemaVersion: 1 }, stories, verifier,
          ...(routing ? { reviewDecision: routing.reviewDecision } : {}),
          ...(request.schemaVersion === 4 || request.schemaVersion === 5 || (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) ? { recordVerifierDispatch: true } : {}),
          ...(request.schemaVersion === 5 || (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) ? { domainRules: true } : {}),
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
          if (request.schemaVersion === 3 || request.schemaVersion === 4 || request.schemaVersion === 5 || (request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9))) {
            const legacyHistory: LegacyHistory = { versionIds: [], fingerprints: new Set() };
            const withheldHistory = new Set<string>();
            const history = database.prepare(`SELECT ${reportColumns} FROM reports WHERE id < ? ORDER BY id`).all(`${request.businessDate}-v1`).flatMap((row) => {
              let old: PublishedReport;
              try {
                old = storedReport(row);
                if (!consistentArchive(old, String(row.id))) throw new ObserverError("history-integrity-failed");
              } catch (error) {
                if (request.schemaVersion !== 8 && request.schemaVersion !== 9) throw error;
                // No facts, fingerprints, policies or event links are reused from
                // an unverifiable archive. Ordinary editions disclose incomplete
                // history through their existing legacy-unclassified contract.
                legacyHistory.versionIds.push(String(row.id));
                return [];
              }
              if (old.record.businessDate >= request.businessDate || old.version.publishedAtUtc > bundle.cutoffUtc || old.record.evidenceBundle.cutoffUtc > bundle.cutoffUtc) return [];
              if (old.record.schemaVersion !== 4 && old.record.schemaVersion !== 5 && (old.record.schemaVersion !== 6 && old.record.schemaVersion !== 7 && (old.record.schemaVersion !== 8 && old.record.schemaVersion !== 9 && (old.record.schemaVersion !== 10 && old.record.schemaVersion !== 11)))) {
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
            if ((request.schemaVersion === 6 || (request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9)) && record.schemaVersion === 6) record = discourse!.project(record, gated.stories, discourseMembers);
          } else record = arrangeEditions(record as Parameters<typeof arrangeEditions>[0], research);
        }
      } else {
        if (stories.some((story) => story.schemaVersion !== 1)) throw new ObserverError("agent-invalid-output");
        record = commonRecord as ReportRecord;
      }
      if ((request.schemaVersion === 7 || request.schemaVersion === 8 || request.schemaVersion === 9) && record.schemaVersion === 7) {
        const failure = github?.configuration ? options.github ? options.github.authorize(repromotion ?? github) : "github-observation-unavailable" : null;
        const snapshot = failure ? { ...github!, runs: [], identities: [], watchItems: [], exclusions: [], reasons: [failure] } : github!;
        if (unsupportedGitHubInput) snapshot.reasons = [...snapshot.reasons, "github-ordinary-candidate-unsupported"];
        const base = { ...record,
          coverageGaps: [...record.coverageGaps.filter((gap) => gap.edition !== "github-projects"),
            ...snapshot.reasons.map((reason) => ({ edition: "github-projects" as const, reason })),
            ...(unsupportedGitHubInput ? [{ edition: "github-projects" as const, reason: "github-ordinary-candidate-unsupported" }] : [])] };
        if (request.schemaVersion === 8 || request.schemaVersion === 9) {
          const complete = GitHubRankingSnapshotSchema.parse(snapshot);
          const githubRanking = rankGitHub({ snapshot: complete, interestProfile: interestProfile!, history: rankingHistory!, algorithmVersion: "observer-github-heat-v1" });
          record = { ...base, schemaVersion: 9, editorialContract: "observer-canonical-v7", github: complete,
            githubRanking,
            coverageGaps: [...base.coverageGaps, ...(rankingHistory!.unavailableVersionIds.length ? [{ edition: "github-projects" as const, reason: "github-history-unavailable" }] : []),
              ...(githubRanking.quota.actual < githubRanking.quota.target ? [{ edition: "github-projects" as const, reason: "github-selection-insufficient" }] : [])] };
          if (!consistentGitHubRanking(record)) throw new ObserverError("canonical-github-record-invalid");
          if (request.schemaVersion === 9) {
            const githubDevelopments = failure ? { ...emptyDevelopments(bundle.cutoffUtc), reasons: [failure] } : projectGitHubPublication(repromotion!,
              { interestProfile: interestProfile!, coverageHistory: rankingHistory!, eventHistory: eventHistory!, algorithmVersion: "observer-github-repromotion-v1" },
              (identity) => { const source = checkedPolicy(identity); return source.citation.enabled ? source.citation.maxCharacters : null; });
            const githubRepromotion = rankGitHubRepromotions({ snapshot: { schemaVersion: 1, github: complete, developments: githubDevelopments }, interestProfile: interestProfile!,
              coverageHistory: rankingHistory!, eventHistory: eventHistory!, algorithmVersion: "observer-github-repromotion-v1" });
            record = { ...record, schemaVersion: 10, editorialContract: "observer-canonical-v8", githubDevelopments, githubRepromotion,
              coverageGaps: [...record.coverageGaps.filter((gap) => gap.reason !== "github-selection-insufficient"),
                ...githubDevelopments.reasons.map((reason) => ({ edition: "github-projects" as const, reason })),
                ...(eventHistory!.unavailableVersionIds.length ? [{ edition: "github-projects" as const, reason: "github-event-history-unavailable" }] : []),
                ...(githubRepromotion.quota.actual < 7 ? [{ edition: "github-projects" as const, reason: "github-selection-insufficient" }] : [])] };
            if (!consistentGitHubRepromotion(record)) throw new ObserverError("canonical-github-record-invalid");
          }
        } else {
          record = { ...base, schemaVersion: 8, editorialContract: "observer-canonical-v6", github: GitHubSnapshotSchema.parse(snapshot) };
          if (!consistentGitHubRecord(record)) throw new ObserverError("canonical-github-record-invalid");
        }
      }
      if (routing) {
        routing.authorize(record.stories.length > 0);
        if (record.schemaVersion !== 10) throw new ObserverError("routing-record-invalid");
        record = finalizeRoutedRecord(record, routing.freeze());
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
          ...(record.schemaVersion === 11 || record.schemaVersion === 10 || record.schemaVersion === 9 || record.schemaVersion === 8 || record.schemaVersion === 3 || record.schemaVersion === 4 || record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7) ? { schemaVersion: record.schemaVersion - 1, editorialContract: record.editorialContract, reportRecordSha256: digest(JSON.stringify(record)) } : {}),
        },
        record, canonicalMarkdown,
      });
      if (request.schemaVersion === 8 || request.schemaVersion === 9) database.exec("BEGIN IMMEDIATE");
      try {
        if (request.schemaVersion === 8 && (digest(JSON.stringify(githubHistory(request.businessDate, bundle.cutoffUtc))) !== digest(JSON.stringify(rankingHistory)) ||
          report.record.schemaVersion === 9 && report.record.github.runs.length > 0 && options.github?.authorize(report.record.github))) throw new ObserverError("github-publication-input-changed");
        if (request.schemaVersion === 9) developmentHistoryRead((scope) => {
          if (report.record.schemaVersion !== 10 && report.record.schemaVersion !== 11) throw new ObserverError("github-publication-input-changed");
          if (capturedDevelopment !== developmentCapture(report.version.id, report.record.businessDate, report.record.evidenceBundle.cutoffUtc,
            { schemaVersion: 1, github: report.record.github, developments: report.record.githubDevelopments }) ||
            report.record.github.runs.length && scope.authorize(repromotion!) !== null ||
            digest(JSON.stringify(githubHistory(request.businessDate, bundle.cutoffUtc))) !== digest(JSON.stringify(rankingHistory)) ||
            digest(JSON.stringify(githubEventHistory(request.businessDate, bundle.cutoffUtc, scope))) !== digest(JSON.stringify(eventHistory)) ||
            scope.authorizeDevelopmentHistory({ schemaVersion: 1, github: report.record.github, developments: report.record.githubDevelopments },
              { interestProfile: report.record.interestProfile, coverageHistory: report.record.githubRanking.history, eventHistory: report.record.githubRepromotion.eventHistory,
                algorithmVersion: report.record.githubRepromotion.algorithmVersion }) !== null) throw new ObserverError("github-publication-input-changed");
        });
        const insertion = routing ? database.prepare("INSERT INTO reports (id,payload,development_capture_sha256,routing_capture_sha256) VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING")
          .run(report.version.id, JSON.stringify(report), capturedDevelopment, digest(JSON.stringify(report.record.schemaVersion === 11 ? report.record.routing : null))) :
          database.prepare("INSERT INTO reports (id,payload,development_capture_sha256) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING").run(report.version.id, JSON.stringify(report), capturedDevelopment);
        if (insertion.changes === 0) throw new ObserverError("version-already-exists");
        if (routing) { routing.authorize(report.record.stories.length > 0); routing.complete(report.version.id); }
        if (request.schemaVersion === 8 || request.schemaVersion === 9) database.exec("COMMIT");
      } catch (error) { if (request.schemaVersion === 8 || request.schemaVersion === 9) database.exec("ROLLBACK"); throw error; }
      return report.version;
      } catch (error) {
        if (!routing) throw error;
        const failure = error instanceof ObserverError ? error : new ObserverError(error instanceof RoutingBoundaryError ? error.message === "cancelled" ? "agent-cancelled" : `routing-${error.message}` : "routed-produce-failed");
        routing.complete(null, failure.code);
        failure.runId = routing.receipt().runId;
        throw failure;
      }
    },
    readRun(runId: string, credential: string | undefined) {
      if (!credential || !timingSafeEqual(Buffer.from(digest(credential)), Buffer.from(digest(options.ownerToken)))) throw new ObserverError("unauthorized");
      return storedRun(runId);
    },
    readReport(versionId: string, credential: string | undefined): PublishedReport {
      if (!credential || !timingSafeEqual(Buffer.from(digest(credential)), Buffer.from(digest(options.ownerToken)))) {
        throw new ObserverError("unauthorized");
      }
      const row = database.prepare(`SELECT ${reportColumns} FROM reports WHERE id = ?`).get(versionId);
      if (!row) throw new ObserverError("not-found");
      const report = storedReport(row);
      if (options.mode === "production" && report.version.provenance === "test-fixture") throw new ObserverError("not-found");
      if (!consistentArchive(report, versionId)) throw new ObserverError("canonical-integrity-failed");
      if ((report.record.schemaVersion === 8 || report.record.schemaVersion === 9 || (report.record.schemaVersion === 10 || report.record.schemaVersion === 11))) {
        if (!consistentEvents(report.record, historicalReport)) throw new ObserverError("canonical-integrity-failed");
        try {
          for (const run of report.record.github.runs) {
            if (!run.policy) continue;
            const source = checkedPolicy(run.policy);
            if (!source.github?.allowRepositorySnapshots || !source.github.allowIdentityHistory || !source.github.allowDerivedPublication || !source.github.irrevocableExportAllowed ||
              source.github.deletionScope !== "raw-only" || !source.distribution.enabled || !source.distribution.allowDerivedText || !source.distribution.allowPermanentArchive || !source.citation.enabled) throw new Error("revoked");
          }
          if (report.record.schemaVersion === 9 || (report.record.schemaVersion === 10 || report.record.schemaVersion === 11)) for (const entry of report.record.githubRanking.history.entries) {
            const old = historicalReport(entry.versionId);
            if (!old || entry.businessDate >= report.record.businessDate || entry.publishedAtUtc > report.record.evidenceBundle.cutoffUtc ||
              old.version.publishedAtUtc !== entry.publishedAtUtc || digest(JSON.stringify(old.record)) !== entry.reportRecordSha256 ||
              (old.record.schemaVersion !== 8 && old.record.schemaVersion !== 9 && (old.record.schemaVersion !== 10 && old.record.schemaVersion !== 11))) throw new Error("invalid-history");
            const nodes = (old.record.schemaVersion === 10 || old.record.schemaVersion === 11) ? old.record.githubRepromotion.selectedNodeIds : old.record.schemaVersion === 8 ? old.record.github.watchItems.map((item) => item.nodeId) : old.record.githubRanking.selectedNodeIds;
            const requiredPolicies = [...new Map(old.record.github.runs.flatMap((run) => run.policy ? [[run.policy.policySha256, run.policy] as const] : [])).values()];
            if (old.record.businessDate !== entry.businessDate || digest(JSON.stringify(nodes)) !== digest(JSON.stringify(entry.nodeIds)) ||
              digest(JSON.stringify(requiredPolicies)) !== digest(JSON.stringify(entry.policies))) throw new Error("invalid-history");
            for (const policy of entry.policies) if (!old.record.github.configuration || !githubPermission(checkedPolicy(policy), old.record.github.configuration, (options.clock ?? (() => new Date().toISOString()))(), true)) throw new Error("revoked");
          }
          if ((report.record.schemaVersion === 10 || report.record.schemaVersion === 11)) {
            const development = report.record.githubDevelopments;
            for (const run of development.runs) {
              if (!run.evidence.length && !run.assessments.length && !run.developments.length && !run.security?.evidence.length && !run.security?.risks.length && !run.security?.history.entries.length && !run.security?.history.materials.length && !run.security?.assessments.length) continue;
              if (!run.policy || !development.configuration || !developmentRunPermission(checkedPolicy(run.policy), run,
                (options.clock ?? (() => new Date().toISOString()))())) throw new Error("revoked");
              for (const receipt of run.assessments) for (const previous of receipt.previousEvidence) {
                if (!developmentPermission(checkedPolicy(previous.evidence.policy), previous.configuration, (options.clock ?? (() => new Date().toISOString()))())) throw new Error("revoked");
              }
              if (run.security) for (const previous of advisoryOrigins(run.security)) if (!developmentPermission(checkedPolicy(previous.evidence.policy), previous.developmentConfiguration,
                (options.clock ?? (() => new Date().toISOString()))(), "security")) throw new Error("revoked");
            }
            const record = report.record;
            developmentHistoryRead((scope) => {
              const snapshot = { schemaVersion: 1 as const, github: record.github, developments: development };
              const publication = { interestProfile: record.interestProfile, coverageHistory: record.githubRanking.history, eventHistory: record.githubRepromotion.eventHistory,
                algorithmVersion: record.githubRepromotion.algorithmVersion };
              // Current first in all three synchronous phases, then the same
              // ordered real prior publications, then the final projection.
              if (scope.authorizeDevelopmentHistory(snapshot, publication) !== null) throw new Error("invalid-development-history");
              const actual = githubEventHistory(record.businessDate, record.evidenceBundle.cutoffUtc, scope);
              if (digest(JSON.stringify(actual)) !== digest(JSON.stringify(record.githubRepromotion.eventHistory)) ||
                scope.authorizeDevelopmentHistory(snapshot, publication) !== null) throw new Error("invalid-history");
            });
          }
        } catch { throw new ObserverError("not-found"); }
      }
      if ((report.record.schemaVersion === 4 || report.record.schemaVersion === 5 || (report.record.schemaVersion === 6 || report.record.schemaVersion === 7 || (report.record.schemaVersion === 8 || report.record.schemaVersion === 9 || (report.record.schemaVersion === 10 || report.record.schemaVersion === 11)))) && !consistentEvents(report.record, historicalReport)) throw new ObserverError("canonical-integrity-failed");
      if (report.record.evidenceBundle.schemaVersion !== 1) {
        try {
          const identities = report.record.evidenceBundle.schemaVersion === 2 ? report.record.evidenceBundle.evidence : [...report.record.evidenceBundle.evidence.flatMap((evidence) => evidence.origin.kind === "collected" ? [{ sourceId: evidence.sourceId, ...evidence.origin }] : []), ...(report.record.schemaVersion === 4 || report.record.schemaVersion === 5 || (report.record.schemaVersion === 6 || report.record.schemaVersion === 7 || (report.record.schemaVersion === 8 || report.record.schemaVersion === 9 || (report.record.schemaVersion === 10 || report.record.schemaVersion === 11))) ? report.record.eventClusters.flatMap((cluster) => cluster.historyPolicies) : [])];
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
