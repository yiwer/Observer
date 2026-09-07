# V1-14 双 Provider 路由：执行与验收记录

状态：2026-09-08 Root已批准设计及首个T1切片，作者开始TDD；尚无产品测试通过结论。GitHub [#14](https://github.com/yiwer/Observer/issues/14) OPEN；Root确认依赖#4/#5/#9均CLOSED。

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

## 提案ae87fab的批准与首片放行

Root完整读取作者`docs/implementation/v1-14.md`，并对照当前Edition分批Gate、单栏Runner和确定性FinalEditor。批准Request10/Record11/Version10/Canonicalv9，仅新路径增加路由；批准独立`routing_runs`安全审计、鉴权`readRun`、实际出版/读取的完整authority验证。缺第二Provider但主评估满足既有严格证据门时，可明确标注single-provider/review-unavailable；不当作双复核一致。分歧不得用Provider投票解除独立来源要求。

初始版本化上限批准用于实施验证：总deadline900s、进程/外部请求共享并发各2、单attempt模型请求4、研究进程最多24（含可配置retry）、核验30主+30条件复核、总外部请求336、异常累计已观察token200万。均需参数回放；不保证满负荷都能在deadline内完成，不是金额业务预算。未知用量保持未知，后验保护允许明确有界超调说明，不能宣称费用已被事前限制。

批准时收紧的实施约束：

1. 现有Gate按Edition whole-story分批，混合主Provider按该批真实Edition路由，不能为每个Provider另开一套30+30预算。全部尝试/重试/核验消耗统一额度；耗尽明确降级。
2. 资格撤销以实际检查/通知点为准，不宣称未观察前瞬时取消；每次broker dispatch、结果采纳和发表前复查资格/来源/TTL。
3. 同装配实例的并发produce共享硬进程/外部请求池，各run身份/账本隔离。清理确认前不释放槽；cleanup-unverified禁止新执行，不以Promise.race完成伪称进程消失。
4. 首外部dispatch前可靠建立审计；失败无Report也能鉴权读回，审计写失败不能假称完整记录。成功关联与Report INSERT协调，只保留有界安全投影。
5. FinalEditor局部一致性或哈希不授予来源/历史authority，实际publish/read仍完整校验。

已放行首个实际`produce → authenticated readReport/readRun → SQLite重启`主成功tracer（父taskId长度200，六栏合法输入，不默认双份研究）。唯一作者确认开始RED→GREEN。必要具体schema/DDL跟随首片diff供Root审查，不再以额外文书审批阻止已批准切片；无Docker/真实模型调用，旧兼容目标不变。
