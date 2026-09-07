# V1-13 增量研究：GitHub 重新入榜事件与实质修订契约

研究日期：2026-09-06（UTC）。性质：实现前的事实与设计输入；本文件不自动采纳算法、批准来源或改变 PRD。

本报告由 Root 委派的 Research Agent 完成，已完整读取 research skill，以及 `CONTEXT.md`、V1-13 ticket、PRD D8/T1、ADR-0003 和既有三篇 GitHub 研究。开始时工作树为 `ticket/v1-13`，HEAD 为 `ec9b91c3e8575f7f3f3dc363d1d35ffb6319fce3`。本次只联网查阅官方文档、GitHub 官方定义及标准原始出处；未请求真实候选仓库 API、读取凭证、执行候选或项目代码。唯一写入为本报告。

## 1. 对实现最有影响的结论

- 稳定 Release 的分类和“重大进展”是两个判断。`draft=false`、`prerelease=false`、`latest` 或 `immutable=true` 都不能独立证明重大变更；tag 和 target 也不是不可变事件身份。证据和建议见第 3 节。
- GitHub 提供 GHSA 唯一标识与可编辑的公告内容，没有提供 Observer 所需的“实质修订序号”。同一 GHSA 的 global 和 repository 表示可以不同，不能按采集顺序相互覆盖。见第 4、6 节。
- 安全公告里的 repository URL 是明确关联线索，但不是已经核验的 repository node ID；包名、参考链接和依赖关系不能替代身份关联。缺失公告、缺少版本范围或 API 失败不能推断安全。见第 4 节。
- `updated_at` 可以用来发现变化，不能充当本地证据首次可用时间，也不能自动产生一次性升权。当前字段值不是历史修订日志。见第 6 节。
- 极端分位、最小样本、事件竞争与修订边界属于 Observer 的版本化设计。PRD 的至少一半新颖位置约束必须独立执行；完整 7 条至少需要 4 条过去 30 天未报道项目。见第 7 节。

## 2. 固定 schema 与核验方式

2026-09-06 对照当前官方 endpoint 文档，并无凭证读取以下官方版本化 JSON 到内存，直接核对 `required`、`properties` 和读路由，未把示例对象当成 schema：[固定官方定义][schema]、[原始 JSON][raw-schema]。

| 项目 | 已核验值 |
|---|---|
| source revision | `3cef12e8a02d612ad032473d4fb87266f2befeae` |
| source path | `descriptions/api.github.com/api.github.com.2026-03-10.json` |
| UTF-8 内容 SHA-256 | `0418E462C16E0D7C14DB3CC22DC8440D0566E710A43788946926727374CD8EAA` |
| 描述格式 / 描述文档版本 | OpenAPI `3.0.3` / `info.version=1.1.4` |
| 本报告对照的 API 日期版本 | `2026-03-10`；不是 `info.version` |
| 目标 components | `release`、`global-advisory`、`repository-advisory`、`vulnerability`、`repository-advisory-vulnerability`、`cvss-severities` |

路径 pointers 为 `#/paths/~1repos~1{owner}~1{repo}~1releases/get`、`#/paths/~1repos~1{owner}~1{repo}~1releases~1{release_id}/get`、`#/paths/~1advisories/get`、`#/paths/~1advisories~1{ghsa_id}/get`、`#/paths/~1repos~1{owner}~1{repo}~1security-advisories/get` 及其 `~1{ghsa_id}/get`。列表响应引用相应 component 数组，详情引用单个 component。

官方现行指南支持显式版本头；请求/证据应固定 `X-GitHub-Api-Version`、media type 和非秘密运行配置版本。旧版本的字段与当前网页示例不应混成一个契约。[API 版本][versions]

## 3. Release：对象身份、稳定分类与重大性

### 官方事实

Release 列表不包含没有关联 Release 的普通 Git tag；公开发布内容对所有人可见，有 push 权限的用户还能看到草稿。列表采用 `page`，默认每页 30、最多 100；按 release ID 取详情有正式路由。`latest` 文档描述按 `created_at` 判断，并说明该时间来自所用 commit，而不是 Release 起草或发布时刻；创建/编辑还支持维护者指定 latest。故 latest 只能用于定位，不能作为完整事件序列或重大性证明。[Releases REST][releases]

下表是固定 `release` component 的字段事实；“必需”指 JSON 字段存在，不代表值一定非空。[固定 schema][schema]

| 字段组 | 正式契约 | 对 Observer 的约束建议 |
|---|---|---|
| `id` / `node_id` | 必需 integer / string | 保存对象身份，并关联已核验的 repository node；不要用 URL、标题作主键 |
| `draft` / `prerelease` | 必需 boolean | 只有明确 false/false 才满足本项目稳定发布前提；类型错误或缺失不可补 false |
| `tag_name` / `target_commitish` | 必需 string | 保留来源原值，不能假定 target 是 SHA |
| `created_at` | 必需、非 nullable date-time string | 不充当本地 availableAt 或发布时间 |
| `published_at` | 必需、nullable date-time string | null 是合法协议值，但不足以证明本项目要求的已公开发布 |
| `updated_at` | 可省略、nullable date-time string | 不要求每个真实响应都有；缺失不伪造为 created/published |
| `immutable` | 可省略 boolean | 省略是未知，不是 false，也不是产品安全认证 |
| `name` / `body` | name 必需 nullable；body 可省略 nullable | 标题/说明可能缺失；正文采集、处理和留存须由来源政策单独允许 |

`target_commitish` 可为分支或 commit SHA；已有 tag 时该输入不决定已有 tag 的目标。Release 管理接口允许编辑 tag、target、标题、说明、草稿和预发布标记；维护者也能删除 Release。[创建/更新参数][releases]、[Release 管理][release-management]

`immutable=true` 的保护主要是 assets 与关联 tag。即使发布不可变 Release，标题、说明、prerelease/latest 标记仍可编辑；Release 可删除，相关 tag 的重用有额外限制。因此“不可变 Release”不等于“整条返回对象永不改变”，本票也不需要下载或验证资产来实现事件身份。[不可变 Release][immutable]

### 身份连续性的保证边界

Global node ID 是不透明对象标识，可作直接 node lookup；GitHub 也存在旧格式向新格式迁移，不能承诺字符串在所有未来 API 迁移中永不变化。仓库改名/转移存在重定向，但旧地址复用可能移除重定向。相关文档没有给本研究一个覆盖所有删除、重建、转移场景的“Release ID 永不重用/永远可解析”统一保证。[node lookup][nodes]、[ID 迁移][node-migration]、[改名][rename]、[转移][transfer]

**设计建议：** 以已有稳定仓库身份加 Release 对象 ID 记账，保存 node ID 和 numeric ID 的交叉证据。改名只更新定位信息；旧路径若返回其他 node，不继承事件历史。删除后重建同名项目、同 tag 重发或不同 Release ID 指向同一已报道重大进展，均不能仅凭“新 ID”判为新重大事件。缺乏内容/身份连续证据时保留冲突或待判定；不要猜测别名，也不要删除旧去重账本。

### 哪些证据才支持“重大”

本次核验的 `release` component 没有 `major`、`breaking` 或“重大变化已核验”的结构字段。`name/body` 是发布者填写或生成的说明内容，可支持“维护者声明了什么”，不能独立证明声明真实或让不可信文本决定 Observer 的规则。[固定 schema][schema]、[Release 管理][release-management]

SemVer 2.0.0 的 major 增长表示不兼容的公开 API 变化，但前提是项目采用并遵循该规范；`0.y.z` 仍属初期开发，build metadata 不决定版本优先级。GitHub 接收 tag 字符串不等于维护者声明遵循 SemVer。[SemVer 原始规范][semver]

**设计建议：** 将稳定发布分类、重大性评估、证据许可分开保存。可接受的重大性依据是已经合规保留的维护者公开声明/说明中的明确重大变化，或有项目版本约定证据与已知比较基线的 major 演进。一个 `v2.0.0`、标题中的 `major`、新 URL、新 ID、发布时间、正文哈希变化，都不足以单独完成判断。普通 patch/minor 更新默认不能重复绕过；例外需要具体新进展及评估身份。若当前来源只允许元数据而不允许所需说明内容，结果应是重大性证据不足，不静默扩大采集许可。

## 4. GHSA：关联、风险范围和独立表示

### 官方字段与可证程度

每个公告都有唯一 GHSA ID；CVE 是另一类标识，可能缺失。GitHub Advisory Database 汇集 GitHub 公告、其他漏洞数据库及社区贡献；reviewed 关注有效性和支持生态的包映射，unreviewed 与 malware 有不同来源/处理方式。这些都是上游声明或整理后的安全资料，不能据域名把它们全部当独立 corroboration。[Advisory Database][database]

固定 schema 中，global 的 `repository_advisory_url`、`source_code_location`、`vulnerabilities` 均必需但可为 null；没有 repository node ID 字段。repository 表示也没有可直接作为受影响目标的 repository node ID，且其 `private_fork` 是协作修复用临时私有 fork，不能当成受影响公共项目。[固定 schema][schema]

| 来源证据 | 可支持的结论 | 仍需满足的 Observer 约束 |
|---|---|---|
| 受控 repository advisory 路由及同 GHSA 返回 | 公告与该仓库路由明确关联 | 路由仓库需与本期已核 repository node 一致；改名/转移后重新验证映射 |
| global `repository_advisory_url` | 指向原 repository advisory 的明确来源字段 | 校验 HTTPS、官方 API origin、路径与 GHSA；地址身份须通过已有仓库证据落到 node |
| global `source_code_location` | 官方返回的源码位置声明 | 只接受明确可解析且有证据解析到目标 node 的仓库位置；外域、歧义、冲突或无法解析保留未知 |
| ecosystem + package name + version range | 公告所声明的受影响产品/版本范围 | 包名不必等于仓库名，可能有多包/多仓库；不能猜 repo，也不证明当前 HEAD 或所有安装都受影响 |
| `references[]` | 补充资料链接 | 引用目标、PoC、修复 PR、依赖仓库不是自动受影响主体；不自动访问外链或提升来源许可 |

表中字段语义来自 [global API][global] 和 [repository API][repository]；映射准入规则是落实 PRD“明确关联”的本项目建议，不是 GitHub 已验证过的 node 关联保证。多来源映射冲突必须可见，不能任选一个匹配项消除冲突。

### 严重性、影响范围与更新

正式 `global-advisory.severity` 为 critical/high/medium/low/unknown；repository severity 可 null 且 enum 不含 unknown。两者 `vulnerabilities` 可 null；每个受影响项的 package、版本范围、修复版本和函数信息也可能为 null。global 使用 `first_patched_version`，repository 使用 `patched_versions`，不能无损地假装两者是完全相同字段。[固定 schema][schema]

2026-03-10 这两个 component 均使用可选 `cvss_severities`，其 v3/v4 子对象及分数/向量可缺失或 null；本版本 component 没有旧 `cvss` 属性。分数保存版本和向量，不自动取多个版本的最大值或由未知分数补 severity。影响范围应保留包生态、包名、原始范围、修复信息、未知项及证据引用，不用一个数字代替。[固定 schema][schema]、[CVSS 支持说明][database]

GitHub 允许编辑已发布 repository advisory 的描述、受影响产品、修复版本、严重性和其他元数据；global 的改进走独立审核。官方明确：global 表示的编辑不会改变 repository 页中的公告内容。[编辑 repository advisory][edit-repository]、[编辑 global advisory][edit-global]、[两类公告权限差异][advisory-permissions]

**设计建议：** 同 GHSA 归一到一个事件，保存 `sourceRepresentation=global|repository` 与各自完整、截止前可用的版本。版本范围、severity 或状态冲突不能按最后采集者覆盖；也不能在两种表示之间来回切换制造“实质新修订”。固定选源/冲突规则，并保留变化前后的内容证据。

global 有 published/updated/reviewed/NVD published/withdrawn 时间，repository 还有 created/closed/state；它们表示不同生命周期。global published/updated 非 nullable；repository created/updated/published/closed/withdrawn 均允许 null。上游 updated 不是“实质更新”的官方判定。[固定 schema][schema]

**设计建议：** 高危/严重、未撤回、公开且明确关联只是风险更新候选条件。`withdrawn_at` 非空或 repository state=withdrawn 必须停止普通事件绕过，并交既有更正/撤回语义判定；不把撤回理解成代码已修好。缺少公告、数据未覆盖、scope 未知、请求失败都不能产生 safe 结论。malware 与普通漏洞不等价，默认 reviewed 请求还会漏掉 malware；未知风险继续隔离，不因为“风险更新”拥有安装推荐权。[global 默认过滤][global]、[malware 边界][database]

## 5. 读取权限、分页和失败不能混成业务事实

| GET 范围 | 官方鉴权说明 | 本票含义 |
|---|---|---|
| Release list/detail | fine-grained 的权限表列 Contents read；只请求公开资源时可无认证或上述权限 | 不需要给任意候选仓库写权限。[Releases][releases] |
| Global list/detail | fine-grained 不要求额外 permission，公开资源可匿名读取 | 适合作为公开公告发现入口，但仍服从限额和来源政策。[Global][global] |
| Repository list/detail | fine-grained 表列 Repository security advisories read；单条正文明确任何人可访问公共仓库已发布公告 | 列表没有与 Release 一样明确的匿名例外表述；不能仅靠单条说明保证列表对任意 token/仓库组合的运行行为。[Repository][repository] |

PAT 官方指南说明 fine-grained token 包含全部公共仓库只读访问。建议维持 D8 已批准的服务端、明确到期、最小只读 PAT；不为读取私有或未发布公告申请管理权限，也不调用要求 organization owner/security manager 的组织公告列表。真实权限组合仍需外部接入验收；本报告没有尝试凭证或自动变更认证方式。[PAT 指南][pat]、[Repository API][repository]

Release 用 page；global/repository advisory 用 `before/after` cursor。目标列表默认 30、schema 最大 100。跟随经过允许列表验证的 `Link rel=next`，不要自行猜 cursor；没有 last 不能等同于没有下一页。查询、页/游标、API 版本、响应完成时间、next、主动 cap、未抓页及故障均进入证据。[分页指南][pagination]、[固定 schema][schema]

global 可按 published/updated/modified 和类型过滤；默认 type=reviewed，默认不返回 malware。对已报道 GHSA 仅轮询 high/critical 列表可能漏掉降级或撤回，建议另按已知 GHSA 获取当前表示，记录 bounded 覆盖范围。所有方案都不能承诺全球全集；分页过程中条目变动也可能改变页面内容。[Global 参数][global]、[稳定分页请求][best-practices]

GitHub 建议 ETag/Last-Modified 条件 GET；正确认证得到 304 可免 primary 消耗，但只证明所请求表示未变。不能用某页的 304 证明整个列表完整或另一表示未变。保留旧 body、匹配的资源/版本/查询/认证上下文与新确认时间；304 不刷新原始内容抓取时间，不续来源 TTL，也不创建新事件修订。[条件请求][best-practices]

匿名普通 REST 通常 60 次/小时，认证用户通常 5,000 次/小时，另有 secondary limits。Primary/secondary 都可能 403/429；按 Retry-After/reset 等响应证据做有界退避。401、权限 403、404、验证 400/422、限额、5xx、网络/解析失败分开保存；404 也可隐藏未授权私有资源，不能断言已删除或“没有安全事件”。若退避后超出 cutoff，记录本期缺口，不能把恢复结果倒灌。[Rate limits][rate]、[故障与退避][troubleshooting]

固定 OpenAPI 的目标 GET 状态清单分别是：Release list 200/404，Release detail 200/401；global list 200/429/422、detail 200/404；repository list 200/400/404、detail 200/403/404。此清单不是通用认证、网关和服务故障的穷尽表。[固定 schema][schema]

GitHub Advisory Database 官方仓库声明 CC-BY-4.0；其署名、来源链接、许可证及修改标识要求应被来源策略具体落实。这个许可不能扩大为“所有仓库公告、Release、外链或源码都获同一许可”。GitHub API 可读性和服务条款也不自动批准 Observer 的采集、模型处理、留存与分发。[Database README][database-repo]、[Database LICENSE][database-license]、[CC-BY-4.0 原文][cc-by]、[GitHub 条款][terms]

## 6. 首次事件、实质修订和 cutoff 的确定性设计建议

本节是 Observer 设计建议，GitHub API 没有提供下表中的本地业务状态。依据是 PRD D8/T1 的事件去重、成功出版记账与因果冻结要求。

| 层次 | 建议保存的身份/证据 | 不可作为替代 |
|---|---|---|
| 上游事件 | 已核 repository node + Release ID，或 repository node + GHSA；附上游 node/numeric ID、表示类型与原始链接 | 仓库名、标题、抓取日期、普通 URL、单独 CVE |
| 每次观察 | 稳定 observation ID、选定字段/许可内内容摘要、HTTP/分页/策略证据、receivedAt、availableAt | 仅上游 updated 时间 |
| 实质修订 | versioned materiality rule + 具体新进展身份 + 规范化相关字段 + 旧/新证据引用 | 整个 JSON/body 哈希、ETag、文本长度、updated 或评估器临时 UUID |
| 资格判断 | stable/high-critical/exceptional 的可重算输入，风险与完整性，接受/拒绝原因 | 候选抓取成功或 Research Agent 自称重大 |
| 成功使用 | publication/report version、repository/event/material-revision key、成功提交时间 | 采集、候选生成、排序、预览、失败发布、邮件重试 |

建议将 `contentDigest` 与 `materialRevisionId` 分开。字段顺序、数组顺序、空白、标题/署名、引用顺序、名称地址变化、上游更新时间变化仅能改变观测；不能自动刷新已消费资格。缺失、null、空列表与有效值保持区别；包名大小写、版本范围和生态版本排序不能在无对应规范时随意归一化。

安全事件的实质修订可候选为：新增明确受影响产品/范围、严重性跨越已固定的重要阈值、明确新增修复或缓解、已核影响方式出现实质变化。每项仍需要具体 diff、证据与规则判断；范围仅重新排版或 credits 变化不通过。撤回走风险更正逻辑。Release 实质修订同样必须指出此前未报道的具体重大变化，不能因编辑说明或切换 prerelease 再次消费已报道同一进展。

同 GHSA 重放、global/repository 相同内容、A→B→A 内容回退、Release 删除重发同一进展，都应查全量已报道 development/revision 历史，而非只比较 lastRevision。若相同上游时间产生冲突内容，保留冲突；若新的有效观察重现旧已报道修订，不再次绕过。相关来源本身允许编辑，不能假装 API 是不可变历史账本。[公告编辑事实][edit-repository]、[独立 global 表示][advisory-permissions]

建议对一份原子输入冻结：原始允许字段、仓库映射、materiality 评估、publication history 和规则版本都需要 `availableAt <= cutoff`。`availableAt` 不早于完整接收、验证并持久化可读取的时刻；Source published/updated 是内容描述时间，不是本地可用性凭证。这沿用既有 `github-api-contract-2026-09-06.md` 的 D8 因果边界。

| 回放输入 | 应观察到的业务结果 |
|---|---|
| 上游 07:20 更新，本地 07:31 才可用，cutoff 07:30 | 不进入当期；不得按 updated 回填 |
| Release 07:25 可用，但重大性证据/评估到 07:31 才可用 | 不产生当期绕过资格 |
| 07:31 收到 304，body 来自昨天 | 不用未来确认改写当期可用性 |
| 同事件同修订重复采集或编排 | 审计可追踪但只保留一次成功消费 |
| 已入选但出版失败，之后同输入重试 | 未成功消费；重试可继续评估 |
| 出版成功后重启、重复运行或投递重试 | 消费账本连续，不再绕过 |
| 实质新修订在 cutoff 前已可用 | 新判断独立留下理由，仍受质量、风险和新颖配额约束 |

## 7. 极端动量与配额：需要项目独立冻结的选择

ADR-0003 已选择 Observer 自定义 Heat，现有官方 API 元数据及上述 Release/GHSA 契约没有定义 Observer 的极端分位、最小样本、episode 身份或配额算法。公开 Trending 页面也不构成本票的算法规格。既有 `github-trending-edition.md` 的示例权重和阈值不能直接变成首版常量。

建议版本化决定并固定回放：使用哪一类有效 24h 净增或综合分数、分位算法与 tie 处理、是否要求严格正净增/绝对最低量、cohort 定义与去重后的最小样本、缺样/冷启动/截断是否排除、进入阈值与退出阈值、同一爆发持续多期时的事件区间、退出多久才允许新 episode、与 Release/GHSA 同时出现时的选择和消费方式。

这些阈值不能从“百分位高”推出可靠性：同 cohort 只有一个仓库时可以名义排名第一；全部零增长也可能通过处理不当的最高百分位。固定小样本样本集、并列、零/负、跨期未退出、退出再增长、缺样恢复与未来快照用例，才能说明具体首版规则。建议完整暖机样本才产生异常动量资格；冷启动或不完整样本显式受限，不包装为已测量的极端再次增长。

配额来自 PRD，不来自 GitHub：完整 7 个位置至少 4 个过去 30 天未报道项目，最多 3 个近期已报道项目；Release/GHSA/动量绕过只改变重复衰减资格，不能把最近已报道项目重标为新颖。如果最终缩为 n 条，实际新颖数仍须满足 `>= ceil(n/2)`；质量不足则减少数量，并说明不足，不能把目标从 7 改成另一个数字来躲避约束。

建议冲突优先级写入规格：当前来源许可/身份/风险与质量门槛 → 新颖性约束 → 可用的普通/事件竞争规则 → 确定性 tie-break。事件可候选不等于保证入选；多个事件争一个仓库位置时，明确报道了哪些具体进展，只消费正文实际成功报道的事件修订。完整 7 条要求 4 个新颖项目的边界不能被任何 boost 覆盖。

## 8. 尚需实现与验收解决的边界

| 边界 | 本次状态 / 后续所需证据 |
|---|---|
| 官方字段、修改语义和公开读取文档 | 已核验当前文档及固定 schema；协议升级重新核对 |
| 首版 major/material revision/极端动量/事件竞争规则 | 本报告给出可审计约束，未替 Root 采纳常量；由版本化技术规格和固定回放证明 |
| 明确 repository node 关联 | 需要实现复用现有身份验证链，回放改名、转移、旧路径复用、冲突和缺失；官方 URL 不是本地 node 证明 |
| Repo advisories 列表公开访问和实际 token 权限 | 未请求真实 API、未验证最小 PAT；不得将文档调查算作真实接入通过 |
| Global/repository 修订不同步 | 需要固定选源/冲突规则，回放交替来源、冲突、回退和重复消费 |
| 撤回/降级/消失的持续监测 | 需要明确已报道 ID 的 bounded 重查；仅采 high/critical 增量不足以证明完整变化 |
| 发布与消费事务一致性 | 需要跨期、失败重试、重启和并发/重复编排的业务集成证据；不能靠内存 set 或内部调用次数证明 |
| 来源许可和成稿表达 | 未获本报告自动批准；安全影响范围、风险更新标签、数据限制和少选理由须在正文可见 |
| 实测证据类别 | 固定 fixtures、真实外部接入与人工成稿检查必须分别报告；本研究没有运行其中任何验收 |

所有设计建议均保持 V1-13 边界：只扩展已有 GitHub 选择闭环，不建立安全扫描器、不执行候选、不引入真实模型/邮件/部署流程；不修改已批准的至少一半新颖位置语义。

[schema]: https://github.com/github/rest-api-description/blob/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json
[raw-schema]: https://raw.githubusercontent.com/github/rest-api-description/3cef12e8a02d612ad032473d4fb87266f2befeae/descriptions/api.github.com/api.github.com.2026-03-10.json
[versions]: https://docs.github.com/en/rest/about-the-rest-api/api-versions
[releases]: https://docs.github.com/en/rest/releases/releases
[release-management]: https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository
[immutable]: https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases
[semver]: https://semver.org/spec/v2.0.0.html
[nodes]: https://docs.github.com/en/graphql/guides/using-global-node-ids
[node-migration]: https://docs.github.com/en/graphql/guides/migrating-graphql-global-node-ids
[rename]: https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository
[transfer]: https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository
[global]: https://docs.github.com/en/rest/security-advisories/global-advisories
[repository]: https://docs.github.com/en/rest/security-advisories/repository-advisories
[database]: https://docs.github.com/en/code-security/concepts/vulnerability-reporting-and-management/github-advisory-database
[edit-repository]: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/edit-repository-advisories
[edit-global]: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/fix-reported-vulnerabilities/edit-advisory-database
[advisory-permissions]: https://docs.github.com/en/code-security/reference/permissions/repository-security-advisory
[pat]: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
[pagination]: https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api
[best-practices]: https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
[rate]: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
[troubleshooting]: https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api
[database-repo]: https://github.com/github/advisory-database/blob/main/README.md
[database-license]: https://github.com/github/advisory-database/blob/main/LICENSE.md
[cc-by]: https://creativecommons.org/licenses/by/4.0/legalcode.en
[terms]: https://docs.github.com/en/site-policy/github-terms/github-terms-of-service
