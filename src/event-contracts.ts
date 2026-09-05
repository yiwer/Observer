import { z } from "zod";

const id = z.string().min(1).max(200);
const edition = z.enum(["world-affairs", "ai", "finance", "frontier-technology", "social-discourse", "github-projects"]);
const utc = z.iso.datetime({ precision: 3, offset: false });
const eventTime = z.strictObject({ atUtc: utc.nullable(), evidenceIds: z.array(id), versionId: id });
export const EventAssessmentSchema = z.strictObject({
  eventKind: z.enum(["observed-event", "publisher-statement"]).optional(),
  identity: z.strictObject({ subject: id, action: id, object: id, discriminator: id }),
  fact: z.string().min(1).max(1000), primaryEdition: edition,
  materiality: z.enum(["material", "routine"]), materialityClaimIds: z.array(id).max(50),
  occurrenceEvidenceId: id.nullable(), disclosureEvidenceId: id.nullable(), developmentEvidenceId: id.nullable(),
  relationToPrior: z.strictObject({ clusterId: id, versionId: id, relation: z.literal("distinct-event"), basisClaimIds: z.array(id).min(1).max(50) }).optional(),
});
export type EventAssessment = z.infer<typeof EventAssessmentSchema>;
export const EventProjectionSchema = EventAssessmentSchema.omit({ identity: true, fact: true }).extend({
  eventKind: z.enum(["observed-event", "publisher-statement"]),
  provenance: z.literal("observer-final-event-projection-v1"),
  annotationSha256: z.string().regex(/^[a-f0-9]{64}$/),
  identitySha256: z.string().regex(/^[a-f0-9]{64}$/), factSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const EventClusterSchema = z.strictObject({
  eventKind: z.enum(["observed-event", "publisher-statement"]),
  id, memberStoryIds: z.array(id).min(1).max(300), evidenceIds: z.array(id).min(1),
  primary: z.strictObject({ storyId: id, versionId: id, edition, reason: z.literal("verified-edition-then-fixed-order") }),
  occurrence: eventTime, firstDisclosure: eventTime, firstDiscoveredAtUtc: utc.nullable(), historyMetadata: z.enum(["available", "source-policy-withheld"]),
  materialDevelopment: eventTime, coverage: z.enum(["new-disclosure", "late-discovered", "material-update"]),
  developmentIds: z.array(id).min(1),
  developments: z.array(z.strictObject({ id, storyId: id, claimId: id, disclosure: eventTime, materialityClaimIds: z.array(id) })).min(1),
  previousCoverage: z.strictObject({ versionId: id, storyId: id }).nullable(),
  separatedFrom: z.array(z.strictObject({ clusterId: id, versionId: id, basis: z.array(z.strictObject({ storyId: id, claimId: id })).min(1) })),
  historyPolicies: z.array(z.strictObject({ sourceId: id, policyVersion: z.number().int().positive(), policySha256: z.string().regex(/^[a-f0-9]{64}$/) })),
});
export const EventSelectionSchema = z.strictObject({
  storyId: id, proposedClusterId: id, eventClusterId: id.nullable(),
  outcome: z.enum(["primary", "impact-note", "withheld", "deferred"]), reason: id,
});
