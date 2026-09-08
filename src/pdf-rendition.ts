import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";
import { z } from "zod";
import type { PublishedReport } from "./contracts.ts";
import { PrivateApiError } from "./private-access.ts";
import type { PdfInput, PdfOutput } from "./pdf-worker.ts";

export const PdfConfigurationSchema = z.strictObject({ enabled: z.boolean().default(true) });
const engine = "observer-pdf-v1/pdfkit-0.17.2/commonmark/noto-sc-2.004";
const maxAttempts = 3, retryDelayMs = 60_000, timeoutMs = 60_000, leaseMs = 120_000;

/** Independent, persisted rendition work. Report INSERT queues work atomically;
 * only a complete worker result is committed, never a partial PDF or changed MD. */
export function pdfRenditions(database: DatabaseSync, clock: () => string, mode: "production" | "test-fixture", enabled: boolean) {
  database.exec("CREATE TABLE IF NOT EXISTS rights_versions(version_id TEXT PRIMARY KEY,removed_at_utc TEXT NOT NULL,retain_version_audit INTEGER NOT NULL)");
  const time = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  const snapshot = (row: string) => `json_object('schemaVersion',1,'format','pdf','scope','full-report','versionId',${row}.version_id,
    'provenance',(SELECT json_extract(payload,'$.version.provenance') FROM reports WHERE id=${row}.version_id),
    'canonicalMarkdownSha256',${row}.canonical_sha256,'state',${row}.state,'attempts',${row}.attempts,'maxAttempts',3,
    'nextAttemptAtUtc',CASE WHEN ${row}.state='pending' THEN ${row}.next_attempt_at ELSE NULL END,
    'updatedAtUtc',${row}.updated_at,'error',${row}.error,'engine',${row}.engine,'bytes',${row}.bytes,'pages',${row}.pages,'glyphFallbacks',${row}.glyph_fallbacks)`;
  database.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS pdf_renditions (
      version_id TEXT PRIMARY KEY REFERENCES reports(id), canonical_sha256 TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL, lease_until TEXT, attempt_id TEXT, updated_at TEXT NOT NULL,
      error TEXT, engine TEXT, bytes INTEGER, pages INTEGER, glyph_fallbacks INTEGER, pdf BLOB);
    CREATE TRIGGER IF NOT EXISTS pdf_state_insert AFTER INSERT ON pdf_renditions BEGIN
      INSERT INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
      VALUES ('pdf:'||lower(hex(randomblob(16))),'rendition-state',substr(NEW.version_id,1,10),NEW.version_id,${time},${snapshot("NEW")}); END;
    CREATE TRIGGER IF NOT EXISTS pdf_state_update AFTER UPDATE ON pdf_renditions BEGIN
      INSERT INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
      VALUES ('pdf:'||lower(hex(randomblob(16))),'rendition-state',substr(NEW.version_id,1,10),NEW.version_id,${time},${snapshot("NEW")}); END;
    CREATE TRIGGER IF NOT EXISTS pdf_report_insert AFTER INSERT ON reports BEGIN
      INSERT INTO pdf_renditions(version_id,canonical_sha256,next_attempt_at,updated_at)
      VALUES (NEW.id,json_extract(NEW.payload,'$.version.canonicalMarkdownSha256'),'0001-01-01T00:00:00.000Z',${time}); END;
    INSERT OR IGNORE INTO pdf_renditions(version_id,canonical_sha256,next_attempt_at,updated_at)
      SELECT id,json_extract(payload,'$.version.canonicalMarkdownSha256'),'0001-01-01T00:00:00.000Z',${time} FROM reports
      WHERE COALESCE(json_extract(payload,'$.rightsRemoved'),0)=0 AND NOT EXISTS(SELECT 1 FROM rights_versions WHERE version_id=reports.id);
    COMMIT;`);
  let active: Worker | null = null, processing = false, closed = false;
  const visibility = mode === "production" ? " AND json_extract(r.payload,'$.version.provenance')!='test-fixture'" : "";
  function convert(input: PdfInput, signal?: AbortSignal): Promise<PdfOutput> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url.endsWith(".ts") ? "./pdf-worker.ts" : "./pdf-worker.js", import.meta.url), {
        workerData: input, env: {}, resourceLimits: { maxOldGenerationSizeMb: 512 },
      });
      active = worker; let result: PdfOutput | undefined, failure: Error | undefined;
      const stop = (reason: string) => { failure = new Error(reason); void worker.terminate(); };
      const timer = setTimeout(() => stop("pdf-timeout"), timeoutMs);
      const abort = () => stop("pdf-interrupted");
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      worker.on("message", (message: PdfOutput & { ok: boolean; reason?: string }) => {
        if (message.ok) result = { bytes: message.bytes, pages: message.pages, glyphFallbacks: message.glyphFallbacks };
        else failure = new Error(message.reason ?? "pdf-conversion-failed");
      });
      worker.on("error", () => { failure ??= new Error("pdf-worker-failed"); });
      worker.on("exit", (code) => {
        clearTimeout(timer); signal?.removeEventListener("abort", abort); active = null;
        if (failure || code !== 0 || !result) reject(failure ?? new Error("pdf-worker-failed")); else resolve(result);
      });
    });
  }
  return {
    async processNext(read: (versionId: string) => PublishedReport, signal?: AbortSignal) {
      if (!enabled || closed || processing || signal?.aborted) return;
      processing = true;
      let claim: { versionId: string; attemptId: string; attempts: number } | undefined;
      try {
        const now = clock();
        database.exec("BEGIN IMMEDIATE");
        try {
          database.prepare(`UPDATE pdf_renditions SET state=CASE WHEN attempts>=? THEN 'failed' ELSE 'pending' END,
            error='pdf-interrupted',next_attempt_at=?,lease_until=NULL,attempt_id=NULL,updated_at=? WHERE state='processing' AND lease_until<=?`)
            .run(maxAttempts, now, now, now);
          const row = database.prepare(`SELECT p.version_id,p.attempts FROM pdf_renditions p JOIN reports r ON r.id=p.version_id
            WHERE p.state='pending' AND p.attempts<? AND p.next_attempt_at<=?${visibility} ORDER BY p.next_attempt_at,p.version_id DESC LIMIT 1`).get(maxAttempts, now);
          if (row) {
            claim = { versionId: String(row.version_id), attemptId: randomUUID(), attempts: Number(row.attempts) + 1 };
            database.prepare("UPDATE pdf_renditions SET state='processing',attempts=?,attempt_id=?,lease_until=?,updated_at=? WHERE version_id=?")
              .run(claim.attempts, claim.attemptId, new Date(Date.parse(now) + leaseMs).toISOString(), now, claim.versionId);
          }
          database.exec("COMMIT");
        } catch (error) { database.exec("ROLLBACK"); throw error; }
        if (!claim) return;
        const report = read(claim.versionId);
        const output = await convert({ canonicalMarkdown: report.canonicalMarkdown, version: report.version }, signal);
        if (closed) return;
        // Recheck withdrawal and current Source Policy after asynchronous conversion.
        read(claim.versionId);
        database.prepare(`UPDATE pdf_renditions SET state='ready',pdf=?,bytes=?,pages=?,glyph_fallbacks=?,engine=?,error=NULL,
          lease_until=NULL,attempt_id=NULL,updated_at=? WHERE version_id=? AND attempt_id=? AND canonical_sha256=?`)
          .run(Buffer.from(output.bytes), output.bytes.length, output.pages, output.glyphFallbacks, engine, clock(), claim.versionId, claim.attemptId, report.version.canonicalMarkdownSha256);
      } catch (error) {
        if (claim && !closed) {
          const reason = error instanceof Error && /^pdf-[a-z-]+$/.test(error.message) ? error.message : "pdf-source-unreadable";
          database.prepare(`UPDATE pdf_renditions SET state=?,error=?,next_attempt_at=?,lease_until=NULL,attempt_id=NULL,updated_at=? WHERE version_id=? AND attempt_id=?`)
            .run(claim.attempts >= maxAttempts ? "failed" : "pending", reason, new Date(Date.parse(clock()) + retryDelayMs).toISOString(), clock(), claim.versionId, claim.attemptId);
        } else if (!closed) throw error;
      } finally { processing = false; }
    },
    read(report: PublishedReport, edition: string | null = null): Buffer {
      if (edition !== null) throw new PrivateApiError("pdf-full-report-only");
      const row = database.prepare("SELECT state,canonical_sha256,pdf FROM pdf_renditions WHERE version_id=?").get(report.version.id);
      if (!row || row.state !== "ready" || !(row.pdf instanceof Uint8Array)) throw new PrivateApiError("rendition-not-available", 404);
      if (row.canonical_sha256 !== report.version.canonicalMarkdownSha256) throw new PrivateApiError("rendition-source-mismatch", 409);
      return Buffer.from(row.pdf);
    },
    close() { closed = true; if (active) void active.terminate(); },
  };
}
