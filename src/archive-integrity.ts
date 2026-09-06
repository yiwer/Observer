import type { PublishedReport } from "./contracts.ts";
import { inputDigest } from "./publication-gate.ts";
import { consistentRecord, sixEditionMarkdown } from "./six-edition.ts";
import { createHash } from "node:crypto";
import { consistentGitHubRecord, githubMarkdown } from "./github-publication.ts";

// Validate identity and actual publication time before callers use any archive field
// for history selection. The same check protects ordinary reads and history replay.
export function consistentArchive(report: PublishedReport, storedId: string): boolean {
  const { record, version, canonicalMarkdown } = report;
  if (version.id !== storedId || version.id !== `${record.businessDate}-v1` || version.briefId !== record.businessDate ||
    record.id !== `${record.businessDate}-v1-record` || version.reportRecordId !== record.id || version.businessDate !== record.businessDate ||
    version.canonicalMarkdownSha256 !== createHash("sha256").update(canonicalMarkdown, "utf8").digest("hex")) return false;
  if (record.schemaVersion !== 1 && version.publishedAtUtc !== record.publicationGate.checkedAtUtc) return false;
  if (record.schemaVersion < 3) return version.schemaVersion === 1;
  if (record.schemaVersion === 8) return version.schemaVersion === 7 && record.editorialContract === version.editorialContract && version.reportRecordSha256 === inputDigest(record) && consistentGitHubRecord(record) && githubMarkdown(record) === canonicalMarkdown;
  return (record.schemaVersion === 3 || record.schemaVersion === 4 || record.schemaVersion === 5 || (record.schemaVersion === 6 || record.schemaVersion === 7)) && version.schemaVersion !== 1 &&
    record.schemaVersion - 1 === version.schemaVersion && record.editorialContract === version.editorialContract &&
    version.reportRecordSha256 === inputDigest(record) && consistentRecord(record) && sixEditionMarkdown(record) === canonicalMarkdown;
}
