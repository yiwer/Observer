# V1-11 执行与待验收记录

状态：**in-progress；首片、身份/截稿独立回放及普通跨日历史已有局部通过；官方契约已移交，作者继续限流/并发/权限可靠性切片；尚无冻结或完整验收结论**。GitHub #11 OPEN / yiwer。

## 固定任务与依赖

- [本地票](../tickets/11-github-snapshot-observations.md) / [GitHub #11](https://github.com/yiwer/Observer/issues/11)正文、空评论已实际读取；原生唯一依赖#6 CLOSED，其已验收集成 **d24c0526b7fff852aeb8b0cb8ab0e61c76632ae4** 在基线可达。
- 顺序前票#10已独立冻结/实际master验收并关闭，见[#10记录](10-social-discourse-edition.md#实际-master-验收与关闭)。本票固定base **0cc3ae6c7137f63283b03dd538b177cd440f5915**，Root创建并核对clean `O:/GenesisCode/Observer-worktrees/v1-11` / `ticket/v1-11`。
- fresh `/root/implement_v1_11` 已实际启动，未复用旧作者/评审上下文。[启动回写](https://github.com/yiwer/Observer/issues/11#issuecomment-5555917110)单次发布并以独立API读回完整正文、ID、URL；Issue已实际读回OPEN/yiwer。

## 范围与首片协调

官方受控Search/Repository元数据有限候选→稳定node身份与小时累计快照→截至07:30已可用的两个真实快照差→Canonical中的GitHub Watch Item、Cold-start Heat或明确缺样→真实SQLite重启与鉴权读回。正/零/负变化均保留，当前±15分钟、历史±60分钟容忍不能偷用未来数据；其他缺样不冒充冷启动。排除非公开/不可访问/archived/disabled/fork/mirror/template，未知风险隔离而非声称已证明恶意。所有源仍需独立用途许可。

正式综合排名、历史报道衰减和一次性事件绕过属于#12/#13，不在本票提前实现。小时观测需有真正协议Adapter及可调度公开Interface，不以每日人工dump替代；全局日报调度属于后票。秘密只允许通过服务端配置传入，PAT只读/有期限，不能进入日志、Prompt或永久报告；不下载或执行候选源码/二进制。

作者须先亲读implement、TDD/tests/mocking、codebase-design、领域词汇、PRD D8/T1、票及相关ADR；先给Root局部Interface/Schema/存储/时序/首片方案，确认后逐片RED→最小GREEN。沿Owner已批准T1公共生产/读取seam和少量真实来源协议契约测试，不旁读数据库断言私有结构，不重问已有测试边界。`xx:25`小时相位当前仅为待论证工程建议，非已实施事实。

## 官方API只读增量预检

Root依research技能派 `/root/research_v1_11_github` 独立核对GitHub官方文档/API描述，临时报告定点 `O:/GenesisCode/Observer/data/root-v1-11-preflight/github-api-contract-2026-09-06.md`；待完成后Root亲读并移交作者。重点是固定API版本、搜索完整性、node ID/名称复用、304的实际复核与原正文取得时间、最小PAT权限，以及历史研究是否有能力陈述过时。没有请求真实候选API、读取PAT或批准来源。

## 冻结与安全约束

基线完整222项、smoke3为子集。request1–6/Record1–7/Version1–6与SQLite user_version1保持原字节；最新正文`observer-canonical-v5`。公共Schema/迁移先由Root协调，不因版本判断P3而历史重构。#7事件、#8Profile开始冻结/实际dispatch、#9逐Claim领域门、#10社交全组最终投影与来源/TTL约束仍须保留。

Root持有Record1–6九份不可变Report/MD oracle；已有29份固定调用通过`data/root-v1-10-review/run-independent.mjs`执行，探针与fixture摘要不可改。新增Record7两份基线目录 `O:/GenesisCode/Observer-worktrees/accept-v1-10-r6/data/root-v1-11-compat-853be14`，baseline SHA256 `00b47b35ab43e47edc58e92aa4932163741c4930a4228e981f0e68297ece87af`，reader SHA256 `ba06065f080cdcc945c5381c31943f75c813e5773a4cc54018a4525302a0bfa6`；必须以新built绝对路径读取，禁止freeze重跑或删除原数据库。旧R4 NOT-FROZEN材料不是基准。

不读auth/秘密/QQ_SMTP_KEY/Owner `.idea/`，不发真实Provider/SMTP，不购买/部署/push/合并/关闭票。QQ预检收件与中文已确认，不重复发送。Claude live延期；Codex费用已授权但实际地区/账户资格仍未知，本票不做live测试。

Docker保持既有desktop-linux29.6.1及固定Codex0.153.4/Claude2.1.252/协议Python三个镜像，精确摘要见[#10记录](10-social-discourse-edition.md)。禁止升级、重建、retag、重启或prune；短标签偶发查询失败保留整次失败，只读核查后同SHA新目录完整重跑，不拼接PASS。完整Docker套件作者/Root串行，各自TEMP/TMP定点新data目录。

保留[执行入口中的历史拒绝清理边界](../EXECUTION.md#保留的测试证据与禁止重试清理边界)及旧exited容器fb6640585ce1/c9e72c9c5c5f，不换工具绕过。作者完成后提交clean SHA，再完整check/smoke、fresh Standards/Spec、Root冻结及实际master验收；未满足前不关闭#11，不启动#12实施。

## 局部Interface与首片确认

作者已报告亲读指定技能及项目材料、实际gh正文/依赖，未发现AGENTS/CLAUDE；锁定`npm ci`完成。Root确认以下是实施方向，不是测试完成证据：

- Request7→Record8/Version7/`observer-canonical-v6`，新增typed GitHub receipt；旧请求和正文保持字节。单独GitHub observation SQLite使用独立application_id/v1，错误数据库/未知新版本拒绝，不修改Report SQLite1。
- `createGitHubObserver`隐藏有限采集、持久观测与身份历史，公开`observeDue`、截止快照读取和close；Observer生产端使用Owner可信reader/store引用，不接受候选/模型自报计数授予资格。Report保存实际选中两点的全部计算证据，旧刊重启不重新依赖当前选样。
- 数字是来源许可下的typed元数据及确定性相减，不虚构LLM核验；没有模型发送的路径不假称使用模型权限。来源可选`github`用途grant覆盖受审query、API处理、快照/身份历史、衍生发布与不可撤回导出、raw-only删除义务；缺失不自动授权，旧policy摘要不变。依阶段检查现有权限，不把凭证声明或GET成功当作实际权限/期限证明。
- 小时相位采用业务Asia/Shanghai的xx:25，持久UTC。完整接收及验证后实际可用时间约束截稿，不能回填计划时刻；07:30相等可入选，当前前15分钟/历史目标±60分钟，closest后同距更早的确定性选择，展示实际间隔。首次历史不足与已知旧仓库缺样分离。
- 首片从自有官方格式Search/详情响应取得同node改名的两个实际观测，重启观察库后produce/readReport再重启，预期+5 stars/−2 forks及原名、两点时间和有限采样披露。该一个端到端tracer批准按RED→GREEN开始；真实协议字段须经当前schema复核，不能凭fixture自证。
- 同步现有Profile开始冻结；每次外部I/O、观测提交、出版与读回检查对应当前许可。较晚失败/不合格记录不能被旧成功缓存覆盖。原API正文、秘密、README和非许可字段不进入永久receipt。
- 共享网络reader仅批准新增安全限额响应头remaining/limit/resource白名单，不输出auth信息。稳定身份查找到底采用已文档化REST路径、受控同源重定向还是有限Search重发现，仍待官方证据收敛；不默用未文档化路径或扩大GraphQL传输。

Root另要求作者明确typed WatchItems与已有GitHub一般故事共存时的席位/重复规则，避免追加数据绕过原领域门或无意翻倍约7条目标；正式综合分数与历史降权仍不在本票。官方schema/PAT/缓存建议须由研究成文后Root亲读移交，不将全部研究建议自动当作实现常量。

## 研究移交与第一条结构 RED

官方增量研究已完成，Root亲读全文、补充固定schema核验及最终修改后，原样复制到作者工作树[研究文件](../../../research/github-api-contract-2026-09-06.md)；SHA256 **dd2400936f28d6ab8c353d09cafa7dbb2630507dc7db111f3a9afca4e08922cf**，241行。原ignored研究材料保留；该相对链接在作者纳入提交并集成前尚不在Root树中，实际文件位于 `O:/GenesisCode/Observer-worktrees/v1-11/docs/research/github-api-contract-2026-09-06.md`。

研究者固定官方`github/rest-api-description` revision **3cef12e8a02d612ad032473d4fb87266f2befeae** 的2026-03-10 JSON，目标10字段与Search envelope逐项核验。Root据此采用固定2026-03-10请求版本；`visibility/is_template`的合法省略与资格未知分开，不能补false/public。固定规范没有`/repositories/{repository_id}`；不使用该猜测路由、不新增GraphQL。采用最多两跳同API HTTPS、允许路径逐跳检查、返回node身份一致才更新地址的REST处理；路径复用且有限Search未找到旧node时明确Gap，不承诺全球重发现。Root批准现有reader增加仅由可信装配提供的可选URL guard，须在每跳DNS/发出请求前执行，旧调用不变。

304要绑定实际条件复核与原表示时间，不延长政策TTL；新官方star history能力不改变本票两个快照净差定义，不纳入新接口。来源许可、PAT实际权限与期限、真实小时容量均未由文档调查获准或通过。

作者报告第一条`node --test tests/github-observations.test.ts`为1项失败，原因是尚不存在公开`github-observations.ts`模块；这是结构RED，不称已独立证明数字计算失败。Root已亲读首片测试与技术方案，尚未读到原始终端日志或GREEN，要求后续提供真实保留日志，不补造历史捕获。

作者的Request7数字观察模式须明确对普通GitHub候选的局部拒绝/Gap与安全投影，不能拖垮其他五栏或放宽旧版本领域门。原始响应TTL与许可允许的持久快照/身份/已刊双点计算证据须区分；Root实际核对[#22](../tickets/22-retention-and-rights-removal.md)明确拥有90天后小时→每日压缩和已刊输入保留，本票不提前实现该清理闭环，也不宣称已有压缩功能。

## 首片 GREEN 与独立协议/身份反例（变化中工作树）

Root亲读作者`data/v1-11-slices/02-typecheck.log`、03/04/05-tracer日志：02为类型错误，03为无WatchItem（0/1，292.8491ms），04为`canonical-github-record-invalid`（0/1，289.1559ms），05最终**1/1通过、300.6743ms**（单项77.442ms）。首次missing-module RED仅保留在作者工具终端，未重建为历史日志；fixture Owner review时间也调整到早于最早观测，不把该输入修正冒充产品缺陷。作者修正空成功返回值被误当失败及schema规范化后的摘要一致性；Root亲读`data/author-tmp/observer-github-83shiX/report.md`确认同node改名、两点真实时间、+5 stars/−2 forks与有限候选说明。以上均非冻结或完整套件验收。

Root沿已批准少量来源协议seam，以实际`createGitHubAdapter`+`createSourceReader`及自有合成HTTPS I/O建立`data/root-v1-11-review/redirect-authority-probe.mjs`，无真实网络，SHA256 **90b1507188b85053c683e475bf5c7b3fabaeb391bdc7717379179cb7c1311e25**。允许重定向控制PASS；Owner maxRedirects=0及首跳后撤权两例均仍发第二次带虚构凭证的HTTP请求，3项1PASS/2FAIL、12.5108ms；原log `wip-redirect-authority-first.log` SHA256 **ecd8cc2c4c69708b52c0bfa9720bc6039cb4a4556ae0c3da08c6496dadec7ab6**。

作者对应协议切片`06-redirect-red.log`为0/1、197.6208ms，07-green为1/1、203.6364ms；Root已亲读日志和窄改：最多min(Owner上限,2)，每跳DNS前和DNS结束后再次核验当前权限/到期/允许路由。Root**原探针原期待**复跑3/3、10.1368ms；`wip-redirect-authority-fixed.log` SHA256 **2680769550d41b97533cb8441527c52e9ac6080a8eee812e26159d88afa2102a**。这是局部关闭，最终冻结仍须重验。

Root另建公开观察→SQLite重启→produce7/鉴权Report的`rename-history-probe.mjs`，SHA256 **52cf4917cf079c5e44f5b62e32c8595ff2f64ebab834f034c9d54bb16d4a1868**。已知旧地址→次日同node已确认新地址→第三日Search未命中但新地址仍有效，旧地址被其他node复用：当前fallback取最早历史地址，导致本可继续观测的项目消失。当天Search再次命中控制PASS、应使用已存新地址例FAIL；2项1PASS/1FAIL、140.0053ms，`wip-known-rename-first.log` SHA256 **c3089d388e908e22802e9b4d960ed8ec59b496adf6f32a2229981e5dcd2292e8**。已交作者下一身份切片修复，不要求全球重发现或GraphQL扩张。

Root固定capturer记录实际模块目录、脚本摘要、前后HEAD/status与原始日志；上述均明确为变化中工作树，不以未变HEAD冒充代码已冻结。测试只写自身ignored证据目录，不旁读产品SQL、不改作者代码或旧oracle。

后续已交作者的重点：选资格后再分配7个位置；日报只携带有界相关双快照/查询证据，不反复复制所有历史小时run或让无关古老policy毒化本期；Record8连续两日普通事件/历史来源门保持；项目正文补human-facing原始仓库链接。采用无条件GET且非预期304明确Gap，不为研究建议额外实现缓存，也不宣称支持304。

作者身份切片`11-identity-red.log`为3项2PASS/1FAIL、386.3947ms；12-green为3/3、397.3028ms，均已由Root亲读。fallback改为优先最新已知地址。Root原`rename-history-probe.mjs`及期待不变复跑**2/2、135.5764ms**，log `wip-known-rename-fixed.log` SHA256 **a0613d771e700b55da10ebc9bdd192b3d7d13e90e4c3118896d20ec7758bbe2e**；此反例局部关闭，仍待最终冻结重验。

Root补充公共观察/生产/重启的`cutoff-availability-probe.mjs`，SHA256 **50779ff78596726769c6403f9a770a8ba6c51f58db40e203e4a5262a0e66b096**：完整详情响应恰好cutoff可用→+5/+1 measured；晚1毫秒→没有measured、未来名称不在整个永久Report、GitHub正文明确current-missing，重启相同。**2/2、123.7327ms**，`wip-cutoff-availability-valid-token.log` SHA256 **7ba55f2d6fe0d3f4c43a8ff2940b4c4ea3c4256e636957bfe60a46403b59ed86**。首次Root自有fixture Owner token不足32字节，被正确拒绝；仅改该输入、保留`wip-cutoff-availability-first.log`，不计产品RED。

新增未冻结Snapshot的有界identity summary已获Root协调：保存真实firstSeen/必要名称连续性及来源/配置/截止证据，完整小时历史留在观察库；新summary不能把未来首次发现或名称提前投影到旧cutoff，读旧刊不依赖可变重新选样。Root捕获工具后续增加相关模块前后摘要，仍不能把WIP结果冒充正式冻结。

## 有界证据、跨日历史与元数据补充

Root已亲读作者13/14-provenance：无关古老policy毒化本期双点的反例从3/4变为4/4（GREEN 426.3627ms），报告保留相关双点、最新覆盖/失败及有界身份摘要。15-news-history初始fixture每天改变同一事件的发生证据，触发现有正确的身份冲突，不计产品RED；修正fixture后16-news-history-valid-fixture-red才证明第三期错误跳过Record8第二期，0/1、314.8287ms。17-green修复后1/1、371.0436ms，18-typecheck通过，Root均已实际读原日志。

19/20-pagination从4/5变为5/5（483.1002ms）：详情双点有效也必须披露Search缺失的分页延续。21-time-classification为既有实现正/零/负、冷启动与成熟缺样及各时点边界14/14（771.8595ms），不补造RED。22/23-rate为429后仍发出后续请求的真实RED→GREEN，最终15/15、821.3331ms；该批日志只证明进程内限流，跨重启冷却、总截止、同小时并发与当前版本权利仍待作者完成，非已验收。

Root依research技能委托三字段独立增量调查，亲读36行完整补充后原样复制至作者`docs/research/github-ranking-metadata-addendum-2026-09-06.md`，SHA256 **e51da602ec92d965276b3f429a09976474f5a9c6e6615bfecda01a2aab51916c**；原241行报告不变。同固定schema中Search/Get的language必填可null、created_at必填非null date-time、topics可省略非null字符串数组。批准实际详情响应保存language/createdAtUtc/topics；未知与明确空值区分，旧快照不事后回填。仅为#12既定消费者保存输入，不做评分/cohort。

原Root三探针及原日志保持原样；其旧最小协议fixture未包含新核验的必填元数据，因此另建`data/root-v1-11-review/*-metadata-v2-probe.mjs`，只增加自有响应的language:null、created_at及topics:[]。Root逐份no-index diff核对，原7项行为断言未改，不把输入升级计为产品修复：

- redirect-authority-metadata-v2 SHA **d791b41d44d349d4da560d7c7007c016f150e11530612cb5f10b7b6d92a87afa**；3/3、9.5521ms，`wip-bounded-redirect-metadata-v2.log` SHA **a6c75f5dc8dd893760907f1eca174e2e960b0e23f688b460b8b58d8ecfdd1999**。
- rename-history-metadata-v2 SHA **0523254d10ca5788bba4fc1666002720b892a490e9f62610a04ac62d35f0d0b2**；2/2、129.7539ms，`wip-bounded-rename-metadata-v2.log` SHA **f2ca26a527545892826fbfccde4ecad2bb9c0a8254c49ec2261a620d74d8126c**。
- cutoff-availability-metadata-v2 SHA **6de2e34c0f25a1e9e0b4410a69c6d4fd4b2b0fc9b128a89dcadf78734c9b1379**；2/2、125.0819ms，`wip-bounded-cutoff-metadata-v2.log` SHA **d0f926faec68e0ca46994115c9d8cb9e60385ec9b1e14249042837bac73c3a8d**。

本轮复跑时相关15个模块前后摘要相同，HEAD仍为base且工作树有未提交更改；仅是有界证据改动后的局部回归，尚非元数据功能通过或冻结验收。后续冻结使用这三份明确版本化的有效输入探针，同时保留历史反例和旧Report1–7字节oracle不变。
