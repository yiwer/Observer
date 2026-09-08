import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { SourceConfigurationSchema, policyDigest, sourceFields } from "./collection.ts";
import { DeletionContractSchema, contentDependencies } from "./retention.ts";
import { PublishedReportSchema, type PublishedReport } from "./contracts.ts";
import { dailyWindow } from "./scheduled-publication.ts";
import { recoveryDeadline } from "./brief-recovery.ts";
import { runtimeSecret } from "./runtime-secrets.ts";
import { CampaignSchema, CompleteShadowSchema, FailureShadowSchema, FreezeShadowSchema, ReviewShadowSchema, ShadowConfigurationSchema,
  StartShadowSchema, shadowRules, type Campaign, type FrozenShadowInput, type ShadowConfiguration, type ShadowReview } from "./shadow-contracts.ts";
import { sampleShadowReport, reviewShadowSample, type ShadowSample } from "./shadow-sampling.ts";

const APP_ID = 1329746771;
type Provider = "codex" | "claude";
type Material = { input: FrozenShadowInput };
type ResultMaterial = { report: PublishedReport; history: PublishedReport[]; sample: ShadowSample; review: ShadowReview | null };
type JsonRow = Record<string, unknown>;
type Metrics = ReturnType<typeof reviewShadowSample> & { scope: "live" | "protocol-fixture"; modelAvailable: boolean; inputComparable: boolean;
  structureAndPolicy: boolean; durationMs: number; modelDurationMs: number | null; modelFailures: number; knownCostUsd: number | null; unknownCostAttempts: number; modelQuality: "PASS" | "FAIL" | "INCOMPLETE" | "NOT_APPLICABLE" };

export function readShadowJson(file: string): unknown {
  const info = statSync(file);
  if (!info.isFile() || info.size > 96 * 1024 * 1024) throw new Error("shadow-input-too-large");
  return JSON.parse(readFileSync(file, "utf8"));
}
function inside(parent: string, target: string) { const path = relative(parent, target); return path === "" || !path.startsWith("..") && !isAbsolute(path); }
function resolvedPath(path: string): string {
  const absolute = resolve(path);
  return existsSync(absolute) ? realpathSync(absolute) : join(resolvedPath(dirname(absolute)), absolute.slice(dirname(absolute).length + 1));
}
export function loadShadowConfiguration(file: string): ShadowConfiguration {
  const config = ShadowConfigurationSchema.parse(readShadowJson(file));
  for (const field of ["directory", "productionDataDirectory", "sourceConfigurationPath", "rightsContractPath"] as const) config[field] = resolvedPath(resolve(dirname(resolve(file)), config[field]));
  if (inside(config.directory, config.productionDataDirectory) || inside(config.productionDataDirectory, config.directory)) throw new Error("shadow-production-storage-overlap");
  for (const url of Object.values(config.servers)) {
    if (!url) continue;
    const target = new URL(url);
    if (target.username || target.password || target.search || target.hash || target.pathname !== "/" ||
      target.protocol !== "https:" && !(target.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))) throw new Error("shadow-invalid-server-origin");
  }
  if (config.servers.codex && config.servers.codex === config.servers.claude) throw new Error("shadow-provider-servers-must-be-isolated");
  return config;
}
function json<T>(row: JsonRow, field: string): T { return JSON.parse(String(row[field])) as T; }
function inputSources(input: FrozenShadowInput) {
  const ids = contentDependencies(input).sources;
  // Empty-but-configured sources still participate in the frozen rights boundary.
  input.policies.forEach((policy) => ids.add(policy.sourceId));
  return [...ids];
}
function expiry(input: FrozenShadowInput) {
  const times = [Date.parse(input.frozenAtUtc) + 30 * 86400000];
  for (const policy of input.policies) times.push(Date.parse(input.frozenAtUtc) + policy.storage.retentionHours * 3600000);
  function visit(value: unknown) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
      if (key === "expiresAtUtc" && typeof item === "string") times.push(Date.parse(item));
      visit(item);
    }
  }
  visit(input); return new Date(Math.min(...times)).toISOString();
}
function quality(metrics: Omit<Metrics, "modelQuality">): Metrics["modelQuality"] {
  if (metrics.scope !== "live" || !metrics.modelAvailable) return "NOT_APPLICABLE";
  if (metrics.fabricatedSources || metrics.seriousErrors || !metrics.structureAndPolicy || metrics.complete && metrics.supportedFraction! < shadowRules.supportedFraction) return "FAIL";
  if (!metrics.inputComparable || !metrics.complete) return "INCOMPLETE";
  return "PASS";
}

/** Dedicated local evaluation archive. No reports/outbox tables, publisher, SMTP,
 * collector, or provider constructor. All source-bearing material is expiring. */
export function openShadowEvaluation(config: ShadowConfiguration, clock = () => new Date().toISOString()) {
  config = ShadowConfigurationSchema.parse(config);
  config.directory = resolvedPath(config.directory); config.productionDataDirectory = resolvedPath(config.productionDataDirectory);
  if (inside(config.directory, config.productionDataDirectory) || inside(config.productionDataDirectory, config.directory)) throw new Error("shadow-production-storage-overlap");
  mkdirSync(config.directory, { recursive: true, mode: 0o700 });
  if (realpathSync(config.directory) !== config.directory) throw new Error("shadow-directory-changed");
  const dbPath = join(config.directory, "shadow.sqlite");
  if (existsSync(dbPath) && realpathSync(dbPath) !== dbPath) throw new Error("shadow-database-link-forbidden");
  const db = new DatabaseSync(dbPath);
  try {
    const app = Number(db.prepare("PRAGMA application_id").get()!.application_id), version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
    const existing = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table'").get();
    if (app !== APP_ID && (app !== 0 || existing) || version !== 0 && version !== 1) throw new Error("shadow-unsupported-storage");
    db.exec(`PRAGMA application_id=${APP_ID}; PRAGMA user_version=1; PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS batches(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL,business_date TEXT NOT NULL,created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,state TEXT NOT NULL,fingerprint TEXT,seed INTEGER NOT NULL,dependencies TEXT NOT NULL,material TEXT,UNIQUE(campaign_id,business_date));
      CREATE TABLE IF NOT EXISTS jobs(batch_id TEXT NOT NULL,provider TEXT NOT NULL,state TEXT NOT NULL,active_attempt TEXT,selected_attempt TEXT,readable TEXT,PRIMARY KEY(batch_id,provider));
      CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,batch_id TEXT NOT NULL,provider TEXT NOT NULL,ordinal INTEGER NOT NULL,started_at TEXT NOT NULL,
        lease_until TEXT NOT NULL,finished_at TEXT,state TEXT NOT NULL,failure TEXT,metrics TEXT,material TEXT,UNIQUE(batch_id,provider,ordinal));
      CREATE TABLE IF NOT EXISTS suppressions(kind TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS exports(id TEXT PRIMARY KEY,batch_id TEXT NOT NULL,expires_at TEXT NOT NULL);`);
  } catch (error) { db.close(); throw error; }
  function transaction<T>(action: () => T): T {
    db.exec("BEGIN IMMEDIATE"); try { const result = action(); db.exec("COMMIT"); return result; } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  const batch = (id: string) => { const row = db.prepare("SELECT * FROM batches WHERE id=?").get(id); if (!row) throw new Error("shadow-batch-not-found"); return row; };
  const campaign = (id: string) => { const row = db.prepare("SELECT payload FROM campaigns WHERE id=?").get(id); if (!row) throw new Error("shadow-campaign-not-found"); return CampaignSchema.parse(json(row, "payload")); };
  const attempt = (id: string) => { const row = db.prepare("SELECT * FROM attempts WHERE id=?").get(id); if (!row) throw new Error("shadow-attempt-not-found"); return row; };
  const enabled = () => { if (!config.enabled) throw new Error("shadow-disabled"); };
  function authorities() {
    const sources = SourceConfigurationSchema.parse(readShadowJson(config.sourceConfigurationPath)).sources;
    if (new Set(sources.map((source) => source.sourceId)).size !== sources.length) throw new Error("shadow-duplicate-policy");
    const contract = DeletionContractSchema.parse(readShadowJson(config.rightsContractPath));
    for (const entry of contract.sources) db.prepare("INSERT OR IGNORE INTO suppressions VALUES('source',?)").run(entry.sourceId);
    for (const entry of contract.versions) db.prepare("INSERT OR IGNORE INTO suppressions VALUES('version',?)").run(entry.versionId);
    return sources;
  }
  function material(id: string): { row: JsonRow; value: Material } {
    const row = batch(id);
    if (!row.material || String(row.expires_at) <= clock()) throw new Error("shadow-material-expired-or-removed");
    return { row, value: json<Material>(row, "material") };
  }
  function deleteExport(id: string) {
    if (!/^shadow-export-[0-9a-f-]{36}$/.test(id)) throw new Error("shadow-invalid-managed-export");
    const path = join(config.directory, `${id}.json`);
    if (existsSync(path)) {
      if (realpathSync(path) !== path || !statSync(path).isFile()) throw new Error("shadow-export-link-forbidden");
      unlinkSync(path);
    }
    db.prepare("DELETE FROM exports WHERE id=?").run(id);
  }
  function maintain() {
    const sources = authorities(), now = clock(); let cleared = 0;
    for (const row of db.prepare("SELECT * FROM batches WHERE material IS NOT NULL").all()) {
      const input = json<Material>(row, "material").input;
      const invalidPolicy = input.policies.some((old) => {
        const current = sources.find((source) => source.sourceId === old.sourceId);
        if (!current || current.review.status !== "approved" || !current.collection.enabled || !current.distribution.enabled)
          db.prepare("INSERT OR IGNORE INTO suppressions VALUES('source',?)").run(old.sourceId);
        return !current || JSON.stringify(current) !== JSON.stringify(old) || current.review.status !== "approved" ||
          !!db.prepare("SELECT 1 FROM suppressions WHERE kind='source' AND id=?").get(old.sourceId);
      });
      const dependency = json<{ sources: string[]; versions: string[] }>(row, "dependencies");
      const revoked = invalidPolicy || dependency.sources.some((id) => !!db.prepare("SELECT 1 FROM suppressions WHERE kind='source' AND id=?").get(id)) ||
        dependency.versions.some((id) => !!db.prepare("SELECT 1 FROM suppressions WHERE kind='version' AND id=?").get(id));
      if (revoked || String(row.expires_at) <= now) {
        transaction(() => {
          db.prepare("UPDATE batches SET material=NULL,fingerprint=NULL,dependencies='{}',state=? WHERE id=?").run(revoked ? "rights-removed" : "expired", row.id!);
          db.prepare("UPDATE attempts SET material=NULL WHERE batch_id=?").run(row.id!);
          db.prepare("UPDATE jobs SET state=CASE WHEN selected_attempt IS NULL THEN 'blocked' ELSE state END,active_attempt=NULL WHERE batch_id=?").run(row.id!);
          db.prepare("UPDATE attempts SET state='failed',failure='policy-blocked',finished_at=? WHERE batch_id=? AND state='running'").run(now, row.id!);
        });
        cleared++;
      }
    }
    // Only exact exports registered by this archive are ever removed.
    for (const row of db.prepare("SELECT exports.* FROM exports JOIN batches ON batches.id=exports.batch_id WHERE exports.expires_at<=? OR batches.material IS NULL").all(now)) deleteExport(String(row.id));
    for (const row of db.prepare("SELECT * FROM attempts WHERE state='running' AND lease_until<=?").all(now)) {
      db.prepare("UPDATE attempts SET state='failed',failure='interrupted',finished_at=? WHERE id=?").run(now, row.id!);
      db.prepare("UPDATE jobs SET state='failed',active_attempt=NULL WHERE active_attempt=?").run(row.id!);
    }
    if (cleared) db.exec("VACUUM");
    return { clearedBatches: cleared, checkedAtUtc: now };
  }
  function metricsFor(value: ResultMaterial, owner: Campaign, durationMs: number): Metrics {
    const reports = [value.report, ...value.history], records = reports.map((report) => report.record);
    const runs = records.flatMap((record) => "editionRuns" in record ? record.editionRuns.flatMap((entry) => entry.status === "completed" ? [entry.result] : []) : []);
    const routing = records.flatMap((record) => record.schemaVersion === 11 ? record.routing.attempts : []);
    const uniqueCosts = [...new Map(routing.map((entry) => [entry.id, entry])).values()];
    const known = uniqueCosts.filter((entry) => entry.usage.costUsd !== null);
    const basic = { ...reviewShadowSample(value.sample, value.review), scope: owner.scope,
      modelAvailable: runs.some((run) => run.status === "succeeded") && !("content" in value.report.version && value.report.version.content === "links-only"),
      inputComparable: !records.some((record) => record.schemaVersion === 12),
      structureAndPolicy: records.every((record) => "publicationGate" in record && record.publicationGate.decisions.filter((decision) => decision.outcome === "published").every((decision) => decision.structure.status === "passed" && decision.policy.status === "passed")),
      durationMs, knownCostUsd: known.length ? known.reduce((sum, entry) => sum + entry.usage.costUsd!, 0) : null,
      modelDurationMs: uniqueCosts.some((entry) => entry.execution) ? uniqueCosts.reduce((sum, entry) => sum + (entry.execution?.durationMs ?? 0), 0) : null,
      modelFailures: uniqueCosts.filter((entry) => entry.status === "failed").length,
      unknownCostAttempts: uniqueCosts.length ? uniqueCosts.length - known.length : 1 };
    return { ...basic, modelQuality: quality(basic) };
  }
  function ensureOutput(report: PublishedReport, history: PublishedReport[], owner: Campaign, provider: Provider, input: FrozenShadowInput) {
    const identity = owner.providers[provider];
    for (const entry of [report, ...history]) {
      if (entry.version.businessDate !== input.request.businessDate || entry.record.businessDate !== input.request.businessDate || entry.record.configurationId !== input.request.configurationId ||
        entry.record.applicationVersion !== owner.applicationVersion || owner.scope === "live" && entry.version.provenance !== "scheduled") throw new Error("shadow-output-identity-mismatch");
      const record = entry.record;
      if (entry.version.publishedAtUtc > clock()) throw new Error("shadow-future-output");
      if (record.schemaVersion === 1 || record.schemaVersion === 2 || (record.schemaVersion === 12 ? record.revision.originalBundleId : record.evidenceBundle.id) !== input.request.evidenceBundle.id) throw new Error("shadow-output-bundle-mismatch");
      if (record.schemaVersion !== 12 && record.taskId !== input.request.taskId) throw new Error("shadow-output-task-mismatch");
      if (record.schemaVersion === 11 && JSON.stringify(record.routing.configuration) !== JSON.stringify({ ...input.routing, primary: provider }))
        throw new Error("shadow-output-routing-configuration-changed");
      if ("interestProfile" in record && JSON.stringify(record.interestProfile) !== JSON.stringify(input.interest)) throw new Error("shadow-output-interest-configuration-changed");
      if (record.schemaVersion !== 12) for (const evidence of record.evidenceBundle.evidence) {
        const original = input.request.evidenceBundle.evidence.find((item) => item.id === evidence.id);
        if (original) {
          if (original.sourceId !== evidence.sourceId || original.retrievedAtUtc !== evidence.retrievedAtUtc ||
            sourceFields.some((field) => field !== "content" && evidence[field as keyof typeof evidence] !== undefined && evidence[field as keyof typeof evidence] !== (field in original ? original[field as keyof typeof original] : undefined))) throw new Error("shadow-output-evidence-changed");
        } else if (!input.policies.some((policy) => policy.sourceId === evidence.sourceId && ["social-discourse", "github-projects"].includes(policy.edition))) throw new Error("shadow-output-evidence-outside-freeze");
      }
      if ("editionRuns" in record) for (const run of record.editionRuns) {
        if (run.status !== "completed") continue;
        const result = run.result, execution = result.execution;
        if (result.provider !== provider || result.model !== identity.model || result.runnerVersion !== identity.runnerVersion || execution?.cliVersion !== identity.cliVersion)
          throw new Error("shadow-provider-identity-mismatch");
        if (owner.scope === "live" && (!execution || execution.provenance !== `${provider}-cli` || execution.processKind !== `${provider}-cli` ||
          execution.modelTransport !== (provider === "codex" ? "openai-api" : "anthropic-api") || execution.cleanup !== "removed" || !execution.containerId)) throw new Error("shadow-live-execution-required");
        if (owner.scope === "protocol-fixture" && execution?.provenance !== "protocol-fixture") throw new Error("shadow-fixture-execution-required");
      }
    }
  }
  const api = {
    close() { db.close(); }, maintain,
    createCampaign(input: unknown) {
      enabled(); maintain(); const owner = CampaignSchema.parse(input), now = clock();
      if (owner.approvedAtUtc > now) throw new Error("shadow-future-rule-approval");
      db.prepare("INSERT INTO campaigns VALUES(?,?,?)").run(owner.id, JSON.stringify(owner), now);
      return { campaignId: owner.id, rules: shadowRules, releaseVerdict: "not-evaluated-by-v1-25" };
    },
    freeze(input: unknown) {
      enabled(); maintain(); const value = FreezeShadowSchema.parse(input), owner = campaign(value.campaignId), now = clock(), frozen = value.input;
      const date = frozen.request.businessDate, window = dailyWindow(date), end = new Date(`${owner.startBusinessDate}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + owner.days);
      if (date < owner.startBusinessDate || date >= end.toISOString().slice(0, 10) || frozen.frozenAtUtc > now || frozen.frozenAtUtc < owner.approvedAtUtc ||
        frozen.request.evidenceBundle.cutoffUtc !== window.cutoffUtc || frozen.request.evidenceBundle.businessDate !== date || frozen.request.evidenceBundle.configurationId !== frozen.request.configurationId ||
        frozen.configuration.configurationId !== frozen.request.configurationId || frozen.versions.application !== owner.codeVersion || frozen.request.evidenceBundle.schemaVersion !== 2)
        throw new Error("shadow-freeze-identity-mismatch");
      const sources = authorities();
      if (inputSources(frozen).some((id) => !frozen.policies.some((policy) => policy.sourceId === id))) throw new Error("shadow-source-without-frozen-policy");
      for (const policy of frozen.policies) if (!sources.some((source) => JSON.stringify(source) === JSON.stringify(policy)) || policy.review.status !== "approved" ||
        db.prepare("SELECT 1 FROM suppressions WHERE kind='source' AND id=?").get(policy.sourceId)) throw new Error("shadow-freeze-policy-mismatch");
      for (const evidence of frozen.request.evidenceBundle.evidence) {
        const policy = frozen.policies.find((source) => source.sourceId === evidence.sourceId);
        if (!policy || evidence.policyVersion !== policy.version || evidence.policySha256 !== policyDigest(policy) || evidence.retrievedAtUtc > now) throw new Error("shadow-evidence-policy-mismatch");
        for (const field of sourceFields) if (evidence[field] !== undefined && (!policy.collection.fields.includes(field) || !policy.storage.fields.includes(field))) throw new Error("shadow-evidence-storage-forbidden");
      }
      for (const sample of frozen.request.discourseSamples ?? []) {
        const policy = frozen.policies.find((source) => source.sourceId === sample.sourceId)!;
        if (!policy.social?.allowAnonymousText || !policy.social.allowStatusKeys || !policy.storage.fields.includes("content") || sample.policyVersion !== policy.version || sample.policySha256 !== policyDigest(policy)) throw new Error("shadow-social-storage-forbidden");
      }
      const expires = expiry(frozen); if (expires <= now) throw new Error("shadow-frozen-material-expired");
      const fingerprint = createHash("sha256").update(JSON.stringify({ input: frozen, rules: shadowRules, codeVersion: owner.codeVersion })).digest("hex");
      const seed = randomBytes(4).readUInt32LE();
      transaction(() => {
        db.prepare("INSERT INTO batches VALUES(?,?,?,?,?,'active',?,?,?,?)").run(value.batchId, owner.id, date, now, expires, fingerprint, seed,
          JSON.stringify({ sources: inputSources(frozen), versions: [] }), JSON.stringify({ input: frozen }));
        for (const provider of ["codex", "claude"]) db.prepare("INSERT INTO jobs VALUES(?,?,'queued',NULL,NULL,NULL)").run(value.batchId, provider);
      });
      return { batchId: value.batchId, businessDate: date, inputFingerprint: fingerprint, expiresAtUtc: expires, seed };
    },
    start(input: unknown) {
      enabled(); maintain(); const value = StartShadowSchema.parse(input), frozen = material(value.batchId), now = clock();
      if (now >= recoveryDeadline(String(frozen.row.business_date))) throw new Error("shadow-day-collection-closed");
      return transaction(() => {
        const job = db.prepare("SELECT * FROM jobs WHERE batch_id=? AND provider=?").get(value.batchId, value.provider)!;
        if (job.active_attempt || job.selected_attempt) throw new Error("shadow-job-already-running-or-complete");
        const ordinal = Number(db.prepare("SELECT COUNT(*) AS n FROM attempts WHERE batch_id=? AND provider=?").get(value.batchId, value.provider)!.n) + 1;
        const id = randomUUID(), leaseUntil = new Date(Math.min(Date.parse(now) + 3600000, Date.parse(String(frozen.row.expires_at)), Date.parse(recoveryDeadline(String(frozen.row.business_date))))).toISOString();
        db.prepare("INSERT INTO attempts VALUES(?,?,?,?,?,?,NULL,'running',NULL,NULL,NULL)").run(id, value.batchId, value.provider, ordinal, now, leaseUntil);
        db.prepare("UPDATE jobs SET state='running',active_attempt=? WHERE batch_id=? AND provider=?").run(id, value.batchId, value.provider);
        return { attemptId: id, provider: value.provider, ordinal, leaseUntilUtc: leaseUntil, inputFingerprint: frozen.row.fingerprint,
          codeVersion: campaign(String(frozen.row.campaign_id)).codeVersion, input: frozen.value.input,
          treatment: "only-selected-provider-research;isolated-production-mode-storage;no-email", output: "CompleteShadowSchema;authenticated-probe-required-for-timing" };
      });
    },
    fail(input: unknown) {
      enabled(); maintain(); const failure = FailureShadowSchema.parse(input), row = attempt(failure.attemptId);
      if (row.state !== "running") throw new Error("shadow-attempt-not-running");
      transaction(() => {
        db.prepare("UPDATE attempts SET state='failed',failure=?,finished_at=?,metrics=? WHERE id=?").run(failure.reason, clock(), JSON.stringify({ costUsd: failure.costUsd }), row.id!);
        db.prepare("UPDATE jobs SET state='failed',active_attempt=NULL WHERE active_attempt=?").run(row.id!);
      });
      return { attemptId: row.id, state: "failed", retry: "start-same-batch-and-provider-before-noon-and-expiry" };
    },
    complete(input: unknown) {
      enabled(); maintain(); const value = CompleteShadowSchema.parse(input), row = attempt(value.attemptId), frozen = material(String(row.batch_id)), owner = campaign(String(frozen.row.campaign_id));
      if (row.state !== "running" || value.inputFingerprint !== frozen.row.fingerprint || value.codeVersion !== owner.codeVersion) throw new Error("shadow-attempt-input-mismatch");
      ensureOutput(value.report, value.history, owner, String(row.provider) as Provider, frozen.value.input);
      const output: ResultMaterial = { report: value.report, history: value.history, sample: sampleShadowReport(value.report, value.history, Number(frozen.row.seed)), review: null };
      const metrics = metricsFor(output, owner, Date.parse(clock()) - Date.parse(String(row.started_at)));
      const dependencies = contentDependencies([frozen.value.input, value.report, value.history]);
      dependencies.versions.add(value.report.version.id); value.history.forEach((report) => dependencies.versions.add(report.version.id));
      transaction(() => {
        db.prepare("UPDATE attempts SET state='completed',finished_at=?,metrics=?,material=? WHERE id=?").run(clock(), JSON.stringify(metrics), JSON.stringify(output), row.id!);
        db.prepare("UPDATE jobs SET state='completed',active_attempt=NULL,selected_attempt=? WHERE active_attempt=?").run(row.id!, row.id!);
        const prior = json<{ sources: string[]; versions: string[] }>(frozen.row, "dependencies");
        db.prepare("UPDATE batches SET dependencies=? WHERE id=?").run(JSON.stringify({ sources: [...new Set([...prior.sources, ...dependencies.sources])], versions: [...new Set([...prior.versions, ...dependencies.versions])] }), row.batch_id!);
      });
      maintain(); return { attemptId: row.id, metrics, sampling: { ...output.sample, items: undefined } };
    },
    form(attemptId: string) {
      maintain(); const row = attempt(attemptId); material(String(row.batch_id));
      if (!row.material) throw new Error("shadow-result-unavailable");
      const value = json<ResultMaterial>(row, "material");
      return { attemptId, sample: value.sample, evidence: value.report.record.evidenceBundle, historyEvidence: value.history.map((report) => ({ versionId: report.version.id, evidence: report.record.evidenceBundle })),
        sourceMaterial: material(String(row.batch_id)).value.input, canonicalMarkdown: value.report.canonicalMarkdown, review: value.review,
        reviewTemplate: { attemptId, reviewer: "", reviewedAtUtc: "", finalized: false, claims: value.sample.items.filter((item) => item.selected).flatMap((item) => item.claims.map((claim) => ({ key: claim.key, facts: [], noFactReason: null }))),
          omissions: null, duplicates: null, classificationErrors: null, expression: null, notes: "" } };
    },
    review(input: unknown) {
      enabled(); maintain(); const review = ReviewShadowSchema.parse(input), row = attempt(review.attemptId), frozen = material(String(row.batch_id));
      if (!row.material || review.reviewedAtUtc > clock() || review.reviewedAtUtc < String(row.finished_at)) throw new Error("shadow-review-time-or-material-invalid");
      const value = json<ResultMaterial>(row, "material");
      if (value.review?.finalized) throw new Error("shadow-review-already-recorded");
      const knownEvidence = new Set<string>();
      function collectIds(input: unknown) {
        if (Array.isArray(input)) input.forEach(collectIds);
        else if (input && typeof input === "object") for (const [key, item] of Object.entries(input)) {
          if (["id", "observationId", "receiptId"].includes(key) && typeof item === "string") knownEvidence.add(item);
          collectIds(item);
        }
      }
      collectIds([frozen.value.input, value.report.record.evidenceBundle, ...value.history.map((report) => report.record.evidenceBundle)]);
      for (const entry of review.claims) for (const fact of entry.facts) if (fact.verdict === "supported" && (!fact.evidenceRefs.length || fact.fabricatedSource || fact.seriousError || fact.wrongAttribution)) throw new Error("shadow-supported-fact-inconsistent");
      for (const entry of review.claims) for (const fact of entry.facts) if (fact.verdict === "supported" && fact.evidenceRefs.some((id) => !knownEvidence.has(id))) throw new Error("shadow-review-evidence-not-in-batch");
      value.review = review;
      const previous = json<Metrics>(row, "metrics"), metrics = metricsFor(value, campaign(String(frozen.row.campaign_id)), previous.durationMs);
      if (review.finalized && metrics.missingClaims) throw new Error("shadow-review-missing-claims");
      db.prepare("UPDATE attempts SET metrics=?,material=? WHERE id=?").run(JSON.stringify(metrics), JSON.stringify(value), row.id!);
      return metrics;
    },
    async probe(input: unknown) {
      enabled(); maintain(); const value = StartShadowSchema.parse(input), job = db.prepare("SELECT * FROM jobs WHERE batch_id=? AND provider=?").get(value.batchId, value.provider);
      if (!job?.selected_attempt) throw new Error("shadow-result-unavailable");
      material(value.batchId); const row = attempt(String(job.selected_attempt)), output = json<ResultMaterial>(row, "material");
      const server = config.servers[value.provider]; if (!server) throw new Error("shadow-server-not-configured");
      const secret = runtimeSecret(`OBSERVER_SHADOW_${value.provider.toUpperCase()}_OWNER_TOKEN`); if (!secret) throw new Error("shadow-read-credential-unavailable");
      const response = await fetch(new URL(`/v1/reports/${encodeURIComponent(output.report.version.id)}`, server), { headers: { authorization: `Bearer ${secret}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!response.ok || Number(response.headers.get("content-length") ?? 0) > 96 * 1024 ** 2) { await response.body?.cancel(); throw new Error("shadow-server-not-readable"); }
      const reader = response.body?.getReader(); if (!reader) throw new Error("shadow-empty-server-response");
      const chunks: Uint8Array[] = []; let bytes = 0;
      try { while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > 96 * 1024 ** 2) throw new Error("shadow-server-response-too-large"); chunks.push(next.value); } }
      finally { await reader.cancel(); }
      const received = PublishedReportSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      if (JSON.stringify(received) !== JSON.stringify(output.report)) throw new Error("shadow-server-content-mismatch");
      const atUtc = clock(); maintain(); material(value.batchId);
      const receipt = { kind: "authenticated-server-read", scope: campaign(String(batch(value.batchId).campaign_id)).scope, atUtc,
        versionId: received.version.id, content: "content" in received.version ? received.version.content : "complete" };
      db.prepare("UPDATE jobs SET readable=COALESCE(readable,?) WHERE batch_id=? AND provider=?").run(JSON.stringify(receipt), value.batchId, value.provider);
      return JSON.parse(String(db.prepare("SELECT readable FROM jobs WHERE batch_id=? AND provider=?").get(value.batchId, value.provider)!.readable)) as unknown;
    },
    status(campaignId: string) {
      maintain(); const owner = campaign(campaignId), now = clock();
      const days = Array.from({ length: owner.days }, (_, index) => {
        const day = new Date(`${owner.startBusinessDate}T00:00:00Z`); day.setUTCDate(day.getUTCDate() + index); const date = day.toISOString().slice(0, 10);
        const frozen = db.prepare("SELECT * FROM batches WHERE campaign_id=? AND business_date=?").get(campaignId, date);
        return { businessDate: date, batchId: frozen?.id ?? null, materialState: frozen?.state ?? "not-frozen", providers: (["codex", "claude"] as const).map((provider) => {
          const job = frozen ? db.prepare("SELECT * FROM jobs WHERE batch_id=? AND provider=?").get(frozen.id!, provider) : undefined;
          const selected = job?.selected_attempt ? attempt(String(job.selected_attempt)) : null;
          const readable = job?.readable ? json<{ atUtc: string; content: string; scope: string }>(job, "readable") : null;
          const timing = readable && readable.scope === "live" && readable.atUtc < recoveryDeadline(date) ? readable.atUtc <= dailyWindow(date).deadlineUtc ? readable.content === "complete" ? "normal-on-time" : "degraded-on-time" : "late" : now >= recoveryDeadline(date) ? "missing" : "pending";
          const attempts = frozen ? db.prepare("SELECT id,ordinal,state,failure,started_at,finished_at,metrics FROM attempts WHERE batch_id=? AND provider=? ORDER BY ordinal").all(frozen.id!, provider) : [];
          const metrics = selected?.metrics ? json<Metrics>(selected, "metrics") : null;
          if (metrics && frozen?.state === "rights-removed") metrics.modelQuality = "INCOMPLETE";
          return { provider, state: job?.state ?? "not-started", attemptCount: attempts.length, failedAttempts: attempts.filter((item) => item.state === "failed").length,
            failureRate: attempts.length ? attempts.filter((item) => item.state === "failed").length / attempts.length : null, timing, actualServerReadableAtUtc: readable?.atUtc ?? null,
            metrics, attempts: attempts.map((item) => ({ ...item, metrics: item.metrics ? JSON.parse(String(item.metrics)) as unknown : null })) };
        }) };
      });
      const providers = (["codex", "claude"] as const).map((provider) => {
        const rows = days.map((day) => day.providers.find((row) => row.provider === provider)!);
        return { provider, qualityPassedDays: rows.filter((row) => row.metrics?.modelQuality === "PASS").length,
          normalOnTime: rows.filter((row) => row.timing === "normal-on-time").length, degradedOnTime: rows.filter((row) => row.timing === "degraded-on-time").length,
          late: rows.filter((row) => row.timing === "late").length, missing: rows.filter((row) => row.timing === "missing").length,
          pending: rows.filter((row) => row.timing === "pending").length };
      });
      const available = providers.filter((entry) => days.some((day) => day.providers.some((row) => row.provider === entry.provider && row.metrics?.modelAvailable))).map((entry) => entry.provider);
      return { campaign: owner, rules: shadowRules, generatedAtUtc: now, providers, days, availableProviders: available,
        comparison: available.length === 2 ? "two-provider-samples;inspect-each-day-for-pairs" : available.length === 1 ? "single-provider-only;other-provider-unverified" : "no-model-quality-evidence",
        releaseVerdict: "not-evaluated-by-v1-25;requires-v1-28" };
    },
    exportBatch(batchId: string, includeMaterial = false) {
      maintain(); const row = batch(batchId), snapshot = api.status(String(row.campaign_id));
      const result = { schemaVersion: 1, kind: "observer-shadow-export", campaign: snapshot.campaign, rules: shadowRules, generatedAtUtc: clock(),
        batch: snapshot.days.find((day) => day.batchId === batchId), inputFingerprint: row.fingerprint, seed: row.seed, expiresAtUtc: row.expires_at,
        material: includeMaterial ? { frozen: material(batchId).value.input, outputs: db.prepare("SELECT id,material FROM attempts WHERE batch_id=? AND material IS NOT NULL").all(batchId).map((item) => ({ attemptId: item.id, result: json<ResultMaterial>(item, "material") })) } : null };
      if (!includeMaterial) return result;
      const id = `shadow-export-${randomUUID()}`, path = join(config.directory, `${id}.json`);
      // Register first so a crash before/while writing still has an exact cleanup target.
      db.prepare("INSERT INTO exports VALUES(?,?,?)").run(id, batchId, row.expires_at!);
      writeFileSync(path, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      return { path, expiresAtUtc: row.expires_at, managed: true, externalCopies: "not-managed;apply-source-rights-and-expiry" };
    },
  };
  return api;
}
