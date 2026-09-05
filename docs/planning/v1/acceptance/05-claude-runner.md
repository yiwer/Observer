# V1-05 审查与验收记录

状态：**首轮未通过，整改中，尚未验收**。GitHub #5 OPEN，assignee=yiwer；首个候选 `0b967c6273b2d768f46df4ce8b546508a0d41784` 的完整测试通过，但独立 Spec 审查与 Root 专项复现发现 2 项 P2 阻断，已交回原 implement agent 修复。不得集成旧候选或启动 #6 实施。

- 范围：[GitHub #5](https://github.com/yiwer/Observer/issues/5)、[本地票](../tickets/05-claude-runner.md)。
- 固定 base：`8e35d12470c14f2638d3adbcd1901935feeaa593`；branch `ticket/v1-05`；worktree `O:/GenesisCode/Observer-worktrees/v1-05`。
- Fresh-context agent：`/root/implement_v1_05`，已要求亲读 implement / TDD 与仓库规范，遵守 PRD T1 公开 produce → readReport seam。
- 唯一 native dependency #3 已实际读回 CLOSED；顺序前票 #4 也已验收集成并关闭。[启动回写](https://github.com/yiwer/Observer/issues/5#issuecomment-5550574214)已读回 OPEN。

## 实施与验收边界

只做一个 Claude 适配器，不做 Provider 仲裁或部署。共享 AgentRunner 和 Publication Gate 契约，供应商事件留在适配器内部。须保留正常协议进程 → 候选 → Gate → SQLite/正文链路，不以全部禁用或仅解析 JSON 替代实现；不要求 Claude 与 Codex 文本一致。

此前 [Claude 增量预检](../../../research/claude-cli-preflight-2026-09-05.md) 只观察 Windows CLI 2.1.252 帮助和官方资料，不证明 Linux 二进制、参数组合、协议或权限实际通过。实施时须固定目标 CLI/模型及完整性，独立校验 exit、result、is_error/拒绝/取消、终态与 final schema，处理真实版本允许的末尾事件。

当前固定基线有 74 个产品测试；smoke 的 3 个是旧子集。修改共有模块须维持 Codex / 来源政策 / Gate / 归档不变量。模型每次发送前检查可信 Bundle TTL；可取得用量有来源，缺失未知，不重复相加。真正权限拒绝、无原文日志、超时/取消下整任务树回收必须观察，不能靠提示词或帮助标志声明。

Root 已交付本机现有 Docker 测试环境与固定 Python/Codex 镜像身份（详见 [#4 验收](04-codex-runner.md)），不授权修改其他项目容器、网络或卷。新下载/构建仅限经完整性校验的固定官方依赖，不升级宿主 CLI 或读取保存认证。旧目录 `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ` 曾被策略拒绝清理，须保持不触碰、不换工具绕过。

作者 provisional commit 后冻结写入；Root 固定非空三点 diff、独立 Standards / Spec 两轴审查、detached 复跑及集成复跑，未关闭阻断发现不得验收。

## 固定依赖与 Root 预检（未冻结）

实施 agent 正准备真实 Claude 2.1.252 Linux CLI → 无凭证 Messages 替身 → Gate → SQLite 的首条正常路径；准备脚本及初始测试尚未冻结。没有模型调用资格结论。

Root 独立打开官方[签名核验说明](https://code.claude.com/docs/en/setup#binary-integrity-and-code-signing)，确认受信指纹 `31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE` 与先验证 manifest、再比对二进制 SHA-256 的校验链。Web 工具读取版本 manifest 一度返回 Internal Error，未把观察失败当作下载失败；随后读取 agent 实际已下载的公开文件并独立核验：

- 官方版本 manifest：`https://downloads.claude.ai/claude-code-releases/2.1.252/manifest.json`，版本 2.1.252，commit `c0778c45886d8f1ed8bd5e7c972b8507d299a548`，buildDate `2026-08-31T16:11:11Z`。
- Linux-x64 二进制实际 **214371672 bytes**，Root `Get-FileHash` SHA-256 为 `a715a45105e593fc9808d035d77781f88480b9897975a9df41837f0c591bd4b3`，与该签名 manifest 一致。
- Root 使用已有 `E:/facility/Git/usr/bin/gpg.exe`，独立 ignored keyring `O:/GenesisCode/Observer/data/claude-root-verification-59bece1f867e481dbf86418cb21c9ba8`，`--no-options --batch --no-auto-key-retrieve`；实际 verify 返回 `VALIDSIG 31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE`，没有读取个人 keyring 或认证。
- 发现 Git 的 MSYS GPG 将直接传入的 Windows homedir 错解成 cwd 相对路径；改传已存在目录对应的 `/o/GenesisCode/...` 后成功。此前是路径语法错误，不是执行策略拒绝。已交作者按实际 GPG 实现处理路径，不把所有 Windows GPG 当成同一种。未改 agent 的包或 keyring。
- 此次最后的镜像 inspect 为 `No such image: observer-v1-05-claude:2.1.252`，只说明当时尚未构建；签名/hash 已分别成功，不把整条 shell 的末尾 exit 1 误报为签名失败。准备工具 session 由创建它的 agent 核实，不凭观察超时重启。

Root 另查官方[结构化输出说明](https://code.claude.com/docs/en/agent-sdk/structured-outputs)：SDK 校验 draft-07，应显式处理 Zod 默认 draft-2020-12 差异；subtype success 但没有 structured_output 仍不能视作结构成功，先前完成输出也可能被 fallback 撤回。已提示作者用目标 CLI 验证这些契约，不能仅沿用 Codex Schema/事件规则。这些是实现前提，不是实际拒绝测试的通过结论。

## 首条实际 CLI 路径（阶段证据）

作者随后将 GPG 改为相对工作目录参数，报告准备脚本通过，镜像固定为 `sha256:0fce00145d59010131a2efebdcac36dd66ef1c8b388830e275fcdc096d720269`（tag `observer-v1-05-claude:2.1.252`）。Root 独立 inspect 确认 Linux/amd64、338723300 bytes；另创建独有 name/label、network none、非 root、只读根、cap-drop ALL、log-driver none、空环境的一次性版本探针，实际 `/opt/claude --version` 输出 **2.1.252 (Claude Code)**、exit 0，按本次 label 读回自动移除。这只核实固定运行依赖，不是 Root 完整业务验收。

作者报告首条实际 CLI → 自有无凭证 Messages SSE → StructuredOutput → Gate → SQLite 正文定向 **1/1** 通过。实际观察到 `init.tools` 只有 `StructuredOutput`，它是结构候选的数据工具，不能和 Bash/Edit/MCP 执行能力混为一谈；宿主固定其 draft-07 schema 并前置检查工具响应。另发现 CLI 默认会创建 `/tmp/claude-65534`，只读根导致 EROFS；设置任务私有 tmpfs 的 `TMPDIR=/run/observer` 后正常。仍须验证恶意内容不会通过这条数据路径变成执行。

当前作者正按后续 red→green 收紧终态和拒绝矩阵，没有冻结 SHA。隔离生命周期从 codex-container/worker 提取为 agent-container/worker；新旧 CLI 的协议分别处理，共享变更必须完整回归原 Codex 74 项证据。当前 1/1 不扩写为全部 AC、安全、真实模型或生产通过。

后续作者报告的实际 red→green：`stop_reason=refusal` 且退出 0 曾误出版，联合唯一 result/init/session/StructuredOutput 完成状态后拒绝；恶意 Bash 响应已有用量却是 null，现保留 Messages 12/21/cached 2 且不出版；第二次发送前 TTL 曾未阻断，现依可信快照拒绝过期发送。该阶段 **4/4** 通过；共享重命名后旧 Codex 适配器文件 **22/22** 通过（60.638 秒）。当前扩展协议失败/整树/OS 拒绝检查在作者 session 59932，未冻结，Root 尚未独立复跑这些新增用例。最终需旧 74 + 新测试完整运行，不把分阶段计数叠加冒充最终总数。

## 继续实施与环境观察（未冻结）

作者后来读回扩展 Claude 测试 **16/16**（56.906 秒）、恶意工具/坏用量/logging/API 失败定向 **4/4**（17.412 秒）；完整 `check` session 84756 为 **93/93**（74.419 秒）。这些是作者在新增嵌套输入检查之前的阶段证据，尚无冻结 SHA，不能作为后续源码版本或 Root 独立验收的通过结论。原 session 59932 的 8/9 中，唯一失败是 `docker top -eo args` 缺少 PID 列；改成 `-eo pid,args` 后实际看到两个协议进程及整树回收。重复 Messages `message_stop` 曾误出版，完整流状态校验后定向通过。

实施 agent 一度因用量限制退出；Owner 明确“继续”后恢复原 agent / 原工作树，没有清理或重写未提交代码。恢复后正补充模型请求中嵌套远程图片/文件能力的边界检查及合法多轮回归。顶层 MCP/容器/beta 字段已窄投影不等于嵌套输入已完成验收；此时未证明存在可利用的实际网页绕过，也未调用真实 API。

2026-09-05 09:55 UTC 后 Root 与作者分别复现 Docker 对 `observer-v1-05-claude:2.1.252` 的 `image inspect` 报 `No such image`，但同 daemon 以不可变 ID 查询及 `image ls` 都有该镜像和标签。Root 按 diagnosing-bugs 的 CLI 反馈环核查；**未重启 Docker、重建、重新打标或删除任何镜像**，下一轮原标签、规范化名称和 ID 均恢复，随后原标签连续 **10/10** 查询返回既定 `sha256:0fce00145d59010131a2efebdcac36dd66ef1c8b388830e275fcdc096d720269`。仅记为已观察的瞬态名称查询异常，根因未确定，不声称产品修复或放宽测试失败处理。当时无 `observer.task` 残留容器。

随后作者提供嵌套边界的实际 RED→GREEN：`nested-image` 协议进程输入起初在公开业务 seam 中仍出版（`Missing expected rejection`）；收紧 Messages/system 与 StructuredOutput 历史后，四种嵌套输入均在模型发送前拒绝（sends=0、cleanup=removed）。解析异常在容器事件回调内转 `policy-violation`，不能逃逸为宿主崩溃。作者该阶段定向 **2/2** 与 typecheck 通过，正重跑完整 94 项及 smoke；Root 尚未独立复现最终实现。该 RED 只证明受控外部协议进程提交的字段越过原边界，并非真实网页/模型触发或远端实际取图证据。

## Standards

首轮 fresh reviewer `/root/review_v1_05_standards` 在 `0b967c6` 完整阅读 26 文件 diff，固定规范及完整 Fowler baseline；明确规范违反 **0**，启发式 **2**，本轴最严重 **P3**：

- possible Duplicated Code：`src/claude-runner.ts:25` 与 `src/codex-runner.ts:33` 重复逐发送 TTL、receipt、transport 和有界用量记录；共同规则未来修正需同步，建议提取 Provider 用量解析之外的共有包装。
- possible Duplicated Code：`src/claude-model-transport.ts:16` 与 `src/codex-model-transport.ts:13` 重复有界响应读取、2 MiB 限制与 reader cancel；可共享读流函数，端点/认证仍由适配器控制。

以上均是非硬违反的维护判断。Root 接受为非阻断建议，本票不为此扩大重构；修复 Spec 后仍须复审新差异。

## Spec

首轮 fresh reviewer `/root/review_v1_05_spec` 独立阅读冻结差异、GitHub #5 / 本地票及 PRD，并做真实固定 CLI + 无凭证 Messages 替身 + Gate/SQLite 专项。未发现范围扩张；本轴 **2 项 P2**：

1. **不完整 SSE 终帧仍出版**。`src/claude-usage.ts:13–14` 只提取 `data:` 行，忽略帧结束和事件名称。将正常流 `.trimEnd()` 删除终帧空行，或仅把最终 `event: message_stop` 改成 `event: ping` 而保留 JSON `type`，实际 CLI 仍 completed、`produce → readReport` 返回正文。违反本票 AC2 对部分输出/失败不出版的要求。[SSE 标准](https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream)要求丢弃 EOF 前未以空行结束的事件；[Anthropic 协议](https://platform.claude.com/docs/en/build-with-claude/streaming#event-types)要求事件名与 JSON type 匹配。
2. **合法多次 message_delta 误拒且丢量**。`src/claude-model-transport.ts:110` 拒绝第一次之后的 delta，`src/claude-usage.ts:22` 同时丢弃已知用量。官方上述协议允许一次或多次 message_delta，usage 是累计值。独立输入 output_tokens 10→21、相同 tool_use 原因、唯一最终 message_stop 后，实际出现 `agent-policy-violation`、无归档；这不是正常协议支持，应成功且 output 为最终 21，不能相加为 31。对应本票 AC1 / AC5 与 D7 正常可互换候选契约。

Root 另独立打开两个官方原始来源核对，并在 detached `0b967c6` 编写自有 ignored `data/root-acceptance/claude-stream.test.ts`，经同一公开 T1 seam 实跑：上述三种场景 **0/3、3 RED**（3.931 秒）；前两项 `Missing expected rejection`，第三项 `agent-policy-violation`，与 reviewer 观察一致。Probe 与虚构 SQLite 快照明确保留为修复前证据，不进入产品包；源码/配置仍等于冻结候选。修复必须保留正常完整流、支持累计更新不重复计费，同时不放宽危险工具、未知/冲突用量或坏终态。

该 reviewer 自有 `O:/GenesisCode/Observer-worktrees/v1-05/data/spec-review-9f568c` 的精确清理被自动策略拒绝，留下探针与七份虚构 SQLite；Root 已明确禁止换工具重试/绕过，旧 `observer-codex-O2hbGJ` 同样保持不触碰。七个 reviewer 任务容器已按各自 ID 读回不存在，tracked 文件未改。此临时目录不是生产数据，也不是阻断修复的理由。

## 首个冻结候选

作者提交 `0b967c6273b2d768f46df4ce8b546508a0d41784`：`feat: add isolated Claude research runner (#5)`；base 不变，26 files、+1023/-57，Root 读回 clean，固定 `git diff 8e35d12470c14f2638d3adbcd1901935feeaa593...HEAD` 与单条 commit list，确认差异非空。作者最终 `check` **94/94**（86.034 秒）、`smoke` **3/3**（1.291 秒，旧子集），未保留 `observer.task` 容器。Root 在独立 detached `O:/GenesisCode/Observer-worktrees/accept-v1-05` 安装锁定依赖后执行完整检查，尚待终态，不提前记 PASS。

Root 随后在该冻结 SHA 独立完成 `npm run check`：**94/94、0 skipped、0 failed**（76.667 秒）；`npm run smoke` **3/3**（1.301 秒，旧子集）。检查包含 typecheck、生产 build、真实 Claude/Codex CLI + 无凭证模型协议替身、Gate/归档和来源政策回归；结束读回 HEAD 未变、detached 工作树 clean。双轴审查仍未结束，以上不授权先行集成或生产发布。

首轮冻结及 Root 全量结果已[回写 GitHub](https://github.com/yiwer/Observer/issues/5#issuecomment-5551054369)并读回 OPEN。其后两轴完成与 Root 3 RED 已否决本候选的验收；原 `/root/implement_v1_05` 已收到具体复现和修改边界，须逐片 TDD、重新完整检查/提交冻结，再进行两轴复审与 Root 验收。旧 94/94 不可用于新代码通过声明。

## 外部门槛

没有真实模型、认证、地域资格、费用、质量、邮件、生产 Linux 或人工验收证据。生产发布/fixture 隔离继续保留；未知不记 PASS。Root 后来实际读到远端 master=`e475bc1`（含 #1–#4），这次 orchestrator 没有执行 push；#5 首个候选仍未集成、未推送，远端无 `ticket/v1-05`。
