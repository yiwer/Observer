import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { reconcileEmailDelivery } from "./email-delivery.ts";
import { PrivateApiError } from "./private-access.ts";

// Only filesystem authority to an existing service DB. Does not start Observer,
// sign a URL, read an email account, load SMTP credentials or send anything.
const [flag, path, command, evidencePath, ...extra] = process.argv.slice(2);
if (flag !== "--database" || !path || command !== "reconcile" || !evidencePath || extra.length) {
  console.error("Usage: email-admin --database <observer.sqlite> reconcile <local-evidence.json>"); process.exitCode = 1;
} else {
  let database: DatabaseSync | undefined;
  try {
    const databasePath = resolve(path), file = resolve(evidencePath);
    if (!statSync(databasePath).isFile() || statSync(file).size > 4096) throw new Error("invalid-local-input");
    const input = JSON.parse(readFileSync(file, "utf8")) as unknown;
    database = new DatabaseSync(databasePath); database.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    console.log(JSON.stringify(reconcileEmailDelivery(database, input, () => new Date().toISOString())));
  } catch (error) {
    console.error(error instanceof PrivateApiError ? error.code : "email-reconciliation-failed"); process.exitCode = 1;
  } finally { database?.close(); }
}
