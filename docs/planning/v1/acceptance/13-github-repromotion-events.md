# V1-13 执行与待验收记录

状态：in-progress；唯一产品作者为`implement_v1_13_resume`。117稳定源码窗口Root新合法短证据Release 9项、原安全3项与旧引文反例1项，共13个独立测试通过，另5份旧刊内容不变；不将新输入冒称原长引文输入继续通过。作者共同引文局部34/34；出版/read计费、纯文字缓解、再次增长产品全链路仍未完成。尚无本票产品提交、最终双轴或master集成验收；GitHub #13最近实时readback为OPEN，本段不作新tracker写入。以下逐段记录按实际发生顺序保留，末段为最新进度。

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

### 索引第一批接线与57冻结独立反例

本轮接续重新确认Root `2c58b8c`仅无关`.idea/`、作者`ticket/v1-13`仍在`ec9b91c3e8575f7f3f3dc363d1d35ffb6319fce3`的未提交WIP。作者以completed短回合交还等待，不代表整票完成或消失；Root完成57短冻结后已明确解除并通过followup恢复唯一作者。goal继续active，本轮存在实际独立执行及产品失败反例，不是外部阻塞。

Root实读50/51/55失败输出，解析50–57完整metadata、核完整before/after一致并重算各`output.log`摘要。首次复核命令把作者日志误写成Root惯用的`native.log`导致ENOENT，仅为Root定位命令错误；列目录确认作者使用`output.log`后只读复核成功，没有重新执行、覆盖或改写这些原始运行。

| 作者切片 | 实际结果 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| 50-index-missing-state-red | 12/13，exit1，2321.4985ms；缺安装state仍送材料核验 | 01:32:35.926Z→01:32:38.328Z | `f4b96b8c4e4fce02f979f059e05b3fdddcfffce70430a43b1bb158190514ea7a` |
| 51-index-state-green-attempt | 16/17，exit1，2619.6723ms；旧metadata-only路径因新空run权限路由回归失败 | 01:37:26.667Z→01:37:29.360Z | `9cde293a6c0d7e1eeebf9be2faf4bcac0909c84dad048e58928b1e3371513d87` |
| 52-index-state-green | 17/17，exit0，2621.7689ms | 01:38:30.843Z→01:38:33.537Z | `93b34df265e7d355e684f8c46a36c6083f8e010c4b4b413f181177d004994039` |
| 53-index-state-typecheck | exit2，5处新Map回调implicit-any；原失败保留 | 01:38:34.288Z→01:38:36.365Z | `9735dab635f18ff3e274da2d02b135f45b9ca009795f90b8040f6cf8925aa6e1` |
| 54-index-state-typecheck | exit0，空log | 01:38:57.341Z→01:38:59.278Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 55-index-member-loss-red | 13/14，exit1，2630.0981ms；缺真实context依赖仍可read | 01:40:30.509Z→01:40:33.214Z | `c40f05d184d720f94e7832898a58fe024b4de652f71b3701aa9139262947ec5a` |
| 56-index-frozen-prefix-green | 18/18，exit0，2891.8337ms | 01:41:34.922Z→01:41:37.887Z | `775cc7e0e1af6ac8757d2911eec3e9c993bc8aadc38830794db922891cc8fab3` |
| 57-index-frozen-typecheck | exit0，空log | 01:41:46.273Z→01:41:48.268Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

52以本轮真实已验证原run在同事务构造expected成员闭合51，不意味着旧无header材料可按新source权限读取。56把contextFreezes接入真实run、Release assessment与input摘要，回核原generation前缀及真实origin；尚未证明全部累计预算、并发、容量、GHSA修订或动量。作者明确当前current-run与origin累计预算仍分开，需下一片合并，不能称最终cap合格。

Root随后按原6份已执行脚本和首跑前固定的新`context-index-loss-probe.mjs`原样运行7组/9测试；每组新目录、单fd/fsync、实际UTC/native exit。Root另解析全部metadata、独立核完整before/after及loghash。没有读取作者helper、没有真实网络或Provider。结果为原7测试PASS、新2测试FAIL，均为WIP诊断：

| Root目录（`data/root-v1-13-review/`） | 实际结果/总时长 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| wip-index57-release-01 | 1/1，243.2865ms，exit0 | 01:59:44.679Z→01:59:45.150Z | `d1c4dd0debce96373664e90260cc3bdc2d7d186daedcddbd52ecb29592cc6889` |
| wip-index57-long-01 | 1/1，289.8165ms，exit0 | 01:59:45.561Z→01:59:46.078Z | `00f89406f75cb9fded31b176ca80fc1ba5f1233cd51cec2bbf583f7e0644bd58` |
| wip-index57-integrity-01 | 1/1，249.6599ms，exit0 | 01:59:46.423Z→01:59:46.900Z | `72d9c05286683d7d3e8c7bcc9a6be8538ea414550f484038eb8ac802267016ea` |
| wip-index57-reissued-01 | 1/1，242.5047ms，exit0 | 01:59:47.213Z→01:59:47.680Z | `64152b56162e42cc3da0e2dd6bf24bc3b365b10dd999236836615ec497e04609` |
| wip-index57-no-novel-01 | 1/1，234.3594ms，exit0 | 01:59:47.997Z→01:59:48.449Z | `69f2982e144d909eb956d4ccee8e678fd7680d57321977815503aefd3137a5a8` |
| wip-index57-scope-01 | 2/2，287.8228ms，exit0 | 01:59:48.757Z→01:59:49.267Z | `e9ad3fafbadec2f7a4a5d82243320536c4fef98b01cd2008fd3c0753680c08d3` |
| wip-index57-context-loss-01 | 0/2，518.3923ms，exit1 | 01:59:49.575Z→01:59:50.313Z | `9c3396594ca2d14ad9244aad9e25b8e5d3e3e50c8ae7722e17479cb1afc3502b` |

两个独立丢行场景分别删除各自新Owned观察库中ROOT_REPEAT的一条context/head：真正依赖该条目的旧刊拒读、后续无verifier输入都已通过，随后普通novel D/E实际selected为空，原期待两者入选，因此在该断言真实失败。后面的Gap及restart断言尚未到达，不能算通过。Root已交作者定位降级范围，要求不放松实际普通报道历史完整性，不修改原oracle；原失败日志、两个故障库及所有旧证据保留。

Root批准作者提出的单列权限路由细化：`development_runs.material_kinds INTEGER`对legacy nullable；新行0=真实无Release/GHSA材料的元数据空/失败run，1=Release，2=GHSA，3=两者。按真实提交payload计算，并在后续复核与schema、固定guards、原SHA/字节及实际kind一致绑定；null/未知bit/headerless不能猜0。0仍需原source metadata许可，不借此读取含事件材料的旧run。该列是已有typed路由内部实现细化，不扩展Request或Research Agent权限。作者更新正式§8审批/已实现/待验证状态并继续TDD；Root不并行修改产品。

### 原索引丢失反例闭合，普通历史校验未放宽

作者58公开反例先证明普通history未缺失、真实已发布节点完整，再复现selected=[]。定位为`repromotionSnapshot`将`developments.reasons`与原run数组别名共享，追加index Gap污染原不可变run内容，组合authorize因此拒绝整栏；59只复制reasons并避免重复追加，不修改普通历史权威逻辑。Root亲读58原失败及实际`[...run.reasons]`修复，并核58–60完整metadata/源码前后指纹/原日志hash：

| 切片 | 实际结果 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| 58-index-gap-ordinary-red | 14/15，exit1，2921.4231ms | 02:01:10.113Z→02:01:13.114Z | `ee1ef8222551fe6d7cf357a58ce335911045594dc3700a62df02ac05419758db` |
| 59-index-gap-ordinary-green | 19/19，exit0，3066.5911ms | 02:01:29.513Z→02:01:32.660Z | `dbebec1872a6226f76778cbe1a80dc2168649ca3d897d9938e4655b3da222d81` |
| 60-index-gap-typecheck | exit0，空log | 02:01:33.391Z→02:01:35.376Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

60冻结期间Root原样重跑7组9测试全部PASS，包括原context-loss两例现在完整到达普通D/E、可见Gap、restart及旧依赖拒读。所有metadata完整前后及日志hash独立复核，所有原脚本期待不改；Root已明确解除冻结。仍不是clean SHA/整票容量或生产验收。

| Root目录（`data/root-v1-13-review/`） | 实际结果/总时长 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| wip-index60-release-01 | 1/1，246.9667ms，exit0 | 02:03:22.243Z→02:03:22.716Z | `c2f52fd966bb2ee911661c67dfb73de224f1050d046a1aba70154a090c6def53` |
| wip-index60-long-01 | 1/1，287.068ms，exit0 | 02:03:23.101Z→02:03:23.612Z | `d75c8232ee77efe4d2dd95187abf2202d5a03377a8068b1bf23cc8c775d9d6e0` |
| wip-index60-integrity-01 | 1/1，253.2972ms，exit0 | 02:03:23.953Z→02:03:24.433Z | `132aa9f9b07d128bfc278c08b3edb05ec2db4472782dbeed12cf4d3b8d1aca47` |
| wip-index60-reissued-01 | 1/1，241.2267ms，exit0 | 02:03:24.756Z→02:03:25.238Z | `8d6f38ea8aa451a31d89ee1601dcc230aa22bf1e9bc9a9ea8d4d87e8740e756c` |
| wip-index60-no-novel-01 | 1/1，232.3672ms，exit0 | 02:03:25.539Z→02:03:25.992Z | `b9d6fddc5e5106c3be12aa881c203c33209b38a1e20d0731a5813123f02966cb` |
| wip-index60-scope-01 | 2/2，295.0214ms，exit0 | 02:03:26.295Z→02:03:26.802Z | `a20bf598775066b8edeffa4f09977f5bf0164272e0c6c6e7ad87ad6a2bab4d3d` |
| wip-index60-context-loss-01 | 2/2，574.8598ms，exit0 | 02:03:27.098Z→02:03:27.891Z | `31f955bd60696b272e3a6e404b0deb931f26e59b28d65b69db312a091f7bff22` |

作者指出原DevelopmentRun内嵌previous可能来自其他source，仅own source typed header不足以在整段解析前逐旧source授权。Root批准同一内部路由增加`dependency_policies TEXT`：严格身份/用途数组`sourceId/policyVersion/policySha256/materialKinds(0..3)`，同身份合并用途，固定Unicode码点总序、无重复未知字段、无材料。先SQL实际UTF-8字节不超过256KiB，再解析最多1001不同身份（current加既有1000 origin预算），逐原source按用途授权后才读原payload；超过cap明确Gap，不截短。新提交从全部实际材料及嵌入previous/previousEvidence/security history引用计算，后与原payload、原SHA/bytes、kind完整核对。legacy null、缺失或不规范不能猜空数组，纯metadata空run也不能避开自己source。该增量不改旧刊/原run字节、不暴露新调用方状态。另派原独立设计agent仅复核这项路由/预算设计，最多3个公开Seam反例，不能改冻结材料或产品、不替代最终双轴review。

Root新增单场景`release-cutoff-probe.mjs`首跑前SHA **43F3DAA3A3E6DB811752ED7C3D7FCD98E9F8ABABF63EE8E58C1E175B2666B780**：只在Owned Release HTTP已开始、仓库元数据已取得后推进注入时钟，保持两分钟deadline内，检查完整可用时刻跨cutoff不能借早published_at入本期、也不提前消费后期资格。只语法检查通过，尚未执行业务，不计PASS。没有修改原fixture、原9个独立期待或任何旧档。实时gh再次确认#13仍OPEN/yiwer，继续唯一作者实施，不关闭。

### 当前父run与统一loader的第一轮验证

Root亲读61原失败：首次Release没有旧previous时，删除其实际当前父GitHubRun后仍能read；62合并当前run/父run与prior origins核验，65把snapshot读取也接统一loader。Root解析61–65全部metadata、核源码/状态前后完整一致与日志hash；63真实类型错误保留，64才是零退出。typed material/dependency路由及累计预算已有接线，不意味着饱和、并发、所有权限时序已验收。

| 作者切片 | 实际结果 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| 61-current-parent-missing-red | 15/16，exit1，3058.7308ms | 02:06:06.015Z→02:06:09.155Z | `7f16482c3c6c6844eb55fdce8c58f5beae28f2e421fa05ac7d18bc70a1d7d89b` |
| 62-current-parent-shared-green | 20/20，exit0，3356.7739ms | 02:09:38.289Z→02:09:41.726Z | `5a788ac9884541d0bbf0d5e7efe32b02b7d1051e88c2802648bf262dfd466c0b` |
| 63-route-budget-typecheck | exit2，SQLite宽union的位运算类型未收窄 | 02:09:42.544Z→02:09:44.513Z | `b3f91e54b4c3bfad6673523cbb84fb76f1db570fa9de852514a31e20be63b4d0` |
| 64-route-snapshot-typecheck | exit0，空log | 02:10:49.145Z→02:10:51.165Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 65-route-snapshot-green | 20/20，exit0，3359.1837ms | 02:10:52.040Z→02:10:55.476Z | `20866ee292f81022b12d21636c21b51373dbdd455734d141e0e59433622b09ec` |

Root预先新建`record9-compat-probe.mjs`，SHA **8251B153D1C94AD18638A48D8ACD5A6A569763543E031615D3124C577BFB2444**，只是校验既定原reader和baseline摘要后调用原reader的薄运行包装；原5份Record9、原reader和期待没有改动。65冻结期间原9测试、新cutoff测试、旧5刊原字节/鉴权读检查全部通过；共9个command groups，其中8组10个node:test，另1组5份实际旧刊，不混称15个node:test。

| Root目录（`data/root-v1-13-review/`） | 实际结果/总时长 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| wip-index65-release-01 | 1/1，261.0131ms，exit0 | 02:15:26.652Z→02:15:27.135Z | `d9c1988d6e9ff35cfc9c26ed5ec0ae745440d47eca86f7b4f0c6b9e078269369` |
| wip-index65-long-01 | 1/1，303.0818ms，exit0 | 02:15:27.530Z→02:15:28.054Z | `2f669ea46e4a8a586195897a877f5a2a7d3ae92e93ae9a1de55bc479850962f9` |
| wip-index65-integrity-01 | 1/1，257.3054ms，exit0 | 02:15:28.441Z→02:15:28.927Z | `757e7a9d3bc6f683ff8dff0e11ad59a8dadd6f5e382485a284fe42025c1a5bca` |
| wip-index65-reissued-01 | 1/1，253.9265ms，exit0 | 02:15:29.245Z→02:15:29.724Z | `e23cbaa6ebada0bcd016d07385b1962495ac8f9691ed0790e9014207267331cc` |
| wip-index65-no-novel-01 | 1/1，250.0485ms，exit0 | 02:15:30.047Z→02:15:30.527Z | `e5c624e1aeee3d1444e8f37bbdb05389f3415962c326e63dbdb4cfb460fc9364` |
| wip-index65-scope-01 | 2/2，310.4484ms，exit0 | 02:15:30.842Z→02:15:31.370Z | `aaf79500845e397a1899cc20e8dcd60e896a2e4bc9b9b6a52139d851aa6c0c80` |
| wip-index65-context-loss-01 | 2/2，638.5717ms，exit0 | 02:15:31.681Z→02:15:32.554Z | `2c581f28bd8f548d5e5ad0b002103cb4823f3c9d588c302377ef0f418323a4b4` |
| wip-index65-cutoff-01 | 1/1，242.3638ms，exit0 | 02:15:32.852Z→02:15:33.311Z | `8e987ea1087dada34a1a053b457db2aea1bfdb01e9c6979dcd710bd531a225c0` |
| wip-index65-record9-01 | 原5刊wholeReport/Markdown/selectedCount/wrong-owner检查，exit0 | 02:15:33.622Z→02:15:34.013Z | `f23bf9ef61fdbefab3311dac00731bf50267bb3fbc67bebd03c9dbeb68e41699` |

Root独立重核九组全部metadata完整before/after与log摘要。cutoff首跑原期待全通过，明确metadata早于截稿、实际完成run晚1秒、源published_at更早、确有semantic assessment；当前快照不纳入该late run、不消费，下一期能真实报道并重启读取。旧刊baseline SHA仍`e69381dd7517c8d6fd524842f904d82b5f2be3a9bfad27b3782063378e154f88`，没有重freeze。Root明确解除65冻结，作者继续；上述为WIP局部证据，不替代最终固定SHA全套/双轴/实际master集成复验。

独立设计者随后指出更窄的顺序风险，Root亲读当前loader确认：`snapshotRun/verify`进入`original()`后可先依typed header解析raw，`ready()`却在稍后的`readNodes`才检查。单边UPDATE缩掉已撤权dependency身份时，trigger虽已置invalid，最终闭包不符拒绝发生在raw解码之后。Root已要求统一入口先核固定guards与本操作可读阶段，再信任header/raw；public snapshot/archive拒绝既有invalid/dirty，维护允许初始合法building及同短事务自有变更，不能一律ready使补建永久停。另要求一次操作记录失败origin为unknown，不重复读取/扣占同slot；实际已读取的失败bytes仍计费，不能免计IO。这些是现有完整性/预算约束细化，不增加外部绕过flag。当前10个独立测试及5旧刊不覆盖raw解码前时序，尚不能称其通过。

独立设计者完成新增`data/v1-13-momentum-design/dependency-header-review.md`，Root全文亲读并核SHA **F0F670A05B39AB0A2EC833DFFCD8BBF182BA9000B2DA79A9F16CFDC63A845273**。它明确保存初次/补读WIP各文件hash，不是原子冻结或已执行探针；已接线的dependency闭包不误报成当前缺失。Root认可其三项最小修正/回归方向并交唯一作者，不改变旧冻结材料或扩展框架：guard/操作阶段先验，old-only与双用途完整身份闭包，以及失败origin操作内unknown缓存。第三场景选择单边损坏旧父`runs`行，避免development mutation guard先遮蔽共享缓存问题；必须证明实际公开observe路径能到达，不可私有直调冒充。第一个场景的最终throws不能证明原文未曾解码，需把公开失败行为与读取前源码核验分别记录；不为观察实现细节增加私有mock或额外产品Interface。保守预留字节若采用，称为上界而非已发生IO；缓存不得跨操作形成永久失效。整体容量/权限饱和和最终整票验收仍未完成。

### 失败origin缓存：先验证反例真正到达目标

本轮goal接续核Root`6b75638`仅无关`.idea/`，作者仍`ticket/v1-13`/`ec9b91c3e8575f7f3f3dc363d1d35ffb6319fce3`未提交WIP且代理live。上一goal turn有实际修复、独立执行和本地证据提交，分类progress。本轮继续原目标，不把小片通过当整票完成。

Root解析66–73全部metadata、重算原`output.log`摘要、核完整源码/状态before=after，并读66/67/69/71实际失败及当前公开测试（未读helper）。66错slot导致取不到注入行；67父JSON不满足旧GitHubRun Schema、在普通history入口就失败；69实际只构造300而非期待490条投影。68/70均exit0，不是产品RED；作者说明分别是有效大输入前提不足、健康origin仍能容纳，不能从文件名`red`推断复现成功。71才在有效输入及父schema可达情况下出现期望zHealthy却实际为空，72修复后保留原业务期待通过。

| 作者切片 | 实际结果 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| 66-shared-failed-origin-red | 0/1，exit1，341.7659ms；夹具slot错误 | 02:18:07.778Z→02:18:08.196Z | `e4e2ed8b6579508c427894e1143ca9c6081e1c29cfc9b223584bc9bade17af13` |
| 67-shared-failed-origin-red | 0/1，exit1，355.7379ms；前置schema失败 | 02:18:30.852Z→02:18:31.284Z | `56a67aac87d3b7c3e3172c8d1016f239c700ca338c2c4811ff6cd68776319147` |
| 68-shared-failed-origin-red | 1/1，exit0，367.5038ms；未触发目标故障 | 02:18:45.916Z→02:18:46.364Z | `14f0a4d2d7fd7cfceeed1212e201e3e210f78582516bb5963be63d0554010c05` |
| 69-shared-failed-origin-red | 0/1，exit1，413.7107ms；300不等于490前提失败 | 02:19:29.485Z→02:19:29.963Z | `c8eaee96cccba6ea66a7e1e6b3ae3168db4fd5120d5ddc90c4c35849e240cf78` |
| 70-shared-failed-origin-red | 1/1，exit0，940.7359ms；未触发目标故障 | 02:20:02.793Z→02:20:03.799Z | `3c25694f682044bf0ccc6ed12c4b83eda54cb5868ea5ad596b6ac688ea53f0ea` |
| 71-shared-failed-origin-red | 0/1，exit1，1059.6867ms；真正预算隔离反例 | 02:20:40.933Z→02:20:42.064Z | `be1fa3488bf2d591a78c3681b47a44962fd938f06fa6bdb56d23c1b145d15307` |
| 72-shared-failed-origin-green | 21/21，exit0，3672.9449ms | 02:21:00.713Z→02:21:04.460Z | `cc8d4df64c0e5aea900a42b02c7099be2a403c29f6ea4a2b665b9a6211cfa447` |
| 73-shared-failed-origin-typecheck | exit0，空log | 02:21:05.304Z→02:21:07.404Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

公开场景为29个node共享同坏父run，另有健康origin；原父JSON仍结构合法但id不匹配，SELECT故障目标来自本轮真实公开run，finally恢复该新Owned库的原父行。Root特别核准统计口径：每node的10个Release使用同一change，run中的290是投影条目，只有29个不同node+change材料，不是290个不同context，也不是1000容量PASS。它仍能构造合法大原run以复现重复解码挤占预算。修复将每个已尝试slot先记操作内unknown，失败不退款，后续同slot不重读，下个操作重新检查，未添加永久veto或外部调用方flag。

### 入口guard、旧-only用途和父行字节边界

Root核74–80各metadata/原log/hash/完整前后指纹。74/77/78均为characterization首跑PASS，不能标RED→GREEN或声称已隔离证明全部时序；75前置guard是静态已识别顺序缺口的修复。Root亲读实际`original()`：首次尝试先检查安装对象/状态再读取typed header及raw；只在maintain持BEGIN IMMEDIATE、入口clean合法阶段后保有私有epoch授权，finally清除。没有外部绕过flag；缓存只在该已核同步操作内复用。77政策修改同时使旧digest失效，其公开结果不能单独证明用途AND；AND接线另靠源码核查，后续最终审查仍必需。

| 作者切片 | 实际结果 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| 74-invalid-header-characterization | 1/1，exit0，508.8213ms | 02:22:19.156Z→02:22:19.730Z | `54b20ae46bc9ff46ad16be62eb869e1258756a59833ca51c48acaf6b396a2505` |
| 75-guard-before-raw-green | 22/22，exit0，3883.0055ms | 02:22:39.770Z→02:22:43.722Z | `537f5c020f93829b820e58fa090ad81ac926ba643416339234f2705389dd3f9e` |
| 76-guard-before-raw-typecheck | exit0，空log | 02:22:44.456Z→02:22:46.440Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 77-old-only-dual-use-characterization | 1/1，exit0，359.6549ms | 02:24:04.638Z→02:24:05.070Z | `260e98705037a0dbce19d780d0d7b9fa29030be1d425fb84838b464f0d4cca76` |
| 78-current-parent-byte-characterization | 1/1，exit0，515.8073ms | 02:27:17.195Z→02:27:17.786Z | `bc388fe79ba1ab34aa2c6fa1cccd7c9c6347833ae99ed042846254e897aa70e4` |
| 79-local-post-header-characterizations | 24/24，exit0，4149.5748ms | 02:27:57.016Z→02:28:01.245Z | `451c53867467dd1fa7656ef1c714adc7514c7b241317d5dfcf06c4c7dc5a4d4e` |
| 80-local-post-header-typecheck | exit0，空log | 02:28:02.001Z→02:28:04.014Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

80短冻结Root原9组重新执行并逐组独立核metadata完整前后与log hash：原10个node:test及原5份Record9检查全PASS。所有既有期待、旧reader/baseline未改，原失败保留。Root已明确解除冻结，作者进入已批准的安全范围扩大首片。

| Root目录（`data/root-v1-13-review/`） | 实际结果/总时长 | UTC（2026-09-07） | 原始log SHA |
| --- | --- | --- | --- |
| wip-index80-release-01 | 1/1，257.3154ms，exit0 | 02:29:26.864Z→02:29:27.357Z | `4e4ca7502bd602f14bbbc381014ea86a29be6d51e35b1aecbaadaf716c65d54b` |
| wip-index80-long-01 | 1/1，306.5757ms，exit0 | 02:29:27.759Z→02:29:28.287Z | `3a41097ef06269363db44ee61ad29d9a1eefe353d3889b93f236418262ac4125` |
| wip-index80-integrity-01 | 1/1，266.6305ms，exit0 | 02:29:28.686Z→02:29:29.184Z | `50c90f6207f9520780e0ab8a799a26fa243b61d55553aa7916d057e51907da51` |
| wip-index80-reissued-01 | 1/1，257.4437ms，exit0 | 02:29:29.517Z→02:29:29.997Z | `6935133c1712197aef20d95ed03a415d9996f784ae8d6d93d06c95c4a3160fca` |
| wip-index80-no-novel-01 | 1/1，250.8478ms，exit0 | 02:29:30.307Z→02:29:30.784Z | `79887c7e24e483e1841941315a6d430aa61349497a398a39c55cd330525ec2c5` |
| wip-index80-scope-01 | 2/2，308.8126ms，exit0 | 02:29:31.101Z→02:29:31.622Z | `a49e759b8da8b3f38626da01c3077e14f28b897b4dd5a27c19e66fe787465403` |
| wip-index80-context-loss-01 | 2/2，611.2856ms，exit0 | 02:29:31.931Z→02:29:32.772Z | `1f54f157f0b9ff032ab1d870252e2d638d7ab7bdad3ac83856539444ae81de77` |
| wip-index80-cutoff-01 | 1/1，249.7279ms，exit0 | 02:29:33.073Z→02:29:33.536Z | `aa8adb1a406444f8c4f295f482b452225403fb9b1c2ae4ea5d1fb779b94d11eb` |
| wip-index80-record9-01 | 原5刊字节/鉴权，exit0 | 02:29:33.853Z→02:29:34.245Z | `f23bf9ef61fdbefab3311dac00731bf50267bb3fbc67bebd03c9dbeb68e41699` |

### GHSA严格修订Schema批准与未缩减的缓解范围

Root全文亲读作者正式§9，批准其`SecurityChange/SecurityDevelopment/SecurityOrigin/SecurityMaterial/AdvisoryHistory/SecurityVerificationInput/SecurityVerification/SecurityReceipt`具体字段及strict/数量/字节限制进入分片实现：initial-risk确定性，四修订类为new-package/range-expansion/severity-escalation/new-remediation；新增包与扩大范围逐原tuple匹配，high→critical，结构化first_patched_version修复字段变更均保留外部语义判断与精确before/after、短摘录、全历史same关联。materials与首次known entries分开，origin补原DevelopmentRun及developmentConfiguration；新history/assessment中全部旧来源须同步纳入typed依赖闭包、原member/freeze完整回核及合并预算，不只是添加Schema。

Root**未批准**将new-remediation最终缩成仅first_patched_version：此前明确包含新修复/缓解。当前缺可比旧证据时revision-unconfirmed正确，但不能将所有有证据的纯文字缓解永远排除后宣告整票完成。独立设计者正提出有界旧/新缓解投影，仍在既有来源权限、短引文、真实run/freeze、共享容量内，不默认保存完整description或添加递归历史/新抓取框架。作者可先直接实现范围扩大等已明确分片，不等待新方案；自然语言缓解与动量、剩余容量验证仍是完整#13要求，不改目标。

### 新独立Release实质修订探针已准备，未首跑

Root新派fresh独立验收作者，仅写`data/root-v1-13-revision-review/`；其使用TDD/codebase-design，未读产品作者helper、未改产品/旧oracle。Root全文审阅两条明确语义字典及一个四期场景：Request8普通R→稳定707原文A→同707重大能力B→双库重启、新708及改名返回A；每期四个新项目避免新颖性配额掩盖结果，必须保留完整A+B及对应previousEvidence，返回A不能再救冷却。公开重算仅为一致性检查，不作为业务期待来源。

首跑前Root发现重算Interface误接裸InterestProfile，已让探针作者仅改为先验证归档profile等于预声明输入，再传真实InterestSnapshot；未运行过业务，故不是产品RED、没有改A/B/历史/配额期待。Root复读修正并核最终SHA：README **77340714D54A5D81308F5DC7C1375B2640342722D4246A4B78F133D2958A7AEA**，`revision-publication-fixture.mjs` **6BA6F43AECB064E83E80130D73650A547C4CBC3D2EA1A6C601790373AF701FA2**，`release-revision-return-probe.mjs` **C7E6F43EB35E575667251FB1E13A978D86C95F2FACCD5B3D126FC1C84DA1BBA8**。原Root fixture/probe不变。

Root另建运行包装`data/root-v1-13-review/release-material-return-probe.mjs`，SHA **368DEEB09E21648EC978FC796F2EA0B2633588B9E465CA6DE06D58C1F5BED7A5**，前后强核上述三文件hash再单fd继承执行一个场景；父capture仍记录实际模块/状态指纹及原日志。当前均仅语法通过，业务未执行，不计PASS，等待下次真实源码冻结。

### GHSA 81–90：真实范围/新增包 RED 与局部 GREEN

Root重核作者81–90每个metadata的完整before/after、原始`output.log`及SHA，均未发生执行中源码/测试变化；另亲读公开security测试与相关投影实现，没有读取作者helper。81与87均在实际publish结果缺少冷却中的repeat节点而失败，不是Schema/fixture前提失败；82虽25/25但83类型检查仍失败，84修正后85再次25/25。86的A→B→A首跑即PASS，只记characterization，不伪称RED。90是下一条severity公开RED，当时尚未增加产品分支。

| 作者目录（`data/v1-13-slices/`） | 实际结果 | UTC（2026-09-07） | 原log SHA |
| --- | --- | --- | --- |
| 81-security-range-expansion-red | 0/1，exit1，440.8245ms | 02:30:53.877Z→02:30:54.392Z | `7cd13fd6d7bde0d0ecf7dd891c93e7152b591b7445fe1ee8a28cfe6270beb4ea` |
| 82-security-range-expansion-green-attempt | 25/25，exit0，4201.4108ms | 02:35:26.819Z→02:35:31.093Z | `37fadccc7377a8662123feeb3aa83e42ab593fe7347849251cf85d48a6da22fa` |
| 83-security-range-expansion-typecheck | exit2；Zod union动态展开和optional函数类型错误 | 02:35:31.936Z→02:35:33.987Z | `cd23345222177fa3ba764ea7a29da0fe9db7b2ca0dd9c5543fc70619280ca506` |
| 84-security-range-expansion-typecheck | exit0，空log | 02:35:59.381Z→02:36:01.392Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 85-security-range-expansion-green | 25/25，exit0，4222.7193ms | 02:36:02.164Z→02:36:06.461Z | `6b831d801fc464b421f7cf1e357e3ee947c94e8d43e07734451919759eb37fc6` |
| 86-security-aba-characterization | 1/1，exit0，549.7938ms | 02:37:15.283Z→02:37:15.909Z | `a46f912c828e0e4547ec51f19bec679999b02730825ca669c32906cf39ab2072` |
| 87-security-new-package-red | 0/1，exit1，438.3813ms | 02:37:50.662Z→02:37:51.181Z | `ccbdce827ee3b7064fc87b1a7ac5823c67f3e3d04ec8acfe124f8841454cd091` |
| 88-security-new-package-green | security 8/8，exit0，1479.7718ms | 02:38:08.776Z→02:38:10.330Z | `9f409ba085f4fea1faa854c548f2bd5bd54f7433a6a19a320836ccbfb4267f13` |
| 89-security-new-package-typecheck | exit0，空log | 02:38:11.090Z→02:38:13.274Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 90-security-escalation-red | 0/1，exit1，433.1230ms | 02:38:47.447Z→02:38:47.947Z | `b58b7052e5bc1e8aa0e9d0dd1a8681ad64d80fdd4007ea3eb65a54fff2cc7c36` |

Root核日志的首个汇总脚本遇到空typecheck日志时仅摘要regex报null，未改文件；随后单独重核84/89的完整metadata与空文件hash通过。读取路径误指Root树/猜目录的ENOENT同样只是只读检查失败，不记产品失败。

### 90稳定源码窗口：11项独立测试及5份旧刊通过

最初请求85冻结，但作者明确告知期间已推进至90-RED-stable-source，因此本轮严格命名`wip-ghsa90-*`，不是85或全套GREEN源码。Root逐项比对十个capture的src摘要与作者90原metadata完全一致，且每次完整before=after、原log hash匹配。源实现仍是88/89通过后的版本，作者tests中含尚待实现的severity RED；Root没有运行那份测试后声称它已通过。全部为WIP诊断，无固定新产品SHA，不替代最终验收。

原八组10个node:test期待未改，原Record9 reader/baseline未改；新增Release语义字典及三文件hash在前段冻结后未改，A→B→A首次业务执行即PASS。Root完成后明确解除作者冻结继续下一片。

| Root目录（`data/root-v1-13-review/`） | 实际结果/总时长 | UTC（2026-09-07） | 原log SHA |
| --- | --- | --- | --- |
| wip-ghsa90-release-01 | 1/1，263.5466ms，exit0 | 02:44:21.007Z→02:44:21.490Z | `2ba071f8469b5402283ee7ae7eb7a9dddea945da348fef86dfc13df08343ed34` |
| wip-ghsa90-long-01 | 1/1，313.9767ms，exit0 | 02:44:22.220Z→02:44:22.769Z | `46e7e85d5bcc6b360fd0cd1850e142dac6d4d677876a3cf02b4a3f340a016296` |
| wip-ghsa90-integrity-01 | 1/1，265.6385ms，exit0 | 02:44:23.480Z→02:44:23.969Z | `bea2998662d627cdc9bdcc71800495ae2da3f0ea05efd891d31951cc4d260c08` |
| wip-ghsa90-reissued-01 | 1/1，257.5128ms，exit0 | 02:44:24.621Z→02:44:25.109Z | `49bc58c0be4dd8cba05aea80f499a63c03c2d22dbed8a83a19b2595793b6db31` |
| wip-ghsa90-no-novel-01 | 1/1，248.7068ms，exit0 | 02:44:25.764Z→02:44:26.246Z | `520ea58705051be49e7e167e5d7eead89050693b75ff0e02d16b0bde785ea8ed` |
| wip-ghsa90-scope-01 | 2/2，325.0569ms，exit0 | 02:44:26.888Z→02:44:27.421Z | `0e0623f1d20324423327409eda4741b5514ae71731d70fd3de1e3bb509466a4c` |
| wip-ghsa90-context-loss-01 | 2/2，602.9362ms，exit0 | 02:44:28.035Z→02:44:28.869Z | `47de9f052e1c707efc0a3c8fb97dedd11ce64c523a541bd25b628beabbb3e6e9` |
| wip-ghsa90-cutoff-01 | 1/1，241.6014ms，exit0 | 02:44:29.496Z→02:44:29.956Z | `21cb55261bf154a27a0cd25b0069f650ae2d30899019da9aa229d0e2362552fb` |
| wip-ghsa90-record9-01 | 原5刊字节/鉴权，exit0 | 02:44:30.580Z→02:44:30.967Z | `f23bf9ef61fdbefab3311dac00731bf50267bb3fbc67bebd03c9dbeb68e41699` |
| wip-ghsa90-material-return-01 | 新1/1，383.5034ms，exit0 | 02:44:31.589Z→02:44:32.248Z | `066b294ded1f7b5cab55e8918f8265ca668f4596c88107703faec38479a7f5c8` |

### 有界纯文字缓解方案批准及精确接线要求

Root全文亲读独立设计`data/v1-13-momentum-design/security-mitigation-projection.md`，SHA **8D4B447B0FA8CB290A7FB0278D2730F89B20CA3F54F51AE496A474A39730B5FF**。批准语义与同一`assessSecurity`有界增量，待唯一作者将精确DDL/strict版本/计费接线写正式§10后核准，不把设计者的未执行三族场景计作PASS：

- `unknown / explicit-none / measures`，措施再区分`mentioned / explicit-only`；缺措辞不是none、普通提及不是穷尽。短quote含原UTF-16位置，实际子串/边界验证；scope必须引用当前完整有限vulnerability元组，单句必须支持全部保留条件和措施。采用1–3条、每条effect最多120的有界投影，不保存旧description全文。
- 初始完整风险保持确定性，允许首轮unknown、后续真实scheduled refresh通过同一次可选评估补采。未知→已变B不能倒填旧none；真实none/only-A→实质B有正向路线，mentioned-A路线须明确替代及新增保护能力，不从字段名或“新”字推定。结构相同不能让text路线永远early-return跳过。
- 全历史短投影及实际原run/freeze绑定；首次origin不覆盖，同义复用旧身份。A→B→A不许用晚出的B造新A；未出版B不消费，已知baseline不是material或Report。flat origins + receipt IDs避免递归复制，无自报hash权威；model输入摘要绑定展开后的完整旧集合。
- 批准第四个非事件context kind `security-mitigation`，不是假initial-risk/排名资格/消费，不新增表。共用每node1000、row64KiB、全部projection16MiB、原run/操作/typed header等全部原上限；可选baseline不足可unknown，但已用于text资格的投影必须与材料共同完整准入。
- 安装选择最终fresh context schema/marker v2；精确CHECK/marker摘要由作者展开再核。#13尚未发布，旧WIP三-kind安装允许明确fail-closed并保留原资料，不承诺其Record10自动迁移或洗白；已验收Record1–9及旧普通库读取仍须保持。不清库、不重写旧JSON、不伪造epoch迁移。
- 当前和所有旧projection/origin加入用途2依赖闭包，读前guard/header/逐原来源许可，读后真实member及完整prefix校验。保留引文限额、TTL、cutoff、实际完成时间与成功Report唯一消费。

引文歧义在实施前明确：既有正式文档的“摘录总量不超过`min(500, source.citation.maxCharacters)`”按同一次实际使用的原`sourceId`聚合，Release/GHSA/mitigation共同计费，不按文章、接口、assessment或政策版本重发额度。沿既有出版流程以Unicode codepoint计字数，quote offset另按UTF-16。单条500限制仍保留；模型输入/永久归档中实际使用的旧摘录同样受其原来源许可与限额，不通过新字段、复制或多policy identity规避。flat事实引用的精确去重和各操作计费域仍需正式契约映射，不接受只口头称有预算。

该要求揭示现有Release逐assessment限额与新GHSA局部累计不一致，作者将另建公开RED修复；预算故障fixture可新建合法短引文版本并证明原body字节仍达到目标，但保留原71证据及所有Root冻结oracle，不能改旧日志。独立验收作者另在全新`data/root-v1-13-security-revision-review/`准备范围A→B→A公开探针；当前仅任务分配，尚无执行证据。

### 91–95：严重性升级与首次修复版本局部通过

Root再次逐项重核91–95全部原metadata、完整before/after和原log SHA；90的severity真实RED后91安全局部9/9，93的首次披露patched version真实RED仍为publish遗漏repeat，94安全局部10/10。92/95类型检查均exit0。这两类均仍需外部supported语义、精确原字段及合法旧development引用，不把枚举存在或更新时间变动当作事件；这里只记局部实现，不声称Root新增独立GHSA修订探针已经运行。

| 作者目录（`data/v1-13-slices/`） | 实际结果 | UTC（2026-09-07） | 原log SHA |
| --- | --- | --- | --- |
| 91-security-escalation-green | 9/9，exit0，1605.8105ms | 02:45:08.882Z→02:45:10.553Z | `d72164d605d4a0c0356d8f3bf040d1cdf31e7f05948a976ddfd504b3fc1ec00f` |
| 92-security-escalation-typecheck | exit0，空log | 02:45:11.281Z→02:45:13.323Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 93-security-patched-version-red | 0/1，exit1，469.1052ms | 02:45:53.264Z→02:45:53.809Z | `271f3408664b8312d8b0860b331847dacaf83edab3e51489b92950729dfec100` |
| 94-security-patched-version-green | 10/10，exit0，1814.5849ms | 02:46:11.711Z→02:46:13.597Z | `18b40362a00d1373942eceda895ee92a69e9704cf006eca3b4e0ac39fa8dbc5c` |
| 95-security-patched-version-typecheck | exit0，空log | 02:46:14.339Z→02:46:16.352Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### 正式 §10 精确接线核准

Root随后全文读作者正式§10，批准其三阶段精确计费（observeDue所有旧短证据模型调用、同次永久保留共用预算；produce/read另核实际完整引述）、实际flat ID引用与物理复制的区别、最终四-kind SQL/state/marker v2，以及strict可选`formatVersion:2`及完整展开的mitigation输入摘要。旧段缺失只表示未知，不自动升级为完整空集合。该核准是实施前契约决策，不表示计费/缓解代码已通过。

另批准**新未发布的**`GitHubEventHistory.developments`只保存严格`nodeId/kind/eventId/developmentId/revisionId/observationId`消费身份投影，不为消费重复复制`change/excerpt`。必须从实际旧Report的可见developments逐项导出并核完整集合，保持逐原source权限、真实成员校验及消费未知时fail-closed；不能借这个收窄删当前或语义比较需要的历史短证据，也不改已验收旧Record字节。该有限投影避免长期消费仅因冗余引文副本耗尽额度，不是引文使用豁免。

作者已获直接开始共同引文公开RED→最小GREEN的批准，然后推进真实none baseline→B文本缓解首片；当前仍无整票最终SHA或资格通过。

### 独立GHSA范围修订探针冻结，尚未首跑

独立作者仅在`data/root-v1-13-security-revision-review/`新建三文件，Root已全文亲读README、fixture和probe并逐项重算hash，未读取作者产品helper。四期为普通Request8 R→同一GHSA首次完整high风险A→真正范围扩大B→重启后updated推进但恢复A；后三期各4个novel，正向入选、保留频率、真实旧origin/完整材料及已消费身份、两次重启和公开纯重算均有预先固定期待。只用Owned HTTP/semantic替身与真实SQLite，无SQL业务oracle；不要求精确等价A回归时额外调用模型。两条完整中文短句合计不足120 codepoints，原source限120，不从文本变动或hash判实质性。

- README SHA **651F3666DB0BE616CB9E78605DA5D85EFC3431A58246BE7A82043648AB327E2A**。
- `security-revision-fixture.mjs` SHA **984650A9A1577D223EF67CF22FDD68D7AAE317AAB216AB585A765E5A8FC20F11**。
- `security-revision-return-probe.mjs` SHA **DA6A42C5B1FAFD91542A9CDFE49730A8963C160045A50E29BD354BB30648AE63**。
- Root新包装`data/root-v1-13-review/security-material-return-probe.mjs` SHA **606EF5E43F34307041ADB24E9E096E51EC9A2F7FB45C8524A4433EDD50B61716**，每次在原capture记录模块/状态外，前后强核这三个外部文件hash，单fd继承运行，timeout30秒。只新增包装，不改旧capture/oracle。

两份原probe脚本及包装仅语法检查通过；业务首次运行待作者下一短冻结，不计PASS。精确Interface映射为`assessSecurity`单assessment、完整`SecurityMaterial.origin`、真正归档`InterestSnapshot`，Root已静态对照，不将语法通过升格为运行兼容。

### 96–99与新独立安全修订首跑

Root核96–99各原metadata完整before/after及log SHA，亲读新增两条公开测试。96是非法same引用虽未使仓库入选，却被保留为supported verification的真实收据缺陷；不能夸大成已重复出版。97将该非法引用拒为null，安全局部11/11，98类型检查通过。99提供250个codepoint、含非BMP emoji的完整Release摘录，真实verification与development两处保留恰好用满500；同源GHSA仍保留额外范围修订而RED。该失败明确发生在相关公开snapshot收据，非引用前提不足；共同预算修复尚未在此段获得GREEN。

| 作者目录（`data/v1-13-slices/`） | 实际结果 | UTC（2026-09-07） | 原log SHA |
| --- | --- | --- | --- |
| 96-security-unknown-same-red | 0/1，exit1，435.9836ms | 02:53:13.413Z→02:53:13.925Z | `7474d0c739c7c9c7b091940dcac2cbf455d2e33ab49e59a17b5a7f82bd21bb97` |
| 97-security-unknown-same-green | 11/11，exit0，2056.1784ms | 02:53:35.825Z→02:53:37.957Z | `2760bfdb042b88ca800e2f52e2a320f7d1fc13ad9f022b603f620c886cfadcf4` |
| 98-security-unknown-same-typecheck | exit0，空log | 02:53:38.729Z→02:53:40.771Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 99-shared-citation-red | 0/1，exit1，403.8954ms | 02:56:52.619Z→02:56:53.103Z | `ee9bc26ef1c7cec1dc379df1b4b6c2af6f745bb6fa48c5d0c3531a8e0123c890` |

作者随后明确提供99-RED-stable-source短冻结，src是97/98已通过版本，tests另含99预期RED。Root首次执行前段已冻结的独立GHSA探针，`wip-ghsa99-security-return-01` **1/1、exit0、404.5079ms**，实际UTC **02:57:34.166Z→02:57:34.868Z**，原log SHA **63645b827b6356e8ea61f9c5322516c29d7d8d4fe0d39907173dd2a7f5810c2c**。Root独立重核完整metadata前后相等、hash，并将每个src模块与作者99原metadata逐项比较完全一致；新README/fixture/probe/包装的冻结hash不变，无业务期待修正。Owned DB与原日志保留，Root完成后明确解除冻结。

这是独立范围扩大、回A抑制、完整实际origin及消费历史、重启/公开重算的WIP诊断，不能合并成同一固定SHA的12测试最终通过，更不代表未实现的共同引用/自然缓解/动量已通过。Root同期实时读取GitHub #13为OPEN、assignee yiwer，未修改tracker或调用真实来源。

### 100–105：新输出共同引文修复与容量样本版本化

本轮Root先实核master `4de15e1`、唯一作者仍在原base的ticket/v1-13 WIP，三个agent当前状态中产品作者确实running。上一goal轮有独立GHSA首跑及三个正式证据提交，为progress；没有触发阻塞审计。继续沿implement/TDD已批准公开Seam，不变更整票目标。

Root亲读100–105原日志、公开容量测试及当前共同reserve接线，逐项核原metadata完整before/after和log SHA。100只修复同一收集里Release/GHSA**新保留输出**共用额度，安全12/12，101类型检查通过；旧模型输入、完整永久previous、按原source分别核额及produce/read阶段尚未接齐，不能声称§10整体通过。

102合并30/31：原容量样本290个非空短引文材料违反共同500额度，公开snapshot变0，在材料数前提处失败，尚未触发被测原origin故障；不是预算缓存修复回退的证据。作者获准版本化替换容量输入，同时保留原71/102日志与源码指纹。作者确认早期完整fixture没有另存副本，仅保留当时hash、日志与补丁过程；不得声称旧WIP完整源码已冻结可直接复跑。

103新的29-material/其余元数据样本在预估原run>2MiB前提失败，属样本大小不足。104调整合法长UTF-8元数据及>1,400,000前提首跑PASS，但其“迁”摘录从半词截取，Root未接受为完整引用样本，要求改成完整“旧接口已移除。”再跑。105新完整句29×2×7=406 codepoints，1/1 characterization通过；不伪称该样本触发新的产品RED→GREEN。

| 作者目录（`data/v1-13-slices/`） | 实际结果 | UTC（2026-09-07） | 原log SHA |
| --- | --- | --- | --- |
| 100-shared-citation-green-attempt | 12/12，exit0，2082.7974ms | 02:58:53.356Z→02:58:55.514Z | `21019e6f204aeafaf83b75f89a4fa0a3979e499ab23d62775b2681ba3d8ec9d7` |
| 101-shared-citation-typecheck | exit0，空log | 02:58:56.376Z→02:58:58.401Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 102-shared-citation-affected-local | 30/31，exit1，4270.7435ms | 02:59:32.159Z→02:59:36.513Z | `04c8b25d0111af3b0f710902af5fe460d7e2136a9d6418c7d000fd57cfe89231` |
| 103-lawful-shared-origin-characterization | 0/1，exit1，436.1027ms；样本前提 | 03:01:12.992Z→03:01:13.505Z | `d259b363f4bc41e888796d231d1d5528d16dd676268715dc497e98cf9f050cca` |
| 104-lawful-shared-origin-characterization | 1/1，exit0，624.8865ms；引用不完整，未接受 | 03:02:52.335Z→03:02:53.032Z | `07396a5b6b0e2ac4a42f3a3b6c6926c8c8a7345cdb91216705709cb0162d7b02` |
| 105-lawful-complete-sentence-characterization | 1/1，exit0，627.2829ms | 03:07:13.376Z→03:07:14.079Z | `048dea8ac5e03526934d7d721856f86f0427f908c365b7b172ea1d8ace8f3523` |

105诊断来自公开snapshot的真实DevelopmentRun序列化字节和实际Owned故障父行：损坏/健康DevelopmentRun分别**1,531,082 / 1,530,967**字节，损坏/健康父GitHubRun分别**934,214 / 942,502**字节，均在单行上限内。Root另算重复同坏origin29次为**71,493,584 > 67,108,864**字节，确认它足以定位原64MiB重复计费问题，而操作内单次缓存可留下健康项目的预算。当前每run只有29个不同material，不是290或1000容量验证；源码仍仅模拟HTTP/语义，不作实际模型质量结论。

Root另派独立作者在新`data/root-v1-13-citation-review/`准备旧输入+保留副本共同计费探针，尚未首跑。预声明A完整38字、B完整15字、source额度76：先普通Request8发表R，再collect A不出版（两份A=76），下轮若比较B，旧输入38+永久previous38已满，新B收据30应被拒。不要求B一定调用模型；能预检跳过合理，但不能裁A历史或假消费。此为已批§10的独立检查，不增加产品规则或改旧Root oracle。

### 106–111：同源旧Release输入与保留共同计费

Root逐个核106–111的实际原metadata/log SHA及完整before/after，108真实旧引文反例为：A完整23字、source额度46，下一轮已用旧model输入23与永久previous23，却仍保留B新verification。109修复后该新片通过，但合并31/32；失败是原4个repeat配额样本在旧+新实际引文副本计费下超过500，使最后r4本轮没有资格，而非配额规则/消费被改。作者仅将该样本证据v2换成完整23字短句，原“3 novel→6位置、只消费3可见发展、后续r4仍可报告”业务期待不改，111合并32/32；110类型检查通过。Root没有把109的31/32记为全绿。

| 作者目录（`data/v1-13-slices/`） | 实际结果 | UTC（2026-09-07） | 原log SHA |
| --- | --- | --- | --- |
| 106-current-quote-regression | 31/31，exit0，4548.5209ms | 03:08:00.102Z→03:08:04.731Z | `f2e44a6c506acf1e20783ec16def719f38796c31b5ef1ae5d575a5dc0d0ca1dc` |
| 107-current-quote-typecheck | exit0，空log | 03:08:05.499Z→03:08:07.536Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 108-release-old-quote-red | 0/1，exit1，408.2190ms | 03:08:53.470Z→03:08:53.952Z | `2696d0b20a68508dd9f392eb0ce0608fdbfe4897e7d9008061505e1eabc50dab` |
| 109-release-old-quote-green | 31/32，exit1，4588.8188ms | 03:09:16.723Z→03:09:21.376Z | `56d36e00fa1a7daa346d701f2cd1673725c955f95d545ee50a79009d96c93a99` |
| 110-release-old-quote-typecheck | exit0，空log | 03:09:22.284Z→03:09:24.330Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 111-release-old-quote-regression | 32/32，exit0，4609.6635ms | 03:09:49.583Z→03:09:54.259Z | `6795031f53806bcfe501c1055a3f212176f34f1c25230cbbc9983e144a9a1f5f` |

111只覆盖同source旧Release路线；跨原source、GHSA旧材料、完整归档出版计费仍required。作者主动提供冻结时独立新counterprobe尚未完成最终静态映射，Root立即明确解除，未让产品作者等待未就绪探针。

Root另独立检查旧Root Release fixture：A全文确为133个ASCII/codepoint，模型旧input+保留previous+当前verification/development四份为**532>500**，原A→B也更长。不能要求产品绕过该计费规则以保证不合法输入的旧positive继续PASS。Root已指派另一个独立作者仅在新`data/root-v1-13-lawful-review/`准备完整短中文证据v2；七个基础scenario及A/B唯一scenario本体须与原文件逐字/hash相同，仅两个新fixture的正文改为语义等价完整短句、原category/object/scope保持，原source500不提升。旧原fixture、oracle与日志完全保留，不将新输入运行称作旧输入PASS；新计费counterprobe与新合法positive共同保留约束与完整业务目标。目前为准备，尚未执行v2。

### 112–117：原来源计费、GHSA旧材料与整节点缺额语义

Root亲读新增公开测试与实际计费实现，独核112–117各原metadata完整before/after和原log SHA。112是新source较小额度错误承担旧source完整Release证明，模型收到空历史而真实RED；113修复为先按原policy identity确认实际许可/limit，再按sourceId共同累计，合并33/33。115的GHSA旧material为完整23字，原history、永久receipt.previous、实际model.previous三处正好69，仍接受另一个修订而真实RED；116合并34/34，114/117类型检查exit0。116不自动证明整history缺额或exact/same跨来源反例已覆盖。

| 作者目录（`data/v1-13-slices/`） | 实际结果 | UTC（2026-09-07） | 原log SHA |
| --- | --- | --- | --- |
| 112-old-source-quote-red | 0/1，exit1，332.9950ms | 03:17:02.329Z→03:17:02.731Z | `13cebcc88a16ad73a1f2204be97c14f990ce171de50decc50378d73089ba5134` |
| 113-old-source-quote-green | 33/33，exit0，4824.1803ms | 03:18:00.709Z→03:18:05.610Z | `edb75668dbb1990f92eb5eb440da81c103e6f0256a4f966339e7f07eb2277aaa` |
| 114-old-source-quote-typecheck | exit0，空log | 03:18:06.379Z→03:18:08.434Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| 115-security-old-quote-red | 0/1，exit1，400.9950ms | 03:19:37.806Z→03:19:38.281Z | `99ac346e6a61665f71e2803549c5a74e92b819bfb1da5d2123bbfdaea5c4b8ab` |
| 116-security-old-quote-green | 34/34，exit0，4699.4862ms | 03:28:33.657Z→03:28:38.432Z | `20d7aeddd184294a8d8793ad40fc1fb7610f9fcf9106f42b9ec550bea64d7494` |
| 117-security-old-quote-typecheck | exit0，空log | 03:28:39.270Z→03:28:41.275Z | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Root批准复用既有`history.unavailableNodeIds`表示合法引文额度不足造成的**整node安全历史未知**，不新增Schema/DDL。仅安全history投影比较可排除合法整node缺失；原actual run相等、所有已冻结prefix/count/bytes/digest、真实origin/member及逐原来源权限全部保留。节点必须属于本轮有效候选，合法缺额保留原freeze；既有index本来不可用路径仍按原规则fail-closed，不能借标志洗掉损坏。整node不得残留部分entries/materials/receipt/security development，不能当初次或复用旧good授资格；风险未知节点隔离，不连带抹去其他ordinary节点。Root静态实读116的verify/readNodes及ranking，确认实际整prefix调用未移走、ranking会因history unavailable隔离；剩余公开characterization继续实施。

### 独立旧引文首跑与合法短证据v2的117窗口

Root全文读新`data/root-v1-13-citation-review/`三文件、最终调整区域及包装，首跑前业务期待固定：A完整38字、B完整15字、固定source76；A采集两处76不出版，下一轮旧模型输入38与永久previous38已满，不得留B新摘录或假消费A，独立novel仍可出版/读取/重启重算。不强制模型调用，允许合法预检跳过；本次实际完整A被发送。

- README SHA **9A80F41C7FF8D5FA25B24854F327180D588DDE05EBBABBE65296CDF65FAB0280**；独立作者交接曾误插空格，实际文件及包装hash核对未受影响。
- fixture SHA **D9646F7A24A58EFE70B15AC3F6825936D6ABE1CFEF7036593C5CCFFF8A8ADCEB**，probe SHA **99F33F4E1C44B212A6C7223F2685A3FD39DFFC216FD175DD20C18517709D8D79**，Root包装SHA **A02359D906BDCF24D6B5D128BBBC2BC6A84E33BC2C95C6C15F680B91BCF0D153**。
- 115稳定窗口首次`wip-quote115-old-input-01`为1/1、exit0、223.7332ms，UTC **03:26:31.049Z→03:26:31.574Z**，log SHA **e551fd28423f1ac2f5b9090c19320b209d5dc46ac894dc6afc2c9f6e3273ad9e**。Root逐模块核其源码等于作者115原metadata，完整before/after与原log吻合，完成即解除冻结。

Root另亲读合法v2全部说明/manifest/两个静态引文账，并由新包装在业务前后重核：八个scenario原新字节/hash相同，两个fixture全文只替换三个完整中文body，其他字节不变。A34/B36 codepoints；observe静态账重复A136、A→B140、回A208；publication明示库存最高416，但这不是最终实际计费/实测承诺，额外实际用途仍要计费。原长英文输入及所有旧日志保留，不把v2结果记为原输入通过。

- v2 README **07C7F919EB3346CAB562BD256E137AFCD2415E0986AE1679358082EF9AD6276D**；manifest **A00A38B5BD03834F62252EF3A32228E1797C5B718C75F6AF4A39C3C01CCB77DD**；静态账 **7B966DA363FFE02FC2E789D44D1FEE0EEE3D4862E1F8C0F876234D0203A8EA56**。
- v2主fixture **00A29C5F37B41041FC20A535B9C3453EF270E8560A323CF3702E417E83A54BC2**；revision fixture **8D464DF5B069FA6C8473364123AFE2E194EDEA2977CA57C898E14F0A2A625B3B**。八原scenario SHA见manifest及前段记录。
- Root新`lawful-release-family-probe.mjs` SHA **1B1033A741EF8F48E15168E609B6D7D5788B3FEB57E0694D21E472E91DCD80AC**；固定manifest前后验所有原/新文件及说明/账，核仅body替换等式与codepoint/bytes/算术，逐子进程继承原fd、30秒有界。原capture不改。

作者117稳定冻结约10秒，Root执行下表五组，完成明确解除，随后逐份核完整before/after、原log SHA及每一src模块均等于117原metadata。Release v2为首次业务执行八组九测试（包含context/head损坏两个反例），加原security scope两项、原GHSA回A一项、原旧引文一项，**同一117源码13个node:test通过**；另Record9五刊不是node:test计数。全部Owned HTTP/语义替身、真实SQLite；无真实来源、模型质量或整票最终SHA资格声明。

| Root目录（`data/root-v1-13-review/`） | 实际结果 | UTC（2026-09-07） | 原log SHA |
| --- | --- | --- | --- |
| wip-quote117-lawful-release-01 | 8组9/9，exit0 | 03:29:46.242Z→03:29:50.800Z | `ea7a7eaabb884ad5c9fabc7010e995ff4609d35bef849d4ad243e53ed74f49a7` |
| wip-quote117-security-scope-01 | 2/2，318.2041ms，exit0 | 03:29:51.191Z→03:29:51.731Z | `5fec4b54e68c0fbe19a7ca35fe709aee080d959b2353951fed3e25c5bcf632c6` |
| wip-quote117-security-return-01 | 1/1，411.4501ms，exit0 | 03:29:52.121Z→03:29:52.815Z | `75897a42fc2bf41e6a38ffa3b88a97c3313b2bd7c81c3d63ac6506a5fbf87a36` |
| wip-quote117-record9-01 | 5刊完整Record/MD原hash不变，exit0 | 03:29:53.137Z→03:29:53.523Z | `f23bf9ef61fdbefab3311dac00731bf50267bb3fbc67bebd03c9dbeb68e41699` |
| wip-quote117-old-input-01 | 1/1，220.9960ms，exit0 | 03:29:53.832Z→03:29:54.338Z | `60280f5da34ba8d866e415f733eb892f43d52f663126ad2862d109cb0c59af39` |

另已派独立作者准备固定policy69、四node分别合法取得23字material后同轮完整history至少92的整node缺额反例；不预定哪node先耗尽、不把内部Release/security先后顺序当规范，仅准备未运行。Root也静态指出Release单条仍有UTF16 `.length` 边界，与总pool codepoint修复不同，要求后续独立非BMP用途覆盖，不把250emoji双副本测试视为所有Unicode边界已通过。

## 兼容及安全

已接受Request1–8/Record1–9/Version1–8/Canonicalv1–v7与`observer-github-heat-v1`旧评分/字节不原地改；Report SQLite v1、GitHub application_id1329746759/v1不擅迁移。新Schema、采集Interface、持久结构或多票契约须Root协调单一写入者。保留50有界候选、当前来源权限、逐跳网络/稳定身份、截止可用时刻与失败不复活旧good规则，不接收Request/Agent自报历史或权限。

Root持有29旧调用、Record7两刊/Record8四刊、20项#12专项/13旧GitHub专项/Spec9组以及新Record9五刊固定oracle。Record9基准`O:/GenesisCode/Observer-worktrees/accept-v1-12-r2/data/root-v1-13-compat-41020f4`，baseline SHA **e69381dd7517c8d6fd524842f904d82b5f2be3a9bfad27b3782063378e154f88**；reader `Observer/data/root-v1-12-review/verify-record9.mjs` SHA **2e624b6be9343864f598d2c697d6f18e16f272cb3acfdb6e96f368dfbe24ab14**。禁止重freeze/改期待/删除原档。

不读取PAT/QQ_SMTP_KEY或无关`.idea/`，不调用真实候选/Provider/SMTP，不部署/购买/push/启用生产。QQ既有单封实际收件确认不重发，Claude live延期。新TEMP仅指定data；固定Docker镜像与Root串行，整次NoSuchImage失败保留并只读核查后同SHA新目录整跑；不升级/rebuild/retag/restart/prune，不清理原data/被拒目录/退出容器。具体固定身份和安全边界继承[#12](12-github-heat-and-novelty.md)与[执行入口](../EXECUTION.md)。
