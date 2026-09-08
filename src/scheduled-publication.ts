import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { CollectedBundleSchema, RoutedRequestSchema, editionNames } from "./contracts.ts";
import { SourcePolicySchema, policyDigest } from "./collection.ts";
import { InterestSnapshotSchema } from "./interest-contracts.ts";
import { DiscourseConfigurationSchema, DiscourseSampleSchema } from "./discourse-contracts.ts";
import { GitHubRepromotionSnapshotSchema } from "./github-development-contracts.ts";
import { RoutingConfigurationSchema } from "./routing-contracts.ts";
import { recoveryDeadline } from "./brief-recovery.ts";

const utc = z.iso.datetime({ precision: 3, offset: false });
export const ScheduleConfigurationSchema = z.strictObject({
  enabled: z.boolean().default(false), startBusinessDate: z.iso.date(),
  retryDelayMs: z.number().int().min(1000).max(3600000).default(60000),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  recoveryRetryDelayMs: z.number().int().min(60000).max(3600000).default(300000),
});
export const ScheduledSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1), request: RoutedRequestSchema, policies: z.array(SourcePolicySchema),
  interest: InterestSnapshotSchema, discourse: DiscourseConfigurationSchema,
  github: GitHubRepromotionSnapshotSchema, routing: RoutingConfigurationSchema,
  configuration: z.json(), versions: z.record(z.string(), z.string()), frozenAtUtc: utc,
  collectionRecovery: z.strictObject({ attachedAtUtc: utc, evidenceIds: z.array(z.string()), originalCoverageGaps: CollectedBundleSchema.shape.coverageGaps }).optional(),
});
export type ScheduledSnapshot = z.infer<typeof ScheduledSnapshotSchema>;
export function dailyWindow(businessDate: string) {
  z.iso.date().parse(businessDate);
  const cutoffUtc = new Date(`${businessDate}T07:30:00+08:00`).toISOString();
  return { businessDate, cutoffUtc, windowStartUtc: new Date(Date.parse(cutoffUtc) - 86400000).toISOString(),
    deadlineUtc: new Date(Date.parse(cutoffUtc) + 3600000).toISOString() };
}
export function shanghaiDate(atUtc: string) { return new Date(Date.parse(utc.parse(atUtc)) + 28800000).toISOString().slice(0, 10); }

// One local node. The persisted PID prevents a second live process claiming a task;
// a dead process can be retried. No cross-host lease, takeover, or routing-run rewrite.
export function scheduledStore(database: DatabaseSync, clock: () => string) {
  const instance = randomUUID();
  database.exec(`CREATE TABLE IF NOT EXISTS scheduled_tasks (
    business_date TEXT PRIMARY KEY, cutoff_utc TEXT NOT NULL, deadline_utc TEXT NOT NULL,
    frozen_at_utc TEXT NOT NULL, snapshot TEXT NOT NULL, state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, owner TEXT, pid INTEGER, next_attempt_utc TEXT,
    completed_at_utc TEXT, readable_at_utc TEXT, failure TEXT);
    CREATE TABLE IF NOT EXISTS delivery_outbox (
    id TEXT PRIMARY KEY, report_version_id TEXT NOT NULL UNIQUE REFERENCES reports(id),
    created_at_utc TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending');
    CREATE TABLE IF NOT EXISTS scheduled_discourse_samples (
    business_date TEXT NOT NULL,group_id TEXT NOT NULL,payload TEXT NOT NULL,
    PRIMARY KEY(business_date,group_id));`);
  const columns = database.prepare("PRAGMA table_info(scheduled_tasks)").all().map((entry) => entry.name);
  for (const [name, definition] of Object.entries({ latest_version_id: "TEXT", content_state: "TEXT", timing_state: "TEXT", recovery_state: "TEXT NOT NULL DEFAULT 'open'", missed_at_utc: "TEXT", latest_readable_at_utc: "TEXT" })) {
    if (!columns.includes(name)) database.exec(`ALTER TABLE scheduled_tasks ADD COLUMN ${name} ${definition}`);
  }
  database.exec("UPDATE scheduled_tasks SET latest_version_id=business_date||'-v1',latest_readable_at_utc=readable_at_utc WHERE latest_version_id IS NULL AND state IN ('published','readable') AND EXISTS (SELECT 1 FROM reports WHERE id=business_date||'-v1')");
  const row = (date: string) => database.prepare("SELECT * FROM scheduled_tasks WHERE business_date=?").get(date);
  const status = (date: string) => {
    const value = row(date); if (!value) return null;
    return { businessDate: String(value.business_date), cutoffUtc: String(value.cutoff_utc), deadlineUtc: String(value.deadline_utc),
      frozenAtUtc: String(value.frozen_at_utc), state: String(value.state), attempts: Number(value.attempts),
      completedAtUtc: value.completed_at_utc as string | null, readableAtUtc: value.readable_at_utc as string | null,
      latestVersionId: value.latest_version_id as string | null, latestReadableAtUtc: value.latest_readable_at_utc as string | null,
      content: value.content_state as string | null, timing: value.timing_state as string | null,
      recovery: String(value.recovery_state), recoveryDeadlineUtc: recoveryDeadline(date), missedAtUtc: value.missed_at_utc as string | null,
      onTime: value.readable_at_utc === null ? null : String(value.readable_at_utc) <= String(value.deadline_utc), failure: value.failure as string | null };
  };
  return {
    status,
    recoverCollection(date: string, input: unknown) {
      const value = row(date);
      if (!value || value.latest_version_id || value.state === "running" || value.recovery_state !== "open" || clock() >= recoveryDeadline(date)) return false;
      const snapshot = ScheduledSnapshotSchema.parse(JSON.parse(String(value.snapshot)));
      const original = snapshot.request.evidenceBundle;
      if (original.schemaVersion !== 2 || original.evidence.length || snapshot.collectionRecovery) return false;
      const recovered = CollectedBundleSchema.parse(input);
      const evidence = recovered.evidence.filter((entry) => entry.publishedAtUtc && entry.publishedAtUtc > original.windowStartUtc && entry.publishedAtUtc <= original.cutoffUtc && entry.retrievedAtUtc <= clock() && entry.discoveredAtUtc <= entry.retrievedAtUtc &&
        snapshot.policies.some((source) => source.sourceId === entry.sourceId && source.version === entry.policyVersion && policyDigest(source) === entry.policySha256));
      if (!evidence.length) return false;
      snapshot.collectionRecovery = { attachedAtUtc: clock(), evidenceIds: evidence.map((entry) => entry.id), originalCoverageGaps: original.coverageGaps };
      snapshot.request = RoutedRequestSchema.parse({ ...snapshot.request, evidenceBundle: { ...original, evidence, coverageGaps: recovered.coverageGaps } });
      snapshot.request.editions = (Object.keys(editionNames) as Array<keyof typeof editionNames>).map((edition) => ({ edition, evidenceIds: evidence.filter((entry) => snapshot.policies.find((source) => source.sourceId === entry.sourceId)?.edition === edition).map((entry) => entry.id) }));
      database.prepare("UPDATE scheduled_tasks SET snapshot=?,state='queued',next_attempt_utc=? WHERE business_date=? AND latest_version_id IS NULL AND state!='running'").run(JSON.stringify(snapshot), clock(), date);
      return true;
    },
    expire() {
      for (const value of database.prepare("SELECT business_date,latest_version_id FROM scheduled_tasks WHERE recovery_state='open'").all()) {
        const date = String(value.business_date);
        if (clock() < recoveryDeadline(date)) continue;
        database.prepare("UPDATE scheduled_tasks SET recovery_state='closed',state=CASE WHEN latest_version_id IS NULL THEN 'missed' WHEN latest_readable_at_utc IS NULL THEN 'published' ELSE 'readable' END,missed_at_utc=CASE WHEN latest_version_id IS NULL THEN ? ELSE NULL END,owner=NULL,pid=NULL WHERE business_date=?")
          .run(clock(), date);
      }
    },
    saveDiscourseSample(input: unknown) {
      const sample = DiscourseSampleSchema.parse(input);
      if (sample.capturedAtUtc > sample.cutoffUtc || status(sample.businessDate)) return;
      database.prepare("INSERT INTO scheduled_discourse_samples VALUES (?,?,?) ON CONFLICT(business_date,group_id) DO UPDATE SET payload=excluded.payload")
        .run(sample.businessDate, sample.groupId, JSON.stringify(sample));
    },
    discourseSamples(date: string) {
      return database.prepare("SELECT payload FROM scheduled_discourse_samples WHERE business_date=? ORDER BY group_id").all(date)
        .map((entry) => DiscourseSampleSchema.parse(JSON.parse(String(entry.payload))));
    },
    freeze(snapshot: ScheduledSnapshot) {
      const value = ScheduledSnapshotSchema.parse(snapshot), window = dailyWindow(value.request.businessDate);
      if (value.request.evidenceBundle.cutoffUtc !== window.cutoffUtc || value.request.evidenceBundle.windowStartUtc !== window.windowStartUtc || value.frozenAtUtc < window.cutoffUtc) throw new Error("invalid-scheduled-window");
      database.prepare("INSERT INTO scheduled_tasks (business_date,cutoff_utc,deadline_utc,frozen_at_utc,snapshot,state,next_attempt_utc) VALUES (?,?,?,?,?,'queued',?) ON CONFLICT(business_date) DO NOTHING")
        .run(window.businessDate, window.cutoffUtc, window.deadlineUtc, value.frozenAtUtc, JSON.stringify(value), value.frozenAtUtc);
      return status(window.businessDate)!;
    },
    pending() { return database.prepare("SELECT business_date FROM scheduled_tasks WHERE recovery_state='open' OR (latest_version_id IS NOT NULL AND latest_readable_at_utc IS NULL) ORDER BY business_date").all().map((entry) => String(entry.business_date)); },
    claim(date: string, maxAttempts: number): ScheduledSnapshot | null {
      database.exec("BEGIN IMMEDIATE");
      try {
        const value = row(date);
        if (!value || value.recovery_state !== "open" || clock() >= recoveryDeadline(date) ||
          value.latest_version_id && value.latest_readable_at_utc === null || value.next_attempt_utc && String(value.next_attempt_utc) > clock()) { database.exec("COMMIT"); return null; }
        if (value.state === "running" && value.pid) {
          let alive = true;
          try { process.kill(Number(value.pid), 0); } catch (error) { alive = (error as NodeJS.ErrnoException).code !== "ESRCH"; }
          if (alive) { database.exec("COMMIT"); return null; }
        }
        // maxAttempts bounds each short retry cycle; exhausted cycles resume at the
        // configured recovery backoff, and the noon boundary bounds the entire day.
        const snapshot = ScheduledSnapshotSchema.parse(JSON.parse(String(value.snapshot)));
        database.prepare("UPDATE scheduled_tasks SET state='running',owner=?,pid=?,attempts=attempts+1,failure=NULL WHERE business_date=?").run(instance, process.pid, date);
        database.exec("COMMIT"); return snapshot;
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    },
    owned(date: string) { const value = row(date); return value?.state === "running" && value.owner === instance; },
    // Called inside Observer's existing publication transaction, after the Report insert.
    published(date: string, versionId: string, atUtc: string, content: string, timing: string, recoverable: boolean, retryDelayMs: number) {
      if (atUtc >= recoveryDeadline(date)) throw new Error("recovery-window-closed");
      const updated = database.prepare("UPDATE scheduled_tasks SET state='published',completed_at_utc=?,latest_version_id=?,latest_readable_at_utc=NULL,content_state=?,timing_state=?,recovery_state=?,next_attempt_utc=?,owner=NULL,pid=NULL WHERE business_date=? AND state='running' AND owner=?")
        .run(atUtc, versionId, content, timing, recoverable ? "open" : "complete", new Date(Date.parse(atUtc) + retryDelayMs).toISOString(), date, instance);
      if (!updated.changes) throw new Error("scheduled-task-ownership-lost");
      database.prepare("INSERT INTO delivery_outbox (id,report_version_id,created_at_utc) VALUES (?,?,?)").run(`report-published:${versionId}`, versionId, atUtc);
    },
    failed(date: string, reason: string, configuration: z.infer<typeof ScheduleConfigurationSchema>) {
      const value = row(date);
      const exhausted = Number(value?.attempts ?? 0) % configuration.maxAttempts === 0;
      database.prepare("UPDATE scheduled_tasks SET state=CASE WHEN latest_version_id IS NOT NULL THEN CASE WHEN latest_readable_at_utc IS NULL THEN 'published' ELSE 'readable' END ELSE ? END,owner=NULL,pid=NULL,failure=?,next_attempt_utc=? WHERE business_date=? AND owner=?")
        .run(exhausted ? "failed" : "queued", reason, new Date(Date.parse(clock()) + (exhausted || value?.latest_version_id ? configuration.recoveryRetryDelayMs : configuration.retryDelayMs)).toISOString(), date, instance);
    },
    readable(versionId: string) {
      database.prepare("UPDATE scheduled_tasks SET state='readable',readable_at_utc=COALESCE(readable_at_utc,?),latest_readable_at_utc=? WHERE latest_version_id=? AND state='published'").run(clock(), clock(), versionId);
    },
    outbox() { return database.prepare("SELECT id,report_version_id AS reportVersionId,created_at_utc AS createdAtUtc,state FROM delivery_outbox ORDER BY created_at_utc,id").all(); },
    // Frozen raw evidence obeys the original cache lifetime even after publication.
    purge(policies: z.infer<typeof SourcePolicySchema>[]) {
      for (const value of database.prepare("SELECT business_date,group_id,payload FROM scheduled_discourse_samples").all()) {
        const sample = DiscourseSampleSchema.parse(JSON.parse(String(value.payload)));
        const source = policies.find((entry) => entry.sourceId === sample.sourceId);
        if (sample.expiresAtUtc <= clock() || !source || !source.collection.enabled || source.review.status !== "approved" || source.version !== sample.policyVersion || policyDigest(source) !== sample.policySha256)
          database.prepare("DELETE FROM scheduled_discourse_samples WHERE business_date=? AND group_id=?").run(String(value.business_date), String(value.group_id));
      }
      for (const value of database.prepare("SELECT business_date,snapshot,state FROM scheduled_tasks").all()) {
        const snapshot = ScheduledSnapshotSchema.parse(JSON.parse(String(value.snapshot)));
        let changed = false, invalid = false;
        if (snapshot.request.discourseSamples) {
          snapshot.request.discourseSamples = snapshot.request.discourseSamples.filter((input) => {
            const sample = DiscourseSampleSchema.parse(input), source = policies.find((entry) => entry.sourceId === sample.sourceId);
            const keep = sample.expiresAtUtc > clock() && source && JSON.stringify(source) === JSON.stringify(snapshot.policies.find((entry) => entry.sourceId === sample.sourceId));
            if (!keep) { changed = true; invalid = true; } return keep;
          });
        }
        const bundle = snapshot.request.evidenceBundle;
        if (bundle.schemaVersion === 2) bundle.evidence = bundle.evidence.filter((evidence) => {
          const original = snapshot.policies.find((source) => source.sourceId === evidence.sourceId);
          const current = policies.find((source) => source.sourceId === evidence.sourceId);
          if (evidence.expiresAtUtc <= clock() || !current || JSON.stringify(original) !== JSON.stringify(current)) {
            invalid = true; changed = true; return false;
          }
          return true;
        });
        if (changed) database.prepare("UPDATE scheduled_tasks SET snapshot=? WHERE business_date=?").run(JSON.stringify(snapshot), String(value.business_date));
        if (invalid && ["queued", "running"].includes(String(value.state))) database.prepare("UPDATE scheduled_tasks SET state='failed',failure='frozen-evidence-expired-or-revoked',owner=NULL,pid=NULL WHERE business_date=?").run(String(value.business_date));
      }
    },
    close() { database.prepare("UPDATE scheduled_tasks SET state='queued',owner=NULL,pid=NULL WHERE state='running' AND owner=?").run(instance); },
  };
}
