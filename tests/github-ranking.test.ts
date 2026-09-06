import assert from "node:assert/strict";
import { test } from "node:test";
import { githubFixture, repository } from "./helpers/github-fixtures.ts";
import { ownerToken } from "./fixtures.ts";
import { rankGitHub } from "../src/github-ranking.ts";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createObserver } from "../src/observer.ts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

test("GitHub Heat ranks the complete observed candidate set beyond the old seven-item projection and survives authenticated archive restart", async (t) => {
  const app = await githubFixture(t);
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  app.state.repositories = ids.map((id) => repository(id, 1000, 10));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = ids.map((id, index) => repository(id, 1001 + index, 10));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const version = await app.observer.produce({ ...app.request(), schemaVersion: 8 });
  const report = app.observer.readReport(version.id, ownerToken);
  assert.equal(report.record.schemaVersion, 9);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.equal(report.version.schemaVersion, 8);
  assert.equal(report.record.github.watchItems.length, 9);
  assert.equal(report.record.githubRanking.candidates.length, 9);
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["i", "h", "g", "f", "e", "d", "c"]);
  assert.match(report.canonicalMarkdown, /Observer GitHub Heat/);
  assert.match(report.canonicalMarkdown, /stars 净变化 \+9/);
  assert.throws(() => app.observer.readReport(version.id, "wrong"), /unauthorized/);
  app.restartStore();
  assert.deepEqual(app.observer.readReport(version.id, ownerToken), report);
});

test("Saved ranking inputs independently reconstruct every candidate and reject a changed unselected candidate outside the old cap", async (t) => {
  const app = await githubFixture(t);
  app.state.repositories = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((id) => repository(id));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = ["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((id, index) => repository(id, 109 - index));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  const input = { snapshot: report.record.github, interestProfile: report.record.interestProfile, history: report.record.githubRanking.history, algorithmVersion: report.record.githubRanking.algorithmVersion };
  assert.deepEqual(rankGitHub(input), report.record.githubRanking);
  const changed = structuredClone(report.record.github);
  changed.watchItems.find((item) => item.nodeId === "i")!.starsDelta = 99999;
  assert.throws(() => rankGitHub({ ...input, snapshot: changed }), /github-ranking-input-invalid/);
});

test("Only a successfully published stable node establishes cooldown, including a previous unranked Record8 and a later rename", async (t) => {
  const app = await githubFixture(t);
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 105)];
  await app.observations.observeDue();
  const previous = await app.publish();
  app.state.now = "2026-09-05T00:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 105), repository("fresh", 100)];
  await app.observations.observeDue();
  app.state.now = "2026-09-05T23:25:00.000Z";
  app.state.repositories = [{ ...repository("R_fixture", 10000), full_name: "transferred/renamed" }, repository("fresh", 105)];
  await app.observations.observeDue();
  app.state.now = "2026-09-05T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request("2026-09-05T23:30:00.000Z", "2026-09-06"), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["fresh"]);
  assert.equal(report.record.githubRanking.candidates.find((item) => item.nodeId === "R_fixture")?.reason, "cooldown");
  assert.equal(report.record.githubRanking.history.entries[0]?.versionId, previous.version.id);
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Language cohorts let the leading Rust momentum compare with the leading Python momentum without a language quota", async (t) => {
  const app = await githubFixture(t);
  const inputs = [
    { id: "p1", language: "Python", delta: 100 }, { id: "p2", language: "Python", delta: 50 },
    { id: "p3", language: "Python", delta: 20 }, { id: "p4", language: "Python", delta: 1 },
    { id: "r1", language: "Rust", delta: 10 }, { id: "r2", language: "Rust", delta: 5 },
    { id: "r3", language: "Rust", delta: 2 }, { id: "r4", language: "Rust", delta: 1 },
  ];
  app.state.repositories = inputs.map(({ id, language }) => ({ ...repository(id), language }));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = inputs.map(({ id, language, delta }) => ({ ...repository(id, 100 + delta), language }));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["p1", "r1", "p2", "r2", "p3", "r3", "p4"]);
  assert.deepEqual(report.record.githubRanking.candidates.find((item) => item.nodeId === "r1")?.cohort, {
    language: "Rust", age: "30-364d", fallback: "language-age", memberNodeIds: ["r1", "r2", "r3", "r4"],
  });
});

test("A project reported 22 days ago has recovered halfway after cooldown and still pays its real 90-day frequency penalty", async (t) => {
  const app = await githubFixture(t);
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 105)];
  await app.observations.observeDue();
  await app.publish();
  app.state.now = "2026-09-25T23:35:00.000Z";
  app.state.repositories = [repository("R_fixture", 105), repository("fresh", 100)];
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:35:00.000Z";
  app.state.repositories = [repository("R_fixture", 205), repository("fresh", 102)];
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:50:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request("2026-09-26T23:40:00.000Z", "2026-09-27"), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  const item = report.record.githubRanking.candidates.find((item) => item.nodeId === "R_fixture")!;
  assert.equal(item.recoveryMultiplier, 0.5);
  assert.equal(item.frequencyMultiplier, 0.8);
  assert.equal(item.reportCount90d, 1);
  assert.equal(item.novel, false);
  assert.equal(item.score, 0.18);
});

test("Three eligible unreported projects support six actual slots, with no seventh repeat or zero-growth filler", async (t) => {
  const app = await githubFixture(t);
  const old = ["old1", "old2", "old3", "old4", "old5", "old6", "old7"];
  app.state.repositories = old.map((id) => repository(id));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = old.map((id) => repository(id, 105));
  await app.observations.observeDue();
  await app.publish();
  app.state.now = "2026-09-25T23:35:00.000Z";
  app.state.repositories = [...old.map((id) => repository(id, 105)), ...["new1", "new2", "new3", "static"].map((id) => repository(id))];
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:35:00.000Z";
  app.state.repositories = [...old.map((id) => repository(id, 10000)), ...["new1", "new2", "new3"].map((id) => repository(id, 106)), repository("static")];
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:50:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request("2026-09-26T23:40:00.000Z", "2026-09-27"), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.equal(report.record.githubRanking.selectedNodeIds.length, 6);
  assert.equal(report.record.githubRanking.candidates.filter((item) => item.selected && item.novel).length, 3);
  assert.ok(!report.record.githubRanking.selectedNodeIds.includes("static"));
  assert.match(report.canonicalMarkdown, /新颖性配额.*6.*3/);
});

test("Cold-start proxies occupy a separate labeled partition while negative measured momentum and weak cold stocks cannot fill slots", async (t) => {
  const app = await githubFixture(t);
  app.state.repositories = [repository(), repository("declining", 1000000, 1000000)];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 105), repository("declining", 999000, 999999), repository("cold-mega", 1000000000, 100000000), repository("cold-weak", 5, 0), repository("cold-supported", 4, 2)];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["R_fixture", "cold-mega", "cold-supported"]);
  assert.equal(report.record.github.watchItems.find((item) => item.nodeId === "declining")?.starsDelta, -1000);
  assert.equal(report.record.githubRanking.candidates.find((item) => item.nodeId === "cold-mega")?.partition, "cold-start");
  assert.match(report.canonicalMarkdown, /实测动量分区/);
  assert.match(report.canonicalMarkdown, /冷启动代理分区/);
  assert.doesNotMatch(report.canonicalMarkdown, /未计算代理分数/);
});

test("A revoked publication source at exactly 90 days no longer blocks the current independently authorized GitHub edition", async (t) => {
  const app = await githubFixture(t);
  app.credential.expiresAtUtc = "2027-01-01T00:00:00.000Z";
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 105)];
  await app.observations.observeDue();
  const previous = await app.publish();
  app.source.sourceId = "independent-source";
  app.configuration.sourceId = "independent-source";
  app.configuration.version = 2;
  app.state.now = "2026-12-03T23:35:00.000Z";
  await app.observations.observeDue();
  app.state.now = "2026-12-03T23:50:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request("2026-12-03T23:40:00.000Z", "2026-12-04"), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["R_fixture"]);
  assert.deepEqual(report.record.githubRanking.history.unavailableVersionIds, []);
  assert.throws(() => app.observer.readReport(previous.version.id, ownerToken), /not-found/);
});

test("An unverifiable recent publication history produces a visible local GitHub gap rather than treating every repository as novel", async (t) => {
  const app = await githubFixture(t);
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  await app.observations.observeDue();
  const previous = await app.publish();
  app.source.sourceId = "new-source";
  app.configuration.sourceId = "new-source";
  app.configuration.version = 2;
  app.state.now = "2026-09-26T23:35:00.000Z";
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:50:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request("2026-09-26T23:40:00.000Z", "2026-09-27"), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, []);
  assert.deepEqual(report.record.githubRanking.history.unavailableVersionIds, [previous.version.id]);
  assert.match(report.canonicalMarkdown, /Coverage Gap：github-history-unavailable/);
  assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "github-projects" && gap.reason === "github-history-unavailable"));
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Explicit topic priorities and exclusions are frozen before async production, without treating reading languages as programming-language filters", async (t) => {
  const app = await githubFixture(t);
  const profile = { schemaVersion: 1, version: 2, topics: [{ key: " Interpreters ", priority: 100 }], entities: [], regions: [], exclusions: { topics: ["blocked"], entities: [], regions: [] }, coverageLanguages: ["zh"] };
  const path = join(app.directory, "topic-profile.json");
  await writeFile(path, JSON.stringify(profile));
  app.observer.importInterestProfile(path);
  app.state.repositories = [{ ...repository("a"), language: "Python", topics: [] }, { ...repository("b"), language: "Rust", topics: ["interpreters"] }, { ...repository("c"), language: null, topics: ["blocked"] }];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = app.state.repositories.map((raw) => ({ ...(raw as object), stargazers_count: 105 }));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const pending = app.observer.produce({ ...app.request(), schemaVersion: 8 });
  await writeFile(path, JSON.stringify({ ...profile, version: 3, topics: [] }));
  app.observer.importInterestProfile(path);
  const report = app.observer.readReport((await pending).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["b", "a"]);
  assert.equal(report.record.interestProfile.profile.version, 2);
  assert.equal(report.record.githubRanking.candidates.find((item) => item.nodeId === "b")?.interestMultiplier, 1.15);
  assert.equal(report.record.githubRanking.candidates.find((item) => item.nodeId === "c")?.reason, "topic-excluded");
});

test("A repository created after its actual current observation is isolated from age-based ranking without hiding the valid candidate", async (t) => {
  const app = await githubFixture(t);
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [{ ...repository("future", 1000000), created_at: "2026-09-04T23:26:00Z" }, repository("valid")];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["valid"]);
  assert.equal(report.record.githubRanking.candidates.find((item) => item.nodeId === "future")?.reason, "invalid-age");
  assert.match(report.canonicalMarkdown, /invalid-age/);
});

test("Equal raw net changes over different actual observation intervals compare by their disclosed average daily rate", async (t) => {
  const app = await githubFixture(t);
  app.state.now = "2026-09-03T22:35:00.000Z";
  app.state.repositories = [repository("a-long"), repository("b-short")];
  app.state.hook = async (url) => new URL(url).pathname === "/repos/example/b-short" ? { status: 404, headers: {}, body: "" } : undefined;
  await app.observations.observeDue();
  app.state.hook = undefined;
  app.state.now = "2026-09-04T00:25:00.000Z";
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("a-long", 124), repository("b-short", 124)];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["b-short", "a-long"]);
  assert.deepEqual(report.record.github.watchItems.map((item) => [item.nodeId, item.starsDelta, item.historical?.observedAtUtc]), [
    ["a-long", 24, "2026-09-03T22:35:00.000Z"], ["b-short", 24, "2026-09-04T00:25:00.000Z"],
  ]);
  assert.match(report.canonicalMarkdown, /按实际双点间隔折算.*平均速率/);
});

test("Mathematically tied scores use a transitive quantized sort key and opaque node identity rather than binary floating-point residue", async (t) => {
  const app = await githubFixture(t);
  app.state.repositories = [repository("a-stars"), repository("z-balanced")];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("a-stars", 200), repository("z-balanced", 102, 22)];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["a-stars", "z-balanced"]);
  assert.deepEqual(report.record.githubRanking.candidates.map((item) => item.sortKey), [450000000000, 450000000000]);
});

test("Opaque non-ASCII node identities break quantized ties by Unicode code point without changing their stored bytes", async (t) => {
  const app = await githubFixture(t);
  const bmp = "id-\ue000", supplementary = "id-\u{10000}";
  app.state.repositories = [{ ...repository(bmp), full_name: "example/bmp" }, { ...repository(supplementary), full_name: "example/supplementary" }];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = app.state.repositories.map((raw) => ({ ...(raw as object), stargazers_count: 105 }));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, [bmp, supplementary]);
});

test("Corrupt recent GitHub archive evidence becomes a local history gap and does not prevent a readable new brief", async (t) => {
  const app = await githubFixture(t);
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 105)];
  await app.observations.observeDue();
  const previous = await app.publish();
  const damaged = structuredClone(previous);
  damaged.record.github.watchItems[0]!.starsDelta = 99999;
  // External storage fault injection, following the existing archive-corruption fixture.
  // Product expectations use only publication and authenticated reads, never SQL queries.
  const archive = new DatabaseSync(join(app.directory, "reports.sqlite"));
  try {
    archive.exec("DROP TRIGGER immutable_report_update");
    archive.prepare("UPDATE reports SET payload = ? WHERE id = ?").run(JSON.stringify(damaged), previous.version.id);
    archive.exec("CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END;");
  } finally { archive.close(); }
  app.restartStore();
  app.state.now = "2026-09-05T23:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 110), repository("fresh")];
  await app.observations.observeDue();
  app.state.now = "2026-09-05T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request("2026-09-05T23:30:00.000Z", "2026-09-06"), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, []);
  assert.deepEqual(report.record.githubRanking.history.unavailableVersionIds, [previous.version.id]);
  assert.match(report.canonicalMarkdown, /Coverage Gap：github-history-unavailable/);
  assert.equal(report.record.editions.length, 6);
  assert.throws(() => app.observer.readReport(previous.version.id, ownerToken), /canonical-integrity-failed/);
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Archived Heat audit retains fixed rules, score components and current failed-candidate exclusions without reviving an older successful sample", async (t) => {
  const app = await githubFixture(t);
  app.state.repositories = [repository("good"), repository("failed")];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("good", 105), repository("failed", 1000000)];
  app.state.hook = async (url) => new URL(url).pathname === "/repos/example/failed" ? { status: 403, headers: {}, body: "" } : undefined;
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  const ranking = report.record.githubRanking;
  assert.deepEqual(ranking.selectedNodeIds, ["good"]);
  assert.deepEqual(ranking.unranked, [{ nodeId: "failed", status: "quarantined", reason: "github-access-unavailable" }]);
  assert.equal(ranking.rules.starsWeight, 0.6);
  assert.equal(ranking.rules.forksWeight, 0.4);
  assert.equal(ranking.rules.sortScale, 1e12);
  assert.equal(ranking.candidates[0]?.starsPercentile, 0.5);
  assert.equal(ranking.candidates[0]?.forksPercentile, 0);
  assert.equal(ranking.candidates[0]?.selection, "novelty-reserved");
  assert.match(report.canonicalMarkdown, /cohort.*partition/);
  assert.match(report.canonicalMarkdown, /0\.6.*0\.4/);
  assert.deepEqual(rankGitHub({ snapshot: report.record.github, interestProfile: report.record.interestProfile, history: ranking.history, algorithmVersion: ranking.algorithmVersion }), ranking);
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Concurrent writers cannot commit a stale novelty decision after another causal publication commits; retry sees exactly the successful history", async (t) => {
  const app = await githubFixture(t);
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 105)];
  await app.observations.observeDue();
  app.state.now = "2026-09-05T23:25:00.000Z";
  app.state.repositories = [repository("R_fixture", 110), repository("fresh")];
  await app.observations.observeDue();
  const earlierWriter = createObserver({ databasePath: join(app.directory, "reports.sqlite"), ownerToken, mode: "test-fixture",
    clock: () => "2026-09-04T23:40:00.000Z", sourcePolicyReader: () => [app.source], github: app.observations });
  t.after(() => earlierWriter.close());
  app.state.now = "2026-09-05T23:40:00.000Z";
  const laterRequest = { ...app.request("2026-09-05T23:30:00.000Z", "2026-09-06"), schemaVersion: 8 };
  const first = earlierWriter.produce({ ...app.request(), schemaVersion: 8 });
  const stale = app.observer.produce(laterRequest);
  const outcomes = await Promise.allSettled([first, stale]);
  assert.equal(outcomes[0]?.status, "fulfilled");
  assert.equal(outcomes[1]?.status, "rejected");
  if (outcomes[1]?.status === "rejected") assert.equal(outcomes[1].reason.code, "github-publication-input-changed");
  assert.throws(() => app.observer.readReport("2026-09-06-v1", ownerToken), /not-found/);
  const report = app.observer.readReport((await app.observer.produce(laterRequest)).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.history.entries.map((entry) => entry.versionId), ["2026-09-05-v1"]);
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["fresh"]);
  await assert.rejects(app.observer.produce(laterRequest), /version-already-exists/);
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Saved-input replay runs as a standalone public import without first initializing the publication modules", async (t) => {
  const app = await githubFixture(t);
  app.state.now = "2026-09-04T23:25:00.000Z";
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  const path = join(app.directory, "saved-ranking-input.json");
  await writeFile(path, JSON.stringify({ snapshot: report.record.github, interestProfile: report.record.interestProfile, history: report.record.githubRanking.history, algorithmVersion: report.record.githubRanking.algorithmVersion }));
  const output = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", `import { readFileSync } from 'node:fs'; import { rankGitHub } from ${JSON.stringify(new URL("../src/github-ranking.ts", import.meta.url).href)}; console.log(JSON.stringify(rankGitHub(JSON.parse(readFileSync(process.argv[1], 'utf8'))).selectedNodeIds));`, path]);
  assert.deepEqual(JSON.parse(output.stdout), ["R_fixture"]);
});

test("Authenticated reads verify complete historical source dependencies against the actual published record, not a self-consistent empty policy list", async (t) => {
  const app = await githubFixture(t);
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  await app.observations.observeDue();
  await app.publish();
  app.state.now = "2026-09-26T23:25:00.000Z";
  app.state.repositories = [repository("fresh")];
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:40:00.000Z";
  const original = app.observer.readReport((await app.observer.produce({ ...app.request("2026-09-26T23:30:00.000Z", "2026-09-27"), schemaVersion: 8 })).id, ownerToken);
  if (original.record.schemaVersion !== 9 || original.version.schemaVersion !== 8) throw new Error("Heat archive required");
  const damaged = structuredClone({ ...original, record: original.record, version: original.version });
  damaged.record.githubRanking.history.entries[0]!.policies = [];
  damaged.version.reportRecordSha256 = createHash("sha256").update(JSON.stringify(damaged.record)).digest("hex");
  const archive = new DatabaseSync(join(app.directory, "reports.sqlite"));
  try {
    archive.exec("DROP TRIGGER immutable_report_update");
    archive.prepare("UPDATE reports SET payload = ? WHERE id = ?").run(JSON.stringify(damaged), original.version.id);
    archive.exec("CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END;");
  } finally { archive.close(); }
  app.restartStore();
  assert.throws(() => app.observer.readReport(original.version.id, ownerToken), /not-found/);
});

test("Omission audit distinguishes a quota-displaced repeat from a weakly ranked repeat already below ordinary capacity", async (t) => {
  const app = await githubFixture(t);
  const old = ["old1", "old2", "old3", "old4", "old5", "old6", "old7"];
  app.state.repositories = old.map((id) => repository(id));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = old.map((id) => repository(id, 105));
  await app.observations.observeDue();
  await app.publish();
  app.state.now = "2026-09-25T23:35:00.000Z";
  app.state.repositories = [...old.map((id) => repository(id, 105)), ...["new1", "new2", "new3"].map((id) => repository(id))];
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:35:00.000Z";
  app.state.repositories = [...old.map((id) => repository(id, id === "old7" ? 106 : 10000)), ...["new1", "new2", "new3"].map((id) => repository(id, 106))];
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:50:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request("2026-09-26T23:40:00.000Z", "2026-09-27"), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.equal(report.record.githubRanking.candidates.find((item) => item.nodeId === "old4")?.reason, "novelty-quota");
  assert.equal(report.record.githubRanking.candidates.find((item) => item.nodeId === "old7")?.reason, "capacity");
});

test("Zero novel candidates preserve the correct empty selection and expose one selection-shortage gap in the archive, overview and edition after restart", async (t) => {
  const app = await githubFixture(t);
  const ids = ["old1", "old2", "old3", "old4", "old5", "old6", "old7"];
  app.state.repositories = ids.map((id) => repository(id));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = ids.map((id) => repository(id, 105));
  await app.observations.observeDue();
  await app.publish();
  app.state.now = "2026-09-25T23:35:00.000Z";
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:35:00.000Z";
  app.state.repositories = ids.map((id) => repository(id, 205));
  await app.observations.observeDue();
  app.state.now = "2026-09-26T23:50:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request("2026-09-26T23:40:00.000Z", "2026-09-27"), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.equal(report.record.githubRanking.candidates.filter((item) => item.score > 0).length, 7);
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, []);
  assert.deepEqual(report.record.github.reasons, []);
  assert.deepEqual(report.record.coverageGaps.filter((gap) => gap.edition === "github-projects"), [{ edition: "github-projects", reason: "github-selection-insufficient" }]);
  const overview = report.canonicalMarkdown.split("\n").find((line) => line.startsWith("- [GitHub"))!;
  const edition = report.canonicalMarkdown.split("## GitHub 热门项目")[1]!;
  for (const text of [overview, edition]) {
    assert.match(text, /Coverage Gap.*github-selection-insufficient/);
    assert.match(text, /实际 0\/7.*正分合格 7.*未报道的合格项目 0/);
    assert.match(text, /新颖性配额约束/);
    assert.match(text, /不代表来源请求失败/);
  }
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("A sparse nonempty Heat edition discloses the actual eligible and novel counts without adding zero-growth filler", async (t) => {
  const app = await githubFixture(t);
  app.state.repositories = [repository("growing"), repository("static")];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("growing", 105), repository("static")];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["growing"]);
  assert.deepEqual(report.record.coverageGaps.filter((gap) => gap.edition === "github-projects"), [{ edition: "github-projects", reason: "github-selection-insufficient" }]);
  const overview = report.canonicalMarkdown.split("\n").find((line) => line.startsWith("- [GitHub"))!;
  assert.match(overview, /实际 1\/7.*正分合格 1.*未报道的合格项目 1.*筛选后合格候选不足/);
  assert.doesNotMatch(overview, /新颖性配额约束/);
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Selection-shortage reporting preserves a distinct real observation access gap in both the overview and GitHub edition", async (t) => {
  const app = await githubFixture(t);
  app.state.repositories = [repository("good"), repository("denied")];
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [repository("good", 105), repository("denied", 105)];
  app.state.hook = async (url) => new URL(url).pathname === "/repos/example/denied" ? { status: 403, headers: {}, body: "" } : undefined;
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ["good"]);
  assert.deepEqual(report.record.coverageGaps.filter((gap) => gap.edition === "github-projects"), [
    { edition: "github-projects", reason: "github-access-unavailable" }, { edition: "github-projects", reason: "github-selection-insufficient" },
  ]);
  assert.deepEqual(report.record.github.reasons, ["github-access-unavailable"]);
  for (const text of [report.canonicalMarkdown.split("\n").find((line) => line.startsWith("- [GitHub"))!, report.canonicalMarkdown.split("## GitHub 热门项目")[1]!]) {
    assert.match(text, /Coverage Gap.*github-access-unavailable/);
    assert.match(text, /Coverage Gap.*github-selection-insufficient/);
  }
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("A full seven-item Heat selection has no spurious selection-shortage gap", async (t) => {
  const app = await githubFixture(t);
  const ids = ["a", "b", "c", "d", "e", "f", "g"];
  app.state.repositories = ids.map((id) => repository(id));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = ids.map((id) => repository(id, 105));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:40:00.000Z";
  const report = app.observer.readReport((await app.observer.produce({ ...app.request(), schemaVersion: 8 })).id, ownerToken);
  if (report.record.schemaVersion !== 9) throw new Error("Record9 required");
  assert.deepEqual(report.record.githubRanking.selectedNodeIds, ids);
  assert.deepEqual(report.record.coverageGaps.filter((gap) => gap.edition === "github-projects"), []);
  assert.doesNotMatch(report.canonicalMarkdown, /github-selection-insufficient/);
  app.restartStore();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});
