# V1-13 执行与待验收记录

状态：in-progress；正式research已完成，Root已审阅完整提案并批准最小共享契约及首条Release纵向TDD；GHSA完整修订规则和动量参数/episode证明尚未冻结。GitHub #13 OPEN。

## 固定任务与依赖

- [本地票](../tickets/13-github-repromotion-events.md) / [GitHub #13](https://github.com/yiwer/Observer/issues/13)正文、空评论已实际读取。原生唯一依赖#12已在2026-09-06T04:00:51Z关闭，Root重新读取关系为closed。
- #12最终实现41020f40a424d00b868085822796cdee32b6599d、实际master集成2d93d40a463af7fd64485383dca32ff92a64ebb0均可达；作者/Root detached/实际master各306/306与smoke3/3，双轴及全部回放见[#12记录](12-github-heat-and-novelty.md#实际master验收与关闭)。
- 固定base **ec9b91c3e8575f7f3f3dc363d1d35ffb6319fce3**；Root确认路径/分支不存在后创建`O:/GenesisCode/Observer-worktrees/v1-13` / `ticket/v1-13`并实核clean。
- fresh `/root/implement_v1_13`为唯一产品作者。另有fresh `/root/research_v1_13`按research skill核查官方Release/GHSA等接口、关联和授权/可用时刻证据，仅写该树`docs/research/github-repromotion-api-contract-2026-09-06.md`，不stage/commit；写入范围与产品作者互斥，作者须亲读研究再制定方案。
- Root已将#13分配给`yiwer`并单次发布[启动说明](https://github.com/yiwer/Observer/issues/13#issuecomment-5556791129)，随后通过独立comment API实读完整body/id/url，并实读票为OPEN、assignee为yiwer；此为启动回写，不是实现或验收通过。

## 待先行确认的实施边界

三类重大进展均需来源证据、稳定事件及实质修订身份；stable Release不自动等于重大变更，不从package名字猜仓库，不把未知安全信息视为安全。极端再次增长的分位/最小样本与事件竞争须独立固定回放后冻结，研究例子不是参数批准。

只在实际成功出版的最终事务消费一次性事件，重复采集/重试/改名/编排不重复消费；仍满足至少ceil(actual/2)过去30天未报道位置，质量不足缩数并明确选择/来源/历史缺口。若业务语义与批准规则冲突，回到Root/Owner，不静默放宽。安全项只作影响范围/证据明确的风险更新；不执行项目代码、不另造安全扫描器。

作者须亲读implement/TDD/tests/mocking/codebase-design、CONTEXT、票/PRD D8/T1/AC-09/ADR0003、当前#11/#12实现及研究，先回报局部Interface/契约增量、来源收据与最终同步事务、事件规则/参数回放与第一条公开tracer；Root确认后才逐片产品RED→最小GREEN。

## Root方案协调与首片批准

Root重新读取PRD D4/D8、requirements-baseline第112行、ADR-0003及当前评分/出版/归档入口后，确认以下既有语义约束：

- 事件只令冷却/恢复因子`recovery=1`，保留90天频率惩罚；作者最初两因子都恢复的备选不采纳。不改变普通Heat v1。
- 无逐事件人工assessment或override。重大Release不能只凭stable标志、tag主版本或标题词语；可以提出受信装配的窄外部语义核验Interface，但Schema/哈希/引用匹配只证明收据一致，不证明真实重大性，真实模型质量仍另验。
- 长期已消费事件不能复用普通热度的90天截断；需在方案中明确古老来源撤权/档案损坏时的保守行为、A→B→A及跨来源表示的重复抑制，并在成功出版事务内同步复核全部新增历史和权限。
- 新Record10发表后，旧Request8生产仍需把实际已报道节点计入普通Heat历史；已存Record1–9正文/reader不改。最终新Schema编号和持久结构仍待完整方案批准。

Root已全文亲读作者树的`docs/research/github-repromotion-api-contract-2026-09-06.md`，并独立读取GitHub官方[immutable Release说明](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases)及[global/repository公告编辑权限说明](https://docs.github.com/en/code-security/reference/permissions/repository-security-advisory)：不可变Release仍可编辑说明/标题等，同GHSA两种表示的内容不会因global编辑自动同步。这是接口事实核对，不批准真实源或默认参数。

研究最终207行、26个引用；Root实算SHA **DB4804805A70988FA699D0D1E4F45057436E7EA14832118B4401379A4A188949**。research作者只写该文档、未stage/commit，允许实施作者将其纳入本票提交。另fresh只读design-risk审查回报5项实施前陷阱：新Record历史漏接、长期去重、正文与消费不一致、正向事件错误解除隔离、语义处理的权限/cutoff穿透；报告亲读时完整提案尚未出现，因此不是对提案或未存在产品的PASS/缺陷验收。

Root随后全文读取作者`docs/implementation/v1-13.md`，批准首条Release纵向slice及必要共享增量：显式可选events能力、同一observeDue装配、组合repromotionSnapshot、窄外部DevelopmentVerifier、Request9→Record10/Version9/Canonicalv8、独立repromotion-v1、成功Report唯一消费事实及旧Request8识别新Record10实际节点。批准附带以下必须先写入方案并落实的条件，作者可修订后直接开始第一条RED→最小GREEN，无需重复等待Root：

1. 新组合authority检查在最终Report事务中必须只读；现有`authorize`内部会开启观察库BEGIN IMMEDIATE，不能直接复用却声称无跨库写锁。同步复核所有新增历史、source与config，无await。
2. 已有slot只有旧run时，不能补写事件并继承旧availableAt；明确事件收据缺失并留待后轮，保留先提交可见事实。
3. 原文处理本身受字段许可约束，不仅约束verifier参数。最小投影、错误/日志/持久收据不得泄漏；每个旧development投影的来源许可分别检查，不能用新源权限覆盖旧材料。
4. 本次未冻结GHSA完整实质修订规则和动量p/min/绝对下限/重新武装时长。2,160小时证明上限是待定提案，需先给精确可重放状态、容量与截断行为；不可把自报previousEpisode当权威。先独立固定输入与方向期待回放，再批准。
5. 首片逐条验证实际Record10成稿可见development与消费集合一致、双库重启、旧Request8继承历史；未覆盖类别保持pending，不能将第一片GREEN当作整票完成。

## 首条真实RED与Root回放准备

作者已先运行`node --test tests/github-repromotion.test.ts`：0/1、native exit1、255.7967ms；旧`SourcePolicySchema`严格拒绝新增`github.events`，这是尚无新能力的真实RED，不更改预期。原日志`Observer-worktrees/v1-13/data/v1-13-slices/01-red/output.log`由Root实际读取并重算SHA **D5562A956A1C62952B12B9481C0E4CB4ABFBBE7B009B6A60EA2FD9D823F5C880**。作者报告原工具执行UTC为2026-09-06T04:23:58.9646351Z→04:23:59.3099308Z；该目录当时没有metadata文件，Root未将后补登记冒充当时自动capture。最小GREEN尚未报告。

Root不读取作者测试helper，仅依公开新契约独立准备`Observer/data/root-v1-13-review/`下三期改名重放与长期事件反例。均仅通过`node --check`，尚未执行业务，不能计入PASS：

- `publication-fixture.mjs` SHA **5F74C55853944F98161418C96E02EBBB7F7917F3C4016355B6952360080A91A8**，Owned HTTP与外部语义替身、真实双SQLite、无真实网络；计数按绝对观察日期递增，确保重复候选仍有正实测动量。
- `release-replay-probe.mjs` SHA **4CA63FF501FED204BC9664DFEF3FC58C2F049A9650E4D5C11104C61D61585738**：先旧Request8实际报道、再新Release成功升权/成稿、双库重启与改名后重放被抑制。
- `long-lived-release-probe.mjs` SHA **4DE35DC105B9DED5AA5C009CE7851A33A193434DA6B9CDFED4F42F13973C1838**：事件发表逾90天后先由Request8正常再报道，再次冷却内重放原事件仍不可升权；不能把普通入选与新事件绕过混为一谈。
- `capture-probe.mjs` SHA **9EA303E255544E6F5E404279EF37E5A90FE5BB0A635B5B7754C443139B214B5A**：单原始fd、fsync、进程实际UTC/exit、全部入口模块与Root脚本前后指纹；不传expected SHA时明确是WIP诊断。此时只做语法检查，capture自身尚未运行。

Root等待首片GREEN/类型通过后的短暂源码冻结再执行独立诊断，避免测试半接线或并发漂移代码。所有原失败/归档/旧oracle继续保留。

## 2026-09-06晚间UTC：实核接续

新的goal continuation中，Root实时agent inventory只返回Root，原实施作者handle已不存在，并非因等待超时推断停止。实际作者树仍为`ticket/v1-13` / `ec9b91c3e8575f7f3f3dc363d1d35ffb6319fce3`，有10个src修改及6个新增文档/产品/测试文件；未有产品提交，切片证据仍只有原01-red。Root主树仅无关`.idea/`，#13重新实读OPEN、assignee yiwer，Node v24.18.0。

Root以现态运行`npm run typecheck`，exit1；唯一TS2345在`src/observer.ts:493:91`，失败路径的`schemaVersion:1|2`联合类型不能传给新authorizer。此为恢复时只读诊断，未创建当时自动metadata，不作为固定SHA关闭证据。

已派fresh `/root/implement_v1_13_resume`接续原WIP，保留原代码/测试期待/失败，不reset或重建。新作者仍是唯一产品writer，须亲读skills与完整票/已批准方案，先恢复首tracerGREEN，再推进整票Release、GHSA、动量；后两类尚未冻结的参数/证明须继续协调，不能把首片当完整交付。Root额外指出当前WIP尚缺的事件归档依赖复核、旧development比较上下文和中途developmentConfiguration授权，要求后续逐片公开负向验证。

另准备未执行的Root `event-history-integrity-probe.mjs`，SHA **9F9934352ACBA2D008D6E717815F6295DE325C0557C026CA7AA4B6FFC19894D4**：仅在新建Owned测试库做可恢复故障注入，去掉真实旧刊的已消费发展，再用公开重算/正文函数构造内部自洽的错误新刊；公开read必须因与真实旧刊历史不符而拒绝。其SQL仅用于注入并finally恢复，不用SQL断言产品结论。目前只通过语法检查，不计PASS。

## 首GREEN后的独立诊断（非冻结验收）

接续作者修复失败fallback的联合类型及Development严格投影字段顺序与哈希的一致性后，首tracer在`04-first-green`实际1/1，402.8931ms，UTC2026-09-06T19:30:20.760Z→19:30:21.239Z，exit0，log SHA **11b6ad275a94861a81f1e1d049770e1f2eb1974b7e9868fdd14eb3ae0a1c145c**；`05-first-green-typecheck`在19:30:22.011Z→19:30:23.914Z exit0，空log SHA **e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855**。

先前`03-first-green-attempt`原失败保留：0/1、385.5833ms、19:24:50.311Z→19:24:50.775Z，exit1，`github-repromotion-input-invalid`；log SHA **742b8835059b5e2f902bbeef172c720d0394b948b1d1d1d46840274f4fb7deed**。`02-resume-typecheck`修复后已exit0；它不覆盖Root恢复时的TS2345诊断。Root亲读作者capture、原失败/成功log，并独立解析02–05的metadata、重算全部日志hash及比对完整before/after identity。所有src/tests前后同，均为WIP不是clean代码提交。

作者随后短暂冻结产品及文件清单，Root用原未修改脚本/fixture首次执行3组公开诊断。各自metadata包含完整模块/Root脚本前后hash，均不变；使用真实UTC、单原始fd、native exit，各自新目录：

| Root目录（`data/root-v1-13-review/`） | 实际结果 | UTC（2026-09-06） | 原始log SHA |
| --- | --- | --- | --- |
| `wip-first-green-release-01` | 1/1，187.154ms，exit0 | 19:31:08.470Z→19:31:08.872Z | `dc11bfb26460f439610376dc4de52d68fad86fcc3d352c5af41249c0e9b465b6` |
| `wip-first-green-long-01` | 1/1，212.157ms，exit0 | 19:31:09.518Z→19:31:09.958Z | `0bcef98e8fd4ac946bcf07d77fdc03e171e3d8358ff39d8fc30f379e7c3aaa0a` |
| `wip-first-green-history-01` | 0/1，167.4744ms，exit1 | 19:31:10.611Z→19:31:10.993Z | `cc68478667f28e600c32fcb3da10433785b941076ece9d526a38f45bf78ada13` |

第三组是产品缺口而非harness失败：真实第2期已消费Release；在新建Owned库将第3期eventHistory中对应旧刊entry.developments置空，保留真实versionId/Record SHA，并通过公开ranking/Markdown函数重生成自洽的第3期。仓库因此错误获得新事件资格，`readReport`未抛拒绝。表明只重算当前排名而未将声明历史回核真实旧刊。故障注入在finally恢复原Owned payload，未动用户库/原oracle。Root已解除冻结，将该反例交作者按下一片公开RED→修复→GREEN处理；完整旧刊SHA/node/development/policy/date/time及新增事件权限需同步核对。原Root期待保持，修复后重新运行。

此阶段只证明上述两个正向诊断通过，并明确一个未修复缺口；未进行本票完整check/smoke、最终双轴、固定SHA或实际master验收，GHSA/动量仍待继续实现。

### 归档历史缺口已在WIP原反例闭合

作者独立新增第二条公开测试，`06-history-red`实际1/2、532.7645ms、UTC19:33:31.732Z→19:33:32.339Z、exit1，`Missing expected exception`，log SHA **eeb94b36ecec75500a389c722776b15d18b4e67b2b7a2f24449da3e0940100ed**。修复新Record10公开read：核本刊development来源权限，再从实际旧刊重导完整eventHistory并比较entries与unavailable，既覆盖字段伪造，也覆盖整条遗漏。

`07-history-green`实际2/2、543.4837ms、UTC19:34:17.730Z→19:34:18.343Z、exit0，log SHA **dd7d692b5e7d5c33b153ab009a609cd5b009b48e12172be04bd4e628ad5e6e37**；`08-history-typecheck`19:34:19.081Z→19:34:21.052Z exit0、空log。Root亲读06–08log、解析metadata、重算hash并检查before/after一致，不把新2/2覆盖原失败。

作者再次短冻结后，Root原3脚本及输入不变重跑，全部1/1；实际模块/脚本/status前后不变：

| Root目录 | 实际时长 | UTC（2026-09-06） | 原始log SHA |
| --- | --- | --- | --- |
| `wip-history-fix-release-01` | 189.4683ms | 19:35:04.657Z→19:35:05.062Z | `4de3cf9c765b6818272671078bb66bdc1994b3b37c47cb273c731d1db1a2f4bd` |
| `wip-history-fix-long-01` | 227.9043ms | 19:35:05.745Z→19:35:06.183Z | `227213daa2095cf40478f567c883cef3c4d68112e65f530b780281f652f7112f` |
| `wip-history-fix-integrity-01` | 188.5587ms | 19:35:06.864Z→19:35:07.253Z | `cda26570d9d2b195a458f8439ea3add34af3b1bd8aeafec58c42a523bf5750f1` |

Root只读核对`observer.ts`确实重导真实历史，已解除冻结让作者继续中途development配置/版本权威及Release跨修订上下文；此修复仅WIP闭合，不替代本票完整验收。

为并行推进未冻结动量设计，Root派`/root/v1_13_momentum_design`只在`Observer/data/v1-13-momentum-design/`写Owned固定输入/预声明偏好/独立参数比较和episode证明建议，不写作者src/tests/正式规格，不自动批准阈值。主作者已协调不重复另写模拟，仍为唯一产品writer，获批后必须用实际公开TDD落实；模拟结果不是产品测试或真实GitHub质量证据。

### 配置权限切片及跨修订契约

作者`09-config-change-red`实际2/3、565.9651ms、19:35:55.227Z→19:35:55.856Z、exit1，原文在配置被禁用后仍送到外部verifier，log SHA **11d7a070b27681cd8b99dffe2902762ea1834214808bad55bf5f007a5d1a9c70**。修复为observeDue首await前冻结developmentConfiguration，每HTTP/模型前后重核；`10-config-change-green`3/3、599.2267ms、19:36:28.446Z→19:36:29.117Z、exit0，log SHA **df69592783bfc95407e8949dccef0249ad905a9aa28f114e30ce3393ad85e353**。

配置版本片保留两次不同含义的RED：`11-config-version-red`3/4只先观察到缺少冲突Gap，fixture的Release发布时间尚在未来，不能声称该次已证明原文泄漏；log SHA **1b978e3435a8f8de84d004b503dd8c496b47299d5272ac5688da175172aa826b**。只把观察时刻移到发布时间后，`12-config-version-red-valid-time`3/4、643.3909ms、19:37:11.342Z→19:37:12.055Z、exit1，实际观察到禁用/回滚后原文外发，SHA **189684f36b15567c7583d65c7e41bb5327690049b09f7a17368c99ff6e23ff66**。持久authority表新增development配置版本/摘要并拒同版编辑和回滚后，`13-config-version-green`4/4、707.3074ms、19:37:12.783Z→19:37:13.567Z、exit0，SHA **612f02c082f48a81ed1fde0ba1bb57e67fc2394eaa1940ad8acfc2fca26dfff6**；`14-config-typecheck`19:37:14.284Z→19:37:16.163Z exit0。Root实读09–14原log/metadata，hash及全部before/after核对一致；仍为作者WIP片，非Root独立该项验收。

Root批准未发布Development assessment receipt增加`previousEvidence`，同步加入输入摘要与严格重算；每个previous按observationId、node、原policy、availableAt和足够的原父run身份精确绑定，不把复制ID当权威。旧证据必须在本轮上下文冻结时已可用，逐原source核各阶段许可；same必须引用输入内合法development，实质新修订与A→B→A查询全量已知和已报道身份，未知不转为空。每仓库1000个development上下文仅是容量提案，不能无限all再slice或让每小时重复收据消耗上限；新增索引DDL须先协调。已允许先推进可界定小量真实run的跨修订TDD，容量问题仍pending，不可带未解决无界方案冻结验收。

### 动量设计固定输入（比较前）

设计agent在比较器尚未编写/运行时冻结`data/v1-13-momentum-design/fixed-inputs.json`，SHA **485316017ACB919DEA0F16B58035B52ED5CD3CA77A16993BFE50418C2B7CDD9C**，及`expectations.json`，SHA **129D97D708694FB387341725C431E2816553D71E1C45BADCE6BD3542972FB522**。Root亲读全部方向期待、独立复核hash，并程序遍历20场景/266帧/5459行：非负整数计数、双点先后、截止可用性及同node同观察时刻计数一致性无异常；这只是输入校验，不是产品或参数通过。

Root已提示两个解释局限：场景09同时标记总体不完整，不能单独证明零/负/cold等每个过滤器；min20与midrank p0.975有数学耦合，最小样本的独立影响还在cohort fallback，不能冒称独立统计校准。普通takeSnapshot只保留当期双点且按当前config/policy筛历史，不能直接担当长期episode证明。reset证书及新onset必须保持可比规则/采样语义/peer输入；仅切换查询使分位降低再切回不能造新episode，严格peer可比性可能抑制真实发现的取舍需明确。全部阈值/证明仍待比较后Root批准。

### 2026-09-07 UTC：Release跨修订WIP与GHSA批准

Root实核作者15–28各目录的原始log SHA和完整before/after状态、源码/测试指纹，均一致；仍在作者基线`ec9b91c3e8575f7f3f3dc363d1d35ffb6319fce3`的未提交WIP。以下为新增局部证据，不替代完整票验收：

| 作者切片（`data/v1-13-slices/`） | 实际结果 | 原始log SHA |
| --- | --- | --- |
| 15-legacy-policy-red | 4/5，exit1；旧metadata-only政策错误阻断普通Heat | `1f8da9f9250691af2dc028f519621a19c28e5f3d1f012bedb00da1acb0f9c4ac` |
| 16-legacy-policy-green | 5/5，exit0 | `e67bba3ac17dce9434dcc20420857fb9d5b364f582f125a89b1c4f07c9ec8d13` |
| 17-local-regression | 147/147，exit0；受影响旧局部组 | `a8f1d96ac040509f9acc95c0b78e3f8c46b755729fdea0d974382820e15785d7` |
| 18-rephrased-release-red | 5/6，exit1；新Release ID加改写错误新增发展 | `a4a3ea63b7a8b7052a0e3504c2b9e0e26e5db4142e6415f3aa31157a5a576b1a` |
| 19-rephrased-release-green | 6/6，exit0 | `0bcf928177086a6c814e071b9e588d7c0865801dd6bbf2eaebf5b3d6a10e3f2e` |
| 20-context-typecheck | exit2；SQL slot联合类型错误，保留 | `f4d786dc1a2ca519717501166f3d40f1bd7828b381fc22b92e79e42e39aa4e54` |
| 21-context-typecheck | exit0，空log | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 22-context-regression | 6/6，exit0 | `2d35dc61bbd499b25f311d14645bb24a4be5421f721b7ccc31f979029c4adec0` |
| 23-release-revisions-characterization | 7/7，exit0；实质B可报道，A→B→A抑制，首次GREEN | `ff923b3a589e2e13c5b0fead4d4956640f4591cc38f2ebb551bd7ec3c4c76f21` |
| 24-routine-release-red | 7/8，exit1；未错误入选，但正文遗漏非重大性说明 | `f642991477a9a91e6a451d566958bc2952a817268392cb8c7ed09941912d9862` |
| 25-routine-release-green | 8/8，exit0 | `3d72cd7ed9b6e3bce1923b3abae55ff27e7c55c74365e69bb44d8b6b2442fd5e` |
| 26-old-source-rights-characterization | 9/9，exit0；旧source撤model权，首次GREEN | `9863da8d2b7da80d99412b79ba6ea0613f94966916b63b0f25fc2724dda09c44` |
| 27-event-quota-characterization | 10/10，exit0；3 novel最多6位，仅实际3个Release消费 | `73fb1622660635698fa4df1d08e576a22670b1dbe5ffccf96057a6335012f923` |
| 28-insert-failure-characterization | 11/11，exit0；INSERT失败可重试，同日冲突不改已刊 | `0f3738e5dcba3bfc1806d75fedc2e741fa2a7c24041af79d61e69394c0dc6962` |

各次真实UTC完整保存在相应metadata。关键跨修订RED18于00:47:56.285Z→00:47:57.504Z，1120.0789ms；GREEN19于00:50:05.890Z→00:50:06.913Z，946.5735ms。Root亲读新增`previousEvidence`契约和实际历史loader：保留父run定位、原配置/来源与证据ID，生产从真实两表核对，但当时仍遍历历史run，长期容量未解决。

Root全文读取更新的实施提案后，批准GHSA增量进入逐片TDD：可选且无默认的`allowAdvisoryBodyProcessing`与`advisories`配置；仅global表示；初次完整风险、新增包、范围实质扩大、high→critical、新修复/缓解五类；security→release→momentum竞争；保留频率、新颖、质量门。附带条件已发作者并由作者回写方案：

1. 真正初次不要求不存在的previous；已知但不可用不能变空并冒充初次。
2. 列表/详情冲突不能吞掉；两个明确映射线索须实际落到stable node，改名但同node不算冲突，无法核查不任选。
3. 历史GHSA补查集合有可核原来源和完整性，不仅看最近run；超50或补查失败的已关联node风险不确认，隔离并显示Gap，不能沿用旧good。
4. 漏洞条目、投影、收据各维设有限完整性上限；超界整条风险fail-closed，不截断成完整。
5. 中途配置/正文/旧投影撤权、cutoff、降级/撤回、表示切换和映射冲突需分别公开验证；不是批准生产来源或真实语义质量。

作者随后提出`development_contexts`首次发展索引及`context_index_state`分批补建，Root认可有界定位方向，**尚未批准DDL**：每node LIMIT1001/最多1000唯一发展、row64KiB、总proof16MiB、每轮旧slot100的工程cap可继续细化；必须补索引漏行/部分丢失、state丢失、并发/较早slot插入和完整上下文遗漏检测，原run载入也先验字节上限。实际观察DB提交可承担已知历史权威，纯输入局部重算不冒称证明全部历史不存在，不要求抵御任意恶意整体重写DB的虚假常数加密证明。索引不承担成功出版消费，原记录/身份不删除。

### Root独立跨修订回放

作者Release稳定点短冻结后，Root原3脚本和原fixture均未改，新增`release-reissued-id-probe.mjs` SHA **6843FA06DB575FFDEF89913E54DAA0356D15EC9DBAD001B239BCED933679D48E**，不读取作者helper。新增场景真实发表707，再改名并以708重发同一正文，要求verifier收到707原发展及原证据，708不能再救冷却候选，双库重启后新旧刊均可读。只用了Owned响应和真实SQLite。

| Root目录（`data/root-v1-13-review/`） | 实际结果/时长 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| wip-revisions-release-01 | 1/1，201.3828ms，exit0 | 00:58:39.072Z→00:58:39.502Z | `f3a2e45f4590f1bc24ff0e93e73ea67fdf6de16ea92109088af424b850bf3d2e` |
| wip-revisions-long-01 | 1/1，248.8588ms，exit0 | 00:58:39.864Z→00:58:40.327Z | `72b34719e634224120e4f3a35cb6ef1dfdfde3998077efafc0a59f75a89808ec` |
| wip-revisions-integrity-01 | 1/1，220.0054ms，exit0 | 00:58:40.660Z→00:58:41.090Z | `c5acd2298f68f6d687f99a4b1dd155db24b6945527eef28e061e6247aaf5117b` |
| wip-revisions-reissued-01 | 1/1，206.4749ms，exit0 | 00:58:41.406Z→00:58:41.822Z | `191384b2177aea86d6a8055740d3c0c38e3c7bbbc2da86ebe0d56920e7f78792` |

Root重算各loghash并比较完整before/after（模块、Root脚本、HEAD/status）一致，已解除冻结。四项仍明确`wip-diagnostic-not-closing-evidence`；不掩盖第一次真实历史漏洞，也不替代最终clean SHA与实际master验收。

### 动量比较初读（参数与证明仍待最终批准）

`compare.mjs` SHA **32b96a96f4408c808938f037500755655055cc2403cd5fa7e846736b10a9c533**、`run-01/manifest.json`记录实际完成00:54:08.078Z。Root全文读比较器，重核原输入/期待SHA未改，程序完整解析9份结果、各5459候选行，独立核真实间隔折算、midrank及同信号组合，并核各31项偏好与summary逐项一致。baseline文件SHA **372897aba254dc617604df68014b385645bd8180dd3ebe9af3514b54f00b5b72**。

| 候选 | 偏好差异项数/场景数 |
| --- | --- |
| p0.975/min20/100stars或20forks/24h | 0/0 |
| p0.95 | 2/1 |
| p0.99 | 16/13 |
| min10 | 1/1 |
| min30 | 12/10 |
| 50stars或10forks | 3/3 |
| 200stars或40forks | 7/6 |
| 12h重新武装 | 2/2 |
| 48h重新武装 | 1/1 |

这是合成设计偏好比较，不是31条产品tests或真实满意度校准。p99/min30多数生命周期差异来自根本无首次资格，不能误称状态机错误。场景09多门同时关闭，场景17返回A时部分peer缺样，二者不能分别孤立证明所有filter或reset可比性；原输入不改，真实产品后续独立对照应补。Root正在等待完整有界onset/reset证明建议；反对仅靠自报checkpoint hash，但认可真实DB权威与局部可重算证明分层。2,160小时/26点旧提案仍未批准。

### 动量参数与局部证明语义已批准

Root亲读独立`README.md`及`episode-proof-design.md`全文后，批准推荐`.975 / min20 / stars100或forks20 / 24h`进入后续公开TDD。采纳是编辑/工程取舍，不把合成零差异当作统计最优。具体新增决定：

- 同一信号同时达绝对日均增量与分位门槛，language+age→age→全部measured回退；普通Heat保持不变。
- 完整measured的零/负增量可以支持non-extreme；unknown、来源/风险不可用、缺样、截断、样本不足不能。退出用实际观察UTC，连续至少24h、相邻不超过90min，不因移动cutoff或重复使用同一观察而推进。
- reset全段与紧邻首次新extreme固定规则、采样语义、目标cohort语义及精确peer集合；显示版本/改名不生成身份。满24h后缺样也丢弃待用reset，保留旧episode及消费。无须与多年前原onset池永远相同，但不能切池制造新高。承认严格peer稳定性可能降低现实召回。
- 采用局部原始onset/reset证据纯重算，加实际观察/Report成员与完整性复核；不递归复制全部历史，也不把自报checkpoint变成权威。首次startup超界仍可在未来完整reset后建立有证资格，不能因任意2,160小时上限永久锁死。
- 允许实施并实测的资源cap：reset最多28评估点再加1 onset；初始startup最多28点含onset；每点评估最多50候选双点；每capsule最多8MiB；每次momentum共享proof bank最多32MiB/50个capsule。按opaque node Unicode码点顺序分配，超界对应动量Gap，不能先赋资格后删证据。它们是显式资源界限，不声称已证明调度恒足够或容量性能通过。其他事件/普通Heat依其独立证据继续。
- 本票保留必要证据，不执行#22清理。实际持久DDL、完整性索引和输入Schema仍由唯一作者给精确方案后协调，尚未批准动量DDL。

设计作者在上述全文初读后又追加实际Seam澄清及批准记录并冻结。Root亲读所有追加内容、独立核最终SHA：`README.md` **79BE11CE18BE5ADD89C366267E07C277362D5288D164C685D01B65E3ADC08F75**；`episode-proof-design.md` **B9F591F751944831B35198A5F03FC96336A9F93BA4C989D80EFFFB9C8D85D70D**。reset加onset的原观察引用上限为29×50×2=2900，原2800仅指reset本段。原固定输入/期待/比较器/run-01保持不变。允许实施作者将必要固定输入、比较脚本、解释文档及摘要manifest纳入正式参数目录，原100MB完整轨迹在data保留、可确定性再生，不必须全部纳入git；不能改期待或丢失provenance。另给同设计agent一个独立有界索引反证任务，只可新增scratch审阅文件，不修改上述冻结材料或产品，不自授DDL批准。

Root另独立准备`novelty-withheld-consumption-probe.mjs`，SHA **38CAE871B18E8960E29B51595F332C10C725EEC7AF553418E7EEE19C0333A0E8**，场景为已采重大Release因0 novel未入选，下一期出现novel才真正消费，空刊不增加频率。当前仅`node --check`通过，未执行业务，不计PASS。

作者后续日志由Root实读并核29–32 metadata/hash与完整before/after：29类型检查exit2是新增quota测试闭包类型收窄遗漏，SHA **4d149fb8d84a57d342eb31fd46f0fb69dd231016f8c7b191c84002d0410e6f7f**，原失败保留；30 typecheck于00:58:10.035Z→00:58:11.930Z exit0；31 Release于00:58:12.688Z→00:58:14.528Z、11/11、1762.3147ms、exit0，SHA **b21e61157ab5eafe3f801c9ecd8e355b708aa3f1d31133571eaff209d3d49ece**。32首GHSA tracer于01:01:07.682Z→01:01:08.012Z、0/1、253.808ms、exit1，未实现的DevelopmentConfiguration严格拒绝`advisories`，SHA **33b10dfd6f3b3f398913221e63933ff9a3cce364d3972b5ed307038ce22629ad**。这是实际新能力RED，不是已完成安全公告验收。

### GHSA首片与当前风险隔离切片

Root亲读新`github-advisories.ts`、`github-advisory-contracts.ts`及权限分派源码，并核33–39各metadata/loghash与完整before/after一致。首片仅覆盖明确node映射、reviewed且high/critical、完整有限scope的初次风险更新；两个显式映射分别走现有仓库Adapter核同stable node，不靠包名猜关联。已有公告补查、实质修订、冲突/撤回和有界历史仍需后续实现，不能称整个GHSA已完成。

| 作者切片 | 实际结果 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| 33-first-ghsa-green-attempt | 0/1，exit1，372.5241ms；新测试Markdown转义期待错误 | 01:06:50.511Z→01:06:50.965Z | `a6c167f695b5e562b1f4d53b898e129908b3d1a69ccb130e92cb57bacfb69da4` |
| 34-ghsa-typecheck | exit0，空log | 01:06:51.731Z→01:06:53.729Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 35-first-ghsa-green | 12/12，exit0，1788.312ms | 01:07:12.031Z→01:07:13.893Z | `9c0df4161741fadf7b716fa647bc0e9acd0ea8fe87813f040ab68108e351e57a` |
| 36-ghsa-unknown-risk-red | 1/2，exit1，455.505ms | 01:08:43.950Z→01:08:44.470Z | `6bf420259e4d648a87d50e6110156b96934d7459e8cd335b049da4b35d6bd82c` |
| 37-ghsa-unknown-risk-green | 13/13，exit0，1839.116ms | 01:09:48.832Z→01:09:50.745Z | `e7224503b1a92ed2764860ea8b7b6f7dd0b990032603f47d99b630ed559271e2` |
| 38-ghsa-risk-typecheck | exit0，空log | 01:09:51.595Z→01:09:53.548Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 39-known-ghsa-refresh-red | 2/3，exit1，562.13ms；已知公告不在增量列表且补查失败，冷却过后错误普通入选 | 01:11:26.861Z→01:11:27.497Z | `6871bd3ea9a01b34fa8d092d2ef5623b25d2d2c1e8abd7148a0b83f9c48d0c83` |

33原日志保留，Root查看失败头及当前测试相应断言：范围`>=1.0.0 <1.2.0`在Markdown按既有规则输出`&gt;`/`&lt;`，作者只修正新测试的显示映射并新增Record中原始scope精确字节断言，不把该次归为产品漏洞或修改旧oracle。36则是真实审计/正文缺口：节点已排除，但候选reason仍可能表示selected并缺风险说明；Root批准新Repromotion增加严格隔离理由，原Heat枚举/运行默认保持，renderer只接受展示投影而不承担权威验证。37已在作者局部闭合，Root独立该项尚待稳定窗口。

Root独立新增`security-scope-probe.mjs`，最终首跑前SHA **7ED671F4F37D38D6BA66CA4E32A7C338328BA7617CA5A5114DFEB1B493DF48D9**，2个预设场景只使用Owned官方形状响应、真实两库、公开observe/produce/read/restart：advisories-only配置且Release字段许可false；完整scope可作为风险更新救冷却；相同公告scope为null时，**此前未报道且普通正分**的项目也必须被隔离并显示unknown。第二项不利用冷却先行遮蔽风险门。脚本在首次运行前明确该对照，仅语法检查通过，尚未运行、不计PASS；与0novel probe等待作者GREEN/typecheck后短冻结一起执行。

### GHSA补查修复后Root六组独立回放

作者39反例在`40-known-refresh-green`闭合为14/14、1896.6266ms、exit0，UTC01:19:18.310Z→01:19:20.282Z，SHA **8051a0d7250176c8ff87e85718e0d1c2627a899a2e99d7a13a80486c982aaf9d**；`41-security-refresh-typecheck`于01:19:29.515Z→01:19:31.478Z exit0、空log。Root解析两份metadata、重算日志hash并核完整before/after一致。Root在其短冻结窗口运行原6份独立脚本，所有预先固定期待未改，各组新目录、单原始fd、实际UTC/native exit及完整模块/Root脚本/HEAD/status指纹；另独立重算loghash和完整before/after一致。仍是WIP局部诊断，不是clean SHA关闭验收：

| Root目录（`data/root-v1-13-review/`） | 实际结果/总时长 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| wip-ghsa-release-01 | 1/1，201.4441ms，exit0 | 01:20:02.982Z→01:20:03.409Z | `b884dff6bd3339592098c9d41d06f2cd13ec7f9cc93084fbca27b6942cfe708c` |
| wip-ghsa-long-01 | 1/1，246.8995ms，exit0 | 01:20:03.749Z→01:20:04.216Z | `9a9b755c8693f862ad81adbadae7f84d15e8932aa1255031b9c22e7f4d5b9a4c` |
| wip-ghsa-integrity-01 | 1/1，209.0558ms，exit0 | 01:20:04.543Z→01:20:04.968Z | `b025633b067e57d7d4fc2316ce96629b8f8427f293a52886c526ba3a09a4b5d9` |
| wip-ghsa-reissued-01 | 1/1，202.3027ms，exit0 | 01:20:05.334Z→01:20:05.749Z | `5c425508e5af28224e5035d4ae90e2ee220fa85ed2c7e5d20463baf759dec6e1` |
| wip-ghsa-no-novel-01 | 1/1，193.6345ms，exit0 | 01:20:06.058Z→01:20:06.461Z | `da8dbf86d51f7d152d823a8d068e7366dfa3304c134da61c1f82faee39775d99` |
| wip-ghsa-scope-01 | 2/2，225.7496ms，exit0 | 01:20:06.763Z→01:20:07.198Z | `8b7109c927e3d3c604e767340a2873cc5f57804a47efa6d8f744f64879f7ceaa` |

新增3项首次实际通过：0 novel未入选不消费，后来出现novel才消费且空刊不增加报道频率；advisories-only/Release许可false仍可完整风险更新；未报道且原普通正分项目因scope未知被排除，候选和正文一致显示不确定风险。未读取作者helper、无真实网络/模型/SMTP。原4项回归也通过，共6组7测试。Root已解除冻结，允许作者继续，所有旧失败继续保留。

### 历史索引完整性协议及新窄Interface

独立索引反证任务已完成，Root分段全文亲读最终`data/v1-13-momentum-design/release-index-review.md`，SHA **457B66F0A4359BBFF038493996F84D250999273BA27BB0E56A5C29DF9D23EF0E**；不含产品修改/测试。Root批准以下协议，不将设计文档当PASS：

- 四表逻辑结构为contexts、heads、pending、state；固定真实run INSERT登记pending，包含较早slot晚提交；单边派生变更设dirty，既有未知dirty不因下次正常采集自动清除；缺state/guard失效。保持第一次canonical origin，不用后来更早slot覆盖旧刊定位。
- expected count/bytes/集合承诺由已核真实run的应新增清单产生，再与实际INSERT结果独立比较，不从可能缺行的contexts重新自证。冻结epoch/generation/时间域及完整manifest保存进真实assessment，并回核其原run成员，防止改早generation并清空previous后自hash通过。
- snapshot、最终只读授权与archive按原freeze完整前缀重取真实上下文，核原证据与来源；未来第1001个发展不能倒灌使昨日合格归档突然超界。索引不记消费，不替代成功Report。
- 每node1000、row64KiB、单次上下文16MiB、旧slot每批100只是待落地的已有容量方向；作者还须提出原DevelopmentRun/父GitHubRun单行字节、批次及单次累计原bytes和不同origin预算。精确DDL及这些数值仍待批准。16MiB不是永久整表大小；新写入保留typed权限路由身份。无header旧库若无法合法读取来源身份，明确Gap，不能把SQLite json_extract宣称为未解析旧材料或借新来源权利洗白；本票未发布，不承诺自动无权迁移全部WIP库。

Root另批准同一`GitHubDevelopmentVerifier`可选窄`assessSecurity(input)`处理实质修订；初次完整风险仍确定性。严格旧evidence/字段old-new/类别/短摘录/输入摘要绑定，same及A→B→A核完整历史，结构不是语义真值或权限。批准同步只读`authorizeDevelopmentHistory?(snapshot)`，专门核旧刊原freeze域真实成员及完整集合，不要求今天采样配置同hash来改排旧刊；仍逐原source核当前使用许可。新Record10缺该能力fail-closed，旧Record不变；当前produce另用当前配置authorize，不能被历史核验入口替代。

按codebase-design，补建、完整性、权限与容量留在观察Module内部，不将checkpoint或“历史已完整”状态交给Request/Agent。作者继续安全修订与索引具体方案；动量尚未产品实现，无产品提交、整票check/smoke、双轴最终review或master集成。

### 具体索引DDL与预算已批准

本次goal接续实时inventory确认实施作者仍running；Root主树为`77007b6`、仅无关`.idea/`，未把观察超时当终止。上一goal turn有真实产品局部证据、Root独立7测试及记录提交，分类为progress。

Root全文亲读作者正式提案§8后，批准四张新表`development_contexts/context_node_heads/context_pending_runs/context_index_state`、`context_frozen_prefix`索引、原`development_runs`六个nullable typed路由/字节/摘要列及固定触发器协议进入实现；application_id/user_version、原runs JSON和旧刊字节不改。新表精确字段/SQL见作者`docs/implementation/v1-13.md`§8，由唯一作者实施，Root不并行写产品。

批准的硬工程预算为：context单行64KiB、每node三类（Release material、安全material、known-security首次关联）合计1000唯一context；单次全部node投影16MiB；单原DevelopmentRun32MiB、单原GitHubRun1MiB；每批维护最多100不同slot且两类原run合计64MiB；每次freeze/snapshot/authorize/read最多1000不同origin slot且两类原run合计64MiB。按origin复用有界验证缓存，投影与原run预算分别计量；这些不保证任意1000-context集合都能放入、不是JS堆/容量性能已经通过。未来动量布局另提，不默认将32MiB momentum bank再塞入该32MiB run。

执行附带条件已发作者：ALTER之后INSERT显式列名；合法新无policy/空失败run以typed bytes/hash等明确区分无header旧WIP，前者可记录经验证空结果，后者不得无权解码或跳过；既有invalid/building/dirty不能由正常路径洗白。所有字节gate在读取大payload/JSON解析之前生效，16MiB按node码点/ordinal分配、不足node整组历史unknown，不传截断previous；普通Heat按独立证据继续，身份不删除。expected集合从真实run及已核head推导再与实际写入独立比较；冻结收据同时绑定原run成员与manifest。作者可写回已批准状态后直接逐片TDD，不必重复等待Root。

### 映射冲突的两次不同RED

Root读取42/43原log并核42–44完整metadata/hash/前后指纹一致。42新fixture历史点与目标24h点相差65min，超既有±1h择样窗口，actual=[]，不能证明详情node偏选；只将旧点改为合法23:25、删去不必要中间点后，43 actual=[novel,unrelated]、expected始终[unrelated]才直接复现详情指向node错误放行。43→44未改期待/fixture：

| 切片 | 实际结果 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| 42-ghsa-node-conflict-red | 3/4，exit1，643.3657ms；fixture前提不满足 | 01:21:33.787Z→01:21:34.505Z | `0e5cd331086f51661af7a91477fe4822dcfec33bf8eddd17caf83683a879afd1` |
| 43-ghsa-node-conflict-red | 3/4，exit1，652.8662ms；产品映射冲突反例 | 01:21:49.624Z→01:21:50.349Z | `0d5fa3c609035dd60b8c82bbb9ed79f5fc680291373d71e2f7076fc129384c03` |
| 44-ghsa-node-conflict-green | 15/15，exit0，1866.1734ms | 01:22:17.067Z→01:22:19.004Z | `6f2da2bb7b70da6a5d947eedb264dc9dc66cf6d0bd07e2eba501462f179e6d02` |

Root独立准备`context-index-loss-probe.mjs`，首跑前最终SHA **2B3E9241E0BBC57C485ABD8EB74605B5D417DEB815B581F5FFAFADD246D425FF**。首次业务运行前把场景明确为：先成功报道，再刊登真正依赖该旧context的重复抑制收据；仅在各自新建Owned观察库注入单context/单head丢行，检查依赖旧刊拒读、不把未知历史送模型作空集、下一期普通novel仍可刊、重启不自动洗白。这样不把只发生在原freeze之后的孤立条目误当其旧依赖。SQL仅确定注入对象和实施故障，业务断言都通过公开Interface。现在仅通过语法检查，两个场景尚未运行，不计PASS；原6组已执行oracle没有任何更改。

### 真实观察成员核验的第一条修复

Root实读46原RED并核46–49各metadata/loghash与完整前后源码/状态一致。46在保存刊物中清空assessment的previous/previousEvidence、重算公开哈希后，公开read未抛异常；47接入同步只读`authorizeDevelopmentHistory`回核真实当前DevelopmentRun成员，49保留typed路由header和原payload实际字节/hash复核。Root只读确认新Record10 read实际调用该Interface、缺实现不默许；这还不是完整四表集合证明，索引阶段继续完成。

| 作者切片 | 实际结果 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| 46-frozen-context-omission-red | 11/12，exit1，1915.3921ms；Missing expected exception | 01:28:11.211Z→01:28:13.200Z | `9a19581311fc3afe4a5b2b8b26c8bce4770538323160c9ecab0923c1e960f507` |
| 47-frozen-context-member-green | 16/16，exit0，2321.8857ms | 01:29:09.949Z→01:29:12.345Z | `03e947307cac4f63f2a549885dae10c2d31c18cc1ae8d234e5abc607295e7343` |
| 48-history-member-typecheck | exit0，空log | 01:29:54.221Z→01:29:56.242Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 49-history-member-green | 16/16，exit0，2323.0833ms | 01:29:57.015Z→01:29:59.403Z | `d46283bef1ec7c55eec76ff597cb43cae07eccea6449ffc22ef1dff767475827` |

45类型检查另已实核UTC01:25:08.557Z→01:25:10.545Z exit0/空log。Root此时重新通过gh读取#13仍OPEN、assignee yiwer，不关闭、无新tracker写入。新四表切片已有`50-index-missing-state-red`，Root读到失去安装状态后仍有外部verifier输入的失败输出，但尚未有其GREEN；不把当前16/16误称索引已验收。

## 兼容及安全

已接受Request1–8/Record1–9/Version1–8/Canonicalv1–v7与`observer-github-heat-v1`旧评分/字节不原地改；Report SQLite v1、GitHub application_id1329746759/v1不擅迁移。新Schema、采集Interface、持久结构或多票契约须Root协调单一写入者。保留50有界候选、当前来源权限、逐跳网络/稳定身份、截止可用时刻与失败不复活旧good规则，不接收Request/Agent自报历史或权限。

Root持有29旧调用、Record7两刊/Record8四刊、20项#12专项/13旧GitHub专项/Spec9组以及新Record9五刊固定oracle。Record9基准`O:/GenesisCode/Observer-worktrees/accept-v1-12-r2/data/root-v1-13-compat-41020f4`，baseline SHA **e69381dd7517c8d6fd524842f904d82b5f2be3a9bfad27b3782063378e154f88**；reader `Observer/data/root-v1-12-review/verify-record9.mjs` SHA **2e624b6be9343864f598d2c697d6f18e16f272cb3acfdb6e96f368dfbe24ab14**。禁止重freeze/改期待/删除原档。

不读取PAT/QQ_SMTP_KEY或无关`.idea/`，不调用真实候选/Provider/SMTP，不部署/购买/push/启用生产。QQ既有单封实际收件确认不重发，Claude live延期。新TEMP仅指定data；固定Docker镜像与Root串行，整次NoSuchImage失败保留并只读核查后同SHA新目录整跑；不升级/rebuild/retag/restart/prune，不清理原data/被拒目录/退出容器。具体固定身份和安全边界继承[#12](12-github-heat-and-novelty.md)与[执行入口](../EXECUTION.md)。
