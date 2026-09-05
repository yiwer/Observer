import { resolve } from "node:path";
import { createObserver, ObserverError } from "./observer.ts";
import { startPrivateServer } from "./http.ts";

const port = Number(process.env.OBSERVER_PORT ?? "3000");
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Invalid OBSERVER_PORT");

// No environment variable or CLI argument enables fixture publication in this entry point.
try {
  const observer = createObserver({
    databasePath: resolve(process.env.OBSERVER_DATABASE_PATH ?? "data/observer.sqlite"),
    ownerToken: process.env.OBSERVER_OWNER_TOKEN ?? "",
    mode: "production",
  });
  const server = await startPrivateServer(observer, port);
  console.log(`Observer listening on http://127.0.0.1:${server.port} (publication disabled)`);
  let stopping = false;
  async function stop() {
    if (stopping) return;
    stopping = true;
    await server.close();
    observer.close();
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
} catch (error) {
  console.error(error instanceof ObserverError ? error.code : "Observer startup failed");
  process.exitCode = 1;
}
