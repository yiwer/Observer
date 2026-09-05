import { z } from "zod";
import type { TokenUsage } from "./contracts.ts";
import { unknownUsage } from "./agent-usage.ts";

const count = z.number().int().nonnegative().nullable().optional();
const responseUsage = z.object({
  input_tokens: count, output_tokens: count, total_tokens: count,
  input_tokens_details: z.object({ cached_tokens: count, cache_write_tokens: count }).nullable().optional(),
  output_tokens_details: z.object({ reasoning_tokens: count }).nullable().optional(),
});

// Only a single matching terminal response supplies a receipt. Never preserve
// response IDs or free-form data, and never pick a favorable duplicate frame.
export function readModelUsage(body: string, model: string): TokenUsage {
  try {
    const events: unknown[] = body.trimStart().startsWith("{") ? [JSON.parse(body)] : body.split("\n")
      .filter((line) => line.startsWith("data:") && line.slice(5).trim() !== "[DONE]").map((line) => JSON.parse(line.slice(5)));
    const responses = events.flatMap((value) => {
      const event = z.object({ type: z.string().optional(), object: z.string().optional(), response: z.unknown().optional() }).passthrough().parse(value);
      if (event.object === "response") return [event];
      return ["response.completed", "response.incomplete", "response.failed"].includes(event.type ?? "") ? [event.response] : [];
    });
    if (responses.length !== 1) return unknownUsage();
    const response = z.object({ model: z.literal(model), status: z.enum(["completed", "incomplete", "failed"]), usage: responseUsage }).parse(responses[0]);
    const usage = response.usage;
    if (usage.input_tokens != null && usage.output_tokens != null && usage.total_tokens != null && usage.input_tokens + usage.output_tokens !== usage.total_tokens) return unknownUsage();
    if ((usage.input_tokens_details?.cached_tokens ?? 0) > (usage.input_tokens ?? Infinity) ||
        (usage.input_tokens_details?.cache_write_tokens ?? 0) > (usage.input_tokens ?? Infinity) ||
        (usage.output_tokens_details?.reasoning_tokens ?? 0) > (usage.output_tokens ?? Infinity)) return unknownUsage();
    return { inputTokens: usage.input_tokens ?? null, outputTokens: usage.output_tokens ?? null,
      cachedInputTokens: usage.input_tokens_details?.cached_tokens ?? null, cacheWriteInputTokens: usage.input_tokens_details?.cache_write_tokens ?? null,
      reasoningOutputTokens: usage.output_tokens_details?.reasoning_tokens ?? null, costUsd: null };
  } catch { return unknownUsage(); }
}
