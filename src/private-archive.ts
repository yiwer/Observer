import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { editionNames, type PublishedReport, type ReportVersion } from "./contracts.ts";
import { PrivateApiError, type PrivateAccess } from "./private-access.ts";

type Edition = keyof typeof editionNames;
type VersionSnapshot = { version: ReportVersion; availableEditions: Edition[]; completedEditions: Edition[];
  linkEditions: Edition[]; coverageGaps: Array<{ edition: Edition; reason: string }> };
type ArchiveEvent = { sequence: string; eventId: string; kind: string; businessDate: string;
  versionId: string | null; occurredAtUtc: string; snapshot: Record<string, unknown> };
const date = z.iso.date(), versionIdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}-v[1-9]\d*$/);
export function parseEdition(value: string | null): Edition | null {
  if (value === null) return null;
  if (!Object.hasOwn(editionNames, value)) throw new PrivateApiError("invalid-edition");
  return value as Edition;
}
export function checkedDate(value: string) {
  if (!date.safeParse(value).success) throw new PrivateApiError("invalid-business-date");
  return value;
}
export function editionMarkdown(report: PublishedReport, edition: Edition): string {
  const markdown = report.canonicalMarkdown, marker = `<a id="edition-${edition}"></a>`;
  const anchor = markdown.indexOf(marker), heading = `## ${editionNames[edition]}\n`;
  const start = anchor >= 0 ? anchor : markdown.indexOf(heading);
  if (start < 0) throw new PrivateApiError("edition-not-available", 404);
  const next = anchor >= 0 ? markdown.indexOf('<a id="edition-', start + marker.length) : markdown.indexOf("\n## ", start + heading.length);
  const end = next >= 0 ? next : markdown.length;
  return markdown.slice(start, end).trim() + "\n";
}

/** SQLite triggers keep changes in exactly the transaction that changed the source.
 * Feed snapshots contain public metadata only, never evidence, prompts or secrets. */
export function privateArchive(database: DatabaseSync, access: PrivateAccess, mode: "production" | "test-fixture") {
  const reportSnapshot = (row: string) => `json_object('version',json_extract(${row}.payload,'$.version'),
    'availableEditions',json(COALESCE(json_extract(${row}.payload,'$.record.revision.availableEditions'),json_extract(${row}.payload,'$.record.recovery.availableEditions'),
      (SELECT json_group_array(DISTINCT json_extract(value,'$.edition')) FROM json_each(${row}.payload,'$.record.stories')))),
    'completedEditions',json(COALESCE(json_extract(${row}.payload,'$.record.recovery.completedEditions'),'[]')),
    'linkEditions',json((SELECT json_group_array(DISTINCT json_extract(value,'$.edition')) FROM json_each(${row}.payload,'$.record.recovery.links'))),
    'coverageGaps',json(COALESCE(json_extract(${row}.payload,'$.record.recovery.coverageGaps'),json_extract(${row}.payload,'$.record.coverageGaps'),'[]')))`;
  const stateSnapshot = (row: string) => `json_object('businessDate',${row}.business_date,'cutoffUtc',${row}.cutoff_utc,'deadlineUtc',${row}.deadline_utc,
    'frozenAtUtc',${row}.frozen_at_utc,'state',${row}.state,'attempts',${row}.attempts,'completedAtUtc',${row}.completed_at_utc,
    'readableAtUtc',${row}.readable_at_utc,'latestVersionId',${row}.latest_version_id,'latestReadableAtUtc',${row}.latest_readable_at_utc,
    'content',${row}.content_state,'timing',CASE WHEN ${row}.readable_at_utc IS NULL THEN CASE WHEN ${row}.latest_version_id IS NULL THEN NULL ELSE 'pending' END
      WHEN ${row}.readable_at_utc<=${row}.deadline_utc THEN 'on-time' ELSE 'delayed' END,
    'onTime',json(CASE WHEN ${row}.readable_at_utc IS NULL THEN 'null' WHEN ${row}.readable_at_utc<=${row}.deadline_utc THEN 'true' ELSE 'false' END),
    'recovery',${row}.recovery_state,'recoveryDeadlineUtc',strftime('%Y-%m-%dT04:00:00.000Z',${row}.business_date),
    'missedAtUtc',${row}.missed_at_utc,'failure',${row}.failure)`;
  const time = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
  database.exec("BEGIN IMMEDIATE");
  try {
    database.exec(`CREATE TABLE IF NOT EXISTS archive_events (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE, kind TEXT NOT NULL,
      business_date TEXT NOT NULL, version_id TEXT, occurred_at_utc TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS archive_events_date_sequence ON archive_events(business_date,sequence);
      CREATE TABLE IF NOT EXISTS archive_revision_changes (event_id TEXT PRIMARY KEY, kind TEXT NOT NULL,
        version_id TEXT NOT NULL REFERENCES reports(id), replacement_version_id TEXT REFERENCES reports(id), reason_reference TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS archive_migrations (id INTEGER PRIMARY KEY);`);
    if (!database.prepare("SELECT 1 FROM archive_migrations WHERE id=1").get()) {
      database.exec(`INSERT INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
        SELECT 'report:'||r.id,'report-published',json_extract(r.payload,'$.version.businessDate'),r.id,${time},${reportSnapshot("r")}
        FROM reports r ORDER BY json_extract(r.payload,'$.version.businessDate'),json_extract(r.payload,'$.version.version');
        INSERT INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
        SELECT 'baseline:'||s.business_date,'brief-state',s.business_date,s.latest_version_id,${time},${stateSnapshot("s")}
        FROM scheduled_tasks s ORDER BY s.business_date;
        INSERT INTO archive_migrations VALUES (1);`);
    }
    if (!database.prepare("SELECT 1 FROM archive_migrations WHERE id=2").get()) {
      database.exec("DROP TRIGGER IF EXISTS archive_report_insert; INSERT INTO archive_migrations VALUES (2)");
    }
    database.exec(`CREATE TRIGGER IF NOT EXISTS archive_report_insert AFTER INSERT ON reports BEGIN
      INSERT INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
      VALUES ('report:'||NEW.id,'report-published',json_extract(NEW.payload,'$.version.businessDate'),NEW.id,${time},${reportSnapshot("NEW")}); END;
      CREATE TRIGGER IF NOT EXISTS archive_schedule_insert AFTER INSERT ON scheduled_tasks BEGIN
      INSERT INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
      VALUES ('state:'||lower(hex(randomblob(16))),'brief-state',NEW.business_date,NEW.latest_version_id,${time},${stateSnapshot("NEW")}); END;
      CREATE TRIGGER IF NOT EXISTS archive_schedule_update AFTER UPDATE ON scheduled_tasks
      WHEN ${stateSnapshot("OLD")} IS NOT ${stateSnapshot("NEW")} BEGIN
      INSERT INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
      VALUES ('state:'||lower(hex(randomblob(16))),'brief-state',NEW.business_date,NEW.latest_version_id,${time},${stateSnapshot("NEW")}); END;
      CREATE TRIGGER IF NOT EXISTS archive_revision_insert AFTER INSERT ON archive_revision_changes BEGIN
      INSERT INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
      VALUES ('revision:'||NEW.event_id,NEW.kind,substr(NEW.version_id,1,10),NEW.version_id,${time},
        json_object('replacementVersionId',NEW.replacement_version_id,'reasonReference',NEW.reason_reference)); END;
      CREATE TRIGGER IF NOT EXISTS immutable_archive_event_update BEFORE UPDATE ON archive_events BEGIN SELECT RAISE(ABORT,'immutable archive event'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_archive_event_delete BEFORE DELETE ON archive_events BEGIN SELECT RAISE(ABORT,'immutable archive event'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_archive_revision_update BEFORE UPDATE ON archive_revision_changes BEGIN SELECT RAISE(ABORT,'immutable archive revision'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_archive_revision_delete BEFORE DELETE ON archive_revision_changes BEGIN SELECT RAISE(ABORT,'immutable archive revision'); END;`);
    database.exec("COMMIT");
  } catch (error) { database.exec("ROLLBACK"); throw error; }
  const highWater = () => Number(database.prepare("SELECT COALESCE(MAX(sequence),0) AS value FROM archive_events").get()!.value);
  // Production readers preserve the existing prohibition on fixture reports.
  const visible = mode === "production" ? " AND (kind NOT IN ('report-published','rendition-state') OR COALESCE(json_extract(payload,'$.version.provenance'),json_extract(payload,'$.provenance'))!='test-fixture')" : "";
  const asEvent = (row: Record<string, unknown>): ArchiveEvent => ({ sequence: String(row.sequence), eventId: String(row.event_id), kind: String(row.kind),
    businessDate: String(row.business_date), versionId: row.version_id as string | null, occurredAtUtc: String(row.occurred_at_utc), snapshot: JSON.parse(String(row.payload)) as Record<string, unknown> });
  function view(businessDate: string, until = highWater()) {
    checkedDate(businessDate);
    const events = database.prepare(`SELECT * FROM archive_events WHERE business_date=? AND sequence<=?${visible} ORDER BY sequence`).all(businessDate, until).map(asEvent);
    if (!events.length) throw new PrivateApiError("not-found", 404);
    const publications = events.filter((event) => event.kind === "report-published").map((event) => event.snapshot as unknown as VersionSnapshot)
      .sort((a, b) => a.version.version - b.version.version);
    const latestVersionId = publications.at(-1)?.version.id ?? null;
    const versions = publications.map((snapshot) => {
      const id = snapshot.version.id;
      const revisions = events.filter((event) => event.versionId === id && ["withdrawal", "correction"].includes(event.kind));
      const withdrawn = snapshot.version.revisionReason === "withdrawal" && snapshot.version.schemaVersion !== 12 || revisions.some((event) => event.kind === "withdrawal");
      const supersededByVersionIds = [...new Set([...publications.filter((entry) => entry.version.previousVersionId === id).map((entry) => entry.version.id),
        ...revisions.flatMap((event) => typeof event.snapshot.replacementVersionId === "string" ? [event.snapshot.replacementVersionId] : [])])];
      const pdf = events.findLast((event) => event.kind === "rendition-state" && event.versionId === id)?.snapshot;
      const pdfAvailable = !withdrawn && pdf?.state === "ready";
      return { ...snapshot, status: withdrawn ? "withdrawn" : supersededByVersionIds.length ? "superseded" : "current", retracted: withdrawn,
        contentSemantics: snapshot.version.schemaVersion === 12 && snapshot.version.revisionReason === "withdrawal" ? "safe-withdrawal-notice" : "report", supersededByVersionIds,
        changes: revisions.map(({ eventId, kind, snapshot: change }) => ({ eventId, kind, ...change })),
        renditions: { markdown: { available: !withdrawn, path: `/v1/reports/${id}/markdown` },
          pdf: { ...pdf, scope: "full-report", available: pdfAvailable,
            ...(pdfAvailable ? { path: `/v1/reports/${id}/pdf` } : { reason: withdrawn ? "report-withdrawn" : pdf?.state ?? "not-generated" }) } } };
    });
    return { schemaVersion: 1, businessDate, latestVersionId, latest: versions.at(-1) ?? null, versions,
      delivery: events.findLast((event) => event.kind === "brief-state")?.snapshot ?? null };
  }
  function paging(input: { cursor?: string; limit?: number }, purpose: "sync" | "history") {
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new PrivateApiError("invalid-limit");
    const cursor = input.cursor ? access.unseal(input.cursor) : null;
    if (cursor && (cursor.v !== 1 || cursor.purpose !== purpose)) throw new PrivateApiError("invalid-cursor");
    const max = highWater(), until = cursor?.until ?? max;
    if (typeof until !== "number" || !Number.isSafeInteger(until) || until < 0 || until > max) throw new PrivateApiError("cursor-reset-required", 409);
    return { limit, cursor, until };
  }
  const checkpoint = (after: number) => access.seal({ v: 1, purpose: "sync", after, until: null });
  return {
    view,
    assertReadable(versionId: string) {
      const item = view(versionId.slice(0, 10)).versions.find((entry) => entry.version.id === versionId);
      if (!item) throw new PrivateApiError("not-found", 404);
      if (item.status === "withdrawn") throw new PrivateApiError("report-withdrawn", 410);
    },
    history(input: { cursor?: string; limit?: number }) {
      const { cursor, until, limit } = paging(input, "history");
      const before = cursor?.before ?? "9999-12-31";
      if (typeof before !== "string") throw new PrivateApiError("invalid-cursor");
      const rows = database.prepare(`SELECT business_date FROM archive_events WHERE sequence<=? AND business_date<?${visible} GROUP BY business_date ORDER BY business_date DESC LIMIT ?`).all(until, before, limit + 1);
      const page = rows.slice(0, limit), hasMore = rows.length > limit;
      return { schemaVersion: 1, snapshotSequence: String(until), items: page.map((row) => view(String(row.business_date), until)), hasMore,
        nextCursor: hasMore ? access.seal({ v: 1, purpose: "history", until, before: page.at(-1)!.business_date }) : null, syncCursor: checkpoint(until) };
    },
    sync(input: { cursor?: string; limit?: number }) {
      const { cursor, until, limit } = paging(input, "sync"), after = cursor?.after ?? 0;
      if (typeof after !== "number" || !Number.isSafeInteger(after) || after < 0 || after > until) throw new PrivateApiError("invalid-cursor");
      const rows = database.prepare(`SELECT * FROM archive_events WHERE sequence>? AND sequence<=?${visible} ORDER BY sequence LIMIT ?`).all(after, until, limit + 1);
      const events = rows.slice(0, limit).map(asEvent), hasMore = rows.length > limit;
      return { schemaVersion: 1, snapshotSequence: String(until), events, hasMore,
        nextCursor: hasMore ? access.seal({ v: 1, purpose: "sync", until, after: Number(events.at(-1)!.sequence) }) : checkpoint(until) };
    },
    // Trusted in-process #20 seam only. The correction publisher must insert its
    // validated Report and call this in that same publication transaction.
    recordRevisionChange(input: unknown) {
      const parsed = z.strictObject({ eventId: z.string().regex(/^[A-Za-z0-9:_-]{1,200}$/), kind: z.enum(["withdrawal", "correction"]),
        versionId: versionIdSchema, replacementVersionId: versionIdSchema.nullable(), reasonReference: z.string().regex(/^[A-Za-z0-9:_.\/-]{1,200}$/) }).safeParse(input);
      if (!parsed.success) throw new PrivateApiError("invalid-revision-change");
      const change = parsed.data;
      const target = database.prepare("SELECT 1 FROM reports WHERE id=?").get(change.versionId);
      if (!target) throw new PrivateApiError("not-found", 404);
      if (change.kind === "correction" && !change.replacementVersionId) throw new PrivateApiError("correction-needs-published-version");
      if (change.replacementVersionId) {
        const replacement = database.prepare("SELECT payload FROM reports WHERE id=?").get(change.replacementVersionId);
        const report = replacement ? JSON.parse(String(replacement.payload)) as PublishedReport : null;
        if (!report || report.version.previousVersionId !== change.versionId || report.version.revisionReason !== change.kind || report.version.businessDate !== change.versionId.slice(0, 10))
          throw new PrivateApiError("invalid-replacement-version");
      }
      const prior = database.prepare("SELECT * FROM archive_revision_changes WHERE event_id=?").get(change.eventId);
      if (prior) {
        if (prior.kind !== change.kind || prior.version_id !== change.versionId || prior.replacement_version_id !== change.replacementVersionId || prior.reason_reference !== change.reasonReference)
          throw new PrivateApiError("revision-event-conflict", 409);
        return { schemaVersion: 1, eventId: change.eventId, recorded: true };
      }
      database.prepare("INSERT INTO archive_revision_changes VALUES (?,?,?,?,?)").run(change.eventId, change.kind, change.versionId, change.replacementVersionId, change.reasonReference);
      return { schemaVersion: 1, eventId: change.eventId, recorded: true };
    },
  };
}
