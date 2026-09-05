# V1-05 审查与验收记录

状态：**实施中，尚未验收**。GitHub #5 OPEN，assignee=yiwer；没有冻结候选或双轴结论。此文记录执行边界，不是通过证明。

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

## Standards

待冻结后独立审查，无结论。

## Spec

待冻结后独立审查，无结论。

## 外部门槛

没有真实模型、认证、地域资格、费用、质量、邮件、生产 Linux 或人工验收证据。生产发布/fixture 隔离继续保留；未知不记 PASS。当前提交均未 push。
