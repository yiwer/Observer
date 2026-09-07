import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGitHubObserver } from "../src/github-observations.ts";
import { createGitHubAdapter } from "../src/github-adapter.ts";
import { createObserver } from "../src/observer.ts";
import { editionNames, PublishedReportSchema } from "../src/contracts.ts";
import { ownerToken } from "./fixtures.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { repository } from "./helpers/github-fixtures.ts";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { rankGitHubRepromotions, githubRepromotionMarkdown } from "../src/github-repromotion.ts";
import { repromotionFixture, publishFirstRelease, ownedAssessment, ownedRelease } from "./helpers/repromotion-fixtures.ts";
import { githubRankingMarkdown } from "../src/github-ranking.ts";
import { consistentArchive } from "../src/archive-integrity.ts";

test("A zero-event Report10 cannot lose its independent capture or downgrade to a coherent Record9 before history checks", async (t) => {
  const fixture = await repromotionFixture(t);
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const original = await fixture.publish("2026-09-06");
  if (original.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(original.record.githubRepromotion.reportedDevelopments, []);
  const { githubDevelopments: _developments, githubRepromotion: _repromotion, ...base } = original.record;
  const record = { ...base, schemaVersion: 9 as const, editorialContract: "observer-canonical-v7" as const };
  const canonicalMarkdown = githubRankingMarkdown(record);
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");
  const downgraded = PublishedReportSchema.parse({ record, canonicalMarkdown, version: { ...original.version, schemaVersion: 8, editorialContract: record.editorialContract,
    reportRecordSha256: sha(JSON.stringify(record)), canonicalMarkdownSha256: sha(canonicalMarkdown) } });
  assert.equal(consistentArchive(downgraded, original.version.id), true, "the forged downgrade is locally valid; the real capture, not a malformed payload, must reject it");
  const fault = new DatabaseSync(fixture.reportPath);
  const actual = fault.prepare("SELECT payload,development_capture_sha256 FROM reports WHERE id=?").get(original.version.id)!;
  fault.exec("DROP TRIGGER immutable_report_update");
  try {
    for (const capture of [null, "0".repeat(64), "unrecognized"]) {
      fault.prepare("UPDATE reports SET development_capture_sha256=? WHERE id=?").run(capture, original.version.id);
      assert.throws(() => fixture.observer.readReport(original.version.id, ownerToken), /integrity/);
    }
    fault.prepare("UPDATE reports SET payload=?,development_capture_sha256=? WHERE id=?").run(JSON.stringify(downgraded), actual.development_capture_sha256!, original.version.id);
    assert.throws(() => fixture.observer.readReport(original.version.id, ownerToken), /integrity/);
    // Even a structurally valid old-version payload may not silently supply
    // ordinary novelty/history under this originally committed Record10 row.
    await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("fresh", 100, 20)]);
    const next = await fixture.publish("2026-09-07");
    if (next.record.schemaVersion !== 10) throw new Error("Record10 required");
    assert.deepEqual(next.record.githubRepromotion.selectedNodeIds, []);
    assert.deepEqual(next.record.githubRanking.history.unavailableVersionIds, [original.version.id]);
    assert.deepEqual(next.record.githubRepromotion.eventHistory.unavailableVersionIds, [original.version.id]);
  } finally {
    fault.prepare("UPDATE reports SET payload=?,development_capture_sha256=? WHERE id=?").run(actual.payload!, actual.development_capture_sha256!, original.version.id);
    fault.exec("CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END"); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(original.version.id, ownerToken), original);
});

test("Capture installation rejects generated and non-null-default columns while preserving an explicit ordinary nullable TEXT column", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-capture-column-owned-"));
  const declarations = ["TEXT GENERATED ALWAYS AS (json_extract(payload, '$.fakeCapture')) VIRTUAL", "TEXT GENERATED ALWAYS AS (NULL) STORED", "TEXT NOT NULL DEFAULT 'unknown'", "TEXT DEFAULT 'NULL'", "INTEGER"];
  for (const [index, declaration] of declarations.entries()) {
    const databasePath = join(directory, `invalid-${index}.sqlite`);
    const setup = new DatabaseSync(databasePath);
    setup.exec(`CREATE TABLE reports(id TEXT PRIMARY KEY,payload TEXT NOT NULL,development_capture_sha256 ${declaration}); PRAGMA user_version=1;`); setup.close();
    assert.throws(() => createObserver({ databasePath, ownerToken, mode: "test-fixture" }), /unsupported-development-capture-storage/);
  }
  const databasePath = join(directory, "valid.sqlite");
  const setup = new DatabaseSync(databasePath);
  setup.exec("CREATE TABLE reports(id TEXT PRIMARY KEY,payload TEXT NOT NULL,development_capture_sha256 TEXT DEFAULT NULL); PRAGMA user_version=1;"); setup.close();
  const observer = createObserver({ databasePath, ownerToken, mode: "test-fixture" });
  t.after(() => observer.close());
  assert.throws(() => observer.readReport("2026-09-06-v1", ownerToken), /not-found/);
});

test("One authenticated report read shares the original-byte allowance across its own run and every actual earlier publication", async (t) => {
  const fixture = await repromotionFixture(t);
  const quote = "旧接口已移除。";
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: quote })) });
  const originals: { slot: string; raw: string }[] = [];
  let latest: Awaited<ReturnType<typeof fixture.publish>> | undefined;
  for (let day = 0; day < 66; day++) {
    const date = new Date(Date.parse("2026-09-05T23:25:00.000Z") + day * 86400000).toISOString();
    fixture.state.releasesByName = { [`example/owned-scope-${day}`]: [ownedRelease(1000 + day, quote)] };
    const run = await fixture.observe(date, [repository(`owned-scope-${day}`, 100, 20)], [ownedRelease(1000 + day, quote)]);
    const businessDate = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
    latest = await fixture.publish(businessDate);
    if (latest.record.schemaVersion !== 10) throw new Error("Record10 required");
    assert.equal(latest.record.githubRepromotion.reportedDevelopments.length, 1);
    originals.push({ slot: run.scheduledAtUtc, raw: JSON.stringify(run) });
  }
  assert.ok(latest);
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const parentBytes = 1024 * 1024 - 1;
  assert.ok(originals.length * parentBytes > 64 * 1024 * 1024);
  try {
    for (const entry of originals) {
      // Legal JSON whitespace changes only physical bytes, not a single field,
      // raw GitHub receipt identity, context membership, or reported expectation.
      assert.ok(Buffer.byteLength(entry.raw) < parentBytes);
      fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(entry.raw + " ".repeat(parentBytes - Buffer.byteLength(entry.raw)), entry.slot);
    }
    assert.throws(() => fixture.observer.readReport(latest!.version.id, ownerToken), /not-found|integrity/);
  } finally {
    for (const entry of originals) fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(entry.raw, entry.slot);
    fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(latest.version.id, ownerToken), latest);
});

test("A complete old Release quote sent for comparison and retained in the new receipt shares the source budget with the new proof", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source.citation.maxCharacters = 46;
  const oldQuote = "The old API is removed.", newQuote = "Use v3 API.";
  assert.equal([...oldQuote].length, 23);
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: oldQuote })) });
  await fixture.observe("2026-09-03T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.observe("2026-09-04T23:25:00.000Z", [repository("repeat", 105, 21)]);
  await fixture.publish("2026-09-05", 8);
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 120, 24), repository("fresh", 100, 20)], [ownedRelease(101, oldQuote)]);
  const first = fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z");
  assert.equal(first.developments.runs[0]!.developments.length, 1);
  const received: string[][] = [];
  fixture.state.assess = async (input) => {
    received.push(input.previous.map((entry) => entry.evidenceExcerpt));
    return { ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: newQuote,
      change: { category: "major-capability", object: "v3 API", scope: "new versioned API" } })) };
  };
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 140, 28), repository("fresh", 125, 25)], [ownedRelease(102, newQuote)]);
  assert.deepEqual(received, [[oldQuote]]);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z");
  assert.equal(snapshot.developments.runs[0]!.assessments[0]!.verification, null);
  assert.deepEqual(snapshot.developments.runs[0]!.assessments[0]!.previous.map((entry) => entry.evidenceExcerpt), [oldQuote]);
  assert.deepEqual(snapshot.developments.runs[0]!.developments, []);
  assert.ok(snapshot.developments.reasons.includes("github-development-citation-limit"));
  const report = await fixture.publish("2026-09-07");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
});

test("A new source cannot charge a prior source's complete Release proof against its own smaller citation allowance", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source.citation.maxCharacters = 46;
  const oldQuote = "The old API is removed.", newQuote = "Use v3 API.";
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: oldQuote })) });
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)], [ownedRelease(101, oldQuote)]);
  assert.equal(fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z").developments.runs[0]!.developments.length, 1);
  fixture.state.additionalSources = [structuredClone(fixture.state.source)];
  fixture.state.source = { ...structuredClone(fixture.state.source), sourceId: "owned-next-source", citation: { ...fixture.state.source.citation, maxCharacters: 22 } };
  fixture.state.configuration = { ...fixture.state.configuration, version: 2, sourceId: fixture.state.source.sourceId };
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, version: 2, sourceId: fixture.state.source.sourceId };
  const received: string[][] = [];
  fixture.state.assess = async (input) => {
    received.push(input.previous.map((entry) => entry.evidenceExcerpt));
    return { ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: newQuote,
      change: { category: "major-capability", object: "v3 API", scope: "new versioned API" } })) };
  };
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 140, 28)], [ownedRelease(102, newQuote)]);
  assert.deepEqual(received, [[oldQuote]]);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z");
  assert.equal(snapshot.developments.runs[0]!.developments[0]!.evidenceExcerpt, newQuote);
  assert.deepEqual(snapshot.developments.runs[0]!.assessments[0]!.previous.map((entry) => entry.evidenceExcerpt), [oldQuote]);
});

test("A single complete routine Release excerpt within 500 codepoints is retained even when non-BMP characters exceed 500 UTF-16 units", async (t) => {
  const fixture = await repromotionFixture(t);
  const quote = `本次仅更换图标：${"🌍".repeat(300)}。`;
  assert.ok([...quote].length < 500 && quote.length > 500);
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry,
    materiality: "routine", change: null, evidenceExcerpt: quote })) });
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)], [ownedRelease(101, quote)]);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z");
  assert.equal(snapshot.developments.runs[0]!.assessments[0]!.verification?.assessments[0]!.evidenceExcerpt, quote);
  assert.deepEqual(snapshot.developments.runs[0]!.developments, []);
});

test("Lifetime consumption retains the exact published development identity without copying its old quotation into each later report", async (t) => {
  const fixture = await repromotionFixture(t);
  const first = await publishFirstRelease(fixture);
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const published = first.record.githubRepromotion.reportedDevelopments[0]!;
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 120, 22)]);
  const next = await fixture.publish("2026-09-07");
  if (next.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(next.record.githubRepromotion.eventHistory.entries[0]!.developments, [{ nodeId: published.nodeId, kind: published.kind, eventId: published.eventId,
    developmentId: published.developmentId, revisionId: published.revisionId, observationId: published.observationId }]);
  assert.deepEqual(next.record.githubRepromotion.reportedDevelopments, []);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(next.version.id, ownerToken), next);
  assert.deepEqual(fixture.observer.readReport(first.version.id, ownerToken), first);
});

test("Publication omits only the complete proof group whose actual record and Markdown copies exceed the source budget while preserving another development and ordinary candidates", async (t) => {
  const fixture = await repromotionFixture(t);
  const longQuote = "The old API is removed. " + "The previous endpoint can no longer be used. ".repeat(3).trimEnd();
  const shortQuote = "旧接口已移除。";
  assert.ok([...longQuote].length * 2 + 14 <= 500 && [...longQuote].length * 5 > 500);
  fixture.state.releasesByName = { "example/aLarge": [ownedRelease(101, longQuote)], "example/zSmall": [ownedRelease(102, shortQuote)] };
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry,
    evidenceExcerpt: input.evidence[0]!.nodeId === "aLarge" ? longQuote : shortQuote })) });
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("aLarge", 100, 20), repository("zSmall", 100, 20)]);
  const original = fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z");
  assert.equal(original.developments.runs[0]!.developments.length, 2);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments.map((entry) => entry.nodeId), ["zSmall"]);
  assert.equal(report.record.githubRepromotion.selectedNodeIds.length, 2);
  assert.ok(!JSON.stringify(report).includes(longQuote));
  assert.ok(report.canonicalMarkdown.includes("github-development-citation-limit"));
  assert.equal(fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z").developments.runs[0]!.id, original.developments.runs[0]!.id);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("Deleting a required publication projection and restoring the genuine full run cannot make an over-budget archive authentic", async (t) => {
  const fixture = await repromotionFixture(t);
  const quote = "The old API is removed. " + "The previous endpoint can no longer be used. ".repeat(3).trimEnd();
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: quote })) });
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)], [ownedRelease(101, quote)]);
  const full = fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z");
  const original = await fixture.publish("2026-09-06");
  const altered = structuredClone(original);
  if (altered.record.schemaVersion !== 10 || altered.version.schemaVersion !== 9) throw new Error("Record10 required");
  assert.deepEqual(altered.record.githubDevelopments.publicationProjection?.omissions, [{ nodeId: "repeat", kind: "release" }]);
  altered.record.githubDevelopments = full.developments;
  altered.record.coverageGaps = altered.record.coverageGaps.filter((entry) => entry.reason !== "github-development-citation-limit");
  altered.record.githubRepromotion = rankGitHubRepromotions({ snapshot: full, interestProfile: altered.record.interestProfile,
    coverageHistory: altered.record.githubRanking.history, eventHistory: altered.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" });
  altered.canonicalMarkdown = githubRepromotionMarkdown(altered.record);
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");
  altered.version.reportRecordSha256 = sha(JSON.stringify(altered.record)); altered.version.canonicalMarkdownSha256 = sha(altered.canonicalMarkdown);
  const fault = new DatabaseSync(fixture.reportPath);
  fault.exec("DROP TRIGGER immutable_report_update");
  try {
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(altered), original.version.id);
    assert.throws(() => fixture.observer.readReport(original.version.id, ownerToken), /not-found|integrity/);
  } finally {
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(original), original.version.id);
    fault.exec("CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END"); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(original.version.id, ownerToken), original);
});

test("A shared damaged origin with lawful short quotations is unknown once and cannot exhaust a separate healthy project's development context budget", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.source.sourceId = "owned-capacity-" + "s".repeat(175);
  fixture.state.configuration.sourceId = fixture.state.source.sourceId;
  fixture.state.developmentConfiguration.sourceId = fixture.state.source.sourceId;
  const damaged = Array.from({ length: 29 }, (_, index) => `a${String(index).padStart(2, "0")}`);
  // Versioned replacement after the shared citation rule: each node has just
  // one material/short quote; other releases contribute bounded API metadata.
  const releases = Array.from({ length: 10 }, (_, index) => ({ ...ownedRelease(100 + index, "旧接口已移除。"),
    tag_name: "版".repeat(1000), node_id: "释".repeat(190) + index }));
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry, index) => ({ ...entry,
    materiality: index === 0 ? "major" : "routine",
    change: index === 0 ? { category: "breaking-interface", object: "Owned scope " + "域".repeat(180), scope: "新".repeat(500) } : null, evidenceExcerpt: index === 0 ? "旧接口已移除。" : "" })) });
  fixture.state.releasesByName = Object.fromEntries(damaged.map((node) => [`example/${node}`, releases]));
  const damagedRun = await fixture.observe("2026-09-05T23:25:00.000Z", damaged.map((node) => repository(node, 100, 20)));
  const originalSnapshot = fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z");
  assert.equal(originalSnapshot.developments.runs[0]!.developments.length, 29);
  const damagedBytes = Buffer.byteLength(JSON.stringify(originalSnapshot.developments.runs[0]));
  assert.ok(damagedBytes > 1_400_000);
  const healthy = [...Array.from({ length: 28 }, (_, index) => `h${index}`), "zHealthy"];
  fixture.state.releasesByName = Object.fromEntries(healthy.map((node) => [`example/${node}`, releases]));
  const healthyRun = await fixture.observe("2026-09-06T00:25:00.000Z", healthy.map((node) => repository(node, 100, 20)));
  const healthySnapshot = fixture.observations.repromotionSnapshot!("2026-09-06T00:30:00.000Z");
  assert.equal(healthySnapshot.developments.runs[0]!.developments.length, 29);
  const healthyBytes = Buffer.byteLength(JSON.stringify(healthySnapshot.developments.runs[0]));
  assert.ok(healthyBytes > 1_400_000);
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const slot = damagedRun.scheduledAtUtc;
  const original = fault.prepare("SELECT payload FROM runs WHERE slot=?").get(slot)!.payload!;
  const healthyOriginal = fault.prepare("SELECT payload FROM runs WHERE slot=?").get(healthyRun.scheduledAtUtc)!.payload!;
  // Owned storage fault: valid bounded JSON, but not the real parent receipt. No product helper or oracle is replaced.
  const damagedParent = `${JSON.stringify({ ...damagedRun, id: "0".repeat(64) })}${" ".repeat(900 * 1024)}`;
  const healthyParent = `${healthyOriginal}${" ".repeat(900 * 1024)}`;
  t.diagnostic(JSON.stringify({ damagedDevelopmentBytes: damagedBytes, healthyDevelopmentBytes: healthyBytes,
    damagedParentBytes: Buffer.byteLength(damagedParent), healthyParentBytes: Buffer.byteLength(healthyParent), materialOriginsPerRun: 29, retainedQuoteCodepointsPerRun: 406 }));
  fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(damagedParent, slot);
  fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(healthyParent, healthyRun.scheduledAtUtc);
  const received: string[] = [];
  fixture.state.assess = async (input) => { received.push(input.evidence[0]!.nodeId); return ownedAssessment(input); };
  fixture.state.releasesByName = Object.fromEntries([...damaged, "zHealthy"].map((node) => [`example/${node}`, [ownedRelease(1001)]]));
  try {
    await fixture.observe("2026-09-06T23:25:00.000Z", [...damaged, "zHealthy"].map((node) => repository(node, 120, 24)));
    assert.deepEqual(received, ["zHealthy"]);
  } finally {
    fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(original, slot);
    fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(healthyOriginal, healthyRun.scheduledAtUtc); fault.close();
  }
});

test("A current parent receipt over the original-run byte cap makes its dependent archive unavailable and recovery never resets its consumed development", async (t) => {
  const fixture = await repromotionFixture(t);
  const report = await publishFirstRelease(fixture);
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  const slot = report.record.githubDevelopments.runs[0]!.slot;
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const original = String(fault.prepare("SELECT payload FROM runs WHERE slot=?").get(slot)!.payload);
  try {
    // Whitespace does not alter JSON's value, but it is still real input bytes.
    fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(original.padEnd(1024 * 1024 + 1, " "), slot);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found/);
  } finally { fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(original, slot); fault.close(); }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 120, 22)], [ownedRelease()]);
  const next = await fixture.publish("2026-09-07");
  if (next.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(next.record.githubRepromotion.reportedDevelopments, []);
});

test("A material stable Release bypasses only recovery after real publication and remains the same authenticated development after restart and a legacy request", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-repromotion-"));
  const source = { ...policy(), sourceId: "github-development-fixture", edition: "github-projects", feedUrl: "https://api.github.com",
    review: { ...policy().review, reviewedAtUtc: "2026-09-01T00:00:00.000Z" },
    collection: { ...policy().collection, readBody: true }, model: { enabled: true, fields: ["url", "title", "content", "contentSha256"] },
    citation: { ...policy().citation, maxCharacters: 500 },
    github: { allowedQueries: ["topic:owner-fixture"], allowApiResponseProcessing: true, allowRepositorySnapshots: true, allowIdentityHistory: true,
      allowDerivedPublication: true, irrevocableExportAllowed: true, deletionScope: "raw-only",
      events: { schemaVersion: 1, allowReleaseMetadata: true, allowAdvisoryMetadata: false, allowReleaseBodyProcessing: true,
        allowMaterialityModelProcessing: true, allowMaterialEvidenceProjection: true, allowEventIdentityHistory: true } } };
  const configuration = { schemaVersion: 1, version: 1, sourceId: source.sourceId, queries: ["topic:owner-fixture"] };
  const developmentConfiguration = { schemaVersion: 1, version: 1, sourceId: source.sourceId, releases: true };
  let now = "2026-09-03T23:25:00.000Z";
  let repositories = [repository("repeat", 100, 20)];
  let releases: unknown[] = [];
  const adapter = createGitHubAdapter({ read: async (url) => {
    const path = new URL(url).pathname;
    const result = path === "/search/repositories" ? { total_count: repositories.length, incomplete_results: false, items: repositories } :
      path.endsWith("/releases") ? path === "/repos/example/repeat/releases" ? releases : [] :
      repositories.find((entry) => entry.full_name === path.slice("/repos/".length));
    return { status: 200, headers: {}, body: JSON.stringify(result) };
  } });
  const storeOptions = { databasePath: join(directory, "observations.sqlite"), configuration: () => configuration, developmentConfiguration: () => developmentConfiguration,
    policies: () => [source], clock: () => now, adapter,
    credential: () => ({ kind: "fine-grained-pat", token: "github_pat_OWNED_FIXTURE_SECRET", expiresAtUtc: "2026-10-01T00:00:00.000Z", repositoryAccess: "public-only", permissions: "metadata-read-only" }),
    developmentVerifier: { async assess(input: { inputSha256: string; evidence: { observationId: string }[] }) {
      return { schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-materiality-v1",
        assessments: input.evidence.map((entry) => ({ observationId: entry.observationId, conclusion: "supported", materiality: "major",
          change: { category: "breaking-interface", object: "legacy search endpoint", scope: "removal of the legacy search contract" },
          evidenceExcerpt: "This release removes the legacy search endpoint.", relation: { kind: "new-material", previousDevelopmentId: null } })) };
    } } };
  let observations = createGitHubObserver(storeOptions);
  const observerOptions = { databasePath: join(directory, "reports.sqlite"), ownerToken, mode: "test-fixture" as const, clock: () => now, sourcePolicyReader: () => [source] };
  let observer = createObserver({ ...observerOptions, github: observations });
  t.after(() => { observer.close(); observations.close(); });
  const profilePath = join(directory, "profile.json");
  await writeFile(profilePath, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  observer.importInterestProfile(profilePath);
  const request = (schemaVersion: number, businessDate: string, cutoffUtc: string) => ({ schemaVersion, taskId: `release-${businessDate}`, businessDate, configurationId: "owned-development",
    evidenceBundle: { schemaVersion: 2, id: `release-${businessDate}`, businessDate, configurationId: "owned-development", windowStartUtc: new Date(Date.parse(cutoffUtc) - 86400000).toISOString(), cutoffUtc, evidence: [], coverageGaps: [] },
    editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: [] })) });
  await observations.observeDue();
  now = "2026-09-04T23:25:00.000Z";
  repositories = [repository("repeat", 105, 21)];
  await observations.observeDue();
  now = "2026-09-04T23:40:00.000Z";
  await observer.produce(request(8, "2026-09-05", "2026-09-04T23:30:00.000Z"));
  now = "2026-09-05T00:25:00.000Z";
  repositories = [repository("repeat", 105, 21), repository("novel", 100, 20)];
  await observations.observeDue();
  now = "2026-09-05T23:25:00.000Z";
  repositories = [repository("repeat", 130, 25), repository("novel", 108, 22)];
  releases = [{ id: 101, node_id: "RE_owned_101", name: "Stable release", tag_name: "v2.0.0", target_commitish: "main", draft: false, prerelease: false,
    created_at: "2026-09-05T20:00:00Z", published_at: "2026-09-05T21:00:00Z", body: "This release removes the legacy search endpoint.\n\nUnneeded full release appendix must not be retained." }];
  await observations.observeDue();
  now = "2026-09-05T23:40:00.000Z";
  const version = await observer.produce(request(9, "2026-09-06", "2026-09-05T23:30:00.000Z"));
  const report = observer.readReport(version.id, ownerToken);
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.version.schemaVersion, 9);
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["repeat", "novel"]);
  const repeated = report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(repeated.ordinaryScore, 0);
  assert.equal(repeated.recoveryMultiplier, 0);
  assert.equal(repeated.effectiveRecoveryMultiplier, 1);
  assert.equal(repeated.frequencyMultiplier, 0.8);
  assert.equal(report.record.githubRepromotion.quota.requiredNovel, 1);
  assert.equal(report.record.githubRepromotion.quota.selectedNovel, 1);
  assert.equal(report.record.githubRepromotion.reportedDevelopments.length, 1);
  const development = report.record.githubRepromotion.reportedDevelopments[0]!;
  assert.equal(development.nodeId, "repeat");
  assert.ok(report.canonicalMarkdown.includes(development.developmentId));
  assert.match(report.canonicalMarkdown, /重大稳定 Release/);
  assert.match(report.canonicalMarkdown, /维护者声明/);
  assert.doesNotMatch(JSON.stringify(report), /Unneeded full release appendix/);
  assert.throws(() => observer.readReport(version.id, "wrong"), /unauthorized/);
  observer.close(); observations.close();
  observations = createGitHubObserver(storeOptions);
  observer = createObserver({ ...observerOptions, github: observations });
  assert.deepEqual(observer.readReport(version.id, ownerToken), report);
  now = "2026-09-06T23:25:00.000Z";
  repositories = [repository("repeat", 140, 26), repository("novel", 118, 23)];
  await observations.observeDue();
  now = "2026-09-06T23:40:00.000Z";
  const legacy = observer.readReport((await observer.produce(request(8, "2026-09-07", "2026-09-06T23:30:00.000Z"))).id, ownerToken);
  if (legacy.record.schemaVersion !== 9) throw new Error("Legacy Record9 required");
  assert.deepEqual(legacy.record.githubRanking.history.entries.find((entry) => entry.versionId === version.id)?.nodeIds, ["repeat", "novel"]);
  assert.deepEqual(legacy.record.githubRanking.selectedNodeIds, []);
});

test("Disabling the frozen development configuration during a Release response prevents material from crossing the external verifier seam", async (t) => {
  const fixture = await repromotionFixture(t);
  const received: string[] = [];
  fixture.state.assess = async (input) => { received.push(...input.evidence.map((entry) => entry.body)); return ownedAssessment(input); };
  fixture.state.onRead = (url) => {
    if (new URL(url).pathname.endsWith("/releases")) fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, version: 2, releases: false };
  };
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 130, 25)], [ownedRelease()]);
  assert.deepEqual(received, []);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  assert.doesNotMatch(report.canonicalMarkdown, /This release removes/);
});

test("Authenticated reading rejects a coherently rewritten event history that omits the actual development from the earlier publication", async (t) => {
  const fixture = await repromotionFixture(t);
  await publishFirstRelease(fixture);
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22), repository("next", 100, 20)]);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("novel", 115, 24), repository("next", 120, 22)]);
  const original = await fixture.publish("2026-09-07");
  if (original.record.schemaVersion !== 10 || original.version.schemaVersion !== 9) throw new Error("Record10 required");
  const altered = structuredClone(original);
  if (altered.record.schemaVersion !== 10 || altered.version.schemaVersion !== 9) throw new Error("Record10 required");
  altered.record.githubRepromotion.eventHistory.entries[0]!.developments = [];
  altered.record.githubRepromotion = rankGitHubRepromotions({ snapshot: { schemaVersion: 1, github: altered.record.github, developments: altered.record.githubDevelopments },
    interestProfile: altered.record.interestProfile, coverageHistory: altered.record.githubRanking.history, eventHistory: altered.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" });
  altered.canonicalMarkdown = githubRepromotionMarkdown(altered.record);
  const sha = (value: string) => createHash("sha256").update(value).digest("hex");
  altered.version.reportRecordSha256 = sha(JSON.stringify(altered.record));
  altered.version.canonicalMarkdownSha256 = sha(altered.canonicalMarkdown);
  const fault = new DatabaseSync(fixture.reportPath);
  fault.exec("DROP TRIGGER immutable_report_update");
  try {
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(altered), original.version.id);
    assert.throws(() => fixture.observer.readReport(original.version.id, ownerToken), /not-found|integrity/);
  } finally {
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(original), original.version.id);
    fault.exec("CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END");
    fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(original.version.id, ownerToken), original);
});

test("An archived Release assessment cannot erase its real frozen previous context and authorize itself with newly consistent hashes", async (t) => {
  const fixture = await repromotionFixture(t);
  await publishFirstRelease(fixture);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("next", 120, 22)]);
  const original = await fixture.publish("2026-09-07");
  const altered = structuredClone(original);
  if (altered.record.schemaVersion !== 10 || altered.version.schemaVersion !== 9) throw new Error("Record10 required");
  const sha = (value: string) => createHash("sha256").update(value).digest("hex");
  const run = altered.record.githubDevelopments.runs[0]!;
  assert.ok(run.assessments.some((entry) => entry.previous.length > 0));
  for (const receipt of run.assessments) {
    receipt.previous = []; receipt.previousEvidence = [];
    receipt.inputSha256 = sha(JSON.stringify({ schemaVersion: 1, evidence: receipt.evidenceIds.map((id) => run.evidence.find((entry) => entry.observationId === id)), previous: [], previousEvidence: [], contextFreeze: receipt.contextFreeze }));
    if (receipt.verification) receipt.verification.inputSha256 = receipt.inputSha256;
  }
  const { id: _id, ...metadata } = run; run.id = sha(JSON.stringify(metadata));
  altered.record.githubRepromotion = rankGitHubRepromotions({ snapshot: { schemaVersion: 1, github: altered.record.github, developments: altered.record.githubDevelopments },
    interestProfile: altered.record.interestProfile, coverageHistory: altered.record.githubRanking.history, eventHistory: altered.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" });
  altered.canonicalMarkdown = githubRepromotionMarkdown(altered.record);
  altered.version.reportRecordSha256 = sha(JSON.stringify(altered.record)); altered.version.canonicalMarkdownSha256 = sha(altered.canonicalMarkdown);
  const fault = new DatabaseSync(fixture.reportPath);
  fault.exec("DROP TRIGGER immutable_report_update");
  try {
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(altered), original.version.id);
    assert.throws(() => fixture.observer.readReport(original.version.id, ownerToken), /not-found|integrity/);
  } finally {
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(original), original.version.id);
    fault.exec("CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END"); fault.close();
  }
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(original.version.id, ownerToken), original);
});

test("A missing installed context-index state cannot be recreated as unseen history after restart", async (t) => {
  const fixture = await repromotionFixture(t);
  await publishFirstRelease(fixture);
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  fault.exec("DROP TABLE IF EXISTS context_index_state");
  fault.prepare("INSERT OR IGNORE INTO authorities(id,version,digest) VALUES('development-context-index',1,?)").run("0".repeat(64));
  fault.close(); fixture.restart();
  const received: unknown[] = [];
  fixture.state.assess = async (input) => { received.push(input); return ownedAssessment(input); };
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("next", 120, 22)], [ownedRelease(202)]);
  assert.deepEqual(received, []);
  const report = await fixture.publish("2026-09-07");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.match(report.canonicalMarkdown, /github-development-history-unavailable/);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
});

test("Losing a frozen context member invalidates an existing archive even when the current run and Report hashes are untouched", async (t) => {
  const fixture = await repromotionFixture(t);
  await publishFirstRelease(fixture);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("next", 120, 22)]);
  const report = await fixture.publish("2026-09-07");
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  fault.prepare("DELETE FROM development_contexts WHERE node_id=?").run("repeat"); fault.close();
  assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
});

test("A damaged development index rejects its dependent archive while unrelated ordinary novel projects remain publishable with intact actual coverage history", async (t) => {
  const fixture = await repromotionFixture(t);
  await publishFirstRelease(fixture);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("next", 120, 22)]);
  const dependent = await fixture.publish("2026-09-07");
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  fault.prepare("DELETE FROM development_contexts WHERE node_id=?").run("repeat"); fault.close();
  assert.throws(() => fixture.observer.readReport(dependent.version.id, ownerToken), /not-found|integrity/);
  const received: unknown[] = [];
  fixture.state.assess = async (input) => { received.push(input); return ownedAssessment(input); };
  await fixture.observe("2026-09-07T00:25:00.000Z", [repository("D", 100, 20), repository("E", 100, 20)]);
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("D", 110, 22), repository("E", 110, 22)]);
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(received, []);
  assert.deepEqual(report.record.githubRanking.history.unavailableVersionIds, []);
  assert.deepEqual(report.record.githubRanking.history.entries.find((entry) => entry.versionId === "2026-09-06-v1")?.nodeIds, ["repeat", "novel"]);
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["D", "E"]);
  assert.match(report.canonicalMarkdown, /github-development-history-unavailable/);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
});

test("An archived first Release requires its actual current parent GitHub run, even when its frozen previous context was empty", async (t) => {
  const fixture = await repromotionFixture(t);
  const report = await publishFirstRelease(fixture);
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  fault.prepare("DELETE FROM runs WHERE slot=?").run(report.record.githubDevelopments.runs[0]!.slot); fault.close();
  assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found|integrity/);
});

test("A restarted observer rejects same-version event capability edits and configuration rollbacks before sending Release material", async (t) => {
  const fixture = await repromotionFixture(t);
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, releases: false };
  await fixture.observe("2026-09-05T21:25:00.000Z", [repository("repeat", 100, 20)]);
  fixture.restart();
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, releases: true };
  const received: string[] = [];
  fixture.state.assess = async (input) => { received.push(...input.evidence.map((entry) => entry.body)); return ownedAssessment(input); };
  await fixture.observe("2026-09-05T22:25:00.000Z", [repository("repeat", 101, 20)], [ownedRelease()]);
  assert.deepEqual(received, []);
  assert.ok(fixture.observations.repromotionSnapshot("2026-09-05T22:30:00.000Z").developments.reasons.includes("github-configuration-version-conflict"));
  fixture.state.developmentConfiguration.version = 2;
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 130, 25)]);
  assert.equal(received.length, 1);
  fixture.restart();
  fixture.state.developmentConfiguration.version = 1;
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 131, 25)]);
  assert.equal(received.length, 1);
  assert.ok(fixture.observations.repromotionSnapshot("2026-09-06T00:30:00.000Z").developments.reasons.includes("github-configuration-version-conflict"));
});

test("A legacy metadata-only Source Policy keeps ordinary Heat available while disclosing unavailable Release capability without reading Release bodies", async (t) => {
  const fixture = await repromotionFixture(t);
  delete fixture.state.source.github!.events;
  const releaseRequests: string[] = [];
  fixture.state.onRead = (url) => { if (new URL(url).pathname.endsWith("/releases")) releaseRequests.push(url); };
  await fixture.observe("2026-09-04T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 130, 25)], [ownedRelease()]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["repeat"]);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  assert.deepEqual(releaseRequests, []);
  assert.match(report.canonicalMarkdown, /github-development-permission-unavailable/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A renamed description and new Release ID reuse the previously reported material development through the verified historical context", async (t) => {
  const fixture = await repromotionFixture(t);
  const prior = await publishFirstRelease(fixture);
  fixture.restart();
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: input.evidence.map((entry) => ({ observationId: entry.observationId, conclusion: "supported", materiality: "major",
    change: { category: "breaking-interface", object: "old search interface", scope: "previous-generation search API retirement" }, evidenceExcerpt: "The old search interface is retired.",
    relation: input.previous.length ? { kind: "same", previousDevelopmentId: input.previous[0]!.developmentId } : { kind: "new-material", previousDevelopmentId: null } })) });
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22), repository("next", 100, 20)], []);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("novel", 115, 24), repository("next", 120, 22)], [ownedRelease(202, "The old search interface is retired.")]);
  const report = await fixture.publish("2026-09-07");
  if (report.record.schemaVersion !== 10 || prior.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["next"]);
  assert.equal(report.record.githubDevelopments.runs[0]!.developments[0]!.developmentId, prior.record.githubRepromotion.reportedDevelopments[0]!.developmentId);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A material revision can be reported once while an A to B to A Release rollback cannot restore the consumed development", async (t) => {
  const fixture = await repromotionFixture(t);
  const first = await publishFirstRelease(fixture);
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: input.evidence.map((entry) => {
    const upgraded = entry.body.includes("distributed query engine");
    const prior = input.previous.find((item) => item.change.object === (upgraded ? "distributed query engine" : "legacy search endpoint"));
    return { observationId: entry.observationId, conclusion: "supported", materiality: "major",
      change: upgraded ? { category: "major-capability", object: "distributed query engine", scope: "new multi-node query execution" } :
        { category: "breaking-interface", object: "legacy search endpoint", scope: "removal of the legacy search contract" },
      evidenceExcerpt: upgraded ? "This release adds the distributed query engine." : "This release removes the legacy search endpoint.",
      relation: prior ? { kind: "same", previousDevelopmentId: prior.developmentId } : { kind: "new-material", previousDevelopmentId: input.previous[0]?.developmentId ?? null } };
  }) });
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22), repository("next", 100, 20)], []);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("novel", 115, 24), repository("next", 120, 22)], [ownedRelease(101, "This release adds the distributed query engine.")]);
  const second = await fixture.publish("2026-09-07");
  if (first.record.schemaVersion !== 10 || second.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(second.record.githubRepromotion.reportedDevelopments.length, 1);
  assert.notEqual(second.record.githubRepromotion.reportedDevelopments[0]!.developmentId, first.record.githubRepromotion.reportedDevelopments[0]!.developmentId);
  assert.equal(second.record.githubRepromotion.reportedDevelopments[0]!.eventId, first.record.githubRepromotion.reportedDevelopments[0]!.eventId);
  fixture.restart();
  await fixture.observe("2026-09-07T00:25:00.000Z", [repository("repeat", 160, 30), repository("novel", 115, 24), repository("next", 120, 22), repository("fresh", 100, 20)], []);
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 190, 35), repository("novel", 123, 26), repository("next", 140, 24), repository("fresh", 120, 22)], [ownedRelease()]);
  const third = await fixture.publish("2026-09-08");
  if (third.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(third.record.githubRepromotion.reportedDevelopments, []);
  assert.deepEqual(third.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  assert.equal(third.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!.eventReason, "already-reported");
});

test("Stable flags and a major-looking tag do not promote a routine Release and the materiality limitation is visible in the brief", async (t) => {
  const fixture = await repromotionFixture(t);
  await publishFirstRelease(fixture);
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, materiality: "routine", change: null })) });
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22), repository("next", 100, 20)], []);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("novel", 115, 24), repository("next", 120, 22)], [{ ...ownedRelease(999), tag_name: "v100.0.0", name: "MAJOR RELEASE" }]);
  const report = await fixture.publish("2026-09-07");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["next"]);
  assert.match(report.canonicalMarkdown, /github-release-not-material/);
});

test("A newly authorized source cannot send a previous source's revoked development projection to the verifier or reset its consumed history", async (t) => {
  const fixture = await repromotionFixture(t);
  const first = await publishFirstRelease(fixture);
  const oldSource = fixture.state.source;
  fixture.state.source = { ...structuredClone(oldSource), sourceId: "new-development-source" };
  fixture.state.additionalSources = [oldSource];
  fixture.state.configuration = { ...fixture.state.configuration, version: 2, sourceId: fixture.state.source.sourceId };
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, version: 2, sourceId: fixture.state.source.sourceId };
  oldSource.model.enabled = false;
  const received: unknown[] = [];
  fixture.state.assess = async (input) => { received.push(input); return ownedAssessment(input); };
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 130, 25), repository("next", 100, 20)], []);
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("next", 120, 22)], [ownedRelease(202)]);
  const report = await fixture.publish("2026-09-07");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(received, []);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  assert.ok(report.record.githubRepromotion.eventHistory.unavailableVersionIds.includes(first.version.id));
  assert.match(report.canonicalMarkdown, /github-development-history-unavailable/);
  assert.throws(() => fixture.observer.readReport(first.version.id, ownerToken), /not-found/);
});

test("An invalid typed dependency header cannot expose an embedded old-source projection through snapshot, archive or the next verifier input", async (t) => {
  const fixture = await repromotionFixture(t);
  await publishFirstRelease(fixture);
  const oldSource = fixture.state.source;
  fixture.state.source = { ...structuredClone(oldSource), sourceId: "new-development-source" };
  fixture.state.additionalSources = [oldSource];
  fixture.state.configuration = { ...fixture.state.configuration, version: 2, sourceId: fixture.state.source.sourceId };
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, version: 2, sourceId: fixture.state.source.sourceId };
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 130, 25), repository("next", 100, 20)], []);
  const current = await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 160, 30), repository("next", 120, 22)], [ownedRelease(202)]);
  const report = await fixture.publish("2026-09-07");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubDevelopments.runs[0]!.assessments[0]!.previousEvidence[0]!.evidence.policy.sourceId, oldSource.sourceId);
  oldSource.model.enabled = false;
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const row = fault.prepare("SELECT dependency_policies FROM development_runs WHERE slot=?").get(current.scheduledAtUtc)!;
  const dependencies = JSON.parse(String(row.dependency_policies)) as { sourceId: string }[];
  fault.prepare("UPDATE development_runs SET dependency_policies=? WHERE slot=?")
    .run(JSON.stringify(dependencies.filter((entry) => entry.sourceId !== oldSource.sourceId)), current.scheduledAtUtc);
  const received: unknown[] = [];
  fixture.state.assess = async (input) => { received.push(input); return ownedAssessment(input); };
  try {
    assert.deepEqual(fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z").developments.runs, []);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found/);
    await fixture.observe("2026-09-07T00:25:00.000Z", [repository("repeat", 170, 32)], [ownedRelease(303)]);
    assert.deepEqual(received, []);
  } finally {
    fault.prepare("UPDATE development_runs SET dependency_policies=? WHERE slot=?").run(row.dependency_policies!, current.scheduledAtUtc); fault.close();
  }
});

test("Three novel projects limit seven qualified candidates to six places and only the three visible Release developments are consumed", async (t) => {
  const fixture = await repromotionFixture(t);
  // Quota fixture v2: a complete short quotation keeps all four real old/new
  // comparisons within the shared source budget; business expectations stay.
  const quote = "The old API is removed.";
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: quote })) });
  const repeated = ["r1", "r2", "r3", "r4"];
  const novel = ["n1", "n2", "n3"];
  await fixture.observe("2026-09-03T23:25:00.000Z", repeated.map((node) => repository(node, 100, 20)));
  await fixture.observe("2026-09-04T23:25:00.000Z", repeated.map((node) => repository(node, 105, 21)));
  await fixture.publish("2026-09-05", 8);
  await fixture.observe("2026-09-05T00:25:00.000Z", [...repeated.map((node) => repository(node, 105, 21)), ...novel.map((node) => repository(node, 100, 20))]);
  fixture.state.releasesByName = Object.fromEntries(repeated.map((node, index) => [`example/${node}`, [ownedRelease(101 + index, quote)]]));
  await fixture.observe("2026-09-05T23:25:00.000Z", [...repeated.map((node) => repository(node, 135, 26)), ...novel.map((node) => repository(node, 120, 22))]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.quota.actual, 6);
  assert.equal(report.record.githubRepromotion.quota.selectedNovel, 3);
  assert.equal(report.record.githubRepromotion.reportedDevelopments.length, 3);
  const selectedNodes = report.record.githubRepromotion.selectedNodeIds;
  const waiting = repeated.find((node) => !selectedNodes.includes(node))!;
  assert.ok(waiting);
  assert.ok(report.record.githubRepromotion.reportedDevelopments.every((development) => report.canonicalMarkdown.includes(development.developmentId)));
  assert.ok(!report.canonicalMarkdown.includes(report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === waiting)!.developments[0]!.developmentId));
  fixture.restart();
  await fixture.observe("2026-09-06T00:25:00.000Z", [...repeated.map((node) => repository(node, 135, 26)), ...novel.map((node) => repository(node, 120, 22)), repository("fresh", 100, 20)]);
  await fixture.observe("2026-09-06T23:25:00.000Z", [...repeated.map((node) => repository(node, 165, 31)), ...novel.map((node) => repository(node, 140, 24)), repository("fresh", 120, 22)]);
  const next = await fixture.publish("2026-09-07");
  if (next.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(next.record.githubRepromotion.reportedDevelopments.map((entry) => entry.nodeId), [waiting]);
  assert.equal(next.record.githubRepromotion.quota.actual, 2);
});

test("A failed Report INSERT leaves a Release available for retry and a later same-day conflict does not change the successful immutable report", async (t) => {
  const fixture = await repromotionFixture(t);
  await fixture.observe("2026-09-03T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.observe("2026-09-04T23:25:00.000Z", [repository("repeat", 105, 21)]);
  await fixture.publish("2026-09-05", 8);
  await fixture.observe("2026-09-05T00:25:00.000Z", [repository("repeat", 105, 21), repository("novel", 100, 20)]);
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)], [ownedRelease()]);
  const fault = new DatabaseSync(fixture.reportPath);
  fault.exec("CREATE TRIGGER owned_failure BEFORE INSERT ON reports BEGIN SELECT RAISE(ABORT, 'owned insertion failure'); END");
  try { await assert.rejects(fixture.publish("2026-09-06"), /owned insertion failure/); }
  finally { fault.exec("DROP TRIGGER owned_failure"); fault.close(); }
  assert.throws(() => fixture.observer.readReport("2026-09-06-v1", ownerToken), /not-found/);
  fixture.restart();
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments.length, 1);
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["repeat", "novel"]);
  await assert.rejects(fixture.publish("2026-09-06"), /version-already-exists/);
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});
