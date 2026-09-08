# 今日私人日报：首批来源 starter（2026-09-08）

用途：供 Owner 一次确认公开字段白名单，并为今天的私人中文邮件提供真实入口。研究窗口固定为 **上海时间 2026-09-07 14:48:58 至 2026-09-08 14:48:58**（UTC 06:48:58 至次日 06:48:58）；页面复核持续至上海 14:55 左右。后续发送若更新截止时间，应重新判断新增材料，不改变事件原始时间。

已读 [PRD](../PRD.md) 和 [9 月 6 日来源审查](v1-09-source-proposal-review-2026-09-06.md)，本轮实际搜索并打开第一方页面，少量读取官方 feed/API 核对字段。没有运行采集批次、模型或邮件，没有修改来源配置或代填 Owner 批准。内部 `pending` 不等于外部禁止；以下为公开许可与可获取性建议，不是已生效白名单。

## 1. 可一次确认的最小白名单

建议范围：下列公开字段可用于本机已登录 Codex 的当次摘要处理、原创中文短摘要、仅向 Owner 发邮件及私人归档；保留出处、原始日期、实际获取时间与必要归属。首轮不取图片、PDF、论文全文、README/源码、Release 正文或个人帖子，普通 feed 优先 `readBody=false`。这些是供 Owner 确认的用途，不是本报告代签。

| sourceId / Edition | 真实第一方 feed/API | 最少字段及适用权利 |
|---|---|---|
| `arxiv-ai-metadata` / **AI 日报** | [cs.AI Atom](https://rss.arxiv.org/atom/cs.AI) | id、题名、作者、摘要、分类、published、updated、原文链接。描述性元数据为 CC0，可保存、转换、分享；保留作者/arXiv 链接，明确“预印本、未据此证明同行评审”。不把论文自身许可混入元数据许可。[API 条款](https://info.arxiv.org/help/api/tou.html) |
| `arxiv-quantum-metadata` / **科技前沿** | [quant-ph Atom](https://rss.arxiv.org/atom/quant-ph) | 同上，仅量子研究起步，不宣称覆盖全部科技。**所有受控机器合计串行，每次请求相隔至少 3 秒**；今天空 feed 不能用昨日列表填成今日。[同一条款](https://info.arxiv.org/help/api/tou.html) |
| `eurostat-economy-releases` / **财经日报** | [Economy and finance Atom](https://ec.europa.eu/eurostat/en/search?p_p_id=estatsearchportlet_WAR_estatsearchportlet&p_p_lifecycle=2&p_p_state=maximized&p_p_mode=view&p_p_resource_id=atom&_estatsearchportlet_WAR_estatsearchportlet_theme=PER_ECOFIN&_estatsearchportlet_WAR_estatsearchportlet_collection=CAT_PREREL)；[官方目录](https://ec.europa.eu/eurostat/web/rss) | id、题名、summary、published、链接，以及摘要中实际出现的统计期。EU 自有编辑内容 CC BY 4.0，统计数据/元数据允许署名复用；排除第三方图片/标识。邮件附“来源：Eurostat，原文链接；中文摘要经改写，Eurostat 不对本摘要负责”，并链接许可；不冒充官方翻译。[版权与复用说明](https://ec.europa.eu/eurostat/help/copyright-notice) |
| `fed-board-press` / **财经日报** | [All Press Releases RSS](https://www.federalreserve.gov/feeds/press_all.xml)；[官方目录](https://www.federalreserve.gov/feeds/feeds.htm) | guid、题名、description、pubDate、链接。Board 自有信息除另有标识外属公有领域，可复制分发；注明 Federal Reserve Board。排除第三方材料和徽标，不把此许可外推给 FRED。[免责声明](https://www.federalreserve.gov/disclaimer.htm) |
| `usgs-earthquake-metadata` / **世界要闻** | [M4.5+ past-day Atom](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.atom)；[同范围 GeoJSON](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson)；[官方目录](https://earthquake.usgs.gov/earthquakes/feed/v1.0/atom.php) | 事件 id、地点、震级、深度、事件 time、updated、status、链接；仅 USGS 自产测量，不取第三方媒体、个人震感报告。USGS 自产数据/信息为美国公有领域，允许自由使用，注明 USGS。[官方版权 FAQ](https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted) |
| `github-public-repository-metadata` / **GitHub 热门项目** | [openai/codex](https://api.github.com/repos/openai/codex)；其他公开项目使用官方 `GET /repos/{owner}/{repo}`，[文档](https://docs.github.com/en/rest/repos/repos#get-a-repository) | node_id、full_name、html_url、created_at、updated_at、pushed_at、当前 stars/forks、language、archived、license 标识。仅客观公开目录/计数，做当前项目发现及原创事实说明；不把公开 API 或仓库 license 标识当作一切正文的站外复制许可。[GitHub 条款 D/H](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)、[匿名公共读取规则](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) |

**社交话语观察：无合规聚合样本，保留 Coverage Gap。** 本轮没有一个可以承诺“公开可见即允许模型处理及不可撤回邮件存留”的个人帖子来源；不抓私有帖，不以官方机构公告替代社会观点样本，也不推断总体民意。

## 2. 今天能用什么，不能把什么当作今天

| Edition / 真实出处 | 实际时间与今日处理 |
|---|---|
| **财经日报**：[Eurostat：二季度 GDP 与就业估计](https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-07092026-ap) | Atom `published=2026-09-07T09:00:00Z`，即上海 9 月 7 日 17:00，确定在窗口内。可写欧元区 GDP 环比 +0.6%、就业 +0.1%；这是 **2026 年第二季度**的估计，不是今日经济增速或投资建议。适合作为本轮优先阅读项。 |
| **世界要闻**：[USGS：印尼 Ruteng 东北偏北 51 km，M5.3](https://earthquake.usgs.gov/earthquakes/eventpage/us7000tfr8) | 事件 `2026-09-08T04:40:28.046Z`，即上海 12:40:28；数据为 reviewed，深度 10 km。可做简短观察项；没有足够影响/伤亡材料，不能升格为重大灾难，更不能从 `tsunami=0` 推断绝无海啸风险。[官方数据](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson) |
| **世界要闻**：[USGS：瓦努阿图 Isangel 东南偏东 92 km，M5.1](https://earthquake.usgs.gov/earthquakes/eventpage/us7000tfqf) | 事件 `2026-09-08T00:52:02.083Z`，即上海 08:52:02；同为 reviewed、深度 10 km。仅低优先观察备选，不为凑条数把同类小事件全部收入。[官方数据](https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson) |
| **世界要闻／科技影响提示**：[欧委会宣布与格陵兰的 2 亿欧元伙伴计划](https://digital-strategy.ec.europa.eu/en/news/eu-and-greenland-strengthen-partnership-and-engagement-backed-eu200-million-eu-investment) | 原页日期 9 月 7 日，含连接、能源及原材料方向；只证明欧委会宣布及其归因，不证明项目已经完成。本轮未拿到精确发布时间，**列为日期级候选，不冒充严格 24h 已确认**。EU 自有文字通常为 CC BY 4.0，署名并标改写；这条为人工候选，不扩大上述 feed 白名单。[官方法律声明](https://commission.europa.eu/legal-notice_en) |
| **AI 日报**：arXiv cs.AI | 本次官方 Atom 的 feed 更新时间为 `2026-09-08T04:00:01.372754+00:00`，**entry=0**；[网页 new 列表](https://arxiv.org/list/cs.AI/new)仍标 9 月 7 日。feed 刷新不是新论文，今天此源没有可交付新项；只可另列明确日期的背景，不宣称 AI 领域当天没有新闻。 |
| **科技前沿**：arXiv quant-ph；[量子器件的随机神经网络论文](https://link.springer.com/article/10.1007/s42484-026-00438-w) | quant-ph feed 更新时间 `2026-09-08T04:00:19.198088+00:00`，**entry=0**。备选论文原页为 9 月 7 日、文章级 CC BY 4.0，可署名改写摘要；精确发布小时未明，所以只作带日期背景，不计严格 24h 新项。署名 Rosenhahn、Osborne、Hirche，链接 DOI/许可并说明中文改写；不将理论研究写成量子优势已实现。 |
| **财经日报**：Fed Board | 当前 RSS 首项为[9 月 4 日终止若干执法行动](https://www.federalreserve.gov/newsevents/pressreleases/enforcement20260904a.htm)，`pubDate=2026-09-04T15:00:00Z`，窗口外。保留 feed，不拿旧公告充当今天政策变化。 |
| **GitHub 热门项目**：[openai/codex](https://github.com/openai/codex) | 官方 API 当前返回公开 Rust 项目，`updated_at=2026-09-08T06:11:13Z`、`pushed_at=05:59:44Z`；这些只是项目状态时间。可列“冷启动项目发现”，**不计算 24h 星标增长、不称官方 Trending，也不因 push 就认定重大新功能**。本次查看的 llama.cpp/vLLM 最新正式 Release 分别为 9 月 4 日／8 月 26 日，均不算今日新发布。 |

每栏约 7 条／3 个重点仍是质量目标，不是本次结果。本 starter 支持一个确定窗口内财经优先项、少量世界观察项、明确标注的科技背景与 GitHub 冷启动；AI/科技最新进展及社交均有缺口。世界议题不因某一个 OCHA 站点条款而全栏停用；冲突、伤亡、选举等高风险结论仍需独立交叉核验。

## 3. 交给执行方的三个具体边界

1. **时间字段差异不是没有新闻。** Eurostat 有 `published`，Fed 有 `pubDate`；USGS Atom 本次只有 `updated`，事件时间在 GeoJSON `properties.time`。Root 已确认现有通用 feeder 不读 `updated`，因此 USGS 需人工保留真实事件时间，或后续批准一个保留时间语义的适配；不能将获取时间/updated 填成原发布时间。arXiv 无条目就是本次空源。日期级背景不挤进严格小时窗口。
2. **匿名 GitHub 外部可行，当前产品路径未接通。** 官方允许匿名读取公共数据，通常为同 IP 每小时 60 次，搜索另有限额；本轮网页/API 可读不需要新秘密。当前 Observer 专用适配器要求 metadata-only fine-grained PAT，既有 `gh` 登录不能冒充它。最小后续兼容建议是明确匿名模式，仅公共 GET、无 Authorization、保留官方限流/时间与缺样语义；本轮不改代码、不索取 token，也不把少量人工查询伪称既有适配器已运行。[官方限流文档](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
3. **不扩大正文许可。** 所列 CC0／公有领域／CC BY 字段可支持保存与衍生摘要；建议只长期留允许元数据和原创成稿，临时原响应不作为无限期全文镜像。额外检索到的 Nature Communications 今日文章不能整站放行：例如[今日水氧化文章](https://www.nature.com/articles/s41467-026-77521-0)明确是 CC BY-NC-ND，不能仅凭 Open Access 把翻译/改编分发视为已获许可，因此不进入首批自动摘要白名单。已有 NASA AI 输出归因问题亦不在本轮擅自放行。

建议 Owner 一次确认上述五家机构对应六个 sourceId 的最少字段与私人用途；执行方在收到确认后记录真实决定。本报告到此结束，不将来源可获取、许可依据、内部启用和今天确有新条目混为同一件事。
