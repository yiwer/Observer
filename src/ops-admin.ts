import { runtimeSecret } from "./runtime-secrets.ts";

// In-container local status command. Reads only the Owner credential, never
// constructs a runtime, opens a database, invokes providers or sends email.
try {
  if (process.argv.length !== 2) throw new Error();
  const port = Number(process.env.OBSERVER_PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
  const token = runtimeSecret("OBSERVER_OWNER_TOKEN");
  if (!token) throw new Error();
  const response = await fetch(`http://127.0.0.1:${port}/v1/ops`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000), redirect: "error",
  });
  if (!response.ok) throw new Error();
  console.log(JSON.stringify(await response.json(), null, 2));
} catch { console.error("operations-status-unavailable"); process.exitCode = 1; }
