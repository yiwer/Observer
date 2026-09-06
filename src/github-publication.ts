import type { ReportRecord } from "./contracts.ts";
import { githubRules, type GitHubSnapshot } from "./github-contracts.ts";
import { githubDigest } from "./github-adapter.ts";
import { selectGitHubItems } from "./github-observations.ts";
import { sixEditionMarkdown, consistentRecord } from "./six-edition.ts";
import { escapeMarkdown } from "./publication-gate.ts";

type GitHubRecord = Extract<ReportRecord, { schemaVersion: 8 }>;
export function priorEditorialRecord(record: GitHubRecord): Extract<ReportRecord, { schemaVersion: 7 }> {
  const { github: _github, ...prior } = record;
  return { ...prior, schemaVersion: 7, editorialContract: "observer-canonical-v5" };
}
export function emptyGitHubSnapshot(cutoffUtc: string): GitHubSnapshot {
  return { schemaVersion: 1, rulesVersion: githubRules.version, cutoffUtc, configuration: null, configurationSha256: null, runs: [], identities: [], reasons: ["github-no-eligible-source"], watchItems: [], exclusions: [] };
}
export function consistentGitHubRecord(record: GitHubRecord): boolean {
  const snapshot = record.github;
  if (!consistentRecord(priorEditorialRecord(record)) || snapshot.cutoffUtc !== record.evidenceBundle.cutoffUtc || record.stories.some((story) => story.edition === "github-projects")) return false;
  if (snapshot.configuration ? githubDigest(snapshot.configuration) !== snapshot.configurationSha256 : snapshot.configurationSha256 !== null || snapshot.runs.length > 0) return false;
  if (snapshot.runs.some((run) => run.configurationSha256 !== snapshot.configurationSha256 || githubDigest(run.configuration) !== run.configurationSha256 || run.availableAtUtc > snapshot.cutoffUtc || run.startedAtUtc > run.availableAtUtc ||
    run.id !== githubDigest([run.scheduledAtUtc, run.configuration, run.policy]) || run.observations.some((entry) => {
      const { id, ...metadata } = entry;
      return id !== githubDigest([run.id, metadata]) || entry.observedAtUtc > entry.availableAtUtc || entry.availableAtUtc > run.availableAtUtc || entry.observedAtUtc < run.startedAtUtc ||
        (entry.reason === null) !== (entry.stars !== null && entry.forks !== null);
    }))) return false;
  if (new Set(snapshot.identities.map((entry) => entry.nodeId)).size !== snapshot.identities.length || snapshot.identities.some((entry) => entry.firstSeenAtUtc > snapshot.cutoffUtc ||
    entry.names.some((name) => name.observedAtUtc < entry.firstSeenAtUtc || name.observedAtUtc > snapshot.cutoffUtc) || !entry.truncated && githubDigest(entry.names) !== entry.historySha256)) return false;
  const items = selectGitHubItems(snapshot.runs, snapshot.cutoffUtc, snapshot.identities);
  return githubDigest(items.filter((item) => item.status === "measured" || item.status === "cold-start").slice(0, githubRules.maxWatchItems)) === githubDigest(snapshot.watchItems) &&
    githubDigest(items.filter((item) => item.status !== "measured" && item.status !== "cold-start")) === githubDigest(snapshot.exclusions);
}
export function githubMarkdown(record: GitHubRecord): string {
  const snapshot = record.github;
  const base = sixEditionMarkdown(priorEditorialRecord(record)).replace("正文契约：observer-canonical-v5", "正文契约：observer-canonical-v6");
  const overview = `- [GitHub 热门项目](#edition-github-projects)：${snapshot.watchItems.length ? `${snapshot.watchItems.length} 个元数据 Watch Item` : "暂无可用 Watch Item"}${snapshot.reasons.map((reason) => `；Coverage Gap（${reason}）`).join("")}`;
  const before = base.slice(0, base.indexOf('<a id="edition-github-projects"></a>')).replace(/^- \[GitHub 热门项目\].*$/m, overview);
  const signed = (number: number) => number > 0 ? `+${number}` : String(number);
  return before + [
    '<a id="edition-github-projects"></a>', "## GitHub 热门项目", `本栏 ${snapshot.watchItems.length} 个 Watch Item，最多 7 个；有限候选按稳定 node ID 排列，未计算综合热度排名。`,
    "仅覆盖配置的有限查询与已发现仓库；不代表全 GitHub，不是 GitHub 官方 Trending，也不是项目质量或安装推荐。",
    `观测规则：${snapshot.rulesVersion}；REST ${githubRules.apiVersion}；小时相位 Asia/Shanghai xx:25；截稿 ${snapshot.cutoffUtc}。`,
    ...snapshot.reasons.map((reason) => `Coverage Gap：${reason}`),
    ...snapshot.exclusions.map((item) => `隔离或缺样：${escapeMarkdown(item.fullName)}；${item.reason}；不占用合格 Watch Item 位置，资格未知不表示已判定恶意。`),
    ...snapshot.identities.filter((entry) => entry.truncated).map((entry) => `身份沿革节选：${escapeMarkdown(entry.nodeId)} 最近 8 次名称；完整截止前身份历史摘要 ${entry.historySha256}。`),
    ...snapshot.runs.slice(-1).map((run) => `来源署名：${escapeMarkdown(run.attribution ?? "未知")}；本轮实际上限：每页 ${run.limits.pageSize}、候选 ${run.limits.candidateLimit}、源最小轮询间隔 ${run.limits.pollIntervalSeconds} 秒；总时限 ${githubRules.deadlineMs / 1000} 秒。`),
    ...(snapshot.configuration?.queries.map((query) => `有限查询：${escapeMarkdown(query)}；sort=updated；order=desc；每页 ${githubRules.pageSize}，最多 ${githubRules.maxPages} 页；候选总量最多 ${githubRules.maxCandidates}。`) ?? []),
    ...snapshot.runs.slice(-1).flatMap((run) => run.queries.map((query) => `查询观察：${escapeMarkdown(query.query)}；页数 ${query.pages}；收到 ${query.receivedCount}；API 总数 ${query.totalCount ?? "未知"}；${query.reason ?? "本次有限遍历完成，分页不具有交易快照保证"}。`)),
    ...snapshot.watchItems.flatMap((item) => [
      `### Watch Item · ${escapeMarkdown(item.fullName)}`, `稳定身份：${escapeMarkdown(item.nodeId)}；[原始项目](<https://github.com/${item.fullName}>)；[仓库元数据](<https://api.github.com/repos/${item.fullName}>)。`,
      ...item.identityHistory.map((entry) => `身份历史：${escapeMarkdown(entry.fullName)}（${entry.observedAtUtc}）。`),
      item.status === "measured" ? `24h 目标双快照：${item.historical!.observedAtUtc} → ${item.current!.observedAtUtc}；实际间隔 ${(Date.parse(item.current!.observedAtUtc) - Date.parse(item.historical!.observedAtUtc)) / 3600000} 小时。\n\nstars 净变化 ${signed(item.starsDelta!)}；forks 净变化 ${signed(item.forksDelta!)}。` :
        item.status === "cold-start" ? "Cold-start Heat：观察历史不足；仅展示存量，尚无可信 24h 净变化；未计算代理分数。" : `Coverage Gap：${item.reason}；未将缺样或资格未知解释为零增长或恶意。`,
      ...(item.current ? [`当前存量 stars ${item.current.stars}；forks ${item.current.forks}；完整响应 ${item.current.observedAtUtc}；可用 ${item.current.availableAtUtc}。`] : []),
      ...(item.historical ? [`历史存量 stars ${item.historical.stars}；forks ${item.historical.forks}；完整响应 ${item.historical.observedAtUtc}；可用 ${item.historical.availableAtUtc}。`] : []),
    ]),
  ].join("\n\n") + "\n";
}
