import type { DatabaseSync } from "node:sqlite";
import type { GitHubRun } from "./github-contracts.ts";

/** Keep immutable publication/index inputs at their exact slots. Compaction only
 * consumes unreferenced hourly observations; it never rewrites integrity inputs. */
export function githubRetention(db: DatabaseSync, now: string, published: unknown[], suppressed: string[]) {
  const exists = (name: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
  db.exec(`PRAGMA secure_delete=ON;
    CREATE TABLE IF NOT EXISTS github_daily_observations(source_id TEXT NOT NULL,day TEXT NOT NULL,node_id TEXT NOT NULL,observed_at TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(source_id,day,node_id));
    CREATE TABLE IF NOT EXISTS github_identity_history(source_id TEXT NOT NULL,node_id TEXT NOT NULL,full_name TEXT NOT NULL,observed_at TEXT NOT NULL,PRIMARY KEY(source_id,node_id,observed_at));
    CREATE TABLE IF NOT EXISTS github_retention_state(id TEXT PRIMARY KEY,reason TEXT NOT NULL,updated_at TEXT NOT NULL,affected INTEGER NOT NULL);`);
  const cutoff = new Date(Date.parse(now) - 90 * 86400000).toISOString();
  const pinned = new Set<string>();
  function references(input: unknown) {
    if (typeof input === "string") pinned.add(input);
    else if (Array.isArray(input)) input.forEach(references);
    else if (input && typeof input === "object") Object.values(input).forEach(references);
  }
  published.forEach(references);
  // Both indexes verify raw parents on reads. A chain member remains necessary
  // even when no report directly names it; do not invalidate their authority.
  if (exists("development_runs")) for (const row of db.prepare("SELECT slot,payload FROM development_runs").all()) { pinned.add(String(row.slot)); references(JSON.parse(String(row.payload))); }
  if (exists("momentum_frames")) for (const row of db.prepare("SELECT slot,github_run_id,payload FROM momentum_frames").all()) { pinned.add(String(row.slot)); pinned.add(String(row.github_run_id)); references(JSON.parse(String(row.payload))); }
  if (exists("momentum_pending")) for (const row of db.prepare("SELECT slot FROM momentum_pending").all()) pinned.add(String(row.slot));
  const runs = db.prepare("SELECT slot,payload FROM runs ORDER BY slot").all().map((row) => ({ slot: String(row.slot), run: JSON.parse(String(row.payload)) as GitHubRun }));
  const blocked = new Set(suppressed);
  const rights = runs.some(({ run }) => blocked.has(run.configuration.sourceId));
  let compacted = 0, retained = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    // Rights removal is explicit, atomic, and stronger than index immutability.
    // Restore the exact trigger definitions before committing; normal writes keep
    // their existing authority checks. No schema authority hash is changed.
    const guards = db.prepare("SELECT name,sql,tbl_name FROM sqlite_master WHERE type='trigger'").all().filter((row) =>
      rights ? ["runs", "development_runs", "development_contexts", "context_node_heads", "context_pending_runs", "momentum_frames", "momentum_steps", "momentum_heads", "momentum_capsules", "momentum_pending", "momentum_state"].includes(String(row.tbl_name)) : row.name === "momentum_raw_delete");
    for (const guard of guards) db.exec(`DROP TRIGGER ${String(guard.name)}`);
    if (rights) {
      // The single configured GitHub provider owns this context/momentum chain.
      // Removing a link invalidates the chain, so discard its derived content too.
      for (const table of ["development_contexts", "context_node_heads", "context_pending_runs", "momentum_frames", "momentum_steps", "momentum_heads", "momentum_capsules", "momentum_pending"]) if (exists(table)) db.exec(`DELETE FROM ${table}`);
      if (exists("context_index_state")) db.exec("UPDATE context_index_state SET phase='invalid',dirty=1");
      if (exists("momentum_state")) db.exec("UPDATE momentum_state SET phase='invalid'");
      if (exists("development_runs")) db.exec("DELETE FROM development_runs");
    }
    const names = new Map<string, string>();
    for (const row of db.prepare("SELECT source_id,node_id,full_name FROM github_identity_history ORDER BY observed_at").all()) names.set(`${row.source_id}:${row.node_id}`, String(row.full_name));
    for (const { slot, run } of runs) {
      const source = run.configuration.sourceId;
      if (blocked.has(source)) { db.prepare("DELETE FROM runs WHERE slot=?").run(slot); continue; }
      if (slot >= cutoff) continue;
      for (const observation of run.observations) {
        const day = observation.observedAtUtc.slice(0, 10);
        db.prepare(`INSERT INTO github_daily_observations VALUES(?,?,?,?,?) ON CONFLICT(source_id,day,node_id) DO UPDATE SET
          observed_at=excluded.observed_at,payload=excluded.payload WHERE excluded.observed_at>github_daily_observations.observed_at`)
          .run(source, day, observation.nodeId, observation.observedAtUtc, JSON.stringify({ policy: run.policy, observation }));
        if (observation.reason !== null && observation.reason !== "github-ineligible" && observation.reason !== "github-risk-unknown") continue;
        const key = `${source}:${observation.nodeId}`;
        if (names.get(key) !== observation.fullName) {
          db.prepare("INSERT OR IGNORE INTO github_identity_history VALUES(?,?,?,?)").run(source, observation.nodeId, observation.fullName, observation.observedAtUtc);
          names.set(key, observation.fullName);
        }
      }
      if (pinned.has(slot) || pinned.has(run.id) || run.observations.some((observation) => pinned.has(observation.id))) { retained++; continue; }
      db.prepare("DELETE FROM runs WHERE slot=?").run(slot); compacted++;
    }
    for (const source of suppressed) for (const table of ["github_daily_observations", "github_identity_history"]) db.prepare(`DELETE FROM ${table} WHERE source_id=?`).run(source);
    for (const guard of guards) db.exec(String(guard.sql));
    db.prepare("INSERT OR REPLACE INTO github_retention_state VALUES('hourly','older-than-90d-daily;published-context-momentum-inputs-pinned',?,?)").run(now, compacted);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return { compactedHourlyRuns: compacted, retainedDependencyRuns: retained, reason: "daily-observations-and-identity-history-retained" };
}
