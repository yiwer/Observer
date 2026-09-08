import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { PublishedReport } from "./contracts.ts";
import { PrivateApiError } from "./private-access.ts";
import { EmailConfigurationSchema, emailBudgets, notificationKindSchema, type EmailOptions, type NotificationKind } from "./email-contracts.ts";
import { prepareEmail } from "./email-message.ts";

const versionIdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}-v[1-9]\d*$/);
const utc = z.iso.datetime({ precision: 3, offset: false });
const reference = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/);
const reconcileSchema = z.strictObject({ eventId: z.uuid(), deliveryId: z.uuid(),
  state: z.enum(["accepted", "delivered", "bounced", "rejected"]),
  source: z.enum(["owner-confirmation", "provider-evidence"]), evidenceReference: reference,
  occurredAtUtc: utc.nullable(), providerMessageId: reference.nullable(),
}).refine((value) => value.source !== "owner-confirmation" || value.state === "delivered", "owner-confirms-receipt-only");

/** #20 calls this in its publication transaction, after INSERT of the new version.
 * No send happens here; repeated version/kind inserts preserve the existing event. */
export function enqueueEmailNotification(database: DatabaseSync, input: { versionId: string; kind: NotificationKind; atUtc: string }) {
  const versionId = versionIdSchema.parse(input.versionId), kind = notificationKindSchema.parse(input.kind), atUtc = utc.parse(input.atUtc);
  const row = database.prepare("SELECT json_extract(payload,'$.version.revisionReason') AS reason FROM reports WHERE id=?").get(versionId);
  if (!row) throw new PrivateApiError("not-found", 404);
  if (kind === "significant-correction" ? row.reason !== "correction" : !["initial", "completion"].includes(String(row.reason)))
    throw new PrivateApiError("notification-version-kind-mismatch", 409);
  const id = `${kind}:${versionId}`;
  database.prepare("INSERT OR IGNORE INTO email_notifications(id,version_id,kind,created_at_utc) VALUES (?,?,?,?)").run(id, versionId, kind, atUtc);
  return { notificationId: id, versionId, kind };
}

/** Local filesystem authority only. Evidence is a human attestation, not a QQ callback.
 * It never schedules another send, even when evidence confirms non-acceptance. */
export function reconcileEmailDelivery(database: DatabaseSync, input: unknown, clock: () => string) {
  const value = reconcileSchema.parse(input), now = clock();
  if (value.occurredAtUtc && value.occurredAtUtc > now) throw new PrivateApiError("future-email-evidence");
  database.exec("BEGIN IMMEDIATE");
  try {
    const existing = database.prepare("SELECT payload FROM email_reconciliations WHERE event_id=?").get(value.eventId);
    if (existing) {
      if (existing.payload !== JSON.stringify(value)) throw new PrivateApiError("email-evidence-conflict", 409);
      database.exec("COMMIT"); return { schemaVersion: 1, eventId: value.eventId, applied: false };
    }
    const row = database.prepare("SELECT state FROM email_deliveries WHERE id=?").get(value.deliveryId);
    if (!row) throw new PrivateApiError("not-found", 404);
    const allowed: Record<string, string[]> = { unknown: ["accepted", "delivered", "bounced", "rejected"], accepted: ["delivered", "bounced"], delivered: ["bounced"] };
    // Duplicate and older facts remain auditable without regressing delivery state.
    const applies = allowed[String(row.state)]?.includes(value.state) ?? false;
    if (!["unknown", "accepted", "delivered", "bounced", "rejected"].includes(String(row.state))) throw new PrivateApiError("email-not-reconcilable", 409);
    database.prepare("INSERT INTO email_reconciliations(event_id,delivery_id,recorded_at_utc,payload) VALUES (?,?,?,?)")
      .run(value.eventId, value.deliveryId, now, JSON.stringify(value));
    if (applies) {
      const field = ({ accepted: "accepted_at_utc", delivered: "delivered_at_utc", bounced: "bounced_at_utc", rejected: "rejected_at_utc" } as const)[value.state];
      database.prepare(`UPDATE email_deliveries SET state=?,${field}=COALESCE(${field},?),provider_message_id=COALESCE(provider_message_id,?),reason='local-evidence-reconciliation',updated_at_utc=? WHERE id=?`)
        .run(value.state, value.occurredAtUtc, value.providerMessageId, now, value.deliveryId);
    }
    database.exec("COMMIT"); return { schemaVersion: 1, eventId: value.eventId, applied: applies };
  } catch (error) { database.exec("ROLLBACK"); throw error; }
}

type Row = { id: string; version_id: string; kind: NotificationKind; sender: string; recipient: string;
  message_id: string; attempts: number; wait_until_utc: string; attempt_id: string | null };
type Readers = { report(versionId: string): PublishedReport; pdf(report: PublishedReport): Buffer;
  grant(versionId: string, format: "pdf" | "markdown"): { path: string; expiresAtUtc: string } };

export function emailDeliveries(database: DatabaseSync, clock: () => string, mode: "production" | "test-fixture", options?: EmailOptions) {
  database.exec("CREATE TABLE IF NOT EXISTS rights_email_scope(delivery_id TEXT PRIMARY KEY,version_id TEXT NOT NULL,scope TEXT NOT NULL,recorded_at_utc TEXT NOT NULL)");
  const configuration = EmailConfigurationSchema.parse(options?.configuration ?? { enabled: false });
  if (configuration.enabled && !options?.transport) throw new Error("email-transport-required");
  if (configuration.enabled && mode === "production" && options?.transport.provenance !== "live") throw new Error("email-live-transport-required");
  database.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS email_notifications(id TEXT PRIMARY KEY,version_id TEXT NOT NULL REFERENCES reports(id),
      kind TEXT NOT NULL,created_at_utc TEXT NOT NULL,UNIQUE(version_id,kind));
    CREATE TABLE IF NOT EXISTS email_deliveries(id TEXT PRIMARY KEY,notification_id TEXT NOT NULL UNIQUE REFERENCES email_notifications(id),
      business_date TEXT NOT NULL,version_id TEXT NOT NULL REFERENCES reports(id),kind TEXT NOT NULL,sender TEXT NOT NULL,recipient TEXT NOT NULL,
      published_at_utc TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,
      message_id TEXT NOT NULL UNIQUE,provider_message_id TEXT,transport TEXT NOT NULL,transport_provenance TEXT NOT NULL,
      next_attempt_at_utc TEXT NOT NULL,wait_until_utc TEXT NOT NULL,lease_until_utc TEXT,attempt_id TEXT,
      created_at_utc TEXT NOT NULL,updated_at_utc TEXT NOT NULL,attempt_started_at_utc TEXT,accepted_at_utc TEXT,
      delivered_at_utc TEXT,bounced_at_utc TEXT,rejected_at_utc TEXT,unknown_at_utc TEXT,
      reason TEXT,response_code INTEGER,mime_bytes INTEGER,attached_pdf INTEGER,pdf_reason TEXT,download_format TEXT,link_expires_at_utc TEXT,
      UNIQUE(business_date,version_id,recipient,kind));
    CREATE TABLE IF NOT EXISTS email_delivery_events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,delivery_id TEXT NOT NULL REFERENCES email_deliveries(id),
      recorded_at_utc TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL,reason TEXT,response_code INTEGER,provider_message_id TEXT);
    CREATE TABLE IF NOT EXISTS email_reconciliations(event_id TEXT PRIMARY KEY,delivery_id TEXT NOT NULL REFERENCES email_deliveries(id),
      recorded_at_utc TEXT NOT NULL,payload TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS email_delivery_insert AFTER INSERT ON email_deliveries BEGIN
      INSERT INTO email_delivery_events(delivery_id,recorded_at_utc,state,attempts,reason,response_code,provider_message_id)
      VALUES (NEW.id,NEW.updated_at_utc,NEW.state,NEW.attempts,NEW.reason,NEW.response_code,NEW.provider_message_id); END;
    CREATE TRIGGER IF NOT EXISTS email_delivery_update AFTER UPDATE ON email_deliveries
      WHEN NEW.state IS NOT OLD.state OR NEW.attempts IS NOT OLD.attempts OR NEW.reason IS NOT OLD.reason BEGIN
      INSERT INTO email_delivery_events(delivery_id,recorded_at_utc,state,attempts,reason,response_code,provider_message_id)
      VALUES (NEW.id,NEW.updated_at_utc,NEW.state,NEW.attempts,NEW.reason,NEW.response_code,NEW.provider_message_id); END;
    CREATE TRIGGER IF NOT EXISTS email_publication_outbox AFTER INSERT ON reports
      WHEN json_extract(NEW.payload,'$.version.revisionReason') IN ('initial','completion') BEGIN
      INSERT OR IGNORE INTO delivery_outbox(id,report_version_id,created_at_utc)
      VALUES ('report-published:'||NEW.id,NEW.id,json_extract(NEW.payload,'$.version.publishedAtUtc')); END;
    CREATE TRIGGER IF NOT EXISTS email_outbox_notification AFTER INSERT ON delivery_outbox BEGIN
      INSERT OR IGNORE INTO email_notifications(id,version_id,kind,created_at_utc)
      VALUES ('daily-brief:'||NEW.report_version_id,NEW.report_version_id,'daily-brief',NEW.created_at_utc); END;
    INSERT OR IGNORE INTO email_notifications(id,version_id,kind,created_at_utc)
      SELECT 'daily-brief:'||report_version_id,report_version_id,'daily-brief',created_at_utc FROM delivery_outbox;
    COMMIT;`);
  let processing = false, closed = false;
  const transport = options?.transport;
  function release(row: Row, state: string, reason: string, nextAt = clock()) {
    database.prepare("UPDATE email_deliveries SET state=?,reason=?,next_attempt_at_utc=?,updated_at_utc=?,lease_until_utc=NULL,attempt_id=NULL WHERE id=? AND attempt_id=?")
      .run(state, reason, nextAt, clock(), row.id, row.attempt_id);
  }
  return {
    enabled: configuration.enabled,
    enqueue(input: { versionId: string; kind: NotificationKind }) { return enqueueEmailNotification(database, { ...input, atUtc: clock() }); },
    reconcile(input: unknown) { return reconcileEmailDelivery(database, input, clock); },
    status(versionId: string) {
      const deliveries = database.prepare(`SELECT id AS deliveryId,kind,transport,transport_provenance AS transportProvenance,state,attempts,
        published_at_utc AS publishedAtUtc,message_id AS messageId,provider_message_id AS providerMessageId,
        attempt_started_at_utc AS attemptStartedAtUtc,accepted_at_utc AS acceptedAtUtc,delivered_at_utc AS deliveredAtUtc,
        bounced_at_utc AS bouncedAtUtc,rejected_at_utc AS rejectedAtUtc,unknown_at_utc AS unknownAtUtc,
        updated_at_utc AS updatedAtUtc,reason,response_code AS responseCode,mime_bytes AS mimeBytes,attached_pdf AS attachedPdf,
        pdf_reason AS pdfReason,download_format AS downloadFormat,link_expires_at_utc AS linkExpiresAtUtc,
        CASE WHEN state='pending' THEN next_attempt_at_utc ELSE NULL END AS nextAttemptAtUtc
        FROM email_deliveries WHERE version_id=? ORDER BY created_at_utc,id`).all(versionId).map((row) => ({ ...row, recipient: "configured-owner",
          events: database.prepare("SELECT sequence,recorded_at_utc AS recordedAtUtc,state,attempts,reason,response_code AS responseCode,provider_message_id AS providerMessageId FROM email_delivery_events WHERE delivery_id=? ORDER BY sequence").all(String(row.deliveryId)),
          reconciliations: database.prepare("SELECT recorded_at_utc AS recordedAtUtc,payload FROM email_reconciliations WHERE delivery_id=? ORDER BY recorded_at_utc,event_id").all(String(row.deliveryId))
            .map((entry) => ({ recordedAtUtc: entry.recordedAtUtc, ...JSON.parse(String(entry.payload)) as Record<string, unknown> })),
        }));
      return { schemaVersion: 1, enabled: configuration.enabled, versionId,
        irretrievableScope: database.prepare("SELECT scope,recorded_at_utc AS recordedAtUtc FROM rights_email_scope WHERE version_id=?").all(versionId),
        notifications: database.prepare("SELECT kind,created_at_utc AS createdAtUtc FROM email_notifications WHERE version_id=? ORDER BY kind").all(versionId), deliveries };
    },
    async processNext(readers: Readers, signal?: AbortSignal) {
      if (!configuration.enabled || !transport || closed || processing || signal?.aborted) return;
      processing = true;
      let claim: Row | undefined, sending = false;
      try {
        const now = clock();
        database.exec("BEGIN IMMEDIATE");
        try {
          // An expired send lease is an ambiguous external side effect, never a retry.
          database.prepare(`UPDATE email_deliveries SET state=CASE WHEN state='sending' THEN 'unknown' ELSE 'pending' END,
            unknown_at_utc=CASE WHEN state='sending' THEN ? ELSE unknown_at_utc END,
            reason=CASE WHEN state='sending' THEN 'send-interrupted-unconfirmed' ELSE 'preparation-interrupted' END,
            lease_until_utc=NULL,attempt_id=NULL,updated_at_utc=? WHERE state IN ('preparing','sending') AND lease_until_utc<=?`).run(now, now, now);
          const visibility = mode === "production" ? " AND json_extract(r.payload,'$.version.provenance')!='test-fixture'" : "";
          const pending = database.prepare(`SELECT n.*,json_extract(r.payload,'$.version.publishedAtUtc') AS published_at_utc
            FROM email_notifications n JOIN reports r ON r.id=n.version_id
            WHERE substr(n.version_id,1,10)>=? AND NOT EXISTS (SELECT 1 FROM rights_versions WHERE version_id=n.version_id)
            AND NOT EXISTS (SELECT 1 FROM email_deliveries d WHERE d.notification_id=n.id)${visibility}
            ORDER BY n.created_at_utc,n.id LIMIT 25`).all(configuration.startBusinessDate);
          for (const row of pending) {
            const id = randomUUID();
            database.prepare(`INSERT INTO email_deliveries(id,notification_id,business_date,version_id,kind,sender,recipient,published_at_utc,
              message_id,transport,transport_provenance,next_attempt_at_utc,wait_until_utc,created_at_utc,updated_at_utc) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
              .run(id, String(row.id), String(row.version_id).slice(0, 10), String(row.version_id), String(row.kind), configuration.address,
                configuration.address, String(row.published_at_utc), `<${id}@observer.invalid>`, transport.name, transport.provenance,
                now, new Date(Date.parse(now) + emailBudgets.pdfWaitMs).toISOString(), now, now);
          }
          database.exec("UPDATE delivery_outbox SET state='queued' WHERE state='pending' AND EXISTS (SELECT 1 FROM email_deliveries d WHERE d.version_id=delivery_outbox.report_version_id AND d.kind='daily-brief')");
          const row = database.prepare(`SELECT * FROM email_deliveries WHERE state='pending' AND attempts<? AND next_attempt_at_utc<=?
            AND recipient=? AND sender=? AND transport=? AND transport_provenance=? ORDER BY next_attempt_at_utc,version_id,id LIMIT 1`)
            .get(emailBudgets.maxAttempts, now, configuration.address, configuration.address, transport.name, transport.provenance);
          if (row) {
            claim = { ...row, attempt_id: randomUUID() } as unknown as Row;
            database.prepare("UPDATE email_deliveries SET state='preparing',attempt_id=?,lease_until_utc=?,updated_at_utc=? WHERE id=?")
              .run(claim.attempt_id, new Date(Date.parse(now) + emailBudgets.leaseMs).toISOString(), now, claim.id);
          }
          database.exec("COMMIT");
        } catch (error) { database.exec("ROLLBACK"); throw error; }
        if (!claim) return;
        const report = readers.report(claim.version_id);
        const rendition = database.prepare("SELECT state FROM pdf_renditions WHERE version_id=?").get(claim.version_id);
        if (rendition && ["pending", "processing"].includes(String(rendition.state)) && clock() < claim.wait_until_utc) {
          release(claim, "pending", "waiting-for-pdf", new Date(Math.min(Date.parse(claim.wait_until_utc), Date.parse(clock()) + 1000)).toISOString()); return;
        }
        let pdf: Buffer | null = null, pdfReason = `pdf-${rendition?.state ?? "unavailable"}`;
        if (rendition?.state === "ready") {
          // Includes the existing PDF provenance and same-version content check.
          pdf = readers.pdf(report); pdfReason = "pdf-ready";
        }
        const format = pdf ? "pdf" : "markdown", grant = readers.grant(claim.version_id, format);
        const message = await prepareEmail({ report, kind: claim.kind, address: claim.recipient, messageId: claim.message_id, atUtc: clock(),
          download: { url: configuration.publicBaseUrl + grant.path, format, expiresAtUtc: grant.expiresAtUtc },
          archiveUrl: `${configuration.publicBaseUrl}/v1/archive/${report.version.businessDate}/versions/${report.version.version}`, pdf, pdfReason });
        // Current withdrawal / Source Policy is rechecked after asynchronous MIME work.
        readers.report(claim.version_id);
        if (pdf) readers.pdf(report);
        if (closed || signal?.aborted) { release(claim, "pending", "preparation-interrupted"); return; }
        const submittedAt = clock();
        const changed = database.prepare(`UPDATE email_deliveries SET state='sending',attempts=attempts+1,attempt_started_at_utc=?,updated_at_utc=?,
          lease_until_utc=?,mime_bytes=?,attached_pdf=?,pdf_reason=?,download_format=?,link_expires_at_utc=?,reason=NULL
          WHERE id=? AND state='preparing' AND attempt_id=?`).run(submittedAt, submittedAt,
            new Date(Date.parse(submittedAt) + emailBudgets.leaseMs).toISOString(), message.raw.length, message.attachedPdf ? 1 : 0,
            message.pdfReason, format, grant.expiresAtUtc, claim.id, claim.attempt_id);
        if (!changed.changes) return;
        sending = true;
        const outcome = await transport.send({ raw: message.raw, from: claim.sender, to: claim.recipient, messageId: claim.message_id }, signal);
        if (closed) return; // Persisted sending becomes unknown on recovery.
        const finished = clock(), exhausted = claim.attempts + 1 >= emailBudgets.maxAttempts;
        const state = outcome.state === "retryable" ? exhausted ? "failed" : "pending" : outcome.state;
        const providerId = outcome.providerMessageId && reference.safeParse(outcome.providerMessageId).success ? outcome.providerMessageId : null;
        database.prepare(`UPDATE email_deliveries SET state=?,reason=?,response_code=?,provider_message_id=COALESCE(provider_message_id,?),
          accepted_at_utc=CASE WHEN ?='accepted' THEN ? ELSE accepted_at_utc END,rejected_at_utc=CASE WHEN ?='rejected' THEN ? ELSE rejected_at_utc END,
          unknown_at_utc=CASE WHEN ?='unknown' THEN ? ELSE unknown_at_utc END,updated_at_utc=?,next_attempt_at_utc=?,lease_until_utc=NULL,attempt_id=NULL
          WHERE id=? AND state='sending' AND attempt_id=?`).run(state, outcome.reason, outcome.responseCode ?? null, providerId,
            state, finished, state, finished, state, finished, finished, new Date(Date.parse(finished) + emailBudgets.retryDelayMs).toISOString(), claim.id, claim.attempt_id);
      } catch (error) {
        if (claim && !closed) {
          if (sending) database.prepare("UPDATE email_deliveries SET state='unknown',reason='transport-failed',unknown_at_utc=?,updated_at_utc=?,lease_until_utc=NULL,attempt_id=NULL WHERE id=? AND attempt_id=?")
            .run(clock(), clock(), claim.id, claim.attempt_id);
          else release(claim, "blocked", error instanceof Error && /^email-[a-z-]+$/.test(error.message) ? error.message : "report-or-pdf-unreadable");
        } else if (!closed) throw error;
      } finally { processing = false; }
    },
    close() { closed = true; transport?.close(); },
  };
}
