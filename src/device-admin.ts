import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { privateAccess, PrivateApiError } from "./private-access.ts";

// Filesystem permission to the explicitly selected private DB is the authority.
// This program never reads Provider credentials or initializes production jobs.
const [flag, path, command, deviceId, ...extra] = process.argv.slice(2);
if (flag !== "--database" || !path || !["pair", "devices", "revoke"].includes(command ?? "") || extra.length ||
  (command === "revoke" ? !deviceId : !!deviceId)) {
  console.error("Usage: device-admin --database <observer.sqlite> pair|devices|revoke <device-id>");
  process.exitCode = 1;
} else {
  const databasePath = resolve(path);
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(databasePath);
  try {
    database.exec("PRAGMA busy_timeout=5000;");
    const access = privateAccess(database, "", () => new Date().toISOString());
    const result = command === "pair" ? access.issuePairing() : command === "devices" ? access.listDevices() : access.revokeDevice(deviceId!);
    // `pair` prints its one-time code only here, directly to the local operator.
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error instanceof PrivateApiError ? error.code : "device-admin-failed");
    process.exitCode = 1;
  } finally { database.close(); }
}
