import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { editionNames, type CollectedEvidence, type PublishedReport, type SixEditionRequest } from "./contracts.ts";
import { CandidateV2Schema } from "./gate-contracts.ts";
import { policyDigest, sourceFields, type SourcePolicy } from "./collection.ts";
import { correctionSectionSource } from "./correction-scope.ts";
import { CorrectionSignalSchema, correctionStatus, enqueueCorrection } from "./correction-queue.ts";
import { editionMarkdown } from "./private-archive.ts";
import { escapeMarkdown, inputDigest } from "./publication-gate.ts";
import { createProviderRouting, type RoutingOptions } from "./provider-routing.ts";
import { MAX_ROUTING_AUDIT_BYTES, RoutingReceiptSchema } from "./routing-contracts.ts";
import { dailyWindow, shanghaiDate } from "./scheduled-publication.ts";
import { SourceReadError } from "./source-network.ts";

export const PatrolConfigurationSchema = z.strictObject({
  enabled: z.boolean().default(false), startMinute: z.number().int().min(0).max(420).default(360),
  deadlineMinute: z.number().int().min(1).max(435).default(435),
  maxTasksPerDay: z.number().int().min(1).max(300).default(80), maxReadsPerDay: z.number().int().min(1).max(1000).default(240),
  maxAttempts: z.number().int().min(1).max(5).default(3), retryDelayMs: z.number().int().min(1000).max(3600000).default(60000),
  taskTimeoutMs: z.number().int().min(500).max(300000).default(120000),
}).refine((value) => value.startMinute < value.deadlineMinute, "Patrol start must precede its deadline");
export type PatrolConfiguration = z.infer<typeof PatrolConfigurationSchema>;
type Edition = keyof typeof editionNames;
interface Target { expectedCurrentVersionId: string; sourceVersionId: string; storyId: string; claimId: string; edition: Edition }
export interface PatrolOptions {
  configuration: unknown;
  reread(target: { sourceId: string; url: string; title: string }, signal?: AbortSignal): Promise<CollectedEvidence>;
  evidence(ids: string[]): CollectedEvidence[];
  deferEvidence(ids: string[], businessDate: string): boolean;
}
interface Dependencies {
  clock(): string; mode: "production" | "test-fixture"; policies(): SourcePolicy[];
  read(id: string): PublishedReport; historical(id: string): PublishedReport;
  routing?: RoutingOptions; configuration?: PatrolOptions;
}
function atMinute(date: string, minute: number) { return new Date(Date.parse(`${date}T00:00:00+08:00`) + minute * 60000).toISOString(); }
function shiftDate(date: string, days: number) { return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86400000).toISOString().slice(0, 10); }
export function patrolCorrectionDeadline(now: string): string | null {
  const date = shanghaiDate(now), start = atMinute(date, 435), readable = atMinute(date, 510);
  return now < start ? start : now < readable ? null : atMinute(shiftDate(date, 1), 435);
}
class PatrolFailure extends Error {}
function fail(reason: string): never { throw new PatrolFailure(reason); }
export function correctionPatrol(database: DatabaseSync, dependencies: Dependencies) {
  const config = PatrolConfigurationSchema.parse(dependencies.configuration?.configuration ?? {}), { clock } = dependencies;
  database.exec(`CREATE TABLE IF NOT EXISTS correction_patrol_runs (
    business_date TEXT PRIMARY KEY, window_start_date TEXT NOT NULL, deadline_utc TEXT NOT NULL,
    started_at_utc TEXT NOT NULL, reads INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, gaps TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS correction_patrol_tasks (
      id TEXT PRIMARY KEY, business_date TEXT NOT NULL, target TEXT NOT NULL, state TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt_utc TEXT NOT NULL, owner TEXT, lease_until_utc TEXT,
      observed_at_utc TEXT, material_id TEXT, signal_id TEXT, reason TEXT, evidence_refs TEXT NOT NULL DEFAULT '[]');
    CREATE INDEX IF NOT EXISTS correction_patrol_due ON correction_patrol_tasks(state,next_attempt_utc);
    CREATE TABLE IF NOT EXISTS correction_patrol_materials (
      id TEXT PRIMARY KEY, observed_at_utc TEXT NOT NULL, signal_id TEXT NOT NULL, evidence_refs TEXT NOT NULL, candidate_date TEXT);
    CREATE TABLE IF NOT EXISTS correction_patrol_source_budget (source TEXT PRIMARY KEY, next_read_utc TEXT NOT NULL);`);
  let processing = false;
  const latest = (date: string) => database.prepare("SELECT id FROM reports WHERE json_extract(payload,'$.version.businessDate')=? ORDER BY json_extract(payload,'$.version.version') DESC LIMIT 1").get(date)?.id;
  function originals(target: Target) {
    if (latest(target.expectedCurrentVersionId.slice(0, 10)) !== target.expectedCurrentVersionId) return fail("patrol-current-version-changed");
    const current = dependencies.read(target.expectedCurrentVersionId), source = dependencies.historical(target.sourceVersionId);
    if (correctionSectionSource(current, target.edition, dependencies.historical) !== target.sourceVersionId) return fail("patrol-section-no-longer-current");
    const section = editionMarkdown(current, target.edition);
    const story = source.record.stories.find((entry) => entry.id === target.storyId && entry.edition === target.edition);
    if (!story || story.schemaVersion !== 2 || source.record.schemaVersion === 1) return fail("patrol-unsupported-legacy-story");
    const gate = source.record.publicationGate;
    const claims = story.claims.filter((claim) => claim.id === target.claimId && section.includes(escapeMarkdown(claim.text)) && gate.decisions.some((entry) => entry.storyId === story.id && entry.claimId === claim.id && entry.outcome === "published"));
    if (!claims.length || claims.length > 20) return fail("patrol-claim-scope-uncovered");
    const ids = new Set(claims.flatMap((entry) => entry.evidenceIds));
    const evidence = source.record.evidenceBundle.evidence.filter((entry) => ids.has(entry.id));
    if (evidence.length !== ids.size || evidence.length > 20) return fail("patrol-evidence-scope-uncovered");
    return { current, source, story, claims, evidence };
  }
  function start(date: string) {
    if (database.prepare("SELECT 1 FROM correction_patrol_runs WHERE business_date=?").get(date) || clock() < atMinute(date, config.startMinute)) return;
    const lower = shiftDate(date, -7), gaps: Array<{ reference: string; reason: string }> = [], targets: Target[] = [];
    const reports = database.prepare("SELECT id FROM reports r WHERE json_extract(payload,'$.version.businessDate')>=? AND json_extract(payload,'$.version.businessDate')<? AND NOT EXISTS (SELECT 1 FROM reports n WHERE json_extract(n.payload,'$.version.businessDate')=json_extract(r.payload,'$.version.businessDate') AND json_extract(n.payload,'$.version.version')>json_extract(r.payload,'$.version.version')) ORDER BY id DESC").all(lower, date);
    for (const row of reports) {
      try {
        const current = dependencies.read(String(row.id));
        for (const edition of Object.keys(editionNames) as Edition[]) {
          let section: string;
          try { section = editionMarkdown(current, edition); } catch { continue; }
          const sourceVersionId = correctionSectionSource(current, edition, dependencies.historical), source = dependencies.historical(sourceVersionId);
          const stories = source.record.stories.filter((story) => story.edition === edition && story.claims.some((claim) => section.includes(escapeMarkdown(claim.text))));
          for (const story of stories) {
            if (story.schemaVersion !== 2) { gaps.push({ reference: `${current.version.id}:${story.id}`, reason: "patrol-unsupported-legacy-story" }); continue; }
            for (const claim of story.claims.filter((entry) => section.includes(escapeMarkdown(entry.text)))) {
              if (targets.length >= config.maxTasksPerDay) { gaps.push({ reference: `${current.version.id}:${edition}`, reason: "patrol-task-budget-uncovered" }); break; }
              targets.push({ expectedCurrentVersionId: current.version.id, sourceVersionId, storyId: story.id, claimId: claim.id, edition });
            }
          }
        }
      } catch { gaps.push({ reference: String(row.id), reason: "patrol-current-provenance-or-policy-unavailable" }); }
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      const inserted = database.prepare("INSERT OR IGNORE INTO correction_patrol_runs VALUES (?,?,?,?,0,'active',?)").run(date, lower, atMinute(date, config.deadlineMinute), clock(), JSON.stringify(gaps));
      if (Number(inserted.changes)) for (const target of targets) database.prepare("INSERT INTO correction_patrol_tasks (id,business_date,target,state,next_attempt_utc) VALUES (?,?,?,'pending',?)").run(`patrol-task:${date}:${inputDigest(target)}`, date, JSON.stringify(target), clock());
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
  }
  function reconcile() {
    for (const row of database.prepare("SELECT id,signal_id FROM correction_patrol_tasks WHERE state='queued'").all()) {
      const status = correctionStatus(database, String(row.signal_id));
      if (status.state === "pending" || status.state === "processing") continue;
      let state = status.state === "published" || status.state === "no-op" ? "completed" : "uncovered", reason = status.reason;
      if (status.state === "deferred-next-edition") {
        const material = database.prepare("SELECT evidence_refs,candidate_date FROM correction_patrol_materials WHERE signal_id=?").get(String(row.signal_id));
        if (material?.candidate_date) {
          database.prepare("UPDATE correction_patrol_tasks SET state='deferred',reason=? WHERE id=?").run(`next-period-discovery:${material.candidate_date}`, row.id!);
          continue;
        }
        const refs = material ? JSON.parse(String(material.evidence_refs)) as Array<{ evidenceId: string; retrievedAtUtc: string }> : [];
        const date = shanghaiDate(clock()), candidateDate = clock() < dailyWindow(date).cutoffUtc && !database.prepare("SELECT 1 FROM scheduled_tasks WHERE business_date=?").get(date) ? date : shiftDate(date, 1);
        const valid = refs.length > 0 && dependencies.configuration!.evidence(refs.map((entry) => entry.evidenceId)).length === refs.length;
        const handed = valid && dependencies.configuration!.deferEvidence(refs.map((entry) => entry.evidenceId), candidateDate);
        state = handed ? "deferred" : "uncovered"; reason = handed ? `next-period-discovery:${candidateDate}` : "patrol-next-period-material-expired";
        if (handed) database.prepare("UPDATE correction_patrol_materials SET candidate_date=? WHERE signal_id=?").run(candidateDate, String(row.signal_id));
      }
      database.prepare("UPDATE correction_patrol_tasks SET state=?,reason=? WHERE id=? AND state='queued'").run(state, reason, row.id!);
    }
    database.prepare("UPDATE correction_patrol_tasks SET state='uncovered',reason='patrol-deadline-uncovered',owner=NULL,lease_until_utc=NULL WHERE state IN ('pending','retry','processing') AND business_date IN (SELECT business_date FROM correction_patrol_runs WHERE deadline_utc<=?) AND (lease_until_utc IS NULL OR lease_until_utc<=?)").run(clock(), clock());
    database.prepare("UPDATE correction_patrol_runs SET state=CASE WHEN EXISTS (SELECT 1 FROM correction_patrol_tasks t WHERE t.business_date=correction_patrol_runs.business_date AND t.state IN ('pending','retry','processing','queued')) THEN 'active' WHEN gaps!='[]' OR EXISTS (SELECT 1 FROM correction_patrol_tasks t WHERE t.business_date=correction_patrol_runs.business_date AND t.state='uncovered') THEN 'uncovered' ELSE 'completed' END").run();
  }
  function status(date = shanghaiDate(clock())) {
    const run = database.prepare("SELECT * FROM correction_patrol_runs WHERE business_date=?").get(date);
    return { enabled: config.enabled, configuration: config, run: run ? { ...run, gaps: JSON.parse(String(run.gaps)) as unknown } : null,
      tasks: database.prepare("SELECT id,target,state,attempts,next_attempt_utc,observed_at_utc,material_id,signal_id,reason FROM correction_patrol_tasks WHERE business_date=? ORDER BY rowid").all(date).map((row) => ({ ...row, target: JSON.parse(String(row.target)) as Target })) };
  }
  return { status, async tick(signal?: AbortSignal) {
    if (!config.enabled || !dependencies.configuration || processing || signal?.aborted) return;
    processing = true;
    let row: Record<string, unknown> | undefined, routing: ReturnType<typeof createProviderRouting> | undefined, finishedRouting = false;
    const owner = randomUUID();
    try {
      start(shanghaiDate(clock())); reconcile();
      database.exec("BEGIN IMMEDIATE");
      try {
        database.prepare("UPDATE correction_patrol_tasks SET state='retry',owner=NULL,lease_until_utc=NULL,reason='patrol-recovered-lease' WHERE state='processing' AND lease_until_utc<=?").run(clock());
        row = database.prepare("SELECT t.*,r.deadline_utc FROM correction_patrol_tasks t JOIN correction_patrol_runs r USING(business_date) WHERE t.state IN ('pending','retry') AND t.attempts<? AND t.next_attempt_utc<=? AND r.deadline_utc>? AND NOT EXISTS (SELECT 1 FROM correction_patrol_tasks WHERE state='processing') ORDER BY t.business_date,t.rowid LIMIT 1").get(config.maxAttempts, clock(), clock());
        if (row) database.prepare("UPDATE correction_patrol_tasks SET state='processing',attempts=attempts+1,owner=?,lease_until_utc=? WHERE id=?").run(owner, new Date(Date.parse(clock()) + config.taskTimeoutMs + 61000).toISOString(), String(row.id));
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
      if (!row) return;
      const target = JSON.parse(String(row.target)) as Target, original = originals(target), timeout = Math.min(config.taskTimeoutMs, Date.parse(String(row.deadline_utc)) - Date.parse(clock()));
      const deadline = new Date(Date.parse(clock()) + timeout).toISOString(), timerSignal = AbortSignal.timeout(Math.max(1, timeout));
      const taskSignal = signal ? AbortSignal.any([signal, timerSignal]) : timerSignal;
      const savedRefs = JSON.parse(String(row.evidence_refs)) as Array<{ evidenceId: string; retrievedAtUtc: string }>;
      const evidence: CollectedEvidence[] = dependencies.configuration.evidence(savedRefs.map((entry) => entry.evidenceId)).filter((entry) => savedRefs.some((ref) => ref.evidenceId === entry.id && ref.retrievedAtUtc === entry.retrievedAtUtc));
      const unique = new Set<string>();
      for (const item of original.evidence) {
        if (!item.url || !item.title) fail("patrol-url-or-title-unavailable");
        const key = `${item.sourceId}:${item.url}`; if (unique.has(key)) continue; unique.add(key);
        if (evidence.some((entry) => entry.sourceId === item.sourceId && entry.url === item.url)) continue;
        const source = dependencies.policies().find((entry) => entry.sourceId === item.sourceId);
        if (!source) fail("patrol-source-policy-unavailable");
        if (source.edition === "social-discourse" || source.edition === "github-projects") fail("patrol-specialized-evidence-uncovered");
        const budget = database.prepare("SELECT next_read_utc FROM correction_patrol_source_budget WHERE source=?").get(source.sourceId);
        if (budget && String(budget.next_read_utc) > clock()) {
          database.prepare("UPDATE correction_patrol_tasks SET state='retry',attempts=attempts-1,next_attempt_utc=?,reason='patrol-source-rate-wait',owner=NULL,lease_until_utc=NULL WHERE id=? AND owner=?").run(String(budget.next_read_utc), String(row.id), owner);
          return;
        }
        const reserved = database.prepare("UPDATE correction_patrol_runs SET reads=reads+1 WHERE business_date=? AND reads<? AND deadline_utc>?").run(String(row.business_date), config.maxReadsPerDay, clock());
        if (!Number(reserved.changes)) fail("patrol-read-budget-uncovered");
        database.prepare("INSERT INTO correction_patrol_source_budget VALUES (?,?) ON CONFLICT(source) DO UPDATE SET next_read_utc=excluded.next_read_utc").run(source.sourceId, new Date(Date.parse(clock()) + source.limits.pollIntervalSeconds * 1000).toISOString());
        evidence.push(await dependencies.configuration.reread({ sourceId: item.sourceId, url: item.url!, title: item.title! }, taskSignal));
        database.prepare("UPDATE correction_patrol_tasks SET evidence_refs=?,observed_at_utc=? WHERE id=? AND owner=?").run(JSON.stringify(evidence.map((entry) => ({ evidenceId: entry.id, retrievedAtUtc: entry.retrievedAtUtc }))), clock(), String(row.id), owner);
      }
      taskSignal.throwIfAborted(); originals(target);
      const affected = original.claims.map((claim, index) => ({ referenceId: `original-${index + 1}`, versionId: target.sourceVersionId, storyId: target.storyId, claimId: claim.id }));
      const materialId = inputDigest([target.expectedCurrentVersionId, affected.map(({ versionId, storyId, claimId }) => [versionId, storyId, claimId]), evidence.map((entry) => [entry.sourceId, entry.url, entry.policySha256, entry.contentSha256]).sort()]);
      const previous = database.prepare("SELECT signal_id FROM correction_patrol_materials WHERE id=?").get(materialId);
      if (previous) {
        database.prepare("UPDATE correction_patrol_tasks SET state='queued',material_id=?,signal_id=?,observed_at_utc=?,reason='patrol-repeated-material',owner=NULL,lease_until_utc=NULL WHERE id=? AND owner=?").run(materialId, String(previous.signal_id), clock(), String(row.id), owner);
        reconcile(); return;
      }
      if (!dependencies.routing || dependencies.mode === "production" && dependencies.routing.executionScope !== "live") fail("patrol-routing-unavailable");
      const authorize = (ids: string[]) => {
        taskSignal.throwIfAborted(); originals(target);
        for (const entry of original.evidence) if (!dependencies.policies().find((source) => source.sourceId === entry.sourceId)?.model.enabled) fail("patrol-original-context-model-forbidden");
        const current = dependencies.configuration!.evidence(ids);
        if (current.length !== ids.length) fail("patrol-material-expired");
        for (const entry of current) {
          const source = dependencies.policies().find((item) => item.sourceId === entry.sourceId);
          if (!source || source.review.status !== "approved" || !source.collection.enabled || !source.model.enabled || !source.model.fields.includes("content") || policyDigest(source) !== entry.policySha256 || entry.expiresAtUtc <= clock()) fail("patrol-current-model-policy-forbidden");
        }
      };
      authorize(evidence.map((entry) => entry.id));
      const projected = evidence.map((entry) => { const value = structuredClone(entry), source = dependencies.policies().find((item) => item.sourceId === entry.sourceId)!;
        for (const field of sourceFields) if (!source.model.fields.includes(field)) delete value[field]; return value; });
      const task: SixEditionRequest = { schemaVersion: 2, taskId: `${row.id}`, businessDate: original.current.version.businessDate, configurationId: original.current.record.configurationId,
        evidenceBundle: { schemaVersion: 2, id: `patrol-material:${materialId}`, businessDate: original.current.version.businessDate, configurationId: original.current.record.configurationId,
          windowStartUtc: original.source.record.evidenceBundle.cutoffUtc, cutoffUtc: clock(), evidence: projected, coverageGaps: [] },
        correctionResearch: { purpose: "seven-day-patrol", originalCutoffUtc: original.source.record.evidenceBundle.cutoffUtc,
          originalStatements: original.claims.map((claim, index) => ({ referenceId: affected[index]!.referenceId, text: claim.text })), eventClusterId: original.story.eventClusterId },
        editions: (Object.keys(editionNames) as Edition[]).map((edition) => ({ edition, evidenceIds: edition === target.edition ? evidence.map((entry) => entry.id) : [] })) };
      routing = createProviderRouting({ ...dependencies.routing!, assemblyIdentity: dependencies.routing!, publicationDeadlineUtc: deadline }, task, (receipt) => {
        const safe = RoutingReceiptSchema.parse(receipt), payload = JSON.stringify(safe);
        if (Buffer.byteLength(payload) > Math.min(MAX_ROUTING_AUDIT_BYTES, safe.configuration.limits.maxAuditBytes)) fail("patrol-routing-audit-capacity");
        database.prepare("INSERT INTO routing_runs VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload").run(safe.runId, payload);
      }, () => ({ status: "available", linkEvidenceIds: evidence.map((entry) => entry.id) }), authorize, taskSignal);
      const result = await routing.run(task, { signal: taskSignal }), output = result.editions.find((entry) => entry.edition === target.edition);
      if (output?.status !== "completed" || output.result.status !== "succeeded") fail("patrol-research-unavailable");
      const candidates = output.result.stories.map((entry) => CandidateV2Schema.parse(entry));
      const finding = candidates.find((entry) => entry.id === "patrol-finding"), replacement = candidates.find((entry) => entry.id === "patrol-replacement") ?? null;
      if (!finding || candidates.length !== 1 + Number(!!replacement) || candidates.some((entry) => entry.eventClusterId !== original.story.eventClusterId)) fail("patrol-invalid-research-candidates");
      const input = CorrectionSignalSchema.parse({ schemaVersion: 1, signalId: `patrol:${materialId}`, expectedCurrentVersionId: target.expectedCurrentVersionId, affected,
        evidence: evidence.map((entry) => ({ evidenceId: entry.id, retrievedAtUtc: entry.retrievedAtUtc })), finding, replacement });
      authorize(evidence.map((entry) => entry.id)); routing.authorize();
      database.exec("BEGIN IMMEDIATE");
      try {
        taskSignal.throwIfAborted(); originals(target);
        if (!database.prepare("SELECT 1 FROM correction_patrol_tasks WHERE id=? AND owner=? AND state='processing'").get(String(row.id), owner)) fail("patrol-lease-lost");
        const queued = enqueueCorrection(database, input, clock());
        database.prepare("INSERT INTO correction_patrol_materials VALUES (?,?,?,?,NULL)").run(materialId, clock(), queued.signalId, JSON.stringify(input.evidence));
        database.prepare("UPDATE correction_patrol_tasks SET state='queued',observed_at_utc=?,material_id=?,signal_id=?,reason=NULL,owner=NULL,lease_until_utc=NULL WHERE id=? AND owner=?").run(clock(), materialId, queued.signalId, String(row.id), owner);
        routing.complete(null, "patrol-candidates-enqueued"); finishedRouting = true;
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    } catch (error) {
      const reason = error instanceof PatrolFailure || error instanceof SourceReadError ? error.message : signal?.aborted ? "patrol-cancelled" : "patrol-processing-unavailable";
      if (routing && !finishedRouting) { try { routing.complete(null, reason); } catch { /* existing routing ledger retains failure */ } }
      if (row) database.prepare("UPDATE correction_patrol_tasks SET state=?,next_attempt_utc=?,reason=?,owner=NULL,lease_until_utc=NULL WHERE id=? AND owner=?").run(
        Number(row.attempts) + 1 < config.maxAttempts && clock() < String(row.deadline_utc) ? "retry" : "uncovered", new Date(Date.parse(clock()) + config.retryDelayMs).toISOString(), reason, String(row.id), owner);
    } finally { processing = false; }
  } };
}
