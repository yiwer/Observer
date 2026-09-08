import type { PublishedReport, editionNames } from "./contracts.ts";

// The owner of the current Canonical section, including Completion inheritance.
export function correctionSectionSource(previous: PublishedReport, edition: keyof typeof editionNames, historical: (id: string) => PublishedReport) {
  if (previous.record.schemaVersion === 12) return previous.record.revision.inherited.find((entry) => entry.edition === edition)?.sourceVersionId ?? previous.version.id;
  let parent = previous;
  while (parent.record.schemaVersion === 11 && parent.record.recovery?.revisionReason === "completion" && !parent.record.recovery.completedEditions.includes(edition) && parent.version.previousVersionId) {
    parent = historical(parent.version.previousVersionId);
  }
  return parent.version.id;
}
