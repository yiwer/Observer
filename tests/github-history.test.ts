import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createObserver } from "../src/observer.ts";
import { editionNames } from "../src/contracts.ts";
import { request, ownerToken, successfulResult } from "./fixtures.ts";

test("Request7 carries ordinary event history through older Record7 and consecutive Record8 publications after restart", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-github-history-"));
  let cutoff = "2026-09-04T23:30:00.000Z";
  let fact = "一期观测网络已开放。";
  const options = { databasePath: join(directory, "reports.sqlite"), ownerToken, mode: "test-fixture" as const, clock: () => cutoff.replace("23:30", "23:40"),
    editionRunner: { run: async (input: import("../src/contracts.ts").SixEditionRequest) => ({ schemaVersion: 2, taskId: input.taskId, evidenceBundleId: input.evidenceBundle.id, configurationId: input.configurationId,
      editions: input.editions.map((entry) => entry.edition !== "world-affairs" ? { edition: entry.edition, status: "no-evidence" } : { edition: entry.edition, status: "completed", result: {
        ...successfulResult(), taskId: `${input.taskId}:${entry.edition}`, evidenceBundleId: input.evidenceBundle.id, startedAtUtc: cutoff.replace("23:30", "23:31"), finishedAtUtc: cutoff.replace("23:30", "23:32"),
        stories: [{ schemaVersion: 2, id: `news-${input.businessDate}`, eventClusterId: "untrusted", edition: entry.edition, title: "untrusted",
          claims: [{ id: "fact", kind: "fact", text: fact, evidenceIds: ["evidence-1"] }, { id: "importance", kind: "analysis", mode: "explanation", text: "扩建提升了持续观测的覆盖能力。", evidenceIds: ["evidence-1"] }] }] } }) }) },
    verifier: { verify: async (input: import("../src/gate-contracts.ts").VerificationInput) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-github-history",
      assessments: input.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id, conclusion: "supported", reason: "supported-by-evidence", wording: "original",
        evidence: [{ evidenceId: "evidence-1", relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "owned-observatory" }],
        domain: { domains: ["world-affairs"], risk: { level: "routine", categories: [] }, assertion: claim.kind === "fact" ? "event-fact" : "interpretation", financialContent: "not-financial", materials: [{ evidenceId: "evidence-1", kind: "text" }], numbers: { status: "none", statistics: [] } },
        ...(claim.kind === "fact" ? { event: { identity: { subject: "observatory", action: "expands", object: "network", discriminator: "owned-plan" }, fact,
          primaryEdition: "world-affairs", materiality: "material", materialityClaimIds: ["importance"], occurrenceEvidenceId: cutoff === "2026-09-04T23:30:00.000Z" ? "evidence-1" : null, disclosureEvidenceId: "evidence-1", developmentEvidenceId: "evidence-1" } } : {}),
      }))) }) } };
  let observer = createObserver(options); t.after(() => observer.close());
  const profile = join(directory, "profile.json");
  await writeFile(profile, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  observer.importInterestProfile(profile);
  const reports = [];
  for (const [index, text] of ["一期观测网络已开放。", "二期观测网络已开放。", "三期观测网络已开放。"].entries()) {
    const date = `2026-09-0${5 + index}`; cutoff = `2026-09-0${4 + index}T23:30:00.000Z`; fact = text;
    const publishedAtUtc = cutoff.replace("23:30", "22:00");
    const input = { ...request, schemaVersion: index === 0 ? 6 : 7, businessDate: date, taskId: `news-${date}`,
      evidenceBundle: { ...request.evidenceBundle, businessDate: date, cutoffUtc: cutoff, windowStartUtc: new Date(Date.parse(cutoff) - 86400000).toISOString(), evidence: [{ ...request.evidenceBundle.evidence[0]!,
        publishedAtUtc, eventTimeUtc: publishedAtUtc, discoveredAtUtc: publishedAtUtc, retrievedAtUtc: publishedAtUtc, content: text, contentSha256: createHash("sha256").update(text).digest("hex") }] },
      editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: edition === "world-affairs" ? ["evidence-1"] : [] })) };
    const report = observer.readReport((await observer.produce(input)).id, ownerToken); reports.push(report);
    observer.close(); observer = createObserver(options);
  }
  const last = reports[2]!;
  assert.equal(last.record.schemaVersion, 8);
  if (last.record.schemaVersion !== 8) throw new Error("Record8 required");
  assert.equal(last.record.eventClusters[0]?.previousCoverage?.versionId, "2026-09-06-v1");
  assert.equal(last.record.stories.length, 1);
  for (const report of reports) assert.equal(JSON.stringify(observer.readReport(report.version.id, ownerToken)), JSON.stringify(report));
});
