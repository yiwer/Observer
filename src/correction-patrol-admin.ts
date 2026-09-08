import { statSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { shanghaiDate } from "./scheduled-publication.ts";

const [flag, path, command, requestedDate, ...extra] = process.argv.slice(2);
let database: DatabaseSync | undefined;
try {
  if (flag !== "--database" || !path || command !== "status" || extra.length) throw new Error("usage");
  const date = z.iso.date().parse(requestedDate ?? shanghaiDate(new Date().toISOString()));
  if (!statSync(resolve(path)).isFile()) throw new Error("missing-database");
  database = new DatabaseSync(resolve(path), { readOnly: true });
  const run = database.prepare("SELECT * FROM correction_patrol_runs WHERE business_date=?").get(date);
  const tasks = database.prepare("SELECT t.id,t.target,t.state,t.attempts,t.next_attempt_utc,t.observed_at_utc,t.material_id,t.signal_id,t.reason,s.state AS correction_state,s.reason AS correction_reason,s.version_id FROM correction_patrol_tasks t LEFT JOIN correction_signals s ON s.signal_id=t.signal_id WHERE t.business_date=? ORDER BY t.rowid").all(date);
  console.log(JSON.stringify({ businessDate: date, run: run ? { ...run, gaps: JSON.parse(String(run.gaps)) as unknown } : null,
    tasks: tasks.map((row) => ({ ...row, target: JSON.parse(String(row.target)) as unknown })) }, null, 2));
} catch {
  console.error("patrol-status-unavailable; Usage: patrol --database <observer.sqlite> status [YYYY-MM-DD]"); process.exitCode = 1;
} finally { database?.close(); }
