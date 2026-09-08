import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createObserver } from "../src/observer.ts";
import { startPrivateServer } from "../src/http.ts";
import { request, successfulResult, ownerToken } from "./fixtures.ts";

test("local paired archive lifecycle: fixed pagination, restart, exact download and revocation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "observer-private-archive-"));
  const options = { databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture" as const,
    clock: () => "2026-09-06T00:00:00.000Z", runner: { run: async () => successfulResult() } };
  let observer = createObserver(options), server = await startPrivateServer(observer);
  let base = `http://127.0.0.1:${server.port}`;
  const get = (path: string, credential?: string) => fetch(base + path, { headers: credential ? { Authorization: `Bearer ${credential}` } : {} });
  try {
    await observer.produce(request);
    const pairing = observer.issueDevicePairing();
    const pairResponse = await fetch(base + "/v1/devices/pair", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingId: pairing.pairingId, code: pairing.code, deviceName: "Local no-GMS sample" }) });
    assert.equal(pairResponse.status, 201);
    const device = await pairResponse.json() as { deviceId: string; credential: string };
    assert.equal((await get("/v1/archive")).status, 401);
    const latest = await get("/v1/archive/2026-09-05/latest", device.credential);
    assert.equal(latest.status, 200);
    const report = await latest.json() as { report: { canonicalMarkdown: string } };
    const selected = await get("/v1/archive/2026-09-05/versions/1?edition=frontier-technology", device.credential);
    assert.equal(selected.status, 200);
    assert.match((await selected.json() as { canonicalMarkdown: string }).canonicalMarkdown, /12 个观测点/);
    const initial = observer.archiveHistory({ limit: 1 }, device.credential);
    assert.equal(initial.items[0]?.latestVersionId, "2026-09-05-v1");
    const grantResponse = await fetch(base + "/v1/reports/2026-09-05-v1/download-link", { method: "POST", headers: { Authorization: `Bearer ${device.credential}` } });
    const grant = await grantResponse.json() as { path: string };
    assert.equal(grantResponse.status, 200);
    assert.equal(await (await get(grant.path)).text(), report.report.canonicalMarkdown);
    assert.equal((await get(grant.path.replace("2026-09-05-v1", "2026-09-05-v2"))).status, 401);
    // A second real publication enters the durable feed after the initial snapshot.
    const next = structuredClone(request);
    next.businessDate = "2026-09-06"; next.evidenceBundle.businessDate = next.businessDate;
    await observer.produce(next);
    const page = observer.syncArchive({ limit: 1 }, device.credential);
    assert.equal(page.hasMore, true);
    const continuation = page.nextCursor;
    await server.close(); observer.close();
    observer = createObserver(options); server = await startPrivateServer(observer); base = `http://127.0.0.1:${server.port}`;
    const repeated = observer.syncArchive({ cursor: continuation, limit: 1 }, device.credential);
    assert.equal(repeated.events[0]?.versionId, "2026-09-06-v1");
    assert.deepEqual(observer.syncArchive({ cursor: continuation, limit: 1 }, device.credential), repeated);
    const incremental = observer.syncArchive({ cursor: initial.syncCursor }, device.credential);
    assert.equal(incremental.events[0]?.versionId, "2026-09-06-v1");
    assert.equal(await (await get(grant.path)).text(), report.report.canonicalMarkdown);
    observer.revokeDevice(device.deviceId);
    assert.equal((await get("/v1/sync", device.credential)).status, 401);
    assert.equal((await get("/v1/reports/2026-09-05-v1", device.credential)).status, 401);
    assert.equal((await get(grant.path)).status, 401);
    assert.equal((await get("/v1/reports/2026-09-05-v1", ownerToken)).status, 200);
  } finally { await server.close(); observer.close(); }
});
