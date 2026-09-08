import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { OwnerPublicationSchema, RoutedRequestSchema } from "./contracts.ts";
import { shanghaiDate } from "./scheduled-publication.ts";

export const OwnerRequestIdSchema = OwnerPublicationSchema.shape.requestId;
export const OwnerPublishRequestSchema = z.strictObject({ requestId: OwnerRequestIdSchema, request: RoutedRequestSchema });
export type OwnerPublication = z.infer<typeof OwnerPublicationSchema>;
const statusSchema = z.strictObject({ requestId: OwnerRequestIdSchema, businessDate: z.iso.date(),
  state: z.enum(["running", "published", "failed"]), publication: OwnerPublicationSchema,
  versionId: z.string().nullable(), failure: z.string().nullable() });

/** This is an explicit rolling window, unrelated to the 07:30 scheduled freeze. */
export function ownerPublicationWindow(frozenAtUtc: string) {
  const businessDate = shanghaiDate(frozenAtUtc);
  return { businessDate, cutoffUtc: frozenAtUtc, windowStartUtc: new Date(Date.parse(frozenAtUtc) - 86400000).toISOString() };
}

export function ownerPublicationMetadata(requestId: string, frozenAtUtc: string, now: string): OwnerPublication {
  const elapsed = Date.parse(now) - Date.parse(frozenAtUtc);
  if (elapsed < 0 || elapsed > 60000 || shanghaiDate(frozenAtUtc) !== shanghaiDate(now)) throw new Error("owner-freeze-not-current");
  const dayEnd = Date.parse(`${shanghaiDate(now)}T23:59:59.999+08:00`);
  const deadlineUtc = new Date(Math.min(Date.parse(now) + 2 * 3600000, dayEnd)).toISOString();
  if (Date.parse(deadlineUtc) - Date.parse(now) < 60000) throw new Error("owner-publication-day-ending");
  return OwnerPublicationSchema.parse({ contract: "observer-owner-publication-v1", requestId, requestedAtUtc: now,
    frozenAtUtc, deadlineUtc, timing: "not-scheduled", window: "rolling-24-hours" });
}

/** Only non-source audit metadata is persisted here. A crash never replays a paid run. */
export function ownerPublicationStore(database: DatabaseSync, clock: () => string) {
  database.exec(`CREATE TABLE IF NOT EXISTS owner_publications (
    request_id TEXT PRIMARY KEY, business_date TEXT NOT NULL, input_sha256 TEXT NOT NULL,
    publication TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('running','published','failed')),
    version_id TEXT, failure TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS owner_publication_active_day ON owner_publications(business_date)
      WHERE state IN ('running','published');`);
  function expire() {
    database.prepare("UPDATE owner_publications SET state='failed',failure='owner-publication-deadline-exceeded' WHERE state='running' AND json_extract(publication,'$.deadlineUtc')<=?").run(clock());
  }
  function status(requestId: string) {
    expire();
    const row = database.prepare("SELECT * FROM owner_publications WHERE request_id=?").get(OwnerRequestIdSchema.parse(requestId));
    return row ? statusSchema.parse({ requestId: row.request_id, businessDate: row.business_date, state: row.state,
      publication: JSON.parse(String(row.publication)), versionId: row.version_id, failure: row.failure }) : null;
  }
  return {
    status,
    claim(businessDate: string, inputSha256: string, publication: OwnerPublication) {
      database.exec("BEGIN IMMEDIATE");
      try {
        if (status(publication.requestId)) throw new Error("owner-request-already-recorded");
        if (database.prepare("SELECT 1 FROM reports WHERE json_extract(payload,'$.version.businessDate')=?").get(businessDate)) throw new Error("owner-day-already-published");
        if (database.prepare("SELECT 1 FROM owner_publications WHERE business_date=? AND state IN ('running','published')").get(businessDate)) throw new Error("owner-day-already-requested");
        database.prepare("INSERT INTO owner_publications VALUES(?,?,?,?,'running',NULL,NULL)")
          .run(publication.requestId, businessDate, inputSha256, JSON.stringify(publication));
        database.exec("COMMIT");
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    },
    matches(requestId: string, inputSha256: string) {
      return database.prepare("SELECT input_sha256 FROM owner_publications WHERE request_id=?").get(requestId)?.input_sha256 === inputSha256;
    },
    // The caller performs this transition in the same transaction as the Report INSERT.
    published(requestId: string, versionId: string) {
      if (!database.prepare("UPDATE owner_publications SET state='published',version_id=? WHERE request_id=? AND state='running'").run(versionId, requestId).changes) throw new Error("owner-request-ownership-lost");
    },
    failed(requestId: string, reason: string) {
      database.prepare("UPDATE owner_publications SET state='failed',failure=? WHERE request_id=? AND state='running'").run(reason, requestId);
    },
  };
}
