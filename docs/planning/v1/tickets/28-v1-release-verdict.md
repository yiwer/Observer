# V1-28 — 14 天证据审核与 V1 上线结论

状态：ready-for-agent · 已发布：[GitHub #28](https://github.com/yiwer/Observer/issues/28)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-28 -->

规划 ID：V1-28 · 类型：acceptance-gate

## What to build

在连续 14 天真实记录与人工核查齐备后，给出有证据的 V1 通过、限范围通过或未通过结论，并留下后续运行与季度恢复演练交接。

## Acceptance criteria

- [ ] 开始审核前确认连续 14 天批次记录完整、指纹一致且人工核查覆盖全部重点和至少 20% 速览；缺少真实天数或人工判定时保持待验收。
- [ ] 伪造来源 0、严重事实错误 0、抽查事实支持率 ≥98%、全部发布候选结构/政策通过、至少 13/14 天在 08:30 前服务端可读；逐项计算并链接对应证据。
- [ ] 正常准时和降级准时分开披露；链接降级只能证明采集/交付，不计为模型事实质量已通过，空样本不能补高分。
- [ ] 单 Provider 可依 PRD 给出其能力范围内结论，但双 Provider 对照/真实切换未验证必须列明；能力差异不能藏在总体 PASS 中。
- [ ] 独立列出 PDF 视觉、实际邮件、私有访问与真实 RPO/RTO 的证据；最终版本相对这些证据有变化时做影响检查和必要重验。
- [ ] 不达标时输出具体缺陷、影响和重评范围，不改门槛、不补造记录、不把本票关闭为已通过；允许将审核结论作为未通过结果保存。
- [ ] 通过后形成私人运行交接和季度恢复演练计划；公开服务、Android 真机和自动生产切换仍不因评测通过被默认为授权。

## Blocked by

- #27 — V1-27 — 启动可续跑的 14 天影子评测批次

## Scope boundary

真实发布资格审核，不增加日常人工编辑流程；Android US-62/63 与 AC-21 不在 V1。

## Decisions and evidence

本票是 release gate：只有满足 PRD 准入的 PASS，或 PRD 允许的单 Provider 限定通过，才算门槛完成；FAIL 留为未通过，正式发布还需要 Owner 授权。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-41、US-55、US-56、US-70、US-72、US-73。
- PRD 行为验收：AC-15、AC-19。
- 参考分支：T3、D10。

## External prerequisites

- 14 consecutive real business dates complete
- Required human fact audits complete
- Independent live evidence current for the release candidate
