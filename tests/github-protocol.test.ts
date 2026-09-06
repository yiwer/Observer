import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer, request as httpRequest } from "node:http";
import { once } from "node:events";
import { createSourceReader } from "../src/source-network.ts";
import { createGitHubAdapter } from "../src/github-adapter.ts";
import { policy } from "./helpers/source-fixtures.ts";

test("GitHub redirects enforce Owner redirect allowance, current authority, expiry and exact route before sending another credentialed request", async (t) => {
  let revoked = false;
  let now = "2026-09-04T23:25:00.000Z";
  let scenario = "allowed";
  const sent: string[] = [];
  const wire: unknown[] = [];
  const server = createServer((request, response) => {
    sent.push(request.url!);
    wire.push([request.method, request.headers.accept, request.headers["x-github-api-version"], request.headers.authorization]);
    if (request.url === "/repos/example/old") {
      if (scenario === "revoked") revoked = true;
      if (scenario === "expired") now = "2026-10-01T00:00:00.000Z";
      response.writeHead(301, { location: scenario === "unsafe" ? "https://api.github.com/user" : "https://api.github.com/repos/example/new" }).end();
    } else response.end(JSON.stringify({ node_id: "R_fixture", full_name: "example/new", private: false, visibility: "public", archived: false, disabled: false, fork: false, mirror_url: null, is_template: false, stargazers_count: 1, forks_count: 0, language: null, created_at: "2026-01-01T00:00:00Z" }));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string");
  t.after(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
  const adapter = createGitHubAdapter({ read: createSourceReader({ resolve: async () => ["93.184.215.14"],
    request: (url, options, callback) => httpRequest(`http://127.0.0.1:${address.port}${url.pathname}`, { ...options, agent: false }, callback) }) });
  for (scenario of ["allowed", "owner-zero", "revoked", "expired", "unsafe"]) {
    revoked = false; now = "2026-09-04T23:25:00.000Z"; sent.length = 0; wire.length = 0;
    const source = { ...policy(), feedUrl: "https://api.github.com", limits: { ...policy().limits, maxRedirects: scenario === "owner-zero" ? 0 : 2 } };
    const operation = adapter.repository("example/old", { source, clock: () => now, authorize: () => revoked ? "github-permission-changed" : null,
      credential: () => ({ kind: "fine-grained-pat", token: "github_pat_OWNED_PROTOCOL_FIXTURE", expiresAtUtc: "2026-10-01T00:00:00.000Z", repositoryAccess: "public-only", permissions: "metadata-read-only" }) });
    if (scenario === "allowed") { assert.equal((await operation).repository.full_name, "example/new"); assert.deepEqual(sent, ["/repos/example/old", "/repos/example/new"]); }
    else { await assert.rejects(operation); assert.deepEqual(sent, ["/repos/example/old"], scenario); }
    for (const request of wire) assert.deepEqual(request, ["GET", "application/vnd.github+json", "2026-03-10", "Bearer github_pat_OWNED_PROTOCOL_FIXTURE"]);
  }
});
