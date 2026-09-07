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

## 首条产品RED

作者`data/v1-14-slices/01-t1-red`因缺少zod依赖失败，只算环境前提失败并保留；按锁文件离线ignore-scripts安装7包后，`02-t1-red-dependencies-ready`真实0/1、0skip、exit1。UTC2026-09-07 22:27:13.837Z–22:27:14.263Z，原错误`Observer.produce: invalid-request`，尚未支持Request10；日志SHA `6d82bf3c51291b0ae60d815f988ce249fa1be0a7d09795b7a4b82468736febd9`由Root重算吻合。Root亲读测试与日志，确认是批准的公开出版路径，而非私有路由单测；此为开发期RED，不是候选验收。

首片有六栏研究输入与结果，但没有实际社交/GitHub采集；这两栏按已有严格规则保留Gap，不伪造合格采集。后续跨模块专项仍必须覆盖真实Owned社会样本和GitHub历史/事件契约；首片不能替代全部六项AC。作者开始最小GREEN接线。已向[#14回写启动范围](https://github.com/yiwer/Observer/issues/14#issuecomment-5576203411)，票保持OPEN。

## 首片合法输入GREEN及继续放行

原fixture把同一evidence-1分给全部六栏，触发既有GitHub输入过滤而删除该证据；不能放宽产品过滤以凑通过。作者改为四个普通研究栏分配合法证据，社会/GitHub两专用栏no-evidence并保留Gap，实际研究attempt=4。Root批准此输入修正和准确切片范围，不替代整票六Edition的各自契约。原6attempt测试事后重建至`data/v1-14-slices/initial-six-attempt.test.ts`，SHA `023cc83e02cc93cd89ace0e7b7cbf6f5662aa4e62159cfb21533ab4e075d9724`与06记录当时测试hash相同；不是声称当时自动保存过源码快照。

`08-t1-valid-edition-assignment`真实1/1、0skip、exit0，UTC2026-09-07 22:32:21.810Z–22:32:22.351Z，log SHA `076e80871d3660fa6ad5f75f12b7c9afdc7c4b3177236e58fc690178685f5eab`；`09-t1-typecheck`exit0，空log SHA `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。Root重算日志并核完整before/after相等，亲读测试、schema/DDL与新路由/FinalEditor接线；真实produce/Gate、Report与GitHub SQLite、Owner鉴权readReport/readRun、重启读取通过。旧01/03/04/06失败全部保留。

Root释放源码短冻结，允许下一条主失败备成功RED→GREEN，不要求每条GREEN停等审批。后续审计片仍须完成：冻结出版receipt和独立终态的明确关联、readRun行身份和有界解析、全失败时调用方可获得runId、安装/丢失/重启abandoned与终态覆盖规则。当前仅主成功切片，fallback/仲裁/有界运行尚未完成；未做票末双轴或整票验收，不集成产品、不关闭#14。

## 主备与局部失败切片10–18

Root读取新增公开测试并核各capture完整before/after一致、实际log SHA吻合：

| 切片 | 真实结果 | 日志SHA |
| --- | --- | --- |
| 10 fallback RED | 1/2，未切换导致实际故事0而期望4 | `19191df0af7fce8fb00124b37cc93e6bc3eb4a6f6014239d36925ba8c81c6929` |
| 11 fallback GREEN | 2/2、0skip；Codex/Claude互换主备，核验随实际成功Provider | `513fcebcc4e93fa68f0a671222812df87f8baa6ef859b31c61cd4283912f6c7c` |
| 13 local failure RED | 2/3；外部抛错整期agent-unknown | `81ea1447ab47ffaaec70efd28bce146dd0a5b81f5276fff113ffde0c5928ece0` |
| 14 local failure attempt | 2/3，仍失败；测试误要求无契约保证的故事数组次序 | `ee5faa3922f568eda1ff5bd0f3a67ac3c5df80e356b82c70169bd8f39a183576` |
| 16 local failure GREEN | 3/3、0skip；按固定成员集合验证，不修改产品排序 | `e5b31acfccfb60686c4a44fe411f808cf270348c8e9a3d1fd43698abb2abaa46` |
| 17 failed-run identity RED | 3/4，失败调用不能取得runId | `a0c17affa21c7a0df8f899af1274f1ae57d5b0d241366e24a70d1d00775b05e8` |
| 18 failed-run identity GREEN | 4/4、0skip；invalid-bundle-identity失败携安全runId，无Report，鉴权读取和重启一致 | `f0b927ee26223232f3e459c136d945f65e15a0ebfe0968cddc9d5c7117c75721` |

12 typecheck exit0。局部异常例为AI栏两Provider都抛错，世界/财经/前沿科技保留，两个失败原因与Provider记录且不留异常原文；不是全部Provider失败或真实服务故障验收。18只证明其具体无Report失败路径，不外推至未测试的全部失败类别。14虽目录含green，实际exit1明确保留，不计PASS。作者继续冻结receipt/独立终态关联、DDL和有界读；Root补充Owner不启用Provider的只读重启也应可查历史安全审计，资格撤销不能遮蔽审计。

## 审计切片19–29

Root核下列完整before/after一致、实际日志SHA，亲读公开readRun/readReport与Owned SQLite故障注入测试。SQL仅注入并还原，不以SQL结果代替业务oracle。

| RED → GREEN | 具体行为与真实结果 | GREEN日志SHA |
| --- | --- | --- |
| 19 → 20 | Report冻结ready收据，独立run终态published；5/5、0skip | `7f6e5185494c6023fce0314bd379480785fd0e623e1796db22b12378a6e02187` |
| 21 → 22 | 无Provider装配的只读重启仍可鉴权读取；6/6、0skip | `d0f3ce7f584956d2e64acaf982f047554e4f3232e8fdbdaa5931ddae5f2894c7` |
| 23 → 24 | 实际runId被替换时审计和关联报告都拒绝；7/7、0skip | `ef2f28091393adaa27d53d5642f0612cfbb015bcd229e9400019d90177576bea` |
| 26 → 28 | 已安装routing表丢失不得静默重建；8/8、0skip | `6200e2131d9c79903f9e78925a3a392e42a7ca956618400228e6c8c0f807a6d1` |

25与29 typecheck均exit0，空日志SHA `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。27仍exit1、7/8，失败为测试收尾重复关闭已关闭数据库；原日志SHA `a087eab0735576a0d3f234cdda25f9e1f4dbf0daf07a3ac173e47a94fad25a01`保留，不计GREEN。上述只是局部开发证据，非完整资格/预算/仲裁验收。

Root发现DDL开始新增`reports.routing_capture_sha256`，要求纠正提案“不改变reports行格式”的宽泛描述。批准必要的nullable附加列用于真实出版capture关联，旧payload/Record字节及旧行NULL不backfill、user_version不变；若实际只作安装marker，须明确用途而非预留误导列。作者须随既定关联切片交付具体校验，不能从存在列推导完整性通过。Root未暂停已批准TDD，并要求完成必要审计片后继续资格、全部失败采集可用性、条件复核和共享预算等核心AC。

## 采集降级与实际capture切片30–38

Root核对30–38各capture完整before/after一致、实际日志SHA吻合，并亲读新增公开produce/readReport测试。31为9/9、34为10/10、37为11/11，均0skip、exit0；32/35/38类型检查exit0。30/33/36原RED日志保留，不算通过。

| GREEN切片 | 已覆盖行为 | 日志SHA |
| --- | --- | --- |
| 31 | 两Provider禁用时零attempt，明确区分采集可用性和模型不可用 | `033293e024244f949b471e4f26b47ea6827219666de8ef8f509e9fc7c64459c1` |
| 34 | SQL仅作Owned故障注入：移除routing并降为自洽Record10，实际readReport仍拒绝；随后还原 | `897952a95e3861188261909907cdc151a0eaf4282cf6026f86f81e1508a89d1b` |
| 37 | 真实Collection SQLite、Owned RSS、schema2 storage Bundle：model-forbidden但允许分发的链接保留；分发撤销后排除，零attempt且报告不包含禁止原文 | `bc59547d8edbac62c6797b33cf2c04e322f4715a7ebd6748443d13e908138714` |

nullable capture列已进入实际INSERT及read校验，不再仅是安装标记。上述仍为未提交WIP的局部开发证据，不是固定候选验收、真实Provider验证或整票完成。作者继续条件复核和实际Gate裁定；Root提醒保留原Verifier provenance，不能用双Provider同意补足独立来源。Sandcastle仍仅后续隔离PoC候选，不进入V1主依赖。

## 条件复核切片39–45及待补边界

Root核39–45完整before/after一致和实际日志SHA，亲读实际Gate接线与公开测试。40为12/12、0skip、exit0，日志SHA `de7faa2f0ac4bcba389f61992738aa56e7c29340c0e3d03facee1e329f82c9ba`：只对高风险Claim触发另一Provider复核，两Provider一致仍因缺独立来源而待确认。44为13/13、0skip、exit0，日志SHA `e2bb64d754ac945919bb8e82c706d6a884bef73484f5f384440151a4c22483f3`：两独立来源且主评估本可发布时，复核冲突令实际Gate返回unconfirmed，正文不作为故事发表，重启读取相同。原核验收据保留，不伪造第三模型或合成research-agent输出。

39/43真实RED保留。41类型检查exit2，测试risk.categories推断never；42修正后exit0，45也exit0。不能将41视为通过。

Root的开发期检查要求继续补有效证据数组顺序置换例，以及复核方unsafe/irrelevant的隔离优先级。当前整assessment哈希比较可能把顺序变化误报为分歧，且普通disputed不能代替quarantined。最初对主unsafe被回调降级的怀疑，经亲读domain-evidence.ts纠正：Request10的domainRules前置检查已隔离主unsafe/irrelevant，应作回归保护验证，不能记作已复现缺陷或伪造RED。Assessment.reason是封闭枚举而非自由文本；不得放宽conclusion/reason一致性来解决等价比较。上述均未完成整票验收，#14保持OPEN。

## 单Provider范围及复核安全修正46–52

Root亲读公开测试、正文生成和实际Gate修改，核46–52完整before/after一致及实际日志SHA：

| GREEN | 结果与范围 | 日志SHA |
| --- | --- | --- |
| 47 | 14/14；缺第二Provider但满足原严格证据门可发布，正文明确single-provider/review-unavailable，零review attempt | `a4d311450290cee671361038fcdb78e5bf2e33de78f1a0dda35056f8e7c3f792` |
| 49 | 15/15；证据顺序置换不再误报分歧，保留不同原始assessment摘要 | `d0d218f65e7472880b5133da8cecdd7e204752781b91954e1310114893e12ddd` |
| 51 | 16/16；主unsafe原保护仍在；复核unsafe即使主缺独立佐证也优先quarantine，不进入unconfirmedItems或故事正文 | `7418872ef004570dc8c6c624fb139e21cd936e609d6fb6e81d413db34619792d` |

各GREEN均exit0、0skip，52类型检查exit0。46/48/50真实RED保留；50实际unconfirmed而期望quarantined，原日志SHA `d24368e2f80fbc9ede00f13ce980b0b55b90d44009aea764a81cd2de3e13e485`。Root另要求新排序使用精确code-unit比较，不能依赖localeCompare对不同Unicode ID的相等排序；不顺手改旧模块。

预算片新增必须验证的组合：15000个review条目与当前1MiB审计读取限制不相容，不能成功发表后readRun/readReport自拒。批准32MiB作为版本化安全审计工程初值进入TDD，写前/读前同限，不影响原模型输出等限制，也不声称总内存上限。需按实际UTF-8和最坏收据预留，默认最大合法批次及低配置前置降级分别覆盖；只读重启不得信任任意receipt自报无限上限。此容量目标尚未验证。

本轮实时`gh issue list`确认#1–#13 CLOSED、#14–#28 OPEN，无漏关已验收票。Root另派独立fresh-context子代理从固定#13源码准备旧Record10基线，只在独立data目录工作，不动作者WIP，不用新源码生成旧证据；在Root核完前不声称基线已验收或#14兼容通过。

## 固定旧Record10基线与Root控制回放

独立子代理交付`data/root-v1-14-record10-compat/`；Root亲读fixture、freeze脚本、v1/v2 reader，并用固定clean `24c38a11d45f949c48e856d015c5b91908ee7d11`的src独立运行：

```powershell
node data/root-v1-14-record10-compat/read-compat-v2.mjs O:/GenesisCode/Observer-worktrees/accept-v1-13-r2/src ts root-old-source-control
```

exit0，结果`root-old-source-control-1788821803465/read-evidence.json` SHA `dc41eb4d94ccd7da97caf9f11b998b8911c04f39c7faf189f8a4e02126b0374d`。Root重算15个冻结文件和58个旧源码/包输入SHA均吻合，目标HEAD/status/完整模块树及package输入前后相同。原始冻结数据库不变；reader仅在副本装配authority并调用鉴权readReport，错误token拒绝，不produce/observe/联网。

基线由旧固定源码公开生成，非新代码反向构造：`2026-09-02-v1` Record9记录普通榜历史；`2026-09-03-v1` Record10中ROOT_REPEAT普通分为0，但Owned重大release经真实GitHub开发与再推广链再次入选，唯一reportedDevelopment、正文摘录及开发ID进入Markdown。SourcePolicy、配置、时钟、Owned输入和数据库完整冻结；这是source-only语义替身基线，不是外部GitHub/真实模型验收。

| 固定锚 | SHA256 |
| --- | --- |
| manifest.json | `e8154dc8860741cfba0c9f8df93bb88225a14681d82014b5d90ceb032ec2a88f` |
| read-compat-v2.mjs | `b30341473968d8a3af27bf2ce49a44696fc02830e05adab7e9b2a050e28f4883` |
| reader-v2-manifest.json | `7e16c56998476c34739a5f81144e36fe3f8bc425b5f0a0f8988e760a03c243e3` |
| Record10完整report | `4908566c06e29d5e57f68cfda45ef4a80d44230570e1837b2c1be2420b97e474` |
| Record10 record | `e8b8e6cb0ed749854a281953fc129086e800df63b911ba3b2f5085a51e4d56c5` |
| Record10 canonical Markdown | `5e9391d648ac4aac4e5bc4273e8ba5efc106e41e78f6cc2e64f5742a940108f5` |

两个旧报告整体/record/Markdown均逐字节与摘要一致。v2以旁挂清单追加目标指纹，原manifest/v1 reader未覆盖。后续对固定#14候选src/dist调用相同reader（参数为绝对模块目录、ts或js、唯一label），外层再绑定候选SHA/构建证据；当前未对#14 WIP运行，不宣称新版本兼容通过。该单个release基线不替代其余旧版本、GHSA/动量和历史消费回归矩阵。

## 预取消切片53–55

Root核完整before/after一致与实际日志SHA，亲读公开预取消测试。53真实RED；54为17/17、0skip、exit0，日志SHA `5ea5a06f4c5f49b04d22bbac0bb15577cee8193135700eede2a51b4ecbc4ff4c`；55类型检查exit0。Owner在dispatch前取消时，调用返回agent-cancelled及runId，readRun可读failed、明确failureReason、零attempt。

这不证明在途取消或总deadline。作者下一片的有限迟到结果用于验证不采纳和已知usage保留；仍须后续非settling外部任务、有界cleanup/readback与不放行新进程的验证，不能把await runner.run最终返回误称无限等待已受控。
