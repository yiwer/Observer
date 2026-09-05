import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { createObserver, type ObserverOptions } from "../src/observer.ts";
import { editionNames } from "../src/contracts.ts";
import { clock, ownerToken, request, successfulResult } from "./fixtures.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { policyDigest } from "../src/collection.ts";
import type { VerificationInput } from "../src/gate-contracts.ts";

const editions = Object.keys(editionNames) as Array<keyof typeof editionNames>;
function input() {
  return { ...structuredClone(request), schemaVersion: 2, editions: editions.map((edition) => ({ edition, evidenceIds: ["evidence-1"] })) };
}
function research(count = 7) {
  return { schemaVersion: 2, taskId: request.taskId, evidenceBundleId: request.evidenceBundle.id, configurationId: request.configurationId,
    editions: editions.map((edition) => ({ edition, status: "completed", result: { ...successfulResult(), taskId: `${request.taskId}:${edition}`,
      stories: Array.from({ length: count }, (_, index) => ({ schemaVersion: 2, id: `${edition}-${index}`, eventClusterId: `${edition}-event-${index}`, edition,
        title: "未经核验的标题不能发布", claims: [{ id: "event", kind: "fact", text: `${editionNames[edition]}示例观测站新增了 12 个观测点（条目 ${index + 1}）。`, evidenceIds: ["evidence-1"] }] })) } })) };
}
function verification(task: VerificationInput, override: (claimId: string) => Record<string, unknown> = () => ({})) {
  return { schemaVersion: 1, inputSha256: task.inputSha256, provenance: "annotated-fixture", verifierVersion: "six-edition-annotations-v1",
    assessments: task.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id, conclusion: "supported", reason: "supported-by-evidence", wording: "original",
      evidence: claim.evidenceIds.map((evidenceId) => ({ evidenceId, relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "observation-42" })), ...override(claim.id),
    }))) };
}
async function fixture(t: TestContext, output: unknown = research(), extra: Partial<ObserverOptions> = {}) {
  const directory = await mkdtemp(join(tmpdir(), "observer-six-"));
  const options = { databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture" as const, clock,
    editionRunner: { run: async () => structuredClone(output) },
    verifier: { verify: async (task: VerificationInput) => verification(task) }, ...extra };
  const observer = createObserver(options);
  t.after(async () => { observer.close(); await rm(directory, { recursive: true, force: true }); });
  return { observer, options };
}

test("A full six-Edition brief is privately readable with seven stories and three priorities per Edition", async (t) => {
  const { observer } = await fixture(t);
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(report.record.schemaVersion, 3);
  if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
  assert.equal(report.record.stories.length, 42);
  assert.equal(report.record.editions.length, 6);
  for (const edition of report.record.editions) {
    assert.equal(edition.storyIds.length, 7);
    assert.equal(edition.priorityStoryIds.length, 3);
    assert.equal(report.canonicalMarkdown.split(`## ${editionNames[edition.edition]}\n`).length - 1, 1);
    assert.match(report.canonicalMarkdown, new RegExp(`${editionNames[edition.edition]}示例观测站新增了 12`));
  }
  assert.match(report.canonicalMarkdown, /Today Overview/);
  assert.equal(report.canonicalMarkdown.includes("未经核验的标题"), false);
  assert.throws(() => observer.readReport(version.id, "incorrect"), { code: "unauthorized" });
});

test("A maximum-length six-Edition task preserves correlated successful and failed derived task identities", async (t) => {
  for (const failed of [false, true]) {
    const task = { ...input(), taskId: "t".repeat(200) };
    const output = research(1);
    const derived = { ...output, taskId: task.taskId, editions: output.editions.map((entry) => {
      const { stories, ...metadata } = entry.result;
      return { ...entry, result: failed && entry.edition === "frontier-technology"
        ? { ...metadata, taskId: `${task.taskId}:${entry.edition}`, status: "failed", failure: { category: "timeout", retryable: true } }
        : { ...metadata, taskId: `${task.taskId}:${entry.edition}`, stories } };
    }) };
    const { observer } = await fixture(t, derived);
    const report = observer.readReport((await observer.produce(task)).id, ownerToken);
    if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
    assert.equal(report.record.stories.length, failed ? 5 : 6);
    for (const entry of report.record.editionRuns) {
      if (entry.status !== "completed") assert.fail("Expected real correlated run metadata");
      assert.equal(entry.result.taskId, `${task.taskId}:${entry.edition}`);
      assert.equal(entry.result.status, failed && entry.edition === "frontier-technology" ? "failed" : "succeeded");
    }
  }
});

test("Sparse research preserves actual counts and known source gaps in the Edition and Overview", async (t) => {
  const source = policy(); source.sourceId = "source-fixture";
  const task = { ...input(), evidenceBundle: { ...request.evidenceBundle, schemaVersion: 2, evidence: [{ ...request.evidenceBundle.evidence[0]!,
    policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: "2026-09-05T23:00:00.000Z" }],
    coverageGaps: [{ sourceId: "missing-source", edition: "ai", reason: "fetch-failed" }] } };
  const { observer } = await fixture(t, research(1), { sourcePolicies: [source] });
  const version = await observer.produce(task);
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(report.record.stories.length, 6);
  assert.equal(report.record.coverageGaps.filter((gap) => gap.reason === "below-story-target").length, 6);
  assert.match(report.canonicalMarkdown.split("## 世界要闻")[0]!, /missing-source.*fetch-failed/);
  assert.match(report.canonicalMarkdown, /本栏实际 1 条/);
});

test("An entirely empty evidence snapshot produces six explicit no-evidence gaps without inventing Agent runs", async (t) => {
  const task = { ...input(), editions: editions.map((edition) => ({ edition, evidenceIds: [] })),
    evidenceBundle: { ...request.evidenceBundle, schemaVersion: 2, evidence: [], coverageGaps: [] } };
  const { observer } = await fixture(t, undefined, { editionRunner: { run: async () => { assert.fail("Empty evidence must not be sent to an Agent"); } } });
  const version = await observer.produce(task);
  const report = observer.readReport(version.id, ownerToken);
  if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
  assert.equal(report.record.stories.length, 0);
  assert.equal(report.record.editionRuns.filter((run) => run.status === "no-evidence").length, 6);
  assert.equal(report.record.coverageGaps.filter((gap) => gap.reason === "no-evidence").length, 6);
  assert.equal(JSON.stringify(report.record).includes('"provider"'), false);
  assert.match(report.canonicalMarkdown, /未取得可用证据/);
  assert.equal(report.record.publicationGate.verification, null);
});

test("One failed Edition preserves its actual failure and usage while successful empty research remains distinct", async (t) => {
  const output = research(1);
  const { stories: _stories, ...metadata } = output.editions[1]!.result;
  const mixed = { ...output, editions: output.editions.map((entry, index) => index === 1 ? { ...entry,
    result: { ...metadata, status: "failed", failure: { category: "timeout", retryable: true }, usage: { inputTokens: 25, outputTokens: null } },
  } : index === 2 ? { ...entry, result: { ...entry.result, stories: [] } } : entry) };
  const { observer } = await fixture(t, mixed);
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
  assert.equal(report.record.stories.length, 4);
  const run = report.record.editionRuns.find((entry) => entry.edition === "ai")!;
  assert.equal(run.status, "completed");
  if (run.status !== "completed") assert.fail("Expected real run metadata");
  assert.equal(run.result.status, "failed");
  assert.equal(run.result.usage?.inputTokens, 25);
  assert.equal(run.result.usage?.outputTokens, null);
  assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "ai" && gap.reason === "agent-timeout"));
  assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "finance" && gap.reason === "no-candidates"));
  assert.match(report.canonicalMarkdown, /研究运行未完成.*timeout/);
  assert.match(report.canonicalMarkdown, /研究已完成，但未返回候选/);
});

test("Priority explanations and cross-Edition Impact Notes use checked analysis claims without occupying story slots", async (t) => {
  const output = research(1);
  const ai = output.editions[1]!.result.stories[0]!;
  const analyses = [
    { id: "significance", kind: "analysis", mode: "explanation", text: "更密集的观测可能改善研究覆盖。", evidenceIds: ["evidence-1"] },
    { id: "impact", kind: "analysis", mode: "scenario", text: "若新点位持续提供数据，AI 训练数据的地域覆盖可能扩大。", evidenceIds: ["evidence-1"] },
    { id: "unknown", kind: "analysis", mode: "explanation", text: "目前仍不能判断新增数据的长期稳定性。", evidenceIds: ["evidence-1"] },
  ];
  const enriched = { ...output, editions: output.editions.map((entry) => entry.edition !== "ai" ? entry : { ...entry,
    result: { ...entry.result, stories: [{ ...ai, claims: [...ai.claims, ...analyses] }] },
    editorial: [{ storyId: ai.id, significanceClaimIds: ["significance"], impactClaimIds: ["impact"], uncertaintyClaimIds: ["unknown"],
      impactNotes: [{ edition: "frontier-technology", claimIds: ["impact"] }] }],
  }) };
  const { observer } = await fixture(t, enriched);
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
  assert.equal(report.record.stories.length, 6);
  assert.equal(report.record.editions.find((entry) => entry.edition === "frontier-technology")!.storyIds.length, 1);
  assert.match(report.canonicalMarkdown, /#### 事件/);
  assert.match(report.canonicalMarkdown, /#### 意义\n\n分析（解释）：更密集/);
  assert.match(report.canonicalMarkdown, /#### 影响路径\n\n分析（情景）：若新点位/);
  assert.match(report.canonicalMarkdown, /#### 未知\n\n分析（解释）：目前仍不能判断/);
  assert.match(report.canonicalMarkdown, /### Impact Note（不占普通条目）/);
  assert.match(report.canonicalMarkdown, /主栏全文.*#story-2/);
});

test("Rejected arbitrary story identities explain their Edition gap and unresolved sources retain their contrary attribution", async (t) => {
  const output = research(1);
  const ai = output.editions[1]!.result.stories[0]!;
  const changed = { ...output, editions: output.editions.map((entry) => entry.edition !== "ai" ? entry : { ...entry, result: { ...entry.result,
    stories: [{ ...ai, id: "story-without-edition-prefix", claims: [{ ...ai.claims[0]!, id: "disputed", text: "观测点数仍有分歧。" }] }],
  } }) };
  const { observer } = await fixture(t, changed, { verifier: { verify: async (task) => verification(task, (id) => id !== "disputed" ? {} : {
    conclusion: "conflicting", reason: "source-conflict", evidence: [{ evidenceId: "evidence-1", relation: "contradicts", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "observation-42" }],
  }) } });
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "ai" && gap.reason === "candidates-rejected"));
  const aiSection = report.canonicalMarkdown.split("## AI 日报")[1]!.split("## 财经日报")[0]!;
  assert.match(aiSection, /story-without-edition-prefix.*source-conflict/);
  assert.match(aiSection, /source-fixture（提供相反材料）/);
  assert.match(aiSection, /待确认说法（非已证事实）：观测点数仍有分歧/);
  assert.equal(report.canonicalMarkdown.split("## 世界要闻")[0]!.includes("观测点数仍有分歧"), false);
});

test("The immutable version binds the Record and Markdown, and rejects changed final wording even with a replaced body digest", async (t) => {
  const { observer } = await fixture(t, research(1));
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(version.schemaVersion, 2);
  if (version.schemaVersion !== 2) assert.fail("Expected content-bound Report Version");
  assert.equal(version.reportRecordSha256, createHash("sha256").update(JSON.stringify(report.record)).digest("hex"));
  const original = report.canonicalMarkdown;
  await assert.rejects(observer.produce(input()), { code: "version-already-exists" });
  assert.equal(observer.readReport(version.id, ownerToken).canonicalMarkdown, original);
  report.canonicalMarkdown = original.replaceAll("12 个观测点", "999 个观测点");
  report.version.canonicalMarkdownSha256 = createHash("sha256").update(report.canonicalMarkdown).digest("hex");
  const directory = await mkdtemp(join(tmpdir(), "observer-restored-six-"));
  const path = join(directory, "archive.sqlite");
  const archive = new DatabaseSync(path);
  archive.exec("CREATE TABLE reports (id TEXT PRIMARY KEY, payload TEXT NOT NULL); PRAGMA user_version = 1;");
  archive.prepare("INSERT INTO reports (id, payload) VALUES (?, ?)").run(version.id, JSON.stringify(report));
  archive.close();
  const restored = createObserver({ databasePath: path, ownerToken, mode: "test-fixture" });
  t.after(async () => { restored.close(); await rm(directory, { recursive: true, force: true }); });
  assert.throws(() => restored.readReport(version.id, ownerToken), { code: "canonical-integrity-failed" });
});

test("Malformed output in one identified Edition becomes a gap without inventing Agent identity or dropping five good Editions", async (t) => {
  const output = research(1);
  const broken = { ...output, editions: output.editions.map((entry) => entry.edition === "ai" ? { edition: "ai", status: "completed", result: { status: "succeeded", stories: [{ title: "UNVERIFIED INJECTION" }] } } : entry) };
  const { observer } = await fixture(t, broken);
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
  assert.equal(report.record.stories.length, 5);
  assert.deepEqual(report.record.editionRuns.find((run) => run.edition === "ai"), { edition: "ai", status: "invalid-output" });
  assert.equal(JSON.stringify(report).includes("UNVERIFIED INJECTION"), false);
  assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "ai" && gap.reason === "agent-invalid-output"));
});

test("Uncorrelated metadata in one uniquely identified Edition is isolated without losing five valid Editions", async (t) => {
  for (const field of ["taskId", "evidenceBundleId", "configurationId"] as const) {
    const output = research(7);
    output.editions[1]!.result[field] = "wrong-local-identity";
    const { observer } = await fixture(t, output);
    const report = observer.readReport((await observer.produce(input())).id, ownerToken);
    assert.equal(report.record.stories.length, 35, field);
    if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
    assert.deepEqual(report.record.editionRuns.find((entry) => entry.edition === "ai"), { edition: "ai", status: "invalid-output" });
    assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "ai" && gap.reason === "agent-invalid-output"));
    assert.equal(report.record.stories.some((story) => story.edition === "ai"), false);
    assert.match(report.canonicalMarkdown, /研究运行未完成.*invalid-output/);
    assert.equal(JSON.stringify(report).includes("wrong-local-identity"), false);
  }
});

test("Invalid timing or unqualified runtime metadata in one Edition cannot invalidate five eligible runs", async (t) => {
  for (const fault of ["before-cutoff", "reversed-time", "future-finish", "unqualified-provider"]) {
    const output = research(7);
    const result = output.editions[1]!.result;
    if (fault === "before-cutoff") result.startedAtUtc = "2026-09-04T23:29:00.000Z";
    if (fault === "reversed-time") result.startedAtUtc = "2026-09-04T23:39:00.000Z";
    if (fault === "future-finish") result.finishedAtUtc = "2026-09-04T23:41:00.000Z";
    if (fault === "unqualified-provider") result.provider = "codex";
    const { observer } = await fixture(t, output);
    const report = observer.readReport((await observer.produce(input())).id, ownerToken);
    assert.equal(report.record.stories.length, 35, fault);
    if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
    assert.deepEqual(report.record.editionRuns.find((entry) => entry.edition === "ai"), { edition: "ai", status: "invalid-output" });
    assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "ai" && gap.reason === "agent-invalid-output"));
    assert.equal(report.record.stories.some((story) => story.edition === "ai"), false);
  }
});

test("Editorial roles cannot promote missing, rejected or unconfirmed claims into Priority facts or Impact Notes", async (t) => {
  const output = research(1);
  const ai = output.editions[1]!.result.stories[0]!;
  const changed = { ...output, editions: output.editions.map((entry) => entry.edition !== "ai" ? entry : { ...entry,
    result: { ...entry.result, stories: [{ ...ai, claims: [...ai.claims,
      { id: "rejected", kind: "analysis", mode: "scenario", text: "UNSAFE GUARANTEED OUTCOME", evidenceIds: ["evidence-1"] },
      { id: "unconfirmed", kind: "analysis", mode: "scenario", text: "影响仍待进一步确认。", evidenceIds: ["evidence-1"] },
    ] }] },
    editorial: [{ storyId: ai.id, significanceClaimIds: ["missing"], impactClaimIds: ["rejected"], uncertaintyClaimIds: ["unconfirmed"], impactNotes: [{ edition: "finance", claimIds: ["event", "missing", "rejected", "unconfirmed"] }] }],
  }) };
  const { observer } = await fixture(t, changed, { verifier: { verify: async (task) => verification(task, (id) => id === "rejected" ? { conclusion: "unsafe", reason: "unsafe-material", wording: "unsafe" } : id === "unconfirmed" ? { conclusion: "insufficient", reason: "insufficient-evidence" } : {}) } });
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(JSON.stringify(report).includes("UNSAFE GUARANTEED OUTCOME"), false);
  assert.equal(report.canonicalMarkdown.includes("### Impact Note"), false);
  assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "ai" && gap.reason === "editorial-reference-unavailable"));
  assert.match(report.canonicalMarkdown, /内容缺口：未提供通过核验的意义陈述/);
  assert.match(report.canonicalMarkdown, /待确认说法（非已证事实）：影响仍待进一步确认/);
});

test("Freeform facts disguised as source gap reasons cannot enter a six-Edition brief", async (t) => {
  const task = { ...input(), editions: editions.map((edition) => ({ edition, evidenceIds: [] })), evidenceBundle: { ...request.evidenceBundle,
    schemaVersion: 2, evidence: [], coverageGaps: [{ edition: "ai", sourceId: "missing-source", reason: "UNVERIFIED 新增 999 个观测点。" }] } };
  const { observer } = await fixture(t);
  await assert.rejects(observer.produce(task), { code: "invalid-request" });
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
});

test("Source archive and distribution rights outrank story and length targets throughout six-Edition publication", async (t) => {
  for (const denial of ["none", "archive", "distribution", "citation"] as const) {
    const source = policy(); source.sourceId = "source-fixture";
    source.model.fields = ["content", "contentSha256"];
    if (denial === "archive") source.distribution.allowPermanentArchive = false;
    if (denial === "distribution") source.distribution.enabled = false;
    if (denial === "citation") source.citation.enabled = false;
    const task = { ...input(), evidenceBundle: { ...request.evidenceBundle, schemaVersion: 2, coverageGaps: [], evidence: [{ ...request.evidenceBundle.evidence[0]!,
      policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: "2026-09-05T23:00:00.000Z" }] } };
    const output = research(1);
    output.editions[0]!.result.stories[0]!.claims[0]!.text = "固定标注的完整事实。".repeat(160);
    const { observer } = await fixture(t, output, { sourcePolicies: [source] });
    const version = await observer.produce(task);
    const report = observer.readReport(version.id, ownerToken);
    assert.equal(report.record.stories.length, denial === "none" ? 6 : 0, denial);
    assert.equal(report.canonicalMarkdown.includes("固定标注的完整事实。".repeat(160)), denial === "none", denial);
    assert.equal(JSON.stringify(report).includes(request.evidenceBundle.evidence[0]!.content), false, denial);
    if (denial !== "none") assert.equal(report.record.evidenceBundle.evidence.length, 0, denial);
  }
});

test("Expiry during either research or verification is enforced before the next model stage and final six-Edition publication", async (t) => {
  for (const stage of ["research", "verification"] as const) {
    const source = policy(); source.sourceId = "source-fixture";
    const task = { ...input(), evidenceBundle: { ...request.evidenceBundle, schemaVersion: 2, coverageGaps: [], evidence: [{ ...request.evidenceBundle.evidence[0]!,
      policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: "2026-09-04T23:41:00.000Z" }] } };
    let now = clock();
    const { observer } = await fixture(t, research(1), { sourcePolicies: [source], clock: () => now,
      editionRunner: { run: async () => { if (stage === "research") now = "2026-09-04T23:42:00.000Z"; return research(1); } },
      verifier: { verify: async (task) => { assert.equal(stage, "verification", "Expired evidence must not reach another model"); now = "2026-09-04T23:42:00.000Z"; return verification(task); } },
    });
    const version = await observer.produce(task);
    const report = observer.readReport(version.id, ownerToken);
    assert.equal(report.record.stories.length, 0);
    assert.equal(version.publishedAtUtc, now);
    assert.match(report.canonicalMarkdown, /evidence-expired/);
    assert.equal(report.canonicalMarkdown.includes("事实："), false);
  }
});

test("A local cross-Edition evidence reference is isolated rather than reassigned or allowed to discard valid Editions", async (t) => {
  const task = input();
  task.evidenceBundle.evidence.push({ ...task.evidenceBundle.evidence[0]!, id: "evidence-outside-ai" });
  const output = research(1);
  output.editions[1]!.result.stories[0]!.claims[0]!.evidenceIds = ["evidence-outside-ai"];
  const { observer } = await fixture(t, output);
  const report = observer.readReport((await observer.produce(task)).id, ownerToken);
  assert.equal(report.record.stories.length, 5);
  if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
  assert.deepEqual(report.record.editionRuns.find((entry) => entry.edition === "ai"), { edition: "ai", status: "invalid-output" });
  assert.equal(report.record.evidenceBundle.evidence.some((entry) => entry.id === "evidence-outside-ai"), false);
  assert.equal(report.canonicalMarkdown.includes("事实：AI 日报"), false);
});

test("Inconsistent local Edition states and story ownership produce an explicit invalid-output gap", async (t) => {
  for (const fault of ["false-no-evidence", "valid-no-evidence", "completed-without-assignment", "wrong-story-edition", "unknown-evidence"]) {
    const task = input();
    const output = research(7);
    if (fault === "completed-without-assignment" || fault === "valid-no-evidence") task.editions[1]!.evidenceIds = [];
    if (fault === "wrong-story-edition") output.editions[1]!.result.stories[0]!.edition = "finance";
    if (fault === "unknown-evidence") output.editions[1]!.result.stories[0]!.claims[0]!.evidenceIds = ["not-in-bundle"];
    const changed = fault === "false-no-evidence" || fault === "valid-no-evidence" ? { ...output, editions: output.editions.map((entry) => entry.edition === "ai" ? { edition: "ai", status: "no-evidence" } : entry) } : output;
    const { observer } = await fixture(t, changed);
    const report = observer.readReport((await observer.produce(task)).id, ownerToken);
    assert.equal(report.record.stories.length, 35, fault);
    if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Report Record");
    assert.deepEqual(report.record.editionRuns.find((entry) => entry.edition === "ai"), { edition: "ai", status: fault === "valid-no-evidence" ? "no-evidence" : "invalid-output" });
    assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "ai" && gap.reason === (fault === "valid-no-evidence" ? "no-evidence" : "agent-invalid-output")));
    assert.equal(report.record.stories.some((story) => story.id.startsWith("ai-")), false);
  }
});

test("Global research identity or Edition-set errors still fail closed without publishing partial results", async (t) => {
  for (const fault of ["taskId", "evidenceBundleId", "configurationId", "duplicate-edition", "missing-edition", "unknown-edition"]) {
    const output = research(7);
    if (fault === "taskId" || fault === "evidenceBundleId" || fault === "configurationId") output[fault] = "wrong-global-identity";
    if (fault === "duplicate-edition") output.editions[1]!.edition = "world-affairs";
    if (fault === "missing-edition") output.editions.pop();
    const changed = fault === "unknown-edition" ? { ...output, editions: output.editions.map((entry) => entry.edition === "ai" ? { ...entry, edition: "unknown-edition" } : entry) } : output;
    const { observer } = await fixture(t, changed);
    await assert.rejects(observer.produce(input()), { code: fault === "missing-edition" || fault === "unknown-edition" ? "agent-invalid-output" : "uncorrelated-agent-result" });
    assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
  }
});

test("Invalid trusted six-Edition assignments and Bundle identity are rejected before research", async (t) => {
  for (const fault of ["duplicate-edition", "duplicate-assignment", "unknown-assignment", "bundle-config", "duplicate-evidence"]) {
    const task = input();
    if (fault === "duplicate-edition") task.editions[1]!.edition = "world-affairs";
    if (fault === "duplicate-assignment") task.editions[1]!.evidenceIds.push("evidence-1");
    if (fault === "unknown-assignment") task.editions[1]!.evidenceIds = ["not-in-bundle"];
    if (fault === "bundle-config") task.evidenceBundle.configurationId = "wrong-bundle-config";
    if (fault === "duplicate-evidence") task.evidenceBundle.evidence.push(structuredClone(task.evidenceBundle.evidence[0]!));
    const { observer } = await fixture(t, undefined, { editionRunner: { run: async () => { assert.fail("Invalid trusted input cannot reach research"); } } });
    await assert.rejects(observer.produce(task), { code: fault === "bundle-config" || fault === "duplicate-evidence" ? "invalid-bundle-identity" : "invalid-edition-input" });
    assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
  }
});

test("The source quotation quota is shared across Editions and never replaces ordinary accepted facts with filler", async (t) => {
  const source = policy(); source.sourceId = "source-fixture"; source.citation.maxCharacters = 10;
  const task = { ...input(), evidenceBundle: { ...request.evidenceBundle, schemaVersion: 2, coverageGaps: [], evidence: [{ ...request.evidenceBundle.evidence[0]!,
    policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: "2026-09-05T23:00:00.000Z" }] } };
  const output = research(1);
  const quoted = { ...output, editions: output.editions.map((entry) => ({ ...entry, result: { ...entry.result, stories: entry.result.stories.map((story) => ({ ...story,
    claims: [...story.claims, { id: "quote", kind: "quotation", originalText: "新增 12", text: "新增 12", translated: false, language: "zh", evidenceIds: ["evidence-1"] }],
  })) } })) };
  const { observer } = await fixture(t, quoted, { sourcePolicies: [source], verifier: { verify: async (task) => verification(task, (id) => id === "quote" ? { wording: "quotation" } : {}) } });
  const version = await observer.produce(task);
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(report.record.stories.length, 6);
  assert.equal(report.canonicalMarkdown.includes("引语（原文）"), false);
  assert.match(report.canonicalMarkdown, /citation-limit/);
  assert.match(report.canonicalMarkdown, /事实：AI 日报示例观测站新增了 12 个观测点/);
});

test("Six-Edition publication preserves pre-model permission checks and production fixture isolation", async (t) => {
  const source = policy(); source.sourceId = "source-fixture"; source.model.enabled = false;
  const task = { ...input(), evidenceBundle: { ...request.evidenceBundle, schemaVersion: 2, coverageGaps: [], evidence: [{ ...request.evidenceBundle.evidence[0]!,
    policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: "2026-09-05T23:00:00.000Z" }] } };
  const { observer } = await fixture(t, research(1), { sourcePolicies: [source], editionRunner: { run: async () => { assert.fail("Forbidden material cannot reach research"); } } });
  await assert.rejects(observer.produce(task), { code: "model-forbidden" });
  const normal = await fixture(t, research(1));
  const version = await normal.observer.produce(input());
  const production = createObserver({ ...normal.options, mode: "production" });
  try {
    await assert.rejects(production.produce(input()), { code: "publication-disabled" });
    assert.throws(() => production.readReport(version.id, ownerToken), { code: "not-found" });
  } finally { production.close(); }
});

test("Statement-only leading stories keep meaningful attributed titles in the Overview without becoming facts", async (t) => {
  for (const statement of ["示例观测站称其将新增 12 个观测点。", "据称计划仍待落实。".repeat(444)]) {
  const output = research(1);
  const statements = { ...output, editions: output.editions.map((entry) => ({ ...entry, result: { ...entry.result, stories: entry.result.stories.map((story) => ({ ...story,
    claims: [{ ...story.claims[0]!, kind: "statement", publisherSourceId: "source-fixture", text: statement }],
  })) } })) };
  const { observer } = await fixture(t, statements, { verifier: { verify: async (task) => verification(task, () => ({ evidence: [{ evidenceId: "evidence-1", relation: "supports", basis: "publisher-statement", reliability: "reliable", upstreamOriginId: "observation-42" }] })) } });
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  assert.ok(report.canonicalMarkdown.split("## 世界要闻")[0]!.includes(`发布者声明（source-fixture）：${statement}`));
  assert.equal(report.canonicalMarkdown.includes("事实："), false);
  }
});

test("Six Editions retain all 42 selected stories across the 500-receipt boundary and full 15000-claim input", async (t) => {
  for (const count of [500, 501, 504, 15000]) {
    const output = research(count === 15000 ? 50 : 7);
    let remaining = count;
    for (const entry of output.editions) for (const story of entry.result.stories) {
      const size = Math.min(count === 15000 ? 50 : 12, remaining);
      story.claims = Array.from({ length: size }, (_, index) => ({ ...story.claims[0]!, id: `claim-${index}`, text: `${story.edition}第 ${index + 1} 项固定观测记录。` }));
      remaining -= size;
    }
    const { observer } = await fixture(t, output);
    const version = await observer.produce(input());
    const report = observer.readReport(version.id, ownerToken);
    assert.equal(report.record.stories.length, 42, `${count} claims`);
    assert.equal(report.record.stories.reduce((total, story) => total + story.claims.length, 0), count === 15000 ? 2100 : count);
    if (report.record.schemaVersion !== 3 || report.record.publicationGate.schemaVersion !== 2) assert.fail("Expected explicit batch ledger");
    const gate = report.record.publicationGate;
    assert.equal(gate.verification, null, "No fabricated aggregate verification");
    assert.equal(gate.decisions.filter((decision) => decision.outcome === "published").length, count);
    assert.equal(gate.batches.reduce((total, batch) => total + (batch.verification?.assessments.length ?? 0), 0), count);
    assert.ok(gate.batches.length <= 30);
    for (const batch of gate.batches) {
      assert.ok(batch.verification!.assessments.length <= 500);
      assert.equal(batch.verification!.inputSha256, batch.input.inputSha256);
    }
    assert.equal(new Set(gate.batches.map((batch) => batch.input.inputSha256)).size, gate.batches.length);
    assert.equal(new Set(gate.batches.map((batch) => batch.input.taskId)).size, gate.batches.length);
  }
});

test("Local duplicate claim, story and evidence-reference identities cannot poison unaffected stories or Editions", async (t) => {
  for (const fault of ["claim", "story-within", "story-across", "evidence-reference"]) {
    const output = research(7);
    const ai = output.editions[1]!.result.stories;
    if (fault === "claim") ai[0]!.claims.push(structuredClone(ai[0]!.claims[0]!));
    if (fault === "story-within") ai[1]!.id = ai[0]!.id;
    if (fault === "story-across") ai[0]!.id = output.editions[0]!.result.stories[0]!.id;
    if (fault === "evidence-reference") ai[0]!.claims[0]!.evidenceIds.push("evidence-1");
    const { observer } = await fixture(t, output);
    const version = await observer.produce(input());
    const report = observer.readReport(version.id, ownerToken);
    assert.equal(report.record.stories.length, fault.startsWith("story-") ? 40 : 41, fault);
    if (report.record.schemaVersion !== 3) assert.fail("Expected six-Edition Record");
    assert.equal(report.record.publicationGate.decisions.filter((decision) => decision.reason === "invalid-verifier-receipt").length, 0, fault);
    assert.ok(report.record.publicationGate.decisions.some((decision) => decision.reason === "ambiguous-claim-identity"));
    assert.match(report.canonicalMarkdown, /GitHub 热门项目示例观测站新增了 12 个观测点/);
  }
});

test("A replayed or miscorrelated batch receipt rejects only its own Edition at 504 claims", async (t) => {
  const output = research(7);
  for (const entry of output.editions) for (const story of entry.result.stories) {
    story.claims = Array.from({ length: 12 }, (_, index) => ({ ...story.claims[0]!, id: `claim-${index}` }));
  }
  let previous: unknown;
  const { observer } = await fixture(t, output, { verifier: { verify: async (task) => {
    if (task.stories[0]?.edition === "ai") return previous;
    const receipt = verification(task);
    previous = receipt;
    return receipt;
  } } });
  const version = await observer.produce(input());
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(report.record.stories.length, 35);
  assert.equal(report.record.stories.reduce((total, story) => total + story.claims.length, 0), 420);
  if (report.record.schemaVersion !== 3 || report.record.publicationGate.schemaVersion !== 2) assert.fail("Expected batch ledger");
  const gate = report.record.publicationGate;
  assert.equal(gate.batches.filter((batch) => batch.verification === null).length, 1);
  assert.equal(gate.decisions.filter((decision) => decision.reason === "invalid-verifier-receipt").length, 84);
  assert.equal(report.record.stories.some((story) => story.edition === "ai"), false);
});

test("Later batches recheck model TTL and the final publication instant revokes an earlier supported batch", async (t) => {
  const source = policy(); source.sourceId = "source-fixture";
  const expiry = "2026-09-04T23:41:00.000Z";
  const task = { ...input(), editions: editions.map((edition) => ({ edition, evidenceIds: [edition === "world-affairs" ? "evidence-1" : "evidence-2"] })),
    evidenceBundle: { ...request.evidenceBundle, schemaVersion: 2, coverageGaps: [], evidence: ["evidence-1", "evidence-2"].map((id) => ({ ...request.evidenceBundle.evidence[0]!, id,
      policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: id === "evidence-1" ? expiry : "2026-09-05T23:00:00.000Z" })) } };
  const output = research(7);
  for (const entry of output.editions) for (const story of entry.result.stories) {
    story.claims = Array.from({ length: 12 }, (_, index) => ({ ...story.claims[0]!, id: `claim-${index}`, evidenceIds: [entry.edition === "world-affairs" ? "evidence-1" : "evidence-2"] }));
  }
  let now = clock();
  const { observer } = await fixture(t, output, { clock: () => now, sourcePolicies: [source], verifier: { verify: async (task) => {
    if (now >= expiry) assert.equal(task.evidence.some((item) => item.id === "evidence-1"), false, "Expired evidence must not enter a later model send");
    if (task.stories[0]?.edition === "ai") now = "2026-09-04T23:42:00.000Z";
    return verification(task);
  } } });
  const version = await observer.produce(task);
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(report.record.stories.length, 35);
  assert.equal(report.record.stories.reduce((total, story) => total + story.claims.length, 0), 420);
  assert.deepEqual(report.record.evidenceBundle.evidence.map((item) => item.id), ["evidence-2"]);
  assert.equal(version.publishedAtUtc, now);
  if (report.record.schemaVersion !== 3 || report.record.publicationGate.schemaVersion !== 2) assert.fail("Expected batch ledger");
  assert.equal(report.record.publicationGate.checkedAtUtc, now);
  assert.equal(report.record.publicationGate.batches[0]!.checkedAtUtc, clock());
  assert.equal(report.record.publicationGate.batches[0]!.verification!.assessments.length, 84, "The first batch was actually verified before expiry");
  assert.equal(report.record.publicationGate.decisions.filter((decision) => decision.policy.reason === "evidence-expired").length, 84);
  assert.equal(report.canonicalMarkdown.includes("世界要闻示例观测站新增了 12"), false);
});
