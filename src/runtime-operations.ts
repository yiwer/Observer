import { timingSafeEqual } from "node:crypto";
import { statfsSync, writeFileSync, renameSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PrivateApiError } from "./private-access.ts";
import { agentContainerStatus } from "./agent-container.ts";

export function operationalStorage(databasePath: string, businessDate: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    database.exec("PRAGMA busy_timeout=1000; PRAGMA query_only=ON");
    if (database.prepare("PRAGMA user_version").get()!.user_version !== 1) throw new Error("unsupported-storage");
    const exists = (name: string) => !!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
    const counts = (table: string) => exists(table) ? database.prepare(`SELECT state,COUNT(*) AS count FROM ${table} GROUP BY state`).all() : [];
    return {
      recoverySnapshotId: exists("recovery_snapshot") ? database.prepare("SELECT snapshot_id FROM recovery_snapshot WHERE id=1").get()?.snapshot_id ?? null : null,
      scheduled: exists("scheduled_tasks") ? database.prepare(`SELECT business_date AS businessDate,state,attempts,
        frozen_at_utc AS frozenAtUtc,completed_at_utc AS completedAtUtc,latest_version_id AS latestVersionId,
        latest_readable_at_utc AS latestReadableAtUtc,content_state AS content,timing_state AS timing,
        recovery_state AS recovery,missed_at_utc AS missedAtUtc,failure FROM scheduled_tasks WHERE business_date=?`).get(businessDate) ?? null : null,
      research: exists("routing_runs") ? database.prepare(`SELECT json_extract(payload,'$.status') AS state,
        json_extract(payload,'$.outcome') AS outcome,json_extract(payload,'$.failureReason') AS failure,
        json_extract(payload,'$.externalRequests') AS externalRequests,json_array_length(payload,'$.attempts') AS attempts
        FROM routing_runs WHERE json_extract(payload,'$.taskId') IN
          (SELECT json_extract(snapshot,'$.request.taskId') FROM scheduled_tasks WHERE business_date=?)
        ORDER BY rowid DESC LIMIT 10`).all(businessDate) : [],
      pdf: counts("pdf_renditions"), email: counts("email_deliveries"), corrections: counts("correction_signals"), patrol: counts("correction_patrol_tasks"),
      emailMeaning: "accepted-is-not-delivered; unknown-requires-evidence-no-blind-retry",
    };
  } finally { database.close(); }
}

export function createRuntimeOperations(storageDirectories: string[], ownerToken: string) {
  const minimumBytes = Number(process.env.OBSERVER_MIN_FREE_BYTES ?? String(512 * 1024 * 1024));
  const minimumInodes = Number(process.env.OBSERVER_MIN_FREE_INODES ?? "1024");
  if (!Number.isSafeInteger(minimumBytes) || minimumBytes < 64 * 1024 * 1024 || !Number.isSafeInteger(minimumInodes) || minimumInodes < 0) throw new Error("invalid-storage-budget");
  const startedAtUtc = new Date().toISOString();
  let heartbeatAtUtc = startedAtUtc, disk: { state: string; freeBytes: number | null; freeInodes: number | null } = { state: "unchecked", freeBytes: null, freeInodes: null };
  let lastDiskCheck = 0, stopping = false;
  const jobs: Record<string, { state: string; startedAtUtc: string | null; finishedAtUtc: string | null; failures: number }> = {};
  return {
    failure(name: string) {
      const job = jobs[name] ??= { state: "idle", startedAtUtc: null, finishedAtUtc: null, failures: 0 };
      job.state = "failed"; job.failures++; job.finishedAtUtc = new Date().toISOString();
    },
    heartbeat() {
      heartbeatAtUtc = new Date().toISOString();
      if (Date.now() - lastDiskCheck >= 10000) {
        lastDiskCheck = Date.now();
        try {
          const stats = storageDirectories.map((path) => statfsSync(path));
          const freeBytes = Math.min(...stats.map((stat) => stat.bavail * stat.bsize));
          // Some filesystems report zero total inodes; that is not a full inode table.
          const inodeCounts = stats.filter((stat) => stat.files > 0).map((stat) => stat.ffree);
          const freeInodes = inodeCounts.length ? Math.min(...inodeCounts) : null;
          disk = { state: freeBytes < minimumBytes || freeInodes !== null && freeInodes < minimumInodes ? "low-space" : "ready", freeBytes, freeInodes };
        } catch { disk = { state: "storage-unavailable", freeBytes: null, freeInodes: null }; }
      }
      const healthFile = process.env.OBSERVER_HEALTH_FILE;
      if (healthFile) {
        try {
          writeFileSync(`${healthFile}.next`, JSON.stringify({ heartbeatAtUtc, stopping, disk: disk.state }), { mode: 0o600 });
          renameSync(`${healthFile}.next`, healthFile);
        } catch { disk = { ...disk, state: "health-state-unwritable" }; }
      }
      return disk.state === "ready" && !stopping;
    },
    async run(name: string, work: () => Promise<unknown>) {
      if (jobs[name]?.state === "running") return;
      const job = jobs[name] ??= { state: "idle", startedAtUtc: null, finishedAtUtc: null, failures: 0 };
      job.state = "running"; job.startedAtUtc = new Date().toISOString();
      try { await work(); job.state = "idle"; }
      catch { job.state = "failed"; job.failures++; console.error(JSON.stringify({ event: "background-failed", job: name })); }
      finally { job.finishedAtUtc = new Date().toISOString(); }
    },
    stop() { stopping = true; },
    status(credential: string | undefined) {
      const actual = Buffer.from(credential ?? ""), expected = Buffer.from(ownerToken);
      if (!actual.length || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new PrivateApiError("unauthorized", 401);
      return { schemaVersion: 1, startedAtUtc, heartbeatAtUtc, stopping,
        disk: { ...disk, minimumBytes, minimumInodes }, agents: agentContainerStatus(), jobs: structuredClone(jobs) };
    },
  };
}
