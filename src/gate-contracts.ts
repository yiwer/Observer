import { z } from "zod";
import type { CollectedEvidence, EvidenceBundle } from "./contracts.ts";
import { EventAssessmentSchema, EventProjectionSchema } from "./event-contracts.ts";
import { SelectionAssessmentSchema, SelectionProjectionSchema } from "./interest-contracts.ts";

const id = z.string().min(1).max(200);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const claimFields = { id, text: z.string().min(1).max(4000), evidenceIds: z.array(id).min(1).max(20) };
export const ClaimSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...claimFields, kind: z.literal("fact") }),
  z.strictObject({ ...claimFields, kind: z.literal("statement"), publisherSourceId: id }),
  z.strictObject({ ...claimFields, kind: z.literal("analysis"), mode: z.enum(["explanation", "scenario"]) }),
  z.strictObject({ ...claimFields, kind: z.literal("quotation"), evidenceIds: z.array(id).length(1), originalText: z.string().min(1).max(4000), translated: z.boolean(), language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,8})?$/) }),
]);
export type Claim = z.infer<typeof ClaimSchema>;
export const CandidateV2Schema = z.strictObject({
  schemaVersion: z.literal(2), id, eventClusterId: id,
  edition: z.enum(["world-affairs", "ai", "finance", "frontier-technology", "social-discourse", "github-projects"]),
  // The input title is ignored; published headings are derived from accepted claims.
  title: z.string().min(1).max(4000), claims: z.array(ClaimSchema).min(1).max(50),
});
export type CandidateV2 = z.infer<typeof CandidateV2Schema>;

export const AssessmentSchema = z.strictObject({
  storyId: id, claimId: id,
  conclusion: z.enum(["supported", "insufficient", "conflicting", "unsafe"]),
  reason: z.enum(["supported-by-evidence", "insufficient-evidence", "source-conflict", "unsafe-material", "irrelevant-evidence"]),
  wording: z.enum(["original", "quotation", "unsafe"]),
  evidence: z.array(z.strictObject({
    evidenceId: id, relation: z.enum(["supports", "contradicts", "irrelevant"]),
    basis: z.enum(["direct-observation", "publisher-statement", "secondary-report"]),
    reliability: z.enum(["reliable", "unknown"]), upstreamOriginId: id.nullable(),
  })).max(20),
  // A malformed event judgment cannot invalidate otherwise usable claim receipts.
  event: EventAssessmentSchema.optional().catch(undefined),
  eventProjection: EventProjectionSchema.optional(),
  selection: SelectionAssessmentSchema.optional().catch(undefined),
  selectionProjection: SelectionProjectionSchema.optional(),
});
export const VerificationSchema = z.strictObject({
  schemaVersion: z.literal(1), inputSha256: sha256,
  provenance: z.enum(["annotated-fixture", "research-agent"]), verifierVersion: id,
  assessments: z.array(AssessmentSchema).max(500),
});
export type Verification = z.infer<typeof VerificationSchema>;
export interface VerificationInput {
  schemaVersion: 1;
  inputSha256: string;
  taskId: string;
  evidenceBundleId: string;
  configurationId: string;
  stories: CandidateV2[];
  evidence: ReadonlyArray<CollectedEvidence | EvidenceBundle["evidence"][number]>;
}
// A semantic judgment is external input, never a deterministic proof of truth.
export interface SemanticVerifier { verify(input: VerificationInput): Promise<unknown>; }

const check = z.strictObject({ status: z.enum(["passed", "failed", "not-evaluated"]), reason: id });
export const GateDecisionSchema = z.strictObject({
  storyId: id, claimId: id, inputClaimSha256: sha256, evidenceIds: z.array(id),
  structure: check, policy: check,
  semantic: z.strictObject({ status: z.enum(["supported", "insufficient", "conflicting", "unsafe", "not-evaluated"]), reason: id }),
  outcome: z.enum(["published", "unconfirmed", "quarantined"]), reason: id,
});
export type GateDecision = z.infer<typeof GateDecisionSchema>;
export const UnconfirmedItemSchema = z.strictObject({
  storyId: id, claimId: id, edition: CandidateV2Schema.shape.edition,
  description: z.string().min(1), evidenceIds: z.array(id).min(1),
});
export type UnconfirmedItem = z.infer<typeof UnconfirmedItemSchema>;
export const PublicationGateSchema = z.strictObject({
  schemaVersion: z.literal(1), decisions: z.array(GateDecisionSchema),
  checkedAtUtc: z.iso.datetime({ precision: 3, offset: false }),
  unconfirmedItems: z.array(UnconfirmedItemSchema),
  input: z.strictObject({
    inputSha256: sha256, taskId: id, evidenceBundleId: id, configurationId: id,
    verificationEvidenceIds: z.array(id),
    evidence: z.array(z.strictObject({ evidenceId: id, sourceId: id, sourceType: z.enum(["primary", "secondary"]), retrievedAtUtc: z.iso.datetime({ precision: 3, offset: false }), policyVersion: z.number().int().positive().optional(), policySha256: sha256.optional() })),
  }),
  verification: VerificationSchema.nullable(),
});

// Six Editions x 50 stories, with <=50 claims/story, need at most 30 whole-story batches.
// Each receipt remains the unchanged <=500-assessment Verification v1 contract.
export const BatchedPublicationGateSchema = PublicationGateSchema.extend({
  schemaVersion: z.literal(2),
  verification: z.null(),
  batches: z.array(PublicationGateSchema.pick({ schemaVersion: true, input: true, verification: true, checkedAtUtc: true })).max(30),
});
