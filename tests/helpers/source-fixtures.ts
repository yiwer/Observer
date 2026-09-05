import type { SourcePolicy } from "../../src/collection.ts";
export function policy(): SourcePolicy {
  return {
    schemaVersion: 1, sourceId: "owner-test", version: 1, name: "Owner test observatory",
    feedUrl: "https://source.example/feed", sourceType: "primary", edition: "frontier-technology",
    review: { status: "approved", reviewedBy: "Owner", reviewedAtUtc: "2026-09-04T00:00:00.000Z", basis: "Self-authored test fixture; all fixture text licensed for these tests" },
    collection: { enabled: true, fields: ["url", "title", "publishedAtRaw", "publishedAtUtc", "eventTimeUtc", "content", "contentSha256"], readBody: false },
    storage: { fields: ["url", "title", "publishedAtRaw", "publishedAtUtc", "eventTimeUtc", "content", "contentSha256"], retentionHours: 24, retainRecordKeys: true },
    model: { enabled: true, fields: ["url", "title", "publishedAtRaw", "publishedAtUtc", "eventTimeUtc", "content", "contentSha256"] },
    distribution: { enabled: true, fields: ["url", "title", "publishedAtRaw", "publishedAtUtc", "eventTimeUtc", "content", "contentSha256"], allowDerivedText: true, allowPermanentArchive: true },
    citation: { enabled: true, attribution: "Owner test observatory", maxCharacters: 1000 },
    deletion: { mode: "owner-request", instructions: "Owner removes source configuration to purge cache; fixture rights allow permanent reports" },
    limits: { pollIntervalSeconds: 60, timeoutMs: 1000, maxResponseBytes: 65536, maxItems: 100, maxRedirects: 3 },
  };
}
