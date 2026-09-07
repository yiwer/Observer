import { z } from "zod";
import { GitHubPolicyIdentitySchema, GitHubRankingSnapshotSchema, GitHubConfigurationSchema, DevelopmentConfigurationSchema, ContextFreezeSchema, type DevelopmentConfiguration, type ContextFreeze } from "./github-contracts.ts";
export { DevelopmentConfigurationSchema, ContextFreezeSchema, type DevelopmentConfiguration, type ContextFreeze } from "./github-contracts.ts";
import { GitHubRankingSchema } from "./github-ranking-contracts.ts";
import { AdvisoryCollectionSchema, AdvisoryDevelopmentSchema, type SecurityVerificationInput } from "./github-advisory-contracts.ts";
import type { InterestSnapshot } from "./interest-contracts.ts";
import type { GitHubCoverageHistory } from "./github-ranking.ts";
import { MomentumDevelopmentSchema, MomentumSnapshotSchema } from "./github-momentum-contracts.ts";

const utc = z.iso.datetime({ precision: 3, offset: false });
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().min(1).max(200);
export const ReleaseSchema = z.object({ id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), node_id: id,
  name: z.string().max(4000).nullable(), tag_name: z.string().max(1000), target_commitish: z.string().max(1000), draft: z.boolean(), prerelease: z.boolean(),
  created_at: z.iso.datetime({ offset: true }), published_at: z.iso.datetime({ offset: true }).nullable(), updated_at: z.iso.datetime({ offset: true }).nullable().optional(),
  immutable: z.boolean().optional(), body: z.string().max(1000000).nullable().optional() });
export const ReleaseEvidenceSchema = z.strictObject({ observationId: sha, nodeId: id, fullName: id, releaseId: z.number().int().nonnegative(), releaseNodeId: id,
  tag: z.string().max(1000), draft: z.boolean(), prerelease: z.boolean(), publishedAtUtc: utc.nullable(), updatedAtUtc: utc.nullable(),
  observedAtUtc: utc, availableAtUtc: utc, responseSha256: sha, bodySha256: sha, policy: GitHubPolicyIdentitySchema });
export type ReleaseEvidence = z.infer<typeof ReleaseEvidenceSchema>;
const ChangeSchema = z.strictObject({ category: z.enum(["breaking-interface", "major-capability", "major-direction"]), object: z.string().min(1).max(200), scope: z.string().min(1).max(500) });
export const DevelopmentAssessmentSchema = z.strictObject({ observationId: sha, conclusion: z.enum(["supported", "insufficient", "conflicting", "unsafe"]),
  materiality: z.enum(["major", "routine", "unknown"]), change: ChangeSchema.nullable(), evidenceExcerpt: z.string().refine((value) => [...value].length <= 500),
  relation: z.strictObject({ kind: z.enum(["same", "new-material", "unknown"]), previousDevelopmentId: sha.nullable() }) });
export type DevelopmentAssessment = z.infer<typeof DevelopmentAssessmentSchema>;
export const DevelopmentVerificationSchema = z.strictObject({ schemaVersion: z.literal(1), inputSha256: sha, provenance: z.enum(["annotated-fixture", "research-agent"]),
  verifierVersion: id, assessments: z.array(DevelopmentAssessmentSchema).max(20) });
export const ReleaseDevelopmentSchema = z.strictObject({ nodeId: id, eventId: sha, developmentId: sha, revisionId: sha, kind: z.literal("release"),
  observationId: sha, change: ChangeSchema, evidenceExcerpt: z.string().min(1).refine((value) => [...value].length <= 500) });
export type ReleaseDevelopment = z.infer<typeof ReleaseDevelopmentSchema>;
export const ReportedDevelopmentSchema = z.discriminatedUnion("kind", [ReleaseDevelopmentSchema, AdvisoryDevelopmentSchema, MomentumDevelopmentSchema]);
export const PreviousDevelopmentEvidenceSchema = z.strictObject({ evidence: ReleaseEvidenceSchema, githubRunId: sha, slot: utc,
  githubConfiguration: GitHubConfigurationSchema, configuration: DevelopmentConfigurationSchema, availableAtUtc: utc });
export type PreviousDevelopmentEvidence = z.infer<typeof PreviousDevelopmentEvidenceSchema>;
export interface DevelopmentContext { previous: ReleaseDevelopment[]; previousEvidence: PreviousDevelopmentEvidence[]; unavailable: boolean; freeze: ContextFreeze | null; }
export interface DevelopmentVerificationInput {
  schemaVersion: 1; inputSha256: string; evidence: (ReleaseEvidence & { body: string })[]; previous: ReleaseDevelopment[]; previousEvidence: PreviousDevelopmentEvidence[]; contextFreeze: ContextFreeze;
}
export interface GitHubDevelopmentVerifier { assess(input: DevelopmentVerificationInput): Promise<unknown>; assessSecurity?(input: SecurityVerificationInput): Promise<unknown>; }
export const DevelopmentRunSchema = z.strictObject({ schemaVersion: z.literal(1), id: sha, slot: utc, githubRunId: sha,
  configuration: DevelopmentConfigurationSchema, configurationSha256: sha, policy: GitHubPolicyIdentitySchema.nullable(), startedAtUtc: utc, availableAtUtc: utc,
  contextFreezes: z.array(ContextFreezeSchema).max(50),
  reasons: z.array(z.string().min(1).max(100)), evidence: z.array(ReleaseEvidenceSchema).max(1000),
  assessments: z.array(z.strictObject({ inputSha256: sha, evidenceIds: z.array(sha).max(20), previous: z.array(ReleaseDevelopmentSchema).max(1000), previousEvidence: z.array(PreviousDevelopmentEvidenceSchema).max(1000), contextFreeze: ContextFreezeSchema,
    verification: DevelopmentVerificationSchema.nullable(), completedAtUtc: utc })).max(50), developments: z.array(ReleaseDevelopmentSchema).max(1000), security: AdvisoryCollectionSchema.optional() });
export type DevelopmentRun = z.infer<typeof DevelopmentRunSchema>;
const PublicationProjectionSchema = z.strictObject({ schemaVersion: z.literal(1), origins: z.array(z.strictObject({ slot: utc, runId: sha })).max(1),
  omissions: z.array(z.strictObject({ nodeId: id, kind: z.enum(["release", "security"]) })).max(100) });
export const DevelopmentSnapshotSchema = z.strictObject({ schemaVersion: z.literal(1), cutoffUtc: utc, configuration: DevelopmentConfigurationSchema.nullable(), configurationSha256: sha.nullable(),
  runs: z.array(DevelopmentRunSchema).max(1), reasons: z.array(z.string().min(1).max(100)), publicationProjection: PublicationProjectionSchema.optional(), momentum: MomentumSnapshotSchema.optional() });
export type DevelopmentSnapshot = z.infer<typeof DevelopmentSnapshotSchema>;
export const GitHubRepromotionSnapshotSchema = z.strictObject({ schemaVersion: z.literal(1), github: GitHubRankingSnapshotSchema, developments: DevelopmentSnapshotSchema });
export type GitHubRepromotionSnapshot = z.infer<typeof GitHubRepromotionSnapshotSchema>;
const PublishedDevelopmentIdentitySchema = z.strictObject({ nodeId: id, kind: z.enum(["release", "security", "momentum"]), eventId: sha, developmentId: sha, revisionId: sha, observationId: sha });
export const GitHubEventHistorySchema = z.strictObject({ entries: z.array(z.strictObject({ versionId: id, businessDate: z.iso.date(), publishedAtUtc: utc, reportRecordSha256: sha,
  nodeIds: z.array(id).max(7), developments: z.array(PublishedDevelopmentIdentitySchema), policies: z.array(GitHubPolicyIdentitySchema) })).max(10000), unavailableVersionIds: z.array(id).max(10001) });
export type GitHubEventHistory = z.infer<typeof GitHubEventHistorySchema>;
export interface GitHubPublicationContext { interestProfile: InterestSnapshot; coverageHistory: GitHubCoverageHistory; eventHistory: GitHubEventHistory; algorithmVersion: "observer-github-repromotion-v1"; }
export const repromotionRules = Object.freeze({ recovery: 1, frequency: "retain-ordinary-frequency", quota: "actual=min(7,eligible,2*novel);reserve-ceil(actual/2)-novel", eventOrder: "security-before-release-before-momentum-before-ordinary;measured-before-cold;effective-sortKey-desc;node-codepoint-asc" });
export const GitHubRepromotionRankingSchema = z.strictObject({ algorithmVersion: z.literal("observer-github-repromotion-v1"),
  rules: z.strictObject({ recovery: z.literal(1), frequency: z.literal(repromotionRules.frequency), quota: z.literal(repromotionRules.quota), eventOrder: z.literal(repromotionRules.eventOrder) }),
  eventHistory: GitHubEventHistorySchema,
  candidates: z.array(GitHubRankingSchema.shape.candidates.element.extend({ ordinaryScore: z.number(), effectiveRecoveryMultiplier: z.number().min(0).max(1),
    reason: GitHubRankingSchema.shape.candidates.element.shape.reason.or(z.literal("security-risk-quarantined")),
    developments: z.array(ReportedDevelopmentSchema), eventReason: z.enum(["eligible-development", "no-development", "already-reported", "event-history-unavailable", "ordinary-ineligible", "security-risk-unconfirmed"]) })).max(50),
  selectedNodeIds: z.array(id).max(7), quota: GitHubRankingSchema.shape.quota, reportedDevelopments: z.array(ReportedDevelopmentSchema) });
