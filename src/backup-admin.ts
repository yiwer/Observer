import { spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";
import { backupDue, backupStatus, completeRestoreDrill, createBackup, loadBackupConfiguration, restoreBackup } from "./backup.ts";

const [flag, file, command, ...arguments_] = process.argv.slice(2);
try {
  process.umask(0o077);
  if (flag !== "--config" || !file || !["due", "status", "create", "restore", "complete-drill"].includes(command ?? "") ||
    arguments_.length !== (command === "restore" ? 2 : command === "complete-drill" ? 3 : 0)) {
    throw new Error("usage");
  }
  const config = loadBackupConfiguration(file);
  for (const directory of [config.controlDirectory, config.restoreDirectory]) if (!existsSync(directory) || !lstatSync(directory).isDirectory()) throw new Error("backup-private-directory-required");
  if (command === "status") console.log(JSON.stringify(backupStatus(config)));
  else if (command === "due") {
    const due = backupDue(config); console.log(JSON.stringify({ enabled: config.enabled, due })); process.exitCode = due ? 10 : 0;
  } else if (process.env.OBSERVER_BACKUP_LOCKED !== "1") {
    if (process.platform !== "linux") throw new Error("backup-linux-flock-required");
    const action = [process.execPath, resolve(process.argv[1]!), ...process.argv.slice(2)];
    const locks = ["--exclusive", "--nonblock", "--no-fork", join(config.controlDirectory, "operation.lock"),
      ...(command === "create" ? ["flock", "--exclusive", "--nonblock", "--no-fork", join(config.dataDirectory, "service.lock")] : []), ...action];
    const child = spawnSync("flock", locks, { stdio: "inherit", env: { ...process.env, OBSERVER_BACKUP_LOCKED: "1" } });
    if (child.error || child.signal) throw new Error("backup-lock-or-child-failed");
    process.exitCode = child.status ?? 1;
  } else {
    const result = command === "create" ? await createBackup(config) : command === "restore" ? await restoreBackup(config, arguments_[0]!, arguments_[1]!) :
      await completeRestoreDrill(config, arguments_[0]!, arguments_[1]!, arguments_[2]!);
    console.log(JSON.stringify(result));
  }
} catch {
  console.error("backup-command-failed; inspect private state/drill phase; no provider response or secret is logged");
  console.error("Usage: backup --config <absolute-config.json> due | status | create | restore <new-drill-id> <incident-utc> | complete-drill <id> <private-base-url> <independent-owner-token-file>");
  process.exitCode = 1;
}
