# 每日新闻日报：信息获取与交付的可行边界

> 调研日期：2026-09-04（Asia/Shanghai）  
> 范围：全球新闻、财经、AI/科技、社交舆论的数据获取，以及邮件和 Android 推送。  
> 方法：只采用平台/机构自己的文档、规范和条款。本文是产品与架构事实底座，不构成法律、投资或合规意见；条款、价格和限额会变化，上线前仍需法律审阅和逐源复核。

## 结论先行：六个会改变产品形态的门槛

1. **“能检索”不等于“能保存、喂给模型或再发布”。** GDELT、新闻 API 和 RSS 可以帮助发现文章，但上游文章仍可能受版权和站点条款约束。日报应默认发布自己的短摘要、标题、出处、时间和直达链接；图片、长引文、全文归档必须逐源获得授权。
2. **个人自用、内部使用、多用户免费产品和收费产品不是同一个许可问题。** NewsAPI 免费 Developer 计划明确只限开发测试，Reddit 商业用途需要单独协议，交易所实时行情通常还涉及数据分发协议、终端/订阅者计费与报表义务。商业模式必须在选源之前确定。
3. **社交舆论是当前最大的上线阻断点。** X 对站外分发和离线内容同步有明确限制；Reddit 标准条款只允许为 App 展示而复制内容，且不得对用户内容作格式化以外的修改。把帖子交给 LLM 生成摘要/情绪结论，再固化到邮件或 PDF，不能默认视为标准 API 许可已覆盖，应先取得平台书面确认或使用另行签署的数据协议。
4. **FRED 不适合直接进入本产品的 agent 开发流程。** FRED 当前官方条款禁止在软件/系统或机器学习（明确包括 LLM 和生成式 AI）的开发或训练中使用 FRED 服务或内容，并禁止通过 API 缓存/归档内容；部分序列还有第三方版权。本产品正是 agent 应用开发，因此默认应阻断，财经数据优先接各统计机构、监管机构或已明确许可的原始源。
5. **FCM 不是正文通道、送达凭证或所有 Android 设备的通用通道。** 单条载荷上限为 4096 字节、连接并非端到端加密、服务端取得 message ID 只表示已接受投递；并且 Android FCM 客户端要求 Google Play services。正确模式是“FCM 通知 + 服务端鉴权拉取 + App 主动补同步”，目标包含无 GMS 设备时还要第二推送通道或纯拉取兜底。
6. **财经日报必须先决定是资讯，还是建议。** SEC 对 investment adviser 的说明涵盖有偿从事证券价值/投资建议，以及经常性出具证券报告或分析的主体。是否落入监管范围取决于辖区和具体业务；MVP 若定位为资讯，应禁止个性化买卖建议、目标价、仓位/适当性判断，并把事实、来源、模型分析和不确定性分栏。

## 1. 全球新闻：发现层与内容权利层必须分开

| 渠道 | 能提供什么 | 时效与覆盖 | 全文、引用和许可边界 | 推荐角色 |
|---|---|---|---|---|
| GDELT 2.0 / DOC API | 全球新闻事件、实体、主题、情绪等元数据；DOC ArticleList 返回匹配文章标题和 URL | GDELT 2.0 数据流以 15 分钟节拍更新，并称其对所监测的 65 种语言做实时翻译；DOC API 最短查询窗口也是 15 分钟。[GDELT 2.0](https://blog.gdeltproject.org/gdelt-2-0-our-global-world-in-realtime/)、[DOC 2.0 说明](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) | GDELT把自身定位为开放的**元数据**索引，而非原文库；ArticleList 的 JSONFeed 是 URL 和标题列表。不能据此推导出对原文章、图片或长引文的再发布权。[GDELT 对元数据索引的说明](https://blog.gdeltproject.org/a-model-for-the-future-of-digital-libraries/) | 跨语言候选发现、热度/事件聚类、覆盖缺口监测；不是事实终审或全文授权方 |
| NewsAPI | `/everything` 搜索标题、描述和正文索引，提供来源、作者、发布时间、URL、图片 URL 和截断内容字段 | 官方当前说明覆盖 15 万多个来源、最长约 5 年历史；支持的语言集合有限且由套餐决定。[Endpoints](https://newsapi.org/docs/endpoints)、[Everything](https://newsapi.org/docs/endpoints/everything) | `content` 最多只给 200 字符；条款禁止借服务复制或再发布受版权保护材料，也禁止构建竞争性新闻数据库；免费 Developer 计划不得用于 staging/production。[Terms](https://newsapi.org/terms) | 付费且获准的候选发现/元数据补全；不要当作全文源或版权清算方 |
| 出版者 RSS/Atom | 出版者主动提供的标题、链接、GUID、日期，以及由出版者决定的摘要或完整 item | 频率、历史窗口、语言和稳定性完全由每个 feed 决定 | RSS 2.0 规范说明 `description` 既可能是故事概要，也可能是完整内容；该规范的开放许可只覆盖**规范文本**，不是各 feed 内容的统一许可。[RSS 2.0 Specification](https://www.rssboard.org/rss-specification) | 高信任的第一方发布发现；每个 feed 单独登记条款、署名和可用字段 |

### 新闻采集应采用的约束

- 建立“来源注册表”，而不是让 coding agent 每天自由搜索整个 Web。每个连接器记录官方域名、接口、允许存储字段、原文缓存 TTL、是否允许模型处理、是否允许生成衍生摘要、是否允许向终端用户分发、署名模板、删除/更正机制和条款复核日期。
- GDELT/NewsAPI 只进入候选池。入选事实至少回到文章直达页；高影响事实优先再找政府、公司公告、监管文件或论文等一手源，并由第二个独立来源交叉确认。
- 默认不抓取付费墙后内容、不绕过 robots/登录/访问控制，不把新闻图片复制进 PDF。页面可访问也不自动产生再发布许可。
- “世界范围”必须是可度量目标：日报随附过去 24 小时按国家/地区、语言、来源类型的采集量、失败率和空白区。任何聚合源都不能证明已经覆盖“全世界”。
- 每条成品至少带：标题、发布者、原始发布时间、采集时间、规范化 URL、来源类型（原始发布/媒体报道/社交帖子）、引用依据和生成模型版本。纠错时能够定位到具体证据和日报版本。

## 2. 财经：监管披露、宏观数据与行情是三类不同产品

### 可优先采用的一手源

| 类型 | 代表渠道与事实 | 边界 |
|---|---|---|
| 监管披露 | SEC EDGAR submissions 和 XBRL JSON 在文件发布时持续更新；官方称 submissions 通常不到 1 秒、XBRL 通常不到 1 分钟。[EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | SEC 要求声明 User-Agent，并以全局不超过 10 请求/秒的公平访问上限为基线；SEC 政府创作内容和 EDGAR 公开申报可访问和复用。[SEC Webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions) 披露是公司陈述，不等于审计后的事实，也不是价格行情。 |
| 美国宏观/劳动数据 | BLS Public Data API 返回各调查的历史时间序列；注册版当前为每天 500 次查询、每次 50 个序列、最多 20 年，且有 50 次/10 秒的请求上限。[BLS API FAQ](https://www.bls.gov/developers/api_faqs.htm) | BLS 发布物原则上属于公有领域（既有版权图片等例外），要求引用来源；API 条款要求注明访问日期，并说明 BLS 不为下载后的衍生分析及时性/质量背书。[版权说明](https://www.bls.gov/opub/copyright-information.htm)、[API Terms](https://www.bls.gov/developers/termsOfService.htm) |
| 全球宏观/发展指标 | World Bank Indicators API 无需 API key，提供约 16,000 个时间序列、45 个以上数据库，许多序列跨 50 年以上。[Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392) | 数据集通常按 CC BY 4.0 使用并要求同时注明世界银行及原始数据提供者；仍须检查单个数据集条目。[World Bank dataset terms](https://data.worldbank.org/summary-terms-of-use) 这是发布周期驱动的宏观数据，不是实时行情。 |

### 明确排除或单独采购的区域

- **FRED：默认排除出 agent 输入。** FRED 的便利性不能覆盖其当前条款：条款禁止在软件程序/系统或机器学习（包括 LLM、深度学习、生成式 AI）的开发或训练中使用 FRED Services/Content，也禁止通过 API 存储、缓存或归档 FRED 内容；第三方序列还需逐条检查版权。[FRED Legal Notices](https://fred.stlouisfed.org/legal/) 本产品处于 AI 应用开发范畴；若未来需要 FRED，应先取得书面许可，并让连接器在模型调用前执行 `ai_processing_allowed=false` 的硬阻断。
- **实时/延迟交易行情：单独产品线。** Nasdaq 官方资料显示，实时数据的外部分发涉及 distributor、subscriber、controlled/uncontrolled product、申报和费用，外部终端用户还可能需要订阅者协议。[Nasdaq agreements and forms](https://www.nasdaqtrader.com/Micro.aspx?id=OptionsAgreements)、[US Equities and Options Data Policies](https://www.nasdaqtrader.com/content/AdministrationSupport/Policy/USEquitiesandOptionsDataPolicies.pdf) 因而“昨日收盘摘要”“15 分钟延迟报价”“盘中实时行情”不能共用一个模糊的 `price` 字段或同一许可假设。
- **投资建议：产品声明不能替代行为边界。** 美国官方说明把有偿、经常性提供证券建议/报告分析纳入 investment adviser 讨论范围。[Investor.gov](https://www.investor.gov/introduction-investing/getting-started/working-investment-professional/investment-advisers) 上线国家、是否收费、是否根据用户持仓定制都会改变风险，需要当地律师判断。

### 财经数据模型最少要保留

`instrument_or_series_id`、`source_authority`、`observation_time`、`published_at`、`retrieved_at`、`frequency`、`revision_or_vintage`、`currency/unit`、`market_status`、`is_realtime/is_delayed`、`license_id`。宏观数值会修订，不能用抓取时间冒充观测时间；日报更正也不能悄悄覆盖旧版。

## 3. AI 与科技前沿：一手发布优先，但必须标注证据等级

### 建议的三层来源

1. **论文/预印本层。** arXiv API 提供题名、摘要、作者、分类、`published`、`updated` 和文章 ID；生产调用应单连接、每次请求至少间隔 3 秒，同一查询按日缓存即可。[arXiv API manual](https://info.arxiv.org/help/api/user-manual.html) arXiv 描述性元数据可按 CC0 使用，但论文 PDF/源文件仍由作者或出版者持有权利，未获许可不得在自己的服务器保存并再提供。[arXiv API Terms](https://info.arxiv.org/help/api/tou.html) 同时要显式标为“预印本/未必同行评审”；arXiv 自身回顾也说明其机制用于快速、无同行评审地分享研究。[arXiv 2020 Annual Report](https://info.arxiv.org/about/reports/2020_arXiv_annual_report.pdf)
2. **正式出版元数据层。** Crossref REST API 公开 DOI、题名、作者、出版日期、资助、更新/撤稿关系等成员提交元数据，公开访问无需注册；大部分元数据可自由使用，但摘要可能仍受作者/出版者版权约束。[Crossref REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) 生产端应使用 `mailto`/明确 User-Agent、缓存结果并退避。[Access and authentication](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/)
3. **机构/产品发布层。** 维护人工审核的公司、实验室、标准组织、监管机构官方域名与 RSS/Atom；开源项目用仓库的 Releases API，而不是把普通 tag 当正式发布。GitHub 官方说明 `List releases` 不包含未关联 release 的普通 Git tags，公开 release 可无认证读取。[GitHub Releases API](https://docs.github.com/en/rest/releases/releases)

### 去重不能只做“标题相似”

- **对象去重：** DOI 小写规范化；arXiv 去掉 `vN` 得到工作 ID、另存版本号；GitHub 用 `owner/repo + release id/tag`；SEC 用 accession number；RSS 优先 GUID，再用规范化 URL。
- **版本去重：** arXiv 无版本号的 ID 指向最新版，带 `vN` 才是固定版本。[arXiv identifier](https://info.arxiv.org/help/arxiv_identifier.html) 版本更新应标为“更新”，而不是每天当新论文。
- **事件聚类：** 同一模型发布可能同时出现论文、公司博客、GitHub release 和多家报道。它们应归入一个 `event_cluster_id`，保留多个证据节点；不要把独立报道简单删掉，也不要在 AI、财经、科技三个版面复制三次。
- **证据等级：** `官方声明` 只证明发布者说过什么；`预印本` 只证明研究结果已公开；`独立复现/同行评审/监管文件` 才提升验证等级。日报文案必须显示等级，agent 不得把营销声明改写成已验证事实。

## 4. 社交舆论：平台逐项边界

### X

- 当前 Recent Search 覆盖最近 7 天，每次最多 100 条；Full-Archive 可追溯至 2006 年 3 月。[Search Posts](https://docs.x.com/x-api/posts/search/introduction) 自助 API 已采用按量预付费，并有每月 200 万次 Post read 上限；价格、端点额度和企业合同会变，应从控制台和响应头动态读取，不把数值写死在业务逻辑中。[Usage and Billing](https://docs.x.com/x-api/fundamentals/post-cap)、[Rate Limits](https://docs.x.com/x-api/fundamentals/rate-limits)
- 通常只能向第三方再分发 Post/User/DM IDs；当前 Developer Policy 对非自动方式给每位服务用户每天最多 500 个公开 Post/User 对象的例外，但自动邮件/PDF 不应假定属于该例外。离线保存的内容必须随 X 上的修改、删除、私有化或封禁而更新；收到平台或权利人请求后最迟 24 小时处理。[X Developer Policy](https://docs.x.com/developer-terms/policy)
- 开发者登记的 use case 具有约束力，实质变更需要通知并获准；协议还禁止用 X 内容训练/微调基础或前沿模型。[X Developer Agreement](https://docs.x.com/developer-terms/agreement) “调用第三方 LLM 做当次摘要是否获准、摘要能否自动分发”仍需 X 书面确认。

**产品含义：** 未获确认前，X 最安全的试验形态是仅在内部短暂计算聚合计数，成品不复制帖子正文、头像或媒体，只给趋势描述、样本方法、少量 live link/ID；但“衍生分析是否可对外分发”本身仍是待确认项。

### Reddit

- Data API 要求注册 OAuth token 和明确 User-Agent；符合免费访问资格的当前上限为每个 OAuth client ID 100 QPM，以 10 分钟窗口平均，可从 `X-Ratelimit-*` 响应头读取。[Reddit Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)
- 商业用途、超限研究或其他未明确许可用途需要与 Reddit 另签协议。标准 Data API 条款仅允许为运行 App 向 App 用户复制和展示用户内容，除格式化外不得修改；还禁止未经权利人许可拿用户内容训练 AI 模型。[Data API Terms](https://redditinc.com/policies/data-api-terms)
- 删除帖子/评论时必须删除标题、正文、嵌入 URL 等相关内容；账号删除还要去掉作者识别信息。官方技术指引建议最长每 48 小时例行清除一次已存用户数据，Developer Terms 也要求在平台、用户或法律要求时删除。[Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)、[Developer Terms](https://redditinc.com/policies/developer-terms)

**产品含义：** LLM 改写帖子形成“社交舆论摘要”与“不得修改”之间存在直接张力，且 PDF/邮件无法回收删除内容。未经书面许可，不应把 Reddit 用户内容送入 agent 或固化到可分发日报。

### Bluesky / AT Protocol

- 多数 `app.bsky.*` GET 可通过 `https://public.api.bsky.app` 无认证读取；全网实时更新可经 Relay/Jetstream 获取。Bluesky 是多服务的开放网络，不是单一中心 API。[API Hosts and Auth](https://bsky.network/docs/api-directory/)
- Bluesky 将开放端点描述为免费且可自行托管，但其托管的 Jetstream 历史 HTTP replay 已采用 API key 和按下载字节计量；429 响应会给出 `Retry-After`。因此实时 tail、历史回放和自建基础设施是三种不同成本模型。[Bluesky Protocol Services](https://bsky.network/)、[Jetstream replay](https://bsky.network/docs/jetstream-replay/)
- Bluesky 托管 PDS 的整体 API 默认按 IP 为 3000 次/5 分钟，而公共 AppView 只承诺“较宽松”的限额；不同服务商可设置不同限额，必须处理 429 和响应头。[Rate Limits](https://bsky.network/docs/rate-limits/)
- AT Protocol repo 是公开、可验证的数据仓库，但删除记录后不保留 tombstone；同步规范要求镜像及时处理记录和账号删除，并明确不建议公开分发静态全量快照。[Repository](https://atproto.com/specs/repository)、[Sync](https://atproto.com/specs/sync) 官方 oEmbed 会实时执行成人内容、删除账号/帖子和“拒绝未登录查看”规则，适合在线展示，但无法解决 PDF 的撤回问题。[Bluesky embeds](https://bsky.network/docs/advanced-guides/oembed/)
- Bluesky 服务条款说明内容仍属于发布者，并仅向 Bluesky 授予运营所需许可；去中心化也意味着 Bluesky 无法强制所有第三方彻底删除。[Bluesky Terms](https://bsky.social/about/support/tos) 因此“协议上公开可同步”不能自动解释成“任意商业再出版”。

**产品含义：** 技术接入最开放，但仍应存 DID + AT URI + CID、消费 delete/account 事件、限制原文缓存、优先 live link；公开内容的商业摘要/再分发范围仍需法律判断。

### Mastodon

- Mastodon 是实例联邦。某实例的 public/federated timeline 只是“该实例已知的公开帖子”，不是整个 Fediverse；实例管理员还可关闭公开 feed 或要求认证。[Public timelines](https://docs.joinmastodon.org/methods/timelines/)
- 软件默认 REST 限额是每账号、每 IP 各 300 次/5 分钟，但实例可采用自己的配置；客户端必须以响应头为准。[Rate limits](https://docs.joinmastodon.org/api/rate-limits/)
- Streaming API 会发出 `delete` 和 `status.update` 事件。[Streaming API](https://docs.joinmastodon.org/methods/streaming/) 每个实例又有自己的 Terms of Service，API 提供读取当前/历史实例条款的实体。[TermsOfService entity](https://docs.joinmastodon.org/entities/TermsOfService/)
- Mastodon 没有统一的中心 API 套餐或一份覆盖全网内容的商业许可；软件可自托管，但采集权、用户内容权利、限额和潜在费用仍由所选实例及上游内容决定。[Running your own server](https://docs.joinmastodon.org/user/run-your-own/)

**产品含义：** 需要“实例白名单 + 每实例条款快照 + 联邦覆盖说明”，不能把一个大实例的样本命名为“全球社交舆论”。

### 社交舆论的共同统计约束

- 输出必须写清平台、接口、查询式、语言、地域代理变量、时间窗、采样方式、原始/去机器人样本数和缺失率。
- “帖子量/互动量/正负面分类”是样本指标，不得改写成“全网支持率”或现实人口比例。
- 将引用用户的正文、用户名、头像、地理/敏感属性与聚合结论分开授权。默认不做跨平台身份匹配，不输出个体画像。
- 保存 `source_content_state` 与 `last_compliance_check_at`；删除事件应触发原始区清理、可变在线报告重算以及历史导出物的风险登记。不可撤回的邮件/PDF与平台删除义务存在结构性冲突，必须由用户决定是否让社交板块仅存在于可更新的 App 页面。

## 5. 邮件与 Android 交付

### 建议的内容主从关系

服务端的、带版本号的 Markdown 是唯一正文；PDF、HTML 邮件和 Android 页面都是同一 `report_version` 的渲染物。生成顺序为：

```text
采集连接器 -> 来源政策门 -> 规范化证据 -> 去重/事件聚类
           -> agent 仅读取获准字段 -> 引用/事实校验 -> versioned Markdown
           -> PDF/HTML 渲染 -> 邮件或 FCM 指针 -> Android 鉴权拉取
```

### 邮件

- MIME 支持多段消息和非文本附件，因此 HTML 正文、`.md` 与 PDF 附件在协议上可行。[RFC 2045](https://datatracker.ietf.org/doc/html/rfc2045)
- SMTP 接收方在接受邮件后承担投递或重试/退信责任，但这不是“用户在指定分钟已看到”的确认。[RFC 5321](https://datatracker.ietf.org/doc/html/rfc5321.html) 邮件 SLA 应记录 `provider_accepted`、bounce、complaint，不能把 API 200 当作阅读回执。
- IETF 建议邮件提交/访问使用 TLS，但同时说明传输 TLS 不是端到端加密的替代品。[RFC 8314](https://datatracker.ietf.org/doc/rfc8314/) 涉及个性化关注、持仓或敏感主题时，优先发简短目录和需要登录的短期链接，而不是把完整 PDF 永久复制到邮箱。
- 邮件和下载后的 PDF 不可远程撤回。包含社交原文、后续被删除内容或可变行情时，建议邮件只发无原文的摘要/链接；是否保留“当时快照”必须与平台许可和用户归档目标一起决定。

### FCM 到 Android

- FCM 有 notification message 与 data message 两类，二者载荷上限均为 4096 字节；连接虽然加密但不是端到端加密，敏感数据需自行做 E2EE。[FCM message types](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type)
- 因此 push 只应包含无敏感信息的 `report_id`、`edition`、`version` 和显示用短标题；不放新闻正文、持仓、源站 token、永久下载 URL。Android App 使用自己的访问令牌向服务端拉取正文。
- 服务端得到 message ID 只表示 FCM 接受投递，不表示设备已收到。设备离线时 FCM 最长保存 28 天（默认四周）；`ttl=0` 无法立即送达就丢弃，Doze 会延迟低优先级消息。[Message lifespan](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan)
- 日报属于非紧急、可补同步内容，应默认 normal priority，配合按“日期 + 版本”折叠和合理 TTL；high priority 只适合需要立即、可见地通知用户的内容，滥用可能被降级。[Android message priority](https://firebase.google.com/docs/cloud-messaging/android/message-priority)
- Android 13+ 的非豁免通知需要用户授予 `POST_NOTIFICATIONS`；新安装应用默认关闭通知。[Android notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission) App 每次启动/恢复时都要调用 `/reports/sync?since_version=...`，即使用户拒绝通知、消息过期或回调丢失，也能补齐日报。
- FCM Android SDK 需要 Google Play services；官方入门条件要求 Android 6.0+ 且设备安装 Google Play Store/Google APIs，Cloud Messaging 被列为“Google Play services required”。[FCM Android setup](https://firebase.google.com/docs/cloud-messaging/android/get-started)、[Firebase SDK dependencies](https://firebase.google.com/docs/android/android-play-services) 目标设备若包含无 GMS 的地区/OEM，必须保留 `PushProvider` 适配层，并提供第二通道或定时拉取；不能以“Android”一词直接推导 FCM 可用。
- FCM registration token/FID 是设备级标识，应按秘密存储；服务端必须支持 token 轮换、退出登录解绑、无效 token 删除和每用户多设备。[Server environment](https://firebase.google.com/docs/cloud-messaging/server-environment) Firebase 隐私文档说明 installation ID 会保留至客户调用删除，删除后从在线和备份系统移除最长可能为 180 天，应写入隐私告知和删除流程。[Firebase privacy](https://firebase.google.com/support/privacy)

### 离线模型

- 服务端保留 Markdown/PDF 的期限与 App 本地缓存期限分开配置，例如 `server_retention_days`、`device_offline_days`；登出、账号删除和设备解绑应触发本地清理。
- App 的离线副本记录 `report_version`、校验和与生成时间；重新联网后先取 manifest，再增量下载。FCM 的 `onDeletedMessages()` 或版本缺口只触发全量同步，不尝试从 push 恢复正文。
- 一份报告需要 `generated`、`published`、`superseded`、`retracted` 状态。更正生成新版本并保留更正说明；涉及必须删除的上游社交内容时，遵从来源政策，而不是为了“不可变审计”继续对终端公开。

## 6. 应在实现前固化的来源政策门

每个来源建议至少有以下机器可读字段：

```yaml
source_id: string
terms_url: https://...
terms_reviewed_at: 2026-09-04
usage_class: personal | internal | public_free | commercial
allowed_fields: [title, url, published_at, ...]
raw_storage: forbidden | ephemeral | allowed
raw_ttl_hours: 0
llm_inference: forbidden | needs_approval | allowed
redistribution: ids_only | links_and_metadata | excerpts | fulltext
attribution_template: string
deletion_signal: none | poll | stream | compliance_api
max_staleness_hours: number
rate_limit_strategy: headers | configured_contract
```

连接器先产出数据和 `policy_decision_id`，agent 才能读取；输出验证器再检查引文字数、图片、署名和分发渠道。不能依赖 prompt 里一句“遵守版权”来替代执行层阻断。调用云端 coding agent/LLM 也属于把来源内容交给另一个处理方，是否允许应单独建模；模型供应商“不拿数据训练”并不会自动解除新闻源或社交平台对处理、修改、保留和再分发的限制。

## 7. 下一轮 grilling 必须让用户决策的问题

### P0：答案会决定能否开工

1. 服务仅供本人使用，还是会有家庭/团队、多租户、公开订阅或收费？预计 3、12 个月的用户数与日报份数是多少？
2. 服务运营主体和首发用户位于哪些司法辖区？是否接受上线前对新闻版权、个人信息、金融资讯/投顾边界做专业法律审阅？
3. “社交舆论日报”是否必须首发？若必须，能否接受在拿到 X/Reddit 等书面许可前仅做内部实验，或首版只提供可更新的 live link/平台内嵌而不生成可分发 PDF？
4. coding agent 是本地进程还是云服务？哪些来源内容会进入 Codex/Claude 上下文、日志和缓存？能否强制执行来源级 `llm_inference` 禁止项？
5. 财经日报是客观资讯/数据解释，还是会结合用户持仓给买卖、仓位、目标价或风险偏好建议？是否需要盘中实时行情，还是官方披露与日/周/月宏观数据足够？
6. Android 目标机型是否都具备 Google Play services？是否必须覆盖中国大陆常见无 GMS 设备？若要覆盖，是否接受第二推送供应商和额外客户端适配，还是允许“邮件 + App 启动同步”兜底？

### P1：答案会决定数据模型与编辑流程

7. 四份日报是独立文件，还是一份日报的四个栏目？同一事件跨 AI/财经/科技时，是只出现一次并加标签，还是允许跨栏重复？
8. 每栏篇幅、候选数、最终条数、语言和时区是什么？“世界范围”要覆盖哪些国家/地区、语言与本地媒体最低配额？
9. 事实入选需要几个独立来源？哪些事件必须有人审阅（战争、灾害、选举、重大市场波动、公司财报、健康安全）？
10. 是否接受把 `官方声明`、`媒体报道`、`预印本`、`同行评审`、`社交样本`明确打标签，即使这让版面更长？
11. 社交“舆论”要回答什么：话题热度、立场簇、代表性论点、情绪，还是特定账号/社区观察？是否允许显示用户名与短引文？最小样本和置信度阈值是什么？
12. 新闻摘要是否需要中文翻译？引用保留原文还是双语？涉及歧义时是否保留多种译法和原文链接？

### P1：答案会决定交付与留存

13. 邮件需要内嵌全文、`.md`/PDF 附件，还是只发目录和鉴权链接？用户能否接受邮件不是准点送达/已读保证？
14. 服务器和手机分别保留多久？用户是否需要永久历史、全文搜索、导出和删除账号？“永久归档”与社交删除义务冲突时优先哪一个？
15. 更正是覆盖原日报、发一封勘误，还是保留版本链？Android 离线看到旧版时应如何提示？
16. 个性化偏好包含哪些敏感信息（持仓、公司关注、政治/健康主题）？这些信息是否允许出现在邮件标题、通知栏或模型提示词中？

### P2：答案会决定成本与运行方式

17. 日报必须几点可用，允许多大延迟？是否还要盘中/突发提醒？日更任务失败时，是发送残缺版、延迟版还是不发并报警？
18. 每月数据 API、agent token、邮件、PDF 渲染、对象存储和推送预算上限是多少？是否接受某个平台涨价后自动降级或停用该栏目？
19. 是否要求完全可复现：保存候选清单、模型/提示词版本、每条证据哈希、评分和人工修改历史？在内容许可不允许留原文时，接受只留元数据与哈希吗？
20. 用户希望谁承担最终编辑责任：全自动、低置信度人工复核，还是每日发布前人工批准？错报、侵权投诉和平台删除请求由谁接收与处理？

## 8. 可供选择、但尚未替用户决定的落地路径

### 路径 A：低许可风险的个人 MVP

- 世界新闻用 GDELT + 已审阅的出版者 RSS 做发现，成品只写原创短摘要、元数据和链接。
- AI/科技用 arXiv/Crossref 元数据、官方机构发布与 GitHub releases；不自托管论文 PDF。
- 财经只用 SEC/BLS/World Bank 等明确的一手源，不接 FRED，不做实时行情和个性化投顾。
- X/Reddit 暂不进入模型；Bluesky/Mastodon 仅做小规模、可删除、以链接为主的实验，是否分发等待权利确认。
- 服务端保存版本化 MD，按需渲染 PDF；邮件发目录/链接；FCM 发无敏感正文的同步指针，App 启动主动补同步。

### 路径 B：多用户/商业版

- 在编码前完成 NewsAPI/出版者、交易所行情和社交平台的数据合同矩阵，明确 LLM 推理、摘要衍生物、缓存、终端展示、邮件/PDF 导出和删除 SLA。
- 为社交板块建立 compliance event 消费、报告重算、用户删除和不可撤回导出物处置流程。
- 推送层按设备市场选择多个 provider；FCM 只是其中一个实现。

二者不是简单的“以后再付费”关系：路径 B 的合同和删除义务会反过来改变数据模型、报告是否可导出、agent 能看到哪些字段，以及 Android 的历史缓存策略。

## 9. 尚未能由公开资料消除的不确定项

- X、Reddit 是否会书面允许“第三方 LLM 当次推理生成舆论摘要并通过自动邮件/PDF分发”，公开条款不足以给出肯定结论。
- 每个新闻出版者 RSS、网页摘要、图片和长引文的具体许可；需要建立首发来源清单后逐项核验。
- 用户的运营主体、收费方式、目标司法辖区与财经个性化程度，决定是否需要投资顾问、市场数据或个人信息方面的额外许可/备案。
- 目标 Android 机型/GMS 覆盖率；未确定之前不能选择单一推送实现。
- GDELT 对用户关心地区和小语种的实际召回率、误报率与延迟；官方范围描述不能替代 2–4 周的基准采样。
- coding agent 供应商的具体数据保留、区域处理和企业隐私配置，以及它们能否满足每个来源合同中的“第三方处理方”要求。
- 用户是否要不可变永久档案；这与 Reddit/X/AT Protocol/Mastodon 的删除、更新和撤回机制可能无法同时满足。
