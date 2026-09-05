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
