# V1-09 四个 Edition 的真实来源提案

调研日期：2026-09-05；2026-09-06 根据独立审查重新读取 OCHA oPt 自有条款与 NASA AI 专节并修订。状态：**仅供 Owner 审阅的 Source Proposal，未批准、未启用**。

本次按 research 技能查阅官方索引、接口说明与使用条款；没有运行 Observer Collector、生成生产 Evidence、调用 Observer 的 Research Agent/Provider 或发送邮件。表中的“已核验”仅指本轮查阅到了相应官方页面或官方文档中的链接，不代表 feed 响应、采集解析、连续可用性或内容权利通过验收。

提案遵循 [PRD D5/D6](../PRD.md#d5-证据选题与更正)：Owner 通过配置启用后来源才可用；`primary` 是相对于某项陈述的来源性质，官方公告不能自动证明其能力、因果或争议数字已获独立验证。高风险世界要闻仍需两个独立可靠来源，转载同一公告不增加独立证据。FRED 和未获许可行情继续按 [D6](../PRD.md#d6-来源与偏好) 默认排除。

## 待审记录

以下是六个窄来源提案，覆盖四个 Edition。`C/M/D/A` 依次对应 `collection.enabled`、`model.enabled`、`distribution.enabled`、`distribution.allowPermanentArchive`；**每条均为 `false / false / false / false`**。来源清单、Edition 归属与建议用途属于本次编辑建议，不是 Owner 决策。

| sourceId / edition | 已核验 origin 与入口 | 建议范围与证据性质 | 权利待审项 | review / C/M/D/A |
|---|---|---|---|---|
| `ocha-opt-humanitarian-reports` / `world-affairs` | `https://www.ochaopt.org`：[Publications](https://www.ochaopt.org/publications)、[官方主页](https://www.ochaopt.org/)；HTML 索引可读，feed/API **unknown** | 仅 OCHA oPt 人道状况报告。官方主页确有 Humanitarian Situation Report；建议保留发布机构、上游归因和统计截止时间。不能扩称全球覆盖，也不能将报告转述的各方数据视为 OCHA 独立验证。[官方报告示例](https://www.ochaopt.org/content/humanitarian-situation-report-28-august-2026) | [该站 Terms of use (a)](https://www.ochaopt.org/page/terms-use)允许个人非商业访问、下载和复制，明确不授予转售、再分发、汇编或衍生作品权，具体材料可有更严格限制。此条款未为 Observer 的模型处理、中文衍生文、邮件/PDF、永久归档链路取得授权；用途适用性与另行许可待 Owner 复核，不能以一般 UN 出版物规则替代该站条款。 | `pending` / `false / false / false / false` |
| `eurostat-economy-finance-releases` / `finance` | `https://ec.europa.eu`：[Euro indicators](https://ec.europa.eu/eurostat/news/euro-indicators)、[官方 RSS 目录](https://ec.europa.eu/eurostat/web/rss)中的 News releases → Economy and finance；精确链接见下 | 欧盟/欧元区经济金融主题宏观发布；GDP/就业联合发布不等于覆盖全部就业/失业主题。估计值需保留月份/季度、单位、季调口径与修订状态。[栏目说明](https://ec.europa.eu/eurostat/news/euro-indicators) | 欧盟自有编辑内容为 CC BY 4.0，统计数据等可署名复用。翻译或修改需告知最终用户并附 Eurostat 不承担责任的声明；出版物翻译还需指定版权、原出版物及译者说明。第三方、逐件条件和商业复用例外另查。待 Owner 明确字段和流程如何满足这些现有条件。[版权与复用说明](https://ec.europa.eu/eurostat/help/copyright-notice) | `pending` / `false / false / false / false` |
| `fed-board-monetary-releases` / `finance` | `https://www.federalreserve.gov`：[官方 RSS 目录](https://www.federalreserve.gov/feeds/feeds.htm)中的 Monetary Policy；文档链接为 [press_monetary.xml](https://www.federalreserve.gov/feeds/press_monetary.xml) | 仅 Board 货币政策公告；可支持“委员会发布了什么决定/声明”，市场影响归 Editorial Analysis，不能由此推导实际市场价格。该目录把货币政策公告和其他数据 feed 分开。[RSS 目录](https://www.federalreserve.gov/feeds/feeds.htm) | 官方说明除另有标识外站点信息属公有领域，可复制分发并应署名；非 Board 材料及标志另受限制。待 Owner 限定公告正文/元数据、模型处理、缓存与归档，不把 Board 的规则外推至 FRED。[Disclaimer](https://www.federalreserve.gov/disclaimer.htm) | `pending` / `false / false / false / false` |
| `arxiv-ai-descriptive-metadata` / `ai` | `https://arxiv.org`：[cs.AI 最近提交索引](https://arxiv.org/list/cs.AI/recent)；接口说明位于 `https://info.arxiv.org`，[RSS 文档](https://info.arxiv.org/help/rss.html)说明按类别提供 RSS/Atom；本次未直接核验 cs.AI feed，精确 `feedUrl` 暂为 **unknown** | 仅 AI 论文发现与描述性元数据，正文、PDF、源文件不在建议首轮范围。作者研究声明保留归因；arXiv 审核不是同行评审，同行评审与独立复现须逐篇另证。[审核说明](https://info.arxiv.org/help/moderation/index.html) | API 条款将题名、摘要、作者、标识和分类等描述性元数据置于 CC0；论文权利另属作者/出版者。待 Owner 确认映射后只把获准摘要作为 `content`，不把元数据许可扩成全文许可；原文归档未批准。[API Terms](https://info.arxiv.org/help/api/tou.html) | `pending` / `false / false / false / false` |
| `anthropic-official-announcements` / `ai` | `https://www.anthropic.com`：[Newsroom](https://www.anthropic.com/news)；HTML 索引可读，官方 news feed/API **unknown** | 模型、产品、安全与研究公告；该页按日期/类别链接公告。建议写“Anthropic 宣布/报告”，能力提升或安全结论仍为发布者声明，独立验证另证。[Newsroom](https://www.anthropic.com/news) | [Consumer Terms](https://www.anthropic.com/legal/consumer-terms)针对服务定义并列出自动化/抓取限制；这些服务条款对 newsroom 的具体适用范围及公告复用许可仍需确认。本轮未取得可授权定时采集、外部模型处理、中文衍生文、邮件/PDF 与永久归档的明确依据；全部 **unknown**。 | `pending` / `false / false / false / false` |
| `nasa-official-news-releases` / `frontier-technology` | `https://www.nasa.gov`：[2026 News Releases](https://www.nasa.gov/2026-news-releases/)、[官方 RSS 目录](https://www.nasa.gov/rss-feeds/)；文档链接为 [news-release/feed/](https://www.nasa.gov/news-release/feed/) | NASA 任务与技术进展，建议排除例行活动提醒及纯宣传。拟研究任务状态及原始测量，科学解释、技术优越性或合作方声明须另证；AI 生成输出的归因须先解决右栏限制，不能直接套用“NASA 报告/据 NASA”式生成句。[新闻索引](https://www.nasa.gov/2026-news-releases/) | [Media Usage Guidelines 的 AI Applications 专节](https://www.nasa.gov/nasa-brand-center/images-and-media/)要求 AI 输出归因 AI 产品自身、不得直接归因 NASA 或使用“according to NASA”等措辞；可以事实披露工具使用 NASA 源材料，但不得暗示 NASA 审阅/许可，并说明生成准确性不由 NASA 负责。第三方权利、AI 标识和 NASA 标志限制另适用。对 Observer 文本推理/引用/导出链路的适用范围仍待审，不能据此推成普遍许可。图片/标志不纳入。 | `pending` / `false / false / false / false` |

## 访问面核验边界

下列“本次”保留 2026-09-05 原调研的观察范围。2026-09-06 的[独立来源审查](v1-09-source-proposal-review-2026-09-06.md)另记录 Eurostat、Fed、NASA 和 [arXiv cs.AI RSS](https://rss.arxiv.org/rss/cs.AI) 四个候选入口的单次 HTTP 200/XML 解析结果；arXiv 因而已有精确候选 endpoint 技术证据。该审查在 Root 分支保存并随集成提供，不把新观察倒填成 9 月 5 日已实测。没有 Collector 联调、持续可用性、完整重定向链或许可验收；全部使用开关仍为 false。

- Fed 与 NASA 的精确 feed 地址来自本轮读取的官方 RSS 目录 HTML 链接；未进行 feed payload 或 Collector 联调。Eurostat 的下列精确地址也来自官方目录的 Economy and finance 新闻发布链接，`p_p_resource_id=atom` 是该链接原值；未确认响应内容和重定向链。[Fed](https://www.federalreserve.gov/feeds/feeds.htm)、[NASA](https://www.nasa.gov/rss-feeds/)、[Eurostat](https://ec.europa.eu/eurostat/web/rss)

  [Eurostat Economy and finance 新闻发布 Atom 候选入口](https://ec.europa.eu/eurostat/en/search?p_p_id=estatsearchportlet_WAR_estatsearchportlet&p_p_lifecycle=2&p_p_state=maximized&p_p_mode=view&p_p_resource_id=atom&_estatsearchportlet_WAR_estatsearchportlet_theme=PER_ECOFIN&_estatsearchportlet_WAR_estatsearchportlet_collection=CAT_PREREL)

- arXiv 官方 RSS 文档已确认类别构造规则，但本轮不将推导出的 cs.AI 地址冒充已核验 endpoint；待补核后才可填写真实 `feedUrl`。其 API 条款对 legacy API（含 RSS）要求所有受控机器合计不超过每三秒一次、一次一个连接；不能直接套用任意轮询参数。[RSS 文档](https://info.arxiv.org/help/rss.html)、[API Terms](https://info.arxiv.org/help/api/tou.html)
- `www.unocha.org` 和部分 UN 页面本轮浏览工具未能读取，未以此推断站点下线。OCHA oPt 已确认的地域入口保持单独提案；OCHA oPt、Anthropic 未核验 feed/API，不以 HTML 索引伪填 `feedUrl`。所有来源的部署侧限流、响应大小与解析适配仍待验证。
- 2026-09-05 调研时 Eurostat 页面显示当日 08:00–18:00 服务维护提示；这只是该日可见的访问风险。9 月 6 日单次 feed 成功另见上方独立审查，两次观察均不能证明整体恢复时间或未来持续可用。[官方提示所在页](https://ec.europa.eu/eurostat/web/rss)

## 转写 SourcePolicy 时的字段建议

以下名称对齐 [现有示例](../../config/sources.example.v1.json)和 [SourcePolicySchema](../../src/collection.ts)。这里只列建议与待填证据，**不是可导入配置**；尤以 `feedUrl=unknown` 的记录不能填伪地址通过 Schema。

| 字段 | 本提案统一值 / Owner 审阅后才可确定的内容 |
|---|---|
| `schemaVersion`、`sourceId`、`version`、`name`、`edition` | 建议 `1`、上表稳定 ID、初始版本 `1`、真实机构及窄范围名称、上表 Edition。 |
| `sourceType` | 可提议 `primary`，仅表示第一方发布入口；实际陈述仍检查作者、上游来源、独立性与研究状态。 |
| `feedUrl` | 仅用上文由官方链接核验的精确地址；未知者继续保留文档提案。HTML 索引/API 文档 URL 不能冒充可采集 feed。 |
| `review` | `status="pending"`、`reviewedBy="Owner"`、`reviewedAtUtc=null`；此处 `reviewedBy` 是 Schema 要求的审阅角色，**不是已经审阅**。`basis` 待记录适用条款/许可 URL、版本或日期、字段和用途判断、剩余限制；调研日期不填成批准日期。 |
| `collection` | `enabled=false`、`fields=[]`、`readBody=false`。启用前逐源决定元数据与正文范围；公开可访问、新闻稿身份或提供 API 都不替代该决定。 |
| `storage` | `fields=[]`、`retentionHours=0`、`retainRecordKeys=false`。后续逐项决定允许保存字段、原文 TTL、哈希/键保留，不继承 fixture 的 24 小时或永久权利。 |
| `model` | `enabled=false`、`fields=[]`。需区分当次推理、第三方处理方及其留存；本轮没有来源被允许进入实际模型。 |
| `distribution` | `enabled=false`、`fields=[]`、`allowDerivedText=false`、`allowPermanentArchive=false`。元数据、中文原创摘要、译文/引文、MD/PDF/邮件及长期归档逐项确认。 |
| `citation` | `enabled=false`、`maxCharacters=0`；逐源审查出处披露与生成输出归因后再填写，不能统一把模型输出归于发布机构。尤其 NASA 的 AI 专节限制直接归因，同时容许不暗示许可的源材料披露；现有 `attribution` 字符串能否满足具体用途仍待审。题名、原始时间、URL、翻译/修改说明也分别确认。 |
| `deletion` | 未核查删除义务时建议 `mode="unsupported"`；`instructions` 写清未确认项。只有确认实际义务可履行后才能考虑 `owner-request`；当前 Schema 拒绝批准 `unsupported`。 |
| `limits` | `pollIntervalSeconds`、`timeoutMs`、`maxResponseBytes`、`maxItems`、`maxRedirects` 均待访问文档与获准适配核验；本次不提供伪装为来源合同的通用数值。 |

候选获准后建议先限定 URL、题名、原始发布时间和直接出处；允许正文或 arXiv 摘要进入模型时，再逐源扩大字段。官方统计保留观测期和修订口径，机构公告保留声明者，预印本保留版本与研究状态；这些编辑要求不由 `sourceType` 或 Schema 通过自动完成。六条提案也不能形成完整全球新闻、财经、AI 或前沿科技覆盖；缺口仍按 [PRD](../PRD.md#d5-证据选题与更正)披露。
