import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createObserver } from "../src/observer.ts";
import { editionNames, type SixEditionRequest } from "../src/contracts.ts";
import { policy } from "./helpers/source-fixtures.ts";
import { ownerToken, request, successfulResult } from "./fixtures.ts";

test("Source classification changing during preparation cannot send newly classified GitHub material to an ordinary Research Agent", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "observer-github-authority-"));
  const source = { ...policy(), sourceId: "shifted-source" };
  const inputs: SixEditionRequest[] = [];
  const observer = createObserver({ databasePath: join(directory, "reports.sqlite"), ownerToken, mode: "test-fixture", clock: () => "2026-09-04T23:40:00.000Z",
    sourcePolicyReader: () => [source],
    editionRunner: { run: async (input) => { inputs.push(structuredClone(input)); return { schemaVersion: 2, taskId: input.taskId, evidenceBundleId: input.evidenceBundle.id, configurationId: input.configurationId,
      editions: input.editions.map((entry) => entry.edition !== "world-affairs" ? { edition: entry.edition, status: "no-evidence" } : { edition: entry.edition, status: "completed", result: {
        ...successfulResult(), taskId: `${input.taskId}:world-affairs`, stories: [{ schemaVersion: 2, id: "news", eventClusterId: "untrusted", edition: "world-affairs", title: "ignored",
          claims: [{ id: "fact", kind: "fact", text: "示例观测站发布了更新。", evidenceIds: ["evidence-1"] }] }] } }) }; } },
    verifier: { verify: async (input) => ({ schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-authority",
      assessments: input.stories.flatMap((story) => story.claims.map((claim) => ({ storyId: story.id, claimId: claim.id, conclusion: "supported", reason: "supported-by-evidence", wording: "original",
        evidence: [{ evidenceId: "evidence-1", relation: "supports", basis: "direct-observation", reliability: "reliable", upstreamOriginId: "owned" }],
        domain: { domains: ["world-affairs"], risk: { level: "routine", categories: [] }, assertion: "event-fact", financialContent: "not-financial", materials: [{ evidenceId: "evidence-1", kind: "text" }], numbers: { status: "none", statistics: [] } },
        event: { identity: { subject: "observatory", action: "published", object: "update", discriminator: "owned" }, fact: "update", primaryEdition: "world-affairs", materiality: "routine", materialityClaimIds: [], occurrenceEvidenceId: null, disclosureEvidenceId: "evidence-1", developmentEvidenceId: null },
      }))) }) } });
  t.after(() => observer.close());
  const profile = join(directory, "profile.json"); await writeFile(profile, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] })); observer.importInterestProfile(profile);
  const marker = "UNTRUSTED-GITHUB-BODY-MUST-NOT-REACH-MODEL";
  const input = { ...structuredClone(request), schemaVersion: 7, editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: edition === "world-affairs" ? ["evidence-1", "shifted"] : [] })) };
  input.evidenceBundle.evidence.push({ ...input.evidenceBundle.evidence[0]!, id: "shifted", sourceId: source.sourceId, content: marker, contentSha256: createHash("sha256").update(marker).digest("hex") });
  const pending = observer.produce(input);
  queueMicrotask(() => { source.edition = "github-projects"; });
  const report = observer.readReport((await pending).id, ownerToken);
  assert.equal(report.record.stories.length, 1);
  assert.ok(!JSON.stringify(inputs).includes(marker));
  assert.ok(!JSON.stringify(report).includes(marker));
  assert.match(report.canonicalMarkdown, /github-ordinary-candidate-unsupported/);
});
