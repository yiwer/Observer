# Mastodon 社交样本 Adapter：协议、许可与验收边界

核对日期：2026-09-05；文档整理时间：22:28 UTC。状态：实施研究，**没有获准的真实实例或真实社交内容来源**。建议实现一个可替换的 Mastodon REST Adapter，并保持真实来源关闭；以自有、虚构、固定的 API 响应验证协议和 T1 业务结果。

本次按 research 技能读取第一方文档、官方源码和法律文本；没有请求真实时间线、状态、账户或个体样本，没有注册应用、申请权限、取得凭证、调用模型 Provider 或发送邮件。条款网页只返回页面壳后，以只读 HTTP 请求读取了官方法律文档接口 `https://mastodon.social/api/v1/instance/terms_of_service`；这不是社交内容采样。本文不构成来源批准或真实接入验收。

约束来自 [V1-10](../planning/v1/tickets/10-social-discourse-edition.md)、[PRD D6](../PRD.md#d6-来源与偏好)、[PRD T1](../PRD.md#t1-主要测试边界已确认)和 [ADR-0005](../adr/0005-separate-expiring-source-material-from-permanent-reports.md)：采集、缓存、模型输入、分发、永久产物分别授权；原始材料与不可变报告分离；无合法来源允许交付 Coverage Gap。

## 版本适用性

本轮官方 latest 发布页指向 [v4.7.1](https://github.com/mastodon/mastodon/releases/tag/v4.7.1)，页面发布时间为 2026-09-01，提交短标识 `bc19d30`。下文源码证据固定到该 tag，文档则是本轮可读的现行页面。**尚未核对任何候选实例的部署版本、配置、分叉或持续可用性**；不能把以下默认值或源码行为扩称为全部 Mastodon 实例的合同。

文档和源码有真实差异：未知标签、禁止匿名访问以及分页链接携带的参数都需防御处理。以下分别标明，不把文档描述与当前源码强行合并成一个必然响应。

## API 最小范围与采样边界

建议首版只实现下列两个 GET 模板，origin 必须来自经过审阅的精确 HTTPS 实例白名单。这里的 `mastodon.example` 是虚构域名，不能作为获准配置。

```text
GET https://mastodon.example/api/v1/timelines/tag/{encodedHashtag}?local=true&limit=20
GET https://mastodon.example/api/v1/statuses/{encodedInstanceStatusId}
```

标签路径不含 `#`；GET timeline 返回 Status 数组。公开访问能否免 token 取决于实例配置，公开 API 存在本身不授予内容使用权。[标签 API 文档](https://docs.joinmastodon.org/methods/timelines/#tag)、[官方公开数据入门](https://docs.joinmastodon.org/client/public/)

| 问题 | 官方证据与可实施结论 |
|---|---|
| 匿名访问 | timeline 文档将端点列为 Public，关闭公开预览时要求认证，4.5 起还有细分访问设置。v4.7.1 `TopicController` 按 local/remote topic feed access 判断，进入 `require_user!` 时无用户可能返回 **422**；全局 `DISALLOW_UNAUTHENTICATED_API_ACCESS` 或 limited federation mode 可返回 **401**。不能只处理文档中的 401，更不能遇到失败自动申请 token 或切其他实例。[TopicController](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/timelines/topic_controller.rb)、[API BaseController](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/base_controller.rb) |
| 标签、范围参数 | 官方文档支持 `any[]`、`all[]`、`none[]`、`local`、`remote`、`only_media`；后面三个默认 false。`local=true` 指本实例本地帖子，**不是当地居民或当地事件**。首版单标签且 local=true 可缩小来源权利范围；仍需本地作者内容的用途许可。[timeline 参数](https://docs.joinmastodon.org/methods/timelines/#tag)、[TagFeed](https://github.com/mastodon/mastodon/blob/v4.7.1/app/models/tag_feed.rb) |
| 复合查询精确语义 | v4.7.1 将路径标签与 `any[]` 合并为 OR，再应用 `all[]` 与 `none[]`；每种模式最多取四个标签，路径标签也占 any 模式名额。因此不能把 `any[]` 当成“路径标签 AND 任意附加标签”，或声称任意多标签都会生效。首版无需开放该复杂面。[TagFeed](https://github.com/mastodon/mastodon/blob/v4.7.1/app/models/tag_feed.rb) |
| 页面大小 | `limit` 默认 20、最大 40，是项目数上限；不是响应字节或原文长度上限。Adapter 自己必须限制字节、页面数和总样本数。[timeline 文档](https://docs.joinmastodon.org/methods/timelines/#tag)、[limit_param 实现](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/base_controller.rb) |
| 游标 | `max_id` 是排他上界；`since_id` 是排他下界并取较新的结果；`min_id` 从给定 ID 后向前分页。源码普通查询按 ID 降序，min_id 查询先升序取邻近项再反转返回。ID 始终当 opaque string，不转 JS Number、不从 ID 解码发布时间。[Paginable](https://github.com/mastodon/mastodon/blob/v4.7.1/app/models/concerns/paginable.rb)、[ID 与分页指南](https://docs.joinmastodon.org/api/guidelines/#handling-ids-within-api-responses) |
| 空页 / 未知标签 | 文档列出未知标签 404、禁用 feed 可返空数组；v4.7.1 `TagController` 对找不到的标签直接返回 `[]`。空数组只能证明本次响应没有样本，不能确认标签从未存在、没有相关讨论或来源完整。[TagController](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/timelines/tag_controller.rb)、[timeline 响应](https://docs.joinmastodon.org/methods/timelines/#tag) |
| 服务器筛选与覆盖 | v4.7.1 查询 public visibility，排除 suspended/silenced 账户；本实例已知的联邦内容与治理配置共同决定可见样本。TagFeed 自己未套用普通 public timeline 的默认排除回复/转发步骤，因此 Adapter 仍须显式处理回复、转发等字段。它不是全网搜索或随机抽样接口。[TagFeed](https://github.com/mastodon/mastodon/blob/v4.7.1/app/models/tag_feed.rb)、[PublicFeed](https://github.com/mastodon/mastodon/blob/v4.7.1/app/models/public_feed.rb) |

### Link 分页与截止时间

官方指南提供 HTTP `Link` 的 `rel="next"`/`rel="prev"`。v4.7.1 非空 timeline 页即插入这两条链接：next 使用最后一项 ID 作 `max_id`，prev 使用第一项 ID 作 `min_id`；因此 **有 next 不表示下一页必有数据，短页也不证明已遍历完毕**。[API Pagination](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/concerns/api/pagination.rb)、[Timeline BaseController](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/timelines/base_controller.rb)

该版本 `TagController::PERMITTED_PARAMS` 仅包含 `local`、`limit`、`only_media`；服务端生成 Link 时可能遗漏 `remote`、复合标签及其他原始边界。实施建议：验证 Link 为同 origin、同标签 endpoint，无 userinfo/fragment，游标唯一且未重复；提取经过校验的 `max_id` 后，用原始不可变查询配置重建下一页 URL。不能盲目跟随任意 Link，也不能让分页悄悄改变查询。若需要兼容无 Link 的响应，仅对这个明确按 Status ID 分页的端点使用最后一项 ID 作为有界后备；缺页头、坏链接、重复游标及预算耗尽应进入缺口记录。[TagController](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/timelines/tag_controller.rb)、[Timeline BaseController](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/timelines/base_controller.rb)

该标签 API 没有 `start_time`、`end_time`、`language` 或地域筛选参数。Observer 必须固定目标窗口与 cutoff，再在本地逐条检验 `created_at`，保留原始响应观测时间。Mastodon 指南解释排序通常反映**插入本实例数据库的时间**；它不承诺与远程帖子的 `created_at` 严格同序。因此遇到一条窗口前的旧帖，不能据此断言后续页全都过旧。达到有限页数/样本数即停止并披露部分覆盖，不承诺完整时间窗。[timeline 参数](https://docs.joinmastodon.org/methods/timelines/#tag)、[ID 排序指南](https://docs.joinmastodon.org/api/guidelines/#handling-ids-within-api-responses)

以下属于 Observer 的因果边界建议：`created_at <= cutoff` 不足以证明正文版本在 cutoff 前已被观察；截稿后首次取得的普通材料不能倒填进当期。`edited_at > cutoff` 的当前版本不进入当期普通摘要；截稿后复查只用于隔离、更正和撤回，不能替换成后来版本后继续假装是截稿快照。分页过程没有服务端事务快照保证，需去重并披露该限制。

## 字段处理与隔离

下表左侧是官方 API 含义，右侧是为当前 V1 范围建议的处理，不表示这些字段已经获准采集或保存。[Status 文档](https://docs.joinmastodon.org/entities/Status/)、[v4.7.1 StatusSerializer](https://github.com/mastodon/mastodon/blob/v4.7.1/app/serializers/rest/status_serializer.rb)

| 字段 | 建议映射与不能推导的含义 |
|---|---|
| `id` / `uri` / `url` | `id` 是查询实例数据库身份，查回必须使用同实例；以 `(instanceOrigin, id)` 去重。`uri` 是联邦对象身份，只有获准才保存或用来跨实例去重。`url` 可为 null，是 HTML 表示链接，不是新的出网授权。不从任意外部 URL 提取 ID 到另一实例复查。 |
| `created_at` / `edited_at` | 分别映射创建时间和最近编辑时间。`edited_at` 自 3.5.0 提供且可 null；缺字段/不支持版本不证明从未编辑。无效时间或未来时间隔离，不能以采集时间补写成来源时间。 |
| `visibility` | 仅明确 `public` 才符合本轮候选范围。`unlisted` 虽可公开读取也不属于 public timeline 语义；`private`、`direct` 和未知值隔离。可读不等于已授权。 |
| `sensitive` / `spoiler_text` | sensitive 标记与折叠提示均需检查。建议首版 sensitive=true、非空 spoiler_text 或无法确定状态者整体隔离；不要把 spoiler 当新闻标题。sensitive=false 不证明内容没有隐私或敏感材料。 |
| `content` | HTML 字符串。只在许可允许后经受限解析提取文字；不执行 HTML、不下载链接/图片、不把 profile mentions 或链接标记原样注入 MD/PDF/邮件。HTML 清理不替代内容许可和敏感字段控制。 |
| `account` | 作者账户实体可携带显示名、简介、头像、自填字段等；最小计数仅按获准账户 ID 去重，不生成个人画像。若账户身份连临时处理都未获准，distinct-author 数必须 unknown，不能只加哈希后宣称不再受策略约束。 |
| `language` | 可为 null 的帖子主语言代码；最多披露为平台返回的语言，不证明作者母语、国籍或中文总体观点。需要本地语言筛选时记录所用筛选器及 unknown 处理。 |
| `media_attachments` / `card` / `poll` | 这些是独立内容面。建议首版有媒体或投票的样本整体隔离，card 与媒体 URL、alt text、HTML 等不进入模型和导出；不递归抓取。平台投票数也不是抽样支持率。 |
| `reblog` / `quote` | reblog 是嵌套 Status；quote 可含另一对象。首版整体隔离转发/引用内容，不能把两层作者和正文混成一条原发，也不能双重计数。quote approval 是平台引用功能状态，不是模型加工或永久导出许可。 |
| `in_reply_to_id` / `in_reply_to_account_id` | nullable；前者是回复父帖，后者存在跳过自回复链的语义，不能直接当完整线程根。建议首版隔离回复并披露“仅原发”；未来保留回复时必须避免把同线程连续发言当独立信号。 |
| `replies_count` / `reblogs_count` / `favourites_count` / `quotes_count` | 只说明响应所表示的互动数字，不替代实际取得的样本数、不同作者数或总体支持率。v4.7.1 serializer 对部分互动数还可能使用上游 untrusted count；首版无须用它们达到采样门槛。 |

官方指南说明内容通常已由 Mastodon 清理成有限 HTML，远程内容没有统一可用的纯文本原稿。Adapter 仍要自行做输入边界验证，且不能借 `text` 或编辑历史接口恢复已经隔离/删除的材料。[HTML 格式指南](https://docs.joinmastodon.org/api/guidelines/#formatting)、[Status 的 text 字段](https://docs.joinmastodon.org/entities/Status/#text)

完整线程不是单个 Status 的字段。`GET /api/v1/statuses/:id/context` 返回 ancestors/descendants；v4.7.1 匿名上下文限制为至多 40 个祖先、60 个后代、20 层后代深度，认证请求另有 4096 上限和可能触发异步补取的分支。首版不调用 context；即使以后实现，也必须报告线程覆盖未知或不完整，不能拿 `replies_count` 宣称线程已读全。[Context](https://docs.joinmastodon.org/entities/Context/)、[ContextsController](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/statuses/contexts_controller.rb)

## 同实例复查：删除与变化的保守语义

公开 Status 可以通过 `GET /api/v1/statuses/:id` 查询；源码在该实例数据库中找 ID，再做可见性授权，不是强制刷新远程原站的承诺。[单状态文档](https://docs.joinmastodon.org/methods/statuses/#get)、[StatusesController](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/statuses_controller.rb)

| 复查观察 | 可确定的事实 | Observer 建议结果 |
|---|---|---|
| 200，身份与所有获准、影响摘要的字段相同 | 该实例本次给出了相同可见表示 | `unchanged-at-instance`；不能声称原站未删或全网一致。 |
| 200，`edited_at` 或影响候选的字段不同 | 当前可见表示发生变化 | `changed`；隔离旧摘要，重新通过政策/核验。只比较 edited_at 不足以覆盖所有风险字段。 |
| 200，ID/URI 身份不符、非 public、sensitive、嵌套内容/媒体状态变更或结构不明 | 复查结果不满足原候选条件 | 不发布旧材料；身份/安全字段异常不能转成正常 changed 后直接通过。 |
| 404 | 找不到或无权看 | `unavailable`，**不标注 confirmed-deleted**。源码将 RecordNotFound 和 NotPermitted 都转换为 not_found。 |
| 401 / 403 / 422 | 当前请求未获得可用表示，可能与实例或访问配置有关 | `access-unavailable`；停止相关网络重试或等待明确下一次调度，不换 token/实例绕过。 |
| 410 | 收到 gone 响应，但本轮 REST 证据未定义其为作者删除证明 | 仍隔离并记 `unavailable`；不将未知实现响应伪装成平台确认删除。 |
| 429 / 5xx / 超时 / 取消 / 非 JSON / 过大 | 未完成有效复查 | `recheck-incomplete`，不能沿用旧快照当复查成功；输出缺口。 |

404 的歧义也由可见性策略支持：作者不可用、private/direct 等情况都会影响能否看见。通用 API 错误处理另有 403、422、429 和 503，但没有给此 GET 定义专门的“确认作者删除”状态。[StatusPolicy](https://github.com/mastodon/mastodon/blob/v4.7.1/app/policies/status_policy.rb)、[API ErrorHandling](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/concerns/api/error_handling.rb)

删除/不可访问虽不能混作同一事实原因，**可以采用相同的保守隔离效果**：停止模型和分发投影，按已批准策略清理可变缓存与关联材料；只保留单独获准的运行元数据。比较哈希、记录键也须有独立保存许可，不能因其不像原文便永久保留。已产生的 MD/PDF/邮件不能保证远端副本撤回，因此任何真实 SourcePolicy 都须先解决删除义务与永久衍生文字、不可撤回导出的相容性；不相容或未知即不启用。[ADR-0005](../adr/0005-separate-expiring-source-material-from-permanent-reports.md)

## 限流、资源上限、取消和出网

官方限流页面列出 `X-RateLimit-Limit`、`X-RateLimit-Remaining`、`X-RateLimit-Reset`，并提醒存在重叠限额；页面所列默认账户/IP 300 次/5 分钟不能当成所有实例的现行配额。[限流文档](https://docs.joinmastodon.org/api/rate-limits/)

v4.7.1 源码的未认证 API 是按 IP（IPv6 按 /64）300 次/5 分钟，带 `max_id`/`min_id`/`since_id`/page 的分页请求还受 300 次/15 分钟限制。429 responder 返回上述 X-RateLimit 头，**没有保证提供 `Retry-After`**；前置代理或其他版本可能添加它。[Rack::Attack](https://github.com/mastodon/mastodon/blob/v4.7.1/config/initializers/rack_attack.rb)

以下是 Observer 实施建议，不是 Mastodon 承诺的服务上限：

- 一个实例一次一个请求；实例级冷却同时约束采集与 status 复查。收到可解析 `Retry-After` 时尊重它，同时不能早于可解析的 reset；无头或无效头使用固定有界退避/本轮失败。等待超出本轮 deadline 就返回限流缺口，不忙循环。
- 配置固定 `timeoutMs`、`maxResponseBytes`、`maxPages`、`maxItems`、`maxRequests` 和整轮 deadline；每页最多请求 40。字节限制必须在读取/解压过程中执行，不能只依赖 Content-Length；错误正文同样限长且不进日志。官方材料没有为此 GET 承诺固定响应字节数或延迟。
- 取消信号覆盖 DNS、连接、读体、翻页、重试等待和复查；取消后中止流与后续请求，结果为未完成。官方端点没有专用“取消远端 GET 工作”合同，客户端停止等待也不证明服务器未处理该请求。
- 复用 ADR-0005 已有证书校验、DNS 地址审查/固定和原始 hostname/SNI 约束。只接受精确允许 origin 的两个路径；首版可拒绝所有重定向，未来若允许须逐跳重新核查且不能扩大允许读取正文的 origin。禁止凭 `url`、`uri`、头像、媒体、mention、Link 或错误消息访问新主机；不自动读取 localhost、私网或元数据地址。

出网规则源自 Observer 的安全边界，不是 Mastodon API 的 URL 可信承诺。一个白名单实例可能返回远程作者对象：**API 请求 origin 许可与返回内容作者/原实例许可必须分别审阅**。`local=true` 能缩小范围，但不能自动解决作者权利。

## 能披露什么，什么必须 unknown

| 观察维度 | 可确知（须实际有响应或固定测试证据） | 必须保留的未知/限制 |
|---|---|---|
| 平台与入口 | Adapter 类型、请求实例、固定标签与全部生效查询参数 | 该实例是否覆盖全 Mastodon/联邦网络：不成立；真实实例版本本轮 unknown。 |
| 时间 | 配置窗口、cutoff、请求观测时刻、有效 created_at/edited_at | 首次发表于全网的时间、全窗完整性、分页事务一致性、原站实时删除状态 unknown。 |
| 语言 | 平台 language 值、null 数、本地筛选配置及留存样本语言分布 | 标签语言不等于帖子语言；作者母语/国籍 unknown，不能按实例域名补写。 |
| 地域 | 若以后获准配置有可验证地域说明，可引用该说明并写清仅为选源依据 | REST Status 没有可靠地理位置字段；本轮作者居住地、事件地理覆盖和地域代表性均 unknown。 |
| 样本量 | 收到数、有效 unique status 数、窗口内数、隔离数、复查成功数、实际进入分析数；仅在身份处理获准时计 distinct account | 重复页不增加样本；boost/favourite/reply 数不算实际观察数；全体讨论总量、触达人数、人口支持率 unknown。 |
| 缺口 | 被限流、预算/截稿中止、无许可、字段未知、隔离、无法复查、语言和原发筛选带来的缺口 | 服务器未返回或未联邦传播的帖子数通常 unknown；不能拿 0 代替未知。 |

该表中字段可用性来自 [Status](https://docs.joinmastodon.org/entities/Status/)、[StatusSerializer](https://github.com/mastodon/mastodon/blob/v4.7.1/app/serializers/rest/status_serializer.rb)、[TagFeed 的查询范围](https://github.com/mastodon/mastodon/blob/v4.7.1/app/models/tag_feed.rb)；统计与披露约束是 [PRD D6](../PRD.md#d6-来源与偏好)的实现推论。没有任一官方 API 文档为“代表性样本的最小 n”背书。Story-linked / Platform-native 的最小有效帖数、不同作者/线程门槛须在技术规格中预先固定、版本化，属于选题规则，不是民调有效性证明；不能看过结果后降门槛凑数。

## 当前内容许可：不能从开放软件或公开访问推导

官方 [2026-07-31 条款公告](https://blog.joinmastodon.org/2026/07/announcing-new-terms-of-service-for-our-servers/)确认 mastodon.social 与 mastodon.online 的新版注册用户条款于 2026-08-31 生效，其他独立实例由各自管理员制定规则。不能引用旧新闻中的 2025 条款内容当作 2026 年所有 Mastodon 实例的当前规则。

本轮直接读取 [mastodon.social 官方条款文档 API](https://mastodon.social/api/v1/instance/terms_of_service)，HTTP 200，返回 `effective_date=2026-08-31`、`effective=true`、`succeeded_by=null`。页面入口为 [Terms of Service](https://mastodon.social/terms-of-service)；API 字段及历史版本机制见 [TermsOfService 文档](https://docs.joinmastodon.org/entities/TermsOfService/)。本轮读到的条款含英语/德语，发生冲突以德语为准，以下只做用途边界归纳：

- 适用对象是该服务注册用户，明确排除非注册用户和其他联邦服务用户；不能把它自动变成所有 API 访客的统一合同。
- 原权利人继续拥有内容。授予 Mastodon GmbH 的许可限于运营/维护服务，包括托管、格式化、自动翻译和联邦传输；这不是给 Observer 的通用加工许可。
- 删除终止其继续托管、展示和传输相应内容的许可，备份另有条款；文中也说明联邦副本和外部计算机上的删除无法保证。后者描述控制能力限制，不应解释为允许第三方永久保留。
- 条款不赋予合同双方以外的人第三方合同权利。本轮没有从该文本取得 Observer 定时抽样、向指定外部模型推理、永久中文摘要、引文及不可撤回 MD/PDF/邮件导出的明确授权。

上述归纳全部来自 [2026-08-31 当前条款文本](https://mastodon.social/api/v1/instance/terms_of_service)。本轮**不主张新版条款包含普遍 AI 禁令，也不主张它授予模型用途**；未出现某项禁令不等于许可。训练、一次推理、第三方留存和衍生文字归档是不同用途，仍须按实际来源和作者权利逐项核查。一个实例的条款也不能替远程作者/原实例补授权。

官方仓库标明 **AGPLv3 是 Mastodon 软件许可**；它不是用户帖子的开放内容许可。文档页的 CC BY-SA 同样不自动覆盖示例引用之外的真实平台用户内容。公开访问、discoverable、quote approval、robots 允许、短摘要或链接归因均不能替代 Owner 对完整用途链路的明确审阅。[Mastodon README 的软件许可说明](https://github.com/mastodon/mastodon/blob/v4.7.1/README.md)、[官方条款](https://mastodon.social/api/v1/instance/terms_of_service)

因此真实实例 `review` 保持 pending，采集、保存、模型、分发、衍生文字和永久归档授权保持关闭/空；删除义务、原文 TTL、键/哈希保留、允许字段、目标 Provider 处理条件、不可撤回导出相容性均为待审。本文没有可直接导入并启用的来源配置，也没有为 Owner 发起许可申请。

## 一个最小实施路径与 T1 验收

1. **交付真实协议 Adapter。** 将上述 URL 构造、受控 GET、JSON/分页解析、Status 白名单映射和同实例复查封装到可替换平台边界；生产 HTTP transport 和可注入固定响应 transport 使用同一 Adapter。手工 Owner dump 不能替代这项平台能力。
2. **默认走无许可降级。** 源配置无批准用途时，采集前返回 Coverage Gap，不访问实例。来源变更/撤销/TTL 到期在模型、成稿和导出前再次阻断，按 ADR-0005 清理可变材料。真实 API 访问与内容权利均未验收。
3. **固定虚构 API 响应。** 只使用为本项目新写的虚构帖子、虚构账户及 `.example`/`.invalid` 地址；不要复制官方文档里的真人帖子来充当 fixture。固定数据的授权范围显式属于测试材料，不继承到真实平台配置。
4. **跨 T1 边界观察结果。** 经实际 Adapter 注入分页/复查响应、时钟、来源政策和 AgentRunner 替身，触发业务生产。本 #10 的实测验收终点限定为 Canonical Markdown（MD）与永久 Report Record，检查其中的 Report Version、两类社交观察、缺口与禁止字段；替身无需逐字模拟真实模型。后续 PDF/邮件 Rendition 的输入必须继承同版本正文及禁止字段约束，但其输入投影、呈现与投递实现属于后续票，留待后续实际测试；本票不据此声称已有 PDF/邮件输入替身或相关验收。真实模型事实质量仍须独立验收。
5. **先固定输出门槛与范围。** Story-linked Discourse 必须指向既有主 Event Cluster，只陈述样本中的论点/分歧；Platform-native Signal 必须通过固定有效样本、作者/线程与查询规则。无样本、阈值不足、偏斜、不可复查或无许可时少收录并披露，不能升级成事实证据或总体支持率。

建议固定响应覆盖以下外部业务行为，测试观察最终可见结果及传输边界，避免断言私有方法结构。表中产物检查限于本 #10 的 Canonical MD 与永久 Report Record；PDF/邮件继承约束留待后续票实际测试：

| 固定响应场景 | 应观察到的结果 |
|---|---|
| 两页合法样本、跨页重复、next 后空页 | 精确去重与样本计数，两类输出按预设门槛生成，正文明确为虚构测试覆盖。 |
| Link 越 origin/改 path/重复游标/遗漏原始过滤，超页数或字节预算 | 无越界请求；有限结束并记录缺口，查询不被分页改变。 |
| cutoff 后新帖、旧帖后仍出现窗口内帖、edited_at 超 cutoff | 不倒填当期；不以单个旧帖提前证明完整，覆盖边界准确。 |
| 敏感/CW、媒体、投票、转发、引用、回复、null language、未知字段 | 按固定隔离规则缩小样本；账户简介、姓名标记、mention、媒体 URL、原文哨兵等不会流入未获准模型字段、Canonical MD 或永久 Report Record。 |
| 复查 changed / 404 / 403 / 410 / 429 / 超时 | 旧材料不再被视为已核验；404/410不生成“作者已删除”伪事实；产生相应缺口。 |
| 许可关闭/撤销、TTL 到期、零样本、低于门槛 | 无真实采集；无模拟填充真实覆盖；Canonical MD 与永久 Report Record 保留明确 Coverage Gap。 |

本研究完成的证据仅是官方协议/条款核查和可实施建议。固定响应测试可以证明上述 Adapter 与业务边界行为；**不能证明真实实例授权、真实接口联调、真实样本覆盖、群体代表性或线上删除执行已经通过**。真实来源仍关闭是当前可交付状态，不是需要手工 dump 绕过的缺陷。

## 窄附注：本地 hashtag 的标准 HTML 包装

2026-09-05 补核，仅阅读 v4.7.1 官方源码。正常本地原发的标签登记从 `status.text` 提取；API `content` 依次经过 `StatusSerializer#content`、`FormattingHelper#status_content_format`、`HtmlAwareFormatter` 的本地分支和 `TextFormatter`。后者把可识别的正文 hashtag 生成 `a`，内部保留 `#` 和无属性的 `span`。因此，**通过正文 `#tag` 登记并命中标签查询的标准本地帖子通常就包含 a/span；仅允许 p/br 会拒绝这条正常路径**。这是已读标准实现的结论，不把任意历史数据、异常响应或其他分叉都断言为同一结构。[标签登记 L4–7](https://github.com/mastodon/mastodon/blob/v4.7.1/app/services/process_hashtags_service.rb#L4-L7)、[Serializer L80–82](https://github.com/mastodon/mastodon/blob/v4.7.1/app/serializers/rest/status_serializer.rb#L80-L82)、[FormattingHelper L27–31](https://github.com/mastodon/mastodon/blob/v4.7.1/app/helpers/formatting_helper.rb#L27-L31)、[HtmlAwareFormatter L16–35](https://github.com/mastodon/mastodon/blob/v4.7.1/app/lib/html_aware_formatter.rb#L16-L35)

`TextFormatter#link_to_hashtag` 的属性为 `href=tag_url(hashtag)`、`class="mention hashtag"`、`rel="tag"`，该分支**没有 target 或 translate**。一般 URL 另有 `target="_blank"`、`rel="nofollow noopener"`、`translate="no"` 及 invisible/ellipsis span；账户 mention 则使用 h-card 外层 span 和 `class="u-url mention"` 的 anchor。它们不属于本轮需要放开的 hashtag 包装。[hashtag 分支 L109–114](https://github.com/mastodon/mastodon/blob/v4.7.1/app/lib/text_formatter.rb#L109-L114)、[一般 URL / mention 分支 L52–81](https://github.com/mastodon/mastodon/blob/v4.7.1/app/lib/text_formatter.rb#L52-L81)、[官方 HTML 指南](https://docs.joinmastodon.org/api/guidelines/#mentions-hashtags-and-custom-emoji)

以下是本项目新写的虚构字段片段，可嵌入既有完整虚构 Status 响应；不是完整 API Status，也不是采集来的帖子。固定查询为 `observerfixture`，剥除包装后应得到 `虚构议题：样本设施扩建 #observerfixture`：

```json
{
  "content": "<p>虚构议题：样本设施扩建 <a href=\"https://mastodon.example/tags/observerfixture\" class=\"mention hashtag\" rel=\"tag\">#<span>observerfixture</span></a></p>",
  "tags": [{ "name": "observerfixture", "url": "https://mastodon.example/tags/observerfixture" }],
  "mentions": [],
  "reblog": null,
  "quote": null,
  "in_reply_to_id": null
}
```

最小解析建议属于 Observer 的约束：在 p/br 之外，只接受结构经过校验的上述 hashtag anchor 和其唯一无属性 span；属性顺序不作为语义，class/rel 按固定 token 集合校验。href 仅作本地数据校验，限定获准实例 HTTPS origin、`/tags/` 路径及与可见标签一致的标签名，无 userinfo/query/fragment，绝不跟随抓取。验证后输出纯文本 `#tag`，丢弃整个链接及所有属性；文本实体只解码一次，不把解码后的字符串再次作为 HTML 解析或执行，后续 MD 仍按纯文本转义。一般链接、账户 mention、额外属性/事件属性、其他嵌套元素、媒体和不匹配结构继续隔离；允许 hashtag 包装不扩大来源权限。T1 应同时覆盖这个标准虚构正例与一般链接/mention/恶意变体的隔离，检查本票的 Canonical MD 与永久 Report Record，PDF/邮件测试仍留后续票。
