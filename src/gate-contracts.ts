import { z } from "zod";

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
  // A headline must be the wording of a claim; the gate never publishes an unchecked headline.
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
    reliability: z.enum(["reliable", "unknown"]), upstreamOriginId: id,
  })).max(20),
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
  evidence: ReadonlyArray<{ id: string; sourceId: string; sourceType: "primary" | "secondary"; content?: string | undefined; contentSha256?: string | undefined }>;
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
export const PublicationGateSchema = z.strictObject({
  schemaVersion: z.literal(1), decisions: z.array(GateDecisionSchema),
  input: z.strictObject({
    inputSha256: sha256, taskId: id, evidenceBundleId: id, configurationId: id,
    evidence: z.array(z.strictObject({ evidenceId: id, sourceId: id, sourceType: z.enum(["primary", "secondary"]), retrievedAtUtc: z.iso.datetime({ precision: 3, offset: false }), policyVersion: z.number().int().positive().optional(), policySha256: sha256.optional() })),
  }),
  verification: VerificationSchema.nullable(),
});
