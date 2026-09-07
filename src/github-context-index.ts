import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { githubDigest } from "./github-adapter.ts";
import { GitHubRunSchema, GitHubPolicyIdentitySchema, type GitHubRun } from "./github-contracts.ts";
import { DevelopmentRunSchema, type DevelopmentRun, type PreviousDevelopmentEvidence, type ContextFreeze } from "./github-development-contracts.ts";
import type { AdvisoryHistory } from "./github-advisory-contracts.ts";
import { projectMitigation } from "./github-mitigations.ts";
import { createGitHubReadBudget, finishGitHubReadBudget, readGitHubMetadata, readGitHubPayload, registerGitHubOrigin, type GitHubReadBudget } from "./github-read-budget.ts";

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const emptyDigest = githubDigest([]);
type Row = Record<string, string | number | bigint | Uint8Array | null>;
type Context = { kind: "release"; development: DevelopmentRun["developments"][number]; origin: PreviousDevelopmentEvidence } |
  { kind: "known-security"; origin: AdvisoryHistory["entries"][number] } |
  ({ kind: "security-mitigation" } & AdvisoryHistory["mitigations"][number]) |
  { kind: "security"; development: NonNullable<DevelopmentRun["security"]>["developments"][number]; origin: AdvisoryHistory["entries"][number] };
export interface IndexedContext { freeze: ContextFreeze | null; entries: Context[]; unavailable: boolean; }
interface Budget { payloads: GitHubReadBudget; origins: Map<string, { run: DevelopmentRun; github: GitHubRun } | null>; dependencies?: Map<string, Dependency>; }
const createBudget = (): Budget => ({ payloads: createGitHubReadBudget(), origins: new Map() });
const DependencySchema = GitHubPolicyIdentitySchema.extend({ materialKinds: z.number().int().min(0).max(3) });
type Dependency = z.infer<typeof DependencySchema>;
export const developmentRouteColumns = { source_id: "TEXT", policy_version: "INTEGER", policy_sha256: "TEXT", available_at: "TEXT", payload_bytes: "INTEGER", payload_sha256: "TEXT", material_kinds: "INTEGER", dependency_policies: "TEXT" };
export function developmentMaterialKinds(run: DevelopmentRun): number {
  return Number(!!(run.evidence.length || run.assessments.length || run.developments.length)) |
    (Number(!!(run.security && (run.security.evidence.length || run.security.risks.length || run.security.developments.length || run.security.history.entries.length || run.security.history.materials.length || run.security.history.mitigations.length || run.security.assessments.length))) << 1);
}
export function developmentDependencies(run: DevelopmentRun): Dependency[] {
  const values: Dependency[] = [...(run.policy ? [{ ...run.policy, materialKinds: developmentMaterialKinds(run) }] : []),
    ...run.assessments.flatMap((receipt) => receipt.previousEvidence.map((entry) => ({ ...entry.evidence.policy, materialKinds: 1 }))),
    ...[...(run.security?.history.entries ?? []), ...(run.security?.history.materials ?? []).map((entry) => entry.origin),
      ...(run.security?.history.mitigations ?? []).map((entry) => entry.origin),
      ...(run.security?.assessments ?? []).flatMap((receipt) => receipt.previous.map((entry) => entry.origin))].map((entry) => ({ ...entry.evidence.policy, materialKinds: 2 }))];
  const distinct = new Map<string, Dependency>();
  for (const value of values) {
    const key = JSON.stringify([value.sourceId, value.policyVersion, value.policySha256]);
    distinct.set(key, { ...value, materialKinds: (distinct.get(key)?.materialKinds ?? 0) | value.materialKinds });
  }
  return [...distinct.values()].sort((a, b) => compareNode(a.sourceId, b.sourceId) || a.policyVersion - b.policyVersion || compareNode(a.policySha256, b.policySha256));
}
const schema: Record<string, string> = {
  development_contexts: `CREATE TABLE development_contexts(node_id TEXT NOT NULL,development_id TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('release','security','known-security','security-mitigation')),node_ordinal INTEGER NOT NULL CHECK(node_ordinal>0),introduced_generation INTEGER NOT NULL CHECK(introduced_generation>=0),origin_slot TEXT NOT NULL,origin_development_run_id TEXT NOT NULL,origin_github_run_id TEXT NOT NULL,source_id TEXT NOT NULL,policy_version INTEGER NOT NULL CHECK(policy_version>0),policy_sha256 TEXT NOT NULL,available_at TEXT NOT NULL,payload_bytes INTEGER NOT NULL CHECK(payload_bytes>0),payload_sha256 TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(node_id,development_id),UNIQUE(node_id,node_ordinal))`,
  context_frozen_prefix: `CREATE INDEX context_frozen_prefix ON development_contexts(node_id,introduced_generation,node_ordinal)`,
  context_node_heads: `CREATE TABLE context_node_heads(node_id TEXT PRIMARY KEY,distinct_count INTEGER NOT NULL CHECK(distinct_count>=0),total_payload_bytes INTEGER NOT NULL CHECK(total_payload_bytes>=0),tail_ordinal INTEGER NOT NULL CHECK(tail_ordinal>=0),set_digest TEXT NOT NULL)`,
  context_pending_runs: `CREATE TABLE context_pending_runs(slot TEXT PRIMARY KEY,enqueue_generation INTEGER NOT NULL CHECK(enqueue_generation>0))`,
  context_index_state: `CREATE TABLE context_index_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),schema_version INTEGER NOT NULL CHECK(schema_version=2),epoch TEXT NOT NULL,phase TEXT NOT NULL CHECK(phase IN ('building','ready','invalid')),dirty INTEGER NOT NULL CHECK(dirty IN (0,1)),legacy_end_slot TEXT,legacy_cursor TEXT,raw_generation INTEGER NOT NULL CHECK(raw_generation>=0),indexed_generation INTEGER NOT NULL CHECK(indexed_generation>=0))`,
};
schema.context_raw_insert = `CREATE TRIGGER context_raw_insert AFTER INSERT ON development_runs WHEN EXISTS(SELECT 1 FROM context_index_state WHERE singleton=1) BEGIN UPDATE context_index_state SET raw_generation=raw_generation+1 WHERE singleton=1; INSERT INTO context_pending_runs(slot,enqueue_generation) SELECT NEW.slot,raw_generation FROM context_index_state WHERE singleton=1; END`;
for (const action of ["UPDATE", "DELETE"]) schema[`context_raw_${action.toLowerCase()}`] = `CREATE TRIGGER context_raw_${action.toLowerCase()} AFTER ${action} ON development_runs BEGIN UPDATE context_index_state SET phase='invalid',dirty=1 WHERE singleton=1; END`;
for (const table of ["development_contexts", "context_node_heads", "context_pending_runs"]) for (const action of ["INSERT", "UPDATE", "DELETE"]) {
  const name = `context_guard_${table}_${action.toLowerCase()}`;
  schema[name] = `CREATE TRIGGER ${name} AFTER ${action} ON ${table} BEGIN UPDATE context_index_state SET dirty=1 WHERE singleton=1; END`;
}
const schemaDigest = githubDigest({ schema, routeColumns: developmentRouteColumns });
const headerColumns = "node_id,development_id,kind,node_ordinal,introduced_generation,origin_slot,origin_development_run_id,origin_github_run_id,source_id,policy_version,policy_sha256,available_at,payload_bytes,payload_sha256";
const leaf = (row: Row) => Object.fromEntries(headerColumns.split(",").map((name) => [name, row[name]]));
const fold = (rows: Row[]) => rows.reduce((digest, row) => githubDigest([digest, leaf(row)]), emptyDigest);
function contexts(run: DevelopmentRun, github: GitHubRun): Context[] {
  const release = run.developments.map((development): Context => ({ kind: "release", development,
    origin: { evidence: run.evidence.find((entry) => entry.observationId === development.observationId)!, githubRunId: github.id, slot: run.slot,
      githubConfiguration: github.configuration, configuration: run.configuration, availableAtUtc: run.availableAtUtc } }));
  const security = (run.security?.evidence ?? []).flatMap((evidence): Context[] => {
    const origin = { evidence, githubRunId: github.id, developmentRunId: run.id, slot: run.slot, configuration: github.configuration, developmentConfiguration: run.configuration, availableAtUtc: run.availableAtUtc };
    const receipt = run.security!.assessments.find((entry) => entry.evidenceId === evidence.observationId);
    const projection = receipt ? projectMitigation(evidence, run.security!.history, receipt) : null;
    return [{ kind: "known-security", origin }, ...(run.security?.developments ?? []).filter((entry) => entry.observationId === evidence.observationId).map((development) => ({ kind: "security" as const, origin, development })),
      ...(projection ? [{ kind: "security-mitigation" as const, projection, origin, receiptSha256: githubDigest(receipt) }] : [])];
  });
  if (release.some((entry) => !entry.origin.evidence)) throw new Error("github-development-history-unavailable");
  return [...release, ...security];
}
const contextId = (entry: Context) => githubDigest([entry.kind, entry.kind === "known-security" ? entry.origin.evidence.ghsaId : entry.kind === "security-mitigation" ? entry.projection.projectionId : entry.development.developmentId]);

/** Private storage facet of the observation module; no caller-supplied history authority. */
export function createDevelopmentContextIndex(db: DatabaseSync, authorize: (identity: NonNullable<GitHubRun["policy"]>, materialKinds: number) => boolean) {
  function installed() {
    try {
      const marker = db.prepare("SELECT version,digest FROM authorities WHERE id='development-context-index'").get();
      const columns = db.prepare("PRAGMA table_info(development_runs)").all();
      return marker?.version === 2 && marker.digest === schemaDigest && Object.entries(developmentRouteColumns).every(([name, type]) => columns.some((column) => column.name === name && column.type === type)) &&
        Object.entries(schema).every(([name, sql]) => db.prepare("SELECT sql FROM sqlite_schema WHERE name=?").get(name)?.sql === sql) &&
        !!db.prepare("SELECT singleton FROM context_index_state WHERE singleton=1").get();
    } catch { return false; }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!db.prepare("SELECT 1 FROM authorities WHERE id='development-context-index'").get()) {
      const occupied = Object.keys(schema).some((name) => db.prepare("SELECT 1 FROM sqlite_schema WHERE name=?").get(name));
      if (!occupied) {
        for (const sql of Object.values(schema)) db.exec(sql);
        const end = db.prepare("SELECT MAX(slot) AS slot FROM development_runs").get()!.slot ?? null;
        db.prepare("INSERT INTO context_index_state(singleton,schema_version,epoch,phase,dirty,legacy_end_slot,legacy_cursor,raw_generation,indexed_generation) VALUES(1,2,?,?,0,?,NULL,0,0)")
          .run(randomUUID(), end === null ? "ready" : "building", end);
        db.prepare("INSERT INTO authorities(id,version,digest) VALUES('development-context-index',2,?)").run(schemaDigest);
      }
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  const state = () => installed() ? db.prepare("SELECT * FROM context_index_state WHERE singleton=1").get()! : null;
  const ready = () => { const row = state(); return !!row && row.phase === "ready" && row.dirty === 0 && row.raw_generation === row.indexed_generation && !db.prepare("SELECT 1 FROM context_pending_runs LIMIT 1").get(); };
  // Only maintain's synchronous write transaction may read a clean building epoch
  // and then its own guarded index writes. No public read can acquire this lease.
  let maintenanceEpoch: string | null = null;

  function original(slot: string, budget: Budget) {
    const current = state();
    if (!current || current.phase === "invalid" || !(ready() || current.epoch === maintenanceEpoch)) throw new Error("github-development-history-unavailable");
    if (budget.origins.has(slot)) {
      const cached = budget.origins.get(slot);
      if (!cached || developmentDependencies(cached.run).some((entry) => !authorize(entry, entry.materialKinds))) throw new Error("github-development-origin-unavailable");
      return cached;
    }
    registerGitHubOrigin(budget.payloads, slot);
    // A failed origin is an operation-local unknown, not another distinct read per dependent node.
    // Bytes already reserved/read remain charged; the next operation gets a fresh cache.
    budget.origins.set(slot, null);
    const header = readGitHubMetadata(db, budget.payloads, "SELECT source_id,policy_version,policy_sha256,available_at,payload_bytes,payload_sha256,material_kinds,length(CAST(dependency_policies AS BLOB)) AS dependency_bytes,length(CAST(payload AS BLOB)) AS bytes FROM development_runs WHERE slot=?",
      ["source_id", "policy_version", "policy_sha256", "available_at", "payload_bytes", "payload_sha256", "material_kinds", "dependency_bytes", "bytes"], [slot])[0];
    const parent = readGitHubMetadata(db, budget.payloads, "SELECT length(CAST(payload AS BLOB)) AS bytes FROM runs WHERE slot=?", ["bytes"], [slot])[0];
    if (!header || !parent || header.payload_bytes === null || header.payload_bytes !== header.bytes || !header.payload_sha256 || Number(header.bytes) > 32 * 1024 * 1024 || Number(parent.bytes) > 1024 * 1024 ||
      typeof header.material_kinds !== "number" || !Number.isInteger(header.material_kinds) || header.material_kinds < 0 || header.material_kinds > 3 || header.dependency_bytes === null || Number(header.dependency_bytes) > 256 * 1024) throw new Error("github-development-origin-unavailable");
    const dependencyRaw = String(readGitHubMetadata(db, budget.payloads, "SELECT dependency_policies FROM development_runs WHERE slot=?", ["dependency_policies"], [slot], 1, 6 * 256 * 1024 + 64)[0]!.dependency_policies);
    const materialKinds = header.material_kinds;
    const dependencies = DependencySchema.array().max(1001).parse(JSON.parse(dependencyRaw));
    if (JSON.stringify(dependencies) !== dependencyRaw || dependencies.some((entry, i) => i > 0 &&
      (compareNode(dependencies[i - 1]!.sourceId, entry.sourceId) || dependencies[i - 1]!.policyVersion - entry.policyVersion || compareNode(dependencies[i - 1]!.policySha256, entry.policySha256)) >= 0) ||
      dependencies.some((entry) => !authorize(entry, entry.materialKinds)) ||
      header.source_id !== null && !dependencies.some((entry) => entry.sourceId === header.source_id && entry.policyVersion === header.policy_version && entry.policySha256 === header.policy_sha256 && (entry.materialKinds & materialKinds) === materialKinds)) throw new Error("github-development-history-unavailable");
    for (const entry of dependencies) (budget.dependencies ??= new Map()).set(JSON.stringify(entry), entry);
    const raw = readGitHubPayload(budget.payloads, "development_runs", slot, Number(header.bytes), () => String(db.prepare("SELECT payload FROM development_runs WHERE slot=?").get(slot)!.payload));
    if (raw.sha256 !== header.payload_sha256) throw new Error("github-development-origin-unavailable");
    const run = DevelopmentRunSchema.parse(JSON.parse(raw.raw));
    const parentRaw = readGitHubPayload(budget.payloads, "runs", slot, Number(parent.bytes), () => String(db.prepare("SELECT payload FROM runs WHERE slot=?").get(slot)!.payload));
    const github = GitHubRunSchema.parse(JSON.parse(parentRaw.raw));
    const { id, ...metadata } = run;
    if (id !== githubDigest(metadata) || run.githubRunId !== github.id || run.slot !== github.scheduledAtUtc || run.availableAtUtc !== github.availableAtUtc ||
      github.id !== githubDigest([github.scheduledAtUtc, github.configuration, github.policy]) ||
      (run.policy?.sourceId ?? null) !== header.source_id || (run.policy?.policyVersion ?? null) !== header.policy_version || (run.policy?.policySha256 ?? null) !== header.policy_sha256 ||
      run.availableAtUtc !== header.available_at || developmentMaterialKinds(run) !== header.material_kinds || JSON.stringify(developmentDependencies(run)) !== dependencyRaw ||
      !run.policy && (run.evidence.length || run.assessments.length || run.developments.length || run.security)) throw new Error("github-development-origin-unavailable");
    const result = { run, github }; budget.origins.set(slot, result); return result;
  }
  function index(slot: string, generation: number, budget: Budget) {
    const { run, github } = original(slot, budget);
    for (const entry of contexts(run, github)) {
      const node = entry.origin.evidence.nodeId, identity = contextId(entry);
      if (db.prepare("SELECT 1 FROM development_contexts WHERE node_id=? AND development_id=?").get(node, identity)) continue;
      const payload = JSON.stringify(entry), bytes = Buffer.byteLength(payload);
      if (bytes > 65536) throw new Error("github-development-context-byte-limit");
      const head = db.prepare("SELECT * FROM context_node_heads WHERE node_id=?").get(node);
      const ordinal = Number(head?.tail_ordinal ?? 0) + 1;
      const row: Row = { node_id: node, development_id: identity, kind: entry.kind, node_ordinal: ordinal, introduced_generation: generation, origin_slot: slot,
        origin_development_run_id: run.id, origin_github_run_id: github.id, source_id: run.policy!.sourceId, policy_version: run.policy!.policyVersion, policy_sha256: run.policy!.policySha256,
        available_at: run.availableAtUtc, payload_bytes: bytes, payload_sha256: hash(payload) };
      const expected = { count: Number(head?.distinct_count ?? 0) + 1, bytes: Number(head?.total_payload_bytes ?? 0) + bytes, digest: githubDigest([head?.set_digest ?? emptyDigest, leaf(row)]) };
      db.prepare(`INSERT INTO development_contexts(${headerColumns},payload) VALUES(${Array(15).fill("?").join(",")})`).run(...headerColumns.split(",").map((name) => row[name]!), payload);
      const actual = db.prepare(`SELECT ${headerColumns} FROM development_contexts WHERE node_id=? AND node_ordinal=?`).get(node, ordinal)!;
      if (githubDigest(leaf(actual)) !== githubDigest(leaf(row))) throw new Error("github-development-index-mismatch");
      db.prepare("INSERT INTO context_node_heads(node_id,distinct_count,total_payload_bytes,tail_ordinal,set_digest) VALUES(?,?,?,?,?) ON CONFLICT(node_id) DO UPDATE SET distinct_count=excluded.distinct_count,total_payload_bytes=excluded.total_payload_bytes,tail_ordinal=excluded.tail_ordinal,set_digest=excluded.set_digest")
        .run(node, expected.count, expected.bytes, ordinal, expected.digest);
      const written = db.prepare("SELECT * FROM context_node_heads WHERE node_id=?").get(node)!;
      if (written.distinct_count !== expected.count || written.total_payload_bytes !== expected.bytes || written.set_digest !== expected.digest || written.tail_ordinal !== ordinal) throw new Error("github-development-index-mismatch");
    }
  }
  function maintain() {
    db.exec("BEGIN IMMEDIATE");
    try {
      const initial = state();
      if (!initial || initial.phase === "invalid" || initial.dirty !== 0) { db.exec("COMMIT"); return; }
      maintenanceEpoch = String(initial.epoch);
      const budget = createBudget();
      const process = (slot: string, generation: number) => {
        db.exec("SAVEPOINT context_slot");
        try { index(slot, generation, budget); db.exec("RELEASE context_slot"); return true; }
        catch { db.exec("ROLLBACK TO context_slot; RELEASE context_slot"); return false; }
      };
      const legacy = initial.phase === "building" ? db.prepare("SELECT slot FROM development_runs WHERE slot > ? AND slot <= ? ORDER BY slot LIMIT 100").all(String(initial.legacy_cursor ?? ""), String(initial.legacy_end_slot)) : [];
      let processed = 0;
      for (const row of legacy) {
        if (!process(String(row.slot), 0)) break;
        db.prepare("UPDATE context_index_state SET legacy_cursor=? WHERE singleton=1").run(row.slot!); processed++;
      }
      const latest = state()!;
      const baselineDone = latest.phase === "ready" || !db.prepare("SELECT 1 FROM development_runs WHERE slot > ? AND slot <= ? LIMIT 1").get(String(latest.legacy_cursor ?? ""), String(latest.legacy_end_slot));
      if (baselineDone) for (const row of db.prepare("SELECT slot,enqueue_generation FROM context_pending_runs ORDER BY enqueue_generation LIMIT ?").all(100 - processed)) {
        if (!process(String(row.slot), Number(row.enqueue_generation))) break;
        db.prepare("DELETE FROM context_pending_runs WHERE slot=?").run(row.slot!);
      }
      const done = baselineDone && !db.prepare("SELECT 1 FROM context_pending_runs LIMIT 1").get();
      db.prepare("UPDATE context_index_state SET phase=?,dirty=0,indexed_generation=CASE WHEN ? THEN raw_generation ELSE indexed_generation END WHERE singleton=1").run(done ? "ready" : "building", Number(done));
      db.exec("COMMIT");
    } catch { db.exec("ROLLBACK"); }
    finally { maintenanceEpoch = null; }
  }
  function committed(slot: string, wasReady: boolean, original: { run: DevelopmentRun; github: GitHubRun }) {
    if (!wasReady || !installed()) return;
    const current = state()!;
    if (current.phase !== "ready") return;
    maintenanceEpoch = String(current.epoch);
    db.exec("SAVEPOINT context_slot");
    try {
      const budget = createBudget();
      budget.payloads.bytes = Buffer.byteLength(JSON.stringify(original.run)) + Buffer.byteLength(JSON.stringify(original.github));
      registerGitHubOrigin(budget.payloads, slot); budget.origins.set(slot, original);
      index(slot, Number(current.raw_generation), budget); db.exec("RELEASE context_slot");
    }
    catch { db.exec("ROLLBACK TO context_slot; RELEASE context_slot; UPDATE context_index_state SET phase='building',dirty=0 WHERE singleton=1"); return; }
    finally { maintenanceEpoch = null; }
    db.prepare("DELETE FROM context_pending_runs WHERE slot=?").run(slot);
    if (db.prepare("SELECT 1 FROM context_pending_runs LIMIT 1").get()) throw new Error("github-development-index-pending");
    db.exec("UPDATE context_index_state SET indexed_generation=raw_generation,dirty=0 WHERE singleton=1");
  }
  function readNodes(nodes: string[], slot: string, frozenAtUtc: string, frozen?: ContextFreeze[], budget: Budget = createBudget()): Map<string, IndexedContext> {
    const result = new Map(nodes.map((node) => [node, { entries: [], unavailable: true, freeze: null } as IndexedContext]));
    if (!ready()) return result;
    const current = state()!;
    let projectionBytes = 0;
    for (const node of [...nodes].sort(compareNode)) {
      try {
        const expected = frozen?.find((entry) => entry.nodeId === node);
        if (frozen && (!expected || expected.epoch !== current.epoch || expected.slot !== slot || expected.frozenAtUtc !== frozenAtUtc)) continue;
        const generation = expected?.generation ?? Number(current.indexed_generation);
        const rows = db.prepare(`SELECT ${headerColumns},length(CAST(payload AS BLOB)) AS actual_bytes FROM development_contexts WHERE node_id=? AND introduced_generation<=? ORDER BY node_ordinal LIMIT 1001`).all(node, generation);
        if (rows.length > 1000 || rows.some((row, i) => row.node_ordinal !== i + 1 || row.payload_bytes !== row.actual_bytes || Number(row.actual_bytes) > 65536)) continue;
        const count = rows.length, bytes = rows.reduce((sum, row) => sum + Number(row.payload_bytes), 0), digest = fold(rows);
        if (!expected) {
          const head = db.prepare("SELECT * FROM context_node_heads WHERE node_id=?").get(node);
          if (head ? head.distinct_count !== count || head.total_payload_bytes !== bytes || head.set_digest !== digest || head.tail_ordinal !== count : count !== 0) continue;
        }
        const used = rows.filter((row) => String(row.origin_slot) < slot && String(row.available_at) <= frozenAtUtc);
        const freeze = { epoch: String(current.epoch), generation, slot, frozenAtUtc, nodeId: node, count, bytes, digest, usedCount: used.length, usedDigest: fold(used) };
        if (expected && githubDigest(expected) !== githubDigest(freeze) || projectionBytes + bytes > 16 * 1024 * 1024) continue;
        const entries: Context[] = [];
        for (const row of used) {
          if (!authorize({ sourceId: String(row.source_id), policyVersion: Number(row.policy_version), policySha256: String(row.policy_sha256) }, row.kind === "release" ? 1 : 2)) throw new Error("revoked");
          const source = original(String(row.origin_slot), budget);
          if (source.run.id !== row.origin_development_run_id || source.github.id !== row.origin_github_run_id) throw new Error("origin");
          const actual = contexts(source.run, source.github).find((entry) => contextId(entry) === row.development_id && entry.origin.evidence.nodeId === node);
          const raw = String(db.prepare("SELECT payload FROM development_contexts WHERE node_id=? AND development_id=?").get(node, row.development_id!)!.payload);
          if (!actual || hash(raw) !== row.payload_sha256 || JSON.stringify(actual) !== raw) throw new Error("member");
          entries.push(actual);
        }
        projectionBytes += bytes; result.set(node, { entries, freeze, unavailable: false });
      } catch { /* One unavailable complete node never turns into a partial context. */ }
    }
    return result;
  }
  function verify(run: DevelopmentRun, budget: Budget = createBudget()): boolean {
    try {
      const actual = original(run.slot, budget);
      if (githubDigest(actual.run) !== githubDigest(run)) return false;
      const indexed = readNodes(run.contextFreezes.map((entry) => entry.nodeId), run.slot, run.startedAtUtc, run.contextFreezes, budget);
      if ([...indexed.values()].some((entry) => entry.unavailable)) return false;
      for (const receipt of run.assessments) {
        const previous = indexed.get(receipt.contextFreeze.nodeId)?.entries.filter((entry) => entry.kind === "release");
        if (!previous || githubDigest(previous.map((entry) => entry.development)) !== githubDigest(receipt.previous) ||
          githubDigest(previous.map((entry) => entry.origin)) !== githubDigest(receipt.previousEvidence)) return false;
      }
      if (run.security) {
        const unavailable = new Set(run.security.history.unavailableNodeIds);
        if (unavailable.size !== run.security.history.unavailableNodeIds.length || [...unavailable].some((nodeId) =>
          !actual.github.observations.some((entry) => entry.nodeId === nodeId && entry.reason === null) ||
          run.security!.history.entries.some((entry) => entry.evidence.nodeId === nodeId) || run.security!.history.materials.some((entry) => entry.origin.evidence.nodeId === nodeId) ||
          run.security!.history.mitigations.some((entry) => entry.origin.evidence.nodeId === nodeId) ||
          run.security!.developments.some((entry) => entry.nodeId === nodeId) || run.security!.assessments.some((receipt) => run.security!.evidence.some((entry) => entry.observationId === receipt.evidenceId && entry.nodeId === nodeId)))) return false;
        // All frozen prefixes above were still checked, including unavailable
        // citation groups. Only the complete security projection is omitted.
        const securityContexts = [...indexed.entries()].filter(([nodeId]) => !unavailable.has(nodeId)).map(([, context]) => context);
        const known = securityContexts.flatMap((context) => context.entries.filter((entry) => entry.kind === "known-security").map((entry) => entry.origin));
        const materials = securityContexts.flatMap((context) => context.entries.filter((entry) => entry.kind === "security").map(({ development, origin }) => ({ development, origin })));
        const mitigations = securityContexts.flatMap((context) => context.entries.filter((entry) => entry.kind === "security-mitigation").map(({ projection, origin, receiptSha256 }) => ({ projection, origin, receiptSha256 })));
        if (githubDigest(known) !== githubDigest(run.security.history.entries) || githubDigest(materials) !== githubDigest(run.security.history.materials) || githubDigest(mitigations) !== githubDigest(run.security.history.mitigations)) return false;
        for (const receipt of run.security.assessments) {
          const evidence = run.security.evidence.find((entry) => entry.observationId === receipt.evidenceId);
          if (!evidence || githubDigest(materials.filter((entry) => entry.origin.evidence.nodeId === evidence.nodeId && entry.origin.evidence.ghsaId === evidence.ghsaId)) !== githubDigest(receipt.previous) ||
            githubDigest(indexed.get(evidence.nodeId)?.freeze) !== githubDigest(receipt.contextFreeze)) return false;
        }
      }
      return true;
    } catch { return false; }
  }
  function snapshotRun(slot: string, budget: Budget = createBudget()): DevelopmentRun | null {
    try {
      const { run } = original(slot, budget);
      return verify(run, budget) ? run : null;
    } catch { return null; }
  }
  function withHistoryRead<T>(use: (reader: { verify(run: DevelopmentRun): boolean; snapshotRun(slot: string): DevelopmentRun | null; payloads: GitHubReadBudget }) => T): T {
    const budget: Budget = { ...createBudget(), dependencies: new Map() };
    const initialState = githubDigest(state());
    let live = true;
    try {
      const result = use({ verify: (run) => live && verify(run, budget), snapshotRun: (slot) => live ? snapshotRun(slot, budget) : null, payloads: budget.payloads });
      if (githubDigest(state()) !== initialState || [...budget.dependencies!.values()].some((entry) => !authorize(entry, entry.materialKinds))) throw new Error("github-development-history-unavailable");
      return result;
    } finally { live = false; budget.origins.clear(); budget.dependencies!.clear(); finishGitHubReadBudget(budget.payloads); }
  }
  return { ready, intact: installed, maintain, committed, readNodes, verify, snapshotRun, withHistoryRead };
}
function compareNode(a: string, b: string) {
  const left = Array.from(a), right = Array.from(b);
  for (let i = 0; i < Math.min(left.length, right.length); i++) { const delta = left[i]!.codePointAt(0)! - right[i]!.codePointAt(0)!; if (delta) return delta; }
  return left.length - right.length;
}
