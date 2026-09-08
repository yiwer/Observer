# 六栏 HTML 日报：采集接口与一次真实运行

日期：2026-09-08。模块：`scripts/daily-acquisition.mjs`。本记录只说明获取层，不代表最终摘要、邮件或完整发布验收通过。按 Owner 快速验证要求，没有执行测试、夹具、typecheck、build、回归或 hash 验证。实现 subagent 完成真实采集并冻结证据，代码 review 与最终邮件验收交由 root orchestrator。

## 调用与行为

```js
import { collectDaily } from './scripts/daily-acquisition.mjs';
const evidence = await collectDaily({ date: '2026-09-08', outputDir: 'data/daily-html/<new-run>' });
```

返回 `{date,retrievedAt,completedAt,cutoff,discoveryWindowStart,items,checks,warnings}`。edition 为 `world/ai/finance/frontier/social/github`；每条有 id、title、url、publishedAt、text、source、retrievedAt。只保留有限摘要/片段，通常2000字符，定向网页补充最多3000字符。不要求最少条数。真实发表日期未知时为 null，论文日期精度保留到日，GitHub 创建/推送时间与知乎 EditTime 不冒充新闻发表时间。

密钥只从进程环境或 Windows User 环境读入内存：`TAVILY_API_KEY`、`EXA_API_KEY`、`OPENALEX_API_KEY`、`ZHIHU_ACCESS_SECRET`、`ALPHAVANTAGE_API_KEY`；不提取 gh CLI 凭据，不使用 SMTP 或调用模型。HTTP 请求有时限；密钥请求禁止跟随重定向；独立服务失败保留中文说明而不取消其余来源。`outputDir/acquisition.json` 使用新建模式，存在时拒绝覆盖。

常规采集包含公开 RSS、HN 热帖/少量评论、匿名 GitHub 多查询、Tavily 中英文检索、Exa 小量补充、OpenAlex 元数据、Alpha Vantage 新闻、知乎搜索及热榜。Tavily 对已有10个以下的官方/RSS候选补充网页片段，不重新搜索。HN 评论仅最多6个主题、每题2条排序靠前评论，不代表社区全貌。知乎问题标题内包含的断言只是被讨论的说法，不自动成为新闻事实。

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
