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

## 兼容及安全

已接受Request1–8/Record1–9/Version1–8/Canonicalv1–v7与`observer-github-heat-v1`旧评分/字节不原地改；Report SQLite v1、GitHub application_id1329746759/v1不擅迁移。新Schema、采集Interface、持久结构或多票契约须Root协调单一写入者。保留50有界候选、当前来源权限、逐跳网络/稳定身份、截止可用时刻与失败不复活旧good规则，不接收Request/Agent自报历史或权限。

Root持有29旧调用、Record7两刊/Record8四刊、20项#12专项/13旧GitHub专项/Spec9组以及新Record9五刊固定oracle。Record9基准`O:/GenesisCode/Observer-worktrees/accept-v1-12-r2/data/root-v1-13-compat-41020f4`，baseline SHA **e69381dd7517c8d6fd524842f904d82b5f2be3a9bfad27b3782063378e154f88**；reader `Observer/data/root-v1-12-review/verify-record9.mjs` SHA **2e624b6be9343864f598d2c697d6f18e16f272cb3acfdb6e96f368dfbe24ab14**。禁止重freeze/改期待/删除原档。

不读取PAT/QQ_SMTP_KEY或无关`.idea/`，不调用真实候选/Provider/SMTP，不部署/购买/push/启用生产。QQ既有单封实际收件确认不重发，Claude live延期。新TEMP仅指定data；固定Docker镜像与Root串行，整次NoSuchImage失败保留并只读核查后同SHA新目录整跑；不升级/rebuild/retag/restart/prune，不清理原data/被拒目录/退出容器。具体固定身份和安全边界继承[#12](12-github-heat-and-novelty.md)与[执行入口](../EXECUTION.md)。
