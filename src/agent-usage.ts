import type { ModelUsageReceipt, TokenUsage } from "./contracts.ts";

export function unknownUsage(): TokenUsage {
  return { inputTokens: null, outputTokens: null, cachedInputTokens: null, cacheWriteInputTokens: null, reasoningOutputTokens: null, costUsd: null };
}

export function researchUsage(cli: TokenUsage, receipts: ModelUsageReceipt[]) {
  if (Object.values(cli).some((value) => value !== null)) return { ...cli, source: "cli-turn" as const, modelResponses: receipts };
  const total = unknownUsage();
  for (const key of Object.keys(total) as (keyof TokenUsage)[]) {
    if (key === "costUsd" || !receipts.length || receipts.some((receipt) => receipt[key] === null)) continue;
    const sum = receipts.reduce((sum, receipt) => sum + receipt[key]!, 0);
    if (Number.isSafeInteger(sum)) total[key] = sum;
  }
  return { ...total, source: receipts.length ? "model-responses" as const : "unknown" as const, modelResponses: receipts };
}
