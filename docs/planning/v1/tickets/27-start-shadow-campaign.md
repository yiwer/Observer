# V1-27 — 启动可续跑的 14 天影子评测批次

状态：ready-for-agent · 已发布：[GitHub #27](https://github.com/yiwer/Observer/issues/27)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-27 -->

规划 ID：V1-27 · 类型：campaign-launch

## What to build

启动独立于交互式 agent 会话的真实影子评测批次，让每天采集、准时记录和人工核查任务持续落盘，并可由后续上下文接管。

## Acceptance criteria

- [ ] Owner 核定评测口径和可用 Provider 范围，固定批次、连续 14 个业务日期、版本指纹和人工核查责任；真实调用与测试投递在授权范围内。
- [ ] 持久化调度运行于已验证环境，测试产物与日常正式发布隔离；双 Provider 对比共享当天冻结 Bundle，单 Provider 批次明确降级验收范围。
- [ ] 启动健康检查和一次真实日运行记录通过；后续日期由持久服务执行，交互式 subagent 退出后批次仍继续。
- [ ] 交付可恢复批次标识、状态读取入口、下次检查点、每日人工核查清单及异常处置规则；不依赖整段聊天历史或长时间工具阻塞等待。
- [ ] 规定代码/模型/来源/评分/核查规则变更后的批次冻结与重跑规则；失败日保留事实，不能删掉后补好日子。
- [ ] 本票完成只表示评测已启动且可接续，不表示已经运行 14 天或任何发布指标通过。

## Blocked by

- #26 — V1-26 — 真实接入、部署与发布前冒烟验收

## Scope boundary

启动和移交长期运行，不负责在单一上下文完成 14 天评测结论。

## Decisions and evidence

外部的时间流逝与人工核查是下一门的证据前提；orchestrator 在等待期间可结束会话并按批次恢复。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-72、US-73。
- PRD 行为验收：T3 影子评测与生产准入（非单项 AC）。
- 参考分支：T3。

## External prerequisites

- Owner-approved frozen evaluation rubric and human audit owner
