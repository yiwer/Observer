import { z } from "zod";

const id = z.string().min(1).max(200);
const utc = z.iso.datetime({ precision: 3, offset: false });
const date = z.iso.date();
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);

export const editionNames = {
  "world-affairs": "世界要闻",
  ai: "AI 日报",
  finance: "财经日报",
  "frontier-technology": "科技前沿",
  "social-discourse": "社交话语观察",
  "github-projects": "GitHub 热门项目",
} as const;
const edition = z.enum(Object.keys(editionNames) as [keyof typeof editionNames, ...Array<keyof typeof editionNames>]);

export const EvidenceBundleSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  businessDate: date,
  configurationId: id,
  windowStartUtc: utc,
  cutoffUtc: utc,
  evidence: z.array(z.strictObject({
    id, sourceId: id,
    sourceType: z.enum(["primary", "secondary"]),
    url: z.url({ protocol: /^https?$/ }),
    title: z.string().min(1),
    eventTimeUtc: utc.nullable(),
    publishedAtUtc: utc.nullable(),
    discoveredAtUtc: utc,
    retrievedAtUtc: utc,
    content: z.string().min(1),
    contentSha256: sha256,
  })).min(1),
});
export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;

export const CollectedEvidenceSchema = z.strictObject({
  id, sourceId: id, policyVersion: z.number().int().positive(), policySha256: sha256,
  sourceType: z.enum(["primary", "secondary"]), trust: z.literal("untrusted-source-data"),
  discoveredAtUtc: utc, retrievedAtUtc: utc, expiresAtUtc: utc,
  url: z.url({ protocol: /^https?$/ }).optional(), title: z.string().optional(),
  publishedAtRaw: z.string().nullable().optional(), publishedAtUtc: utc.nullable().optional(),
  eventTimeUtc: utc.nullable().optional(), content: z.string().optional(), contentSha256: sha256.optional(),
});
export type CollectedEvidence = z.infer<typeof CollectedEvidenceSchema>;
export const CollectedBundleSchema = z.strictObject({
  schemaVersion: z.literal(2), id, businessDate: date, configurationId: id,
  windowStartUtc: utc, cutoffUtc: utc,
  evidence: z.array(CollectedEvidenceSchema),
  coverageGaps: z.array(z.strictObject({ sourceId: id, edition, reason: z.string().min(1) })),
});
export type CollectedBundle = z.infer<typeof CollectedBundleSchema>;
const AnyBundleSchema = z.discriminatedUnion("schemaVersion", [EvidenceBundleSchema, CollectedBundleSchema]);

export const CandidateStorySchema = z.strictObject({
  schemaVersion: z.literal(1),
  id, eventClusterId: id,
  edition,
  title: z.string().min(1),
  claims: z.array(z.strictObject({
    text: z.string().min(1),
    evidenceIds: z.array(id).min(1),
  })).min(1),
  quotations: z.array(z.strictObject({ evidenceId: id, text: z.string().min(1) })).optional(),
});
export type CandidateStory = z.infer<typeof CandidateStorySchema>;

const agentMetadata = {
  schemaVersion: z.literal(1),
  taskId: id, evidenceBundleId: id, configurationId: id,
  provider: z.enum(["fixture", "codex", "claude"]),
  model: id, runnerVersion: id,
  startedAtUtc: utc, finishedAtUtc: utc,
  usage: z.strictObject({
    inputTokens: z.number().int().nonnegative().optional(),
    outputTokens: z.number().int().nonnegative().optional(),
    costUsd: z.number().nonnegative().optional(),
  }).optional(),
};
export const AgentResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...agentMetadata, status: z.literal("succeeded"), stories: z.array(CandidateStorySchema).min(1) }),
  z.strictObject({
    ...agentMetadata,
    status: z.enum(["failed", "cancelled"]),
    failure: z.strictObject({ category: z.enum(["timeout", "nonzero-exit", "invalid-output", "unavailable", "cancelled", "unknown"]), retryable: z.boolean() }),
  }),
]);
export type AgentResult = z.infer<typeof AgentResultSchema>;

export const ProduceRequestSchema = z.strictObject({
  schemaVersion: z.literal(1), taskId: id, businessDate: date, configurationId: id,
  evidenceBundle: AnyBundleSchema,
});
export type ProduceRequest = z.infer<typeof ProduceRequestSchema>;

// A runner is an external, untrusted boundary: successful resolution is not publication authority.
export interface AgentRunner {
  run(task: ProduceRequest): Promise<unknown>;
}

export const ReportRecordSchema = z.strictObject({
  schemaVersion: z.literal(1), id,
  businessDate: date, businessTimezone: z.literal("Asia/Shanghai"),
  configurationId: id, taskId: id, applicationVersion: id,
  evidenceBundle: AnyBundleSchema,
  stories: z.array(CandidateStorySchema).length(1),
  coverageGaps: z.array(z.strictObject({ edition, reason: z.literal("not-implemented-in-fixture-spine") })).length(5),
  sourcePolicyDecisions: z.array(z.union([
    z.strictObject({ evidenceId: id, decision: z.literal("test-fixture-only") }),
    z.strictObject({ evidenceId: id, decision: z.literal("source-policy-v1"), sourceId: id, policyVersion: z.number().int().positive(), policySha256: sha256, attribution: z.string().min(1) }),
  ])).min(1),
  agentResult: AgentResultSchema,
});
export type ReportRecord = z.infer<typeof ReportRecordSchema>;

export const ReportVersionSchema = z.strictObject({
  schemaVersion: z.literal(1), id, briefId: id,
  businessDate: date, version: z.literal(1),
  publishedAtUtc: utc, revisionReason: z.literal("initial"),
  previousVersionId: z.null(),
  provenance: z.literal("test-fixture"),
  reportRecordId: id,
  canonicalMarkdownSha256: sha256,
});
export type ReportVersion = z.infer<typeof ReportVersionSchema>;
export const PublishedReportSchema = z.strictObject({
  version: ReportVersionSchema,
  record: ReportRecordSchema,
  canonicalMarkdown: z.string().min(1),
});
export type PublishedReport = z.infer<typeof PublishedReportSchema>;
