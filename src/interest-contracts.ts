import { z } from "zod";

const key = z.string().trim().min(1).max(200);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const region = z.string().regex(/^[A-Z]{2}$/);
const language = z.string().regex(/^[a-z]{2,3}(-[A-Za-z]{2,8})?$/);
const weighted = z.strictObject({ key, priority: z.number().int().min(0).max(100) });
export const InterestProfileSchema = z.strictObject({
  schemaVersion: z.literal(1), version: z.number().int().positive(),
  topics: z.array(weighted).max(100), entities: z.array(weighted).max(100),
  regions: z.array(weighted.extend({ key: region })).max(100),
  exclusions: z.strictObject({ topics: z.array(key).max(100), entities: z.array(key).max(100), regions: z.array(region).max(100) }),
  coverageLanguages: z.array(language).min(1).max(30),
}).superRefine((profile, context) => {
  const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  for (const group of ["topics", "entities", "regions"] as const) {
    for (const [path, keys] of [[group, profile[group].map((item) => item.key)], [`exclusions.${group}`, profile.exclusions[group]]] as const) {
      if (new Set(keys.map(normalize)).size !== keys.length) context.addIssue({ code: "custom", message: "duplicate-interest-key", path: [path] });
    }
  }
  if (new Set(profile.coverageLanguages.map((language) => language.toLowerCase())).size !== profile.coverageLanguages.length) context.addIssue({ code: "custom", message: "duplicate-coverage-language", path: ["coverageLanguages"] });
});
export type InterestProfile = z.infer<typeof InterestProfileSchema>;
export const InterestSnapshotSchema = z.strictObject({ profile: InterestProfileSchema, sha256 });
export type InterestSnapshot = z.infer<typeof InterestSnapshotSchema>;
export const SelectionAssessmentSchema = z.strictObject({
  topics: z.array(key).max(100), entities: z.array(key).max(100), regions: z.array(region).max(100),
  evidenceLanguages: z.array(z.strictObject({ evidenceId: key, language })).max(20),
  impact: z.enum(["ordinary", "global", "major-regional"]), impactClaimIds: z.array(key).max(50),
  impactBasis: z.enum(["observed-event", "statement-act"]).optional(),
});
export const SelectionProjectionSchema = SelectionAssessmentSchema.omit({ topics: true, entities: true }).extend({
  provenance: z.literal("observer-final-selection-projection-v1"), annotationSha256: sha256,
  topicSha256s: z.array(sha256).max(100), entitySha256s: z.array(sha256).max(100),
});
export const InterestSelectionSchema = z.strictObject({
  storyId: key, score: z.number().int().nonnegative(), baseline: z.boolean(),
  outcome: z.enum(["eligible", "excluded", "outside-region-scope"]),
});
const coverageEntry = z.strictObject({ key: z.string().min(1).max(20), evidenceIds: z.array(key), selectedStoryIds: z.array(key) });
export const InterestCoverageSchema = z.strictObject({
  scope: z.literal("model-input-and-final-gate-annotations"), inputEvidenceCount: z.number().int().nonnegative(),
  regions: z.array(coverageEntry).length(4), languages: z.array(coverageEntry),
  unknownRegionEvidenceIds: z.array(key), unknownLanguageEvidenceIds: z.array(key),
});
