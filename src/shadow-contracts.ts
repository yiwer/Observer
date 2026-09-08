import { z } from "zod";
import { ScheduledSnapshotSchema } from "./scheduled-publication.ts";
import { ProductionConfigurationSchema } from "./production-runtime.ts";
import { DiscourseSampleSchema } from "./discourse-contracts.ts";
import { PublishedReportSchema } from "./contracts.ts";
import { ProviderSchema } from "./routing-contracts.ts";

const id = z.string().min(1).max(200), utc = z.iso.datetime({ precision: 3, offset: false });
export const shadowRules = Object.freeze({
  version: "observer-shadow-v1-draft-1", watchFraction: 0.2, supportedFraction: 0.98,
  sampling: "all-priority-plus-first-ceil-watch-count-times-0.2-in-seeded-shuffle-per-provider",
  facts: "human-split-every-selected-claim-including-attribution-quotation-and-factual-premises-of-analysis",
  denominator: "all-human-enumerated-facts;unsupported-conflicting-and-unverifiable-are-not-supported;empty-is-null",
  missing: "missing-split-or-judgment-is-incomplete;links-only-and-fixtures-never-model-quality-pass",
  comparison: "same-day-same-frozen-input-config-code-and-rules;provider-choice-is-only-treatment;no-best-retry-selection",
  serious: "wrong-person-country-date-or-number-changing-conclusion;inverted-causality;unsafe-financial-or-security-claim;false-attribution",
  timing: "actual-authenticated-server-read-completion;08:30-inclusive;missing-at-12:00;email-is-not-readability",
});
export const ShadowConfigurationSchema = z.strictObject({ schemaVersion: z.literal(1), enabled: z.boolean().default(false),
  directory: z.string().min(1), productionDataDirectory: z.string().min(1), sourceConfigurationPath: z.string().min(1), rightsContractPath: z.string().min(1),
  servers: z.strictObject({ codex: z.url().optional(), claude: z.url().optional() }).default({}) });
export type ShadowConfiguration = z.infer<typeof ShadowConfigurationSchema>;
export const CampaignSchema = z.strictObject({ id, startBusinessDate: z.iso.date(), days: z.number().int().min(1).max(366).default(14),
  scope: z.enum(["live", "protocol-fixture"]), codeVersion: id, applicationVersion: id,
  rulesVersion: z.literal(shadowRules.version), approvedBy: id, approvedAtUtc: utc,
  providers: z.strictObject({ codex: z.strictObject({ model: id, cliVersion: id, runnerVersion: id }), claude: z.strictObject({ model: id, cliVersion: id, runnerVersion: id }) }),
});
export type Campaign = z.infer<typeof CampaignSchema>;
export const FrozenShadowInputSchema = ScheduledSnapshotSchema.extend({
  configuration: ProductionConfigurationSchema,
  request: ScheduledSnapshotSchema.shape.request.extend({ discourseSamples: z.array(DiscourseSampleSchema).max(10).optional() }),
});
export type FrozenShadowInput = z.infer<typeof FrozenShadowInputSchema>;
export const FreezeShadowSchema = z.strictObject({ campaignId: id, batchId: id, input: FrozenShadowInputSchema });
export const StartShadowSchema = z.strictObject({ batchId: id, provider: ProviderSchema });
export const FailureShadowSchema = z.strictObject({ attemptId: id, reason: z.enum(["unavailable", "timeout", "invalid-output", "process-failed", "interrupted", "policy-blocked"]),
  costUsd: z.number().nonnegative().nullable().default(null) });
export const CompleteShadowSchema = z.strictObject({ attemptId: id, inputFingerprint: z.string().regex(/^[a-f0-9]{64}$/), codeVersion: id,
  report: PublishedReportSchema, history: z.array(PublishedReportSchema).max(100).default([]) });
export const FactJudgmentSchema = z.strictObject({ text: z.string().min(1).max(4000),
  verdict: z.enum(["supported", "unsupported", "conflicting", "unverifiable"]), evidenceRefs: z.array(id).max(50),
  basis: z.string().min(1).max(2000), fabricatedSource: z.boolean(), seriousError: z.boolean(), wrongAttribution: z.boolean(),
});
export const ReviewShadowSchema = z.strictObject({ attemptId: id, reviewer: id, reviewedAtUtc: utc,
  finalized: z.boolean().default(true),
  claims: z.array(z.strictObject({ key: id, facts: z.array(FactJudgmentSchema).max(100), noFactReason: z.string().max(2000).nullable() })).max(20000),
  // Overall items require an explicit human assessment; zero must be an observed zero.
  omissions: z.number().int().nonnegative(), duplicates: z.number().int().nonnegative(), classificationErrors: z.number().int().nonnegative(),
  expression: z.enum(["clear", "minor-issues", "major-issues"]), notes: z.string().max(4000),
});
export type ShadowReview = z.infer<typeof ReviewShadowSchema>;
export interface ShadowClaim { key: string; itemKey: string; kind: string; text: string; evidenceRefs: string[]; }
export interface ShadowItem { key: string; edition: string; storyId: string; sourceVersionId: string; priority: boolean; selected: boolean; claims: ShadowClaim[]; }
