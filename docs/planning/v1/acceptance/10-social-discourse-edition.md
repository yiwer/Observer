# V1-10 执行与待验收记录

状态：**首轮冻结候选未通过独立评审，作者正在修复三个已复现阻断；尚未合并或完成本票验收**。GitHub #10 OPEN / assignee yiwer。

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
