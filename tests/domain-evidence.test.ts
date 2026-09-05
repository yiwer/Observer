import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createObserver, type ObserverOptions } from "../src/observer.ts";
import { editionNames } from "../src/contracts.ts";
import type { CandidateV2, VerificationInput } from "../src/gate-contracts.ts";
import { ownerToken, request, successfulResult } from "./fixtures.ts";
import { createHash } from "node:crypto";
import { policy } from "./helpers/source-fixtures.ts";
import { policyDigest } from "../src/collection.ts";

const editions = Object.keys(editionNames) as Array<keyof typeof editionNames>;
function domain(): Record<string, unknown> {
  return { domains: ["world-affairs"], risk: { level: "high", categories: ["armed-conflict"] }, assertion: "event-fact", financialContent: "not-financial", numbers: { status: "none", statistics: [] } };
}
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "observer-domain-"));
  const task = { ...structuredClone(request), schemaVersion: 5,
    editions: editions.map((edition) => ({ edition, evidenceIds: ["evidence-1", "evidence-2"] })) };
  const content = "甲地发生了武装冲突。";
  task.evidenceBundle.evidence = [1, 2].map((index) => ({ ...structuredClone(request.evidenceBundle.evidence[0]!),
    id: `evidence-${index}`, sourceId: `source-${index}`, url: `https://source-${index}.example/report`, title: "固定冲突材料", content,
    contentSha256: createHash("sha256").update(content).digest("hex") }));
  const candidates: CandidateV2[] = [{ schemaVersion: 2, id: "conflict", eventClusterId: "untrusted-cluster", edition: "world-affairs", title: "不可信标题",
    claims: [{ id: "fact", kind: "fact", text: content, evidenceIds: ["evidence-1", "evidence-2"] }] }];
  const annotations: Record<string, ReturnType<typeof domain> | undefined> = { conflict: domain() };
  const assessmentOverrides: Record<string, Record<string, unknown>> = {};
  const eventFacts: Record<string, string> = { conflict: "armed-conflict-started" };
  const origins = ["origin-1", "origin-2"];
  const options: ObserverOptions = { databasePath: join(directory, "archive.sqlite"), ownerToken, mode: "test-fixture", clock: () => task.evidenceBundle.cutoffUtc.replace("23:30", "23:40"),
    editionRunner: { run: async () => ({ schemaVersion: 2, taskId: task.taskId, evidenceBundleId: task.evidenceBundle.id, configurationId: task.configurationId,
      editions: editions.map((edition) => ({ edition, status: "completed", result: { ...successfulResult(), taskId: `${task.taskId}:${edition}`,
        startedAtUtc: task.evidenceBundle.cutoffUtc.replace("23:30", "23:31"), finishedAtUtc: task.evidenceBundle.cutoffUtc.replace("23:30", "23:32"),
        stories: candidates.filter((story) => story.edition === edition) } })) }) },
    verifier: { verify: async (input: VerificationInput) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "domain-fixture-v1",
      assessments: input.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id,
        conclusion: "supported", reason: "supported-by-evidence", wording: "original",
        evidence: claim.evidenceIds.map((evidenceId) => ({ evidenceId, relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: origins[Number(evidenceId.slice(-1)) - 1] })),
        domain: annotations[story.id] ? { materials: claim.evidenceIds.map((evidenceId) => ({ evidenceId, kind: "text" })), ...annotations[story.id] } : undefined,
        event: { identity: { subject: story.id, action: "occurred", object: eventFacts[story.id] ?? "fixture-disclosure", discriminator: "2026-09-04" }, primaryEdition: story.edition,
          materiality: "routine", materialityClaimIds: [], occurrenceEvidenceId: null, disclosureEvidenceId: "evidence-1", developmentEvidenceId: null,
          fact: eventFacts[story.id] ?? "fixture-disclosure" },
        ...assessmentOverrides[`${story.id}/${claim.id}`],
      }))) }) } };
  let observer = createObserver(options);
  t.after(() => observer.close());
  const profileFile = join(directory, "interest.json");
  await writeFile(profileFile, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  observer.importInterestProfile(profileFile);
  return { directory, task, candidates, annotations, assessmentOverrides, origins, options, get observer() { return observer; },
    material(text: string, fact: string) {
      eventFacts.conflict = fact;
      for (const evidence of task.evidenceBundle.evidence) {
        evidence.title = "固定场景材料";
        evidence.content = text;
        evidence.contentSha256 = createHash("sha256").update(text).digest("hex");
      }
    },
    restart() { observer.close(); observer = createObserver(options); },
    async publish() { return observer.readReport((await observer.produce(task)).id, ownerToken); } };
}

test("High-risk world facts require independent upstream corroboration and keep the decision after restart", async (t) => {
  for (const independent of [true, false]) {
    const app = await fixture(t);
    if (!independent) app.origins[1] = "origin-1";
    const report = await app.publish();
    assert.equal(report.record.schemaVersion, 6);
    assert.equal(report.version.schemaVersion, 5);
    assert.equal(report.record.stories.length, independent ? 1 : 0);
    assert.equal(report.record.publicationGate.decisions[0]!.outcome, independent ? "published" : "unconfirmed");
    assert.match(report.canonicalMarkdown, independent ? /事实：甲地发生了武装冲突/ : /待确认说法（非已证事实）：甲地发生了武装冲突/);
    assert.throws(() => app.observer.readReport(report.version.id, "wrong"), /unauthorized/);
    app.restart();
    assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
  }
});

test("Dynamic counts retain their evidence-supported statistics time in published and conflicting descriptions without borrowing publication time", async (t) => {
  for (const mode of ["published", "conflicting", "missing", "future", "foreign-reference"] as const) {
    const app = await fixture(t);
    const statisticsAtUtc = mode === "missing" ? null : mode === "future" ? "2026-09-05T00:00:00.000Z" : "2026-09-04T20:00:00.000Z";
    app.candidates[0]!.claims[0]!.text = "示例救援报告的伤亡统计为十二至十五人，最终总数未知。";
    app.material("两份救援记录于2026-09-04T20:00:00.000Z统计：伤亡十二至十五人，最终总数未知。", "rescue-count-disclosed");
    app.annotations.conflict = { ...domain(), risk: { level: "high", categories: ["casualty-disaster"] }, numbers: { status: "dynamic", statistics: [{ statisticsAtUtc, evidenceIds: mode === "foreign-reference" ? ["foreign"] : ["evidence-1", "evidence-2"], publisherSourceId: null }] } };
    if (mode === "conflicting") app.assessmentOverrides["conflict/fact"] = { conclusion: "conflicting", reason: "source-conflict" };
    const report = await app.publish();
    assert.equal(report.record.schemaVersion, 6);
    const valid = mode === "published" || mode === "conflicting";
    assert.equal(report.record.publicationGate.decisions[0]!.outcome, valid ? mode === "published" ? "published" : "unconfirmed" : "quarantined");
    if (valid) {
      assert.match(report.canonicalMarkdown, /统计时间：2026-09-04T20:00:00.000Z/);
      assert.match(report.canonicalMarkdown, /十二至十五人，最终总数未知/);
    } else assert.ok(!JSON.stringify(report).includes("十二至十五人"));
    app.restart();
    assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
  }
});

test("High-risk finance requires a primary observation in addition to two independent sources even outside the finance Edition", async (t) => {
  for (const primary of [false, true]) {
    const app = await fixture(t);
    app.candidates[0]!.edition = "ai";
    app.candidates[0]!.claims[0]!.text = "示例公司的清偿安排已获法院确认。";
    app.material("法院记录和独立庭审观察均确认示例公司的清偿安排已获法院确认。", "court-confirmed-settlement");
    app.annotations.conflict = { ...domain(), domains: ["finance"], risk: { level: "high", categories: ["finance-sensitive"] }, financialContent: "informational" };
    for (const evidence of app.task.evidenceBundle.evidence) evidence.sourceType = "secondary";
    if (primary) app.task.evidenceBundle.evidence[0]!.sourceType = "primary";
    const report = await app.publish();
    assert.equal(report.record.stories.length, primary ? 1 : 0);
    assert.notEqual(report.record.schemaVersion, 1);
    if (report.record.schemaVersion === 1) return;
    assert.equal(report.record.publicationGate.decisions[0]!.reason, primary ? "appropriate-primary" : "finance-primary-corroboration-required");
    assert.match(report.canonicalMarkdown, primary ? /事实：示例公司的清偿安排/ : /待确认说法（非已证事实）：示例公司的清偿安排/);
  }
});

test("Financial instructions, target prices, return promises and unknown suitability never survive as facts, analysis, statements or quotations", async (t) => {
  for (const content of ["trade-instruction", "target-price", "return-promise", "unknown"] as const) {
    for (const kind of ["fact", "analysis", "statement", "quotation"] as const) {
      const app = await fixture(t);
      const text = "拒绝成稿标记：立即买入，目标价翻倍，保证收益。";
      app.material(`一份不应进入财经成稿的营销材料写道：${text}`, "marketing-statement-published");
      const common = { id: "fact", text, evidenceIds: ["evidence-1"] };
      app.candidates[0]!.claims = [kind === "analysis" ? { ...common, kind, mode: "explanation" } : kind === "statement" ? { ...common, kind, publisherSourceId: "source-1" } : kind === "quotation" ? { ...common, kind, originalText: text, translated: false, language: "zh" } : { ...common, kind }];
      app.annotations.conflict = { ...domain(), domains: ["finance"], financialContent: content };
      const report = await app.publish();
      assert.equal(report.record.schemaVersion, 6);
      assert.equal(report.record.publicationGate.decisions[0]!.reason, "financial-content-forbidden");
      assert.equal(report.record.publicationGate.decisions[0]!.outcome, "quarantined");
      assert.ok(!JSON.stringify(report).includes("拒绝成稿标记"));
    }
  }
});

test("AI and frontier research show each Evidence's combined maturity and unknown states beside the Chinese claim", async (t) => {
  for (const edition of ["ai", "frontier-technology"] as const) {
    const app = await fixture(t);
    app.candidates[0]!.edition = edition;
    app.candidates[0]!.claims[0]!.text = "示例研究公布了公开实验，另一团队报告了复现实验。";
    app.material("研究方发布尚未同行评审的预印本实验，独立团队另行发布复现记录，其同行评审状态未知。", "experiments-disclosed");
    app.annotations.conflict = { ...domain(), domains: [edition], risk: { level: "routine", categories: [] }, research: [
      { evidenceId: "evidence-1", preprint: "yes", officialRelease: "yes", independentValidation: "no", peerReview: "no", role: "research-result" },
      { evidenceId: "evidence-2", preprint: "unknown", officialRelease: "no", independentValidation: "yes", peerReview: "unknown", role: "research-result" },
    ] };
    const report = await app.publish();
    assert.equal(report.record.stories.length, 1);
    assert.match(report.canonicalMarkdown, /证据成熟度 evidence-1：预印本：是；官方发布：是；独立验证：否；同行评审：否/);
    assert.match(report.canonicalMarkdown, /证据成熟度 evidence-2：预印本：未知；官方发布：否；独立验证：是；同行评审：未知/);
    app.restart();
    assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
  }
});

test("Research labels cannot borrow another Claim's Evidence and missing judgments isolate only the affected Claim", async (t) => {
  for (const mode of ["missing", "foreign", "duplicate"] as const) {
    const app = await fixture(t);
    app.candidates[0]!.edition = "ai";
    app.material("研究团队公开了一份新实验记录。", "experiment-disclosed");
    app.candidates[0]!.claims[0]!.text = "研究团队公开了一份新实验记录。";
    const label = { evidenceId: "evidence-1", preprint: "yes", officialRelease: "yes", independentValidation: "no", peerReview: "unknown", role: "research-result" };
    app.annotations.conflict = { ...domain(), domains: ["ai"], risk: { level: "routine", categories: [] }, research: mode === "missing" ? [] : [label, { ...label, evidenceId: mode === "foreign" ? "foreign-research" : "evidence-1" }] };
    app.candidates.push({ ...structuredClone(app.candidates[0]!), id: "healthy", edition: "world-affairs", claims: [{ id: "fact", kind: "fact", text: "甲地发生了武装冲突。", evidenceIds: ["evidence-1", "evidence-2"] }] });
    app.material("研究团队公开了一份新实验记录。同份材料另记甲地发生了武装冲突。", "experiment-disclosed");
    app.annotations.healthy = domain();
    const report = await app.publish();
    assert.deepEqual(report.record.stories.map((story) => story.id), ["healthy"]);
    assert.notEqual(report.record.schemaVersion, 1);
    if (report.record.schemaVersion === 1) return;
    assert.equal(report.record.publicationGate.decisions.find((item) => item.storyId === "conflict")!.reason, "research-assessment-unavailable");
    assert.ok(!JSON.stringify(report).includes("foreign-research"));
  }
});

test("An official company capability claim remains attributed or unconfirmed until independent capability Evidence exists", async (t) => {
  for (const edition of ["ai", "frontier-technology"] as const) {
    for (const kind of ["fact", "statement"] as const) {
      const app = await fixture(t);
      app.candidates[0]!.edition = edition;
      const text = "示例公司宣称系统已实现自主实验能力。";
      app.material(text + "该能力暂无独立验证或同行评审。", "company-capability-announced");
      const common = { id: "fact", text, evidenceIds: ["evidence-1"] };
      app.candidates[0]!.claims = [kind === "statement" ? { ...common, kind, publisherSourceId: "source-1" } : { ...common, kind }];
      app.annotations.conflict = { ...domain(), domains: [edition], risk: { level: "routine", categories: [] }, assertion: kind === "fact" ? "event-fact" : "attributed-statement", research: [
        { evidenceId: "evidence-1", preprint: "no", officialRelease: "yes", independentValidation: "no", peerReview: "unknown", role: "company-capability-claim" },
      ] };
      if (kind === "statement") app.assessmentOverrides["conflict/fact"] = {
        evidence: [{ evidenceId: "evidence-1", relation: "supports", basis: "publisher-statement", reliability: "reliable", upstreamOriginId: "origin-1" }],
        event: { eventKind: "publisher-statement", identity: { subject: "source-1", action: "published-statement", object: "capability-announcement", discriminator: "2026-09-04" }, fact: "company-capability-announced", primaryEdition: edition, materiality: "routine", materialityClaimIds: [], occurrenceEvidenceId: null, disclosureEvidenceId: "evidence-1", developmentEvidenceId: null },
      };
      const report = await app.publish();
      assert.notEqual(report.record.schemaVersion, 1);
      if (report.record.schemaVersion === 1) return;
      assert.equal(report.record.publicationGate.decisions[0]!.outcome, kind === "fact" ? "unconfirmed" : "published");
      assert.match(report.canonicalMarkdown, kind === "fact" ? /待确认说法（非已证事实）/ : /发布者声明（source-1）/);
      assert.match(report.canonicalMarkdown, /独立验证：否；同行评审：未知/);
    }
  }
});

test("Independent company-capability validation requires an actually different Source and Upstream Origin", async (t) => {
  for (const mode of ["independent", "same-origin", "same-source", "unknown-origin"] as const) {
    const app = await fixture(t);
    app.candidates[0]!.edition = "ai";
    app.candidates[0]!.claims[0]!.text = "示例公司的实验系统具备自动校准能力。";
    app.material("公司公布自动校准能力，第二份测量记录报告成功复核；来源与上游关系由本场景明确标注。", "automatic-calibration-measured");
    if (mode === "same-origin") app.origins[1] = "origin-1";
    if (mode === "same-source") app.task.evidenceBundle.evidence[1]!.sourceId = "source-1";
    if (mode === "unknown-origin") app.assessmentOverrides["conflict/fact"] = { evidence: [
      { evidenceId: "evidence-1", relation: "supports", basis: "publisher-statement", reliability: "reliable", upstreamOriginId: null },
      { evidenceId: "evidence-2", relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "origin-2" },
    ] };
    app.annotations.conflict = { ...domain(), domains: ["ai"], risk: { level: "routine", categories: [] }, research: [
      { evidenceId: "evidence-1", preprint: "no", officialRelease: "yes", independentValidation: "no", peerReview: "unknown", role: "company-capability-claim" },
      { evidenceId: "evidence-2", preprint: "no", officialRelease: "no", independentValidation: "yes", peerReview: "unknown", role: "research-result" },
    ] };
    const report = await app.publish();
    if (report.record.schemaVersion !== 6) assert.fail("Expected domain report");
    assert.equal(report.record.publicationGate.decisions[0]!.outcome, mode === "independent" ? "published" : "unconfirmed", mode);
    assert.match(report.canonicalMarkdown, mode === "independent" ? /evidence-2：预印本：否；官方发布：否；独立验证：是/ : /evidence-2：预印本：否；官方发布：否；独立验证：未知/);
  }
});

test("Single-party dynamic counts keep their own supported time and attribution even while unconfirmed", async (t) => {
  for (const publisherSourceId of ["source-1", null, "foreign-publisher"] as const) {
    const app = await fixture(t);
    app.material("source-1的计票机构称，截至2026-09-04T20:00:00.000Z已计票六成；source-2只转载该机构数字。独立总数未知。", "election-count-disclosed");
    app.candidates[0]!.claims[0]!.text = "计票机构称已计票六成，独立总数未知。";
    app.origins[1] = "origin-1";
    app.annotations.conflict = { ...domain(), risk: { level: "high", categories: ["election-count"] }, numbers: { status: "dynamic", statistics: [{ statisticsAtUtc: "2026-09-04T20:00:00.000Z", evidenceIds: ["evidence-1"], publisherSourceId }] } };
    const report = await app.publish();
    assert.notEqual(report.record.schemaVersion, 1);
    if (report.record.schemaVersion === 1) return;
    assert.equal(report.record.publicationGate.decisions[0]!.outcome, publisherSourceId === "source-1" ? "unconfirmed" : "quarantined");
    if (publisherSourceId === "source-1") {
      assert.match(report.canonicalMarkdown, /待确认说法（非已证事实）：计票机构称已计票六成/);
      assert.match(report.canonicalMarkdown, /统计时间：2026-09-04T20:00:00.000Z；依据：evidence-1；单方归因：source-1/);
    } else assert.ok(!JSON.stringify(report).includes("已计票六成"));
    assert.ok(!JSON.stringify(report).includes("foreign-publisher"));
  }
});

test("Financial market figures retain their own statistics time and unknown final total", async (t) => {
  for (const valid of [true, false]) {
    const app = await fixture(t);
    app.candidates[0]!.edition = "finance";
    app.material("截至2026-09-04T20:00:00.000Z，示例市场的结算记录总额为三亿元，两家独立记录一致；盘中最终总额未知。", "market-settlement-disclosed");
    app.candidates[0]!.claims[0]!.text = "示例市场已记录三亿元结算，盘中最终总额未知。";
    app.annotations.conflict = { ...domain(), domains: ["finance"], financialContent: "informational", risk: { level: "high", categories: ["finance-sensitive"] }, numbers: { status: "dynamic", statistics: [{ statisticsAtUtc: valid ? "2026-09-04T20:00:00.000Z" : null, publisherSourceId: null, evidenceIds: ["evidence-1", "evidence-2"] }] } };
    const report = await app.publish();
    if (report.record.schemaVersion !== 6) assert.fail("Expected domain report");
    assert.equal(report.record.publicationGate.decisions[0]!.outcome, valid ? "published" : "quarantined");
    if (valid) {
      assert.match(report.canonicalMarkdown, /三亿元结算，盘中最终总额未知/);
      assert.match(report.canonicalMarkdown, /统计时间：2026-09-04T20:00:00.000Z/);
    } else assert.ok(!JSON.stringify(report).includes("三亿元结算"));
  }
});

test("Unsafe media and unsafe wording are quarantined before a high-risk or company uncertainty can expose their text", async (t) => {
  for (const mode of ["unverified-social-video", "graphic-imagery", "unknown", "unsafe-receipt", "company-count"] as const) {
    const app = await fixture(t);
    const text = "必须隔离的材料标记：视频声称冲突伤亡三十人，尚无核验。";
    app.material(text, "unverified-material-described");
    app.candidates[0]!.claims[0]!.text = text;
    app.origins[1] = "origin-1";
    if (mode === "unsafe-receipt") app.assessmentOverrides["conflict/fact"] = { conclusion: "unsafe", reason: "unsafe-material" };
    else if (mode === "company-count") app.annotations.conflict = { ...domain(), domains: ["ai"], numbers: { status: "dynamic", statistics: [{ statisticsAtUtc: null, publisherSourceId: "source-1", evidenceIds: ["evidence-1"] }] }, research: [1, 2].map((id) => ({ evidenceId: `evidence-${id}`, preprint: "no", officialRelease: "yes", independentValidation: "no", peerReview: "no", role: "company-capability-claim" })) };
    else app.annotations.conflict = { ...domain(), materials: [1, 2].map((id) => ({ evidenceId: `evidence-${id}`, kind: mode })) };
    const report = await app.publish();
    assert.notEqual(report.record.schemaVersion, 1);
    if (report.record.schemaVersion === 1) return;
    assert.equal(report.record.publicationGate.decisions[0]!.outcome, "quarantined");
    assert.equal(report.record.publicationGate.decisions[0]!.reason, mode === "unsafe-receipt" ? "unsafe-material" : mode === "company-count" ? "statistics-time-unavailable" : "publication-material-forbidden");
    assert.ok(!JSON.stringify(report).includes("必须隔离的材料标记"));
    assert.equal(report.record.evidenceBundle.evidence.length, 0);
  }
});

test("A fact cannot borrow an interpretation label to bypass high-risk checks, and every semantic finance domain needs primary corroboration", async (t) => {
  for (const mode of ["fact-as-interpretation", "fact-as-statement", "multi-domain-finance"] as const) {
    const app = await fixture(t);
    app.origins[1] = "origin-1";
    if (mode === "multi-domain-finance") {
      app.material("冲突导致示例金融机构清偿暂停，两家媒体独立报道该变化，尚无一手记录。", "settlement-interrupted");
      app.candidates[0]!.claims[0]!.text = "冲突导致示例金融机构清偿暂停。";
      app.annotations.conflict = { ...domain(), domains: ["world-affairs", "finance"], financialContent: "informational" };
      app.origins[1] = "origin-2";
      app.task.evidenceBundle.evidence.forEach((evidence) => { evidence.sourceType = "secondary"; });
    } else app.annotations.conflict = { ...domain(), assertion: mode === "fact-as-interpretation" ? "interpretation" : "attributed-statement" };
    const report = await app.publish();
    assert.notEqual(report.record.schemaVersion, 1);
    if (report.record.schemaVersion === 1) return;
    assert.equal(report.record.publicationGate.decisions[0]!.reason, mode === "multi-domain-finance" ? "finance-primary-corroboration-required" : "domain-assertion-inconsistent");
    assert.equal(report.record.stories.length, 0);
  }
});

test("Every Edition requires a complete semantic domain judgment and malformed annotations leave healthy batch neighbors readable", async (t) => {
  for (const edition of editions) {
    for (const bad of [undefined, { ...domain(), risk: { level: "unknown", categories: [] } }, { ...domain(), freeText: "不可入档的注解原文" }] as const) {
      const app = await fixture(t);
      app.candidates[0]!.edition = edition;
      app.annotations.conflict = bad;
      app.candidates.push({ ...structuredClone(app.candidates[0]!), id: "healthy", edition: "world-affairs" });
      app.annotations.healthy = domain();
      const report = await app.publish();
      assert.deepEqual(report.record.stories.map((story) => story.id), ["healthy"]);
      assert.notEqual(report.record.schemaVersion, 1);
      if (report.record.schemaVersion === 1) return;
      assert.equal(report.record.publicationGate.decisions.find((item) => item.storyId === "conflict")!.reason, "domain-assessment-unavailable");
      assert.ok(!JSON.stringify(report).includes("不可入档的注解原文"));
    }
  }
});

test("High-risk factual assertions inside analysis, statements and quotations receive the same source gate while a pure scenario stays analysis", async (t) => {
  for (const kind of ["analysis", "statement", "quotation"] as const) {
    const app = await fixture(t);
    const text = "甲地发生了武装冲突。";
    const common = { id: "fact", text, evidenceIds: ["evidence-1"] };
    app.candidates[0]!.claims = [kind === "analysis" ? { ...common, kind, mode: "explanation" } : kind === "statement" ? { ...common, kind, publisherSourceId: "source-1" } : { ...common, kind, originalText: text, translated: false, language: "zh" }];
    const report = await app.publish();
    assert.notEqual(report.record.schemaVersion, 1);
    if (report.record.schemaVersion === 1) return;
    assert.equal(report.record.publicationGate.decisions[0]!.reason, "high-risk-independent-sources-required");
    assert.equal(report.record.publicationGate.decisions[0]!.outcome, "unconfirmed");
    assert.equal(report.record.stories.length, 0);
  }
  const app = await fixture(t);
  app.material("甲地发生了武装冲突。若运输中断持续，可能延缓物资交付；该条件后果尚未发生。", "armed-conflict-started");
  app.candidates[0]!.claims.push({ id: "scenario", kind: "analysis", mode: "scenario", text: "若运输中断持续，可能延缓物资交付。", evidenceIds: ["evidence-1"] });
  app.assessmentOverrides["conflict/scenario"] = { domain: { ...domain(), materials: [{ evidenceId: "evidence-1", kind: "text" }], assertion: "interpretation", numbers: { status: "none", statistics: [] } } };
  const report = await app.publish();
  assert.match(report.canonicalMarkdown, /分析（情景）：若运输中断持续/);
});

test("Legacy request versions strip new domain annotations without changing their report contract", async (t) => {
  for (const schemaVersion of [1, 2, 3, 4] as const) {
    const app = await fixture(t);
    let task: unknown = { ...app.task, schemaVersion };
    if (schemaVersion === 1) {
      const { editions: _editions, ...single } = app.task;
      task = { ...single, schemaVersion };
      app.options.runner = { run: async () => ({ ...successfulResult(), stories: app.candidates }) };
      app.restart();
    }
    const report = app.observer.readReport((await app.observer.produce(task)).id, ownerToken);
    assert.equal(report.record.schemaVersion, schemaVersion + 1);
    assert.ok(!JSON.stringify(report).includes('"domain"'));
    assert.ok(!JSON.stringify(report).includes("domainProjection"));
    app.restart();
    assert.equal(JSON.stringify(app.observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
  }
});

test("Four Editions replay allowed, rejected and unconfirmed inputs through full Chinese Markdown and a restarted archive", async (t) => {
  for (const edition of ["world-affairs", "finance", "ai", "frontier-technology"] as const) {
    for (const outcome of ["published", "quarantined", "unconfirmed"] as const) {
      const app = await fixture(t);
      const science = edition === "ai" || edition === "frontier-technology";
      const text = edition === "world-affairs" ? "示例公共卫生应急机制已启动。" : edition === "finance" ? "示例清算机构已暂缓部分结算。" : edition === "ai" ? "示例研究团队公布了模型实验。" : "示例实验室公布了新材料实验。";
      app.candidates[0]!.edition = edition;
      app.candidates[0]!.claims[0]!.text = text;
      app.material(text + (outcome === "unconfirmed" ? "另一份独立记录对这一披露提出相反证据，状态仍未解决。" : "两份独立记录均支持这一披露。"), `${edition}-disclosure`);
      app.annotations.conflict = { ...domain(), domains: [edition], risk: { level: science ? "routine" : "high", categories: science ? [] : [edition === "finance" ? "finance-sensitive" : "public-health-emergency"] }, financialContent: edition === "finance" ? "informational" : "not-financial",
        research: science ? [1, 2].map((id) => ({ evidenceId: `evidence-${id}`, preprint: id === 1 ? "yes" : "no", officialRelease: id === 1 ? "yes" : "no", independentValidation: id === 1 ? "no" : "yes", peerReview: "unknown", role: "research-result" })) : [] };
      if (outcome === "unconfirmed") app.assessmentOverrides["conflict/fact"] = { conclusion: "conflicting", reason: "source-conflict", evidence: [
        { evidenceId: "evidence-1", relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "origin-1" },
        { evidenceId: "evidence-2", relation: "contradicts", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "origin-2" },
      ] };
      if (outcome === "quarantined") {
        app.candidates[0]!.claims[0]!.text = "拒绝回放原文：" + text;
        app.material("拒绝回放原文：" + text, `${edition}-rejected-disclosure`);
        if (edition === "finance") app.annotations.conflict.financialContent = "unknown";
        else if (science) app.annotations.conflict.research = [];
        else app.annotations.conflict.materials = [1, 2].map((id) => ({ evidenceId: `evidence-${id}`, kind: "unverified-social-video" }));
      }
      const report = await app.publish();
      if (report.record.schemaVersion !== 6) assert.fail("Expected domain report");
      assert.equal(report.record.publicationGate.decisions[0]!.outcome, outcome);
      assert.match(report.canonicalMarkdown, new RegExp(editionNames[edition]));
      if (outcome === "published") assert.match(report.canonicalMarkdown, /事实：/);
      if (outcome === "unconfirmed") {
        assert.match(report.canonicalMarkdown, /待确认说法（非已证事实）/);
        assert.match(report.canonicalMarkdown, /source-2（提供相反材料）/);
      }
      assert.ok(!JSON.stringify(report).includes("拒绝回放原文"));
      app.restart();
      assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
      await writeFile(join(app.directory, "replay-request.json"), JSON.stringify(app.task, null, 2));
      await writeFile(join(app.directory, "replay-candidates.json"), JSON.stringify(app.candidates, null, 2));
      await writeFile(join(app.directory, "replay-annotations.json"), JSON.stringify({ annotations: app.annotations, assessmentOverrides: app.assessmentOverrides, origins: app.origins }, null, 2));
      await writeFile(join(app.directory, "replay-report.json"), JSON.stringify(report, null, 2));
      await writeFile(join(app.directory, "replay.md"), report.canonicalMarkdown);
      t.diagnostic(`${edition}/${outcome}: ${app.directory}`);
    }
  }
});

test("Domain rules retain source permissions, final expiry and actual Verifier delivery accounting", async (t) => {
  for (const mode of ["pending", "model-forbidden", "distribution", "final-expiry", "no-verifier", "valid-and-revoked"] as const) {
    const app = await fixture(t);
    const sources = [1, 2].map((id) => ({ ...policy(), sourceId: `source-${id}` }));
    if (mode === "pending") sources[0]!.review = { ...sources[0]!.review, status: "pending", reviewedAtUtc: null };
    if (mode === "model-forbidden") sources[0]!.model.enabled = false;
    if (mode === "distribution") sources[0]!.distribution.enabled = false;
    app.options.sourcePolicies = sources;
    const input = { ...app.task, evidenceBundle: { ...app.task.evidenceBundle, schemaVersion: 2, coverageGaps: [],
      evidence: app.task.evidenceBundle.evidence.map((entry, index) => ({ ...entry, policyVersion: 1, policySha256: policyDigest(sources[index]!), trust: "untrusted-source-data", expiresAtUtc: mode === "final-expiry" ? "2026-09-04T23:39:30.000Z" : "2026-09-05T22:06:00.000Z" })) } };
    const received: string[][] = [];
    const verifier = app.options.verifier!;
    let completed = false;
    if (mode === "no-verifier") delete app.options.verifier;
    else app.options.verifier = { verify: async (value) => { received.push(value.evidence.map((item) => item.id)); completed = true; return verifier.verify(value); } };
    if (mode === "final-expiry") app.options.clock = () => completed ? "2026-09-04T23:40:00.000Z" : "2026-09-04T23:39:00.000Z";
    app.restart();
    if (mode === "pending" || mode === "model-forbidden") {
      await assert.rejects(() => app.observer.produce(input), mode === "pending" ? /source-policy-invalid/ : /model-forbidden/);
      assert.deepEqual(received, []);
      continue;
    }
    const report = app.observer.readReport((await app.observer.produce(input)).id, ownerToken);
    if (report.record.schemaVersion !== 6) assert.fail("Expected domain report");
    assert.equal(report.record.coverage.inputEvidenceCount, mode === "no-verifier" ? 0 : 2);
    assert.deepEqual(report.record.publicationGate.input.dispatchedEvidenceIds, received.flat());
    assert.equal(report.record.stories.length, mode === "valid-and-revoked" ? 1 : 0);
    if (mode !== "valid-and-revoked") assert.ok(!JSON.stringify(report).includes("observer-final-domain-projection-v1"));
    else {
      app.restart();
      assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
      app.options.sourcePolicies = [];
      app.restart();
      assert.throws(() => app.observer.readReport(report.version.id, ownerToken), /not-found/);
    }
  }
});

test("Record 5 and Record 6 remain classified history across consecutive request 5 publications and restarts", async (t) => {
  const app = await fixture(t);
  const first = app.observer.readReport((await app.observer.produce({ ...app.task, schemaVersion: 4 })).id, ownerToken);
  assert.equal(first.record.schemaVersion, 5);
  for (const [date, cutoff, window] of [["2026-09-06", "2026-09-05T23:30:00.000Z", "2026-09-04T23:30:00.000Z"], ["2026-09-07", "2026-09-06T23:30:00.000Z", "2026-09-05T23:30:00.000Z"]]) {
    app.restart();
    app.task.businessDate = date!;
    app.task.evidenceBundle.businessDate = date!;
    app.task.evidenceBundle.cutoffUtc = cutoff!;
    app.task.evidenceBundle.windowStartUtc = window!;
    const later = await app.publish();
    if (later.record.schemaVersion !== 6) assert.fail("Expected domain report");
    assert.deepEqual(later.record.stories, []);
    assert.deepEqual(later.record.historyCoverage, { status: "classified", versionIds: [] });
    assert.equal(later.record.eventSelections[0]!.reason, "no-new-development");
    assert.deepEqual(app.observer.readReport(first.version.id, ownerToken), first);
    app.restart();
    assert.deepEqual(app.observer.readReport(later.version.id, ownerToken), later);
  }
});

test("The public domain request rejects binary or extra media inputs and production still cannot publish fixture reports", async (t) => {
  const app = await fixture(t);
  await assert.rejects(() => app.observer.produce({ ...app.task, evidenceBundle: { ...app.task.evidenceBundle,
    evidence: app.task.evidenceBundle.evidence.map((item) => ({ ...item, media: { url: "https://media.example/unverified.mp4", kind: "video" } })) } }), /invalid-request/);
  await assert.rejects(() => app.observer.produce({ ...app.task, evidenceBundle: { ...app.task.evidenceBundle,
    evidence: app.task.evidenceBundle.evidence.map((item) => ({ ...item, content: new Uint8Array([1, 2, 3]) })) } }), /invalid-request/);
  const report = await app.publish();
  app.options.mode = "production";
  app.restart();
  await assert.rejects(() => app.observer.produce(app.task), /publication-disabled/);
  assert.throws(() => app.observer.readReport(report.version.id, ownerToken), /not-found/);
});
