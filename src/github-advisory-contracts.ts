import { z } from "zod";
import { GitHubPolicyIdentitySchema, GitHubConfigurationSchema, DevelopmentConfigurationSchema, ContextFreezeSchema, type ContextFreeze } from "./github-contracts.ts";

const sha = z.string().regex(/^[a-f0-9]{64}$/);
const utc = z.iso.datetime({ precision: 3, offset: false });
const id = z.string().min(1).max(200);
export const ghsaIdSchema = z.string().regex(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/);
export const AdvisoryVulnerabilitySchema = z.strictObject({ package: z.strictObject({ ecosystem: z.string().min(1).max(32), name: z.string().min(1).max(256).nullable() }).nullable(),
  vulnerable_version_range: z.string().max(1000).nullable(), first_patched_version: z.string().max(256).nullable(), vulnerable_functions: z.array(z.string().max(200)).max(10).nullable() });
export const GlobalAdvisorySchema = z.object({ ghsa_id: ghsaIdSchema, cve_id: z.string().max(100).nullable(), url: z.string().max(2048), html_url: z.string().max(2048),
  repository_advisory_url: z.string().max(2048).nullable(), source_code_location: z.string().max(2048).nullable(), summary: z.string().max(1024), description: z.string().max(65535).nullable(),
  type: z.enum(["reviewed", "unreviewed", "malware"]), severity: z.enum(["critical", "high", "medium", "low", "unknown"]),
  identifiers: z.array(z.unknown()).max(100).nullable(), references: z.array(z.string().max(2048)).max(100).nullable(),
  published_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }), github_reviewed_at: z.iso.datetime({ offset: true }).nullable(),
  nvd_published_at: z.iso.datetime({ offset: true }).nullable(), withdrawn_at: z.iso.datetime({ offset: true }).nullable(),
  vulnerabilities: z.array(AdvisoryVulnerabilitySchema).max(20).nullable(), cwes: z.array(z.unknown()).max(100).nullable(), credits: z.array(z.unknown()).max(100).nullable() });
export const AdvisoryEvidenceSchema = z.strictObject({ observationId: sha, nodeId: id, ghsaId: ghsaIdSchema, sourceRepresentation: z.literal("global"),
  type: GlobalAdvisorySchema.shape.type, severity: GlobalAdvisorySchema.shape.severity, vulnerabilities: GlobalAdvisorySchema.shape.vulnerabilities,
  publishedAtUtc: utc, updatedAtUtc: utc, withdrawnAtUtc: utc.nullable(), observedAtUtc: utc, availableAtUtc: utc, responseSha256: sha, bodySha256: sha,
  policy: GitHubPolicyIdentitySchema, mapping: z.array(z.strictObject({ field: z.enum(["source_code_location", "repository_advisory_url"]), url: z.string().max(2048),
    fullName: id, nodeId: id, responseSha256: sha, observedAtUtc: utc, availableAtUtc: utc })).min(1).max(2) });
export type AdvisoryEvidence = z.infer<typeof AdvisoryEvidenceSchema>;
const StructuredSecurityChangeSchema = z.discriminatedUnion("category", [
  z.strictObject({ category: z.enum(["new-package", "range-expansion", "new-remediation"]), before: z.array(AdvisoryVulnerabilitySchema).max(20), after: z.array(AdvisoryVulnerabilitySchema).max(20) }),
  z.strictObject({ category: z.literal("severity-escalation"), before: z.literal("high"), after: z.literal("critical") })]);
export const SecurityChangeSchema = z.union([StructuredSecurityChangeSchema, z.lazy(() => TextMitigationChangeSchema)]);
export const AdvisoryDevelopmentSchema = z.strictObject({ nodeId: id, eventId: sha, developmentId: sha, revisionId: sha, kind: z.literal("security"), observationId: sha,
  materialRevision: z.enum(["initial-risk", "new-package", "range-expansion", "severity-escalation", "new-remediation"]), change: SecurityChangeSchema.nullable(), evidenceExcerpt: z.string().min(1).refine((value) => [...value].length <= 500).nullable() });
export type AdvisoryDevelopment = z.infer<typeof AdvisoryDevelopmentSchema>;
export const SecurityOriginSchema = z.strictObject({ evidence: AdvisoryEvidenceSchema, githubRunId: sha, developmentRunId: sha, slot: utc,
  configuration: GitHubConfigurationSchema, developmentConfiguration: DevelopmentConfigurationSchema, availableAtUtc: utc });
export const SecurityMaterialSchema = z.strictObject({ development: AdvisoryDevelopmentSchema, origin: SecurityOriginSchema });
const quoteText = z.string().min(1).refine((value) => [...value].length <= 500);
export const BodyQuoteSchema = z.strictObject({ start: z.number().int().min(0).max(65535), text: quoteText });
const measures = z.array(z.strictObject({ effect: z.string().min(1).refine((value) => [...value].length <= 120) })).min(1).max(3)
  .refine((entries) => new Set(entries.map((entry) => entry.effect)).size === entries.length);
const scopeIndexes = z.array(z.number().int().min(0).max(19)).min(1).max(20).refine((entries) => entries.every((value, i) => i === 0 || entries[i - 1]! < value));
export const MitigationStateSchema = z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("explicit-none"), scope: z.array(AdvisoryVulnerabilitySchema).min(1).max(20) }),
  z.strictObject({ state: z.literal("measures"), scope: z.array(AdvisoryVulnerabilitySchema).min(1).max(20), assertion: z.enum(["mentioned", "explicit-only"]), measures })]);
export const TextMitigationChangeSchema = z.strictObject({ category: z.literal("new-remediation"), representation: z.literal("text-mitigation"), beforeProjectionId: sha,
  before: MitigationStateSchema, after: MitigationStateSchema, basis: z.enum(["none-to-measure", "added-measure", "replacement"]) });
export const MitigationAssessmentSchema = z.strictObject({ conclusion: z.enum(["supported", "insufficient", "conflicting", "unsafe"]),
  projection: z.discriminatedUnion("state", [
    z.strictObject({ state: z.literal("unknown"), reason: z.enum(["not-attempted", "body-unavailable", "no-explicit-assertion", "scope-uncertain", "conflicting", "unsafe", "verification-unavailable", "quote-limit", "resource-limit", "history-unavailable"]) }),
    z.strictObject({ state: z.literal("explicit-none"), scopeIndexes, quote: BodyQuoteSchema }),
    z.strictObject({ state: z.literal("measures"), scopeIndexes, quote: BodyQuoteSchema, assertion: z.enum(["mentioned", "explicit-only"]), measures })]),
  relation: z.strictObject({ kind: z.enum(["same", "distinct", "unknown"]), previousProjectionId: sha.nullable() }) });
export const MitigationProjectionSchema = z.strictObject({ schemaVersion: z.literal(1), projectionId: sha, observationId: sha, state: MitigationStateSchema,
  quote: BodyQuoteSchema, inputSha256: sha, completedAtUtc: utc });
export const MitigationOriginSchema = z.strictObject({ projection: MitigationProjectionSchema, origin: SecurityOriginSchema, receiptSha256: sha });
export type MitigationOrigin = z.infer<typeof MitigationOriginSchema>;
export const AdvisoryHistorySchema = z.strictObject({ entries: z.array(SecurityOriginSchema).max(2500), materials: z.array(SecurityMaterialSchema).max(50000),
  mitigations: z.array(MitigationOriginSchema).max(50000), unavailableNodeIds: z.array(id).max(50) });
export type AdvisoryHistory = z.infer<typeof AdvisoryHistorySchema>;
export type SecurityVerificationInput = { schemaVersion: 1; inputSha256: string; evidence: AdvisoryEvidence & { description: string | null }; previous: AdvisoryHistory["materials"]; contextFreeze: ContextFreeze } &
  ({ formatVersion?: never; previousMitigations?: never } | { formatVersion: 2; previousMitigations: MitigationOrigin[] });
export const SecurityVerificationV1Schema = z.strictObject({ schemaVersion: z.literal(1), inputSha256: sha, provenance: z.enum(["annotated-fixture", "research-agent"]), verifierVersion: id,
  assessment: z.strictObject({ observationId: sha, conclusion: z.enum(["supported", "insufficient", "conflicting", "unsafe"]),
      relation: z.strictObject({ kind: z.enum(["same", "new-material", "unknown"]), previousDevelopmentId: sha.nullable() }), change: StructuredSecurityChangeSchema.nullable(), evidenceExcerpt: z.string().refine((value) => [...value].length <= 500) }) });
export const SecurityVerificationV2Schema = SecurityVerificationV1Schema.extend({ formatVersion: z.literal(2), mitigation: MitigationAssessmentSchema.optional(),
  assessment: SecurityVerificationV1Schema.shape.assessment.extend({ change: SecurityChangeSchema.nullable() }) });
export const SecurityVerificationSchema = z.union([SecurityVerificationV1Schema, SecurityVerificationV2Schema]);
const SecurityReceiptV1Schema = z.strictObject({ evidenceId: sha, inputSha256: sha, previous: z.array(SecurityMaterialSchema).max(1000), contextFreeze: ContextFreezeSchema,
  verification: SecurityVerificationV1Schema.nullable(), completedAtUtc: utc });
export const SecurityReceiptSchema = z.union([SecurityReceiptV1Schema, SecurityReceiptV1Schema.extend({ formatVersion: z.literal(2),
  previousMitigationIds: z.array(sha).max(1000).refine((entries) => entries.every((value, i) => i === 0 || entries[i - 1]! < value)), verification: SecurityVerificationV2Schema.nullable() })]);
export const AdvisoryCollectionSchema = z.strictObject({ evidence: z.array(AdvisoryEvidenceSchema).max(150), developments: z.array(AdvisoryDevelopmentSchema).max(150),
  history: AdvisoryHistorySchema, assessments: z.array(SecurityReceiptSchema).max(150),
  risks: z.array(z.strictObject({ nodeId: id, ghsaId: ghsaIdSchema, status: z.enum(["high-risk", "lower-risk", "unknown", "withdrawn"]), reason: z.string().min(1).max(100) })).max(300),
  reasons: z.array(z.string().min(1).max(100)).max(100) });
export type AdvisoryCollection = z.infer<typeof AdvisoryCollectionSchema>;
