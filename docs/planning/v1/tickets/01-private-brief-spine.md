# V1-01 — 最小私有日报闭环与共享契约

状态：ready-for-agent · 已发布：[GitHub #1](https://github.com/yiwer/Observer/issues/1)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-01 -->

规划 ID：V1-01 · 类型：implementation

## What to build

用固定 Evidence 和替身 Agent 生成一条有来源的故事，保存 Report Record 与 Canonical Markdown，并由已鉴权的 Owner 读取不可变版本。其余 Edition 明确为空缺，先建立可以贯穿后续能力的最小闭环。

## Acceptance criteria

- [ ] 固定业务日期的一次生产可通过一个业务集成入口完成；合法身份能读取正文和版本标识，未鉴权读取失败，进程重启后该版本仍在。
- [ ] 定义并验证 Evidence Bundle、Candidate Story、Report Record、Report Version 和 AgentRunner 的最小版本化契约；包含来源关联、UTC 时间、配置标识、任务标识、终态、失败分类和可选用量，支持后续扩展。
- [ ] 记录运行语言、持久化、迁移和测试工具的最小技术决策及理由；采用单节点实现，不预建微服务或 Android UI。
- [ ] 同一确定性输入可核对故事、数字、来源及版本内容；只将固定替身用于自动化测试，生产入口不能把替身输出当作真实研究。
- [ ] 建立可在干净环境运行的构建与业务冒烟检查；观察发布结果而非私有方法或提示词全文。

## Blocked by

- None — no prerequisite tickets.

## Scope boundary

仅一个固定故事和最小私有读取；不包含真实采集、真实模型、六栏选题、PDF、邮件或完整设备配对。

## Decisions and evidence

本票落实共享契约和最小技术选型；后续票通过这些契约集成，契约变更交由 orchestrator 协调。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-54、US-58。
- PRD 行为验收：AC-15、AC-16。
- 参考分支：D1、D2、D3、D9、T1、ADR-0001。
