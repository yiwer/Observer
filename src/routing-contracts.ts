import { z } from "zod";
import { AgentExecutionSchema } from "./agent-execution.ts";

// Trusted observer-routing-v1 storage bound, also used by read-only assemblies.
// A receipt cannot raise this limit by supplying its own configuration.
export const MAX_ROUTING_AUDIT_BYTES = 64 * 1024 * 1024;

const id = z.string().min(1).max(200), sha = z.string().regex(/^[a-f0-9]{64}$/);
const utc = z.iso.datetime({ precision: 3, offset: false });
export const ProviderSchema = z.enum(["codex", "claude"]);
export type Provider = z.infer<typeof ProviderSchema>;
export const RoutingLimitsSchema = z.strictObject({ version: z.literal(1).default(1), attemptTimeoutMs: z.number().int().min(100).max(300000).default(60000), totalTimeoutMs: z.number().int().min(1000).max(3600000).default(900000), cleanupTimeoutMs: z.number().int().min(100).max(10000).default(1000),
  maxConcurrentProcesses: z.number().int().min(1).max(4).default(2), maxConcurrentExternalRequests: z.number().int().min(1).max(4).default(2),
  maxModelRequestsPerAttempt: z.number().int().min(1).max(8).default(4), maxExternalRequests: z.number().int().min(1).max(672).default(336), maxAuditBytes: z.number().int().min(65536).max(MAX_ROUTING_AUDIT_BYTES).default(MAX_ROUTING_AUDIT_BYTES),
  maxResearchAttempts: z.number().int().min(0).max(24).default(24), maxVerificationAttempts: z.number().int().min(0).max(30).default(30), maxReviewAttempts: z.number().int().min(0).max(30).default(30), sameProviderRetries: z.number().int().min(0).max(1).default(0), maxObservedTokens: z.number().int().min(1).max(1000000000).default(2000000) });
export const RoutingConfigurationSchema = z.strictObject({ schemaVersion: z.literal(1), version: z.number().int().positive(), primary: ProviderSchema,
  limits: RoutingLimitsSchema.default({ version: 1, attemptTimeoutMs: 60000, totalTimeoutMs: 900000, cleanupTimeoutMs: 1000, maxConcurrentProcesses: 2, maxConcurrentExternalRequests: 2, maxModelRequestsPerAttempt: 4, maxExternalRequests: 336, maxAuditBytes: MAX_ROUTING_AUDIT_BYTES,
    maxResearchAttempts: 24, maxVerificationAttempts: 30, maxReviewAttempts: 30, sameProviderRetries: 0, maxObservedTokens: 2000000 }) });
export const ProviderEligibilitySchema = z.strictObject({ version: z.number().int().positive(), provider: ProviderSchema, enabled: z.boolean(), accountEligible: z.boolean(), regionEligible: z.boolean(),
  scope: z.enum(["protocol-fixture", "live"]), checkedAtUtc: utc, validUntilUtc: utc, evidenceReference: id });
export const RoutingResponseUsageSchema = z.strictObject({ request: z.number().int().min(1).max(8), inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(), costUsd: z.number().nonnegative().nullable() });
export const RoutingAttemptSchema = z.strictObject({ id, edition: z.enum(["world-affairs", "ai", "finance", "frontier-technology", "social-discourse", "github-projects"]),
  role: z.enum(["research", "verification", "review"]), provider: ProviderSchema, status: z.enum(["started", "succeeded", "failed"]), inputSha256: sha, qualificationSha256: sha,
  startedAtUtc: utc, finishedAtUtc: utc.nullable(), reason: id.nullable(), modelRequests: z.number().int().min(0).max(8),
  execution: AgentExecutionSchema.nullable(), usageSource: z.enum(["cli-turn", "cli-model-tree", "model-responses", "unknown"]),
  observedResponses: z.array(RoutingResponseUsageSchema).max(8),
  usage: z.strictObject({ inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable(), costUsd: z.number().nonnegative().nullable() }) });
export const RoutingReceiptSchema = z.strictObject({ schemaVersion: z.literal(1), rules: z.literal("observer-routing-v1"), runId: id, taskId: id, evidenceBundleId: id, configurationId: id,
  configuration: RoutingConfigurationSchema, configurationSha256: sha, externalRequests: z.number().int().min(0).max(672),
  qualifications: z.array(ProviderEligibilitySchema.extend({ configurationSha256: sha })).max(16),
  qualificationOverflow: ProviderEligibilitySchema.extend({ configurationSha256: sha }).nullable(),
  usageProtection: z.strictObject({ observedTokens: z.string().regex(/^(0|[1-9][0-9]{0,19})$/), unknownAttempts: z.number().int().min(0).max(84), accounting: z.enum(["not-observed", "complete", "incomplete"]), thresholdReached: z.boolean(), exceeded: z.boolean() }),
  collection: z.strictObject({ status: z.enum(["available", "partial", "unavailable"]), linkEvidenceIds: z.array(id).max(10000) }),
  outcome: z.enum(["pending", "research-available", "agents-unavailable-collection-available", "agents-unavailable-collection-partial", "agents-unavailable-collection-unavailable"]),
  decisions: z.array(z.strictObject({ sequence: z.number().int().positive(), edition: id, provider: ProviderSchema.nullable(), state: z.enum(["queued", "provider-disabled", "primary-selected", "fallback-selected", "research-completed", "research-failed", "no-evidence", "deadline-exhausted", "cleanup-unverified", "request-budget-exhausted", "runner-unavailable", "audit-budget-exhausted", "attempt-budget-exhausted", "provider-retry", "usage-budget-exhausted", "provider-isolated"]), atUtc: utc })).max(512),
  reviews: z.array(z.strictObject({ inputSha256: sha, storyId: id, claimId: id, inputClaimSha256: sha, primaryProvider: ProviderSchema, reviewProvider: ProviderSchema.nullable(),
    primaryAssessmentSha256: sha, reviewAssessmentSha256: sha.nullable(), outcome: z.enum(["agreed", "disputed", "review-unavailable", "invalid-review", "unsafe-review"]) })).max(15000),
  attempts: z.array(RoutingAttemptSchema).max(84), status: z.enum(["running", "ready", "published", "failed"]), reportVersionId: id.nullable(), failureReason: id.nullable() });
export type RoutingReceipt = z.infer<typeof RoutingReceiptSchema>;
export const FinalEditorReceiptSchema = z.strictObject({ contract: z.literal("observer-final-editor-v1"), inputRecordSha256: sha,
  capabilities: z.strictObject({ network: z.literal(false), shell: z.literal(false) }), status: z.literal("completed") });
