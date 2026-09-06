// Fully deterministic Owned synthetic receipts, NOT external GitHub observations
// or actual published history. Used only to compare design replay with the public
// pure replay interface. Production never accepts this history from a Request.
import { createHash } from "node:crypto";
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const day = 86400000, cutoffUtc = "2026-09-06T00:00:00.000Z", cutoff = Date.parse(cutoffUtc);
const at = (ms) => new Date(ms).toISOString();
export function fixedInput(rows) {
  const configuration = { schemaVersion: 1, version: 1, sourceId: "owned-simulation", queries: ["topic:owned-simulation"] };
  const policy = { sourceId: "owned-simulation", policyVersion: 1, policySha256: "0".repeat(64) };
  const configurationSha256 = digest(configuration), runs = new Map();
  function observation(row, time, historical) {
    const timestamp = at(time);
    if (!runs.has(timestamp)) runs.set(timestamp, { id: digest([timestamp, configuration, policy]), scheduledAtUtc: timestamp, startedAtUtc: timestamp, availableAtUtc: timestamp,
      resumeAtUtc: null, configuration, configurationSha256, policy, attribution: "Owned synthetic design fixture", limits: { pageSize: 30, candidateLimit: 50, pollIntervalSeconds: 3600, timeoutMs: 1000, maxRedirects: 0 }, queries: [], reasons: [], observations: [] });
    const run = runs.get(timestamp);
    const metadata = { nodeId: row.id, fullName: `owned/${row.id}`, observedAtUtc: timestamp, availableAtUtc: timestamp, responseSha256: "0".repeat(64),
      stars: row.stars - (historical ? row.starsDelta : 0), forks: row.forks - (historical ? row.forksDelta : 0), reason: null, language: row.language,
      createdAtUtc: at(cutoff - row.ageDays * day), topics: [...(row.topicPriority ? [`boost-${row.id}`] : []), ...(row.excludedTopic ? ["blocked"] : [])] };
    const result = { id: digest([run.id, metadata]), ...metadata };
    run.observations.push(result);
    return result;
  }
  const watchItems = rows.map((row) => {
    const historical = row.partition === "measured" ? observation(row, cutoff - row.intervalHours * 3600000, true) : null;
    const current = observation(row, cutoff, false);
    const firstSeenAtUtc = historical?.observedAtUtc ?? current.observedAtUtc;
    return { nodeId: row.id, fullName: current.fullName, status: row.partition, current, historical,
      starsDelta: historical ? row.starsDelta : null, forksDelta: historical ? row.forksDelta : null, firstSeenAtUtc,
      identityHistory: [{ fullName: current.fullName, observedAtUtc: firstSeenAtUtc }], reason: null };
  }).sort((a, b) => a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0);
  const profile = { schemaVersion: 1, version: 1, topics: rows.filter((row) => row.topicPriority).map((row) => ({ key: `boost-${row.id}`, priority: row.topicPriority })), entities: [], regions: [], exclusions: { topics: ["blocked"], entities: [], regions: [] }, coverageLanguages: ["zh"] };
  const publications = new Map();
  for (const row of rows) for (const days of row.reportAgesDays) {
    const time = at(cutoff - Math.round(days * day));
    if (!publications.has(time)) publications.set(time, []);
    publications.get(time).push(row.id);
  }
  return { snapshot: { schemaVersion: 2, rulesVersion: "observer-github-observations-v1", cutoffUtc, configuration, configurationSha256,
    runs: [...runs.values()].sort((a, b) => a.availableAtUtc < b.availableAtUtc ? -1 : 1),
    identities: watchItems.map((item) => ({ nodeId: item.nodeId, firstSeenAtUtc: item.firstSeenAtUtc, names: item.identityHistory, historySha256: digest(item.identityHistory), truncated: false })),
    reasons: [], watchItems, exclusions: [] }, interestProfile: { profile, sha256: digest(profile) },
    history: { entries: [...publications].sort(([a], [b]) => a < b ? -1 : 1).map(([publishedAtUtc, nodeIds], index) => ({ versionId: `owned-${index}`, businessDate: publishedAtUtc.slice(0, 10), publishedAtUtc,
      reportRecordSha256: "0".repeat(64), nodeIds, policies: [policy] })), unavailableVersionIds: [] }, algorithmVersion: "observer-github-heat-v1" };
}
