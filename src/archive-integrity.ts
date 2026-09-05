import type { PublishedReport } from "./contracts.ts";
import { inputDigest } from "./publication-gate.ts";
import { consistentRecord, sixEditionMarkdown } from "./six-edition.ts";
import { createHash } from "node:crypto";

// Validate identity and actual publication time before callers use any archive field
// for history selection. The same check protects ordinary reads and history replay.
export function consistentArchive(report: PublishedReport, storedId: string): boolean {
  const { record, version, canonicalMarkdown } = report;
  if (version.id !== storedId || version.id !== `${record.businessDate}-v1` || version.briefId !== record.businessDate ||
    record.id !== `${record.businessDate}-v1-record` || version.reportRecordId !== record.id || version.businessDate !== record.businessDate ||
    version.canonicalMarkdownSha256 !== createHash("sha256").update(canonicalMarkdown, "utf8").digest("hex")) return false;
  if (record.schemaVersion !== 1 && version.publishedAtUtc !== record.publicationGate.checkedAtUtc) return false;
  if (record.schemaVersion < 3) return version.schemaVersion === 1;
  return (record.schemaVersion === 3 || record.schemaVersion === 4 || record.schemaVersion === 5 || record.schemaVersion === 6) && version.schemaVersion !== 1 &&
    record.schemaVersion - 1 === version.schemaVersion && record.editorialContract === version.editorialContract &&
    version.reportRecordSha256 === inputDigest(record) && consistentRecord(record) && sixEditionMarkdown(record) === canonicalMarkdown;
}
