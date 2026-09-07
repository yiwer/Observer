import type { GitHubRun } from "./github-contracts.ts";

export type QuotationPolicy = NonNullable<GitHubRun["policy"]>;
export type QuotationUse = { policy: QuotationPolicy; text: string };

// One operation owns one pool. Equal text in copied fields or repeated calls
// is still a distinct use; only actual flat ID references are free of quotes.
export function quotationBudget(limit: (policy: QuotationPolicy) => number | null) {
  const used = new Map<string, number>();
  return (uses: QuotationUse[]): boolean => {
    const next = new Map(used);
    for (const use of uses) {
      const maximum = limit(use.policy);
      if (maximum === null) return false;
      const count = (next.get(use.policy.sourceId) ?? 0) + [...use.text].length;
      if (count > Math.min(500, maximum)) return false;
      next.set(use.policy.sourceId, count);
    }
    for (const [sourceId, count] of next) used.set(sourceId, count);
    return true;
  };
}
