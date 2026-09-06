import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { createGitHubObserver } from "../../src/github-observations.ts";
import { createGitHubAdapter } from "../../src/github-adapter.ts";
import { createObserver } from "../../src/observer.ts";
import { editionNames } from "../../src/contracts.ts";
import { ownerToken } from "../fixtures.ts";
import { policy } from "./source-fixtures.ts";
import type { SourceReadRequest, SourceResponse } from "../../src/collection.ts";

export const repository = (nodeId = "R_fixture", stars = 100, forks = 20) => ({ node_id: nodeId, full_name: `example/${nodeId}`, private: false, visibility: "public", archived: false, disabled: false,
  fork: false, mirror_url: null as string | null, is_template: false, stargazers_count: stars, forks_count: forks, language: null as string | null, created_at: "2026-01-01T00:00:00Z" });
export async function githubFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "observer-github-slice-"));
  const source = { ...policy(), sourceId: "github-fixture", edition: "github-projects", feedUrl: "https://api.github.com",
    review: { ...policy().review, reviewedAtUtc: "2026-09-01T00:00:00.000Z" }, collection: { ...policy().collection, readBody: true }, model: { enabled: false, fields: [] },
    github: { allowedQueries: ["topic:owner-fixture"], allowApiResponseProcessing: true, allowRepositorySnapshots: true, allowIdentityHistory: true,
      allowDerivedPublication: true, irrevocableExportAllowed: true, deletionScope: "raw-only" } };
  const configuration = { schemaVersion: 1, version: 1, sourceId: source.sourceId, queries: ["topic:owner-fixture"] };
  const state = { now: "2026-09-03T23:25:00.000Z", repositories: [repository()] as unknown[], status: 200,
    hook: undefined as undefined | ((url: string, request: SourceReadRequest) => Promise<SourceResponse | undefined>), calls: [] as string[] };
  const credential = { kind: "fine-grained-pat", token: "github_pat_OWNED_FIXTURE_SECRET", expiresAtUtc: "2026-10-01T00:00:00.000Z", repositoryAccess: "public-only", permissions: "metadata-read-only" };
  const adapter = createGitHubAdapter({ read: async (url, request) => {
    state.calls.push(url);
    const override = await state.hook?.(url, request); if (override) return override;
    const path = new URL(url).pathname;
    return { status: state.status, headers: {}, body: JSON.stringify(path === "/search/repositories" ? { total_count: state.repositories.length, incomplete_results: false, items: state.repositories } :
      state.repositories.find((entry) => (entry as { full_name: string }).full_name === path.slice("/repos/".length))) };
  } });
  const storeOptions = { databasePath: join(directory, "observations.sqlite"), configuration: () => configuration, policies: () => [source], credential: () => credential, clock: () => state.now, adapter };
  let observations = createGitHubObserver(storeOptions);
  let observer = createObserver({ databasePath: join(directory, "reports.sqlite"), ownerToken, mode: "test-fixture", clock: () => state.now, sourcePolicyReader: () => [source], github: observations });
  t.after(() => { observer.close(); observations.close(); });
  const profile = join(directory, "profile.json");
  await writeFile(profile, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  observer.importInterestProfile(profile);
  const request = (cutoffUtc = "2026-09-04T23:30:00.000Z", businessDate = "2026-09-05") => ({ schemaVersion: 7, taskId: `github-${businessDate}`, businessDate, configurationId: "owned-config",
    evidenceBundle: { schemaVersion: 2, id: `owned-${businessDate}`, businessDate, configurationId: "owned-config", windowStartUtc: new Date(Date.parse(cutoffUtc) - 86400000).toISOString(), cutoffUtc, evidence: [], coverageGaps: [] },
    editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: [] })) });
  return { directory, source, configuration, credential, state, request, get observations() { return observations; }, get observer() { return observer; },
    restartStore(replacementAdapter?: ReturnType<typeof createGitHubAdapter>) { observations.close(); if (replacementAdapter) storeOptions.adapter = replacementAdapter; observations = createGitHubObserver(storeOptions); observer.close(); observer = createObserver({ databasePath: join(directory, "reports.sqlite"), ownerToken, mode: "test-fixture", clock: () => state.now, sourcePolicyReader: () => [source], github: observations }); },
    async publish(cutoffUtc = "2026-09-04T23:30:00.000Z", businessDate = "2026-09-05") {
      state.now = new Date(Date.parse(cutoffUtc) + 600000).toISOString();
      const report = observer.readReport((await observer.produce(request(cutoffUtc, businessDate))).id, ownerToken);
      if (report.record.schemaVersion !== 8) throw new Error("Record8 required");
      return { ...report, record: report.record };
    } };
}
