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

## 有限迟到结果切片56–58

Root核完整before/after一致、实际日志SHA并亲读公开测试。56 exit1、17/18，具体RED是RoutingConfiguration尚不支持limits（unrecognized_keys），不能表述为已复现迟到发表。57 exit0、18/18、0skip，日志SHA `8bdd1904becd4f1e77e10fbe3a0f87a3f48d6ff83c4dccd004cbf69433c9beb9`；58类型检查exit0。固定Owned主Provider等待130ms、attempt上限100ms，四栏主结果不被采用，均记timeout，input10/output20已知用量保留，备Provider实际完成四栏。

此片只证明有限迟到结果处理，不证明永不settle的Runner或transport有界终止。Root亲读既有agent-container及两Runner：容器返回前有身份cleanup/readback，但宿主broker.respond Promise独立，容器removed不能证明外部请求已结束。已要求进程池和外部请求池分别保持名额释放与取消证据，迟到响应不得回写；共享预算和完整终止仍为待实现/验收目标。作者仍在运行，Root不重复启动实现或抢先运行整票测试。

## 宿主dispatch控制Seam与研究阶段总时限59–61

Root批准作者沿既定方案增加可信AgentRunOptions dispatch control：broker实际respond前申请请求额度/槽，只有真实Promise settle后释放；进程槽独立以Runner cleanup/readback为依据，未确认清理熔断同routing装配实例。模型输入不能授予许可/额度，run账本仍隔离。队列等待计入总deadline，获槽后实际dispatch前复查取消、资格和来源；未派发不能算已请求，已派发失败不退款。旧调用方不传control保持旧契约，具体typed实现和真实固定CLI协议仍待验证。

Root亲读59–61测试与当前接线，核完整before/after一致和实际日志SHA。60 exit0、19/19、0skip，日志SHA `443bf23bb564f8a3a47067d67a68644bd5d7fcfd8228e73b6b35e197e36a56cd`；61类型检查exit0，59 RED保留。Owned主结果在总时限后返回，不采纳、不启动另一Provider，六栏Gap和独立采集可用状态可读；仅1次attempt，total-deadline原因及已知usage保留，无Provider配置重启readRun相同。

此为研究阶段时限切片，不能外推为queue/review/Gate/Editor/提交前都已受控。作者须继续覆盖已有故事时后续阶段跨deadline、非settling任务的有界收尾，并区分收尾审计/安全降级与正常发表。当前100ms为Owned快速测试参数，原批准生产total下界1000ms；若变更需明确版本/测试注入，不无记录放宽。#14未冻结、未整票验收。

## 非返回Runner与同装配熔断62–67

Root核62–67完整before/after一致及实际日志SHA，亲读公开produce/readRun测试。62是cleanupTimeoutMs配置尚不支持的RED；63为真正不返回Runner导致测试4000ms超时，19pass、1cancelled、exit1，日志SHA `d8488d5884c8e30f8e1d707023bf329315820f90d17f54a1b830a56b961b5200`。64虽目录名green，实际19/20、exit1，第一次收尾已完成但第二次同日produce撞到既有version-already-exists，原失败保留。

66改用第二次失败携runId的鉴权readRun作为业务oracle，不改产品同日唯一版本契约：20/20、0skip、0cancelled、exit0，日志SHA `cb26b33c63ec75adf5ae83f57d1f546641ea5ff20a99221a15f298c55c9ee34b`；65/67类型检查exit0。100ms attempt加100ms cleanup等待后，不返回Owned Runner记cleanup-unverified、未知usage仍null；报告六栏Gap，随后同routing装配的新run零attempt且明确熔断，原run原因不变。没有真实进程/容器，不声称进程已被杀死。

Root要求继续覆盖及时返回但execution.cleanup=unverified/failure=cleanup-failed的Runner，以及前一栏成功、后一栏清理不明后不能再启动Verifier；所有派发需统一安全门。另需主动resolve/reject已超cleanup grace的deferred Runner后重新读冻结run/report，证明迟到写被拒绝；永久不返回例不能替代该证据。真实固定CLI cleanup/readback、宿主请求Promise及跨run共享预算仍未验收。

## 及时清理失败与迟到冻结回归68–73

Root亲读公开测试和统一begin安全门，核68–73各capture完整before/after及实际日志SHA。68真实RED；69 exit0、21/21、0skip/0cancelled，日志SHA `6cfec906165b58619c00d5970446e784ada43d9909052a59435f7f4008b4d0a2`；70类型检查exit0。world研究成功后AI及时返回cleanup-failed，实际run只有这两次研究attempt，不启动后续研究或Verifier；未核验故事不发表、六Edition保留。

71将totalTimeoutMs恢复批准的1000ms下界并更新快速例，21/21通过；这不是新的故障修复RED。72新增迟到resolve/reject回归直接22/22通过，0skip/0cancelled，日志SHA `0dab7f9e52f74124914376021db10e905a60883cf313fdf9b4a1f003f5c56d4f`：先超cleanup grace冻结run/report，再主动settle原deferred并排空一轮事件队列，鉴权readRun/readReport保持完整相等；无Provider配置重启run也相同。没有为已有正确行为伪造RED。

73跨produce共享进程槽真实RED，22/23、exit1，日志SHA `77cf1bd6453f9747a694c881ef7276c44b1753a326f90d15ed6c5b733e07d02f`，作者继续最小GREEN。该并发矩阵仍未通过，不计入已有22/22范围；所有证据仍为未冻结WIP局部测试。

## 共享研究进程槽74–75及排队边界

Root亲读Owned外部容量输入与公开每run审计断言，核74/75完整before/after一致及实际日志SHA。74 exit0、23/23、0skip/0cancelled，日志SHA `edcf006fe08b0920f0afb6a5c42b9ae423f5018f36e6b557d04931e24832c525`；75类型检查exit0。三个并发produce共享双研究槽，各run均四个成功研究attempt，按既有同日唯一版本语义从成功报告或version-already-exists错误取得runId分别鉴权读取。外部容量计数位于Owned研究Runner，不是容器实测，也尚未覆盖研究/主核验/条件复核混合峰值。

Root提出待补边界：获槽后的decide/persist、begin、资格解析、缺Runner等同步失败必须避免泄漏名额，同时不能在实际派发后清理未明时释放；排队Owner取消应保留agent-cancelled，不能改记deadline-exhausted并继续发表Gap。语义调用当前begin早于acquire，获槽后必须再次检查资格/剩余时限和取消，避免排队期间撤销仍派发。作者继续通过公开矩阵统一可信dispatch入口，明确queued与实际started审计语义；当前GREEN不外推上述目标通过。

## 请求额度、排队取消与固定CLI拒绝接线76–86

Root亲读公开配额/取消测试、新CLI测试、两Runner的dispatchControl增量，核76–86各capture完整before/after一致及实际日志SHA。

| GREEN | 真实覆盖 | 日志SHA |
| --- | --- | --- |
| 77 | 24/24；两个attempt派发数[4,1]、总数5，attempt配额耗尽失败不退还此前请求数，后续停止，六栏Gap和重启审计可读 | `646036cd4a460919dc90a04d5cd97278ba87f14e2911ba9be897e95e094ff0ff` |
| 80 | 25/25；两个已占槽任务之外的排队任务被Owner取消，agent-cancelled、零attempt、failed审计，不再误报deadline或发表 | `0505161f04d506273275abf4d952466f126966e5bc3994e1ce01dc3a6e58426f` |
| 85 | 新CLI文件1/1，内部串行Codex/Claude两例：首respond前宿主拒绝、外部Owned transport零调用、各一次拒绝、cleanup removed | `974fdbe69238ff2c05453fd5902575a1b49ef2b083e22fd70f83323e143ab75e` |

均exit0、0skip/0cancelled；78/81/86类型检查exit0。76具体RED为maxExternalRequests配置尚不支持，79为排队取消却发表的真实行为RED。77的send均返回200，证明失败attempt不退款，尚不证明网络请求自身reject/HTTP失败仍计数；已要求后续补测。

Root实时确认固定镜像存在且无running Observer任务后放行串行Docker窗口，没有build/pull/retag或真实模型请求。82真实Codex CLI未接control，dispatched1/refused0，测试失败；83虽运行通过，84类型exit2暴露测试使用非法ModelBoundaryError类别等问题，均保留。85修正为合法evidence-expired拒绝，未放宽产品枚举：实际Codex 0.153.4容器`0124d60aa2efc38468910d6cdb1a97cbb11da7f8b86105f061d467e683849b1d`、Claude 2.1.252容器`5e5bee1a978414d7e05cdf3d76e178e0a7a04adbe1201bbb9ab7b8e381cca23a`均确认removed；失败运行terminal missing/exitCode null符合中止，不伪称模型成功。

作者归还窗口后Root独查docker ps --all，两个本次ID均不存在，仅保留既有两日以前Exited容器，未删除。此为真实固定CLI+Owned协议的Runner拒绝接线，不是完整Request10 CLI闭环、语义CLI、共享外部槽或Claude live通过；后续矩阵与整票固定候选验收保持未完成。

## 独立外部请求槽87–90

Root亲读Owned detached-model输入、实际dispatchControl及三轮公开readRun断言，核87–90完整before/after相等和实际日志SHA。87真实RED：进程已结束但外部Promise仍pending，实际派发8而期望2。88 exit0、26/26、0skip/0cancelled，日志SHA `0ee879a16b96d34795b1c2f9a302a0a8350d6bfedee76c8ae2cc2d0e77d32ed8`；89类型检查exit0。

现在两外部Promise持续占槽，下一run零外部派发；主动settle后旧run完全不变，第三run可重新派发8次。该Owned Runner返回安全not-created过程收据，同时独立外部Promise不响应abort；此为两类生命周期分离的业务回放，不是网络/容器容量实测。Root要求后续统一dispatch在send前（包括排队醒后）校验run仍running、attempt仍started，不只依赖调用者signal，防止已终态hook新发请求或改冻结计数。

90已进入语义核验不返回矩阵，真实4000ms超时RED：26pass、1cancelled、exit1，日志SHA `e8cc782f51a7d93e493cfb229835b0267a9d888ecef8c811ece8f7c15ee659f1`。作者继续其GREEN，不计入已通过26/26范围；共享槽可配置范围、混合角色/资格/预算及真实CLI全链验收仍待完成。

## 语义超时与发表前deadline91–96

Root核91–96完整before/after一致及实际日志SHA，亲读semanticAttempt和公开失败run/noReport断言。91 exit0、27/27、0skip/0cancelled，日志SHA `9b217ebb8f7eb0e80051f8660a90796e98b9c609b1e0377ef2fb148f01438c5d`；92类型检查exit0。四栏研究完成后首个语义核验永久不返回，100ms attempt加100ms cleanup等待后记cleanup-unverified，run仅五个attempt，无其他Verifier、无发表故事，六栏Gap与只读重启审计相等。

93发表前总时限真实RED后，94 exit0、28/28、0skip/0cancelled，日志SHA `1edd44fb53a12bafec0e53265f817d8525a7ba53595a720bc44eb2c0b81a4fd2`；95类型检查exit0。world已核验成功，AI核验跨1000ms总deadline时，produce返回routing-total-deadline及runId，不正常发表先前故事，目标Report不存在，failed审计可重启读取。这是核验阶段跨时限例，未代替Editor/事务阶段容量回放。

Root提醒Owner在核验或复核期间取消必须在整轮提交前重查：Gate与复核catch可能吸收Verifier异常，不能仅靠semanticAttempt抛错证明取消阻止发表。96保留终态host hook仍能派发的真实RED，28/29、exit1，日志SHA `43bd95284e38ab857f5a1f289083a1d0aaf0ef26674ddcee33721dfee022b463`；作者继续该修正，不计为通过。当前全部为WIP局部证据。

## 终态派发与核验期间取消97–100

Root亲读公开测试、dispatchControl和发表前authorize，核97–100完整before/after一致及实际日志SHA。97 exit0、29/29、0skip/0cancelled，日志SHA `5d45391c82c0031be72bafd1a5b9d1b054f544d9387dabc269adbad15b5ca50f`：保留的host hook在run已完成时拒绝新dispatch，鉴权run/report均完整相等；控制入口及排队醒后均要求run running、attempt started。

99新增取消回归直接30/30通过，exit0、0skip/0cancelled，日志SHA `57e73d1d4c7454ff9caabd6a88a0d946280d83e8be6adf146156d60caaf4b143`。主Codex核验及Claude条件复核两个场景中，实际调用开始时Owner取消，最终agent-cancelled、failed run、相应attempt cancelled、目标Report不存在；既有提交前取消保护生效，不伪造新RED。98/100类型检查exit0。

作者继续获槽后同步失败释放、资格/来源复查、审计容量及真实语义CLI接线；原30主核验+30条件复核/24研究含retry、异常用量与六Edition历史矩阵仍保留。当前普通四栏Owned fixture通过不替代社会/GitHub采集、参数容量、固定候选双轴review和整票验收。

审计上限后续裁定：作者提供合法JSON转义ID上界估算（15000 review约42,960,000字节、10000 link IDs约12,030,000字节，加1MiB余量为56,038,576），32MiB初值不足。Root批准64MiB（67,108,864）作为v1可信安装硬上限/default进入容量TDD，低配置仍先预留、实际UTF-8计量和明确降级；不是容量已通过。完整schema余量须实测，最大可达端到端组合与纯schema极值分别标明，不绕过原CLI输入/输出上限；重型回放另经Root串行协调。

## 缺少Adapter的局部降级101–103

Root亲读公开三轮produce/readRun例和研究槽外层try/finally，核101–103完整before/after一致及实际日志SHA。101真实RED保留；102 exit0、31/31、0skip/0cancelled，日志SHA `d9c69d32150531c67c228d681dd3b2ee54be6a081a30c1607588e53ed371dac9`；103类型检查exit0。world两Provider均无Adapter时先明确runner-unavailable，其他三普通栏成功；三轮run各三次研究、所有实际attempt成功，未因重复缺Adapter耗尽共享名额。

该修正把Adapter存在性检查移至acquire之前，因此测试不能直接证明获槽后的同步异常释放。Root要求后续以获槽后可信资格回调throw等公开故障例，再正常运行验证槽仍可用；不以当前缺Adapter绿色替代。作者继续实际SourcePolicy在每次broker派发前复查的切片，尚未计为通过。#14仍未提交固定候选或整票验收。

## 每次broker请求的来源复查104–106

Root亲读真实Collection SQLite/Owned RSS→schema2 storage Bundle测试、authorizeEvidence及dispatchControl接线，核104–106完整before/after一致及实际日志SHA。104真实RED保留；105 exit0、32/32、0skip/0cancelled，日志SHA `6e3d53a59587cea7f976b3afe7b7f45b8a72def569a7ca4eabf8436e5561965d`；106类型检查exit0。

首个Owned send后撤销实际SourcePolicy.model.enabled，后续send在计入派发前被阻止；run外部请求数及首attempt请求数均为1，最终Report不存在。可信callback使用当前checkedPolicy的版本/完整摘要并检查model与expiry，不以初始modelPolicies快照授权整轮；每attempt的证据ID保存在内部映射，begin与实际dispatch均检查。此例不代表资格撤销、来源全部字段/历史/六栏组合或容量已完整验收，原矩阵继续。

## 获槽后同步异常与失败请求回归107–108

Root亲读公开测试，核107/108完整before/after一致及实际日志SHA。107直接GREEN，34/34、0skip/0cancelled、exit0，日志SHA `8a44b723286cba7e3999a136620e0297e422fc8c17bf9ab9b497e8dbcdf0c500`；108类型检查exit0，不伪造新RED。可信资格回调在获槽后的第二次读取抛错，随后两轮并发produce均实际进入研究，证明两个进程名额可用。另一次Owned transport实际抛连接错误，外部派发与attempt请求数仍为1、attempt failed、未知usage仍null，无故事发表。

## 可达千条陈述审计容量109–111

Root批准串行单Node本地容量窗口；作者归还后，Root亲读公开produce/readReport/readRun及无Provider配置重启测试，核109–111完整before/after一致和实际日志SHA。109真实RED：produce已成功，但自身readReport因旧1MiB storedRun上限报routing-integrity-failed，日志SHA `0aff6308b61f812bf7504547d5770a5a6784fac2b9200aeff9f6c148ae706560`。

110限定容量用例1/1、0skip/0cancelled、exit0，日志SHA `4e194d1f67ee6a6475213dc106af77d30f8e8e4e8bc02cfe759b7a66038eb159`；111类型检查exit0。实际审计2,818,470 UTF-8字节，capture耗时1785.2425ms，测试进程resourceUsage.maxRSS为447,164KiB（约437MiB）。world使用20故事×50陈述、两个Owned独立来源及合法转义ID；研究与语义输入/输出均断言小于原1MiB/2MiB限制，1000条review完整可读并在只读重启后保持相等。读写采用可信固定64MiB硬限，不信任收据自声明。

这是可达1000陈述的局部容量证据，不是15000纯schema极值、六栏最大组合、真实CLI或完整性能验收。Root已批准下一112/113低配置审计预算RED→GREEN独占本地窗口，无Docker/联网；要求派发前实际UTF-8最坏投影与终态余量预留、明确audit-budget-exhausted且保留每条Claim的Gate终态，不能通过静默丢弃审计达标。结果尚待核对，#14仍ACTIVE且未冻结候选。

## 低配置审计预算112–114

作者归还本地窗口，Root核112–114完整before/after一致及实际日志SHA，亲读公开测试和预留/双重写入限制。112是maxAuditBytes字段尚不支持的配置RED，日志SHA `f5a3d4a405cacbf8b856e73aab1afa3811f859e48fd9895af8385fae3d997e24`，不能称已有预算越界行为复现。113限定测试1/1、0skip/0cancelled、exit0，日志SHA `09abfb8497cc7e5593093d1c7455771bd9a8a87739b2655fe5d83d30c6d154d0`；114类型检查exit0。

512KiB配置下，world两个语义批次在派发前明确audit-budget-exhausted，零world核验attempt、零虚构review；真实Gate保留1000条Claim终态，另外三普通栏发表。run实际6042 UTF-8字节，capture819.5064ms，测试进程峰值RSS302,048KiB；无Provider配置重启run完整相等。预留覆盖已有/潜在review的实际转义字节、84 attempts、512固定Edition决策、终态字段和来源ID；读写同时执行可信64MiB及低配置界限。

此例不证明全部schema数值/字节极值。Root指出Number.MAX_VALUE的JSON文本不必然覆盖所有合法costUsd序列化长度，后续需保守余量或完整上界证明，不可藉此引入业务成本封顶。初始收据自身超低预算时作者明确报告为派发前capacity错误，不宣称该情形已有完整持久审计。真实语义CLI、资格撤销、全角色/重试/异常用量、六栏历史及票末固定候选验收仍待完成。

## 三角色尝试预算115–117

Root亲读角色计数、begin派发前校验及公开报告断言，核115–117完整before/after一致与实际日志SHA。115为maxResearchAttempts/maxVerificationAttempts/maxReviewAttempts尚不支持的配置RED；116实际完整文件37/37、0skip/0cancelled、exit0，日志SHA `41180e2dc22bcb4a6c0c06193c4ef034f5c5b9f8b7c204f61f1855a8cceb714a`；117类型检查exit0。配置研究2、主核验1、复核0时，实际attempt仅research/research/verification，复核明确review-unavailable、存在attempt-budget-exhausted决策，六栏结构保留且world一条已满足严格Gate的故事发表。实现范围分别0–24、0–30、0–30；该低配置例不代替默认最大组合、retry或异常token验收。

运行范围纠正：作者原用`^(?!Audit)`希望排除容量例，但115/116实际仍包含两容量测试，未重新协调容量窗口。作者先提出根suite空名解释，随后极小probe发现补`.+`仍无效，故撤回该根因结论，不能称已诊断。作者主动报告，原capture保留；Root当时无重测试或Docker并行，未发生资源冲突，不把该次写成35项普通回归。116 capture12559.3489ms、实际峰值RSS466,884KiB；新配置字段后容量审计2,818,572字节，低预算审计6119字节。后续排除规则先用小probe实测，含容量的单文件回归按真实范围协调。

数值预留后续证据：Root用本机Node实际确认JSON.stringify(Number.MAX_VALUE)为23字节，而合法非负0.0000012345678901234567为24字节，已交作者作为边界回归输入。作者拟增加每数值64字节保守余量，尚未核验该修正；不将意图记为通过。

筛选工具独立复现118/119：小probe仅两个test，Audit项执行即主动throw，ordinary项成功；118负向正则仍执行Audit，1pass/1fail、exit1，SHA `1451fb9d805dc999e078be7055287408641d9e229d969ef8071471f022e7454c`。119使用Node原生`--test-skip-pattern Audit`仅ordinary 1/1、exit0，SHA `e4c716e3998df210a5e6c707112506b72d729687daf18818973c3b65c78aa2a9`。Root核两capture before/after及实际hash，亲读probe并独立执行同skip命令得到1/1。118/119是追加复现，不冒充首次输出；这只确认可用筛选办法，不是产品新增通过项或根因诊断。

## 数值保留与有界同Provider重试120–124

Root核120–124完整before/after一致、实际日志SHA，并亲读公开测试与接线。120直接回归36/36、exit0，SHA `0f00921ff16b07d4130b930f941d70081dc27102d505e0ccfd037d66087f0d2b`；121类型exit0。合法长小数、Number.MAX_VALUE、5e-324三个Owned成本值经研究attempt审计与无Provider重启保持相等，不人为舍入或设置业务成本封顶。预留增加84×3×64字节余量；此例是数值保留回归，不伪称精确审计预算边界RED。

122为sameProviderRetries配置尚不支持的RED，SHA `c07d13095d56d0e78b3f280baccd3acacba057db76448534c6904982e2dc2bd1`；123为37/37、exit0，SHA `c45d8848a2ddf3a01d2b4a4f26fcb304336b9e698b1360c97ceb8369297557d9`；124类型exit0。两次GREEN均0skip/0cancelled，但命令使用原生skip-pattern Audit，实际排除了两个容量例，不是全文件或整票通过。Codex/Claude分别作主，四普通栏短暂unavailable后均A→A成功；主持续失败时A→A→B→B成功，无B→A回跳，provider-retry明确记录。依据既定版本化路由类别判断，不改变旧Runner统一retryable:false契约；全六栏24尝试上界与拒绝类别仍需后续矩阵。

Root源码核查提出后续局部失败边界：schema合法但taskId/provider/edition/evidence身份不匹配的invalid-routed-result当前位于研究inner catch外，可能整轮失败并留下started attempt；已要求作者通过公开测试按局部失败/明确终态处理，不能让一栏恶意身份取消此前成功栏。policy-violation禁用该Provider本run余下角色、资格状态及完整真实CLI仍未验收。当前GitHub实读#1–#13 CLOSED、#14–#28 OPEN，未提前关闭#14。

## 最终用量观察与恶意身份局部隔离125–130

Root核125–130完整before/after一致及实际日志SHA，亲读公开测试和实际调用边界。125为maxObservedTokens配置未支持的RED；126排除两Audit后38/38、0skip/0cancelled、exit0，SHA `6a4808d69be11dba961cd967c7316d88e906d74e893977ebc6c45f224924bb2d`；127类型exit0。阈值20时首研究实际已观察30 tokens，记录exceeded并停止后续attempt，不伪称已消耗的30被事前阻止；缺usage的四研究/四主核验共8个attempt保持null/incomplete。BigInt累加已知input/output后存十进制字符串，缺值不伪称已知零。此处只消费最终AgentResult用量，单进程多次host响应之间的实时观察/在途取消及语义CLI元数据仍待实现，不能据此关闭异常用量整项。

128复现上一Root身份发现，公开produce抛agent-unknown，exit1，SHA `bca13ad3ce382a3559fc4260c836cc856e0374a9007333d5aebe90a8512860da`。129排除两Audit后39/39、0skip/0cancelled、exit0，SHA `45029966fb4d46ad9a89c3971e802d0a0a7a61b0baf7a282f1950ecf2118a761`；130类型exit0。四种schema合法的task/provider/edition/evidence恶意绑定均使AI主备attempt明确failed/invalid-output，不发表该栏，其他三普通栏保留且没有started遗留。身份检查移入inner失败收敛边界；资格撤销/来源变化及policy-violation运行内隔离仍为下一矩阵，不由本片代替。以上均WIP局部证据，尚非固定候选审查与整票验收。

## 违规Provider运行内隔离131–133

Root核131–133完整before/after一致及实际日志SHA，亲读公开用例、独立资格/隔离状态与实际主核验Provider选择。131真实RED仅保留3故事而期望4，SHA `3d4bee7e476256f0fdae06392fc3228a495c36163b451d26e38c18bc0f751b37`；132排除两Audit后40/40、0skip/0cancelled、exit0，SHA `b54bb6936ff59cfd70b5452913eb8e03fffd7c935d42bc69827a7fa65866d8d6`；133类型exit0。

Codex先完成world研究，在AI返回policy-violation后本run隔离；即使配置同Provider retry=1也不重试该违规Provider。之后Claude研究/核验，四普通栏保留，Codex仅两个研究attempt、无后续语义调用，provider-isolated明确可读。账户/地域资格与本run隔离分开，之前安全研究仍可交未隔离Provider核验；Root已要求后续高风险例确认此时复核只能review-unavailable/null，不能误称双Provider agreed或重启隔离Provider。当前routine例不代替该分支。Root另核两Runner工厂原有z.literal固定模型，身份校验未新增模型选择限制。

## 真实语义CLI接口增量裁定（尚未执行）

Root批准作者在资格/隔离主线后增加createCodexVerifier/createClaudeVerifier可信工厂，使用既有固定model/runtime/taskRoot/transport，现有VerificationInput每批≤500 assessments。新增明确版本的SemanticRun host envelope包含provider/model/runnerVersion、绑定task/attempt/inputSha256、execution、usage与成功/失败/取消状态；成功内含未经改写的Verification receipt，失败固定分类。模型只产出Verification，不能自行生成host envelope取得真实CLI来源或权限；旧Owned SemanticVerifier原receipt兼容，不凭任意unknown JSON形状授信。

router拆出验证绑定后的原receipt交真实Gate，host元数据进入独立attempt安全审计；invalid receipt不能先记核验成功。清理未证实、取消及已知/未知用量不能被Gate catch吞掉；每次respond前资格/来源/额度检查与实际响应观察保持。新增CLI帧状态机分支只由可信工厂选择Verification schema，旧create*Runner/read*Result默认CandidateOutput契约和旧输出字节不变；Claude仅允许原受控StructuredOutput，不增加任意工具、网络或shell。原1MiB输入/2MiB输出约束保留。

首条纵片为固定实际CLI+Owned语义→routing→Gate→鉴权readReport，再对称接通另一Provider并回归旧Candidate协议；Docker另行请求串行窗口。此为接口/TDD准入，不是CLI已通过，不启生产/live，也不取消旧归档、六栏、容量和最终双轴审查要求。

## 高风险隔离与资格回归134–135

Root核134/135完整before/after一致与实际日志SHA，亲读两个新增公开回归。134直接GREEN，排除两Audit后42/42、0skip/0cancelled、exit0，SHA `75152edcbcdcb3877e3cdab93ecd4cc3153e2cdd8f1cd941cf3f5122e39483cd`；135类型exit0，不伪造新RED。

高风险world在原研究Codex因AI违规被隔离后，由Claude主核验，reviewProvider=null、review-unavailable、零review attempt；canonical Markdown明确single-provider/review-unavailable，不把同一Provider或已隔离Provider当独立复核。资格前置四例分别enabled=false、accountEligible=false、regionEligible=false、过期，实际attempt全部Claude且四普通栏保留。另一例在Codex Runner开始时撤销资格版本，返回结果不采纳，唯一Codex attempt为failed/provider-ineligible，合格备份继续完成四栏。

该例覆盖派发前与Runner返回采纳时资格，不代替排队醒后、逐broker派发、已选Provider最终发表前撤销或完整安全资格收据。当前固定Owned资格不证明Owner实际地区/账户资格；#14仍未冻结、未整票验收。

## 资格快照与attempt绑定136–138

Root核136–138完整before/after一致及实际日志SHA，亲读公开鉴权读取/重启用例与资格快照接线。136真实RED为缺少qualifications审计字段，SHA `8dd369879f40e7b8435a28e29b7f57fdf22841b93f332696f78f3477f4706e30`；137排除两Audit后43/43、0skip/0cancelled、exit0，SHA `ec4505ba686578f41657f77dd6c57645f8165d75f9f2788a13348c53bddfb8b0`；138类型exit0。

Codex资格v1 enabled=true与后续v2撤销均保留，每个attempt通过qualificationSha256关联到同Provider且已启用、账户/地域合格、明确protocol-fixture范围的安全快照；无Provider配置重启run完整相等。快照按完整内容hash去重，不按provider/version掩盖同版本变动；输入资格数组最多2，快照最多16，并纳入审计转义字节预留与attempt摘要空间。

Root要求第17个不同可信快照、同版本内容变化及终态后变化有明确派发前拒绝/审计结果；当前实现有qualification-capacity-exceeded/qualification-changed保护，但本片未直接验证这些容量分支，不计通过。普通快照绑定亦不能代替逐broker资格撤销、队列醒后复查及实际CLI身份/资格验证。作者继续原完整矩阵，当前无Docker或重型测试窗口在途。

资格容量后续准入：作者报告正准备第17个不同可信快照的公开TDD。Root批准固定单项qualificationOverflow记录首次被拒快照，明确非授权证据，不进入attempt grant查找，也不把有效资格上限从16静默提高至17；固定额外字节计入UTF-8预留。首次overflow后运行级阻止新派发，更多变更不得覆盖首次拒绝证据，既有attempt必须终态并保持失败run/原安全结果的既定可读语义。此增量不新增启动写入或恢复清理权限；当前仅接口准入，尚无该边界通过证据。上一等待期已通过实时agent状态确认作者running，未因观察超时重启。

## 资格快照超限与运行级锁定139–142

Root核139–142完整before/after一致、实际日志SHA，亲读公开失败run/只读重启断言与overflow授权分离。139真实RED缺少首次超限证据，SHA `667171b3e0f103402c81d6daec346bc52e9361253641fc7896df96b2fbdc0d82`；140排除两Audit后44/44、0skip/0cancelled、exit0，SHA `c6167a833dff9db4efee8f83e7f801194054dd7ade852b56fc40be658488a8a3`；141类型exit0。

同version=1但完整内容持续变化的可信快照保留16项，首次第17项仅进入qualificationOverflow，不被任何attempt当作grant；整轮failed、无Report、无started遗留，实际外部派发数与Owned发送数相同，重启run完全相等。Root指出首次用例17以后一直disabled不能独自区分运行级锁定与持续资格禁用；142追加回归直接44/44通过，SHA `73ddb777e4b705b2398b445ca8fcd34eceeeab1fa42a4222e8aac6d776b84265`：只有第17禁用，第18本将启用，但资格读取停在17，所有实际send对应读取序号小于17，首次overflow未覆盖。不伪造新RED，也不将该边界等同全部资格撤销矩阵。

作者下一片补共享进程/外部槽各1–4、默认2；Root认可同routing装配额度首次绑定后不得就地变更，调整需新装配。新装配不能作为旧装配pending请求已释放的证明，也不声称跨任意装配的全宿主全局额度。具体并发行为及真实语义CLI仍待实施/验收。

## 可配置共享槽与额度变更143–151

Root核143–151各capture完整before/after一致、实际日志SHA，亲读公开并发run、额度变更和pending-send测试及实现。143直接RED为拒绝结果reason.code未提供预期version-already-exists，不称已复现并发2>1。144排除两Audit后45/45、exit0，SHA `fdda32277dc6971c75362f60393a6792f0129994c79002ff39162554ed9a3666`；145类型exit0。三个并行produce共享配置1的Owned研究容量，每run八个成功attempt，独立审计记录两类槽配置为1。该例外部请求配置只是记录断言，不代替实际send容量。

146真实RED：同装配额度从1改4后仍执行8个attempt，SHA `6a68dcae7bb6484e36b4724c2d45a613d0e658e583d0734cd9b124e6e26234d2`。147虽名green实际exit1：已挡派发但failureReason被通用catch压为agent-unknown，原失败保留，SHA `b85ade374aa97ebac41a54600444ac1afd731e2a41772209df4cb69cc78c75a1`；148类型exit0。149非Audit46/46、exit0，SHA `0a1dc3bcbce2dfc4e231a4e0f9729909bd03f89567cf182bf84e48151f18dc27`：新run failed、零attempt/外部请求、明确assembly-configuration-changed，先前run完整不变。只保留路由可信RoutingBoundaryError分类，旧非路由异常处理不变。

150追加外部槽回归直接非Audit47/47、exit0，SHA `95ad232abebd7e4759856562112e05421419d21614cbe222a5dc9dce6e039117`；151类型exit0。配置1或4时，Owned进程收尾后尚pending的实际send恰为1或4，八个研究attempt失败而不释放这些外部Promise名额；主动settle后原run完全不变。所有GREEN均0skip/0cancelled，实际排除Audit用例，不是完整容量或整票验收；没有Docker/真实模型请求。共享两类槽的范围各1–4/default2，额度绑定同装配；跨任意装配的全宿主限制不在本证据内。作者继续真实语义CLI及剩余六栏/历史矩阵。

## 真实语义CLI首接口RED152与环境预检

Root实时只读检查Docker Linux engine无running容器，两个已批准固定Codex/Claude镜像ID仍存在且一致，无build/pull/retag。此仅环境预检，不代表已运行语义CLI或授予并行窗口。

Root核152完整before/after一致及日志SHA `86f990a834ba675656394b864bfe25830fd591187284ed9633215c9ec78b8b5f`，亲读新增公开CLI测试。选中1项、exit1，实际RED为动态导入semantic-verifiers.ts缺模块，0容器/0外部模型请求；不是已复现CLI执行行为失败。拟覆盖Owned研究加两种固定实际CLI各四普通栏主核验，经真实Gate、鉴权Report/run及只读重启，断言实际CLI版本、containerID、cleanup、usage和dispatch计数。社会/GitHub在此输入仍Gap，routine主核验不代替条件review CLI或完整六栏历史验收。

作者现实现已批准typed mode/host envelope，实际八容器串行运行前再申请窗口；普通回归将显式排除Audit与CLI，禁止隐式启动容器。当前尚无SemanticRun/真实语义CLI通过结论。

## 首组真实语义CLI与host执行收据153–156

Root亲读semantic-verifiers.ts、协议mode增量、容器host接线与router解封装，核153–156完整before/after一致和实际日志SHA。153类型exit0；154显式排除Audit|CLI后47/47、0skip/0cancelled、exit0，SHA `a2c961e206338782b731b3821773692d90fd9c5b589c11239471095ab47b889d`。可信Verifier工厂选择Verification schema，host WeakSet封装不能由普通JSON形状伪造；router验证attempt/input/provider/model/Bundle/configuration绑定，再将原Verification交Gate，记录实际执行/清理和用量来源。旧默认Candidate路径仍需票末完整回归，不以源码检查代替。

Root再次实时检查无running容器且两固定镜像ID一致后批准155串行窗口。155选中CLI用例1/1、0skip/0cancelled、exit0，capture33760.943ms，SHA `fe22a82c504f9897e86384992a10fe76d7d47e715942292e427fcd71569cd72c`；156类型exit0。实际Codex 0.153.4四容器、Claude 2.1.252四容器，每个一次Owned模型响应、exit0/terminal completed/cleanup removed。八个完整containerID及安全usage在该日志两条JSON；前缀分别Codex c77d77e3/854cd145/66c5f9f1/36c48f22，Claude bddb16ab/a6eb164a/a4469a44/f064cab6。

各provider的一轮四普通栏均经真实Gate生成，Owner readReport/readRun与无Provider只读重启完全相等。input12/output21来自Owned响应；Codex cost未知null、Claude CLI返回cost0.0003516，不能称真实账单或实际付费消耗。没有真实模型网络/凭据，也无镜像build/pull/retag。作者归还窗口后Root独查docker ps --all完整ID，八个本次ID均不存在；既有Exited容器未动。

这证明真实固定CLI+Owned语义主核验闭环，不是live、实际地区/账户资格、条件review CLI、专用六栏或生产通过。Root另指出schema/hash合法但assessment覆盖/归属非法时，semanticAttempt可能先记succeeded而后Gate拒绝；作者已接下公开边界TDD，当前不把该细节算已验收。#14仍为未冻结WIP，剩余原矩阵继续。

## 核验覆盖终态157–159与逐响应观察准入

Root核157–159完整before/after一致及实际日志SHA，亲读公开三场景及统一validVerification。157真实RED为缺项receipt使attempt仍succeeded而预期failed，SHA `205a2e25ce604d7c142fea5f4843b7fce05b95df1278bccb288e3d71b2d30037`；158排除Audit|CLI后48/48、0skip/0cancelled、exit0，SHA `654e2d7b6a302468be0b1ab4a3e35bfa00d715390e73a8c2b2f41a7bb94faaa1`；159类型exit0。缺项、重复、foreign story三类schema合法/hash匹配评估均在attempt成功前按完整story/claim/evidence覆盖拒绝，world核验failed/invalid-output，其他三普通栏保留，Owned execution=null、重启run完全一致。没有伪造实际CLI来源。

Root批准下一host dispatchControl.observeUsage最小增量：实际Runner/Verifier读取每次响应后观察白名单safe usage，仅绑定本attempt真实已dispatch请求序号（1..实际modelRequests、最大8）；模型正文不能自行增加收据。相同请求不得双计，重复/冲突及未知转已知规则明确；CLI聚合与broker请求来源分别保留，不相加重复计量。冻结run或已终态attempt的迟到观察不能改旧审计，阈值保护只描述已观察下界，可取消在途并阻止新send，但保留cleanup grace/熔断和外部Promise实际settle才释放槽的生命周期。

新增数组、数值与安全元数据须同时纳入审计最坏字节预留，不存原始响应。本项尚为TDD准入，不记实时用量保护已通过；作者继续实际响应/条件review/旧Candidate协议回归及完整六栏历史。Root建议在轻量checkpoint先跑既有纯协议测试，Docker仍另行协调。

## 逐响应观察控制160–162

Root核160–162完整before/after一致及实际日志SHA，亲读公开host控制测试、计量/取消逻辑及Codex/Claude Runner与新Verifier调用observeUsage的接线。160真实RED实际send8而期望1，SHA `b6e2736499b873ac9205f41e85270e6ad432b971899121b2e95c7ee25fc9e10c`；161排除Audit|CLI后49/49、0skip/0cancelled、exit0，SHA `619e3ea8d723417ff1e1ce6076c7d3dc73ed31d4f182c8c814928acdbda193b3`；162类型exit0。

四研究已观察120 tokens，首语义response增加40使已知下界160超过150阈值，实际send仅1、仅1语义attempt、usage-budget-exhausted；不等待最终语义receipt才止新send，后续核验不启动、无故事发表，重启run完整一致。observedResponses最多8，序号只允许已派发范围；input/output按每字段broker合计与最终CLI观察取较大值，不相加双计，cache/reasoning子集不再额外加总。

当前规则为首次观察不可覆盖（含unknown→known冲突），相同值幂等，终态观察忽略；Root已要求以公开回归分别验证重复/冲突、未派发序号、迟到冻结和CLI/broker不双计，不能以源码存在替代通过。此片实际Owned host控制，不代表新增observe接线已在固定CLI重跑。作者将增加保存旧Candidate帧的纯parser回归，仍须原Docker Runner suites及票末整套验收，不把轻量回归替代真实CLI旧协议资格。
