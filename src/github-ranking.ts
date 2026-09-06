import { z } from "zod";
import { GitHubRankingSnapshotSchema, type GitHubRankingSnapshot } from "./github-contracts.ts";
import { InterestSnapshotSchema, type InterestSnapshot } from "./interest-contracts.ts";
import { selectGitHubItems } from "./github-observations.ts";
import { githubDigest } from "./github-adapter.ts";
import { consistentGitHubRecord, githubMarkdown } from "./github-publication.ts";
import type { ReportRecord } from "./contracts.ts";
import { escapeMarkdown } from "./publication-gate.ts";
import { interestKeyHash } from "./interest-profile.ts";

function compareNodeIds(a: string, b: string): number {
  const left = Array.from(a), right = Array.from(b);
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    const difference = left[index]!.codePointAt(0)! - right[index]!.codePointAt(0)!;
    if (difference) return difference;
  }
  return left.length - right.length;
}

import { heatRules, GitHubCoverageHistorySchema, GitHubRankingSchema, type GitHubCoverageHistory } from "./github-ranking-contracts.ts";
export type { GitHubCoverageHistory } from "./github-ranking-contracts.ts";
export function rankGitHub(input: { snapshot: GitHubRankingSnapshot; interestProfile: InterestSnapshot; history: GitHubCoverageHistory; algorithmVersion: "observer-github-heat-v1" }): z.infer<typeof GitHubRankingSchema> {
  let { snapshot } = input;
  const history = GitHubCoverageHistorySchema.parse(input.history);
  const profile = InterestSnapshotSchema.parse(input.interestProfile);
  if (input.algorithmVersion !== "observer-github-heat-v1" || githubDigest(profile.profile) !== profile.sha256 ||
    new Set(history.entries.map((entry) => entry.versionId)).size !== history.entries.length || history.entries.some((entry) => entry.publishedAtUtc > snapshot.cutoffUtc || new Set(entry.nodeIds).size !== entry.nodeIds.length)) throw new Error("github-ranking-input-invalid");
  const checked = GitHubRankingSnapshotSchema.safeParse(snapshot);
  if (!checked.success) throw new Error("github-ranking-input-invalid");
  snapshot = checked.data;
  const reconstructed = selectGitHubItems(snapshot.runs, snapshot.cutoffUtc, snapshot.identities);
  if (githubDigest(reconstructed.filter((item) => item.status === "measured" || item.status === "cold-start")) !== githubDigest(snapshot.watchItems) ||
    githubDigest(reconstructed.filter((item) => item.status !== "measured" && item.status !== "cold-start")) !== githubDigest(snapshot.exclusions) ||
    new Set(reconstructed.map((item) => item.nodeId)).size > 50 ||
    (snapshot.configuration ? githubDigest(snapshot.configuration) !== snapshot.configurationSha256 : snapshot.configurationSha256 !== null || snapshot.runs.length > 0) ||
    snapshot.runs.some((run) => run.configurationSha256 !== snapshot.configurationSha256 || githubDigest(run.configuration) !== run.configurationSha256 ||
      run.availableAtUtc > snapshot.cutoffUtc || run.startedAtUtc > run.availableAtUtc || run.id !== githubDigest([run.scheduledAtUtc, run.configuration, run.policy]) ||
      run.observations.some((entry) => { const { id, ...metadata } = entry; return id !== githubDigest([run.id, metadata]) || entry.observedAtUtc > entry.availableAtUtc ||
        entry.availableAtUtc > run.availableAtUtc || entry.observedAtUtc < run.startedAtUtc || (entry.reason === null) !== (entry.stars !== null && entry.forks !== null); })) ||
    new Set(snapshot.identities.map((entry) => entry.nodeId)).size !== snapshot.identities.length || snapshot.identities.some((entry) => entry.firstSeenAtUtc > snapshot.cutoffUtc ||
      entry.names.some((name) => name.observedAtUtc < entry.firstSeenAtUtc || name.observedAtUtc > snapshot.cutoffUtc) || !entry.truncated && githubDigest(entry.names) !== entry.historySha256)) {
    throw new Error("github-ranking-input-invalid");
  }
  const items = snapshot.watchItems;
  const percentile = (value: number, values: number[]) => value <= 0 ? 0 : (values.filter((entry) => entry < value).length + values.filter((entry) => entry === value).length / 2) / values.length;
  const validAge = (item: typeof items[number]) => item.current?.createdAtUtc !== null && item.current?.createdAtUtc !== undefined && item.current.createdAtUtc <= item.current.observedAtUtc && item.current.createdAtUtc <= snapshot.cutoffUtc;
  const age = (item: typeof items[number]) => {
    const days = validAge(item) ? (Date.parse(snapshot.cutoffUtc) - Date.parse(item.current!.createdAtUtc!)) / heatRules.dayMs : null;
    return days === null ? "unknown" as const : days < 30 ? "0-29d" as const : days < 365 ? "30-364d" as const : "365d+" as const;
  };
  const signal = (item: typeof items[number], kind: "stars" | "forks") => !validAge(item) ? 0 : item.status === "measured" ? Math.max(0, (kind === "stars" ? item.starsDelta : item.forksDelta) ?? 0) * heatRules.dayMs / (Date.parse(item.current!.observedAtUtc) - Date.parse(item.historical!.observedAtUtc)) :
    (item.current?.[kind] ?? 0) / Math.max(1, (Date.parse(snapshot.cutoffUtc) - Date.parse(item.current!.createdAtUtc!)) / heatRules.dayMs);
  const ranked = items.map((item) => {
    let peers = items.filter((peer) => validAge(peer) && peer.status === item.status && age(peer) === age(item) && peer.current?.language === item.current?.language);
    let fallback: "language-age" | "age" | "partition" = "language-age";
    if (peers.length < heatRules.minimumCohort) { peers = items.filter((peer) => validAge(peer) && peer.status === item.status && age(peer) === age(item)); fallback = "age"; }
    if (peers.length < heatRules.minimumCohort) { peers = items.filter((peer) => validAge(peer) && peer.status === item.status); fallback = "partition"; }
    const publications = history.entries.filter((entry) => entry.nodeIds.includes(item.nodeId));
    const lastReportedAtUtc = publications.map((entry) => entry.publishedAtUtc).sort().at(-1) ?? null;
    const elapsed = lastReportedAtUtc === null ? Infinity : Date.parse(snapshot.cutoffUtc) - Date.parse(lastReportedAtUtc);
    const cooldown = elapsed <= heatRules.cooldownDays * heatRules.dayMs;
    const recoveryMultiplier = Math.min(1, Math.max(0, (elapsed - heatRules.cooldownDays * heatRules.dayMs) / (heatRules.recoveryDays * heatRules.dayMs)));
    const reportCount90d = publications.filter((entry) => Date.parse(entry.publishedAtUtc) > Date.parse(snapshot.cutoffUtc) - heatRules.frequencyDays * heatRules.dayMs).length;
    const frequencyMultiplier = 1 / (1 + heatRules.frequencyPenalty * reportCount90d);
    const starsSignal = signal(item, "stars"), forksSignal = signal(item, "forks");
    const attention = item.status === "measured" ? starsSignal > 0 || forksSignal > 0 : item.current!.stars! >= heatRules.coldStars || item.current!.forks! >= heatRules.coldForks;
    const starsPercentile = percentile(starsSignal, peers.map((peer) => signal(peer, "stars"))), forksPercentile = percentile(forksSignal, peers.map((peer) => signal(peer, "forks")));
    const baseScore = heatRules.starsWeight * starsPercentile + heatRules.forksWeight * forksPercentile;
    const topics = new Set((item.current?.topics ?? []).map(interestKeyHash));
    const matches = profile.profile.topics.filter((entry) => topics.has(interestKeyHash(entry.key)));
    const excluded = profile.profile.exclusions.topics.some((topic) => topics.has(interestKeyHash(topic)));
    const interestMultiplier = 1 + heatRules.topicGain * Math.max(0, ...matches.map((entry) => entry.priority)) / 100;
    return { nodeId: item.nodeId, cooldown, excluded, invalidAge: !validAge(item), lastReportedAtUtc, reportCount90d, recoveryMultiplier, frequencyMultiplier, novel: history.unavailableVersionIds.length === 0 && elapsed >= heatRules.noveltyDays * heatRules.dayMs,
      partition: item.status as "measured" | "cold-start", starsSignal, forksSignal, starsPercentile, forksPercentile, baseScore,
      interestMultiplier, matchedTopics: matches.map((entry) => entry.key),
      score: !validAge(item) || !attention || excluded || history.unavailableVersionIds.length ? 0 : baseScore * interestMultiplier * recoveryMultiplier * frequencyMultiplier,
      cohort: { language: item.current?.language ?? null, age: age(item), fallback, memberNodeIds: peers.map((peer) => peer.nodeId).sort() } };
  })
    .map((item) => ({ ...item, sortKey: Math.round(item.score * heatRules.sortScale) }))
    .sort((a, b) => Number(a.partition === "cold-start") - Number(b.partition === "cold-start") || b.sortKey - a.sortKey || compareNodeIds(a.nodeId, b.nodeId));
  const eligible = ranked.filter((item) => item.score > 0);
  const novel = eligible.filter((item) => item.novel);
  const actual = Math.min(heatRules.target, eligible.length, novel.length * 2);
  const reserved = new Set(novel.slice(0, Math.ceil(actual / 2)).map((item) => item.nodeId));
  const chosen = new Set(reserved);
  for (const item of eligible) if (chosen.size < actual) chosen.add(item.nodeId);
  const ordinaryCapacity = new Set(eligible.slice(0, heatRules.target).map((item) => item.nodeId));
  const selectedNodeIds = ranked.filter((item) => chosen.has(item.nodeId)).map((item) => item.nodeId);
  const selectedNovel = ranked.filter((item) => chosen.has(item.nodeId) && item.novel).length;
  if (selectedNovel < Math.ceil(selectedNodeIds.length / 2)) throw new Error("github-ranking-quota-invalid");
  return GitHubRankingSchema.parse({ algorithmVersion: "observer-github-heat-v1", rules: heatRules, history,
    unranked: snapshot.exclusions.map(({ nodeId, status, reason }) => ({ nodeId, status, reason })),
    candidates: ranked.map(({ cooldown, excluded, invalidAge, ...item }) => ({ ...item, selected: chosen.has(item.nodeId), selection: reserved.has(item.nodeId) ? "novelty-reserved" : chosen.has(item.nodeId) ? "rank-fill" : null,
      reason: history.unavailableVersionIds.length ? "history-unavailable" : invalidAge ? "invalid-age" : excluded ? "topic-excluded" : cooldown ? "cooldown" : item.score <= 0 ? "attention-insufficient" : chosen.has(item.nodeId) ? "selected" : ordinaryCapacity.has(item.nodeId) ? "novelty-quota" : "capacity" })), selectedNodeIds,
    quota: { target: 7, actual: selectedNodeIds.length, requiredNovel: Math.ceil(selectedNodeIds.length / 2), selectedNovel, eligibleNovel: novel.length } });
}
type RankedRecord = Extract<ReportRecord, { schemaVersion: 9 }>;
function projectedRecord(record: RankedRecord): Extract<ReportRecord, { schemaVersion: 8 }> {
  const { githubRanking: _ranking, ...prior } = record;
  return { ...prior, schemaVersion: 8, editorialContract: "observer-canonical-v6", github: { ...record.github, schemaVersion: 1,
    watchItems: record.github.watchItems.slice(0, 7) } };
}
export function consistentGitHubRanking(record: RankedRecord): boolean {
  // Retain legacy editorial validation, then independently reconstruct ALL ranking receipts.
  const projected = projectedRecord(record);
  if (!consistentGitHubRecord(projected)) return false;
  if (record.githubRanking.history.unavailableVersionIds.length && !record.coverageGaps.some((gap) => gap.edition === "github-projects" && gap.reason === "github-history-unavailable")) return false;
  try { return githubDigest(rankGitHub({ snapshot: record.github, interestProfile: record.interestProfile, history: record.githubRanking.history, algorithmVersion: record.githubRanking.algorithmVersion })) === githubDigest(record.githubRanking); }
  catch { return false; }
}
export function githubRankingMarkdown(record: RankedRecord): string {
  const projected = projectedRecord(record);
  projected.github.watchItems = record.githubRanking.selectedNodeIds.map((nodeId) => record.github.watchItems.find((item) => item.nodeId === nodeId)!);
  let rendered = githubMarkdown(projected)
    .replaceAll("observer-canonical-v6", "observer-canonical-v7")
    .replace("有限候选按稳定 node ID 排列，未计算综合热度排名。", `Observer GitHub Heat；算法 ${record.githubRanking.algorithmVersion}；保存全部 ${record.githubRanking.candidates.length} 个候选的排序依据。实测分数按实际双点间隔折算24小时平均速率；原始正、零、负净变化与实际时刻不变，不声称精确事件流水。\n\n新颖性配额：实际 ${record.githubRanking.quota.actual} 个位置，过去30天未报道 ${record.githubRanking.quota.selectedNovel} 个；至少 ${record.githubRanking.quota.requiredNovel} 个。`);
  if (record.githubRanking.history.unavailableVersionIds.length) rendered = rendered.replace("## GitHub 热门项目\n", "## GitHub 热门项目\n\nCoverage Gap：github-history-unavailable；近90天出版历史无法取得完整可证身份或当前使用权限，本栏暂停普通排序，不能将未知历史视为未报道。\n");
  rendered += "\n### 完整候选排序与理由\n\n" +
    `权重 stars ${heatRules.starsWeight} / forks ${heatRules.forksWeight}；正信号使用 cohort 中位秩分位；topic 增益最高 ${heatRules.topicGain}；7天冷却后30天线性恢复；90天频率系数 ${heatRules.frequencyPenalty}。\n\n` +
    "热度仅是有限观测内的注意力信号，不代表项目质量、安全或安装建议。工程参数未经真实用户满意度校准；小 cohort 回退降低比较精度，不保证语言覆盖。\n\n" +
    record.githubRanking.candidates.map((item, index) => `${index + 1}. ${escapeMarkdown(item.nodeId)} · ${item.partition} · 分数 ${item.score.toPrecision(6)} / sortKey ${item.sortKey} · ${item.reason}${item.selection ? ` (${item.selection})` : ""}；cohort ${escapeMarkdown(item.cohort.language ?? "unknown-language")}/${item.cohort.age}/${item.cohort.fallback} (${item.cohort.memberNodeIds.length})；stars/forks 分位 ${item.starsPercentile}/${item.forksPercentile}；兴趣×${item.interestMultiplier}、恢复×${item.recoveryMultiplier}、频率×${item.frequencyMultiplier} (${item.reportCount90d}次)，30天未报道=${item.novel}。`).join("\n") + "\n";
  rendered = rendered.replaceAll("Cold-start Heat：观察历史不足；仅展示存量，尚无可信 24h 净变化；未计算代理分数。", "Cold-start Heat：观察历史不足；存量/仓库年龄代理，尚无可信 24h 净变化，分数不与实测动量混排。");
  for (const partition of ["measured", "cold-start"] as const) {
    const first = record.githubRanking.candidates.find((item) => item.selected && item.partition === partition);
    if (first) {
      const index = record.githubRanking.selectedNodeIds.indexOf(first.nodeId);
      const item = projected.github.watchItems[index]!;
      const heading = `### Watch Item · ${escapeMarkdown(item.fullName)}`;
      rendered = rendered.replace(heading, `### ${partition === "measured" ? "实测动量分区" : "冷启动代理分区"}\n\n${heading}`);
    }
  }
  return rendered;
}
