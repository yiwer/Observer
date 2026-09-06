import type { CollectedEvidence, ReportRecord, SixEditionRequest } from "./contracts.ts";
import type { CandidateV2, Claim, Verification } from "./gate-contracts.ts";
import { DiscourseReasonSchema, DiscourseSampleSchema, discourseRules, type DiscourseConfiguration, type DiscourseReason, type DiscourseSample } from "./discourse-contracts.ts";
import { discoursePermission, type DiscourseAdapter } from "./mastodon-adapter.ts";
import { policyDigest, type SourcePolicy } from "./collection.ts";
import { inputDigest } from "./publication-gate.ts";
import { selectInterests } from "./interest-selection.ts";

type Discourse = Extract<ReportRecord, { schemaVersion: 7 }>["discourse"];
export interface DiscourseOptions { configuration: unknown; adapter?: DiscourseAdapter; }
export async function prepareDiscourse(input: { request: Extract<SixEditionRequest, { schemaVersion: 6 }>; configuration: DiscourseConfiguration; frozenAtUtc: string;
  adapter: DiscourseAdapter | undefined; policies: () => SourcePolicy[]; clock: () => string; signal?: AbortSignal }) {
  const configuration = structuredClone(input.configuration);
  const configurationSha256 = inputDigest(configuration);
  const sourcesAtStart = input.policies();
  const sources = new Map(configuration.groups.map((group) => [group.id, sourcesAtStart.find((source) => source.sourceId === group.sourceId)]));
  const samples = new Map<string, DiscourseSample>();
  const failed = new Map<string, DiscourseReason>();
  const groups: Discourse["groups"] = configuration.groups.map((group) => ({ id: group.id, sourceId: group.sourceId, kind: group.kind, platform: "Mastodon", query: `#${group.tag}；local=true；语言过滤=${group.language ?? "不限（保留未知）"}`,
    linkedEvidenceIds: group.linkedEvidenceIds,
    windowStartUtc: input.request.evidenceBundle.windowStartUtc, cutoffUtc: input.request.evidenceBundle.cutoffUtc,
    language: null, regionBasis: null, sampleSize: null, receivedCount: null, duplicateCount: null, isolatedCount: null, rootCount: null, bucketCounts: null, reason: null }));
  for (const group of configuration.groups) {
    const source = sources.get(group.id);
    if (!discoursePermission(source, group.tag, input.frozenAtUtc)) { failed.set(group.id, "social-no-eligible-source"); continue; }
    if (input.request.evidenceBundle.evidence.some((evidence) => evidence.id === `discourse-${group.id}`)) { failed.set(group.id, "social-snapshot-invalid"); continue; }
    const matches = (input.request.discourseSamples ?? []).filter((sample) => typeof sample === "object" && sample !== null && "groupId" in sample && sample.groupId === group.id);
    const checked = matches.length === 1 ? DiscourseSampleSchema.safeParse(matches[0]) : null;
    if (!checked?.success) { failed.set(group.id, "social-snapshot-unavailable"); continue; }
    const sample = checked.data;
    if (sample.sourceId !== group.sourceId || sample.policyVersion !== source!.version || sample.policySha256 !== policyDigest(source!) ||
      sample.configurationSha256 !== configurationSha256 || sample.rulesSha256 !== inputDigest(discourseRules) || sample.businessDate !== input.request.businessDate ||
      sample.windowStartUtc !== input.request.evidenceBundle.windowStartUtc || sample.cutoffUtc !== input.request.evidenceBundle.cutoffUtc ||
      sample.capturedAtUtc > sample.cutoffUtc && (sample.reason !== "social-after-cutoff" || sample.records.length !== 0) || sample.expiresAtUtc > new Date(Date.parse(sample.capturedAtUtc) + source!.storage.retentionHours * 3600000).toISOString() ||
      sample.records.some((record) => record.createdAtUtc <= sample.windowStartUtc || record.createdAtUtc > sample.capturedAtUtc || record.editedAtUtc !== null && record.editedAtUtc > sample.capturedAtUtc) ||
      sample.records.length + sample.duplicateCount + sample.isolatedCount !== sample.receivedCount || new Set(sample.records.map((record) => record.id)).size !== sample.records.length ||
      new Set(sample.records.map((record) => record.text)).size !== sample.records.length) { failed.set(group.id, "social-snapshot-invalid"); continue; }
    samples.set(group.id, sample);
    const projected = groups.find((entry) => entry.id === group.id)!;
    const midpoint = (Date.parse(sample.windowStartUtc) + Date.parse(sample.cutoffUtc)) / 2;
    const early = sample.records.filter((record) => Date.parse(record.createdAtUtc) <= midpoint).length;
    Object.assign(projected, { sampleSize: sample.records.length, receivedCount: sample.receivedCount, duplicateCount: sample.duplicateCount, isolatedCount: sample.isolatedCount,
      rootCount: sample.records.length, bucketCounts: [early, sample.records.length - early],
      language: sample.records.some((record) => record.language === null) ? null : [...new Set(sample.records.map((record) => record.language))].sort().join("、") || null });
    if (sample.reason) failed.set(group.id, sample.reason);
    else if (sample.expiresAtUtc <= input.clock()) failed.set(group.id, "social-expired");
    else if (sample.duplicateCount / Math.max(1, sample.receivedCount) > discourseRules.maximumDuplicateFraction) failed.set(group.id, "social-skewed");
    else if (sample.records.length < (group.kind === "story-linked" ? discourseRules.linkedMinimum : discourseRules.nativeMinimum)) failed.set(group.id, "social-insufficient-sample");
    else if (sample.records.length < discourseRules.minimumRoots || early === 0 || early === sample.records.length) failed.set(group.id, "social-skewed");
    else if (input.request.evidenceBundle.schemaVersion !== 2) failed.set(group.id, "social-collected-bundle-required");
  }
  const refresh = async () => {
    let current: SourcePolicy[];
    for (const group of configuration.groups) {
      if (failed.has(group.id)) continue;
      try { current = input.policies(); } catch { current = []; }
      const source = current.find((source) => source.sourceId === group.sourceId);
      const sample = samples.get(group.id)!;
      if (!discoursePermission(source, group.tag, input.clock()) || policyDigest(source!) !== sample.policySha256) { failed.set(group.id, "social-permission-changed"); continue; }
      if (sample.expiresAtUtc <= input.clock()) { failed.set(group.id, "social-expired"); continue; }
      try {
        const result = input.adapter ? await input.adapter.revalidate(structuredClone(sample), source!, input.signal) : "social-snapshot-unavailable";
        if (result !== null) { const reason = DiscourseReasonSchema.safeParse(result); failed.set(group.id, reason.success ? reason.data : "social-recheck-incomplete"); }
        else {
          const latest = input.policies().find((source) => source.sourceId === group.sourceId);
          if (!discoursePermission(latest, group.tag, input.clock()) || policyDigest(latest!) !== sample.policySha256) failed.set(group.id, "social-permission-changed");
          else if (sample.expiresAtUtc <= input.clock()) failed.set(group.id, "social-expired");
        }
      } catch { failed.set(group.id, "social-recheck-incomplete"); }
    }
    // A later group's await may revoke or expire an earlier group's source.
    // Close the whole round synchronously: no more source I/O after this sweep.
    try { current = input.policies(); } catch { current = []; }
    const finalAtUtc = input.clock();
    for (const group of configuration.groups) {
      if (failed.has(group.id)) continue;
      const source = current.find((source) => source.sourceId === group.sourceId);
      const sample = samples.get(group.id)!;
      if (!discoursePermission(source, group.tag, finalAtUtc) || policyDigest(source!) !== sample.policySha256) failed.set(group.id, "social-permission-changed");
      else if (sample.expiresAtUtc <= finalAtUtc) failed.set(group.id, "social-expired");
    }
  };
  await refresh();
  const evidence: CollectedEvidence[] = configuration.groups.flatMap((group) => {
    if (failed.has(group.id)) return [];
    const source = sources.get(group.id)!;
    const sample = samples.get(group.id)!;
    const content = [`Mastodon 单实例本地原发样本；组 ${group.id}；查询 #${group.tag}；窗口 ${sample.windowStartUtc} 至 ${sample.cutoffUtc}；样本 ${sample.records.length}。只分析样本论点，不作为新闻独立证据。`, ...sample.records.map((record, index) => `样本 ${index + 1}：${record.text}`)].join("\n");
    return [{ id: `discourse-${group.id}`, sourceId: source.sourceId, sourceType: source.sourceType, policyVersion: source.version, policySha256: policyDigest(source), trust: "untrusted-source-data",
      discoveredAtUtc: sample.capturedAtUtc, retrievedAtUtc: sample.capturedAtUtc, expiresAtUtc: sample.expiresAtUtc,
      url: new URL(`/api/v1/timelines/tag/${encodeURIComponent(group.tag)}?local=true`, source.feedUrl).href, title: `Mastodon #${group.tag} 匿名话语样本`,
      publishedAtUtc: null, eventTimeUtc: null, content, contentSha256: inputDigestText(content) }];
  });
  const groupFor = (id: string) => configuration.groups.find((group) => id === `discourse-${group.id}`);
  return { evidence, refresh,
    nativeStoryIds(stories: CandidateV2[]) { return new Set(stories.filter((story) => story.edition === "social-discourse" && configuration.groups.some((group) => group.id === story.eventClusterId && group.kind === "platform-native")).map((story) => story.id)); },
    modelFailure(ids: string[]) { return ids.map((id) => groupFor(id)).filter((group) => !!group).map((group) => failed.get(group!.id)).find((reason) => reason !== undefined) ?? null; },
    claimEligibility(story: CandidateV2, claim: Claim) {
      const social = claim.evidenceIds.map(groupFor).filter((group) => !!group);
      if (!social.length && story.edition !== "social-discourse") return null;
      if (story.edition !== "social-discourse" || claim.kind !== "analysis" || social.length !== 1 || claim.evidenceIds.length !== 1 || social[0]!.id !== story.eventClusterId) return "social-invalid-claim";
      return failed.get(social[0]!.id) ?? null;
    },
    semanticEligibility(story: CandidateV2, _claim: Claim, assessment: Verification["assessments"][number]) {
      if (story.edition !== "social-discourse") return null;
      const group = configuration.groups.find((group) => group.id === story.eventClusterId);
      const label = assessment.discourse;
      return group && label?.scope === "sample-only" && label.individualProfiling === false && assessment.conclusion === "supported" && assessment.wording === "original" && assessment.domain?.assertion === "interpretation" &&
        label.content === (group.kind === "story-linked" ? "arguments-and-disagreements" : "emerging-topic") ? null : "social-unsafe-inference";
    },
    project(record: Extract<ReportRecord, { schemaVersion: 6 }>, candidates: CandidateV2[]): Extract<ReportRecord, { schemaVersion: 7 }> {
      const observations: Discourse["observations"] = [];
      const eligibleGroups = configuration.groups.flatMap((group) => {
        if (failed.has(group.id)) return [];
        const stories = candidates.filter((story) => story.edition === "social-discourse" && story.eventClusterId === group.id);
        const clusters = record.eventClusters.filter((cluster) => cluster.primary.edition !== "social-discourse" && group.linkedEvidenceIds.length > 0 && group.linkedEvidenceIds.every((id) => cluster.evidenceIds.includes(id)));
        if (group.kind === "story-linked" && clusters.length !== 1) { failed.set(group.id, "social-main-story-unavailable"); return []; }
        if (stories.length !== 1) { failed.set(group.id, "social-analysis-unavailable"); return []; }
        const story = stories[0]!;
        if (!story.claims.length || story.claims.some((claim) => !record.publicationGate.decisions.some((decision) => decision.storyId === story.id && decision.claimId === claim.id && decision.outcome === "published"))) { failed.set(group.id, "social-analysis-unavailable"); return []; }
        return [{ group, story, cluster: group.kind === "story-linked" ? clusters[0]! : null }];
      });
      const selected = selectInterests(record.publicationGate, eligibleGroups.filter(({ group }) => group.kind === "platform-native").map(({ story }) => story), record.interestProfile, []);
      const selectedNativeIds = selected.stories.slice(0, 7).map((story) => story.id);
      for (const { group, story, cluster } of eligibleGroups) {
        if (group.kind === "platform-native" && !selected.stories.some((candidate) => candidate.id === story.id)) { failed.set(group.id, "social-interest-excluded"); continue; }
        if (group.kind === "platform-native" && !selectedNativeIds.includes(story.id)) { failed.set(group.id, "social-capacity-limit"); continue; }
        observations.push({ groupId: group.id, kind: group.kind, priority: group.kind === "platform-native" && selectedNativeIds.indexOf(story.id) < 3,
          story: { ...story, title: "匿名样本中的话语观察" }, linkedClusterId: cluster?.id ?? null, primaryStoryId: cluster?.primary.storyId ?? null, primaryVersionId: cluster?.primary.versionId ?? null });
      }
      observations.sort((a, b) => a.kind !== b.kind ? a.kind === "story-linked" ? -1 : 1 : a.kind === "platform-native" ? selectedNativeIds.indexOf(a.story.id) - selectedNativeIds.indexOf(b.story.id) : 0);
      const displayGroups = [...observations.map((observation) => groups.find((group) => group.id === observation.groupId)!), ...groups.filter((group) => !observations.some((observation) => observation.groupId === group.id))];
      const failedEvidenceIds = new Set(configuration.groups.filter((group) => failed.has(group.id)).map((group) => `discourse-${group.id}`));
      const failedClaims = new Set(record.publicationGate.decisions.filter((decision) => decision.evidenceIds.some((id) => failedEvidenceIds.has(id))).map((decision) => JSON.stringify([decision.storyId, decision.claimId])));
      const finalReceipt = (verification: Verification | null) => verification ? { ...verification, assessments: verification.assessments.filter((assessment) =>
        !failedClaims.has(JSON.stringify([assessment.storyId, assessment.claimId])) && !assessment.evidence.some((evidence) => failedEvidenceIds.has(evidence.evidenceId))) } : null;
      const gate = record.publicationGate;
      const publicationGate = gate.schemaVersion === 1 ? { ...gate, verification: finalReceipt(gate.verification) } : { ...gate, batches: gate.batches.map((batch) => ({ ...batch, verification: finalReceipt(batch.verification) })) };
      return { ...record, publicationGate, schemaVersion: 7, editorialContract: "observer-canonical-v5", interestSelections: [...record.interestSelections, ...selected.interestSelections], discourse: { schemaVersion: 1, rulesVersion: "observer-discourse-v1", frozenAtUtc: input.frozenAtUtc, configurationSha256,
        groups: displayGroups.map((group) => ({ ...group, reason: failed.get(group.id) ?? null })), observations },
        coverageGaps: [...record.coverageGaps.filter((gap) => gap.edition !== "social-discourse" || gap.reason !== "below-interest-selection-target"),
          ...(observations.length < 7 ? [{ edition: "social-discourse" as const, reason: "social-below-target" }] : []),
          ...groups.filter((group) => failed.has(group.id)).map((group) => ({ edition: "social-discourse" as const, reason: failed.get(group.id)! })),
          ...(groups.length ? [] : [{ edition: "social-discourse" as const, reason: "social-no-eligible-source" }])],
      };
    },
  };
}
export function consistentDiscourse(record: Extract<ReportRecord, { schemaVersion: 7 }>): boolean {
  const { groups, observations } = record.discourse;
  if (new Set(groups.map((group) => group.id)).size !== groups.length || new Set(observations.map((observation) => observation.groupId)).size !== observations.length ||
    new Set(observations.map((observation) => observation.story.id)).size !== observations.length) return false;
  if (groups.some((group) => group.windowStartUtc !== record.evidenceBundle.windowStartUtc || group.cutoffUtc !== record.evidenceBundle.cutoffUtc ||
    group.reason !== null && !record.coverageGaps.some((gap) => gap.edition === "social-discourse" && gap.reason === group.reason) ||
    group.reason === null && !observations.some((observation) => observation.groupId === group.id))) return false;
  const native = observations.filter((observation) => observation.kind === "platform-native");
  if (native.length > 7 || native.some((observation, index) => observation.priority !== (index < 3))) return false;
  const selected = selectInterests(record.publicationGate, native.map((observation) => observation.story), record.interestProfile, []);
  if (inputDigest(selected.stories.map((story) => story.id)) !== inputDigest(native.map((observation) => observation.story.id)) ||
    selected.interestSelections.some((selection) => selection.baseline || selection.outcome !== "eligible" || inputDigest(selection) !== inputDigest(record.interestSelections.find((entry) => entry.storyId === selection.storyId)))) return false;
  return observations.every((observation) => {
    const group = groups.find((group) => group.id === observation.groupId);
    const story = observation.story;
    if (!group || group.reason !== null || group.kind !== observation.kind || group.sampleSize === null || group.receivedCount === null || group.duplicateCount === null || group.isolatedCount === null ||
      group.sampleSize < (group.kind === "story-linked" ? discourseRules.linkedMinimum : discourseRules.nativeMinimum) || group.rootCount !== group.sampleSize ||
      !group.bucketCounts || group.bucketCounts.some((count) => count < 1) || group.bucketCounts[0] + group.bucketCounts[1] !== group.sampleSize ||
      group.sampleSize + group.duplicateCount + group.isolatedCount !== group.receivedCount || group.duplicateCount / group.receivedCount > discourseRules.maximumDuplicateFraction ||
      story.title !== "匿名样本中的话语观察" || story.eventClusterId !== group.id || story.edition !== "social-discourse" ||
      !record.editions.find((entry) => entry.edition === "social-discourse")?.candidateStoryIds.includes(story.id) ||
      story.claims.some((claim) => claim.kind !== "analysis" || claim.evidenceIds.length !== 1 || claim.evidenceIds[0] !== `discourse-${group.id}` ||
        !record.evidenceBundle.evidence.some((evidence) => evidence.id === claim.evidenceIds[0] && evidence.sourceId === group.sourceId && evidence.origin.kind === "collected" && evidence.url && evidence.title) ||
        !record.publicationGate.decisions.some((decision) => decision.storyId === story.id && decision.claimId === claim.id && decision.outcome === "published" && decision.inputClaimSha256 === inputDigest(claim)))) return false;
    if (observation.kind === "platform-native") return observation.linkedClusterId === null && observation.primaryStoryId === null && observation.primaryVersionId === null;
    const clusters = record.eventClusters.filter((cluster) => group.linkedEvidenceIds.length > 0 && group.linkedEvidenceIds.every((id) => cluster.evidenceIds.includes(id)));
    return observation.priority === false && clusters.length === 1 && clusters[0]!.id === observation.linkedClusterId && clusters[0]!.primary.storyId === observation.primaryStoryId &&
      clusters[0]!.primary.versionId === observation.primaryVersionId && clusters[0]!.primary.edition !== "social-discourse";
  });
}
import { createHash } from "node:crypto";
const inputDigestText = (text: string) => createHash("sha256").update(text).digest("hex");
