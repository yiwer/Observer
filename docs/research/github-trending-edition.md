# GitHub 热门项目 Edition：官方数据边界、可审计热度与历史降权

> 研究日期：2026-09-04  
> 研究范围：只使用 GitHub 官方文档、官方 API 描述、官方 GitHub Changelog、`github.com` 官方页面及 GitHub 官方源码仓库。  
> 结论性质：架构与需求事实底座；许可部分不是法律意见。

## 结论先行

1. **不能把产品承诺为“GitHub Trending 的 API 版”。** GitHub 有公开的 [Trending 页面](https://github.com/trending)，页面提供 daily、weekly、monthly 等 UI 选项，但 GitHub 当前公开的 [REST OpenAPI 描述](https://docs.github.com/en/rest/about-the-rest-api/about-the-openapi-description-for-the-rest-api)和[公开 GraphQL Schema](https://docs.github.com/en/enterprise-cloud@latest/graphql/overview/public-schema)都没有文档化的 `trending` endpoint、field 或算法契约。页面 HTML 不是稳定 API。
2. **可以用官方 API 构建一个可审计的“Observer 热度榜”。** 候选发现主要依赖 Repository Search；候选详情、累计 stars/forks、topics、创建/推送时间、Release 和安全公告再由 REST/GraphQL 补齐。必须把检索式、窗口、分页、`incomplete_results`、快照时间和评分版本一并保存。
3. **任意公开仓库的“过去 24 小时 star 净增量”需要服务自行做周期快照。** Search 的 `sort=stars` 是累计值排序，不是时间窗增量。Public Events 有数量、保留时间和延迟限制，`WatchEvent` 只有加星，没有可靠的取消加星净额。更重要的是，GitHub 已宣布从 2026 年 7 月起收紧公开仓库 stargazer 名单 API，不能再把逐个 stargazer 的时间线当作全球仓库的通用能力。
4. **历史降权必须以稳定 repository node ID 为主键。** 仓库改名或转移不能重置“已报道”历史。重大稳定 Release 或与该仓库明确关联的新/重大更新 GHSA 可以一次性绕过冷却期，但事件 ID 必须去重，防止同一事件连续升权。
5. **V1 应发布“元数据 + 原始链接 + 自写摘要”，不要镜像 Trending UI、README、源码或完整 Release 文本。** GitHub 鼓励用 ETag 做条件请求，但官方并未给所有公共元数据一个通用的永久缓存许可；仓库内容的再分发还受内容作者权利、仓库许可证和 GitHub 条款约束。

## 1. GitHub Trending：可观察 UI，不是公开稳定 API

### 1.1 已确认的官方边界

| 观察项 | 官方事实 | 产品含义 |
|---|---|---|
| Trending 页面 | [github.com/trending](https://github.com/trending) 是 GitHub 官方页面，展示仓库、stars today 等信息，并有日/周/月、语言等 UI 选项 | 可用于人工对照，不能据此推定存在公开 API 或稳定算法 |
| REST API 契约 | GitHub 说明 REST API 的契约由其 [OpenAPI description](https://docs.github.com/en/rest/about-the-rest-api/about-the-openapi-description-for-the-rest-api)描述，官方描述仓库为 [github/rest-api-description](https://github.com/github/rest-api-description)；当前公开描述中没有 Trending 路由 | 不应抓“隐藏接口”并当作受支持契约 |
| GraphQL 契约 | GitHub 提供可下载的[公开 GraphQL Schema](https://docs.github.com/en/enterprise-cloud@latest/graphql/overview/public-schema)；当前 schema 有 `search`，没有 `trending` 字段 | GraphQL 同样不能复刻官方 Trending 排名 |
| 页面资产 | GitHub [Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)对 GitHub 自身 HTML、CSS、JavaScript 和视觉设计保留权利 | V1 不抓取和重发 Trending 页面/UI |

**研究判定（截至 2026-09-04）：** 没有找到 GitHub 文档化、公开且有稳定契约的 Trending REST/GraphQL API，也没有官方公开 Trending 排名算法。后续若 GitHub 增加正式 endpoint，应以版本化官方 API 文档为准重新评估。

产品命名建议是 **“Observer GitHub 热门项目 Edition”**，并在方法说明中写“基于 GitHub 官方 API 的自定义、可审计热度”，不要写“GitHub Trending 镜像”或声称与官方榜单一致。

## 2. 可构建热门候选的官方能力

### 2.1 Repository Search 是候选发现入口

[Search repositories REST endpoint](https://docs.github.com/en/rest/search/search#search-repositories)支持：

- 以累计 `stars`、累计 `forks`、`help-wanted-issues` 或 `updated` 排序；
- `created:`、`pushed:`、`stars:`、`forks:`、`language:`、`topic:`、`license:`、`archived:`、`mirror:`、`template:` 等限定词，完整语义见[官方仓库搜索文档](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories)；
- 最多每页 100 条，但**单次搜索最多只能取回 1,000 条结果**；
- 官方 Search 通用限制还说明，单个查询最多在 4,000 个符合 filters 的仓库范围内搜索；这是“搜索范围”限制，与“最多取回 1,000 条结果”不是同一件事；
- 搜索通常按 best match；指定排序后仍只是在查询结果内按当前累计值或更新时间排序；
- 认证请求通常为每分钟 30 次 Search 请求，未认证通常为每分钟 10 次；Search 有独立限额；
- 查询文本最多 256 个字符（不含限定词），布尔运算符数量也有限；
- 超时或索引压力可能返回部分结果，响应中的 `incomplete_results=true` 必须视为“不完整”，不能静默发布。

关键语义：

- `sort=stars` / `sort=forks` 是**当前累计值**，不是“过去 24 小时增量”。
- `pushed:` 指最近一次提交被推送到任意分支的时间，不能等同于 Release、活跃用户数或项目质量。
- fork 默认不进入普通 repository search；仍应在补齐详情后重新检查 `fork`，避免查询变化或错误配置漏过。
- topic 由仓库维护者标注，适合分类和分桶，不应当作可信度证明。

### 2.2 需要分片，而不是假装 1,000 条就是“全球全集”

当 `total_count > 1000` 时，V1 应确定性分片：

1. 先按 `created` 或 `pushed` 时间窗切分；
2. 某个时间窗仍超过 1,000 时，再按语言、topic 或 stars 区间切分；
3. 保存每个分片的完整 query、请求截止时间、`total_count`、页码、`incomplete_results` 和重试记录；
4. 任一关键分片持续 `incomplete_results=true` 时，整期应“降级标记”或停止发布，由用户决定，不能把部分结果称为完整全球榜。

搜索索引在分页期间会变化，因此即使分片也不是交易账本式快照。推荐固定每日截止时刻，并在短时间内完成一次采集；榜单应声称“按 Observer 采样窗口生成”，而不是“全球所有 GitHub 仓库的绝对排名”。

### 2.3 REST/GraphQL 能补齐哪些字段

[Get a repository](https://docs.github.com/en/rest/repos/repos#get-a-repository) 和 [GraphQL Repository object](https://docs.github.com/en/graphql/reference/objects#repository)可提供或对应下列字段：

| 用途 | 建议保存字段 |
|---|---|
| 稳定身份 | `id`、`node_id` / GraphQL `id`、`full_name`、`html_url` |
| 当前规模 | `stargazers_count`、`forks_count`；GraphQL `stargazerCount`、`forkCount`；也可用专用 `GET /repos/{owner}/{repo}/stargazers/count` 读取当前 star 数 |
| 时间 | `created_at`、`updated_at`、`pushed_at` |
| 分类 | primary language、topics、license |
| 结构过滤 | `fork`、`mirror_url` / `isMirror`、`is_template` / `isTemplate` |
| 状态过滤 | `archived`、`disabled`、visibility；GraphQL 还有 `viewerContentWarning` |
| Release | latest release 或 Releases endpoint 返回的 release ID、tag、draft、prerelease、`published_at` |

GitHub 的[仓库转移说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)表明，转移时 stars/watchers 会随仓库转移，旧 URL 也会重定向；因此历史主键应是不可读但稳定的 global node ID，而不是 `owner/name`。GitHub 也明确要求客户端把 [global node ID 当作 opaque identifier](https://docs.github.com/en/graphql/guides/migrating-graphql-global-node-ids)。

[Starring REST 文档](https://docs.github.com/en/rest/activity/starring)另有两个容易踩坑的当前事实：

- GitHub 已提供只返回当前计数的 `GET /repos/{owner}/{repo}/stargazers/count`；对公共仓库可不认证读取，适合做轻量快照，但仍然没有历史序列；
- REST 响应里的 `watchers`、`watchers_count`、`stargazers_count` 都表示 star 数，而真正订阅通知的 watcher 数是 `subscribers_count`。V1 应统一以 `stargazers_count` / 专用 count endpoint 为 star 口径，避免把字段名误读。

GraphQL 可减少补齐详情的往返次数，但不会绕过搜索上限：

- 公共 schema 的 `search` connection 最多返回 1,000 个结果；
- connection 分页必须提供 `first` 或 `last`，每次 1–100，见[官方分页指南](https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api)；
- 还受点数、节点数、并发、超时和 secondary rate limit 约束，见[GraphQL rate/query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)。

### 2.4 Release、Events 与安全公告的角色

- [Releases REST API](https://docs.github.com/en/rest/releases/releases)适合监测已经进入候选池或观察名单的仓库。`latest release` 是最近的非 draft、非 prerelease 完整 Release，按 `created_at` 排序；官方明确说明这里的 `created_at` 是 Release 所用 commit 的日期，不是 draft 或发布日，所以还必须单独保存 `published_at`。GitHub 没有文档化的“全球所有仓库 Release 搜索” endpoint。
- [Public Events API](https://docs.github.com/en/rest/activity/events)只适合补充发现线索：最多返回 300 条，时间线只覆盖最近 30 天，而且官方注明不是实时服务，延迟可能从约 30 秒到 6 小时。
- [GitHub event types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)中的 `ReleaseEvent` 可以提示发生了公开 Release，但受 Public Events 的上述截断和延迟限制，不能作为完整全球 Release 数据源。
- [Global Security Advisories API](https://docs.github.com/en/rest/security-advisories/global-advisories)支持按公告类型、严重性、生态、发布时间、更新时间、影响包等过滤；响应可包含 GHSA/CVE、`repository_advisory_url`、`source_code_location`、发布时间和撤回时间。它适合安全事件升权，但只有当官方字段能明确映射到仓库时才可关联，不能只凭相似包名猜测。

## 3. “过去 24 小时 star 增量”必须如何定义

### 3.1 三种观测手段的可用性

| 手段 | 能看到什么 | 不能解决什么 | V1 判定 |
|---|---|---|---|
| 仓库详情累计值或专用 count endpoint | 当前 `stargazers_count`；`GET /repos/{owner}/{repo}/stargazers/count` 只返回当前 count | 没有历史时间窗 | **通用、稳定；必须自行快照** |
| Stargazers list + `starred_at` media type | 理论上可返回加星时间 | GitHub [2026-06-30 官方变更公告](https://github.blog/changelog/2026-06-30-upcoming-access-restrictions-to-public-api-endpoints-and-ui-views/)宣布，自 2026 年 7 月起，对公开仓库 stargazer 名单的访问限制为管理员/协作者；无权限调用可能为空或 403 | **不能作为全球任意仓库的 V1 基础** |
| Public `WatchEvent` | 公开的加星事件；`action` 只有 `started` | 最多 300 条、30 天、明显延迟，不包含可靠的取消加星净额，也可能在繁忙时间线中被截断 | 只能作为候选提示，不能算净增 |
| `star` webhook | `created` / `deleted` 动作，可精确维护增减 | repository webhook 需要仓库管理权限；GitHub App 只收到安装所覆盖资源的事件，见[webhook 类型](https://docs.github.com/en/webhooks/types-of-webhooks)和[创建 webhook](https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks) | 仅用于自有或获授权仓库的增强能力 |

### 3.2 V1 的可审计定义

对候选仓库 `r`，在日报截止时间 `t`：

`delta_star_24h(r,t) = star_count(r,t_current) - star_count(r,t_old)`

其中：

- `t_current` 是距离 `t` 最近、且采样偏差不超过当前样本容忍值的快照；
- `t_old` 是距离 `t - 24h` 最近、且偏差不超过历史样本容忍值的快照；
- 建议采样频率为 1 小时；可先建议“当前样本 ±15 分钟、历史样本 ±60 分钟”，但这是产品参数，需要用户确认；
- 原始净增可以为负数，因为取消加星是真实变化；排名分数可对负数取 0，但呈现和审计不能篡改原始值；
- 同理，`delta_fork_24h` 也只能由累计 forks 的两个快照得到。

第一天没有满 24 小时的历史快照时，应显示“24h 净增不可用”。可以使用“最近创建 + 当前累计 stars + pushed/release 新鲜度”做**冷启动代理热度**，但必须单独标注，不能伪装成 24h 增量。

这套方法得到的是两个采样点之间的**净变化**，不是 24 小时内全部加星动作总数。如果期间有人加星后又取消，二者会抵消；这是有意且可验证的定义。

## 4. 认证、限额、条件请求、缓存与再分发

### 4.1 认证与限额

根据 [REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)：

- 未认证公共请求通常为 60 次/小时，按来源 IP 计算；
- 认证用户通常为 5,000 次/小时；
- GitHub App installation 通常从 5,000 次/小时起，并按组织/仓库规模扩展，非 Enterprise Cloud installation 的上限通常为 12,500 次/小时；
- REST/GraphQL 共享“不超过 100 个并发请求”的 secondary limit；REST endpoint 通常还受每分钟 900 secondary points 限制，GraphQL endpoint 为每分钟 2,000 secondary points；
- 还有 CPU 时间、高成本行为和未公开的 secondary limit；不能只盯 `x-ratelimit-remaining`；
- 403/429 时必须遵守 `retry-after` 或 reset 时间，随后指数退避；反复无视可能导致集成被禁用。

Search 有单独的分钟级限制；GraphQL 也有独立点数和节点成本。V1 应顺序化/限并发执行，先 Search 发现候选，再只为候选和观察名单做详情与快照，不能每小时扫描 GitHub 全站。

[GraphQL rate/query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)的当前主要边界是：普通用户通常为每小时 5,000 points，非 Enterprise Cloud 的 GitHub App installation 从每小时 5,000 points 起并最多扩展到 12,500；每个 connection 的 `first` / `last` 必须为 1–100；单次调用不能请求超过 500,000 个总 nodes；处理超过 10 秒会超时。查询还可能因资源上限只返回 partial results，所以同样要保存 errors/completeness，不能把 partial response 当完整数据。

认证建议：

- 单人私用原型：fine-grained personal access token，最小权限、设置过期；
- 后端长期服务或多用户：GitHub App，安装范围和权限最小化；
- token 只能在服务端 secret store，不能打进 Android APK、日报或日志。参见 GitHub 的[凭据安全指南](https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure)。

请求应显式发送 `Accept: application/vnd.github+json`、有效 `User-Agent`，并固定 `X-GitHub-Api-Version`；GitHub 对版本支持周期的说明见 [API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions)。

### 4.2 条件请求和缓存

GitHub 的 [REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)建议：

- 保存 `ETag` 或 `Last-Modified`，后续发送 `If-None-Match` / `If-Modified-Since`；
- 合法认证的条件请求若返回 `304 Not Modified`，通常不消耗 primary rate limit；
- 能用 webhook 时优先 webhook；对任意外部公共仓库没有安装权限，所以这里仍需受控轮询。

推荐保存最小审计缓存：

- GitHub node ID、当前名称和 URL；
- 累计 stars/forks 与 `sampled_at`；
- ETag、API 版本、HTTP 状态、来源 endpoint；
- 仅为评分所需的分类、状态、Release/安全事件元数据。

GitHub 官方文档没有为所有公共仓库元数据给出一个统一、永久的缓存保留期。产品需要自行确定快照保留期和删除政策；遇到 404、451、删除、转私有或禁用时，应停止发布并按政策清理/封存，不要让陈旧缓存继续对外曝光。

### 4.3 二次分发边界

GitHub [Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)区分了 GitHub 服务自身的权利与用户上传内容的权利：内容所有者保留其权利，公开仓库内容的额外使用权通常由仓库许可证决定；GitHub 自身 HTML/CSS/JavaScript/视觉设计也不是可自由复制的公共素材。API 条款还明确反对共享 token 绕过限额、以 spam 为目的使用数据，以及某些高吞吐或转售式使用。

因此 V1 的保守输出边界是：

- 可重发：仓库名称、计数、时间、topic/language 等必要元数据，原始 GitHub URL，Observer 自写摘要和评分解释；
- 不默认重发：完整 README、源码、Release body、用户头像/个人资料、Trending 页 HTML/UI；
- 不保存 stargazer 身份列表；本产品只需要聚合计数；
- 公开、商业、多租户、收费或大规模转售前，应让法律/合规基于具体商业模式和仓库许可证复核。

## 5. archived、fork、mirror、template、spam 与恶意仓库

### 5.1 V1 硬过滤

进入排名前重新读取仓库详情，并要求：

- visibility 为 public；
- `archived=false`；
- `disabled=false`；
- `fork=false`；
- `mirror_url=null` / `isMirror=false`；
- `is_template=false`；
- 仓库仍可访问。

Search 层可使用 `archived:false mirror:false template:false`，fork 默认排除；详情层必须再次校验。是否把这些项目放进独立“归档/生态复刻观察”栏目是后续产品决策，不能和原创活跃项目混排。

### 5.2 spam/刷星与恶意内容没有一个可依赖的公开总开关

当前 REST/GraphQL 仓库 schema 没有文档化的通用 `is_spam` 或 `is_malicious` 布尔字段。因此：

- `viewerContentWarning` 只能作为风险信号，不等于最终判定；
- Global Advisory 的 `type=malware`、明确匹配的 `source_code_location` 或 repository advisory 可触发隔离/警告；
- disabled、不可访问、法律限制响应应直接阻断发布；
- 短时间异常 star 峰值、仓库/账号过新、缺许可证、低代码量等都只能是启发式信号，不能宣称仓库“作弊”或“恶意”；
- V1 不 clone、不 build、不运行候选源码，不抓取候选提供的二进制，不自动访问 README 中的任意外链。

GitHub [Acceptable Use Policies](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies)明确禁止包括自动化 starring 在内的排名操纵，因此 stars 是可被攻击的流行度信号，不是安全或质量背书。评分应限制单一 star 指标的支配力，并加入 forks、开发活动、Release 等佐证；高风险项进入人工复核或单独警报区。

## 6. 历史已报道项目的降权与事件升权

### 6.1 必须持久化的字段

| 域 | 最小字段 |
|---|---|
| 身份 | `repository_node_id`（主键）、REST numeric ID、`full_name`、`html_url` |
| 当前状态 | visibility、archived、disabled、fork、mirror、template、content warning |
| 分类 | language、topics、license、`created_at`、`pushed_at`、`updated_at` |
| 快照 | `sampled_at`、star count、fork count、ETag、API version、HTTP status、采样偏差、完整性 |
| 报道历史 | `first_seen_at`、`last_seen_at`、`last_reported_at`、7/30/90 天报道次数、上次报道理由、上次 star count、`cooldown_until` |
| Release | release ID/node ID、tag、draft、prerelease、`created_at`、`published_at`、`last_reported_release_id` |
| 安全事件 | GHSA/CVE、type、severity、published/updated/withdrawn、映射证据、上次已报道 revision |
| 升权去重 | `last_repromotion_event_id`、event type、event revision、promoted_at |
| 审计 | query/分片、cutoff、`total_count`、`incomplete_results`、重试、评分版本 |

### 6.2 三种降权方案，留给产品选择

**A. 硬冷却期**

- 报道后 `D` 天内不再进入普通榜；
- 只有新的重大 Release 或新的/重大更新安全事件能绕过；
- 最易解释和测试，但可能错过爆发式二次增长。

**B. 平滑恢复**

示例：

`novelty_multiplier = min(1, days_since_last_report / recovery_days) / sqrt(1 + report_count_90d)`

- 近期报道越多，分数越低；
- 随时间恢复；
- 比硬排除柔和，但参数更影响结果。

**C. 新颖性配额**

- Top N 中至少 K 个从未报道项目；
- 其余按普通分数；
- 能保证发现性，但会让榜尾项目的绝对热度不可直接比较。

**推荐拿来验证的 V1 假设，不替用户拍板：**

- 7 天硬冷却；
- 冷却后 30 天线性恢复，再除以报道频率惩罚；
- 同一期至少一半位置留给过去 30 天未报道项目；
- Release/GHSA override 后仍保留较小重复惩罚，并展示“因何重新入榜”。

### 6.3 可以绕过冷却的事件

**重大 Release**

- release ID 必须是此前未报道的新 ID；
- 默认排除 draft 和 prerelease；
- 若项目明确遵循 SemVer，可把 major version 作为强信号；
- 不遵循 SemVer 时，需要从官方 Release 元数据/说明得到 breaking、major、stable 等证据，或进入人工复核，不能仅凭 tag 字符串猜测。

**重大安全事件**

- 新 GHSA，或现有 GHSA 在上次报道后发生实质更新；
- 必须通过 `source_code_location`、`repository_advisory_url` 或其他官方字段明确映射到仓库；
- 默认候选阈值可提议 high/critical 或 malware，但严重性阈值、是否把“安全警报”混入“热门推荐”必须由用户决定；
- `withdrawn_at` 非空时停止升权并可发布更正。

同一 release ID 或同一 GHSA revision 只能绕过一次。每日仍活跃的同一事件不能连续刷新冷却期。

“24h star 增量位于同 cohort 极高分位”是否也能绕过冷却，是独立产品决策；如果允许，应设置更高阈值并标注“异常动量重新入榜”，避免老项目永久霸榜。

## 7. 推荐一个可测试的 V1 定义

### 7.1 候选宇宙

仅处理 public repository metadata，候选由四个池组成：

1. **新项目池**：`created` 在最近 7 天，按当前 stars 降序发现；
2. **活跃项目池**：`pushed` 在最近 3 天且累计 stars 达到最小阈值，按当前 stars 降序发现；
3. **观察/历史池**：曾进入候选或被报道的仓库，继续做小时快照，以捕捉 24h 动量和再爆发；
4. **事件池**：对候选/观察池轮询稳定 Releases；通过 Global/Repository Advisories 发现明确映射的安全事件。Public `ReleaseEvent` 只作为补充线索。

所有大查询按时间、语言/topic、stars 区间切成不超过 1,000 可取回结果的分片。

### 7.2 资格和分数

先执行第 5 节硬过滤；满 24 小时数据后，再按语言与仓库年龄 cohort 计算稳健分位，避免大语言生态和成熟项目只靠累计基数垄断：

`momentum = 0.70 × pct(log1p(max(delta_star_24h, 0))) + 0.15 × pct(log1p(max(delta_fork_24h, 0))) + 0.15 × activity_bonus`

`final_score = momentum × novelty_multiplier`

其中：

- `pct` 是同 cohort 内的稳健百分位；
- `activity_bonus` 是预先固定、可解释的类别分，例如“7 天内创建”“72 小时内 pushed”“新稳定 Release”；
- 原始负增量保留，只有进入分数时取 0；
- 分数相同以 repository node ID 做确定性 tie-break；
- Release/GHSA 事件升权先通过资格规则，再应用一次性 override，不覆盖原始 momentum。

这些权重只是首轮可测假设，必须通过回放数据比较“新颖性、重复率、噪音率、人工满意度”后再调，不应冒充 GitHub 官方算法。

### 7.3 每个榜单项的最小输出

- 仓库名、原始 GitHub URL、语言/topics；
- 当前 stars/forks；
- 24h star/fork **净变化**与两个实际快照时间；
- 数据完整性和采样偏差；
- created/pushed 时间；
- 新 Release 或 GHSA 的原始链接与触发理由；
- 上次报道日期、近 30/90 天报道次数和降权/升权原因；
- 风险/过滤提示；
- 最终分数及各分量；
- Observer 方法声明，不出现“官方 GitHub Trending 排名”字样。

日报级审计信息还应包含：cutoff、API version、评分版本、所有 query/分片、`total_count`、`incomplete_results`、重试与降级状态。

### 7.4 验收和测试

V1 至少覆盖以下自动化用例：

1. archived/fork/mirror/template/disabled fixture 全部被硬过滤；
2. 仓库 rename/transfer 后 node ID 不变，报道历史仍命中；
3. 快照差正确计算正、零、负 star 增量；
4. 缺失 24h 旧样本时显示 unavailable，绝不以累计 stars 或 WatchEvent 数冒充；
5. 当前/历史快照超出允许偏差时降级；
6. 搜索结果超过 1,000 时按规则分片；`incomplete_results=true` 重试后仍失败则停止或显式降级；
7. 7 天冷却、30 天恢复、报道频率惩罚均确定性复现；
8. 新 release ID 或新 GHSA revision 只升权一次；
9. withdrawn advisory 不升权；
10. 相同分数结果在重复运行中顺序一致；
11. ETag 304、primary/search/secondary 限额和退避可模拟；
12. 渲染器只输出允许的元数据、自写摘要和原始链接，不镜像 README/源码/UI；
13. 冷启动前 24 小时只显示“代理热度”，暖机后才显示“24h 净增”；
14. 任一期都能从保存的两个快照、查询记录和评分版本重算 Top N。

通过标准：

- 暖机 24 小时后，每个净增数字能追溯到两个有时间戳的累计计数；
- 榜内不存在硬过滤状态；
- 历史降权和 override 对相同输入输出完全一致；
- 同一 Release/GHSA 不会连续重复升权；
- API 部分结果不会被包装成完整全球排名；
- 输出不宣称官方 Trending，不执行候选代码。

## 8. 后续 grilling 必须让用户决定的问题

这些答案会改变数据、算法、成本或许可边界，不应由实现者暗自决定：

1. 产品是单人私用、团队内部，还是公开/商业/收费/转售？是否需要法务确认再分发方案？
2. 用户接受“Observer 自定义可审计热度榜”，还是必须追求与 GitHub Trending UI 一致？若后者，是否接受没有官方稳定 API、会随页面变化失效的事实？
3. Top N 是多少？需要哪些语言、topics、地区/时区和排除项？是否设置语言/topic 配额？
4. 更看重 7 天内新项目，还是成熟项目的二次爆发？`created 7d`、`pushed 3d`、最小 stars 门槛分别是多少？
5. “过去 24h”是否接受两个快照的净变化定义？小时采样、当前 ±15 分钟和历史 ±60 分钟是否足够？
6. 第一天没有 24h 数据时，是不发榜、只发代理热度，还是先预热后上线？
7. 历史降权选择硬冷却、平滑恢复、还是新颖性配额？7 天冷却、30 天恢复是否合适？
8. 同一期至少多少席位必须给从未报道或 30 天未报道项目？
9. “重大 Release”如何定义：SemVer major、稳定版、breaking change 文案、维护者标记，还是人工确认？
10. 安全事件是否进入热门榜，还是独立“安全警报”区？阈值是 high/critical，是否包含 malware？
11. 极端 star 动量能否绕过冷却？若能，阈值按绝对数还是同语言/年龄 cohort 分位？
12. 遇到 `incomplete_results`、限额耗尽或快照缺失，是停止整期、减少榜单，还是标记降级发布？
13. 对疑似刷星/恶意仓库是否强制人工复核？允许哪些可解释风险信号？
14. 快照、报道历史和事件 ID 保留多久？用户是否要求删除/导出机制？
15. 使用 PAT 还是 GitHub App？目标候选规模和小时请求预算是多少？
16. archived/forks/mirrors/templates 是彻底排除，还是放到单独观察栏目？

## 9. 尚未消除的不确定项与监控点

- GitHub 可能继续调整 stargazer endpoint 的授权行为；目前官方变更公告明确了收紧方向，但具体仓库/调用的返回可能是空结果或 403。实现必须把 403/空结果当作“不可用”，不能推断“没有 stars”。
- GitHub 没有公开 Trending 算法，无法验证 Observer 排名与官网 daily/weekly/monthly 数字同义。
- Search 是变化中的索引，不保证交易级一致快照；“全球完整覆盖”不可作为 V1 承诺。
- 官方 API 没有通用 spam/malware 最终判定字段；风险策略只能是过滤、佐证、隔离和人工复核。
- Release 的“重大”并非跨项目统一语义；SemVer 只适用于明确采用它的项目。
- GitHub 条款、API 版本、限额和访问政策都会变化。上线前和每次 API 版本升级时应重新核对官方文档；公开商业化还需针对实际分发内容做许可审查。
- GitHub repository metadata 没有可靠的“项目所属国家/地区”字段，因此该 Edition 不能声称按地理意义代表“世界范围”。

## 官方一手资料索引

- [GitHub Trending 页面](https://github.com/trending)
- [REST API OpenAPI description 说明](https://docs.github.com/en/rest/about-the-rest-api/about-the-openapi-description-for-the-rest-api)
- [GitHub 官方 REST API description 仓库](https://github.com/github/rest-api-description)
- [公开 GraphQL schema](https://docs.github.com/en/enterprise-cloud@latest/graphql/overview/public-schema)
- [Search REST API](https://docs.github.com/en/rest/search/search)
- [Repository search qualifiers](https://docs.github.com/en/search-github/searching-on-github/searching-for-repositories)
- [Repositories REST API](https://docs.github.com/en/rest/repos/repos)
- [Starring REST API](https://docs.github.com/en/rest/activity/starring)
- [2026 年 stargazer 访问限制公告](https://github.blog/changelog/2026-06-30-upcoming-access-restrictions-to-public-api-endpoints-and-ui-views/)
- [Public Events REST API](https://docs.github.com/en/rest/activity/events)
- [GitHub event types](https://docs.github.com/en/rest/using-the-rest-api/github-event-types)
- [Webhook event payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [Releases REST API](https://docs.github.com/en/rest/releases/releases)
- [Global Security Advisories REST API](https://docs.github.com/en/rest/security-advisories/global-advisories)
- [REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GraphQL rate/query limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)
- [REST best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
- [Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)
- [Acceptable Use Policies](https://docs.github.com/en/site-policy/acceptable-use-policies/github-acceptable-use-policies)
