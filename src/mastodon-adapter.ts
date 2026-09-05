import { randomUUID } from "node:crypto";
import { SaxesParser } from "saxes";
import { z } from "zod";
import { SourcePolicySchema, policyDigest, type SourcePolicy, type SourceReadRequest, type SourceResponse } from "./collection.ts";
import { createSourceReader } from "./source-network.ts";
import { DiscourseConfigurationSchema, DiscourseReasonSchema, DiscourseSampleSchema, discourseRules, type DiscourseSample } from "./discourse-contracts.ts";
import { inputDigest } from "./publication-gate.ts";

export interface DiscourseAdapter { revalidate(sample: DiscourseSample, source: SourcePolicy, signal?: AbortSignal): Promise<string | null>; }
export function discoursePermission(source: SourcePolicy | undefined, tag: string, atUtc: string): boolean {
  return !!source && source.edition === "social-discourse" && source.review.status === "approved" && source.review.reviewedAtUtc !== null && source.review.reviewedAtUtc <= atUtc &&
    source.collection.enabled && source.collection.readBody && source.storage.retentionHours > 0 && source.storage.retainRecordKeys && source.model.enabled &&
    source.distribution.enabled && source.distribution.allowDerivedText && source.distribution.allowPermanentArchive && source.citation.enabled &&
    [source.collection.fields, source.storage.fields, source.model.fields].every((fields) => ["url", "title", "content", "contentSha256"].every((field) => fields.includes(field as "content"))) &&
    ["url", "title"].every((field) => source.distribution.fields.includes(field as "url")) && source.deletion.mode === "owner-request" &&
    !!source.social && source.social.allowedTags.includes(tag) && source.social.allowApiResponseProcessing && source.social.allowStatusKeys && source.social.allowAnonymousText &&
    source.social.irrevocableExportAllowed && source.social.deletionScope === "raw-only";
}
const statusSchema = z.object({ id: z.string().min(1).max(200).refine((id) => id !== "." && id !== ".." && !/[\\/%?#\u0000-\u0020]/.test(id)), created_at: z.iso.datetime({ offset: true }), edited_at: z.iso.datetime({ offset: true }).nullable(),
  visibility: z.literal("public"), sensitive: z.literal(false), spoiler_text: z.literal(""), content: z.string().min(1).max(8000), language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,8})?$/).nullable().catch(null),
  media_attachments: z.array(z.unknown()).length(0), card: z.null(), poll: z.null(), reblog: z.null(), quote: z.null().optional(), in_reply_to_id: z.null(),
});
function plainText(html: string, queryTag: string, origin: string): string {
  const parser = new SaxesParser();
  let text = "";
  const stack: string[] = [];
  let hashtag: string | null = null;
  parser.on("doctype", () => { throw new Error("unsafe-html"); });
  parser.on("opentag", (tag) => {
    if (tag.name === "a") {
      const attributes = tag.attributes;
      const href = new URL(String(attributes.href));
      if (hashtag !== null || Object.keys(attributes).sort().join(",") !== "class,href,rel" || attributes.class !== "mention hashtag" || attributes.rel !== "tag" ||
        href.origin !== origin || href.username || href.password || href.search || href.hash || decodeURIComponent(href.pathname).toLowerCase() !== `/tags/${queryTag.toLowerCase()}`) throw new Error("unsafe-html");
      hashtag = "";
    } else if (tag.name === "span") {
      if (stack.at(-1) !== "a" || hashtag === null || Object.keys(tag.attributes).length) throw new Error("unsafe-html");
    } else if (!["root", "p", "br"].includes(tag.name) || hashtag !== null || Object.keys(tag.attributes).length) throw new Error("unsafe-html");
    stack.push(tag.name);
  });
  parser.on("text", (value) => { if (hashtag === null) text += value; else hashtag += value; });
  parser.on("closetag", (tag) => {
    stack.pop();
    if (tag.name === "a") {
      if (hashtag?.toLowerCase() !== `#${queryTag.toLowerCase()}`) throw new Error("unsafe-html");
      text += ` #${queryTag} `; hashtag = null;
    } else if (hashtag === null) text += " ";
  });
  parser.write(`<root>${html.replace(/<br\s*>/gi, "<br/>")}</root>`).close();
  text = text.trim().replace(/\s+/g, " ");
  // Conservative format checks, not a claim to identify every kind of personal data.
  if (!text || text.length > 2000 || /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+|@[\p{L}\p{N}_]+|\b(?:\d{1,3}\.){3}\d{1,3}\b|\+?\d[\d ()-]{8,}\d)/u.test(text)) throw new Error("sensitive-text");
  return text;
}
function statusRecord(raw: unknown, windowStartUtc: string, cutoffUtc: string, queryTag: string, origin: string): DiscourseSample["records"][number] {
  const value = statusSchema.parse(raw);
  const created = new Date(value.created_at).toISOString();
  const edited = value.edited_at === null ? null : new Date(value.edited_at).toISOString();
  if (created <= windowStartUtc || created > cutoffUtc || edited !== null && (edited < created || edited > cutoffUtc)) throw new Error("outside-window");
  return { id: value.id, createdAtUtc: created, editedAtUtc: edited, language: value.language, text: plainText(value.content, queryTag, origin), fingerprint: inputDigest(value) };
}

export function createMastodonAdapter(options: { clock?: () => string; read?: (url: string, request: SourceReadRequest) => Promise<SourceResponse> } = {}) {
  const clock = options.clock ?? (() => new Date().toISOString());
  const read = options.read ?? createSourceReader();
  const receipts = new Map<string, { digest: string; expiresAtUtc: string; tag: string; sourceId: string; policySha256: string; origin: string }>();
  const cooldown = new Map<string, number>();
  async function get(url: string, source: SourcePolicy, deadline: number, signal?: AbortSignal): Promise<SourceResponse> {
    const origin = new URL(source.feedUrl).origin;
    if ((cooldown.get(origin) ?? 0) > Date.parse(clock())) throw new Error("social-rate-limited");
    if (signal?.aborted) throw new Error("social-cancelled");
    const timeout = Math.min(source.limits.timeoutMs, deadline - Date.now());
    if (timeout <= 0) throw new Error("social-timeout");
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectAbort: ((reason: Error) => void) | undefined;
    const abort = () => { controller.abort(); rejectAbort?.(new Error("social-cancelled")); };
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const interrupted = new Promise<never>((_, reject) => { rejectAbort = reject; timer = setTimeout(() => { controller.abort(); reject(new Error("social-timeout")); }, timeout); });
      const response = await Promise.race([interrupted, read(url, { source: { ...source, limits: { ...source.limits, maxRedirects: 0 } }, headers: { accept: "application/json" }, signal: controller.signal })]);
      if (signal?.aborted) throw new Error("social-cancelled");
      if (controller.signal.aborted || Date.now() >= deadline) throw new Error("social-timeout");
      if (response.finalUrl && response.finalUrl !== url) throw new Error("social-unsafe-response");
      if (Buffer.byteLength(response.body) > source.limits.maxResponseBytes) throw new Error("social-response-too-large");
      if (response.status === 429) {
        const retry = response.headers["retry-after"];
        const retryAt = retry && /^\d+$/.test(retry) ? Date.parse(clock()) + Number(retry) * 1000 : Date.parse(retry ?? "");
        const resetAt = Date.parse(response.headers["x-ratelimit-reset"] ?? "");
        cooldown.set(origin, Math.max(Date.parse(clock()) + 60000, Number.isFinite(retryAt) ? retryAt : 0, Number.isFinite(resetAt) ? resetAt : 0));
        throw new Error("social-rate-limited");
      }
      if ([401, 403, 422].includes(response.status)) throw new Error("social-access-unavailable");
      if ([404, 410].includes(response.status)) throw new Error("social-unavailable");
      if (response.status !== 200) throw new Error("social-recheck-incomplete");
      return response;
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  }
  function failure(error: unknown) { const parsed = DiscourseReasonSchema.safeParse(error instanceof Error ? error.message : null); return parsed.success ? parsed.data : "social-invalid-response"; }
  return {
    async capture(input: { sourcePolicy: unknown; configuration: unknown; groupId: string; businessDate: string; windowStartUtc: string; cutoffUtc: string; signal?: AbortSignal }): Promise<DiscourseSample> {
      const source = SourcePolicySchema.parse(input.sourcePolicy);
      const configuration = DiscourseConfigurationSchema.parse(input.configuration);
      const group = configuration.groups.find((group) => group.id === input.groupId);
      if (!group || group.sourceId !== source.sourceId) throw new Error("invalid-capture-identity");
      const started = clock();
      const sample: DiscourseSample = { schemaVersion: 1, receiptId: randomUUID(), groupId: group.id, sourceId: source.sourceId, policyVersion: source.version, policySha256: policyDigest(source),
        configurationSha256: inputDigest(configuration), rulesSha256: inputDigest(discourseRules), businessDate: input.businessDate, windowStartUtc: input.windowStartUtc, cutoffUtc: input.cutoffUtc,
        capturedAtUtc: started, expiresAtUtc: new Date(Date.parse(started) + source.storage.retentionHours * 3600000).toISOString(), reason: null, receivedCount: 0, duplicateCount: 0, isolatedCount: 0, records: [] };
      DiscourseSampleSchema.parse(sample);
      if (!discoursePermission(source, group.tag, started)) sample.reason = "social-no-eligible-source";
      else if (input.windowStartUtc >= input.cutoffUtc || started > input.cutoffUtc) sample.reason = "social-after-cutoff";
      else {
        const deadline = Date.now() + discourseRules.deadlineMs;
        const endpoint = new URL(`/api/v1/timelines/tag/${encodeURIComponent(group.tag)}`, source.feedUrl);
        const cursors = new Set<string>();
        const keys = new Set<string>();
        const texts = new Set<string>();
        let cursor: string | null = null;
        try {
          for (let page = 0; page < discourseRules.maxPages; page++) {
            const url = new URL(endpoint); url.searchParams.set("local", "true"); url.searchParams.set("limit", String(discourseRules.pageSize));
            if (cursor) url.searchParams.set("max_id", cursor);
            const response = await get(url.href, source, deadline, input.signal);
            sample.capturedAtUtc = clock();
            if (sample.capturedAtUtc > input.cutoffUtc) throw new Error("social-after-cutoff");
            const records = z.array(z.unknown()).max(40).parse(JSON.parse(response.body));
            if (!records.length) break;
            for (const raw of records) {
              if (sample.receivedCount >= Math.min(discourseRules.maxItems, source.limits.maxItems)) throw new Error("social-sample-limit");
              sample.receivedCount++;
              try {
                const record = statusRecord(raw, input.windowStartUtc, input.cutoffUtc, group.tag, endpoint.origin);
                if (group.language !== null && record.language !== group.language) { sample.isolatedCount++; continue; }
                if (keys.has(record.id) || texts.has(record.text)) { sample.duplicateCount++; continue; }
                keys.add(record.id); texts.add(record.text); sample.records.push(record);
              } catch { sample.isolatedCount++; }
            }
            const links = [...(response.headers.link ?? "").matchAll(/<([^>]+)>\s*;\s*rel="next"/g)];
            if (links.length !== 1) throw new Error("social-pagination-incomplete");
            const next = new URL(links[0]![1]!);
            const values = next.searchParams.getAll("max_id");
            if (next.origin !== endpoint.origin || next.pathname !== endpoint.pathname || next.username || next.password || next.hash || values.length !== 1 || !values[0] || values[0].length > 200 || cursors.has(values[0])) throw new Error("social-pagination-incomplete");
            cursor = values[0]; cursors.add(cursor);
            if (page === discourseRules.maxPages - 1) throw new Error("social-pagination-incomplete");
          }
        } catch (error) { sample.reason = failure(error); sample.isolatedCount += sample.records.length; sample.records = []; }
      }
      const checked = DiscourseSampleSchema.parse(sample);
      for (const [key, value] of receipts) if (value.expiresAtUtc <= started) receipts.delete(key);
      if (receipts.size >= 100) receipts.delete(receipts.keys().next().value!);
      receipts.set(checked.receiptId, { digest: inputDigest(checked), expiresAtUtc: checked.expiresAtUtc, tag: group.tag, sourceId: source.sourceId, policySha256: policyDigest(source), origin: new URL(source.feedUrl).origin });
      return checked;
    },
    async revalidate(sample: DiscourseSample, source: SourcePolicy, signal?: AbortSignal): Promise<string | null> {
      const receipt = receipts.get(sample.receiptId);
      if (!receipt || receipt.digest !== inputDigest(sample)) return "social-snapshot-unavailable";
      const current = SourcePolicySchema.safeParse(source);
      if (!current.success || !discoursePermission(current.data, receipt.tag, clock()) || current.data.sourceId !== receipt.sourceId ||
        policyDigest(current.data) !== receipt.policySha256 || new URL(current.data.feedUrl).origin !== receipt.origin) {
        receipts.delete(sample.receiptId); return "social-permission-changed";
      }
      source = current.data;
      if (receipt.expiresAtUtc <= clock()) { receipts.delete(sample.receiptId); return "social-expired"; }
      if (sample.reason) return sample.reason;
      const deadline = Date.now() + discourseRules.deadlineMs;
      try {
        for (const record of sample.records) {
          const url = new URL(`/api/v1/statuses/${encodeURIComponent(record.id)}`, source.feedUrl);
          const response = await get(url.href, source, deadline, signal);
          const current = statusRecord(JSON.parse(response.body), sample.windowStartUtc, sample.cutoffUtc, receipt.tag, receipt.origin);
          if (current.id !== record.id || current.fingerprint !== record.fingerprint) throw new Error("social-changed");
        }
        if (signal?.aborted) throw new Error("social-cancelled");
        if (Date.now() >= deadline) throw new Error("social-timeout");
        if (receipt.expiresAtUtc <= clock()) throw new Error("social-expired");
        return null;
      } catch (error) { receipts.delete(sample.receiptId); return failure(error); }
    },
  };
}
