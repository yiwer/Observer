import { z } from "zod";
import { BatchedPublicationGateSchema, CandidateV2Schema, ClaimSchema, PublicationGateSchema } from "./gate-contracts.ts";
import { EventClusterSchema, EventSelectionSchema } from "./event-contracts.ts";
import { InterestSnapshotSchema, InterestSelectionSchema, InterestCoverageSchema } from "./interest-contracts.ts";
import { DiscourseSnapshotSchema } from "./discourse-contracts.ts";
import { GitHubSnapshotSchema, GitHubRankingSnapshotSchema } from "./github-contracts.ts";
import { GitHubRankingSchema } from "./github-ranking-contracts.ts";
import { DevelopmentSnapshotSchema, GitHubRepromotionRankingSchema } from "./github-development-contracts.ts";
import { RoutingReceiptSchema, FinalEditorReceiptSchema } from "./routing-contracts.ts";

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
// Archive-only projection: fixture inputs never acquire fictitious collection policy identities.
export const ArchivedBundleSchema = CollectedBundleSchema.extend({
  schemaVersion: z.literal(3), sourceBundleSchemaVersion: z.union([z.literal(1), z.literal(2)]),
  evidence: z.array(CollectedEvidenceSchema.omit({ content: true, expiresAtUtc: true, policyVersion: true, policySha256: true, trust: true }).extend({
    origin: z.discriminatedUnion("kind", [
      z.strictObject({ kind: z.literal("fixture") }),
      z.strictObject({ kind: z.literal("collected"), policyVersion: z.number().int().positive(), policySha256: sha256 }),
    ]),
  })),
});

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

const tokenUsage = {
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  cachedInputTokens: z.number().int().nonnegative().nullable(),
  cacheWriteInputTokens: z.number().int().nonnegative().nullable(),
  reasoningOutputTokens: z.number().int().nonnegative().nullable(),
  costUsd: z.number().nonnegative().nullable(),
};
const TokenUsageSchema = z.strictObject(tokenUsage);
const ModelUsageReceiptSchema = z.strictObject({ request: z.number().int().min(1).max(8), ...tokenUsage });
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type ModelUsageReceipt = z.infer<typeof ModelUsageReceiptSchema>;

const agentMetadata = {
  schemaVersion: z.literal(1),
  taskId: id, evidenceBundleId: id, configurationId: id,
  provider: z.enum(["fixture", "codex", "claude"]),
  model: id, runnerVersion: id,
  startedAtUtc: utc, finishedAtUtc: utc,
  execution: z.strictObject({
    provenance: z.enum(["protocol-fixture", "codex-cli", "claude-cli"]),
    processKind: z.enum(["protocol-fixture", "codex-cli", "claude-cli"]),
    modelTransport: z.enum(["not-used", "model-protocol-fixture", "openai-api", "anthropic-api"]),
    cliVersion: id, durationMs: z.number().int().nonnegative(),
    exitCode: z.number().int().nullable(),
    terminal: z.enum(["completed", "failed", "missing", "invalid"]),
    containerId: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    cleanup: z.enum(["removed", "not-created", "unverified"]),
  }).optional(),
  usage: TokenUsageSchema.partial().extend({
    source: z.enum(["cli-turn", "cli-model-tree", "model-responses", "unknown"]).optional(),
    modelResponses: z.array(ModelUsageReceiptSchema).max(8).optional(),
  }).optional(),
};
export const AgentResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ ...agentMetadata, status: z.literal("succeeded"), stories: z.array(z.union([CandidateStorySchema, CandidateV2Schema])).min(1) }),
  z.strictObject({
    ...agentMetadata,
    status: z.enum(["failed", "cancelled"]),
    failure: z.strictObject({ category: z.enum(["timeout", "nonzero-exit", "invalid-output", "unavailable", "cancelled", "unknown", "output-limit", "input-limit", "cleanup-failed", "policy-violation", "evidence-expired", "version-mismatch"]), retryable: z.boolean() }),
  }),
]);
export type AgentResult = z.infer<typeof AgentResultSchema>;

export const ProduceRequestSchema = z.strictObject({
  schemaVersion: z.literal(1), taskId: id, businessDate: date, configurationId: id,
  evidenceBundle: AnyBundleSchema,
});
export type ProduceRequest = z.infer<typeof ProduceRequestSchema>;

// The six-Edition seam accepts research outcomes, never a Report Record or final prose.
const sourceGapReason = z.enum(["source-pending", "collection-forbidden", "storage-forbidden", "model-forbidden", "distribution-forbidden", "rate-limited", "timeout", "http-error", "unsafe-xml", "source-failed", "fetch-failed", "evidence-unavailable", "target-forbidden", "origin-forbidden", "redirect-limit", "response-too-large", "encoding-forbidden", "invalid-feed", "invalid-item", "item-limit"]);
export const SixEditionRequestSchema = ProduceRequestSchema.extend({
  schemaVersion: z.literal(2),
  evidenceBundle: z.discriminatedUnion("schemaVersion", [EvidenceBundleSchema, CollectedBundleSchema.extend({
    coverageGaps: z.array(CollectedBundleSchema.shape.coverageGaps.element.extend({ reason: sourceGapReason })),
  })]),
  editions: z.array(z.strictObject({ edition, evidenceIds: z.array(id) })).length(6),
});
export const EventEditionRequestSchema = SixEditionRequestSchema.extend({ schemaVersion: z.literal(3) });
export const InterestEditionRequestSchema = SixEditionRequestSchema.extend({ schemaVersion: z.literal(4) });
export const DomainEditionRequestSchema = SixEditionRequestSchema.extend({ schemaVersion: z.literal(5) });
export const DiscourseEditionRequestSchema = SixEditionRequestSchema.extend({ schemaVersion: z.literal(6), discourseSamples: z.array(z.unknown()).max(10).optional() });
export const GitHubEditionRequestSchema = DiscourseEditionRequestSchema.extend({ schemaVersion: z.literal(7) });
export const GitHubHeatRequestSchema = DiscourseEditionRequestSchema.extend({ schemaVersion: z.literal(8) });
export const GitHubRepromotionRequestSchema = DiscourseEditionRequestSchema.extend({ schemaVersion: z.literal(9) });
export const RoutedRequestSchema = DiscourseEditionRequestSchema.extend({ schemaVersion: z.literal(10) });
export type SixEditionRequest = z.infer<typeof SixEditionRequestSchema> | z.infer<typeof EventEditionRequestSchema> | z.infer<typeof InterestEditionRequestSchema> | z.infer<typeof DomainEditionRequestSchema> | z.infer<typeof DiscourseEditionRequestSchema> | z.infer<typeof GitHubEditionRequestSchema> | z.infer<typeof GitHubHeatRequestSchema> | z.infer<typeof GitHubRepromotionRequestSchema>;
// Six-Edition research appends a known Edition suffix to the unchanged 200-character input ID.
// This bounded envelope extension does not alter the legacy AgentRunner/CLI contract.
const editionTaskId = z.string().min(1).max(200 + 1 + Math.max(...Object.keys(editionNames).map((name) => name.length)));
const EditionAgentResultSchema = z.discriminatedUnion("status", [
  AgentResultSchema.options[0].extend({ taskId: editionTaskId, stories: z.array(CandidateV2Schema).max(50) }),
  AgentResultSchema.options[1].extend({ taskId: editionTaskId }),
]);
const StoryEditorialSchema = z.strictObject({
  storyId: id, significanceClaimIds: z.array(id), impactClaimIds: z.array(id), uncertaintyClaimIds: z.array(id),
  impactNotes: z.array(z.strictObject({ edition, claimIds: z.array(id).min(1) })),
});
export const EditionResearchSchema = z.strictObject({
  schemaVersion: z.literal(2), taskId: id, evidenceBundleId: id, configurationId: id,
  editions: z.array(z.discriminatedUnion("status", [
    z.strictObject({ edition, status: z.literal("completed"), result: EditionAgentResultSchema, editorial: z.array(StoryEditorialSchema).max(50).optional() }),
    z.strictObject({ edition, status: z.literal("no-evidence") }),
    z.strictObject({ edition, status: z.literal("invalid-output") }),
  ])).length(6),
});
export type EditionResearch = z.infer<typeof EditionResearchSchema>;
export const EditionResearchEnvelopeSchema = EditionResearchSchema.extend({ editions: z.array(z.looseObject({ edition })).length(6) });
export interface EditionRunner {
  run(task: SixEditionRequest, options?: { signal?: AbortSignal }): Promise<unknown>;
}

// A runner is an external, untrusted boundary: successful resolution is not publication authority.
export interface AgentRunOptions {
  signal?: AbortSignal;
  // Host identity for a semantic process; the model cannot select this value.
  semanticAttempt?: { id: string; inputSha256: string };
  // Trusted host-only control. Never constructed from a CLI/model request body.
  dispatchControl?: { dispatch<T>(send: () => Promise<T>, signal: AbortSignal): Promise<T>; observeUsage?(request: number, usage: TokenUsage): void };
}
export interface AgentRunner {
  run(task: ProduceRequest, options?: AgentRunOptions): Promise<unknown>;
}

const LegacyReportRecordSchema = z.strictObject({
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
const GatedReportRecordSchema = LegacyReportRecordSchema.extend({
  schemaVersion: z.literal(2),
  evidenceBundle: ArchivedBundleSchema,
  stories: z.array(CandidateV2Schema),
  coverageGaps: z.array(z.strictObject({ edition, reason: z.string().min(1) })),
  sourcePolicyDecisions: z.array(LegacyReportRecordSchema.shape.sourcePolicyDecisions.element),
  // Only accepted wording is archived. Rejected input is identified by hash in the gate ledger.
  agentResult: z.strictObject({ ...agentMetadata, status: z.literal("succeeded") }),
  publicationGate: PublicationGateSchema,
});
const SixEditionRecordSchema = GatedReportRecordSchema.omit({ agentResult: true }).extend({
  schemaVersion: z.literal(3),
  editorialContract: z.literal("observer-canonical-v1"),
  publicationGate: z.union([PublicationGateSchema, BatchedPublicationGateSchema]),
  // Derived attribution labels may extend a bounded 4000-character Claim.
  stories: z.array(CandidateV2Schema.extend({ title: z.string().min(1).max(4500) })),
  editionRuns: z.array(z.discriminatedUnion("status", [
    z.strictObject({ edition, status: z.literal("completed"), result: z.discriminatedUnion("status", [
      EditionAgentResultSchema.options[0].omit({ stories: true }), EditionAgentResultSchema.options[1],
    ]) }),
    z.strictObject({ edition, status: z.literal("no-evidence") }),
    z.strictObject({ edition, status: z.literal("invalid-output") }),
  ])).length(6),
  editions: z.array(z.strictObject({ edition, candidateStoryIds: z.array(id), storyIds: z.array(id), priorityStoryIds: z.array(id) })).length(6),
  storyEditorial: z.array(StoryEditorialSchema),
});
const EventRecordSchema = SixEditionRecordSchema.extend({
  schemaVersion: z.literal(4), editorialContract: z.literal("observer-canonical-v2"), eventClusters: z.array(EventClusterSchema.extend({
    supportingClaims: z.array(z.strictObject({ storyId: id, claim: ClaimSchema })),
    impactNotes: z.array(z.strictObject({ edition, claims: z.array(z.strictObject({ storyId: id, claim: ClaimSchema })).max(1) })),
  })),
  eventSelections: z.array(EventSelectionSchema).max(300),
  historyCoverage: z.strictObject({ status: z.enum(["classified", "legacy-unclassified"]), versionIds: z.array(id) }),
});
const InterestRecordSchema = EventRecordSchema.extend({
  schemaVersion: z.literal(5), editorialContract: z.literal("observer-canonical-v3"),
  interestProfile: InterestSnapshotSchema, interestSelections: z.array(InterestSelectionSchema).max(300), coverage: InterestCoverageSchema,
});
const DomainRecordSchema = InterestRecordSchema.extend({ schemaVersion: z.literal(6), editorialContract: z.literal("observer-canonical-v4"), domainRules: z.literal("observer-domain-evidence-v1") });
const DiscourseRecordSchema = DomainRecordSchema.extend({ schemaVersion: z.literal(7), editorialContract: z.literal("observer-canonical-v5"),
  discourse: DiscourseSnapshotSchema.extend({ observations: z.array(z.strictObject({ groupId: id, kind: z.enum(["story-linked", "platform-native"]),
    story: CandidateV2Schema, priority: z.boolean(), linkedClusterId: id.nullable(), primaryStoryId: id.nullable(), primaryVersionId: id.nullable(),
  })).max(10) }),
});
const GitHubRecordSchema = DiscourseRecordSchema.extend({ schemaVersion: z.literal(8), editorialContract: z.literal("observer-canonical-v6"), github: GitHubSnapshotSchema });
const GitHubHeatRecordSchema = DiscourseRecordSchema.extend({ schemaVersion: z.literal(9), editorialContract: z.literal("observer-canonical-v7"), github: GitHubRankingSnapshotSchema, githubRanking: GitHubRankingSchema });
const GitHubRepromotionRecordSchema = GitHubHeatRecordSchema.extend({ schemaVersion: z.literal(10), editorialContract: z.literal("observer-canonical-v8"), githubDevelopments: DevelopmentSnapshotSchema, githubRepromotion: GitHubRepromotionRankingSchema });
export const BriefRecoverySchema = z.strictObject({
  contract: z.literal("observer-recovery-v1"), version: z.number().int().positive(),
  revisionReason: z.enum(["initial", "completion"]), previousVersionId: id.nullable(),
  publishedAtUtc: utc, deadlineUtc: utc, recoveryDeadlineUtc: utc,
  timing: z.enum(["on-time", "delayed"]), delayReason: z.string().nullable(),
  content: z.enum(["complete", "degraded", "links-only"]),
  coverageGaps: z.array(z.strictObject({ edition, reason: z.string().min(1) })),
  completedEditions: z.array(edition), availableEditions: z.array(edition), inheritedMarkdown: z.string().nullable(), collectionRecoveredAtUtc: utc.nullable(),
  links: z.array(z.strictObject({ evidenceId: id, edition, sourceId: id, policyVersion: z.number().int().positive(), policySha256: sha256,
    attribution: z.string().min(1), title: z.string().min(1), url: z.url({ protocol: /^https?$/ }), publishedAtUtc: utc.nullable() })),
});
export const RoutedRecordSchema = GitHubRepromotionRecordSchema.extend({ schemaVersion: z.literal(11), editorialContract: z.literal("observer-canonical-v9"), routing: RoutingReceiptSchema, finalEditor: FinalEditorReceiptSchema, publicationMode: z.literal("scheduled").optional(), recovery: BriefRecoverySchema.optional() });
export const ReportRecordSchema = z.union([LegacyReportRecordSchema, GatedReportRecordSchema, SixEditionRecordSchema, EventRecordSchema, InterestRecordSchema, DomainRecordSchema, DiscourseRecordSchema, GitHubRecordSchema, GitHubHeatRecordSchema, GitHubRepromotionRecordSchema, RoutedRecordSchema]);
export type ReportRecord = z.infer<typeof ReportRecordSchema>;

const LegacyReportVersionSchema = z.strictObject({
  schemaVersion: z.literal(1), id, briefId: id,
  businessDate: date, version: z.literal(1),
  publishedAtUtc: utc, revisionReason: z.literal("initial"),
  previousVersionId: z.null(),
  provenance: z.literal("test-fixture"),
  reportRecordId: id,
  canonicalMarkdownSha256: sha256,
});
export const ReportVersionSchema = z.discriminatedUnion("schemaVersion", [LegacyReportVersionSchema, LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(2), editorialContract: z.literal("observer-canonical-v1"), reportRecordSha256: sha256,
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(3), editorialContract: z.literal("observer-canonical-v2"), reportRecordSha256: sha256,
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(4), editorialContract: z.literal("observer-canonical-v3"), reportRecordSha256: sha256,
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(5), editorialContract: z.literal("observer-canonical-v4"), reportRecordSha256: sha256,
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(6), editorialContract: z.literal("observer-canonical-v5"), reportRecordSha256: sha256,
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(7), editorialContract: z.literal("observer-canonical-v6"), reportRecordSha256: sha256,
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(8), editorialContract: z.literal("observer-canonical-v7"), reportRecordSha256: sha256,
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(9), editorialContract: z.literal("observer-canonical-v8"), reportRecordSha256: sha256,
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(10), editorialContract: z.literal("observer-canonical-v9"), reportRecordSha256: sha256,
  provenance: z.enum(["test-fixture", "scheduled"]),
}), LegacyReportVersionSchema.extend({
  schemaVersion: z.literal(11), editorialContract: z.literal("observer-canonical-v9"), reportRecordSha256: sha256,
  version: z.number().int().positive(), revisionReason: z.enum(["initial", "completion", "correction", "withdrawal"]), previousVersionId: id.nullable(),
  provenance: z.enum(["test-fixture", "scheduled"]),
  content: z.enum(["complete", "degraded", "links-only"]), timing: z.enum(["on-time", "delayed"]),
})]);
export type ReportVersion = z.infer<typeof ReportVersionSchema>;
export const PublishedReportSchema = z.strictObject({
  version: ReportVersionSchema,
  record: ReportRecordSchema,
  canonicalMarkdown: z.string().min(1),
});
export type PublishedReport = z.infer<typeof PublishedReportSchema>;
