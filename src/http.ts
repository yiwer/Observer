import { createServer, type IncomingMessage } from "node:http";
import { once } from "node:events";
import { ObserverError, type Observer } from "./observer.ts";
import { PrivateApiError } from "./private-access.ts";

type Reader = Pick<Observer, "readReport"> & Partial<Pick<Observer, "readScheduledStatus" | "pairDevice" | "archiveHistory" | "syncArchive" |
  "readArchive" | "readArchiveReport" | "createDownload" | "readDownload">>;
async function jsonBody(request: IncomingMessage): Promise<unknown> {
  if (!request.headers["content-type"]?.startsWith("application/json")) throw new PrivateApiError("json-required", 415);
  const chunks: Buffer[] = []; let bytes = 0;
  for await (const value of request) {
    const chunk = Buffer.from(value as Uint8Array); bytes += chunk.length;
    if (bytes > 4096) throw new PrivateApiError("request-too-large", 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new PrivateApiError("invalid-json"); }
}

export async function startPrivateServer(observer: Reader, port = 0) {
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      const url = new URL(request.url ?? "/", "http://observer.local"), path = url.pathname;
      const authorization = request.headers.authorization;
      const credential = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
      const reportRoute = /^\/v1\/reports\/(\d{4}-\d{2}-\d{2}-v[1-9]\d*)(?:\/(markdown|pdf|download-link))?$/.exec(path);
      const statusRoute = /^\/v1\/briefs\/(\d{4}-\d{2}-\d{2})$/.exec(path);
      const archiveRoute = /^\/v1\/archive\/(\d{4}-\d{2}-\d{2})(?:\/(latest|versions)(?:\/([1-9]\d*))?)?$/.exec(path);
      const downloadRoute = /^\/v1\/downloads\/(\d{4}-\d{2}-\d{2}-v[1-9]\d*)\/(markdown|pdf)$/.exec(path);
      const pair = path === "/v1/devices/pair", issueDownload = reportRoute?.[2] === "download-link";
      const method = pair || issueDownload ? "POST" : "GET";
      if (request.method !== method) {
        response.setHeader("Allow", method); throw new PrivateApiError("method-not-allowed", 405);
      }
      const paging = () => {
        for (const key of url.searchParams.keys()) if (!["cursor", "limit"].includes(key) || url.searchParams.getAll(key).length > 1) throw new PrivateApiError("invalid-query");
        const cursor = url.searchParams.get("cursor"), limit = url.searchParams.get("limit");
        return { ...(cursor ? { cursor } : {}), ...(limit !== null ? { limit: Number(limit) } : {}) };
      };
      const markdown = (value: string, attachment?: string) => {
        response.setHeader("Content-Type", "text/markdown; charset=utf-8");
        if (attachment) response.setHeader("Content-Disposition", `attachment; filename="${attachment}.md"`);
        response.end(value);
      };
      if (pair && observer.pairDevice) {
        response.statusCode = 201; response.end(JSON.stringify(observer.pairDevice(await jsonBody(request)))); return;
      }
      if (path === "/v1/archive" && observer.archiveHistory) { response.end(JSON.stringify(observer.archiveHistory(paging(), credential))); return; }
      if (path === "/v1/sync" && observer.syncArchive) { response.end(JSON.stringify(observer.syncArchive(paging(), credential))); return; }
      if (archiveRoute && observer.readArchive && observer.readArchiveReport) {
        const [, businessDate, selector, version] = archiveRoute;
        if (selector === "versions" && !version || selector === "latest" && version) throw new PrivateApiError("not-found", 404);
        response.end(JSON.stringify(selector ? observer.readArchiveReport(businessDate!, version ?? "latest", url.searchParams.get("edition"), credential) : observer.readArchive(businessDate!, credential))); return;
      }
      if (downloadRoute && observer.readDownload) {
        markdown(observer.readDownload(downloadRoute[1]!, downloadRoute[2]!, url.searchParams.get("edition"), url.searchParams.get("token") ?? ""), downloadRoute[1]!); return;
      }
      if (statusRoute && observer.readScheduledStatus) { response.end(JSON.stringify(observer.readScheduledStatus(statusRoute[1]!, credential))); return; }
      if (reportRoute) {
        if (issueDownload && observer.createDownload) {
          response.end(JSON.stringify(observer.createDownload(reportRoute[1]!, url.searchParams.get("format") ?? "markdown", url.searchParams.get("edition"), credential))); return;
        }
        const report = observer.readReport(reportRoute[1]!, credential);
        if (reportRoute[2] === "pdf") throw new PrivateApiError("rendition-not-available", 404);
        if (reportRoute[2] === "markdown") markdown(report.canonicalMarkdown);
        else response.end(JSON.stringify(report));
        return;
      }
      throw new PrivateApiError("not-found", 404);
    } catch (error) {
      const code = error instanceof ObserverError || error instanceof PrivateApiError ? error.code : "internal-error";
      const status = error instanceof PrivateApiError ? error.status : code === "unauthorized" ? 401 : code === "not-found" ? 404 : 500;
      if (status === 401) response.setHeader("WWW-Authenticate", "Bearer");
      if (status === 429) response.setHeader("Retry-After", "60");
      response.writeHead(status).end(JSON.stringify({ error: status === 500 ? "internal-error" : code }));
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.listen(port, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Missing server address");
  return { port: address.port, async close() {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  } };
}
