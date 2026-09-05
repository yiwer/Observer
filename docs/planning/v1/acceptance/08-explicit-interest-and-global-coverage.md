# V1-08 执行与待验收记录

状态：**首次冻结 c0a4522 不接受，Spec P2 经 Root 复现，交原作者窄修**。GitHub #8 OPEN，已分配 yiwer；未验收/集成。

- 范围：[GitHub #8](https://github.com/yiwer/Observer/issues/8)、[本地票](../tickets/08-explicit-interest-and-global-coverage.md)；PRD US8/64–66、AC17、D1/D3/D6。
- Fixed base：**`b1b6ac3ab557f0098ae5b133f20f4ca32b9182aa`**；包含 #7 最终实施7fae122、集成8e02377及关闭记录。
- Worktree：`O:/GenesisCode/Observer-worktrees/v1-08`，branch `ticket/v1-08`，Root 创建后实际核对 SHA 与 clean。
- Fresh-context `/root/implement_v1_08` 已实际创建成功，未复用 #7 作者/reviewer；先亲读 implement、TDD及required references、必要领域/interface指导与项目规范。
- Root 实际读取 #8 全票与空评论；原生 dependency API 返回唯一 #7 closed，#7 closedAt `2026-09-05T12:21:57Z`。Root 已将 #8 分配 yiwer；未把标签当作依赖验证。
- [GitHub 启动回写](https://github.com/yiwer/Observer/issues/8#issuecomment-5551799527)已发布并实际读回完整正文/作者；#8仍OPEN、assignee=yiwer。

## 票内范围与判定约束

版本化 Interest Profile 包含主题、实体、地区、优先级与排除项，支持文件维护/导入导出，无效配置说明错误并保留上一有效版本。每次日报使用固定快照与可追踪生效版本；相同 Evidence/历史只变偏好可观察排序变化，中途修改不改变在途刊次。

重大 Global Baseline 即使与兴趣排除冲突仍保留入选资格，不绕过 Source Policy、证据核验、事件历史或时间窗口。不把 Agent 的自报标签或关键词命中直接当作事实权威；区域/语言描述缺失保持未知，不能用域名或来源机构国别推造事件影响范围。中国/美国/欧盟/其它全球重大区域及多语言的纳入策略应可解释，实际缺口在总览/相应栏目可见。

初始配置需可审阅，不暗中推断 Owner 私人偏好；无阅读时长、点击学习、静默偏好改写。保留六栏7/3软目标、不凑数、单主故事及不占配额 Impact Note、明确补报、旧刊不重写与历史来源传递许可。GitHub 专门热度/仓库、高风险主题、纠错工作流、Provider路由、调度、PDF/SMTP/Android、部署不属本票。

## 先行计划与 TDD

已要求作者先回报配置文件/版本持久性/无效回退/排序优先级/Global Baseline 权威和首个竖切方案，再由 Root 核对是否仍属已批准 PRD T1：从业务日期、配置、证据、历史及外部 Runner/Verifier/时钟触发公开 `produce → readReport`，观察最终版本、正文、缺口和归档；真实磁盘 SQLite、重启可恢复。不测试私有函数、内部 mock 或 SQL 侧读，不新增 test-only 业务入口；如确需新的 seam 或重大协议选择，先报告。

一片 RED→GREEN 后再下一片；定期 typecheck/单文件，最后代码与专属实施说明一起提交 clean 固定 SHA，再运行全套 check/smoke。Root 另做固定非空三点 diff、Standards/Spec 独立双轴、detached 与实际 master 验收；本文件不提前给出测试 PASS。

当前已有152个测试，smoke3是其子集。request1/2/3与旧Record1/2/3/4读契约、SQLite user_version1、来源缓存独立于永久归档均须兼容；新版本演化不能修改旧正文或冒称原始模型回执。方案待作者基于代码收敛，以上不是已实现结果。

## 独立旧归档与安全

Root 保留 #5 producer 的 Record1/2（`accept-v1-05/data/root-v1-06-compat-4ca1d8`）、#6 producer 的 Record3（`accept-v1-06/data/root-v1-07-compat-a913cb`）和 #7 producer 的两期 Record4（`accept-v1-07/data/root-v1-08-compat-9b22d0`）。最新两期包含主故事、Impact Note、重大更新、前次版本/时间关系；生成与读取脚本及不可变摘要见 [#7记录](07-event-history-and-updates.md#本地集成与后续历史基线)。冻结/集成后用新 built reader 读取，禁止用新代码反造旧预期、修改或删除这些目录。

固定 Linux Codex0.153.4 / Claude2.1.252 与无凭证协议fixture保持；既有首项Claude tag inspect偶发失败根因未知，需保留完整终态，必要只读核对后同SHA定向/全量另记，不拼为首跑通过。不重建镜像、重标签、重启daemon或改全局配置。

本票不读取秘密或认证文件、不调用真实Provider/SMTP。QQ单封预检已由Root完成，禁止重发；本机Codex地区资格信息仍缺，真实Claude测试延期。用户 `.idea/` 和其它项目资源不动。绝对禁止触碰或换工具清理：

- `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`
- `O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c`
- `C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`

新的测试使用自有唯一目录并保留证据，不广泛删除。代码未push、生产未启用；真实来源/模型质量及14天人工核查不能由本票替身证明。

## 首片方案确认（未实现/冻结）

作者已亲读所需技能/项目规范，实际确认 fixed base 与 clean；仅 `npm ci --ignore-scripts` 安装7个锁定依赖，尚无测试结果。Root 已确认以下方案属于既有 PRD T1 的配置输入及公开 `createObserver` Interface，不新增 HTTP 配置路由或测试专用业务入口：

- Interest Profile v1 严格JSON，显式主题/实体/地区优先级与排除、目标语言；初始空主题/实体/排除、CN/US/EU等权，有限语言列表仍须在实施说明中解释，不代表已有采集能力。
- 拟增加本地 Owner `importInterestProfile(filePath)` / `exportInterestProfile(filePath)`；输入文件与应用持有的有效active快照分开，显式import验证后同目录原子切换，版本单调、同版同内容幂等、同版异内容/回滚拒绝。同步只约束本进程，不宣称跨进程事务；export新文件不覆盖档案或active。无效输入保持上个版本，直接损坏active不得静默造默认。
- 拟 request4 → Record5 / Version4 / canonical-v3，并保留request1/2/3与旧Record1–4；Record4继续作为已分类事件历史，不能降成legacy。所有版本/归档关联和旧字节兼容待实测。
- 选择metadata拟来自现有SemanticVerifier与合格Claim/证据关联，最终Gate后仅归档明确projection的hash/enum/qualifiedIDs；新optional注解也不能从旧request入口泄漏隔离自由文。来源字段不可用、语言/地区不明保持unknown，不以标题或域名推造。
- 硬门/事件历史资格 → 合格metadata与兴趣排除（证据支持的baseline可跨该排除）→ 每栏baseline、显式priority、稳定平手 → 最终7/3软截断。必须保留第8个及以后已合格候选通过偏好上升的机会；多成员metadata不能借未合格内容授权，不重展开Impact Note。
- baseline只保留资格，不强制凑数或保证入选；声明类条目只能依据已证声明行为，不能以未证承诺结果主张重大影响。覆盖统计区分本期可用证据、已核验标注和已选故事，未知/未标注单列，不宣称全球召回。

第一个竖切：两份独立磁盘archive使用相同Evidence/空历史，仅显式priority不同，观察两候选排序交换及Report里的固定配置版本/hash。后续逐片加入invalid保持、文件往返/重启、在途冻结、baseline硬门、语言/地域缺口、旧档兼容。Root已批准先写此一片RED，不以计划描述充当实现或PASS。

## 首片 TDD 与 Root 独立诊断（WIP）

作者首个 `node --test tests/interest-profile.test.ts` 实际 **0/1 RED**（223.03 ms），公开 `importInterestProfile` 尚不存在。最小实现后 typecheck PASS、同文件 **1/1 GREEN**（258.16 ms）；request4/Record5/Version4/canonical-v3、显式文件导入、快照与最终截断前排序已贯通。版本错误、baseline、覆盖等后续规则此时尚未完成，不能将首片当整票通过。

Root 实际读取首片测试与当时 diff、新的三个 interest 模块：测试经文件导入和公开 `produce → readReport`，比较两个独立archive中的实际顺序与配置快照，不使用内部SQL。已提醒作者把虚构来源正文与候选事实保持一致；annotated-fixture并非真实语义质量证据。

Root 新建自有 ignored `O:/GenesisCode/Observer-worktrees/accept-v1-07/data/root-v1-08-review/selection-capacity-probe.ts`，九个独立虚构事件、实际正文包含全部事实，均有合格外部核验标注；只把第9项的显式优先级调高。对当时 #8 **WIP source** 运行 **1/1 PASS**（52.7749 ms）：最终7条依次为item-08、item-00至item-05，3条重点、7个Event Cluster，关闭writer/新reader读回完整JSON一致。该补充边界初跑即绿，不冒称新增RED；脚本/期望与新SQLite材料保留，冻结后必须对built重跑。

同一阶段 Root 用既有不可变producer档案对新WIP source读取：Record1/2 **2/2**、Record3 **1/1**、两期Record4 **2/2**，合计**5/5**旧JSON/MD/摘要/身份与私有读取兼容。未重造旧档，未把Source reader诊断绑为当前HEAD基线的实现结果；作者此时HEAD仍b1b6ac3，代码尚未提交。

Root capacity 脚本 SHA-256：`41d5883d4edc7cda3eb5e7db990f96b67c8b3cdf92459e7c35d8b277f020d827`。

## 后续竖切与覆盖归因整改

作者随后报告5个兴趣T1已GREEN：显式排序/快照、无效导入与版本冲突、在途import冻结、baseline在截断前跨兴趣排除，以及地域/语言已知与未知缺口；最近typecheck PASS，单文件5/5约351 ms。此前22个事件回归与当时3个兴趣场景25/25通过。以上为作者WIP报告，仍无最终冻结或全量check；逐片准确RED/命令明细留待实施说明和终态交接。

Root 独立 `coverage-attribution-probe.ts` 在新自有 `accept-v1-07/data/root-v1-08-review` 实际运行 **0/1 RED**（37.3762 ms）：同一来源文档明确包含中国/美国两个独立事件，可信标注分别为CN/US，兴趣排除US；最终仅选 `cn-only`，但 `coverage.regions.US.selectedStoryIds` 错误为 `["cn-only"]`。正确应为空；US的 `evidenceIds: ["shared"]` 可以保留，表示研究阶段确实观察到相关材料，不等于最终选中美国事件。

原因定位是当前 `interestCoverage.entry` 按共享Evidence ID给最终故事继承整个来源文档汇总地域，没有沿实际选中Claim/Cluster的地域标注归因。违反本票“实际覆盖可解释”和已确认的输入/标注/成稿统计分离；是当前WIP的实际错误，不是因尚未完成其它规则而人为制造RED。Root脚本 SHA-256 **`6ba77479ba076f8bda92108a448e98541978c631c0fc6c7225d0b174d57c688a`**，全程公开生产/关闭/重启读取、真实SQLite，无SQL侧读，失败材料保留。

已交原作者按现有竖切顺序用其自身T1复现后窄修复：区分证据观察与真实选中事件地域，不让已排除/未刊登/隔离成员因共享文档借权；支持事实/Impact Note按已声明统计语义处理。语言指标同样应核对其定义，但不把来源语言和事件地域混为一种含义。修复后Root原脚本/预期复跑，再在冻结built与实际master重验；当前不接受、不关闭、不开始#9。

### 覆盖归因整改后复验（仍为WIP）

作者用自己的第7片公开T1独立复现：重复Cluster成员标US，而主CN与另一EU事件共享Evidence，错误的US已选故事数组同时包含space/climate；当时6 PASS / 1 RED，约448 ms。改为沿实际已选fact/statement及supportingClaim的qualified annotation归因后，作者单文件 **7/7 GREEN**（416.7 ms）。纯Impact Note成员不会将未承载事实的地域借给主故事；证据层的研究观察计数仍保留。语言已选计数定义为已选Claim所见获准材料的标注语言，不再无条件join整个共享文档。

Root 未修改脚本或预期，对整改后WIP source实际重跑：原覆盖归因 **1/1 PASS**（53.9939 ms），US.evidenceIds仍为shared而US.selectedStoryIds正确为空；容量 **1/1 PASS**（74.7954 ms），旧Record1/2/3/两期4 **5/5**兼容。原RED材料保留，不改写历史。此开发期复现已转绿，正式关闭仍待固定SHA、双轴和built/master验收；其它来源/元数据边界继续实施。

## 首次冻结与独立检查

作者提交 **c0a4522ca52704f2f6c5ae65ca970ae3a0429214**（`feat: add versioned explicit interests and coverage baseline`）。Root实际核对base、HEAD、clean、commit list、非空完整 `git diff b1b6ac3ab557f0098ae5b133f20f4ca32b9182aa...HEAD`（90,345字符，14 files、+792/-29）及diff-check exit0；首次输出截断后完整重取，未以截断内容冒充全部diff。

本票新增14个公开T1测试、初始配置与 [专属实施说明](../../../implementation/v1-08.md)。作者记录10段真实RED过程及5个初绿补充测试；其中既有entity/region测试后来新增正文断言经历独立RED→GREEN。Root收尾提醒的数量缺口措辞已修为新版“硬门、事件去重及兴趣与地域筛选后不足”，不再把兴趣过滤称为Gate候选不足；旧版文字未改。

Root创建新的 detached `O:/GenesisCode/Observer-worktrees/accept-v1-08` 固定于c0a4522，`npm ci --ignore-scripts` 安装7个锁定依赖、build exit0，实际再次确认clean。以下均对该 **built `dist/observer.js`** 运行，沿用既有脚本及独立预期，没有重建旧producer档案：

| 检查 | 结果 |
|---|---|
| 第9候选在7条截断前按偏好提升 | 1/1 PASS，108.6773 ms |
| 共享文档不借已排除US地域 | 1/1 PASS，128.9291 ms；US evidence保留、selected为空 |
| 既有事件：新事实/因果历史 | 3/3 PASS，339.3039 ms |
| 既有事件：隔离注解不留存 | 4/4 PASS，197.1883 ms |
| 既有事件：声明/事实组合 | 3/3 PASS，123.6209 ms |
| 既有事件：来源许可传递 | 1/1 PASS，171.4147 ms |
| 既有事件：Version/Gate时间关联 | 3/3 PASS，203.1198 ms |
| 不可变Record1/2/3/两期4 | 5/5，原MD/完整JSON/摘要/私有读取保持 |

新增专项合计2/2，既有事件14/14；这些不是完整suite或生产质量证明。作者首轮full日志已出现首个Claude tag inspect `No such image`，其余组继续执行；尚待完整计数/exit，不中断后拼成PASS，不修改环境或镜像。

### Standards

fresh `/root/review_v1_08_standards` 已完成完整14文件静态审查，结束时c0a4522/clean；没有执行测试。硬性违反 **0**，启发式建议 **2**，worst **P3**，均非阻断：

- possible Duplicated Code：`src/interest-contracts.ts:15` 与 `src/interest-profile.ts:7` 重复兴趣键规范化规则，未来可抽取无依赖函数避免等价关系漂移。
- possible Repeated Switches：`src/interest-selection.ts:27,56,97` 重复Gate版本的assessment展开，未来可集中版本适配。

### Spec

fresh `/root/review_v1_08_spec` 与Standards实际并行启动，独立上下文、没有交换两轴发现。完整静态审查及自有公开T1探针后，**1项P2**：未实际调用SemanticVerifier时，`interestCoverage`仍将准备输入的`verificationEvidenceIds`计为“实际进入核验”。`src/interest-selection.ts:58,86` / `src/six-edition.ts:107` 的新使用与实施说明“真正交给Verifier、不包含仅Runner所见材料”不符。未配置Verifier、全部Claim因重复ID在发送前结构拒绝，两模式调用0次但inputEvidenceCount为1、MD报1，重启可读。Spec自有ignored探针 `v1-08/data/spec-review-d38d70b3-cd31-4954-83b5-443ab8ce4b8b/coverage-probe.ts` exit0为观察结果，不是断言修复通过。

两轴汇总：Standards **0 hard / 2 heuristic，worst P3**；Spec **1，worst P2**。Root不合并或重排两轴发现；该候选不接受，Root未启动完整detached suite或集成。

### Root P2 复现与整改边界

Root新增自有ignored `accept-v1-07/data/root-v1-08-review/verification-dispatch-probe.ts`，动态指定c0a4522的detached built reader，公开文件配置→produce→关闭/重启readReport，真实独立SQLite。首次脚本虚构Owner token不足32字符，4例均被`invalid-owner-token`拒绝，属于 **harness错误**，不是产品RED；只修正脚本token后重跑。

正式探针 SHA-256 **6c47db960ec1e3b52fbd55154325739df868dff95b021b72da61c78432a5fb9e**，实际 **2 PASS / 2 RED**（134.8554 ms，exit1）：

- absent / structurally-rejected：外部Verifier实际收到IDs为空，期望inputEvidenceCount为0及unknown数组空；实际count1且unknown包含observations，两个断言失败。
- throws-after-dispatch / invalid-receipt-after-dispatch：外部Verifier已收到observations，即使抛错或回执无效仍应count1并保留未知标注；两例通过。发送不等于核验成功，修复不能只依据有效回执计数。

全部材料保留。原作者已获完整Spec及Root复现，按自身T1先RED后窄修；保留旧`verificationEvidenceIds`准备输入语义、request1/2/3及旧档字节，在新版本准确记录实际交付的证据、跨批去重，不改文案掩盖发送事实。后续必须clean新SHA、完整检查及两轴复审、Root原脚本不改预期复验。

### 作者 c0a4522 首轮完整检查终态

`npm run check` **exit1，165/166 PASS、1 FAIL**；测试duration **198319.9923 ms**，命令wall204.1528秒。唯一失败为 `tests/claude-runner.test.ts:40` 首个隔离Claude协议fixture的 `docker image inspect` tag `No such image`，全部14个兴趣测试通过。日志 `O:/GenesisCode/Observer-worktrees/v1-08/data/v1-08-c0a4522-6dc7/check-first.log` 保留。没有中止/修改镜像、tag、daemon或环境；尚无该SHA第二full或smoke，也不为已知P2候选继续凑验收。此环境查询失败与Spec业务P2分别记录。
