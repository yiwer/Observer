import type { ReportRecord } from "./contracts.ts";
import { githubDigest } from "./github-adapter.ts";
import { rankGitHub, consistentGitHubRanking, githubRankingMarkdown, type GitHubCoverageHistory } from "./github-ranking.ts";
import { reconstructDevelopments } from "./github-developments.ts";
import { consistentAdvisories } from "./github-advisories.ts";
import { GitHubEventHistorySchema, GitHubRepromotionRankingSchema, GitHubRepromotionSnapshotSchema, repromotionRules,
  type GitHubRepromotionSnapshot, type GitHubEventHistory, type DevelopmentSnapshot } from "./github-development-contracts.ts";
import type { InterestSnapshot } from "./interest-contracts.ts";
import { escapeMarkdown } from "./publication-gate.ts";
import { reconstructMomentum, evaluateMomentum } from "./github-momentum.ts";

export function emptyDevelopments(cutoffUtc: string): DevelopmentSnapshot {
  return { schemaVersion: 1, cutoffUtc, configuration: null, configurationSha256: null, runs: [], reasons: ["github-development-disabled"] };
}
function codepoints(left: string, right: string): number {
  const a = Array.from(left), b = Array.from(right);
  for (let i = 0; i < Math.min(a.length, b.length); i++) { const difference = a[i]!.codePointAt(0)! - b[i]!.codePointAt(0)!; if (difference) return difference; }
  return a.length - b.length;
}
export function rankGitHubRepromotions(input: { snapshot: GitHubRepromotionSnapshot; interestProfile: InterestSnapshot; coverageHistory: GitHubCoverageHistory;
  eventHistory: GitHubEventHistory; algorithmVersion: "observer-github-repromotion-v1" }) {
  if (input.algorithmVersion !== "observer-github-repromotion-v1") throw new Error("github-repromotion-input-invalid");
  const snapshot = GitHubRepromotionSnapshotSchema.parse(input.snapshot);
  const history = GitHubEventHistorySchema.parse(input.eventHistory);
  const ordinary = rankGitHub({ snapshot: snapshot.github, interestProfile: input.interestProfile, history: input.coverageHistory, algorithmVersion: "observer-github-heat-v1" });
  const development = snapshot.developments;
  const momentum = development.momentum ? reconstructMomentum(development.momentum) : [];
  if (development.momentum && (development.momentum.cutoffUtc !== snapshot.github.cutoffUtc || githubDigest(momentum) !== githubDigest(development.momentum.developments))) throw new Error("github-repromotion-input-invalid");
  if (development.cutoffUtc !== snapshot.github.cutoffUtc || development.configurationSha256 !== (development.configuration ? githubDigest(development.configuration) : null)) throw new Error("github-repromotion-input-invalid");
  for (const run of development.runs) {
    const { id, ...metadata } = run;
    if (id !== githubDigest(metadata) || run.configurationSha256 !== development.configurationSha256 || run.configurationSha256 !== githubDigest(run.configuration) ||
      run.availableAtUtc > development.cutoffUtc || run.startedAtUtc > run.availableAtUtc || !snapshot.github.runs.some((entry) => entry.id === run.githubRunId && entry.scheduledAtUtc === run.slot) ||
      run.evidence.some((evidence) => { const { observationId, ...metadata } = evidence; return observationId !== githubDigest([run.githubRunId, metadata]) || evidence.observedAtUtc > evidence.availableAtUtc ||
        evidence.availableAtUtc > run.availableAtUtc || evidence.observedAtUtc < run.startedAtUtc || !snapshot.github.watchItems.some((item) => item.nodeId === evidence.nodeId && item.fullName === evidence.fullName) || githubDigest(evidence.policy) !== githubDigest(run.policy); }) ||
      githubDigest(reconstructDevelopments(run)) !== githubDigest(run.developments)) throw new Error("github-repromotion-input-invalid");
    if (run.security && !consistentAdvisories(run.security, snapshot.github.runs.find((entry) => entry.id === run.githubRunId)!, run.availableAtUtc, run.contextFreezes)) throw new Error("github-repromotion-input-invalid");
  }
  if (new Set(history.entries.map((entry) => entry.versionId)).size !== history.entries.length || history.entries.some((entry) => entry.publishedAtUtc > snapshot.github.cutoffUtc)) throw new Error("github-repromotion-input-invalid");
  const reported = new Set(history.entries.flatMap((entry) => entry.developments.map((item) => item.developmentId)));
  const candidates = ordinary.candidates.map((candidate) => {
    const available = [...development.runs.flatMap((run) => [...run.developments, ...(run.security?.developments ?? [])]), ...momentum].filter((entry) => entry.nodeId === candidate.nodeId);
    const fresh = [...new Map(available.filter((entry) => !reported.has(entry.developmentId)).map((entry) => [entry.developmentId, entry])).values()];
    const attention = candidate.partition === "measured" ? candidate.starsSignal > 0 || candidate.forksSignal > 0 : snapshot.github.watchItems.some((item) => item.nodeId === candidate.nodeId && (item.current!.stars! >= 10 || item.current!.forks! >= 2));
    const riskUnknown = development.runs.some((run) => run.security?.history.unavailableNodeIds.includes(candidate.nodeId) || run.security?.risks.some((risk) => risk.nodeId === candidate.nodeId && (risk.status === "unknown" || risk.status === "withdrawn")));
    const allowed = !["history-unavailable", "invalid-age", "topic-excluded"].includes(candidate.reason) && attention && !riskUnknown;
    const bypass = allowed && candidate.lastReportedAtUtc !== null && history.unavailableVersionIds.length === 0 && fresh.length > 0;
    const effectiveRecoveryMultiplier = bypass ? 1 : candidate.recoveryMultiplier;
    const score = riskUnknown ? 0 : bypass ? candidate.baseScore * candidate.interestMultiplier * candidate.frequencyMultiplier : candidate.score;
    return { ...candidate, ordinaryScore: candidate.score, score, sortKey: Math.round(score * 1e12), effectiveRecoveryMultiplier,
      developments: allowed && !history.unavailableVersionIds.length ? fresh : [],
      eventReason: riskUnknown ? "security-risk-unconfirmed" as const : !allowed ? "ordinary-ineligible" as const : history.unavailableVersionIds.length ? "event-history-unavailable" as const : fresh.length ? "eligible-development" as const : available.length ? "already-reported" as const : "no-development" as const };
  }).sort((a, b) => Number(b.developments.some((entry) => entry.kind === "security")) - Number(a.developments.some((entry) => entry.kind === "security")) ||
    Number(b.developments.some((entry) => entry.kind === "release")) - Number(a.developments.some((entry) => entry.kind === "release")) ||
    Number(b.developments.length > 0) - Number(a.developments.length > 0) || Number(a.partition === "cold-start") - Number(b.partition === "cold-start") || b.sortKey - a.sortKey || codepoints(a.nodeId, b.nodeId));
  const eligible = candidates.filter((entry) => entry.score > 0);
  const novel = ordinary.candidates.filter((entry) => entry.novel && eligible.some((candidate) => candidate.nodeId === entry.nodeId));
  const actual = Math.min(7, eligible.length, 2 * novel.length);
  const reserved = new Set(novel.slice(0, Math.ceil(actual / 2)).map((entry) => entry.nodeId)), selected = new Set(reserved);
  for (const entry of eligible) if (selected.size < actual) selected.add(entry.nodeId);
  const selectedNodeIds = candidates.filter((entry) => selected.has(entry.nodeId)).map((entry) => entry.nodeId);
  const selectedNovel = candidates.filter((entry) => entry.novel && selected.has(entry.nodeId)).length;
  if (selectedNovel < Math.ceil(actual / 2)) throw new Error("github-repromotion-quota-invalid");
  return GitHubRepromotionRankingSchema.parse({ algorithmVersion: input.algorithmVersion, rules: repromotionRules, eventHistory: history,
    candidates: candidates.map((entry) => ({ ...entry, selected: selected.has(entry.nodeId), reason: entry.eventReason === "security-risk-unconfirmed" ? "security-risk-quarantined" : selected.has(entry.nodeId) ? "selected" : entry.score > 0 ? "novelty-quota" : entry.reason,
      selection: reserved.has(entry.nodeId) ? "novelty-reserved" : selected.has(entry.nodeId) ? "rank-fill" : null })),
    selectedNodeIds, quota: { target: 7, actual, selectedNovel, requiredNovel: Math.ceil(actual / 2), eligibleNovel: novel.length },
    reportedDevelopments: candidates.filter((entry) => selected.has(entry.nodeId)).flatMap((entry) => entry.developments) });
}

type RepromotionRecord = Extract<ReportRecord, { schemaVersion: 10 }>;
function ordinaryRecord(record: RepromotionRecord): Extract<ReportRecord, { schemaVersion: 9 }> {
  const { githubDevelopments: _development, githubRepromotion: _repromotion, ...prior } = record;
  return { ...prior, schemaVersion: 9, editorialContract: "observer-canonical-v7", coverageGaps: [...record.coverageGaps.filter((gap) => gap.reason !== "github-selection-insufficient"),
    ...(record.githubRanking.quota.actual < 7 ? [{ edition: "github-projects" as const, reason: "github-selection-insufficient" }] : [])] };
}
export function consistentGitHubRepromotion(record: RepromotionRecord): boolean {
  if (!consistentGitHubRanking(ordinaryRecord(record)) || record.coverageGaps.filter((gap) => gap.edition === "github-projects" && gap.reason === "github-selection-insufficient").length !== Number(record.githubRepromotion.quota.actual < 7)) return false;
  try {
    return githubDigest(rankGitHubRepromotions({ snapshot: { schemaVersion: 1, github: record.github, developments: record.githubDevelopments }, interestProfile: record.interestProfile,
      coverageHistory: record.githubRanking.history, eventHistory: record.githubRepromotion.eventHistory, algorithmVersion: record.githubRepromotion.algorithmVersion })) === githubDigest(record.githubRepromotion);
  } catch { return false; }
}
export function githubRepromotionMarkdown(record: RepromotionRecord): string {
  const prior: Parameters<typeof githubRankingMarkdown>[0] = ordinaryRecord(record);
  prior.githubRanking = { ...prior.githubRanking, candidates: record.githubRepromotion.candidates.map(({ ordinaryScore: _ordinary, effectiveRecoveryMultiplier: _effective, developments: _developments, eventReason: _event, ...entry }) => entry),
    selectedNodeIds: record.githubRepromotion.selectedNodeIds, quota: record.githubRepromotion.quota };
  let markdown = githubRankingMarkdown(prior).replaceAll("observer-canonical-v7", "observer-canonical-v8");
  markdown += `\n### 重大进展与一次性重新入榜\n\n规则：${record.githubRepromotion.algorithmVersion}；只绕过冷却/恢复因子，保留90天频率惩罚；实际新颖位置仍至少一半。\n\n`;
  for (const reason of record.githubDevelopments.reasons) markdown += `Coverage Gap：${escapeMarkdown(reason)}。\n\n`;
  for (const reason of record.githubDevelopments.momentum?.reasons ?? []) markdown += `Coverage Gap：${escapeMarkdown(reason)}。\n\n`;
  for (const risk of record.githubDevelopments.runs.flatMap((run) => run.security?.risks ?? [])) {
    if (risk.status !== "high-risk") markdown += `风险状态 · ${escapeMarkdown(risk.nodeId)} / ${risk.ghsaId}：${escapeMarkdown(risk.reason)}；${risk.status === "lower-risk" ? "当前公告严重性较低，不等于风险消失。" : "风险或范围未确认，仓库隔离；缺失信息不等于安全。"}\n\n`;
  }
  for (const item of record.githubRepromotion.candidates) markdown += `候选 ${escapeMarkdown(item.nodeId)}：普通分数 ${item.ordinaryScore}；恢复 ${item.recoveryMultiplier} → ${item.effectiveRecoveryMultiplier}；频率 ${item.frequencyMultiplier}；事件 ${item.eventReason}；最终 ${item.reason}。\n\n`;
  for (const event of record.githubRepromotion.reportedDevelopments) {
    if (event.kind === "momentum") {
      const capsule = record.githubDevelopments.momentum!.capsules.find((entry) => entry.id === event.capsuleId)!;
      const onset = capsule.points.at(-1)!, metrics = evaluateMomentum(onset, event.nodeId);
      markdown += `极端动量 · ${escapeMarkdown(event.nodeId)}：observer-github-momentum-v1；真实双点24小时平均净增 stars ${metrics.stars} / forks ${metrics.forks}，同信号分位 ${metrics.starsPercentile} / ${metrics.forksPercentile}。仅在完整有限候选池比较，不声称全GitHub或统计显著性。\n\n` +
        `首次极端观察 ${capsule.onsetObservationId}；实际UTC ${onset.availableAtUtc}；${capsule.kind}证明 ${capsule.points.length} 个评估点；发展身份 ${event.developmentId}。未执行候选，不证明代码质量或安全。\n\n`;
      continue;
    }
    if (event.kind === "security") {
      const evidence = record.githubDevelopments.runs.flatMap((run) => run.security?.evidence ?? []).find((entry) => entry.observationId === event.observationId)!;
      markdown += `风险更新 · ${escapeMarkdown(event.nodeId)}：GitHub global 公告声明严重性 ${evidence.severity}，GHSA ${evidence.ghsaId}。\n\n`;
      for (const vulnerability of evidence.vulnerabilities ?? []) markdown += `受影响包 ${escapeMarkdown(vulnerability.package?.ecosystem ?? "unknown")} / ${escapeMarkdown(vulnerability.package?.name ?? "unknown")}；范围 ${escapeMarkdown(vulnerability.vulnerable_version_range ?? "unknown")}；首个修复版本 ${escapeMarkdown(vulnerability.first_patched_version ?? "unknown")}。\n\n`;
      if (event.change && "representation" in event.change && event.change.after.state === "measures") {
        markdown += `维护者缓解声明：${event.change.after.measures.map((entry) => escapeMarkdown(entry.effect)).join("；")}。来源摘录：${escapeMarkdown(event.evidenceExcerpt!)}。这是公告中的缓解声明，不证明已经部署或风险已消失。\n\n`;
      }
      markdown += `[安全公告](<https://github.com/advisories/${evidence.ghsaId}>)；完整响应 ${evidence.observedAtUtc}，可用 ${evidence.availableAtUtc}。\n\n发展身份 ${event.developmentId}；事件 ${event.eventId}；实质修订 ${event.revisionId}。这是公告所声明的影响范围，不证明当前HEAD或所有安装均受影响；未执行候选，不提供安装建议。\n\n`;
      continue;
    }
    const evidence = record.githubDevelopments.runs.flatMap((run) => run.evidence).find((entry) => entry.observationId === event.observationId)!;
    markdown += `重大稳定 Release · ${escapeMarkdown(evidence.fullName)}：维护者声明存在 ${escapeMarkdown(event.change.category)}；变化对象 ${escapeMarkdown(event.change.object)}；范围 ${escapeMarkdown(event.change.scope)}。\n\n` +
      `来源摘录：${escapeMarkdown(event.evidenceExcerpt)}；[Release 元数据](<https://api.github.com/repos/${evidence.fullName}/releases/${evidence.releaseId}>)；完整响应 ${evidence.observedAtUtc}，可用 ${evidence.availableAtUtc}。\n\n` +
      `发展身份 ${event.developmentId}；事件 ${event.eventId}；实质修订 ${event.revisionId}。语义收据支持维护者声明的归因，未执行候选代码，不证明代码质量或安装安全。\n\n`;
  }
  return markdown;
}
