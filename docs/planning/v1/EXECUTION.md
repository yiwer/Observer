# V1 orchestrator 执行记录

Owner 已授权：按 ticket 顺序逐个派发 fresh-context subagent，使用 implement skill 实现并提交，由 orchestrator review、验收和集成。此授权不包含资源购买、未经批准的真实付费调用、正式投递或自动跳过人工验收。

最新补充授权见 [Owner 运行输入](OWNER-INPUTS.md)：本机 Codex 真实测试已批准且不设额度上限；Claude 真实环境由 Owner 后续提供、当前跳过但保留未验证；邮件选择 QQ SMTP 授权码、发件收件同一邮箱（具体地址只保存在 ignored 本地配置）。本机地区资格尚待信息，未进行真实模型调用。Owner 已授权读取用户级 `QQ_SMTP_KEY` 并测试；[单封 SMTP 预检](acceptance/qq-smtp-preflight-2026-09-05.md)实际 TLS 1.3、AUTH 235、DATA 250，**2026-09-06 Owner 已确认实际收件与中文显示正常**，未重发；不代表产品投递器或每日发送已启用。

## 接续规则

1. 从当前 Git 和 GitHub 实际状态恢复，不从聊天摘要猜测完成。
2. 每次只推进一张实施票；固定 worktree、起始提交和验收范围，再派发 subagent。
3. 采用已确认 PRD T1 seam 做 TDD；定期 typecheck、针对性测试，票末运行完整测试。
4. implement 的 code-review 使用 Standards / Spec 两轴独立审查；orchestrator 另做结果核对和集成基线验收。未解决阻断发现不算完成。
5. 票通过后集成提交、记录证据，再关闭 Issue 并推进下一张；外部门槛单独记录，不把开发测试替代实测。
6. 提交代码不等于 push。当前 GitHub 票已发布，代码是否推送由实际 Git 状态说明。

## 当前停止点

- 2026-09-08最新：#13最终候选 **24c38a11d45f949c48e856d015c5b91908ee7d11** 已接受并本地集成至 **c987c6aa11e267327b47c37f0d465d5c8ea9edfc**。作者、Root干净detached、实际master完整check各403/403，smoke各3/3；Root两种built各26项#13专项、Record9五刊、20项#12/13项#11/29既有调用/Record7两刊与Record8四刊/Spec9组/参数回放通过；同候选原LF工作树的独立bank与metadata容量门2/2通过。Standards 0硬违规/原2非阻断P3，Spec 0开放阻断。完整证据及CRLF前置失败保留见[#13最终验收](acceptance/13-github-repromotion-events.md#最终候选与实际-master-验收)。允许回写关闭#13后推进#14；代码未push、真实外部门槛不变。下列#13旧候选/整改条目为历史过程，以本条和最新验收记录为准。

- 当前实施票：#13 GitHub重大进展一次性重新入榜，base **ec9b91c3e8575f7f3f3dc363d1d35ffb6319fce3**，专属`Observer-worktrees/v1-13` / `ticket/v1-13`。首个候选 **2a125fe9c73504f06b17b171ceb2cd3f1367334c** 已提交；作者完整check 402/402、smoke 3/3，Root固定候选bank/metadata行数独立容量门均通过。首轮正式双轴审查：Standards 0硬违规/2非阻断P3；Spec 1项P1——同node超过3条合法GHSA可能使动量witness strict解析抛错并回滚整次观察，而非按约定整witness unavailable并保留真实origin。作者正在公开接口复现/修复；候选尚未接受、未集成，#13实时仍OPEN，不能推进#14。原全量Docker失败与全部旧候选/探针原档保留。详细切片、完整证据与后续进展见[#13记录](acceptance/13-github-repromotion-events.md)，不把局部PASS当整票通过。
- 2026-09-07因Owner询问再次实时核对：GitHub #1–#12全部CLOSED、#13–#28仍OPEN，没有漏关已验收票。Owner插入的[Sandcastle＋Docker研究](../../research/sandcastle-docker-agent-sandbox-2026-09-07.md)已完成并交付，Root亲读全文并独核上游SHA/发布及核心Docker源码后作为独立研究文档本地提交；不采纳为V1依赖、不改变Runner/PRD/ADR/tickets，也没有安装/执行外部代码。当前主线仍为#13。
- 已完成票：#1–#12，均完成实施、双轴 review、独立冻结验收及本地 master 集成，GitHub 已读回 CLOSED。
- 最新验收：#10，**合规社交样本到话语观察Edition**。实施 **853be14fa9275fb7d99be19524014963a6857ef4**，本地集成 **0210cf1a0faa2fbc857d25948ca1860119abad1e**。作者/Root detached/actual-master完整check各222/222、smoke各3/3；Standards0hard/1非阻断P3、Spec0；Root两种built各29份固定检查调用及新增Record7两份历史读取通过。首次master Docker标签查询失败整次保留，原标签恢复后新目录完整重跑，不拼接PASS。全部证据统一见[#10记录](acceptance/10-social-discourse-edition.md#实际-master-验收与关闭)。[GitHub验收回写](https://github.com/yiwer/Observer/issues/10#issuecomment-5555910060)已实际读回，#10 CLOSED（2026-09-06T00:53:44Z）。代码未push，真实社交源仍未批准。
- 最新验收：#11 GitHub候选/稳定身份/真实快照增量。最终实施 **14f6889a207db393a96bb0fff7f4ba7867e6714d**，实际master集成 **867e500431886e1d876066c950f3a880b38f81f8**；作者/Root detached/实际master完整check各282/282、smoke各3/3，Root两种built各29次既有调用、Record7两份、独立13项与新Record8四份字节回放通过。Standards0hard/2非阻断P3、Spec0，首轮两P2原期待复现后已关闭；原拒收与Docker整次失败均保留。[最终GitHub回写](https://github.com/yiwer/Observer/issues/11#issuecomment-5556354464)已读回，#11 CLOSED（2026-09-06T02:28:54Z）。统一证据见[#11记录](acceptance/11-github-snapshot-observations.md#实际-master-验收与关闭)。代码未push、真实来源/生产未启用。
- 最新验收：#12 Observer GitHub Heat与历史报道降权。最终实施 **41020f40a424d00b868085822796cdee32b6599d**、实际master集成 **2d93d40a463af7fd64485383dca32ff92a64ebb0**；作者/Root detached/实际master完整check各306/306、smoke各3/3，Root两种built各20新专项/13旧GitHub专项/29既有调用/旧Record7两刊与Record8四刊/Spec9组/完整参数回放通过，新增Record9五刊读取基准已冻结并在master验证。Standards0hard/原2非阻断P3；Spec0，首轮选择Gap P2原期待闭合。统一见[#12记录](acceptance/12-github-heat-and-novelty.md#实际master验收与关闭)；[回写](https://github.com/yiwer/Observer/issues/12#issuecomment-5556767744)已实际读回，#12 CLOSED（2026-09-06T04:00:51Z）。代码未push/生产未启用。下一frontier #13原生唯一依赖#12已实读closed，准备fresh作者；以下为历史过程。
- 最新验收：#9，**高风险新闻与AI/科技证据标签**。实施 **57e9686a14003055f6c9e51483cd7e0cd4393663**，本地集成 **ca7377a5d7e5cc42a4a8970b61d8cab3c835eaed**；作者/Root detached/actual-master全检各**186/186**、smoke各3/3。Standards0hard/2非阻断P3，Spec0。Root两种构建的公司1/1、兴趣6/6、事件14/14、Spec3/3、旧Record1–5六份及新Record6三份读取通过；master12份回放正文已核对。[GitHub回写](https://github.com/yiwer/Observer/issues/9#issuecomment-5555131833)已读回，#9 CLOSED（2026-09-05T22:12:21Z）。下游#10原生唯一依赖#7已实际确认CLOSED。见[#9记录](acceptance/09-domain-evidence-rules.md#实际-master-验收与关闭)。
- #9 前期 Root 公司独立性探针0/1 RED已窄修并保持固定期待回归；六源[独立审查](../../research/v1-09-source-proposal-review-2026-09-06.md)促成OCHA/NASA/Eurostat提案补正，全部来源仍pending/false。Root没有启动/重启Docker；中断时留下的两只旧exited容器只读确认并保留。单封SMTP收件/中文显示已由Owner确认，未重发；代码未push，最近实际远端master仍 `e475bc18620d1d052f6effcb648fbc4ec66150d2`、无远端ticket/v1-09。以下#8/#7等条目是此前过程，不代表当前frontier。
- 最新验收：#8 最终实施 **06fc8b33b4bbb3f063d865f53dfe8086599c7e13**、本地集成 **8079271c3cc2911257f5a54153b3ec16969c6b67**。作者/Root detached/实际master全检各 **167/167**、smoke各 **3/3**，Root冻结/集成本票专项各6/6、事件各14/14、旧归档各5/5；Standards 0 hard / 2非阻断P3，Spec0，原P2关闭。首次c0a4522失败保留。[GitHub验收回写](https://github.com/yiwer/Observer/issues/8#issuecomment-5551977141)已读回，#8 CLOSED（2026-09-05T12:58:25Z）。下一票#9的原生依赖#6已实际验证closed，待fresh实施；代码未push，生产未启用。见 [#8记录](acceptance/08-explicit-interest-and-global-coverage.md)。以下#7/#6等停止点为历史过程，非当前待验收。
- 最新验收：#7 最终实施 **7fae122cbe1d7abf1ebd12615091221abb6d7fda**，本地集成 **8e02377a60544c7dd7cfb3e759bc02d5d45fb760**。作者、Root detached、实际 master 完整检查均 **152/152**、smoke各 **3/3**；Root frozen/master 专项各 **14/14**、旧Record1/2/3各 **3/3**。Standards0 hard/1非阻断P3、Spec0且独立6/6；原四项阻断已关闭，失败历史保留。[GitHub验收回写](https://github.com/yiwer/Observer/issues/7#issuecomment-5551782570)已读回，#7 CLOSED（2026-09-05T12:21:57Z）。#8 dependency 已验证 #7 closed，下一步 fresh 实施 #8。以下 #7/#6 条目为历史过程，不是仍待验收；#5–#7代码未push，生产未启用。
- 当前实施票：#7；原生依赖 #6 已 CLOSED。fresh-context `/root/implement_v1_07`、worktree `O:/GenesisCode/Observer-worktrees/v1-07`、branch `ticket/v1-07`、fixed base `5da81976dd2ba166066977c038e6f46451890283`。第二冻结 **7fae122cbe1d7abf1ebd12615091221abb6d7fda**（13 files、+945/-25）已通过独立冻结验收：作者第二次与 Root 首次 full 各 **152/152**、smoke 各 **3/3**；Root built 专项 **14/14**、旧档 **3/3**。Standards 0 hard / 原 1 非阻断 P3；Spec 0、自有6/6，原四项阻断全部关闭。作者首次151/152与旧候选63e93dc的失败记录保留于 [#7验收记录](acceptance/07-event-history-and-updates.md)。当前允许本地集成，尚待实际 master 复验；#7未关闭，#8未开始，未push。以下 #6 条目为历史过程，#6当前已接受集成并CLOSED，以其[验收记录](acceptance/06-six-edition-canonical-brief.md)为准。
- #6 首次冻结 `ac55dc418425d02030441156bf9eef9224873f1c`，8 files、+682/-40；作者第二轮和 Root 独立 check 均 120/120、smoke 各 3/3，旧 Record v1/v2 built-reader 兼容 2/2；作者首轮 119/120 的 Docker tag 查询失败另行保留。Standards 0 hard / 1 非阻断 P3；Spec **2 P2 阻断**（六栏总 Claims 超 500 全体误拒、局部重复身份污染正常五栏），Root 自有磁盘 SQLite / built-reader 专项 **1 PASS / 4 RED** 复现。已交原 implement agent 窄范围 TDD 修复，当前候选不接受、不集成、不启动 #7；详见验收记录。
- #6 最新冻结 **73c95da371e710a59a2658c8e82073dbcf6eb44c**，10 files、+918/-48。作者与 Root 完整 check 各 **125/125**、smoke 各 **3/3**，Root 边界专项 **9/9**、旧归档 **2/2**；旧容量/重复身份及新增长 taskId 问题已修复。Standards 0 hard / 原 1 P3；独立 Spec 仍有 **1 P2**：已识别单栏的局部任务/Bundle/配置/运行时间或资格错误仍直接中止整期，丢失五栏有效内容。Root 专项 3 PASS / 6 RED、Spec 专项 6 PASS / 3 RED，已交原作者继续 TDD；本候选不接受、不集成。前条为历史过程，以本条及验收记录最新结论为准。
- #6 最终冻结 **af18a4b6276f3c5254474c1e676e5e88b2eaaa07** 已通过独立冻结验收：作者/Root check 各 **130/130**、smoke 各 **3/3**；Root 自有 built 专项 **18/18**、旧归档 **2/2**。最终 Standards 0 hard / 原 1 P3；Spec **0**、原所有阻断已关闭，自有专项9/9。以上两轮为历史过程。当前只接受进入本地集成，尚待 master 集成复跑，#6 未关、#7 未开始、未 push。
- #5 已验收：最终实施 `177cfbbddf08e507c448e76dbe23ebc31a2ef617`、本地集成 `ed2f705f8381a2f8543e48f21266affe252b9ea4`；[关闭回写](https://github.com/yiwer/Observer/issues/5#issuecomment-5551208771)实际读回 CLOSED。以下 #5 冻结/整改条目为历史过程，当前状态以本条与 [验收记录](acceptance/05-claude-runner.md) 为准；不得把此前 P2 或待验收状态当作仍然开放。
- #5 首个冻结候选 `0b967c6273b2d768f46df4ce8b546508a0d41784`（26 files，+1023/-57）；作者 check 94/94、smoke 3/3，工作树干净。Root 已固定非空三点 diff，派发 fresh Standards / Spec 两轴，在 detached `O:/GenesisCode/Observer-worktrees/accept-v1-05` 独立复跑；未出最终验收结论，不启动 #6 实施。
- #5 首轮结果：Root 冻结 check 94/94、smoke 3/3，但 Standards 2 项 P3 非阻断维护建议、Spec 2 项 P2 阻断（SSE 未完整终帧仍出版；合法多次 message_delta 误拒/丢量）；Root 自有公开 seam 专项 3 RED 重现，已交原 implement agent 修复，旧候选不得集成。新 SHA / 全量检查 / 两轴复审 / Root 验收尚待完成。
- #5 第二个冻结候选 `de63459f3f496374cde58eca8c250c25e01354de`：作者 check 101/101、smoke 3/3；Root detached 独立 check 101/101（128.522 秒）、smoke 3/3（1.315 秒）。Standards 硬违反 0、原 2 项 P3；Spec 关闭原 2 P2，但新增“首次输出用量更新之前截流，未知输出误记为 0”P2。Root 自有专项 3 PASS / 1 RED（5.225 秒）复现。仍不得集成或开始 #6；原作者会话已不在 live inventory，已派发 fresh-context `/root/implement_v1_05_usage_fix` 在原分支作窄范围 TDD 修复，下一冻结后重验。
- #5 最新冻结为 `177cfbbddf08e507c448e76dbe23ebc31a2ef617`：修复 agent 完成 RED→GREEN、3 项新增回归、最终 SHA check 104/104 / smoke 3/3。Root 独立 detached 同 SHA check **104/104**（123.195 秒）、smoke **3/3**（1.293 秒）、自有专项 **4/4**（5.193 秒），clean、无任务容器残留。最终 Standards 硬违反 0 / 原 2 P3；独立 Spec 0、专属 T1 探针 7/7，原 3 项 P2 均关闭。冻结验收通过，待本地集成及集成基线复跑后再关闭票。
- #4 最终实施 `139dc1388cb01d68df12554f85003ac41bbd20b8`，固定起点 `320ab620a2d3f22c09e13334a68f06a3b664af05`；worktree `O:/GenesisCode/Observer-worktrees/v1-04`，分支 `ticket/v1-04`，干净；[验收回写](https://github.com/yiwer/Observer/issues/4#issuecomment-5550565579)已读回 CLOSED。
- #4 首轮 Spec 用量丢失 P2 已修复并复审关闭。最终 Standards 1 项 P3 非阻断重复解帧建议、硬违反 0；Spec 0。Root 独立冻结和集成均 check **74/74**、smoke **3/3**（旧子集），额外公开 seam 专项 **3/3**；详见 [V1-04 记录](acceptance/04-codex-runner.md)。CLI + 模型协议替身不代表真实模型或生产资格。
- 并行只读预检 `/root/research_v1_05_preflight` 已完成 [Claude 增量研究](../../research/claude-cli-preflight-2026-09-05.md)；Root 独立复跑帮助/版本确认本机仍为 2.1.252。`permission-prompts` 版本差异及 `subtype=success` 仍可能 `is_error=true` 已记录；预检时未实施/触发模型/升级，现已交给 #5 fresh 实施 agent，仍须实测目标 Linux CLI 和完整隔离契约。
- #3 最终实施提交：67401aca6bcc0cd943f0b3fb9257ac7e7288f214；worktree：`O:/GenesisCode/Observer-worktrees/v1-03`；分支：`ticket/v1-03`；[验收回写](https://github.com/yiwer/Observer/issues/3#issuecomment-5550293271)。
- 最新已验收产品集成提交：**867e500431886e1d876066c950f3a880b38f81f8**（#11）；#12仍在独立worktree逐片实施，局部Interface已协调，参数回放及最终冻结审查尚未完成。开发期独立7项历史及10项时间/频率检查通过，均非固定提交验收，详见[#12记录](acceptance/12-github-heat-and-novelty.md)。以上早期过程中的“最新/当前”是当时状态，不覆盖本条与顶部frontier。
- 2026-09-05 17:59:25 +08:00 后读到 `origin/master` 与 `git ls-remote` 均为 `e475bc18620d1d052f6effcb648fbc4ec66150d2`；已确认 #1–#4 实施和集成提交都可从该远端提交到达。该 push 不是本次 orchestrator 执行；#5 候选仍未集成、未推送（远端无 ticket/v1-05）。远端代码存在不代表生产部署或模型资格通过。Root 新出现未跟踪 `.idea/`，保留不纳入任务提交。
- #3 首轮测试虽通过，但两轴及 Root 额外发现阻断；最终重新冻结、复审关闭全部发现，再集成验收。Root 在最终工作区及 master 均复跑 check 52/52、smoke 3/3；smoke 属于总测试子集。详见 [V1-03 验收记录](acceptance/03-evidence-publication-gate.md)。

## 已验收

- [V1-01 验收记录](acceptance/01-private-brief-spine.md)：实施 35c647c，集成 1798613；orchestrator 在固定工作区和集成基线均复跑 typecheck/build、13/13 测试及 2/2 smoke。Standards 有 1 项非阻塞建议，Spec 无发现。
- [V1-02 验收记录](acceptance/02-policy-bound-collection.md)：最终实施 2931098，集成 7fdef67；orchestrator 在固定工作区和集成基线均复跑 typecheck/build、32/32 测试及 3/3 smoke。两轴原 3 项阻断和 root 删除准入发现均修复；余 1 项非阻塞维护建议。
- [V1-03 验收记录](acceptance/03-evidence-publication-gate.md)：最终实施 67401ac，集成 a83cf2a；orchestrator 冻结和集成各复跑 typecheck/build、52/52 与 3/3 smoke；Standards、Spec 最终各 0 项；Root 矛盾回执及 24 场景 TTL 回归通过。只有标注语义替身证据。
- [V1-04 验收记录](acceptance/04-codex-runner.md)：最终实施 139dc13，集成 f59bcad；冻结和集成各 check 74/74、smoke 3/3；Root 首次发送 TTL 与拒绝用量专项 3/3。Standards 留 1 项非阻断 P3，Spec 原 P2 关闭、最终 0。真实 CLI + 无凭证模型替身，不是模型/地区/生产资格。
- [V1-05 验收记录](acceptance/05-claude-runner.md)：最终实施 177cfbb，集成 ed2f705；Root 冻结和集成各 check **104/104**、smoke **3/3**，自有专项 **4/4**，独立 Spec 专项 **7/7**。Standards 硬违反 0、2 项非阻断 P3；Spec 原 3 P2 全关闭、最终 0。固定 Linux Claude 2.1.252 CLI 与无凭证模型替身；后查宿主已 2.1.261，不混作同一资格。#5 代码未 push。
- [V1-06 验收记录](acceptance/06-six-edition-canonical-brief.md)：最终实施 af18a4b，集成 d24c052；Root 冻结/集成各 check **130/130**、smoke **3/3**、自有 built 专项 **18/18**、旧归档兼容 **2/2**。最终 Standards 0 hard / 1 非阻断 P3，Spec 0；所有容量/身份/局部失败阻断均关闭。#6 已 CLOSED，#5/#6 代码未 push；最新远端仍 e475bc1。仅本地标注替身与旧 CLI 协议回归资格，生产仍禁用。

## 协作容量

#8 的 fresh implementation、独立 Standards/Spec 两轴及同reviewer第二轮并行复审均实际启动成功，最终接受并CLOSED。#9仍须新的实施上下文，不复用旧票作者或reviewer。

#2 的第二个 reviewer spawn 曾返回 `collab spawn failed: agent thread limit reached`。Standards 使用独立新 reviewer，Spec 复用未参与 #2 实施的 #1 agent，两轴没有互换报告内容。后续实施仍要求 fresh context；若平台无法释放线程，不得把旧实施上下文冒充 fresh context，需核实容量或请求 Owner 调整会话。

#3 的 fresh implementation 和两个 fresh reviewer 均实际启动成功；不要把 #2 的历史错误当作当前容量阻断。

#5 最终 `177cfbb` 的新 Spec spawn 再次实际返回 `agent thread limit reached`；复用未参与 #5 实施的 #4 agent 进行独立 Spec，重新读全票，不与 Standards 交换报告。Standards 已先结束，因此此次两轴未能在时间上重叠，不能伪称并行成功；审查独立性仍保持。#6 实施仍必须新上下文，不得把 reviewer 会话直接改称 fresh implementation。

随后 #6 的 `/root/implement_v1_06` fresh spawn 已实际成功，旧容量问题不再阻断当前实施；该 agent 未继承旧票对话上下文。

## 外部就绪项

### 保留的测试证据与禁止重试清理边界

以下精确路径的清理曾被自动策略拒绝，后续 agent 不触碰、不换工具或重跑 cleanup 绕过；它们是虚构测试证据，不是当前开发阻断：

- `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`。
- `O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c`。
- `C:/Users/16348/AppData/Local/Temp/observer-six-ip5kK3`（#6 harness 关闭顺序 EBUSY 后新增，新的测试必须使用自己新建的独立目录）。

Root 的历史兼容样本及其他 reviewer 证据归各自所有，不得顺带删除。仅按不可变身份/精确句柄收尾本轮自己的进程和容器，不进行全局 prune。

### 外部资格状态

V1-26 起的真实环境、Provider 资格/凭证、来源许可、费用、收件人与备份资源逐项结合最新 Owner 输入判断；Codex 本机调用费用已授权，Claude 外部测试已明确延期，QQ 授权码已在本机用户级环境可用且单封 SMTP 受理成功，Owner 已确认该封收件和中文显示；产品日报/PDF/附件及目标部署投递仍按后续票验收，其余未获授权部分仍不得擅自执行。V1-28 需要连续 14 天真实记录及规定比例的人工事实核查。没有这些证据时不得宣布 V1 生产通过。

## 下一票只读预检

2026-09-05，orchestrator 在等待 #3 时执行了本机 `codex --version`、根/exec/sandbox/features 帮助命令及无调用参数解析检查。当前二进制为 `C:/Users/16348/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe`，版本 **codex-cli 0.153.4**，已不同于历史研究的 0.151.0。`--search -a never` 放在 `exec` 前可通过帮助解析，`exec --ask-for-approval never --help` 仍被拒绝。没有读取凭证、修改配置或发起模型请求。

#4 实施时必须重验实际二进制与完整终态契约，不得从历史版本或帮助解析推定认证、费用、事实质量、OS 隔离或进程树清理已经合格。预检已重新打开官方[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)、[安全边界](https://learn.chatgpt.com/docs/agent-approvals-security)和[配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)；这些文档与本机帮助仅作后续测试依据，不是实际拒绝边界的测试证据。预检时未开始实施，现已按上述固定基线派发。

本机有 Docker CLI、WSL CLI，但 `wsl --list --quiet` 只列 docker-desktop；读取 Docker Server 版本时 Linux Engine named pipe 不存在，不能视为容器运行环境已就绪。此次只读预检没有启动虚拟机/容器、安装组件或修改配置。

随后 #4 实施 agent 明确需要 Linux 隔离测试，root 启动已有 Docker Desktop 并读取运行库存：Engine 29.6.1、Linux amd64；已有 10 个其他项目容器仍全部 exited，未修改或删除。已交付固定 Python 镜像身份供无模型协议/权限探测使用。详见 [V1-04 执行与待验收记录](acceptance/04-codex-runner.md)；环境启动不等于安全边界或实际 Codex 接入通过。
