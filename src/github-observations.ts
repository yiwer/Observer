import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { z } from "zod";
import { SourcePolicySchema, policyDigest, type SourcePolicy } from "./collection.ts";
import { GitHubConfigurationSchema, GitHubRepositorySchema, GitHubRunSchema, GitHubSnapshotSchema, GitHubWatchItemSchema, githubRules,
  GitHubRankingSnapshotSchema, type GitHubRankingSnapshot, type GitHubConfiguration, type GitHubObservation, type GitHubReason, type GitHubRun, type GitHubSnapshot, type DevelopmentHistoryReadScope, type SyncResult } from "./github-contracts.ts";
import { createGitHubAdapter, githubDigest, githubFailure, type GitHubAdapter } from "./github-adapter.ts";
import { DevelopmentConfigurationSchema, DevelopmentRunSchema, GitHubRepromotionSnapshotSchema, PreviousDevelopmentEvidenceSchema, type DevelopmentContext, type PreviousDevelopmentEvidence, type DevelopmentConfiguration, type GitHubRepromotionSnapshot, type GitHubDevelopmentVerifier, type DevelopmentSnapshot, type GitHubPublicationContext } from "./github-development-contracts.ts";
import { collectDevelopments, developmentPermission, developmentRunPermission, reconstructDevelopments } from "./github-developments.ts";
import { AdvisoryHistorySchema, type AdvisoryHistory } from "./github-advisory-contracts.ts";
import { consistentAdvisories } from "./github-advisories.ts";
import { createDevelopmentContextIndex, developmentRouteColumns, developmentMaterialKinds, developmentDependencies, type IndexedContext } from "./github-context-index.ts";
import { projectGitHubPublication } from "./github-publication-budget.ts";
import type { QuotationPolicy } from "./github-quotations.ts";
import { createMomentumStorage } from "./github-momentum-storage.ts";
import { createGitHubReadBudget, finishGitHubReadBudget, type GitHubReadBudget } from "./github-read-budget.ts";
import { githubRetention } from "./github-retention.ts";

export function githubPermission(source: SourcePolicy | undefined, configuration: GitHubConfiguration, atUtc: string, publication = false): boolean {
  return !!source && source.sourceId === configuration.sourceId && source.edition === "github-projects" && source.feedUrl === "https://api.github.com" &&
    source.review.status === "approved" && source.review.reviewedAtUtc !== null && source.review.reviewedAtUtc <= atUtc && source.collection.enabled && source.collection.readBody &&
    source.storage.retainRecordKeys && [source.collection.fields, source.storage.fields].every((fields) => ["url", "title", "content", "contentSha256"].every((field) => fields.includes(field as "content"))) &&
    !!source.github && source.github.allowApiResponseProcessing && source.github.allowRepositorySnapshots && source.github.allowIdentityHistory &&
    configuration.queries.every((query) => source.github!.allowedQueries.includes(query)) &&
    (!publication || source.distribution.enabled && source.distribution.allowDerivedText && source.distribution.allowPermanentArchive && source.citation.enabled &&
      ["url", "title"].every((field) => source.distribution.fields.includes(field as "url")) && source.github.allowDerivedPublication && source.github.irrevocableExportAllowed && source.github.deletionScope === "raw-only");
}
function phase(atUtc: string) { const date = new Date(atUtc); date.setUTCMinutes(25, 0, 0); if (date.toISOString() > atUtc) date.setUTCHours(date.getUTCHours() - 1); return date.toISOString(); }
const utc = z.iso.datetime({ precision: 3, offset: false });
// A validated same-node detail can establish an address without qualifying its counts.
// Failed reads and identity mismatches remain observations, never verified name changes.
const hasVerifiedIdentity = (entry: GitHubObservation) => entry.reason === null || entry.reason === "github-ineligible" || entry.reason === "github-risk-unknown";

export function selectGitHubItems(runs: GitHubRun[], cutoffUtc: string, identities: GitHubSnapshot["identities"] = []): GitHubSnapshot["watchItems"] {
  const observations = runs.flatMap((run) => run.observations).filter((entry) => entry.observedAtUtc <= cutoffUtc && entry.availableAtUtc <= cutoffUtc);
  const nodes = [...new Set(observations.map((entry) => entry.nodeId))].sort();
  const target = Date.parse(cutoffUtc) - 86400000;
  const nearest = (entries: GitHubObservation[], time: number) => [...entries].sort((a, b) => Math.abs(Date.parse(a.observedAtUtc) - time) - Math.abs(Date.parse(b.observedAtUtc) - time) || a.observedAtUtc.localeCompare(b.observedAtUtc) || a.id.localeCompare(b.id))[0] ?? null;
  return GitHubWatchItemSchema.array().parse(nodes.map((nodeId) => {
    const history = observations.filter((entry) => entry.nodeId === nodeId).sort((a, b) => a.availableAtUtc.localeCompare(b.availableAtUtc) || a.id.localeCompare(b.id));
    const latest = history.at(-1)!;
    const current = latest.reason === null ? nearest(history.filter((entry) => entry.reason === null && Date.parse(entry.observedAtUtc) >= Date.parse(cutoffUtc) - 900000), Date.parse(cutoffUtc)) : null;
    const historical = current ? nearest(history.filter((entry) => entry.reason === null && Math.abs(Date.parse(entry.observedAtUtc) - target) <= 3600000 && entry.observedAtUtc < current.observedAtUtc), target) : null;
    const identity = identities.find((entry) => entry.nodeId === nodeId);
    const firstSeenAtUtc = identity?.firstSeenAtUtc ?? history[0]!.observedAtUtc;
    const status = latest.reason ? "quarantined" : !current ? "missing" : historical ? "measured" : Date.parse(firstSeenAtUtc) > target ? "cold-start" : "missing";
    return { nodeId, fullName: latest.fullName, firstSeenAtUtc, identityHistory: identity?.names ?? history.filter((entry, index) => index === 0 || history[index - 1]!.fullName !== entry.fullName).map(({ fullName, observedAtUtc }) => ({ fullName, observedAtUtc })),
      status, current, historical, starsDelta: current && historical ? current.stars! - historical.stars! : null, forksDelta: current && historical ? current.forks! - historical.forks! : null,
      reason: latest.reason ?? (!current ? "github-current-missing" : !historical && status !== "cold-start" ? "github-historical-missing" : null) };
  }));
}

export function createGitHubObserver(options: { databasePath: string; configuration: () => unknown; policies: () => unknown; credential: () => unknown; clock?: () => string; adapter?: GitHubAdapter;
  developmentConfiguration?: () => unknown; developmentVerifier?: GitHubDevelopmentVerifier }) {
  const clock = options.clock ?? (() => new Date().toISOString());
  const adapter = options.adapter ?? createGitHubAdapter();
  mkdirSync(dirname(options.databasePath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(options.databasePath);
  const appId = Number(db.prepare("PRAGMA application_id").get()!.application_id);
  const version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
  if (!(appId === 0 && version === 0 && db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length === 0 || appId === 1329746759 && version === 1)) { db.close(); throw new Error("unsupported-github-storage"); }
  db.exec(`PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS runs(slot TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS authorities(id TEXT PRIMARY KEY, version INTEGER NOT NULL, digest TEXT NOT NULL);
    PRAGMA application_id=1329746759; PRAGMA user_version=1;`);
  if (options.developmentConfiguration) db.exec("CREATE TABLE IF NOT EXISTS development_runs(slot TEXT PRIMARY KEY, payload TEXT NOT NULL)");
  if (options.developmentConfiguration) {
    const columns = new Set(db.prepare("PRAGMA table_info(development_runs)").all().map((row) => String(row.name)));
    for (const [name, type] of Object.entries(developmentRouteColumns)) {
      if (!columns.has(name!)) db.exec(`ALTER TABLE development_runs ADD COLUMN ${name} ${type}`);
    }
  }
  const configuration = () => GitHubConfigurationSchema.parse(options.configuration());
  const policies = () => SourcePolicySchema.array().parse(options.policies());
  function quotationLimit(identity: QuotationPolicy) {
    const original = policies().find((entry) => entry.sourceId === identity.sourceId);
    return original && original.version === identity.policyVersion && policyDigest(original) === identity.policySha256 && original.citation.enabled ? original.citation.maxCharacters : null;
  }
  const contextIndex = options.developmentConfiguration ? createDevelopmentContextIndex(db, (identity, materialKinds) => {
    try {
      const source = policies().find((entry) => entry.sourceId === identity.sourceId);
      return !!source && source.version === identity.policyVersion && policyDigest(source) === identity.policySha256 &&
        githubPermission(source, { schemaVersion: 1, version: 1, sourceId: source.sourceId, queries: [] }, clock(), true) &&
        (!(materialKinds & 1) || developmentPermission(source, { sourceId: source.sourceId }, clock())) &&
        (!(materialKinds & 2) || developmentPermission(source, { sourceId: source.sourceId }, clock(), "security"));
    } catch { return false; }
  }) : null;
  let momentumStore: ReturnType<typeof createMomentumStorage> | null = null;
  function ensureMomentum(config?: DevelopmentConfiguration|null) {
    if (!momentumStore && (config?.momentum || db.prepare("SELECT id FROM authorities WHERE id='momentum-storage'").get())) {
      momentumStore = createMomentumStorage(db, (identity) => {
        try {
          const source = policies().find((entry) => entry.sourceId === identity.sourceId);
          return !!source && source.version === identity.policyVersion && policyDigest(source) === identity.policySha256 &&
            githubPermission(source, { schemaVersion: 1, version: 1, sourceId: source.sourceId, queries: [] }, clock(), true) &&
            (!identity.momentum || source.github?.events?.allowMomentumEvidence === true && source.github.events.allowEventIdentityHistory && source.github.events.allowMaterialEvidenceProjection) &&
            (!(identity.materialKinds & 1) || developmentPermission(source, { sourceId: source.sourceId }, clock())) &&
            (!(identity.materialKinds & 2) || developmentPermission(source, { sourceId: source.sourceId }, clock(), "security"));
        } catch { return false; }
      }, clock);
    }
    return momentumStore;
  }
  ensureMomentum();
  const history = () => db.prepare("SELECT payload FROM runs ORDER BY slot").all().map((row) => GitHubRunSchema.parse(JSON.parse(String(row.payload))));
  let active: Promise<GitHubRun> | undefined;
  let historyReading = false;
  type ContextReader = { verify(run: z.infer<typeof DevelopmentRunSchema>): boolean; snapshotRun(slot: string): z.infer<typeof DevelopmentRunSchema> | null; payloads: GitHubReadBudget };
  function momentumSnapshot(slot: string, cutoffUtc: string, reader: ContextReader) {
    try {
      const actual = momentumStore?.snapshot(slot, cutoffUtc, reader.payloads);
      if (!actual) return null;
      if (momentumStore!.verify(actual, reader.snapshotRun, reader.payloads)) return actual;
      return { ...actual, point: null, nodes: [], capsules: [], developments: [], reasons: ["github-momentum-history-unavailable"] };
    } catch { return null; }
  }
  function withDevelopmentHistoryRead<T>(use: (scope: DevelopmentHistoryReadScope) => T & SyncResult<T>): T {
    if (historyReading || use.constructor.name === "AsyncFunction") throw new Error("github-development-read-scope-invalid");
    historyReading = true;
    let live = true;
    let began = false;
    try {
      db.exec("BEGIN"); began = true;
      const invoke = (reader: ContextReader) => {
        const scope: DevelopmentHistoryReadScope = {
          authorize: (snapshot) => live ? authorizeInScope(snapshot, reader) : "github-observation-unavailable",
          authorizeDevelopmentHistory: (snapshot, publication) => live ? authorizeDevelopmentHistoryInScope(snapshot, publication, reader) : "github-observation-unavailable",
        };
        const result = use(scope);
        if (result !== null && (typeof result === "object" || typeof result === "function") && typeof (result as { then?: unknown }).then === "function") throw new Error("github-development-read-scope-invalid");
        return result;
      };
      if (contextIndex) return contextIndex.withHistoryRead(invoke);
      const payloads = createGitHubReadBudget();
      try { return invoke({ verify: () => false, snapshotRun: () => null, payloads }); }
      finally { finishGitHubReadBudget(payloads); }
    } finally { live = false; try { if (began) db.exec("COMMIT"); } finally { historyReading = false; } }
  }
  function developmentAuthorityFailure(config: DevelopmentConfiguration, save = false): GitHubReason | null {
    const hash = githubDigest(config);
    const stored = db.prepare("SELECT version,digest FROM authorities WHERE id='development-configuration'").get();
    if (stored && (Number(stored.version) > config.version || Number(stored.version) === config.version && stored.digest !== hash)) return "github-configuration-version-conflict";
    if (save) db.prepare("INSERT OR REPLACE INTO authorities VALUES('development-configuration',?,?)").run(config.version, hash);
    return null;
  }
  function authorizePrevious(evidence: PreviousDevelopmentEvidence[]): boolean {
    try {
      const current = policies();
      return evidence.every((entry) => {
        const source = current.find((source) => source.sourceId === entry.evidence.policy.sourceId);
        return !!source && source.version === entry.evidence.policy.policyVersion && policyDigest(source) === entry.evidence.policy.policySha256 && developmentPermission(source, entry.configuration, clock());
      });
    } catch { return false; }
  }
  function authorizeAdvisoryHistory(history: AdvisoryHistory): boolean {
    try {
      const current = policies();
      return [...history.entries, ...history.materials.map((entry) => entry.origin), ...history.mitigations.map((entry) => entry.origin)].every((entry) => {
        const source = current.find((source) => source.sourceId === entry.evidence.policy.sourceId);
        return !!source && source.version === entry.evidence.policy.policyVersion && policyDigest(source) === entry.evidence.policy.policySha256 &&
          developmentPermission(source, entry.configuration, clock(), "security");
      });
    } catch { return false; }
  }
  function authorityFailure(config: GitHubConfiguration, source: SourcePolicy | undefined, save = false): GitHubReason | null {
    const entries = [{ id: "configuration", version: config.version, digest: githubDigest(config), failure: "github-configuration-version-conflict" as const },
      ...(source ? [{ id: `source:${source.sourceId}`, version: source.version, digest: policyDigest(source), failure: "github-policy-version-conflict" as const }] : [])];
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const entry of entries) {
        const old = db.prepare("SELECT version,digest FROM authorities WHERE id=?").get(entry.id);
        if (old && (Number(old.version) > entry.version || Number(old.version) === entry.version && old.digest !== entry.digest)) return entry.failure;
      }
      if (save) for (const entry of entries) db.prepare("INSERT OR REPLACE INTO authorities VALUES(?,?,?)").run(entry.id, entry.version, entry.digest);
      return null;
    } finally { db.exec("COMMIT"); }
  }
  function authorize(snapshot: GitHubSnapshot | GitHubRankingSnapshot | GitHubRepromotionSnapshot): GitHubReason | null {
    if ("developments" in snapshot) {
      try { return withDevelopmentHistoryRead((scope) => scope.authorize(snapshot)); }
      catch { return "github-observation-unavailable"; }
    }
    return authorizeInScope(snapshot);
  }
  function authorizeInScope(snapshot: GitHubSnapshot | GitHubRankingSnapshot | GitHubRepromotionSnapshot, reader?: ContextReader): GitHubReason | null {
    if ("developments" in snapshot) {
      try {
        const checked = GitHubRepromotionSnapshotSchema.parse(snapshot);
        const config = configuration(), source = policies().find((entry) => entry.sourceId === config.sourceId);
        if (githubDigest(config) !== checked.github.configurationSha256) return "github-configuration-changed";
        if (!githubPermission(source, config, clock(), true) || checked.github.runs.some((run) => run.policy?.policySha256 !== policyDigest(source!))) return "github-permission-changed";
        const declarations = [{ id: "configuration", version: config.version, digest: githubDigest(config) }, { id: `source:${source!.sourceId}`, version: source!.version, digest: policyDigest(source!) }];
        for (const declaration of declarations) {
          const stored = db.prepare("SELECT version,digest FROM authorities WHERE id=?").get(declaration.id);
          if (stored && (Number(stored.version) > declaration.version || Number(stored.version) === declaration.version && stored.digest !== declaration.digest)) return "github-policy-version-conflict";
        }
        if (checked.developments.configuration) {
          const current = DevelopmentConfigurationSchema.parse(options.developmentConfiguration?.());
          if (githubDigest(current) !== checked.developments.configurationSha256) return "github-configuration-changed";
          const conflict = developmentAuthorityFailure(current); if (conflict) return conflict;
          if (checked.developments.runs.some((run) => !developmentRunPermission(source, run, clock()) || run.policy?.policySha256 !== policyDigest(source!))) return "github-permission-changed";
          if (!authorizePrevious(checked.developments.runs.flatMap((run) => run.assessments.flatMap((receipt) => receipt.previousEvidence)))) return "github-permission-changed";
          for (const run of checked.developments.runs) if (run.security && !authorizeAdvisoryHistory(run.security.history)) return "github-permission-changed";
          const historyFailure = authorizeDevelopmentHistoryInScope(checked, undefined, reader!); if (historyFailure) return historyFailure;
        }
        return null;
      } catch { return "github-permission-changed"; }
    }
    try {
      (snapshot.schemaVersion === 1 ? GitHubSnapshotSchema : GitHubRankingSnapshotSchema).parse(snapshot);
      const config = configuration();
      if (githubDigest(config) !== snapshot.configurationSha256) return "github-configuration-changed";
      const source = policies().find((source) => source.sourceId === config.sourceId);
      const conflict = authorityFailure(config, source); if (conflict) return conflict;
      if (!githubPermission(source, config, clock(), true) || snapshot.runs.some((run) => !run.policy || run.policy.policySha256 !== policyDigest(source!))) return "github-permission-changed";
      return null;
    } catch { return "github-permission-changed"; }
  }
  function authorizeDevelopmentHistory(snapshot: GitHubRepromotionSnapshot, publication?: GitHubPublicationContext): GitHubReason | null {
    try { return withDevelopmentHistoryRead((scope) => scope.authorizeDevelopmentHistory(snapshot, publication)); }
    catch { return "github-observation-unavailable"; }
  }
  function authorizeDevelopmentHistoryInScope(snapshot: GitHubRepromotionSnapshot, publication: GitHubPublicationContext | undefined, reader: ContextReader): GitHubReason | null {
    try {
      const checked = GitHubRepromotionSnapshotSchema.parse(snapshot);
      if (checked.developments.configuration?.momentum) {
        const current = checked.github.runs.at(-1), frozen = checked.developments.momentum;
        const actual = current ? momentumSnapshot(current.scheduledAtUtc, checked.developments.cutoffUtc, reader) : null;
        if (actual && (!frozen || githubDigest(actual) !== githubDigest(frozen)) || frozen && !actual) return "github-observation-unavailable";
      }
      if (checked.developments.publicationProjection && !publication) return "github-observation-unavailable";
        if (publication) {
          const { publicationProjection, ...base } = checked.developments;
          const origins = publicationProjection?.origins ?? base.runs.map((run) => ({ slot: run.slot, runId: run.id }));
          const current = checked.github.runs.at(-1);
          const persisted = current && base.configuration ? reader.snapshotRun(current.scheduledAtUtc) : null;
          const originals = persisted && persisted.githubRunId === current!.id && persisted.configurationSha256 === base.configurationSha256 &&
            githubDigest(persisted.policy) === githubDigest(current!.policy) && persisted.availableAtUtc <= base.cutoffUtc ? [persisted] : [];
          if (origins.length !== base.runs.length || githubDigest(origins) !== githubDigest(originals.map((run) => ({ slot: run.slot, runId: run.id })))) return "github-observation-unavailable";
          // The actual current slot, not a pair of caller-empty arrays, decides
          // the original set. Loading it has authenticated its complete
          // frozen prefix, even for groups that the final projection omits.
          const original: GitHubRepromotionSnapshot = { ...checked, developments: { ...base, runs: originals, reasons: originals.length ? originals.flatMap((run) => run.reasons) : base.reasons } };
          if (githubDigest(projectGitHubPublication(original, publication, quotationLimit)) !== githubDigest(checked.developments)) return "github-observation-unavailable";
        } else for (const run of checked.developments.runs) if (!reader.verify(run)) return "github-observation-unavailable";
        return null;
    } catch { return "github-observation-unavailable"; }
  }
  function takeSnapshot(cutoffUtc: string, ranking: boolean): GitHubSnapshot | GitHubRankingSnapshot {
    utc.parse(cutoffUtc);
    const config = configuration();
    const source = policies().find((source) => source.sourceId === config.sourceId);
    const all = history().filter((run) => run.availableAtUtc <= cutoffUtc && run.configuration.sourceId === config.sourceId);
    const compatible = all.filter((run) => run.configurationSha256 === githubDigest(config) && run.policy?.policySha256 === (source ? policyDigest(source) : null));
    const currentNodes = new Set(compatible.at(-1)?.observations.map((entry) => entry.nodeId) ?? []);
    const identities: GitHubSnapshot["identities"] = [...currentNodes].sort().map((nodeId) => {
      const entries = all.flatMap((run) => run.observations).filter((entry) => entry.nodeId === nodeId);
      const verified = entries.filter(hasVerifiedIdentity);
      const compacted = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='github_identity_history'").get() ? db.prepare("SELECT full_name AS fullName,observed_at AS observedAtUtc FROM github_identity_history WHERE source_id=? AND node_id=? AND observed_at<=? ORDER BY observed_at").all(config.sourceId, nodeId, cutoffUtc).map((row) => ({ fullName: String(row.fullName), observedAtUtc: String(row.observedAtUtc) })) : [];
      const history = [...compacted, ...verified.map(({ fullName, observedAtUtc }) => ({ fullName, observedAtUtc }))].sort((a, b) => a.observedAtUtc.localeCompare(b.observedAtUtc));
      const names = history.filter((entry, index) => index === 0 || history[index - 1]!.fullName !== entry.fullName);
      return { nodeId, firstSeenAtUtc: [entries[0]!.observedAtUtc, compacted[0]?.observedAtUtc].filter((entry): entry is string => !!entry).sort()[0]!, historySha256: githubDigest(names), names: names.slice(-8), truncated: names.length > 8 };
    });
    const snapshot: GitHubSnapshot | GitHubRankingSnapshot = { schemaVersion: ranking ? 2 : 1, rulesVersion: githubRules.version, cutoffUtc, configuration: config, configurationSha256: githubDigest(config),
      runs: compatible.map((run) => ({ ...run, observations: run.observations.filter((entry) => currentNodes.has(entry.nodeId)) })), identities, reasons: [], watchItems: [], exclusions: [] };
    // Authorize the bounded publication projection after the full history has supplied the pair.
    const failure = authorize({ ...snapshot, runs: [], identities: [] });
    if (failure) { snapshot.runs = []; snapshot.identities = []; snapshot.reasons = [failure]; }
    else {
      const items = selectGitHubItems(snapshot.runs, cutoffUtc, identities);
      snapshot.watchItems = items.filter((item) => item.status === "measured" || item.status === "cold-start").slice(0, ranking ? githubRules.maxCandidates : githubRules.maxWatchItems);
      snapshot.exclusions = items.filter((item) => item.status !== "measured" && item.status !== "cold-start");
      snapshot.reasons = [...new Set<GitHubReason>([...(snapshot.runs.at(-1)?.reasons ?? ["github-no-observations"]), ...snapshot.exclusions.flatMap((item) => item.reason ? [item.reason] : [])])];
      const displayed = [...snapshot.watchItems, ...snapshot.exclusions];
      const retained = new Set(displayed.flatMap((item) => [item.current?.id, item.historical?.id,
        snapshot.runs.flatMap((run) => run.observations).filter((entry) => entry.nodeId === item.nodeId).at(-1)?.id].filter((id) => id !== undefined)));
      const latestRunId = snapshot.runs.at(-1)?.id;
      snapshot.runs = snapshot.runs.map((run) => ({ ...run, observations: run.observations.filter((entry) => retained.has(entry.id)) })).filter((run) => run.id === latestRunId || run.observations.length > 0);
      snapshot.identities = identities.filter((identity) => displayed.some((item) => item.nodeId === identity.nodeId));
    }
    return (ranking ? GitHubRankingSnapshotSchema : GitHubSnapshotSchema).parse(snapshot);
  }
  return {
    maintainRetention(published: unknown[], suppressed: string[]) {
      if (historyReading || active) throw new Error("github-retention-busy");
      return githubRetention(db, clock(), published, suppressed);
    },
    async observeDue(input: { signal?: AbortSignal } = {}): Promise<GitHubRun> {
      if (historyReading) throw new Error("github-development-read-scope-invalid");
      if (active) return active;
      active = (async () => {
      const startedAtUtc = utc.parse(clock());
      const scheduledAtUtc = phase(startedAtUtc);
      const prior = db.prepare("SELECT payload FROM runs WHERE slot=?").get(scheduledAtUtc);
      if (prior) return GitHubRunSchema.parse(JSON.parse(String(prior.payload)));
      const config = configuration();
      contextIndex?.maintain();
      const developmentConfig = options.developmentConfiguration ? DevelopmentConfigurationSchema.parse(options.developmentConfiguration()) : null;
      const activeMomentum = ensureMomentum(developmentConfig);
      const developmentConflict = developmentConfig ? developmentAuthorityFailure(developmentConfig, true) : null;
      const source = policies().find((source) => source.sourceId === config.sourceId);
      const last = history().filter((run) => run.configuration.sourceId === config.sourceId).at(-1);
      if (last?.resumeAtUtc && startedAtUtc < last.resumeAtUtc) return last;
      if (source && last && Date.parse(startedAtUtc) < Date.parse(last.startedAtUtc) + source.limits.pollIntervalSeconds * 1000) return last;
      const deadline = Date.now() + githubRules.deadlineMs;
      const candidateLimit = Math.min(githubRules.maxCandidates, source?.limits.maxItems ?? githubRules.maxCandidates);
      const identity = source ? { sourceId: source.sourceId, policyVersion: source.version, policySha256: policyDigest(source) } : null;
      const run: GitHubRun = { id: githubDigest([scheduledAtUtc, config, identity]), scheduledAtUtc, startedAtUtc, availableAtUtc: startedAtUtc, resumeAtUtc: null,
        configuration: config, configurationSha256: githubDigest(config), policy: identity, attribution: source?.citation.attribution ?? null,
        limits: { pageSize: Math.min(githubRules.pageSize, source?.limits.maxItems ?? githubRules.pageSize), candidateLimit, pollIntervalSeconds: source?.limits.pollIntervalSeconds ?? 3600,
          timeoutMs: source?.limits.timeoutMs ?? 1000, maxRedirects: Math.min(githubRules.maxRedirects, source?.limits.maxRedirects ?? 0) }, queries: [], reasons: [], observations: [] };
      const check = (): GitHubReason | null => {
        try {
          if (Date.now() >= deadline || Date.parse(clock()) - Date.parse(startedAtUtc) > githubRules.deadlineMs) return "github-timeout";
          if (githubDigest(configuration()) !== run.configurationSha256) return "github-configuration-changed";
          const current = policies().find((source) => source.sourceId === config.sourceId);
          if (!githubPermission(current, config, clock()) || !identity || policyDigest(current!) !== identity.policySha256) return "github-permission-changed";
          return null;
        } catch { return "github-permission-changed"; }
      };
      const conflict = authorityFailure(config, source, true);
      if (conflict) run.reasons.push(conflict);
      else if (!githubPermission(source, config, startedAtUtc)) run.reasons.push("github-no-eligible-source");
      else {
        const access = { source: source!, credential: options.credential, clock, authorize: check, deadline, ...(input.signal ? { signal: input.signal } : {}) };
        const candidates = new Map<string, string>();
        for (const query of config.queries) {
          const receipt: GitHubRun["queries"][number] = { query, pages: 0, receivedCount: 0, totalCount: null, reason: null };
          run.queries.push(receipt);
          try {
            for (let page = 1; page <= githubRules.maxPages; page++) {
              const response = await adapter.search(query, page, access); receipt.pages++; receipt.receivedCount += response.items.length; receipt.totalCount = response.total_count;
              if (response.incomplete_results) receipt.reason = "github-search-incomplete";
              for (const raw of response.items) {
                const parsed = GitHubRepositorySchema.safeParse(raw);
                if (!parsed.success) { run.reasons.push("github-invalid-response"); continue; }
                if (candidates.size >= candidateLimit && !candidates.has(parsed.data.node_id)) { receipt.reason = "github-candidate-limit"; continue; }
                candidates.set(parsed.data.node_id, parsed.data.full_name);
              }
              if (!response.paginationValid || response.nextPage === null && receipt.receivedCount < response.total_count) { receipt.reason = "github-pagination-incomplete"; break; }
              if (response.nextPage === null) break;
              if (page === githubRules.maxPages || !response.items.length) { receipt.reason = "github-pagination-incomplete"; break; }
            }
          } catch (error) { receipt.reason = githubFailure(error); }
        }
        for (const previous of history().filter((run) => run.configuration.sourceId === config.sourceId).flatMap((run) => run.observations).filter(hasVerifiedIdentity).reverse()) if (!candidates.has(previous.nodeId)) {
          if (candidates.size < candidateLimit) candidates.set(previous.nodeId, previous.fullName); else run.reasons.push("github-candidate-limit");
        }
        if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='github_identity_history'").get()) {
          for (const previous of db.prepare("SELECT node_id,full_name FROM github_identity_history WHERE source_id=? ORDER BY observed_at DESC").all(config.sourceId)) {
            if (!candidates.has(String(previous.node_id)) && candidates.size < candidateLimit) candidates.set(String(previous.node_id), String(previous.full_name));
          }
        }
        for (const [nodeId, fullName] of candidates) {
          let observation: GitHubObservation;
          try {
            const result = await adapter.repository(fullName, access);
            const value = result.repository;
            const reason: GitHubReason | null = value.node_id !== nodeId ? "github-identity-changed" : value.visibility === undefined || !["public", "private", "internal"].includes(value.visibility) || value.is_template === undefined ? "github-risk-unknown" :
              value.private || value.visibility !== "public" || value.archived || value.disabled || value.fork || value.mirror_url !== null || value.is_template ? "github-ineligible" : null;
            const metadata = { nodeId, fullName: value.node_id === nodeId ? value.full_name : fullName, observedAtUtc: result.observedAtUtc, availableAtUtc: clock(), responseSha256: result.responseSha256,
              stars: reason ? null : value.stargazers_count, forks: reason ? null : value.forks_count, reason,
              language: reason ? null : value.language, createdAtUtc: reason ? null : new Date(value.created_at).toISOString(), topics: reason ? null : value.topics ?? null };
            observation = { id: githubDigest([run.id, metadata]), ...metadata };
          } catch (error) {
            const metadata = { nodeId, fullName, observedAtUtc: clock(), availableAtUtc: clock(), responseSha256: githubDigest(null), stars: null, forks: null, reason: githubFailure(error), language: null, createdAtUtc: null, topics: null };
            observation = { id: githubDigest([run.id, metadata]), ...metadata };
          }
          run.observations.push(observation);
        }
        const failure = check(); if (failure) { run.reasons.push(failure); run.observations = []; }
      }
      run.availableAtUtc = utc.parse(clock());
      run.resumeAtUtc = adapter.resumeAtUtc();
      run.reasons = [...new Set([...run.reasons, ...run.queries.flatMap((entry) => entry.reason ? [entry.reason] : [])])];
      db.exec("BEGIN");
      let indexed: Map<string, IndexedContext>;
      try { indexed = contextIndex?.readNodes(run.observations.filter((entry) => entry.reason === null).map((entry) => entry.nodeId), run.scheduledAtUtc, run.startedAtUtc) ?? new Map(); }
      finally { db.exec("COMMIT"); }
      const releaseContexts = new Map<string, DevelopmentContext>();
      const securityHistory: AdvisoryHistory = { entries: [], materials: [], mitigations: [], unavailableNodeIds: [] };
      for (const [nodeId, context] of indexed) {
        const release = context.entries.filter((entry) => entry.kind === "release");
        releaseContexts.set(nodeId, { previous: release.map((entry) => entry.development), previousEvidence: release.map((entry) => entry.origin), unavailable: context.unavailable, freeze: context.freeze });
        if (context.unavailable) securityHistory.unavailableNodeIds.push(nodeId);
        else {
          securityHistory.entries.push(...context.entries.filter((entry) => entry.kind === "known-security").map((entry) => entry.origin));
          securityHistory.materials.push(...context.entries.filter((entry) => entry.kind === "security").map(({ development, origin }) => ({ development, origin })));
          securityHistory.mitigations.push(...context.entries.filter((entry) => entry.kind === "security-mitigation").map(({ projection, origin, receiptSha256 }) => ({ projection, origin, receiptSha256 })));
        }
      }
      const developmentRun = developmentConfig ? await collectDevelopments({ run, configuration: developmentConfig, source, adapter, clock,
        contexts: releaseContexts, authorizePrevious, advisoryHistory: developmentConfig.advisories ? securityHistory : { entries: [], materials: [], mitigations: [], unavailableNodeIds: [] }, authorizeAdvisoryHistory,
        quotationLimit,
        access: source ? { source, credential: options.credential, clock, authorize: () => {
          const failure = check(); if (failure) return failure;
          if (developmentConflict) return developmentConflict;
          try {
            if (githubDigest(DevelopmentConfigurationSchema.parse(options.developmentConfiguration?.())) !== githubDigest(developmentConfig)) return "github-configuration-changed";
            const conflict = developmentAuthorityFailure(developmentConfig); if (conflict) return conflict;
            return null;
          } catch { return "github-configuration-changed"; }
        }, deadline, ...(input.signal ? { signal: input.signal } : {}) } : undefined,
        ...(options.developmentVerifier ? { verifier: options.developmentVerifier } : {}) }) : null;
      if (developmentRun) run.availableAtUtc = developmentRun.availableAtUtc;
      const checked = GitHubRunSchema.parse(run);
      if (developmentRun || activeMomentum) {
        const persist = (finalizeMomentum?: () => void) => {
        db.exec("BEGIN IMMEDIATE");
        try {
          const momentumPoint = activeMomentum?.makePoint(checked, developmentConfig, developmentRun);
          const indexReady = contextIndex?.ready() ?? false;
          const insertion = activeMomentum ? activeMomentum.insertRun(checked) : db.prepare("INSERT OR IGNORE INTO runs(slot,payload) VALUES (?, ?)").run(scheduledAtUtc, JSON.stringify(checked));
          if (developmentRun && insertion.changes && contextIndex?.intact()) {
            const payload = JSON.stringify(developmentRun);
            db.prepare("INSERT INTO development_runs(slot,payload,source_id,policy_version,policy_sha256,available_at,payload_bytes,payload_sha256,material_kinds,dependency_policies) VALUES (?,?,?,?,?,?,?,?,?,?)")
              .run(scheduledAtUtc, payload, developmentRun.policy?.sourceId ?? null, developmentRun.policy?.policyVersion ?? null, developmentRun.policy?.policySha256 ?? null,
                developmentRun.availableAtUtc, Buffer.byteLength(payload), createHash("sha256").update(payload).digest("hex"), developmentMaterialKinds(developmentRun), JSON.stringify(developmentDependencies(developmentRun)));
            contextIndex.committed(scheduledAtUtc, indexReady, { run: developmentRun, github: checked });
          }
          if (insertion.changes && momentumPoint) activeMomentum!.commit(momentumPoint, developmentRun);
          finalizeMomentum?.();
          db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
        };
        if (activeMomentum) activeMomentum.write(persist); else persist();
      } else db.prepare("INSERT OR IGNORE INTO runs(slot,payload) VALUES (?, ?)").run(scheduledAtUtc, JSON.stringify(checked));
      return GitHubRunSchema.parse(JSON.parse(String(db.prepare("SELECT payload FROM runs WHERE slot=?").get(scheduledAtUtc)!.payload)));
      })();
      try { return await active; } finally { active = undefined; }
    },
    snapshot(cutoffUtc: string): GitHubSnapshot { return takeSnapshot(cutoffUtc, false) as GitHubSnapshot; },
    rankingSnapshot(cutoffUtc: string): GitHubRankingSnapshot { return takeSnapshot(cutoffUtc, true) as GitHubRankingSnapshot; },
    repromotionSnapshot(cutoffUtc: string): GitHubRepromotionSnapshot {
      const github = takeSnapshot(cutoffUtc, true) as GitHubRankingSnapshot;
      const config = options.developmentConfiguration ? DevelopmentConfigurationSchema.parse(options.developmentConfiguration()) : null;
      const developments: DevelopmentSnapshot = { schemaVersion: 1, cutoffUtc, configuration: config, configurationSha256: config ? githubDigest(config) : null, runs: [], reasons: [] };
      const latest = github.runs.at(-1);
      db.exec("BEGIN");
      let captured;
      try {
        captured = contextIndex?.withHistoryRead((reader) => ({
          run: config && latest ? reader.snapshotRun(latest.scheduledAtUtc) : null,
          momentum: config?.momentum && latest ? momentumSnapshot(latest.scheduledAtUtc, cutoffUtc, reader) : null,
        })) ?? { run: null, momentum: null };
      }
      finally { db.exec("COMMIT"); }
      const { run, momentum } = captured;
      if (run) {
        if (run.githubRunId === latest!.id && run.availableAtUtc <= cutoffUtc && run.configurationSha256 === developments.configurationSha256) {
          developments.runs = [run]; developments.reasons = [...run.reasons];
        } else developments.reasons.push("github-development-unavailable");
      } else developments.reasons.push(config ? "github-missing-event-run" : "github-development-disabled");
      if (config && !contextIndex?.ready() && !developments.reasons.includes("github-development-history-unavailable")) developments.reasons.push("github-development-history-unavailable");
      if (momentum) developments.momentum = momentum;
      else if (config?.momentum) developments.reasons.push("github-momentum-point-unavailable");
      return GitHubRepromotionSnapshotSchema.parse({ schemaVersion: 1, github, developments });
    },
    authorize,
    authorizeDevelopmentHistory,
    withDevelopmentHistoryRead,
    close() { db.close(); },
  };
}
