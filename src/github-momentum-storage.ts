import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { githubDigest } from "./github-adapter.ts";
import { GitHubPolicyIdentitySchema, GitHubRunSchema, type GitHubRun, type DevelopmentConfiguration } from "./github-contracts.ts";
import type { DevelopmentRun } from "./github-development-contracts.ts";
import { developmentDependencies } from "./github-context-index.ts";
import { MomentumPointSchema, MomentumCapsuleSchema, MomentumSnapshotSchema, type MomentumPoint, type MomentumCapsule, type MomentumSnapshot } from "./github-momentum-contracts.ts";
import { capsuleDevelopment, evaluateMomentum, momentumNodeOrder, momentumRules, reconstructMomentum } from "./github-momentum.ts";
import { createGitHubReadBudget, decodeGitHubPayload, finishGitHubReadBudget, readGitHubMetadata, readGitHubPayload, registerGitHubOrigin, type GitHubReadBudget } from "./github-read-budget.ts";

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");
const empty = githubDigest([]);
const routeColumns = { momentum_policy: "TEXT", momentum_payload_bytes: "INTEGER", momentum_payload_sha256: "TEXT" };
const schema: Record<string, string> = {
  momentum_state: "CREATE TABLE momentum_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),schema_version INTEGER NOT NULL CHECK(schema_version=1),epoch TEXT NOT NULL,phase TEXT NOT NULL CHECK(phase IN ('ready','dirty','invalid')),generation INTEGER NOT NULL,installed_at TEXT NOT NULL,legacy_unknown INTEGER NOT NULL CHECK(legacy_unknown IN (0,1)),frame_count INTEGER NOT NULL,frame_digest TEXT NOT NULL)",
  momentum_pending: "CREATE TABLE momentum_pending(slot TEXT PRIMARY KEY)",
  momentum_frames: "CREATE TABLE momentum_frames(slot TEXT PRIMARY KEY,generation INTEGER NOT NULL UNIQUE,point_id TEXT NOT NULL UNIQUE,available_at TEXT NOT NULL,github_run_id TEXT NOT NULL,dependency_policies TEXT NOT NULL,payload_bytes INTEGER NOT NULL,payload_sha256 TEXT NOT NULL,payload TEXT NOT NULL,step_count INTEGER NOT NULL,step_digest TEXT NOT NULL)",
  momentum_steps: "CREATE TABLE momentum_steps(node_id TEXT NOT NULL,generation INTEGER NOT NULL,slot TEXT NOT NULL,step_id TEXT NOT NULL UNIQUE,ordinal INTEGER NOT NULL,prior_digest TEXT NOT NULL,payload_bytes INTEGER NOT NULL,payload_sha256 TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(node_id,generation),UNIQUE(node_id,ordinal))",
  momentum_heads: "CREATE TABLE momentum_heads(node_id TEXT PRIMARY KEY,first_generation INTEGER NOT NULL,last_generation INTEGER NOT NULL,step_count INTEGER NOT NULL,step_digest TEXT NOT NULL,last_step_id TEXT NOT NULL)",
  momentum_capsules: "CREATE TABLE momentum_capsules(id TEXT PRIMARY KEY,node_id TEXT NOT NULL,onset_observation_id TEXT NOT NULL,origin_generation INTEGER NOT NULL,dependency_policies TEXT NOT NULL,payload_bytes INTEGER NOT NULL,payload_sha256 TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(node_id,onset_observation_id))",
  momentum_frames_available: "CREATE INDEX momentum_frames_available ON momentum_frames(available_at,generation)",
};
schema.momentum_raw_insert = "CREATE TRIGGER momentum_raw_insert AFTER INSERT ON runs BEGIN INSERT INTO momentum_pending(slot) VALUES(NEW.slot); UPDATE momentum_state SET phase='dirty' WHERE singleton=1; END";
for (const action of ["UPDATE", "DELETE"]) schema[`momentum_raw_${action.toLowerCase()}`] = `CREATE TRIGGER momentum_raw_${action.toLowerCase()} AFTER ${action} ON runs BEGIN UPDATE momentum_state SET phase='invalid' WHERE singleton=1; END`;
for (const table of ["momentum_state", "momentum_pending", "momentum_frames", "momentum_steps", "momentum_heads", "momentum_capsules"]) {
  for (const action of ["INSERT", "UPDATE", "DELETE"]) {
    const name = `${table}_${action.toLowerCase()}_guard`;
    schema[name] = `CREATE TRIGGER ${name} BEFORE ${action} ON ${table} WHEN momentum_write_lease()=0 BEGIN SELECT RAISE(ABORT,'immutable momentum authority'); END`;
  }
}
const schemaHash = githubDigest({ schema, routeColumns });
const DependencySchema = GitHubPolicyIdentitySchema.extend({ materialKinds: z.number().int().min(0).max(3), momentum: z.boolean() });
type Dependency = z.infer<typeof DependencySchema>;
const sha = z.string().regex(/^[a-f0-9]{64}$/), positive = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const StepSchema = z.strictObject({ schemaVersion: z.literal(1), nodeId: z.string().min(1).max(200), generation: positive, slot: z.iso.datetime({ precision: 3, offset: false }),
  pointId: sha, previousStepId: sha.nullable(), onsetObservationId: sha.nullable(), capsuleId: sha.nullable(), startupPointIds: sha.array().max(28), resetPointIds: sha.array().max(28),
  startupUnknown: z.boolean(), status: z.enum(["extreme", "non-extreme", "unknown"]), reasons: z.array(z.string().min(1).max(100)).max(500) });
const ExpectedSchema = z.strictObject({ nodeId: z.string().min(1).max(200), stepId: sha, ordinal: positive, priorDigest: sha, newDigest: sha });
const FrameSchema = z.strictObject({ point: MomentumPointSchema, expected: ExpectedSchema.array().max(50) });
type Step = z.infer<typeof StepSchema>;
type Expected = z.infer<typeof ExpectedSchema>;
type Frame = z.infer<typeof FrameSchema>;
type Budget = GitHubReadBudget;
const budget = createGitHubReadBudget;
function canonicalDependencies(entries: Dependency[]): Dependency[] {
  const distinct = new Map<string, Dependency>();
  for (const entry of entries) { const key = githubDigest([entry.sourceId, entry.policyVersion, entry.policySha256]), old = distinct.get(key);
    distinct.set(key, { ...entry, materialKinds: entry.materialKinds | (old?.materialKinds ?? 0), momentum: entry.momentum || !!old?.momentum }); }
  return [...distinct.values()].sort((a, b) => momentumNodeOrder(a.sourceId, b.sourceId) || a.policyVersion - b.policyVersion || momentumNodeOrder(a.policySha256, b.policySha256));
}
function dependencies(point: MomentumPoint, development?: DevelopmentRun|null): Dependency[] {
  const entries: Dependency[] = [...point.candidates.flatMap((entry) => [entry.current, entry.historical].flatMap((origin) => origin ? [{ ...origin.policy, materialKinds: 0, momentum: true }] : [])),
    ...(point.policy ? [{ ...point.policy, materialKinds: 0, momentum: false }] : []),
    ...(development ? developmentDependencies(development).map((entry) => ({ ...entry, momentum: false })) : [])];
  return canonicalDependencies(entries);
}

/** Private observation storage. Only actual hourly commits can advance it;
 * neither a snapshot nor an external caller supplies an episode state. */
export function createMomentumStorage(db: DatabaseSync, authorize: (dependency: Dependency) => boolean, clock: () => string) {
  let lease = false;
  let writeBudget: Budget | null = null;
  const checkedFrames = new WeakMap<Budget, Map<string, Frame>>();
  db.function("momentum_write_lease", () => Number(lease));
  function installed(shared: Budget, refresh = false) {
    const marker = readGitHubMetadata(db, shared, "SELECT version,digest FROM authorities WHERE id='momentum-storage'", ["version", "digest"], [], 1, 4096, refresh)[0];
    if (marker?.version !== 1 || marker.digest !== schemaHash) return false;
    const names = Object.keys(schema);
    const objects = readGitHubMetadata(db, shared, `SELECT name,sql FROM sqlite_master WHERE name IN (${names.map(() => "?").join(",")}) ORDER BY name`, ["name", "sql"], names, names.length, 4096, refresh);
    const columns = readGitHubMetadata(db, shared, "SELECT name,type,hidden FROM pragma_table_xinfo('runs') LIMIT 64", ["name", "type", "hidden"], [], 64, 4096, refresh);
    return Object.entries(schema).every(([name, sql]) => objects.some((entry) => entry.name === name && entry.sql === sql)) &&
      Object.entries(routeColumns).every(([name, type]) => columns.some((entry) => entry.name === name && entry.type === type && entry.hidden === 0));
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    lease = true;
    const shared = budget();
    const marker = readGitHubMetadata(db, shared, "SELECT version,digest FROM authorities WHERE id='momentum-storage'", ["version", "digest"])[0];
    const objects = readGitHubMetadata(db, shared, "SELECT name FROM sqlite_master WHERE name LIKE 'momentum_%' LIMIT 1", ["name"]);
    const columns = readGitHubMetadata(db, shared, "SELECT name FROM pragma_table_xinfo('runs') LIMIT 64", ["name"], [], 64).some((entry) => Object.hasOwn(routeColumns, String(entry.name)));
    if (!marker && !objects.length && !columns) {
      const legacy = readGitHubMetadata(db, shared, "SELECT slot FROM runs LIMIT 1", ["slot"])[0];
      for (const [name, type] of Object.entries(routeColumns)) db.exec(`ALTER TABLE runs ADD COLUMN ${name} ${type}`);
      for (const sql of Object.values(schema)) db.exec(sql);
      db.prepare("INSERT INTO momentum_state(singleton,schema_version,epoch,phase,generation,installed_at,legacy_unknown,frame_count,frame_digest) VALUES(1,1,?,'ready',0,?,?,0,?)")
        .run(randomUUID(), clock(), Number(!!legacy), empty);
      db.prepare("INSERT INTO authorities(id,version,digest) VALUES('momentum-storage',1,?)").run(schemaHash);
    }
    if (!installed(shared, true) || !readGitHubMetadata(db, shared, "SELECT singleton FROM momentum_state WHERE singleton=1", ["singleton"])[0]) {
      // An existing but unsupported momentum authority is unavailable, not a
      // new empty installation. Roll back without hiding other database errors
      // so independent ordinary reads can still use their original store.
      db.exec("ROLLBACK");
      return null;
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; } finally { lease = false; }
  function state(shared: Budget, refresh = false) {
    if (!installed(shared, refresh)) throw new Error("github-momentum-history-invalid");
    const row = readGitHubMetadata(db, shared, "SELECT singleton,schema_version,epoch,phase,generation,installed_at,legacy_unknown,frame_count,frame_digest FROM momentum_state WHERE singleton=1",
      ["singleton", "schema_version", "epoch", "phase", "generation", "installed_at", "legacy_unknown", "frame_count", "frame_digest"], [], 1, 4096, refresh)[0];
    if (!row || row.phase !== "ready" && !lease) throw new Error("github-momentum-history-invalid");
    // Before acquiring the private write lease, and again at the final fresh
    // check, no pending work may exist. Only the intervening transaction may
    // see its own newly inserted run's pending row; it deletes only that slot.
    if ((!lease || refresh) && readGitHubMetadata(db, shared, "SELECT slot FROM momentum_pending LIMIT 1", ["slot"], [], 1, 4096, refresh).length) {
      throw new Error("github-momentum-history-invalid");
    }
    return row;
  }
  function permit(raw: unknown, shared?: Budget) {
    if (typeof raw !== "string" || Buffer.byteLength(raw) > 262144) throw new Error("github-momentum-header-invalid");
    const entries = DependencySchema.array().max(1001).parse(JSON.parse(raw));
    if (JSON.stringify(entries) !== raw || JSON.stringify(canonicalDependencies(entries)) !== raw) throw new Error("github-momentum-header-invalid");
    if (entries.some((entry) => !authorize(entry))) throw new Error("github-momentum-permission-changed");
    for (const entry of entries) shared?.permissions.set(JSON.stringify(entry), () => authorize(entry));
    return entries;
  }
  function dependencyHeader(table: "momentum_frames" | "momentum_capsules", field: "slot" | "id", key: string, shared: Budget) {
    const size = readGitHubMetadata(db, shared, `SELECT length(CAST(dependency_policies AS BLOB)) AS bytes FROM ${table} WHERE ${field}=?`, ["bytes"], [key])[0];
    if (!size || size.bytes === null || Number(size.bytes) > 262144) throw new Error("github-momentum-header-invalid");
    return permit(readGitHubMetadata(db, shared, `SELECT dependency_policies FROM ${table} WHERE ${field}=?`, ["dependency_policies"], [key], 1, 6 * 262144 + 64)[0]!.dependency_policies, shared);
  }
  function payload(table: "momentum_frames"|"momentum_capsules"|"momentum_steps", field: "slot"|"id"|"step_id", key: string, cap: number, shared: Budget): unknown {
    state(shared);
    const header = readGitHubMetadata(db, shared, `SELECT payload_bytes,payload_sha256,length(CAST(payload AS BLOB)) AS actual_bytes${table === "momentum_steps" ? "" : ",length(CAST(dependency_policies AS BLOB)) AS header_bytes"} FROM ${table} WHERE ${field}=?`,
      ["payload_bytes", "payload_sha256", "actual_bytes", ...(table === "momentum_steps" ? [] : ["header_bytes"])], [key])[0];
    if (!header || Number(header.actual_bytes) > cap || header.actual_bytes !== header.payload_bytes || Number(header.header_bytes ?? 0) > 262144) throw new Error("github-momentum-proof-unavailable");
    if (table !== "momentum_steps") dependencyHeader(table, table === "momentum_frames" ? "slot" : "id", key, shared);
    const raw = readGitHubPayload(shared, table, key, Number(header.actual_bytes), () => String(db.prepare(`SELECT payload FROM ${table} WHERE ${field}=?`).get(key)!.payload));
    if (raw.sha256 !== header.payload_sha256) throw new Error("github-momentum-proof-invalid");
    return decodeGitHubPayload(raw);
  }
  function frame(slot: string, shared: Budget): Frame {
    const value = payload("momentum_frames", "slot", slot, 2 * 1024 * 1024, shared);
    const saved = checkedFrames.get(shared)?.get(slot);
    if (saved) return saved; // payload above still checks the current permissions.
    const actual = FrameSchema.parse(value);
    const header = readGitHubMetadata(db, shared, "SELECT slot,generation,point_id,available_at,github_run_id,step_count,step_digest FROM momentum_frames WHERE slot=?",
      ["slot", "generation", "point_id", "available_at", "github_run_id", "step_count", "step_digest"], [slot])[0];
    const nodes = actual.point.candidates.map((entry) => entry.nodeId);
    const { id: pointId, ...pointContent } = actual.point;
    if (!header || !positive.safeParse(header.generation).success || header.slot !== slot || actual.point.slot !== slot || actual.point.id !== header.point_id ||
      pointId !== githubDigest(pointContent) ||
      actual.point.availableAtUtc !== header.available_at || actual.point.githubRunId !== header.github_run_id ||
      Buffer.byteLength(JSON.stringify(actual.point)) > 1024 * 1024 || Buffer.byteLength(JSON.stringify(actual.expected)) > 32768 ||
      actual.expected.length !== header.step_count || githubDigest(actual.expected) !== header.step_digest ||
      nodes.some((node, i) => i > 0 && momentumNodeOrder(nodes[i - 1]!, node) >= 0) || githubDigest(actual.expected.map((entry) => entry.nodeId)) !== githubDigest(nodes)) throw new Error("github-momentum-history-invalid");
    for (const expected of actual.expected) {
      const row = readGitHubMetadata(db, shared, "SELECT node_id,generation,slot,step_id,ordinal,prior_digest FROM momentum_steps WHERE node_id=? AND generation=?",
        ["node_id", "generation", "slot", "step_id", "ordinal", "prior_digest"], [expected.nodeId, Number(header.generation)])[0];
      if (!row || row.node_id !== expected.nodeId || row.generation !== header.generation || row.slot !== slot || row.step_id !== expected.stepId ||
        row.ordinal !== expected.ordinal || row.prior_digest !== expected.priorDigest || expected.newDigest !== githubDigest([expected.priorDigest, expected.stepId]) ||
        expected.ordinal === 1 && expected.priorDigest !== empty) throw new Error("github-momentum-history-invalid");
    }
    if (!checkedFrames.has(shared)) checkedFrames.set(shared, new Map());
    checkedFrames.get(shared)!.set(slot, actual);
    return actual;
  }
  function parent(slot: string, shared: Budget, momentum: boolean): GitHubRun {
    state(shared);
    registerGitHubOrigin(shared, slot);
    const header = readGitHubMetadata(db, shared, "SELECT momentum_payload_bytes,momentum_payload_sha256,length(CAST(momentum_policy AS BLOB)) AS header_bytes,length(CAST(payload AS BLOB)) AS actual_bytes FROM runs WHERE slot=?",
      ["momentum_payload_bytes", "momentum_payload_sha256", "header_bytes", "actual_bytes"], [slot])[0];
    if (!header || header.header_bytes === null || Number(header.header_bytes) > 1024 || Number(header.actual_bytes) > 1024 * 1024 || header.actual_bytes !== header.momentum_payload_bytes) throw new Error("github-momentum-proof-unavailable");
    const routeRaw = readGitHubMetadata(db, shared, "SELECT momentum_policy FROM runs WHERE slot=?", ["momentum_policy"], [slot], 1, 6 * 1024 + 64)[0]!.momentum_policy;
    if (typeof routeRaw !== "string") throw new Error("github-momentum-proof-unavailable");
    const route = z.strictObject({ schemaVersion: z.literal(1), policy: GitHubPolicyIdentitySchema.nullable(), configurationSha256: z.string().regex(/^[a-f0-9]{64}$/) }).parse(JSON.parse(routeRaw));
    if (route.policy && !authorize({ ...route.policy, materialKinds: 0, momentum })) throw new Error("github-momentum-permission-changed");
    if (route.policy) { const dependency = { ...route.policy, materialKinds: 0, momentum }; shared.permissions.set(JSON.stringify(dependency), () => authorize(dependency)); }
    const raw = readGitHubPayload(shared, "runs", slot, Number(header.actual_bytes), () => String(db.prepare("SELECT payload FROM runs WHERE slot=?").get(slot)!.payload));
    if (raw.sha256 !== header.momentum_payload_sha256) throw new Error("github-momentum-proof-invalid");
    const run = GitHubRunSchema.parse(decodeGitHubPayload(raw));
    if (run.scheduledAtUtc !== slot || githubDigest(run.policy) !== githubDigest(route.policy) || run.configurationSha256 !== route.configurationSha256 ||
      run.configurationSha256 !== githubDigest(run.configuration) || run.id !== githubDigest([slot, run.configuration, run.policy]) || !route.policy && run.observations.length) throw new Error("github-momentum-proof-invalid");
    return run;
  }
  function frameById(id: string, shared: Budget) { const row = readGitHubMetadata(db, shared, "SELECT slot FROM momentum_frames WHERE point_id=?", ["slot"], [id])[0]; if (!row) throw new Error("github-momentum-proof-unavailable"); return frame(String(row.slot), shared); }
  function checkedHead(node: string, shared: Budget) {
    const head = readGitHubMetadata(db, shared, "SELECT node_id,first_generation,last_generation,step_count,step_digest,last_step_id FROM momentum_heads WHERE node_id=?",
      ["node_id", "first_generation", "last_generation", "step_count", "step_digest", "last_step_id"], [node], 1, 1024)[0];
    const columns = ["node_id", "generation", "slot", "step_id", "ordinal", "prior_digest"];
    const latest = readGitHubMetadata(db, shared, "SELECT node_id,generation,slot,step_id,ordinal,prior_digest FROM momentum_steps WHERE node_id=? ORDER BY generation DESC LIMIT 1", columns, [node])[0];
    if (!head && !latest) return null;
    const first = readGitHubMetadata(db, shared, "SELECT node_id,generation,slot,step_id,ordinal,prior_digest FROM momentum_steps WHERE node_id=? ORDER BY generation LIMIT 1", columns, [node])[0];
    if (!head || !latest || !first || [head.first_generation, head.last_generation, head.step_count, first.generation, latest.generation, latest.ordinal].some((value) =>
      typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) ||
      head.node_id !== node || first.node_id !== node || latest.node_id !== node || first.ordinal !== 1 || first.prior_digest !== empty ||
      Number(first.generation) > Number(latest.generation) || String(first.slot) > String(latest.slot) || Number(latest.generation) > Number(state(shared).generation) ||
      Number(latest.ordinal) > Number(latest.generation) - Number(first.generation) + 1 ||
      head.first_generation !== first.generation || head.last_generation !== latest.generation || head.step_count !== latest.ordinal || head.last_step_id !== latest.step_id ||
      head.step_digest !== githubDigest([latest.prior_digest, latest.step_id])) throw new Error("github-momentum-history-invalid");
    return head;
  }
  function currentStep(node: string, generation: number, shared: Budget): Step|null {
    const row = readGitHubMetadata(db, shared, "SELECT step_id,slot,generation,ordinal,prior_digest FROM momentum_steps WHERE node_id=? AND generation<=? ORDER BY generation DESC LIMIT 1", ["step_id", "slot", "generation", "ordinal", "prior_digest"], [node, generation])[0];
    if (!row) return null;
    const actual = frame(String(row.slot), shared), expected = actual.expected.find((entry) => entry.nodeId === node);
    if (!expected || expected.stepId !== row.step_id || expected.ordinal !== row.ordinal || expected.priorDigest !== row.prior_digest) throw new Error("github-momentum-history-invalid");
    const value = payload("momentum_steps", "step_id", String(row.step_id), 65536, shared);
    StepSchema.parse(value);
    // Validate strictly without changing the historical object's property
    // order, which is part of its already committed content digest.
    const step = value as Step;
    if (githubDigest(step) !== row.step_id || step.nodeId !== node || step.pointId !== actual.point.id || step.generation !== row.generation || step.slot !== row.slot ||
      (expected.ordinal === 1) !== (step.previousStepId === null)) throw new Error("github-momentum-history-invalid");
    return step;
  }
  function makePoint(run: GitHubRun, config: DevelopmentConfiguration|null, development: DevelopmentRun|null): MomentumPoint {
    const shared = writeBudget ?? budget(), target = Date.parse(run.availableAtUtc) - 86400000;
    state(shared, true);
    const previous = readGitHubMetadata(db, shared, "SELECT slot FROM momentum_frames WHERE slot>=? AND slot<=? ORDER BY slot LIMIT 6", ["slot"],
      [new Date(target - 7200000).toISOString(), new Date(target + 7200000).toISOString()], 6).map((row) => frame(String(row.slot), shared).point);
    const enabled = config?.momentum === true && !!run.policy && authorize({ ...run.policy, materialKinds: 0, momentum: true });
    const origin = development ? { slot: development.slot, developmentRunId: development.id, availableAtUtc: development.availableAtUtc, configuration: development.configuration, policy: development.policy } : null;
    const security: MomentumPoint["security"] = !config?.advisories ? { mode: "disabled", origin } : !development?.security ? { mode: "unavailable", origin, reason: "missing-run" } :
      { mode: "observed", origin: origin!, nodes: [...run.observations].sort((a, b) => momentumNodeOrder(a.nodeId, b.nodeId)).map((entry) => ({ nodeId: entry.nodeId,
        risks: development.security!.risks.filter((risk) => risk.nodeId === entry.nodeId), historyUnavailable: development.security!.history.unavailableNodeIds.includes(entry.nodeId) })) };
    const metadata = { schemaVersion: 1 as const, slot: run.scheduledAtUtc, cutoffUtc: run.availableAtUtc, availableAtUtc: run.availableAtUtc, githubRunId: run.id,
      configuration: run.configuration, policy: run.policy, developmentConfiguration: config, rulesVersion: momentumRules.version,
      sampling: { observationRules: "observer-github-observations-v1" as const, queries: run.configuration.queries, candidateLimit: run.limits.candidateLimit, currentToleranceMinutes: 15 as const, historicalToleranceMinutes: 60 as const },
      runReasons: run.reasons, queries: run.queries, security,
      candidates: [...run.observations].sort((a, b) => momentumNodeOrder(a.nodeId, b.nodeId)).map((observation) => {
        const historical = enabled ? previous.flatMap((point) => point.candidates.filter((entry) => entry.nodeId === observation.nodeId).flatMap((entry) => entry.current ? [entry.current] : []))
          .filter((entry) => entry.observation.reason === null && Math.abs(Date.parse(entry.observation.observedAtUtc) - target) <= 3600000 && entry.observation.observedAtUtc < observation.observedAtUtc &&
            githubDigest(entry.configuration) === run.configurationSha256 && githubDigest(entry.policy) === githubDigest(run.policy))
          .sort((a, b) => Math.abs(Date.parse(a.observation.observedAtUtc) - target) - Math.abs(Date.parse(b.observation.observedAtUtc) - target) || a.observation.observedAtUtc.localeCompare(b.observation.observedAtUtc) || a.observation.id.localeCompare(b.observation.id))[0] ?? null : null;
        return { nodeId: observation.nodeId, status: !enabled ? "missing" as const : observation.reason ? "quarantined" as const : historical ? "measured" as const : "cold-start" as const,
          current: enabled ? { slot: run.scheduledAtUtc, githubRunId: run.id, configuration: run.configuration, policy: run.policy!, observation } : null, historical,
          reason: observation.reason ?? (!enabled ? "github-current-missing" as const : null) };
      }) };
    return MomentumPointSchema.parse({ ...metadata, id: githubDigest(metadata) });
  }
  function commit(point: MomentumPoint, development: DevelopmentRun|null) {
    const shared = writeBudget ?? budget();
    const before = state(shared), generation = Number(before.generation) + 1, expected: Expected[] = [];
    const requiredDependencies = JSON.stringify(dependencies(point, development));
    permit(requiredDependencies, shared);
    for (const candidate of point.candidates) {
      const head = checkedHead(candidate.nodeId, shared), previous = currentStep(candidate.nodeId, Number(before.generation), shared);
      if (!!head !== !!previous || head && (head.last_step_id !== githubDigest(previous) || head.step_count === 0)) throw new Error("github-momentum-history-invalid");
      const evaluation = evaluateMomentum(point, candidate.nodeId);
      let startupUnknown = previous?.startupUnknown ?? !!before.legacy_unknown;
      let resourceUnavailable = previous?.reasons.includes("github-momentum-resource-limit") ?? false;
      const startupPointIds = [...(previous?.startupPointIds ?? []), point.id];
      if (startupPointIds.length > 28) startupUnknown = true;
      let capsuleId = previous?.capsuleId ?? null, onsetObservationId = previous?.onsetObservationId ?? null;
      const priorPoint = previous ? frameById(previous.pointId, shared).point : null;
      const priorObservation = priorPoint?.candidates.find((entry) => entry.nodeId === candidate.nodeId)?.current?.observation;
      const elapsed = candidate.current && priorObservation ? Date.parse(candidate.current.observation.observedAtUtc) - Date.parse(priorObservation.observedAtUtc) : 0;
      const contiguous = previous?.generation === Number(before.generation) && elapsed > 0 && elapsed <= 90 * 60000 &&
        !!priorPoint && evaluation.context !== "" && evaluateMomentum(priorPoint, candidate.nodeId).context === evaluation.context;
      const previousReset = contiguous ? previous!.resetPointIds : [];
      const resetPointIds = evaluation.status === "non-extreme" ? [...previousReset, point.id].slice(-28) : [];
      let proof: { kind: "startup" | "reset"; points: MomentumPoint[] } | null = null;
      if (evaluation.status === "extreme" && previousReset.length >= 2) {
        const low = previousReset.map((id) => frameById(id, shared).point);
        const observed = (entry: MomentumPoint) => Date.parse(entry.candidates.find((item) => item.nodeId === candidate.nodeId)!.current!.observation.observedAtUtc);
        if (observed(low.at(-1)!) - observed(low[0]!) >= momentumRules.dayMs) proof = { kind: "reset", points: [...low, point] };
      }
      if (!proof && !capsuleId && !startupUnknown && evaluation.status === "extreme") proof = {
        kind: "startup", points: [...startupPointIds.slice(0, -1).map((id) => frameById(id, shared).point), point] };
      if (proof) {
        const { points, kind } = proof;
        const data = { schemaVersion: 1 as const, nodeId: candidate.nodeId, kind, onsetObservationId: candidate.current!.observation.id, points };
        const required = canonicalDependencies(points.flatMap((item) => {
          if (item.id === point.id) return dependencies(item, development);
          return dependencyHeader("momentum_frames", "slot", item.slot, shared);
        }));
        permit(JSON.stringify(required), shared);
        // Preallocate the whole group using its exact JSON byte count, without
        // building an oversized bank string or truncating any deciding peer.
        const bytes = Buffer.byteLength(JSON.stringify({ ...data, points: [], id: "0".repeat(64) })) +
          points.reduce((sum, item) => sum + Buffer.byteLength(JSON.stringify(item)), 0) + Math.max(0, points.length - 1);
        if (bytes > 8 * 1024 * 1024) { startupUnknown = true; resourceUnavailable = true; }
        else {
          const capsule = MomentumCapsuleSchema.parse({ ...data, id: githubDigest(data) });
          capsuleDevelopment(capsule);
          const raw = JSON.stringify(capsule);
          capsuleId = capsule.id; onsetObservationId = capsule.onsetObservationId; resourceUnavailable = false;
          db.prepare("INSERT INTO momentum_capsules(id,node_id,onset_observation_id,origin_generation,dependency_policies,payload_bytes,payload_sha256,payload) VALUES(?,?,?,?,?,?,?,?)")
            .run(capsule.id, candidate.nodeId, capsule.onsetObservationId, generation, JSON.stringify(required), Buffer.byteLength(raw), hash(raw), raw);
        }
      }
      const step: Step = { schemaVersion: 1, nodeId: candidate.nodeId, generation, slot: point.slot, pointId: point.id, previousStepId: previous ? githubDigest(previous) : null,
        onsetObservationId, capsuleId, startupPointIds: startupUnknown || capsuleId ? [] : startupPointIds, startupUnknown, resetPointIds, status: evaluation.status,
        reasons: [...evaluation.reasons, ...(resourceUnavailable ? ["github-momentum-resource-limit"] : [])] };
      const raw = JSON.stringify(step), stepId = githubDigest(step), ordinal = Number(head?.step_count ?? 0) + 1, priorDigest = String(head?.step_digest ?? empty), newDigest = githubDigest([priorDigest, stepId]);
      db.prepare("INSERT INTO momentum_steps(node_id,generation,slot,step_id,ordinal,prior_digest,payload_bytes,payload_sha256,payload) VALUES(?,?,?,?,?,?,?,?,?)")
        .run(candidate.nodeId, generation, point.slot, stepId, ordinal, priorDigest, Buffer.byteLength(raw), hash(raw), raw);
      db.prepare("INSERT INTO momentum_heads(node_id,first_generation,last_generation,step_count,step_digest,last_step_id) VALUES(?,?,?,?,?,?) ON CONFLICT(node_id) DO UPDATE SET last_generation=excluded.last_generation,step_count=excluded.step_count,step_digest=excluded.step_digest,last_step_id=excluded.last_step_id")
        .run(candidate.nodeId, Number(head?.first_generation ?? generation), generation, ordinal, newDigest, stepId);
      expected.push({ nodeId: candidate.nodeId, stepId, ordinal, priorDigest, newDigest });
    }
    const raw = JSON.stringify({ point, expected });
    if (Buffer.byteLength(raw) > 2 * 1024 * 1024 || Buffer.byteLength(JSON.stringify(point)) > 1024 * 1024) throw new Error("github-momentum-payload-limit");
    db.prepare("INSERT INTO momentum_frames(slot,generation,point_id,available_at,github_run_id,dependency_policies,payload_bytes,payload_sha256,payload,step_count,step_digest) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(point.slot, generation, point.id, point.availableAtUtc, point.githubRunId, requiredDependencies, Buffer.byteLength(raw), hash(raw), raw, expected.length, githubDigest(expected));
    frame(point.slot, shared);
    db.prepare("DELETE FROM momentum_pending WHERE slot=?").run(point.slot);
    db.prepare("UPDATE momentum_state SET phase='ready',generation=?,frame_count=frame_count+1,frame_digest=? WHERE singleton=1").run(generation, githubDigest([before.frame_digest, point.id, githubDigest(expected)]));
  }
  function snapshot(slot: string, cutoffUtc: string, shared = budget()): MomentumSnapshot {
    const currentState = state(shared), row = readGitHubMetadata(db, shared, "SELECT generation FROM momentum_frames WHERE slot=? AND available_at<=?", ["generation"], [slot, cutoffUtc])[0];
    shared.permissions.set("momentum-state", () => githubDigest(state(shared, true)) === githubDigest(currentState));
    if (!row) return { schemaVersion: 1, rulesVersion: momentumRules.version, cutoffUtc, freeze: { epoch: String(currentState.epoch), generation: 0, pointId: null, pointSlot: null }, point: null, nodes: [], capsules: [], developments: [], reasons: ["github-momentum-point-unavailable"] };
    const actual = frame(slot, shared), capsules: MomentumCapsule[] = [], nodes: MomentumSnapshot["nodes"] = [];
    let bankBytes = 2; // The serialized bank's surrounding array brackets.
    for (const candidate of actual.point.candidates) {
      const head = checkedHead(candidate.nodeId, shared);
      if (!head) throw new Error("github-momentum-history-invalid");
      const step = currentStep(candidate.nodeId, Number(row.generation), shared);
      if (!step || step.pointId !== actual.point.id) throw new Error("github-momentum-history-invalid");
      const reasons = [...step.reasons];
      if (step.capsuleId) {
        const capsule = MomentumCapsuleSchema.parse(payload("momentum_capsules", "id", step.capsuleId, 8 * 1024 * 1024, shared));
        if (capsule.nodeId !== candidate.nodeId || capsule.onsetObservationId !== step.onsetObservationId) throw new Error("github-momentum-history-invalid");
        capsuleDevelopment(capsule);
        const bytes = Buffer.byteLength(JSON.stringify(capsule)) + Number(capsules.length > 0);
        if (bankBytes + bytes <= 32 * 1024 * 1024) { bankBytes += bytes; capsules.push(capsule); }
        else if (!reasons.includes("github-momentum-resource-limit")) reasons.push("github-momentum-resource-limit");
      }
      nodes.push({ nodeId: candidate.nodeId, stepId: githubDigest(step), onsetObservationId: step.onsetObservationId, capsuleId: step.capsuleId, status: step.status, reasons });
    }
    const value: MomentumSnapshot = { schemaVersion: 1, rulesVersion: momentumRules.version, cutoffUtc,
      freeze: { epoch: String(currentState.epoch), generation: Number(row.generation), pointId: actual.point.id, pointSlot: slot }, point: actual.point, nodes, capsules, developments: [],
      reasons: nodes.some((node) => node.reasons.includes("github-momentum-resource-limit")) ? ["github-momentum-resource-limit"] : [] };
    value.developments = reconstructMomentum(value); return MomentumSnapshotSchema.parse(value);
  }
  return {
    makePoint,
    write<T>(use: (finalize: () => void) => T): T {
      if (lease) throw new Error("github-momentum-write-reentrant");
      const shared = budget(); state(shared); writeBudget = shared; lease = true;
      try {
        return use(() => {
          // The owning transaction calls this before COMMIT, while a failure
          // can still roll back the raw run and every episode authority row.
          if (state(shared, true).phase !== "ready") throw new Error("github-momentum-history-invalid");
          finishGitHubReadBudget(shared);
        });
      } finally {
        lease = false; writeBudget = null;
        shared.rows.clear(); shared.origins.clear(); shared.permissions.clear(); shared.metadata.clear();
      }
    },
    insertRun(run: GitHubRun) { const raw = JSON.stringify(run); return db.prepare("INSERT OR IGNORE INTO runs(slot,payload,momentum_policy,momentum_payload_bytes,momentum_payload_sha256) VALUES(?,?,?,?,?)")
      .run(run.scheduledAtUtc, raw, JSON.stringify({ schemaVersion: 1, policy: run.policy, configurationSha256: run.configurationSha256 }), Buffer.byteLength(raw), hash(raw)); },
    commit,
    snapshot,
    verify(frozen: MomentumSnapshot, loadDevelopment: (slot: string) => DevelopmentRun|null, shared = budget()): boolean {
      try {
        const reproduced = frozen.freeze.pointSlot ? snapshot(frozen.freeze.pointSlot, frozen.cutoffUtc, shared) : frozen;
        if (githubDigest(reproduced) !== githubDigest(frozen)) return false;
        // Deterministic publication omission never hides an invalid original
        // capsule or a revoked dependency. These full proofs stay inside the
        // shared raw-payload allowance, not in the bounded published bank.
        const proofCapsules = frozen.nodes.flatMap((node) => node.capsuleId ? [MomentumCapsuleSchema.parse(payload("momentum_capsules", "id", node.capsuleId, 8 * 1024 * 1024, shared))] : []);
        for (const capsule of proofCapsules) {
          const actualPoints = readGitHubMetadata(db, shared, "SELECT point_id FROM momentum_frames WHERE slot>=? AND slot<=? ORDER BY slot LIMIT 30", ["point_id"],
            [capsule.points[0]!.slot, capsule.points.at(-1)!.slot], 30).map((entry) => entry.point_id);
          if (githubDigest(actualPoints) !== githubDigest(capsule.points.map((entry) => entry.id))) return false;
        }
        const points = [...(frozen.point ? [frozen.point] : []), ...proofCapsules.flatMap((capsule) => capsule.points)];
        const checkedPoints = new Set<string>();
        const actualDependencies = new Map<string, Dependency[]>();
        for (const point of points) {
          if (checkedPoints.has(point.id)) continue; checkedPoints.add(point.id);
          if (githubDigest(frame(point.slot, shared).point) !== githubDigest(point)) return false;
          const run = parent(point.slot, shared, point.candidates.some((entry) => entry.current !== null));
          if (run.id !== point.githubRunId || githubDigest(run.observations.map((entry) => entry.nodeId).sort(momentumNodeOrder)) !== githubDigest(point.candidates.map((entry) => entry.nodeId))) return false;
          for (const candidate of point.candidates) for (const origin of [candidate.current, candidate.historical]) if (origin) {
            const actual = parent(origin.slot, shared, true);
            if (actual.id !== origin.githubRunId || actual.availableAtUtc > point.cutoffUtc || githubDigest(actual.configuration) !== githubDigest(origin.configuration) ||
              githubDigest(actual.policy) !== githubDigest(origin.policy) || !actual.observations.some((entry) => githubDigest(entry) === githubDigest(origin.observation))) return false;
          }
          let original: DevelopmentRun | null = null;
          if (point.security.origin) {
            const origin = point.security.origin;
            original = loadDevelopment(origin.slot);
            if (!original || original.id !== origin.developmentRunId || original.githubRunId !== point.githubRunId || original.availableAtUtc !== origin.availableAtUtc ||
              githubDigest(original.configuration) !== githubDigest(origin.configuration)) return false;
            const security = original.security;
            if (point.security.mode === "observed" && point.security.nodes.some((entry) => githubDigest(entry.risks) !== githubDigest(security?.risks.filter((risk) => risk.nodeId === entry.nodeId)) || entry.historyUnavailable !== security?.history.unavailableNodeIds.includes(entry.nodeId))) return false;
          }
          const required = dependencies(point, original);
          if (githubDigest(required) !== githubDigest(dependencyHeader("momentum_frames", "slot", point.slot, shared))) return false;
          actualDependencies.set(point.id, required);
        }
        for (const capsule of proofCapsules) if (githubDigest(canonicalDependencies(capsule.points.flatMap((point) => actualDependencies.get(point.id)!))) !==
          githubDigest(dependencyHeader("momentum_capsules", "id", capsule.id, shared))) return false;
        return true;
      } catch { return false; }
    },
  };
}
