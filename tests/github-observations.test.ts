import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createObserver } from "../src/observer.ts";
import { createGitHubObserver } from "../src/github-observations.ts";
import { createGitHubAdapter } from "../src/github-adapter.ts";
import { editionNames } from "../src/contracts.ts";
import { ownerToken } from "./fixtures.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { githubFixture, repository as metadata } from "./helpers/github-fixtures.ts";

test("Owned official metadata observations survive rename and SQLite restart as an authenticated Watch Item with real +5 stars and -2 forks", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-github-"));
  let now = "2026-09-03T23:25:00.000Z";
  let repository = { node_id: "R_owner_fixture", full_name: "example/old-name", private: false, visibility: "public", archived: false, disabled: false,
    fork: false, mirror_url: null, is_template: false, stargazers_count: 100, forks_count: 20, language: null, created_at: "2026-01-01T00:00:00Z" };
  const source = { ...policy(), sourceId: "github-fixture", edition: "github-projects", feedUrl: "https://api.github.com",
    review: { ...policy().review, reviewedAtUtc: "2026-09-01T00:00:00.000Z" },
    collection: { ...policy().collection, readBody: true }, model: { enabled: false, fields: [] },
    github: { allowedQueries: ["topic:owner-fixture"], allowApiResponseProcessing: true, allowRepositorySnapshots: true, allowIdentityHistory: true,
      allowDerivedPublication: true, irrevocableExportAllowed: true, deletionScope: "raw-only" } };
  const configuration = { schemaVersion: 1, version: 1, sourceId: source.sourceId, queries: ["topic:owner-fixture"] };
  const adapter = createGitHubAdapter({ read: async (url) => ({ status: 200, headers: {}, body: JSON.stringify(new URL(url).pathname === "/search/repositories" ?
    { total_count: 1, incomplete_results: false, items: [repository] } : repository) }) });
  const options = { databasePath: join(directory, "github.sqlite"), configuration: () => configuration, policies: () => [source],
    credential: () => ({ kind: "fine-grained-pat", token: "github_pat_OWNED_FIXTURE_SECRET", expiresAtUtc: "2026-10-01T00:00:00.000Z", repositoryAccess: "public-only", permissions: "metadata-read-only" }),
    clock: () => now, adapter };
  let observations = createGitHubObserver(options);
  await observations.observeDue();
  now = "2026-09-04T23:25:00.000Z";
  repository = { ...repository, full_name: "transferred/new-name", stargazers_count: 105, forks_count: 18 };
  await observations.observeDue();
  observations.close();
  observations = createGitHubObserver(options);
  t.after(() => observations.close());
  now = "2026-09-04T23:40:00.000Z";
  const observerOptions = { databasePath: join(directory, "reports.sqlite"), ownerToken, mode: "test-fixture" as const, clock: () => now,
    sourcePolicyReader: () => [source], github: observations };
  let observer = createObserver(observerOptions);
  t.after(() => observer.close());
  const profile = join(directory, "profile.json");
  await writeFile(profile, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  observer.importInterestProfile(profile);
  const version = await observer.produce({ schemaVersion: 7, taskId: "github-day", businessDate: "2026-09-05", configurationId: "owned-config",
    evidenceBundle: { schemaVersion: 2, id: "owned-bundle", businessDate: "2026-09-05", configurationId: "owned-config", windowStartUtc: "2026-09-03T23:30:00.000Z", cutoffUtc: "2026-09-04T23:30:00.000Z", evidence: [], coverageGaps: [] },
    editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: [] })) });
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(report.record.schemaVersion, 8);
  if (report.record.schemaVersion !== 8) throw new Error("new-record-required");
  assert.equal(report.version.schemaVersion, 7);
  const item = report.record.github.watchItems[0]!;
  assert.deepEqual({ nodeId: item.nodeId, name: item.fullName, status: item.status, stars: item.starsDelta, forks: item.forksDelta,
    current: item.current?.observedAtUtc, historical: item.historical?.observedAtUtc }, {
    nodeId: "R_owner_fixture", name: "transferred/new-name", status: "measured", stars: 5, forks: -2,
    current: "2026-09-04T23:25:00.000Z", historical: "2026-09-03T23:25:00.000Z" });
  assert.deepEqual(item.identityHistory.map((entry) => entry.fullName), ["example/old-name", "transferred/new-name"]);
  assert.match(report.canonicalMarkdown, /Watch Item/);
  assert.match(report.canonicalMarkdown, /stars 净变化 \+5；forks 净变化 -2/);
  assert.match(report.canonicalMarkdown, /有限候选/);
  assert.ok(!JSON.stringify(report).includes("OWNED_FIXTURE_SECRET"));
  assert.throws(() => observer.readReport(version.id, "wrong"), /unauthorized/);
  observer.close(); observer = createObserver(observerOptions);
  assert.equal(JSON.stringify(observer.readReport(version.id, ownerToken)), JSON.stringify(report));
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(directory, "report.md"), report.canonicalMarkdown);
  t.diagnostic(`owned GitHub replay: ${directory}`);
});

test("Ineligible repository identities remain visible as isolated outcomes without consuming the seven usable Watch Item slots", async (t) => {
  const app = await githubFixture(t);
  app.state.repositories = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ ...metadata(id), archived: true }));
  app.state.repositories.push(metadata("z-eligible"));
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  await app.observations.observeDue();
  const report = await app.publish();
  assert.deepEqual(report.record.github.watchItems.map((entry) => entry.nodeId), ["z-eligible"]);
  assert.equal(report.record.github.exclusions.length, 7);
  assert.match(report.canonicalMarkdown, /隔离/);
});

test("The latest verified renamed address remains tracked when finite Search stops returning it and the old name is reused", async (t) => {
  const app = await githubFixture(t);
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [{ ...metadata(), full_name: "transferred/current", stargazers_count: 105 }];
  await app.observations.observeDue();
  app.restartStore();
  app.state.now = "2026-09-05T23:25:00.000Z";
  app.state.hook = async (url) => ({ status: 200, headers: {}, body: JSON.stringify(new URL(url).pathname === "/search/repositories" ? { total_count: 0, incomplete_results: false, items: [] } :
    new URL(url).pathname === "/repos/transferred/current" ? { ...metadata(), full_name: "transferred/current", stargazers_count: 110 } : metadata("R_different")) });
  await app.observations.observeDue();
  const report = await app.publish("2026-09-05T23:30:00.000Z", "2026-09-06");
  assert.deepEqual(report.record.github.watchItems.map((item) => [item.nodeId, item.fullName, item.starsDelta]), [["R_fixture", "transferred/current", 5]]);
});

test("A report pins only the relevant pair and bounded identity history, so an irrelevant older policy cannot poison a valid current pair", async (t) => {
  const app = await githubFixture(t);
  app.state.now = "2026-09-01T23:25:00.000Z"; await app.observations.observeDue();
  app.source.version = 2;
  app.state.now = "2026-09-03T23:25:00.000Z"; await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z"; app.state.repositories = [metadata("R_fixture", 105, 18)]; await app.observations.observeDue();
  app.restartStore();
  const report = await app.publish();
  assert.equal(report.record.github.watchItems[0]?.starsDelta, 5);
  assert.equal(report.record.github.watchItems[0]?.firstSeenAtUtc, "2026-09-01T23:25:00.000Z");
  assert.equal(report.record.github.runs.length, 2);
  assert.ok(report.record.github.runs.every((run) => run.policy?.policyVersion === 2));
});

test("Missing pagination continuation stays visible even when fetched repository details have a valid measured pair", async (t) => {
  const app = await githubFixture(t);
  app.state.hook = async (url) => new URL(url).pathname === "/search/repositories" ? { status: 200, headers: {}, body: JSON.stringify({ total_count: 2, incomplete_results: false, items: [metadata()] }) } : undefined;
  await app.observations.observeDue(); app.state.now = "2026-09-04T23:25:00.000Z"; await app.observations.observeDue();
  const report = await app.publish();
  assert.equal(report.record.github.watchItems[0]?.status, "measured");
  assert.ok(report.record.github.reasons.includes("github-pagination-incomplete"));
  assert.match(report.canonicalMarkdown, /github-pagination-incomplete/);
});

test("The same report seam distinguishes zero, negative, true cold-start and old missing history, with causal cutoff equality", async (t) => {
  const scenarios = [
    { name: "zero", historical: "2026-09-03T23:25:00.000Z", current: "2026-09-04T23:25:00.000Z", stars: 100, forks: 20, status: "measured", delta: 0 },
    { name: "negative", historical: "2026-09-03T23:25:00.000Z", current: "2026-09-04T23:25:00.000Z", stars: 90, forks: 19, status: "measured", delta: -10 },
    { name: "cold", historical: null, current: "2026-09-04T23:25:00.000Z", stars: 10, forks: 0, status: "cold-start", delta: null },
    { name: "old-missing", historical: "2026-09-02T23:25:00.000Z", current: "2026-09-04T23:25:00.000Z", stars: 100, forks: 20, status: "missing", delta: null },
    { name: "historical-edge", historical: "2026-09-03T22:30:00.000Z", current: "2026-09-04T23:30:00.000Z", stars: 105, forks: 18, status: "measured", delta: 5 },
    { name: "historical-too-old", historical: "2026-09-03T22:29:59.999Z", current: "2026-09-04T23:25:00.000Z", stars: 105, forks: 18, status: "missing", delta: null },
    { name: "current-too-old", historical: "2026-09-03T23:25:00.000Z", current: "2026-09-04T23:14:59.999Z", stars: 105, forks: 18, status: "missing", delta: null },
    { name: "future-only-current", historical: "2026-09-03T23:25:00.000Z", current: "2026-09-04T23:30:00.001Z", stars: 105, forks: 18, status: "missing", delta: null },
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async (t) => {
    const app = await githubFixture(t);
    if (scenario.historical) { app.state.now = scenario.historical; await app.observations.observeDue(); }
    app.state.now = scenario.current; app.state.repositories = [metadata("R_fixture", scenario.stars, scenario.forks)]; await app.observations.observeDue();
    app.restartStore(); const report = await app.publish();
    const item = [...report.record.github.watchItems, ...report.record.github.exclusions][0]!;
    assert.equal(item.status, scenario.status);
    assert.equal(item.starsDelta, scenario.delta);
    if (item.status === "measured") assert.ok(item.current!.availableAtUtc <= report.record.evidenceBundle.cutoffUtc);
    if (item.status === "missing") assert.ok(!report.canonicalMarkdown.includes("Cold-start Heat"));
  });
});

test("A rate-limited batch honors retry-after without sending further repository requests and publishes the missing observation reason", async (t) => {
  const app = await githubFixture(t);
  app.state.repositories = [metadata("a"), metadata("b")]; await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z"; app.state.calls.length = 0;
  app.state.hook = async () => ({ status: 429, headers: { "retry-after": "3600" }, body: "PRIVATE-RATE-BODY" });
  await app.observations.observeDue();
  const report = await app.publish();
  assert.equal(app.state.calls.length, 1);
  assert.equal(report.record.github.watchItems.length, 0);
  assert.match(report.canonicalMarkdown, /github-rate-limited/);
  assert.ok(!JSON.stringify(report).includes("PRIVATE-RATE-BODY"));
});

test("Ranking consumers can replay the metadata observed at each endpoint without replacing old unknowns with future language or topics", async (t) => {
  const app = await githubFixture(t);
  await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.repositories = [{ ...metadata(), language: "Rust", topics: [] }]; await app.observations.observeDue();
  const report = await app.publish();
  const item = report.record.github.watchItems[0]!;
  assert.deepEqual([item.historical?.language, item.historical?.topics, item.historical?.createdAtUtc], [null, null, "2026-01-01T00:00:00.000Z"]);
  assert.deepEqual([item.current?.language, item.current?.topics, item.current?.createdAtUtc], ["Rust", [], "2026-01-01T00:00:00.000Z"]);
});

test("Concurrent and restarted collection of the same hourly slot returns one durable result without duplicate observation failure", async (t) => {
  const app = await githubFixture(t);
  const [first, second] = await Promise.all([app.observations.observeDue(), app.observations.observeDue()]);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  app.restartStore();
  assert.equal(JSON.stringify(await app.observations.observeDue()), JSON.stringify(first));
  const report = await app.publish("2026-09-03T23:30:00.000Z", "2026-09-04");
  assert.equal(report.record.github.watchItems[0]?.status, "cold-start");
});

test("A same-version edited Source Policy cannot authorize another observation after restart", async (t) => {
  const app = await githubFixture(t); await app.observations.observeDue(); app.restartStore();
  app.source.citation.attribution = "Edited without a new Owner policy version";
  app.state.now = "2026-09-04T23:25:00.000Z"; app.state.calls.length = 0;
  const run = await app.observations.observeDue(); const report = await app.publish();
  assert.equal(app.state.calls.length, 0);
  assert.ok(run.reasons.includes("github-policy-version-conflict"));
  assert.equal(report.record.github.watchItems.length, 0);
  assert.match(report.canonicalMarkdown, /github-policy-version-conflict/);
});

test("An invalidated GitHub configuration or source reader becomes an Edition gap while the Daily Brief remains readable", async (t) => {
  for (const invalid of ["configuration", "policy"]) await t.test(invalid, async (t) => {
    const app = await githubFixture(t); await app.observations.observeDue();
    if (invalid === "configuration") app.configuration.queries = [];
    else app.source.name = "";
    const report = await app.publish();
    assert.equal(report.record.github.watchItems.length, 0);
    assert.match(report.canonicalMarkdown, /github-observation-unavailable/);
    assert.equal(report.record.editions.length, 6);
  });
});

test("Owner item, polling and whole-batch time limits bound the hourly observation workflow", async (t) => {
  await t.test("smaller-item-budget", async (t) => {
    const app = await githubFixture(t); app.source.limits.maxItems = 1;
    await app.observations.observeDue();
    assert.equal(new URL(app.state.calls[0]!).searchParams.get("per_page"), "1");
    assert.equal((await app.publish("2026-09-03T23:30:00.000Z", "2026-09-04")).record.github.watchItems.length, 1);
  });
  await t.test("poll-interval-after-late-start", async (t) => {
    const app = await githubFixture(t); app.source.limits.pollIntervalSeconds = 3600; app.state.now = "2026-09-04T23:24:00.000Z";
    const first = await app.observations.observeDue(); app.restartStore(); app.state.calls.length = 0; app.state.now = "2026-09-04T23:25:00.000Z";
    const second = await app.observations.observeDue();
    assert.equal(second.id, first.id); assert.equal(app.state.calls.length, 0);
  });
  await t.test("whole-batch-deadline", async (t) => {
    const app = await githubFixture(t); app.state.now = "2026-09-04T23:25:00.000Z";
    app.state.hook = async () => { app.state.now = "2026-09-04T23:27:00.001Z"; return undefined; };
    await app.observations.observeDue(); const report = await app.publish();
    assert.equal(report.record.github.watchItems.length, 0); assert.match(report.canonicalMarkdown, /github-timeout/);
  });
});

test("Opaque node identities keep their exact bytes rather than relying on an invented GitHub ID alphabet", async (t) => {
  const app = await githubFixture(t); app.state.repositories = [{ ...metadata(), node_id: "opaque/+node==", full_name: "example/project" }];
  await app.observations.observeDue();
  const report = await app.publish("2026-09-03T23:30:00.000Z", "2026-09-04");
  assert.equal(report.record.github.watchItems[0]?.nodeId, "opaque/+node==");
});

test("The server's rate-limit pause survives reconstructing both the observation store and network Adapter", async (t) => {
  const app = await githubFixture(t); await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z";
  app.state.hook = async () => ({ status: 429, headers: { "retry-after": "172800" }, body: "" });
  await app.observations.observeDue();
  let requests = 0;
  app.restartStore(createGitHubAdapter({ read: async () => { requests++; return { status: 429, headers: {}, body: "" }; } }));
  app.state.now = "2026-09-05T23:25:00.000Z"; await app.observations.observeDue();
  const report = await app.publish("2026-09-05T23:30:00.000Z", "2026-09-06");
  assert.equal(requests, 0); assert.match(report.canonicalMarkdown, /github-rate-limited/);
});

test("Official response failures and unknown qualification remain local, redacted gaps after a previously good observation", async (t) => {
  const cases = [
    ...["private", "archived", "disabled", "fork", "is_template"].map((field) => ({ name: field, value: { ...metadata(), [field]: true }, reason: "github-ineligible" })),
    { name: "mirror", value: { ...metadata(), mirror_url: "https://untrusted.invalid/never-follow" }, reason: "github-ineligible" },
    { name: "unknown-template", value: { ...metadata(), is_template: undefined }, reason: "github-risk-unknown" },
    { name: "unknown-visibility", value: { ...metadata(), visibility: undefined }, reason: "github-risk-unknown" },
    { name: "missing-required-language", value: { ...metadata(), language: undefined }, reason: "github-invalid-response" },
    { name: "invalid-created-at", value: { ...metadata(), created_at: "not-a-date" }, reason: "github-invalid-response" },
    { name: "invalid-topics-null", value: { ...metadata(), topics: null }, reason: "github-invalid-response" },
    { name: "unsafe-count", value: { ...metadata(), stargazers_count: Number.MAX_SAFE_INTEGER + 1 }, reason: "github-invalid-response" },
    ...[401, 403, 404, 410].map((status) => ({ name: `status-${status}`, status, reason: "github-access-unavailable" })),
    { name: "unexpected-304", status: 304, reason: "github-network-failed" },
    { name: "network-exception", reason: "github-network-failed" },
    { name: "expired", reason: "github-credential-expired" },
    { name: "undeclared-secret", reason: "github-credential-unavailable" },
    { name: "cancelled", reason: "github-cancelled" },
  ];
  for (const scenario of cases) await t.test(scenario.name, async (t) => {
    const app = await githubFixture(t); await app.observations.observeDue();
    app.state.now = "2026-09-04T23:25:00.000Z"; app.state.calls.length = 0;
    if ("value" in scenario) app.state.repositories = [scenario.value];
    if ("status" in scenario) app.state.hook = async () => ({ status: scenario.status, headers: {}, body: "PRIVATE-RESPONSE-MARKER" });
    if (scenario.name === "network-exception") app.state.hook = async () => { throw new Error(`PRIVATE-RESPONSE-MARKER ${app.credential.token}`); };
    if (scenario.name === "expired") app.credential.expiresAtUtc = app.state.now;
    if (scenario.name === "undeclared-secret") app.credential.token = "PRIVATE-RESPONSE-MARKER";
    const signal = scenario.name === "cancelled" ? AbortSignal.abort() : undefined;
    await app.observations.observeDue(signal ? { signal } : {}); app.restartStore();
    const report = await app.publish();
    assert.equal(report.record.github.watchItems.length, 0);
    assert.match(report.canonicalMarkdown, new RegExp(scenario.reason));
    assert.ok(!JSON.stringify(report).includes("PRIVATE-RESPONSE-MARKER"));
    assert.ok(!JSON.stringify(report).includes(app.credential.token));
    if (["expired", "undeclared-secret", "cancelled"].includes(scenario.name)) assert.equal(app.state.calls.length, 0);
  });
});

test("An Owner source switch does not carry a previous source's discovered repository addresses into new authorized queries", async (t) => {
  const app = await githubFixture(t); await app.observations.observeDue();
  app.state.now = "2026-09-04T23:25:00.000Z"; app.state.calls.length = 0;
  app.source.sourceId = "new-owner-source"; app.configuration.sourceId = app.source.sourceId; app.configuration.version = 2;
  app.state.repositories = [];
  await app.observations.observeDue();
  const report = await app.publish();
  assert.equal(app.state.calls.length, 1);
  assert.equal(report.record.github.exclusions.length, 0);
  assert.equal(report.record.github.watchItems.length, 0);
});
