# V1-11 增量研究：GitHub 有限候选与快照观测契约

研究日期：2026-09-06（UTC）。状态：Root 预研输入，尚未采纳为实现规格。

本报告由 Root 委派的只读 Research Agent 编写，已完整读取 research skill。只查阅 GitHub 官方文档及官方 API 定义源码，未调用真实候选 API，未读取本地秘密、认证状态或环境变量，未 clone、下载或执行候选代码。官方版本化 schema 通过无凭证公开 HTTPS 读取到内存并提取目标字段，未保存完整 schema。唯一写入为本 ignored 报告；写入前已确认 `.gitignore:3:data/` 覆盖目标路径。没有变更产品、测试、策略、配置、Git HEAD、Issue、commit 或 push。

本地依据：`docs/PRD.md` D8、AC-07/AC-08/AC-10/AC-18；`docs/adr/0003-compute-observer-github-heat-from-official-metadata.md`；`docs/planning/v1/tickets/11-github-snapshot-observations.md`；2026-09-04 的 `docs/research/github-trending-edition.md`。以下明确区分官方事实、Observer 建议和未验证事项，不扩大到 #12/#13 的综合分数或事件规则。

## 1. 本次需要补入旧研究的结论

| 增量 | 对 #11 的影响 |
|---|---|
| 当前官方文档列出 `2026-03-10` 与 `2022-11-28` 两个受支持 REST 版本；不发版本头仍默认后者 | 固定具体版本并随观测保存；不能把“文档当前示例版本”与实际请求版本混同。建议新适配器先以 `2026-03-10` 固定样本验证，不在本次预研改配置。[API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions#supported-api-versions) |
| 官方现在提供 repository star history | 旧研究“计数 endpoint 不提供历史”仍成立，但不应扩大成“GitHub 没有仓库 star 历史 API”。新的按日/周加星聚合仍不等于 D8 的滚动 24h 两点净变化，详见第 4 节。[Star history](https://docs.github.com/en/rest/activity/starring#get-repository-star-history) |
| node ID 是不透明身份，但官方存在旧/新格式迁移 | 维护身份连续性，不承诺同一对象的 ID 字符串在任何 API 迁移中永不变化；URL 不能代替身份核验。[Global ID migration](https://docs.github.com/en/graphql/guides/migrating-graphql-global-node-ids#migrating-to-the-new-global-ids) |
| 官方条件请求语义是“所请求表示未改变” | 304 需要新的确认记录并指回旧响应体，不能重写旧抓取时间或延长来源策略 TTL。[Conditional requests](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests) |
| fine-grained PAT 自带全部公共仓库的只读访问 | 公共元数据观察不需要给候选仓库管理员、Contents write 或 Starring write 权限；明确到期且不额外授权私有仓库。[PAT creation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token) |

旧研究里的新项目 7 天、活跃项目 3 天、stars 门槛、分片算法和示例权重均不能因本报告而成为已批准常量。D8 已批准的是有限官方元数据观察、稳定身份、排除项、小时观测、容忍窗口和因果截止。

## 2. 身份、重定向与缺失元数据

### 官方事实与保证边界

REST `node_id` 对应 GraphQL node interface 的 `id`，支持直接按 node ID 查找对象；官方要求把这些唯一标识当不透明字符串，不自行解码。官方迁移指南同时展示：用旧 ID 查询可以返回同一对象的新 ID。[Using global node IDs](https://docs.github.com/en/graphql/guides/using-global-node-ids)，[Migrating global node IDs](https://docs.github.com/en/graphql/guides/migrating-graphql-global-node-ids)

改名会重定向仓库信息并保留 stars 等关联，但重新使用旧仓库名会破坏重定向。转移会连同 stars、watchers 和 fork 网络关系一起转移；旧路径重新建仓或 fork 会永久删除转移重定向。[Renaming](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)，[Transfer contents and redirects](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository#whats-transferred-with-a-repository)

`Get a repository` 文档列出 `301`、`403`、`404` 等结果，并展示 `id/node_id/full_name/html_url/private/fork/archived/disabled/is_template/mirror_url/visibility` 等字段。官方示例是说明性数据，不能当成每个字段必然存在、每个示例值互相一致的运行样本。[Get a repository](https://docs.github.com/en/rest/repos/repos#get-a-repository)

**研究边界：** 上述材料支持以仓库对象身份贯穿改名/转移；本次没有找到可引用的“所有 rename/transfer/API 迁移条件下 node ID 字符串绝不变化”逐字保证，也未做真实改名/转移实验。不得把本报告或固定 fixture 升格为该外部保证。

### 建议的有限身份处理

- 同 node ID、不同 `full_name/html_url`：追加有观测时间的名称/地址历史，继续同一快照序列。
- 同旧路径、不同 node ID：不继承旧项目历史，不相减；标记身份冲突或新对象并留下证据。即使 HTTP 200 也不能跳过此检查。
- `301`：最多有限次跟随经验证的 GitHub API HTTPS 地址，完整读取最终响应并校验 node ID；终止于非允许目标或重定向循环时记失败。HTTP 的跟随与更新建议见 [GitHub redirects](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#follow-redirects)；目标约束与最大次数是 Observer 防护建议。
- 只在官方直接 node lookup/migration 映射等可验证证据建立后连接新旧 ID 别名。保存 REST numeric `id` 作辅助审计，不依赖解码 node ID 或仅凭同名猜映射。#11 不必因此新增默认 GraphQL 调用。

### 建议的资格解码，不把未知默认为允许

以下是落实 D8 的 Observer 资格规则，**不是宣称 GitHub schema 的每个字段都 required**。Root 追加的目标 OpenAPI 核验已完成，精确 required/nullable 结论见第 8 节；`visibility/is_template` 的合法省略必须与资格未知分开。GitHub 提供按产品及日期版本划分的官方定义，见 [OpenAPI descriptions](https://docs.github.com/en/rest/about-the-rest-api/about-the-openapi-description-for-the-rest-api#about-githubs-openapi-description)。

| 证据 | 有效候选要求 | 异常处理 |
|---|---|---|
| 身份 | 非空、不透明 node ID；可校验的仓库 API/原始展示地址 | 缺失、错误类型、身份冲突：隔离 |
| 公开性 | `private === false`；建议同时要求 `visibility === "public"` | private 为 true、非 public、冲突、未知枚举或缺字段：排除/隔离 |
| 结构与状态 | `archived === false`、`disabled === false`、`fork === false`、`is_template === false` | true：排除；null、缺失、字符串 `"false"` 等：未知隔离 |
| mirror | `mirror_url` 字段存在且显式 null | 非空地址：排除；缺失、空串或错误类型：隔离，不读取该外链 |
| 计数 | `stargazers_count`、`forks_count` 为非负、有限、可无损保存的整数 | 0 是有效计数；缺失、null、负数、溢出、类型不符：不可计算，不补零 |
| 可选分类 | language/license 可为空，topics 可为空数组 | 保留 unknown/empty 的差别；不据此自动认定恶意或允许再分发 |
| 可访问性 | 当期有效成功响应或满足第 5 节的有效 304 | 网络/认证/权限/不可访问失败不是“计数为零” |

Search 可用 `is:public archived:false mirror:false template:false`；普通仓库搜索默认不含 fork。限定词只减少发现噪声，后续仍按详情核验。[Repository visibility](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories#search-by-repository-visibility)，[Repository structural qualifiers](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories#search-based-on-whether-a-repository-is-a-mirror)

`disabled=false` 仅是该状态字段，不是“已扫描安全”的证明。隔离未知不是断言恶意；本轮也不新增 README、二进制或源码扫描。

## 3. 有限 Search、分页与失败记录

### 官方事实

Search repositories 每页最多 100，默认 30；单次搜索最多可取回 1,000 项。Search 通用文档另有 4,000 仓库搜索范围限制，不能将其与可取回结果上限混同。`sort` 支持 stars、forks、help-wanted-issues、updated；这是当前规模/更新时间排序。认证 Search 通常 30 次/分钟，未认证 10 次/分钟。查询超时可返回 `incomplete_results=true`；该值表示可能不完整，不能因为 HTTP 200 就忽略。[Search API](https://docs.github.com/en/rest/search/search#about-search)，[Search repositories parameters](https://docs.github.com/en/rest/search/search#parameters-for-search-repositories)

下一页应由 `Link` 中的 `rel="next"` 得到；没有 `last` 不等于没有下一页。官方普通 pagination 示例会剥离 `total_count/incomplete_results`，因此不能原样作为 Observer 审计聚合器。[REST pagination](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api#using-link-headers)，[Pagination scripting example](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api#scripting-with-pagination)

查询含无权限资源可能 422；多资源检索也可能只返回有权限部分而没有列出省略项。`incomplete_results=false` 不能作为权限覆盖证明。[Search access errors](https://docs.github.com/en/rest/search/search#access-errors-or-missing-search-results)

### #11 建议，不启动全球扫描

使用有限、版本化 query 清单和固定排序；不默认语言过滤，不把旧研究时间阈值照抄为规则。`per_page=100`、每 query 最多 10 页作为协议上限；实际还要有更小或相等的配置页数、候选总量、请求总量、总时长上限。query 列表、cap 和遍历次序属于运行配置版本，不是临时由候选内容决定。暂不引入递归分片追求全量。

逐页保存 query、sort/order、page、per_page、请求/完整响应时间、total_count、incomplete_results、原始项数、去重后项数、next 是否存在、HTTP 结果、退避和停止原因。以 node ID 去重，但保留每个查询命中关系。

建议分开记录以下维度，而非一个 `complete` 布尔：

| 维度 | 推荐表达 |
|---|---|
| 采样宇宙 | `finite_query_set`，永远不声称全 GitHub |
| 主动界限 | `configured_cap_reached` / `search_1000_cap` |
| GitHub partial | 任一页 `incomplete_results=true` 即 `search_incomplete` |
| 遍历结果 | 已抓页、未抓 next、重复页/重复 node、计数漂移、失败页 |
| 请求故障 | auth/rate/access/validation/service/network/parse 分类 |

全部配置页成功只能叫“本次有限查询遍历成功”。分页期间排序项变动会造成页面位移；官方提醒增加/删除也会改变分页，不能宣称交易级快照。[Stable cached requests](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#make-requests-that-can-be-cached)

### 认证、限额与其他错误

| 官方响应事实 | Observer 建议 |
|---|---|
| 无效凭证最初通常 401；短时间多次失败后连有效认证也可能暂时 403。[Authentication failures](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api#failed-login-limit) | 终止该凭证本轮批次、报告认证失败，不盲目自动降到匿名模式；不能凭 401 断言一定是“过期” |
| Primary/secondary rate limit 都可能 403 或 429；前者 remaining=0，后者有相应错误信息。[Rate troubleshooting](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#rate-limit-errors) | 联合安全响应头和错误类别分类，不能把所有 403 写成限额 |
| 私有且未正确授权的资源会用 404 隐藏存在性。[404 behavior](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#404-not-found-for-an-existing-resource) | 表示“当前不可访问”，不擅称已删除或计数清零，禁止用旧缓存作为本期有效状态 |
| 422 可表示验证失败、请求滥用或查询访问问题；503 是服务不可用。[Search statuses](https://docs.github.com/en/rest/search/search#http-response-status-codes-for-search-repositories) | 422 不无限重试、不由错误文字改写查询策略；503/网络故障仅做有界重试 |
| 退休 API 版本会 410；不存在版本可 400。[API version lifecycle](https://docs.github.com/en/rest/about-the-rest-api/api-versions#api-version-closing-down)，[Unsupported version](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#not-a-supported-version) | 记协议配置失败，不解释为仓库被删除 |

认证普通 REST 通常 5,000 次/小时，匿名 60 次/小时，另有 shared concurrency、points 等 secondary limits；每次采用实际响应头，不能将静态上限当成本轮剩余额度。[REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)

遵守 `retry-after`；remaining=0 等到 reset；无法据此确定时至少等一分钟，后续指数退避且有限次重试。若恢复时刻已超过本轮截止/总时长，停止本轮并呈现缺样，不能等待后把未来结果塞进旧刊。[Rate retry guidance](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#rate-limit-errors)

建议所有 API 请求顺序执行；401 和无法恢复的权限/验证失败零重试，网络/5xx/已确认 secondary limit 至多两次额外尝试，且同时受总时长和截止限制。具体 request timeout/候选规模应以 #11 容量证据固定，不能从“xx:25 开始”推断所有仓库必在截止前完成。

## 4. 累计计数、净变化与新出现的 star history

官方明确 `stargazers_count`（历史别名 `watchers/watchers_count`）是当前已加星用户数，真正订阅 watcher 用 `subscribers_count`。专用 count endpoint 明确排除已经取消 star 的用户。因此“累计 stars”在 Observer 中应理解为**当前存量计数**，不是历史全部加星操作的单调累计器。[Starring versus watching](https://docs.github.com/en/rest/activity/starring#starring-versus-watching)，[Get stargazer count](https://docs.github.com/en/rest/activity/starring#get-stargazer-count)

`forks_count` 在 repository metadata 中是当前 forks 指标；Search 按 forks 数排序。本次未找到该计数单调递增、精确到事件时刻或具跨认证上下文一致性的保证；使用同一受限公共观测上下文保存 API 原值，不从 fork 列表长度、`network_count` 或 Search `score` 替代它。[Repository metadata](https://docs.github.com/en/rest/repos/repos#get-a-repository)，[Repository search sorting](https://docs.github.com/en/rest/search/search#parameters-for-search-repositories)

**新增能力：** `GET /repos/{owner}/{repo}/stargazers/history` 返回按日历周分组的 stars，`days` 是从星期日开始每天创建的 stars；周/日边界不保证 UTC 对齐。公共资源可无认证读取，分页最多 30 项、page 最大 100。[Repository star history](https://docs.github.com/en/rest/activity/starring#get-repository-star-history)

**推论与范围决定：** 这不是文档化的“以 Observer 07:30 为终点、可扣除取消 star、截止前可用的滚动 24h 净变化”契约。#11 仍应只从两个有效快照相减，不用该接口伪造旧快照、消除 Cold-start Heat 或回填未来可用性；本次不增设该接口调用。旧研究需要改的是过宽的 API 能力描述，不是已批准的 D8 数学定义。

建议 `delta_stars = current.stargazers_count - previous.stargazers_count`、forks 同理，使用可保存负数的无损整数运算；身份、计数口径或认证可见范围不兼容时不可相减。负值保留原始结果；不由下降幅度擅自断言刷星、删除或其他成因。

数据状态至少分开：有效正/零/负净变化；进入观察不足所需历史的 Cold-start Heat；已有历史但近目标样本缺失/陈旧；当前样本失败；身份/资格隔离。只有历史不足是冷启动；不能用累计 stars 充当 delta，也不在 #11 套入尚未批准的综合代理分数。

## 5. ETag、304 与 07:30 可用性

GitHub 建议保存 ETag 后以 `If-None-Match` 做条件 GET，也支持 `Last-Modified/If-Modified-Since`。304 说明请求的表示未变；正确带 Authorization 的 304 不计 primary rate limit，但这不是所有限额/成本都免除的保证。稳定 URL 和参数有利于复用 ETag。[Conditional GET](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api#use-conditional-requests)

以下时间字段与选择规则是 **Observer 落实 D8 的实现建议**；GitHub 没有为返回的全部元数据提供一个精确统一的状态变更时刻：

| 字段 | 建议含义 |
|---|---|
| `scheduled_for` | 原定小时任务时间，仅用于调度审计 |
| `request_started_at` | 请求启动时刻，不证明已观察到响应 |
| `response_received_at` | 完整响应可用时刻；200 必须包含完整 body，304 必须已完整结束 |
| `available_at` | 有效响应完成验证并进入可供当期读取的记录时刻；不得早于完整接收 |
| `observed_at` | 推荐与有效观测的 `available_at` 一致，严格可重放；另保留 received 时间解释本地处理延迟 |
| `body_fetched_at` | 所引用最近一次 200 原始 body 的抓取时间，不因 304 改写 |
| `validated_at` / `observation_kind` | 本次 304 的确认时刻及 `revalidated`；200 为 `fetched` |
| `body_ref` / `validator_ref` | 原 body 的稳定引用/摘要，以及实际条件请求与 304 证据 |
| `policy_version` / `policy_checked_at` | 来源许可决策版本与检查时间；独立于 API 计数确认时间 |

允许 304 成为“计数未变化的再次观测”的条件建议：存在对应资源、API 版本、media type、query/页和认证上下文一致的有效 body；曾通过字段与身份校验；本次确实完成带匹配 validator 的条件请求；原 body 和当前处理均在来源策略许可、保留/缓存期限内。记录 `body_fetched_at` 与本次 `observed_at`，不能合并成一个模糊 `fetched_at`。

304 **不能**：重置原 body 的年龄、延长策略 TTL、恢复被撤销的许可、证明没有字段之外的风险，或把 Search 页再确认当作仓库详情再确认。旧 body 已过期、丢失、validator 不匹配时，记 `cache_unusable`；若政策允许且本轮还有时间，可另做一次完整 GET，否则缺样。完全没有网络确认的缓存读取不产生新 observation。

建议小时相位为报告时区的 `xx:25`，在 07:30 前留出五分钟窗口；这是 Root 提出的实现方案，**不是 GitHub 调度规定，也不是已完成容量验收**。采集量、排队和退避仍必须受界限约束。

当期当前样本应满足 `observed_at <= cutoff` 且距 cutoff 不超过 15 分钟；历史样本距 `cutoff - 24h` 不超过 60 分钟，并同样要求 `available_at <= cutoff`。两点必须可溯源且前后有序，展示两次实际观测时间及实际间隔。择样的同距离 tie-break 应固定，例如先更早观测，再稳定记录 ID。

| 截止边界案例 | 建议结果 |
|---|---|
| 原定 07:25；07:29:59 完整接收，但 07:30:01 才验证并对当期可用 | 不进入该 07:30 冻结；不能用 scheduled/started 时间回填 |
| 恰好 07:30:00 已完整验证并可用，冻结选样规则为 `<=` | 可入选，需持久化相同精度的边界证据 |
| 请求 07:29 启动，07:30:01 才完整返回 | 下一期可用，本期缺样 |
| 07:31 完成 304，body 来自昨天 | 本期不能使用该未来确认；保留昨天旧 body 时间 |
| 07:25 完成有效 304，原 body 已违反来源 TTL | 不因 304 恢复资格；按缓存/政策失败呈现 |
| 所有“当前样本”仅存在于 07:30 之后但在 +15 分钟内 | 缺样；容忍窗口不能推翻因果截止 |

## 6. 最小到期 PAT 与来源权限边界

Search repositories 支持 fine-grained PAT 且无需额外 permission；Get repository 一般列出 Metadata read，但只取公共资源时无需认证或该额外许可。[Search token permissions](https://docs.github.com/en/rest/search/search#fine-grained-access-tokens-for-search-repositories)，[Get repository token permissions](https://docs.github.com/en/rest/repos/repos#fine-grained-access-tokens-for-get-a-repository)

PAT 创建指南明确 token 总是包括全部公共仓库只读访问；选择最小 repository access、不给额外私有仓库和账号写权限。GitHub 建议最少权限、足够短的明确 expiration、服务端安全保存、避免 token 明文出现在命令行或仓库。[PAT scope and public access](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)，[Credential security](https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure)

建议 #11 凭证配置契约：服务端秘密引用 + 非秘密到期时间/凭证配置标识；固定只允许选定 GET 路由。日志只采用允许名单字段，不记录 Authorization、完整请求配置、包含秘密的异常、返回对象内与本业务无关的凭据字段或 secret 派生值。不存在 secret、已知到期或外部认证失败应在 GitHub 栏呈现故障；不能偷偷改用更宽 token。

“这次 GET 成功”只能证明这次调用的技术可达性；不能证明 PAT 只有读权限、必有到期日，或证明整条处理/模型/发布链已获来源许可。`X-Accepted-GitHub-Permissions` 表示 endpoint 所需权限，不能作为 token 实际无其他权限的证明。[Permission header](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#resource-not-accessible)

GitHub 条款保留用户内容权利、区分 GitHub/其他用户的许可，并限制 API 滥用与共享 token 绕过限额。因此公共 API 可读取、repo license 字段或 304 都不能自行将 Observer 来源策略从待审改成允许，也不能推导永久缓存/公开分发权。[GitHub Terms: user content](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#d-user-generated-content)，[GitHub Terms: API](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#h-api-terms)

推荐遵守现有 source permission 管线，仅持久化本次观测需要的允许字段与证据；本研究不是法律判定或来源授权。README、Release body、候选外链、头像、源码和二进制均非本票默认观测材料。

## 7. 实现交接与证据类别

建议固定样本覆盖以下行为，这些属于后续开发验证设计，本报告未创建测试或声称通过：

1. 同 node ID 改名/转移历史连续；旧地址 200 返回其他 node ID 时不串历史；合法/非法重定向、循环、缺 node ID。
2. 每个排除状态 true；字段分别缺失/null/错误类型；公开性矛盾；optional 分类 unknown；无效计数与有效零。
3. 分页多页、重复 node、total_count 漂移、显式 cap、1000 上限、incomplete true、缺失 incomplete、失败次页、304 页与无 body 缓存。
4. 正/零/负两点差；历史不足与成熟仓库缺样不同；超容忍、恰好边界、只存在未来观测、开始早但完成晚。
5. 有效 304 引用旧 body、新确认时间；单纯缓存不刷新；304 不续政策 TTL、不复活撤销许可、不挪动原始 fetch 时间。
6. 401、权限型 403、primary/secondary 403/429、422、503、网络/解析失败；恢复时间超过截止；带敏感值异常脱敏。
7. 固定 Report Record/Canonical Markdown 中的 GitHub Watch Item 能回溯 query、身份、两点时间、计数、缺样原因和 API/配置/策略版本；不出现官方 Trending 或完整全站覆盖措辞。

| 证据类别 | 本次状态 / 后续要求 |
|---|---|
| 官方文档调查 | 已完成本报告；链接为 2026-09-06 查阅状态，后续协议升级须复核 |
| 版本化 OpenAPI 目标字段校验 | 已完成 Search/详情的 10 个资格字段、Search envelope 与 numeric-ID route 存在性核验，固定 source revision 见第 8 节；未声称全面验证全部 API 或真实响应 |
| 固定 API-shaped fixtures / synthetic clocks | 本次未运行；只能证明开发逻辑，不是真实 GitHub API 连通、身份转移或滚动 24h 观测证据 |
| 真实外部接入 | 未验证；没有真实候选请求，没有读取或探测凭证 |
| 真实 PAT 最小权限和期限 | 未验证；必须由实际 provisioned 配置/允许的配置核验支持，GET 成功不足以证明 |
| 真实小时运行、07:30 相位容量、次日两点差 | 未验证；需绑定代码、配置、实际时区、完整响应与可用时间，不能用 scheduled 时间代替 |
| 来源许可与人工成稿检查 | 未因本报告获准或通过；保持现有权限和验收类别 |

推荐 Root 先将本报告作为 #11 工作树中的增量研究输入，再在技术规格中明确采纳的有限集合、时钟、304 和失败边界。本文件本身不改变既有 PRD/ADR 或 #10 冻结验收结论。

## 8. Root 追加核验：固定 OpenAPI、身份追踪路由与期限证据

### 8.1 固定的官方定义与目标字段

核验来源：[github/rest-api-description 固定 revision 的 2026-03-10 定义](https://github.com/github/rest-api-description/blob/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json)，[同 revision 原始 JSON](https://raw.githubusercontent.com/github/rest-api-description/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json)。2026-09-06 从官方仓库页面解析 source revision 后，按该不可变 revision 读取定义；没有调用 `api.github.com` 的真实仓库或认证 endpoint。

- source revision：`3cef12e8a02d612ad032473d4fb87266f2befeae`。
- source path：`descriptions/api.github.com/api.github.com.2026-03-10.json`。
- 读取内容按 UTF-8 计算 SHA-256：`0418E462C16E0D7C14DB3CC22DC8440D0566E710A43788946926727374CD8EAA`。
- 定义格式 `openapi=3.0.3`；文件的 `info.version=1.1.4` 是描述文档版本，**不是**请求的 `X-GitHub-Api-Version` 值。
- `GET /search/repositories`，operationId `search/repos`；200 JSON envelope 必需 `total_count/incomplete_results/items`；item 引用 `#/components/schemas/repo-search-result-item`。
- `GET /repos/{owner}/{repo}`，operationId `repos/get`；200 JSON 引用 `#/components/schemas/full-repository`。

精确 response JSON pointers：`#/paths/~1search~1repositories/get/responses/200/content/application~1json/schema`；`#/paths/~1repos~1{owner}~1{repo}/get/responses/200/content/application~1json/schema`。下表直接读取两个 component 的 `required` 数组和 `properties`，不从示例猜测。所有字段结论均来自上述固定官方定义。

| 字段 | Search required | Get required | 类型 / nullable（两者相同） |
|---|---|---|---|
| `node_id` | 是 | 是 | string；未声明 nullable |
| `private` | 是 | 是 | boolean；未声明 nullable |
| `visibility` | **否** | **否** | string；未声明 nullable；描述列出 public/private/internal，但没有 schema enum 约束 |
| `archived` | 是 | 是 | boolean；未声明 nullable |
| `disabled` | 是 | 是 | boolean；未声明 nullable |
| `fork` | 是 | 是 | boolean；未声明 nullable |
| `is_template` | **否** | **否** | boolean；未声明 nullable |
| `mirror_url` | 是 | 是 | string，format uri，**nullable=true** |
| `stargazers_count` | 是 | 是 | integer；未声明 nullable/minimum |
| `forks_count` | 是 | 是 | integer；未声明 nullable/minimum |

**给实现者的关键区别：** parser 应接受两个 optional 字段的省略，并保留 unknown；不能把 optional 省略报为整个 response malformed。第 2 节要求 `visibility=public` 与 `is_template=false` 是 Observer 的更严格入选证据建议。缺少这些证据时可以保留合法观测元数据并标记资格未决，但不能发布该仓库为已确认合格，也不能把缺失值填 false/public。一个 Search item 的 optional 缺失可交给既定详情请求补齐；但完整详情本身也允许省略，因此不能承诺“补一次详情就一定解决”。这可能减少可用候选，真实接入必须测量该缺失率。若 Root 决定采用其他官方证据补齐，应在规格明确对应字段及可信度，不由搜索命中或历史缓存默认推断。

推荐为“合法但资格未知”和“协议类型不符”分别保留 replay 用例。非负计数、非空身份和未知 visibility 隔离同样是 Observer 领域限制，不能假装是上述 schema 已写出的 `minimum/minLength/enum`。

建议请求头仍是 `X-GitHub-Api-Version: 2026-03-10`，配 `Accept: application/vnd.github+json` 和有效 User-Agent。当前版本头由[官方版本指南](https://docs.github.com/en/rest/about-the-rest-api/api-versions#specifying-an-api-version)与[所选 endpoint 示例](https://docs.github.com/en/rest/repos/repos#get-a-repository)确认；不要用 `info.version=1.1.4` 或省略版本头。上述两个 operation 的 parameters 未单独列出该版本头，不能据此反推不需要固定版本。

### 8.2 REST numeric-ID route 的结果与最小身份追踪方案

**核验结果：** 固定定义的 `paths` 中不存在 `/repositories/{repository_id}`。只存在 `/repositories` 这一顶层列表路由，不能把它解释为 numeric-ID 详情路由；当前[Get repository 文档](https://docs.github.com/en/rest/repos/repos#get-a-repository)只给出 owner/repo 详情入口。本次定向官方文档检索也未找到 numeric-ID 详情路由的支持契约。因此 #11 不应实现或依赖猜出的 `GET /repositories/{id}`，也不能因为其他子资源 URL 使用数字 ID 就推导该入口受支持。[固定 REST 路由定义](https://github.com/github/rest-api-description/blob/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json)

| 机制 | 官方支持与实际边界 | #11 推荐 |
|---|---|---|
| 保存 canonical owner/repo，调用详情，处理 301 | 正式详情入口和 GitHub 重定向规则；普通改名/转移可通过现有重定向找到新位置，但旧路径复用会使重定向消失。[Get repository](https://docs.github.com/en/rest/repos/repos#get-a-repository)，[Transfer redirects](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository#whats-transferred-with-a-repository) | 最小 REST-only 路径。固定允许的 GitHub API origin；每跳校验 HTTPS、origin、允许路径和次数；保留 DNS/出站防护；禁止向外域转发 token。最终成功 body 的 node ID 匹配后才更新地址历史 |
| 有限 Search 中再次发现旧 node ID | Search 返回 node ID，但只有有限查询结果，不能保证改名/转移后的项目仍在查询内。[Search repository schema](https://github.com/github/rest-api-description/blob/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json) | 可用于有限恢复；返回不同 node 的旧路径必须隔离。没重新命中就显式缺样，不扩大到无界搜索、不伪造连续观测 |
| GraphQL `node(id)` 读取 Repository 身份/地址 | 官方直接 node lookup；Repository 提供 id、nameWithOwner、url，以及非空 isTemplate/visibility 等类型。普通 GraphQL query 用 POST 到 `https://api.github.com/graphql`，读取与写入由 query/mutation 区分。[Node lookup](https://docs.github.com/en/graphql/guides/using-global-node-ids#3-do-a-direct-node-lookup-in-graphql)，[Repository fields](https://docs.github.com/en/graphql/reference/repos#repository-2)，[GraphQL HTTP contract](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#communicating-with-graphql) | 若 #11 必须在旧路径复用后仍主动按身份继续跟踪，这是有文档支持的身份解析补充。需要固定查询文本、仅允许已知 node IDs 与只读字段、有限调用及专门 POST transport 边界；不能因为要读取就放开任意 POST/GraphQL 内容。null/errors 仍降级 |

**推荐交给 Root 的选择：** 在现有 GET-only transport 范围内先完成“实际详情 301 → 校验同 node → 保存新地址”的可回放闭环，足以落实普通改名/转移处理；明确路径复用且有限 Search 未命中时的身份未解析/缺样。若验收要求跨路径复用也有主动恢复能力，应由 Root 在 #11 规格内选择受限 GraphQL node 解析，而非依赖不存在于官方定义的 numeric-ID 详情。该补充可以只解决 node 到 canonical address，再回到同一 REST 计数口径，避免未验证地混用 REST/GraphQL forks 指标。

### 8.3 期限 metadata 的可证明边界

GitHub 在 2021-07-26 官方公告中公布 `GitHub-Authentication-Token-Expiration` 响应头，表示 PAT 到期时间。[Official PAT expiration header announcement](https://github.blog/changelog/2021-07-26-expiration-options-for-personal-access-tokens/)

本次没有找到“目前每种 fine-grained PAT、每个成功/失败/304 响应都会包含该头”的统一保证，也没有通过真实凭证验证。建议把从验证过的 GitHub API TLS 响应中得到且可解析的该头作为带接收时间的**外部期限证据**；与服务端 provisioned 非秘密期限配置分开。缺头、无效日期或冲突不是“永不过期”，本地自填未来日期也不是 GitHub 签发期限证明。生产验收应记录实际创建配置或已验证的外部到期信息；运行时采用更保守的已知期限并暴露未知/冲突，不能因此申请更宽凭证或读取 token 内容。

该期限头不证明 token 仅有读权限。公共 Search/Get 的最小权限仍由第 6 节 endpoint 文档决定；GraphQL 官方指南亦明确 fine-grained PAT 包含公共仓库只读访问，实际字段缺权限会返回错误。[GraphQL PAT permissions](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#authenticating-with-a-personal-access-token)
