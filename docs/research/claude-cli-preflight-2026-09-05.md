# Claude CLI 只读增量预检（2026-09-05）

范围：[V1-05](../planning/v1/tickets/05-claude-runner.md)、[PRD D7](../PRD.md#d7-agent-运行)；补充[原研究](claude-programmatic-invocation.md)，不启动或实施 #5。仅查看版本、帮助和官方资料；未读取认证/配置/凭证文件，未打印环境变量，未执行 prompt、真实模型/API 调用、安装、升级、登录或 Docker 操作。账户、地域、模型可用性、隔离和真实协议均未验证。

## 本机证据（local probe）

2026-09-05，PowerShell，cwd `O:\GenesisCode\Observer`：

```powershell
Get-Command localclaude,claude -ErrorAction SilentlyContinue |
  Select-Object Name,CommandType,Source,Path
& 'C:/Users/16348/.local/bin/claude.exe' --version
& 'C:/Users/16348/.local/bin/claude.exe' --help
```

命令发现返回 `claude.exe`，路径 `C:\Users\16348\.local\bin\claude.exe`；未发现名为 `localclaude` 的命令。版本输出仍为 **`2.1.252 (Claude Code)`**，退出码 0，与原研究相同。以下“已列出”仅表示帮助中的声明，不代表运行或隔离通过。

| 所需参数 | 2.1.252 本机帮助证据 |
|---|---|
| `--bare` | 已列出；跳过 hooks、keychain、CLAUDE.md 自动发现等；帮助同时提醒显式 skill 仍可解析 |
| `-p` / `--print` | 已列出；非交互打印退出，跳过 workspace trust 对话框 |
| `--json-schema` | 已列出；接收 JSON Schema |
| `--output-format stream-json`、`--verbose` | 均已列出；另有 `--include-partial-messages` |
| `--tools`、`--allowedTools` | 均已列出；前者选择内建工具，后者允许工具调用 |
| `--strict-mcp-config` | 已列出；仅使用显式 MCP 配置 |
| `--permission-mode dontAsk` | `dontAsk` 在 choices 中 |
| `--permission-prompts none` | 未列出 |
| `--no-session-persistence` | 已列出；print 会话不保存、不可恢复 |
| `--max-turns` | 未列出；不能仅据缺席断言不支持 |

Root 随后独立复跑 `Get-Command claude -All`、`claude --version` 与 `claude --help`，得到同一路径/版本。帮助还列出了三项对 #5 有用的能力声明：`--disable-slash-commands` 禁用 skills；`--restricted` 去掉命令/代码执行工具并限制文件工具目录（但显式 `--tools`、managed settings/`--settings` 仍需核查）；`--safe-mode` 禁用自定义内容但不替代认证/工具权限约束。它们只是当前帮助可见的选项，不表示组合参数、拒绝边界或旧版本兼容已经实测。

另执行的两个帮助探针 `claude.exe --bare --max-turns 1 --help` 和 `claude.exe --bare --permission-prompts none --help` 均退出 0 并打印帮助，未启动任务。**帮助路径可能提前返回，这不是参数接受性验证**；本次没有通过执行任务来补证。

## #5 应注意的官方协议差异

- 原研究的 `--permission-prompts none` 仍不能作为本机已支持前提：官方要求 **2.1.259+**。模型权限请求被拒绝时，当前文档描述 `system/permission_denied` 事件和最终 `permission_denials`；不能把这些新行为自动回填为 2.1.252 实测事实。结构数据位于 `structured_output`；流式示例使用 `--output-format stream-json --verbose`。[非交互文档](https://code.claude.com/docs/en/headless)
- 官方继续列出 `--max-turns`：仅 print 模式、默认无限、到限错误退出；流式输入下排队消息可能另起一轮并重置限额。#5 应固定单任务输入和外部时限，另以目标二进制验证轮数限制，不能把它当整个进程累计时限。[CLI reference](https://code.claude.com/docs/en/cli-reference)
- 正常终态是 `success`；已知错误 subtype 包括 `error_max_turns`、`error_max_budget_usd`、`error_during_execution`、`error_max_structured_output_retries`。`stop_reason="refusal"` 表示模型拒绝，`max_tokens` 表示输出被限长。`result` 后仍可能有系统事件，应读到 EOF 并等待进程退出。[Agent loop / Handle the result](https://code.claude.com/docs/en/agent-sdk/agent-loop#handle-the-result)
- **不能仅检查 `subtype="success"`。** 官方类型注明 API 失败可以保留此 subtype，但 `is_error=true`，并带 `api_error_status`（该字段自 CLI 2.1.110 发出）。`terminal_reason` 可标识取消，如 `aborted_streaming` / `aborted_tools`；旧版本或绕过 agent loop 的结果可能缺失，所阅源码未给它完整最低版本承诺。[官方 ResultMessage 定义](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/src/claude_agent_sdk/types.py)

当前官方解析器直接读取的 wire 字段如下；这是实现样本依据，**不是本机输出快照**。源码链接指向研究时的 `main`，实施时应再固定所用版本的字段证据。[官方消息解析器](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/src/claude_agent_sdk/_internal/message_parser.py)

| 类别 | wire 字段 |
|---|---|
| 终态与关联 | `type="result"`、`subtype`、`is_error`、`session_id`、`num_turns` |
| 输出、拒绝与错误 | `result`、`structured_output`、`stop_reason`、`permission_denials`、`errors`、`api_error_status`、`terminal_reason` |
| 时间与消耗 | `duration_ms`、`duration_api_ms`、`total_cost_usd`、`usage`、`modelUsage` |

`usage` 只覆盖主 loop，`modelUsage` 覆盖整棵调用树；崩溃结果可能将费用归零，缺失值不能解释为零消耗。[Agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop#handle-the-result) `modelUsage` 内含 `inputTokens`、`outputTokens`、`cacheReadInputTokens`、`cacheCreationInputTokens`、`webSearchRequests`、`costUSD` 等；Python 属性 `model_usage` 对应 wire 的驼峰字段。费用仍是客户端估计。[官方类型](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/src/claude_agent_sdk/types.py) [非交互费用说明](https://code.claude.com/docs/en/headless)

工程判定：成功候选需联合检查退出码、唯一可信终态、`is_error`、拒绝/取消、结构完整性和业务 Schema；部分文本、未知终态、缺少最终结果不能进入正常出版。失败/缺失用量保留未知，禁止回退为成功或零消耗。按 PRD D7 控制轮数、时限与重试；原研究的金额上限示例不是已批准业务常量。

## 配置、凭证与网络边界

普通 `-p` 会加载用户/项目自动配置，且未信任目录中的 hook、MCP 仍可能启动。`--bare` 跳过自动发现和 OAuth/keychain；Anthropic 认证转为显式 API key 或 `apiKeyHelper`，第三方 provider 仍读取自身凭证。显式 `--add-dir` 仍可能引入 skills，因此 bare 不能独立证明无配置污染。[非交互 bare mode](https://code.claude.com/docs/en/headless#start-faster-with-bare-mode)

`--allowedTools` 是免提示批准；`--tools` 限制内建集合但不控制 MCP，需要独立 MCP 策略。`--no-session-persistence` 只承诺不保存会话，不能扩写成整个进程不落盘。[CLI reference](https://code.claude.com/docs/en/cli-reference) 官方安全文档明确权限门禁不等于 sandbox；`ANTHROPIC_BASE_URL` 只改变模型请求路由，不能控制其他工具流量。模型传输、命令出网、检索和 MCP 应各有运行环境约束，凭证可由隔离边界外代理注入。[安全部署](https://code.claude.com/docs/en/agent-sdk/secure-deployment#configuring-claude-code-to-use-a-proxy)

## Linux 固定分发建议（仅查资料，未执行）

官方原生安装支持指定确切版本，也提供签名 apt/dnf/apk 仓库；`stable`/`latest` 是变化通道，不能代替版本固定。#5 建议选择目标 Linux 架构对应的官方原生版本，在镜像构建记录中固定版本和二进制 hash，再运行目标机版本/协议验收；本机 Windows 版本不等于 Linux 资格。[官方安装与固定版本](https://code.claude.com/docs/en/setup#install-a-specific-version)

完整性链应包括：从官方取得所选版本的 `manifest.json` 和 `manifest.json.sig`，核对官方密钥指纹 `31DDDE24DDFAB679F42D7BD2BAA929FF1A7ECACE`，验证 detached signature，再比对 `platforms.<platform>.checksum` 的 SHA-256。签名 manifest 自 2.1.89 提供；Linux 二进制没有单独的平台代码签名。固定安装后还需管理更新来源，避免自动漂移；本预检没有下载、安装、签名/hash 核验或更新配置。[官方完整性与更新说明](https://code.claude.com/docs/en/setup#binary-integrity-and-code-signing)

本便笺只完成资料及本机帮助预检。#5 尚未实施，协议替身测试、Linux 隔离/终止测试、授权真实调用和模型质量分别待验，不记 PASS。
