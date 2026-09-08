import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { PublishedReport } from "./contracts.ts";
import { QqTransportConfigurationSchema, emailBudgets, type EmailTransport } from "./email-contracts.ts";
import { prepareOwnerRequestedEmail } from "./email-message.ts";
import { OwnerRequestIdSchema } from "./owner-publication.ts";

const inputSchema = z.strictObject({ requestId: OwnerRequestIdSchema,
  versionId: z.string().regex(/^\d{4}-\d{2}-\d{2}-v[1-9]\d*$/), address: QqTransportConfigurationSchema.shape.address });
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Dedicated once-only dispatch ledger. Contains no body, attachment, address or secret. */
export function ownerEmailDeliveries(database: DatabaseSync, clock: () => string) {
  database.exec(`CREATE TABLE IF NOT EXISTS owner_email_deliveries (
    request_id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES reports(id), recipient_sha256 TEXT NOT NULL,
    message_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, created_at_utc TEXT NOT NULL, updated_at_utc TEXT NOT NULL,
    reason TEXT, response_code INTEGER, UNIQUE(version_id,recipient_sha256));`);
  function status(requestId: string) {
    OwnerRequestIdSchema.parse(requestId);
    database.prepare("UPDATE owner_email_deliveries SET state='unknown',reason='smtp-response-unconfirmed',updated_at_utc=? WHERE request_id=? AND state='sending' AND updated_at_utc<=?")
      .run(clock(), requestId, new Date(Date.parse(clock()) - emailBudgets.leaseMs).toISOString());
    return database.prepare(`SELECT request_id AS requestId,version_id AS versionId,message_id AS messageId,state,
      created_at_utc AS createdAtUtc,updated_at_utc AS updatedAtUtc,reason,response_code AS responseCode
      FROM owner_email_deliveries WHERE request_id=?`).get(requestId) ?? null;
  }
  function existingRequest(requestId: string, versionId: string, recipientSha256: string) {
    const existing = database.prepare("SELECT request_id,version_id,recipient_sha256 FROM owner_email_deliveries WHERE request_id=?")
      .get(requestId) ?? database.prepare("SELECT request_id,version_id,recipient_sha256 FROM owner_email_deliveries WHERE version_id=? AND recipient_sha256=?")
      .get(versionId, recipientSha256);
    if (!existing) return null;
    if (existing.version_id !== versionId || existing.recipient_sha256 !== recipientSha256) throw new Error("email-owner-request-conflict");
    return status(String(existing.request_id));
  }
  return {
    status,
    async send(input: unknown, transport: EmailTransport, readers: {
      report(versionId: string): PublishedReport; pdf(report: PublishedReport): Buffer;
    }, signal?: AbortSignal) {
      const request = inputSchema.parse(input);
      if (transport.name !== "qq-smtp" || transport.provenance !== "live") throw new Error("email-live-transport-required");
      const recipientSha256 = sha256(request.address);
      const existing = existingRequest(request.requestId, request.versionId, recipientSha256);
      if (existing) return existing; // Every state is final for dispatch: never retry.
      const report = readers.report(request.versionId);
      if (report.version.provenance !== "owner-requested") throw new Error("email-owner-publication-required");
      const messageId = `<${randomUUID()}@observer.invalid>`, atUtc = clock();
      const claimed = database.prepare("INSERT OR IGNORE INTO owner_email_deliveries VALUES(?,?,?,?,'pending',?,?,NULL,NULL)")
        .run(request.requestId, request.versionId, recipientSha256, messageId, atUtc, atUtc);
      if (!claimed.changes) return existingRequest(request.requestId, request.versionId, recipientSha256);
      let sending = false;
      try {
        const pdf = readers.pdf(report);
        const prepared = await prepareOwnerRequestedEmail({ report, pdf, address: request.address, messageId, atUtc });
        // Re-read policy/withdrawal state and the same-version PDF immediately before SMTP.
        const current = readers.report(request.versionId);
        if (current.canonicalMarkdown !== report.canonicalMarkdown || !readers.pdf(current).equals(pdf)) throw new Error("email-source-changed");
        if (signal?.aborted) throw new Error("email-preparation-interrupted");
        const changed = database.prepare("UPDATE owner_email_deliveries SET state='sending',updated_at_utc=? WHERE request_id=? AND state='pending'").run(clock(), request.requestId);
        if (!changed.changes) return status(request.requestId);
        sending = true;
        const outcome = await transport.send({ raw: prepared.raw, from: request.address, to: request.address, messageId }, signal);
        const state = outcome.state === "retryable" ? "failed" : outcome.state;
        database.prepare("UPDATE owner_email_deliveries SET state=?,reason=?,response_code=?,updated_at_utc=? WHERE request_id=? AND state='sending'")
          .run(state, outcome.reason, outcome.responseCode ?? null, clock(), request.requestId);
      } catch (error) {
        database.prepare("UPDATE owner_email_deliveries SET state=?,reason=?,updated_at_utc=? WHERE request_id=? AND state IN ('pending','sending')")
          .run(sending ? "unknown" : "failed", sending ? "transport-failed" : error instanceof Error && /^email-[a-z-]+$/.test(error.message) ? error.message : "report-or-pdf-unreadable", clock(), request.requestId);
      }
      return status(request.requestId);
    },
  };
}
