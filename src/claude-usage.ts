import { z } from "zod";
import type { ModelUsageReceipt, TokenUsage } from "./contracts.ts";
import { researchUsage, unknownUsage } from "./agent-usage.ts";

const count = z.number().int().nonnegative().nullable().optional();
const usageSchema = z.object({ input_tokens: count, output_tokens: count, cache_read_input_tokens: count, cache_creation_input_tokens: count,
  output_tokens_details: z.object({ thinking_tokens: count }).nullish() });
function tokens(usage: z.infer<typeof usageSchema>): TokenUsage {
  return { inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null, cachedInputTokens: usage.cache_read_input_tokens ?? null,
    cacheWriteInputTokens: usage.cache_creation_input_tokens ?? null, reasoningOutputTokens: usage.output_tokens_details?.thinking_tokens ?? null, costUsd: null };
}
export function* messageEvents(body: string): Generator<Record<string, unknown>> {
  const eventSchema = z.record(z.string(), z.unknown());
  if (body.trimStart().startsWith("{")) { yield eventSchema.parse(JSON.parse(body)); return; }
  // SSE dispatches only at an empty line, not EOF. Keep data lines in their
  // frame and use the last event field, as the consumer will do.
  const lines = body.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  let name = "", data: string[] = [];
  for (const line of lines.slice(0, -1)) {
    if (line === "") {
      if (data.length) {
        const event = eventSchema.parse(JSON.parse(data.join("\n")));
        if ((name || "message") !== event.type) throw new Error("model-event-name-mismatch");
        yield event;
      }
      name = ""; data = []; continue;
    }
    if (line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "event") name = value;
    if (field === "data") data.push(value);
  }
  if (name || data.length || (lines.at(-1) && !lines.at(-1)!.startsWith(":"))) throw new Error("incomplete-model-event");
}
export function readMessagesAccounting(body: string, model: string): { usage: TokenUsage; consistent: boolean } {
  let usage = unknownUsage(), started = false, ended = false, consistent = true;
  const conflicts = new Set<keyof TokenUsage>();
  const update = (key: keyof TokenUsage, value: unknown, required = false) => {
    if (conflicts.has(key) || (!required && value == null)) return;
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || (usage[key] !== null && value < usage[key])) {
      usage[key] = null; conflicts.add(key); consistent = false;
    } else usage[key] = value;
  };
  try {
    for (const event of messageEvents(body)) {
      if (event.type === "ping") continue;
      if (ended) { consistent = false; break; }
      if (event.type === "message" || event.type === "message_start") {
        if (started) { usage = unknownUsage(); consistent = false; break; }
        const message = z.object({ model: z.literal(model), usage: usageSchema }).parse(event.message ?? event);
        usage = tokens(message.usage); started = true;
      } else if (event.type === "message_delta") {
        if (!started) { consistent = false; break; }
        const delta = z.record(z.string(), z.unknown()).safeParse(event.usage);
        // Missing required output accounting is unknown, not the start's zero.
        update("outputTokens", delta.success ? delta.data.output_tokens : undefined, true);
        if (!delta.success) continue;
        update("inputTokens", delta.data.input_tokens);
        update("cachedInputTokens", delta.data.cache_read_input_tokens);
        update("cacheWriteInputTokens", delta.data.cache_creation_input_tokens);
        if (delta.data.output_tokens_details != null) {
          const details = z.record(z.string(), z.unknown()).safeParse(delta.data.output_tokens_details);
          update("reasoningOutputTokens", details.success ? details.data.thinking_tokens : undefined, true);
        }
      } else if (event.type === "message_stop") {
        ended = true;
      }
    }
  } catch { consistent = false; } // Preserve usage from dispatched earlier frames.
  return { usage, consistent: consistent && started };
}

// Claude's modelUsage is whole-tree accounting; usage is the main loop only.
// Never add either aggregate to the host's per-send receipts.
export function claudeResearchUsage(stdout: string, receipts: ModelUsageReceipt[]) {
  const fallback = () => researchUsage(unknownUsage(), receipts);
  const reconcile = (usage: TokenUsage, source: "cli-model-tree" | "cli-turn") => {
    const observed = fallback();
    // Pinned CLI can account at the first delta, before the final cumulative
    // usage arrives. Never prefer that estimate over our complete model sends.
    if (receipts.length && (Object.keys(unknownUsage()) as (keyof TokenUsage)[]).some((key) => key !== "costUsd" && usage[key] !== observed[key])) return observed;
    return { ...usage, source, modelResponses: receipts };
  };
  try {
    const results = stdout.trimEnd().split("\n").flatMap((line) => {
      try { const frame = JSON.parse(line); const event = frame.kind === "event" ? JSON.parse(frame.line) : null; return event?.type === "result" ? [event] : []; }
      catch { return []; }
    });
    if (results.length !== 1) return fallback();
    const result = z.object({ subtype: z.string(), modelUsage: z.unknown().optional(), usage: z.unknown().optional() }).parse(results[0]);
    // Crash synthesis can replace real consumption with zero totals.
    if (result.subtype === "error_during_execution") return fallback();
    if (result.modelUsage !== undefined) {
      const models = z.record(z.string(), z.object({ inputTokens: count, outputTokens: count, cacheReadInputTokens: count,
        cacheCreationInputTokens: count, costUSD: z.number().nonnegative().nullable().optional() })).parse(result.modelUsage);
      const entries = Object.values(models);
      if (!entries.length || entries.length > 8) return fallback();
      const total = unknownUsage();
      const fields = { inputTokens: "inputTokens", outputTokens: "outputTokens", cachedInputTokens: "cacheReadInputTokens", cacheWriteInputTokens: "cacheCreationInputTokens", costUsd: "costUSD" } as const;
      for (const [key, wire] of Object.entries(fields) as [keyof typeof fields, typeof fields[keyof typeof fields]][]) {
        if (entries.some((entry) => entry[wire] == null)) continue;
        const sum = entries.reduce((sum, entry) => sum + entry[wire]!, 0);
        if (!Number.isFinite(sum) || (key !== "costUsd" && !Number.isSafeInteger(sum))) continue;
        total[key] = sum;
      }
      return reconcile(total, "cli-model-tree");
    }
    const usage = researchUsage(tokens(usageSchema.parse(result.usage)), receipts);
    return usage.source === "cli-turn" ? reconcile(usage, "cli-turn") : usage;
  } catch { return fallback(); }
}
