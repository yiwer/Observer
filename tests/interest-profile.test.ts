import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, type TestContext } from "node:test";
import { createObserver, type ObserverOptions } from "../src/observer.ts";
import { editionNames } from "../src/contracts.ts";
import type { CandidateV2, VerificationInput } from "../src/gate-contracts.ts";
import type { InterestProfile } from "../src/interest-contracts.ts";
import { ownerToken, request, successfulResult } from "./fixtures.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { policyDigest } from "../src/collection.ts";

const editions = Object.keys(editionNames) as Array<keyof typeof editionNames>;
function profile(topics = [{ key: "climate", priority: 10 }, { key: "space", priority: 1 }], version = 1): InterestProfile {
  return { schemaVersion: 1, version, topics, entities: [],
    regions: [{ key: "CN", priority: 1 }, { key: "US", priority: 1 }, { key: "EU", priority: 1 }],
    exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh", "en", "fr", "de"] };
}
function candidate(id: string, evidenceId = "evidence-1", edition: CandidateV2["edition"] = "world-affairs"): CandidateV2 {
  return { schemaVersion: 2, id, eventClusterId: `proposed-${id}`, edition, title: "不可信标题",
    claims: [{ id: "fact", kind: "fact", text: `${id} 项目新增了观测设施。`, evidenceIds: [evidenceId] },
      { id: "importance", kind: "analysis", mode: "explanation", text: "新增观测对该区域长期监测有重大影响。", evidenceIds: [evidenceId] }] };
}
function labels(id: string): { event: Record<string, unknown>; selection: { topics: string[]; entities: string[]; regions: string[]; evidenceLanguages: Array<{ evidenceId: string; language: string }>; impact: "ordinary" | "global" | "major-regional"; impactClaimIds: string[]; impactBasis?: "observed-event" | "statement-act" } } {
  return { event: { identity: { subject: id, action: "expanded", object: "observation", discriminator: "2026-plan" },
    fact: `${id}-expanded`, primaryEdition: "world-affairs", materiality: "material", materialityClaimIds: ["importance"],
    occurrenceEvidenceId: "evidence-1", disclosureEvidenceId: "evidence-1", developmentEvidenceId: null },
  selection: { topics: [id], entities: [], regions: ["CN"], evidenceLanguages: [{ evidenceId: "evidence-1", language: "zh" }],
    impact: "ordinary", impactClaimIds: [] } };
}
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "observer-interest-"));
  const task = { ...structuredClone(request), schemaVersion: 4,
    editions: editions.map((edition) => ({ edition, evidenceIds: ["evidence-1"] })) };
  const candidates = [candidate("climate"), candidate("space")];
  const content = candidates.flatMap((story) => story.claims.map((claim) => claim.text)).join("\n");
  Object.assign(task.evidenceBundle.evidence[0]!, { content, contentSha256: createHash("sha256").update(content).digest("hex") });
  const annotations: Record<string, ReturnType<typeof labels>> = { climate: labels("climate"), space: labels("space") };
  const options: ObserverOptions = { databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture",
    clock: () => task.evidenceBundle.cutoffUtc.replace("23:30", "23:40"),
    editionRunner: { run: async () => ({ schemaVersion: 2, taskId: task.taskId, evidenceBundleId: task.evidenceBundle.id, configurationId: task.configurationId,
      editions: editions.map((edition) => ({ edition, status: "completed", result: { ...successfulResult(), taskId: `${task.taskId}:${edition}`,
        startedAtUtc: task.evidenceBundle.cutoffUtc.replace("23:30", "23:31"), finishedAtUtc: task.evidenceBundle.cutoffUtc.replace("23:30", "23:32"),
        stories: candidates.filter((story) => story.edition === edition) } })) }) },
    verifier: { verify: async (input: VerificationInput) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "selection-fixture-v1",
      assessments: input.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id,
        conclusion: "supported", reason: "supported-by-evidence", wording: "original",
        evidence: claim.evidenceIds.map((evidenceId) => ({ evidenceId, relation: "supports", basis: claim.kind === "statement" ? "publisher-statement" : "direct-observation", reliability: "reliable", upstreamOriginId: "observatory" })),
        ...(claim.kind === "fact" || claim.kind === "statement" ? annotations[story.id] : {}) }))) }) } };
  let observer = createObserver(options);
  t.after(() => observer.close()); // Preserve bounded evidence directories; never broad-clean shared temp.
  return { directory, task, candidates, annotations, options, get observer() { return observer; },
    restart() { observer.close(); observer = createObserver(options); },
    async import(value: unknown) { const file = join(directory, `input-${crypto.randomUUID()}.json`); await writeFile(file, JSON.stringify(value)); return observer.importInterestProfile(file); },
    async publish() {
      const content = candidates.flatMap((story) => story.claims.map((claim) => claim.text)).join("\n");
      const generatedSource = task.evidenceBundle.evidence.find((item) => item.id === "evidence-1");
      if (generatedSource) Object.assign(generatedSource, { content, contentSha256: createHash("sha256").update(content).digest("hex") });
      return observer.readReport((await observer.produce(task)).id, ownerToken);
    } };
}

test("Owner file priorities change story order with identical Evidence and history, and each report records its effective profile", async (t) => {
  const first = await fixture(t);
  const second = await fixture(t);
  await first.import(profile());
  await second.import(profile([{ key: "climate", priority: 1 }, { key: "space", priority: 10 }]));
  const a = await first.publish();
  const b = await second.publish();
  assert.deepEqual(a.record.stories.map((story) => story.id), ["climate", "space"]);
  assert.deepEqual(b.record.stories.map((story) => story.id), ["space", "climate"]);
  if (a.record.schemaVersion !== 5 || b.record.schemaVersion !== 5) assert.fail("Expected explicit-interest record");
  assert.deepEqual(a.record.interestProfile.profile, profile());
  assert.deepEqual(b.record.interestProfile.profile.topics, [{ key: "climate", priority: 1 }, { key: "space", priority: 10 }]);
  assert.notEqual(a.record.interestProfile.sha256, b.record.interestProfile.sha256);
  assert.equal(a.version.schemaVersion, 4);
  assert.equal(a.record.editorialContract, "observer-canonical-v3");
});

test("The news region policy does not exclude GitHub projects by geography or grant them news baseline authority", async (t) => {
  const app = await fixture(t);
  app.candidates.splice(0, app.candidates.length, candidate("repository", "evidence-1", "github-projects"));
  app.annotations.repository = labels("repository");
  Object.assign(app.annotations.repository.selection, { topics: [], regions: ["JP"], impact: "global", impactClaimIds: ["importance"], impactBasis: "observed-event" });
  await app.import(profile([]));
  const report = await app.publish();
  assert.deepEqual(report.record.stories.map((story) => story.id), ["repository"]);
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.equal(report.record.interestSelections[0]!.baseline, false);
  assert.equal(report.record.eventSelections[0]!.reason, "github-rules-deferred");
});

test("An event explicitly assessed as routine cannot acquire Global Baseline from a conflicting selection label", async (t) => {
  const app = await fixture(t);
  app.candidates.splice(1);
  app.annotations.climate!.event.materiality = "routine";
  Object.assign(app.annotations.climate!.selection, { impact: "global", impactClaimIds: ["importance"], impactBasis: "observed-event" });
  const config = profile(); config.exclusions.topics = ["climate"];
  await app.import(config);
  const report = await app.publish();
  assert.deepEqual(report.record.stories, []);
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.equal(report.record.interestSelections[0]!.baseline, false);
});

test("Explicit entity and region priorities admit other regions, while ordinary exclusions remain effective", async (t) => {
  for (const exclude of [false, true]) {
    const app = await fixture(t);
    app.annotations.climate!.selection = { ...app.annotations.climate!.selection, topics: [], entities: ["Observatory"], regions: ["JP"] };
    app.annotations.space!.selection = { ...app.annotations.space!.selection, topics: [], regions: ["BR"] };
    const config = profile([]);
    config.entities = [{ key: "observatory", priority: 30 }];
    config.regions.push({ key: "BR", priority: 20 });
    if (exclude) { config.exclusions.entities = ["OBSERVATORY"]; config.exclusions.regions = ["BR"]; }
    await app.import(config);
    const report = await app.publish();
    assert.deepEqual(report.record.stories.map((story) => story.id), exclude ? [] : ["climate", "space"]);
    if (exclude) {
      assert.match(report.canonicalMarkdown, /通过硬门、事件去重及兴趣与地域筛选后/);
      assert.ok(!report.canonicalMarkdown.includes("通过发布门的候选不足"));
    }
  }
  const outside = await fixture(t);
  outside.annotations.climate!.selection.regions = ["JP"];
  outside.annotations.space!.selection.regions = ["BR"];
  await outside.import(profile([]));
  const report = await outside.publish();
  assert.deepEqual(report.record.stories, []);
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.ok(report.record.interestSelections.every((item) => item.outcome === "outside-region-scope"));
});

test("The neutral example is explicitly imported, exports never overwrite files, and corrupt application snapshots never invent recovery", async (t) => {
  const app = await fixture(t);
  await assert.rejects(() => app.publish(), /interest-profile-unavailable-or-corrupt/);
  app.observer.importInterestProfile(fileURLToPath(new URL("../config/interest.example.v1.json", import.meta.url)));
  const exported = join(app.directory, "example-copy.json");
  app.observer.exportInterestProfile(exported);
  assert.deepEqual(JSON.parse(await readFile(exported, "utf8")), profile([]));
  assert.throws(() => app.observer.exportInterestProfile(exported), /EEXIST/);
  assert.throws(() => app.observer.exportInterestProfile(app.options.databasePath), /target-forbidden/);
  assert.throws(() => app.observer.exportInterestProfile(`${app.options.databasePath}.interest.json`), /target-forbidden/);
  const report = await app.publish();
  await writeFile(`${app.options.databasePath}.interest.json`, "{ broken application snapshot");
  app.restart();
  await assert.rejects(() => app.import(profile([], 2)), /interest-profile-unavailable-or-corrupt/);
  assert.throws(() => app.observer.exportInterestProfile(join(app.directory, "must-not-exist.json")), /interest-profile-unavailable-or-corrupt/);
  assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
});

test("New selection annotations never leak into legacy request archives, and Record 4 plus Record 5 remain classified history across restarts", async (t) => {
  for (const schemaVersion of [1, 2, 3]) {
    const app = await fixture(t);
    for (const annotation of Object.values(app.annotations)) annotation.selection.topics = ["unpublished-annotation-prose"];
    app.options.runner = { run: async () => ({ ...successfulResult(), stories: app.candidates }) };
    app.restart();
    const { editions: _editions, ...legacy } = app.task;
    const input = schemaVersion === 1 ? { ...legacy, schemaVersion } : { ...app.task, schemaVersion };
    const report = app.observer.readReport((await app.observer.produce(input)).id, ownerToken);
    assert.equal(report.record.schemaVersion, schemaVersion + 1);
    assert.ok(!JSON.stringify(report).includes("unpublished-annotation-prose"));
    assert.ok(!JSON.stringify(report).includes("selectionProjection"));
    app.restart();
    assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
  }
  const app = await fixture(t);
  await app.import(profile());
  app.task.schemaVersion = 3;
  const older = await app.publish();
  app.restart();
  Object.assign(app.task, { schemaVersion: 4, businessDate: "2026-09-06", taskId: "interest-second" });
  Object.assign(app.task.evidenceBundle, { businessDate: "2026-09-06", windowStartUtc: "2026-09-04T23:30:00.000Z", cutoffUtc: "2026-09-05T23:30:00.000Z" });
  const repeated = await app.publish();
  if (repeated.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.deepEqual(repeated.record.stories, []);
  assert.deepEqual(repeated.record.historyCoverage, { status: "classified", versionIds: [] });
  app.restart();
  Object.assign(app.task, { businessDate: "2026-09-07", taskId: "interest-third" });
  Object.assign(app.task.evidenceBundle, { businessDate: "2026-09-07", windowStartUtc: "2026-09-05T23:30:00.000Z", cutoffUtc: "2026-09-06T23:30:00.000Z" });
  Object.assign(app.task.evidenceBundle.evidence[0]!, { publishedAtUtc: "2026-09-06T22:00:00.000Z", discoveredAtUtc: "2026-09-06T22:05:00.000Z", retrievedAtUtc: "2026-09-06T22:06:00.000Z" });
  for (const annotation of Object.values(app.annotations)) annotation.event.fact = `${annotation.event.fact}-new-development`;
  for (const story of app.candidates) story.claims[0]!.text = `${story.id} 项目新增的设施已全部投入运行。`;
  const update = await app.publish();
  if (update.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.equal(update.record.stories.length, 2);
  assert.ok(update.record.eventClusters.every((cluster) => cluster.previousCoverage?.versionId === older.version.id));
  assert.equal(JSON.stringify(app.observer.readReport(older.version.id, ownerToken)), JSON.stringify(older));
  assert.equal(JSON.stringify(app.observer.readReport(repeated.version.id, ownerToken)), JSON.stringify(repeated));
  app.restart();
  Object.assign(app.task, { businessDate: "2026-09-08", taskId: "interest-fourth" });
  Object.assign(app.task.evidenceBundle, { businessDate: "2026-09-08", windowStartUtc: "2026-09-06T23:30:00.000Z", cutoffUtc: "2026-09-07T23:30:00.000Z" });
  const repeatedUpdate = await app.publish();
  assert.equal(repeatedUpdate.record.stories.length, 0);
  assert.equal(JSON.stringify(app.observer.readReport(update.version.id, ownerToken)), JSON.stringify(update));
});

test("Baseline cannot bypass final distribution, expiry, receipt identity, statement attribution, or the known disclosure window", async (t) => {
  for (const mode of ["distribution", "final-expiry", "receipt-identity", "unsafe-analysis", "unknown-disclosure", "foreign-language", "statement-result", "statement-act", "post-cutoff"] as const) {
    const app = await fixture(t);
    app.candidates.splice(1);
    const label = app.annotations.climate!;
    Object.assign(label.selection, { impact: "global", impactClaimIds: ["importance"], impactBasis: "observed-event" });
    const config = profile(); config.exclusions.topics = ["climate"];
    await app.import(config);
    let input: unknown = app.task;
    if (mode === "unknown-disclosure") app.task.evidenceBundle.evidence[0]!.publishedAtUtc = null as unknown as string;
    if (mode === "foreign-language") label.selection.evidenceLanguages[0]!.evidenceId = "foreign-evidence";
    if (mode === "post-cutoff") app.task.evidenceBundle.evidence[0]!.publishedAtUtc = "2026-09-05T00:00:00.000Z";
    if (mode === "statement-result" || mode === "statement-act") {
      app.candidates[0]!.claims[0] = { id: "fact", kind: "statement", text: "观测站宣布将扩建全球网络。", publisherSourceId: app.task.evidenceBundle.evidence[0]!.sourceId, evidenceIds: ["evidence-1"] };
      label.event = { ...label.event, eventKind: "publisher-statement", identity: { subject: app.task.evidenceBundle.evidence[0]!.sourceId, action: "published-statement", object: "network", discriminator: "2026-announcement" }, occurrenceEvidenceId: null };
      if (mode === "statement-act") label.selection.impactBasis = "statement-act";
    }
    const sourceText = app.candidates.flatMap((story) => story.claims.map((claim) => claim.text)).join("\n");
    Object.assign(app.task.evidenceBundle.evidence[0]!, { content: sourceText, contentSha256: createHash("sha256").update(sourceText).digest("hex") });
    const original = app.options.verifier!;
    let expired = false;
    let calls = 0;
    app.options.verifier = { verify: async (value) => {
      const receipt = await original.verify(value) as { inputSha256: string; assessments: Array<{ claimId: string; conclusion: string; reason: string; wording: string }> };
      if (mode === "receipt-identity") receipt.inputSha256 = "0".repeat(64);
      if (mode === "unsafe-analysis") for (const assessment of receipt.assessments.filter((item) => item.claimId === "importance")) Object.assign(assessment, { conclusion: "unsafe", reason: "unsafe-material", wording: "unsafe" });
      if (mode === "final-expiry" && ++calls === 2) expired = true;
      return receipt;
    } };
    if (mode === "distribution" || mode === "final-expiry") {
      const source = policy();
      source.distribution.enabled = mode !== "distribution";
      app.options.sourcePolicies = [source];
      app.options.clock = () => expired ? "2026-09-04T23:40:00.000Z" : "2026-09-04T23:39:00.000Z";
      if (mode === "final-expiry") {
        app.candidates.push(candidate("second-batch", "evidence-1", "ai"));
        app.annotations["second-batch"] = labels("second-batch");
      }
      input = { ...app.task, evidenceBundle: { ...app.task.evidenceBundle, schemaVersion: 2, coverageGaps: [],
        evidence: [{ ...app.task.evidenceBundle.evidence[0]!, sourceId: source.sourceId, policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: mode === "final-expiry" ? "2026-09-04T23:39:30.000Z" : "2026-09-05T12:00:00.000Z" }] } };
    }
    app.restart();
    if (mode === "post-cutoff") { await assert.rejects(() => app.observer.produce(input), /invalid-evidence-window/); continue; }
    const report = app.observer.readReport((await app.observer.produce(input)).id, ownerToken);
    if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
    const selected = report.record.interestSelections.find((item) => item.storyId === "climate");
    assert.equal(selected?.baseline ?? false, mode === "statement-act", mode);
    assert.equal(report.record.stories.some((story) => story.id === "climate"), mode === "statement-act" || mode === "foreign-language", mode);
    if (["distribution", "final-expiry", "receipt-identity"].includes(mode)) assert.ok(!JSON.stringify(report).includes("observer-final-selection-projection-v1"), mode);
    if (mode === "statement-act") assert.match(report.canonicalMarkdown, /发布者公开作出声明；声明内容不等同于已证事实/);
  }
});

test("A duplicate cluster member cannot lend its unpublished subject metadata to the primary story or pretend the selected story covers its region", async (t) => {
  const app = await fixture(t);
  app.candidates.push(candidate("duplicate", "evidence-1", "ai"));
  app.annotations.duplicate = labels("duplicate");
  app.annotations.duplicate.event = structuredClone(app.annotations.climate!.event);
  app.annotations.duplicate.selection = { ...app.annotations.duplicate.selection, topics: ["boost"], regions: ["US"], impact: "global", impactClaimIds: ["importance"], impactBasis: "observed-event" };
  app.annotations.space!.selection.regions = ["EU"];
  await app.import(profile([{ key: "boost", priority: 100 }, { key: "space", priority: 10 }]));
  const report = await app.publish();
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.deepEqual(report.record.stories.map((story) => story.id), ["space", "climate"]);
  assert.equal(report.record.interestSelections.find((item) => item.storyId === "climate")!.baseline, false);
  assert.deepEqual(report.record.editions.find((entry) => entry.edition === "ai")!.storyIds, []);
  assert.match(report.canonicalMarkdown, /Impact Note（不占普通条目）/);
  assert.deepEqual(report.record.coverage.regions.find((entry) => entry.key === "US")!.selectedStoryIds, []);
  assert.deepEqual(report.record.coverage.regions.find((entry) => entry.key === "EU")!.selectedStoryIds, ["space"]);
});

test("Verifier language and importance labels cannot create coverage or baseline when Source Policy withholds the material from model input", async (t) => {
  const app = await fixture(t);
  const source = policy();
  source.model.fields = [];
  app.options.sourcePolicies = [source];
  app.restart();
  await app.import(profile());
  for (const label of Object.values(app.annotations)) Object.assign(label.selection, { impact: "global", impactClaimIds: ["importance"], impactBasis: "observed-event" });
  const evidence = { ...app.task.evidenceBundle.evidence[0]!, sourceId: source.sourceId, policyVersion: source.version,
    policySha256: policyDigest(source), trust: "untrusted-source-data", expiresAtUtc: "2026-09-05T12:00:00.000Z" };
  const input = { ...app.task, evidenceBundle: { ...app.task.evidenceBundle, schemaVersion: 2, coverageGaps: [], evidence: [evidence] } };
  const report = app.observer.readReport((await app.observer.produce(input)).id, ownerToken);
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.deepEqual(report.record.coverage.unknownLanguageEvidenceIds, ["evidence-1"]);
  assert.ok(report.record.coverage.languages.every((entry) => entry.evidenceIds.length === 0));
  assert.ok(report.record.interestSelections.every((entry) => !entry.baseline));
  assert.ok(!JSON.stringify(report).includes("observer-final-selection-projection-v1"));
});

test("Regional and multilingual coverage reports actual annotated Evidence, unknowns, and missing targets without deriving geography from a domain", async (t) => {
  const app = await fixture(t);
  app.candidates.splice(0, app.candidates.length);
  app.task.evidenceBundle.evidence.splice(0, app.task.evidenceBundle.evidence.length);
  for (const [id, region, language, impact] of [["cn", "CN", "zh", "ordinary"], ["us", "US", "en", "ordinary"], ["eu", "EU", "fr", "ordinary"], ["jp", "JP", "ja", "major-regional"], ["unknown", null, null, "ordinary"]] as const) {
    const evidenceId = `evidence-${id}`;
    const content = { cn: "cn 项目在中国新增观测设施，显著扩大区域长期监测。", us: "The us project in the United States added observation facilities, significantly expanding regional long-term monitoring.",
      eu: "Le projet eu dans l’Union européenne a ajouté des installations d’observation, développant la surveillance régionale à long terme.",
      jp: "日本の jp プロジェクトは観測施設を追加し、地域の長期観測を大幅に拡大した。", unknown: "unknown 项目新增了观测设施，未明确地区；语言未标注。" }[id];
    app.task.evidenceBundle.evidence.push({ ...request.evidenceBundle.evidence[0]!, id: evidenceId, sourceId: `source-${id}`, url: `https://example.cn/${id}`, content, contentSha256: createHash("sha256").update(content).digest("hex") });
    app.candidates.push(candidate(id, evidenceId));
    app.annotations[id] = labels(id);
    app.annotations[id]!.event = { ...app.annotations[id]!.event, occurrenceEvidenceId: evidenceId, disclosureEvidenceId: evidenceId };
    app.annotations[id]!.selection = { topics: [], entities: [], regions: region ? [region] : [], evidenceLanguages: language ? [{ evidenceId, language }] : [], impact, impactClaimIds: ["importance"], impactBasis: "observed-event" };
  }
  for (const edition of app.task.editions) edition.evidenceIds = app.task.evidenceBundle.evidence.map((item) => item.id);
  await app.import(profile([]));
  const report = await app.publish();
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.deepEqual(report.record.coverage.regions.map((entry) => [entry.key, entry.evidenceIds]), [["CN", ["evidence-cn"]], ["US", ["evidence-us"]], ["EU", ["evidence-eu"]], ["other", ["evidence-jp"]]]);
  assert.deepEqual(report.record.coverage.unknownRegionEvidenceIds, ["evidence-unknown"]);
  assert.deepEqual(report.record.coverage.unknownLanguageEvidenceIds, ["evidence-unknown"]);
  assert.deepEqual(report.record.coverage.languages.find((entry) => entry.key === "de")!.evidenceIds, []);
  assert.deepEqual(report.record.coverage.languages.find((entry) => entry.key === "ja")!.evidenceIds, ["evidence-jp"]);
  assert.match(report.canonicalMarkdown, /语言盲区：de/);
  assert.match(report.canonicalMarkdown, /未知地域证据 1/);
  assert.match(report.canonicalMarkdown, /未知语言证据 1/);
  assert.equal(report.record.stories.length, 5);
});

test("A pending source and an empty bundle disclose source, region, and language gaps without manufacturing a global baseline", async (t) => {
  const app = await fixture(t);
  await app.import(profile([]));
  const input = { ...app.task, evidenceBundle: { ...app.task.evidenceBundle, schemaVersion: 2, evidence: [], coverageGaps: [{ sourceId: "pending-owner-source", edition: "world-affairs", reason: "source-pending" }] },
    editions: editions.map((edition) => ({ edition, evidenceIds: [] })) };
  const report = app.observer.readReport((await app.observer.produce(input)).id, ownerToken);
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.equal(report.record.stories.length, 0);
  assert.equal(report.record.coverage.inputEvidenceCount, 0);
  assert.ok(report.record.coverage.regions.every((entry) => entry.evidenceIds.length === 0));
  assert.match(report.canonicalMarkdown, /source-gap:pending-owner-source:source-pending/);
  assert.match(report.canonicalMarkdown, /地域缺口：CN/);
  assert.match(report.canonicalMarkdown, /语言盲区：zh/);
});

test("A profile imported while research is running only affects later production, and canonical wording identifies the frozen version", async (t) => {
  const app = await fixture(t);
  await app.import(profile());
  let release!: () => void;
  let announce!: () => void;
  const paused = new Promise<void>((resolve) => { release = resolve; });
  const entered = new Promise<void>((resolve) => { announce = resolve; });
  const runner = app.options.editionRunner!;
  app.options.editionRunner = { run: async (task, options) => { announce(); await paused; return runner.run(task, options); } };
  app.restart();
  const pending = app.publish();
  await entered;
  await app.import(profile([{ key: "space", priority: 100 }], 2));
  release();
  const report = await pending;
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.equal(report.record.interestProfile.profile.version, 1);
  assert.deepEqual(report.record.stories.map((story) => story.id), ["climate", "space"]);
  assert.match(report.canonicalMarkdown, /Interest Profile：v1/);
  const exported = join(app.directory, "next-profile.json");
  app.observer.exportInterestProfile(exported);
  const next = await fixture(t);
  next.observer.importInterestProfile(exported);
  const later = await next.publish();
  assert.deepEqual(later.record.stories.map((story) => story.id), ["space", "climate"]);
  assert.match(later.canonicalMarkdown, /Interest Profile：v2/);
  assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
});

test("A supported Global Baseline beyond the first seven candidates stays eligible under exclusions and receives a normal story slot", async (t) => {
  const app = await fixture(t);
  app.candidates.splice(0, app.candidates.length, ...Array.from({ length: 8 }, (_, index) => candidate(`ordinary-${index}`)), candidate("baseline"));
  for (const story of app.candidates) app.annotations[story.id] = labels(story.id);
  app.annotations.baseline!.selection = { ...app.annotations.baseline!.selection, topics: ["excluded"], impact: "global", impactClaimIds: ["importance"], impactBasis: "observed-event" };
  app.annotations["ordinary-0"]!.selection.topics = ["excluded"];
  const config = profile([{ key: "ordinary-1", priority: 100 }]);
  config.exclusions.topics = ["excluded"];
  await app.import(config);
  const report = await app.publish();
  assert.deepEqual(report.record.stories.map((story) => story.id), ["baseline", "ordinary-1", "ordinary-2", "ordinary-3", "ordinary-4", "ordinary-5", "ordinary-6"]);
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.equal(report.record.editions[0]!.priorityStoryIds[0], "baseline");
  assert.equal(report.record.interestSelections.find((item) => item.storyId === "baseline")!.baseline, true);
  assert.equal(report.record.interestSelections.find((item) => item.storyId === "ordinary-0")!.outcome, "excluded");
});

test("Invalid file imports preserve the last validated version across restart and export, while versions cannot roll back or change silently", async (t) => {
  const app = await fixture(t);
  await app.import(profile([], 2));
  for (const invalid of [profile([], 1), profile([{ key: "new", priority: 1 }], 2),
    profile([{ key: "bad", priority: -1 }], 3), profile([{ key: "SPACE", priority: 1 }, { key: " space ", priority: 2 }], 3),
    { ...profile([], 3), implicitClickLearning: true }]) {
    await assert.rejects(() => app.import(invalid), /interest-profile/);
  }
  const broken = join(app.directory, "broken.json");
  await writeFile(broken, "{ invalid json");
  assert.throws(() => app.observer.importInterestProfile(broken), /interest-profile/);
  app.restart();
  const exported = join(app.directory, "export.json");
  app.observer.exportInterestProfile(exported);
  assert.deepEqual(JSON.parse(await readFile(exported, "utf8")), profile([], 2));
  app.observer.importInterestProfile(exported);
  const report = await app.publish();
  if (report.record.schemaVersion !== 5) assert.fail("Expected interest record");
  assert.deepEqual(report.record.interestProfile.profile, profile([], 2));
});
