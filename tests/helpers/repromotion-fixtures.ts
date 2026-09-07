import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { createGitHubObserver } from "../../src/github-observations.ts";
import { createGitHubAdapter } from "../../src/github-adapter.ts";
import { createObserver } from "../../src/observer.ts";
import { SourcePolicySchema, type SourcePolicy } from "../../src/collection.ts";
import { editionNames } from "../../src/contracts.ts";
import type { DevelopmentVerificationInput } from "../../src/github-development-contracts.ts";
import type { SecurityVerificationInput } from "../../src/github-advisory-contracts.ts";
import { ownerToken } from "../fixtures.ts";
import { policy } from "./source-fixtures.ts";
import { repository } from "./github-fixtures.ts";

export const ownedRelease = (id = 101, body = "This release removes the legacy search endpoint.") => ({ id, node_id: `RE_owned_${id}`, name: "Stable release", tag_name: "v2.0.0", target_commitish: "main", draft: false, prerelease: false,
  created_at: "2026-09-05T20:00:00Z", published_at: "2026-09-05T21:00:00Z", body });
export function ownedAssessment(input: DevelopmentVerificationInput) {
  return { schemaVersion: 1, inputSha256: input.inputSha256, provenance: "annotated-fixture", verifierVersion: "owned-materiality-v1",
    assessments: input.evidence.map((entry) => ({ observationId: entry.observationId, conclusion: "supported", materiality: "major",
      change: { category: "breaking-interface", object: "legacy search endpoint", scope: "removal of the legacy search contract" },
      evidenceExcerpt: "This release removes the legacy search endpoint.", relation: { kind: "new-material", previousDevelopmentId: null } })) };
}
export async function repromotionFixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "observer-repromotion-owned-"));
  const state = {
    source: SourcePolicySchema.parse({ ...policy(), sourceId: "github-development-fixture", edition: "github-projects", feedUrl: "https://api.github.com",
      review: { ...policy().review, reviewedAtUtc: "2026-09-01T00:00:00.000Z" },
      collection: { ...policy().collection, readBody: true }, model: { enabled: true, fields: ["url", "title", "content", "contentSha256"] },
      citation: { ...policy().citation, maxCharacters: 500 },
      github: { allowedQueries: ["topic:owner-fixture"], allowApiResponseProcessing: true, allowRepositorySnapshots: true, allowIdentityHistory: true,
        allowDerivedPublication: true, irrevocableExportAllowed: true, deletionScope: "raw-only",
        events: { schemaVersion: 1, allowReleaseMetadata: true, allowAdvisoryMetadata: false, allowReleaseBodyProcessing: true,
          allowMaterialityModelProcessing: true, allowMaterialEvidenceProjection: true, allowEventIdentityHistory: true } } }),
    configuration: { schemaVersion: 1, version: 1, sourceId: "github-development-fixture", queries: ["topic:owner-fixture"] },
    developmentConfiguration: { schemaVersion: 1, version: 1, sourceId: "github-development-fixture", releases: true } as { schemaVersion: number; version: number; sourceId: string; releases: boolean; advisories?: boolean },
    now: "2026-09-03T23:25:00.000Z", repositories: [repository("repeat", 100, 20)], releases: [] as ReturnType<typeof ownedRelease>[],
    releasesByName: {} as Record<string, ReturnType<typeof ownedRelease>[]>,
    advisories: [] as unknown[],
    advisoryDetails: {} as Record<string, unknown>,
    httpStatuses: {} as Record<string, number>,
    searchPagination: false,
    assess: async (input: DevelopmentVerificationInput): Promise<unknown> => ownedAssessment(input),
    assessSecurity: undefined as undefined | ((input: SecurityVerificationInput) => Promise<unknown>),
    onRead: (_url: string) => {},
    additionalSources: [] as SourcePolicy[],
  };
  const adapter = createGitHubAdapter({ read: async (url) => {
    state.onRead(url);
    const parsedUrl = new URL(url), path = parsedUrl.pathname;
    const page = Number(parsedUrl.searchParams.get("page") ?? 1), pageSize = Number(parsedUrl.searchParams.get("per_page") ?? 30);
    if (state.httpStatuses[path]) return { status: state.httpStatuses[path]!, headers: {}, body: "" };
    const result = path === "/advisories" ? state.advisories : path.startsWith("/advisories/") ? state.advisoryDetails[path.slice("/advisories/".length)] ?? state.advisories.find((entry) => (entry as { ghsa_id: string }).ghsa_id === path.slice("/advisories/".length)) : path === "/search/repositories" ? { total_count: state.repositories.length, incomplete_results: false, items: state.repositories.slice((page - 1) * pageSize, page * pageSize) } :
      path.endsWith("/releases") ? state.releasesByName[path.slice("/repos/".length, -"/releases".length)] ?? (path === "/repos/example/repeat/releases" ? state.releases : []) : state.repositories.find((entry) => entry.full_name === path.slice("/repos/".length));
    const headers: Record<string, string> = {};
    if (state.searchPagination && path === "/search/repositories" && page * pageSize < state.repositories.length) {
      const next = new URL(url); next.searchParams.set("page", String(page + 1));
      headers.link = `<${next.href}>; rel="next"`;
    }
    return { status: 200, headers, body: JSON.stringify(result) };
  } });
  const observationOptions = { databasePath: join(directory, "observations.sqlite"), configuration: () => state.configuration, developmentConfiguration: () => state.developmentConfiguration,
    policies: () => [state.source, ...state.additionalSources], clock: () => state.now, adapter,
    credential: () => ({ kind: "fine-grained-pat", token: "github_pat_OWNED_FIXTURE_SECRET", expiresAtUtc: "2027-10-01T00:00:00.000Z", repositoryAccess: "public-only", permissions: "metadata-read-only" }),
    developmentVerifier: { assess: (input: DevelopmentVerificationInput) => state.assess(input),
      assessSecurity: (input: SecurityVerificationInput) => state.assessSecurity?.(input) ?? Promise.resolve(null) } };
  let observations = createGitHubObserver(observationOptions);
  const reportPath = join(directory, "reports.sqlite");
  const observerOptions = { databasePath: reportPath, ownerToken, mode: "test-fixture" as const, clock: () => state.now, sourcePolicyReader: () => [state.source, ...state.additionalSources] };
  let observer = createObserver({ ...observerOptions, github: observations });
  let observerOpen = true, observationsOpen = true;
  function close() {
    if (observerOpen) { observer.close(); observerOpen = false; }
    if (observationsOpen) { observations.close(); observationsOpen = false; }
  }
  t.after(close);
  const profilePath = join(directory, "profile.json");
  await writeFile(profilePath, JSON.stringify({ schemaVersion: 1, version: 1, topics: [], entities: [], regions: [], exclusions: { topics: [], entities: [], regions: [] }, coverageLanguages: ["zh"] }));
  observer.importInterestProfile(profilePath);
  return { state, directory, reportPath, get observer() { return observer; }, get observations() { return observations; },
    restart(developments = true) {
      close();
      const { developmentConfiguration: _developmentConfiguration, ...metadataOnlyOptions } = observationOptions;
      observations = createGitHubObserver(developments ? observationOptions : metadataOnlyOptions);
      observationsOpen = true;
      observer = createObserver({ ...observerOptions, github: observations });
      observerOpen = true;
    },
    async observe(atUtc: string, nodes: ReturnType<typeof repository>[], releases = state.releases) { state.now = atUtc; state.repositories = nodes; state.releases = releases; return observations.observeDue(); },
    async publish(businessDate: string, schemaVersion = 9) {
      const cutoffUtc = new Date(Date.parse(`${businessDate}T00:00:00.000Z`) - 1800000).toISOString();
      state.now = cutoffUtc.replace("23:30", "23:40");
      const request = { schemaVersion, taskId: `owned-${businessDate}`, businessDate, configurationId: "owned-development",
        evidenceBundle: { schemaVersion: 2, id: `owned-${businessDate}`, businessDate, configurationId: "owned-development", windowStartUtc: new Date(Date.parse(cutoffUtc) - 86400000).toISOString(), cutoffUtc, evidence: [], coverageGaps: [] },
        editions: Object.keys(editionNames).map((edition) => ({ edition, evidenceIds: [] })) };
      const version = await observer.produce(request); return observer.readReport(version.id, ownerToken);
    },
  };
}

export async function publishFirstRelease(fixture: Awaited<ReturnType<typeof repromotionFixture>>) {
  await fixture.observe("2026-09-03T23:25:00.000Z", [repository("repeat", 100, 20)]);
  await fixture.observe("2026-09-04T23:25:00.000Z", [repository("repeat", 105, 21)]);
  await fixture.publish("2026-09-05", 8);
  await fixture.observe("2026-09-05T00:25:00.000Z", [repository("repeat", 105, 21), repository("novel", 100, 20)]);
  await fixture.observe("2026-09-05T23:25:00.000Z", [repository("repeat", 130, 25), repository("novel", 108, 22)], [ownedRelease()]);
  return fixture.publish("2026-09-06");
}
