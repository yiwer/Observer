import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createProductionRuntime } from "../src/production-runtime.ts";
import { startPrivateServer } from "../src/http.ts";

test("configured daily production freezes an empty day without publishing an empty normal brief", async () => {
  const directory = mkdtempSync(join(tmpdir(), "observer-scheduled-"));
  const configurationPath = join(directory, "runtime.json"), ownerToken = "scheduled-local-check-owner-token-32";
  writeFileSync(configurationPath, JSON.stringify({ schemaVersion: 1, configurationId: "scheduled-local-check",
    schedule: { enabled: true, startBusinessDate: "2026-09-09" },
    sourceConfigurationPath: resolve("config/sources.example.v1.json"), interestProfilePath: resolve("config/interest.example.v1.json"),
    databasePath: join(directory, "reports.sqlite"), collectionDatabasePath: join(directory, "collection.sqlite"),
    collect: false, routing: { schemaVersion: 1, version: 1, primary: "codex" }, providers: {},
  }));
  let now = "2026-09-08T23:29:59.999Z";
  let runtime = createProductionRuntime(configurationPath, ownerToken, () => now);
  let server = await startPrivateServer(runtime.observer);
  const probe = async (_versionId: string) => { assert.fail("No trustworthy content must not publish a report"); };
  try {
    await runtime.tick(probe);
    assert.equal(runtime.observer.scheduledStatus("2026-09-09"), null);
    now = "2026-09-08T23:30:00.000Z";
    await Promise.all([runtime.tick(probe), runtime.tick(probe)]);
    const first = runtime.observer.scheduledStatus("2026-09-09");
    assert.equal(first?.state, "queued", JSON.stringify(first));
    assert.equal(first.attempts, 1);
    assert.equal(first.frozenAtUtc, now);
    assert.equal(first.completedAtUtc, null);
    assert.equal(first.readableAtUtc, null);
    assert.equal(first.deadlineUtc, "2026-09-09T00:30:00.000Z");
    assert.equal(first.onTime, null);
    assert.equal(first.failure, "no-trustworthy-content");
    assert.equal(runtime.observer.pendingDeliveries(ownerToken).length, 0);
    await server.close(); runtime.close();
    runtime = createProductionRuntime(configurationPath, ownerToken, () => now);
    server = await startPrivateServer(runtime.observer);
    await runtime.tick(probe);
    assert.deepEqual(runtime.observer.scheduledStatus("2026-09-09"), first);
    assert.equal(runtime.observer.pendingDeliveries(ownerToken).length, 0);
    now = "2026-09-09T23:30:00.000Z";
    await runtime.tick(probe);
    assert.equal(runtime.observer.scheduledStatus("2026-09-09")?.state, "missed");
    assert.equal(runtime.observer.scheduledStatus("2026-09-10")?.state, "queued");
    assert.equal(runtime.observer.pendingDeliveries(ownerToken).length, 0);
  } finally { await server.close(); runtime.close(); }
});
