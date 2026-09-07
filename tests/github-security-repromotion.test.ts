import assert from "node:assert/strict";
import { test } from "node:test";
import { repromotionFixture, ownedRelease, ownedAssessment } from "./helpers/repromotion-fixtures.ts";
import { repository } from "./helpers/github-fixtures.ts";
import { ownerToken } from "./fixtures.ts";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { rankGitHubRepromotions, githubRepromotionMarkdown } from "../src/github-repromotion.ts";

const advisory = () => ({ ghsa_id: "GHSA-abcd-2345-efgh", cve_id: null, url: "https://api.github.com/advisories/GHSA-abcd-2345-efgh", html_url: "https://github.com/advisories/GHSA-abcd-2345-efgh",
  repository_advisory_url: "https://api.github.com/repos/example/repeat/security-advisories/GHSA-abcd-2345-efgh", source_code_location: "https://github.com/example/repeat", type: "reviewed", severity: "high",
  summary: "Owned package security risk", description: "Affected versions permit unauthorized query access. DO_NOT_RETAIN_THIS_FULL_DESCRIPTION.", identifiers: [{ type: "GHSA", value: "GHSA-abcd-2345-efgh" }], references: [],
  published_at: "2026-09-05T21:00:00Z", updated_at: "2026-09-05T21:00:00Z", github_reviewed_at: "2026-09-05T21:00:00Z", nvd_published_at: null, withdrawn_at: null,
  vulnerabilities: [{ package: { ecosystem: "npm", name: "owned-query-package" }, vulnerable_version_range: ">=1.0.0 <1.2.0", first_patched_version: "1.2.0", vulnerable_functions: null }], cwes: [], credits: [] });

test("A scheduled refresh may establish an explicit-none mitigation baseline, preserves its first real origin across restart, and never makes the baseline an event", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  const quote = "目前没有缓解措施。";
  fixture.state.advisories = [{ ...advisory(), description: quote }];
  let calls = 0;
  const received: unknown[] = [];
  fixture.state.assessSecurity = async (input) => {
    calls++; received.push(structuredClone(input));
    assert.ok("previousMitigations" in input && Array.isArray(input.previousMitigations));
    const { description: _description, ...evidence } = input.evidence;
    assert.equal(input.inputSha256, createHash("sha256").update(JSON.stringify({ schemaVersion: 1, formatVersion: 2, evidence,
      previous: input.previous, previousMitigations: input.previousMitigations, contextFreeze: input.contextFreeze })).digest("hex"));
    assert.equal(input.previousMitigations.length, calls === 1 ? 0 : 1);
    return { schemaVersion: 1, formatVersion: 2, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-mitigation-v1",
      assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "same", previousDevelopmentId: input.previous[0]!.development.developmentId }, change: null, evidenceExcerpt: "" },
      mitigation: { conclusion: "supported", projection: { state: "explicit-none", scopeIndexes: [0], quote: { start: 0, text: quote } },
        relation: { kind: calls === 1 ? "distinct" : "same", previousProjectionId: calls === 1 ? null : input.previousMitigations[0]!.projection.projectionId } } };
  };
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  assert.equal(calls, 0, "initial complete risk does not wait for a mitigation model");
  const initial = await fixture.publish("2026-09-06");
  if (initial.record.schemaVersion !== 10) throw new Error("Record10 required");
  const initialId = initial.record.githubRepromotion.reportedDevelopments[0]!.developmentId;
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  assert.equal(calls, 1, "the next scheduled refresh records the real explicit-none baseline");
  const baselineRun = fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z").developments.runs[0]!;
  assert.equal(baselineRun.security!.developments[0]!.developmentId, initialId);
  fixture.restart();
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30)]);
  assert.equal(calls, 2);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-07T23:30:00.000Z");
  const history = snapshot.developments.runs[0]!.security!.history;
  assert.ok("mitigations" in history && Array.isArray(history.mitigations));
  assert.equal(history.mitigations.length, 1);
  assert.equal(history.mitigations[0]!.origin.developmentRunId, baselineRun.id);
  assert.equal(history.mitigations[0]!.projection.quote.text, quote);
  assert.equal(history.mitigations[0]!.projection.state.state, "explicit-none");
  assert.equal(snapshot.developments.runs[0]!.security!.developments[0]!.developmentId, initialId);
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  assert.equal(received.length, 2);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A supported mitigation baseline does not require the optional structural assessment to assert a redundant same-development judgment", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  const quote = "目前没有缓解措施。";
  fixture.state.advisories = [{ ...advisory(), description: quote }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, formatVersion: 2, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-mitigation-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "insufficient", relation: { kind: "unknown", previousDevelopmentId: null }, change: null, evidenceExcerpt: "" },
    mitigation: { conclusion: "supported", projection: { state: "explicit-none", scopeIndexes: [0], quote: { start: 0, text: quote } }, relation: { kind: "distinct", previousProjectionId: null } } });
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  fixture.restart();
  fixture.state.assessSecurity = async () => null;
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30)]);
  const security = fixture.observations.repromotionSnapshot!("2026-09-07T23:30:00.000Z").developments.runs[0]!.security!;
  assert.equal(security.history.mitigations.length, 1);
  assert.equal(security.history.mitigations[0]!.projection.quote.text, quote);
  assert.equal(security.developments[0]!.materialRevision, "initial-risk");
});

test("A real explicit-none baseline followed by a verified textual mitigation is a once-only sourced development despite unchanged structured risk fields", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  const noneQuote = "目前没有缓解措施。", newQuote = "关闭远程查询可以避免此风险。", effect = "关闭远程查询";
  fixture.state.advisories = [{ ...advisory(), description: noneQuote }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.publish("2026-09-06");
  fixture.state.assessSecurity = async (input) => {
    assert.equal(input.formatVersion, 2);
    assert.ok(input.previousMitigations);
    const isNone = input.evidence.description === noneQuote;
    const prior = input.previousMitigations.find((entry) => entry.projection.state.state === "explicit-none");
    if (!isNone) assert.ok(prior, "the complete input contains the actual earlier none, not inferred absence");
    return { schemaVersion: 1, formatVersion: 2, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-mitigation-v1",
      assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: isNone ? "same" : "new-material", previousDevelopmentId: input.previous[0]!.development.developmentId },
        change: isNone ? null : { category: "new-remediation", representation: "text-mitigation", beforeProjectionId: prior!.projection.projectionId,
          before: prior!.projection.state, after: { state: "measures", scope: input.evidence.vulnerabilities, assertion: "mentioned", measures: [{ effect }] }, basis: "none-to-measure" }, evidenceExcerpt: isNone ? "" : newQuote },
      mitigation: { conclusion: "supported", projection: isNone ? { state: "explicit-none", scopeIndexes: [0], quote: { start: 0, text: noneQuote } } :
        { state: "measures", scopeIndexes: [0], quote: { start: 0, text: newQuote }, assertion: "mentioned", measures: [{ effect }] },
        relation: { kind: "distinct", previousProjectionId: prior?.projection.projectionId ?? null } } };
  };
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  fixture.restart();
  fixture.state.advisories = [{ ...advisory(), description: newQuote }];
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 100, 20)]);
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual([...report.record.githubRepromotion.selectedNodeIds].sort(), ["fresh", "repeat"]);
  const development = report.record.githubRepromotion.reportedDevelopments[0]!;
  assert.equal(development.kind, "security");
  assert.ok("materialRevision" in development && development.materialRevision === "new-remediation");
  assert.ok(development.change && "representation" in development.change && development.change.representation === "text-mitigation");
  assert.match(report.canonicalMarkdown, /关闭远程查询/);
  const candidate = report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!;
  assert.equal(candidate.effectiveRecoveryMultiplier, 1);
  assert.ok(candidate.frequencyMultiplier < 1);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("Unknown initial mitigation never becomes an invented none, while a later real explicit-only baseline can support additional protection", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [{ ...advisory(), description: "缓解情况尚待确认。" }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.publish("2026-09-06");
  const baselineQuote = "仅可关闭查询缓解。", addedQuote = "关闭查询之外，还可隔离入口。";
  const baselineEffect = "关闭查询", addedEffect = "隔离入口";
  fixture.state.assessSecurity = async (input) => {
    assert.ok(input.previousMitigations);
    const prior = input.previousMitigations[0], first = input.evidence.description === baselineQuote;
    assert.equal(input.previousMitigations.length, first ? 0 : 1);
    const measures = first ? [{ effect: baselineEffect }] : [{ effect: baselineEffect }, { effect: addedEffect }];
    // Owned annotation v2: the A sentence is exhaustive; B merely mentions
    // an additional protection and does not claim these are the only options.
    const assertion = first ? "explicit-only" : "mentioned";
    return { schemaVersion: 1, formatVersion: 2, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-mitigation-v1",
      assessment: { observationId: input.evidence.observationId, conclusion: first ? "insufficient" : "supported",
        relation: { kind: first ? "unknown" : "new-material", previousDevelopmentId: first ? null : input.previous[0]!.development.developmentId },
        change: first ? null : { category: "new-remediation", representation: "text-mitigation", beforeProjectionId: prior!.projection.projectionId, before: prior!.projection.state,
          after: { state: "measures", scope: input.evidence.vulnerabilities, assertion, measures }, basis: "added-measure" }, evidenceExcerpt: first ? "" : addedQuote },
      mitigation: { conclusion: "supported", projection: { state: "measures", scopeIndexes: [0], quote: { start: 0, text: first ? baselineQuote : addedQuote }, assertion, measures },
        relation: { kind: "distinct", previousProjectionId: prior?.projection.projectionId ?? null } } };
  };
  fixture.state.advisories = [{ ...advisory(), description: baselineQuote }];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("fresh", 100, 20)]);
  const baseline = await fixture.publish("2026-09-07");
  if (baseline.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(baseline.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  assert.deepEqual(baseline.record.githubRepromotion.reportedDevelopments, []);
  fixture.restart();
  fixture.state.advisories = [{ ...advisory(), description: addedQuote }];
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30), repository("other", 100, 20)]);
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual([...report.record.githubRepromotion.selectedNodeIds].sort(), ["other", "repeat"]);
  const history = report.record.githubDevelopments.runs[0]!.security!.history;
  assert.equal(history.mitigations.length, 1);
  assert.equal(history.mitigations[0]!.projection.state.state, "measures");
  assert.equal(report.record.githubRepromotion.reportedDevelopments.length, 1);
  assert.match(report.canonicalMarkdown, /隔离入口/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A merely mentioned mitigation cannot justify an added-measure claim, while a later explicit replacement can use the actual earlier baseline", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  const oldQuote = "关闭查询可缓解风险。", newQuote = "隔离入口可替代关闭查询并阻断绕过。";
  fixture.state.advisories = [{ ...advisory(), description: oldQuote }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.publish("2026-09-06");
  let basis: "added-measure" | "replacement" = "added-measure";
  let replacementPriorCount = 0;
  fixture.state.assessSecurity = async (input) => {
    assert.ok(input.previousMitigations);
    const baseline = input.evidence.description === oldQuote;
    const before = input.previousMitigations.find((entry) => entry.projection.quote.text === oldQuote);
    const measures = [{ effect: baseline ? "关闭查询" : "隔离入口" }];
    if (!baseline) assert.ok(before);
    if (basis === "replacement") replacementPriorCount = input.previousMitigations.length;
    return { schemaVersion: 1, formatVersion: 2, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-mitigation-v1",
      assessment: { observationId: input.evidence.observationId, conclusion: baseline ? "insufficient" : "supported",
        relation: { kind: baseline ? "unknown" : "new-material", previousDevelopmentId: baseline ? null : input.previous[0]!.development.developmentId },
        change: baseline ? null : { category: "new-remediation", representation: "text-mitigation", beforeProjectionId: before!.projection.projectionId, before: before!.projection.state,
          after: { state: "measures", scope: input.evidence.vulnerabilities, assertion: "mentioned", measures }, basis }, evidenceExcerpt: baseline ? "" : newQuote },
      mitigation: { conclusion: "supported", projection: { state: "measures", scopeIndexes: [0], quote: { start: 0, text: baseline ? oldQuote : newQuote }, assertion: "mentioned", measures },
        relation: { kind: "distinct", previousProjectionId: before?.projection.projectionId ?? null } } };
  };
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  fixture.state.advisories = [{ ...advisory(), description: newQuote }];
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 100, 20)]);
  const rejected = await fixture.publish("2026-09-08");
  if (rejected.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(rejected.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  assert.deepEqual(rejected.record.githubRepromotion.reportedDevelopments, []);
  fixture.restart();
  basis = "replacement";
  await fixture.observe("2026-09-08T23:25:00.000Z", [repository("repeat", 190, 35), repository("other", 100, 20)]);
  const accepted = await fixture.publish("2026-09-09");
  if (accepted.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(replacementPriorCount, 2, "the rejected development did not erase the actual B projection or invent a new first observation");
  assert.deepEqual([...accepted.record.githubRepromotion.selectedNodeIds].sort(), ["other", "repeat"]);
  assert.equal(accepted.record.githubRepromotion.reportedDevelopments.length, 1);
  assert.match(accepted.canonicalMarkdown, /隔离入口/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(accepted.version.id, ownerToken), accepted);
});

test("Revoking an old mitigation source prevents its baseline from reaching a newly authorized source's verifier without inventing empty prior knowledge", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  const quote = "目前没有缓解措施。";
  fixture.state.advisories = [{ ...advisory(), description: quote }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  let calls = 0;
  fixture.state.assessSecurity = async (input) => { calls++; return { schemaVersion: 1, formatVersion: 2, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-mitigation-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "insufficient", relation: { kind: "unknown", previousDevelopmentId: null }, change: null, evidenceExcerpt: "" },
    mitigation: { conclusion: "supported", projection: { state: "explicit-none", scopeIndexes: [0], quote: { start: 0, text: quote } }, relation: { kind: "distinct", previousProjectionId: null } } }; };
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  assert.equal(calls, 1);
  const originalSource = structuredClone(fixture.state.source);
  fixture.state.additionalSources = [{ ...structuredClone(originalSource), github: { ...originalSource.github!, events: { ...originalSource.github!.events!, allowMaterialEvidenceProjection: false } } }];
  fixture.state.source = { ...structuredClone(originalSource), sourceId: "new-mitigation-source" };
  fixture.state.configuration = { ...fixture.state.configuration, sourceId: fixture.state.source.sourceId, version: 2 };
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, sourceId: fixture.state.source.sourceId, version: 2 };
  fixture.state.advisories = [{ ...advisory(), description: "关闭远程查询可以避免此风险。" }];
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 100, 20)]);
  assert.equal(calls, 1, "revoked old material never crosses the new source's model seam");
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-07T23:30:00.000Z");
  assert.deepEqual(snapshot.developments.runs[0]!.security!.history.unavailableNodeIds, ["repeat"]);
  assert.deepEqual(snapshot.developments.runs[0]!.security!.developments, []);
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("GHSA history, comparison input and retained previous material share the original source allowance before another revision can be accepted", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.source.citation.maxCharacters = 69;
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const oldQuote = "Old builds have a risk.", newQuote = "More builds have a risk.";
  assert.equal([...oldQuote].length, 23);
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-quote-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: input.previous[0]!.development.developmentId },
      change: { category: "range-expansion", before: input.previous[0]!.origin.evidence.vulnerabilities, after: input.evidence.vulnerabilities }, evidenceExcerpt: input.evidence.description } });
  fixture.state.advisories = [{ ...advisory(), description: oldQuote, vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0" }] }];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  assert.equal(fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z").developments.runs[0]!.security!.developments[0]!.evidenceExcerpt, oldQuote);
  fixture.state.advisories = [{ ...advisory(), description: newQuote, vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <3.0.0" }] }];
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30)]);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-07T23:30:00.000Z");
  const security = snapshot.developments.runs[0]!.security!;
  assert.equal(security.history.materials.length, 2);
  assert.equal(security.assessments[0]!.previous.length, 2);
  assert.equal(security.assessments[0]!.verification, null);
  assert.deepEqual(security.developments, []);
  assert.ok(snapshot.developments.reasons.includes("github-development-citation-limit"));
});

test("A citation-limited whole security history isolates only its repository and cannot hide a damaged original prefix from archive authentication", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.source.citation.maxCharacters = 69;
  fixture.state.developmentConfiguration.advisories = true;
  const releaseQuote = "The old APIs are removed.", securityQuote = "Old builds have a risk.";
  assert.equal([...releaseQuote].length, 25);
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: releaseQuote })) });
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)], [ownedRelease(101, releaseQuote)]);
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-quote-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: input.previous[0]!.development.developmentId },
      change: { category: "range-expansion", before: input.previous[0]!.origin.evidence.vulnerabilities, after: input.evidence.vulnerabilities }, evidenceExcerpt: securityQuote } });
  fixture.state.advisories = [{ ...advisory(), description: securityQuote, vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0" }] }];
  const original = await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("fresh", 100, 20)], []);
  assert.equal(fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z").developments.runs[0]!.security!.developments[0]!.evidenceExcerpt, securityQuote);
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, materiality: "routine", change: null, evidenceExcerpt: "" })) });
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 130, 25)], [ownedRelease(102)]);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-07T23:30:00.000Z");
  const security = snapshot.developments.runs[0]!.security!;
  assert.deepEqual(security.history.unavailableNodeIds, ["repeat"]);
  assert.deepEqual(security.history.entries, []);
  assert.deepEqual(security.history.materials, []);
  assert.deepEqual(security.assessments, []);
  assert.deepEqual(security.developments, []);
  assert.ok(snapshot.developments.reasons.includes("github-development-citation-limit"));
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
  const fault = new DatabaseSync(join(fixture.directory, "observations.sqlite"));
  const raw = fault.prepare("SELECT payload FROM runs WHERE slot=?").get(original.scheduledAtUtc)!.payload!;
  try {
    fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(JSON.stringify({ ...original, id: "0".repeat(64) }), original.scheduledAtUtc);
    assert.throws(() => fixture.observer.readReport(report.version.id, ownerToken), /not-found/);
  } finally { fault.prepare("UPDATE runs SET payload=? WHERE slot=?").run(raw, original.scheduledAtUtc); fault.close(); }
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("An exact GHSA material refresh uses the original source for its old excerpt even when the new description has different wording", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.source.citation.maxCharacters = 100;
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const quote = "Old builds have a risk.";
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-quote-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: input.previous[0]!.development.developmentId },
      change: { category: "range-expansion", before: input.previous[0]!.origin.evidence.vulnerabilities, after: input.evidence.vulnerabilities }, evidenceExcerpt: quote } });
  const expanded = { ...advisory(), description: quote, vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0" }] };
  fixture.state.advisories = [expanded];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  const original = fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z").developments.runs[0]!.security!.developments[0]!;
  assert.equal(original.evidenceExcerpt, quote);
  fixture.state.additionalSources = [structuredClone(fixture.state.source)];
  fixture.state.source = { ...structuredClone(fixture.state.source), sourceId: "owned-new-security", citation: { ...fixture.state.source.citation, maxCharacters: 1 } };
  fixture.state.configuration = { ...fixture.state.configuration, sourceId: fixture.state.source.sourceId, version: 2 };
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, sourceId: fixture.state.source.sourceId, version: 2 };
  fixture.state.advisories = [{ ...expanded, description: "This notice uses entirely different wording." }];
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30)]);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-07T23:30:00.000Z");
  assert.equal(snapshot.developments.runs[0]!.security!.developments[0]!.developmentId, original.developmentId);
  assert.equal(snapshot.developments.runs[0]!.security!.developments[0]!.evidenceExcerpt, quote);
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.developmentId, original.developmentId);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A single insufficient GHSA assessment may retain a complete non-BMP excerpt within its codepoint limit without granting a development", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const quote = `以下标识的版本尚需确认：${"🌍".repeat(300)}。`;
  assert.ok([...quote].length < 500 && quote.length > 500);
  fixture.state.advisories = [{ ...advisory(), description: quote, vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0" }] }];
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-quote-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "insufficient", relation: { kind: "unknown", previousDevelopmentId: null }, change: null, evidenceExcerpt: quote } });
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  const security = fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z").developments.runs[0]!.security!;
  assert.equal(security.assessments[0]!.verification?.assessment.evidenceExcerpt, quote);
  assert.deepEqual(security.developments, []);
});

test("Erasing a whole development run from a coherently rewritten report cannot hide the real current GHSA uncertainty and admit its repository", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [{ ...advisory(), vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: null }] }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20), repository("fresh", 100, 20)]);
  const original = await fixture.publish("2026-09-06");
  const altered = structuredClone(original);
  if (altered.record.schemaVersion !== 10 || altered.version.schemaVersion !== 9) throw new Error("Record10 required");
  assert.deepEqual(altered.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  altered.record.githubDevelopments.runs = []; altered.record.githubDevelopments.reasons = [];
  delete altered.record.githubDevelopments.publicationProjection;
  altered.record.coverageGaps = [...altered.record.coverageGaps.filter((entry) => entry.edition !== "github-projects"), { edition: "github-projects", reason: "github-selection-insufficient" }];
  altered.record.githubRepromotion = rankGitHubRepromotions({ snapshot: { schemaVersion: 1, github: altered.record.github, developments: altered.record.githubDevelopments },
    interestProfile: altered.record.interestProfile, coverageHistory: altered.record.githubRanking.history, eventHistory: altered.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" });
  assert.ok(altered.record.githubRepromotion.selectedNodeIds.includes("repeat"));
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

test("Publication charging an exact old GHSA excerpt to its original source cannot revive the same repository through a separately affordable Release", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.source.citation.maxCharacters = 50;
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const quote = "More builds are at risk.";
  assert.ok([...quote].length * 2 <= 50 && [...quote].length * 4 > 50);
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-quote-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: input.previous[0]!.development.developmentId },
      change: { category: "range-expansion", before: input.previous[0]!.origin.evidence.vulnerabilities, after: input.evidence.vulnerabilities }, evidenceExcerpt: quote } });
  const expanded = { ...advisory(), description: quote, vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0" }] };
  fixture.state.advisories = [expanded];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)]);
  assert.equal(fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z").developments.runs[0]!.security!.developments.length, 1);
  fixture.state.additionalSources = [structuredClone(fixture.state.source)];
  fixture.state.source = { ...structuredClone(fixture.state.source), sourceId: "owned-new-security", citation: { ...fixture.state.source.citation, maxCharacters: 500 } };
  fixture.state.configuration = { ...fixture.state.configuration, sourceId: fixture.state.source.sourceId, version: 2 };
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, sourceId: fixture.state.source.sourceId, version: 2 };
  fixture.state.advisories = [{ ...expanded, description: "This notice uses entirely different wording." }];
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 100, 20)], [ownedRelease()]);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-07T23:30:00.000Z");
  assert.equal(snapshot.developments.runs[0]!.developments.length, 1);
  assert.equal(snapshot.developments.runs[0]!.security!.developments[0]!.evidenceExcerpt, quote);
  const report = await fixture.publish("2026-09-08");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubDevelopments.publicationProjection?.omissions, [{ nodeId: "repeat", kind: "security" }]);
  assert.equal(report.record.githubDevelopments.runs[0]!.developments.length, 1);
  assert.deepEqual(report.record.githubDevelopments.runs[0]!.security!.history.unavailableNodeIds, ["repeat"]);
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A genuine disabled event configuration at publication remains distinguishable from tampering when an older same-slot event run exists", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [{ ...advisory(), vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: null }] }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20), repository("fresh", 100, 20)]);
  const original = fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z");
  assert.equal(original.developments.runs.length, 1);
  fixture.restart(false);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(report.record.githubDevelopments.configuration, null);
  assert.deepEqual(report.record.githubDevelopments.runs, []);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
  assert.deepEqual(fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z"), original);
});

test("Erasing both frozen event configuration and its whole run cannot turn a genuinely quarantined repository into ordinary eligible history", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [{ ...advisory(), vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: null }] }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20), repository("fresh", 100, 20)]);
  const original = await fixture.publish("2026-09-06");
  const altered = structuredClone(original);
  if (altered.record.schemaVersion !== 10 || altered.version.schemaVersion !== 9) throw new Error("Record10 required");
  assert.deepEqual(altered.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  altered.record.githubDevelopments.configuration = null;
  altered.record.githubDevelopments.configurationSha256 = null;
  altered.record.githubDevelopments.runs = [];
  altered.record.githubDevelopments.reasons = ["github-development-disabled"];
  delete altered.record.githubDevelopments.publicationProjection;
  altered.record.coverageGaps = [...altered.record.coverageGaps.filter((entry) => entry.edition !== "github-projects"), { edition: "github-projects", reason: "github-selection-insufficient" }];
  altered.record.githubRepromotion = rankGitHubRepromotions({ snapshot: { schemaVersion: 1, github: altered.record.github, developments: altered.record.githubDevelopments },
    interestProfile: altered.record.interestProfile, coverageHistory: altered.record.githubRanking.history, eventHistory: altered.record.githubRepromotion.eventHistory, algorithmVersion: "observer-github-repromotion-v1" });
  assert.ok(altered.record.githubRepromotion.selectedNodeIds.includes("repeat"));
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

test("An explicitly node-associated high GHSA is a sourced risk update, preserves the novel quota and remains identical after both stores restart", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  await fixture.observe("2026-09-03T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.observe("2026-09-04T23:25:00.000Z", [repository("repeat", 105, 21)]);
  await fixture.publish("2026-09-05", 8);
  await fixture.observe("2026-09-05T00:25:00.000Z", [repository("repeat", 105, 21), repository("novel", 100, 20)]);
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["repeat", "novel"]);
  assert.equal(report.record.githubRepromotion.reportedDevelopments.length, 1);
  assert.equal(report.record.githubRepromotion.reportedDevelopments[0]!.kind, "security");
  assert.equal(report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!.frequencyMultiplier, 0.8);
  assert.match(report.canonicalMarkdown, /风险更新/);
  assert.match(report.canonicalMarkdown, /owned-query-package/);
  assert.match(report.canonicalMarkdown, /&gt;=1\.0\.0 &lt;1\.2\.0/);
  assert.equal(report.record.githubDevelopments.runs[0]!.security!.evidence[0]!.vulnerabilities![0]!.vulnerable_version_range, ">=1.0.0 <1.2.0");
  assert.match(report.canonicalMarkdown, /不.*安装建议/);
  assert.doesNotMatch(JSON.stringify(report), /DO_NOT_RETAIN_THIS_FULL_DESCRIPTION/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(report.version.id, ownerToken), report);
});

test("A verified expansion of an already reported GHSA range is a new sourced risk development during cooling and survives archive replay", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const first = await fixture.publish("2026-09-06");
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const originalDevelopment = first.record.githubRepromotion.reportedDevelopments[0]!;
  assert.equal(originalDevelopment.kind, "security");
  const excerpt = "Versions from 1.2.0 up to 2.0.0 are also affected by this risk.";
  const expanded = { ...advisory(), updated_at: "2026-09-06T21:00:00Z", description: `${excerpt} DO_NOT_KEEP_EXPANDED_FULL_BODY`,
    vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0", first_patched_version: "2.0.0" }] };
  fixture.state.assessSecurity = async (input) => {
    assert.equal(input.previous.length, 1);
    assert.equal(input.previous[0]!.development.developmentId, originalDevelopment.developmentId);
    assert.equal(input.previous[0]!.origin.evidence.vulnerabilities![0]!.vulnerable_version_range, ">=1.0.0 <1.2.0");
    return { schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-materiality-v1",
      assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: originalDevelopment.developmentId },
        change: { category: "range-expansion", before: advisory().vulnerabilities, after: expanded.vulnerabilities }, evidenceExcerpt: excerpt } };
  };
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 100, 20), repository("novel", 100, 20)]);
  fixture.state.advisories = [expanded];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)]);
  const second = await fixture.publish("2026-09-07");
  if (second.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(second.record.githubRepromotion.selectedNodeIds, ["repeat", "novel"]);
  const development = second.record.githubRepromotion.reportedDevelopments[0]!;
  assert.equal(development.kind, "security");
  assert.notEqual(development.developmentId, originalDevelopment.developmentId);
  assert.equal(development.eventId, originalDevelopment.eventId);
  assert.equal(second.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!.frequencyMultiplier, 0.8);
  assert.match(second.canonicalMarkdown, /&gt;=1\.0\.0 &lt;2\.0\.0/);
  assert.doesNotMatch(JSON.stringify(second), /DO_NOT_KEEP_EXPANDED_FULL_BODY/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(second.version.id, ownerToken), second);
});

test("A GHSA A to B to A return preserves both material origins and cannot consume the initially reported risk a second time", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const first = await fixture.publish("2026-09-06");
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const initial = first.record.githubRepromotion.reportedDevelopments[0]!;
  const expanded = { ...advisory(), description: "The vulnerable range now includes releases below 2.0.0.",
    vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0" }] };
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-materiality-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: initial.developmentId },
      change: { category: "range-expansion", before: advisory().vulnerabilities, after: expanded.vulnerabilities }, evidenceExcerpt: expanded.description } });
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 100, 20), repository("novel", 100, 20)]);
  fixture.state.advisories = [expanded];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)]);
  const second = await fixture.publish("2026-09-07");
  if (second.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(second.record.githubRepromotion.reportedDevelopments.length, 1);
  fixture.restart();
  await fixture.observe("2026-09-07T00:25:00.000Z", [repository("repeat", 130, 25), repository("fresh", 100, 20)]);
  fixture.state.advisories = [{ ...advisory(), updated_at: "2026-09-07T21:00:00Z" }];
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 108, 22)]);
  const third = await fixture.publish("2026-09-08");
  if (third.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.equal(third.record.githubDevelopments.runs[0]!.security!.history.materials.length, 2);
  assert.equal(third.record.githubDevelopments.runs[0]!.security!.developments[0]!.developmentId, initial.developmentId);
  assert.deepEqual(third.record.githubRepromotion.reportedDevelopments, []);
  assert.deepEqual(third.record.githubRepromotion.selectedNodeIds, ["fresh"]);
  assert.deepEqual(fixture.observer.readReport(third.version.id, ownerToken), third);
});

test("A verified newly affected package in a known GHSA is a distinct risk development, not another initial-risk report", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const first = await fixture.publish("2026-09-06");
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const initial = first.record.githubRepromotion.reportedDevelopments[0]!;
  const expanded = { ...advisory(), description: "The separate owned-admin package is also affected by this vulnerability.",
    vulnerabilities: [...advisory().vulnerabilities, { ...advisory().vulnerabilities[0]!, package: { ecosystem: "npm", name: "owned-admin" } }] };
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-materiality-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: initial.developmentId },
      change: { category: "new-package", before: advisory().vulnerabilities, after: input.evidence.vulnerabilities }, evidenceExcerpt: expanded.description } });
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 100, 20), repository("novel", 100, 20)]);
  fixture.state.advisories = [expanded];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)]);
  const second = await fixture.publish("2026-09-07");
  if (second.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(second.record.githubRepromotion.selectedNodeIds, ["repeat", "novel"]);
  const development = second.record.githubRepromotion.reportedDevelopments[0]!;
  if (development.kind !== "security") throw new Error("security required");
  assert.equal(development.materialRevision, "new-package");
  assert.notEqual(development.developmentId, initial.developmentId);
  assert.match(second.canonicalMarkdown, /owned-admin/);
  fixture.restart();
  assert.deepEqual(fixture.observer.readReport(second.version.id, ownerToken), second);
});

test("An explicitly verified high to critical GHSA escalation is a new development without treating a changed score or timestamp as severity", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const first = await fixture.publish("2026-09-06");
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const initial = first.record.githubRepromotion.reportedDevelopments[0]!;
  const escalated = { ...advisory(), severity: "critical", description: "The reviewed risk has been escalated from high to critical." };
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-materiality-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: initial.developmentId },
      change: { category: "severity-escalation", before: "high", after: "critical" }, evidenceExcerpt: escalated.description } });
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 100, 20), repository("novel", 100, 20)]);
  fixture.state.advisories = [escalated];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)]);
  const second = await fixture.publish("2026-09-07");
  if (second.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(second.record.githubRepromotion.selectedNodeIds, ["repeat", "novel"]);
  const development = second.record.githubRepromotion.reportedDevelopments[0]!;
  if (development.kind !== "security") throw new Error("security required");
  assert.equal(development.materialRevision, "severity-escalation");
  assert.notEqual(development.developmentId, initial.developmentId);
  assert.match(second.canonicalMarkdown, /critical/);
});

test("A newly disclosed verified patched version is reportable once with its actual prior unknown patch state", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  const before = { ...advisory(), vulnerabilities: [{ ...advisory().vulnerabilities[0]!, first_patched_version: null }] };
  fixture.state.advisories = [before];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const first = await fixture.publish("2026-09-06");
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const initial = first.record.githubRepromotion.reportedDevelopments[0]!;
  const fixed = { ...advisory(), description: "A patched owned-query-package version 1.2.0 is now available." };
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-materiality-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: initial.developmentId },
      change: { category: "new-remediation", before: before.vulnerabilities, after: fixed.vulnerabilities }, evidenceExcerpt: fixed.description } });
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 100, 20), repository("novel", 100, 20)]);
  fixture.state.advisories = [fixed];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)]);
  const second = await fixture.publish("2026-09-07");
  if (second.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(second.record.githubRepromotion.selectedNodeIds, ["repeat", "novel"]);
  const development = second.record.githubRepromotion.reportedDevelopments[0]!;
  if (development.kind !== "security") throw new Error("security required");
  assert.equal(development.materialRevision, "new-remediation");
  assert.match(second.canonicalMarkdown, /1\.2\.0/);
  fixture.restart();
  await fixture.observe("2026-09-07T00:25:00.000Z", [repository("repeat", 130, 25), repository("fresh", 100, 20)]);
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30), repository("fresh", 108, 22)]);
  const third = await fixture.publish("2026-09-08");
  if (third.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(third.record.githubRepromotion.reportedDevelopments, []);
  assert.deepEqual(third.record.githubRepromotion.selectedNodeIds, ["fresh"]);
});

test("A security verifier cannot authenticate a same-development relation to an identity absent from its complete historical input", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.publish("2026-09-06");
  const expanded = { ...advisory(), description: "An additional affected version range is under review.",
    vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0" }] };
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-materiality-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "same", previousDevelopmentId: "f".repeat(64) }, change: null, evidenceExcerpt: expanded.description } });
  await fixture.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 100, 20), repository("novel", 100, 20)]);
  fixture.state.advisories = [expanded];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)]);
  const report = await fixture.publish("2026-09-07");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["novel"]);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
  assert.equal(report.record.githubDevelopments.runs[0]!.security!.assessments[0]!.verification, null);
  assert.match(report.canonicalMarkdown, /github-advisory-revision-unconfirmed/);
});

test("Release and GHSA retained excerpts from one source share the codepoint budget rather than receiving separate per-adapter allowances", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)]);
  const first = await fixture.publish("2026-09-06");
  if (first.record.schemaVersion !== 10) throw new Error("Record10 required");
  const initial = first.record.githubRepromotion.reportedDevelopments[0]!;
  const prefix = "The legacy search endpoint is removed. ";
  const releaseQuote = prefix + "🚀".repeat(250 - [...prefix].length);
  fixture.state.assess = async (input) => ({ ...ownedAssessment(input), assessments: ownedAssessment(input).assessments.map((entry) => ({ ...entry, evidenceExcerpt: releaseQuote })) });
  const expanded = { ...advisory(), description: "More versions are affected by this risk.",
    vulnerabilities: [{ ...advisory().vulnerabilities[0]!, vulnerable_version_range: ">=1.0.0 <2.0.0" }] };
  fixture.state.assessSecurity = async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-security-materiality-v1",
    assessment: { observationId: input.evidence.observationId, conclusion: "supported", relation: { kind: "new-material", previousDevelopmentId: initial.developmentId },
      change: { category: "range-expansion", before: advisory().vulnerabilities, after: expanded.vulnerabilities }, evidenceExcerpt: expanded.description } });
  fixture.state.advisories = [expanded];
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25)], [ownedRelease(202, releaseQuote)]);
  const snapshot = fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z");
  assert.equal(snapshot.developments.runs[0]!.developments.length, 1);
  assert.equal(snapshot.developments.runs[0]!.security!.assessments[0]!.verification, null);
  assert.deepEqual(snapshot.developments.runs[0]!.security!.developments, []);
  assert.ok(snapshot.developments.reasons.includes("github-development-citation-limit"));
});

test("An associated high advisory with unknown affected versions isolates an otherwise eligible repository and discloses the risk uncertainty", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  await fixture.observe("2026-09-04T23:25:00.000Z", [repository("repeat", 100, 20), repository("novel", 100, 20)]);
  fixture.state.advisories = [{ ...advisory(), vulnerabilities: null }];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)]);
  const report = await fixture.publish("2026-09-06");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["novel"]);
  assert.equal(report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!.reason, "security-risk-quarantined");
  assert.match(report.canonicalMarkdown, /github-advisory-unknown/);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
});

test("A known GHSA missing from the incremental list must be refreshed and a failed refresh isolates the repository after ordinary cooling has expired", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  await fixture.observe("2026-09-04T23:25:00.000Z", [repository("repeat", 100, 20)]);
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 130, 25)]);
  await fixture.publish("2026-09-06");
  fixture.restart();
  fixture.state.advisories = [];
  fixture.state.httpStatuses["/advisories/GHSA-abcd-2345-efgh"] = 403;
  await fixture.observe("2026-10-13T23:25:00.000Z", [repository("repeat", 200, 40), repository("novel", 100, 20)]);
  await fixture.observe("2026-10-14T23:25:00.000Z", [repository("repeat", 230, 45), repository("novel", 108, 22)]);
  const report = await fixture.publish("2026-10-15");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["novel"]);
  assert.match(report.canonicalMarkdown, /github-advisory-refresh-failed/);
  assert.equal(report.record.githubRepromotion.candidates.find((entry) => entry.nodeId === "repeat")!.reason, "security-risk-quarantined");
});

test("Old-source security scope remains an authorized dependency when refresh yields no current evidence and a new source also reuses its Release history", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20)], [ownedRelease()]);
  const original = fixture.observations.repromotionSnapshot!("2026-09-05T23:30:00.000Z");
  assert.equal(original.developments.runs[0]!.security!.evidence.length, 1);
  assert.equal(original.developments.runs[0]!.developments.length, 1);
  const oldSource = fixture.state.source;
  fixture.state.source = { ...structuredClone(oldSource), sourceId: "replacement-material-source" };
  fixture.state.additionalSources = [oldSource];
  fixture.state.configuration = { ...fixture.state.configuration, sourceId: fixture.state.source.sourceId, version: 2 };
  fixture.state.developmentConfiguration = { ...fixture.state.developmentConfiguration, sourceId: fixture.state.source.sourceId, version: 2 };
  fixture.state.advisories = [];
  fixture.state.httpStatuses[`/advisories/${advisory().ghsa_id}`] = 403;
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)], [ownedRelease(202)]);
  const before = fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z");
  assert.equal(before.developments.runs[0]!.security!.evidence.length, 0);
  assert.equal(before.developments.runs[0]!.security!.history.entries[0]!.evidence.policy.sourceId, oldSource.sourceId);
  assert.equal(before.developments.runs[0]!.assessments[0]!.previousEvidence[0]!.evidence.policy.sourceId, oldSource.sourceId);
  oldSource.github!.events!.allowAdvisoryBodyProcessing = false;
  assert.deepEqual(fixture.observations.repromotionSnapshot!("2026-09-06T23:30:00.000Z").developments.runs, []);
  const received: unknown[] = [];
  fixture.state.assess = async (input) => { received.push(input); return ownedAssessment(input); };
  await fixture.observe("2026-09-07T23:25:00.000Z", [repository("repeat", 160, 30)], [ownedRelease(303)]);
  assert.deepEqual(received, []);
});

test("A list and detail disagreement about the stable repository node isolates both associated projects instead of preferring the detail mapping", async (t) => {
  const fixture = await repromotionFixture(t);
  Object.assign(fixture.state.source.github!.events!, { allowAdvisoryMetadata: true, allowAdvisoryBodyProcessing: true });
  fixture.state.developmentConfiguration.advisories = true;
  fixture.state.advisories = [advisory()];
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 100, 20), repository("novel", 100, 20), repository("unrelated", 100, 20)]);
  fixture.state.advisoryDetails[advisory().ghsa_id] = { ...advisory(), source_code_location: "https://github.com/example/novel",
    repository_advisory_url: `https://api.github.com/repos/example/novel/security-advisories/${advisory().ghsa_id}` };
  await fixture.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 108, 22), repository("novel", 108, 22), repository("unrelated", 108, 22)]);
  const report = await fixture.publish("2026-09-07");
  if (report.record.schemaVersion !== 10) throw new Error("Record10 required");
  assert.deepEqual(report.record.githubRepromotion.selectedNodeIds, ["unrelated"]);
  assert.match(report.canonicalMarkdown, /github-advisory-list-detail-conflict/);
  assert.deepEqual(report.record.githubRepromotion.reportedDevelopments, []);
});
