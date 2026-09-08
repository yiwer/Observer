import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { createCollection, SourceConfigurationSchema } from "./collection.ts";
import { InterestProfileSchema, InterestSnapshotSchema } from "./interest-contracts.ts";
import { ProductionConfigurationSchema } from "./production-runtime.ts";
import { DeletionContractSchema, retentionLifecycle, type DeletionContract } from "./retention.ts";
import { ScheduledSnapshotSchema, scheduledStore, shanghaiDate } from "./scheduled-publication.ts";
import { githubRetention } from "./github-retention.ts";
import { backupObjectStore, ObjectCredentialsSchema, ObjectStoreSchema } from "./backup-s3.ts";
import { backupNames, decodeSnapshot, decryptFile, encodeSnapshot, encryptStream, fileDigest, type BackupManifest } from "./backup-format.ts";

export const BackupConfigurationSchema = z.strictObject({ schemaVersion: z.literal(1), enabled: z.boolean().default(false),
  runtimeConfigurationPath: z.string().min(1), dataDirectory: z.string().min(1), controlDirectory: z.string().min(1), restoreDirectory: z.string().min(1),
  currentSourcesPath: z.string().min(1), latestContractPath: z.string().min(1), encryptionKeyPath: z.string().min(1),
  snapshotIntervalHours: z.number().min(1).max(24).default(12), maxSnapshotBytes: z.number().int().min(1048576).max(4 * 1024 ** 3).default(1024 ** 3),
  objectStore: ObjectStoreSchema,
});
export type BackupConfiguration = z.infer<typeof BackupConfigurationSchema>;
type RuntimeConfiguration = z.infer<typeof ProductionConfigurationSchema>;
const utc = () => new Date().toISOString();
const SourceAuthoritySchema = z.strictObject({ schemaVersion: z.literal(1), updatedAtUtc: z.iso.datetime({ precision: 3, offset: false }),
  contract: DeletionContractSchema, sources: SourceConfigurationSchema });
type Authority = z.infer<typeof SourceAuthoritySchema>;
const SuccessSchema = z.strictObject({ id: z.uuid(), boundaryAtUtc: z.string(), completedAtUtc: z.string(), cursor: z.string(), etag: z.string().nullable() });
const StateSchema = z.strictObject({ schemaVersion: z.literal(1), lastSuccess: SuccessSchema.nullable(),
  attempt: z.strictObject({ startedAtUtc: z.string(), state: z.enum(["running", "complete", "failed"]), phase: z.string() }) });
type State = z.infer<typeof StateSchema>;

export function readJson(file: string, maxBytes = 16 * 1024 ** 2): unknown {
  if (!lstatSync(file).isFile() || statSync(file).size > maxBytes) throw new Error("backup-input-invalid");
  return JSON.parse(readFileSync(file, "utf8"));
}
export function atomicJson(file: string, value: unknown) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const fd = openSync(temporary, "r"); try { fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temporary, file);
  if (process.platform !== "win32") { const directory = openSync(dirname(file), "r"); try { fsyncSync(directory); } finally { closeSync(directory); } }
}
export function loadBackupConfiguration(file: string) {
  const config = BackupConfigurationSchema.parse(readJson(resolve(file)));
  for (const path of [config.runtimeConfigurationPath, config.dataDirectory, config.controlDirectory, config.restoreDirectory,
    config.currentSourcesPath, config.latestContractPath, config.encryptionKeyPath, config.objectStore.credentialsPath]) if (!isAbsolute(path)) throw new Error("backup-absolute-path-required");
  const roots = [config.dataDirectory, config.controlDirectory, config.restoreDirectory].map((value) => resolve(value));
  for (let a = 0; a < roots.length; a++) for (let b = a + 1; b < roots.length; b++) {
    const overlaps = (parent: string, child: string) => !relative(parent, child).startsWith("..") && !isAbsolute(relative(parent, child));
    if (overlaps(roots[a]!, roots[b]!) || overlaps(roots[b]!, roots[a]!)) throw new Error("backup-directories-must-be-separate");
  }
  return config;
}
const table = (db: DatabaseSync, name: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';
function openManaged(file: string, kind: "reports" | "collection" | "github", readOnly = false) {
  if (!lstatSync(file).isFile()) throw new Error("backup-database-missing");
  const db = new DatabaseSync(file, { readOnly });
  try {
    const applicationId = { reports: 0, collection: 1329746755, github: 1329746759 }[kind];
    if (db.prepare("PRAGMA user_version").get()!.user_version !== 1 || db.prepare("PRAGMA application_id").get()!.application_id !== applicationId ||
        !table(db, { reports: "reports", collection: "source_suppressions", github: "runs" }[kind])) throw new Error("backup-storage-version-unsupported");
    if (table(db, "context_index_state") && db.prepare("SELECT 1 FROM context_index_state WHERE schema_version!=2").get() ||
        table(db, "momentum_state") && db.prepare("SELECT 1 FROM momentum_state WHERE schema_version!=1").get()) throw new Error("backup-index-version-unsupported");
    db.exec("PRAGMA busy_timeout=5000"); return db;
  } catch (error) { db.close(); throw error; }
}
function runtimeInputs(config: BackupConfiguration) {
  const runtime = ProductionConfigurationSchema.parse(readJson(config.runtimeConfigurationPath));
  const fromRuntime = (value: string) => resolve(dirname(config.runtimeConfigurationPath), value);
  const files = { "reports.sqlite": fromRuntime(runtime.databasePath), "collection.sqlite": fromRuntime(runtime.collectionDatabasePath),
    ...(runtime.github ? { "github.sqlite": fromRuntime(runtime.github.databasePath) } : {}) };
  if (new Set(Object.values(files)).size !== Object.keys(files).length || Object.values(files).some((file) => dirname(file) !== resolve(config.dataDirectory))) throw new Error("backup-storage-must-share-lock-directory");
  const sources = SourceConfigurationSchema.parse(readJson(fromRuntime(runtime.sourceConfigurationPath)));
  const current = SourceConfigurationSchema.parse(readJson(config.currentSourcesPath));
  if (JSON.stringify(sources) !== JSON.stringify(current)) throw new Error("backup-source-authority-mismatch");
  const interest = InterestProfileSchema.parse(readJson(fromRuntime(runtime.interestProfilePath)));
  const active = InterestSnapshotSchema.parse(readJson(`${files["reports.sqlite"]}.interest.json`));
  if (JSON.stringify(active.profile) !== JSON.stringify(interest)) throw new Error("backup-interest-boundary-mismatch");
  // These schemas have no inline credential fields. Reject credential-bearing
  // URLs too; credentials must remain dedicated file/env inputs.
  const inspect = (value: unknown): void => {
    if (typeof value === "string" && /^https?:\/\//.test(value)) {
      const url = new URL(value);
      if (url.username || url.password || [...url.searchParams.keys()].some((key) => /token|secret|password|api.?key|authorization/i.test(key))) throw new Error("backup-inline-secret-forbidden");
    } else if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === "object") Object.values(value).forEach(inspect);
  };
  inspect([runtime, sources, interest]);
  return { runtime, files, sources, interest, active };
}
function readState(config: BackupConfiguration): State | null {
  const file = join(config.controlDirectory, "state.json"); return existsSync(file) ? StateSchema.parse(readJson(file)) : null;
}
function latestAuthority(config: BackupConfiguration): Authority {
  return { schemaVersion: 1, updatedAtUtc: utc(), contract: DeletionContractSchema.parse(readJson(config.latestContractPath)),
    sources: SourceConfigurationSchema.parse(readJson(config.currentSourcesPath)) };
}
function mergeContracts(...contracts: DeletionContract[]): DeletionContract {
  const sources = new Map<string, DeletionContract["sources"][number]>(), versions = new Map<string, DeletionContract["versions"][number]>();
  for (const contract of contracts) {
    for (const entry of contract.sources) { const old = sources.get(entry.sourceId); sources.set(entry.sourceId, old ? { ...old,
      blockedAtUtc: [old.blockedAtUtc, entry.blockedAtUtc].sort()[0]!, retainVersionAudit: old.retainVersionAudit && entry.retainVersionAudit } : entry); }
    for (const entry of contract.versions) { const old = versions.get(entry.versionId); versions.set(entry.versionId, old ? { ...old,
      removedAtUtc: [old.removedAtUtc, entry.removedAtUtc].sort()[0]!, retainVersionAudit: old.retainVersionAudit && entry.retainVersionAudit } : entry); }
  }
  return DeletionContractSchema.parse({ schemaVersion: 1, kind: "observer-rights-suppression", sources: [...sources.values()].sort((a, b) => a.sourceId.localeCompare(b.sourceId)),
    versions: [...versions.values()].sort((a, b) => a.versionId.localeCompare(b.versionId)) });
}
function savedAuthority(config: BackupConfiguration): Authority | null {
  const file = join(config.controlDirectory, "latest-authority.json"); return existsSync(file) ? SourceAuthoritySchema.parse(readJson(file)) : null;
}
/** SQL-level copy into brand new pages; no source database/WAL/freelist bytes are
 * copied. Secret table rows are never even SELECTed. Triggers install last. */
function logicalClone(source: string, target: string, kind: "reports" | "collection" | "github") {
  const input = openManaged(source, kind, true), output = new DatabaseSync(target);
  const noRows = new Set(["private_access_meta", "devices", "device_pairings", "pairing_rate", "agent_events", "scheduled_discourse_samples",
    ...(kind === "collection" ? ["evidence", "correction_source_evidence", "source_state"] : [])]);
  try {
    input.exec("BEGIN"); output.exec("PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE");
    const schema = input.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid").all();
    for (const row of schema.filter((row) => row.type === "table")) {
      if (/CREATE\s+VIRTUAL\s+TABLE/i.test(String(row.sql))) throw new Error("backup-virtual-table-unsupported");
      output.exec(String(row.sql));
      if (noRows.has(String(row.name))) continue;
      const columns = input.prepare(`PRAGMA table_info(${quote(String(row.name))})`).all().map((entry) => String(entry.name));
      const insert = output.prepare(`INSERT INTO ${quote(String(row.name))} (${columns.map(quote).join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
      const select = input.prepare(`SELECT ${columns.map(quote).join(",")} FROM ${quote(String(row.name))}`); select.setReadBigInts(true);
      for (const item of select.iterate()) {
        if (kind === "reports" && row.name === "scheduled_tasks" && item.snapshot !== "{}") {
          const snapshot = ScheduledSnapshotSchema.parse(JSON.parse(String(item.snapshot)));
          if (snapshot.request.evidenceBundle.schemaVersion === 2) snapshot.request.evidenceBundle.evidence = [];
          if (snapshot.request.discourseSamples) snapshot.request.discourseSamples = [];
          item.snapshot = JSON.stringify(snapshot);
          if (["queued", "running"].includes(String(item.state))) { item.state = "failed"; item.failure = "backup-excludes-expiring-source"; }
          item.owner = null; item.pid = null;
        }
        if (kind === "reports" && row.name === "correction_signals") {
          item.payload = "{}"; item.owner = null; item.lease_until_utc = null;
          if (["pending", "processing"].includes(String(item.state))) { item.state = "blocked"; item.reason = "backup-excludes-expiring-source"; }
        }
        insert.run(...columns.map((column) => item[column]!));
      }
    }
    if (table(input, "sqlite_sequence")) {
      output.exec("DELETE FROM sqlite_sequence");
      for (const row of input.prepare("SELECT name,seq FROM sqlite_sequence").all()) output.prepare("INSERT INTO sqlite_sequence VALUES(?,?)").run(row.name!, row.seq!);
    }
    for (const row of schema.filter((row) => row.type !== "table")) output.exec(String(row.sql));
    output.exec(`PRAGMA application_id=${Number(input.prepare("PRAGMA application_id").get()!.application_id)}; PRAGMA user_version=1; COMMIT`);
    input.exec("COMMIT");
  } finally { input.close(); output.close(); }
}
function maintain(files: { "reports.sqlite": string; "collection.sqlite": string; "github.sqlite"?: string }, authority: Authority, stripExpiring = false) {
  const reports = openManaged(files["reports.sqlite"], "reports"), github = files["github.sqlite"] ? openManaged(files["github.sqlite"], "github") : undefined;
  let collection: ReturnType<typeof createCollection> | undefined;
  try {
    // Verify every database before the collection constructor can migrate it.
    openManaged(files["collection.sqlite"], "collection", true).close();
    collection = createCollection({ databasePath: files["collection.sqlite"], sources: authority.sources.sources, policyReader: () => authority.sources.sources });
    const schedule = scheduledStore(reports, utc);
    const lifecycle = retentionLifecycle(reports, utc, () => authority.sources.sources, { purgeRaw: (ids) => collection!.suppressSources(ids),
      availableEvidence: (ids) => collection!.correctionEvidence(ids).map((entry) => entry.id), purgeScheduled: (policies) => schedule.purge(policies),
      ...(github ? { compactGitHub: (published: unknown[], ids: string[]) => githubRetention(github, utc(), published, ids) } : {}) });
    lifecycle.applyContract(authority.contract);
    if (stripExpiring) {
      // All SourcePolicy raw TTLs are <=30 days. Expire only the frozen raw-input
      // projection, not permanent report records or the GitHub identity chain.
      scheduledStore(reports, () => new Date(Date.now() + 31 * 86400000).toISOString()).purge(authority.sources.sources);
      if (table(reports, "correction_signals")) reports.exec(`UPDATE correction_signals SET payload='{}',
        state=CASE WHEN state IN ('pending','processing') THEN 'blocked' ELSE state END,
        reason=CASE WHEN state IN ('pending','processing') THEN 'backup-excludes-expiring-source' ELSE reason END,owner=NULL,lease_until_utc=NULL`);
    }
    return { ...authority, contract: mergeContracts(authority.contract, lifecycle.contract()) };
  } finally { collection?.close(); github?.close(); reports.close(); }
}
function currentCursor(config: BackupConfiguration) {
  const inputs = runtimeInputs(config), db = openManaged(inputs.files["reports.sqlite"], "reports", true);
  try {
    return JSON.stringify({ release: process.env.OBSERVER_RELEASE_ID, runtime: inputs.runtime, sources: inputs.sources, interest: inputs.active,
      contract: latestAuthority(config).contract,
      reports: db.prepare("SELECT id FROM reports ORDER BY id").all(),
      pdf: table(db, "pdf_renditions") ? db.prepare("SELECT version_id,state FROM pdf_renditions ORDER BY version_id").all() : [],
      email: table(db, "email_delivery_events") ? db.prepare("SELECT COALESCE(MAX(sequence),0) AS value FROM email_delivery_events").get() : null,
      rights: table(db, "rights_sources") ? db.prepare("SELECT * FROM rights_sources ORDER BY source_id").all() : [],
      removed: table(db, "rights_versions") ? db.prepare("SELECT * FROM rights_versions ORDER BY version_id").all() : [],
    });
  } finally { db.close(); }
}
export function backupStatus(config: BackupConfiguration) {
  const state = readState(config), ageSeconds = state?.lastSuccess ? (Date.now() - Date.parse(state.lastSuccess.boundaryAtUtc)) / 1000 : null;
  const success = state?.lastSuccess;
  return { enabled: config.enabled, state: state ? { attempt: state.attempt, lastSuccess: success ? {
    id: success.id, boundaryAtUtc: success.boundaryAtUtc, completedAtUtc: success.completedAtUtc } : null } : null,
    recoverableSnapshotAgeSeconds: ageSeconds, rpoTargetSeconds: 86400,
    rpoStatus: ageSeconds === null ? "no-successful-snapshot" : ageSeconds > 86400 ? "target-exceeded" : "within-target-local-receipt-only" };
}
export function backupDue(config: BackupConfiguration) {
  if (!config.enabled) return false;
  const state = readState(config);
  return !state?.lastSuccess || state.attempt.state !== "complete" || Date.now() - Date.parse(state.lastSuccess.boundaryAtUtc) >= config.snapshotIntervalHours * 3600000 || currentCursor(config) !== state.lastSuccess.cursor;
}
function keyAndStore(config: BackupConfiguration) {
  const encoded = readFileSync(config.encryptionKeyPath, "utf8").trim();
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error("backup-key-must-be-32-byte-base64");
  const key = Buffer.from(encoded, "base64");
  const credentials = ObjectCredentialsSchema.parse(readJson(config.objectStore.credentialsPath, 16384));
  return { key, store: backupObjectStore(config.objectStore, credentials) };
}
async function encryptedJson(file: string, value: unknown, key: Buffer) {
  async function* chunks() { yield Buffer.from(JSON.stringify(value)); }
  await encryptStream(chunks(), file, key);
}
function cleanupCreated(directory: string, parent: string) {
  if (dirname(directory) !== resolve(parent) || !/^(snapshot|restore)-[A-Za-z0-9]+$/.test(directory.slice(dirname(directory).length + 1))) throw new Error("backup-cleanup-target-invalid");
  rmSync(directory, { recursive: true });
}
function beginStage(config: BackupConfiguration, kind: "snapshot" | "restore", parent: string) {
  const pointer = join(config.controlDirectory, `${kind}-active.json`);
  if (existsSync(pointer)) {
    const old = z.strictObject({ schemaVersion: z.literal(1), directory: z.string(), parent: z.string() }).parse(readJson(pointer));
    if (resolve(old.parent) !== resolve(parent)) throw new Error("backup-staging-parent-changed");
    if (existsSync(old.directory)) cleanupCreated(old.directory, parent);
  }
  const directory = mkdtempSync(join(parent, `${kind}-`));
  atomicJson(pointer, { schemaVersion: 1, directory, parent: resolve(parent) });
  return directory;
}
function syncDirectory(directory: string) {
  if (process.platform !== "win32") { const fd = openSync(directory, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } }
}

/** Caller holds service.lock and control operation.lock for the entire operation.
 * A changed authority deletes the previous exact object before another upload.
 * No app can publish/revoke while an older staged snapshot is being uploaded. */
export async function createBackup(config: BackupConfiguration) {
  if (!config.enabled || !process.env.OBSERVER_RELEASE_ID) throw new Error("backup-disabled-or-release-missing");
  const stage = beginStage(config, "snapshot", config.controlDirectory), startedAtUtc = utc();
  const state: State = { schemaVersion: 1, lastSuccess: readState(config)?.lastSuccess ?? null, attempt: { startedAtUtc, state: "running", phase: "inputs" } };
  const phase = (value: string) => { state.attempt.phase = value; atomicJson(join(config.controlDirectory, "state.json"), state); };
  let connection: ReturnType<typeof keyAndStore> | undefined;
  try {
    phase("inputs"); const inputs = runtimeInputs(config), initialAuthority = latestAuthority(config), prior = savedAuthority(config);
    let authority = { ...initialAuthority, contract: mergeContracts(initialAuthority.contract, ...(prior ? [prior.contract] : [])) };
    const configurationBoundary = JSON.stringify(inputs);
    connection = keyAndStore(config); const { key, store } = connection;
    phase("storage-policy"); await store.assertPrivateDeletable();
    // Losing this node's control directory cannot erase newer remote markers.
    try {
      await store.get("authority.obs", join(stage, "previous-authority.obs"), 32 * 1024 ** 2);
      await decryptFile(join(stage, "previous-authority.obs"), join(stage, "previous-authority.json"), key);
      const remote = SourceAuthoritySchema.parse(readJson(join(stage, "previous-authority.json")));
      authority.contract = mergeContracts(authority.contract, remote.contract);
      for (const source of authority.sources.sources) {
        const old = remote.sources.sources.find((entry) => entry.sourceId === source.sourceId);
        if (old && (source.version < old.version || source.version === old.version && JSON.stringify(source) !== JSON.stringify(old))) throw new Error("backup-source-authority-rollback");
      }
    } catch (error) { if (!(error instanceof Error && error.name === "NoSuchKey")) throw error; }
    phase("retention");
    try { authority = maintain(inputs.files, authority); }
    catch (error) { await store.removeSnapshot(); state.lastSuccess = null; throw error; }
    const cursor = currentCursor(config), boundaryAtUtc = utc();
    // If the local receipt was lost, assume an old remote snapshot exists.
    const changedRights = !prior || JSON.stringify({ contract: prior.contract, sources: prior.sources }) !== JSON.stringify({ contract: authority.contract, sources: authority.sources });
    if (changedRights) {
      phase("rights-delete-previous-snapshot"); await store.removeSnapshot();
      state.lastSuccess = null; phase("rights-authority");
    }
    // Separate from snapshot bytes: deleting/replacing a snapshot cannot roll back
    // the last known deletion markers. Recovery additionally requires Owner's
    // latest independent inputs, including any change not uploaded before loss.
    atomicJson(join(config.controlDirectory, "latest-authority.json"), authority);
    await encryptedJson(join(stage, "authority.obs"), authority, key);
    await store.put("authority.obs", join(stage, "authority.obs"));
    phase("logical-snapshot");
    for (const [name, source] of Object.entries(inputs.files)) logicalClone(source, join(stage, name), name.replace(".sqlite", "") as "reports" | "collection" | "github");
    const snapshotFiles = { "reports.sqlite": join(stage, "reports.sqlite"), "collection.sqlite": join(stage, "collection.sqlite"),
      ...(inputs.files["github.sqlite"] ? { "github.sqlite": join(stage, "github.sqlite") } : {}) };
    maintain(snapshotFiles, authority, true);
    // Repack after raw projection removal so deleted candidate bytes cannot be
    // recovered from free pages of the ordinary snapshot.
    for (const [name, file] of Object.entries(snapshotFiles)) { const db = openManaged(file, name.replace(".sqlite", "") as "reports" | "collection" | "github");
      try { db.exec("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; VACUUM"); } finally { db.close(); } }
    atomicJson(join(stage, "runtime.json"), inputs.runtime); atomicJson(join(stage, "sources.json"), inputs.sources);
    atomicJson(join(stage, "interest.json"), inputs.interest); atomicJson(join(stage, "active-interest.json"), inputs.active);
    const files: BackupManifest["files"] = [];
    for (const name of backupNames) if (existsSync(join(stage, name))) files.push({ name, bytes: statSync(join(stage, name)).size, sha256: await fileDigest(join(stage, name)) });
    if (files.reduce((sum, file) => sum + file.bytes, 0) + 16 * 1024 ** 2 > config.maxSnapshotBytes) throw new Error("backup-size-budget-exceeded");
    const reportDb = openManaged(snapshotFiles["reports.sqlite"], "reports", true);
    let reportIds: string[]; try { reportIds = reportDb.prepare("SELECT id FROM reports ORDER BY id").all().map((row) => String(row.id)); } finally { reportDb.close(); }
    const manifest: BackupManifest = { schemaVersion: 1, kind: "observer-off-node-snapshot", id: randomUUID(), releaseId: process.env.OBSERVER_RELEASE_ID,
      nodeVersion: process.versions.node, configurationId: inputs.runtime.configurationId, boundaryAtUtc,
      consistency: "app-stopped-service-lock-logical-rewrite", exclusions: "secrets-devices-pairings-expiring-source-material", files, reportIds };
    await encodeSnapshot(stage, manifest, join(stage, "snapshot.obs"), key);
    const unchanged = () => JSON.stringify(runtimeInputs(config)) === configurationBoundary &&
      JSON.stringify(latestAuthority(config).contract) === JSON.stringify(initialAuthority.contract) && currentCursor(config) === cursor;
    if (!unchanged()) throw new Error("backup-consistency-boundary-changed");
    phase("upload"); const etag = await store.put("snapshot.obs", join(stage, "snapshot.obs"));
    if (!unchanged()) { await store.removeSnapshot(); state.lastSuccess = null; throw new Error("backup-authority-changed-during-upload"); }
    await store.assertPrivateDeletable();
    state.lastSuccess = { id: manifest.id, boundaryAtUtc, completedAtUtc: utc(), cursor, etag };
    state.attempt.state = "complete"; phase("complete");
    atomicJson(join(config.controlDirectory, "last-manifest.json"), manifest);
    return { id: manifest.id, boundaryAtUtc, completedAtUtc: state.lastSuccess.completedAtUtc, state: "complete" };
  } catch (error) { state.attempt.state = "failed"; atomicJson(join(config.controlDirectory, "state.json"), state); throw error; }
  finally { connection?.store.close(); cleanupCreated(stage, config.controlDirectory); }
}

function restoredMailFence(db: DatabaseSync, restoredAtUtc: string, snapshotId: string) {
  db.exec("CREATE TABLE IF NOT EXISTS recovery_snapshot(id INTEGER PRIMARY KEY CHECK(id=1),snapshot_id TEXT NOT NULL)");
  db.prepare("INSERT OR REPLACE INTO recovery_snapshot VALUES(1,?)").run(snapshotId);
  db.exec("CREATE TABLE IF NOT EXISTS recovery_mail_fence(id INTEGER PRIMARY KEY CHECK(id=1),through_business_date TEXT NOT NULL,restored_at_utc TEXT NOT NULL)");
  db.prepare("INSERT INTO recovery_mail_fence VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET through_business_date=MAX(through_business_date,excluded.through_business_date),restored_at_utc=excluded.restored_at_utc")
    .run(shanghaiDate(restoredAtUtc), restoredAtUtc);
  if (!table(db, "email_deliveries")) throw new Error("backup-email-schema-missing");
  // The snapshot cannot know SMTP acknowledgements that occurred after its RPO
  // boundary. Fence the loss window rather than automatically resend history.
  db.prepare(`UPDATE email_deliveries SET unknown_at_utc=CASE WHEN state='sending' THEN ? ELSE unknown_at_utc END,
    updated_at_utc=?,state=CASE WHEN state='sending' THEN 'unknown' ELSE 'suppressed' END,
    reason='restore-send-history-uncertain',lease_until_utc=NULL,attempt_id=NULL WHERE state IN ('pending','preparing','sending');
    `).run(restoredAtUtc, restoredAtUtc);
  db.exec(`CREATE TRIGGER IF NOT EXISTS recovery_mail_insert AFTER INSERT ON email_deliveries WHEN NEW.business_date<=(SELECT through_business_date FROM recovery_mail_fence WHERE id=1)
    BEGIN UPDATE email_deliveries SET state='suppressed',reason='restore-send-history-uncertain' WHERE id=NEW.id; END;
    CREATE TRIGGER IF NOT EXISTS recovery_mail_retry BEFORE UPDATE OF state ON email_deliveries WHEN NEW.state IN ('pending','preparing','sending') AND
    NEW.business_date<=(SELECT through_business_date FROM recovery_mail_fence WHERE id=1) BEGIN SELECT RAISE(IGNORE); END;`);
}

export async function restoreBackup(config: BackupConfiguration, drillId: string, incidentAtUtc: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(drillId) || !process.env.OBSERVER_RELEASE_ID ||
    !z.iso.datetime({ precision: 3, offset: false }).safeParse(incidentAtUtc).success || incidentAtUtc > utc()) throw new Error("backup-restore-id-release-or-incident-invalid");
  if (existsSync(join(config.controlDirectory, `drill-${drillId}.json`))) throw new Error("backup-drill-id-already-recorded");
  const target = join(config.restoreDirectory, drillId), stage = beginStage(config, "restore", config.restoreDirectory);
  const startedAtUtc = incidentAtUtc;
  if (existsSync(target)) { cleanupCreated(stage, config.restoreDirectory); throw new Error("backup-restore-target-exists"); }
  const result: Record<string, unknown> = { schemaVersion: 1, drillId, startedAtUtc, requestedAtUtc: utc(), state: "running", phase: "authority", completedAtUtc: null,
    rpoTargetSeconds: 86400, rtoTargetSeconds: 14400, rpoSeconds: null, rtoSeconds: null, verdict: "NOT_MEASURED" };
  const record = () => atomicJson(join(config.controlDirectory, `drill-${drillId}.json`), result);
  let connection: ReturnType<typeof keyAndStore> | undefined;
  try {
    record(); const current = latestAuthority(config), authorityBoundary = JSON.stringify({ contract: current.contract, sources: current.sources });
    connection = keyAndStore(config); const { store, key } = connection;
    await store.assertPrivateDeletable();
    await store.get("authority.obs", join(stage, "authority.obs"), 32 * 1024 ** 2);
    await decryptFile(join(stage, "authority.obs"), join(stage, "authority.json"), key);
    const remote = SourceAuthoritySchema.parse(readJson(join(stage, "authority.json")));
    for (const source of current.sources.sources) {
      const prior = remote.sources.sources.find((entry) => entry.sourceId === source.sourceId);
      if (prior && (source.version < prior.version || source.version === prior.version && JSON.stringify(source) !== JSON.stringify(prior))) throw new Error("backup-current-source-policy-rollback");
    }
    const authority: Authority = { ...current, contract: mergeContracts(remote.contract, current.contract, ...(savedAuthority(config) ? [savedAuthority(config)!.contract] : [])) };
    result.phase = "download"; record();
    await store.get("snapshot.obs", join(stage, "snapshot.obs"), config.maxSnapshotBytes);
    result.phase = "authenticate"; record();
    await decryptFile(join(stage, "snapshot.obs"), join(stage, "snapshot.plain"), key);
    const extracted = join(stage, "extracted"); mkdirSync(extracted, { mode: 0o700 });
    const manifest = await decodeSnapshot(join(stage, "snapshot.plain"), extracted, config.maxSnapshotBytes);
    if (manifest.releaseId !== process.env.OBSERVER_RELEASE_ID || manifest.boundaryAtUtc > startedAtUtc) throw new Error("backup-release-or-boundary-unsupported");
    result.snapshotId = manifest.id; result.releaseId = manifest.releaseId; result.configurationId = manifest.configurationId;
    result.boundaryAtUtc = manifest.boundaryAtUtc; result.rpoSeconds = (Date.parse(startedAtUtc) - Date.parse(manifest.boundaryAtUtc)) / 1000;
    result.phase = "retention-and-mail-fence"; record();
    const runtime = ProductionConfigurationSchema.parse(readJson(join(extracted, "runtime.json")));
    if (!!runtime.github !== existsSync(join(extracted, "github.sqlite"))) throw new Error("backup-database-inventory-mismatch");
    const files = { "reports.sqlite": join(extracted, "reports.sqlite"), "collection.sqlite": join(extracted, "collection.sqlite"),
      ...(runtime.github ? { "github.sqlite": join(extracted, "github.sqlite") } : {}) };
    const applied = maintain(files, authority, true);
    const reports = openManaged(files["reports.sqlite"], "reports");
    try {
      if (JSON.stringify(reports.prepare("SELECT id FROM reports ORDER BY id").all().map((row) => String(row.id))) !== JSON.stringify(manifest.reportIds)) throw new Error("backup-report-inventory-mismatch");
      for (const name of ["private_access_meta", "devices", "device_pairings"]) if (table(reports, name) && reports.prepare(`SELECT COUNT(*) AS count FROM ${quote(name)}`).get()!.count !== 0) throw new Error("backup-secret-state-forbidden");
      restoredMailFence(reports, startedAtUtc, manifest.id);
    } finally { reports.close(); }
    for (const [name, file] of Object.entries(files)) {
      const db = openManaged(file, name.replace(".sqlite", "") as "reports" | "collection" | "github");
      try {
        if (db.prepare("PRAGMA integrity_check").get()!.integrity_check !== "ok" || db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("backup-restored-storage-invalid");
        db.exec("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; VACUUM");
      } finally { db.close(); }
    }
    const ready = join(stage, "ready"), data = join(ready, "data"), configs = join(ready, "config");
    mkdirSync(ready, { mode: 0o700 }); mkdirSync(data, { mode: 0o700 }); mkdirSync(configs, { mode: 0o700 });
    for (const [name, file] of Object.entries(files)) renameSync(file, join(data, name === "reports.sqlite" ? "observer.sqlite" : name));
    // Fixed container paths survive promotion to a new host mount. Runtime starts
    // read-only in behavior until the operator explicitly enables future work.
    const restoredRuntime: RuntimeConfiguration = { ...runtime, databasePath: "/var/lib/observer/observer.sqlite", collectionDatabasePath: "/var/lib/observer/collection.sqlite",
      sourceConfigurationPath: "sources.json", interestProfilePath: "interest.json", taskRoot: "/run/observer/agent-tasks",
      schedule: { ...runtime.schedule, enabled: false }, collect: false, email: { enabled: false }, pdf: { enabled: false },
      corrections: { enabled: false }, correctionPatrol: { ...runtime.correctionPatrol, enabled: false },
      retention: { restoreContractPath: "restore-contract.json" },
      ...(runtime.github ? { github: { ...runtime.github, databasePath: "/var/lib/observer/github.sqlite" } } : {}) };
    atomicJson(join(configs, "runtime.json"), restoredRuntime); atomicJson(join(configs, "sources.json"), current.sources);
    atomicJson(join(configs, "restore-contract.json"), applied.contract);
    const interest = InterestProfileSchema.parse(readJson(join(extracted, "interest.json"))), active = InterestSnapshotSchema.parse(readJson(join(extracted, "active-interest.json")));
    if (JSON.stringify(interest) !== JSON.stringify(active.profile)) throw new Error("backup-restored-interest-mismatch");
    atomicJson(join(configs, "interest.json"), interest); atomicJson(join(data, "observer.sqlite.interest.json"), active);
    const reloaded = latestAuthority(config);
    if (JSON.stringify({ contract: reloaded.contract, sources: reloaded.sources }) !== authorityBoundary) throw new Error("backup-restore-authority-changed");
    await store.get("authority.obs", join(stage, "final-authority.obs"), 32 * 1024 ** 2);
    await decryptFile(join(stage, "final-authority.obs"), join(stage, "final-authority.json"), key);
    const remoteFinal = SourceAuthoritySchema.parse(readJson(join(stage, "final-authority.json")));
    if (JSON.stringify({ sources: remote.sources, contract: remote.contract }) !== JSON.stringify({ sources: remoteFinal.sources, contract: remoteFinal.contract })) throw new Error("backup-remote-authority-changed");
    atomicJson(join(ready, "manifest.json"), manifest); atomicJson(join(ready, "restore-receipt.json"), { ...result, phase: "sanitized", state: "ready-for-private-start" });
    syncDirectory(data); syncDirectory(configs); syncDirectory(ready);
    renameSync(ready, target);
    syncDirectory(config.restoreDirectory);
    result.state = "ready-for-private-start"; result.phase = "awaiting-authenticated-readiness"; result.sanitizedAtUtc = utc(); record();
    return { drillId, state: result.state, target, rpoSeconds: result.rpoSeconds, verdict: "NOT_MEASURED", reason: "private-start-and-readiness-required" };
  } catch (error) { result.state = "failed"; result.verdict = "FAIL"; result.failedAtUtc = utc(); record(); throw error; }
  finally { connection?.store.close(); cleanupCreated(stage, config.restoreDirectory); }
}

/** Final event is measured against an actual private server; staging completion
 * alone is never an RTO pass. No SMTP, collection, or model work is requested. */
export async function completeRestoreDrill(config: BackupConfiguration, drillId: string, baseUrl: string, ownerTokenPath: string) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(drillId)) throw new Error("backup-drill-id-invalid");
  const url = new URL(baseUrl);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    !(url.protocol === "https:" || url.protocol === "http:" && ["127.0.0.1", "[::1]", "app"].includes(url.hostname))) throw new Error("backup-private-readiness-url-invalid");
  const file = join(config.controlDirectory, `drill-${drillId}.json`), result = readJson(file) as Record<string, unknown>;
  if (result.state !== "ready-for-private-start" || typeof result.startedAtUtc !== "string" || typeof result.rpoSeconds !== "number") throw new Error("backup-drill-not-ready");
  const token = readFileSync(ownerTokenPath, "utf8").trim(); if (token.length < 32) throw new Error("backup-independent-owner-secret-required");
  try {
    const receipt = readJson(join(config.restoreDirectory, drillId, "restore-receipt.json")) as Record<string, unknown>;
    if (receipt.snapshotId !== result.snapshotId) throw new Error("backup-drill-identity-mismatch");
    const headers = { Authorization: `Bearer ${token}` };
    const response = await fetch(new URL("/v1/ops", url), { headers, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("backup-private-service-unreadable");
    const status = await response.json() as { storage?: { recoverySnapshotId?: string }; runtime?: { enabled?: Record<string, boolean> } };
    if (status.storage?.recoverySnapshotId !== result.snapshotId || !status.runtime?.enabled || Object.values(status.runtime.enabled).some(Boolean)) throw new Error("backup-readiness-runtime-mismatch");
    const archive = await fetch(new URL("/v1/archive?limit=1", url), { headers, redirect: "error", signal: AbortSignal.timeout(10000) });
    if (!archive.ok) throw new Error("backup-private-archive-unreadable");
    const history = await archive.json() as { schemaVersion?: number; items?: Array<{ versions?: Array<{ version?: { id?: string }; renditions?: { markdown?: { available?: boolean }; pdf?: { available?: boolean } } }> }> };
    if (history.schemaVersion !== 1 || !Array.isArray(history.items)) throw new Error("backup-private-archive-invalid");
    let checkedRenditions = 0;
    for (const version of history.items.flatMap((item) => item.versions ?? [])) {
      if (!version.version?.id || !/^\d{4}-\d{2}-\d{2}-v[1-9]\d*$/.test(version.version.id)) throw new Error("backup-archive-version-invalid");
      for (const format of ["markdown", "pdf"] as const) if (version.renditions?.[format]?.available) {
        const rendition = await fetch(new URL(`/v1/reports/${version.version.id}/${format}`, url), { headers, redirect: "error", signal: AbortSignal.timeout(30000) });
        if (!rendition.ok || !(await rendition.arrayBuffer()).byteLength) throw new Error("backup-private-rendition-unreadable");
        checkedRenditions++;
      }
    }
    result.checkedRenditions = checkedRenditions;
    result.completedAtUtc = utc(); result.rtoSeconds = (Date.parse(String(result.completedAtUtc)) - Date.parse(result.startedAtUtc)) / 1000;
    result.state = "complete"; result.phase = "authenticated-private-archive-readable";
    result.verdict = result.rpoSeconds > 86400 || Number(result.rtoSeconds) > 14400 ? "FAIL" : checkedRenditions === 0 ? "INCOMPLETE" : "PASS";
    result.scope = "this-restored-snapshot-private-api-only;no-smtp-provider-or-production-capacity-qualification";
    atomicJson(file, result); return result;
  } catch (error) { result.lastReadinessFailureAtUtc = utc(); result.verdict = "FAIL"; atomicJson(file, result); throw error; }
}
