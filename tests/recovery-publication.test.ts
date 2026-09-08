import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createObserver } from "../src/observer.ts";
import { createCollection, policyDigest } from "../src/collection.ts";
import { createProductionRuntime } from "../src/production-runtime.ts";
import { startPrivateServer } from "../src/http.ts";
import { editionNames, type ProduceRequest } from "../src/contracts.ts";
import type { VerificationInput } from "../src/gate-contracts.ts";
import { revisionWindowOpen } from "../src/brief-recovery.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { request, successfulResult, ownerToken } from "./fixtures.ts";

test("scheduled recovery publishes safe links, inherits completed research into readable revisions, and closes noon", async () => {
  const directory = mkdtempSync(join(tmpdir(), "observer-recovery-"));
  let now = "2026-09-04T23:40:00.000Z", available = false;
  const source = { ...policy(), edition: "world-affairs" as const };
  const calls: string[] = [];
  const routing = { configuration: { schemaVersion: 1, version: 1, primary: "codex" }, clock: () => now,
    eligibility: () => available ? [{ version: 1, provider: "codex", enabled: true, accountEligible: true, regionEligible: true, scope: "protocol-fixture", checkedAtUtc: "2026-09-04T23:30:00.000Z", validUntilUtc: "2026-09-06T00:00:00.000Z", evidenceReference: "local-check" }] : [],
    providers: { codex: { editions: Object.fromEntries(["world-affairs", "ai"].map((edition) => [edition, { run: async (input: ProduceRequest) => {
      calls.push(edition);
      return { ...successfulResult(), taskId: input.taskId, evidenceBundleId: input.evidenceBundle.id, configurationId: input.configurationId, provider: "codex", model: "gpt-5.6-sol", startedAtUtc: now, finishedAtUtc: now,
        execution: { provenance: "protocol-fixture", processKind: "protocol-fixture", modelTransport: "model-protocol-fixture", cliVersion: "0.153.4", durationMs: 1, exitCode: 0, terminal: "completed", containerId: null, cleanup: "not-created" },
        stories: [{ schemaVersion: 2, id: `story-${edition}`, eventClusterId: `event-${edition}`, edition, title: "原始候选",
          claims: [{ id: "fact", kind: "fact", text: `${edition}观测记录已公开。`, evidenceIds: ["evidence-1"] }] }] };
    } }])), verifier: { verify: async (input: VerificationInput) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "recovery-local",
      assessments: input.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id, conclusion: "supported", reason: "supported-by-evidence", wording: "original",
        evidence: claim.evidenceIds.map((evidenceId) => ({ evidenceId, relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "local-observation" })),
        domain: { domains: [story.edition], risk: { level: "routine", categories: [] }, assertion: "event-fact", financialContent: "not-financial", numbers: { status: "none", statistics: [] }, materials: [{ evidenceId: "evidence-1", kind: "text" }], research: story.edition === "ai" ? [{ evidenceId: "evidence-1", role: "research-result", preprint: "no", officialRelease: "no", independentValidation: "unknown", peerReview: "unknown" }] : [] },
        event: { identity: { subject: story.edition, action: "published", object: "observation", discriminator: "local-recovery" }, primaryEdition: story.edition, materiality: "routine", materialityClaimIds: [], occurrenceEvidenceId: null, disclosureEvidenceId: "evidence-1", developmentEvidenceId: null, fact: story.edition },
      }))) }) } } } };
  const options = { databasePath: join(directory, "reports.sqlite"), ownerToken, mode: "test-fixture" as const, clock: () => now, sourcePolicies: [source], routing,
    schedule: { configuration: { enabled: true, startBusinessDate: "2026-09-05" }, runtimeConfiguration: {}, versions: { recovery: "local" } } };
  let observer = createObserver(options);
  observer.importInterestProfile(resolve("config/interest.example.v1.json"));
  const evidence = { ...request.evidenceBundle.evidence[0]!, sourceId: source.sourceId, policyVersion: 1, policySha256: policyDigest(source), expiresAtUtc: "2026-09-06T00:00:00.000Z", trust: "untrusted-source-data" };
  observer.freezeScheduled({ ...request, schemaVersion: 10, evidenceBundle: { ...request.evidenceBundle, schemaVersion: 2, evidence: [evidence], coverageGaps: [] },
    editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: ["world-affairs", "ai"].includes(edition) ? ["evidence-1"] : [] })) });
  let server = await startPrivateServer(observer);
  const read = async (id: string) => {
    const response = await fetch(`http://127.0.0.1:${server.port}/v1/reports/${id}`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(response.status, 200);
    return response.json() as Promise<{ canonicalMarkdown: string; version: { previousVersionId: string; content: string } }>;
  };
  try {
    await observer.runScheduled("2026-09-05");
    observer.markScheduledReadable("2026-09-05-v1", ownerToken);
    const first = await read("2026-09-05-v1");
    assert.equal(first.version.content, "links-only");
    assert.match(first.canonicalMarkdown, /来源链接/);
    assert.doesNotMatch(first.canonicalMarkdown, /新增 12 个观测点/);
    await server.close(); observer.close();
    observer = createObserver(options); server = await startPrivateServer(observer);
    available = true; now = "2026-09-05T01:00:00.000Z";
    await observer.runScheduled("2026-09-05");
    observer.markScheduledReadable("2026-09-05-v2", ownerToken);
    const second = await read("2026-09-05-v2");
    assert.equal(second.version.previousVersionId, "2026-09-05-v1");
    assert.match(second.canonicalMarkdown, /world-affairs观测记录已公开/);
    assert.match(second.canonicalMarkdown, /ai观测记录已公开/);
    assert.equal((await read("2026-09-05-v1")).canonicalMarkdown, first.canonicalMarkdown);
    now = "2026-09-05T01:10:00.000Z";
    await assert.rejects(observer.runScheduled("2026-09-05"), /completion-no-new-content/);
    assert.deepEqual(calls, ["world-affairs", "ai"]);
    assert.equal(observer.pendingDeliveries(ownerToken).length, 2);
    now = "2026-09-05T04:00:00.000Z";
    observer.pendingScheduled();
    assert.equal(observer.scheduledStatus("2026-09-05")?.state, "readable");
    assert.equal(observer.scheduledStatus("2026-09-05")?.recovery, "closed");
    assert.equal(revisionWindowOpen("correction", "2026-09-05", now), true);
    assert.equal(revisionWindowOpen("completion", "2026-09-05", now), false);
  } finally { await server.close(); observer.close(); }

  // Actual runtime assembly: start with no cache, then recover only pre-cutoff
  // disclosures; the source response is local and no Provider/network is invoked.
  const runtimePath = join(directory, "runtime.json"), sourcePath = join(directory, "sources.json");
  writeFileSync(sourcePath, JSON.stringify({ schemaVersion: 1, configurationId: "local", sources: [source] }));
  writeFileSync(runtimePath, JSON.stringify({ schemaVersion: 1, configurationId: "local", schedule: { enabled: true, startBusinessDate: "2026-09-06" },
    sourceConfigurationPath: sourcePath, interestProfilePath: resolve("config/interest.example.v1.json"), databasePath: join(directory, "runtime.sqlite"), collectionDatabasePath: join(directory, "cache.sqlite"),
    collect: false, routing: { schemaVersion: 1, version: 1, primary: "codex" }, providers: {} }));
  now = "2026-09-05T23:30:00.000Z";
  const runtime = createProductionRuntime(runtimePath, ownerToken, () => now);
  const collection = createCollection({ databasePath: join(directory, "cache.sqlite"), sources: [source], clock: () => now, read: async () => ({ status: 200, headers: {}, body:
    '<rss version="2.0"><channel><title>Local</title><item><title>Eligible disclosure</title><link>https://source.example/eligible</link><pubDate>2026-09-05T23:00:00Z</pubDate></item><item><title>New after cutoff</title><link>https://source.example/new</link><pubDate>2026-09-06T01:00:00Z</pubDate></item></channel></rss>' }) });
  const privateServer = await startPrivateServer(runtime.observer);
  const probe = async (id: string) => {
    const response = await fetch(`http://127.0.0.1:${privateServer.port}/v1/reports/${id}`, { headers: { Authorization: `Bearer ${ownerToken}` } });
    assert.equal(response.status, 200);
    const report = await response.json() as { canonicalMarkdown: string };
    assert.match(report.canonicalMarkdown, /Delayed Brief/);
    assert.match(report.canonicalMarkdown, /Eligible disclosure/);
    assert.doesNotMatch(report.canonicalMarkdown, /New after cutoff/);
  };
  try {
    await runtime.tick(probe);
    assert.equal(runtime.observer.scheduledStatus("2026-09-06")?.latestVersionId, null);
    now = "2026-09-06T02:00:00.000Z";
    await collection.collect(); await runtime.tick(probe);
    assert.equal(runtime.observer.scheduledStatus("2026-09-06")?.timing, "delayed");
    now = "2026-09-07T04:00:00.000Z";
    await runtime.tick(probe);
    assert.equal(runtime.observer.scheduledStatus("2026-09-07")?.state, "missed");
    assert.equal((await fetch(`http://127.0.0.1:${privateServer.port}/v1/briefs/2026-09-07`)).status, 401);
  } finally { await privateServer.close(); runtime.close(); collection.close(); }
});
