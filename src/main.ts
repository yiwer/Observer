import { resolve } from "node:path";
import { createObserver, ObserverError } from "./observer.ts";
import { startPrivateServer } from "./http.ts";
import { createProductionRuntime } from "./production-runtime.ts";

const port = Number(process.env.OBSERVER_PORT ?? "3000");
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid OBSERVER_PORT");

try {
  const ownerToken = process.env.OBSERVER_OWNER_TOKEN ?? "";
  const runtime = process.env.OBSERVER_RUNTIME_CONFIG ? createProductionRuntime(resolve(process.env.OBSERVER_RUNTIME_CONFIG), ownerToken) : undefined;
  const observer = runtime?.observer ?? createObserver({
    databasePath: resolve(process.env.OBSERVER_DATABASE_PATH ?? "data/observer.sqlite"),
    ownerToken,
    mode: "production",
  });
  const server = await startPrivateServer(observer, port);
  console.log(`Observer listening on http://127.0.0.1:${server.port} (scheduled publication ${runtime?.enabled ? "enabled" : "disabled"})`);
  const shutdown = new AbortController();
  const inFlight = new Set<Promise<unknown>>();
  const tick = () => {
    if (shutdown.signal.aborted) return;
    try { observer.processRetention(); } catch { console.error("retention-tick-failed"); return; }
    // Start the daily historical-source scan independently before ordinary daily work.
    // Neither freeze nor readable delivery awaits its network/model work.
    const patrol = observer.processCorrectionPatrol(shutdown.signal).catch(() => console.error("correction-patrol-tick-failed"));
    inFlight.add(patrol); void patrol.finally(() => inFlight.delete(patrol));
    const correction = observer.processCorrections(shutdown.signal).catch(() => console.error("correction-tick-failed"));
    inFlight.add(correction); void correction.finally(() => inFlight.delete(correction));
    const rendition = observer.processPdfRenditions(shutdown.signal).catch(() => console.error("pdf-rendition-tick-failed"));
    inFlight.add(rendition); void rendition.finally(() => inFlight.delete(rendition));
    const delivery = observer.processEmailDeliveries(shutdown.signal).catch(() => console.error("email-delivery-tick-failed"));
    inFlight.add(delivery); void delivery.finally(() => inFlight.delete(delivery));
    if (!runtime) return;
    const work = runtime.tick(async (versionId) => {
      const response = await fetch(`http://127.0.0.1:${server.port}/v1/reports/${versionId}`, {
        headers: { Authorization: `Bearer ${ownerToken}` }, signal: AbortSignal.timeout(10000), redirect: "error",
      });
      if (!response.ok || (await response.json() as { version?: { id?: string } }).version?.id !== versionId) throw new Error("private-version-unreadable");
    }, shutdown.signal).catch(() => console.error("scheduled-tick-failed"));
    inFlight.add(work); void work.finally(() => inFlight.delete(work));
    const collection = runtime.collect(shutdown.signal).catch(() => console.error("scheduled-collection-failed"));
    inFlight.add(collection); void collection.finally(() => inFlight.delete(collection));
  };
  const timer = setInterval(tick, 1000); tick();
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    clearInterval(timer); shutdown.abort();
    await Promise.allSettled(inFlight);
    await server.close();
    if (runtime) runtime.close(); else observer.close();
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (error) {
  console.error(error instanceof ObserverError ? error.code : "Observer startup failed");
  process.exitCode = 1;
}
