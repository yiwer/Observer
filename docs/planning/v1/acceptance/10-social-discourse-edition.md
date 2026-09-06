# V1-10 执行与待验收记录

状态：**R6 853be14 已通过作者与 Root 独立冻结完整验收、双轴评审和29份固定检查；接受进入本地集成，尚待实际 master 验收**。GitHub #10 OPEN / assignee yiwer。以下 R1–R5 拒绝记录是历史，不代表当前候选。

- [本地票](../tickets/10-social-discourse-edition.md) / [GitHub #10](https://github.com/yiwer/Observer/issues/10)全文、空评论及原生依赖已实际读取；唯一#7 CLOSED，#7已验收集成8e02377在新基线可达。顺序前票#9已实际关闭并完成冻结/master验收，见[#9记录](09-domain-evidence-rules.md)。
- 固定base **f36aae2122d081e638bfd520f93ded88fc95ef3b**，专属 `O:/GenesisCode/Observer-worktrees/v1-10` / `ticket/v1-10` 已由Root创建并核对clean。fresh `/root/implement_v1_10` 已实际启动，不复用旧作者/评审上下文。
- [GitHub启动回写](https://github.com/yiwer/Observer/issues/10#issuecomment-5555149060)已单次发布，Root用独立API读回完整正文/ID/URL，另读Issue状态与assignee。

## 范围与先行要求

一个可替换平台Adapter，交付Story-linked Discourse、Platform-native Signal及无合法样本时的明确Coverage Gap。真实社交源尚未批准；X/Reddit等用途未知维持关闭，不用自有fixture证明真实平台覆盖，也不能以只有空栏替代两类固定合法材料的开发路径。

作者先亲读implement、TDD及tests/mocking、codebase-design、领域词汇、票/PRD US23–25、AC05/06、D5/D6/T1和ADR0001/4/5。局部技术方案须覆盖六AC：平台/查询/语言/时窗/地域依据/样本量和缺口；最小采样、原生信号阈值与偏斜判断；主EventCluster关联和不得作为独立事实佐证；采集/模型/存储/永久导出分段授权与撤回/删除时点；敏感字段阻断；Schema/历史兼容。需要平台事实时用research技能派背景一手研究，历史研究不是当前授权。

先向Root提交最小Interface/版本/首片方案确认，再沿已批准T1逐片RED→GREEN。原公开 `createObserver` 来源/配置/业务时间/历史/Runner与Verifier→produce→鉴权readReport、真实SQLite/重启为主要seam，少量外部来源I/O契约。不得用候选或模型自报授予SourcePolicy权限、事后调阈值凑信号、总体支持率/个体画像或新增人工编辑器。PDF/邮件尚属于后续票，本票须证明禁止材料不会进入共用Canonical，不虚称已运行不存在的Rendition。

## 冻结与安全基线

基线完整186项，smoke3为子集。保留request1–5/Record1–6/Version1–5及SQLite user_version1旧字节/读回语义；新版本先协调，不能静默改旧renderer。#9所有栏目逐Claim domain规则、#8Profile开始固定和实际Verifier发送计数、#7事件因果/去重/历史来源权利、六栏7/3软目标继续有效。

Root持有旧Record1–5六份及Record6三份不可变oracle；新增后者在 `accept-v1-09/data/root-v1-10-compat-57e9686`，generator禁止重跑，基线与reader摘要见[#9记录](09-domain-evidence-rules.md#record6-后续兼容基线)。作者不改这些基准，最终由Root以新built及actual-master独立读取。

不读auth/秘密/QQ_SMTP_KEY/用户`.idea/`，不发真实Provider/SMTP，不采集真实平台、批准来源、购买、部署、push、合并或关闭票。Docker固定desktop-linux29.6.1及既有三个sha256镜像，禁止升级、重建、retag、重启或prune。绝对不触碰/换工具清理历史拒绝目录 `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`、`O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c`、`C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`；两只21:56旧exited容器fb6640585ce1/c9e72c9c5c5f亦不归本票管理。

完成代码与说明一并提交clean SHA，再同SHA完整check/smoke，Root固定三点diff、fresh Standards/Spec双轴、独立冻结与实际master验收。真实源许可、模型质量、邮件/PDF、目标环境与14天人工门槛继续分别验收。

## 首片方案确认

作者已报告亲读指定技能/项目文件、实际gh与基线clean。Root确认以下局部设计仍属于已批准T1与本票范围；这是实施方案，不是完成证据：

- Request6→Record7/Version6/`observer-canonical-v5`，沿domain-v1；旧request1–5/Record1–6及SQLite版本、Candidate2/Research2/Verification1外壳保留。逐社会Claim增加独立受限discourse判断，缺失/未知failclosed，不由注解赋予来源权限。
- `discourse.observations` 单独存放经过共同Gate的样本论点/分歧；不伪造fact以穿过#7事件规则。Story-linked定位本期最终唯一合格主EventCluster，不能相信候选自报ID；无主或多主Gap。native标为平台信号候选、非已证新闻，不能当新闻事实或独立佐证。社会组数与普通新闻/ImpactNote配额区分。
- 开始时冻结Owner采样配置与指纹：单组最多100条、最多10组、原post key去重；Story-linked最少6条，native最少12条/至少3个不同讨论线程/2个预先时间桶。同线程占比>50%或重复>40%、关键完整性未知、限流/删除/不足均Gap。这些是版本化工程资格阈值，不是经校准的代表性或置信度；不同thread ID不叫独立可靠来源。语言/地域未知不编造。
- 社会专门用途约束只能收紧当前SourcePolicy；所有现有阶段grant及明确允许永久衍生/不可撤回导出同时满足才可使用，删除义务若要求回收衍生/导出物或未知则拒绝。旧policy不带可选social字段时必须保持原digest，且不会自动获得social用途。
- 采集后、送模型/核验前、核验后和提交前的生命周期复核只能收紧：deleted/changed/unavailable使该组退出可读/归档内容，不补取越过cutoff的新正文。可选外部当前配置读取与静态启动快照明确区分，不声称静态默认能感知磁盘变更；已导出文件不可回收。原始材料敏感字段在最早许可投影阻断，允许观点文本仍受原文存储/TTL/模型grant；不声称结构字段过滤可识别任意自由文本中的全部PII。

Root要求将最初“仅Owner-supplied sample Adapter”方案改为**一个真实Mastodon受控HTTP/分页协议Adapter + 自有合法固定响应替身**，避免以每日手动dump接口替代票内平台采样能力。Root依research技能实际派 `/root/v1_10_mastodon_research` 独立核对官方API/字段/分页/删除/许可边界，仅写作者工作树 `docs/research/mastodon-social-sample-adapter-2026-09-05.md`，不读取真实时间线或帖子。所有实际实例仍未批准、保持关闭；正向采样片要先根据研究收敛具体合同，技术可访问不代表使用许可。

已批准先做不依赖真实网络的首片：public produce6面对缺社会用途许可时不调用采样，普通合格新闻仍成稿，社会栏明确无合规来源Gap；真实SQLite重启/鉴权可读，request5仍原Record6。作者应先取得真实RED，再最小GREEN；首片确认时尚无结果，随后进展见下节。

## 局部实施与截稿采样合同

Root实际读了作者工作树 `data/v1-10-slices/01-red-ready.log`、`01-green-after-clock-fix.log`、`02-red.log`、`02-green.log` 全文：

- 首片已安装锁定依赖后因 `invalid-request` 真正 RED（1项失败）；增加新版本并窄修只对request6读取新冻结时钟后，单文件1/1通过、319.5877ms。最初缺zod是环境失败，不计业务RED。
- 第2片先因缺少「平台：Mastodon」展示 RED，最小披露后2/2通过、344.9583ms；未采集时语言、地域、样本量仍为未知，不编造零值。
- 这些是作者变化中工作树的局部结果，Root仅核对已存日志与当前测试，不是独立冻结重跑、完整测试或正式双轴审查，计数不相加为本票验收。

作者发现现有 `Evidence.retrievedAtUtc <= cutoffUtc` 与在produce中首次实时采样不相容。Root核对当前 `observer.ts`、采集器和PRD D4后，批准 **截稿前显式 `createMastodonAdapter.capture`，截稿后 `produce6` 读取该冻结快照并只作撤销式复核**。capture返回实际receivedAt、来源政策/采样配置指纹和有界样本，不以created_at代替首次取得时间、不回填cutoff；快照/receipt按不可信来源输入解析和冻结，Runner不能赋予权限。许可不足须在第一次HTTP前拒绝；跨cutoff、取消、超时和有限分页不能伪装完整取得。

此调整仍是已批准来源I/O到T1的时序，不引入每日手动dump或通用缓存。若实现仅同进程短存，须明确TTL及重启丢失后的Gap，持久调度留在后续票；截稿后同实例复核不能添加新版正文。所有来源/材料生命周期只能收紧。

Root已完整读独立研究，并通过官方文档和固定v4.7.1源码独立核对关键协议事实：标签分页链接只保留部分参数，须固定原查询；ID为opaque string且排序不保证created_at顺序；单状态404同时涵盖找不到和无权查看，不能称已确认作者删除。来源：[标签Controller](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/timelines/tag_controller.rb)、[官方ID指南](https://docs.joinmastodon.org/api/guidelines/#handling-ids-within-api-responses)、[状态Controller](https://github.com/mastodon/mastodon/blob/v4.7.1/app/controllers/api/v1/statuses_controller.rb)。研究文档由作者最终提交纳入；它不批准真实来源或证明实际平台采样。最后收紧PDF/邮件未来实测措辞后，Root读回变更段落并验证文件SHA256 `e4a070fbfcb8bcfd22822a72369231592eb55be77ff8c64068d48b19a871b210`；当前仅Canonical/MD及永久Record可验证。

作者亲读完整研究后，Root确认具体正向首片：真实Mastodon协议Adapter以自有虚构两页加终止空页取得6条获准本地原发样本，实际capture早于cutoff、produce晚于cutoff；匿名获准文字经Runner/Verifier后形成指向本期唯一合格主EventCluster的Story-linked Discourse，账户/头像等传输层哨兵不进入模型或永久Record，SQLite重启保持字节。下一片再推进native门槛、偏斜和生命周期。该次方案确认时尚无正向片结果，后续进展如下。

## 正向链路与Root互补检查（变化中工作树）

随后Root实际读 `04-typecheck.log` 和 `04-progress.log`：作者正向Story-linked片4/4通过、326.5018ms，typecheck无错误。它不是完整套件或冻结结果。作者又报告native的12/11门槛、Profile开始固定、复核后不可用及受限兴趣排除等后续片；最终须以冻结代码与完整证据审查，不由切片数量认定票完成。

Root在独立 `data/root-v1-10-review/` 写少量互补公开seam探针，不导入产品fixture期待、不旁读SQLite、不访问真实网络：

- `adapter-policy-probe.mjs` 先捕获6条自有响应，再撤销collection许可；实际RED为仍读取6条status（exit1，20.813ms）。作者修复公共Adapter自身的当前权限/原政策/来源origin绑定后，Root原样复跑1/1通过、14.599ms，脚本SHA256 `5c520e243cdb2714e25d2dd34143f621560be1c419186e1f2e861115e4dea65f`。
- `discourse-t1-probe.mjs` 用12条两桶材料和完全空的普通Bundle，证明可产生1组native观察且不虚构新闻/主EventCluster，鉴权重启相同：1/1通过、51.8256ms，脚本SHA256 `191c77187c7d26c8b792dd8772219a970fcd183c1fc5ae71ad8d4392377009d3`。Root读完整社交MD段，未知地域/作者数及非代表性局限均可见。首次Root错误输入了domain-v1不接受的主题枚举，被正确隔离；只修了探针输入，保留失败记录，不计产品RED。
- `post-verifier-t1-probe.mjs` 证明Claim已送Verifier后，将复核响应改为404；原Claim及复制进自由注解的原句均不在全Report中，0组观察且重启相同：1/1通过、46.0057ms，脚本SHA256 `99280ecd676cc78cce13b43ceb8ee390f0a42255dbbea054e94d590b68a40b85`。首次Root负向子串断言误报了正确的否定说明「未将不可用断言为作者已删除」；亲读中文后改为检查结构化unavailable原因，禁留原句期待未改，原日志保留为探针断言错误。
- `adapter-cancellation-probe.mjs` 在最后一条status响应期间取消，最初仍返回unchanged；实际RED exit1、1项失败、13.8962ms。作者修复后Root保持原期待复跑1/1通过、18.5967ms；问题局部关闭，最终冻结重跑仍待完成。

Root另静态发现Interest快照曾放在新增异步采样之后；作者报告已用复核等待期间导入v2的真实RED→GREEN修到任何新await之前，保持旧请求时钟不变。Root也批准仅request6、通过全部社会Gate的native analysis使用受限topics/entities兴趣投影做排除/排序；不能扩普通analysis，地域固定未知、GlobalBaseline不由社交推断，原词不作为自由注解永久保留，Story-linked仍跟随最终主Cluster。Record7社交观察的一致性校验仍在实施。

在作者第13片后变化中源码上，Root四个原探针又独立并行复跑，均exit0/各1项：policy16.0268ms、cancellation18.5967ms、native-only66.1554ms、post-Verifier56.1193ms。日志为 `data/root-v1-10-review/wip-after-s13-*.log`，SQLite/MD输出各自独立新目录；不是同一冻结版完整check，不将重复计数累计成测试覆盖量。

以上均基于尚未提交冻结的工作树；完整check/smoke、fresh Standards/Spec、Root冻结构建和actual-master验收仍未执行。本票保持in-progress，不启动#11。

## 收口前协议复核与环境记录

Root进一步亲读作者 `18-lifecycle-regression.log` 与 `18-green.log`：Runner后撤销来源许可曾使普通新闻一并因 `source-policy-invalid` 失败（16项中1失败，566.431ms）。作者修复后16/16、594.5898ms；撤销社会材料而保留普通新闻的期待未变。Root又完整读取 `27-green.log` / `27-typecheck.log`：社交单文件25/25、946.4876ms，无失败/取消/跳过，typecheck无错误。上述依然是变化中作者工作树日志，不计作冻结验收。

Root静态发现最初p/br-only解析与选定hashtag时间线的标准正文不相容，要求在冻结前验证。原研究agent依research技能仅窄复核官方v4.7.1 formatter并追加同一研究文件：本地正文标签标准格式为 `a.mention.hashtag[rel=tag]` 包裹 `#<span>tag</span>`，一般URL和账户mention另有不同结构。作者以该自有虚构格式取得真实RED→GREEN，并把两类正向fixture换成这个格式；只允许受限同实例标签包装，剥除链接/HTML，不扩大来源用途许可。Root亲读唯一附注152–171并验证最终研究文件SHA256 `c1ff179946466fb9684158c18d4cf466442e54852871c9b5b34175d84df42221`；原151行版本摘要仅是历史中间版本。来源：[官方hashtag formatter](https://github.com/mastodon/mastodon/blob/v4.7.1/app/lib/text_formatter.rb#L109-L114)。Root完整读作者 `24-real-format-fixtures.log`：22/22、1000.5791ms；作者曾误把Observer自己的MD目录锚判为来源HTML，保留中间失败记录并只收窄该错误断言，不称其为产品RED。

同次准备完整测试时，Root只读Docker预检曾重复遇到两个既有Provider标签 `No such image`，但按固定ID读取和镜像列表仍显示原标签。Root依diagnosing-bugs技能用原CLI调用缩小复现，未升级、重建、retag、重启或清理Docker。随后原标签读取恢复，**根因未证实，不能声称修复了Docker**。2026-09-05T23:03:00Z `data/root-v1-10-review/docker-tag-probe-ready.log` 三项均exit0且精确匹配原Codex/Claude/协议镜像ID；`docker-tag-differential.json`保留恢复时的对照结果。这是测试环境就绪检查，不是完整check结果；若完整执行再次失败，保留整次终态，单独复跑而不拼接PASS。

## 首轮固定候选 R1：拒绝合并

作者提交 `6c7da4c4fa45b6fca80444247fef4ed70fa3ae52`，Root实际核对clean `ticket/v1-10`、有效base `f36aae2122d081e638bfd520f93ded88fc95ef3b`及非空 `git diff f36aae2...HEAD`；唯一提交 `6c7da4c feat: add policy-bound Mastodon discourse observations`，19文件、1370+/45-。包含[技术规格](../../../implementation/v1-10.md)、官方研究、固定材料用途说明和26项社交测试。Root重读GitHub #10全文/评论及原生#7 CLOSED，未改票状态。

作者完整check首轮 `data/v1-10-final-check-ES7ah1`：212项中211通过/1失败，exit1、144507.8822ms；唯一失败为初始 `docker image inspect observer-v1-05-claude:2.1.252` 返回No such image。原始stdout SHA256 `1415e08aa5bf043fc7ac442a8232dae19ace5e35413a80911dc14a4b483cae92`，失败整次保留。只读原标签检查恢复且没有环境变更后，同SHA另目录完整重跑，不拼接局部结果：

| 执行者/同SHA工作树 | 完整check终态 | smoke终态 | 证据目录 |
|---|---|---|---|
| 作者 `v1-10` | 212/212，exit0，125379.994ms | 3/3，exit0，1335.3342ms | `data/v1-10-final-check-sq9mlU` / `data/v1-10-final-smoke-t5FMRW` |
| Root独立detached `accept-v1-10` | 212/212，exit0，121090.2552ms | 3/3，exit0，1310.9221ms | `data/root-frozen-6c7da4c-full` |

两者均前后clean同SHA，无取消/跳过；smoke是完整套件子集。作者check stdout SHA256 `92fcd7057f3bc184962cb61dfbe9bdc50ae8984e2dbe0626f92b15d3cb5906bd`、smoke stdout `b1fcf2bd4c419283011f82a402b9e13a406d5b07614caa898df1ec429542d210`；Root原始stdout/stderr分存且combined按观测到达顺序落盘，check combined `161e7f6f8e2e8f8558bae15e492afab806f66ad74be5b0812f8ab5e47cea8380`、smoke combined `ab3df2ea7ebb4780e8025e65512ffe598c564c7b97e91a7fbb22207f7a30d597`。

Root用此detached built显式路径重跑全部旧Record1–6不可变reader，9份旧Report/MD字节均相同；公司独立性1项、Profile三探针1/1/4、Event五探针3/4/3/1/3均通过。旧#9 Spec探针原字节SHA `6dad8f32e095d046c5c89aeadd777da2dd2d4114af741cae253a52dde270cd9e`机械复制到此工作树 `data/root-v1-10-inherited-spec`，实际导入本树dist，3/3、106.7757ms。没有重建旧基准。

本票四个Root探针在同built独立重跑均exit0/1项：policy26.0657ms、最后响应取消30.6134ms、native-only94.7069ms、post-Verifier不可用79.8001ms，日志 `Observer/data/root-v1-10-review/frozen-6c7da4c-*.log`。Root读回两份新MD的社交栏和Overview，原生候选、计数/两桶/未知属性、非代表性及404非确认删除表述与期待一致。

### Standards

fresh `/root/review_v1_10_standards` 阅读完整差异与规范后报告两项，维持本轴原分类：

1. **P1，硬性违规：最终社交复查留下普通证据TTL校验空档。** R1 `observer.ts:294` 在 `await discourse.refresh()` 后更新发布时间却仅检查social失败，违反 `docs/implementation/v1-03.md:38`「不再取一次较晚时间留下校验空档。到期瞬间不再允许事实发布」及v1-09最终许可/TTL规则。普通证据23:41到期，最后一次社交I/O把时钟推进至23:42，事实仍published且进入永久MD和鉴权重启结果。
2. **P3，判断性 possible Repeated Switches。** `record.schemaVersion === 6 || record.schemaVersion === 7` 等能力判断重复分布在observer/archive-integrity/six-edition等模块，可能增加未来版本遗漏风险；非硬性违规。本票不为此扩展旧版本重构。

Standards合计2项：1硬性、1判断性；本轴最严重P1。未以完整套件通过掩盖新增反例。

### Spec

fresh `/root/review_v1_10_spec` 阅读完整差异及票/PRD/Root批准范围后报告两项：

1. **P1：歧义组占用native排名，导致整期无法归档。** R1 `discourse.ts:102–117` 先排名再拒绝同组多候选，priority仍取旧位置，违背「最多7个native、前三个重点」与合格部分继续成稿。A组三个分别过Gate的候选与B组一个合格候选使B的priority=false，最终 `canonical-record-invalid`；两个唯一候选的对照成功归档/重启。
2. **P1：后续组等待时撤回前组来源拖垮合法组。** R1 `discourse.ts:52–72` 仅在每组自己的await后检查当前政策；复查B时撤回A，未回扫的A仍进modelRequest，`source-policy-invalid`阻止合法B成稿，违反「变化只把组放入sticky隔离集合」；稳定政策对照通过。

Spec合计2项，本轴最严重P1；未确认额外范围扩张。两个轴不合并或重新排序。

### 独立反例与修复边界

Root亲读并原样重复三个评审探针，每个对照通过、负例失败：

- Standards `final-refresh-expiry-probe.mjs` SHA256 `24688d5e0a1c8c319cc0d3331866ae3c52ea4459ae9a18b37c6c4d26a464bf47`；评审2项中1失败406.9957ms，Root399.0863ms。
- Spec `native-group-isolation.mjs` SHA256 `4b63a876ff4bd2dfe74a5e5d20a5dcba855c76250774beba7032770fc75eb6b0`；评审2项中1失败231.9069ms，Root331.0215ms。
- Spec `multi-group-revocation.mjs` SHA256 `dc05fb78790597852ef48c8f7eafa2991fd772c6f032d70677e69d6177ad2404`；评审2项中1失败293.5895ms，Root267.1527ms。

原探针与首次日志分别保留在 `Observer/data/root-v1-10-standards-review` / `root-v1-10-spec-review`。Root仅另做可移植副本，参数化被测built模块路径及SHA诊断，业务期待不变；先对原detached R1重新证明各2项中1失败，105.8668/90.4179/106.6598ms，`root-v1-10-review/portable-r1-*-red.log`。Standards早期探针的Windows导入URL和SourcePolicy规范化顺序准备错误保留，不算产品RED。

Root因此拒绝R1合并，批准作者按TDD窄修：最终await后以唯一最终时间重查全部可展示Claim的完整当前许可/TTL及受限回执；先确定每组唯一且可刊资格再进行native排序/容量/priority；全部组HTTP完成后无新HTTP地同步重扫所有未隔离组当前许可/TTL。不放宽一致性校验、不改旧字节/独立探针期待。新clean SHA须重新冻结、双轴复审、完整check/smoke、Root独立与actual-master验收，当前不启动#11。

## R1修复中补充检查

Root的可移植评审探针只参数化模块路径/诊断SHA，固定业务期待。它们在同一R1 built上重现原失败，后续新冻结与master保持文件不变：native-group `c2c5a8abe57fabb8eb5e2313570f1a9e9e7a2cfd919dac3f6e2ff15467839d5b`；multi-group `97e6008bc44b1a672ac547b0caed93e34d80e77fd2addddbe4bd51c17a3fd60f`；final-expiry `fe15739af7284aa264c62894f434a5ceada006c9869fa8c67d7b9e477464fbd4`。文件均为 `Observer/data/root-v1-10-review/*-portable.mjs`。

作者第3片修复过程还遇到关联失败：移除已撤来源后，Runner仍返回该已知失效组候选会使原Edition assignment检查拒绝整栏。Root批准仅Request6/social入口先隔离**本期配置中已sticky失效组**的候选，再执行原assignment检查；不能让未知group、未知Evidence或错误Edition借此绕过校验。Root另指出反向时序A等待期间撤B：每组I/O前也须读取当前政策，不能只依赖整轮开始的旧数组；这是同一多组生命周期修复，不要求每个socket监听磁盘。作者报告正反向都已取得真实RED→GREEN，仍待新冻结独立验证。

Root额外运行唯一时间解析反例：R1 Adapter的created_at/edited_at只验证string，JavaScript Date会把日期-only补成UTC午夜，导致缺失实际时刻的记录被采纳进时间窗。`adapter-creation-time-probe.mjs` SHA256 `3c1569a2cb6a03239b129b0a52fbea381c4fd21808f071f70a6eebf2449fb45b`在R1 detached built的明确时刻对照通过，`created_at=2026-09-04`的6条负例却全被采纳；2项中1失败、19.271ms，原日志 `adapter-creation-time-r1-red.log`。Root要求created及非null edited必须是有明确时区的合法ISO实际时刻，允许合法offset规范到UTC；日期-only、缺时区及无效日历隔离，不能发明缺失时间。此为Root补充检查，不重写原Standards/Spec报告计数。

## 第二轮固定候选 R2：拒绝合并

R2 `96a8c9d014608043fa87f3d95f23e2c7a47461b3` 相比R1仅5文件212+/19-，Root确认固定base三点差异有效非空、作者前后clean。作者全检 `v1-10/data/v1-10-final-check-8ERABK` 为216/216、exit0、125607.8974ms，smoke `v1-10-final-smoke-J8eeyN` 为3/3、exit0、1352.0426ms，无取消/跳过；smoke仍是子集。stdout SHA256分别为 `5edf6ef228e1a987ea040abd02b24238d1f8dc553e45ddfc77ad5b5d281b5425` 和 `6d8e38b649a63a2aa31ef6c95f23cb09239e0fb5319a4752a74a3df010771902`。Root亲读结果与摘要，但**没有运行R2独立完整check/smoke**，不能把作者执行重标为Root。

Root另建clean detached `accept-v1-10-r2`、锁依赖并build：全部14份旧reader/公司/Profile/Event探针通过，9份历史Report/MD字节保持；旧#9 Spec原字节机械复制后导入本树dist，3/3、110.2628ms。本票四个既有Root探针各1/1；native-group、多组撤权、最终普通TTL、日期-only四个原反例各2/2通过，日志 `Observer/data/root-v1-10-review/frozen-96a8c9d-*.log`。这证明R1已知问题已修复，不等于本票验收完成。

### Standards

fresh `/root/review_v1_10_r2_standards`：**0项硬性违规，1项P3判断性 possible Repeated Switches**，保持前轮版本能力重复判断的非阻断结论。独立补查最后社交await撤销普通distribution.enabled，发布Claim/自由回执被隔离，native保留、最终时间一致、鉴权重启一致：`root-v1-10-r2-standards-review/final-rights-probe.mjs` 2/2、321.4675ms；脚本SHA256 `1b74feb54986c59c27c4a72502d56b4c2c692f9dd3687ce512f8baba17ff7906`。首次准备缺publishedAtUtc分发grant的错误fixture已保留说明，不算产品RED。此项当时是评审agent执行，Root已亲读脚本/结果，尚未独立复跑。

### Spec

fresh `/root/review_v1_10_r2_spec`：**2项，最高P1**。

1. **P1：当前配置独有的社交来源绕过模型输入隔离。** `observer.ts:119` 从启动policies判source.edition，后续却从sourcePolicyReader核验当前许可；只由reader登记且缺social特殊用途、无采样组的源，经普通Bundle/world-affairs路径把未投影canary送EditionRunner。违反本票仅合法capture路径取得社会材料的用途边界。启动策略对照正确隔离。仅证明替身Runner输入泄露，未调用真实模型，不追加声称永久正文泄露。
2. **P2：公共revalidate最后响应到期仍返回unchanged。** `mastodon-adapter.ts:164–175` 仅入口检查TTL；最后HTTP把clock推进到receipt.expiresAtUtc，仍返回null。违反技术规格公共Adapter自己守TTL的规则。Observer已有await后复查，因此这是公共Adapter契约缺陷，不是已证明的出版绕过。

Root亲读并原样复跑 `root-v1-10-r2-spec-review/current-source-and-ttl.mjs`：4项中2对照通过/2负例失败，Root263.4572ms（原评审350.0923ms），SHA256 `b39eed0733b892b725c034d718a9ac197e60feaa34c627bc364ad178ba9a67d7`。Root发现原普通Evidence的24h TTL与1h政策不匹配，另做portable副本仅参数化built路径并将发现/取得23:10、到期次日00:10，业务断言不变；在R2 detached仍2/4失败、59.1618ms，排除该准备问题。副本 `root-v1-10-review/r2-portable/current-source-and-ttl.mjs` SHA256 `d4046a2a36e164d295910bb01cd02dec20dc869b36b8b4c3e731c6bb5396f717`，原脚本/失败均保留，后续新冻结/master固定此副本期待。

Root拒绝R2并要求窄修：最后采样await后，同一份当前政策Authority完成来源分类与grant/digest检查，补等待期间才登记社交源的同根因动态变体；公共revalidate最后返回前保留取消/实际deadline优先再查TTL，失效receipt不可回拨复活。无需监听每个socket、不扩旧Request、不为P3重构历史版本。

## 第三轮固定候选 R3：拒绝合并

作者将两项修复及回归/规格提交clean `af2b9b4599c40a324213ee6339fe393eaf3d345e`，R2至R3仅4文件93+/5-。作者局部单文件32/32、2218.6185ms，八相关文件152/152、4266.8765ms，固定portable反例4/4、58.7692ms；它们不是完整或Root冻结结果。Root验证完整base三点差异19文件1654+/48-、三个提交可达，创建独立detached `accept-v1-10-r3` 并安装锁依赖/build；已派fresh Standards/Spec两轴重新审查。当前不启动#11。

Docker环境仍间歇出现原短标签NoSuchImage、固定ID却正常。R2在23:47、R3在2026-09-06T00:02:31Z以同一个daemon ID/29.6.1、固定CLI和显式host复现；只读限定名称对照中Codex请求5秒超时，Claude成功后短名恢复。两次相关性相同，**根因仍未证明，限定名超时不算PASS**。原日志分别 `docker-r2-differential.log`、`docker-r3-differential.log`；没有升级/重建/retag/重启/prune。R3完整suite须在原三镜像检查就绪后再启动，保留任何整次失败，不拼接结果。

原三镜像实际恢复后，作者及Root独立detached均在同clean af2b9b4完成全检，无失败/取消/跳过：

| 执行者 | 完整check | smoke（子集） | 证据目录 |
|---|---|---|---|
| 作者 | 218/218，exit0，124327.1784ms | 3/3，exit0，1346.9641ms | `v1-10/data/v1-10-final-check-n5kwD2` / `v1-10-final-smoke-h0Iatf` |
| Root detached | 218/218，exit0，122488.019ms | 3/3，exit0，1345.6992ms | `accept-v1-10-r3/data/root-frozen-af2b9b4-full` |

作者stdout摘要check `a9c897ae22ad4518b7abd6be45d3584383d99f59234e76802edfcd145950357c`、smoke `b9918e5906cb4a6678dfbaa61d1d64806f13b68e47502eb742235fc489eddd25`；Root combined摘要check `0a6c34beb3ec0e95bd485bf4a3ec91c46e7273ea31013a5fe82ea4c203630a26`、smoke `195966bbb847ddc29d2fa0fc0efab46d16f2858c083b86a22078e0749ad1a9f8`。Root全检00:06:24.444–00:08:32.074Z，smoke00:08:53.443–00:08:57.645Z；前后SHA/branch/status一致。

Root独立全部14份旧reader/专项再次通过，9份历史Report/MD字节不变；旧#9 Spec原字节复制到此树实际导入dist，3/3、86.5033ms。本票8个既有探针全部通过；R2 current-source/TTL原期待4/4、66.9235ms，final-rights的仅路径参数化副本2/2、101.0983ms。副本SHA256 `366bf80840e22c10c0bfc9be2ea04bc134b2c0ab69ccbace8ae39f96954071f6`，原稿保留。新MD社交栏/Overview读取确认边界与不可用否定表述。整轮25次调用及原始输出/摘要/前后身份保存在 `Observer/data/root-v1-10-review/frozen-af2b9b4-independent-result.json`。执行器首次缺新worktree的data父目录，尚未运行测试即ENOENT；创建父目录后原脚本完成，不计产品RED。

### Standards

fresh `/root/review_v1_10_r3_standards`：**0硬性违规，1项P3判断性 possible Repeated Switches**。完整19文件及新delta审查前后clean；未发现违反PRD D5/D6/T1、ADR0001/4/5或批准合同的确定问题。当前政策Authority及公共Adapter取消→deadline→TTL顺序符合合同。版本能力判断分布在observer.ts:380和six-edition.ts:134等处，保留非阻断维护建议，不扩旧版本重构。

评审独立公共Adapter三个场景：稳定、末响应到期、取消同时到期及失败后时钟回拨不可复活，均exit0。`root-v1-10-r3-standards-review/probe.mjs` SHA256 `69a3e6654dd1fb10d865fb7a4dffa6111e3cf6e3e80a025de264f2d41f824ec1`，Root亲读，不能算作Root另一次执行。

### Spec

fresh `/root/review_v1_10_r3_spec`：**1项P2：最终失败组仍永久保留含原句的语义回执**。技术合同v1-10.md:42要求删除「最终失效组的全部语义回执」，:86明确包含upstreamOriginId等字段复制的原句。observer.ts:323–328先裁回执，discourse.ts:117之后才判无主故事、无合格分析等组失败，未再清除回执。missing-main和unsafe-scope均0观察及明确Gap，canary却仍在verification.assessments[].evidence[].upstreamOriginId，经鉴权读取/SQLite重启可取得。影响为永久Record残留，**没有观察到Markdown泄露**。未发现其他独立缺失或范围扩张，R3前两项修复与合同相符。

Root亲读固定探针 `Observer/data/root-v1-10-r3-spec-review/final-group-receipt.mjs`，SHA256 `973e5838d2a7f3055e5a84eb0a5a8ad2a2b2215e242b6a0112e5ab397f7dd7d0`，在独立detached built原样复现：3项中native对照1PASS、两负例FAIL，137.5661ms，日志 `root-v1-10-review/r3-final-group-receipt-root-red.log`。自有材料，无真实服务、秘密或SQL旁读。Root拒绝R3，作者在全部最终资格/兴趣/容量判断后统一裁失效组回执，保留普通/合格社交审计与旧字节；保持原期待，不靠单字段黑名单。新clean SHA须再次冻结复审与独立验收，当前不启动#11。

## 第四轮固定候选 R4：拒绝合并

R4 `f363de8facf1b387c9eabc29d99e32d49b1fe8a6` 相比R3仅3文件59+/2-；在discourse最终failed集合形成后，按Gate的story/claim身份及Evidence关联裁掉整条Assessment。Root核对clean、完整base三点差异有效非空（19文件1711+/48-），亲读delta/规格。作者单文件33/33、相关八文件153/153及原R3探针3/3只是开发证据；中间误命名green的失败已如实说明为新增fixture不合法可选字段，不改业务期待。

| 执行者 | 完整check | smoke（子集） | 证据目录 |
|---|---|---|---|
| 作者 | 219/219，exit0，122703.6332ms | 3/3，exit0，1339.2403ms | `v1-10/data/v1-10-final-check-eFikTK` / `v1-10-final-smoke-pv6NHX` |
| Root detached | 219/219，exit0，121120.8073ms | 3/3，exit0，1318.4076ms | `accept-v1-10-r4/data/root-frozen-f363de8-full` |

同SHA前后clean、无失败/取消/跳过。作者stdout摘要check `e75855e32b2fc536877c7ce4dacf9c2150738fc22bc05bf3667e045d7ae15102`、smoke `f138a9ec85689a64aafeba67abb0082ceb364aedcfd7b96d52b6b4f85712c425`；Root combined摘要check `8e0eee5f9d46c5dfd1bad3b0f38e181442eed98ef179dbd8e389307b61470603`、smoke `a9c79b9afa2b75fca60d2155032a40a57c50938fa7f7f67e788b559512b7673c`。Root全检00:14:53.866–00:17:00.099Z，smoke00:19:01.493–00:19:05.624Z。

Root新detached锁依赖/build后，全部14份继承reader/专项通过，9份历史Report/MD字节不变；本票既有8探针、R2当前来源/TTL4项、final-rights2项、R3final-group-receipt3项全部通过，后者139.5042ms。旧#9 Spec原字节复制到本树dist路径后3/3、106.2837ms。26次独立调用原始输出/摘要/前后SHA保存在 `Observer/data/root-v1-10-review/frozen-f363de8-independent-result.json`。下列两项是随后新增的真实反例，不能被上述结果覆盖。

### Standards

fresh `/root/review_v1_10_r4_standards`：**1项P1硬性违规、1项P3判断性 possible Repeated Switches**。

- **P1：最终删回执但未同步重算coverage，正常新闻整期无法归档。** discourse.ts:139保留arrangeEvents先计算的coverage；合法native Assessment携带evidenceLanguages=zh且随后被兴趣排除，最终裁掉Assessment后，interest-selection.ts:117重算不一致，produce抛canonical-record-invalid。违反技术规格v1-10.md:42保留普通新闻审计和:86最终一致性要求。合格且有语言、排除但无语言两个对照均重启可读。
- **P3：版本能力多点判断**，six-edition.ts:59/134/173等重复扩展schemaVersion集合；仍是非阻断历史维护建议，不要求本票重构。

原 `root-v1-10-r4-standards-review/final-coverage-probe.mjs` SHA256 `9feb8f651879e9e663832f5b5221b55059b2c7b66b4d8fc32d2ef0f0cca8eab7`，评审3项中2PASS/1FAIL、360.108ms；Root亲读原脚本及其Owner自有政策helper，原样复跑同clean作者源码3中1FAIL、372.1976ms。再只参数化built导入/输出路径、机械冻结政策helper输入到 `root-v1-10-review/r4-coverage-portable`，在Root独立R4 built保持期待3中1FAIL、105.9887ms，日志 `r4-coverage-root-built-red.log`。副本摘要 `f6b5c619b249877c6ec81fd0a9e586919f79ddcccba0874e6b575936d58201e6`、不改值的helper摘要 `a14108e634c4b5e4da220e867126199c79aa187a485c02f4f3909ca18ffafead`，原稿保留。

### Spec

fresh `/root/review_v1_10_r4_spec`：**1项P1，最终资格使用已裁剪候选，遗漏部分失败组**。技术规格:84要求「恰好一个候选且所有Claim可刊」，:42要求最终失败组整条Assessment删除。observer.ts:372传入gated.stories时已删失败Claim/空候选，discourse.ts:115–120只能看到幸存部分；一个safe加一个population Claim，或同组一个safe候选加一个population候选，均错误保留1组观察、groupReason=null，未进入failed集合，原句回执仍永久保留。未发现范围扩张。

Root亲读原探针 `root-v1-10-r4-spec-review/group-eligibility.mjs`，SHA256 `df11f5f6c2354d0e6b0795caee62ce6b65d6d425bcff58faf7360bdf918ce280`，独立R4 built原样复现3中1PASS/2FAIL、105.9212ms；两个失败场景rawRetained=true，鉴权重启一致，日志 `r4-group-root-built-red.log`。全部自有材料，无真实模型或来源。

Root拒绝R4：原候选/Claim成员身份用于组资格，完整最终Gate用于可刊判断，显示payload仍沿sanitized gated结果；最终回执裁剪后重算相应覆盖投影，不修改实际dispatch计数、降低一致性门或回填未核验正文。已准备但**未执行**的 `accept-v1-10-r4/data/root-v1-11-compat-f363de8/freeze-baseline.mjs` 不构成新Record7兼容oracle，目录已标NOT-FROZEN且没有baseline.json；只在未来正式接受的冻结候选上另建基准。当前#10仍OPEN，不启动#11。

## 第五轮固定候选 R5：拒绝合并

新clean `2a30b0b1891c71d5f74671da8576ba8ddf375aaa` 仅4文件101+/9-，Root核对完整固定base三点差异19文件1803+/48-及五个提交，亲读新代码/测试/规格。短期成员快照在Gate前仅存id/groupId/claimIds，资格查完整最终Gate、显示仍沿gated；最终回执后用interestCoverage重算，不改dispatch记录。作者35/35和相关八文件155/155以及三个原probe各3/3仍仅局部开发证据。

Root新detached `accept-v1-10-r5` 锁依赖/build并独立运行全部28份固定reader/probe：旧14份及9份Report/MD字节均保持，本票所有前四轮反例通过。R4 coverage3/3、156.4231ms，原成员3/3、131.7996ms，旧#9 Spec3/3、117.063ms；固定输入/断言与hash未改。原始输出、摘要、前后clean身份在 `Observer/data/root-v1-10-review/frozen-2a30b0b-independent-result.json`。完整check/smoke及两轴结论未由这28次结果代替。

Root已派fresh `/root/review_v1_10_r5_standards` / `/root/review_v1_10_r5_spec`。Docker短标签再次复现相同现象，Root00:23:33–00:23:40Z只读同daemon/显式host/固定ID/限定名称对照后原短名恢复；Codex限定名称5秒超时仍明确为失败，根因未证实、未写环境，日志 `docker-r5-differential.log`。作者原Node三镜像检查就绪后已启动同SHA完整check，新目录 `v1-10/data/v1-10-final-check-e5S8cZ`，本段记录时尚未取得终态。新Record7兼容baseline仍未冻结，不启动#11。

作者最终同clean SHA完整check为221/221、exit0、124375.3972ms（00:24:06.088–00:26:15.216Z），smoke子集3/3、exit0、1342.2902ms（00:26:24.676–00:26:28.502Z），无取消/跳过。Root亲读两个result.json及stdout摘要：check `e346acad5441e23793c12e0e605764871e662da4c2ad0b5261630194996bf065`，smoke `21c0183c044cf4a649e646e204d4e77127a90d925ae62af3c916770adbbf2994`，后者目录 `v1-10-final-smoke-7dGV0c`。**Root没有启动R5独立完整check/smoke**：在其启动前，下述新阻断已经确认；不能把作者结果或此前Root版本结果改称R5独立全检。

### Standards

fresh `/root/review_v1_10_r5_standards`：**1项P1硬性违规、1项P3既有判断项**。

- **P1：最终failed组的unconfirmedItems未裁，正文进入永久MD。** discourse.ts:144只裁Assessment，保留Gate.unconfirmedItems。自有合法sample-only/original/supported回执的Evidence relation为contradicts时，domain规则给出unconfirmed，组被判social-analysis-unavailable且无观察，但失败社会正文仍显示在MD「待确认」区；被裁掉相反关系后还显示成「关系未确认」。违反v1-10.md:85整组全原Claim须published及v1-03.md:29待确认关系完整要求。普通新闻、另一合格组及SQLite重启可读保持。
- **P3：possible Repeated Switches**，observer.ts:381、six-edition.ts:124等多点版本集合，仍不阻断且不要求本票历史重构。

原 `root-v1-10-r5-standards-review/unconfirmed-probe.mjs` SHA256 `78f9c4115f2fd0973a8c8fa08f543f524d76a9ea9a3bb6aeaeca63e740b26f56`，评审2项中1PASS/1FAIL、332.5556ms。Root完整亲读脚本及两份自有fixture依赖，原样复跑同clean作者源码2中1FAIL、94.4946ms；实际MD第141行有失败canary。Root另只参数化built/输出路径、机械冻结fixture，并将普通Evidence expiry从超出24h的23:00收回准确24h后的22:06，其余业务期待不变，独立R5 built仍2中1FAIL、97.2749ms，日志 `root-v1-10-review/r5-unconfirmed-root-built-red.log`。副本 `r5-unconfirmed-portable/unconfirmed-probe.mjs` 摘要 `cc67bc2e48ef3783952272c837b88645315e2b308ced7de58f22c3d6a6923992`，fixtures.ts摘要 `02a67938e174089cd59e7d11a0c5e15345176e9579e83661f1be8cd6b1ef2af4`，source-fixtures.ts仍 `a14108e634c4b5e4da220e867126199c79aa187a485c02f4f3909ca18ffafead`。原稿和失败均保留，后续固定副本期待。

### Spec

fresh `/root/review_v1_10_r5_spec`：**0 finding**，缺失/部分实现、范围扩张、错误实现均0，本轴无最严重项；完整19文件差异及R5 delta、票/依赖/规范均亲读，前后clean。原成员快照逐项匹配最终Gate、清洗payload展示及coverage重算符合已批准契约。评审独立单文件35/35、2523.5337ms，typecheck exit0，临时目录固定在 `root-v1-10-r5-spec-review`；未改代码或旧oracle，未跑Docker全套。此轴结论不覆盖另轴已证实的P1。

Root拒绝R5并交作者窄修：最终failed集合须覆盖所有可读投影，包含unconfirmedItems；普通合法待确认必须继续保留完整支持/相反关系，另一合格社会组/新闻和实际dispatch身份保持。不得把被拒正文换区显示、保留禁用回执补关系或放宽一致性校验。新clean SHA须重新冻结/复审/完整验收；没有新Record7 accepted baseline，#10未关闭、#11未启动。

## 最终固定候选 R6：接受进入集成

最终作者提交 **853be14fa9275fb7d99be19524014963a6857ef4**，Root 核对 clean `ticket/v1-10`，固定 base 的非空三点 diff 为19文件、1866+/48-。R5→R6仅3文件、65+/2-，Root亲读全部增量。最终失败组的同一 Claim/Evidence 集合同时过滤 Assessment 与 unconfirmedItems，再按剩余回执重算 coverage；普通合法相反证据的关系及实际 dispatch 身份保留。失败历史及固定反例均未改成宽松期待。

### Standards

fresh `/root/review_v1_10_r6_standards`：**0 hard，1项既有非阻断 P3，最严重P3**。R5 P1已关闭，无新增。P3仍为重复Schema版本判断的可能Repeated Switches，不要求本票历史重构。完整19文件和R6 delta均亲读、前后clean；独立复跑现有4项最终资格/coverage/原成员/待确认回归4/4、530.136ms，不冒充4个新独立探针。完整报告 `data/root-v1-10-r6-standards-review/review.md`。

### Spec

fresh `/root/review_v1_10_r6_spec`：**0 finding**，缺失/部分、范围扩张、错误实现均0，最严重项无。已亲读GitHub正文/评论、原生#7 CLOSED、完整19文件及R6增量；前后同SHA clean。独立现有社交单文件36/36、2870.8211ms，产物 `data/root-v1-10-r6-spec-review`。两轴均未改产品或旧oracle，未做真实平台/Provider资格测试。

### 同 SHA 完整检查与 Root 独立回归

| 执行者 | check | smoke（完整套件子集） | 证据目录 |
|---|---|---|---|
| 作者 `v1-10` | 222/222，126148.2905ms | 3/3，1325.7387ms | `data/v1-10-final-check-QQvN4r` / `data/v1-10-final-smoke-Gf8C2S` |
| Root detached `accept-v1-10-r6` | 222/222，122622.893ms | 3/3，1329.9801ms | `data/root-frozen-853be14-full` |

全部exit0、无失败/取消/跳过、前后clean同853be14。作者check stdout SHA256 `1969d56d76d326214647c0fa3f7267646b3523440485fd1b338acc6779a37b5b`，smoke stdout `9ff02988665a420513b90256abf87c032eb113262150c085a8f74c1d08aaf426`。Root check UTC 2026-09-06T00:37:59.314Z–00:40:07.078Z、combined SHA256 `2a68632f00a82e18faa3cb7f0b1d4201ae7d3ecb3dbd578105665e9d214b8de6`；smoke 00:45:13.923Z–00:45:18.216Z、combined `279295b40910fd939e65e860ab14b728b1ba42de042014fd1370ddb0ac21b09c`。

Root固定runner `data/root-v1-10-review/run-independent.mjs` 在该独立built执行**29份检查调用均exit0**；它们不是29个测试，不把重跑次数累加覆盖。含旧5 readers/9份Record1–6整Report与MD字节、公司/兴趣/事件、原社交8探针、R2当前权限/TTL与最终权利、R3最终回执、R4最终coverage及原成员、R5待确认过滤和旧#9 Spec3项。结果 `data/root-v1-10-review/frozen-853be14-independent-result.json` 绑定输入摘要、执行路径和前后clean SHA。R5固定待确认正反对照2/2、132.1283ms；其他已拒反例全部转绿。

R6准备时再次遇到既有Docker短标签读取异常，按固定ID可读；只读差分后原标签恢复。`docker-r6-differential.log` 中全限定Codex查询5秒timeout不是PASS，根因未证明；没有升级、重建、retag、重启或prune。随后作者与Root完整终态才是有效全检。仍只使用固定三镜像与离线协议/自有来源替身，不代表真实社交、模型、PDF/邮件或生产资格。

### Record7 后续兼容基线

在R6冻结验收通过后一次性捕获此前Root独立探针已生成的native与unavailable-gap两份报告，不重生成业务数据。目录 `O:/GenesisCode/Observer-worktrees/accept-v1-10-r6/data/root-v1-11-compat-853be14`；`baseline.json` SHA256 **00b47b35ab43e47edc58e92aa4932163741c4930a4228e981f0e68297ece87af**，producer固定853be14。新reader必须以待验收built绝对路径读取，检查整Report/MD、Record7/Version6、错误鉴权及production拒绝fixture。禁止重跑freeze或覆盖基线。旧R4准备脚本未执行且明确NOT-FROZEN，不得用作oracle。
