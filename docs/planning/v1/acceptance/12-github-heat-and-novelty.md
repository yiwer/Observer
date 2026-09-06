# V1-12 执行与待验收记录

状态：**in-progress；首个候选e461739拒收：Standards无hard/2非阻断P3，Spec有1项P2且Root独立复现；作者与Root完整check虽各302/302，不能替代缺口契约。已批准原作者窄修，未合入/关票**。GitHub #12 OPEN / yiwer。

## 固定任务与依赖

- [本地票](../tickets/12-github-heat-and-novelty.md) / [GitHub #12](https://github.com/yiwer/Observer/issues/12)正文、空评论已实际读取；原生依赖恰为#8/#11，均CLOSED。
- #8已验收集成 **8079271c3cc2911257f5a54153b3ec16969c6b67**、#11已验收集成 **867e500431886e1d876066c950f3a880b38f81f8**均在base可达。#11最终候选/冻结/实际master全部证据见[#11记录](11-github-snapshot-observations.md#实际-master-验收与关闭)。
- 固定base **48d4767561459db66575125d18c8a89dce185068**，专属 `O:/GenesisCode/Observer-worktrees/v1-12` / `ticket/v1-12`。Root已核对不存在旧同名worktree/分支后创建并验证clean。
- 新上下文 `/root/implement_v1_12` 实际spawn成功，不复用#11作者。已告知亲读implement/TDD/tests/mocking/codebase-design及领域、PRD D8/T1、ADR0003、本票/当前#11契约/官方元数据研究，先回报方案、Root确认后才实施。
- [启动回写](https://github.com/yiwer/Observer/issues/12#issuecomment-5556371220)已单次发布，Root经独立API读回完整正文、ID与URL；Issue已读回OPEN/yiwer。

## 实施边界与先行协调

普通热度与历史报道降权：语言/年龄cohort、显式topic兴趣，不限制语言、不让累计stars独自主导；冷启动与实测动量分区标识；稳定node历史，7天冷却后30天线性恢复、90天频率惩罚；正常位置至少一半给过去30天未报道项目，候选/质量不足减少数量。须记录评分版本、函数/参数、全体评分输入/排名与选择理由，能用出版时保存输入重算。

技术方案需先明确精确边界、奇数取整、小cohort回退、质量阈值、参数比较与偏差指标，回放验证后冻结；历史研究示例不是已采用算法。参数回放是合成输入验证，不冒充用户满意度/真实噪音率。#13 Release/GHSA/重大动量一次性绕过及#22保留清理不提前实现。

#11 `snapshot(cutoff)` 已是最多7个Watch Item的出版投影，#12不能只对这7个排名却声称比较全部候选。Root要求在观察Module内部复用实际截止前完整合格候选、保留现有可用时刻/来源/失败约束；新增公开Interface、Schema/正文或持久结构先协调单一写者。报道历史只来自实际成功出版，并明确截止因果、当前来源权限和失败/重复的原子性。

沿Owner已批准T1公共观察→真实SQLite→produce/鉴权readReport→重启seam逐条RED→最小GREEN；不写私有helper/SQL旁路断言，不重新询问已批准测试边界。首片和评分实现均等待作者方案，不把派发等同于已完成功能。

## 兼容与安全

基线完整check282/282、smoke3/3子集。旧Request1–7、Record1–8、Version1–7和Canonical旧v1–v6正文原字节保持；Report SQLite user_version1、观察库appID1329746759/v1的变更须显式协调。权限/配置版本、逐跳DNS/路由、最小资源限制、受限secondary403读取、身份确认与数值资格分离、截止前当前失败不复活旧good数值等不放宽。

Root持有29次旧业务/Record1–6九刊oracle、Record7两刊，以及GitHub13项原期待；新增Record8四刊基准 `O:/GenesisCode/Observer-worktrees/accept-v1-11-r2/data/root-v1-12-compat-14f6889`，baseline SHA **ec54671f5c22b72661cf19037e8f4c95211a66ed68d7c78937e292f240d73638**，reader SHA **4a6c7ea75cd19d5d30aa7c4b2ed7e95aeac17676c612873c8af3e9a0069308d2**。禁止重freeze、改期待或删除归档；正式回归须用新built绝对路径读取。

本票不读真实PAT/auth/env秘密/QQ_SMTP_KEY或无关`.idea/`，不请求真实GitHub/Provider/SMTP，不部署、购买、push或启用生产。QQ既有单封预检和Owner中文收件确认不重发；Claude live延期。固定Docker/镜像约束与历史拒绝cleanup见[执行入口](../EXECUTION.md#保留的测试证据与禁止重试清理边界)及#11记录。作者与Root串行Docker；只读短标签失败需保留整次失败，新目录同SHA整次重跑，不拼接PASS。所有新TEMP定点自身data，旧证据不清理。

## 局部Interface及首片协调（未冻结）

作者已报告亲读全部指定技能/领域/票/当前#11实现与官方元数据研究，实际核对clean分支/base与原生依赖。Node v24.18.0，专属worktree `npm ci --ignore-scripts --offline`从锁定缓存完成、锁文件未改；没有Docker或真实候选/Provider请求。

Root批准以下实现方向，不视为参数或功能验收：

- Request8→Record9/ReportVersion8/`observer-canonical-v7`，旧路径原字节；两SQLite版本不迁移。观察Module可选`rankingSnapshot(cutoffUtc)`提供严格schemaVersion2的完整本轮有限候选（最多50），原snapshot v1最多7不改。权限核验须明确识别v1/v2真实收据，不能以新Interface接受Request/Agent自报授权。
- 一个版本化纯`rankGitHub({ snapshot, interestProfile, history, algorithmVersion })`供可信出版与固定归档输入重算；没有eval、用户任意函数或从网络补输入。Record9保存完整候选和既有InterestSnapshot，另存必要历史、规则、全体得分/入落选理由，不重复保存整个snapshot两次。
- 报道历史由截止前、期初已可见、实际成功INSERT的Record8/9选中稳定node导出，不单独跨库写历史表。来源与完整性不可验证时本栏history-unavailable，不视为new。相关90天内旧Record<=7 GitHub prose无法证明稳定node时留明确legacy Gap，不猜名称/URL；窗外不永久阻断。最终同步事务重核历史/来源→INSERT，失败或未发表尝试不产生报道历史；未来更正/撤回由后票明确接入。
- 精确UTC毫秒：7天点恢复仍0，之后30天线性恢复，37天全恢复；30/90天窗为`(cutoff-D, cutoff]`，对应边界须测±1ms。正常最终入选数N需至少ceil(N/2) novel，按质量合格候选选择可满足配额的最大N<=7，不足缩数，novel0则空刊，不为配额填低质量。
- 首片使用9个实际Owned协议格式候选与两个观察时刻，经真实SQLite→produce8→鉴权readReport：排序输入包含9个，原cap7之外高动量第9个入选，保留signed变化/版本/审计并重启原样读取。Root亲读测试和helper确认restartStore同时重开观察及Report库；没有私有SQL旁读断言。首片获准逐个RED→最小GREEN，暂定参数不可冒充最终算法。

作者参数提案`data/parameter-proposal/expectations.json` SHA **41ad8312dce52fe0ed5aa24771f97db29062d9d7ad6232dd10c8c18ff88db872**已由Root亲读：8组设计偏好/偏差场景，stars/forks权重、topic增益、cold门槛和频率惩罚均是候选而非批准常量。四点同cohort手算只说明信号平衡偏好，不是客观质量真值或最佳权重证明。

Root要求保留原提案，扩展另成版本；将描述性场景落实成完整可重放数值/结果，覆盖候选数/并列、语言年龄不均、实际双点间隔、存量不变性、正零负、cold、偏好及配额冲突。宽约束无法区分两个参数时如实说明，较小干预可作工程默认而不声称唯一最优。小cohort回退须披露降低分辨率，不追加未批准语言配额；createdAt晚于真实观察不能以max(1,负年龄)掩盖。measured注意力门依赖真实正净变化或经说明的实际间隔标准化率，不能仅靠巨大存量使零/负动量合格；cold proxy保持明确分区。

## 逐片实施证据（WIP，不是冻结验收）

作者base仍为48d4767，变更未提交。Root亲读新增测试、公开helper及实现，并读取以下原始日志；计数是各时刻同一测试文件的累计测试数，不相加成独立总数。所有内容只验证Owned外部协议替身→真实SQLite→公开生产/鉴权读取与重启，无真实候选/Provider调用。

- 首片完整9候选：作者报告原工具终端RED 0/1、274.6889ms（chunk `1bdc34`，`invalid-request`），GREEN 1/1、334.614ms及typecheck（chunk `3411c3`）。没有持久原生日志，Root未直接取得这两次终端；不补造原日志，不列为Root独立验证。
- `data/v1-12-slices/02-cohort-red.log`：1/2，365.89ms；语言分组领先者仍按全局计分。`02-cohort-green.log`保留第一次实现失败0/2、371.4027ms、`canonical-integrity-failed`；随后`02-cohort-green-2.log`为2/2、368.6348ms（SHA **6d9d38f48139bcc30062b268464e9000760544dadea5741aa773391d1ff072dd**）。作者说明归档字段顺序修复，未删除中间失败。
- `03-replay-red.log`：2/3、422.0762ms，第9项未入选候选starsDelta变造未拒绝；`03-replay-green.log`：3/3、406.7615ms（SHA **a80b8eede41e057768b2dc6b138f71ad50688efcbfa3982d06f2a0d8e1b1ffb3**）。Root先指出旧cap7投影不足以证明全体输入，作者新增全体实际收据重新择样与候选/排除项核对；不能仅对自报输入重算得分自证。
- `04-history-red.log`：2/4、505.3907ms，纯replay尚未支持新输入Interface、实际旧Record8改名后未冷却；`04-history-green.log`：4/4、494.1627ms（SHA **56f52f3ca300c1a0cfb56de2be7378b8f687a8e28833ed01cdb666a82769e2e2**）。实现从成功归档选中node生成历史、首个await前固定、最终短事务重核后写入。02/03/04 typecheck原日志均只有npm/tsc命令且无诊断；退出成功由作者工具结果报告，不由空日志单独证明。

这些阶段证据未替代最终固定SHA的完整check、双轴review或实际master资格。30/90窗口、cold、完整异常历史和参数回放仍逐片推进；Root不提前宣布#12完成。

## Root独立历史业务oracle（未冻结）

脚本 `O:/GenesisCode/Observer/data/root-v1-12-review/publication-history-probe.mjs`（当前SHA **11844966cae83a8b988904435587e330af095104d8ee99858bbf2310474d0a4a**）以独立Owned响应构建真实旧Record8和本期Record9，不导入作者测试helper、不私写SQL或自报生产历史。保留的`capture-probe.mjs`捕获全部src模块前后hash、HEAD/status、UTC、stdout/stderr与退出值；两流分别保留后连接，不冒称到达序列日志。

命令：`node data/root-v1-12-review/capture-probe.mjs O:/GenesisCode/Observer-worktrees/v1-12 O:/GenesisCode/Observer-worktrees/v1-12/src ts wip-history-02`。

2026-09-06T02:54:52.849Z–02:54:53.831Z，**4/7、576.6954ms、exit1**；`wip-history-02.log` SHA **6f452834f9c87f5e8aaa81b1fdbd04c8d92b539728c0413d6033c44d72d565d9**。前后HEAD48d4767和dirty状态一致、全部src hash一致，但不是clean freeze；相关ranking SHA **f1d9ba5534d6b54f19dee449b6b6a88bcb09462db7071270abd835b889528bd4**、observer SHA **0bdc2289a0b3747f7d17169a45d6043b7636bc0ee546551abe8f8614a83748c5**。

- 通过：实际成功发布时间距本期cutoff为7天−1ms、7天、7天+1ms时，稳定node分别冷却、冷却、恢复极小正资格；实际失败的重复Request7不会将未发表候选加入下期历史。均通过公开鉴权读取和重启一致性。
- 待完成：90天−1ms的旧source已撤销，历史确实标unavailable且不选，但正文尚未说明；90天及+1ms仍被窗口外旧source问题挡住。Root已将三个原期待交作者落实异常历史/Gap竖片，后续保持此脚本期待重跑；这是WIP诊断，不是最终Spec review评级。
- 首次`wip-history-01`同为4/7，但后三项先遇Root夹具换source未增加configuration version，导致正确的`github-configuration-version-conflict`。这是harness错误而非产品RED；原脚本副本`publication-history-probe-v1-harness.mjs`、原结果/日志完整保留。当前脚本仅在换source时增加版本，没有改任何业务断言。首次log SHA **a04da6ca41907b02062b00fcdc7dded4cd5f8734c4314946fb4455a2aeb4ed10**；7天和失败发布四项也通过，但不以部分通过拼凑全体资格。

### 原期待复跑及后续逐片进展

作者落实窗口外历史淘汰和窗口内显式本栏Gap后，Root原脚本SHA **11844966cae83a8b988904435587e330af095104d8ee99858bbf2310474d0a4a**原7项断言不变，执行同命令仅label换`wip-history-03`：**7/7、598.169ms、exit0**，2026-09-06T02:57:45.294Z–02:57:46.297Z；原log SHA **c50032238f3cacb8be80e51350f5d1532c8217344b9433fee152d73d68f93e41**。Root核对实际日志hash及结果before/after完整身份一致；ranking SHA **2cb25bf03aa49696b5a31e441f267ac96161f951c9f088dc762262a4f6f09344**、observer SHA **a5bed0db503bc404c737e0ce0a7dfb68ecc2721802d762c47667e86e7cc3d8fd**。前述3项WIP行为已按原期待闭合；尚未冻结，不能替代固定SHA验收。

Root也实读作者后续原RED/GREEN输出：05恢复半程4/5→5/5（573.3547ms）；06质量不足配额5/6→6/6（682.3533ms）；07cold/负增6/7→最终7/7（697.0922ms），中间`07-cold-green.log`保留未匹配转义下划线标题的实现失败，不覆盖；08恰90天旧源权限7/8→8/8（808.8981ms）；09近90天未知历史Gap8/9→9/9（848.8474ms）。后五个最终GREEN日志SHA依次为 **25eac4d8dca962b35d51c6957103fda636496becc2f6bf886f1a26a5c5a58614**、**f6c454c985ba99e6dda1c7f75cfefecbf8145dc532e8207e7a9cd9258bb9a5af**、**0025ab96f19175c2e608394c4e09988b3e9be50d89e4fe14c5c05e54b40bae5d**、**9ef2db2de11473b6263518d13aa12c552569eb528e535f9b881818c9b20d6ae4**、**d0fec7e7e8b4bedc214c2365b4507aac153041c1200e1508f5adde5d45f87ac6**。

剩余仍包括兴趣权重/排除、精确边界完整覆盖、完整性异常局部退化/并发失败、规则审计与完整参数回放评审，然后才最终提交和双轴/全量/历史回归。Root再次实际读取GitHub #12为OPEN/yiwer，未关闭、未push、未启用生产；#13未启动。

### Root完整时间窗口与频率独立回放

新增`data/root-v1-12-review/history-boundaries-probe.mjs` SHA **4923da9a0d66eb2bb54a54db6e3d38e595150d9a41ac78f698eff16605ba9ce4**，独立夹具`publication-fixture.mjs` SHA **167dd2d2c961c43f7eb9d9f46dd40fc922cab10bc9b477182969ad0ef12c189f**。夹具提取自Root已验证的独立实际出版设置，未修改原7项脚本。9项分别用真实旧Record8验证30/37/90天的−1ms、恰好、+1ms；第10项实际生成五份成功旧刊，验证同一稳定node计数为5、恢复相同时比单次报道分数更低，未固定尚未批准的频率系数。所有检查再走纯归档输入重算和Report库重启鉴权读取；没有私有SQL/内部模块替身。

命令：`node data/root-v1-12-review/capture-boundaries.mjs O:/GenesisCode/Observer-worktrees/v1-12 O:/GenesisCode/Observer-worktrees/v1-12/src ts wip-boundaries-01`。**10/10、945.6851ms、exit0**，2026-09-06T03:01:47.240Z–03:01:48.607Z；原log SHA **b5f96edb028af3cdc82659ce5b81d5f4e770a30fad3e5b7672dea00446f01f60**已实际核对。前后HEAD48d4767、dirty及所有src hash一致；ranking SHA **2b9c5ec90358a0d45b109ccd287bd39187f8a40835fa03c99cfff9963d991569**，observer SHA **a5bed0db503bc404c737e0ce0a7dfb68ecc2721802d762c47667e86e7cc3d8fd**。这是新增WIP诊断，非最终freeze；后续固定候选和实际master均须保持原期待回放。

## 参数回放评审与数值排序契约（工程选择已协调，代码尚未冻结）

Root亲读作者`data/parameter-proposal/compare-v2.mjs`全部脚本（SHA **cbbad9eb3ff270263b701548c7ccd5b5e45cbc44ec90c5ac0a3d61f4eca04ab0**）并独立执行，结果与原`comparison-v2.json`（622519字节，SHA **54eef194f57605501a98068bf470f0e7ec16857f6425a6269ca40aecc22683e5**）解析深等；前后两文件hash不变。Root捕获`data/root-v1-12-review/parameter-v2-replay-result.json` SHA **87359f18b731b10f8aeae48c95a88a469a54260a11405528937464d5563e1595**，2026-09-06T03:04:15.449Z–03:04:15.561Z、exit0。

25组完整数值场景×7单参数变体是设计偏好模拟，不是175项产品测试、独立公式实现、真实满意度或最佳性证明。保留原expectations SHA不变；参数对比结果如下。

| 方案 | 相对预先声明偏好的差异数 | 具体含义 |
|---|---:|---|
| .60/.40，topic .15，frequency .25，cold10或2，实际间隔标准化 | 0 | 获准作为首版工程默认，不是唯一最优 |
| stars .75 | 1 | 两信号案例过度偏向单一stars峰值 |
| stars .50 | 2 | 原及扩容案例的中等双信号排序不满足设计取舍 |
| topic .30 | 0 | 本组输入无法区分；选更小干预.15 |
| frequency .50 | 0 | 同样满足方向约束；选更小干预.25 |
| cold5或1 | 1 | 预先定义的弱存量也获普通位置 |
| 不标准化实际间隔 | 1 | 同净变化的23h/25h平均速率未区分 |

Root核对同动量四次/一次报道分数比在k=.25为.625、k=.50为.5，均满足原≤70%偏好；更强参数并未被证据否定。cohort最少4、按语言+年龄→年龄→同分区回退是工程分辨率选择，未作统计校准；零动量背景增多会改变分位绝对值，小cohort不承诺每语言上榜。Root同意上述首版参数及实际区间标准化，但要求规则/输入保存、产品语义对齐与最终冻结验收。

Root在模拟输出发现数学同分0.45产生二进制尾差，随后以真实双快照→produce8→readReport独立复现：`ranking-tie-probe.mjs` SHA **2da400323b638eec44d39461953fdb24540e4e3081c814b2433086a961600c3e**，原`wip-tie-01` **0/1、85.1123ms、exit1**，log SHA **8b1cf5abe29161d801ade83ef919596815e877d6b669cde558a4d4b0779a9743**。数学同值的`a-star-spike`错误排在`z-balanced`后；该次模块前后hash一致，但仍dirty WIP，非正式Spec评级。

作者13片原12/13→13/13（1040.9366ms）后，Root亲读固定整数排序键`Math.round(rawScore*1e12)`、资格仍用原`score>0`，不使用可能非传递的成对epsilon。Root原同分脚本与断言不变，`wip-tie-02` **1/1、97.1454ms、exit0**（2026-09-06T03:06:53.979Z–03:06:54.476Z），log SHA **1806af8aa360604e43a96488ed2b84f5bd930a2c079c5e7790f7f2e2b63cb657**。原7项history另跑`wip-history-04` **7/7、602.1967ms、exit0**，log SHA **1969c1acb8b20a181c24b59fbe4ed0f663412ec93000c012f2343f98667e65be**，7天+1ms仍有正资格；两次前后全部模块hash一致，ranking为 **d0892c807b4ec5fe826757754bf39e261ecbf199f4c1ab2a6d3240f951a9725b**。

Root已协调允许精度规则：分区→整数sortKey倒序→opaque node原字符串序数；排序键0不意味着原正分不合格。后续模拟另成v3，保留v2，不覆写原输出。只有完整审计契约与产品回放对应后才冻结最终代码；异常历史/并发/最终全量与双轴审查仍待完成。

### 新排名序数澄清与损坏历史处理

上述“原字符串序数”在Root先前消息中曾混用“码点”与JS `<`，两者对补充平面字符并不等同。14片实际以BMP U+E000和U+10000身份反例13/14 RED→14/14 GREEN（1093.0744ms）后，Root明确接受新Heat tie-break为**Unicode码点升序**，不使用locale，也不改变旧#11 snapshot/旧刊及其他元数据数组的原排序。`14-unicode-green.log` SHA **79eb4e1179f951c7569c8973dff6b3f810c66d9032cdd81e6ad173929dcae038**，Root已实读测试、日志及`codePointAt`比较实现；v3/最终技术规格须使用此澄清，不沿用含混表述。

15片以既有测试模式对专属临时SQLite做外部归档损坏注入（恢复触发器），只从公开produce/read/restart断言业务结果，没有SQL旁路断言；这不是生产存储被实际损坏的证据。Root实读原14/15 RED（1155.7079ms，`history-integrity-failed`）和15/15 GREEN（1123.9895ms）；`15-corrupt-history-green.log` SHA **01fbe4729b3beaa94bb794c907251b85acd31bbda1c19bdadfe4a3dc4900cb0f**。Request8不复用损坏记录的任何facts、fingerprints、policies或event links；GitHub记录history-unavailable，普通Edition沿既有legacy-history-unclassified披露，旧刊本身仍拒绝读取，旧Request<=7维持原fail-closed行为。无法验证的时间不能按自报90天外淘汰；这是损坏完整性与已验证旧源权限自然过期的不同边界。最终双轴需再核验，当前仍未冻结。

16片新增固定规则/系数/说明性公式（不执行字符串）、全体候选分量与配额选择路径、未参与排名的隔离/缺样审计；403最新失败仍不复活旧好样本。Root实读测试和完整GREEN原日志16/16、1169.305ms，以及当前rules/重算/Markdown实现；未把该片视为固定候选验收。

17片两个真实SQLite连接从公开produce并发开始：较早因果刊成功INSERT后，后刊已固定的历史发生变化，最终事务拒绝后刊且鉴权读not-found；重新生成只见已成功一刊，重复Request8仍拒绝、重启读取一致。Root实读测试和`17-concurrent-characterization.log` **17/17、1270.9041ms**；这项第一次即GREEN，记录为characterization而不是补造RED→GREEN。作者继续v3参数精度对齐及技术规格，再准备最终clean提交/完整check；Root未启动最终双轴，也未推进#13。

### 独立导入、历史依赖及v3产品对应回放

Root实读18片原日志：`18-standalone-red.log` **17/18、1590.3943ms**，独立进程仅导入`rankGitHub`时因循环依赖触发`GitHubRankingSchema`初始化前访问；将纯Schema/规则拆到`github-ranking-contracts.ts`后，`18-standalone-green.log` **18/18、1546.0268ms**，SHA **fbbb599ab1d7d6db902825b47200a5a4e2d24b67dfe6f3f943852d39aa933f4d**。测试用实际出版保存的输入执行独立进程重算。Root另有不预加载Observer/publication的独立入口探针，首次执行时作者已修复，故`wip-standalone-01`只记录 **1/1、135.0534ms、exit0**（2026-09-06T03:20:48.222Z–03:20:48.632Z），不冒称Root复现RED；log SHA **4e5d47f707fc9f4615547bc2c33288bd508c1b0d4d8941a112c7298bf5eb3cd3**，全部src前后hash稳定，HEAD48d4767/dirty。

19片对专属临时SQLite注入归档历史policy列表缺失，保持自洽记录hash，只由重启后公开鉴权读取断言拒绝。Root实读 **18/19 RED、1681.7236ms**（缺少预期异常）→**19/19 GREEN、1672.2819ms**；GREEN SHA **ad3bb31eef52c8eca9c0cd5926812dc11ba345ff7e5ca55a68dcf9092a7b538f**。读取端将历史条目的businessDate/nodeIds/完整policies与实际旧刊逐项核对，不以自报空权限列表绕过依赖检查。这是Owned故障注入，不声称任意恶意数据库改写均可防御。`19-typecheck.log`首轮类型收窄错误与`19-typecheck-2.log`后续无诊断均保留。

作者v3脚本及完整固定输入位于`docs/implementation/v1-12-parameters/compare-v3.mjs` / `fixed-input.mjs`，本次SHA分别 **9838a84bc52cf9ae56383a16cfbedb5adef645229da19dd143ad4c9b4054bbd7** / **3c6f527386ea2c193aedc5a9696d4da7e79f40e0e6f4da246438afe0dace2b07**。原`comparison-v3.json`是循环依赖异常输出（不是成功JSON），`comparison-v3-2.json`保留不可实现负历史计数失败；成功完整输出另存`comparison-v3-3.json`，SHA **9c503adae5c93e5a96a9eeb7deccf6e4acfc15fb89a2d159e49d9781441b2135**。v2只是抽象数值模拟，其中两组不能直接映射真实计数；不得声称原175组合都是实际观测。

Root新增`data/root-v1-12-review/verify-parameter-v3.mjs`（SHA **b1676053fea3a102ed5c2bc76641ec0e3d24b61392618acf22f04b64b2bcb863**），执行`node data/root-v1-12-review/verify-parameter-v3.mjs O:/GenesisCode/Observer-worktrees/v1-12 wip-v3-01`：2026-09-06T03:27:41.029Z–03:27:41.671Z，exit0、stderr为空，stdout完整解析与作者成功产物deepEqual；25默认场景全部产品score/sortKey/base/recovery/frequency/count90/novel、排序和入选无差异，七组参数偏好差异仍为0/1/2/0/0/1/1。

Root还逐行核对v2→v3输入：仅`uneven-languages`的Python-1..11及`uneven-ages`的mature-1..11，共22行measured stars由100改为1200..200，使历史计数非负；signed delta、forks、cold、历史年龄及预定偏好均未改变。完整before/after、调整列表、stdout/stderr与hash保存在`wip-v3-01-parameter-v3-result.json`（SHA **814b7133b27150576f4c93d7e5a30bd2a5c9cb8e86503448a321986308e2adef**）。全src及两脚本前后hash一致，HEAD48d4767/dirty，仍是WIP而非最终freeze。

这些参数回放使用Owned合成收据和虚构历史作为公开纯函数输入，只证明设计模拟与实现对应；不是实际出版历史、外部GitHub数据、独立公式实现、真实满意度校准或生产资格。真实成功出版历史已由上述独立SQLite业务探针另行覆盖；最终SHA及实际master仍需原期待重跑。#12未关闭、#13未启动、未push、未发送邮件或启用生产。

## 首个固定候选与独立验收进程

最终20片区分因novelty quota挤出的重复项目与本来就在普通前7之外的低排名：19/20 RED（1706.8505ms）→20/20 GREEN（1734.6755ms），GREEN SHA **df8a6456b31c56e7636f85afe2f3aa65fc7c6e71da7e1dc20b846c2c704a11e9**。作者八文件局部回归143/143、4224.9348ms，原log SHA **9fbb5e85d6b299562664f7b49598099b0410df08cf83bfdce48cbf9ab739c785**。Root已亲读实际断言和原始摘要；局部不替代全量。

作者clean提交 **e4617399c4308a97466a3a1ed94e1b6eabbea34a**，`ticket/v1-12`，base48d4767；单一commit `feat: add reproducible GitHub Heat and publication novelty (#12)`，19文件、+1209/-80。Root实际核对解析base、非空`git diff 48d4767561459db66575125d18c8a89dce185068...e4617399c4308a97466a3a1ed94e1b6eabbea34a`、diffcheck、HEAD和clean后，派发两个fresh且不互通报告的reviewer。精确规格及参数输入见[实现说明](../../../implementation/v1-12.md)和[参数比较](../../../implementation/v1-12-parameters/README.md)。

作者最终参数回放`data/author-v1-12-e461739-parameters-01/comparison.json`，2026-09-06T03:31:33.219Z–03:31:33.518Z、exit0，1330629bytes，SHA **8d24f4eca94141a5094c332cb87d11c0a3b7208c30e15659c99bd7faad708541**；metadata含实际进程UTC、前后clean/SHA/模块hash。它与Root此前WIP stdout字节一致，仍重新绑定当前clean SHA，不用WIP替代冻结证明。

作者首次完整check `data/author-v1-12-e461739-check-01` 已终态：**301/302、125413.6612ms、exit1**，2026-09-06T03:31:13.542Z–03:33:24.325Z，native SHA **843ba1063d16877f48c1086d5c6bf874e5133d11a58b532141b99e84286c19f7**。唯一失败为Claude测试fixture执行短标签`docker image inspect observer-v1-05-claude:2.1.252`返回NoSuchImage；Root实读原始终态和异常。不据此认定根因或产品通过。作者报告随后只读核查原标签仍指固定镜像、运行容器为空，未改代码/标签/镜像；同SHA在check-02新目录整次重跑，首轮完整失败保留，不拼接PASS。

### Root冻结业务与历史回放

Root确认新路径不存在后创建detached `O:/GenesisCode/Observer-worktrees/accept-v1-12-r1`，clean HEAD为e461739；锁定依赖离线`npm ci --ignore-scripts --offline --no-audit --no-fund`与build通过，无锁文件变化。新调度脚本`data/root-v1-12-review/run-frozen-independent.mjs` SHA **d07f510cf13552df13b48430010f20e5ce39a07471230e7468442e4de9064251**只复用原oracle/期待，并校验其既有hash；所有TEMP均在指定data下，没有修改旧档或重freeze。

命令：`node O:/GenesisCode/Observer/data/root-v1-12-review/run-frozen-independent.mjs O:/GenesisCode/Observer-worktrees/accept-v1-12-r1 e4617399c4308a97466a3a1ed94e1b6eabbea34a frozen-e461739`。2026-09-06T03:34:26.134Z–03:34:45.379Z，**13/13命令组exit0**，不是13项测试。结果位于该detached树`data/frozen-e461739/independent-result.json`，SHA **ac77961c849c587a6fbd18059cdc8eef2538e69c5fb02687de809daaa1711cd9**，前后clean/SHA及全部built模块hash逐项一致。Root实际解析组日志与子结果：

- 新19专项：历史7/7（754.8241ms）、时间/频率10/10（1161.8898ms）、量化tie1/1（121.5239ms）、独立导入1/1（105.5541ms）。原日志及完整源/built身份在Root data的新`frozen-e461739-*`记录，原WIP期待不变。
- 旧GitHub13专项：redirect3/3、rename2/2、cutoff2/2、latest4/4、原Spec反例2/2，全部exit0。没有把当前版本覆盖旧13项脚本或期望。
- 29次既有业务/旧Record1–6调用全部exit0；`data/root-v1-10-review/frozen-e461739-inherited-independent-result.json`前后clean/e461739。29是调用数，不虚报成29项测试。
- 旧Record7两刊、Record8四刊reader输出均确认完整Report与MD不变；本次组log SHA分别 **42b152574cbb57d4ae006473d122058c015a123b852a64793d7c694ab62c4231** / **d32fd4453993be136fa9c725ddd8cca65210170a9b1606a43b0e7508fc33d275**。
- 参数脚本在detached源码独立执行，25默认产品对应/7候选偏好及完整JSON deepEqual通过；这是pure源入口检查，其余业务探针使用本次dist绝对路径。各组原流按stdout/stderr连接保存，不冒称到达顺序。

### Standards

固定轴reviewer `/root/review_v1_12_standards`：未发现文档规范硬违反；两条P3启发式维护建议（judgement call，非阻断）：

1. possible Repeated Switches：`src/observer.ts:155/186/193/455`重复枚举请求schema能力，后续版本可能漏接冻结、来源政策或投影；建议集中为可类型收窄的能力判断并保留旧行为。
2. possible Duplicated Code：`src/observer.ts:133/529`两处重复实际报道node投影及run policy去重，共同定义历史身份/来源依赖；建议共享纯投影，两处各自保留授权校验。

reviewer核对PRD T1的公开业务结果边界，SQL只做外部故障注入，无私有调用次数/结构断言；HANDOFF契约/替身与真实资格区分无hard违反。审查前后指定SHA/clean一致，只读、未跑测试，未读取Spec轴。Root不为这两条非阻断维护建议修改当前冻结候选。

### Spec

独立`/root/review_v1_12_spec`最终：**1项P2，未发现范围扩展**。

P2：排序缩为空栏时未记录Coverage Gap。PRD `docs/PRD.md:270` AC-01要求“不足明确缺口且不凑数”。`src/observer.ts:467`删除既有GitHub缺口，`:474`只恢复历史不可用缺口；`github-ranking.ts:113–117`继续沿用观察snapshot.reasons。健康50候选中只有7个已报道项目有正动量、eligibleNovel=0时，正确选出0项，但本栏`coverageGaps=[]`，总览只显示“暂无可用Watch Item”。完整候选表里的落选理由不能替代结构化栏级缺口与总览说明；须保持0入选，不为修缺口改变配额。

reviewer独立`data/root-v1-12-spec-review/independent-probe.mjs`（SHA **8f28657959dcf0caf59e1292ef84f8057b93f592a15baaa8249173eb4eb526a8**）实际4项业务检查通过：50候选两页协议→真实SQLite→produce/read→双库重启/纯重放、零novel零入选、落选不计历史；`gap-contract-check.mjs`从实际公开读取保存的第二刊检查AC-01时exit1。最终`run-auOim0`结果SHA **932ef4e20fa34557ed6c2232f65c6331bc97d7f66b535dfb7ce5bc0f10736165**，三份实际reports SHA **96e313f77db31a9771d9c4b95402eca55c91d6bd0545a3bafb3f3dcf62716f73**。完整报告`spec-review.md` SHA **611daac815edc1816e25c403d64b3358f734a425b7f48c5a691d0f17a32558f4**，Root已实读。

reviewer保留两次harness失败（错误reviewedBy枚举、最后场景漏提供历史观察）及一次含无关协议失败的中间成功；最终只服务完整健康50详情以隔离Gap问题，没有改产品/原期望、补造旧日志或删原SQLite。Spec前后指定SHA/clean一致，未读取Standards报告。

两轴汇总：Standards **0硬违反/2条非阻断P3**；Spec **1条P2**。两轴不合并或互相抵消；e461739不接受、不集成。

### 完整check终态与Root原期待复现

作者check-02：**302/302、120508.3524ms、exit0**，2026-09-06T03:33:51.510Z–03:35:57.325Z，log SHA **7daef40463a2ab1978549d4b54290f6bbba1484c856dcfd4b22cc93c8b6167c6**。smoke-01：**3/3、1307.2958ms、exit0**，03:36:04.341Z–03:36:08.461Z，SHA **db24ac4a0755a6af66de125bcd584eb2019a9f78b75c1a9d5b46811b083087c1**。Root实际解析metadata/原log，hash匹配，前后clean/e461739和全部src hash一致；第一次301/302整次失败未覆盖。

作者释放Docker后Root运行`run-frozen-capture.mjs check`，detached `accept-v1-12-r1` / e461739 / 空branch，证据目录`data/root-e461739-full-01`。**302/302、123545.6822ms、exit0**，2026-09-06T03:37:10.837Z–03:39:20.235Z，log SHA **259aad15a5fc2c3037bca69b3fc08362b7a06ddff57db06c12b2b532dc041d3a**；前后clean冻结身份一致，原到达顺序流完整保存。该完整检查通过仍未覆盖Spec缺口，不能用于关票；Root未继续为已拒收候选跑smoke或master集成。

Root另写不导入作者helper的公开seam原期待`data/root-v1-12-review/selection-gap-probe.mjs`（SHA **baac7952f60649301b64cecb7bd339ba39317a963caccd370d51a51d1490b47f**），用自身Owned协议fixture实际出版7项目，22天后全部恢复正分、novel0、selected0，要求结构化GitHub Gap/总览与栏首说明/重启可读。`capture-selection-gap.mjs`对冻结dist执行，**0/1、138.5214ms、exit1**，2026-09-06T03:40:38.508Z–03:40:38.995Z；`frozen-e461739-selection-gap.log` SHA **a250583005e034c8bddc890d2b4dba38ae4b0f0701b691044c4744e3b5307c7e**，结果SHA **5dbac4128fb1fd6d0b92367a713ceed94c9976f1bd3ae163b36c1e49c3bd0870**。前后clean/e461739/全部built hash一致，首个结构化缺口断言失败，原数值与选择断言已通过。

Root已交原作者窄修并批准语义：仅新Record9当actual<7追加一次`github-selection-insufficient`，不改观察snapshot.reasons、不冒充来源请求失败；总览与GitHub栏首显示同一真实actual/7、正分eligible、新颖eligible计数，明确候选筛选不足/新颖配额限制；保留实际source/history缺口。归档一致性检查校验此Gap与actual<target严格对应。零novel先RED→GREEN，再稀疏非零/真实来源缺口并存/满7不增加选择Gap逐片。评分、排序、配额、算法版本、旧刊路径和P3维护建议均不改。新SHA后重新完整验收；原冻结/失败全部保留，#13仍未启动。
