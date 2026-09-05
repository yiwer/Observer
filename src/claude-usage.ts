import { z } from "zod";
import type { ModelUsageReceipt, TokenUsage } from "./contracts.ts";
import { researchUsage, unknownUsage } from "./agent-usage.ts";

const count = z.number().int().nonnegative().nullable().optional();
const usageSchema = z.object({ input_tokens: count, output_tokens: count, cache_read_input_tokens: count, cache_creation_input_tokens: count,
  output_tokens_details: z.object({ thinking_tokens: count }).optional() });
function tokens(usage: z.infer<typeof usageSchema>): TokenUsage {
  return { inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null, cachedInputTokens: usage.cache_read_input_tokens ?? null,
    cacheWriteInputTokens: usage.cache_creation_input_tokens ?? null, reasoningOutputTokens: usage.output_tokens_details?.thinking_tokens ?? null, costUsd: null };
}
export function messageEvents(body: string): Record<string, unknown>[] {
  const values: unknown[] = body.trimStart().startsWith("{") ? [JSON.parse(body)] : body.split(/\r?\n/)
    .filter((line) => line.startsWith("data:")).map((line) => JSON.parse(line.slice(5)));
  return z.array(z.record(z.string(), z.unknown())).parse(values);
}
export function readMessagesUsage(body: string, model: string): TokenUsage {
  try {
    const events = messageEvents(body);
    const starts = events.filter((event) => ["message", "message_start"].includes(String(event.type)));
    const deltas = events.filter((event) => event.type === "message_delta");
    if (starts.length !== 1 || deltas.length > 1) return unknownUsage();
    const message = z.object({ model: z.literal(model), usage: usageSchema }).parse(starts[0]!.message ?? starts[0]);
    const usage = { ...message.usage };
    if (deltas.length) Object.assign(usage, usageSchema.parse(deltas[0]!.usage));
    return tokens(usage);
  } catch { return unknownUsage(); }
}

// Claude's modelUsage is whole-tree accounting; usage is the main loop only.
// Never add either aggregate to the host's per-send receipts.
export function claudeResearchUsage(stdout: string, receipts: ModelUsageReceipt[]) {
  const fallback = () => researchUsage(unknownUsage(), receipts);
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
      return { ...total, source: "cli-model-tree" as const, modelResponses: receipts };
    }
    return researchUsage(tokens(usageSchema.parse(result.usage)), receipts);
  } catch { return fallback(); }
}
