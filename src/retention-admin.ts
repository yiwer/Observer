import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createCollection, SourceConfigurationSchema } from "./collection.ts";
import { ProductionConfigurationSchema } from "./production-runtime.ts";
import { retentionLifecycle } from "./retention.ts";
import { scheduledStore } from "./scheduled-publication.ts";
import { githubRetention } from "./github-retention.ts";

const [flag, file, command, argument, ...extra] = process.argv.slice(2);
if (flag !== "--config" || !file || !["run", "status", "remove", "contract", "apply-contract"].includes(command ?? "") || extra.length ||
    (["remove", "apply-contract"].includes(command!) ? !argument : !!argument)) {
  console.error("Usage: retention --config <runtime.json> run | status | contract | remove <request.json> | apply-contract <suppression.json>"); process.exitCode = 1;
} else {
  let database: DatabaseSync | undefined, github: DatabaseSync | undefined, collection: ReturnType<typeof createCollection> | undefined;
  try {
    const json = (path: string) => { if (statSync(path).size > 16 * 1024 * 1024) throw new Error("input-too-large"); return JSON.parse(readFileSync(path, "utf8")) as unknown; };
    const configPath = resolve(file), configuration = ProductionConfigurationSchema.parse(json(configPath));
    const path = (value: string) => resolve(dirname(configPath), value);
    const reportPath = path(configuration.databasePath), collectionPath = path(configuration.collectionDatabasePath);
    // Local management opens exactly the configured existing managed databases.
    // It never constructs providers, reads credentials, sends mail, or collects.
    if (reportPath === collectionPath || !statSync(reportPath).isFile() || !statSync(collectionPath).isFile()) throw new Error("invalid-storage-target");
    database = new DatabaseSync(reportPath); database.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON");
    if (database.prepare("PRAGMA user_version").get()!.user_version !== 1 || !database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='reports'").get()) throw new Error("unsupported-storage");
    const sources = () => SourceConfigurationSchema.parse(json(path(configuration.sourceConfigurationPath))).sources;
    if (configuration.github) {
      const githubPath = path(configuration.github.databasePath);
      if ([reportPath, collectionPath].includes(githubPath) || !statSync(githubPath).isFile()) throw new Error("invalid-storage-target");
      github = new DatabaseSync(githubPath);
      if (github.prepare("PRAGMA application_id").get()!.application_id !== 1329746759 || github.prepare("PRAGMA user_version").get()!.user_version !== 1)
        throw new Error("unsupported-github-storage");
    }
    collection = createCollection({ databasePath: collectionPath, sources: sources(), policyReader: sources });
    const clock = () => new Date().toISOString(), schedule = scheduledStore(database, clock);
    const lifecycle = retentionLifecycle(database, clock, sources, { purgeRaw: (ids) => collection!.suppressSources(ids),
      availableEvidence: (ids) => collection!.correctionEvidence(ids).map((entry) => entry.id), purgeScheduled: (current) => schedule.purge(current),
      ...(github ? { compactGitHub: (published: unknown[], ids: string[]) => githubRetention(github!, clock(), published, ids) } : {}) });
    if (command === "remove") lifecycle.remove(json(resolve(argument!)));
    else if (command === "apply-contract") lifecycle.applyContract(json(resolve(argument!)));
    else if (command === "run") lifecycle.maintenance(true);
    console.log(JSON.stringify(command === "contract" ? lifecycle.contract() : lifecycle.status()));
  } catch { console.error("retention-command-failed"); process.exitCode = 1; }
  finally { collection?.close(); github?.close(); database?.close(); }
}
