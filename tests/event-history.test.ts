import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test, type TestContext } from "node:test";
import { createObserver, type ObserverOptions } from "../src/observer.ts";
import { editionNames } from "../src/contracts.ts";
import type { VerificationInput } from "../src/gate-contracts.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { policyDigest } from "../src/collection.ts";
import { ownerToken, request, successfulResult } from "./fixtures.ts";

const editions = Object.keys(editionNames) as Array<keyof typeof editionNames>;
type Edition = typeof editions[number];
const identity = { subject: "示例观测站", action: "扩建", object: "观测网络", discriminator: "第42期计划" };
function story(id: string, edition: Edition, evidenceId: string, text = "示例观测站新增了 12 个观测点。") {
  return { schemaVersion: 2, id, eventClusterId: "untrusted-same-id", edition, title: "不可信标题",
    claims: [ { id: "fact", kind: "fact", text, evidenceIds: [evidenceId] },
      { id: "importance", kind: "analysis", mode: "explanation", text: "新增覆盖对持续观测有重大意义。", evidenceIds: [evidenceId] } ] };
}
type Story = Omit<ReturnType<typeof story>, "claims"> & { claims: Array<ReturnType<typeof story>["claims"][number] & { publisherSourceId?: string }> };
type Evidence = Omit<typeof request.evidenceBundle.evidence[number], "eventTimeUtc" | "publishedAtUtc"> & { eventTimeUtc: string | null; publishedAtUtc: string | null };
function task(date = "2026-09-05", evidence: Evidence[] = structuredClone(request.evidenceBundle.evidence)) {
  const previous = new Date(`${date}T00:00:00.000Z`); previous.setUTCDate(previous.getUTCDate() - 1);
  const prior = previous.toISOString().slice(0, 10);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return { ...request, schemaVersion: 3, businessDate: date, taskId: `events-${date}`,
    evidenceBundle: { ...request.evidenceBundle, id: `evidence-${date}`, businessDate: date,
      windowStartUtc: `${previous.toISOString().slice(0, 10)}T23:30:00.000Z`, cutoffUtc: `${prior}T23:30:00.000Z`, evidence },
    editions: editions.map((edition) => ({ edition, evidenceIds: evidence.map((item) => item.id) })) };
}
function annotation(evidenceId: string, override: Record<string, unknown> = {}) {
  return { identity, fact: "新增12个观测点", primaryEdition: "world-affairs", materiality: "material",
    materialityClaimIds: ["importance"], occurrenceEvidenceId: evidenceId,
    disclosureEvidenceId: evidenceId, developmentEvidenceId: null, ...override };
}
function receipt(input: VerificationInput, annotations: Record<string, unknown>) {
  return { schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "event-annotations-v1",
    assessments: input.stories.flatMap((candidate) => candidate.claims.map((claim) => ({ storyId: candidate.id, claimId: claim.id,
      conclusion: "supported", reason: "supported-by-evidence", wording: "original",
      evidence: claim.evidenceIds.map((evidenceId) => ({ evidenceId, relation: "supports", basis: claim.kind === "statement" ? "publisher-statement" : "direct-observation", reliability: "reliable", upstreamOriginId: `origin-${evidenceId}` })),
      ...(["fact", "statement"].includes(claim.kind) ? { event: annotations[`${candidate.id}:${claim.id}`] ?? annotations[candidate.id] } : {}),
    }))) };
}
async function fixture(t: TestContext, sourcePolicies?: ObserverOptions["sourcePolicies"]) {
  const directory = await mkdtemp(join(tmpdir(), "observer-events-"));
  let currentTask = task();
  let candidates: Story[] = [];
  let annotations: Record<string, unknown> = {};
  const options: ObserverOptions = { databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture",
    ...(sourcePolicies ? { sourcePolicies } : {}),
    clock: () => currentTask.evidenceBundle.cutoffUtc.replace("23:30", "23:40"),
    editionRunner: { run: async () => ({ schemaVersion: 2, taskId: currentTask.taskId, evidenceBundleId: currentTask.evidenceBundle.id, configurationId: currentTask.configurationId,
      editions: editions.map((edition) => ({ edition, status: "completed", result: { ...successfulResult(), taskId: `${currentTask.taskId}:${edition}`,
        evidenceBundleId: currentTask.evidenceBundle.id, startedAtUtc: currentTask.evidenceBundle.cutoffUtc.replace("23:30", "23:31"), finishedAtUtc: currentTask.evidenceBundle.cutoffUtc.replace("23:30", "23:32"),
        stories: candidates.filter((candidate) => candidate.edition === edition) } })) }) },
    verifier: { verify: async (input) => receipt(input, annotations) } };
  let observer = createObserver(options);
  t.after(() => observer.close()); // Retain this task's bounded SQLite evidence; no broad cleanup.
  return { databasePath: options.databasePath, async publish(input: ReturnType<typeof task>, stories: Story[], labels: Record<string, unknown>) {
    currentTask = input; candidates = stories; annotations = labels;
    return observer.readReport((await observer.produce(input)).id, ownerToken);
  }, restart(policies?: ObserverOptions["sourcePolicies"]) { observer.close(); if (policies) options.sourcePolicies = policies; observer = createObserver(options); }, read(id: string) { return observer.readReport(id, ownerToken); } };
}

test("Same event across sources and Editions has one primary story and a slot-free linked Impact Note", async (t) => {
  const app = await fixture(t);
  const evidence = structuredClone(request.evidenceBundle.evidence);
  evidence.push({ ...evidence[0]!, id: "evidence-2", sourceId: "another-observatory", url: "https://example.net/report42" });
  const report = await app.publish(task("2026-09-05", evidence), [story("world", "world-affairs", "evidence-1"), story("ai", "ai", "evidence-2")], {
    world: annotation("evidence-1"), ai: annotation("evidence-2"),
  });
  assert.equal(report.record.stories.length, 1);
  assert.equal(report.record.schemaVersion, 4);
  if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.equal(report.record.eventClusters.length, 1);
  assert.deepEqual(report.record.eventClusters[0]!.memberStoryIds, ["world", "ai"]);
  assert.deepEqual(report.record.eventClusters[0]!.evidenceIds, ["evidence-1", "evidence-2"]);
  assert.equal(report.record.eventClusters[0]!.primary.storyId, "world");
  assert.equal(report.record.eventClusters[0]!.primary.versionId, "2026-09-05-v1");
  assert.deepEqual(report.record.editions.find((entry) => entry.edition === "ai")!.storyIds, []);
  assert.deepEqual(report.record.editions.find((entry) => entry.edition === "ai")!.priorityStoryIds, []);
  assert.match(report.canonicalMarkdown, /Impact Note（不占普通条目）/);
  assert.match(report.canonicalMarkdown, /主栏全文.*#story-1/);
});

test("Restarted consecutive issues suppress unchanged coverage and link a materially new verified fact without rewriting earlier reports", async (t) => {
  const app = await fixture(t);
  const first = await app.publish(task(), [story("first", "world-affairs", "evidence-1")], { first: annotation("evidence-1") });
  const oldBytes = JSON.stringify(first);
  app.restart();
  const unchanged = await app.publish(task("2026-09-06"), [story("retitled", "ai", "evidence-1", "重磅：观测点扩建已添十二处。")], { retitled: annotation("evidence-1") });
  assert.equal(unchanged.record.stories.length, 0);
  assert.match(unchanged.canonicalMarkdown, /no-new-development/);
  app.restart();
  const development = { ...request.evidenceBundle.evidence[0]!, id: "evidence-3", url: "https://example.org/observatory/update-43",
    eventTimeUtc: "2026-09-06T20:00:00.000Z", publishedAtUtc: "2026-09-06T22:00:00.000Z", discoveredAtUtc: "2026-09-06T22:05:00.000Z", retrievedAtUtc: "2026-09-06T22:06:00.000Z" };
  const update = await app.publish(task("2026-09-07", [development]), [story("update", "ai", "evidence-3", "该计划的全部观测点现已投入运行。")], {
    update: annotation("evidence-3", { fact: "全部观测点投入运行", occurrenceEvidenceId: null, developmentEvidenceId: "evidence-3" }),
  });
  assert.equal(update.record.stories.length, 1);
  if (update.record.schemaVersion !== 4 || first.record.schemaVersion !== 4) assert.fail("Expected event-aware records");
  const cluster = update.record.eventClusters[0]!;
  assert.equal(cluster.id, first.record.eventClusters[0]!.id);
  assert.equal(cluster.coverage, "material-update");
  assert.equal(cluster.firstDisclosure.atUtc, "2026-09-04T22:00:00.000Z");
  assert.equal(cluster.firstDiscoveredAtUtc, "2026-09-04T22:05:00.000Z");
  assert.equal(cluster.materialDevelopment.atUtc, "2026-09-06T20:00:00.000Z");
  assert.equal(cluster.previousCoverage!.versionId, "2026-09-05-v1");
  assert.match(update.canonicalMarkdown, /实质新进展/);
  assert.equal(JSON.stringify(app.read(first.version.id)), oldBytes);
});

test("An old event first disclosed in this window is eligible and unknown occurrence remains unknown", async (t) => {
  for (const occurredAt of ["2026-02-01T10:00:00.000Z", null]) {
    const app = await fixture(t);
    const evidence = [{ ...request.evidenceBundle.evidence[0]!, eventTimeUtc: occurredAt }];
    const report = await app.publish(task("2026-09-05", evidence), [story("old-event", "world-affairs", "evidence-1")], { "old-event": annotation("evidence-1") });
    assert.equal(report.record.stories.length, 1);
    if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
    const cluster = report.record.eventClusters[0]!;
    assert.equal(cluster.occurrence.atUtc, occurredAt);
    assert.equal(cluster.firstDisclosure.atUtc, "2026-09-04T22:00:00.000Z");
    assert.equal(cluster.firstDiscoveredAtUtc, "2026-09-04T22:05:00.000Z");
    assert.equal(cluster.materialDevelopment.atUtc, null);
    assert.equal(cluster.coverage, "new-disclosure");
    assert.match(report.canonicalMarkdown, /首次公开披露：2026-09-04T22:00:00.000Z/);
    assert.ok(report.canonicalMarkdown.includes(`事件发生：${occurredAt ?? "未知"}`));
  }
});

test("Late discovery requires supported material relevance and preserves the old disclosure date instead of using discovery time", async (t) => {
  for (const materiality of ["material", "routine", "missing-analysis", "unknown-disclosure"]) {
    const app = await fixture(t);
    const evidence = [{ ...request.evidenceBundle.evidence[0]!, eventTimeUtc: "2026-02-01T10:00:00.000Z",
      publishedAtUtc: materiality === "unknown-disclosure" ? null : "2026-08-01T10:00:00.000Z" }];
    const report = await app.publish(task("2026-09-05", evidence), [story("late", "world-affairs", "evidence-1")], {
      late: annotation("evidence-1", { materiality: materiality === "routine" ? "routine" : "material", materialityClaimIds: materiality === "missing-analysis" ? ["absent"] : ["importance"] }),
    });
    assert.equal(report.record.stories.length, materiality === "material" ? 1 : 0, materiality);
    if (materiality === "material") {
      if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
      assert.equal(report.record.eventClusters[0]!.coverage, "late-discovered");
      assert.equal(report.record.eventClusters[0]!.firstDisclosure.atUtc, "2026-08-01T10:00:00.000Z");
      assert.match(report.canonicalMarkdown, /补报（Late-discovered Story）/);
      assert.match(report.canonicalMarkdown, /首次公开披露：2026-08-01T10:00:00.000Z/);
    } else assert.match(report.canonicalMarkdown, /not-material|unknown-disclosure/);
  }
});

test("Similarity and suggested cluster IDs cannot merge independent events or override conflicting factual occurrence evidence", async (t) => {
  for (const conflicting of [false, true]) {
    const app = await fixture(t);
    const evidence = [{ ...request.evidenceBundle.evidence[0]!, eventTimeUtc: "2026-09-02T10:00:00.000Z" },
      { ...request.evidenceBundle.evidence[0]!, id: "evidence-2", eventTimeUtc: "2026-09-03T10:00:00.000Z", url: "https://example.net/another-plan" }];
    const report = await app.publish(task("2026-09-05", evidence), [story("plan42", "world-affairs", "evidence-1"), story("plan43", "ai", "evidence-2")], {
      plan42: annotation("evidence-1"), plan43: annotation("evidence-2", { identity: conflicting ? identity : { ...identity, discriminator: "第43期独立计划" } }),
    });
    assert.equal(report.record.stories.length, conflicting ? 0 : 2);
    if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
    assert.equal(report.record.eventClusters.length, conflicting ? 0 : 2);
    if (conflicting) assert.match(report.canonicalMarkdown, /identity-conflict/);
    else assert.notEqual(report.record.stories[0]!.eventClusterId, report.record.stories[1]!.eventClusterId);
  }
});

test("Missing, foreign, conflicting, and non-factual event assessments fail closed locally without giving candidate IDs authority", async (t) => {
  for (const fault of ["missing", "foreign-evidence", "non-factual", "invalid-shape", "mixed-identities"]) {
    const app = await fixture(t);
    const bad = story("bad", "ai", "evidence-1");
    const good = story("good", "world-affairs", "evidence-1");
    if (fault === "non-factual") bad.claims[0] = { ...bad.claims[0]!, kind: "analysis", mode: "explanation" };
    if (fault === "mixed-identities") bad.claims.push({ ...bad.claims[0]!, id: "other-fact", text: "另一个独立事件也在同段材料出现。" });
    const labels = fault === "missing" ? {} : { bad: fault === "invalid-shape" ? { materiality: true } : annotation("evidence-1", fault === "foreign-evidence" ? { disclosureEvidenceId: "foreign" } : {}) };
    const report = await app.publish(task(), [bad, good], { ...labels, good: annotation("evidence-1"),
      ...(fault === "mixed-identities" ? { "bad:other-fact": annotation("evidence-1", { identity: { ...identity, discriminator: "独立计划" } }) } : {}),
    });
    assert.deepEqual(report.record.stories.map((candidate) => candidate.id), ["good"], fault);
    assert.match(report.canonicalMarkdown, /event-assessment-unavailable|event-assessment-invalid/);
  }
});

test("Multiple verified developments in one event retain the new fact in the primary story and do not inherit the old fact's disclosure time", async (t) => {
  const app = await fixture(t);
  await app.publish(task(), [story("first", "world-affairs", "evidence-1")], { first: annotation("evidence-1") });
  app.restart();
  const newer = { ...request.evidenceBundle.evidence[0]!, id: "new", url: "https://example.org/observatory/operation",
    publishedAtUtc: "2026-09-05T21:00:00.000Z", discoveredAtUtc: "2026-09-05T21:05:00.000Z", retrievedAtUtc: "2026-09-05T21:06:00.000Z" };
  const report = await app.publish(task("2026-09-06", [request.evidenceBundle.evidence[0]!, newer]), [story("mixed", "world-affairs", "evidence-1"),
    story("operation", "ai", "new", "该计划已正式投入运行。"), story("access", "finance", "new", "该计划同时开放了公共数据访问。")], {
    mixed: annotation("evidence-1"), operation: annotation("new", { fact: "正式投入运行" }), access: annotation("new", { fact: "开放公共数据访问" }),
  });
  assert.equal(report.record.stories.length, 1);
  assert.ok(report.canonicalMarkdown.includes("该计划已正式投入运行。"));
  assert.ok(report.canonicalMarkdown.includes("该计划同时开放了公共数据访问。"));
  if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.equal(report.record.eventClusters[0]!.coverage, "material-update");
  assert.equal(report.record.eventClusters[0]!.developments.filter((development) => development.disclosure.atUtc === "2026-09-05T21:00:00.000Z").length, 2);
});

test("A later evidence-backed separation links the earlier mistaken cluster without changing its published bytes", async (t) => {
  const app = await fixture(t);
  const first = await app.publish(task(), [story("earlier", "world-affairs", "evidence-1")], { earlier: annotation("evidence-1") });
  if (first.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  const original = JSON.stringify(first);
  app.restart();
  const evidence = [{ ...request.evidenceBundle.evidence[0]!, publishedAtUtc: "2026-09-05T20:00:00.000Z", discoveredAtUtc: "2026-09-05T20:05:00.000Z", retrievedAtUtc: "2026-09-05T20:06:00.000Z" }];
  const separated = story("separated", "ai", "evidence-1", "新增观测点属于另一个独立计划，先前关联有误。");
  separated.eventClusterId = first.record.eventClusters[0]!.id;
  const report = await app.publish(task("2026-09-06", evidence), [separated], { separated: annotation("evidence-1", {
    identity: { ...identity, discriminator: "第43期独立计划" },
    relationToPrior: { clusterId: separated.eventClusterId, versionId: first.version.id, relation: "distinct-event", basisClaimIds: ["fact"] },
  }) });
  assert.equal(report.record.stories.length, 1);
  if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.deepEqual(report.record.eventClusters[0]!.separatedFrom, [{ clusterId: separated.eventClusterId, versionId: "2026-09-05-v1", basis: [{ storyId: "separated", claimId: "fact" }] }]);
  assert.match(report.canonicalMarkdown, /后续拆分关联/);
  assert.equal(JSON.stringify(app.read(first.version.id)), original);
});

test("Earlier legacy coverage is explicitly unclassified instead of silently proving a new event was never covered", async (t) => {
  const app = await fixture(t);
  const original = await app.publish({ ...task(), schemaVersion: 2 }, [story("legacy", "world-affairs", "evidence-1")], { legacy: annotation("evidence-1") });
  const bytes = JSON.stringify(original);
  app.restart();
  const report = await app.publish(task("2026-09-06"), [story("repeat", "ai", "evidence-1")], { repeat: annotation("evidence-1") });
  assert.equal(report.record.stories.length, 0);
  assert.match(report.canonicalMarkdown, /历史覆盖尚未完全分类/);
  assert.ok(report.record.coverageGaps.some((gap) => gap.reason === "legacy-history-unclassified"));
  assert.equal(JSON.stringify(app.read(original.version.id)), bytes);
});

test("Deduplication fills ordinary slots from remaining candidates, preserves GitHub's separate scope, and can retain over fifty distinct facts under one primary", async (t) => {
  const app = await fixture(t);
  const candidates = [story("primary", "world-affairs", "evidence-1"), story("duplicate", "ai", "evidence-1"),
    ...Array.from({ length: 7 }, (_, i) => story(`ai-${i}`, "ai", "evidence-1")), story("repository", "github-projects", "evidence-1")];
  const labels: Record<string, unknown> = { primary: annotation("evidence-1"), duplicate: annotation("evidence-1") };
  for (let i = 0; i < 7; i++) labels[`ai-${i}`] = annotation("evidence-1", { identity: { ...identity, discriminator: `independent-${i}` }, primaryEdition: "ai" });
  const report = await app.publish(task(), candidates, labels);
  if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.equal(report.record.editions.find((entry) => entry.edition === "ai")!.storyIds.length, 7);
  assert.equal(report.record.editions.find((entry) => entry.edition === "ai")!.priorityStoryIds.length, 3);
  assert.equal(report.record.editions.find((entry) => entry.edition === "github-projects")!.storyIds.length, 1);
  const large = await fixture(t);
  const many = [story("many-a", "world-affairs", "evidence-1"), story("many-b", "ai", "evidence-1")];
  const manyLabels: Record<string, unknown> = {};
  for (const [i, candidate] of many.entries()) {
    candidate.claims = [candidate.claims[1]!, ...Array.from({ length: 49 }, (_, index) => ({ ...candidate.claims[0]!, id: `fact-${index}`, text: `计划第${i * 49 + index + 1}项独立成果。` }))];
    for (let index = 0; index < 49; index++) manyLabels[`${candidate.id}:fact-${index}`] = annotation("evidence-1", { fact: `成果-${i * 49 + index + 1}` });
  }
  const full = await large.publish(task(), many, manyLabels);
  assert.equal(full.record.stories.length, 1);
  assert.ok(full.canonicalMarkdown.includes("计划第98项独立成果。"));
  if (full.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.equal(full.record.eventClusters[0]!.developments.length, 98);
});

test("Event annotation prose cannot survive final publication denial or legacy publication in the permanent archive", async (t) => {
  for (const denial of ["distribution", "archive", "expired", "unsafe", "allowed"]) for (const schemaVersion of [1, 2, 3]) {
    const directory = await mkdtemp(join(tmpdir(), "observer-event-retention-"));
    const source = policy(); source.sourceId = "source-fixture";
    if (denial === "distribution") source.distribution.enabled = false;
    if (denial === "archive") source.distribution.allowPermanentArchive = false;
    let now = "2026-09-04T23:40:00.000Z";
    const candidate = story("candidate", "world-affairs", "evidence-1");
    const marker = `RAW_ANNOTATION_${denial}_${schemaVersion}`;
    const input = { ...task(), schemaVersion, evidenceBundle: { ...task().evidenceBundle, schemaVersion: 2, coverageGaps: [],
      evidence: [{ ...request.evidenceBundle.evidence[0]!, policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: "2026-09-04T23:41:00.000Z" }] } };
    const { editions: _editions, ...single } = input;
    const run = { ...successfulResult(), taskId: input.taskId, evidenceBundleId: input.evidenceBundle.id, stories: [candidate] };
    const options: ObserverOptions = { databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture", sourcePolicies: [source], clock: () => now,
      runner: { run: async () => run }, editionRunner: { run: async () => ({ schemaVersion: 2, taskId: input.taskId, evidenceBundleId: input.evidenceBundle.id, configurationId: input.configurationId,
        editions: editions.map((edition) => ({ edition, status: "completed", result: { ...run, taskId: `${input.taskId}:${edition}`, stories: edition === "world-affairs" ? [candidate] : [] } })) }) },
      verifier: { verify: async (verificationInput) => {
        if (denial === "expired") now = "2026-09-04T23:42:00.000Z";
        const result = receipt(verificationInput, { candidate: annotation("evidence-1", { fact: marker }) });
        if (denial === "unsafe") for (const assessment of result.assessments) assessment.wording = "unsafe";
        return result;
      } } };
    let observer = createObserver(options);
    const version = await observer.produce(schemaVersion === 1 ? single : input);
    observer.close(); observer = createObserver(options);
    try {
      const report = observer.readReport(version.id, ownerToken);
      assert.equal(JSON.stringify(report).includes(marker), false, `${denial}/${schemaVersion}`);
      assert.equal(report.record.stories.length, denial === "allowed" ? 1 : 0);
    } finally { observer.close(); }
  }
});

test("A late-discovered material update is labeled late, cutoff endpoints are not newly disclosed twice, and future reports do not influence replay", async (t) => {
  const app = await fixture(t);
  await app.publish(task(), [story("first", "world-affairs", "evidence-1")], { first: annotation("evidence-1") });
  app.restart();
  const oldDisclosure = { ...request.evidenceBundle.evidence[0]!, id: "update", publishedAtUtc: "2026-09-04T23:30:00.000Z",
    discoveredAtUtc: "2026-09-05T20:00:00.000Z", retrievedAtUtc: "2026-09-05T20:01:00.000Z" };
  const late = await app.publish(task("2026-09-06", [oldDisclosure]), [story("late-update", "ai", "update", "观测计划已开放数据访问。")], { "late-update": annotation("update", { fact: "开放数据访问" }) });
  if (late.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.equal(late.record.eventClusters[0]!.coverage, "late-discovered");
  assert.equal(late.record.eventClusters[0]!.previousCoverage!.versionId, "2026-09-05-v1");
  assert.equal(late.record.eventClusters[0]!.developments[0]!.disclosure.atUtc, "2026-09-04T23:30:00.000Z");
  const futureApp = await fixture(t);
  await futureApp.publish(task("2026-09-09"), [story("future", "world-affairs", "evidence-1")], { future: annotation("evidence-1") });
  futureApp.restart();
  const earlier = await futureApp.publish(task(), [story("past", "world-affairs", "evidence-1")], { past: annotation("evidence-1") });
  assert.equal(earlier.record.stories.length, 1);
  if (earlier.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.equal(earlier.record.eventClusters[0]!.previousCoverage, null);
});

test("A cross-Edition Impact Note explains relevance using that member's verified analysis without consuming normal or priority slots", async (t) => {
  const app = await fixture(t);
  const related = story("related", "ai", "evidence-1");
  related.claims[1]!.text = "分析：新增观测数据可能改善训练样本的地理覆盖。";
  const report = await app.publish(task(), [story("primary", "world-affairs", "evidence-1"), related], { primary: annotation("evidence-1"), related: annotation("evidence-1") });
  const aiSection = report.canonicalMarkdown.split("## AI 日报\n")[1]!.split("## 财经日报\n")[0]!;
  assert.ok(aiSection.includes("新增观测数据可能改善训练样本的地理覆盖。"));
  assert.match(aiSection, /本栏实际 0 条 · 重点 0 条/);
});

test("Revoking a historical source denies already borrowed metadata and later production retains only history fingerprints", async (t) => {
  const firstSource = policy(); firstSource.sourceId = "source-fixture";
  const secondSource = policy(); secondSource.sourceId = "second-source";
  const app = await fixture(t, [firstSource, secondSource]);
  const collected = (date: string, source: typeof firstSource, evidence: Evidence[]) => ({ ...task(date, evidence), evidenceBundle: { ...task(date, evidence).evidenceBundle, schemaVersion: 2, coverageGaps: [],
    evidence: evidence.map((item) => ({ ...item, sourceId: source.sourceId, policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: "2026-09-20T23:00:00.000Z" })) } });
  const first = await app.publish(collected("2026-09-05", firstSource, request.evidenceBundle.evidence), [story("first", "world-affairs", "evidence-1")], { first: annotation("evidence-1") });
  const newer = { ...request.evidenceBundle.evidence[0]!, publishedAtUtc: "2026-09-05T20:00:00.000Z", discoveredAtUtc: "2026-09-05T20:05:00.000Z", retrievedAtUtc: "2026-09-05T20:06:00.000Z" };
  const second = await app.publish(collected("2026-09-06", secondSource, [newer]), [story("second", "ai", "evidence-1")], { second: annotation("evidence-1", { fact: "正式运行" }) });
  assert.ok(second.canonicalMarkdown.includes("2026-09-04T22:00:00.000Z"));
  app.restart([secondSource]);
  assert.throws(() => app.read(first.version.id), { code: "not-found" });
  assert.throws(() => app.read(second.version.id), { code: "not-found" });
  const latest = { ...newer, publishedAtUtc: "2026-09-06T20:00:00.000Z", discoveredAtUtc: "2026-09-06T20:05:00.000Z", retrievedAtUtc: "2026-09-06T20:06:00.000Z" };
  const third = await app.publish(collected("2026-09-07", secondSource, [latest]), [story("third", "ai", "evidence-1")], { third: annotation("evidence-1", { fact: "开放数据访问" }) });
  assert.equal(third.record.stories.length, 1);
  assert.equal(JSON.stringify(third).includes("2026-09-04T22:00:00.000Z"), false);
  assert.match(third.canonicalMarkdown, /历史时间元数据因当前来源权限不可分发/);
});

test("A purported occurrence or development later than its disclosure cannot be published as an established event time", async (t) => {
  for (const field of ["occurrenceEvidenceId", "developmentEvidenceId"]) {
    const app = await fixture(t);
    const evidence = [{ ...request.evidenceBundle.evidence[0]!, eventTimeUtc: "2026-09-05T10:00:00.000Z" }];
    const report = await app.publish(task("2026-09-05", evidence), [story("future-occurrence", "ai", "evidence-1")], {
      "future-occurrence": annotation("evidence-1", { occurrenceEvidenceId: null, [field]: "evidence-1" }),
    });
    assert.equal(report.record.stories.length, 0);
    assert.match(report.canonicalMarkdown, /event-time-conflict/);
  }
});

test("A verified attributed statement can report the act of announcing without upgrading the publisher's claimed outcome to fact", async (t) => {
  for (const kind of ["valid", "wrong-publisher", "claimed-outcome"]) {
    const app = await fixture(t);
    const candidate: Story = { ...story("announcement", "ai", "evidence-1"), claims: [{ id: "statement", kind: "statement", publisherSourceId: "source-fixture",
      text: "示例观测站称其系统已达到全覆盖。", evidenceIds: ["evidence-1"] }] };
    const report = await app.publish(task(), [candidate], { announcement: annotation("evidence-1", {
      eventKind: kind === "claimed-outcome" ? "observed-event" : "publisher-statement", occurrenceEvidenceId: null, materialityClaimIds: [],
      identity: { subject: kind === "wrong-publisher" ? "another-source" : "source-fixture", action: "published-statement", object: "观测覆盖声明", discriminator: "第42期声明" },
      fact: "发布全覆盖声明",
    }) });
    assert.equal(report.record.stories.length, kind === "valid" ? 1 : 0, kind);
    if (kind === "valid") {
      assert.match(report.canonicalMarkdown, /发布者声明（source-fixture）：示例观测站称其系统已达到全覆盖/);
      assert.equal(report.canonicalMarkdown.includes("事实：示例观测站"), false);
      assert.match(report.canonicalMarkdown, /声明内容不等同于已证事实/);
    }
  }
});

test("Observed facts keep their supporting attributed reactions and statement-only stories keep separately labeled analysis", async (t) => {
  for (const mixed of [true, false]) {
    const app = await fixture(t);
    const candidate: Story = story("mixed", "ai", "evidence-1");
    const statement = { id: "statement", kind: "statement", publisherSourceId: "source-fixture", text: "发布者称这将扩大观测覆盖。", evidenceIds: ["evidence-1"] };
    if (mixed) candidate.claims.push(statement);
    else candidate.claims[0] = statement;
    const report = await app.publish(task(), [candidate], { mixed: annotation("evidence-1", mixed ? {} : {
      eventKind: "publisher-statement", occurrenceEvidenceId: null,
      identity: { subject: "source-fixture", action: "published-statement", object: "覆盖声明", discriminator: "第42期声明" },
    }) });
    assert.equal(report.record.stories.length, 1);
    assert.match(report.canonicalMarkdown, /发布者声明（source-fixture）：发布者称这将扩大观测覆盖/);
    assert.match(report.canonicalMarkdown, /分析（解释）：新增覆盖对持续观测有重大意义/);
    assert.equal(report.canonicalMarkdown.includes("事实：示例观测站新增了 12"), mixed);
  }
});

test("Unclassified legacy history remains visible while independently evidenced new events continue across later issues", async (t) => {
  const app = await fixture(t);
  const original = await app.publish({ ...task(), schemaVersion: 2 }, [story("legacy", "world-affairs", "evidence-1")], { legacy: annotation("evidence-1") });
  for (const date of ["2026-09-06", "2026-09-07"]) {
    app.restart();
    const day = date === "2026-09-06" ? "2026-09-05" : "2026-09-06";
    const evidence = [{ ...request.evidenceBundle.evidence[0]!, id: `new-${date}`, url: `https://example.net/new-${date}`,
      publishedAtUtc: `${day}T22:00:00.000Z`, discoveredAtUtc: `${day}T22:05:00.000Z`, retrievedAtUtc: `${day}T22:06:00.000Z` }];
    const report = await app.publish(task(date, evidence), [story("new", "ai", evidence[0]!.id, "另一机构公布了独立的研究成果。")], { new: annotation(evidence[0]!.id, { identity: { ...identity, subject: "另一机构", discriminator: date } }) });
    assert.equal(report.record.stories.length, 1);
    if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
    assert.deepEqual(report.record.historyCoverage, { status: "legacy-unclassified", versionIds: [original.version.id] });
    assert.match(report.canonicalMarkdown, /历史覆盖尚未完全分类/);
    assert.equal(report.record.eventClusters[0]!.previousCoverage, null);
  }
});

test("A current disclosure and a missed older material fact in one cluster label the older fact itself as late", async (t) => {
  const app = await fixture(t);
  const older = { ...request.evidenceBundle.evidence[0]!, id: "older", url: "https://example.net/earlier", publishedAtUtc: "2026-08-01T10:00:00.000Z" };
  const report = await app.publish(task("2026-09-05", [request.evidenceBundle.evidence[0]!, older]), [story("today", "world-affairs", "evidence-1"),
    story("missed", "ai", "older", "该计划此前已经开放公共数据。")], { today: annotation("evidence-1"), missed: annotation("older", { fact: "开放公共数据" }) });
  assert.equal(report.record.stories.length, 1);
  assert.match(report.canonicalMarkdown, /补报事实（Late-discovered Story）：首次公开披露 2026-08-01T10:00:00.000Z/);
  if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.equal(report.record.eventClusters[0]!.developments.find((development) => development.storyId === "missed")!.coverage, "late-discovered");
  assert.equal(report.record.eventClusters[0]!.developments.find((development) => development.storyId === "today")!.coverage, "current-disclosure");
});

test("Newly discovered earlier disclosure corrects the current cluster timeline while the earlier published version stays immutable", async (t) => {
  const app = await fixture(t);
  const first = await app.publish(task(), [story("first", "world-affairs", "evidence-1")], { first: annotation("evidence-1") });
  const original = JSON.stringify(first);
  app.restart();
  const earlier = { ...request.evidenceBundle.evidence[0]!, id: "earlier", url: "https://example.net/early-disclosure", publishedAtUtc: "2026-08-01T10:00:00.000Z",
    discoveredAtUtc: "2026-09-05T20:00:00.000Z", retrievedAtUtc: "2026-09-05T20:01:00.000Z" };
  const report = await app.publish(task("2026-09-06", [earlier]), [story("earlier", "ai", "earlier", "该计划更早已向公众开放数据。")], { earlier: annotation("earlier", { fact: "开放数据" }) });
  if (report.record.schemaVersion !== 4) assert.fail("Expected event-aware record");
  assert.equal(report.record.eventClusters[0]!.firstDisclosure.atUtc, "2026-08-01T10:00:00.000Z");
  assert.equal(report.record.eventClusters[0]!.firstDisclosure.versionId, "2026-09-06-v1");
  assert.equal(JSON.stringify(app.read(first.version.id)), original);
});

test("Damaged archived publication times are rejected before causal history filtering instead of creating false newness", async (t) => {
  for (const timestamp of ["2026-09-10T23:40:00.000Z", "2026-09-04T22:30:00.000Z"]) {
    const app = await fixture(t);
    const original = await app.publish(task(), [story("first", "world-affairs", "evidence-1")], { first: annotation("evidence-1") });
    const damaged = structuredClone(original);
    damaged.version.publishedAtUtc = timestamp;
    // External archive corruption fixture. All expectations remain at produce/readReport.
    const archive = new DatabaseSync(app.databasePath);
    try {
      archive.exec("DROP TRIGGER immutable_report_update");
      archive.prepare("UPDATE reports SET payload = ? WHERE id = ?").run(JSON.stringify(damaged), original.version.id);
      archive.exec("CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END;");
    } finally { archive.close(); }
    app.restart();
    await assert.rejects(app.publish(task("2026-09-06"), [story("repeat", "ai", "evidence-1")], { repeat: annotation("evidence-1") }), { code: "history-integrity-failed" });
    assert.throws(() => app.read("2026-09-06-v1"), { code: "not-found" });
  }
});

test("Legacy denial cannot confuse repeated template text at a static URL with a later independently evidenced event", async (t) => {
  const app = await fixture(t);
  await app.publish({ ...task(), schemaVersion: 2 }, [story("legacy", "world-affairs", "evidence-1")], { legacy: annotation("evidence-1") });
  const later = { ...request.evidenceBundle.evidence[0]!, eventTimeUtc: "2026-09-05T20:00:00.000Z", publishedAtUtc: "2026-09-05T22:00:00.000Z",
    discoveredAtUtc: "2026-09-05T22:05:00.000Z", retrievedAtUtc: "2026-09-05T22:06:00.000Z" };
  const report = await app.publish(task("2026-09-06", [later]), [story("independent", "ai", "evidence-1")], {
    independent: annotation("evidence-1", { identity: { ...identity, discriminator: "另一独立期次" } }),
  });
  assert.equal(report.record.stories.length, 1);
  assert.match(report.canonicalMarkdown, /历史覆盖尚未完全分类/);
});
