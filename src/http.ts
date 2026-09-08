import { createServer } from "node:http";
import { once } from "node:events";
import { ObserverError, type Observer } from "./observer.ts";

export async function startPrivateServer(observer: Pick<Observer, "readReport"> & Partial<Pick<Observer, "readScheduledStatus">>, port = 0) {
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    const route = /^\/v1\/reports\/(\d{4}-\d{2}-\d{2}-v[1-9]\d*)(\/markdown)?$/.exec(request.url ?? "");
    const statusRoute = /^\/v1\/briefs\/(\d{4}-\d{2}-\d{2})$/.exec(request.url ?? "");
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end(JSON.stringify({ error: "method-not-allowed" }));
      return;
    }
    if (!route && !statusRoute) { response.writeHead(404).end(JSON.stringify({ error: "not-found" })); return; }
    try {
      const authorization = request.headers.authorization;
      const credential = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
      if (statusRoute) {
        if (!observer.readScheduledStatus) throw new ObserverError("not-found");
        response.end(JSON.stringify(observer.readScheduledStatus(statusRoute[1]!, credential))); return;
      }
      const report = observer.readReport(route![1]!, credential);
      if (route![2]) {
        response.setHeader("Content-Type", "text/markdown; charset=utf-8");
        response.end(report.canonicalMarkdown);
      } else response.end(JSON.stringify(report));
    } catch (error) {
      const code = error instanceof ObserverError ? error.code : "internal-error";
      if (code === "unauthorized") {
        response.setHeader("WWW-Authenticate", "Bearer");
        response.writeHead(401).end(JSON.stringify({ error: code }));
      } else if (code === "not-found") {
        response.writeHead(404).end(JSON.stringify({ error: code }));
      } else response.writeHead(500).end(JSON.stringify({ error: "internal-error" }));
    }
  });
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Missing server address");
  return {
    port: address.port,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}
