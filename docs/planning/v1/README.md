# Observer V1 ticket 执行清单

日期：2026-09-05。状态：**已发布 28 张 GitHub Issues（#1–#28），39 条原生 blocking 关系已读回验证；未开始实现**。

已确认 28 张：25 张计划在独立 fresh context 完成的开发票，另有真实接入验收、影子评测启动和最终资格审核各 1 张。每张都交付可验证的业务路径；V1 无客户端 UI，因此“纵向”贯穿该能力实际涉及的输入、状态、处理、私有读取/交付与测试，不虚造前端工作。

当前依据为基线提交 `c104ef7` 的 [PRD](../../PRD.md)、[需求基线](../../requirements-baseline.md)、[领域词汇](../../../CONTEXT.md) 及相关 ADR。仓库尚无产品代码，无需单列 prefactor。本文是已确认的执行拆分，不覆盖产品需求，也不把研究示例参数升级为已批准常量。

## 执行入口

- 当前实施与验收进度：[EXECUTION](EXECUTION.md)。Owner 已授权按票逐个实施、提交和 orchestrator 验收。

- 查看颗粒度与依赖：本页下方 28 项，每项链接到本地票体与真实 GitHub Issue。
- 交给下一轮 orchestrator：[HANDOFF](HANDOFF.md)。
- 需要程序读取依赖、覆盖、真实 Issue 编号与外部门槛：[manifest](manifest.json)。发布已核验，后续执行状态以实际 tracker 为准。
- PRD T1 的“整期业务集成边界 + 少量外部契约测试”已随票拆分获 Owner 确认。真实模型质量、PDF 人工视觉、真实邮件、灾备分别验收。

## 编号拆分

V1-xx 为稳定规划 ID，右侧 #xx 链接为本次真实 GitHub Issue 编号；本次数字恰好一致，不应假定以后仍一致。Blocked by 只表示必须先完成的票，不表示行号顺序必须串行。

1. [V1-01 — 最小私有日报闭环与共享契约](tickets/01-private-brief-spine.md) · [#1](https://github.com/yiwer/Observer/issues/1)
   - Blocked by：无（获得实现指令后可开始）。
   - 交付：用固定 Evidence 和替身 Agent 生成一条有来源的故事，保存 Report Record 与 Canonical Markdown，并由已鉴权的 Owner 读取不可变版本。其余 Edition 明确为空缺，先建立可以贯穿后续能力的最小闭环。

2. [V1-02 — 受来源政策约束的持续采集](tickets/02-policy-bound-collection.md) · [#2](https://github.com/yiwer/Observer/issues/2)
   - Blocked by：V1-01。
   - 交付：Owner 通过审阅过的来源配置接入一个 RSS/Atom 来源，从持续采集到可供研究使用的 Evidence Bundle 全程执行 Source Policy，并能看见来源缺口与待审 Source Proposal。

3. [V1-03 — 陈述级证据核验与 Publication Gate](tickets/03-evidence-publication-gate.md) · [#3](https://github.com/yiwer/Observer/issues/3)
   - Blocked by：V1-02。
   - 交付：将 Agent 候选逐条核验为可发布、待确认或隔离项，使 Owner 读到的事实、发布者声明和分析具有不同语义及就近证据，而不只是一份通过 JSON Schema 的文本。

4. [V1-04 — Codex 单栏研究到受控候选输出](tickets/04-codex-runner.md) · [#4](https://github.com/yiwer/Observer/issues/4)
   - Blocked by：V1-03。
   - 交付：同一栏目的 Evidence Bundle 经 Codex 非交互子进程返回可核验候选；只有完整成功终态的结构化结果才能进入 Publication Gate。

5. [V1-05 — Claude 单栏研究到受控候选输出](tickets/05-claude-runner.md) · [#5](https://github.com/yiwer/Observer/issues/5)
   - Blocked by：V1-03。
   - 交付：同一栏目的 Evidence Bundle 经 Claude 非交互子进程返回可核验候选，与 Codex 对业务层暴露相同成功、失败和用量契约。

6. [V1-06 — 六栏编排、Today Overview 与唯一正文](tickets/06-six-edition-canonical-brief.md) · [#6](https://github.com/yiwer/Observer/issues/6)
   - Blocked by：V1-03。
   - 交付：将通过核验的候选组成六个 Edition 和 Today Overview，生成唯一版本化 Canonical Markdown；有证据不足的栏目时仍可得到结构完整、缺口清楚的私有日报。

7. [V1-07 — Event Cluster、跨栏去重与跨日报更新](tickets/07-event-history-and-updates.md) · [#7](https://github.com/yiwer/Observer/issues/7)
   - Blocked by：V1-06。
   - 交付：同一事件只在主 Edition 完整展开，其他栏看到不占配额的 Impact Note；跨天只重新报道实质新进展，重大漏采旧闻显示补报。

8. [V1-08 — 可版本化兴趣配置与全球覆盖底线](tickets/08-explicit-interest-and-global-coverage.md) · [#8](https://github.com/yiwer/Observer/issues/8)
   - Blocked by：V1-07。
   - 交付：Owner 编辑和导入导出配置后，下一次日报按明确偏好选题，同时重大 Global Baseline 事件仍有入选资格，实际语言和地域缺口可见。

9. [V1-09 — 高风险新闻与 AI／科技证据标签](tickets/09-domain-evidence-rules.md) · [#9](https://github.com/yiwer/Observer/issues/9)
   - Blocked by：V1-06。
   - 交付：世界要闻、财经、AI 和科技前沿在共同流水线上采用相应证据门，让高风险断言降级为合适归因或待确认，并准确呈现研究成熟度。

10. [V1-10 — 合规社交样本到话语观察 Edition](tickets/10-social-discourse-edition.md) · [#10](https://github.com/yiwer/Observer/issues/10)
   - Blocked by：V1-07。
   - 交付：将一个获准平台的样本转为故事关联讨论和平台原生信号，或在没有合规来源时明确交付 Coverage Gap，始终披露观察边界。

11. [V1-11 — GitHub 候选、稳定身份与真实快照增量](tickets/11-github-snapshot-observations.md) · [#11](https://github.com/yiwer/Observer/issues/11)
   - Blocked by：V1-06。
   - 交付：利用官方允许元数据发现候选、按稳定仓库身份采集快照，并在 GitHub Edition 中呈现真实 24h 净变化、冷启动或缺样状态。

12. [V1-12 — Observer GitHub Heat 与历史报道降权](tickets/12-github-heat-and-novelty.md) · [#12](https://github.com/yiwer/Observer/issues/12)
   - Blocked by：V1-08、V1-11。
   - 交付：GitHub Edition 根据可解释的动量、新颖性与报道历史选出项目，让新项目和成熟项目新动量都有机会出现，并可重算已发布排序。

13. [V1-13 — GitHub 重大进展一次性重新入榜](tickets/13-github-repromotion-events.md) · [#13](https://github.com/yiwer/Observer/issues/13)
   - Blocked by：V1-12。
   - 交付：已经报道的项目在重大稳定 Release、安全事件或极端新动量出现时可以一次绕过普通降权，并在 Edition 中显示新进展及风险标签。

14. [V1-14 — 双 Provider 路由、复核与有界降级](tickets/14-provider-routing-and-review.md) · [#14](https://github.com/yiwer/Observer/issues/14)
   - Blocked by：V1-04、V1-05、V1-09。
   - 交付：一次 Edition 研究选择一个主 Provider，按明确条件触发另一 Provider 的复核或故障替代；无可用 Provider 时返回可解释失败，交由出版流程降级。

15. [V1-15 — 07:30 冻结到 08:30 原子发布](tickets/15-scheduled-cutoff-publication.md) · [#15](https://github.com/yiwer/Observer/issues/15)
   - Blocked by：V1-07、V1-14。
   - 交付：持久化调度驱动每天同一刊次的证据冻结、研究与私有发布；重试或节点重启不会产生重复已完成版本，截稿后的普通新闻留到下一期。

16. [V1-16 — 降级、迟到、缺刊与午前补齐](tickets/16-degraded-delayed-and-missed.md) · [#16](https://github.com/yiwer/Observer/issues/16)
   - Blocked by：V1-15。
   - 交付：栏目或节点失败时，Owner 仍能区分可读的有效内容、缺口、迟到与缺刊；午前恢复可首发或补齐为新版本，午后不补造正常日报。

17. [V1-17 — 私有归档、可撤销配对与同步 API](tickets/17-private-archive-and-device-sync.md) · [#17](https://github.com/yiwer/Observer/issues/17)
   - Blocked by：V1-01。
   - 交付：Owner 或未来 Android 设备通过一次性配对取得可撤销访问资格，按日期、Edition 和版本读取私有归档，并获知新增、取代、撤回和缺刊状态。

18. [V1-18 — Canonical Markdown 到中文 PDF](tickets/18-markdown-to-pdf-rendition.md) · [#18](https://github.com/yiwer/Observer/issues/18)
   - Blocked by：V1-06。
   - 交付：Owner 可以获取与 Canonical Markdown 同版本的中文 PDF，排版适合长文阅读，来源链接和修订语义不丢失。

19. [V1-19 — 同版本邮件交付与未知受理对账](tickets/19-email-delivery-and-reconciliation.md) · [#19](https://github.com/yiwer/Observer/issues/19)
   - Blocked by：V1-17、V1-18。
   - 交付：报告发布后向 Owner 发送同版本 HTML 总览、私有链接及预算内 PDF，并将发布、服务商受理、实际投递、退信或未知状态分别呈现。

20. [V1-20 — 证据更正、撤回与重大更正通知](tickets/20-correction-and-retraction-versions.md) · [#20](https://github.com/yiwer/Observer/issues/20)
   - Blocked by：V1-16、V1-19。
   - 交付：给定可靠更正或重大未解错误信号，系统自动核验并创建 Correction/撤回关系，Owner 看到新旧版本状态，重大事实更正触发幂等邮件。

21. [V1-21 — 最近 7 天来源更正与撤回巡检](tickets/21-seven-day-correction-patrol.md) · [#21](https://github.com/yiwer/Observer/issues/21)
   - Blocked by：V1-20。
   - 交付：每次日更前自动复查最近 7 天已报道故事的来源更正、撤回及重大冲突，将有效信号送入既有 Correction 流程。

22. [V1-22 — 到期清理、来源撤销与审计保留](tickets/22-retention-and-rights-removal.md) · [#22](https://github.com/yiwer/Observer/issues/22)
   - Blocked by：V1-13、V1-20。
   - 交付：到期数据和来源要求删除的内容会从模型材料、归档及导出访问路径中清理，同时保留许可允许的版本墓碑和已发布 GitHub 计算依据。

23. [V1-23 — 单节点 Linux 运行与可观测运维](tickets/23-single-node-runtime.md) · [#23](https://github.com/yiwer/Observer/issues/23)
   - Blocked by：V1-16、V1-19。
   - 交付：在云厂商中立的单节点 Linux 环境启动私人日报服务，持久状态跨重启保存，Owner 可查看任务、报告、Provider 和邮件的分立状态。

24. [V1-24 — 节点外一致性备份与干净环境恢复](tickets/24-off-node-backup-restore.md) · [#24](https://github.com/yiwer/Observer/issues/24)
   - Blocked by：V1-22、V1-23。
   - 交付：已发布报告及时复制到节点外私有对象存储，并能用数据库、配置及产物的一致性备份在干净环境恢复服务和归档。

25. [V1-25 — 影子评测记录、抽样与事实核查工具](tickets/25-shadow-evaluation-harness.md) · [#25](https://github.com/yiwer/Observer/issues/25)
   - Blocked by：V1-06。
   - 交付：同一 Evidence Bundle 的 Provider 输出进入独立测试归档，形成可供人工核查的陈述级表单、抽样记录及质量/准时统计，为 14 天真实评测准备可持续运行的工具。

26. [V1-26 — 真实接入、部署与发布前冒烟验收](tickets/26-authorized-live-readiness.md) · [#26](https://github.com/yiwer/Observer/issues/26)
   - Blocked by：V1-10、V1-21、V1-24、V1-25。
   - 交付：在 Owner 授权且资格合规的实际环境完成六栏服务、可用 Provider、邮件、私有访问和灾备的冒烟取证，明确哪些能力可以进入真实影子评测。

27. [V1-27 — 启动可续跑的 14 天影子评测批次](tickets/27-start-shadow-campaign.md) · [#27](https://github.com/yiwer/Observer/issues/27)
   - Blocked by：V1-26。
   - 交付：启动独立于交互式 agent 会话的真实影子评测批次，让每天采集、准时记录和人工核查任务持续落盘，并可由后续上下文接管。

28. [V1-28 — 14 天证据审核与 V1 上线结论](tickets/28-v1-release-verdict.md) · [#28](https://github.com/yiwer/Observer/issues/28)
   - Blocked by：V1-27。
   - 交付：在连续 14 天真实记录与人工核查齐备后，给出有证据的 V1 通过、限范围通过或未通过结论，并留下后续运行与季度恢复演练交接。


## 并行执行方式

先完成 V1-01，避免多个 fresh-context agent 各自发明公共契约。之后只派发依赖已合并且验收通过的 frontier，不必等整批结束。

| 已完成条件 | 新的并行机会 | 边界 |
|---|---|---|
| V1-01 | V1-02 与 V1-17 | 采集和私有归档沿共同数据契约推进 |
| V1-03 | V1-04、V1-05、V1-06 | Codex、Claude、六栏编排使用同一 AgentRunner/候选契约 |
| V1-06 | V1-07、V1-09、V1-11、V1-18、V1-25 | 按可用 worker 数取 frontier；不是要求一次开五个 agent |
| 分支各自完成 | 兴趣、社交、GitHub 排名/升权、路由/调度、邮件 | 以 manifest 的直接依赖为准，不用整段阶段屏障 |
| 开发集成完成 | V1-26 真实实测 → V1-27 启动批次 | 外部授权与资源就绪仍必须满足 |
| 批次运行且 14 天证据/人工核查齐备 | V1-28 发布资格审核 | “批次启动”不等于“14 天通过” |

产品内部六个 Edition Research Agent 是运行时角色；这里的 subagent 是开发协作角色。两者的数量和并发限制互不等同。一个开发票一条分支/独立 worktree，一个公共契约变更由 orchestrator 串行协调；避免并行 agent 改同一迁移或公共 Schema。

## 未定技术问题的归属

以下是各票必须交付的局部技术规格与验证，不是另起一张“全系统技术设计”水平大票。实现前先收敛该票所需决策，再完成纵向路径。

| 尚未固定的事项 | 决策负责票 | 约束 |
|---|---|---|
| 语言、持久化、迁移、最小共享契约 | V1-01 | 单节点；从一条可读日报验证选型 |
| 来源政策格式、首发源审阅 | V1-02，主题配置由 V1-09/10/11 补充 | 接入成功不证明使用许可；启用由 Owner 配置批准 |
| 新进展、补报、事件身份 | V1-07 | 与真实时间字段及边界回放共同落地 |
| 初始兴趣、全球重大事件资格 | V1-08 | 明确配置，不做隐式画像 |
| 高风险仲裁、社交采样门槛 | V1-09/10 | 不把平台样本等同总体民意 |
| GitHub 快照相位、排序公式、升权/配额冲突 | V1-11/12/13 | 固定版本、输入与回放；不得削弱既定降权和新颖性语义 |
| CLI 版本/终态、权限、复核、调用上限 | V1-04/05/14 | 实现时复核本机帮助及官方资料；真实接入在 V1-26 |
| 截稿端点、恢复与版本并发 | V1-15/16/20 | 正午限制补跑/补齐，不限制纠错 |
| 同步路由、游标、设备凭证与签名期限 | V1-17 | 单 Owner，凭证可撤销 |
| PDF 引擎/字体、邮件服务商/预算/未知对账 | V1-18/19 | 同一正文，受理不等于投递 |
| Linux 容量、对象存储、恢复计时口径 | V1-23/24 | 软件选择不自动授权购买或真实部署 |
| 事实计数、严重错误、抽查与批次变更规则 | V1-25，V1-27 启动前核定 | 先冻结口径再实测，变更需影响检查/重验 |

遇到影响产品范围、法律许可、付费或正式发布的新选择，明确提交 Owner 决定；一般实现细节由负责票形成有证据的局部规格，不反复重开需求访谈。

## 覆盖与验收边界

manifest 逐票映射 PRD 稳定编号；映射表示计划覆盖，**不表示这些能力已实现或已通过**。

- V1 用户故事：US-1–61、US-64–73，共 71 条，均有负责票。
- V1 行为验收：AC-01–AC-20，全覆盖；一个场景可能由多个开发票加真实验收共同完成。
- 排除：US-62、US-63、AC-21 为 Phase 2 Android，不纳入本次实施或上线通过声明。
- V1-01–25：以各票自动化/固定输入及指定人工样张证据评审开发完成，真实外部前提单列。
- V1-26：完成实际环境、可用 Provider、邮件/PDF、私有访问及真实备份恢复验证。
- V1-27：只交付可跨会话续跑的长期评测批次，不持有 agent 会话等 14 天。
- V1-28：只有连续 14 天记录、人工核查与独立实测证据满足 PRD 阈值，才给出通过或允许的限定范围通过。审核未通过则保留失败结论与整改需求。

## 发布结果与 tracker

Owner 已确认的 28 张票已发布到 [yiwer/Observer Issues](https://github.com/yiwer/Observer/issues)，一票一 Issue；全部具有 `ready-for-agent` 标签，并建立 39 条 GitHub 原生 blocking 关系。该标签表示票可供 agent 接手，不保证其 blockers 已完成、外部条件已具备或生产验收已通过。

已读回核对 28 张票的身份、中文正文与标签，并逐票读取全部原生依赖列表；无重复票。发布时所有票均 open，唯一没有前置票的是 [V1-01 / #1](https://github.com/yiwer/Observer/issues/1)。此为发布时快照，派发时重新检查依赖状态与验收证据。

核验中观察到 #28 的摘要 blocked_by 计数与实际原生关系暂不一致；其 #27 前置关系已从 blocked_by 与反向 blocking 两个接口确认。聚合计数仅作提示，不能仅凭零计数解锁下游；派发前核对本清单与原生关系列表，并确认每个前置票已集成且验收通过。

`to-tickets` 发布阶段已完成。根级 AGENTS/CLAUDE 与完整技能路由配置本次未新建；没有修改或关闭 parent issue，没有启动开发、真实服务或付费评测。GitHub Issues 已发布，本地清单/交接的 Git commit 与 push 是独立操作。

## 按需阅读路由

所有实现 agent 先读选中的票、领域词汇和 PRD 对应部分；票内 references 到下列分支定位。供应商能力、版本、条款在真正接入时复核，不拿 2026-09-05 的研究当永久保证。

- D1：[PRD：D1 版本与范围](../../PRD.md#d1-版本与范围)。
- D2：[PRD：D2 逻辑模块与主要契约](../../PRD.md#d2-逻辑模块与主要契约)。
- D3：[PRD：D3 信息对象与时间语义](../../PRD.md#d3-信息对象与时间语义)。
- D4：[PRD：D4 截稿、发布与恢复](../../PRD.md#d4-截稿发布与恢复)。
- D5：[PRD：D5 证据、选题与更正](../../PRD.md#d5-证据选题与更正)。
- D6：[PRD：D6 来源与偏好](../../PRD.md#d6-来源与偏好)。
- D7：[PRD：D7 Agent 运行](../../PRD.md#d7-agent-运行)。
- D8：[PRD：D8 GitHub 热度](../../PRD.md#d8-github-热度)。
- D9：[PRD：D9 正文、文件与同步契约](../../PRD.md#d9-正文文件与同步契约)。
- D10：[PRD：D10 部署、归档与恢复](../../PRD.md#d10-部署归档与恢复)。
- T1：[PRD：T1 主要测试边界（已确认）](../../PRD.md#t1-主要测试边界已确认)。
- T3：[PRD：T3 影子评测与生产准入](../../PRD.md#t3-影子评测与生产准入已确认)。
- ADR-0001：[确定性管线边界](../../adr/0001-bound-research-agents-with-deterministic-pipeline.md)。
- ADR-0002：[地域与 Provider 资格](../../adr/0002-run-agents-only-from-a-supported-region.md)。
- ADR-0003：[Observer GitHub Heat](../../adr/0003-compute-observer-github-heat-from-official-metadata.md)。
- research:codex：[Codex 调起研究](../../research/codex-programmatic-invocation.md)。
- research:claude：[Claude 调起研究](../../research/claude-programmatic-invocation.md)。
- research:sources：[来源与交付研究](../../research/news-acquisition-and-delivery-constraints.md)。
- research:github：[GitHub 热度研究](../../research/github-trending-edition.md)。
- research:deployment：[部署研究：历史腾讯云候选，须服从 ADR-0002](../../research/tencent-cloud-deployment-constraints.md)。
