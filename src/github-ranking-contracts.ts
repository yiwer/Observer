import { z } from "zod";
import { GitHubPolicyIdentitySchema, GitHubWatchItemSchema } from "./github-contracts.ts";

// Frozen engineering defaults, not statistically calibrated quality estimates.
// Formula strings are audit descriptions; they are never evaluated as code.
export const heatRules = Object.freeze({
  starsWeight: 0.6, forksWeight: 0.4, topicGain: 0.15, frequencyPenalty: 0.25,
  coldStars: 10, coldForks: 2, minimumCohort: 4, target: 7, sortScale: 1e12, dayMs: 86400000,
  cooldownDays: 7, recoveryDays: 30, noveltyDays: 30, frequencyDays: 90,
  measured: "max(0,signedDelta)*dayMs/(current.observedAtUtc-historical.observedAtUtc)",
  cold: "stock/max(1,(cutoffUtc-createdAtUtc)/dayMs)",
  percentile: "x<=0?0:(count(peer<x)+0.5*count(peer===x))/peerCount",
  score: "(starsWeight*starsPercentile+forksWeight*forksPercentile)*(1+topicGain*maxMatchedPriority/100)*clamp((elapsedDays-cooldownDays)/recoveryDays,0,1)/(1+frequencyPenalty*count90d)",
  eligibility: "valid-age && attention-floor && !topic-excluded && history-available && raw-score>0",
  cohort: "same-partition: language+age; if size<minimumCohort use age; if size<minimumCohort use partition; peers include all observation-qualified valid-age candidates before editorial filters",
  windows: "age [0,30),[30,365),[365,infinity); report windows (cutoff-D,cutoff]; exactly7d recovery0; exactly37d recovery1",
  order: "measured-before-cold; Math.round(raw-score*sortScale) descending; opaque-node Unicode-code-point ascending; raw-score>0 is not rounded",
  selection: "N=min(target,eligibleCount,2*eligibleNovelCount); reserve first ceil(N/2) novel, fill in eligible order, emit chosen in total order; zero novel means zero items",
});
const HeatRulesSchema = z.strictObject({
  starsWeight: z.literal(heatRules.starsWeight), forksWeight: z.literal(heatRules.forksWeight), topicGain: z.literal(heatRules.topicGain), frequencyPenalty: z.literal(heatRules.frequencyPenalty),
  coldStars: z.literal(heatRules.coldStars), coldForks: z.literal(heatRules.coldForks), minimumCohort: z.literal(heatRules.minimumCohort), target: z.literal(heatRules.target), sortScale: z.literal(heatRules.sortScale), dayMs: z.literal(heatRules.dayMs),
  cooldownDays: z.literal(heatRules.cooldownDays), recoveryDays: z.literal(heatRules.recoveryDays), noveltyDays: z.literal(heatRules.noveltyDays), frequencyDays: z.literal(heatRules.frequencyDays),
  measured: z.literal(heatRules.measured), cold: z.literal(heatRules.cold), percentile: z.literal(heatRules.percentile), score: z.literal(heatRules.score), eligibility: z.literal(heatRules.eligibility), cohort: z.literal(heatRules.cohort), windows: z.literal(heatRules.windows), order: z.literal(heatRules.order), selection: z.literal(heatRules.selection),
});
export const GitHubCoverageHistorySchema = z.strictObject({
  entries: z.array(z.strictObject({ versionId: z.string(), businessDate: z.iso.date(), publishedAtUtc: z.iso.datetime({ precision: 3, offset: false }),
    reportRecordSha256: z.string().regex(/^[a-f0-9]{64}$/), nodeIds: z.array(z.string()).max(7), policies: z.array(GitHubPolicyIdentitySchema) })),
  unavailableVersionIds: z.array(z.string()),
});
export type GitHubCoverageHistory = z.infer<typeof GitHubCoverageHistorySchema>;
export const GitHubRankingSchema = z.strictObject({
  algorithmVersion: z.literal("observer-github-heat-v1"),
  rules: HeatRulesSchema,
  history: GitHubCoverageHistorySchema,
  unranked: z.array(GitHubWatchItemSchema.pick({ nodeId: true, status: true, reason: true })).max(50),
  candidates: z.array(z.strictObject({ nodeId: z.string(), score: z.number().finite(), sortKey: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), selected: z.boolean(), reason: z.enum(["selected", "capacity", "novelty-quota", "attention-insufficient", "cooldown", "history-unavailable", "topic-excluded", "invalid-age"]),
    partition: z.enum(["measured", "cold-start"]), starsSignal: z.number().nonnegative(), forksSignal: z.number().nonnegative(), starsPercentile: z.number().min(0).max(1), forksPercentile: z.number().min(0).max(1), baseScore: z.number().nonnegative(),
    selection: z.enum(["novelty-reserved", "rank-fill"]).nullable(),
    interestMultiplier: z.number().min(1).max(1.15), matchedTopics: z.array(z.string()),
    lastReportedAtUtc: z.iso.datetime({ precision: 3, offset: false }).nullable(), reportCount90d: z.number().int().nonnegative(), novel: z.boolean(), recoveryMultiplier: z.number().min(0).max(1), frequencyMultiplier: z.number().positive().max(1),
    cohort: z.strictObject({ language: z.string().nullable(), age: z.enum(["0-29d", "30-364d", "365d+", "unknown"]), fallback: z.enum(["language-age", "age", "partition"]), memberNodeIds: z.array(z.string()).max(50) }),
  })).max(50),
  selectedNodeIds: z.array(z.string()).max(7),
  quota: z.strictObject({ target: z.literal(7), actual: z.number().int().min(0).max(7), requiredNovel: z.number().int().min(0).max(4), selectedNovel: z.number().int().min(0).max(7), eligibleNovel: z.number().int().min(0).max(50) }),
});
