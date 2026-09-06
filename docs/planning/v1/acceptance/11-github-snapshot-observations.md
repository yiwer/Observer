# V1-11 执行与待验收记录

状态：**in-progress；fresh作者已亲读契约，Root已协调新增版本/存储/权限与首片；官方协议细节复核中，尚无冻结或验收结论**。GitHub #11 OPEN / yiwer。

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
