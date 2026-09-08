import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createProductionRuntime } from "../src/production-runtime.ts";
import { startPrivateServer } from "../src/http.ts";

test("configured daily production freezes at Shanghai cutoff, publishes private gaps and outbox once across restart", async () => {
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
  const probe = async (versionId: string) => {
    const url = `http://127.0.0.1:${server.port}/v1/reports/${versionId}`;
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(response.status, 200);
    const report = await response.json() as { version: { id: string; provenance: string }; canonicalMarkdown: string; record: { coverageGaps: unknown[] } };
    assert.equal(report.version.id, versionId);
    assert.equal(report.version.provenance, "scheduled");
    assert.doesNotMatch(report.canonicalMarkdown, /自动化标注替身产物/);
    assert.ok(report.record.coverageGaps.length >= 6);
  };
  try {
    await runtime.tick(probe);
    assert.equal(runtime.observer.scheduledStatus("2026-09-09"), null);
    now = "2026-09-08T23:30:00.000Z";
    await Promise.all([runtime.tick(probe), runtime.tick(probe)]);
    const first = runtime.observer.scheduledStatus("2026-09-09");
    assert.equal(first?.state, "readable", JSON.stringify(first));
    assert.equal(first.attempts, 1);
    assert.equal(first.frozenAtUtc, now);
    assert.equal(first.completedAtUtc, now);
    assert.equal(first.readableAtUtc, now);
    assert.equal(first.deadlineUtc, "2026-09-09T00:30:00.000Z");
    assert.equal(first.onTime, true);
    assert.equal(runtime.observer.pendingDeliveries(ownerToken).length, 1);
    await server.close(); runtime.close();
    runtime = createProductionRuntime(configurationPath, ownerToken, () => now);
    server = await startPrivateServer(runtime.observer);
    await runtime.tick(probe);
    assert.deepEqual(runtime.observer.scheduledStatus("2026-09-09"), first);
    assert.equal(runtime.observer.pendingDeliveries(ownerToken).length, 1);
    now = "2026-09-09T23:30:00.000Z";
    await runtime.tick(probe);
    assert.equal(runtime.observer.scheduledStatus("2026-09-10")?.state, "readable");
    assert.equal(runtime.observer.pendingDeliveries(ownerToken).length, 2);
  } finally { await server.close(); runtime.close(); }
});
