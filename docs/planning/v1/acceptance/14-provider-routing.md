# V1-14 双 Provider 路由：执行与验收记录

状态：设计审查中，尚无产品实现或测试通过结论。GitHub [#14](https://github.com/yiwer/Observer/issues/14) OPEN；Root于2026-09-08确认依赖#4/#5/#9均CLOSED。

## 实施身份与边界

- fresh-context作者：`/root/implement_v1_14`；仅写`O:/GenesisCode/Observer-worktrees/v1-14` / `ticket/v1-14`。
- 固定base：`91e4d8b1d9a0f043201189f4610d597394210a2e`；继承#13产品集成`c987c6a`，完整check403/403、smoke3/3是基线证据，不是#14验收。
- 使用implement/TDD，先提交`docs/implementation/v1-14.md`供Root批准，再逐个公开业务切片RED→GREEN。票末固定提交双轴审查、独立验收、集成后复验。
- 不新增HTTP发布入口或开始每日调度；#15负责持久调度。Sandcastle非V1依赖。Claude live延期，不缩减双Provider业务契约；Codex地域资格仍未确认，不以历史费用授权代替资格。

## Root已核当前代码的接入约束

1. `AgentRunner.run`使用旧单栏ProduceRequest，taskId上限200；`EditionResearch`允许附加栏目后更长身份。路由必须明确安全且有界的身份映射，不静默拓宽旧CLI契约。
2. `observer.ts`有证据却未装配EditionRunner会拒绝；Runner整体抛错会成为整期`agent-unknown`。路由必须返回可解释的局部终态，单栏失败不得丢失其他栏。
3. Codex/Claude当前失败均返回`retryable:false`。备Provider替代策略须显式版本化，不靠该字段假装实现故障替代；安全拒绝、取消及无法确认清理不能盲目触发下一次执行。
4. 当前Final Editor由`arrangeEditions`/`sixEditionMarkdown`及后续版本化渲染实现，只有确定性逻辑，无模型/I/O/tools。复用真实受校验记录→跨栏总览/正文路径，不引入能编造事实的第二轮生成或无作用Facade。
5. 复核一致不是独立来源；转载同一上游不能投票成为交叉佐证。分歧需要Claim/Evidence身份绑定且不得绕过现有Publication Gate。
6. 运行约束须分清attempt数、attempt内模型请求数、共享并发、总deadline、异常已观察usage；未知消耗不能记零，后验告警不能声称已经阻止这次费用。资格在dispatch与替代前从可信配置复查，不接受Agent自报。

## 已确认T1验收方向

出版行为通过真实`createObserver.produce → authenticated readReport → SQLite重启读取`；全部失败、取消、预算和运行审计通过路由公开Interface及Owner鉴权运行记录读取。只替换外部Provider/transport、可信时间/资格输入；自有Gate、SQLite与Final Editor不mock，不用私有方法计数或SQL查行充当业务oracle。

最终必须覆盖票内全部六项AC：主备互换和条件复核/仲裁、六栏及Final Editor、资格失效、可配置有界运行与未知用量、局部保留及采集可用性区分、恶意工具/超时取消/失败决策完整终态。尚未批准具体参数和接口；不得把这些预检写成实现或验收PASS。
