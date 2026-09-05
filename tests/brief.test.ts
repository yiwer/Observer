import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createObserver } from "../src/observer.ts";
import { clock, ownerToken, request, successfulResult } from "./fixtures.ts";

async function fixture(t: TestContext, result: unknown = successfulResult()) {
  const directory = await mkdtemp(join(tmpdir(), "observer-brief-"));
  const observer = createObserver({
    databasePath: join(directory, "archive.sqlite"), ownerToken,
    mode: "test-fixture", clock, runner: { run: async () => result },
  });
  t.after(async () => { observer.close(); await rm(directory, { recursive: true, force: true }); });
  return observer;
}

test("Owner produces and privately reads one sourced fixture story and five visible Edition gaps", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-brief-"));
  const observer = createObserver({
    databasePath: join(directory, "archive.sqlite"), ownerToken,
    mode: "test-fixture", clock, runner: { run: async () => successfulResult() },
  });
  t.after(async () => { observer.close(); await rm(directory, { recursive: true, force: true }); });
  const version = await observer.produce(request);
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(version.id, "2026-09-05-v1");
  assert.equal(report.version.businessDate, "2026-09-05");
  assert.equal(report.record.stories.length, 1);
  assert.equal(report.record.coverageGaps.length, 5);
  assert.match(report.canonicalMarkdown, /第 42 次数据更新，新增 12 个观测点/);
  assert.match(report.canonicalMarkdown, /https:\/\/example\.org\/observatory\/update-42/);
  for (const edition of ["世界要闻", "AI 日报", "财经日报", "社交话语观察", "GitHub 热门项目"]) {
    assert.ok(report.canonicalMarkdown.includes(`${edition}：Coverage Gap`));
  }
  assert.throws(() => observer.readReport(version.id, undefined), { code: "unauthorized" });
  assert.throws(() => observer.readReport(version.id, "wrong-token"), { code: "unauthorized" });
});

test("An Agent result for another task cannot publish a Report Version", async (t) => {
  const result = successfulResult();
  result.taskId = "different-task";
  const observer = await fixture(t, result);
  await assert.rejects(observer.produce(request), { code: "uncorrelated-agent-result" });
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
});

test("Claims without a source in this Evidence Bundle cannot be published", async (t) => {
  const result = successfulResult();
  result.stories[0]!.claims[0]!.evidenceIds = ["invented-source"];
  const observer = await fixture(t, result);
  await assert.rejects(observer.produce(request), { code: "unknown-evidence-reference" });
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
});

test("Changed evidence cannot inherit an earlier content hash", async (t) => {
  const input = structuredClone(request);
  input.evidenceBundle.evidence[0]!.content = "改为 99 个观测点。";
  const observer = await fixture(t);
  await assert.rejects(observer.produce(input), { code: "evidence-integrity-failed" });
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
});

test("Evidence outside its declared cutoff snapshot cannot enter a Report Record", async (t) => {
  const input = structuredClone(request);
  input.evidenceBundle.evidence[0]!.retrievedAtUtc = "2026-09-04T23:31:00.000Z";
  const observer = await fixture(t);
  await assert.rejects(observer.produce(input), { code: "invalid-evidence-window" });
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
});

test("Publication rejects incompatible schema versions, invalid dates and non-UTC timestamps", async (t) => {
  const observer = await fixture(t);
  const nextVersion = { ...request, schemaVersion: 2 };
  const invalidDate = { ...request, businessDate: "2026-02-30" };
  const localTime = structuredClone(request);
  localTime.evidenceBundle.cutoffUtc = "2026-09-05T07:30:00.000+08:00";
  for (const input of [nextVersion, invalidDate, localTime]) {
    await assert.rejects(observer.produce(input), { code: "invalid-request" });
  }
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
});

test("A bundle must belong to this date and configuration and have unambiguous Evidence IDs", async (t) => {
  const observer = await fixture(t);
  const differentDate = structuredClone(request);
  differentDate.evidenceBundle.businessDate = "2026-09-04";
  const differentConfiguration = structuredClone(request);
  differentConfiguration.evidenceBundle.configurationId = "other-configuration";
  const duplicateEvidence = structuredClone(request);
  duplicateEvidence.evidenceBundle.evidence.push(structuredClone(duplicateEvidence.evidenceBundle.evidence[0]!));
  for (const input of [differentDate, differentConfiguration, duplicateEvidence]) {
    await assert.rejects(observer.produce(input), { code: "invalid-bundle-identity" });
  }
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
});

test("Invalid, partial and failed Agent responses never create a publication", async (t) => {
  const { stories: _stories, status: _status, ...metadata } = successfulResult();
  const cases: Array<[unknown, string]> = [
    [{ ...successfulResult(), status: "running" }, "agent-invalid-output"],
    [{ ...successfulResult(), usage: { inputTokens: -1 } }, "agent-invalid-output"],
    [{ ...successfulResult(), stories: [] }, "agent-invalid-output"],
    [{ ...metadata, status: "failed", failure: { category: "timeout", retryable: true } }, "agent-timeout"],
    [{ ...metadata, status: "cancelled", failure: { category: "cancelled", retryable: false } }, "agent-cancelled"],
  ];
  for (const [result, code] of cases) {
    const observer = await fixture(t, result);
    await assert.rejects(observer.produce(request), { code });
    assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
  }
});

test("A fixture result must identify its provenance and a valid completed run before publication", async (t) => {
  const cases = [
    { ...successfulResult(), provider: "codex" },
    { ...successfulResult(), startedAtUtc: "2026-09-04T23:35:00.000Z" },
    { ...successfulResult(), finishedAtUtc: "2026-09-05T00:00:00.000Z" },
  ];
  for (const result of cases) {
    const observer = await fixture(t, result);
    await assert.rejects(observer.produce(request), { code: "invalid-fixture-run" });
    assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
  }
});

test("Deterministic input preserves identical version content and existing publication cannot be overwritten", async (t) => {
  const observer = await fixture(t);
  const independentArchive = await fixture(t);
  const version = await observer.produce(request);
  const original = observer.readReport(version.id, ownerToken);
  const independentVersion = await independentArchive.produce(request);
  assert.deepEqual(independentArchive.readReport(independentVersion.id, ownerToken), original);
  await assert.rejects(observer.produce(request), { code: "version-already-exists" });
  const changedRead = observer.readReport(version.id, ownerToken);
  changedRead.record.stories[0]!.title = "This cannot rewrite the archive";
  changedRead.canonicalMarkdown = "This cannot rewrite the body";
  assert.deepEqual(observer.readReport(version.id, ownerToken), original);
});

test("A rejected Runner is classified without publishing its exception text", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-rejection-"));
  const observer = createObserver({
    databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture", clock,
    runner: { run: async () => { throw new Error("provider secret or partial text"); } },
  });
  t.after(async () => { observer.close(); await rm(directory, { recursive: true, force: true }); });
  await assert.rejects(observer.produce(request), { code: "agent-unknown", message: "agent-unknown" });
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
});
