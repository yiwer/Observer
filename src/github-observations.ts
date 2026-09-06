import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { SourcePolicySchema, policyDigest, type SourcePolicy } from "./collection.ts";
import { GitHubConfigurationSchema, GitHubRepositorySchema, GitHubRunSchema, GitHubSnapshotSchema, GitHubWatchItemSchema, githubRules,
  type GitHubConfiguration, type GitHubObservation, type GitHubReason, type GitHubRun, type GitHubSnapshot } from "./github-contracts.ts";
import { createGitHubAdapter, githubDigest, githubFailure, type GitHubAdapter } from "./github-adapter.ts";

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

export function createGitHubObserver(options: { databasePath: string; configuration: () => unknown; policies: () => unknown; credential: () => unknown; clock?: () => string; adapter?: GitHubAdapter }) {
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
  const configuration = () => GitHubConfigurationSchema.parse(options.configuration());
  const policies = () => SourcePolicySchema.array().parse(options.policies());
  const history = () => db.prepare("SELECT payload FROM runs ORDER BY slot").all().map((row) => GitHubRunSchema.parse(JSON.parse(String(row.payload))));
  let active: Promise<GitHubRun> | undefined;
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
  function authorize(snapshot: GitHubSnapshot): GitHubReason | null {
    try {
      const config = configuration();
      if (githubDigest(config) !== snapshot.configurationSha256) return "github-configuration-changed";
      const source = policies().find((source) => source.sourceId === config.sourceId);
      const conflict = authorityFailure(config, source); if (conflict) return conflict;
      if (!githubPermission(source, config, clock(), true) || snapshot.runs.some((run) => !run.policy || run.policy.policySha256 !== policyDigest(source!))) return "github-permission-changed";
      return null;
    } catch { return "github-permission-changed"; }
  }
  return {
    async observeDue(input: { signal?: AbortSignal } = {}): Promise<GitHubRun> {
      if (active) return active;
      active = (async () => {
      const startedAtUtc = utc.parse(clock());
      const scheduledAtUtc = phase(startedAtUtc);
      const prior = db.prepare("SELECT payload FROM runs WHERE slot=?").get(scheduledAtUtc);
      if (prior) return GitHubRunSchema.parse(JSON.parse(String(prior.payload)));
      const config = configuration();
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
      const checked = GitHubRunSchema.parse(run);
      db.prepare("INSERT OR IGNORE INTO runs VALUES (?, ?)").run(scheduledAtUtc, JSON.stringify(checked));
      return GitHubRunSchema.parse(JSON.parse(String(db.prepare("SELECT payload FROM runs WHERE slot=?").get(scheduledAtUtc)!.payload)));
      })();
      try { return await active; } finally { active = undefined; }
    },
    snapshot(cutoffUtc: string): GitHubSnapshot {
      utc.parse(cutoffUtc);
      const config = configuration();
      const source = policies().find((source) => source.sourceId === config.sourceId);
      const all = history().filter((run) => run.availableAtUtc <= cutoffUtc && run.configuration.sourceId === config.sourceId);
      const compatible = all.filter((run) => run.configurationSha256 === githubDigest(config) && run.policy?.policySha256 === (source ? policyDigest(source) : null));
      const currentNodes = new Set(compatible.at(-1)?.observations.map((entry) => entry.nodeId) ?? []);
      const identities: GitHubSnapshot["identities"] = [...currentNodes].sort().map((nodeId) => {
        const entries = all.flatMap((run) => run.observations).filter((entry) => entry.nodeId === nodeId);
        const verified = entries.filter(hasVerifiedIdentity);
        const names = verified.filter((entry, index) => index === 0 || verified[index - 1]!.fullName !== entry.fullName).map(({ fullName, observedAtUtc }) => ({ fullName, observedAtUtc }));
        return { nodeId, firstSeenAtUtc: entries[0]!.observedAtUtc, historySha256: githubDigest(names), names: names.slice(-8), truncated: names.length > 8 };
      });
      const snapshot: GitHubSnapshot = { schemaVersion: 1, rulesVersion: githubRules.version, cutoffUtc, configuration: config, configurationSha256: githubDigest(config),
        runs: compatible.map((run) => ({ ...run, observations: run.observations.filter((entry) => currentNodes.has(entry.nodeId)) })), identities, reasons: [], watchItems: [], exclusions: [] };
      const failure = authorize(snapshot);
      if (failure) { snapshot.runs = []; snapshot.identities = []; snapshot.reasons = [failure]; }
      else {
        const items = selectGitHubItems(snapshot.runs, cutoffUtc, identities);
        snapshot.watchItems = items.filter((item) => item.status === "measured" || item.status === "cold-start").slice(0, githubRules.maxWatchItems);
        snapshot.exclusions = items.filter((item) => item.status !== "measured" && item.status !== "cold-start");
        snapshot.reasons = [...new Set<GitHubReason>([...(snapshot.runs.at(-1)?.reasons ?? ["github-no-observations"]), ...snapshot.exclusions.flatMap((item) => item.reason ? [item.reason] : [])])];
        const displayed = [...snapshot.watchItems, ...snapshot.exclusions];
        const retained = new Set(displayed.flatMap((item) => [item.current?.id, item.historical?.id,
          snapshot.runs.flatMap((run) => run.observations).filter((entry) => entry.nodeId === item.nodeId).at(-1)?.id].filter((id) => id !== undefined)));
        const latestRunId = snapshot.runs.at(-1)?.id;
        snapshot.runs = snapshot.runs.map((run) => ({ ...run, observations: run.observations.filter((entry) => retained.has(entry.id)) })).filter((run) => run.id === latestRunId || run.observations.length > 0);
        snapshot.identities = identities.filter((identity) => displayed.some((item) => item.nodeId === identity.nodeId));
      }
      return GitHubSnapshotSchema.parse(snapshot);
    },
    authorize,
    close() { db.close(); },
  };
}
