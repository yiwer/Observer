# V1-03 审查与验收记录

状态：**未验收，修复中**。GitHub #3 保持 OPEN；此记录不是生产准入或本地集成证明。

## 冻结基线与独立复跑

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

本轴 2 项（1 硬、1 判断性 smell），最严重为 P2。Reviewer 独立执行 1 个本地 probe，未复跑全套；未修改文件。

## Spec

独立 reviewer：`/root/review_v1_03_spec`，fresh context；未参与实施，未接收 Standards 报告。

1. **P1 · TTL 漏掉下一次模型输入及最终归档时刻。** PRD D6 要求模型和分发阶段执行政策，票要求过期候选不能直接发布。独立实测除上述 Verifier 输入边界外，还发现 `observer.ts:178` 判断后 `:189` 重新取发布时间；clock 前三次 23:40、第四次恰为过期时刻 23:41 时，归档 `publishedAtUtc === expiresAtUtc` 且仍 published。应在各模型边界复查，并让最终判定与归档使用同一完成时间。
2. **P2 · 冲突项没有可理解的争议内容与来源归因。** PRD D5 要求冲突展示归因、区间与未知；票要求解释清楚的 Unconfirmed Item 或缺口。双来源冲突实测正文只剩内部 Claim ID 和通用原因，没有主题、来源或链接；未通过候选的全部引用元数据被丢弃。应保留明确未确认的安全描述和许可引用；不要求本票实现原文冻结/replay。

本轴 2 项，最严重为 P1。Reviewer 使用固定代码与临时 SQLite 做独立探测，未复跑全套、未修改工作区；未发现明确范围扩张。

## Root 独立验收

**阻断：互相矛盾的语义回执仍会发布。** 在上述冻结版本通过公开 `produce` → `readReport`，输入有效 primary 支持关系、`conclusion=supported`、`wording=original`，但 `reason` 分别为 `unsafe-material`、`irrelevant-evidence`、`source-conflict`、`insufficient-evidence`。四种均实际归档 published 并在正文显示事实；正常 `supported-by-evidence` 对照也发布。需要明确结论/理由一致性规则，并拒绝矛盾回执，不能只采用有利结论。此发现单列，不并入或重排两轴报告。

Root probe 没有访问外部来源或模型，使用逐案临时 SQLite，结束后关闭并清理各自临时目录。没有删除用户数据或修改冻结代码。

## 下一步与证据边界

已将两轴及 Root 阻断完整交还实施 agent，允许从首轮冻结解冻修复。每项先复现红灯，再提交修复；新 SHA 必须重新冻结，复跑 check/smoke，分别复审并由 Root 再验收。未满足前不集成、不关闭 #3、不启动 #4 实施。

普通事实、声明、分析、引语的正常路径必须保留；不得以“全拒绝”或把全部未确认内容抹成通用缺口替代需求。恶意/许可禁止的内容仍不允许回显。真实语义质量、来源权利、模型调用、生产发布、部署及后续人工影子评测仍未验证。
