import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { z } from "zod";
import { createCollection, SourceConfigurationSchema } from "./collection.ts";
import { createObserver } from "./observer.ts";
import { editionNames, type AgentRunner } from "./contracts.ts";
import { createCodexRunner } from "./codex-runner.ts";
import { createClaudeRunner } from "./claude-runner.ts";
import { createCodexVerifier, createClaudeVerifier } from "./semantic-verifiers.ts";
import { createOpenAIModelTransport } from "./codex-model-transport.ts";
import { createAnthropicModelTransport } from "./claude-model-transport.ts";
import { codexVersion } from "./codex-protocol.ts";
import { claudeVersion } from "./claude-protocol.ts";
import { NativeCodexAuthorizationSchema, ProviderEligibilitySchema, providerAuthorized, RoutingConfigurationSchema } from "./routing-contracts.ts";
import type { RoutingOptions } from "./provider-routing.ts";
import { createGitHubObserver } from "./github-observations.ts";
import { GitHubConfigurationSchema, DevelopmentConfigurationSchema } from "./github-contracts.ts";
import { dailyWindow, ScheduleConfigurationSchema, shanghaiDate } from "./scheduled-publication.ts";
import { DiscourseConfigurationSchema } from "./discourse-contracts.ts";
import { createMastodonAdapter } from "./mastodon-adapter.ts";
import { PdfConfigurationSchema } from "./pdf-rendition.ts";
import { EmailConfigurationSchema } from "./email-contracts.ts";
import { createQqEmailTransport } from "./qq-email-transport.ts";
import { PatrolConfigurationSchema } from "./correction-patrol.ts";
import { runtimeSecret } from "./runtime-secrets.ts";
import { nativeCodexModel, nativeCodexReasoningEffort, nativeCodexStatus } from "./codex-native.ts";

const provider = z.strictObject({ enabled: z.boolean().default(false), image: z.string().min(1), eligibility: ProviderEligibilitySchema });
const nativeCodex = z.strictObject({ kind: z.literal("codex-native"), enabled: z.boolean().default(false),
  executable: z.string().min(1).refine(isAbsolute, "native-executable-must-be-absolute"),
  model: z.literal(nativeCodexModel).default(nativeCodexModel), reasoningEffort: z.literal(nativeCodexReasoningEffort).default(nativeCodexReasoningEffort),
  eligibility: NativeCodexAuthorizationSchema });
export const ProductionConfigurationSchema = z.strictObject({
  schemaVersion: z.literal(1), configurationId: z.string().min(1).max(200),
  schedule: ScheduleConfigurationSchema,
  sourceConfigurationPath: z.string().min(1), interestProfilePath: z.string().min(1),
  databasePath: z.string().default("../data/observer.sqlite"), collectionDatabasePath: z.string().default("../data/collection.sqlite"),
  taskRoot: z.string().default("../data/agent-tasks"), collect: z.boolean().default(false),
  routing: RoutingConfigurationSchema,
  providers: z.strictObject({ codex: z.union([provider, nativeCodex]).optional(), claude: provider.optional() }).default({}),
  pdf: PdfConfigurationSchema.default({ enabled: true }),
  email: EmailConfigurationSchema.default({ enabled: false }),
  corrections: z.strictObject({ enabled: z.boolean().default(false) }).default({ enabled: false }),
  correctionPatrol: PatrolConfigurationSchema.prefault({}),
  retention: z.strictObject({ restoreContractPath: z.string().min(1).optional() }).default({}),
  discourse: DiscourseConfigurationSchema.optional(),
  github: z.strictObject({ databasePath: z.string(), configuration: GitHubConfigurationSchema, developmentConfiguration: DevelopmentConfigurationSchema.optional(),
    credentialMode: z.enum(["fine-grained-pat", "anonymous-public"]).default("fine-grained-pat"),
    credentialExpiresAtUtc: z.iso.datetime({ precision: 3, offset: false }).optional() }).optional(),
});
function readJson(path: string) {
  if (statSync(path).size > 1024 * 1024) throw new Error("configuration-too-large");
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
function availableSecret(name: string): string | undefined {
  try { return runtimeSecret(name); } catch { return undefined; }
}

// Native Codex uses the CLI's saved login. API containers retain their dedicated
// credential/broker path; construction never starts either kind of model work.
export function createProductionRuntime(configurationPath: string, ownerToken: string, clock = () => new Date().toISOString()) {
  const configuration = ProductionConfigurationSchema.parse(readJson(configurationPath));
  if (configuration.correctionPatrol.enabled && !configuration.corrections.enabled) throw new Error("patrol-requires-corrections-enabled");
  // Lazy credential injection: constructing the adapter neither reads the key
  // nor connects. Missing/invalid enabled configuration fails before this point.
  const email = configuration.email.enabled ? { configuration: configuration.email,
    transport: createQqEmailTransport(configuration.email, () => availableSecret("QQ_SMTP_KEY")) } : undefined;
  const path = (value: string) => resolve(dirname(resolve(configurationPath)), value);
  const sources = () => SourceConfigurationSchema.parse(readJson(path(configuration.sourceConfigurationPath)));
  const sourceConfiguration = sources();
  const collection = createCollection({ databasePath: path(configuration.collectionDatabasePath), sources: sourceConfiguration.sources, policyReader: () => sources().sources, clock });
  const providers: RoutingOptions["providers"] = {};
  const suppressedSources = new Set<string>();
  const mastodon = configuration.discourse ? createMastodonAdapter({ clock }) : undefined;
  const credentialStates = new Map<string, "available" | "unavailable">();
  const connectivity = new Map<string, { state: "succeeded" | "failed"; atUtc: string }>();
  const observeResult = (name: string, value: unknown) => {
    const result = value as { status?: string };
    connectivity.set(name, { state: result?.status === "succeeded" ? "succeeded" : "failed", atUtc: clock() });
    return value;
  };
  for (const name of ["codex", "claude"] as const) {
    const entry = configuration.providers[name];
    if (!entry?.enabled) continue;
    const native = "kind" in entry && entry.kind === "codex-native";
    if (!native && !configuration.schedule.enabled && !configuration.corrections.enabled) continue;
    if (entry.eligibility.provider !== name || entry.eligibility.scope !== "live") throw new Error("invalid-live-provider-qualification");
    if (!providerAuthorized(entry.eligibility, "live", clock(), native)) continue;
    const common = { taskRoot: path(configuration.taskRoot), timeoutMs: configuration.routing.limits.attemptTimeoutMs,
      maxModelRequests: configuration.routing.limits.maxModelRequestsPerAttempt, clock };
    const editions: Partial<Record<keyof typeof editionNames, AgentRunner>> = {};
    if ("kind" in entry && entry.kind === "codex-native") {
      const options = { ...common, model: entry.model, runtime: { kind: "codex-native" as const, executable: entry.executable } };
      for (const edition of Object.keys(editionNames) as Array<keyof typeof editionNames>) {
        const runner = createCodexRunner({ ...options, edition });
        editions[edition] = { async run(input, controls) { return observeResult(name, await runner.run(input, controls)); } };
      }
      const verifier = createCodexVerifier(options);
      providers.codex = { editions, executionKind: "codex-native", verifier: { async verify(input, controls) { return observeResult(name, await verifier.verify(input, controls)); } } };
      continue;
    }
    const key = availableSecret(name === "codex" ? "OBSERVER_OPENAI_API_KEY" : "OBSERVER_ANTHROPIC_API_KEY");
    credentialStates.set(name, key ? "available" : "unavailable");
    if (!key) continue; // Routing records runner-unavailable and publishes explicit gaps.
    if (name === "codex") {
      const options = { ...common, model: "gpt-5.6-sol", runtime: { kind: "codex-cli" as const, image: entry.image }, transport: createOpenAIModelTransport(key) };
      for (const edition of Object.keys(editionNames) as Array<keyof typeof editionNames>) editions[edition] = createCodexRunner({ ...options, edition });
      providers.codex = { editions, verifier: createCodexVerifier(options) };
    } else {
      const options = { ...common, model: "claude-sonnet-4-6", runtime: { kind: "claude-cli" as const, image: entry.image }, transport: createAnthropicModelTransport(key) };
      for (const edition of Object.keys(editionNames) as Array<keyof typeof editionNames>) editions[edition] = createClaudeRunner({ ...options, edition });
      providers.claude = { editions, verifier: createClaudeVerifier(options) };
    }
  }
  const routing: RoutingOptions = { configuration: configuration.routing, executionScope: "live", providers, clock,
    eligibility: () => Object.entries(configuration.providers).flatMap(([name, entry]) => entry ? [{ ...entry.eligibility, provider: name, enabled: entry.enabled && entry.eligibility.enabled }] : []) };
  const github = configuration.github ? createGitHubObserver({ databasePath: path(configuration.github.databasePath),
    configuration: () => configuration.github!.configuration, policies: () => sources().sources.filter((source) => !suppressedSources.has(source.sourceId)),
    credential: () => configuration.github?.credentialMode === "anonymous-public" ? { kind: "anonymous-public" } : configuration.schedule.enabled && configuration.collect && configuration.github?.credentialExpiresAtUtc ? {
      kind: "fine-grained-pat", token: availableSecret("OBSERVER_GITHUB_TOKEN"),
      expiresAtUtc: configuration.github.credentialExpiresAtUtc, repositoryAccess: "public-only", permissions: "metadata-read-only",
    } : null, clock,
    ...(configuration.github.developmentConfiguration ? { developmentConfiguration: () => configuration.github!.developmentConfiguration } : {}) }) : undefined;
  const observer = createObserver({ databasePath: path(configuration.databasePath), ownerToken, mode: "production", clock,
    pdf: configuration.pdf,
    corrections: { enabled: configuration.corrections.enabled, evidence: (ids) => collection.correctionEvidence(ids) },
    correctionPatrol: { configuration: configuration.correctionPatrol, reread: (target, signal) => collection.rereadCorrection(target, signal),
      evidence: (ids) => collection.correctionEvidence(ids), deferEvidence: (ids, date) => collection.deferCorrectionEvidence(ids, date) },
    ...(email ? { email } : {}),
    sourcePolicies: sourceConfiguration.sources, sourcePolicyReader: () => sources().sources, ...(github ? { github } : {}),
    retention: { purgeRaw: (ids) => { ids.forEach((id) => suppressedSources.add(id)); collection.suppressSources(ids); },
      availableEvidence: (ids) => collection.correctionEvidence(ids).map((entry) => entry.id),
      ...(github ? { compactGitHub: (published, ids) => github.maintainRetention(published, ids) } : {}),
      ...(configuration.retention.restoreContractPath ? { restoreContract: readJson(path(configuration.retention.restoreContractPath)) } : {}) },
    ...(mastodon ? { discourse: { configuration: configuration.discourse, adapter: mastodon } } : {}),
    routing,
    schedule: { configuration: configuration.schedule, runtimeConfiguration: z.json().parse(JSON.parse(JSON.stringify(configuration))),
      versions: { application: process.env.OBSERVER_RELEASE_ID ?? "0.1.0", scheduler: "observer-scheduled-v1", recovery: "observer-recovery-v1", node: process.versions.node, codex: codexVersion, claude: claudeVersion,
        providerRuntime: JSON.stringify(configuration.providers) } },
  });
  observer.importInterestProfile(path(configuration.interestProfilePath));
  let ticking = false, collecting = false, lastSocialAttempt = 0;
  let collectionState = collection.status();
  let lastCollectionAtUtc: string | null = null, failedCollectionComponents = 0;
  return {
    observer, collection, configuration, routing, enabled: configuration.schedule.enabled,
    async observeGitHub(signal?: AbortSignal) {
      observer.processRetention();
      if (!github) throw new Error("github-observation-unavailable");
      return github.observeDue(signal ? { signal } : {});
    },
    requiresContainerNode: Object.values(configuration.providers).some((entry) => entry?.enabled && !("kind" in entry)),
    databasePath: path(configuration.databasePath),
    taskRoot: path(configuration.taskRoot),
    storageDirectories: [...new Set([configuration.databasePath, configuration.collectionDatabasePath,
      ...(configuration.github ? [configuration.github.databasePath] : [])].map((value) => dirname(path(value))))],
    status() {
      const now = clock();
      return { configurationId: configuration.configurationId,
        enabled: { schedule: configuration.schedule.enabled, collection: configuration.collect, pdf: configuration.pdf.enabled,
          email: configuration.email.enabled, corrections: configuration.corrections.enabled, patrol: configuration.correctionPatrol.enabled },
        limits: { routing: configuration.routing.limits, schedule: configuration.schedule, patrol: configuration.correctionPatrol },
        providers: (["codex", "claude"] as const).map((name) => {
          const entry = configuration.providers[name], eligibility = entry?.eligibility;
          const native = !!entry && "kind" in entry && entry.kind === "codex-native";
          const state = !entry?.enabled ? "disabled" : !eligibility || !providerAuthorized(eligibility, "live", now, native) ? "ineligible-or-authorization-expired" :
            eligibility.checkedAtUtc > now || eligibility.validUntilUtc <= now ? "qualification-expired-or-future" :
            native ? "runner-configured" : !configuration.schedule.enabled && !configuration.corrections.enabled ? "work-disabled" : credentialStates.get(name) !== "available" ? "credential-unavailable" : "runner-configured";
          return { provider: name, state, checkedAtUtc: eligibility?.checkedAtUtc ?? null, validUntilUtc: eligibility?.validUntilUtc ?? null,
            credential: native ? "cli-managed-not-read" : credentialStates.get(name) ?? "not-loaded",
            actualConnectivity: connectivity.get(name)?.state ?? "not-probed", lastAttemptAtUtc: connectivity.get(name)?.atUtc ?? null,
            ...(native ? { processKind: "codex-native", modelTransport: "codex-saved-login", authSource: "cli-managed-chatgpt-login",
              regionReview: "skipped-by-owner", accountEligibility: "not-reviewed", model: nativeCodexModel, reasoningEffort: nativeCodexReasoningEffort,
              requestLimits: "process-only;per-model-request-unobservable", native: nativeCodexStatus() } : {}) };
        }),
        collection: { active: collecting, lastCycleAtUtc: lastCollectionAtUtc, failedComponents: failedCollectionComponents,
          pendingProposals: collectionState.proposals.length, coverageGaps: collectionState.coverageGaps.map(({ sourceId, reason }) => ({ sourceId, reason })) },
      };
    },
    async collect(signal?: AbortSignal) {
      observer.processRetention();
      if (!configuration.schedule.enabled || !configuration.collect || collecting) return;
      collecting = true;
      try {
        const now = clock(), date = shanghaiDate(now), window = dailyWindow(date);
        const captureSocial = async () => {
          if (!mastodon || !configuration.discourse || now >= window.cutoffUtc || Date.parse(window.cutoffUtc) - Date.parse(now) > 600000 || Date.parse(now) - lastSocialAttempt < 60000 || observer.scheduledStatus(date)) return;
          lastSocialAttempt = Date.parse(now);
          for (const group of configuration.discourse.groups) {
            if (signal?.aborted) break;
            const sourcePolicy = sources().sources.find((source) => source.sourceId === group.sourceId && !observer.deletionContract().sources.some((entry) => entry.sourceId === source.sourceId));
            if (!sourcePolicy) continue;
            const sample = await mastodon.capture({ sourcePolicy, configuration: configuration.discourse, groupId: group.id,
              businessDate: date, windowStartUtc: window.windowStartUtc, cutoffUtc: window.cutoffUtc, ...(signal ? { signal } : {}) });
            observer.saveScheduledDiscourseSample(sample);
          }
        };
        const results = await Promise.allSettled([collection.collect(), ...(github ? [github.observeDue(signal ? { signal } : {})] : []), captureSocial()]);
        lastCollectionAtUtc = clock(); failedCollectionComponents = results.filter((result) => result.status === "rejected").length;
        collectionState = collection.status();
        if (failedCollectionComponents) throw new Error("collection-components-failed");
      }
      finally { collecting = false; }
    },
    async tick(readable: (versionId: string) => Promise<void>, signal?: AbortSignal) {
      observer.processRetention();
      if (!configuration.schedule.enabled || ticking || signal?.aborted) return;
      ticking = true;
      try {
        observer.purgeScheduledEvidence();
        const date = shanghaiDate(clock()), window = dailyWindow(date);
        if (date >= configuration.schedule.startBusinessDate && clock() >= window.cutoffUtc && !observer.scheduledStatus(date)) {
          const bundle = collection.bundle({ businessDate: date, configurationId: configuration.configurationId, windowStartUtc: window.windowStartUtc, cutoffUtc: window.cutoffUtc }, "storage");
          // Published/event eligibility remains with the existing Event Cluster rules.
          // Exact lower endpoint belongs to yesterday's window, and future disclosures stay out.
          bundle.evidence = bundle.evidence.filter((entry) => entry.retrievedAtUtc > window.windowStartUtc && (!entry.publishedAtUtc || entry.publishedAtUtc <= window.cutoffUtc));
          observer.freezeScheduled({ schemaVersion: 10, taskId: `daily:${date}:v1`, businessDate: date, configurationId: configuration.configurationId,
            evidenceBundle: { ...bundle, id: `daily:${date}:evidence-v1` }, discourseSamples: observer.scheduledDiscourseSamples(date), editions: Object.keys(editionNames).map((edition) => ({ edition,
              evidenceIds: bundle.evidence.filter((entry) => sourceConfiguration.sources.find((source) => source.sourceId === entry.sourceId)?.edition === edition).map((entry) => entry.id) })) });
        }
        for (const businessDate of observer.pendingScheduled()) {
          if (signal?.aborted) break;
          try {
            const statusBefore = observer.scheduledStatus(businessDate);
            if (!statusBefore?.latestVersionId && statusBefore?.recovery === "open") {
              const originalWindow = dailyWindow(businessDate);
              observer.recoverScheduledCollection(businessDate, collection.bundle({ businessDate, configurationId: configuration.configurationId,
                windowStartUtc: originalWindow.windowStartUtc, cutoffUtc: clock() }, "storage"));
            }
            await observer.runScheduled(businessDate, signal);
            const status = observer.scheduledStatus(businessDate);
            if (status?.latestVersionId && !status.latestReadableAtUtc) {
              const versionId = status.latestVersionId;
              await readable(versionId);
              observer.markScheduledReadable(versionId, ownerToken);
            }
          } catch { /* Persisted task state is the diagnostic authority; try on next tick. */ }
        }
      } finally { ticking = false; }
    },
    close() { observer.close(); github?.close(); collection.close(); },
  };
}
