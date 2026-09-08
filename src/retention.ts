import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { SourcePolicySchema, policyDigest, type SourcePolicy } from "./collection.ts";
import { PrivateApiError } from "./private-access.ts";

const id = z.string().min(1).max(200), utc = z.iso.datetime({ precision: 3, offset: false });
export const RightsRemovalSchema = z.strictObject({ sourceId: id, reason: z.enum(["source-request", "policy-tightened", "source-removed"]),
  retainVersionAudit: z.boolean().default(false) });
export type RightsRemoval = z.infer<typeof RightsRemovalSchema>;
export const DeletionContractSchema = z.strictObject({ schemaVersion: z.literal(1), kind: z.literal("observer-rights-suppression"),
  sources: z.array(RightsRemovalSchema.extend({ blockedAtUtc: utc })).max(10000),
  versions: z.array(z.strictObject({ versionId: z.string().regex(/^\d{4}-\d{2}-\d{2}-v[1-9]\d*$/), removedAtUtc: utc, retainVersionAudit: z.boolean() })).max(100000) });
export type DeletionContract = z.infer<typeof DeletionContractSchema>;

/** Inspect structured provenance, never search the Markdown for coincidental names. */
export function contentDependencies(input: unknown) {
  const sources = new Set<string>(), versions = new Set<string>();
  function visit(value: unknown, key = "") {
    if (typeof value === "string") {
      if (key === "sourceId") sources.add(value);
      if (/VersionId$/.test(key) || key === "versionId") versions.add(value);
    } else if (Array.isArray(value)) value.forEach((entry) => visit(entry, key.replace(/Ids$/, "Id")));
    else if (value && typeof value === "object") for (const [name, entry] of Object.entries(value)) visit(entry, name);
  }
  visit(input); return { sources, versions };
}

export function initializeRetention(database: DatabaseSync) {
  database.exec(`PRAGMA secure_delete=ON;
    CREATE TABLE IF NOT EXISTS rights_sources(source_id TEXT PRIMARY KEY,reason TEXT NOT NULL,blocked_at_utc TEXT NOT NULL,retain_version_audit INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rights_versions(version_id TEXT PRIMARY KEY,removed_at_utc TEXT NOT NULL,retain_version_audit INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS retention_policies(source_id TEXT PRIMARY KEY,version INTEGER NOT NULL,digest TEXT NOT NULL,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS retention_jobs(id TEXT PRIMARY KEY,state TEXT NOT NULL,reason TEXT NOT NULL,updated_at_utc TEXT NOT NULL,result TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS agent_events(id TEXT PRIMARY KEY,occurred_at_utc TEXT NOT NULL,provider TEXT NOT NULL,kind TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rights_routing_runs(id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS rights_email_scope(delivery_id TEXT PRIMARY KEY,version_id TEXT NOT NULL,scope TEXT NOT NULL,recorded_at_utc TEXT NOT NULL);`);
  database.exec(`CREATE TRIGGER IF NOT EXISTS rights_report_insert BEFORE INSERT ON reports WHEN
    EXISTS(SELECT 1 FROM json_tree(NEW.payload) j JOIN rights_sources s ON j.key='sourceId' AND j.value=s.source_id) OR
    EXISTS(SELECT 1 FROM json_tree(NEW.payload) j JOIN rights_versions v ON j.key IN ('previousVersionId','sourceVersionId','versionId') AND j.value=v.version_id)
    BEGIN SELECT RAISE(ABORT,'report-rights-removed'); END;`);
  if (database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='routing_runs'").get()) {
    database.exec(`CREATE TRIGGER IF NOT EXISTS rights_routing_insert BEFORE INSERT ON routing_runs
      WHEN EXISTS(SELECT 1 FROM rights_routing_runs WHERE id=NEW.id) BEGIN SELECT RAISE(IGNORE); END;`);
    for (const action of ["INSERT", "UPDATE"]) database.exec(`CREATE TRIGGER IF NOT EXISTS retention_agent_${action.toLowerCase()} AFTER ${action} ON routing_runs BEGIN
      INSERT OR IGNORE INTO agent_events(id,occurred_at_utc,provider,kind)
      SELECT NEW.id||':'||json_extract(value,'$.sequence'),json_extract(value,'$.atUtc'),COALESCE(json_extract(value,'$.provider'),'none'),json_extract(value,'$.state') FROM json_each(NEW.payload,'$.decisions'); END;`);
  }
}

function tightened(previous: SourcePolicy, current: SourcePolicy) {
  if (current.review.status !== "approved" || !current.collection.enabled) return true;
  for (const stage of ["collection", "storage", "model", "distribution"] as const) {
    if (previous[stage].fields.some((field) => !current[stage].fields.includes(field))) return true;
  }
  function revoked(old: unknown, next: unknown): boolean {
    if (old === true) return next !== true;
    if (!old || typeof old !== "object" || Array.isArray(old)) return false;
    return Object.entries(old).some(([key, value]) => revoked(value, next && typeof next === "object" ? (next as Record<string, unknown>)[key] : undefined));
  }
  return revoked(previous, current) || current.citation.maxCharacters < previous.citation.maxCharacters ||
    current.github?.deletionScope !== previous.github?.deletionScope || current.social?.deletionScope !== previous.social?.deletionScope;
}

/** Local authority only. Markers commit before cross-database cleanup and are never
 * lifted by a config rollback or by restoring an older report database. */
export function retentionLifecycle(database: DatabaseSync, clock: () => string, readPolicies: () => SourcePolicy[],
  hooks: { purgeRaw?: (sourceIds: string[]) => void; purgeScheduled?: (policies: SourcePolicy[]) => void;
    availableEvidence?: (ids: string[]) => string[];
    compactGitHub?: (published: unknown[], sourceIds: string[]) => unknown } = {}) {
  initializeRetention(database);
  let refreshing = false, lastMaintenance = 0;
  const has = (table: string) => !!database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  const blocked = () => database.prepare("SELECT source_id FROM rights_sources").all().map((row) => String(row.source_id));
  function mark(input: RightsRemoval, atUtc = clock()) {
    database.prepare(`INSERT INTO rights_sources VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET
      retain_version_audit=MIN(rights_sources.retain_version_audit,excluded.retain_version_audit)`)
      .run(input.sourceId, input.reason, atUtc, Number(input.retainVersionAudit));
    database.prepare(`INSERT INTO retention_jobs VALUES(?,'pending',?,?, '{}') ON CONFLICT(id) DO UPDATE SET state='pending',updated_at_utc=excluded.updated_at_utc`)
      .run(`rights:${input.sourceId}`, input.reason, atUtc);
  }
  function policies() {
    const current = SourcePolicySchema.array().max(100).parse(readPolicies());
    if (refreshing) return current.filter((source) => !blocked().includes(source.sourceId));
    refreshing = true;
    try {
      database.exec("SAVEPOINT retention_policy");
      try {
        for (const source of current) {
          const old = database.prepare("SELECT * FROM retention_policies WHERE source_id=?").get(source.sourceId);
          if (old && (Number(old.version) > source.version || Number(old.version) === source.version && old.digest !== policyDigest(source))) throw new Error("policy-version-conflict");
        }
        for (const row of database.prepare("SELECT * FROM retention_policies").all()) {
          if (blocked().includes(String(row.source_id))) continue;
          const source = current.find((entry) => entry.sourceId === row.source_id);
          const previous = SourcePolicySchema.parse(JSON.parse(String(row.payload)));
          if (!source || tightened(previous, source)) mark({ sourceId: String(row.source_id), reason: source ? "policy-tightened" : "source-removed",
            retainVersionAudit: !!source?.storage.retainRecordKeys });
        }
        for (const source of current) database.prepare(`INSERT INTO retention_policies VALUES(?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET
          version=excluded.version,digest=excluded.digest,payload=excluded.payload`).run(source.sourceId, source.version, policyDigest(source),
            database.prepare("SELECT 1 FROM rights_sources WHERE source_id=? AND retain_version_audit=0").get(source.sourceId) ? "null" : JSON.stringify(source));
        database.exec("RELEASE retention_policy");
      } catch (error) { database.exec("ROLLBACK TO retention_policy; RELEASE retention_policy"); throw error; }
      return current.filter((source) => !blocked().includes(source.sourceId));
    } finally { refreshing = false; }
  }
  // Upgrade existing archives without relying on a previously installed registry.
  // An old collected grant cannot silently become a current grant at first boot.
  const initialPolicies = readPolicies();
  for (const row of database.prepare("SELECT payload FROM reports WHERE COALESCE(json_extract(payload,'$.rightsRemoved'),0)=0").all()) {
    function inspect(value: unknown) {
      if (Array.isArray(value)) { value.forEach(inspect); return; }
      if (!value || typeof value !== "object") return;
      const item = value as Record<string, unknown>, origin = item.origin as Record<string, unknown> | undefined;
      if (typeof item.sourceId === "string" && (typeof item.policyVersion === "number" || origin?.kind === "collected")) {
        const current = initialPolicies.find((source) => source.sourceId === item.sourceId);
        const version = item.policyVersion ?? origin?.policyVersion;
        if (!current || current.review.status !== "approved" || !current.collection.enabled || !current.distribution.enabled || !current.distribution.allowPermanentArchive ||
          !current.distribution.allowDerivedText || !current.citation.enabled || current.version !== version)
          mark({ sourceId: item.sourceId, reason: current ? "policy-tightened" : "source-removed", retainVersionAudit: !!current?.storage.retainRecordKeys });
      }
      Object.values(item).forEach(inspect);
    }
    inspect(JSON.parse(String(row.payload)));
  }
  const removed = (versionId: string) => !!database.prepare("SELECT 1 FROM rights_versions WHERE version_id=?").get(versionId);
  function assertReadable(versionId: string, payload?: unknown) {
    policies();
    if (removed(versionId)) throw new PrivateApiError("report-rights-removed", 410);
    if (payload && [...contentDependencies(payload).sources].some((source) => blocked().includes(source))) throw new PrivateApiError("report-rights-removed", 410);
  }
  function cleanRights() {
    const sources = blocked(), sourceSet = new Set(sources);
    const reports = database.prepare("SELECT id,payload FROM reports").all().map((row) => ({ id: String(row.id), payload: JSON.parse(String(row.payload)) as Record<string, unknown> }));
    const affected = new Set(database.prepare("SELECT version_id FROM rights_versions").all().map((row) => String(row.version_id)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const report of reports) {
        if (affected.has(report.id)) continue;
        const dependency = contentDependencies(report.payload);
        if ([...dependency.sources].some((source) => sourceSet.has(source)) || [...dependency.versions].some((version) => affected.has(version))) {
          affected.add(report.id); changed = true;
        }
      }
    }
    const forbiddenAudit = database.prepare("SELECT 1 FROM rights_sources WHERE retain_version_audit=0 LIMIT 1").get();
    // Commit even before purgeRaw: a failed secondary database cannot expose reports.
    for (const version of affected) database.prepare("INSERT INTO rights_versions VALUES(?,?,?) ON CONFLICT(version_id) DO UPDATE SET retain_version_audit=MIN(rights_versions.retain_version_audit,excluded.retain_version_audit)").run(version, clock(), Number(!forbiddenAudit));
    hooks.purgeRaw?.(sources);
    if (!sources.length && !affected.size) return;
    const touches = (value: unknown) => { const dependencies = contentDependencies(value);
      return [...dependencies.sources].some((source) => sourceSet.has(source)) || [...dependencies.versions].some((version) => affected.has(version)); };
    database.exec("BEGIN IMMEDIATE");
    try {
      // These two triggers are suspended only inside this atomic rights operation;
      // every normal write still encounters the original immutability contract.
      const guards = database.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger' AND name IN ('immutable_report_update','immutable_archive_event_update','immutable_archive_revision_update')").all();
      for (const guard of guards) database.exec(`DROP TRIGGER ${String(guard.name)}`);
      for (const report of reports.filter((entry) => affected.has(entry.id))) {
        const original = report.payload.version as Record<string, unknown>;
        const allow = database.prepare("SELECT retain_version_audit FROM rights_versions WHERE version_id=?").get(report.id)!.retain_version_audit === 1;
        const version = { id: report.id, businessDate: report.id.slice(0, 10), version: Number(report.id.split("-v")[1]),
          provenance: original.provenance, ...(allow ? { publishedAtUtc: original.publishedAtUtc, revisionReason: original.revisionReason } : {}) };
        database.prepare("UPDATE reports SET payload=?,development_capture_sha256=NULL WHERE id=?").run(JSON.stringify({ rightsRemoved: true, version }), report.id);
        if (has("routing_runs")) database.prepare("UPDATE reports SET routing_capture_sha256=NULL WHERE id=?").run(report.id);
        if (has("pdf_renditions")) database.prepare("DELETE FROM pdf_renditions WHERE version_id=?").run(report.id);
        if (has("delivery_outbox")) database.prepare("UPDATE delivery_outbox SET state='rights-removed' WHERE report_version_id=?").run(report.id);
        if (has("email_deliveries")) for (const delivery of database.prepare("SELECT id,state,attached_pdf,download_format FROM email_deliveries WHERE version_id=?").all(report.id)) {
          if (["sending", "unknown", "accepted", "delivered", "bounced"].includes(String(delivery.state))) database.prepare("INSERT OR IGNORE INTO rights_email_scope VALUES(?,?,?,?)")
            .run(delivery.id!, report.id, delivery.attached_pdf === 1 ? "email-and-pdf-possibly-delivered-cannot-remote-erase" : "email-possibly-delivered-cannot-remote-erase", clock());
          database.prepare(`UPDATE email_deliveries SET state=CASE WHEN state IN ('accepted','delivered','unknown','bounced') THEN state WHEN state='sending' THEN 'unknown' ELSE 'suppressed' END,
            sender='',recipient='',provider_message_id=NULL,reason='rights-removed',lease_until_utc=NULL,attempt_id=NULL,link_expires_at_utc=NULL,pdf_reason=NULL WHERE id=?`).run(delivery.id!);
          database.prepare("UPDATE email_delivery_events SET reason='rights-removed',provider_message_id=NULL WHERE delivery_id=?").run(delivery.id!);
          database.prepare("UPDATE email_reconciliations SET payload='{}' WHERE delivery_id=?").run(delivery.id!);
        }
        if (has("archive_events")) database.prepare("UPDATE archive_events SET kind='rights-removed',payload=? WHERE version_id=?")
          .run(JSON.stringify({ rightsRemoved: true, reason: "source-rights", version, retainVersionAudit: allow }), report.id);
        if (has("archive_revision_changes")) database.prepare("UPDATE archive_revision_changes SET reason_reference='rights-removed' WHERE version_id=? OR replacement_version_id=?").run(report.id, report.id);
        if (has("archive_events")) database.prepare(`INSERT OR IGNORE INTO archive_events(event_id,kind,business_date,version_id,occurred_at_utc,payload)
          VALUES(?,'rights-removed',?,?,?,?)`).run(`rights:${report.id}`, report.id.slice(0, 10), report.id, clock(), JSON.stringify({ rightsRemoved: true, version, reason: "source-rights" }));
      }
      if (has("scheduled_tasks")) for (const row of database.prepare("SELECT business_date,snapshot,latest_version_id FROM scheduled_tasks").all()) {
        if (!touches(JSON.parse(String(row.snapshot))) && !affected.has(String(row.latest_version_id))) continue;
        database.prepare("UPDATE scheduled_tasks SET snapshot='{}',state='rights-removed',recovery_state='closed',failure='rights-removed',owner=NULL,pid=NULL WHERE business_date=?").run(row.business_date!);
      }
      if (has("scheduled_discourse_samples")) for (const row of database.prepare("SELECT rowid,payload FROM scheduled_discourse_samples").all()) {
        if (touches(JSON.parse(String(row.payload)))) database.prepare("DELETE FROM scheduled_discourse_samples WHERE rowid=?").run(row.rowid!);
      }
      // Candidate text cannot survive loss of its exact raw source. Conservatively
      // scrub queued candidates on any source removal; identities remain terminal.
      if (has("correction_signals") && sources.length) database.exec("UPDATE correction_signals SET payload='{}',state='blocked',reason='rights-removed',owner=NULL,lease_until_utc=NULL");
      if (has("routing_runs")) for (const row of database.prepare("SELECT id,payload FROM routing_runs").all()) {
        const run = JSON.parse(String(row.payload)) as Record<string, unknown>;
        if (touches(run) || sources.length && run.status !== "published") {
          database.prepare("INSERT OR IGNORE INTO rights_routing_runs VALUES(?)").run(row.id!);
          database.prepare("DELETE FROM routing_runs WHERE id=?").run(row.id!);
          database.prepare("DELETE FROM agent_events WHERE substr(id,1,?)=?").run(String(row.id).length + 1, `${row.id}:`);
        }
      }
      if (has("correction_patrol_tasks")) for (const row of database.prepare("SELECT id,target FROM correction_patrol_tasks").all()) {
        if (touches(JSON.parse(String(row.target)))) database.prepare("UPDATE correction_patrol_tasks SET target='{}',state='blocked',reason='rights-removed',evidence_refs='[]',owner=NULL,lease_until_utc=NULL WHERE id=?").run(row.id!);
      }
      if (forbiddenAudit) {
        if (has("correction_signals")) database.exec("UPDATE correction_signals SET identity_key='rights:'||signal_id,input_digest='' WHERE reason='rights-removed'");
        if (has("correction_patrol_tasks")) database.exec("UPDATE correction_patrol_tasks SET material_id=NULL WHERE reason='rights-removed'");
        if (has("correction_patrol_materials")) database.exec("DELETE FROM correction_patrol_materials");
        for (const source of sources) {
          if (has("correction_patrol_source_budget")) database.prepare("DELETE FROM correction_patrol_source_budget WHERE source=?").run(source);
          database.prepare("UPDATE retention_policies SET payload='null' WHERE source_id=?").run(source);
        }
      }
      for (const guard of guards) database.exec(String(guard.sql));
      database.exec("COMMIT");
    } catch (error) { database.exec("ROLLBACK"); throw error; }
  }
  function maintenance(force = false) {
    const current = policies();
    if (!force && Date.parse(clock()) - lastMaintenance < 60000 && !database.prepare("SELECT 1 FROM retention_jobs WHERE state!='complete' LIMIT 1").get()) return;
    database.prepare("INSERT OR REPLACE INTO retention_jobs VALUES('maintenance','running','source-ttl-agent-log-30d-github-90d',?,'{}')").run(clock());
    try {
      cleanRights(); hooks.purgeScheduled?.(current);
      const expiredEvents = database.prepare("DELETE FROM agent_events WHERE occurred_at_utc<=?").run(new Date(Date.parse(clock()) - 30 * 86400000).toISOString()).changes;
      // Raw candidates are bounded by their original source TTL, at most 30 days.
      if (has("correction_signals")) for (const row of database.prepare("SELECT signal_id,payload,received_at_utc,state FROM correction_signals WHERE payload!='{}'").all()) {
        const body = JSON.parse(String(row.payload)) as { evidence?: Array<{ evidenceId: string; retrievedAtUtc: string }> };
        const ttl = Math.min(720, ...current.map((source) => source.storage.retentionHours));
        const evidence = body.evidence ?? [], available = hooks.availableEvidence?.(evidence.map((entry) => entry.evidenceId));
        if (evidence.some((entry) => available ? !available.includes(entry.evidenceId) : Date.parse(entry.retrievedAtUtc) + ttl * 3600000 <= Date.parse(clock()))) database.prepare("UPDATE correction_signals SET payload='{}',state=CASE WHEN state IN ('pending','processing') THEN 'blocked' ELSE state END,reason='candidate-source-ttl',owner=NULL,lease_until_utc=NULL WHERE signal_id=?").run(row.signal_id!);
      }
      const published = database.prepare("SELECT payload FROM reports WHERE COALESCE(json_extract(payload,'$.rightsRemoved'),0)=0").all().map((row) => JSON.parse(String(row.payload)) as unknown);
      const github = hooks.compactGitHub?.(published, blocked()) ?? null;
      const result = JSON.stringify({ expiredAgentEvents: Number(expiredEvents), github, reason: "rights-overrides-immutable-content; publication-inputs-pinned" });
      database.prepare("UPDATE retention_jobs SET state='complete',updated_at_utc=?,result=?").run(clock(), result);
      lastMaintenance = Date.parse(clock());
    } catch {
      database.prepare("UPDATE retention_jobs SET state='retry',updated_at_utc=?,result=? WHERE state!='complete'").run(clock(), JSON.stringify({ reason: "maintenance-incomplete-access-remains-blocked" }));
      throw new Error("retention-maintenance-incomplete");
    }
  }
  return { policies, assertReadable, maintenance,
    remove(input: unknown) { const value = RightsRemovalSchema.parse(input);
      value.retainVersionAudit &&= !!readPolicies().find((source) => source.sourceId === value.sourceId)?.storage.retainRecordKeys;
      mark(value); maintenance(true); return { sourceId: value.sourceId, state: "complete" }; },
    status() { return database.prepare("SELECT id,state,reason,updated_at_utc AS updatedAtUtc,result FROM retention_jobs ORDER BY id").all(); },
    contract(): DeletionContract { return DeletionContractSchema.parse({ schemaVersion: 1, kind: "observer-rights-suppression",
      sources: database.prepare("SELECT source_id AS sourceId,reason,blocked_at_utc AS blockedAtUtc,retain_version_audit AS retainVersionAudit FROM rights_sources").all().map((row) => ({ ...row, retainVersionAudit: !!row.retainVersionAudit })),
      versions: database.prepare("SELECT version_id AS versionId,removed_at_utc AS removedAtUtc,retain_version_audit AS retainVersionAudit FROM rights_versions").all().map((row) => ({ ...row, retainVersionAudit: !!row.retainVersionAudit })) }); },
    applyContract(input: unknown) { const contract = DeletionContractSchema.parse(input);
      for (const source of contract.sources) mark(source, source.blockedAtUtc);
      for (const version of contract.versions) database.prepare("INSERT INTO rights_versions VALUES(?,?,?) ON CONFLICT(version_id) DO UPDATE SET retain_version_audit=MIN(rights_versions.retain_version_audit,excluded.retain_version_audit)").run(version.versionId, version.removedAtUtc, Number(version.retainVersionAudit));
      maintenance(true);
    },
  };
}
