import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createObserver, type ObserverOptions } from "../src/observer.ts";
import { editionNames, type ProduceRequest, type AgentRunOptions } from "../src/contracts.ts";
import type { VerificationInput, SemanticVerifier } from "../src/gate-contracts.ts";
import { modelResponseFixture, usageResponseFixture } from "./helpers/model-responses.ts";
import { claudeMessageFixture } from "./helpers/claude-messages.ts";
import { clock, ownerToken, request, successfulResult } from "./fixtures.ts";
import { createGitHubObserver } from "../src/github-observations.ts";
import { createGitHubAdapter } from "../src/github-adapter.ts";
import { DatabaseSync } from "node:sqlite";
import { priorRoutedRecord } from "../src/routed-publication.ts";
import { githubRepromotionMarkdown } from "../src/github-repromotion.ts";
import { inputDigest } from "../src/publication-gate.ts";
import { createHash } from "node:crypto";
import { createCollection, type SourcePolicy } from "../src/collection.ts";
import { policy } from "./helpers/source-fixtures.ts";

const editions = Object.keys(editionNames) as (keyof typeof editionNames)[];
const assessment = (input: VerificationInput) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-routing-v1",
  assessments: input.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id, conclusion: "supported", reason: "supported-by-evidence", wording: "original",
    evidence: claim.evidenceIds.map((evidenceId) => ({ evidenceId, relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: `owned-${story.edition}-${evidenceId}` })),
    domain: { domains: [story.edition === "github-projects" || story.edition === "social-discourse" ? "world-affairs" : story.edition], risk: { level: "routine", categories: [] as string[] }, assertion: "event-fact", financialContent: story.edition === "finance" ? "informational" : "not-financial", numbers: { status: "none", statistics: [] }, materials: claim.evidenceIds.map((evidenceId) => ({ evidenceId, kind: "text" })),
      research: ["ai", "frontier-technology"].includes(story.edition) ? claim.evidenceIds.map((evidenceId) => ({ evidenceId, role: "research-result", preprint: "no", officialRelease: "no", independentValidation: "unknown", peerReview: "unknown" })) : [] },
    event: { identity: { subject: story.edition, action: "published", object: "observation", discriminator: "owned-2026-09-04" }, primaryEdition: story.edition, materiality: "routine", materialityClaimIds: [], occurrenceEvidenceId: null, disclosureEvidenceId: "evidence-1", developmentEvidenceId: null, fact: `owned-${story.edition}` },
  }))) });

async function fixture(t: TestContext, behavior: { primary?: "codex" | "claude"; failPrimary?: boolean; throwEdition?: string; disabled?: string[]; sources?: SourcePolicy[]; highRisk?: boolean; disagreement?: boolean; secondSource?: boolean; reversedReview?: boolean; unsafeProvider?: "codex" | "claude"; waitPrimaryMs?: number; neverSettle?: boolean; qualification?: (provider: string) => Record<string, unknown>; policyViolationEdition?: string; bindingAttack?: "task" | "provider" | "edition" | "evidence"; omitUsage?: boolean; transientOnce?: boolean; costUsd?: number; auditCapacity?: boolean; eligibilityRead?: () => void; modelSent?: () => void; omittedEdition?: string; semanticStarted?: (provider: string) => void; retainControl?: (control: NonNullable<AgentRunOptions["dispatchControl"]>) => void; waitVerifierEdition?: string; verifierDeferred?: Promise<void>; detachedModel?: () => Promise<unknown>; researchStarted?: () => void; modelRequests?: number; enforceTwoConcurrent?: boolean; deferred?: Promise<void>; cleanupFailedEdition?: string; limits?: Record<string, number> } = {}) {
  const directory = await mkdtemp(join(process.cwd(), "data", "v1-14-t1-"));
  const task = { ...structuredClone(request), schemaVersion: 10, taskId: "t".repeat(200), editions: editions.map((edition) => ({ edition, evidenceIds: ["social-discourse", "github-projects"].includes(edition) ? [] : ["evidence-1"] })) };
  if (behavior.secondSource) {
    task.evidenceBundle.evidence.push({ ...structuredClone(task.evidenceBundle.evidence[0]!), id: "evidence-2", sourceId: "owned-second-source", url: "https://second.example/observation" });
    for (const entry of task.editions) if (entry.evidenceIds.length) entry.evidenceIds.push("evidence-2");
  }
  const primary = behavior.primary ?? "codex";
  let activeExternal = 0;
  const providerCalls = new Map<string, number>();
  const routing = { configuration: { schemaVersion: 1, version: 1, primary, ...(behavior.limits ? { limits: behavior.limits } : {}) }, clock,
    eligibility: () => { behavior.eligibilityRead?.(); return ["codex", "claude"].map((provider) => ({ version: 1, provider, enabled: !behavior.disabled?.includes(provider), accountEligible: true, regionEligible: true, scope: "protocol-fixture", checkedAtUtc: "2026-09-04T23:30:00.000Z", validUntilUtc: "2026-09-06T00:00:00.000Z", evidenceReference: "owned-protocol-only", ...behavior.qualification?.(provider) })); },
    providers: Object.fromEntries(["codex", "claude"].map((provider) => [provider, {
      editions: Object.fromEntries(editions.map((edition) => [edition, { run: async (input: ProduceRequest, runOptions?: AgentRunOptions) => {
        behavior.researchStarted?.();
        const callKey = `${provider}:${edition}`;
        providerCalls.set(callKey, (providerCalls.get(callKey) ?? 0) + 1);
        if (runOptions?.dispatchControl) behavior.retainControl?.(runOptions.dispatchControl);
        if (behavior.detachedModel) {
          const modelAbort = new AbortController();
          assert.ok(runOptions?.dispatchControl);
          void runOptions.dispatchControl.dispatch(behavior.detachedModel, modelAbort.signal).catch(() => {});
          await new Promise((resolve) => setImmediate(resolve));
          modelAbort.abort();
        }
        if (behavior.modelRequests) for (let index = 0; index < behavior.modelRequests; index++) {
          assert.ok(runOptions?.dispatchControl);
          await runOptions.dispatchControl.dispatch(async () => { behavior.modelSent?.(); return { status: 200 }; }, runOptions.signal!);
        }
        if (behavior.enforceTwoConcurrent) {
          activeExternal++;
          try { if (activeExternal > (behavior.limits?.maxConcurrentProcesses ?? 2)) throw new Error("Owned external process capacity exceeded"); await new Promise((resolve) => setTimeout(resolve, 30)); }
          finally { activeExternal--; }
        }
        if (edition === behavior.throwEdition) throw new Error("PRIVATE_SOURCE_TEXT_MUST_NOT_APPEAR");
        if (behavior.neverSettle) await new Promise(() => {});
        if (behavior.deferred) await behavior.deferred;
        if (!behavior.failPrimary && !behavior.waitPrimaryMs && !behavior.detachedModel && !behavior.bindingAttack && !behavior.policyViolationEdition && !behavior.qualification) assert.equal(provider, primary, "Ordinary success does not dispatch a backup research task");
        if (behavior.waitPrimaryMs && provider === primary) await new Promise((resolve) => setTimeout(resolve, behavior.waitPrimaryMs));
        assert.ok(input.taskId.length <= 200); assert.match(input.taskId, /^route-[a-f0-9]{64}$/);
        const result = { ...successfulResult(), taskId: input.taskId, provider, model: provider === "codex" ? "gpt-5.6-sol" : "claude-sonnet-4-6",
          usage: { ...successfulResult().usage, ...(behavior.costUsd !== undefined ? { costUsd: behavior.costUsd } : {}) },
          execution: { provenance: "protocol-fixture", processKind: "protocol-fixture", modelTransport: "model-protocol-fixture", cliVersion: provider === "codex" ? "0.153.4" : "2.1.252", durationMs: 1, exitCode: 0, terminal: "completed", containerId: null, cleanup: "not-created" },
          stories: [{ schemaVersion: 2, id: `story-${edition}`, eventClusterId: `event-${edition}`, edition, title: "未核验标题", claims: [{ id: "fact", kind: "fact", text: `${editionNames[edition]}观测记录已公开。`, evidenceIds: input.evidenceBundle.evidence.map((entry) => entry.id) }] }] };
        if (behavior.auditCapacity && edition === "world-affairs") {
          result.stories = Array.from({ length: 20 }, (_, index) => ({ ...result.stories[0]!, id: "\u0001".repeat(196) + String(index).padStart(4, "0"),
            claims: Array.from({ length: 50 }, (_, claimIndex) => ({ ...result.stories[0]!.claims[0]!, id: "\u0001".repeat(196) + String(claimIndex).padStart(4, "0") })) }));
          assert.ok(Buffer.byteLength(JSON.stringify(input)) < 1024 * 1024);
          assert.ok(Buffer.byteLength(JSON.stringify(result)) < 2 * 1024 * 1024);
        }
        if (behavior.detachedModel || behavior.failPrimary && provider === primary || behavior.transientOnce && providerCalls.get(callKey) === 1) {
          const { stories: _stories, ...metadata } = result;
          return { ...metadata, status: "failed", failure: { category: "unavailable", retryable: false } };
        }
        if (behavior.cleanupFailedEdition === edition) {
          const { stories: _stories, ...metadata } = result;
          return { ...metadata, execution: { ...metadata.execution, cleanup: "unverified" }, status: "failed", failure: { category: "cleanup-failed", retryable: false } };
        }
        if (behavior.policyViolationEdition === edition && provider === primary) {
          const { stories: _stories, ...metadata } = result;
          return { ...metadata, status: "failed", failure: { category: "policy-violation", retryable: false } };
        }
        if (behavior.omitUsage) { const { usage: _usage, ...unknownUsageResult } = result; return unknownUsageResult; }
        if (behavior.bindingAttack && edition === "ai") {
          if (behavior.bindingAttack === "task") result.taskId = "foreign-task";
          if (behavior.bindingAttack === "provider") result.provider = provider === "codex" ? "claude" : "codex";
          if (behavior.bindingAttack === "edition") result.stories[0]!.edition = "finance";
          if (behavior.bindingAttack === "evidence") result.stories[0]!.claims[0]!.evidenceIds = ["foreign-evidence"];
        }
        return result;
      } }])), verifier: { verify: async (input: VerificationInput) => {
        if (behavior.auditCapacity) assert.ok(Buffer.byteLength(JSON.stringify(input)) < 1024 * 1024);
        behavior.semanticStarted?.(provider);
        if (behavior.waitVerifierEdition === input.stories[0]?.edition) await new Promise((resolve) => setTimeout(resolve, 1030));
        if (behavior.verifierDeferred) await behavior.verifierDeferred;
        const result = assessment(input);
        if (behavior.highRisk && input.stories[0]?.edition === "world-affairs") for (const entry of result.assessments) {
          entry.domain.risk = { level: "high", categories: ["armed-conflict"] };
          if (behavior.disagreement && provider !== primary) { entry.conclusion = "conflicting"; entry.reason = "source-conflict"; }
          if (behavior.reversedReview && provider !== primary) entry.evidence.reverse();
          if (behavior.unsafeProvider === provider) { entry.conclusion = "unsafe"; entry.reason = "unsafe-material"; }
        }
        if (behavior.auditCapacity) assert.ok(Buffer.byteLength(JSON.stringify(result)) < 2 * 1024 * 1024);
        return result;
      } },
    }])) };
  if (behavior.omittedEdition) for (const provider of Object.values(routing.providers)) delete provider.editions[behavior.omittedEdition];
  const github = createGitHubObserver({ databasePath: join(directory, "observations.sqlite"), configuration: () => ({ schemaVersion: 1, version: 1, sourceId: "not-enabled", queries: ["topic:owned"] }),
    policies: () => [], credential: () => null, clock, adapter: createGitHubAdapter({ read: async () => { throw new Error("No source is enabled"); } }) });
  t.after(() => github.close());
  const options = { databasePath: join(directory, "reports.sqlite"), ownerToken, mode: "test-fixture", clock, routing, github, sourcePolicyReader: () => behavior.sources ?? [] } as unknown as ObserverOptions;
  let observer = createObserver(options);
  let closed = false;
  t.after(() => { if (!closed) observer.close(); });
  const profile = join(directory, "profile.json");
  await writeFile(profile, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  observer.importInterestProfile(profile);
  return { task, directory, useVerifier(provider: "codex" | "claude", verifier: SemanticVerifier) { Object.assign(routing.providers[provider]!.verifier, verifier); }, get observer() { return observer; }, restart(readOnly = false) { observer.close(); closed = true; const { routing: _routing, ...readOptions } = options; observer = createObserver(readOnly ? readOptions : options); closed = false; } };
}

test("Four researched Editions and two explicit gaps are privately published with bounded identities and survive restart", async (t) => {
  const app = await fixture(t);
  const { task, observer } = app;
  const version = await observer.produce(task);
  const report = observer.readReport(version.id, ownerToken);
  assert.equal(report.record.schemaVersion, 11);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.equal(report.version.schemaVersion, 10);
  assert.equal(report.record.editions.length, 6);
  assert.equal(report.record.routing.attempts.filter((attempt) => attempt.role === "research").length, 4);
  assert.deepEqual(report.record.editionRuns.filter((entry) => entry.status === "no-evidence").map((entry) => entry.edition), ["social-discourse", "github-projects"]);
  assert.ok(report.record.routing.attempts.every((attempt) => attempt.provider === "codex"));
  assert.ok(report.record.stories.some((story) => story.edition === "world-affairs"));
  assert.match(report.canonicalMarkdown, /Today Overview/);
  assert.equal(report.canonicalMarkdown.includes("未核验标题"), false);
  const run = observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.status, "published");
  assert.equal(run.reportVersionId, version.id);
  assert.throws(() => observer.readRun(run.runId, "wrong"), /unauthorized/);
  assert.throws(() => observer.readReport(version.id, "wrong"), /unauthorized/);
  app.restart();
  assert.deepEqual(app.observer.readReport(version.id, ownerToken), report);
  assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
});

test("Either Provider can replace an unavailable primary without losing the completed Editions", async (t) => {
  for (const primary of ["codex", "claude"] as const) {
    const app = await fixture(t, { primary, failPrimary: true });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    assert.equal(report.record.stories.length, 4);
    const research = report.record.routing.attempts.filter((attempt) => attempt.role === "research");
    assert.equal(research.length, 8);
    assert.deepEqual(research.filter((attempt) => attempt.status === "failed").map((attempt) => attempt.reason), Array(4).fill("unavailable"));
    assert.ok(research.filter((attempt) => attempt.status === "succeeded").every((attempt) => attempt.provider !== primary));
    assert.ok(report.record.routing.attempts.filter((attempt) => attempt.role === "verification").every((attempt) => attempt.provider !== primary));
    app.restart(); assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
});

test("An Edition whose two Providers throw retains other completed Editions and safe failure decisions", async (t) => {
  const app = await fixture(t, { throwEdition: "ai" });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.deepEqual(new Set(report.record.stories.map((story) => story.edition)), new Set(["world-affairs", "finance", "frontier-technology"]));
  const failed = report.record.routing.attempts.filter((attempt) => attempt.edition === "ai");
  assert.deepEqual(failed.map((attempt) => [attempt.provider, attempt.status, attempt.reason]), [["codex", "failed", "unknown"], ["claude", "failed", "unknown"]]);
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(JSON.stringify(run).includes("PRIVATE_SOURCE_TEXT_MUST_NOT_APPEAR"), false);
  assert.match(report.canonicalMarkdown, /Coverage Gap/);
  app.restart(); assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("A failed produce exposes its authenticated run identity even when no Report exists", async (t) => {
  const app = await fixture(t);
  app.task.evidenceBundle.businessDate = "2026-09-06";
  let runId: string | undefined;
  await assert.rejects(app.observer.produce(app.task), (error: unknown) => {
    const failure = error as { code: string; runId?: string };
    assert.equal(failure.code, "invalid-bundle-identity");
    assert.match(failure.runId ?? "", /^run-/); runId = failure.runId; return true;
  });
  const run = app.observer.readRun(runId!, ownerToken);
  assert.equal(run.status, "failed"); assert.equal(run.reportVersionId, null);
  assert.equal(run.attempts.length, 0);
  assert.throws(() => app.observer.readReport("2026-09-05-v1", ownerToken), /not-found/);
  app.restart(); assert.deepEqual(app.observer.readRun(runId!, ownerToken), run);
});

test("A published Record freezes a ready routing receipt distinct from its terminal run", async (t) => {
  const app = await fixture(t);
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(report.record.routing.status, "ready");
  assert.equal(report.record.routing.reportVersionId, null);
  assert.equal(run.status, "published");
  assert.deepEqual({ ...run, status: "ready", reportVersionId: null }, report.record.routing);
});

test("Safe routing history remains privately readable after restart without enabling a Provider", async (t) => {
  const app = await fixture(t);
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  app.restart(true);
  assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("A substituted run identity is rejected by private audit and its linked Report", async (t) => {
  const app = await fixture(t);
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  const fault = new DatabaseSync(join(app.directory, "reports.sqlite"));
  const trigger = fault.prepare("SELECT sql FROM sqlite_master WHERE name='immutable_routing_terminal'").get()!.sql as string;
  try {
    fault.exec("DROP TRIGGER immutable_routing_terminal");
    fault.prepare("UPDATE routing_runs SET payload=? WHERE id=?").run(JSON.stringify({ ...run, runId: "run-substituted" }), run.runId);
    assert.throws(() => app.observer.readRun(run.runId, ownerToken), /routing-integrity/);
    assert.throws(() => app.observer.readReport(report.version.id, ownerToken), /routing-integrity/);
  } finally { fault.prepare("UPDATE routing_runs SET payload=? WHERE id=?").run(JSON.stringify(run), run.runId); fault.exec(trigger); fault.close(); }
});

test("Missing installed routing storage cannot be silently recreated on restart", async (t) => {
  const app = await fixture(t);
  await app.observer.produce(app.task);
  const fault = new DatabaseSync(join(app.directory, "reports.sqlite"));
  fault.exec("ALTER TABLE routing_runs RENAME TO routing_runs_preserved"); fault.close();
  assert.throws(() => app.restart(), /unsupported-routing-storage/);
});

test("Both disabled Providers make no attempts while collection availability remains explicit", async (t) => {
  const app = await fixture(t, { disabled: ["codex", "claude"] });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.equal(report.record.stories.length, 0);
  assert.equal(report.record.routing.attempts.length, 0);
  assert.equal(report.record.routing.collection.status, "available");
  assert.deepEqual(report.record.routing.collection.linkEvidenceIds, ["evidence-1"]);
  assert.equal(report.record.routing.outcome, "agents-unavailable-collection-available");
  assert.equal(report.record.routing.decisions.filter((entry) => entry.state === "provider-disabled").length, 8);
});

test("A routed publication cannot remove its routing receipt by downgrading to a coherent Record10", async (t) => {
  const app = await fixture(t);
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const record = priorRoutedRecord(report.record), canonicalMarkdown = githubRepromotionMarkdown(record);
  const downgrade = { record, canonicalMarkdown, version: { ...report.version, schemaVersion: 9, editorialContract: "observer-canonical-v8", reportRecordSha256: inputDigest(record), canonicalMarkdownSha256: createHash("sha256").update(canonicalMarkdown).digest("hex") } };
  const fault = new DatabaseSync(join(app.directory, "reports.sqlite"));
  fault.exec("DROP TRIGGER immutable_report_update");
  try {
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(downgrade), report.version.id);
    assert.throws(() => app.observer.readReport(report.version.id, ownerToken), /routing-integrity/);
  } finally {
    fault.prepare("UPDATE reports SET payload=? WHERE id=?").run(JSON.stringify(report), report.version.id);
    fault.exec("CREATE TRIGGER immutable_report_update BEFORE UPDATE ON reports BEGIN SELECT RAISE(ABORT, 'immutable report'); END"); fault.close();
  }
});

test("Collected model-forbidden material retains only currently distributable link eligibility", async (t) => {
  for (const revoke of [false, true]) {
    const source = policy(); source.model.enabled = false;
    const app = await fixture(t, { disabled: ["codex", "claude"], sources: [source] });
    const collection = createCollection({ databasePath: join(app.directory, "collection.sqlite"), sources: [source], clock: () => "2026-09-04T22:06:00.000Z", read: async () => ({ status: 200, headers: {},
      body: '<rss version="2.0"><channel><title>Owned</title><item><guid>owned</guid><title>Owned link</title><link>https://source.example/item</link><pubDate>Fri, 04 Sep 2026 22:00:00 GMT</pubDate><description>PRIVATE_MODEL_FORBIDDEN_TEXT</description></item></channel></rss>' }) });
    t.after(() => collection.close());
    assert.equal((await collection.collect()).added, 1);
    const evidenceBundle = collection.bundle({ businessDate: app.task.businessDate, configurationId: app.task.configurationId, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc }, "storage");
    const task = { ...app.task, evidenceBundle, editions: editions.map((edition) => ({ edition, evidenceIds: edition === "frontier-technology" ? evidenceBundle.evidence.map((item) => item.id) : [] })) };
    if (revoke) source.distribution.enabled = false;
    const report = app.observer.readReport((await app.observer.produce(task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    assert.deepEqual(report.record.routing.collection.linkEvidenceIds, revoke ? [] : evidenceBundle.evidence.map((entry) => entry.id));
    assert.equal(report.record.routing.collection.status, revoke ? "unavailable" : "available");
    assert.equal(report.record.routing.attempts.length, 0);
    assert.equal(JSON.stringify(report).includes("PRIVATE_MODEL_FORBIDDEN_TEXT"), false);
  }
});

test("High-risk claims receive conditional review but Provider agreement cannot supply independent sources", async (t) => {
  const app = await fixture(t, { highRisk: true });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.deepEqual(report.record.routing.attempts.filter((attempt) => attempt.role === "review").map((attempt) => [attempt.edition, attempt.provider]), [["world-affairs", "claude"]]);
  assert.equal(report.record.routing.reviews[0]?.outcome, "agreed");
  assert.equal(report.record.publicationGate.decisions.find((decision) => decision.storyId === "story-world-affairs")?.reason, "high-risk-independent-sources-required");
  assert.ok(!report.record.stories.some((story) => story.edition === "world-affairs"));
  assert.match(report.canonicalMarkdown, /待确认/);
});

test("Provider disagreement constrains the actual Gate despite a primary receipt that would otherwise publish", async (t) => {
  const app = await fixture(t, { highRisk: true, secondSource: true, disagreement: true });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.equal(report.record.routing.reviews[0]?.outcome, "disputed");
  const decision = report.record.publicationGate.decisions.find((entry) => entry.storyId === "story-world-affairs")!;
  assert.equal(decision.outcome, "unconfirmed");
  assert.equal(decision.reason, "provider-review-disagreement");
  assert.ok(!report.record.stories.some((story) => story.edition === "world-affairs"));
  assert.match(report.canonicalMarkdown, /待确认/);
  app.restart(); assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Single-Provider high-risk publication keeps strict evidence requirements and discloses unavailable comparison", async (t) => {
  const app = await fixture(t, { highRisk: true, secondSource: true, disabled: ["claude"] });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.equal(report.record.routing.reviews[0]?.outcome, "review-unavailable");
  assert.equal(report.record.publicationGate.decisions.find((decision) => decision.storyId === "story-world-affairs")?.outcome, "published");
  assert.match(report.canonicalMarkdown, /single-provider/);
  assert.match(report.canonicalMarkdown, /review-unavailable/);
  assert.equal(report.record.routing.attempts.filter((attempt) => attempt.role === "review").length, 0);
});

test("A semantically equal review with permuted Evidence preserves agreement and both original digests", async (t) => {
  const app = await fixture(t, { highRisk: true, secondSource: true, reversedReview: true });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const review = report.record.routing.reviews[0]!;
  assert.equal(review.outcome, "agreed");
  assert.notEqual(review.primaryAssessmentSha256, review.reviewAssessmentSha256);
  assert.equal(report.record.publicationGate.decisions.find((entry) => entry.storyId === "story-world-affairs")?.outcome, "published");
});

test("Unsafe judgments on either side remain quarantined even when the primary lacks corroboration", async (t) => {
  for (const scenario of [{ unsafeProvider: "codex", secondSource: true }, { unsafeProvider: "claude", secondSource: true }, { unsafeProvider: "claude", secondSource: false }] as const) {
    const app = await fixture(t, { highRisk: true, ...scenario });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    assert.equal(report.record.publicationGate.decisions.find((entry) => entry.storyId === "story-world-affairs")?.outcome, "quarantined");
    assert.ok(!report.record.publicationGate.unconfirmedItems.some((entry) => entry.storyId === "story-world-affairs"));
    assert.ok(!report.record.stories.some((entry) => entry.edition === "world-affairs"));
  }
});

test("Owner cancellation before dispatch leaves a discoverable failed run and no Provider attempt", async (t) => {
  const app = await fixture(t);
  const cancellation = new AbortController(); cancellation.abort();
  let runId = "";
  await assert.rejects(app.observer.produce(app.task, { signal: cancellation.signal }), (error: unknown) => {
    const failure = error as { code: string; runId: string }; runId = failure.runId;
    assert.equal(failure.code, "agent-cancelled"); return true;
  });
  const run = app.observer.readRun(runId, ownerToken);
  assert.equal(run.failureReason, "agent-cancelled"); assert.equal(run.attempts.length, 0);
  assert.equal(run.status, "failed");
});

test("A late primary result is rejected after its attempt deadline and the backup retains known usage", async (t) => {
  const app = await fixture(t, { waitPrimaryMs: 130, limits: { attemptTimeoutMs: 100 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.equal(report.record.stories.length, 4);
  const timedOut = report.record.routing.attempts.filter((attempt) => attempt.role === "research" && attempt.provider === "codex");
  assert.deepEqual(timedOut.map((attempt) => [attempt.status, attempt.reason]), Array(4).fill(["failed", "timeout"]));
  assert.ok(timedOut.every((attempt) => attempt.usage.inputTokens === 10 && attempt.usage.outputTokens === 20));
  assert.ok(report.record.editionRuns.filter((entry) => entry.status === "completed").every((entry) => entry.result.provider === "claude"));
});

test("An exhausted total deadline preserves all six gaps without dispatching another Provider", async (t) => {
  const app = await fixture(t, { waitPrimaryMs: 1030, limits: { attemptTimeoutMs: 3000, totalTimeoutMs: 1000 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.equal(report.record.stories.length, 0);
  assert.equal(report.record.editions.length, 6);
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.attempts.length, 1);
  assert.equal(run.attempts[0]?.reason, "total-deadline");
  assert.equal(run.attempts[0]?.usage.inputTokens, 10);
  assert.equal(run.outcome, "agents-unavailable-collection-available");
  assert.ok(run.decisions.some((entry) => entry.state === "deadline-exhausted"));
  app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
});

test("An unresponsive Provider leaves unknown cleanup and halts later execution in the same assembly", { timeout: 4000 }, async (t) => {
  const app = await fixture(t, { neverSettle: true, limits: { attemptTimeoutMs: 100, cleanupTimeoutMs: 100 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.attempts.length, 1);
  assert.equal(run.attempts[0]?.reason, "cleanup-unverified");
  assert.equal(run.attempts[0]?.usage.inputTokens, null);
  assert.equal(report.record.editions.length, 6);
  assert.equal(report.record.stories.length, 0);
  let laterId = "";
  await assert.rejects(app.observer.produce({ ...app.task, taskId: "after-unresponsive" }), (error: unknown) => {
    const failure = error as { code: string; runId: string };
    assert.equal(failure.code, "version-already-exists"); laterId = failure.runId; return true;
  });
  const later = app.observer.readRun(laterId, ownerToken);
  assert.equal(later.attempts.length, 0);
  assert.ok(later.decisions.some((entry) => entry.state === "cleanup-unverified"));
  assert.equal(app.observer.readRun(run.runId, ownerToken).attempts[0]?.reason, "cleanup-unverified");
});

test("A settled cleanup failure prevents any subsequent research or verification process", async (t) => {
  const app = await fixture(t, { cleanupFailedEdition: "ai" });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.deepEqual(run.attempts.map((entry) => [entry.edition, entry.role, entry.reason]), [
    ["world-affairs", "research", null], ["ai", "research", "cleanup-unverified"],
  ]);
  assert.equal(report.record.stories.length, 0);
  assert.equal(report.record.editions.length, 6);
  assert.ok(report.record.publicationGate.decisions.every((entry) => entry.outcome !== "published"));
});

test("A late resolved or rejected Provider cannot rewrite a frozen run or published gap", async (t) => {
  for (const rejectLate of [false, true]) {
    let settle!: () => void;
    const deferred = new Promise<void>((resolve, reject) => { settle = rejectLate ? () => reject(new Error("PRIVATE_LATE_ERROR")) : resolve; });
    const app = await fixture(t, { deferred, limits: { attemptTimeoutMs: 100, cleanupTimeoutMs: 100 } });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    assert.equal(run.attempts[0]?.reason, "cleanup-unverified");
    settle(); await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
    app.restart(true);
    assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  }
});

test("Concurrent produce calls share two process slots while each run retains its own successful attempts", async (t) => {
  const app = await fixture(t, { enforceTwoConcurrent: true });
  const outcomes = await Promise.allSettled([1, 2, 3].map((index) => app.observer.produce({ ...app.task, taskId: `parallel-${index}` })));
  for (const outcome of outcomes) {
    let runId: string;
    if (outcome.status === "fulfilled") {
      const report = app.observer.readReport(outcome.value.id, ownerToken);
      if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
      runId = report.record.routing.runId;
    } else { assert.equal(outcome.reason.code, "version-already-exists"); runId = outcome.reason.runId; }
    const run = app.observer.readRun(runId, ownerToken);
    assert.equal(run.attempts.filter((entry) => entry.role === "research").length, 4);
    assert.ok(run.attempts.every((entry) => entry.status === "succeeded"));
  }
});

test("Configured single-process capacity is shared across concurrent produce calls and recorded per run", async (t) => {
  const app = await fixture(t, { enforceTwoConcurrent: true, limits: { maxConcurrentProcesses: 1, maxConcurrentExternalRequests: 1 } });
  const outcomes = await Promise.allSettled([1, 2, 3].map((index) => app.observer.produce({ ...app.task, taskId: `single-slot-${index}` })));
  for (const outcome of outcomes) {
    let runId: string;
    if (outcome.status === "fulfilled") {
      const report = app.observer.readReport(outcome.value.id, ownerToken);
      if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
      assert.equal(report.record.stories.length, 4); runId = report.record.routing.runId;
    } else { assert.equal(outcome.reason.code, "version-already-exists"); runId = outcome.reason.runId; }
    const run = app.observer.readRun(runId, ownerToken);
    assert.equal(run.configuration.limits.maxConcurrentProcesses, 1);
    assert.equal(run.configuration.limits.maxConcurrentExternalRequests, 1);
    assert.equal(run.attempts.length, 8);
    assert.ok(run.attempts.every((entry) => entry.status === "succeeded"));
  }
});

test("Changing a bound assembly's pool limits fails before dispatch and leaves its earlier run unchanged", async (t) => {
  const limits = { maxConcurrentProcesses: 1, maxConcurrentExternalRequests: 1 };
  const app = await fixture(t, { limits });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const original = app.observer.readRun(report.record.routing.runId, ownerToken);
  limits.maxConcurrentProcesses = 4; limits.maxConcurrentExternalRequests = 4;
  let deniedId = "";
  await assert.rejects(app.observer.produce({ ...app.task, taskId: "changed-pool" }), (error: unknown) => {
    assert.ok(error instanceof Error && "runId" in error); deniedId = String(error.runId); return true;
  });
  const denied = app.observer.readRun(deniedId, ownerToken);
  assert.equal(denied.status, "failed");
  assert.equal(denied.attempts.length, 0);
  assert.equal(denied.externalRequests, 0);
  assert.match(denied.failureReason!, /assembly-configuration-changed/);
  assert.deepEqual(app.observer.readRun(original.runId, ownerToken), original);
});

test("Attempt and task request allowances count dispatched failures without refunding exhausted quota", async (t) => {
  const app = await fixture(t, { modelRequests: 5, limits: { maxExternalRequests: 5 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.externalRequests, 5);
  assert.deepEqual(run.attempts.map((entry) => entry.modelRequests), [4, 1]);
  assert.ok(run.attempts.every((entry) => entry.status === "failed"));
  assert.equal(report.record.stories.length, 0);
  assert.equal(report.record.editions.length, 6);
  assert.ok(run.decisions.some((entry) => entry.state === "request-budget-exhausted"));
  app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
});

test("Owner cancellation while queued is not relabelled as deadline exhaustion or published", async (t) => {
  let release!: () => void, notifyStarted!: () => void, started = 0;
  const deferred = new Promise<void>((resolve) => { release = resolve; });
  const busy = new Promise<void>((resolve) => { notifyStarted = resolve; });
  const app = await fixture(t, { deferred, researchStarted: () => { if (++started === 2) notifyStarted(); } });
  const running = Promise.allSettled([1, 2].map((index) => app.observer.produce({ ...app.task, taskId: `occupied-${index}` })));
  await busy;
  const cancellation = new AbortController();
  const queued = app.observer.produce({ ...app.task, taskId: "cancel-queued" }, { signal: cancellation.signal });
  const checked = assert.rejects(queued, (error: unknown) => {
    const failure = error as { code: string; runId: string };
    assert.equal(failure.code, "agent-cancelled");
    const run = app.observer.readRun(failure.runId, ownerToken);
    assert.equal(run.attempts.length, 0);
    assert.equal(run.status, "failed");
    assert.equal(run.failureReason, "agent-cancelled");
    assert.ok(!run.decisions.some((entry) => entry.state === "deadline-exhausted"));
    return true;
  });
  await new Promise((resolve) => setTimeout(resolve, 20)); cancellation.abort();
  try { await checked; } finally { release(); await running; }
});

test("Confirmed process completion cannot release still-pending external requests in the shared assembly", async (t) => {
  let settle!: () => void;
  const pending = new Promise<void>((resolve) => { settle = resolve; });
  const app = await fixture(t, { detachedModel: () => pending });
  try {
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    assert.equal(run.externalRequests, 2);
    assert.equal(run.attempts.length, 8);
    assert.equal(report.record.stories.length, 0);
    let secondId = "";
    await assert.rejects(app.observer.produce({ ...app.task, taskId: "pending-models" }), (error: unknown) => {
      const failure = error as { code: string; runId: string }; assert.equal(failure.code, "version-already-exists"); secondId = failure.runId; return true;
    });
    assert.equal(app.observer.readRun(secondId, ownerToken).externalRequests, 0);
    settle(); await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
    let thirdId = "";
    await assert.rejects(app.observer.produce({ ...app.task, taskId: "settled-models" }), (error: unknown) => {
      const failure = error as { code: string; runId: string }; assert.equal(failure.code, "version-already-exists"); thirdId = failure.runId; return true;
    });
    assert.equal(app.observer.readRun(thirdId, ownerToken).externalRequests, 8);
  } finally { settle(); }
});

test("Configured external slots retain exactly one or four pending requests independently of completed processes", async (t) => {
  for (const capacity of [1, 4]) {
    let settle!: () => void, sends = 0;
    const pending = new Promise<void>((resolve) => { settle = resolve; });
    const app = await fixture(t, { limits: { maxConcurrentExternalRequests: capacity }, detachedModel: () => { sends++; return pending; } });
    try {
      const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
      if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
      const run = app.observer.readRun(report.record.routing.runId, ownerToken);
      assert.equal(run.externalRequests, capacity); assert.equal(sends, capacity);
      assert.equal(run.attempts.length, 8);
      assert.ok(run.attempts.every((entry) => entry.status === "failed"));
      settle(); await new Promise((resolve) => setImmediate(resolve));
      assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
    } finally { settle(); }
  }
});

test("Unresponsive semantic verification is bounded and cannot start another verifier after unknown cleanup", { timeout: 4000 }, async (t) => {
  const app = await fixture(t, { verifierDeferred: new Promise(() => {}), limits: { attemptTimeoutMs: 100, cleanupTimeoutMs: 100 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.attempts.length, 5);
  assert.equal(run.attempts[4]?.role, "verification");
  assert.equal(run.attempts[4]?.reason, "cleanup-unverified");
  assert.equal(report.record.stories.length, 0);
  assert.equal(report.record.editions.length, 6);
  app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
});

test("Crossing the total deadline during verification prevents normal publication of earlier validated stories", async (t) => {
  const app = await fixture(t, { waitVerifierEdition: "ai", limits: { totalTimeoutMs: 1000, attemptTimeoutMs: 3000 } });
  let runId = "";
  await assert.rejects(app.observer.produce(app.task), (error: unknown) => {
    const failure = error as { code: string; runId: string }; assert.equal(failure.code, "routing-total-deadline"); runId = failure.runId; return true;
  });
  const run = app.observer.readRun(runId, ownerToken);
  assert.equal(run.status, "failed");
  assert.ok(run.attempts.some((entry) => entry.role === "verification" && entry.edition === "world-affairs" && entry.status === "succeeded"));
  assert.ok(run.attempts.some((entry) => entry.edition === "ai" && entry.reason === "total-deadline"));
  assert.throws(() => app.observer.readReport("2026-09-05-v1", ownerToken), /not-found/);
  app.restart(true); assert.deepEqual(app.observer.readRun(runId, ownerToken), run);
});

test("A retained host dispatch hook cannot start a request or rewrite a completed run", async (t) => {
  let control!: NonNullable<AgentRunOptions["dispatchControl"]>;
  const app = await fixture(t, { retainControl: (value) => { control = value; } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  await assert.rejects(control.dispatch(async () => "unexpected-dispatch", new AbortController().signal), /dispatch-forbidden/);
  assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("Owner cancellation during primary verification or conditional review remains a failed run without a Report", async (t) => {
  for (const cancelAt of ["codex", "claude"]) {
    const cancellation = new AbortController();
    const app = await fixture(t, { highRisk: true, secondSource: true, semanticStarted: (provider) => { if (provider === cancelAt) cancellation.abort(); } });
    let runId = "";
    await assert.rejects(app.observer.produce(app.task, { signal: cancellation.signal }), (error: unknown) => {
      const failure = error as { code: string; runId: string }; assert.equal(failure.code, "agent-cancelled"); runId = failure.runId; return true;
    });
    const run = app.observer.readRun(runId, ownerToken);
    assert.equal(run.failureReason, "agent-cancelled"); assert.equal(run.status, "failed");
    assert.ok(run.attempts.some((entry) => entry.provider === cancelAt && entry.reason === "cancelled"));
    assert.throws(() => app.observer.readReport("2026-09-05-v1", ownerToken), /not-found/);
  }
});

test("Unavailable Edition adapters leave a local gap without reserving leaked process slots", { timeout: 4000 }, async (t) => {
  const app = await fixture(t, { omittedEdition: "world-affairs" });
  for (let index = 0; index < 3; index++) {
    let runId = "";
    try {
      const report = app.observer.readReport((await app.observer.produce({ ...app.task, taskId: `missing-adapter-${index}` })).id, ownerToken);
      if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
      assert.equal(report.record.stories.length, 3); runId = report.record.routing.runId;
    } catch (error) {
      const failure = error as { code: string; runId: string }; assert.equal(failure.code, "version-already-exists"); runId = failure.runId;
    }
    const run = app.observer.readRun(runId, ownerToken);
    assert.equal(run.attempts.filter((entry) => entry.role === "research").length, 3);
    assert.ok(run.attempts.every((entry) => entry.status === "succeeded"));
    assert.equal(run.decisions.filter((entry) => entry.state === "runner-unavailable").length, 2);
  }
});

test("Every broker dispatch rechecks the actual SourcePolicy after an earlier model request", async (t) => {
  const source = policy();
  const app = await fixture(t, { sources: [source], modelRequests: 2, modelSent: () => { source.model.enabled = false; } });
  const collection = createCollection({ databasePath: join(app.directory, "collection.sqlite"), sources: [source], clock: () => "2026-09-04T22:06:00.000Z", read: async () => ({ status: 200, headers: {},
    body: '<rss version="2.0"><channel><title>Owned</title><item><guid>owned</guid><title>Owned</title><link>https://source.example/item</link><pubDate>Fri, 04 Sep 2026 22:00:00 GMT</pubDate><description>Owned observation</description></item></channel></rss>' }) });
  t.after(() => collection.close());
  assert.equal((await collection.collect()).added, 1);
  const evidenceBundle = collection.bundle({ businessDate: app.task.businessDate, configurationId: app.task.configurationId, windowStartUtc: app.task.evidenceBundle.windowStartUtc, cutoffUtc: app.task.evidenceBundle.cutoffUtc }, "storage");
  const task = { ...app.task, evidenceBundle, editions: editions.map((edition) => ({ edition, evidenceIds: edition === "frontier-technology" ? evidenceBundle.evidence.map((entry) => entry.id) : [] })) };
  let runId = "";
  await assert.rejects(app.observer.produce(task), (error: unknown) => { runId = (error as { runId: string }).runId; return true; });
  const run = app.observer.readRun(runId, ownerToken);
  assert.equal(run.externalRequests, 1);
  assert.equal(run.attempts[0]?.modelRequests, 1);
  assert.throws(() => app.observer.readReport("2026-09-05-v1", ownerToken), /not-found/);
});

test("A synchronous trusted eligibility failure after acquiring a slot does not leak either process permit", { timeout: 4000 }, async (t) => {
  let reads = 0, started = 0, release!: () => void, notify!: () => void;
  const deferred = new Promise<void>((resolve) => { release = resolve; });
  const busy = new Promise<void>((resolve) => { notify = resolve; });
  const app = await fixture(t, { deferred, eligibilityRead: () => { if (++reads === 2) throw new Error("Owned eligibility unavailable"); }, researchStarted: () => { if (++started === 2) notify(); } });
  await assert.rejects(app.observer.produce(app.task), /agent-unknown/);
  const running = Promise.allSettled([1, 2].map((index) => app.observer.produce({ ...app.task, taskId: `after-sync-failure-${index}` })));
  try {
    await Promise.race([busy, new Promise<void>((resolve) => t.signal.addEventListener("abort", () => resolve(), { once: true }))]);
    assert.equal(started, 2);
  } finally { release(); await running; }
});

test("A dispatched transport rejection consumes quota even though no model response was received", async (t) => {
  const app = await fixture(t, { modelRequests: 1, limits: { maxExternalRequests: 1 }, modelSent: () => { throw new Error("Owned connection failed"); } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.externalRequests, 1);
  assert.equal(run.attempts.length, 1);
  assert.equal(run.attempts[0]?.modelRequests, 1);
  assert.equal(run.attempts[0]?.status, "failed");
  assert.equal(run.attempts[0]?.usage.inputTokens, null);
  assert.equal(report.record.stories.length, 0);
});

test("Audit capacity: a reachable thousand-claim high-risk batch remains privately readable after publication and restart", async (t) => {
  const app = await fixture(t, { auditCapacity: true, highRisk: true, secondSource: true });
  const version = await app.observer.produce(app.task);
  const report = app.observer.readReport(version.id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.equal(report.record.routing.reviews.length, 1000);
  assert.ok(Buffer.byteLength(JSON.stringify(report.record.routing)) > 1024 * 1024);
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.reviews.length, 1000);
  app.restart(true);
  assert.deepEqual(app.observer.readReport(version.id, ownerToken), report);
  assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  console.log(JSON.stringify({ auditBytes: Buffer.byteLength(JSON.stringify(run)), peakRssKiB: process.resourceUsage().maxRSS }));
});

test("Audit budget: an insufficient review allowance leaves explicit claim decisions without blocking other Editions", async (t) => {
  const app = await fixture(t, { auditCapacity: true, highRisk: true, secondSource: true, limits: { maxAuditBytes: 512 * 1024 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.ok(Buffer.byteLength(JSON.stringify(run)) <= 512 * 1024);
  assert.equal(run.reviews.length, 0);
  assert.equal(run.attempts.filter((entry) => entry.edition === "world-affairs" && entry.role !== "research").length, 0);
  assert.equal(run.decisions.filter((entry) => entry.state === "audit-budget-exhausted").length, 2);
  assert.equal(report.record.publicationGate.decisions.filter((entry) => entry.storyId.startsWith("\u0001")).length, 1000);
  assert.equal(report.record.stories.length, 3);
  app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  console.log(JSON.stringify({ auditBytes: Buffer.byteLength(JSON.stringify(run)), peakRssKiB: process.resourceUsage().maxRSS }));
});

test("Research, primary verification and review process budgets leave explicit local terminal outcomes", async (t) => {
  const app = await fixture(t, { highRisk: true, secondSource: true, limits: { maxResearchAttempts: 2, maxVerificationAttempts: 1, maxReviewAttempts: 0 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.deepEqual(run.attempts.map((entry) => entry.role), ["research", "research", "verification"]);
  assert.equal(run.reviews[0]?.outcome, "review-unavailable");
  assert.ok(run.decisions.some((entry) => entry.state === "attempt-budget-exhausted"));
  assert.equal(report.record.stories.length, 1);
  assert.equal(report.record.stories[0]?.edition, "world-affairs");
  assert.equal(report.record.editions.length, 6);
});

test("Observed long-decimal and exponent costs remain unrounded safe accounting without a business cost cap", async (t) => {
  assert.equal(Buffer.byteLength(JSON.stringify(0.0000012345678901234567)), 24);
  assert.equal(Buffer.byteLength(JSON.stringify(Number.MAX_VALUE)), 23);
  for (const costUsd of [0.0000012345678901234567, Number.MAX_VALUE, 5e-324]) {
    const app = await fixture(t, { costUsd });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    assert.ok(run.attempts.filter((entry) => entry.role === "research").every((entry) => entry.usage.costUsd === costUsd));
    app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  }
});

test("A single unavailable retry is bounded per Provider and never returns from the backup to the primary", async (t) => {
  for (const primary of ["codex", "claude"] as const) for (const failPrimary of [false, true]) {
    const app = await fixture(t, { primary, failPrimary, transientOnce: true, limits: { sameProviderRetries: 1 } });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    const backup = primary === "codex" ? "claude" : "codex";
    for (const edition of ["world-affairs", "ai", "finance", "frontier-technology"]) {
      const research = run.attempts.filter((entry) => entry.edition === edition && entry.role === "research");
      assert.deepEqual(research.map((entry) => entry.provider), failPrimary ? [primary, primary, backup, backup] : [primary, primary]);
      assert.equal(research.at(-1)?.status, "succeeded");
    }
    assert.equal(report.record.stories.length, 4);
    assert.ok(run.decisions.some((entry) => entry.state === "provider-retry"));
  }
});

test("Observed token excess prevents later dispatch without pretending the already consumed tokens were blocked", async (t) => {
  const app = await fixture(t, { limits: { maxObservedTokens: 20 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.attempts.length, 1);
  assert.equal(run.usageProtection.observedTokens, "30");
  assert.equal(run.usageProtection.exceeded, true);
  assert.equal(run.usageProtection.unknownAttempts, 0);
  assert.ok(run.decisions.some((entry) => entry.state === "usage-budget-exhausted"));
  assert.equal(report.record.stories.length, 0);
  const unknown = await fixture(t, { omitUsage: true });
  const unknownReport = unknown.observer.readReport((await unknown.observer.produce(unknown.task)).id, ownerToken);
  if (unknownReport.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const unknownRun = unknown.observer.readRun(unknownReport.record.routing.runId, ownerToken);
  assert.equal(unknownRun.usageProtection.accounting, "incomplete");
  assert.equal(unknownRun.usageProtection.unknownAttempts, 8);
  assert.equal(unknownRun.usageProtection.exceeded, false);
  assert.ok(unknownRun.attempts.every((entry) => entry.usage.inputTokens === null && entry.usage.outputTokens === null));
});

test("Schema-valid foreign identities remain local failed attempts rather than cancelling other Editions", async (t) => {
  for (const bindingAttack of ["task", "provider", "edition", "evidence"] as const) {
    const app = await fixture(t, { bindingAttack });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    assert.equal(report.record.stories.length, 3);
    assert.ok(!report.record.stories.some((entry) => entry.edition === "ai"));
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    assert.deepEqual(run.attempts.filter((entry) => entry.edition === "ai").map((entry) => [entry.status, entry.reason]), [["failed", "invalid-output"], ["failed", "invalid-output"]]);
    assert.ok(run.attempts.every((entry) => entry.status !== "started"));
  }
});

test("A policy-violating Provider is isolated for remaining roles while the clean backup validates preserved research", async (t) => {
  const app = await fixture(t, { policyViolationEdition: "ai", limits: { sameProviderRetries: 1 } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(report.record.stories.length, 4);
  assert.deepEqual(run.attempts.filter((entry) => entry.provider === "codex").map((entry) => [entry.edition, entry.role, entry.reason]), [["world-affairs", "research", null], ["ai", "research", "policy-violation"]]);
  assert.ok(run.attempts.filter((entry) => entry.role !== "research").every((entry) => entry.provider === "claude"));
  assert.ok(run.decisions.some((entry) => entry.state === "provider-isolated"));
});

test("Isolation leaves high-risk backup verification explicitly single-Provider without revisiting the isolated primary", async (t) => {
  const app = await fixture(t, { policyViolationEdition: "ai", highRisk: true, secondSource: true });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.reviews[0]?.primaryProvider, "claude");
  assert.equal(run.reviews[0]?.outcome, "review-unavailable");
  assert.equal(run.reviews[0]?.reviewProvider, null);
  assert.equal(run.attempts.filter((entry) => entry.role === "review").length, 0);
  assert.match(report.canonicalMarkdown, /single-provider.*review-unavailable/);
});

test("Trusted account, region, expiry and in-flight revocation checks prevent dispatch or adoption and retain a qualified backup", async (t) => {
  for (const invalid of [{ enabled: false }, { accountEligible: false }, { regionEligible: false }, { validUntilUtc: "2026-09-04T23:35:00.000Z" }]) {
    const app = await fixture(t, { qualification: (provider) => provider === "codex" ? invalid : {} });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    assert.equal(report.record.stories.length, 4);
    assert.ok(report.record.routing.attempts.every((entry) => entry.provider === "claude"));
  }
  let revoked = false;
  const app = await fixture(t, { qualification: (provider) => provider === "codex" && revoked ? { version: 2, enabled: false } : {}, researchStarted: () => { revoked = true; } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const primary = report.record.routing.attempts.filter((entry) => entry.provider === "codex");
  assert.equal(primary.length, 1);
  assert.equal(primary[0]?.reason, "provider-ineligible");
  assert.equal(primary[0]?.status, "failed");
  assert.equal(report.record.stories.length, 4);
});

test("Safe qualification snapshots bind dispatched attempts and retain a later trusted revocation for private readers", async (t) => {
  let revoked = false;
  const app = await fixture(t, { qualification: (provider) => provider === "codex" && revoked ? { version: 2, enabled: false } : {}, researchStarted: () => { revoked = true; } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.deepEqual(run.qualifications.filter((entry) => entry.provider === "codex").map((entry) => [entry.version, entry.enabled]), [[1, true], [2, false]]);
  for (const attempt of run.attempts) {
    const grant = run.qualifications.find((entry) => entry.configurationSha256 === attempt.qualificationSha256);
    assert.equal(grant?.provider, attempt.provider);
    assert.equal(grant?.enabled, true);
    assert.equal(grant?.accountEligible, true);
    assert.equal(grant?.regionEligible, true);
    assert.equal(grant?.scope, "protocol-fixture");
    assert.equal(grant?.evidenceReference, "owned-protocol-only");
  }
  app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
});

test("The seventeenth distinct same-version qualification is retained only as denied evidence and stops the run", async (t) => {
  let reads = 0, sends = 0;
  const dispatchReads: number[] = [];
  const app = await fixture(t, { eligibilityRead: () => { reads++; }, qualification: () => ({ evidenceReference: `trusted-snapshot-${reads}`, enabled: reads !== 17 }), modelRequests: 4, modelSent: () => { sends++; dispatchReads.push(reads); } });
  let runId = "";
  await assert.rejects(app.observer.produce(app.task), (error: unknown) => {
    assert.ok(error instanceof Error && "runId" in error);
    runId = String(error.runId); return true;
  });
  const run = app.observer.readRun(runId, ownerToken);
  assert.equal(run.status, "failed");
  assert.equal(run.qualifications.length, 16);
  assert.equal(new Set(run.qualifications.map((entry) => entry.configurationSha256)).size, 16);
  assert.ok(run.qualifications.every((entry) => entry.version === 1));
  assert.equal(run.qualificationOverflow?.evidenceReference, "trusted-snapshot-17");
  assert.equal(run.qualificationOverflow?.enabled, false);
  assert.ok(run.attempts.every((entry) => entry.status !== "started"));
  assert.ok(run.attempts.every((entry) => entry.qualificationSha256 !== run.qualificationOverflow?.configurationSha256));
  assert.equal(run.externalRequests, sends);
  assert.ok(dispatchReads.every((read) => read < 17));
  assert.equal(reads, 17, "The overflow latch stops qualification lookup even though its next value would enable execution again");
  assert.equal(run.reportVersionId, null);
  app.restart(true); assert.deepEqual(app.observer.readRun(runId, ownerToken), run);
});

test("Schema-valid semantic receipts with missing, duplicate or foreign assessments never record verification success", async (t) => {
  for (const attack of ["missing", "duplicate", "foreign"] as const) {
    const app = await fixture(t);
    app.useVerifier("codex", { verify: async (input) => {
      const result = assessment(input);
      if (input.stories[0]?.edition === "world-affairs") {
        if (attack === "missing") result.assessments = [];
        else if (attack === "duplicate") result.assessments.push(structuredClone(result.assessments[0]!));
        else result.assessments[0]!.storyId = "foreign-story";
      }
      return result;
    } });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    assert.equal(report.record.stories.length, 3);
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    const invalid = run.attempts.find((entry) => entry.edition === "world-affairs" && entry.role === "verification");
    assert.equal(invalid?.status, "failed"); assert.equal(invalid?.reason, "invalid-output");
    assert.equal(invalid?.execution, null, "An Owned semantic receipt cannot self-assign actual CLI provenance");
    app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  }
});

test("Observed host response usage stops the next request before a semantic process returns its final receipt", async (t) => {
  let sends = 0;
  const app = await fixture(t, { limits: { maxObservedTokens: 150 } });
  app.useVerifier("codex", { verify: async (input, options) => {
    assert.ok(options?.dispatchControl);
    for (let request = 1; request <= 2; request++) await options.dispatchControl.dispatch(async () => {
      sends++;
      options.dispatchControl!.observeUsage?.(request, { inputTokens: 20, outputTokens: 20, cachedInputTokens: 0, cacheWriteInputTokens: 0, reasoningOutputTokens: 0, costUsd: null });
      return { status: 200 };
    }, options.signal!);
    return assessment(input);
  } });
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(sends, 1);
  assert.equal(run.usageProtection.observedTokens, "160");
  assert.equal(run.usageProtection.exceeded, true);
  const semantic = run.attempts.filter((entry) => entry.role === "verification");
  assert.equal(semantic.length, 1);
  assert.equal(semantic[0]?.reason, "usage-budget-exhausted");
  assert.equal(semantic[0]?.observedResponses[0]?.inputTokens, 20);
  assert.equal(report.record.stories.length, 0);
  app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
});

test("Host usage observations are dispatch-bound, idempotent, immutable and frozen after publication", async (t) => {
  for (const behavior of ["duplicate", "conflict", "unknown-to-known", "undispatched"] as const) {
    const app = await fixture(t);
    let retained: NonNullable<AgentRunOptions["dispatchControl"]> | undefined;
    const usage = { inputTokens: 20, outputTokens: 20, cachedInputTokens: 0, cacheWriteInputTokens: 0, reasoningOutputTokens: 0, costUsd: null };
    app.useVerifier("codex", { verify: async (input, options) => {
      assert.ok(options?.dispatchControl?.observeUsage); retained = options.dispatchControl;
      if (behavior === "undispatched") options.dispatchControl.observeUsage(1, usage);
      await options.dispatchControl.dispatch(async () => {
        options.dispatchControl!.observeUsage!(1, behavior === "unknown-to-known" ? { ...usage, inputTokens: null } : usage);
        options.dispatchControl!.observeUsage!(1, behavior === "conflict" ? { ...usage, inputTokens: 21 } : usage);
        return { status: 200 };
      }, options.signal!);
      return assessment(input);
    } });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    assert.equal(report.record.stories.length, behavior === "duplicate" ? 4 : 0);
    assert.equal(run.usageProtection.observedTokens, behavior === "undispatched" ? "120" : behavior === "unknown-to-known" ? "200" : "280");
    for (const attempt of run.attempts.filter((entry) => entry.role === "verification")) {
      assert.equal(attempt.modelRequests, behavior === "undispatched" ? 0 : 1);
      assert.equal(attempt.observedResponses.length, behavior === "undispatched" ? 0 : 1);
      if (behavior !== "undispatched") assert.equal(attempt.observedResponses[0]?.inputTokens, behavior === "unknown-to-known" ? null : 20);
      assert.equal(attempt.reason, behavior === "duplicate" ? null : behavior === "undispatched" ? "invalid-usage-request" : "conflicting-usage-observation");
    }
    retained!.observeUsage!(1, { ...usage, inputTokens: 999 });
    assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
    app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  }
});

test("Terminal run storage cannot be overwritten and read-only restart does not rewrite a last-observed running receipt", async (t) => {
  const app = await fixture(t);
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  const original = app.observer.readRun(report.record.routing.runId, ownerToken);
  const orphan = { ...structuredClone(original), runId: "owned-last-observed-running", status: "running", reportVersionId: null, failureReason: null };
  const fault = new DatabaseSync(join(app.directory, "reports.sqlite"));
  try {
    // Deliberate storage fault attempt; the business oracle is the unchanged authenticated read.
    try { fault.prepare("UPDATE routing_runs SET payload=? WHERE id=?").run(JSON.stringify({ ...original, status: "running" }), original.runId); } catch { /* storage may reject the write */ }
    assert.deepEqual(app.observer.readRun(original.runId, ownerToken), original);
    // An Owned crash-boundary snapshot, not a claim that a real process was killed or cleaned.
    fault.prepare("INSERT INTO routing_runs(id,payload) VALUES (?,?)").run(orphan.runId, JSON.stringify(orphan));
  } finally { fault.close(); }
  const observed = app.observer.readRun(orphan.runId, ownerToken);
  assert.equal(observed.status, "running");
  app.restart(true);
  assert.deepEqual(app.observer.readRun(orphan.runId, ownerToken), observed);
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
});

test("CLI fixed Codex and Claude semantic execution publishes through the real Gate with host-bound execution receipts", async (t) => {
  const { createCodexVerifier, createClaudeVerifier } = await import("../src/semantic-verifiers.ts");
  for (const provider of ["codex", "claude"] as const) {
    const app = await fixture(t, { primary: provider });
    let current!: VerificationInput;
    const transport = { provenance: "model-protocol-fixture" as const, respond: async () => ({ status: 200, body: provider === "codex" ? modelResponseFixture(assessment(current)) : claudeMessageFixture([{ type: "tool_use", id: "semantic_fixture", name: "StructuredOutput", input: assessment(current) }]) }) };
    const verifier = provider === "codex" ? createCodexVerifier({ taskRoot: join(app.directory, "semantic"), model: "gpt-5.6-sol", transport,
      runtime: { kind: "codex-cli", image: "sha256:12226892754c245087a7285475dad50d58322e7b9d637ba40850370c37cc5024" } }) : createClaudeVerifier({ taskRoot: join(app.directory, "semantic"), model: "claude-sonnet-4-6", transport,
      runtime: { kind: "claude-cli", image: "sha256:0fce00145d59010131a2efebdcac36dd66ef1c8b388830e275fcdc096d720269" } });
    app.useVerifier(provider, { verify: async (input, options) => { current = input; return verifier.verify(input, options); } });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    assert.equal(report.record.stories.length, 4);
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    assert.equal(run.usageProtection.observedTokens, "252", "120 research plus 4 x 33 semantic tokens, not a second copy of the broker observations");
    const semantic = run.attempts.filter((entry) => entry.role === "verification");
    assert.equal(semantic.length, 4);
    for (const attempt of semantic) {
      assert.equal(attempt.status, "succeeded");
      assert.equal(attempt.execution?.cleanup, "removed");
      assert.equal(attempt.execution?.processKind, provider === "codex" ? "codex-cli" : "claude-cli");
      assert.equal(attempt.execution?.cliVersion, provider === "codex" ? "codex-cli 0.153.4" : "2.1.252 (Claude Code)");
      assert.match(attempt.execution?.containerId ?? "", /^[a-f0-9]{64}$/);
      assert.ok(attempt.modelRequests > 0);
      assert.ok(attempt.usage.inputTokens !== null);
      assert.equal(attempt.observedResponses.length, 1);
    }
    console.log(JSON.stringify({ provider, semantic: semantic.map(({ id, execution, usage, modelRequests }) => ({ id, execution, usage, modelRequests })) }));
    app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
    assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  }
});

test("CLI high-risk review uses the other fixed Provider for an independently evidenced Claim", async (t) => {
  const { createCodexVerifier, createClaudeVerifier } = await import("../src/semantic-verifiers.ts");
  const app = await fixture(t, { secondSource: true });
  for (const provider of ["codex", "claude"] as const) {
    let current!: VerificationInput;
    const transport = { provenance: "model-protocol-fixture" as const, respond: async () => {
      const result = assessment(current);
      if (current.stories[0]?.edition === "world-affairs") for (const entry of result.assessments) entry.domain.risk = { level: "high", categories: ["armed-conflict"] };
      return { status: 200, body: provider === "codex" ? modelResponseFixture(result) : claudeMessageFixture([{ type: "tool_use", id: "review_fixture", name: "StructuredOutput", input: result }]) };
    } };
    const verifier = provider === "codex" ? createCodexVerifier({ taskRoot: join(app.directory, "semantic"), model: "gpt-5.6-sol", transport,
      runtime: { kind: "codex-cli", image: "sha256:12226892754c245087a7285475dad50d58322e7b9d637ba40850370c37cc5024" } }) : createClaudeVerifier({ taskRoot: join(app.directory, "semantic"), model: "claude-sonnet-4-6", transport,
      runtime: { kind: "claude-cli", image: "sha256:0fce00145d59010131a2efebdcac36dd66ef1c8b388830e275fcdc096d720269" } });
    app.useVerifier(provider, { verify: async (input, options) => { current = input; return verifier.verify(input, options); } });
  }
  const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
  assert.equal(report.record.stories.length, 4);
  const run = app.observer.readRun(report.record.routing.runId, ownerToken);
  assert.equal(run.reviews.length, 1); assert.equal(run.reviews[0]?.outcome, "agreed");
  assert.equal(run.reviews[0]?.primaryProvider, "codex"); assert.equal(run.reviews[0]?.reviewProvider, "claude");
  const review = run.attempts.filter((entry) => entry.role === "review");
  assert.equal(review.length, 1); assert.equal(review[0]?.status, "succeeded");
  assert.equal(review[0]?.execution?.processKind, "claude-cli"); assert.equal(review[0]?.execution?.cleanup, "removed");
  assert.equal(run.usageProtection.observedTokens, "285");
  console.log(JSON.stringify({ semantic: run.attempts.filter((entry) => entry.role !== "research").map(({ id, execution, usage, modelRequests }) => ({ id, execution, usage, modelRequests })) }));
  app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
});

test("CLI malicious semantic tools isolate that Provider without discarding earlier checked Editions", async (t) => {
  const { createCodexVerifier, createClaudeVerifier } = await import("../src/semantic-verifiers.ts");
  for (const primary of ["codex", "claude"] as const) {
    const app = await fixture(t, { primary });
    let current!: VerificationInput;
    const transport = { provenance: "model-protocol-fixture" as const, respond: async () => {
      const malicious = current.stories[0]?.edition === "ai";
      return { status: 200, body: primary === "codex" ? malicious ? usageResponseFixture({ input_tokens: 12, output_tokens: 21, total_tokens: 33 }, true) : modelResponseFixture(assessment(current)) :
        claudeMessageFixture([{ type: "tool_use", id: "semantic_tool", name: malicious ? "exec_command" : "StructuredOutput", input: malicious ? { command: "MALICIOUS-TOOL-CANARY" } : assessment(current) }]) };
    } };
    const verifier = primary === "codex" ? createCodexVerifier({ taskRoot: join(app.directory, "semantic"), model: "gpt-5.6-sol", transport,
      runtime: { kind: "codex-cli", image: "sha256:12226892754c245087a7285475dad50d58322e7b9d637ba40850370c37cc5024" } }) : createClaudeVerifier({ taskRoot: join(app.directory, "semantic"), model: "claude-sonnet-4-6", transport,
      runtime: { kind: "claude-cli", image: "sha256:0fce00145d59010131a2efebdcac36dd66ef1c8b388830e275fcdc096d720269" } });
    app.useVerifier(primary, { verify: async (input, options) => { current = input; return verifier.verify(input, options); } });
    const report = app.observer.readReport((await app.observer.produce(app.task)).id, ownerToken);
    if (report.record.schemaVersion !== 11) assert.fail("Expected routed Record11");
    const run = app.observer.readRun(report.record.routing.runId, ownerToken);
    console.log(JSON.stringify({ primary, semantic: run.attempts.filter((entry) => entry.role !== "research").map(({ id, provider, reason, execution }) => ({ id, provider, reason, execution })) }));
    const semantic = run.attempts.filter((entry) => entry.role === "verification");
    assert.deepEqual(semantic.map((entry) => entry.provider), [primary, primary, primary === "codex" ? "claude" : "codex", primary === "codex" ? "claude" : "codex"]);
    assert.equal(semantic[1]?.reason, "policy-violation");
    assert.equal(semantic[1]?.status, "failed"); assert.equal(semantic[1]?.execution?.cleanup, "removed");
    assert.equal(report.record.stories.length, 3);
    assert.ok(report.record.stories.some((entry) => entry.edition === "world-affairs"));
    assert.doesNotMatch(JSON.stringify(report), /MALICIOUS-TOOL-CANARY/);
    app.restart(true); assert.deepEqual(app.observer.readRun(run.runId, ownerToken), run);
  }
});
