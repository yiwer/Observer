# V1-03 审查与验收记录

状态：**本地实施验收通过**。2026-09-05 完成修复、新 SHA 双轴复审、独立冻结验收及 master 集成。仅验证标注替身和本地流程，不是生产准入；提交尚未 push。

- 范围：[GitHub #3](https://github.com/yiwer/Observer/issues/3)、[本地 ticket](../tickets/03-evidence-publication-gate.md)。
- 最终实施提交：`67401aca6bcc0cd943f0b3fb9257ac7e7288f214`，分支 `ticket/v1-03`，冻结后 clean。
- 集成提交：`a83cf2a08b8db8b9b960f059e2a3653cc01c3935`，master 集成后复跑通过且 clean。
- 最终比较：`git diff aa2a90fd5f72b225051bff6d52bea9114a96523f...67401aca6bcc0cd943f0b3fb9257ac7e7288f214`；7 文件，+778/-12。
- [首轮问题回写](https://github.com/yiwer/Observer/issues/3#issuecomment-5550234082)；下列首轮记录保留为历史，不代表最终状态。
- [最终验收回写](https://github.com/yiwer/Observer/issues/3#issuecomment-5550293271)，2026-09-05T07:28:58Z 关闭并读回 CLOSED。

## 首轮冻结基线与独立复跑（历史）

- 固定起点：aa2a90fd5f72b225051bff6d52bea9114a96523f。
- 首轮实施提交：4ae2b6a7c49e7805c8768d7c661a6256bfbafe03；`ticket/v1-03`，首轮冻结时 clean。
- 比较：`git diff aa2a90fd5f72b225051bff6d52bea9114a96523f...4ae2b6a7c49e7805c8768d7c661a6256bfbafe03`；7 文件，+609/-10。
- Root 独立 detached 工作区：`O:/GenesisCode/Observer-worktrees/accept-v1-03`，固定于上述首轮 SHA。
- Root 执行 `npm ci --ignore-scripts --no-audit --no-fund` 安装 7 个锁定包，`npm run check`（typecheck/build、46/46）和 `npm run smoke`（build、3/3）均通过；smoke 是 46 项的子集。固定 diff 检查通过，工作区 clean。
- 这些通过仅覆盖已有自动化用例。以下额外探测已证明仍有阻断，不能以测试计数宣布完成。

## Standards

独立 reviewer：`/root/review_v1_03_standards`，fresh context；未参与实施，未接收 Spec 报告。

1. **P2 · 硬违规，已实测：过期材料仍进入 Verifier。** `publication-gate.ts:11` 先调用 `verifier.verify`，后执行 `policyCheck`；Runner 前 TTL 检查不能覆盖 Runner 耗时。违反 PRD D6:205 的模型阶段政策执行与实施说明的“仅模型许可视图”。公开 seam probe 将时钟从 23:40 推到 23:42，材料 23:41 过期，Verifier 仍收到原文，之后才隔离。需在再次发送材料前复查 TTL，保留发布前检查。
2. **P3 · possible Duplicated Code，静态判断。** Gate 多分支重复构造 Claim 身份、摘要和结构/政策结果。建议收敛共同上下文和结果构造，降低字段遗漏风险；不是文档硬违规。

首轮本轴 2 项（1 硬、1 判断性 smell），最严重为 P2。Reviewer 独立执行 1 个本地 probe，未复跑全套；未修改文件。

**最终复审 @67401ac：原 2 项均关闭，剩余 0 项、新发现 0 项。** Verifier 发前独立检查 TTL，混合有效/过期材料保留正常路径；共同 `decide` 构造关闭重复逻辑建议。Reviewer 独立运行 10 个本地公开接口场景，覆盖正常、全过期、混合、待确认许可、旧记录、归档来源身份和未知上游组合；没有声称重跑全套或验证真实模型。

## Spec

独立 reviewer：`/root/review_v1_03_spec`，fresh context；未参与实施，未接收 Standards 报告。

1. **P1 · TTL 漏掉下一次模型输入及最终归档时刻。** PRD D6 要求模型和分发阶段执行政策，票要求过期候选不能直接发布。独立实测除上述 Verifier 输入边界外，还发现 `observer.ts:178` 判断后 `:189` 重新取发布时间；clock 前三次 23:40、第四次恰为过期时刻 23:41 时，归档 `publishedAtUtc === expiresAtUtc` 且仍 published。应在各模型边界复查，并让最终判定与归档使用同一完成时间。
2. **P2 · 冲突项没有可理解的争议内容与来源归因。** PRD D5 要求冲突展示归因、区间与未知；票要求解释清楚的 Unconfirmed Item 或缺口。双来源冲突实测正文只剩内部 Claim ID 和通用原因，没有主题、来源或链接；未通过候选的全部引用元数据被丢弃。应保留明确未确认的安全描述和许可引用；不要求本票实现原文冻结/replay。

首轮本轴 2 项，最严重为 P1。Reviewer 使用固定代码与临时 SQLite 做独立探测，未复跑全套、未修改工作区；未发现明确范围扩张。

**最终复审 @67401ac：原 2 项均关闭，剩余 0 项、新发现 0 项。** 原 TTL 复现已通过，最终门与归档共用一次完成时间；冲突正文包含明确待确认的安全说法及许可归因/链接，不升级为事实或标题。Reviewer 独立运行 20/20 Gate 测试和 10 个额外 probe，检查恶意内容、禁止许可及上游来源组合；ArchivedBundle v3 无明确范围扩张。

两轴汇总：Standards 剩余 0 项，无最严重未解决项；Spec 剩余 0 项，无最严重未解决项。Root 发现独立记录，不并入两轴排序或计数。

## Root 独立验收

**首轮阻断，最终已关闭：互相矛盾的语义回执仍会发布。** 在首轮冻结版本通过公开 `produce` → `readReport`，输入有效 primary 支持关系、`conclusion=supported`、`wording=original`，但 `reason` 分别为 `unsafe-material`、`irrelevant-evidence`、`source-conflict`、`insufficient-evidence`。四种均实际归档 published 并在正文显示事实；正常 `supported-by-evidence` 对照也发布。最终版本采用结论/理由一致性表，Root 重跑四种矛盾回执均隔离，正常对照仍发布。此发现单列，不并入或重排两轴报告。

Root probe 没有访问外部来源或模型，使用逐案临时 SQLite，结束后关闭并清理各自临时目录。没有删除用户数据或修改冻结代码。

Root 另做 24 个单调时钟场景（12 种 TTL × 两种 Runner 耗时）。首轮出现 13 次违规：12 次过期原文进入 Verifier、1 次过期事实发布；最终版本违规为 0，并保留 10 次合法发布。额外许可探测确认：许可待确认项可归档，来源撤销后重启读取 not-found；禁止分发或永久归档时不保留该待确认项及引用；归档均无 raw source body。

## 最终冻结与集成验证

Root 在 detached 工作区 `O:/GenesisCode/Observer-worktrees/accept-v1-03` 固定到最终 SHA，再在上述 master 集成提交复跑。两处均通过，工作区 clean。

| 检查 | 最终结果 |
|---|---|
| `npm ci --ignore-scripts --no-audit --no-fund` | 安装 7 个锁定包 |
| `npm run check` | typecheck、build、52/52 测试通过 |
| `npm run smoke` | build、3/3 本地进程测试通过 |
| 固定实施 diff 检查 | 通过 |

Smoke 是 52 项中的子集，不能合称 55 个不同测试。Windows、Node 24.18.0、npm 11.16.0；无外部模型调用。

| Ticket 条件 | 本地验收证据 |
|---|---|
| 具体事实与独立来源 | Claim→Evidence 支持关系；适当 primary 或两独立可靠来源；同上游及未知上游不虚增独立性 |
| 声明、分析、引语 | 归因与陈述类型独立；解释/情景标签；原文核查和翻译标识；Source 级原文加译文引文额度 |
| 三类判定分离 | structure/policy/semantic 分账；伪引用、无关材料、禁止政策、两次模型边界与最终 TTL 的失败路径 |
| 冲突与不足 | 安全且获许可的待确认说法、就近归因与支持/相反来源；固定原因、矛盾回执拒绝，无精确置信度字段 |
| 候选至归档正文 | 20 个新增 Gate 场景及原 32 个回归；正常事实/声明/分析/引语与恶意、伪独立负例 |
| 可替换语义核验 | 输入摘要、Evidence 身份、送核集合、逐 Claim 结论/理由和 provenance；只由 annotated-fixture 验证流程 |

## 后续契约与证据边界

详细实现和红绿记录见[实现说明](../../../implementation/v1-03.md)。ReportRecord v2 使用 ArchivedBundle v3，区分 fixture/collected origin，仅许可元数据归档，无原文及伪造的 fixture 政策/TTL；旧 ReportRecord v1 仍可读。研究输入 v1/v2 与归档 v3 不能混用。加入 Verifier 后旧 v1 候选不得绕过新门，生产装配仍禁用。

普通事实、声明、分析、引语的正常路径必须保留；不得以“全拒绝”或把全部未确认内容抹成通用缺口替代需求。恶意/许可禁止的内容仍不允许回显。真实语义质量、来源权利、模型调用、生产发布、部署及后续人工影子评测仍未验证。

输入摘要不等于原文冻结；缓存仍只保留最新修订，#15 负责持久冻结/replay。JSON 许可元数据仍是不可信内容，未来客户端必须安全呈现。Issue 关闭只表示上述本地实施验收，远程代码和生产状态没有因此改变。
