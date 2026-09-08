import { readFileSync } from "node:fs";

// Local liveness only: low space and Provider eligibility are readiness states,
// not reasons to cycle the process and repeat external work.
try {
  const file = process.env.OBSERVER_HEALTH_FILE;
  if (!file) throw new Error();
  const state = JSON.parse(readFileSync(file, "utf8")) as { heartbeatAtUtc: string; stopping: boolean };
  const age = Date.now() - Date.parse(state.heartbeatAtUtc);
  if (!Number.isFinite(age) || age < 0 || age > 15000 || state.stopping) throw new Error();
  const port = Number(process.env.OBSERVER_PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
  const response = await fetch(`http://127.0.0.1:${port}/__observer_liveness`, { signal: AbortSignal.timeout(3000), redirect: "error" });
  if (response.status !== 404) throw new Error();
} catch { process.exitCode = 1; }
