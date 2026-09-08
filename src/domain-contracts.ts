import { z } from "zod";

export const DomainAssessmentSchema = z.strictObject({
  domains: z.array(z.enum(["world-affairs", "finance", "ai", "frontier-technology", "other"])).min(1).max(5),
  risk: z.strictObject({ level: z.enum(["routine", "high", "unknown"]),
    categories: z.array(z.enum(["armed-conflict", "casualty-disaster", "election-count", "public-health-emergency", "finance-sensitive"])).max(5) }),
  assertion: z.enum(["event-fact", "attributed-statement", "interpretation", "unknown"]).describe("Independently classify the claim's actual wording: event-fact asserts an underlying occurrence or condition; attributed-statement reports a named publisher's statement or estimate; interpretation offers an explanation or scenario. Use unknown when unclear. Do not copy claim.kind to make it pass: a fact label with attributed wording is inconsistent, and interpretation requires analysis wording and kind. Evidence strength and source independence are separate judgments; an official source or a citation does not determine assertion type."),
  materials: z.array(z.strictObject({ evidenceId: z.string().min(1).max(200),
    kind: z.enum(["text", "verified-media-description", "unverified-social-video", "graphic-imagery", "unknown"]),
  })).min(1).max(20),
  financialContent: z.enum(["not-financial", "informational", "trade-instruction", "target-price", "return-promise", "unknown"]),
  research: z.array(z.strictObject({
    evidenceId: z.string().min(1).max(200),
    preprint: z.enum(["yes", "no", "unknown"]), officialRelease: z.enum(["yes", "no", "unknown"]),
    independentValidation: z.enum(["yes", "no", "unknown"]), peerReview: z.enum(["yes", "no", "unknown"]),
    role: z.enum(["research-result", "company-capability-claim", "other", "unknown"]),
  })).max(20).default([]),
  numbers: z.strictObject({ status: z.enum(["none", "dynamic", "unknown"]), statistics: z.array(z.strictObject({
    statisticsAtUtc: z.iso.datetime({ precision: 3, offset: false }).nullable(), evidenceIds: z.array(z.string().min(1).max(200)).min(1).max(20),
    publisherSourceId: z.string().min(1).max(200).nullable(),
  })).max(20) }),
});
export const DomainProjectionSchema = DomainAssessmentSchema.extend({
  provenance: z.literal("observer-final-domain-projection-v1"), annotationSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
