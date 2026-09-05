# V1-08 执行与待验收记录

状态：**已派发 fresh-context 作者，正在阅读与收敛首片方案，未冻结/验收**。GitHub #8 OPEN，已分配 yiwer。

- 范围：[GitHub #8](https://github.com/yiwer/Observer/issues/8)、[本地票](../tickets/08-explicit-interest-and-global-coverage.md)；PRD US8/64–66、AC17、D1/D3/D6。
- Fixed base：**`b1b6ac3ab557f0098ae5b133f20f4ca32b9182aa`**；包含 #7 最终实施7fae122、集成8e02377及关闭记录。
- Worktree：`O:/GenesisCode/Observer-worktrees/v1-08`，branch `ticket/v1-08`，Root 创建后实际核对 SHA 与 clean。
- Fresh-context `/root/implement_v1_08` 已实际创建成功，未复用 #7 作者/reviewer；先亲读 implement、TDD及required references、必要领域/interface指导与项目规范。
- Root 实际读取 #8 全票与空评论；原生 dependency API 返回唯一 #7 closed，#7 closedAt `2026-09-05T12:21:57Z`。Root 已将 #8 分配 yiwer；未把标签当作依赖验证。
- [GitHub 启动回写](https://github.com/yiwer/Observer/issues/8#issuecomment-5551799527)已发布并实际读回完整正文/作者；#8仍OPEN、assignee=yiwer。

## 票内范围与判定约束

版本化 Interest Profile 包含主题、实体、地区、优先级与排除项，支持文件维护/导入导出，无效配置说明错误并保留上一有效版本。每次日报使用固定快照与可追踪生效版本；相同 Evidence/历史只变偏好可观察排序变化，中途修改不改变在途刊次。

重大 Global Baseline 即使与兴趣排除冲突仍保留入选资格，不绕过 Source Policy、证据核验、事件历史或时间窗口。不把 Agent 的自报标签或关键词命中直接当作事实权威；区域/语言描述缺失保持未知，不能用域名或来源机构国别推造事件影响范围。中国/美国/欧盟/其它全球重大区域及多语言的纳入策略应可解释，实际缺口在总览/相应栏目可见。

初始配置需可审阅，不暗中推断 Owner 私人偏好；无阅读时长、点击学习、静默偏好改写。保留六栏7/3软目标、不凑数、单主故事及不占配额 Impact Note、明确补报、旧刊不重写与历史来源传递许可。GitHub 专门热度/仓库、高风险主题、纠错工作流、Provider路由、调度、PDF/SMTP/Android、部署不属本票。

## 先行计划与 TDD

已要求作者先回报配置文件/版本持久性/无效回退/排序优先级/Global Baseline 权威和首个竖切方案，再由 Root 核对是否仍属已批准 PRD T1：从业务日期、配置、证据、历史及外部 Runner/Verifier/时钟触发公开 `produce → readReport`，观察最终版本、正文、缺口和归档；真实磁盘 SQLite、重启可恢复。不测试私有函数、内部 mock 或 SQL 侧读，不新增 test-only 业务入口；如确需新的 seam 或重大协议选择，先报告。

一片 RED→GREEN 后再下一片；定期 typecheck/单文件，最后代码与专属实施说明一起提交 clean 固定 SHA，再运行全套 check/smoke。Root 另做固定非空三点 diff、Standards/Spec 独立双轴、detached 与实际 master 验收；本文件不提前给出测试 PASS。

当前已有152个测试，smoke3是其子集。request1/2/3与旧Record1/2/3/4读契约、SQLite user_version1、来源缓存独立于永久归档均须兼容；新版本演化不能修改旧正文或冒称原始模型回执。方案待作者基于代码收敛，以上不是已实现结果。

## 独立旧归档与安全

Root 保留 #5 producer 的 Record1/2（`accept-v1-05/data/root-v1-06-compat-4ca1d8`）、#6 producer 的 Record3（`accept-v1-06/data/root-v1-07-compat-a913cb`）和 #7 producer 的两期 Record4（`accept-v1-07/data/root-v1-08-compat-9b22d0`）。最新两期包含主故事、Impact Note、重大更新、前次版本/时间关系；生成与读取脚本及不可变摘要见 [#7记录](07-event-history-and-updates.md#本地集成与后续历史基线)。冻结/集成后用新 built reader 读取，禁止用新代码反造旧预期、修改或删除这些目录。

固定 Linux Codex0.153.4 / Claude2.1.252 与无凭证协议fixture保持；既有首项Claude tag inspect偶发失败根因未知，需保留完整终态，必要只读核对后同SHA定向/全量另记，不拼为首跑通过。不重建镜像、重标签、重启daemon或改全局配置。

本票不读取秘密或认证文件、不调用真实Provider/SMTP。QQ单封预检已由Root完成，禁止重发；本机Codex地区资格信息仍缺，真实Claude测试延期。用户 `.idea/` 和其它项目资源不动。绝对禁止触碰或换工具清理：

- `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`
- `O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c`
- `C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`

新的测试使用自有唯一目录并保留证据，不广泛删除。代码未push、生产未启用；真实来源/模型质量及14天人工核查不能由本票替身证明。
