# 六栏 HTML 日报：采集接口与一次真实运行

## 当前GitHub规则：官方每日Trending，不限项目发布日期

按Owner最新选择，GitHub栏目只取[GitHub官方Trending每日榜单](https://github.com/trending?since=daily)，默认所有语言。原先新建仓库/近期Release/高星搜索替代来源已移除，Tavily不再为GitHub执行查询。历史已报道项目由编辑层降权，不改变采集榜单的真实名次。

`scripts/daily-github-trending.mjs`导出`collectGitHubTrending()`，返回`{items,check,warnings}`：一次匿名GET、25秒超时、3MiB响应上限、至多50个榜单行，无新依赖、凭据或付费请求。非Trending页面、空榜、条目解析异常、超时/403/429均明确失败，绝不使用搜索结果替代。

条目字段：通用`id/edition/title/url/source/text`；`repositoryUrl`；`evidenceKind:'github-trending'`；`trendPeriod:'daily'`；`trendingUrl`；真实页面顺序`trendingRank`；`observedAt/retrievedAt`；`publishedAt:null`。`stars/starsToday`只取页面可见整数，缺失或舍入缩写为null，并保留`starsText/starsTodayText`。页面的today不是Observer自行计算的北京时间增长口径。

最终资格使用共享`sourceEligible(item,bundle)`布尔结果；GitHub检查当前采集的官方daily快照，不调用项目发布日期规则。其余五栏继续`publicationDecision`。中间轮转只限制候选数量，保留GitHub官方原名次；`enrichDaily`仅在尚未生成且从未取过Trending时补取一次，已有成功/失败记录均不自动重试。

本轮唯一实际匿名读取：2026-09-08T10:40:40.017Z开始、10:40:43.052Z观察到16个项目，1–16名全部解析，stars/starsToday均可读。前3名为ayghri/i-have-adhd、cathrynlavery/diagram-design、openai/skills。本轮不重跑整套collect，不调用模型/SMTP，不执行测试、回归或hash验证。

## 本次变更静态审阅

固定范围 `537dfb9...0f4764b`，未运行测试/回归，也未重发邮件。

### Standards

发现1项P2：从整个榜单行提取今日Star可能误读仓库描述中的数字。已限定为GitHub右侧今日计数容器，缺失或歧义时返回null，不从描述中补数字。其余未发现硬标准违反；额外smell为0。修复后未追加网络抓取或全流程验证。

### Spec

未发现P1/P2。真实daily榜、名次、历史仓库降权、生成/发信资格及其他五栏时间窗符合当前请求；没有重发或调用模型的额外动作。

汇总：Standards 1项P2已修复；Spec 0项。真实抓取16条证明采集路径可用，不冒充新稿/邮件端到端验收。

## 其他五栏规则：仅昨天00:00至本次采集开始（2026-09-08更新）

五个新闻栏目权威策略为 `previous-day-midnight-v1`。采集一开始就冻结 `cutoff`，`windowStart` 为当前北京时间日期的前一天00:00；`completedAt/retrievedAt`只记录操作完成，不能扩大新闻发布范围。GitHub采用上节独立规则。日期必须是当前北京时间日期，不通过传旧date伪造补报。

共享 helper `scripts/daily-window.mjs`：

- `createDailyWindow({date,now})` 返回 `{date,windowStart,cutoff,timeZone,publicationPolicy}`。
- `publicationDecision(publishedAtOrItem,window)` 返回 `{eligible,publishedAt,precision,reason,precisionNote?}`，供采集、生成、发送引用检查共用。
- 缺发布日期、缺时区、窗口前、截止后都剔除。日精度保留原 `YYYY-MM-DD`；只接受完整日期落窗（本场景为昨天），今天仅日日期因不能证明早于截止而剔除，不伪造00:00发表时间。日精度的日期归窗按北京时间日历解释，并保留精度说明，不声明有精确发表小时。
- `warningsByEdition`为每栏可读缺口，`filteredOut`按栏目/原因计数。内部候选可以先补元数据，但最终五个新闻栏目`items`全部通过发布时间helper，没有unknown逃生通道，也不以“没凑够7条”为由放宽范围。GitHub的null发布时间按独立快照规则处理。
- HN帖子采用`story.time`，抽样评论也要求`comment.time`落窗。知乎热榜只作发现，最多3次匿名公开页面读取尝试找JSON-LD或文章发布日期；EditTime、热榜名次、观察时间均不能代替发表日期。拿不到就剔除，不能把权限成功误报为内容满足日期。
- GitHub旧版新仓库/Release日期规则已被官方Trending规则替代，下文旧批次采集结果仅为历史记录。
- 本次新增2条AI、1条科技精确查询，所有搜索起点与昨日日期对齐；最终由时间helper兜底，不相信搜索过滤自动保证时间。旧事件可通过窗口内的新报道入选，稿件内历史背景不能冒充本期新发生。

旧目录不重跑、不覆盖。新的严格窗口采集为 `data/daily-html/2026-09-08-editions-02`；具体结果以新目录`acquisition.json`为准。下方真实用量表属于此前合并邮件批次的历史证据，不是新批次用量或当前内容规则。

本次严格窗唯一真实采集：北京时间 `2026-09-07 00:00` 至 `2026-09-08 18:13:02.500`，完成 `18:13:53.350`。最终候选世界33、AI21、财经40、科技18、社交30、GitHub13；最新共享helper只读检查全部候选均符合窗口，没有unknown入包。知乎接口仍成功，但25个候选因无可确认首次发布时间剔除；3次公开页面元数据读取未补得日期，不能将此说成缺key。HN19个窗口内帖子与9条窗口内评论提供社交样本。OpenAlex此窗0条，不是权限失败。GitHub含2条窗口内release（Hermes Agent v0.21.1、Graphify v0.9.56）、8条窗口内新建仓库及3条有日期的检索报道；内容是否值得报道仍由编辑筛选，不因计数可用就全部发布。

本批次Tavily14次Basic搜索各报告1credit、7篇网页补充报告1credit，共已知15credits；usage仍0属于未同步/计量差异，不能据此称零消耗。Exa三次各报告0.007美元；OpenAlex本次0.001美元、当日剩余0.998美元。未再次运行旧目录、未为本轮回归或额度探针重搜。

日期：2026-09-08。模块：`scripts/daily-acquisition.mjs`。本记录只说明获取层，不代表最终摘要、邮件或完整发布验收通过。按 Owner 快速验证要求，没有执行测试、夹具、typecheck、build、回归或 hash 验证。实现 subagent 完成真实采集并冻结证据，代码 review 与最终邮件验收交由 root orchestrator。

## 调用与行为

```js
import { collectDaily } from './scripts/daily-acquisition.mjs';
const evidence = await collectDaily({ date: '2026-09-08', outputDir: 'data/daily-html/<new-run>' });
```

返回 `{date,retrievedAt,completedAt,cutoff,discoveryWindowStart,items,checks,warnings}`。edition 为 `world/ai/finance/frontier/social/github`；每条有 id、title、url、publishedAt、text、source、retrievedAt。只保留有限摘要/片段，通常2000字符，定向网页补充最多3000字符。不要求最少条数。真实发表日期未知时为 null，论文日期精度保留到日，GitHub 创建/推送时间与知乎 EditTime 不冒充新闻发表时间。

密钥只从进程环境或 Windows User 环境读入内存：`TAVILY_API_KEY`、`EXA_API_KEY`、`OPENALEX_API_KEY`、`ZHIHU_ACCESS_SECRET`、`ALPHAVANTAGE_API_KEY`；不提取 gh CLI 凭据，不使用 SMTP 或调用模型。HTTP 请求有时限；密钥请求禁止跟随重定向；独立服务失败保留中文说明而不取消其余来源。`outputDir/acquisition.json` 使用新建模式，存在时拒绝覆盖。

常规采集包含公开 RSS、HN 热帖/少量评论、GitHub官方每日Trending、Tavily中英文检索（不含GitHub）、Exa小量补充、OpenAlex元数据、Alpha Vantage新闻、知乎搜索及热榜。Tavily对已有10个以下的官方/RSS候选补充网页片段，不重新搜索。HN评论仅最多6个主题、每题2条排序靠前评论，不代表社区全貌。知乎问题标题内包含的断言只是被讨论的说法，不自动成为新闻事实。

`supplementSocial`、`enrichDaily` 用于尚未生成任何 edition 文件的证据包定向补充；一旦发现 edition 文件就拒绝修改，不应在生成过程中调用。已完成操作检查避免重复计费。普通每日 `collectDaily` 自动包含同样的评论、热榜和补文，无需日常手工补录。

## 本次真实权限、额度结果

本次新目录 `data/daily-html/2026-09-08-update-01`，最终采集完成 `2026-09-08T09:39:28.033Z`。最终 world40、ai26、finance40、frontier31、social56、github24 条候选；这些是候选数，不等于最终日报条数或全部内容合格。

| 服务 | 实际观察 | 不能推断的事 |
|---|---|---|
| Tavily | 11次 Basic 搜索各返回1credit；1次 Basic Extract 请求10个URL、成功10个、2credits，已知请求合计13credits。Usage 前后均显示 plan_usage0/plan_limit1000 | Usage可能尚未同步，不能称零消耗或精确剩余1000；不是现金余额 |
| Exa | 3次搜索成功，每次响应报告 costDollars.total0.007，合计0.021美元 | 响应估计不等于最终账单，未确认可用余额API，余额unknown |
| OpenAlex | works成功8条；rate-limit返回 daily_budget_usd1、daily_used_usd0.001、daily_remaining_usd0.999、prepaid0 | 是查询时的每日预算，不保证后续永远不变 |
| Alpha Vantage | NEWS_SENTIMENT成功，返回50条，已截断/筛选进入候选 | 请求limit12未按12返回；实际权限只覆盖本次接口，不证明全部premium权限；余额unknown |
| 知乎 | 搜索 Code0，Data.Items10；热榜 Code0，Data.Items，可用15个话题；提供标题/摘要/链接等 | API响应实际为大写字段，初次适配为空不是权限失败；余额unknown、其他端点权限未验证 |
| GitHub | 三个匿名仓库搜索成功；search桶limit10、remaining依次9/8/7 | 是时间窗限额，不是全部GitHub额度，也不是今日star增长 |
| 公开源 | BBC、DW、UN、OpenAI、HF、NASA均取到近期候选；HN25个帖子、12条评论样本 | 不能因此宣称全球覆盖完整或已核验每条陈述 |

知乎前三次搜索分别为首轮采集、定向结构检查、正确适配补录；热榜只调用一次。没有重跑全部付费检索，没有购买或自动充值。原始诊断检查保留，并追加成功状态，不把旧适配问题继续写成 Owner 缺权限。

## 官方接口依据

- [Tavily Search](https://docs.tavily.com/documentation/api-reference/endpoint/search)、[Usage](https://docs.tavily.com/documentation/api-reference/endpoint/usage)、[Extract](https://docs.tavily.com/documentation/api-reference/endpoint/extract)：Bearer；`POST /search`、`GET /usage`、`POST /extract`。
- [Exa Search](https://exa.ai/docs/reference/search)：`POST https://api.exa.ai/search`，`x-api-key`，highlights与costDollars。
- [OpenAlex Authentication](https://help.openalex.org/api/authentication/)：Bearer或api_key；`/works`、`/rate-limit`及响应配额字段。
- [Alpha Vantage](https://www.alphavantage.co/documentation/)：`/query?function=NEWS_SENTIMENT`；apikey只进入请求，URL不记录。
- [知乎官方数据平台](https://developer.zhihu.com/)：Bearer + X-Request-Timestamp、`/api/v1/content/zhihu_search`；官方热榜入口同属content接口，本次以最小无附加参数GET实际确认`/api/v1/content/hot_list`成功。文档前端读取不完整，热榜响应结构依据本次真实官方响应，不将第三方爬虫示例当官方协议。
- [HN官方API](https://github.com/HackerNews/API)、[GitHub仓库搜索](https://docs.github.com/en/rest/search/search#search-repositories)：匿名公共数据；平台热度与项目总计数保留样本说明。

只读权限成功不是摘要质量成功；编写阶段仍须过滤首页、机器日报聚合稿、机械持仓披露和无实质内容的标题。没有强制双源、凑7条或复杂类型分类门。
