import { z } from "zod";

const id = z.string().min(1).max(200);
const utc = z.iso.datetime({ precision: 3, offset: false });
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const DiscourseReasonSchema = z.enum(["social-no-eligible-source", "social-snapshot-unavailable", "social-snapshot-invalid", "social-expired",
  "social-permission-changed", "social-recheck-incomplete", "social-insufficient-sample", "social-skewed", "social-collected-bundle-required",
  "social-invalid-claim", "social-unsafe-inference", "social-main-story-unavailable", "social-analysis-unavailable", "social-interest-excluded",
  "social-capacity-limit", "social-below-target", "social-access-unavailable", "social-after-cutoff", "social-cancelled", "social-changed",
  "social-invalid-response", "social-pagination-incomplete", "social-rate-limited", "social-response-too-large", "social-sample-limit",
  "social-timeout", "social-unavailable", "social-unsafe-response"]);
export type DiscourseReason = z.infer<typeof DiscourseReasonSchema>;
export const discourseRules = Object.freeze({ version: "observer-discourse-v1", linkedMinimum: 6, nativeMinimum: 12,
  minimumRoots: 3, timeBuckets: 2, maximumDuplicateFraction: 0.4, maximumRootFraction: 0.5, maxPages: 6, maxItems: 100, pageSize: 20, deadlineMs: 30000 });
export const DiscourseConfigurationSchema = z.strictObject({
  schemaVersion: z.literal(1), version: z.number().int().positive(),
  groups: z.array(z.strictObject({
    id, sourceId: id, tag: z.string().regex(/^[\p{L}\p{N}_]{1,64}$/u),
    language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,8})?$/).nullable(), regionBasis: z.null(),
    kind: z.enum(["story-linked", "platform-native"]), linkedEvidenceIds: z.array(id).max(20),
  })).max(10),
}).refine((config) => new Set(config.groups.map((group) => group.id)).size === config.groups.length, "duplicate-discourse-group");
export type DiscourseConfiguration = z.infer<typeof DiscourseConfigurationSchema>;
export const DiscourseSampleSchema = z.strictObject({
  schemaVersion: z.literal(1), receiptId: id, groupId: id, sourceId: id, policyVersion: z.number().int().positive(), policySha256: sha256,
  configurationSha256: sha256, rulesSha256: sha256, businessDate: z.iso.date(), windowStartUtc: utc, cutoffUtc: utc,
  capturedAtUtc: utc, expiresAtUtc: utc, reason: DiscourseReasonSchema.nullable(), receivedCount: z.number().int().nonnegative().max(100),
  duplicateCount: z.number().int().nonnegative().max(100), isolatedCount: z.number().int().nonnegative().max(100),
  records: z.array(z.strictObject({ id, createdAtUtc: utc, editedAtUtc: utc.nullable(), language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,8})?$/).nullable(), text: z.string().min(1).max(2000), fingerprint: sha256 })).max(100),
});
export type DiscourseSample = z.infer<typeof DiscourseSampleSchema>;
export const DiscourseAssessmentSchema = z.strictObject({ scope: z.enum(["sample-only", "population", "unknown"]),
  content: z.enum(["arguments-and-disagreements", "emerging-topic", "other", "unknown"]), individualProfiling: z.boolean().nullable() });
export const DiscourseSnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1), rulesVersion: z.literal("observer-discourse-v1"), frozenAtUtc: utc,
  configurationSha256: z.string().regex(/^[a-f0-9]{64}$/),
  groups: z.array(z.strictObject({
    id, sourceId: id, platform: z.literal("Mastodon"), query: z.string().min(1).max(200),
    kind: z.enum(["story-linked", "platform-native"]), windowStartUtc: utc, cutoffUtc: utc,
    linkedEvidenceIds: z.array(id).max(20),
    language: z.string().max(100).nullable(), regionBasis: z.null(), sampleSize: z.number().int().nonnegative().nullable(),
    receivedCount: z.number().int().nonnegative().nullable(), duplicateCount: z.number().int().nonnegative().nullable(), isolatedCount: z.number().int().nonnegative().nullable(),
    rootCount: z.number().int().nonnegative().nullable(), bucketCounts: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]).nullable(),
    reason: DiscourseReasonSchema.nullable(),
  })).max(10),
});
