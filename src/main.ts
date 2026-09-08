import { dirname, resolve } from "node:path";
import { createObserver, ObserverError } from "./observer.ts";
import { startPrivateServer } from "./http.ts";
import { createProductionRuntime } from "./production-runtime.ts";
import { runtimeSecret } from "./runtime-secrets.ts";
import { createRuntimeOperations, operationalStorage } from "./runtime-operations.ts";
import { shanghaiDate } from "./scheduled-publication.ts";
import { prepareAgentNode } from "./agent-container.ts";

const port = Number(process.env.OBSERVER_PORT ?? "3000");
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid OBSERVER_PORT");

try {
  process.umask(0o077);
  const host = process.env.OBSERVER_BIND_HOST ?? "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "0.0.0.0") throw new Error("invalid-bind-host");
  const ownerToken = runtimeSecret("OBSERVER_OWNER_TOKEN") ?? "";
  const runtime = process.env.OBSERVER_RUNTIME_CONFIG ? createProductionRuntime(resolve(process.env.OBSERVER_RUNTIME_CONFIG), ownerToken) : undefined;
  const observer = runtime?.observer ?? createObserver({
    databasePath: resolve(process.env.OBSERVER_DATABASE_PATH ?? "data/observer.sqlite"),
    ownerToken,
    mode: "production",
  });
  const databasePath = runtime?.databasePath ?? resolve(process.env.OBSERVER_DATABASE_PATH ?? "data/observer.sqlite");
  const operations = createRuntimeOperations(runtime?.storageDirectories ?? [dirname(databasePath)], ownerToken);
  let agentRecovery = "checking";
  const server = await startPrivateServer(observer, port, { host, operations: (credential) => {
    const status = operations.status(credential);
    return { ...status, agentRecovery, runtime: runtime?.status() ?? { enabled: false },
      storage: operationalStorage(databasePath, shanghaiDate(new Date().toISOString())) };
  } });
  console.log(`Observer listening on http://${host}:${server.port} (scheduled publication ${runtime?.enabled ? "enabled" : "disabled"})`);
  const shutdown = new AbortController();
  const inFlight = new Set<Promise<unknown>>();
  const recovery = prepareAgentNode(runtime?.taskRoot ?? resolve("data/agent-tasks"), shutdown.signal).then((state) => { agentRecovery = state; });
  inFlight.add(recovery); void recovery.finally(() => inFlight.delete(recovery));
  const launch = (name: string, work: () => Promise<unknown>) => {
    const pending = operations.run(name, work); inFlight.add(pending); void pending.finally(() => inFlight.delete(pending));
  };
  const tick = () => {
    if (shutdown.signal.aborted) return;
    if (!operations.heartbeat()) return;
    try { observer.processRetention(); } catch { operations.failure("retention"); console.error("retention-tick-failed"); return; }
    // Start the daily historical-source scan independently before ordinary daily work.
    // Neither freeze nor readable delivery awaits its network/model work.
    launch("patrol", () => observer.processCorrectionPatrol(shutdown.signal));
    launch("correction", () => observer.processCorrections(shutdown.signal));
    launch("pdf", () => observer.processPdfRenditions(shutdown.signal));
    launch("email", () => observer.processEmailDeliveries(shutdown.signal));
    if (!runtime) return;
    launch("scheduled", () => runtime.tick(async (versionId) => {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/reports/${versionId}`, {
        headers: { Authorization: `Bearer ${ownerToken}` }, signal: AbortSignal.timeout(10000), redirect: "error",
      });
      if (!response.ok || (await response.json() as { version?: { id?: string } }).version?.id !== versionId) throw new Error("private-version-unreadable");
    }, shutdown.signal));
    launch("collection", () => runtime.collect(shutdown.signal));
  };
  const timer = setInterval(tick, 1000); tick();
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    operations.stop(); operations.heartbeat();
    clearInterval(timer); shutdown.abort();
    const deadline = setTimeout(() => { console.error("shutdown-deadline-exceeded"); process.exit(1); }, 30000);
    await Promise.allSettled(inFlight);
    await server.close();
    if (runtime) runtime.close(); else observer.close();
    clearTimeout(deadline);
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (error) {
  console.error(error instanceof ObserverError ? error.code : "Observer startup failed");
  process.exitCode = 1;
}
