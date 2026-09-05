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

test("Cross-Edition evidence assignments and global research identities cannot be silently reassigned", async (t) => {
  const task = input();
  task.evidenceBundle.evidence.push({ ...task.evidenceBundle.evidence[0]!, id: "evidence-outside-ai" });
  const output = research(1);
  output.editions[1]!.result.stories[0]!.claims[0]!.evidenceIds = ["evidence-outside-ai"];
  const { observer } = await fixture(t, output);
  await assert.rejects(observer.produce(task), { code: "uncorrelated-agent-result" });
  assert.throws(() => observer.readReport("2026-09-05-v1", ownerToken), { code: "not-found" });
  for (const changed of [
    { ...research(1), taskId: "different-task" },
    { ...research(1), editions: research(1).editions.map((entry) => entry.edition !== "ai" ? entry : { ...entry, result: { ...entry.result, evidenceBundleId: "different-bundle" } }) },
  ]) {
    const { observer } = await fixture(t, changed);
    await assert.rejects(observer.produce(input()), { code: "uncorrelated-agent-result" });
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
