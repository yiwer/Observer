import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { editionNames, type AgentRunner } from "../src/contracts.ts";
import { type VerificationInput } from "../src/gate-contracts.ts";
import type { RoutingOptions } from "../src/provider-routing.ts";
import { createMastodonAdapter } from "../src/mastodon-adapter.ts";
import { policyDigest, type SourcePolicy } from "../src/collection.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { repository } from "./helpers/github-fixtures.ts";
import { repromotionFixture, publishFirstRelease } from "./helpers/repromotion-fixtures.ts";
import { ownerToken, successfulResult } from "./fixtures.ts";

test("Routed publication retains all six real Edition contracts and reads prior Record9 and Record10 history unchanged", async (t) => {
  let now = "2026-09-06T23:20:00.000Z";
  const news: SourcePolicy = { ...policy(), sourceId: "owned-news", edition: "world-affairs" };
  const social: SourcePolicy = { ...policy(), sourceId: "owned-social", edition: "social-discourse", collection: { ...policy().collection, readBody: true },
    social: { platform: "mastodon", allowedTags: ["observatory"], allowApiResponseProcessing: true, allowStatusKeys: true, allowAnonymousText: true, irrevocableExportAllowed: true, deletionScope: "raw-only" } };
  const configuration = { schemaVersion: 1, version: 1, groups: [{ id: "native", sourceId: social.sourceId, tag: "observatory", language: null, regionBasis: null, kind: "platform-native", linkedEvidenceIds: [] }] };
  const statuses = Array.from({ length: 12 }, (_, index) => ({ id: `owned-${index}`, created_at: index < 6 ? "2026-09-06T01:00:00.000Z" : "2026-09-06T22:00:00.000Z", edited_at: null,
    visibility: "public", sensitive: false, spoiler_text: "", content: `<p>新观点${index}：${index % 2 ? "公开误差有助于复核" : "观测覆盖需要持续改善"}。</p>`, language: "zh", media_attachments: [], card: null, poll: null, reblog: null, quote: null, in_reply_to_id: null, account: { display_name: "DO-NOT-EXPOSE-PROFILE" } }));
  const adapter = createMastodonAdapter({ clock: () => now, read: async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/v1/statuses/")) return { status: 200, headers: {}, body: JSON.stringify(statuses.find((entry) => entry.id === parsed.pathname.split("/").at(-1))) };
    const page = parsed.searchParams.has("max_id") ? [] : statuses;
    return { status: 200, body: JSON.stringify(page), headers: page.length ? { link: `<https://source.example/api/v1/timelines/tag/observatory?max_id=owned-11>; rel="next"` } : {} };
  } });
  const runner = (edition: keyof typeof editionNames): AgentRunner => ({ async run(input) {
    assert.notEqual(edition, "github-projects", "GitHub metadata is deterministic, never smuggled through ordinary Agent evidence");
    assert.doesNotMatch(JSON.stringify(input), /DO-NOT-EXPOSE-PROFILE/);
    return { ...successfulResult(), taskId: input.taskId, evidenceBundleId: input.evidenceBundle.id, configurationId: input.configurationId, provider: "codex", model: "gpt-5.6-sol", startedAtUtc: now, finishedAtUtc: now,
      execution: { provenance: "protocol-fixture", processKind: "protocol-fixture", modelTransport: "model-protocol-fixture", cliVersion: "codex-cli 0.153.4", durationMs: 1, exitCode: 0, terminal: "completed", containerId: null, cleanup: "not-created" },
      stories: [{ schemaVersion: 2, id: `owned-${edition}`, eventClusterId: edition === "social-discourse" ? "native" : `owned-${edition}`, edition, title: "未采纳标题",
        claims: [{ id: "fact", kind: edition === "social-discourse" ? "analysis" : "fact", ...(edition === "social-discourse" ? { mode: "explanation" } : {}), text: edition === "social-discourse" ? "样本中新出现对观测覆盖与公开误差的讨论。" : `${editionNames[edition]}观测记录已公开。`, evidenceIds: input.evidenceBundle.evidence.map((entry) => entry.id) }] }] };
  } });
  const verify = async (input: VerificationInput) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-six-routing",
    assessments: input.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id, conclusion: "supported", reason: "supported-by-evidence", wording: "original",
      evidence: claim.evidenceIds.map((evidenceId) => ({ evidenceId, relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: story.edition })),
      domain: { domains: [story.edition === "social-discourse" ? "other" : story.edition], risk: { level: "routine", categories: [] }, assertion: claim.kind === "analysis" ? "interpretation" : "event-fact", financialContent: story.edition === "finance" ? "informational" : "not-financial", numbers: { status: "none", statistics: [] }, materials: claim.evidenceIds.map((evidenceId) => ({ evidenceId, kind: "text" })),
        research: ["ai", "frontier-technology"].includes(story.edition) ? claim.evidenceIds.map((evidenceId) => ({ evidenceId, role: "research-result", preprint: "no", officialRelease: "no", independentValidation: "unknown", peerReview: "unknown" })) : [] },
      ...(story.edition === "social-discourse" ? { discourse: { scope: "sample-only", content: "emerging-topic", individualProfiling: false } } : { event: { identity: { subject: story.edition, action: "published", object: "observation", discriminator: "owned-2026-09-06" }, primaryEdition: story.edition, materiality: "routine", materialityClaimIds: [], occurrenceEvidenceId: null, disclosureEvidenceId: "news", developmentEvidenceId: null, fact: story.edition } }),
    }))) });
  const routing: RoutingOptions = { configuration: { schemaVersion: 1, version: 1, primary: "codex" }, clock: () => now,
    eligibility: () => ["codex", "claude"].map((provider) => ({ version: 1, provider, enabled: provider === "codex", accountEligible: true, regionEligible: true, scope: "protocol-fixture", checkedAtUtc: "2026-09-01T00:00:00.000Z", validUntilUtc: "2026-09-10T00:00:00.000Z", evidenceReference: "owned-six" })),
    providers: { codex: { editions: Object.fromEntries(Object.keys(editionNames).map((edition) => [edition, runner(edition as keyof typeof editionNames)])), verifier: { verify } } } };
  const app = await repromotionFixture(t, { directoryRoot: join(process.cwd(), "data"), observer: { routing, discourse: { configuration, adapter } } });
  const legacy10 = await publishFirstRelease(app);
  const legacy9 = app.observer.readReport("2026-09-05-v1", ownerToken);
  assert.equal(legacy9.record.schemaVersion, 9); assert.equal(legacy10.record.schemaVersion, 10);
  app.state.additionalSources.push(news, social);
  await app.observe("2026-09-06T00:25:00.000Z", [repository("repeat", 130, 25), repository("six-new", 100, 20)], []);
  await app.observe("2026-09-06T23:25:00.000Z", [repository("repeat", 140, 30), repository("six-new", 160, 35)], []);
  const windowStartUtc = "2026-09-05T23:30:00.000Z", cutoffUtc = "2026-09-06T23:30:00.000Z", businessDate = "2026-09-07";
  const snapshot = await adapter.capture({ sourcePolicy: social, configuration, groupId: "native", businessDate, windowStartUtc, cutoffUtc });
  now = "2026-09-06T23:40:00.000Z"; app.state.now = now;
  const content = "各栏目观测记录已公开。";
  const task = { schemaVersion: 10, taskId: "owned-six-routing", configurationId: "owned-six", businessDate, discourseSamples: [snapshot],
    evidenceBundle: { schemaVersion: 2, id: "owned-six", configurationId: "owned-six", businessDate, windowStartUtc, cutoffUtc, coverageGaps: [], evidence: [{ id: "news", sourceId: news.sourceId, sourceType: "primary", url: "https://source.example/observation", title: "观测记录", content, contentSha256: createHash("sha256").update(content).digest("hex"), discoveredAtUtc: "2026-09-06T22:00:00.000Z", retrievedAtUtc: "2026-09-06T22:00:00.000Z", publishedAtUtc: "2026-09-06T21:00:00.000Z", trust: "untrusted-source-data", policyVersion: news.version, policySha256: policyDigest(news), expiresAtUtc: "2026-09-07T22:00:00.000Z" }] },
    editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: ["social-discourse", "github-projects"].includes(edition) ? [] : ["news"] })) };
  const report = app.observer.readReport((await app.observer.produce(task)).id, ownerToken);
  if (report.record.schemaVersion !== 11) assert.fail("Expected Record11");
  assert.ok(report.record.editions.filter((entry) => !["social-discourse", "github-projects"].includes(entry.edition)).every((entry) => entry.storyIds.length > 0));
  assert.equal(report.record.discourse.observations.length, 1);
  assert.ok(report.record.githubRepromotion.selectedNodeIds.includes("six-new"));
  assert.match(report.canonicalMarkdown, /已核验 1 组样本观察/);
  assert.match(report.canonicalMarkdown, /six-new/);
  assert.deepEqual(report.record.routing.attempts.filter((entry) => entry.role === "research").map((entry) => entry.edition), ["world-affairs", "ai", "finance", "frontier-technology", "social-discourse"]);
  assert.equal(report.record.finalEditor.capabilities.network, false); assert.equal(report.record.finalEditor.capabilities.shell, false);
  assert.doesNotMatch(report.canonicalMarkdown, /DO-NOT-EXPOSE-PROFILE/);
  app.restart();
  assert.deepEqual(app.observer.readReport(report.version.id, ownerToken), report);
  assert.deepEqual(app.observer.readReport(legacy9.version.id, ownerToken), legacy9);
  assert.deepEqual(app.observer.readReport(legacy10.version.id, ownerToken), legacy10);
});
