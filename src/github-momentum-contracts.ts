import { z } from "zod";
import { DevelopmentConfigurationSchema, GitHubConfigurationSchema, GitHubPolicyIdentitySchema, GitHubObservationSchema, GitHubReasonSchema, GitHubRunSchema } from "./github-contracts.ts";
import { AdvisoryCollectionSchema } from "./github-advisory-contracts.ts";

const sha = z.string().regex(/^[a-f0-9]{64}$/), utc = z.iso.datetime({ precision: 3, offset: false }), id = z.string().min(1).max(200);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const reasons = z.array(z.string().min(1).max(100)).max(500);
const RiskOriginSchema = z.strictObject({ slot: utc, developmentRunId: sha, availableAtUtc: utc, configuration: DevelopmentConfigurationSchema, policy: GitHubPolicyIdentitySchema.nullable() });
export const SecurityRiskWitnessSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("disabled"), origin: RiskOriginSchema.nullable() }),
  z.strictObject({ mode: z.literal("unavailable"), origin: RiskOriginSchema.nullable(), reason: z.enum(["missing-run", "permission", "resource-limit", "invalid-history"]) }),
  z.strictObject({ mode: z.literal("observed"), origin: RiskOriginSchema, nodes: z.array(z.strictObject({ nodeId: id,
    risks: z.array(AdvisoryCollectionSchema.shape.risks.element).max(3), historyUnavailable: z.boolean() })).max(50) }),
]);
const ObservationOriginSchema = z.strictObject({ slot: utc, githubRunId: sha, configuration: GitHubConfigurationSchema, policy: GitHubPolicyIdentitySchema, observation: GitHubObservationSchema });
export const MomentumPointSchema = z.strictObject({ schemaVersion: z.literal(1), id: sha, slot: utc, cutoffUtc: utc, availableAtUtc: utc,
  githubRunId: sha, configuration: GitHubConfigurationSchema, policy: GitHubPolicyIdentitySchema.nullable(), developmentConfiguration: DevelopmentConfigurationSchema.nullable(),
  rulesVersion: z.literal("observer-github-momentum-v1"), sampling: z.strictObject({ observationRules: z.literal("observer-github-observations-v1"), queries: GitHubConfigurationSchema.shape.queries,
    candidateLimit: count.max(50), currentToleranceMinutes: z.literal(15), historicalToleranceMinutes: z.literal(60) }),
  runReasons: z.array(GitHubReasonSchema), queries: GitHubRunSchema.shape.queries, security: SecurityRiskWitnessSchema,
  candidates: z.array(z.strictObject({ nodeId: id, status: z.enum(["measured", "cold-start", "missing", "quarantined"]),
    current: ObservationOriginSchema.nullable(), historical: ObservationOriginSchema.nullable(), reason: GitHubReasonSchema.nullable() })).max(50) });
export type MomentumPoint = z.infer<typeof MomentumPointSchema>;
export const MomentumCapsuleSchema = z.strictObject({ schemaVersion: z.literal(1), id: sha, nodeId: id, kind: z.enum(["startup", "reset"]),
  onsetObservationId: sha, points: z.array(MomentumPointSchema).min(1).max(29) });
export type MomentumCapsule = z.infer<typeof MomentumCapsuleSchema>;
export const MomentumDevelopmentSchema = z.strictObject({ nodeId: id, kind: z.literal("momentum"), eventId: sha, developmentId: sha, revisionId: sha,
  observationId: sha, capsuleId: sha, materialRevision: z.literal("initial-exceptional-momentum") });
export const MomentumSnapshotSchema = z.strictObject({ schemaVersion: z.literal(1), rulesVersion: z.literal("observer-github-momentum-v1"), cutoffUtc: utc,
  freeze: z.strictObject({ epoch: id, generation: count, pointId: sha.nullable(), pointSlot: utc.nullable() }), point: MomentumPointSchema.nullable(),
  nodes: z.array(z.strictObject({ nodeId: id, stepId: sha.nullable(), onsetObservationId: sha.nullable(), capsuleId: sha.nullable(),
    status: z.enum(["extreme", "non-extreme", "unknown"]), reasons })).max(50),
  capsules: z.array(MomentumCapsuleSchema).max(50), developments: z.array(MomentumDevelopmentSchema).max(50), reasons });
export type MomentumSnapshot = z.infer<typeof MomentumSnapshotSchema>;
