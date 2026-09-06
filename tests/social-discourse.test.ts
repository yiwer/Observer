import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createObserver } from "../src/observer.ts";
import { editionNames, type PublishedReport, type SixEditionRequest } from "../src/contracts.ts";
import type { CandidateV2, VerificationInput } from "../src/gate-contracts.ts";
import { ownerToken, request, successfulResult } from "./fixtures.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { createHash } from "node:crypto";
import { policyDigest, type SourcePolicy } from "../src/collection.ts";
import type { DiscourseAdapter } from "../src/mastodon-adapter.ts";
import { createMastodonAdapter } from "../src/mastodon-adapter.ts";

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "observer-discourse-"));
  const task = { ...structuredClone(request), schemaVersion: 6,
    editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: edition === "world-affairs" ? ["evidence-1"] : [] })) };
  const source: SourcePolicy = { ...policy(), edition: "social-discourse" };
  let sampleReads = 0;
  const runnerInputs: unknown[] = [];
  const verifierInputs: unknown[] = [];
  const socialStories: CandidateV2[] = [];
  const options = { databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture" as const,
    clock: () => "2026-09-04T23:40:00.000Z", sourcePolicies: [source],
    discourse: { configuration: { schemaVersion: 1, version: 1, groups: [{ id: "linked", sourceId: source.sourceId,
      tag: "observatory", language: null, regionBasis: null, kind: "story-linked", linkedEvidenceIds: ["evidence-1"] }] },
      adapter: { revalidate: async () => { sampleReads++; return "social-no-eligible-source"; } } as DiscourseAdapter },
    editionRunner: { run: async (input: unknown) => { runnerInputs.push(structuredClone(input)); return ({ schemaVersion: 2, taskId: task.taskId, evidenceBundleId: task.evidenceBundle.id, configurationId: task.configurationId,
      editions: (input as SixEditionRequest).editions.map((entry) => !entry.evidenceIds.length ? { edition: entry.edition, status: "no-evidence" } : {
        edition: entry.edition, status: "completed", result: { ...successfulResult(), taskId: `${task.taskId}:${entry.edition}`,
          stories: entry.edition === "social-discourse" ? socialStories : [{ schemaVersion: 2, id: "news", eventClusterId: "candidate-suggestion", edition: entry.edition, title: "不可信标题",
            claims: [{ id: "fact", kind: "fact", text: "示例观测站发布了更新。", evidenceIds: ["evidence-1"] }] }] } }) }); } },
    verifier: { verify: async (input: VerificationInput) => { verifierInputs.push(structuredClone(input)); return ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "discourse-fixture-v1",
      assessments: input.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id,
        conclusion: "supported", reason: "supported-by-evidence", wording: "original",
        evidence: claim.evidenceIds.map((evidenceId) => ({ evidenceId, relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "observatory" })),
        domain: { domains: [story.edition === "social-discourse" ? "other" : "world-affairs"], risk: { level: "routine", categories: [] }, assertion: claim.kind === "analysis" ? "interpretation" : "event-fact", financialContent: "not-financial",
          materials: claim.evidenceIds.map((evidenceId) => ({ evidenceId, kind: "text" })), numbers: { status: "none", statistics: [] } },
        event: { identity: { subject: "observatory", action: "published", object: "update", discriminator: "2026-09-04" }, primaryEdition: "world-affairs",
          materiality: "routine", materialityClaimIds: [], occurrenceEvidenceId: null, disclosureEvidenceId: "evidence-1", developmentEvidenceId: null, fact: "update-published" },
        ...(story.edition === "social-discourse" ? { discourse: { scope: "sample-only", content: "arguments-and-disagreements", individualProfiling: false } } : {}),
      }))) }); } } };
  let observer = createObserver(options);
  t.after(() => observer.close());
  const profileFile = join(directory, "interest.json");
  await writeFile(profileFile, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  observer.importInterestProfile(profileFile);
  return { directory, task, options, runnerInputs, verifierInputs, socialStories, get observer() { return observer; }, get sampleReads() { return sampleReads; },
    restart() { observer.close(); observer = createObserver(options); } };
}

async function saveDemo(t: TestContext, directory: string, report: PublishedReport, label: string) {
  await writeFile(join(directory, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(directory, "report.md"), report.canonicalMarkdown);
  t.diagnostic(`${label} self-authored fixture replay: ${directory}`);
}

async function sampleFixture(t: TestContext, count = 12, kind: "platform-native" | "story-linked" = "platform-native") {
  const app = await fixture(t);
  const source: SourcePolicy = { ...app.options.sourcePolicies[0]!, collection: { ...app.options.sourcePolicies[0]!.collection, readBody: true },
    social: { platform: "mastodon", allowedTags: ["observatory"], allowApiResponseProcessing: true, allowStatusKeys: true, allowAnonymousText: true,
      irrevocableExportAllowed: true, deletionScope: "raw-only" } };
  const newsPolicy: SourcePolicy = { ...policy(), sourceId: "source-fixture", edition: "world-affairs" };
  app.options.sourcePolicies.splice(0, app.options.sourcePolicies.length, source, newsPolicy);
  const configuration = { ...app.options.discourse.configuration, groups: [{ ...app.options.discourse.configuration.groups[0]!, kind }] };
  app.options.discourse.configuration = configuration;
  const statuses = Array.from({ length: count }, (_, index) => ({ id: `fixture-${index}`, created_at: index < Math.ceil(count / 2) ? "2026-09-04T01:00:00.000Z" : "2026-09-04T22:00:00.000Z",
    edited_at: null, visibility: "public", sensitive: false, spoiler_text: "", content: `<p>新观点${index}：${index % 2 ? "公开误差有助于复核" : "观测覆盖需要持续改善"}。 <a href="https://source.example/tags/observatory" class="mention hashtag" rel="tag">#<span>observatory</span></a></p>`, language: "zh",
    media_attachments: [] as unknown[], card: null, poll: null, reblog: null, quote: null, in_reply_to_id: null, account: { display_name: "HIDDEN-PROFILE-CANARY" } }));
  const calls: string[] = [];
  const hooks: { status?: () => Promise<void>; responseStatus: number; now: string } = { responseStatus: 200, now: "2026-09-04T23:20:00.000Z" };
  const adapter = createMastodonAdapter({ clock: () => hooks.now, read: async (url) => {
    calls.push(url);
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/v1/statuses/")) { await hooks.status?.(); return { status: hooks.responseStatus,
      body: JSON.stringify(statuses.find((item) => item.id === decodeURIComponent(parsed.pathname.split("/").at(-1)!))), headers: {} }; }
    const page = parsed.searchParams.has("max_id") ? [] : statuses;
    return { status: 200, body: JSON.stringify(page), headers: page.length ? { link: `<https://source.example/api/v1/timelines/tag/observatory?max_id=${page.at(-1)!.id}>; rel="next"` } : {} };
  } });
  const snapshot = await adapter.capture({ sourcePolicy: source, configuration, groupId: "linked", businessDate: app.task.businessDate,
    windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc });
  app.options.discourse.adapter = adapter;
  const originalVerify = app.options.verifier.verify;
  app.options.verifier.verify = async (input) => {
    const result = await originalVerify(input);
    for (const assessment of result.assessments) if (assessment.discourse) assessment.discourse.content = kind === "platform-native" ? "emerging-topic" : "arguments-and-disagreements";
    return result;
  };
  app.socialStories.push({ schemaVersion: 2, id: "social-sample", eventClusterId: "linked", edition: "social-discourse", title: "未采纳标题",
    claims: [{ id: "argument", kind: "analysis", mode: "explanation", text: "样本中新出现对观测覆盖与公开误差的讨论。", evidenceIds: ["discourse-linked"] }] });
  app.restart();
  const task = { ...app.task, discourseSamples: [snapshot], evidenceBundle: { ...app.task.evidenceBundle, schemaVersion: 2, coverageGaps: [],
    evidence: app.task.evidenceBundle.evidence.map((evidence) => ({ ...evidence, policyVersion: newsPolicy.version, policySha256: policyDigest(newsPolicy), trust: "untrusted-source-data", expiresAtUtc: "2026-09-05T23:00:00.000Z" })) } };
  return { ...app, get observer() { return app.observer; }, source, adapter, snapshot, task, hooks, statuses, calls };
}

test("A source without explicit discourse uses is never sampled; ordinary news and the social permission gap remain readable after restart", async (t) => {
  const app = await fixture(t);
  const version = await app.observer.produce(app.task);
  const report = app.observer.readReport(version.id, ownerToken);
  assert.equal(app.sampleReads, 0);
  assert.equal(report.record.schemaVersion, 7);
  assert.equal(report.version.schemaVersion, 6);
  assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
  assert.match(report.canonicalMarkdown, /无合规社交来源/);
  assert.match(report.canonicalMarkdown, /示例观测站发布了更新/);
  assert.throws(() => app.observer.readReport(version.id, "wrong"), /unauthorized/);
  app.restart();
  assert.equal(JSON.stringify(app.observer.readReport(version.id, ownerToken)), JSON.stringify(report));
  await saveDemo(t, app.directory, report, "no-permission-gap");
});

test("A pre-cutoff Mastodon capture becomes anonymous Story-linked Discourse pointing to the selected news cluster", async (t) => {
  const app = await fixture(t);
  const { createMastodonAdapter } = await import("../src/mastodon-adapter.ts");
  const source = { ...app.options.sourcePolicies[0]!, collection: { ...app.options.sourcePolicies[0]!.collection, readBody: true },
    social: { platform: "mastodon" as const, allowedTags: ["observatory"], allowApiResponseProcessing: true, allowStatusKeys: true,
      allowAnonymousText: true, irrevocableExportAllowed: true, deletionScope: "raw-only" as const } };
  app.options.sourcePolicies[0] = source;
  const statuses = Array.from({ length: 6 }, (_, index) => ({ id: `post-${index}`, created_at: index < 3 ? "2026-09-04T01:00:00.000Z" : "2026-09-04T22:00:00.000Z",
    edited_at: null, visibility: "public", sensitive: false, spoiler_text: "", content: `<p>虚构观点${index}：${index % 2 ? "应先公开误差区间" : "新增观测点有助于覆盖"}。 <a href="https://source.example/tags/observatory" class="mention hashtag" rel="tag">#<span>observatory</span></a></p>`, language: "zh",
    media_attachments: [], card: null, poll: null, reblog: null, quote: null, in_reply_to_id: null,
    account: { id: `author-${index}`, display_name: "PRIVATE-ACCOUNT-CANARY", avatar: "https://private.invalid/PRIVATE-AVATAR-CANARY" } }));
  const adapter = createMastodonAdapter({ clock: () => "2026-09-04T23:20:00.000Z", read: async (url: string) => {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/v1/statuses/")) return { status: 200, body: JSON.stringify(statuses.find((item) => item.id === decodeURIComponent(parsed.pathname.split("/").at(-1)!))), headers: {} };
    const cursor = parsed.searchParams.get("max_id");
    const page = cursor === null ? statuses.slice(0, 3) : cursor === "post-2" ? statuses.slice(3) : [];
    return { status: 200, body: JSON.stringify(page), headers: page.length ? { link: `<https://source.example/api/v1/timelines/tag/observatory?max_id=${page.at(-1)!.id}>; rel="next"` } : {} };
  } });
  const snapshot = await adapter.capture({ sourcePolicy: source, configuration: app.options.discourse.configuration, groupId: "linked", businessDate: app.task.businessDate,
    windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc });
  app.options.discourse.adapter = adapter;
  const newsPolicy = { ...policy(), sourceId: "source-fixture", edition: "world-affairs" as const };
  app.options.sourcePolicies.push(newsPolicy);
  app.socialStories.push({ schemaVersion: 2, id: "social-linked", eventClusterId: "linked", edition: "social-discourse", title: "不可信社交标题",
    claims: [{ id: "arguments", kind: "analysis", mode: "explanation", text: "样本中的分歧是新增观测点的覆盖价值与误差披露是否充分。", evidenceIds: ["discourse-linked"] }] });
  app.restart();
  const version = await app.observer.produce({ ...app.task, discourseSamples: [snapshot], evidenceBundle: { ...app.task.evidenceBundle, schemaVersion: 2, coverageGaps: [],
    evidence: app.task.evidenceBundle.evidence.map((evidence) => ({ ...evidence, policyVersion: newsPolicy.version, policySha256: policyDigest(newsPolicy), trust: "untrusted-source-data", expiresAtUtc: "2026-09-05T23:00:00.000Z" })) } });
  const report = app.observer.readReport(version.id, ownerToken);
  assert.match(report.canonicalMarkdown, /Story-linked Discourse/);
  assert.match(report.canonicalMarkdown, /样本中的分歧是新增观测点的覆盖价值与误差披露是否充分/);
  assert.match(report.canonicalMarkdown, /主 Event Cluster.*event-/);
  assert.match(report.canonicalMarkdown, /样本量：6/);
  assert.match(report.canonicalMarkdown, /不作为主故事的独立事实证明/);
  assert.ok(!JSON.stringify([...app.runnerInputs, ...app.verifierInputs, report]).includes("PRIVATE-"));
  assert.ok(!JSON.stringify(app.runnerInputs).includes("discourseSamples"));
  assert.ok(!JSON.stringify(app.runnerInputs).includes("reviewedBy"));
  app.restart();
  assert.equal(JSON.stringify(app.observer.readReport(version.id, ownerToken)), JSON.stringify(report));
  await saveDemo(t, app.directory, report, "story-linked");
});

test("Social material cannot bypass sampling permissions by entering the ordinary Evidence Bundle or another Edition", async (t) => {
  const app = await fixture(t);
  const content = "FORBIDDEN-SOCIAL-CANARY";
  app.task.evidenceBundle.evidence.push({ ...structuredClone(app.task.evidenceBundle.evidence[0]!), id: "social-bypass", sourceId: "owner-test", content,
    contentSha256: createHash("sha256").update(content).digest("hex") });
  app.task.editions.find((entry) => entry.edition === "world-affairs")!.evidenceIds.push("social-bypass");
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.ok(!JSON.stringify(app.runnerInputs).includes(content));
  assert.ok(!JSON.stringify(report).includes(content));
  assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
  assert.match(report.canonicalMarkdown, /无合规社交来源/);
});

test("An unsampled query discloses its platform and window while unobserved language, geography and sample size remain unknown", async (t) => {
  const app = await fixture(t);
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.match(report.canonicalMarkdown, /平台：Mastodon/);
  assert.match(report.canonicalMarkdown, /查询：#observatory/);
  assert.match(report.canonicalMarkdown, /语言：未知/);
  assert.match(report.canonicalMarkdown, /地域依据：未知/);
  assert.match(report.canonicalMarkdown, /样本量：未知（未采集）/);
  assert.match(report.canonicalMarkdown, /2026-09-03T23:30:00.000Z.*2026-09-04T23:30:00.000Z/);
});

test("The Interest Profile is frozen before the first asynchronous sample revalidation", async (t) => {
  const app = await sampleFixture(t);
  const profileFile = join(await mkdtemp(join(tmpdir(), "observer-discourse-profile-")), "v2.json");
  await writeFile(profileFile, JSON.stringify({ schemaVersion: 1, version: 2, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["en"] }));
  let imported = false;
  app.hooks.status = async () => { if (!imported) { imported = true; app.observer.importInterestProfile(profileFile); } };
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.match(report.canonicalMarkdown, /Interest Profile：v1/);
});

test("A native-only brief selects a platform signal at the frozen threshold and reports a readable sample gap below it", async (t) => {
  for (const count of [12, 11]) {
    const app = await sampleFixture(t, count);
    app.task.evidenceBundle.evidence = [];
    app.task.editions = app.task.editions.map((entry) => ({ ...entry, evidenceIds: [] }));
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(report.record.stories.length, 0);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.equal(report.record.discourse.observations.length, count === 12 ? 1 : 0);
    if (count === 12) {
      assert.match(report.canonicalMarkdown, /社交话语观察.*已核验 1 组样本观察/);
      assert.match(report.canonicalMarkdown, /本栏实际 1 组话语观察/);
      assert.match(report.canonicalMarkdown, /平台原生信号候选，非新闻事实/);
    } else {
      assert.match(report.canonicalMarkdown, /未达到预先固定的采样门槛/);
      assert.ok(!JSON.stringify([...app.runnerInputs, ...app.verifierInputs]).includes("新观点"));
    }
    app.restart();
    assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
    if (count === 12) await saveDemo(t, app.directory, report, "platform-native-only");
  }
});

test("A post-Verifier unavailable sample leaves only a gap and bounded audit identifiers, with no social wording or annotations in the restarted archive", async (t) => {
  const app = await sampleFixture(t);
  const marker = "FINAL-SOCIAL-CANARY";
  app.socialStories[0]!.claims[0]!.text = marker;
  const original = app.options.verifier.verify;
  app.options.verifier.verify = async (input) => {
    const result = await original(input);
    if (input.stories.some((story) => story.edition === "social-discourse")) {
      for (const assessment of result.assessments) if (assessment.discourse) assessment.evidence[0]!.upstreamOriginId = marker;
      app.hooks.responseStatus = 404;
    }
    return result;
  };
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.observations.length, 0);
  assert.ok(!JSON.stringify(report).includes(marker));
  assert.ok(!JSON.stringify(report).includes("新观点"));
  assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
  assert.match(report.canonicalMarkdown, /样本在本实例复查不可用/);
  assert.ok(!report.record.evidenceBundle.evidence.some((entry) => entry.id === "discourse-linked"));
  assert.ok(report.record.publicationGate.decisions.some((decision) => decision.storyId === "social-sample" && decision.outcome === "quarantined"));
  app.restart();
  assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
});

test("Unrecognized platform language metadata stays unknown and cannot carry arbitrary source text into permanent reports", async (t) => {
  const app = await sampleFixture(t);
  for (const status of app.statuses) status.language = "PRIVATE-LANGUAGE";
  app.task.discourseSamples = [await app.adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration, groupId: "linked", businessDate: app.task.businessDate,
    windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc })];
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.ok(!JSON.stringify(report).includes("PRIVATE-LANGUAGE"));
  assert.match(report.canonicalMarkdown, /语言：未知/);
});

test("Native sample topics obey the frozen explicit exclusion without acquiring a Global Baseline or demographic region", async (t) => {
  const app = await sampleFixture(t);
  const profileFile = join(await mkdtemp(join(tmpdir(), "observer-discourse-exclusion-")), "v2.json");
  await writeFile(profileFile, JSON.stringify({ schemaVersion: 1, version: 2, topics: [], entities: [], regions: [], exclusions: { topics: ["observation-methods"], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  app.observer.importInterestProfile(profileFile);
  const original = app.options.verifier.verify;
  app.options.verifier.verify = async (input) => {
    const result = await original(input);
    return { ...result, assessments: result.assessments.map((assessment) => assessment.discourse ? { ...assessment, selection: {
      topics: ["observation-methods"], entities: [], regions: ["CN"], evidenceLanguages: [], impact: "global", impactClaimIds: ["argument"], impactBasis: "observed-event",
    } } : assessment) };
  };
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.observations.length, 0);
  assert.ok(report.record.interestSelections.some((selection) => selection.storyId === "social-sample" && selection.outcome === "excluded" && selection.baseline === false));
  assert.match(report.canonicalMarkdown, /平台原生观察被本期明确兴趣排除/);
});

test("A selected native observation has a reproducible priority and never creates a news Event Cluster", async (t) => {
  const app = await sampleFixture(t);
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.observations[0]!.priority, true);
  assert.equal(report.record.eventClusters.length, 1);
  assert.ok(report.record.eventClusters.every((cluster) => cluster.primary.storyId === "news"));
  app.restart();
  assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
});

test("Cancellation while a source transport never resolves is observed as cancellation rather than a later timeout", async (t) => {
  const app = await sampleFixture(t);
  const controller = new AbortController();
  const adapter = createMastodonAdapter({ clock: () => "2026-09-04T23:20:00.000Z", read: async () => { controller.abort(); return await new Promise<never>(() => {}); } });
  const sample = await adapter.capture({ sourcePolicy: { ...app.source, limits: { ...app.source.limits, timeoutMs: 20 } }, configuration: app.options.discourse.configuration,
    groupId: "linked", businessDate: app.task.businessDate, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc, signal: controller.signal });
  assert.equal(sample.reason, "social-cancelled");
});

test("An incomplete timeline page is quarantined with its actual pagination gap, not a misleading invalid snapshot", async (t) => {
  const app = await sampleFixture(t);
  const adapter = createMastodonAdapter({ clock: () => "2026-09-04T23:20:00.000Z", read: async () => ({ status: 200, headers: {}, body: JSON.stringify(app.statuses) }) });
  app.options.discourse.adapter = adapter;
  app.task.discourseSamples = [await adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration,
    groupId: "linked", businessDate: app.task.businessDate, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc })];
  app.restart();
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.groups[0]!.reason, "social-pagination-incomplete");
  assert.equal(report.record.discourse.groups[0]!.receivedCount, 12);
  assert.equal(report.record.discourse.observations.length, 0);
  assert.ok(!JSON.stringify([...app.runnerInputs, report]).includes("新观点"));
  assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
});

test("External adapter error strings cannot become permanent reason codes or leak source text", async (t) => {
  const app = await sampleFixture(t);
  const marker = "social-private-source-canary";
  const adapter = createMastodonAdapter({ clock: () => "2026-09-04T23:20:00.000Z", read: async () => { throw new Error(marker); } });
  const sample = await adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration,
    groupId: "linked", businessDate: app.task.businessDate, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc });
  assert.equal(sample.reason, "social-invalid-response");
  app.options.discourse.adapter = { revalidate: async () => marker };
  app.restart();
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.ok(!JSON.stringify(report).includes(marker));
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.groups[0]!.reason, "social-recheck-incomplete");
});

test("A timeline response received across cutoff is not backdated and produces a cutoff gap while news survives", async (t) => {
  const app = await sampleFixture(t);
  let now = "2026-09-04T23:29:00.000Z";
  const adapter = createMastodonAdapter({ clock: () => now, read: async () => { now = "2026-09-04T23:31:00.000Z"; return { status: 200, headers: {}, body: JSON.stringify(app.statuses) }; } });
  app.task.discourseSamples = [await adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration,
    groupId: "linked", businessDate: app.task.businessDate, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc })];
  assert.equal(app.task.discourseSamples[0]!.capturedAtUtc, "2026-09-04T23:31:00.000Z");
  assert.deepEqual(app.task.discourseSamples[0]!.records, []);
  app.options.discourse.adapter = adapter;
  app.restart();
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.groups[0]!.reason, "social-after-cutoff");
  assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
});

test("Every required use grant fails closed before HTTP at capture and at the public revalidation seam", async (t) => {
  const app = await sampleFixture(t);
  const denied: SourcePolicy[] = [
    { ...app.source, review: { ...app.source.review, status: "pending" } },
    { ...app.source, collection: { ...app.source.collection, enabled: false } },
    { ...app.source, model: { ...app.source.model, enabled: false } },
    { ...app.source, storage: { ...app.source.storage, retentionHours: 0 } },
    { ...app.source, distribution: { ...app.source.distribution, allowPermanentArchive: false } },
    { ...app.source, social: { ...app.source.social!, irrevocableExportAllowed: false } },
    { ...app.source, social: { ...app.source.social!, deletionScope: "unknown" } },
    { ...app.source, social: { ...app.source.social!, deletionScope: "derived-and-exports" } },
  ];
  const capture = { configuration: app.options.discourse.configuration, groupId: "linked", businessDate: app.task.businessDate,
    windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc };
  for (const source of denied) {
    const snapshot = await app.adapter.capture({ ...capture, sourcePolicy: app.source });
    const before = app.calls.length;
    assert.equal((await app.adapter.capture({ ...capture, sourcePolicy: source })).reason, "social-no-eligible-source");
    assert.equal(await app.adapter.revalidate(snapshot, source), "social-permission-changed");
    assert.equal(app.calls.length, before, "revocation must prevent all source HTTP, not merely hide the result");
  }
});

test("Current-use revocation after Runner or after Verifier removes the group without later HTTP or permanent wording", async (t) => {
  for (const stage of ["runner", "verifier"] as const) {
    const app = await sampleFixture(t);
    let current = structuredClone(app.options.sourcePolicies);
    Object.assign(app.options, { sourcePolicyReader: () => current });
    let readsAtRevocation = -1;
    const revoke = () => { readsAtRevocation = app.calls.length; current = current.map((source) => source.sourceId === app.source.sourceId ? { ...source, collection: { ...source.collection, enabled: false } } : source); };
    if (stage === "runner") {
      const original = app.options.editionRunner.run;
      app.options.editionRunner.run = async (input) => { const result = await original(input); revoke(); return result; };
    } else {
      const original = app.options.verifier.verify;
      app.options.verifier.verify = async (input) => { const result = await original(input); revoke(); return result; };
    }
    app.restart();
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(app.calls.length, readsAtRevocation);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.equal(report.record.discourse.groups[0]!.reason, "social-permission-changed");
    assert.equal(report.record.discourse.observations.length, 0);
    assert.ok(!JSON.stringify(report).includes("新观点"));
    assert.ok(!JSON.stringify(report).includes(app.socialStories[0]!.claims[0]!.text));
    assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
    assert.equal(JSON.stringify(app.verifierInputs).includes("discourse-linked"), stage === "verifier");
    app.restart();
    assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
  }
});

test("A caller's colliding ordinary evidence identity cannot make an otherwise valid news issue fail", async (t) => {
  const app = await sampleFixture(t);
  app.task.evidenceBundle.evidence.push({ ...app.task.evidenceBundle.evidence[0]!, id: "discourse-linked" });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.observations.length, 0);
  assert.equal(report.record.discourse.groups[0]!.reason, "social-snapshot-invalid");
});

test("Repeated wording or a single occupied time bucket yields a skew gap instead of a population inference", async (t) => {
  for (const skew of ["repetition", "time"] as const) {
    const app = await sampleFixture(t);
    if (skew === "repetition") {
      app.statuses.push(...app.statuses.map((status, index) => ({ ...status, id: `repeat-${index}` })));
    } else for (const status of app.statuses) status.created_at = "2026-09-04T22:00:00.000Z";
    app.task.discourseSamples = [await app.adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration, groupId: "linked", businessDate: app.task.businessDate,
      windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc })];
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.equal(report.record.discourse.groups[0]!.reason, "social-skewed");
    assert.equal(report.record.discourse.observations.length, 0);
    assert.ok(!JSON.stringify(app.runnerInputs).includes("新观点"));
  }
});

test("Account coordinates and attachment metadata are never model inputs, while identifiable HTML and contact text are isolated before projection", async (t) => {
  const app = await sampleFixture(t);
  for (const status of app.statuses) Object.assign(status, { ip: "PRIVATE-IP-CANARY", coordinates: { latitude: "PRIVATE-GEO-CANARY" } });
  for (const [index, content] of ["<p><a href='https://private.invalid'>PRIVATE-HTML-CANARY</a></p>", "<p>private@example.invalid</p>", "<p>@private_handle</p>", "<p>198.51.100.42</p>"].entries()) {
    app.statuses.push({ ...app.statuses[0]!, id: `unsafe-${index}`, content });
  }
  app.statuses.push({ ...app.statuses[0]!, id: "attached", media_attachments: [{ url: "PRIVATE-ATTACHMENT-CANARY" }] });
  app.task.discourseSamples = [await app.adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration, groupId: "linked", businessDate: app.task.businessDate,
    windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc })];
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.groups[0]!.sampleSize, 12);
  assert.equal(report.record.discourse.groups[0]!.isolatedCount, 5);
  const output = JSON.stringify([...app.runnerInputs, ...app.verifierInputs, report]);
  for (const marker of ["PRIVATE-", "private@example.invalid", "@private_handle", "198.51.100.42"]) assert.ok(!output.includes(marker));
});

test("Changed snapshot text or loss of the capture receipt cannot authorize model use after restart", async (t) => {
  for (const variant of ["text", "receipt"] as const) {
    const app = await sampleFixture(t);
    if (variant === "text") app.task.discourseSamples[0]!.records[0]!.text = "FORGED-ANONYMOUS-TEXT";
    else { app.options.discourse.adapter = createMastodonAdapter({ read: async () => { throw new Error("unexpected HTTP without receipt"); } }); app.restart(); }
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.equal(report.record.discourse.groups[0]!.reason, "social-snapshot-unavailable");
    assert.equal(report.record.discourse.observations.length, 0);
    assert.ok(!JSON.stringify([...app.runnerInputs, ...app.verifierInputs, report]).includes("FORGED-"));
  }
});

test("Population claims, individual profiling and social facts cannot pass as sample observations", async (t) => {
  for (const misuse of ["population", "profile", "fact"] as const) {
    const app = await sampleFixture(t);
    const marker = "UNSAFE-SOCIAL-ASSERTION";
    app.socialStories[0]!.claims = [misuse === "fact" ? { id: "argument", kind: "fact", text: marker, evidenceIds: ["discourse-linked"] } :
      { id: "argument", kind: "analysis", mode: "explanation", text: marker, evidenceIds: ["discourse-linked"] }];
    const original = app.options.verifier.verify;
    app.options.verifier.verify = async (input) => {
      const result = await original(input);
      for (const assessment of result.assessments) if (assessment.discourse) {
        if (misuse === "population") assessment.discourse.scope = "population";
        if (misuse === "profile") assessment.discourse.individualProfiling = true;
      }
      return result;
    };
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.equal(report.record.discourse.observations.length, 0);
    assert.ok(!report.canonicalMarkdown.includes(marker));
    assert.ok(report.record.publicationGate.decisions.some((decision) => decision.storyId === "social-sample" && decision.outcome === "quarantined" && decision.reason === (misuse === "fact" ? "social-invalid-claim" : "social-unsafe-inference")));
  }
});

test("Real-format hashtag anchors preserve anonymous arguments without sending source HTML or URLs to models", async (t) => {
  const app = await sampleFixture(t);
  app.task.discourseSamples = [await app.adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration, groupId: "linked", businessDate: app.task.businessDate,
    windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc })];
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.observations.length, 1);
  assert.equal(report.record.discourse.groups[0]!.sampleSize, 12);
  assert.ok(JSON.stringify(app.runnerInputs).includes("新观点"));
  for (const marker of ["<a href=", "<span>", "/tags/observatory", "mention hashtag"]) assert.ok(!JSON.stringify([...app.runnerInputs, ...app.verifierInputs, report]).includes(marker), marker);
});

test("Story-linked discussion cannot select a candidate-supplied main cluster when no news event survives", async (t) => {
  const app = await sampleFixture(t, 6, "story-linked");
  app.task.evidenceBundle.evidence = [];
  app.task.editions = app.task.editions.map((entry) => ({ ...entry, evidenceIds: [] }));
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.eventClusters.length, 0);
  assert.equal(report.record.discourse.observations.length, 0);
  assert.equal(report.record.discourse.groups[0]!.reason, "social-main-story-unavailable");
  assert.ok(!report.canonicalMarkdown.includes(app.socialStories[0]!.claims[0]!.text));
});

test("An instance rate limit during revalidation also blocks the next capture without another HTTP request", async (t) => {
  const app = await sampleFixture(t);
  app.hooks.responseStatus = 429;
  assert.equal(await app.adapter.revalidate(app.snapshot, app.source), "social-rate-limited");
  const before = app.calls.length;
  const sample = await app.adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration, groupId: "linked", businessDate: app.task.businessDate,
    windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc });
  assert.equal(sample.reason, "social-rate-limited");
  assert.equal(app.calls.length, before);
});

test("A frozen query language filter is disclosed separately from unknown observed language", async (t) => {
  const app = await fixture(t);
  Object.assign(app.options.discourse.configuration.groups[0]!, { language: "zh" });
  app.restart();
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.match(report.canonicalMarkdown, /查询：#observatory.*local=true.*语言过滤=zh/);
  assert.match(report.canonicalMarkdown, /语言：未知/);
});

test("A policy change during awaited pre-Runner revalidation is observed before model dispatch without losing ordinary news", async (t) => {
  const app = await sampleFixture(t);
  let current = structuredClone(app.options.sourcePolicies);
  Object.assign(app.options, { sourcePolicyReader: () => current });
  app.hooks.status = async () => { current = current.map((source) => source.sourceId === app.source.sourceId ? { ...source, model: { ...source.model, enabled: false } } : source); };
  app.restart();
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion !== 7) return;
  assert.equal(report.record.discourse.groups[0]!.reason, "social-permission-changed");
  assert.ok(!JSON.stringify([...app.runnerInputs, ...app.verifierInputs]).includes("新观点"));
});

test("Ordinary evidence expiring during the final social read is quarantined at the same final publication time", async (t) => {
  for (const expire of [false, true]) for (const confirmed of [false, true]) {
    const app = await sampleFixture(t);
    app.task.evidenceBundle.evidence[0]!.expiresAtUtc = "2026-09-04T23:41:00.000Z";
    app.hooks.now = "2026-09-04T23:40:00.000Z";
    app.options.clock = () => app.hooks.now;
    let lastVerifierReturned = false;
    let subsequentRounds = 0;
    const original = app.options.verifier.verify;
    app.options.verifier.verify = async (input) => {
      const result = await original(input);
      for (const assessment of result.assessments) if (assessment.storyId === "news") {
        if (!confirmed) { assessment.conclusion = "insufficient"; assessment.reason = "insufficient-evidence"; }
        assessment.evidence[0]!.upstreamOriginId = "EXPIRED-FREE-RECEIPT";
      }
      if (input.stories.some((story) => story.edition === "social-discourse")) lastVerifierReturned = true;
      return result;
    };
    app.hooks.status = async () => {
      if (lastVerifierReturned && app.calls.at(-1)!.endsWith("/fixture-0")) {
        subsequentRounds++;
        if (expire && subsequentRounds === 2) app.hooks.now = "2026-09-04T23:42:00.000Z";
      }
    };
    app.restart();
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(subsequentRounds, 2);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    const decision = report.record.publicationGate.decisions.find((entry) => entry.storyId === "news" && entry.claimId === "fact")!;
    assert.equal(decision.outcome, expire ? "quarantined" : confirmed ? "published" : "unconfirmed");
    if (expire) {
      assert.equal(decision.reason, "evidence-expired");
      assert.equal(report.version.publishedAtUtc, "2026-09-04T23:42:00.000Z");
      assert.equal(report.record.stories.length, 0);
      assert.ok(!report.canonicalMarkdown.includes("示例观测站发布了更新"));
      assert.ok(!JSON.stringify(report).includes("EXPIRED-FREE-RECEIPT"));
      assert.equal(report.record.publicationGate.unconfirmedItems.length, 0);
    }
    assert.equal(report.record.publicationGate.checkedAtUtc, report.version.publishedAtUtc);
    assert.equal(report.record.discourse.observations.length, 1);
    app.restart();
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
});

test("Ambiguous native groups are isolated before priority ranking and cannot displace a valid group's publication", async (t) => {
  for (const ambiguous of [false, true]) {
    const app = await sampleFixture(t);
    const configuration = { ...app.options.discourse.configuration, groups: [app.options.discourse.configuration.groups[0]!, { ...app.options.discourse.configuration.groups[0]!, id: "valid" }] };
    app.options.discourse.configuration = configuration;
    app.task.discourseSamples = [];
    for (const group of configuration.groups) app.task.discourseSamples.push(await app.adapter.capture({ sourcePolicy: app.source, configuration, groupId: group.id,
      businessDate: app.task.businessDate, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc }));
    const sampleStory = app.socialStories[0]!;
    app.socialStories.splice(0, app.socialStories.length,
      ...["a-first", ...(ambiguous ? ["b-second", "c-third"] : [])].map((id) => ({ ...structuredClone(sampleStory), id })),
      { ...structuredClone(sampleStory), id: "z-valid", eventClusterId: "valid", claims: sampleStory.claims.map((claim) => ({ ...claim, evidenceIds: ["discourse-valid"] })) });
    app.task.evidenceBundle.evidence = [];
    app.task.editions = app.task.editions.map((entry) => ({ ...entry, evidenceIds: [] }));
    app.restart();
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.equal(report.record.discourse.observations.length, ambiguous ? 1 : 2);
    assert.equal(report.record.discourse.observations.find((entry) => entry.groupId === "valid")!.priority, true);
    if (ambiguous) {
      assert.equal(report.record.discourse.groups.find((entry) => entry.id === "linked")!.reason, "social-analysis-unavailable");
      assert.deepEqual(report.record.interestSelections.map((entry) => entry.storyId), ["z-valid"]);
    }
    app.restart();
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
});

test("Cross-group revocation in either direction isolates only the revoked group and prevents its next HTTP read", async (t) => {
  for (const revoke of [false, true]) for (const reverse of [false, true]) for (const unknownEvidence of [false, true]) {
    if (unknownEvidence && (!revoke || reverse)) continue;
    const app = await sampleFixture(t);
    const second: SourcePolicy = { ...app.source, sourceId: "second-source", feedUrl: "https://second.example/feed" };
    app.options.sourcePolicies.push(second);
    let current = structuredClone(app.options.sourcePolicies);
    Object.assign(app.options, { sourcePolicyReader: () => current });
    const configuration = { ...app.options.discourse.configuration, groups: [app.options.discourse.configuration.groups[0]!, { ...app.options.discourse.configuration.groups[0]!, id: "valid", sourceId: second.sourceId }] };
    app.options.discourse.configuration = configuration;
    const deniedOrigin = reverse ? "https://second.example" : "https://source.example";
    const triggerOrigin = reverse ? "https://source.example" : "https://second.example";
    const deniedSourceId = reverse ? second.sourceId : app.source.sourceId;
    let revoked = false;
    let forbiddenReads = 0;
    const adapter = createMastodonAdapter({ clock: () => "2026-09-04T23:20:00.000Z", read: async (url) => {
      const target = new URL(url);
      const records = app.statuses.map((status) => ({ ...status, content: status.content.replaceAll("https://source.example", target.origin).replace("新观点", target.origin === deniedOrigin ? "REVOKED-GROUP-TEXT" : "仍合格观点") }));
      if (target.pathname.startsWith("/api/v1/statuses/")) {
        if (revoked && target.origin === deniedOrigin) forbiddenReads++;
        if (revoke && target.origin === triggerOrigin) { revoked = true; current = current.map((source) => source.sourceId === deniedSourceId ? { ...source, collection: { ...source.collection, enabled: false } } : source); }
        return { status: 200, headers: {}, body: JSON.stringify(records.find((status) => status.id === target.pathname.split("/").at(-1))) };
      }
      const page = target.searchParams.has("max_id") ? [] : records;
      return { status: 200, body: JSON.stringify(page), headers: page.length ? { link: `<${target.origin}/api/v1/timelines/tag/observatory?max_id=fixture-11>; rel="next"` } : {} };
    } });
    app.options.discourse.adapter = adapter;
    app.task.discourseSamples = [];
    for (const group of configuration.groups) app.task.discourseSamples.push(await adapter.capture({ sourcePolicy: group.id === "linked" ? app.source : second,
      configuration, groupId: group.id, businessDate: app.task.businessDate, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc }));
    const sampleStory = app.socialStories[0]!;
    app.socialStories.push({ ...structuredClone(sampleStory), id: "z-valid", eventClusterId: "valid", claims: sampleStory.claims.map((claim) => ({ ...claim, evidenceIds: ["discourse-valid"] })) });
    if (unknownEvidence) sampleStory.claims[0]!.evidenceIds = ["unknown-evidence"];
    app.restart();
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(forbiddenReads, 0, "A grant revoked during the previous group cannot authorize the next group's HTTP");
    assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.equal(report.record.discourse.observations.length, unknownEvidence ? 0 : revoke ? 1 : 2, JSON.stringify({ groups: report.record.discourse.groups, gaps: report.record.coverageGaps, decisions: report.record.publicationGate.decisions }));
    if (unknownEvidence) assert.ok(report.record.coverageGaps.some((gap) => gap.edition === "social-discourse" && gap.reason === "agent-invalid-output"));
    else assert.equal(report.record.discourse.observations.find((entry) => entry.groupId === (reverse ? "linked" : "valid"))!.priority, true);
    if (revoke) {
      assert.equal(report.record.discourse.groups.find((entry) => entry.id === (reverse ? "valid" : "linked"))!.reason, "social-permission-changed");
      assert.ok(!JSON.stringify([...app.runnerInputs, ...app.verifierInputs, report]).includes("REVOKED-GROUP-TEXT"));
    }
    app.restart();
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
});

test("Mastodon creation and edit times require real calendar instants with explicit zones before window membership is decided", async (t) => {
  const app = await sampleFixture(t, 6);
  const capture = () => app.adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration, groupId: "linked",
    businessDate: app.task.businessDate, windowStartUtc: "2026-01-01T00:00:00.000Z", cutoffUtc: app.task.evidenceBundle.cutoffUtc });
  for (const entry of [
    { created: "2026-09-04T01:00:00.000Z", edited: null, valid: true },
    { created: "2026-09-04T03:00:00+02:00", edited: "2026-09-03T23:00:00-03:00", valid: true },
    { created: "2026-09-04", edited: null, valid: false },
    { created: "2026-09-04T01:00:00", edited: null, valid: false },
    { created: "2026-02-29T01:00:00.000Z", edited: null, valid: false },
    { created: "2026-09-04T01:00:00.000Z", edited: "2026-09-04", valid: false },
    { created: "2026-09-04T01:00:00.000Z", edited: "2026-09-04T02:00:00", valid: false },
    { created: "2026-02-28T01:00:00.000Z", edited: "2026-02-29T02:00:00.000Z", valid: false },
  ]) {
    for (const status of app.statuses) Object.assign(status, { created_at: entry.created, edited_at: entry.edited });
    const sample = await capture();
    assert.equal(sample.receivedCount, 6);
    assert.equal(sample.records.length, entry.valid ? 6 : 0, JSON.stringify(entry));
    assert.equal(sample.isolatedCount, entry.valid ? 0 : 6);
    if (entry.valid) {
      assert.equal(sample.records[0]!.createdAtUtc, "2026-09-04T01:00:00.000Z");
      assert.equal(sample.records[0]!.editedAtUtc, entry.edited === null ? null : "2026-09-04T02:00:00.000Z");
    }
  }
  for (const status of app.statuses) Object.assign(status, { created_at: "2026-09-04T01:00:00.000Z", edited_at: null });
  const sample = await capture();
  assert.equal(await app.adapter.revalidate(sample, app.source), null);
  Object.assign(app.statuses[0]!, { edited_at: "2026-09-04" });
  assert.equal(await app.adapter.revalidate(sample, app.source), "social-invalid-response");
});

test("Current source authority blocks unsampled social material disguised as ordinary evidence even without startup policies or groups", async (t) => {
  for (const startup of ["present", "missing", "stale"] as const) {
    const app = await fixture(t);
    const source = app.options.sourcePolicies[0]!;
    const news: SourcePolicy = { ...policy(), sourceId: "source-fixture", edition: "world-affairs" };
    const current = [source, news];
    app.options.sourcePolicies.splice(0, app.options.sourcePolicies.length, ...(startup === "missing" ? [] : [startup === "stale" ? { ...source, edition: "world-affairs" as const } : source, news]));
    Object.assign(app.options, { sourcePolicyReader: () => current });
    app.options.discourse.configuration.groups = [];
    const marker = "UNPROJECTED-SOCIAL-AUTHORITY-CANARY";
    const evidence = { ...app.task.evidenceBundle.evidence[0]!, policyVersion: news.version, policySha256: policyDigest(news), trust: "untrusted-source-data",
      expiresAtUtc: "2026-09-05T22:06:00.000Z" };
    const socialEvidence = { ...evidence, id: "disguised-social", sourceId: source.sourceId, policySha256: policyDigest(source),
      content: marker, contentSha256: createHash("sha256").update(marker).digest("hex") };
    const task = { ...app.task, evidenceBundle: { ...app.task.evidenceBundle, schemaVersion: 2, coverageGaps: [], evidence: [evidence, socialEvidence] },
      editions: app.task.editions.map((entry) => ({ ...entry, evidenceIds: entry.edition === "world-affairs" ? ["evidence-1", "disguised-social"] : [] })) };
    app.restart();
    const report = app.observer.readReport((await app.observer.produce(task)).id, ownerToken);
    assert.ok(!JSON.stringify([...app.runnerInputs, ...app.verifierInputs, report]).includes(marker), startup);
    assert.equal(app.sampleReads, 0);
    assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
    assert.match(report.canonicalMarkdown, /无合规社交来源/);
    app.restart();
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
  const app = await sampleFixture(t);
  const registered: SourcePolicy = { ...policy(), sourceId: "registered-during-read", edition: "social-discourse" };
  const initial = structuredClone(app.options.sourcePolicies);
  let current = initial;
  app.options.sourcePolicies.splice(0);
  Object.assign(app.options, { sourcePolicyReader: () => current });
  app.hooks.status = async () => { current = [...initial, registered]; };
  const marker = "LATE-REGISTERED-UNPROJECTED-SOCIAL-CANARY";
  app.task.evidenceBundle.evidence.push({ ...app.task.evidenceBundle.evidence[0]!, id: "late-social", sourceId: registered.sourceId,
    policySha256: policyDigest(registered), content: marker, contentSha256: createHash("sha256").update(marker).digest("hex") });
  app.task.editions.find((entry) => entry.edition === "world-affairs")!.evidenceIds.push("late-social");
  app.restart();
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  assert.ok(!JSON.stringify([...app.runnerInputs, ...app.verifierInputs, report]).includes(marker), "A source registered during sample I/O uses the same current classification as model permission checks");
  assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
  assert.equal(report.record.schemaVersion, 7);
  if (report.record.schemaVersion === 7) assert.equal(report.record.discourse.observations.length, 1);
  app.restart();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Public sample revalidation cannot return unchanged after its last read crosses TTL and never revives the receipt", async (t) => {
  for (const ending of ["stable", "expired", "cancelled-and-expired", "timeout-and-expired"] as const) {
    const app = await sampleFixture(t, 6);
    app.hooks.now = "2026-09-05T23:19:59.000Z";
    const controller = new AbortController();
    app.hooks.status = async () => {
      if (app.calls.at(-1)!.endsWith("/fixture-5") && ending !== "stable") {
        app.hooks.now = "2026-09-05T23:20:00.000Z";
        if (ending === "cancelled-and-expired") controller.abort();
        if (ending === "timeout-and-expired") await new Promise<void>(() => {});
      }
    };
    const result = await app.adapter.revalidate(app.snapshot, app.source, controller.signal);
    assert.equal(result, ending === "stable" ? null : ending === "expired" ? "social-expired" : ending === "cancelled-and-expired" ? "social-cancelled" : "social-timeout");
    if (ending !== "stable") {
      const calls = app.calls.length;
      app.hooks.now = "2026-09-05T23:19:59.000Z";
      assert.equal(await app.adapter.revalidate(app.snapshot, app.source), "social-snapshot-unavailable");
      assert.equal(app.calls.length, calls, "A failed receipt cannot authorize another status read even when the clock moves back");
    }
  }
});

test("Final group eligibility and interest failures remove the whole social receipt while preserving qualified and ordinary audit after restart", async (t) => {
  for (const variant of ["qualified", "missing-main", "unsafe-scope", "excluded"] as const) {
    const app = await sampleFixture(t, 12, variant === "missing-main" ? "story-linked" : "platform-native");
    const marker = "FINAL-GROUP-RAW-RECEIPT-CANARY";
    for (const status of app.statuses) status.content = status.content.replace("新观点", marker);
    if (variant === "missing-main") app.options.discourse.configuration.groups[0]!.linkedEvidenceIds = [];
    app.task.discourseSamples = [await app.adapter.capture({ sourcePolicy: app.source, configuration: app.options.discourse.configuration, groupId: "linked",
      businessDate: app.task.businessDate, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc })];
    if (variant === "excluded") {
      const profileFile = join(app.directory, "excluded-profile.json");
      await writeFile(profileFile, JSON.stringify({ schemaVersion: 1, version: 2, topics: [], entities: [], regions: [], exclusions: { topics: ["observation-methods"], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
      app.observer.importInterestProfile(profileFile);
    }
    const original = app.options.verifier.verify;
    app.options.verifier.verify = async (input) => {
      const result = await original(input);
      for (const assessment of result.assessments) {
        assessment.evidence[0]!.upstreamOriginId = assessment.discourse ? marker : "ORDINARY-AUDIT-KEPT";
        if (assessment.discourse && variant === "unsafe-scope") Object.assign(assessment.discourse, { scope: "population" });
        if (assessment.discourse && variant === "excluded") Object.assign(assessment, { selection: {
          topics: ["observation-methods"], entities: [], regions: [], evidenceLanguages: [], impact: "ordinary", impactClaimIds: [],
        } });
      }
      return result;
    };
    app.restart();
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.equal(report.record.discourse.observations.length, variant === "qualified" ? 1 : 0);
    assert.equal(report.record.discourse.groups[0]!.reason, variant === "qualified" ? null : variant === "missing-main" ? "social-main-story-unavailable" : variant === "unsafe-scope" ? "social-analysis-unavailable" : "social-interest-excluded");
    assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
    const gate = report.record.publicationGate;
    const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
    assert.ok(assessments.some((assessment) => assessment.storyId === "news"));
    assert.ok(JSON.stringify(report).includes("ORDINARY-AUDIT-KEPT"));
    assert.equal(assessments.some((assessment) => assessment.storyId === "social-sample"), variant === "qualified", variant);
    if (variant !== "qualified") assert.ok(!JSON.stringify(report).includes(marker), variant);
    app.restart();
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
});

test("Final coverage follows retained discourse annotations without rewriting actual Verifier dispatch counts", async (t) => {
  for (const excluded of [false, true]) {
    const app = await sampleFixture(t);
    if (excluded) {
      const profileFile = join(app.directory, "language-exclusion.json");
      await writeFile(profileFile, JSON.stringify({ schemaVersion: 1, version: 2, topics: [], entities: [], regions: [], exclusions: { topics: ["observation-methods"], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
      app.observer.importInterestProfile(profileFile);
    }
    const original = app.options.verifier.verify;
    app.options.verifier.verify = async (input) => {
      const result = await original(input);
      for (const assessment of result.assessments) if (assessment.discourse) Object.assign(assessment, { selection: {
        topics: ["observation-methods"], entities: [], regions: [], evidenceLanguages: [{ evidenceId: "discourse-linked", language: "zh" }], impact: "ordinary", impactClaimIds: [],
      } });
      return result;
    };
    app.restart();
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
    assert.equal(report.record.discourse.observations.length, excluded ? 0 : 1);
    assert.equal(report.record.coverage.inputEvidenceCount, 2);
    assert.deepEqual(report.record.publicationGate.input.dispatchedEvidenceIds, ["evidence-1", "discourse-linked"]);
    assert.deepEqual(report.record.coverage.languages.find((entry) => entry.key === "zh")!.evidenceIds, excluded ? [] : ["discourse-linked"]);
    assert.deepEqual(report.record.coverage.unknownLanguageEvidenceIds, excluded ? ["discourse-linked", "evidence-1"] : ["evidence-1"]);
    app.restart();
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
});

test("Original candidate and Claim membership governs whole-group eligibility without restoring unsanitized payloads", async (t) => {
  for (const variant of ["all-safe", "mixed-claims", "mixed-candidates"] as const) {
    const app = await sampleFixture(t);
    const configuration = { ...app.options.discourse.configuration, groups: [app.options.discourse.configuration.groups[0]!, { ...app.options.discourse.configuration.groups[0]!, id: "valid" }] };
    app.options.discourse.configuration = configuration;
    app.task.discourseSamples = [];
    for (const group of configuration.groups) app.task.discourseSamples.push(await app.adapter.capture({ sourcePolicy: app.source, configuration, groupId: group.id,
      businessDate: app.task.businessDate, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc }));
    const originalStory = app.socialStories[0]!;
    originalStory.title = "UNTRUSTED-ORIGINAL-CANDIDATE-TITLE";
    const second = { ...structuredClone(originalStory.claims[0]!), id: "second", text: variant === "all-safe" ? "样本也讨论进一步公开观测方法。" : "FAILED-MEMBER-RAW-CANARY" };
    if (variant === "mixed-candidates") app.socialStories.push({ ...structuredClone(originalStory), id: "discarded-candidate", claims: [second] });
    else originalStory.claims.push(second);
    app.socialStories.push({ ...structuredClone(originalStory), id: "z-valid", eventClusterId: "valid", claims: [{ ...structuredClone(originalStory.claims[0]!), evidenceIds: ["discourse-valid"] }] });
    const originalVerify = app.options.verifier.verify;
    app.options.verifier.verify = async (input) => {
      const result = await originalVerify(input);
      for (const assessment of result.assessments) if (assessment.discourse) {
        if (variant !== "all-safe" && assessment.claimId === "second") {
          Object.assign(assessment.discourse, { scope: "population" });
          assessment.evidence[0]!.upstreamOriginId = "FAILED-MEMBER-RAW-CANARY";
        } else if (assessment.storyId === "z-valid") assessment.evidence[0]!.upstreamOriginId = "QUALIFIED-GROUP-AUDIT";
      }
      return result;
    };
    app.restart();
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    assert.equal(report.record.schemaVersion, 7);
    if (report.record.schemaVersion !== 7) return;
    assert.deepEqual(report.record.stories.map((story) => story.id), ["news"]);
    assert.equal(report.record.discourse.observations.length, variant === "all-safe" ? 2 : 1, variant);
    assert.equal(report.record.discourse.groups.find((group) => group.id === "linked")!.reason, variant === "all-safe" ? null : "social-analysis-unavailable");
    assert.equal(report.record.discourse.observations.find((entry) => entry.groupId === "valid")!.priority, true);
    assert.ok(!JSON.stringify(report).includes("UNTRUSTED-ORIGINAL-CANDIDATE-TITLE"));
    assert.ok(!JSON.stringify(report).includes("FAILED-MEMBER-RAW-CANARY"));
    assert.ok(JSON.stringify(report).includes("QUALIFIED-GROUP-AUDIT"));
    const gate = report.record.publicationGate;
    const assessments = gate.schemaVersion === 1 ? gate.verification?.assessments ?? [] : gate.batches.flatMap((batch) => batch.verification?.assessments ?? []);
    assert.equal(assessments.some((assessment) => ["social-sample", "discarded-candidate"].includes(assessment.storyId)), variant === "all-safe");
    app.restart();
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
});
