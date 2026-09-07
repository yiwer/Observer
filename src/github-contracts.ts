import { z } from "zod";
import type { GitHubRepromotionSnapshot, GitHubPublicationContext } from "./github-development-contracts.ts";

const utc = z.iso.datetime({ precision: 3, offset: false });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const nodeId = z.string().min(1).max(200).regex(/^[^\u0000-\u001f\u007f]+$/u);
const fullName = z.string().regex(/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/).refine((value) => value.split("/").every((part) => part !== "." && part !== ".."));
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const githubRules = Object.freeze({ version: "observer-github-observations-v1", apiVersion: "2026-03-10", minute: 25,
  maxPages: 3, pageSize: 30, maxCandidates: 50, maxQueries: 3, maxRedirects: 2, deadlineMs: 120000, currentToleranceMinutes: 15, historicalToleranceMinutes: 60, maxWatchItems: 7 });
export const GitHubConfigurationSchema = z.strictObject({ schemaVersion: z.literal(1), version: z.number().int().positive(), sourceId: z.string().min(1).max(200),
  queries: z.array(z.string().min(1).max(200).refine((query) => !/[\u0000-\u001f]/.test(query))).min(1).max(3),
}).refine((value) => new Set(value.queries).size === value.queries.length);
export type GitHubConfiguration = z.infer<typeof GitHubConfigurationSchema>;
export const GitHubPolicyIdentitySchema = z.strictObject({ sourceId: z.string().min(1).max(200), policyVersion: z.number().int().positive(), policySha256: sha256 });
export const DevelopmentConfigurationSchema = z.strictObject({ schemaVersion: z.literal(1), version: z.number().int().positive(), sourceId: z.string().min(1).max(200), releases: z.boolean(), advisories: z.boolean().optional(), momentum: z.boolean().optional() });
export type DevelopmentConfiguration = z.infer<typeof DevelopmentConfigurationSchema>;
export const ContextFreezeSchema = z.strictObject({ epoch: z.string().min(1).max(200), generation: z.number().int().nonnegative(), slot: utc, frozenAtUtc: utc, nodeId: z.string().min(1).max(200),
  count: z.number().int().nonnegative().max(1000), bytes: z.number().int().nonnegative().max(16 * 1024 * 1024), digest: sha256,
  usedCount: z.number().int().nonnegative().max(1000), usedDigest: sha256 });
export type ContextFreeze = z.infer<typeof ContextFreezeSchema>;
export const GitHubRepositorySchema = z.object({ node_id: nodeId, full_name: fullName, private: z.boolean(), archived: z.boolean(), disabled: z.boolean(), fork: z.boolean(),
  mirror_url: z.string().nullable(), visibility: z.string().max(100).optional(), is_template: z.boolean().optional(), stargazers_count: count, forks_count: count,
  language: z.string().max(200).nullable(), created_at: z.iso.datetime({ offset: true }), topics: z.array(z.string().max(200)).max(100).optional() });
export const GitHubReasonSchema = z.enum(["github-no-eligible-source", "github-permission-changed", "github-configuration-changed", "github-credential-unavailable", "github-credential-expired",
  "github-policy-version-conflict", "github-configuration-version-conflict",
  "github-ordinary-candidate-unsupported",
  "github-access-unavailable", "github-rate-limited", "github-network-failed", "github-timeout", "github-cancelled", "github-invalid-response", "github-response-too-large", "github-unsafe-route",
  "github-pagination-incomplete", "github-search-incomplete", "github-candidate-limit", "github-identity-changed", "github-ineligible", "github-risk-unknown", "github-current-missing", "github-historical-missing",
  "github-after-cutoff", "github-observation-unavailable", "github-no-observations", "github-clock-invalid"]);
export type GitHubReason = z.infer<typeof GitHubReasonSchema>;
export const GitHubObservationSchema = z.strictObject({ id: sha256, nodeId, fullName, observedAtUtc: utc, availableAtUtc: utc,
  responseSha256: sha256, stars: count.nullable(), forks: count.nullable(), reason: GitHubReasonSchema.nullable(),
  language: z.string().max(200).nullable(), createdAtUtc: utc.nullable(), topics: z.array(z.string().max(200)).max(100).nullable() });
export type GitHubObservation = z.infer<typeof GitHubObservationSchema>;
export const GitHubRunSchema = z.strictObject({ id: sha256, scheduledAtUtc: utc, startedAtUtc: utc, availableAtUtc: utc, resumeAtUtc: utc.nullable(),
  configuration: GitHubConfigurationSchema, configurationSha256: sha256, policy: GitHubPolicyIdentitySchema.nullable(),
  attribution: z.string().max(2000).nullable(), limits: z.strictObject({ pageSize: count, candidateLimit: count, pollIntervalSeconds: count, timeoutMs: count, maxRedirects: count }),
  queries: z.array(z.strictObject({ query: z.string().max(200), pages: count, receivedCount: count, totalCount: count.nullable(), reason: GitHubReasonSchema.nullable() })).max(3),
  reasons: z.array(GitHubReasonSchema), observations: z.array(GitHubObservationSchema).max(50),
});
export type GitHubRun = z.infer<typeof GitHubRunSchema>;
export const GitHubWatchItemSchema = z.strictObject({ nodeId, fullName, status: z.enum(["measured", "cold-start", "missing", "quarantined"]),
  current: GitHubObservationSchema.nullable(), historical: GitHubObservationSchema.nullable(), starsDelta: z.number().int().nullable(), forksDelta: z.number().int().nullable(),
  firstSeenAtUtc: utc, identityHistory: z.array(z.strictObject({ fullName, observedAtUtc: utc })), reason: GitHubReasonSchema.nullable() });
export const GitHubIdentitySummarySchema = z.strictObject({ nodeId, firstSeenAtUtc: utc, historySha256: sha256,
  names: z.array(z.strictObject({ fullName, observedAtUtc: utc })).max(8), truncated: z.boolean() });
export const GitHubSnapshotSchema = z.strictObject({ schemaVersion: z.literal(1), rulesVersion: z.literal("observer-github-observations-v1"),
  cutoffUtc: utc, configuration: GitHubConfigurationSchema.nullable(), configurationSha256: sha256.nullable(),
  runs: z.array(GitHubRunSchema).max(101), identities: z.array(GitHubIdentitySummarySchema).max(50), reasons: z.array(GitHubReasonSchema), watchItems: z.array(GitHubWatchItemSchema).max(7), exclusions: z.array(GitHubWatchItemSchema).max(50) });
export type GitHubSnapshot = z.infer<typeof GitHubSnapshotSchema>;
export const GitHubRankingSnapshotSchema = GitHubSnapshotSchema.extend({ schemaVersion: z.literal(2), watchItems: z.array(GitHubWatchItemSchema).max(50) });
export type GitHubRankingSnapshot = z.infer<typeof GitHubRankingSnapshotSchema>;
export type SyncResult<T> = T extends PromiseLike<unknown> ? never : T;
export interface DevelopmentHistoryReadScope {
  authorize(snapshot: GitHubRepromotionSnapshot): GitHubReason | null;
  authorizeDevelopmentHistory(snapshot: GitHubRepromotionSnapshot, publication?: GitHubPublicationContext): GitHubReason | null;
}
export interface GitHubObservationReader {
  snapshot(cutoffUtc: string): GitHubSnapshot;
  rankingSnapshot?(cutoffUtc: string): GitHubRankingSnapshot;
  repromotionSnapshot?(cutoffUtc: string): GitHubRepromotionSnapshot;
  authorizeDevelopmentHistory?(snapshot: GitHubRepromotionSnapshot, publication?: GitHubPublicationContext): GitHubReason | null;
  withDevelopmentHistoryRead?<T>(use: (scope: DevelopmentHistoryReadScope) => T & SyncResult<T>): T;
  authorize(snapshot: GitHubSnapshot | GitHubRankingSnapshot | GitHubRepromotionSnapshot): GitHubReason | null;
}
