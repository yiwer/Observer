import { readFile, stat } from "node:fs/promises";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { SourceConfigurationSchema, createCollection } from "./collection.ts";

const shutdown = new AbortController();
process.on("SIGINT", () => shutdown.abort());
process.on("SIGTERM", () => shutdown.abort());

try {
  const configPath = process.env.OBSERVER_SOURCE_CONFIG;
  if (!configPath || (await stat(configPath)).size > 262144) throw new Error("invalid-source-configuration");
  const configuration = SourceConfigurationSchema.parse(JSON.parse(await readFile(configPath, "utf8")));
  const collection = createCollection({
    databasePath: resolve(process.env.OBSERVER_COLLECTION_DATABASE_PATH ?? "data/collection.sqlite"),
    sources: configuration.sources,
    policyReader: () => {
      if (statSync(configPath).size > 262144) throw new Error("invalid-source-configuration");
      return SourceConfigurationSchema.parse(JSON.parse(readFileSync(configPath, "utf8"))).sources;
    },
  });
  try {
    while (!shutdown.signal.aborted) {
      const result = await collection.collect();
      // Operational outcomes only. Never log response bodies, report material or exceptions.
      console.log(JSON.stringify({ configurationId: configuration.configurationId, ...result }));
      if (process.argv.includes("--once")) break;
      await setTimeout(1000, undefined, { signal: shutdown.signal }).catch(() => {});
    }
  } finally { collection.close(); }
} catch {
  console.error("collection-startup-or-storage-failed");
  process.exitCode = 1;
}
