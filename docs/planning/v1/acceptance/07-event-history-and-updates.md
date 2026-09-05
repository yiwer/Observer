# V1-07 执行与待验收记录

状态：**第二冻结 7fae122 已通过独立冻结验收，允许本地集成；实际 master 复验尚待完成，未关票**。GitHub #7 OPEN，assignee=yiwer。首个候选 63e93dc 的拒绝和失败证据保留为历史过程，以本文最后的审查记录为准。

- 范围：[GitHub #7](https://github.com/yiwer/Observer/issues/7)、[本地票](../tickets/07-event-history-and-updates.md)。
- Fixed base：`5da81976dd2ba166066977c038e6f46451890283`，包含 #6 最终接受、集成与关闭记录。
- Worktree：`O:/GenesisCode/Observer-worktrees/v1-07`；branch：`ticket/v1-07`，创建时 clean。
- Fresh-context `/root/implement_v1_07` 已实际创建成功，不复用作者或 review 会话；要求亲读 implement、TDD/required references、domain-modeling（必要格式）、CONTEXT、PRD/ADR 和票据。
- 唯一原生依赖 #6 已实际读回 CLOSED，closedAt `2026-09-05T11:29:58Z`；#7 dependency API 也返回 #6 closed。
- [启动回写](https://github.com/yiwer/Observer/issues/7#issuecomment-5551477565)已发布并读回；#7 OPEN、assignee=yiwer。

## 范围与判定边界

建立可追踪 Event Cluster、主 Edition 决定、跨栏 Impact Note 与新闻事件历史；同一事件只完整展开一次，其他栏的 Impact Note 不占普通/重点配额。相似词但独立事件不强行合并；Agent 可建议，任意 ID、相似度或自报布尔值不能成为未经核验的聚类/新颖性权威。

分别记录事件发生、首次公开披露、首次发现与实质进展时间；旧事件今日披露可以入选，无新进展仅换标题不能重复；重大漏采仍有价值才补报，并明确标签，不捏造未知时间或伪装新发生。实施须先收敛可执行新进展/补报判定表及冲突案例，写在本票实施/技术说明；词汇表仅保留领域定义，不塞入实现细节。

按已确认 T1 公开 `createObserver.produce → readReport` 逐片 TDD，真实 SQLite，外部 Runner/Verifier/来源/时钟可替换。通过连续多期生产、关闭/重开后再生产读取，观察历史影响和旧版字节不变；不以内置私有方法/内部 mock/SQL 旁路替代业务断言，也不为测试擅建未确认业务入口。

保留既有六栏 7/3 软目标、Record→唯一 Markdown、纯确定性 Final Editor、来源字段/模型与分发许可、逐批/最终 TTL、整期引用额度、私有鉴权和生产 fixture 隔离。新闻聚类不能绕过 Publication Gate，或把未确认/隔离内容升级成事实。若演化 Schema/SQLite，须显式兼容、原子迁移、未知新版本拒绝；旧 Record v1/v2/v3 和已出版正文不能静默重写，采集缓存不混为报告数据库迁移。

本票不实现 GitHub 仓库主键/热度/升权、兴趣配置、主题专门规则、真实 Provider 路由、PDF/邮件/Android、纠错新版、日刊调度或部署。真实来源/模型/人工判断资格与固定回放分开。

## 环境、安全与证据

既有基线 **130 项**，smoke 3 项是子集，不冒充新票结果。固定 Linux Codex 0.153.4 与 Claude 2.1.252 运行依赖和无凭证模型协议替身保持；宿主 Claude 2.1.261 不替代 Linux 资格。不升级 CLI、不重建/改标签/重启 Docker 或改全局配置；其它项目资源与用户 `.idea/` 不动。

既有首次 Claude tag inspect 偶发 No such image 的失败记录保留、根因未知；最近 #6 最终冻结及集成 full check 都首跑通过。若再遇到，等待实际终态并区分环境 setup 与产品结果，记录只读核对/同 SHA 定向和全量复跑，不拼接成 PASS。

本票不读 Owner 秘密、认证文件或邮箱，不触发真实模型/SMTP/云资源。QQ 单封预检已由 Root 完成（SMTP accepted / inbox unconfirmed），禁止重发；本机 Codex 真实测试地区资格和延期 Claude 实测由 Root 分别处理。

绝对禁止触碰或换工具重试清理：

- `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`
- `O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c`
- `C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`

Root/其它 reviewer 的各工作区 `data/` 证据也不归本作者所有，尤其旧归档基线、#6 独立 probes 与 `v1-06/data/spec-73c95da-independent`。使用自己新建的测试目录，不清理旧证据。

## 后续验收

作者先回报契约/判定表思路和首片 RED→GREEN；定期 typecheck/单文件验证，代码与实施说明一起提交冻结，再运行完整 check/smoke。Root 固定非空三点 diff，独立 Standards/Spec 双轴、detached 专项与历史兼容、实际 master 集成复跑后才接受/关票。当前没有 #7 最终测试计数或冻结提交，不拿 #6 130/130 代替；下列单片结果仅是实施进展。

## 已沟通的技术方向（尚未冻结或验证）

作者已亲读所需指导与项目规范，提出沿用现有 SemanticVerifier，在明确版本的回执中增加与事实 Claim/输入摘要关联的 event assessment，研究输出只建议 Claim 引用和主栏。确定性流程核对已通过 Gate 的事实/来源时间及关联，再从不可变已发布 SQLite 行重建本地历史、比较事件与进展；不将历史原文重新发给模型，也不增加测试专用业务入口或无必要的存储迁移。拟用新的六栏请求 v3 选择事件感知语义，保留既有输入与 canonical-v1 读取；具体 Schema/规则待首片验证，不能将此方向当成已经落地的事实。

Root 允许在当前票范围内按 T1 竖切推进，并要求：事实性的身份/时间不能只凭分析或自报布尔值授权；未知时间保持未知，不用发现时间冒充首次披露；缺失/错配/冲突的事件评估不能回退到任意 candidate.eventClusterId；历史回放不能偷用未来日报，有界截断不能被解释为“未报道”；错误合并的后续可追踪处置不重写旧正文，正式 Correction 仍属后续票；历史数据不能绕过来源模型许可。先跨栏同事件的一条 RED→GREEN，再逐片补判定表，不预先横铺全部测试。

## 首片实施进展（未冻结）

作者首个 T1 场景为两个来源、两个 Edition 的同事件：出版一条主故事，保留两份关联证据，另一栏有 Impact Note 且普通/重点数均为 0。首次命令因缺少本 worktree 的 node_modules 报 `ERR_MODULE_NOT_FOUND zod`（117.3774 ms），属于环境 setup；作者运行锁文件约束的 `npm ci --ignore-scripts`，未改变依赖或全局环境。随后业务 RED 为 `invalid-request`，**0/1**（214.6951 ms）；最小实现后 **1/1 GREEN**（218.7474 ms），typecheck PASS，均由作者报告。新增 request v3 / Record v4 / Version v3 / canonical-v2 的初步形态，旧六栏 request v2 仍用 Record v3 / canonical-v1；后续时间、历史、冲突守卫尚在逐片实现，不视作完成。

## Root 独立历史兼容基线

2026-09-05，Root 在 clean detached `O:/GenesisCode/Observer-worktrees/accept-v1-06` 的已接受 #6 SHA `af18a4b6276f3c5254474c1e676e5e88b2eaaa07`，通过公开 `produce → readReport` 实际生成新的 **Record v3 / Version v2 / canonical-v1** SQLite 归档。含六栏六条故事、重点分析和世界要闻→AI Impact Note；关闭 writer 后新 reader 读回完全一致。使用虚构自有素材及标注 Verifier，无真实模型或来源调用。

- Root 自有 ignored 目录：`O:/GenesisCode/Observer-worktrees/accept-v1-06/data/root-v1-07-compat-a913cb`。
- `generate-baseline.ts` 检查 producer SHA 与 tracked clean、拒绝覆盖既存数据库；SHA-256 `a5816eaf862fc5b5252008d09cb2600226733016c87acb7e0c1be8e986f39efd`。
- `record-v3.sqlite` / `baseline.json` 固定出版物 `2026-09-05-v1`；MD **8418 bytes**，SHA-256 `978a3ccd1eded8ebc2d1995f72586f53dab64e3685ee8de03317f82c48c10b38`；Record SHA-256 `1b1ac746a1176012097c8f71ae4598315807547208dd46eff802529e0a108b05`；完整 JSON SHA-256 `ecc58624e53b6a697e1123907af38e2279273b081e4c293ed5690639767d9092`。
- `verify-reader.ts` SHA-256 `9a3354b346fff1f9fa36979b3a9b42c6eeaa6b0928ed4de5ec81255ae5c9baa2`；接受固定绝对 module 路径，公开读取并核对 Schema、六故事、原字节/完整 JSON/版本哈希、错误 Owner 拒绝，以及 production 不可读取 fixture。无 SQL 旁路业务断言。
- 已接受 #6 built reader 自检 **1/1**；#7 当时未冻结的 source reader 诊断 **1/1**。后者只是早期兼容诊断，不能当最终 #7 证据；待冻结后以及实际 master 集成后都必须复跑。
- 已有 #5 producer 的 Record v1/v2 两份历史基线继续保留在 `accept-v1-05/data/root-v1-06-compat-4ca1d8`，不重新生成、不用新实现反造旧版预期。

复跑：`node O:/GenesisCode/Observer-worktrees/accept-v1-06/data/root-v1-07-compat-a913cb/verify-reader.ts <绝对路径/dist/observer.js>`。此目录是独立验收证据，不归作者或其它 reviewer 清理。

## Root 实施期独立探针（WIP，非冻结验收）

Root 新建自有 ignored `accept-v1-06/data/root-v1-07-review`，仅用虚构素材、外部 Runner/Verifier/时钟替身、真实磁盘 SQLite，公开 `produce → close → readReport`。没有修改作者代码或检查内部 SQL。作者此时 HEAD 仍为起点 `5da8197`，产品代码未提交；以下结果不绑定为该基线的行为，也不视作最终证据。

`fact-and-causality-probe.ts` **3/3 PASS**（82.1607 ms），覆盖同候选中旧 fact 后附今日新 fact 的保留、未来业务日报不能进入旧期回放、旧业务日期但实际晚出版的日报不能成为早先 cutoff 的历史。脚本 SHA-256 `5c22dc44a7529e2b8e19b66f8bc29e99372d94e049d56d7fc4a8c56fe96ef11b`；三个 `causality-run-*` 目录保留。冻结后须对 built 复跑。

`annotation-retention-probe.ts` **0/4 RED**（67.6951 ms，exit 1）：来源禁止分发、禁止永久归档、Verifier 返回后过期、措辞 unsafe 四种已被 Publication Gate 隔离的内容，虽然 stories=0 且 Markdown 不含 marker，仍通过 `publicationGate.batches[].verification.assessments[].event.fact` 的自由文本进入已持久化 Report Record，关闭/重开公开读取后仍可见。违反既有 PRD D6 与 ADR-0005 的来源分发/永久保留边界，是当前实施必须关闭的阻断；不是新增加产品需求，也不是对 #6 已接受 SHA 的发现。

- retention 探针 SHA-256 `1d310d04a050570d55f3e85ce845b3fbbe19378d1e52672c00a9fb46c6956628`；四份 `retention-run-*` SQLite 保留，只含自有虚构 marker。
- 复现后取得 WIP 文件 SHA-256：`gate-contracts.ts` `1ecd485e5803e0e6daf77838472c29a8c3ada9ed7123e80bd9dd854f21904f1e`；`publication-gate.ts` `c428abc7e5795018765a32e06fcde72ccc2b805e0bb20bff847bf8490407a971`；`batched-publication-gate.ts` `1181aa0e5f605c3edfe3caf5164583f46f775e6c0ef5c15cf7bd5fce8b7450aa`。这只是定位 WIP 的证据，不冒充冻结整个候选。
- 已交原作者用 TDD 窄范围修复：最终门槛后的 event 派生文本不得保留被隔离内容；检查跨批最终 TTL 和同样接受 optional event 的 request v1/v2 路径；不能把本地归档投影伪称完整原始模型回执。

双轴正式 code-review、完整 check/smoke、冻结/集成复验尚未开始，#7 仍 OPEN。

### 归档注解整改后的 WIP 复验

作者报告已用自己的公开 T1 先 RED→GREEN，覆盖 request v1/v2/v3 × 禁止分发/禁止永久归档/核验后过期/unsafe/允许来源 **15 种组合**，当时文件 **11/11 PASS**（645.2856 ms）及 typecheck PASS。新增 `event-projection.ts`，先完成 Gate（含最终跨批检查），统一剥离 Verifier `event` 自由文本；只有最终可发布 fact 保留明确标为 `observer-final-event-projection-v1` 的摘要、枚举和合格引用，不把本地投影冒充原始响应。外部回填本地投影字段不能获得授权。此为作者实施报告，不替代 Root 复验。

Root 未改探针或预期，直接针对整改后 WIP source reader 重跑：原归档注解 **4/4 PASS**（100.4523 ms），因果/同候选多 fact **3/3 PASS**（114.0533 ms）；固定 #5 的 Record v1/v2 与 #6 的 Record v3 **3/3** 全 JSON、MD、身份与鉴权兼容通过。最初 0/4 RED 证据与 SQLite 保留，不覆盖。当前 WIP 复现已转绿，但正式关闭仍待冻结 SHA、独立双轴与 built/master 重验；其它时间/关联/源权限场景继续实施。

### 后续竖切进展与冻结前核对

作者随后报告事件文件 **14/14 PASS**（831.8935 ms）、typecheck PASS；覆盖去重后配额补位、单主故事保留 **98 条**独立事实、有效分析 Impact Note、旧档缺少可信事件身份时明确未分类历史缺口，以及窗口端点/晚发现新进展。

历史来源另做两阶段 T1：D1 旧源有效，D2 用新源报道更新且借入 D1 的时间；重开后撤销 D1 源，公开读取 D1/D2 均 `not-found`；D3 仅凭仍有效新源继续产生更新，不输出受限旧时间并明确 `source-policy-withheld`。作者先取得 RED（236.2916 ms，Missing expected exception），再以 EventCluster 的 `historyPolicies` 记录借入元数据所依赖的来源 policy/version/hash，在读与新生产时重新核对传递依赖；不覆写已发表正文、不将历史原文发模型。以上仍为作者 WIP 结果，Root 未以此替代独立冻结验收。

Root 已要求冻结清单明确合法发布者声明的覆盖边界：不能因 event-aware 暂只接受 kind=fact 身份锚而无意缩窄 PRD D5 的正确归因声明；可确认“声明被发布”事件，但不得将声明内容升级事实。作者仍在核对这一边界、reader 事件关系一致性及实施判定表，尚未给最终提交、full check 或 review 结果。

### 声明组合与传递撤权的独立诊断

作者确认 fact-only 锚会缩窄原本允许的正确归因声明，已增加与 observed-event 分开的 publisher-statement 身份空间；锚定实际 publisherSourceId 与“发布声明”动作，声明内容继续保留归因而不是转为事实，未知发生时间不推造。混合报道中的已证事件与辅助声明区分处理。

Root 新增自有公开 T1 探针，仍位于 `accept-v1-06/data/root-v1-07-review`，对当时 WIP source 实际执行：

- `statement-composition-probe.ts` **3/3 PASS**（67.576 ms）：纯合法声明、已证事实 + 无单独事件注解的辅助声明、已证事实 + 有声明事件注解的辅助声明。均关闭 writer 后新 reader 读取，确认声明归因可读、观察事实仍在正确事件中、没有把所宣称结果升级事实。SHA-256 `7cb72d2f7376d773c33af65fcfc63a1c87653d34379091bfb9dc55e50e451d9a`。
- `transitive-policy-probe.ts` **1/1 PASS**（113.8449 ms）：五期、三来源；D1 来源 A 的时间经来源 B/C 的 D2/D3 借用；重开撤销 A/B 后 D1–D3 均拒读；D4 以有效 C 源发布独立新进展，受限旧时间不在新 Record/MD；再次重开 D5 对 D2 已报道事实仍以历史指纹抑制重复。SHA-256 `4ab0ba7dd52af9d65185c3391f76ee33855c1825b2aaaa3ffd3e6765980f1a9b`。

这些新测试与目录保留；加上原因果 3、注解保留 4，Root 当前有 **11 个独立专项场景**，另有 **3 份旧归档**。它们并非同一最终冻结的全量结果，正式验收时需全部对 fixed built 与集成基线复跑。#7 此时尚未冻结，不能因为 WIP 诊断通过而关票。

## 首次冻结与独立验收进行中

- 冻结实施 SHA：`63e93dc29f83ae3e0f010e2051dc2e162eaf8f1b`，commit `feat: persist evidence-bound event clusters and daily updates (#7)`。作者与 Root 均实际核对 branch `ticket/v1-07`、tracked/untracked clean；固定起点仍 `5da81976dd2ba166066977c038e6f46451890283`。
- Root 实际捕获 `git diff 5da81976dd2ba166066977c038e6f46451890283...HEAD`，非空 **12 files、+811/-17**（完整捕获 90126 chars）；包含 4 个事件模块、契约/Observer/Gate/renderer 接入、17 个新 T1 测试、实施判定表及两个纯领域词条。Root planning 状态文件不在实施提交内。
- 两个 fresh 独立 reviewer 均实际创建成功并并行：`/root/review_v1_07_standards`、`/root/review_v1_07_spec`。各自读取固定 diff/规范/PRD，不互换报告；结果尚待返回，不拿旧 #6 reviewer 结论代替。
- Root 新建 clean detached `O:/GenesisCode/Observer-worktrees/accept-v1-07`，同 SHA；`npm ci --ignore-scripts` 仅安装锁文件依赖（7 packages），未变更锁文件或全局环境；独立 build PASS。
- Root 对该 **fixed built** 实际运行自有专项：注解保留 **4/4**（161.5242 ms）、因果/同候选多事实 **3/3**（203.2257 ms）、声明组合 **3/3**（131.5409 ms）、五期传递撤权 **1/1**（168.3806 ms），合计 **11/11 PASS**。Record v1/v2/v3 三份旧 producer 归档 **3/3** 全 JSON、MD、版本哈希和私有读取边界不变。结束后 detached HEAD 未变且 clean。
- 作者冻结后的第一次 `npm run check` 仍在 session `27268`：typecheck/build 已通过；首项 Claude fixture setup 报既有 `No such image: observer-v1-05-claude:2.1.252`（503.4033 ms），整套尚未终态。已要求等待真实终态并保留失败，再仅只读核对、同 SHA 定向及完整复跑；不重建、重标签、重启 Docker，不拼接失败/重跑成首跑 PASS。

作者完整 check/smoke 终态、两轴 review、Root 完整 check/smoke 和实际 master 集成复验仍缺，当前不接受、不关票、不开始 #8；无真实 Provider/SMTP/部署操作，无 push。

## 首次冻结审查结论：63e93dc 不接受

作者 first full check 已实际结束：**146/147 PASS、1 FAIL**，0 skipped/cancelled，**184574.0204 ms**。唯一失败为 `tests/claude-runner.test.ts:40` 首个 fixture 的固定镜像 tag inspect（503.4033 ms）；不是事件业务失败。随后同 SHA 只读 tag 与 exact ID 都返回固定 `sha256:0fce00145d59010131a2efebdcac36dd66ef1c8b388830e275fcdc096d720269`，无环境/镜像改变；该单项重跑 **1/1 PASS**（2527.5009 ms）。首轮失败保留，根因仍未知，不算完整 PASS。由于本轮 review 已确认需改代码，Root 要求不再补跑被拒绝 SHA 的第二次 full/smoke；Root 此 SHA 也未运行完整 check/smoke，不以专项代替。

### Standards

独立 `/root/review_v1_07_standards` 完整读取 12 文件固定 diff，静态审查；**hard 1、heuristic 1，worst P2**。

- **P2 hard**：`src/observer.ts:284` 在完整关联校验前按 `old.version.publishedAtUtc` 过滤历史，`:286` 及 `historicalReport`（`:91`）未执行普通读取在 `:334` 已有的 `publishedAtUtc === publicationGate.checkedAtUtc` 关系。只损坏未包含在 Record/MD 摘要里的 Version 时间，便可丢弃既有报道或错误纳入历史。违反 `docs/implementation/v1-07.md:70` 的历史损坏失败关闭及因果窗口约束。需先完整验证版本/Record/Gate 关系，再做时间过滤，并复用相同核对。
- **P3 possible Duplicated Code**：`event-history.ts:14`、`event-integrity.ts:9`、`six-edition.ts:148` 重复展开单批/多批核验回执。可共享纯访问函数降低版本分支漂移；属非阻断维护判断，不是明确规范违反。

Root 另对同 **63e93dc built** 运行 `history-version-time-probe.ts`：**1 PASS / 2 RED**（120.631 ms，exit 1）。未损坏对照后期 0 故事；只将旧 Version 时间改到未来，竟再出版 1 条；改早也不拒绝损坏。两种损坏均应 `history-integrity-failed`。故障仅注入 Root 新建的 `version-time-run-*` SQLite（临时移除/恢复其更新触发器），原始对象由公开 reader 取得，业务断言仍公开 `produce/readReport`，没有用 SQL 观察业务结果。脚本 SHA-256 `25b18850cbd772b6232944c932134793eb3edd6bec1b15e226344a4ca8cb7c4d`，同其它 Root 证据保留于 `accept-v1-06/data/root-v1-07-review`。

### Spec

独立 `/root/review_v1_07_spec` 完整核对原票、PRD、固定 diff、SHA/clean/GitHub OPEN，**3 项，worst P1**。

- **P1**：任意旧 Record1/2/3 新闻令 `legacyHistory` 永久为真，随后所有 v3 新闻在身份判断前被拒绝（`observer.ts:285`、`event-history.ts:19`）。连续两期不同主体、今日首次披露事件均 0 故事，违反 PRD:272“新披露可入选”和票:19“独立新事实”回放。没有 Owner 授权永久全局停报；实现说明不能覆盖原需求。
- **P2**：同 Cluster 包含今日新事实和重大漏采旧事实时，`event-history.ts:96` 的 `eligible.some(inWindow)` 只把整组标成 new-disclosure；旧事实已刊登却没有任何补报标签。违反票:18 及 PRD:55 的显式补报要求。
- **P2**：后续新发现更早披露时，`event-history.ts:89` 无条件继承 `last.firstDisclosure`；当前 development 已记录 8 月 30 日披露，当前组首次披露仍显示 9 月 4 日。违反票:17 与 PRD:159–166；可更新当前元数据而不改旧刊。

Spec 自有 T1：`O:/GenesisCode/Observer-worktrees/v1-07/data/spec-v1-07-c9a641/probe.test.mjs`，真实 SQLite、外部 Runner/Verifier/时钟、公开 `produce → readReport`，**0/3 PASS、3 个业务 RED**（411.4376 ms）；旧刊重启后字节不变。Root 已完整阅读探针，断言与三项发现一致；未修改/清理其独立证据。该脚本原本绑定作者 source，后续复验须再次确认当时实际 SHA，不能把变化中的 WIP 误标为冻结结果。

### 整改与状态

两轴各自保留结论，不把维护建议混为 Spec 缺陷。当前 **4 项阻断**交回原 fresh implementation agent 逐片 TDD；P3 不要求扩大重构。此前 11/11 专项与旧档 3/3 不能遮蔽这些新发现；此 SHA 不接受、不集成、不关 #7、不开始 #8。

作者提出的 legacy 窄修正已获 Root 同意：取消全局永久停报，以带实际旧版本范围的 `legacy-unclassified` 审计/栏目缺口表达历史不确定性，当前通过证据规则的新披露/重大进展仍可选题，不把 previousCoverage=null 当成从未报道证明。若加本地精确重复否定约束，须同时匹配 Claim 类型/声明归因和可验证相同来源证据身份，不能仅以模板句文字哈希误杀独立事件；缺字段保持未知。不重写旧刊、不新增人工编辑或历史原文模型发送。

其余整改：完整版本关联校验先于因果过滤；对每条实际刊登的漏采事实标明补报；当前 firstDisclosure 取可分发历史与当前证据中的最早真实披露。修复后必须新提交、新 full check/smoke、两轴复审和 Root 独立验收，不能复用被拒绝候选的计数。

[GitHub 首轮不接受回写](https://github.com/yiwer/Observer/issues/7#issuecomment-5551655286)已发布并实际读回正文；#7 仍 OPEN、assignee=yiwer。仅状态与证据回写，没有 push 或生产操作。

## 第二冻结与复验：7fae122

作者已逐片修复四项阻断，并增加“同模板、静态 URL、相同正文 hash、不同发布/事件期次”的误杀反例；作者 RED→GREEN 和冻结前 59/59 文件回归记录在实施说明中，不替代以下新冻结结果。

- 固定实施 SHA：`7fae122cbe1d7abf1ebd12615091221abb6d7fda`；保留父提交 63e93dc，未 amend/rebase。Root 实际核对 author clean、base 可解析、两条 commit list，以及非空 `git diff 5da81976dd2ba166066977c038e6f46451890283...HEAD`：**13 files、+945/-25**，完整捕获 103398 chars；相对首候选增量 **8 files、+159/-33**。
- 同两位独立 reviewer 实际并行重新启动 Standards / Spec，各自对固定新 SHA 复审完整和增量差异、不交换另一轴结论；Spec 需复跑其既有 3 个业务 RED。当前结果尚待返回。
- Root 先确认自有 detached `accept-v1-07` clean，再切换该 SHA 并 build PASS；没有重建依赖、镜像或修改作者源码。
- Root 原脚本及预期未改，对 **7fae122 built**：注解保留 **4/4**（86.2372 ms）、因果/同候选多事实 **3/3**（135.3917 ms）、声明组合 **3/3**（88.8644 ms）、五期传递撤权 **1/1**（126.0677 ms）、版本时间完整性 **3/3**（120.8787 ms），合计 **14/14 PASS**。两种时间损坏均实际返回 `history-integrity-failed`，未损坏对照仍正确去重。之前 63e93dc 的 1 PASS / 2 RED 保留。
- 原 #5 producer 的 Record v1/v2 与 #6 producer 的 Record v3 **3/3** 兼容：新 built reader 读取，完整 JSON、原 Markdown 和哈希、身份/私有读取边界不变；没有用新实现重造旧档预期。
- 作者该 SHA 首次 full check 已实际终态 **151/152 PASS、1 FAIL**（133959.3282 ms），typecheck/build PASS；唯一失败为首个 Claude 固定 tag inspect `No such image`（194.1602 ms）。随后只读 tag 与 exact ID 均正确，无环境改变；同 SHA 定向该项 **1/1 PASS**（1872.4576 ms）、smoke **3/3 PASS**（1332.9856 ms）。首个 full 仍记 FAIL、根因未知；第二次 full 等待复审主要结论后再运行，不拼接为首跑通过。

Root 完整 check/smoke、双轴结论及实际 master 集成复验仍缺；当前不接受、不关闭 #7、不实施 #8，无 push、真实 Provider 或 SMTP 重发。

### 第二轮 Standards

独立 reviewer 已完成新 SHA 全量与增量静态复审，实际确认 clean。**hard 0、heuristic 1，worst P3**；原 P2 关闭：`archive-integrity.ts:13` 的 Version/Gate 时间一致性校验在 `observer.ts:283` 因果过滤前调用，历史查找 `:92` 和普通读取 `:337` 复用，符合实施说明:73。作者时间故障回归也已静态核对；本轴未执行测试，动态证据以上述 Root built 3/3 为准。

原非阻断 **possible Duplicated Code** 保留：`event-history.ts:23`、`event-integrity.ts:9` 与 `six-edition.ts:148` 分别展开单/多批回执。是未来结构漂移的维护判断，不是硬违规，不要求扩大重构。Spec 结论仍待独立返回，两轴不合并或重排。

### 第二轮 Spec

独立 reviewer 已完整核对票:15–20、PRD US11–14 / AC02–03 / D3 / D5、新 SHA 的完整差异和 8 文件增量，以及 clean / GitHub OPEN。**0 项，worst 无**；原全局停报、混合事实补报、首次披露更新三项均关闭，未发现新的缺失、错误实现或范围扩张。

其自有 `data/spec-v1-07-c9a641/probe.test.mjs` 原三例在新 SHA **3/3 PASS**；追加静态页面不同发布时间/期次、完全相同旧事实抑制、旧发布时间未知三个正反例后，同一公开 T1 套件 **6/6 PASS**（315.6102 ms）。真实 SQLite、外部 Runner/Verifier/时钟、重启后旧刊字节不变、实际旧版本 ID 和未分类状态均有断言。Root 已完整阅读修订后的脚本；未修改作者源码/测试，也未把作者 full 结果算作本轴证据。本地标注替身不证明真实模型或生产质量。

两个轴的原阻断已关闭；Root 已通知作者在不修改 SHA/环境的前提下运行第二次完整 check，随后才做 Root 独立完整验收与 master 集成。此前失败仍保留，不提前宣告最终通过。

### 同 SHA 完整复跑

作者第二次 `npm run check` 已自然结束 exit 0：typecheck/build PASS，**152/152 PASS**，0 fail/skip/cancel，**123586.1916 ms**；结束后仍为 7fae122 且 clean，无源码/文档/环境变化，未重复已有 smoke 3/3。第一次 151/152 的失败仍是独立结果，不改写为首跑通过。Root 随后确认自己的 detached 同 SHA clean，启动独立完整 check；尚未终态。

第二轮 Spec 六例脚本 SHA-256 为 `d591fd6d87351fd4218dccf7d977b5b1438b7d5ad18fbcb8113dcae9584728e6`；Root 实际读回并计算，不与原三例失败时的脚本版本混淆。

### Root 独立冻结验收通过

Root clean detached `7fae122` 的首次完整 `npm run check` 自然结束 exit 0：typecheck/build PASS，**152/152 PASS**、0 fail/skip/cancel，**151077.6439 ms**。随后同 SHA `npm run smoke` **3/3 PASS**（1404.4045 ms），它是完整检查的子集，不相加制造额外覆盖。结束后 HEAD 未变且工作区 clean；按两个固定镜像 ID 只读检查，均无运行中容器残留。

结合 Root built 专项 **14/14**、旧 producer 归档 **3/3**、独立 Spec **6/6** 与两轴原阻断关闭，允许候选进入本地集成。唯一保留的 Standards P3 是非阻断回执展开重复；不增加无关重构。尚需实际 master 合并提交上的 full/smoke/专项/旧档复验后才能关闭 #7；代码未 push、生产未启用，真实 Provider/来源/人工质量资格未验证。
