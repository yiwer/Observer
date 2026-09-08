import { editionNames, type PublishedReport } from "./contracts.ts";
import { correctionSectionSource } from "./correction-scope.ts";
import { editionMarkdown } from "./private-archive.ts";
import { escapeMarkdown } from "./publication-gate.ts";
import type { ShadowItem, ShadowReview } from "./shadow-contracts.ts";

/** The sampling PRNG is reproducible, not a security or acceptance digest. */
function shuffled<T>(input: T[], seed: number): T[] {
  const values = [...input]; let state = seed >>> 0;
  for (let index = values.length - 1; index > 0; index--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const next = Math.floor(state / 4294967296 * (index + 1));
    [values[index], values[next]] = [values[next]!, values[index]!];
  }
  return values;
}

export function sampleShadowReport(report: PublishedReport, history: PublishedReport[], seed: number) {
  const versions = new Map(history.map((item) => [item.version.id, item]));
  if (versions.size !== history.length || versions.has(report.version.id)) throw new Error("shadow-duplicate-history");
  versions.set(report.version.id, report);
  const historical = (id: string) => {
    const item = versions.get(id);
    if (!item || item.version.businessDate !== report.version.businessDate) throw new Error("shadow-missing-section-history");
    return item;
  };
  // Reject cycles before using the shared Completion resolver.
  for (const item of versions.values()) {
    const visited = new Set<string>(); let current = item;
    while (current.version.previousVersionId) {
      if (visited.has(current.version.id)) throw new Error("shadow-history-cycle");
      visited.add(current.version.id); current = historical(current.version.previousVersionId);
    }
  }
  const items: ShadowItem[] = [];
  const add = (edition: string, version: string, storyId: string, priority: boolean,
    claims: Array<{ id: string; kind: string; text: string; evidenceIds: string[]; originalText?: string; publisherSourceId?: string }>) => {
    const key = `item-${items.length + 1}`;
    items.push({ key, edition, storyId, sourceVersionId: version, priority, selected: priority,
      claims: claims.map((claim, index) => ({ key: `${key}-claim-${index + 1}`, itemKey: key, kind: claim.kind,
        text: claim.text + (claim.originalText ? `\n原文引语：${claim.originalText}` : "") + (claim.publisherSourceId ? `\n发言归因：${claim.publisherSourceId}` : ""), evidenceRefs: claim.evidenceIds })) });
  };
  for (const edition of Object.keys(editionNames) as Array<keyof typeof editionNames>) {
    const owner = historical(correctionSectionSource(report, edition, historical)), record = owner.record;
    const currentSection = editionMarkdown(report, edition), originalSection = editionMarkdown(owner, edition);
    if (owner !== report && currentSection !== originalSection) throw new Error("shadow-inherited-section-mismatch");
    if (record.schemaVersion === 1 || record.schemaVersion === 2) throw new Error("shadow-six-edition-required");
    if (record.schemaVersion === 12) {
      for (const story of record.stories.filter((entry) => entry.edition === edition)) add(edition, owner.version.id, story.id, true, story.claims);
      continue;
    }
    if (edition === "social-discourse" && "discourse" in record) {
      for (const entry of record.discourse.observations) {
        const group = record.discourse.groups.find((group) => group.id === entry.groupId);
        add(edition, owner.version.id, entry.story.id, entry.priority, [...entry.story.claims,
          ...(group ? [{ id: "sample-context", kind: "rendered", text: JSON.stringify(group), evidenceIds: entry.story.claims.flatMap((claim) => claim.evidenceIds) }] : [])]);
      }
      continue;
    }
    if (edition === "github-projects" && "github" in record) {
      const selected = "githubRepromotion" in record ? record.githubRepromotion.selectedNodeIds : "githubRanking" in record ? record.githubRanking.selectedNodeIds : record.github.watchItems.map((item) => item.nodeId);
      for (const nodeId of selected) {
        const item = record.github.watchItems.find((entry) => entry.nodeId === nodeId);
        if (!item) throw new Error("shadow-github-item-missing");
        const heading = `### Watch Item · ${escapeMarkdown(item.fullName)}`, start = originalSection.indexOf(heading);
        if (start < 0) throw new Error("shadow-github-heading-missing");
        const end = originalSection.indexOf("\n### ", start + heading.length);
        add(edition, owner.version.id, nodeId, false, [{ id: nodeId, kind: "rendered", text: originalSection.slice(start, end < 0 ? undefined : end),
          evidenceIds: [item.current?.id, item.historical?.id].filter((value): value is string => !!value) }]);
      }
      // Ranking, release and security appendices also contain checkable facts.
      const appendix = originalSection.indexOf("### 完整候选排序与理由");
      if (appendix >= 0) add(edition, owner.version.id, "github-appendix", true, [{ id: "appendix", kind: "rendered", text: originalSection.slice(appendix),
        evidenceIds: record.github.runs.flatMap((run) => run.observations.map((entry) => entry.id)) }]);
      continue;
    }
    const selection = "editions" in record ? record.editions.find((item) => item.edition === edition) : undefined;
    for (const storyId of selection?.storyIds ?? []) {
      const story = record.stories.find((entry) => entry.id === storyId);
      if (!story || story.edition !== edition) throw new Error("shadow-selected-story-missing");
      const supporting = "eventClusters" in record ? record.eventClusters.filter((cluster) => cluster.primary.storyId === story.id).flatMap((cluster) => cluster.supportingClaims.map((entry) => entry.claim)) : [];
      add(edition, owner.version.id, story.id, selection!.priorityStoryIds.includes(story.id), [...story.claims, ...supporting]);
    }
  }
  const watch = items.filter((item) => !item.priority), requiredWatch = Math.ceil(watch.length * 0.2);
  for (const item of shuffled(watch, seed).slice(0, requiredWatch)) item.selected = true;
  return { seed, method: "lcg-fisher-yates-v1;canonical-item-order;ceil(0.2*N)", population: items.length,
    priority: items.filter((item) => item.priority).length, watch: watch.length, requiredWatch,
    selected: items.filter((item) => item.selected).map((item) => item.key), items };
}
export type ShadowSample = ReturnType<typeof sampleShadowReport>;

export function reviewShadowSample(sample: ShadowSample, review: ShadowReview | null) {
  const claims = sample.items.filter((item) => item.selected).flatMap((item) => item.claims), checked = new Map(review?.claims.map((entry) => [entry.key, entry]) ?? []);
  if (review && (checked.size !== review.claims.length || [...checked.keys()].some((key) => !claims.some((claim) => claim.key === key)))) throw new Error("shadow-review-claim-mismatch");
  const missing = claims.filter((claim) => {
    const judgment = checked.get(claim.key);
    if (!judgment || !judgment.facts.length && (claim.kind !== "analysis" && claim.kind !== "rendered" || !judgment.noFactReason?.trim())) return true;
    return false;
  });
  const facts = [...checked.values()].flatMap((entry) => entry.facts);
  const supported = facts.filter((fact) => fact.verdict === "supported").length;
  return { selectedClaims: claims.length, missingClaims: missing.length, checkedFacts: facts.length, supportedFacts: supported,
    supportedFraction: facts.length ? supported / facts.length : null, fabricatedSources: facts.filter((fact) => fact.fabricatedSource).length,
    seriousErrors: facts.filter((fact) => fact.seriousError).length, wrongAttributions: facts.filter((fact) => fact.wrongAttribution).length,
    complete: !!review?.finalized && claims.length > 0 && !missing.length && facts.length > 0,
    omissions: review?.omissions ?? null, duplicates: review?.duplicates ?? null, classificationErrors: review?.classificationErrors ?? null, expression: review?.expression ?? null };
}
