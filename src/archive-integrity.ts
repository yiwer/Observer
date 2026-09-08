import type { PublishedReport } from "./contracts.ts";
import { inputDigest } from "./publication-gate.ts";
import { consistentRecord, sixEditionMarkdown } from "./six-edition.ts";
import { createHash } from "node:crypto";
import { consistentGitHubRecord, githubMarkdown } from "./github-publication.ts";
import { consistentGitHubRanking, githubRankingMarkdown } from "./github-ranking.ts";
import { consistentGitHubRepromotion, githubRepromotionMarkdown } from "./github-repromotion.ts";
import { consistentRoutedRecord, routedMarkdown } from "./routed-publication.ts";
import { correctionMarkdown } from "./correction-rendering.ts";

// Validate identity and actual publication time before callers use any archive field
// for history selection. The same check protects ordinary reads and history replay.
export function consistentArchive(report: PublishedReport, storedId: string): boolean {
  const { record, version, canonicalMarkdown } = report;
  if (version.id !== storedId || version.id !== `${record.businessDate}-v${version.version}` || version.briefId !== record.businessDate ||
    record.id !== `${version.id}-record` || version.reportRecordId !== record.id || version.businessDate !== record.businessDate ||
    version.canonicalMarkdownSha256 !== createHash("sha256").update(canonicalMarkdown, "utf8").digest("hex")) return false;
  if (record.schemaVersion !== 1 && version.publishedAtUtc !== record.publicationGate.checkedAtUtc) return false;
  if (record.schemaVersion < 3) return version.schemaVersion === 1;
  if (record.schemaVersion === 12) return version.schemaVersion === 12 && version.version >= 2 && version.previousVersionId === `${record.businessDate}-v${version.version - 1}` &&
    record.publicationMode === version.provenance &&
    record.revision.previousVersionId === version.previousVersionId && record.revision.revisionReason === version.revisionReason && version.editorialContract === record.editorialContract &&
    version.reportRecordSha256 === inputDigest(record) && correctionMarkdown(record) === canonicalMarkdown &&
    record.stories.every((story) => story.claims.every((claim) => record.publicationGate.decisions.some((decision) => decision.storyId === story.id && decision.claimId === claim.id && decision.outcome === "published" && decision.inputClaimSha256 === inputDigest(claim)))) &&
    record.stories.some((story) => story.id === record.revision.findingStoryId) && new Set(record.revision.inherited.map((entry) => entry.edition)).size === record.revision.inherited.length &&
    record.revision.inherited.every((entry) => !record.revision.affectedEditions.includes(entry.edition));
  if (record.schemaVersion === 11) return (version.schemaVersion === 10 && !record.recovery || version.schemaVersion === 11 && !!record.recovery &&
    record.recovery.version === version.version && record.recovery.revisionReason === version.revisionReason && record.recovery.previousVersionId === version.previousVersionId && record.recovery.publishedAtUtc === version.publishedAtUtc && record.recovery.content === version.content && record.recovery.timing === version.timing) &&
    (version.provenance === "scheduled") === (record.publicationMode === "scheduled") && "editorialContract" in version && record.editorialContract === version.editorialContract && version.reportRecordSha256 === inputDigest(record) && consistentRoutedRecord(record) && routedMarkdown(record) === canonicalMarkdown;
  if (record.schemaVersion === 10) return version.schemaVersion === 9 && record.editorialContract === version.editorialContract && version.reportRecordSha256 === inputDigest(record) && consistentGitHubRepromotion(record) && githubRepromotionMarkdown(record) === canonicalMarkdown;
  if (record.schemaVersion === 9) return version.schemaVersion === 8 && record.editorialContract === version.editorialContract && version.reportRecordSha256 === inputDigest(record) && consistentGitHubRanking(record) && githubRankingMarkdown(record) === canonicalMarkdown;
  if (record.schemaVersion === 8) return version.schemaVersion === 7 && record.editorialContract === version.editorialContract && version.reportRecordSha256 === inputDigest(record) && consistentGitHubRecord(record) && githubMarkdown(record) === canonicalMarkdown;
  return (record.schemaVersion === 3 || record.schemaVersion === 4 || record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) && version.schemaVersion !== 1 &&
    record.schemaVersion - 1 === version.schemaVersion && record.editorialContract === version.editorialContract &&
    version.reportRecordSha256 === inputDigest(record) && consistentRecord(record) && sixEditionMarkdown(record) === canonicalMarkdown;
}
