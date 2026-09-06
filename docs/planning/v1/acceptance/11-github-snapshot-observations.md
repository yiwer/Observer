# V1-11 执行与待验收记录

状态：**accepted；最终实施 14f6889、集成 867e500，作者/Root冻结/实际master完整check各282/282、smoke各3/3；Standards 0 hard / 2 非阻断 P3、Spec 0。GitHub #11 已实际读回 CLOSED / yiwer，代码未push，生产未启用**。

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

## 可靠性与权限切片（仍未冻结）

Root实际读回作者以下原日志及相关公开Interface代码，均为作者变化中工作树切片，不是Root独立全量或正式review：

- 24/25-metadata：新增两点元数据保留的真实15/16 RED→16/16 GREEN（837.7805ms），26-typecheck通过；旧自有fixture补充官方必填字段另计输入修正，不计缺陷。
- 27/28-slot：并发同小时唯一键冲突16/17→17/17（880.4216ms）；同一观察实例合并在途任务，持久小时结果在重启后复用。不宣称跨进程网络请求exactly-once。
- 29/30-policy-version：来源内容修改而版本不增仍发出请求17/18→18/18（1122.6141ms），持久配置/来源版本摘要防止同版改写及回退。31/32-config-gap：无效配置或来源读取导致整期异常18/21→21/21（1167.4082ms），现在只产生明确GitHub缺口。
- 33/34-authority：准备期间来源改归GitHub，原本仍将marker发给普通Runner；0/1→1/1（262.17ms），同一次最终发送前权限用于重新过滤，未放宽其他Edition的门。
- 35/36-resource：Owner更小maxItems、补采后最小poll间隔及整批120秒时限反例修复，最终25/25（1262.0568ms）。Root协调run记录实际生效限额及来源归因，MD须反映实际值；不把规则最大值冒充当次允许值。
- 37/38-opaque：自创node ID字符表错误拒绝`opaque/+node==`，25/26→26/26（1327.0766ms）；按opaque字节保留，只保留Observer自身长度/危险控制字符资源限制。

上述问题是当前票的资格、来源与时序契约，不扩展为#12排名或全局调度。跨重启退避、余下失败/撤权矩阵和最终规格仍待作者收敛，尚无clean候选SHA、票末full/smoke、双轴审查或Root冻结/实际master验收。Root不关闭#11或启动#12实施。

## 退避、来源隔离与额外因果回放

Root亲读39-restart-rate-red（26/27、1361.2416ms）：重建观察库实例及Adapter后仍提前发送请求。Root批准未冻结Adapter只读`resumeAtUtc()`及Run的UTC/null同名字段，保存已解析的最早恢复时间，按同源最后收据约束重启后的请求；不存原头、正文或令牌，不改变SQLite表结构或旧Record。40-green为27/27、1364.1447ms。41-protocol-failure-matrix为既有行为验证49/49、2403.5964ms，覆盖资格排除/未知、必填畸形、访问失败/304、秘密异常、凭证到期和预取消，不补造RED；42-typecheck通过。

作者自行发现已知地址fallback未按sourceId隔离，43-source-switch-red为49/50、2476.4876ms，新来源仍采集旧来源的已发现地址；44-green过滤同源历史后50/50、2436.2734ms。Root已亲读原日志；仍为未冻结切片。

Root按既定T1公开观察→实际SQLite重启→produce7/鉴权读取建立独立`data/root-v1-11-review/latest-failure-causality-probe.mjs`，SHA **afca4865dd5de1ae6d77542099314510e3f9eb6b2ab9b35c2ce5b67e5a7a5e7c**。四例固定期待：较新成功+6；截稿前401或未知template阻止回退到此前有效+5；晚于截稿1毫秒的401不能抹掉此前截止内+5；原错误体不入永久Report，报告库重启读回一致。首次**4/4、297.2999ms**，没有产品RED；log `wip-latest-failure-causality-first.log` SHA **3f209268042be98bd4b24eeb8ad6959dddf92c22fba0c2bc8c0c68ab9181a19a**，UTC 2026-09-06T01:47:42.255Z–01:47:42.953Z。相关15模块前后摘要一致，但HEAD仍base且工作树未提交，最终须在固定SHA复跑。

当前下一动作：作者更新真实技术规格和路由、形成clean候选，票末full/smoke后由fresh双轴review与Root独立冻结验收；以上50项及Root四项均不替代完整套件、旧Record1–7 oracle或实际master验收。

## 第一轮固定候选与拒收（2026-09-06）

作者候选 **3cbff88a7d1aca6dc2db995302d9c1c7912cb019**，`ticket/v1-11` clean；Root验证base可达、`git diff 0cc3ae6c7137f63283b03dd538b177cd440f5915...3cbff88a7d1aca6dc2db995302d9c1c7912cb019`非空，21文件 +1305/−30。Root另建clean detached `O:/GenesisCode/Observer-worktrees/accept-v1-11`，`npm ci`及build通过。作者和Root使用固定镜像、串行Docker、独立TEMP；本轮未做真实来源/Provider/PAT/SMTP/部署或push。

### 完整测试证据

- 作者首次 `data/author-full-3cbff88-1/` 完整check **274/275，1 FAIL**（129318.19ms），唯一错误为Claude原短标签`No such image`；log SHA **cd1272b403838ebd35f3d3f4bc2ffe162e5a686382867d92ee3dcc1f4f6c3d3a**。原日志完整保留，只读核对固定镜像后，在新目录同SHA重跑，不拼接PASS。
- 作者 `data/author-full-3cbff88-2/` 完整check **275/275**（123709.7956ms），UTC01:58:23.8688242–02:00:32.7559402，log SHA **ffa85d7864743592d116aef186b733ceaa48534bf8c2c1479b8292d5cc7d764e**；smoke **3/3子集**（1318.3765ms），log SHA **dff71f222671dd2dcd144e4fc784e23732acfabcc714fd757eb3fad1118152fc**。Root亲读result和原log尾/count/hash。
- Root detached `data/root-full-3cbff88-1/` 完整check **275/275**（122564.6799ms），UTC02:01:41.759–02:03:49.767，log SHA **cec73d2f99a036fdde534ac1f11ffc9566f8e9bce4248cf97cc352ca36de1a45**；smoke **3/3子集**（1328.8974ms），UTC02:06:51.880–02:06:56.337，log SHA **800324c0ac4ec1fdb11227b85c64e512d5a64217ec894ddb52a19ce0254f6a5d**。捕获工具保留raw stdout/stderr、时间和前后clean固定HEAD；两个result已读回。完整套件通过不能覆盖下方独立反例失败。

### Root 冻结回放

固定29次既有调用全部exit0（含Record1–6九份旧Report/MD），不是29项单元测试；结果 `data/root-v1-10-review/frozen-v1-11-3cbff88-independent-result.json`。Record7两份旧刊用原reader读取新built通过，整个Report/MD均未变，未重新生成baseline。以上开始/结束固定clean。

四份Root独立探针原SHA及期待不变，新构建实际SQLite/生产/鉴权读取与受控来源协议均通过：

| 探针 / 日志前缀 `data/root-v1-11-review/` | 结果 | log SHA256 |
| --- | --- | --- |
| `frozen-3cbff88-redirect` | 3/3，12.818ms | c8efc5f0bc1e71189c49ce1451a560a1116fac36d9ecff87a7a18b761897101d |
| `frozen-3cbff88-rename` | 2/2，166.6736ms | 4bd0a9f5ffebfcbb81fd799202b95803c63574d52ffb4fe18fac742236573d7f |
| `frozen-3cbff88-cutoff` | 2/2，143.8435ms | 8373d544b9b7242d05e86c144e281c07dc8405ff179f0609a08f66e37dc83784 |
| `frozen-3cbff88-latest-causality` | 4/4，290.0886ms | 007b99d513e97ed3f0d7bea19f22d53ebf04705299b3b74dbaad3b867573368e |

各result的15个相关built模块前后摘要一致、固定HEAD且status为空。这11项不包含以下新Spec反例；不得合并计为“所有反例通过”。

### Standards

fresh `/root/review_v1_11_standards`完整读21文件diff，开始/结束clean固定SHA；**0硬性违反，2项P3维护性判断**：`observer.ts:450`事件版本分支可能Repeated Switches（Record8读取重复检查，与出版枚举不对称）；`:131/:165`同步清除Evidence/Edition引用可能Duplicated Code。来自code-review固定异味基线而非仓库硬规范；未运行测试，不以此要求扩大重构。

### Spec

fresh `/root/review_v1_11_spec`与另一轴并行、未交换发现，完整读票/原生#6依赖/21文件diff；开始/结束clean固定SHA。作者原53项自有运行通过，另建实际HTTP→真实SourceReader→SQLite重启→produce7/鉴权readReport独立反例，**两项P2，2/2 FAIL，exit1**：

1. `github-observations.ts:131–133/:164`把详情node冲突的未验证名称用于历史回退及名称沿革，违反实现规格“同来源最近验证的已知地址”。一次错误Search地址后，重启空Search仍访问错误地址；有效旧地址可得+7却不生成Watch Item。
2. `github-adapter.ts:44`与SourceReader的非200丢正文组合，漏判正文明确secondary-limit、remaining=100且无Retry-After的403。原始独立结果立即发3次请求、仅access-unavailable、resumeAtUtc=null，应1次、明确限流、至少60秒退避。Root亦实际浏览核对[GitHub官方规则](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api#rate-limit-errors)，并未请求真实候选API。

原Spec脚本 `data/root-v1-11-spec-review/identity-recovery.test.mjs` SHA **b9711595161ef8638edf597476963d97781b1f1df25428c77ec97b53440e143d**、原结果 `independent-results.json`（497.4296ms）保留。Root亲读完整脚本/结果，另复制成可选绝对built路径的 `data/root-v1-11-review/spec-r1-counterexamples-probe.mjs`，SHA **7549a54ec96a1f9f82e6a11e8d85d3edb567ea994000c9cc39164fd6c03e1fdf**；只改变import/自有输出及相同profile路径，no-index diff确认全部行为期待不变。Profile SHA **3984c0345d0e1ca32ba0338c1d6792aff784ad1893eaafac7706cccf89bc4737**。

Root固定built复跑 **0/2 PASS，2 FAIL**（176.0753ms），UTC02:08:17.581–02:08:18.099；`frozen-3cbff88-spec-r1.log` SHA **c2d593951714828864213a5e679b382a5dfb5e3605d5da7fb09f76967947b4ec**。前后HEAD/clean/15模块摘要一致，两个同样错误均独立复现。

**首轮汇总：Standards 2项、最重P3（非阻断）；Spec 2项、最重P2（阻断）。本候选拒收，不能合并/关闭#11或启动#12实施；已有275/275不替代反例修复。** 作者继续逐项TDD后提交新SHA，必须重新冻结并完整验收。

[首轮拒收回写](https://github.com/yiwer/Observer/issues/11#issuecomment-5556273579)已单次发布，并由Root通过独立API读回完整正文、ID与URL；Issue保持OPEN。GitHub回写不等于代码push。

## 第二轮修复协调（尚未验收）

Root批准以同node详情已验证且reason为null/ineligible/risk-unknown的记录作已验证身份；transport/parse/identity-changed保留失败事实，但不覆盖已验证地址/名称历史。当前失败仍阻断复用旧good数值，不修改四个Root因果期待。

Root依codebase-design的小Interface原则批准可信装配专用可选`SourceReadRequest.readErrorBody(status, headers)`：reader仅4xx/5xx且回调true才按原尺寸/UTF8/encoding/abort限额读错误体，缺省保持旧行为。GitHub仅对无法由头分类的403启用；已经由remaining=0/Retry-After判定的403/429无需读体，避免坏正文破坏已知限流退避。Adapter仅解析受限合法JSON message分类，不保存/发布原错误体，普通403不冒充限流。此为本票必要共享Interface窄改，不新增SourcePolicy/持久Schema、排名或全局调度。

## 第二轮固定候选与复审

作者修复提交 **14f6889a207db393a96bb0fff7f4ba7867e6714d**，相对首轮仅7文件111+/6−，base不变；Root验证clean/分支与非空三点diff。Root亲读完整修复及规格澄清，另建clean detached `O:/GenesisCode/Observer-worktrees/accept-v1-11-r2`，npm ci/build通过。原首轮SHA、日志及oracle均保留，未将作者WIP冒充固定构建。

Root亲读作者局部日志：48身份恢复50/51 RED→49 **51/51**（2556.5045ms）；50真实SourceReader secondary403的1/2 RED（3次≠1）→51 **2/2**（356.4385ms），跨小时slot并重建Adapter/store验证resume前不请求。52未知资格但已确认身份控制**52/52**（2601.5868ms）；53普通403、有头超长/gzip/停滞体及旧SourceReader回归**9/9**（1557.7582ms）；54 typecheck通过。后两项是覆盖，不补造RED。

### Standards

原独立Standards reviewer与Spec复审并行，完整读7文件修复及新规格，并复用上一轮全部21文件阅读。**0硬性违反、2项P3判断项，最重P3**；原observer版本枚举及Evidence同步移除重复未改，无新增发现。不强制与阻断修复无关的重构。

### Spec

原Spec reviewer完整读修复、新规格及原验收要求；**未关闭问题0，最重无，原两项P2关闭，无新增范围扩张**。原脚本/期待不变**2/2**（475.0772ms），结果 `data/root-v1-11-spec-review/round2-independent-results.json`；另运行既有GitHub与SourceReader五文件**63/63**（3607.5874ms），`round2-existing-results.json`，Root均已亲读。两轴开始/结束均clean且固定14f6889。

隔离说明：R2 Spec重新读取GitHub评论时，公开首轮验收评论附带了Standards两项摘要；reviewer主动报告这一暴露，未读另一轴报告文件或据此改变Spec判断。Root如实记录，不宣称本轮完全没有另一轴信息暴露；原独立Spec反例与Root固定built重放仍是两项关闭的直接证据。

### Root 第二轮独立回放

29份原固定调用全部exit0，结果 `data/root-v1-10-review/frozen-v1-11-14f6889-independent-result.json`，前后clean固定。Record7原reader读取新built的两份Report/MD全部原字节，baseline未重建。以下探针原SHA/期待未改，前后clean固定14f6889、15相关built模块摘要一致，Root已核对log实际hash与count：

| `data/root-v1-11-review/` 日志前缀 | 结果 | log SHA256 |
| --- | --- | --- |
| `frozen-14f6889-redirect` | 3/3，16.5224ms | 4aeaa5881cf8c8da679205d9236fd5df16faa6ed5e5d0b1bbebee78e20f3df75 |
| `frozen-14f6889-rename` | 2/2，207.7336ms | 888220f24c88e2384081f973fb371d73af6d950c73bf26a414f4cd26e2f4af0d |
| `frozen-14f6889-cutoff` | 2/2，176.6751ms | 46e139b7805fbf091f6ffa5f4910fc39ef6ed8bbd81e4376bee1a0c4cdc7a7ea |
| `frozen-14f6889-latest-causality` | 4/4，331.495ms | 680f57a3c7eb54d415db42741129e908ce0412e8ef4b1103027e2504493ca0e7 |
| `frozen-14f6889-spec-r1` | 2/2，207.5197ms | 5fe458259cb1b284d400122244ffece80d784ee3c79586d90cba906e2006d9f1 |

本轮13项合计仅指上述独立探针，不将29次调用、旧刊数或smoke混为完整测试数。实际MD已读GitHub成功与失败部分：+6及两点实际间隔/存量/来源/有限候选披露一致；截止前失败仅隔离/缺样，无旧增长或原错误体。

作者本轮首个全量 `data/author-full-14f6889-1/` **281/282，1FAIL**（127292.7146ms），UTC02:14:12.1944355–02:16:24.7793289，唯一原Claude短标签`No such image`；log SHA **8b5b1df6ccb4abc94c8ddf96ff082e1674bf0d0f8710077165665abdff79114f**。Root亲读result/原log并校验hash；只读原镜像核对SHA未变，结果SHA **71e562aada1a53a6644482b996d4d1ff761b2c53e6662e4e5ed771090e7dcd9a**。作者正在同SHA新目录整次重跑，不能将局部通过拼成282/282。

### 第二轮完整冻结通过

- 作者 `data/author-full-14f6889-2/` 同SHA新目录完整check **282/282**（123007.8792ms），UTC02:17:22.1306272–02:19:30.5905616，log SHA **ef913beaec8229b88a21caa49194897dc638e80f100f9bb5fbd359b5129b1897**；smoke **3/3子集**（1361.8369ms），UTC02:19:53.0994875–02:19:57.3991961，log SHA **3c71d0bc9235dc65b42e2fde8fa6c35bb99ca3d770ed24dce159c055265b3109**。Root核对原log hash及元数据。smoke-result.json是作者随后从原终态工具输出登记的索引，不冒充执行时原生捕获文件；原smoke.log未改。
- Root detached `data/root-full-14f6889-1/` 完整check **282/282**（122190.828ms），UTC02:20:20.649–02:22:28.220，log SHA **1bb1e9f18524cc764e27aeffcd490936c70472c114ecf979b8e3cdcb6c9ef13d**；smoke **3/3子集**（1320.0443ms），UTC02:22:48.133–02:22:52.481，log SHA **ed8f66adca0426e3d6b063fcb4f06d17552e50d3af9575268580316bd61c3a03**。前后clean固定14f6889、完整退出0，原生capture result已读回；没有剪裁或拼接失败。

Root额外固定Record8四份已独立断言的永久Report/MD：成功+6、截止前访问失败、截止后失败仍+5、未知风险隔离。目录 `O:/GenesisCode/Observer-worktrees/accept-v1-11-r2/data/root-v1-12-compat-14f6889`，baseline SHA **ec54671f5c22b72661cf19037e8f4c95211a66ed68d7c78937e292f240d73638**，reader SHA **4a6c7ea75cd19d5d30aa7c4b2ed7e95aeac17676c612873c8af3e9a0069308d2**。原报告库没有重建，reader读新built四份全Report/MD原字节，错误Owner token被拒绝。首次freeze脚本将两个随机输出目录对应关系写反，被固定+5期待拒绝；按原日志修正路径映射后才首次写出baseline，未改变期待、不计产品RED。此后禁止再次freeze或改基准；生产者仍须完成实际master验收。

### 验收项映射（开发资格）

| #11 验收项 | 固定验证证据 |
| --- | --- |
| 有限官方候选、稳定身份、排除/未知隔离 | Search/详情协议、opaque/转移/改名回退、资格矩阵及Spec原身份反例 |
| 小时相位与截止前可用选样 | 同slot/重启/迟到poll、当前/历史容忍、Root恰好截稿及晚1ms |
| 正零负净差、冷启动/缺样分离及真实时刻 | 生产/重启报告矩阵及Root四项因果回放，MD人工阅读 |
| 不完整、限流、权限/网络降级可见 | 分页/总候选限制、来源版本/撤权、401/403/429/304、正文限流及持久resume |
| 秘密只读到期声明、受控I/O | 虚构PAT过期/脱敏、逐跳路由/DNS/权限验证，不克隆或下载执行 |
| 观察到归档及后续复用 | 实际SQLite→produce7/鉴权/重启，全量282、13专项、旧刊1–7与新Record8四份 |

**固定候选满足本票自动化开发验收，允许本地集成；实际master重验尚未完成，因此尚不关闭#11。** 真实PAT权限/有效期、来源许可、GitHub实际容量、模型/地区/正式生产/人工质量仍未验证；无生产资格替代或#12实施。

## 实际 master 验收与关闭

Root先提交冻结证据 **fdf352f**，再no-ff合入已评审候选，实际集成 **867e500431886e1d876066c950f3a880b38f81f8**。产品src/tests/package/lock/tsconfig相对14f6889无额外diff；跟踪文件干净，唯一无关`?? .idea/`前后原样保留。Root没有清理旧证据或重用作者TEMP。

- 完整 `npm run check`：**282/282**（122557.1989ms），UTC2026-09-06T02:24:47.451Z–02:26:55.459Z，log SHA **40eb3dd25a38e664d1cf89680974cce87d08b182181d826514061ef5ed9c62ff**。
- `npm run smoke`：**3/3子集**（1340.5199ms），UTC02:27:57.727Z–02:28:01.995Z，log SHA **9f5054c800622de04e35db989a0bc68ffd275c7579470691deb0ed1702bd5fa8**。
- 原生capturer结果/原stdout/stderr与合并log在 `data/root-v1-11-master-867e500-1/`，Root已亲读终态和验证hash；两命令前后master/867e500/status完全相同，退出0。
- 既有固定29次调用全部退出0，结果 `data/root-v1-10-review/master-v1-11-867e500-independent-result.json`；Record1–6九份旧Report/MD、Record7额外两份原reader、Record8新四份原reader全部原字节。所有baseline/reader未更改；后票必须保留这些兼容oracle。

实际master独立13项原期待全部通过，前后15个built模块摘要一致，结果位于 `data/root-v1-11-review/`：

| 日志前缀 | 结果 | log SHA256 |
| --- | --- | --- |
| `master-867e500-redirect` | 3/3，13.0899ms | 39b5b8595405e5414d475367b6f2ddb696e950e0a4314a1c01c78918251c1ca8 |
| `master-867e500-rename` | 2/2，211.9008ms | d0a6dc4519791d56013e08b41d5f25bdb19aac7864aa97f318461822ff016a37 |
| `master-867e500-cutoff` | 2/2，187.1025ms | b457138204e230550d7fa0b6f46a079b9231f86c8aaf2830b2c00aba74cb1287 |
| `master-867e500-latest-causality` | 4/4，334.3526ms | 300e3ec5ee8c7c560b29a88ced7e821f453cb84336e4603f90b477c864409465 |
| `master-867e500-spec-r1` | 2/2，193.588ms | df5aef2c8212bc458b2f0e51a28be66c159710806c97f4f103bfeb7eca35c663 |

Root单次发布[最终验收回写](https://github.com/yiwer/Observer/issues/11#issuecomment-5556354464)，独立API实际读回完整正文、ID、URL后关闭；`gh issue view`读回 **CLOSED，2026-09-06T02:28:54Z，yiwer**。随后实际读取#12正文/空评论及原生依赖：仅#8/#11且均CLOSED，两票集成8079271/867e500都在当前master可达。

**#11开发验收完成。** 原拒收及失败证据保留；资格仅本地自有来源协议/SQLite/无凭证模型替身，未批准真实来源/PAT/生产或push。下一步为全新实施上下文的#12，在实现前协调完整候选输入、稳定身份报道历史、精确评分/配额与新正文版本；不复用本票作者为下一票fresh作者。
