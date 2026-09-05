import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SaxesParser } from "saxes";
import { CollectedBundleSchema, type CollectedBundle, type CollectedEvidence } from "./contracts.ts";
import { createSourceReader, SourceReadError } from "./source-network.ts";

export const sourceFields = ["url", "title", "publishedAtRaw", "publishedAtUtc", "eventTimeUtc", "content", "contentSha256"] as const;
const fields = z.array(z.enum(sourceFields));
const text = z.string().min(1).max(2000);
const utc = z.iso.datetime({ precision: 3, offset: false });
export const SourcePolicySchema = z.strictObject({
  schemaVersion: z.literal(1), sourceId: z.string().min(1).max(200), version: z.number().int().positive(), name: text,
  feedUrl: z.url({ protocol: /^https$/ }), sourceType: z.enum(["primary", "secondary"]),
  edition: z.enum(["world-affairs", "ai", "finance", "frontier-technology", "social-discourse", "github-projects"]),
  review: z.strictObject({ status: z.enum(["pending", "approved", "rejected"]), reviewedBy: z.literal("Owner"), reviewedAtUtc: utc.nullable(), basis: text }),
  collection: z.strictObject({ enabled: z.boolean(), fields, readBody: z.boolean() }),
  storage: z.strictObject({ fields, retentionHours: z.number().nonnegative().max(720), retainRecordKeys: z.boolean() }),
  model: z.strictObject({ enabled: z.boolean(), fields }),
  distribution: z.strictObject({ enabled: z.boolean(), fields, allowDerivedText: z.boolean(), allowPermanentArchive: z.boolean() }),
  citation: z.strictObject({ enabled: z.boolean(), attribution: text, maxCharacters: z.number().int().nonnegative().max(10000) }),
  deletion: z.strictObject({ mode: z.enum(["owner-request", "unsupported"]), instructions: text }),
  limits: z.strictObject({
    pollIntervalSeconds: z.number().int().min(1).max(86400), timeoutMs: z.number().int().min(20).max(30000),
    maxResponseBytes: z.number().int().min(64).max(1048576), maxItems: z.number().int().min(1).max(1000), maxRedirects: z.number().int().min(0).max(5),
  }),
}).refine((source) => source.review.status !== "approved" || source.review.reviewedAtUtc !== null, "Approved policies need an Owner review date");
export type SourcePolicy = z.infer<typeof SourcePolicySchema>;
export const SourceConfigurationSchema = z.strictObject({ schemaVersion: z.literal(1), configurationId: z.string().min(1).max(200), sources: z.array(SourcePolicySchema).max(100) });
const ProposalSchema = z.strictObject({ sourceId: text, feedUrl: z.url({ protocol: /^https$/ }), reason: text });
export type SourceProposal = z.infer<typeof ProposalSchema>;
export interface CoverageGap { sourceId: string; edition: SourcePolicy["edition"]; reason: string }

export interface SourceResponse { status: number; body: string; headers: Record<string, string>; finalUrl?: string }
export interface SourceReadRequest { source: SourcePolicy; headers: Record<string, string>; signal: AbortSignal }
export interface CollectionOptions {
  databasePath: string; sources: unknown; clock?: () => string;
  read?: (url: string, request: SourceReadRequest) => Promise<SourceResponse>;
}
export function policyDigest(policy: SourcePolicy) { return digest(JSON.stringify(policy)); }
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
async function boundedRead(read: NonNullable<CollectionOptions["read"]>, url: string, source: SourcePolicy, headers: Record<string, string>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      read(url, { source, headers, signal: controller.signal }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("timeout")); }, source.limits.timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

function feedItems(xml: string, source: SourcePolicy, feedUrl: string) {
  if (Buffer.byteLength(xml) > source.limits.maxResponseBytes) throw new SourceReadError("response-too-large");
  const parser = new SaxesParser({ xmlns: true });
  const stack: Array<{ name: string; value: string; base: string }> = [];
  const items: Array<Record<string, string>> = [];
  let item: Record<string, string> | undefined;
  let itemDepth = 0;
  let format: "rss" | "atom";
  parser.on("xmldecl", (declaration) => { if (declaration.encoding && !/^utf-8$/i.test(declaration.encoding)) throw new SourceReadError("encoding-forbidden"); });
  parser.on("doctype", () => { throw new Error("unsafe-xml"); });
  parser.on("opentag", (tag) => {
    if (stack.length >= 32) throw new Error("unsafe-xml");
    if (!stack.length) {
      if (tag.local === "rss" && tag.uri === "") format = "rss";
      else if (tag.local === "feed" && tag.uri === "http://www.w3.org/2005/Atom") format = "atom";
      else throw new SourceReadError("invalid-feed");
    }
    const parentBase = stack.at(-1)?.base ?? feedUrl;
    const base = tag.attributes["xml:base"] ? new URL(tag.attributes["xml:base"].value, parentBase).href : parentBase;
    stack.push({ name: tag.local, value: "", base });
    if ((format === "rss" && tag.local === "item" && tag.uri === "" && stack.length === 3 && stack[1]?.name === "channel") ||
      (format === "atom" && tag.local === "entry" && tag.uri === "http://www.w3.org/2005/Atom" && stack.length === 2)) { item = {}; itemDepth = stack.length; }
    if (item && stack.length === itemDepth + 1 && tag.local === "link" && tag.attributes.href &&
      (!tag.attributes.rel || tag.attributes.rel.value === "alternate")) item.link = new URL(tag.attributes.href.value, base).href;
  });
  parser.on("text", (value) => { if (stack.length) stack[stack.length - 1]!.value += value; });
  parser.on("cdata", (value) => { if (stack.length) stack[stack.length - 1]!.value += value; });
  parser.on("closetag", () => {
    const node = stack.pop()!;
    if (item && stack.length === itemDepth && node.value.trim()) {
      const name = node.name === "encoded" ? "content" : node.name;
      item[name] = name === "link" ? new URL(node.value.trim(), node.base).href : node.value.trim();
    }
    if (stack.length) stack.at(-1)!.value += node.value;
    if (stack.length === itemDepth - 1 && item) {
      if (items.length >= source.limits.maxItems) throw new SourceReadError("item-limit");
      items.push(item); item = undefined;
    }
  });
  parser.write(xml).close();
  return items;
}

function publicationTime(raw: string | null) {
  if (!raw) return null;
  const explicitIso = z.iso.datetime({ offset: true }).safeParse(raw).success;
  const rss = /^(?:\w{3},\s+)?(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(?:GMT|UT|UTC|[+-]\d{4})$/.exec(raw);
  const month = rss ? ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(rss[2]!.toLowerCase()) + 1 : 0;
  const explicitRss = !!rss && month > 0 && z.iso.date().safeParse(`${rss[3]}-${String(month).padStart(2, "0")}-${rss[1]!.padStart(2, "0")}`).success && Number(rss[4]) < 24 && Number(rss[5]) < 60 && Number(rss[6] ?? 0) < 60;
  const time = explicitIso || explicitRss ? Date.parse(raw) : NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function createCollection(options: CollectionOptions) {
  const sources = z.array(SourcePolicySchema).max(100).parse(options.sources);
  if (new Set(sources.map((source) => source.sourceId)).size !== sources.length) throw new Error("duplicate-source-id");
  const clock = options.clock ?? (() => new Date().toISOString());
  const read = options.read ?? createSourceReader();
  mkdirSync(dirname(options.databasePath), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(options.databasePath);
  const appId = Number(database.prepare("PRAGMA application_id").get()!.application_id);
  const version = Number(database.prepare("PRAGMA user_version").get()!.user_version);
  if (!((appId === 0 && version === 0) || (appId === 1329746755 && version === 1))) { database.close(); throw new Error("unsupported-collection-storage"); }
  database.exec(`PRAGMA secure_delete = ON; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, source TEXT NOT NULL, record_key TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(source, record_key));
    CREATE TABLE IF NOT EXISTS source_state (source TEXT PRIMARY KEY, next_poll TEXT NOT NULL, validators TEXT NOT NULL DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS policies (source TEXT PRIMARY KEY, version INTEGER NOT NULL, digest TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS proposals (source TEXT PRIMARY KEY, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_gaps (source TEXT PRIMARY KEY, payload TEXT NOT NULL);
    PRAGMA application_id = 1329746755; PRAGMA user_version = 1;
  `);
  for (const source of sources) {
    const previous = database.prepare("SELECT version, digest FROM policies WHERE source = ?").get(source.sourceId);
    if (previous && (Number(previous.version) > source.version || Number(previous.version) === source.version && previous.digest !== policyDigest(source))) { database.close(); throw new Error("policy-version-conflict"); }
  }
  database.exec("BEGIN IMMEDIATE");
  for (const row of database.prepare("SELECT source, digest FROM policies").all()) {
    const source = sources.find((source) => source.sourceId === row.source);
    if (!source || source.review.status !== "approved" || !source.collection.enabled || policyDigest(source) !== row.digest) {
      database.prepare("DELETE FROM evidence WHERE source = ?").run(row.source!);
      database.prepare("DELETE FROM source_state WHERE source = ?").run(row.source!);
      database.prepare("DELETE FROM source_gaps WHERE source = ?").run(row.source!);
    }
  }
  for (const source of sources) database.prepare("INSERT OR REPLACE INTO policies VALUES (?, ?, ?)").run(source.sourceId, source.version, policyDigest(source));
  database.exec("COMMIT");
  let lastGaps: CoverageGap[] = database.prepare("SELECT payload FROM source_gaps ORDER BY rowid").all().map((row) => JSON.parse(String(row.payload)) as CoverageGap);
  let lastOutcomes: Array<{ sourceId: string; reason: string }> = [];
  function purge() {
    database.prepare("DELETE FROM evidence WHERE json_extract(payload, '$.expiresAtUtc') <= ?").run(clock());
    for (const source of sources) if (!database.prepare("SELECT 1 FROM evidence WHERE source = ? LIMIT 1").get(source.sourceId)) database.prepare("UPDATE source_state SET validators = '{}' WHERE source = ?").run(source.sourceId);
  }
  const proposals: SourceProposal[] = sources.filter((source) => source.review.status !== "approved")
    .map((source) => ({ sourceId: source.sourceId, feedUrl: source.feedUrl, reason: "Owner review required" }));
  let closed = false;
  return {
    proposeSource(input: unknown) {
      const proposal = ProposalSchema.parse(input);
      if (Number(database.prepare("SELECT count(*) AS total FROM proposals").get()!.total) >= 100) throw new Error("proposal-limit");
      database.prepare("INSERT OR IGNORE INTO proposals VALUES (?, ?)").run(proposal.sourceId, JSON.stringify(proposal));
    },
    async collect() {
      purge();
      const coverageGaps: CoverageGap[] = sources.filter((source) => source.review.status !== "approved")
        .map((source) => ({ sourceId: source.sourceId, edition: source.edition, reason: "source-pending" }));
      let added = 0, updated = 0, duplicates = 0;
      const outcomes: typeof lastOutcomes = [];
      for (const source of sources.filter((source) => source.review.status === "approved")) {
        if (!source.collection.enabled) { coverageGaps.push({ sourceId: source.sourceId, edition: source.edition, reason: "collection-forbidden" }); continue; }
        const now = clock();
        const state = database.prepare("SELECT next_poll, validators FROM source_state WHERE source = ?").get(source.sourceId);
        if (state && String(state.next_poll) > now) {
          outcomes.push({ sourceId: source.sourceId, reason: "poll-not-due" });
          const unresolved = lastGaps.find((gap) => gap.sourceId === source.sourceId);
          if (unresolved) coverageGaps.push(unresolved);
          continue;
        }
        database.prepare("INSERT INTO source_state (source, next_poll) VALUES (?, ?) ON CONFLICT(source) DO UPDATE SET next_poll = excluded.next_poll").run(source.sourceId, new Date(Date.parse(now) + source.limits.pollIntervalSeconds * 1000).toISOString());
        try {
        const response = await boundedRead(read, source.feedUrl, source, state ? JSON.parse(String(state.validators)) as Record<string, string> : {});
        const feedReceivedAtUtc = clock();
        if (response.status === 429) {
          const retry = response.headers["retry-after"] ?? "";
          const retryMs = /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.parse(now);
          const delay = Number.isFinite(retryMs) ? Math.max(source.limits.pollIntervalSeconds * 1000, Math.min(retryMs, 86400000)) : source.limits.pollIntervalSeconds * 1000;
          database.prepare("UPDATE source_state SET next_poll = ? WHERE source = ?").run(new Date(Date.parse(now) + delay).toISOString(), source.sourceId);
          coverageGaps.push({ sourceId: source.sourceId, edition: source.edition, reason: "rate-limited" }); continue;
        }
        if (response.status === 304) { outcomes.push({ sourceId: source.sourceId, reason: "not-modified" }); continue; }
        if (response.status !== 200) throw new Error("http-error");
        let changes = 0;
        if (!source.storage.fields.length || source.storage.retentionHours === 0) {
          coverageGaps.push({ sourceId: source.sourceId, edition: source.edition, reason: "storage-forbidden" }); continue;
        }
        for (const item of feedItems(response.body, source, response.finalUrl ?? source.feedUrl)) {
          const publishedAtRaw = item.pubDate ?? item.published ?? null;
          if (!item.link || !/^https?:$/.test(new URL(item.link).protocol)) throw new SourceReadError("invalid-item");
          let content = item.content ?? item.description ?? item.summary;
          if (source.collection.readBody && source.collection.fields.includes("content") && item.link) {
            const body = await boundedRead(read, new URL(item.link, source.feedUrl).href, source, {});
            if (body.status !== 200) throw new Error("http-error");
            if (Buffer.byteLength(body.body) > source.limits.maxResponseBytes) throw new SourceReadError("response-too-large");
            content = body.body;
          }
          const retrievedAtUtc = clock();
          const values = { url: item.link, title: item.title, publishedAtRaw, publishedAtUtc: publicationTime(publishedAtRaw), eventTimeUtc: null, content, contentSha256: digest(content ?? "") };
          const permitted = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== undefined && source.collection.fields.includes(key as typeof sourceFields[number]) && source.storage.fields.includes(key as typeof sourceFields[number])));
          const key = source.storage.retainRecordKeys ? digest(item.guid ?? item.id ?? item.link ?? randomUUID()) : randomUUID();
          const previousRow = database.prepare("SELECT payload FROM evidence WHERE source = ? AND record_key = ?").get(source.sourceId, key);
          const previous = previousRow ? JSON.parse(String(previousRow.payload)) as CollectedEvidence : undefined;
          if (previous && sourceFields.every((field) => previous[field] === permitted[field])) { duplicates++; continue; }
          const evidence: CollectedEvidence = {
            id: previous?.id ?? randomUUID(), sourceId: source.sourceId, sourceType: source.sourceType,
            policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data",
            discoveredAtUtc: previous?.discoveredAtUtc ?? feedReceivedAtUtc, retrievedAtUtc, expiresAtUtc: new Date(Date.parse(retrievedAtUtc) + source.storage.retentionHours * 3600000).toISOString(), ...permitted,
          };
          database.prepare("INSERT OR REPLACE INTO evidence VALUES (?, ?, ?, ?)").run(evidence.id, source.sourceId, key, JSON.stringify(evidence));
          if (previous) updated++; else added++;
          changes++;
        }
        outcomes.push({ sourceId: source.sourceId, reason: changes ? "collected" : "no-change" });
        if (source.storage.retainRecordKeys) {
          const validators: Record<string, string> = {};
          if (response.headers.etag) validators["if-none-match"] = response.headers.etag.slice(0, 1024);
          if (response.headers["last-modified"]) validators["if-modified-since"] = response.headers["last-modified"].slice(0, 128);
          database.prepare("UPDATE source_state SET validators = ? WHERE source = ?").run(JSON.stringify(validators), source.sourceId);
        }
        } catch (error) {
          const reason = error instanceof SourceReadError || error instanceof Error && ["timeout", "http-error", "unsafe-xml"].includes(error.message) ? error.message : "source-failed";
          coverageGaps.push({ sourceId: source.sourceId, edition: source.edition, reason });
        }
      }
      lastGaps = coverageGaps;
      database.exec("BEGIN IMMEDIATE; DELETE FROM source_gaps;");
      for (const gap of coverageGaps) database.prepare("INSERT INTO source_gaps VALUES (?, ?)").run(gap.sourceId, JSON.stringify(gap));
      database.exec("COMMIT");
      lastOutcomes = outcomes;
      return { added, updated, duplicates, coverageGaps, outcomes };
    },
    bundle(window: Pick<CollectedBundle, "businessDate" | "configurationId" | "windowStartUtc" | "cutoffUtc">, stage: "storage" | "model" | "distribution") {
      purge();
      const gaps = structuredClone(lastGaps);
      const evidence = database.prepare("SELECT payload FROM evidence ORDER BY rowid").all().map((row) => JSON.parse(String(row.payload)) as CollectedEvidence)
        .filter((item) => {
          const source = sources.find((source) => source.sourceId === item.sourceId)!;
          if (stage !== "storage" && !source[stage].enabled) { gaps.push({ sourceId: source.sourceId, edition: source.edition, reason: `${stage}-forbidden` }); return false; }
          return item.retrievedAtUtc <= window.cutoffUtc && item.retrievedAtUtc >= window.windowStartUtc;
        })
        .map((item) => {
          const source = sources.find((source) => source.sourceId === item.sourceId)!;
          for (const field of sourceFields) if (!source[stage].fields.includes(field)) delete item[field];
          return item;
        });
      for (const source of sources) if (!evidence.some((item) => item.sourceId === source.sourceId) && !gaps.some((gap) => gap.sourceId === source.sourceId)) gaps.push({ sourceId: source.sourceId, edition: source.edition, reason: "evidence-unavailable" });
      return CollectedBundleSchema.parse({ schemaVersion: 2, id: randomUUID(), ...window, evidence, coverageGaps: gaps });
    },
    status() {
      purge();
      const saved = database.prepare("SELECT payload FROM proposals ORDER BY rowid").all().map((row) => ProposalSchema.parse(JSON.parse(String(row.payload))));
      return { proposals: [...structuredClone(proposals), ...saved.filter((proposal) => !sources.some((source) => source.sourceId === proposal.sourceId))], coverageGaps: structuredClone(lastGaps), outcomes: structuredClone(lastOutcomes) };
    },
    close() { if (!closed) { closed = true; database.close(); } },
  };
}
