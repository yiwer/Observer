import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { correctionStatus, enqueueCorrection } from "./correction-queue.ts";
import { PrivateApiError } from "./private-access.ts";

const [flag, path, command, argument, ...extra] = process.argv.slice(2);
if (flag !== "--database" || !path || !["enqueue", "status"].includes(command ?? "") || !argument || extra.length) {
  console.error("Usage: corrections --database <observer.sqlite> enqueue <signal.json> | status <signal-id>"); process.exitCode = 1;
} else {
  let database: DatabaseSync | undefined;
  try {
    if (!statSync(resolve(path)).isFile()) throw new Error("missing-database");
    database = new DatabaseSync(resolve(path)); database.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    if (command === "enqueue") {
      const file = resolve(argument);
      if (statSync(file).size > 256 * 1024) throw new Error("signal-too-large");
      console.log(JSON.stringify(enqueueCorrection(database, JSON.parse(readFileSync(file, "utf8")), new Date().toISOString())));
    } else console.log(JSON.stringify(correctionStatus(database, argument)));
  } catch (error) {
    console.error(error instanceof PrivateApiError ? error.code : "correction-command-failed"); process.exitCode = 1;
  } finally { database?.close(); }
}
