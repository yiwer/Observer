# Codex 作为每日新闻服务 worker 的程序化调起研究

> 研究日期：2026-09-04（Asia/Shanghai）  
> 范围：Codex CLI / `codex exec` 的无人值守调用、输入输出、会话、权限、联网、MCP、认证、调度与生产边界。  
> 证据边界：只引用实际打开的 OpenAI 官方页面（`learn.chatgpt.com`、`developers.openai.com`、`platform.openai.com`），并以本机 `codex-cli 0.151.0` 的 `--help` 和无费用参数解析检查作版本化补充；没有发起任何需要凭证或可能计费的模型调用。

## 结论先行

`codex exec` **适合做个人版或早期版本日报的定时、无人值守 agent worker**：官方将它定义为脚本、CI 和 scheduled jobs 的非交互入口；该命令已标记为 Stable，并提供 stdin、独立工作目录、JSONL 事件流、JSON Schema 约束最终输出、会话续跑、sandbox、审批策略、live web search 和 MCP。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)｜[CLI 命令参考](https://learn.chatgpt.com/docs/developer-commands?surface=cli)

但它**不应被视为生产级“全球新闻源”本身**。官方 web search 能访问最新网页并给出来源引用，但并不保证来源数量、地域覆盖、召回完整度或同一查询的稳定结果；`search_context_size` 也明确不保证确切来源数。Codex CLI 文档还没有给出 agent 运行失败的数字退出码表、CLI 级并发契约、自动重试策略或可用性 SLA。[Web search 指南](https://developers.openai.com/api/docs/guides/tools-web-search)

因此推荐的生产定位是：

1. **采集层**由可审计的 RSS、通讯社/交易所/监管机构 API、新闻供应商或只读 MCP 工具提供候选材料和原始来源账本；
2. **Codex worker**负责检索补充、去重、交叉核验、分类、摘要和结构化编辑；
3. **确定性渲染层**把已验证的结构化 JSON 渲染成 Markdown/PDF，再交给邮件或 Android 推送通道。

这是基于官方能力边界作出的工程判断，不是 OpenAI 对新闻产品完整性或 SLA 的承诺。

## 1. 可程序化调起的能力矩阵

| 维度 | 已核实能力 | 对日报服务的意义 |
|---|---|---|
| 非交互入口 | `codex exec` / `codex e`，用于无需 TUI 的脚本、CI、流水线和 scheduled jobs；CLI 参考将其标为 Stable。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)｜[CLI 参考](https://learn.chatgpt.com/docs/developer-commands?surface=cli) | 可由 Windows Task Scheduler、systemd timer、cron 或队列 worker 启动。 |
| Prompt / stdin | Prompt 可作为单个参数；省略或传 `-` 时从 stdin 读取。若既有 prompt 参数又有 pipe，参数是指令，stdin 会作为额外上下文。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode) | 可把固定编辑规则作为参数，把已抓取新闻 JSON 通过 stdin 注入；也可把完整 prompt 文件送入 `codex exec -`。 |
| cwd | `-C` / `--cd` 设置 workspace root。默认要求在 Git 仓库内；非 Git 目录需显式 `--skip-git-repo-check`。[CLI 参考](https://learn.chatgpt.com/docs/developer-commands?surface=cli)｜[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode) | 每个 edition/job 应使用独立、受控工作目录，避免继承无关 `AGENTS.md`、配置或文件。生产上优先使用专用 Git 工作区，而不是长期依赖 skip。 |
| stdout / stderr | 普通模式把进度写到 stderr，只把最终 agent message 写到 stdout；`-o` / `--output-last-message` 另存最终消息。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode) | stdout 可直接落 MD；生产上更适合把 stderr 作为诊断日志，最终结构化结果单独落盘。 |
| JSONL | `--json` 使 stdout 成为逐行 JSON 事件流，包含 `thread.started`、`turn.started`、`turn.completed`、`turn.failed`、`item.*`、`error`；item 可表示 agent message、命令、MCP、web search 等，完成事件含 token usage。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode) | 可取得 thread ID、阶段状态、工具轨迹和 token 用量，供审计、成本计量和告警使用。 |
| Structured Output | `--output-schema <schema.json>` 要求最终响应符合 JSON Schema；可与 `-o` 组合把最终 JSON 写入单独文件。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode) | 建议先生成机器契约 JSON，再由应用生成 MD/PDF；不要把自由文本直接当成可发布事实。应用仍应再次做 JSON Schema 校验。 |
| 会话 | `codex exec resume --last <prompt>` 或 `codex exec resume <SESSION_ID> <prompt>` 可续跑；`--last` 默认按 cwd 选择，`--all` 才跨目录。`--ephemeral` 则不在磁盘保留 session rollout。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)｜[CLI 参考](https://learn.chatgpt.com/docs/developer-commands?surface=cli) | 独立日报优先“一期一新线程 + `--ephemeral`”。多阶段同一期处理可保存 `thread_id` 后用明确 ID 续跑；并发 worker 不应使用有竞态的 `--last`。 |

### 建议的日报最终输出契约

`--output-schema` 至少应约束：`edition_id`、`edition_date`、`timezone`、`category`、`generated_at`、`coverage_window`、`stories[]`、`sources[]`、`conflicts[]`、`omissions[]`。每条 story 建议具有：稳定 ID、标题、摘要、重要性解释、事实与观点区分、事件时间、来源 URL 列表、跨来源一致性、置信度和风险标签。

Schema 只能约束“形状”，不能证明内容真实；发布前还应检查 URL、发布日期、重复项、跨来源支持和时间窗口。

## 2. Web search、命令联网与 MCP 是三条不同通道

### 2.1 原生 web search

Codex 默认 web search 模式是 `cached`：使用 OpenAI 维护的索引，并非实时打开任意网页。日报需要当前信息时，应显式用 `--search` 或 `web_search = "live"`；也可用 `disabled` 移除该工具，或用 `indexed` 让外部访问受搜索索引门控。[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)｜[配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)

官方 API 文档说明 web search 能访问最新信息并产生带来源的回答；输出含 web search action 和 URL citation。直接使用 Responses API 时，还可请求完整 `sources` 字段，得到模型检索过的全部 URL，而不仅是正文实际引用的少数 URL。[Web search 指南](https://developers.openai.com/api/docs/guides/tools-web-search)

不过，Codex CLI 的公开 JSONL 文档只列出了事件和 item 类型，**没有承诺完整暴露 Responses API 的 `sources` / citation annotation 原始结构**。若生产系统要求不可丢失的来源账本，应：

- 在 Codex 最终 schema 中显式要求 `sources[]`，并由应用验证每个 URL；或
- 用 Codex SDK / app server 检查实际事件契约；若仍无法取得完整检索账本，则在这一环节直接使用 Responses API 的 `include: ["web_search_call.action.sources"]`。

官方还明确指出，搜索上下文大小不会保证确切 token 数、来源数或引用数。因此“覆盖全球当天重要新闻”必须由产品自己的来源清单、地区/语言配额和缺口检测定义，不能只靠一句开放式搜索 prompt。[Web search 指南](https://developers.openai.com/api/docs/guides/tools-web-search)

### 2.2 sandbox 内命令的网络

本地 Codex 默认关闭 agent 命令的网络；`workspace-write` 也不会自动获得网络。若必须让 agent 自己运行 `curl`、RSS 脚本或 SDK，需要设置 `sandbox_workspace_write.network_access = true`。可再启用 network proxy 并设置域名 allow/deny；仅写域名规则但不启用 proxy，不会实际执行过滤。[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)

命令网络代理**不控制** web search、Apps/Connectors、MCP、浏览器、Computer Use、模型请求或认证请求；这些通道有各自配置和策略。因此，允许命令只访问少数域名，不代表 MCP 或 web search 也受同一列表约束。[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)

对日报的低风险默认值是：agent 保持 `read-only`、命令网络关闭，只启用原生 live web search；确定性 RSS/API 抓取放在 Codex 进程之前完成，通过 stdin 传入。这样可以把“抓取程序可访问哪里”与“模型能做什么”分别审计。

### 2.3 MCP

Codex CLI 支持本地 STDIO MCP 和 Streamable HTTP MCP；HTTP 可用 bearer token 或 OAuth。配置保存在 `config.toml`，可设置工具 allowlist/denylist、启动超时、单工具超时、服务器级或工具级审批策略。[MCP 官方文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

对新闻 worker，建议把受信任的 RSS 聚合、付费新闻 API、监管公告、行情/公司公告查询封装成只读 MCP 工具，并设置：

- `required = true`：关键源初始化失败即让 exec 失败，而不是静默产出缺源日报；官方确认 required MCP 初始化失败会使 `codex exec` 以错误结束。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)
- `enabled_tools`：只暴露本任务所需查询工具；
- `tool_timeout_sec`：用有限超时隔离慢源；默认 MCP 启动超时为 10 秒、工具超时为 60 秒。[MCP 官方文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- 凭证用 `bearer_token_env_var` / 环境变量传入，不把 token 写进 prompt、日志或静态 header；
- 无人值守任务只允许只读工具，避免任何需要人工审批的写操作。

## 3. Sandbox 与 approval：无人值守不等于全权限

官方非交互文档称 `codex exec` 默认使用 read-only sandbox；新自动化应按最小权限选择 `read-only`、`workspace-write` 或 `danger-full-access`，并仅在隔离 CI runner/container 中考虑 full access。旧 `--full-auto` 已是兼容性参数并会告警。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)

日报研究与摘要一般不需要改代码，推荐：

```text
sandbox = read-only
approval = never
native web search = live
command network = off
MCP = only trusted read-only tools
```

`approval = never` 的含义是遇到不允许的动作直接失败/返回给模型，而不是弹出无人处理的确认。不要用 `--dangerously-bypass-approvals-and-sandbox` 解决无人值守问题；它同时移除了审批和 sandbox 边界。[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)

live web 内容仍应视为不可信输入。官方特别提示 web search 和开放网络会带来 prompt injection 风险；任何网页文字都不应有权修改任务策略、读取秘密或触发外部写操作。[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)

## 4. 身份认证、CI 与定时任务边界

Codex 本地客户端支持两类基本登录：ChatGPT 订阅身份和 API key。ChatGPT 身份遵守工作区权限和 ChatGPT 数据策略；API key 遵守 API 组织的数据设置并按标准 API 使用量计费。[Authentication](https://learn.chatgpt.com/docs/auth)

无人值守服务的默认选择应是 API key：官方明确建议 API key 用于程序化 Codex CLI / CI/CD，并警告不要把 Codex 执行暴露到不可信或公开环境。`codex exec` 默认会复用已保存的 CLI 认证；自动化中也可仅在该次调用设置 `CODEX_API_KEY`。[Authentication](https://learn.chatgpt.com/docs/auth)｜[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)

更高阶选择：

- 可信云/CI 已有短期 workload token 时，官方建议 workload identity federation，避免长期保存 OpenAI credential；
- ChatGPT Enterprise 可为可信脚本、scheduler 和私有 CI runner 使用 Codex access token；一般 OpenAI API 调用仍使用 Platform API key；
- `~/.codex/auth.json` 含访问 token，应按密码处理，不得提交、贴进工单或日志。[Authentication](https://learn.chatgpt.com/docs/auth)

不要把 `OPENAI_API_KEY` / `CODEX_API_KEY` 设为会运行仓库控制代码的整个 CI job 的环境变量。官方建议只给需要它的 Codex invocation，并确保同一进程环境里没有不可信代码；GitHub Actions 场景优先使用官方 Codex Action 的代理隔离模式。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)

## 5. 成本、配额、并发和可靠性

### 官方已说明

- API key 模式适合共享自动化环境，按 API pricing 计费，不消耗 ChatGPT 套餐内额度；模型可用性取决于该 key 可访问的 API models。[Codex pricing](https://learn.chatgpt.com/docs/pricing)
- ChatGPT 登录下，本地消息与 cloud chat 共用套餐用量，且可能存在周限制；达到限制后的行为和可购买 credit 因计划而异。[Codex pricing](https://learn.chatgpt.com/docs/pricing)
- API 模型按 token 计费，web search action 还会产生工具调用成本；实际 rate limits 随模型和账户 usage tier 变化。[Web search 指南](https://developers.openai.com/api/docs/guides/tools-web-search)｜[GPT-5.6 Sol 模型页](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- `turn.completed` JSONL 事件可带 input、cached input、output 和 reasoning token usage，可作为单次日报的成本观测基础。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)

### 官方尚未形成可依赖契约的项目

截至本次研究，官方 Codex CLI 页面没有说明：

- 同一账号/同一 `CODEX_HOME` 可安全并发多少个 `codex exec`；
- CLI 自身对 429、5xx、连接中断会重试几次、退避多久；
- 单次 exec 的默认总超时或最长运行时间；
- agent/model failure、schema failure、网络失败、MCP failure 分别对应哪个数字退出码；
- `codex exec` 的可用性 SLA、结果确定性、新闻召回率或全球覆盖保证；
- 使用 ChatGPT 订阅身份跑长期 scheduler 是否有独立于交互用量的稳定服务配额。

因此第一版并发应保守（例如外部队列控制 1～2 个 worker 起步），再依据真实 429、延迟、token 和搜索调用数据调优；该数字是工程起点，不是官方限制。

### 服务端必须补齐的可靠性控制

1. 外部 timeout、有限次数重试与指数退避；不要假设 CLI 内建重试。
2. 用 `{edition_date, timezone, category, source_set_version}` 做幂等键；写临时文件，全部校验通过后原子发布。
3. 同一 category/date 加互斥锁，避免定时器重入。
4. 同时检查进程退出状态、JSONL 终态和最终 JSON Schema；缺任一项都不得发布。
5. 保存 query/source/生成时间/模型/CLI 版本/token usage，但对 prompt、stderr 和 MCP 输出做秘密脱敏。
6. 失败时发布“上次成功版本 + 明确过期标记”或只发故障通知，不静默生成来源不足的日报。
7. 固定 CLI 版本并做升级回归；model ID、搜索模式和 schema 都显式设置。

## 6. 退出状态：当前能确认到什么程度

官方文档确认两件事：JSONL 会出现 `turn.completed`、`turn.failed` 和 `error` 事件；required MCP 初始化失败会让 `codex exec` 以错误退出。但官方没有给出数字退出码对照表。[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)

本机 `codex-cli 0.151.0` 的无费用参数解析检查得到：

| 场景 | 观测结果 |
|---|---:|
| `codex exec --help` | 0 |
| 未知参数 `codex exec --not-a-real-flag` | 2 |

这只证明该版本的 help/参数解析行为，**不能外推**模型失败、429、超时、MCP 或 schema 失败的具体 code。实现上应把任何非零状态视为失败，并额外要求 JSONL 最后出现 `turn.completed`、不存在 `turn.failed` / `error`，且最终文件通过本地 schema 校验。

## 7. 最小调用轮廓（示例，不在本次研究中执行）

### 7.1 Windows PowerShell

以下轮廓假设 secret manager 已把 API key 交给 `$codexApiKey`，prompt/schema/run 目录均由服务预先创建。它使用 live web search、read-only、永不交互、JSONL 事件流和 schema 约束最终结果：

```powershell
$runRoot   = 'C:\Services\Observer\run'
$prompt    = 'C:\Services\Observer\prompts\ai-daily.md'
$schema    = 'C:\Services\Observer\schemas\daily-news.schema.json'
$events    = 'C:\Services\Observer\out\ai-daily.events.jsonl'
$finalJson = 'C:\Services\Observer\out\ai-daily.final.json'
$stderrLog = 'C:\Services\Observer\out\ai-daily.stderr.log'

$previousCodexKey = $env:CODEX_API_KEY
$codexExit = $null
try {
    $env:CODEX_API_KEY = $codexApiKey
    Get-Content -Raw -Encoding UTF8 $prompt |
        & codex --search -a never -s read-only -C $runRoot exec `
            --skip-git-repo-check `
            --ephemeral `
            --json `
            --color never `
            --output-schema $schema `
            --output-last-message $finalJson `
            - 1> $events 2> $stderrLog
    $codexExit = $LASTEXITCODE
}
finally {
    if ($null -eq $previousCodexKey) {
        Remove-Item Env:CODEX_API_KEY -ErrorAction SilentlyContinue
    }
    else {
        $env:CODEX_API_KEY = $previousCodexKey
    }
}

if ($codexExit -ne 0) {
    throw "codex exec failed: exit=$codexExit"
}
# 下一步：解析 events 终态、重新验证 finalJson、通过后原子发布。
```

注意：

- 若 `$runRoot` 是专用 Git repo，应去掉 `--skip-git-repo-check`。
- `--ephemeral` 适合每日报的一次性线程；需要续跑时去掉它，持久化 JSONL 中的 `thread_id`。
- API key 应由 Windows Credential Manager、服务账户 secret store 或等价设施注入，不能写进脚本/任务参数。

### 7.2 Linux + systemd timer/cron worker

由 systemd credential/secret manager 预先注入 `CODEX_API_KEY`。worker 脚本用 `flock` 防重入，用外部 `timeout` 设总时限：

```bash
#!/usr/bin/env bash
set -uo pipefail
umask 077

exec 9>/run/lock/observer-ai-daily.lock
flock -n 9 || exit 75

run_root=/srv/observer/run
prompt=/srv/observer/prompts/ai-daily.md
schema=/srv/observer/schemas/daily-news.schema.json
events=/srv/observer/out/ai-daily.events.jsonl
final_json=/srv/observer/out/ai-daily.final.json
stderr_log=/srv/observer/out/ai-daily.stderr.log

timeout --signal=TERM 45m \
  codex --search -a never -s read-only -C "$run_root" exec \
    --skip-git-repo-check \
    --ephemeral \
    --json \
    --color never \
    --output-schema "$schema" \
    --output-last-message "$final_json" \
    - < "$prompt" > "$events" 2> "$stderr_log"
codex_exit=$?

if [ "$codex_exit" -ne 0 ]; then
  exit "$codex_exit"
fi
# 下一步：解析 JSONL 终态、重新验证 schema、通过后原子发布。
```

systemd timer 的最小调度意图：

```ini
[Timer]
OnCalendar=*-*-* 06:00:00 Asia/Shanghai
Persistent=true
RandomizedDelaySec=2m
```

`Persistent=true` 可补跑关机期间错过的任务；仍需由 worker 的幂等键防止重复发布。若用 cron，只让 cron 调上述 wrapper，不要把 API key 或完整 `codex` 命令直接写入 crontab。

### 7.3 明确 ID 的续跑轮廓

多阶段同一期任务可从首阶段 JSONL 取得 `thread_id`，第二阶段使用明确 ID：

```text
codex --search -a never -s read-only -C <run-root> exec resume \
  <THREAD_ID> --json --output-schema <schema> -o <final> \
  "在同一期材料上执行交叉核验并生成最终结构"
```

不要在多 worker 调度器中用 `resume --last`；官方只保证它按“当前目录的最近记录”选择，无法表达业务幂等键。[CLI 参考](https://learn.chatgpt.com/docs/developer-commands?surface=cli)

## 8. 本机 0.151.0 的版本化补充

本机只读检查确认：

- `codex --version`：`codex-cli 0.151.0`；
- `codex exec --help` 包含 prompt/stdin、`-C`、`--json`、`--output-schema`、`-o`、`--ephemeral`、sandbox、model、profile、`--ignore-user-config`、`--ignore-rules` 和 resume；
- `codex exec resume --help` 接受 session UUID/thread name、`--last`、`--all`、follow-up prompt/stdin；
- `codex login --help` 接受从 stdin 读 API key 或 access token；
- 在该版本中，`--search` 和 `-a/--ask-for-approval` 是根命令选项。参数解析验证：`codex --search -a never exec --help` 成功，而 `codex exec --search --help` 和 `codex exec --ask-for-approval never --help` 返回 2。因此脚本采用“全局选项放在 `exec` 之前”的顺序。

最后一项说明官方网页示例与具体已安装二进制之间可能存在语法位置差异。部署脚本必须在固定版本上运行 `codex --help` / `codex exec --help` 的无费用冒烟检查，升级时重新验证，不能只复制网页命令。

## 9. 生产适用性判定

| 判定项 | 结论 | 原因 |
|---|---|---|
| 个人每日四类日报 MVP | 适合 | scheduled job、live search、schema、JSONL、最小权限和 API key 自动化均有官方路径。 |
| 内部小规模服务 | 有条件适合 | 需外部 queue/timeout/retry/lock/secret store/schema validator/source ledger。 |
| 只靠 Codex 搜索覆盖全球新闻 | 不适合 | 无召回、地区、语言、来源数、稳定性或完整性保证。 |
| 直接把 agent 文本推给终端用户 | 不适合 | 需要事实/来源校验、确定性渲染、失败降级与审计。 |
| 把 Codex 用作生产编排 SDK | 可行但应升级接口 | 官方提供 server-side Codex SDK，可 start/continue/resume thread；app server 面向自定义客户端的认证、历史、审批和流式事件。相较 shell 进程，它更适合长期服务集成。[Codex SDK](https://learn.chatgpt.com/docs/codex-sdk) |

推荐演进：MVP 可从 `codex exec` 开始，证明日报选题与模板；进入稳定运营后，把调度、状态、重试、并发、来源账本和渲染移入应用服务，并评估 Codex SDK/app server 或直接 Responses API。保留 CLI 作为运维回放和降级入口，而不是让 shell stdout 成为唯一生产协议。

## 10. 仍不确定、需要 PoC 实测的清单

1. 当前目标账号/认证方式实际可用的模型、日/周额度、RPM/TPM 和 web-search 工具费用。
2. `codex exec --json` 在 web search item 中实际保留哪些 citation/source 字段；是否满足完整来源账本。
3. schema 不满足、429、5xx、DNS/代理失败、required/optional MCP 超时在 0.151.0 下的实际事件序列、数字退出码与部分文件行为。
4. 同一 `CODEX_HOME` 并发运行四个 category worker 时的 session 文件、auth refresh 和日志竞争行为。
5. Windows Task Scheduler 的非交互服务账户下，native sandbox、证书代理、UTF-8 重定向和 secret 注入是否符合预期。
6. 不同地区、语言、付费墙与站点 robots/许可对新闻召回和可引用性的实际影响。
7. 每个 edition 在真实 source set 下的 p50/p95 时延、token/search-call 成本和事实错误率。

这些项目应在隔离测试账号、成本上限和不可发布测试通道中验证后，才决定生产并发和自动发布阈值。

## 官方来源索引

- [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Developer commands / Codex CLI reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli)
- [Authentication](https://learn.chatgpt.com/docs/auth)
- [Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)
- [Configuration Reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Codex SDK](https://learn.chatgpt.com/docs/codex-sdk)
- [Codex Pricing](https://learn.chatgpt.com/docs/pricing)
- [Web search tool](https://developers.openai.com/api/docs/guides/tools-web-search)
- [GPT-5.6 Sol model and tiered API limits](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
