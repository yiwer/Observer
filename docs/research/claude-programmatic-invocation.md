# Claude Code / Agent SDK 的程序化与无人值守调起机制

> 研究日期：2026-09-04（Asia/Shanghai）  
> 范围：Claude Code `claude -p`、Claude Agent SDK、自托管调度、WebSearch/WebFetch、MCP、认证、费用、并发和生产边界。  
> 证据约束：只使用实际打开的 Anthropic 官方文档、官方帮助中心和 `anthropics/*` 官方源码仓库；未执行任何会产生 API 费用或需要凭证的 Claude 调用。

## 结论先行

1. **`claude -p` 是正式的非交互入口，不是屏幕自动化。** `-p`/`--print` 让 Claude Code 接收 prompt、运行 agent loop、打印结果并退出；官方明确把它用于脚本和 CI/CD。成功进程退出码为 `0`，失败为非零。[非交互模式](https://code.claude.com/docs/en/headless)
2. **适合作为 PoC 或单租户每日批处理 worker，但不宜直接充当完整生产服务控制面。** 官方把 CLI 定位为交互开发和一次性任务，把 Agent SDK 定位为 CI/CD、自定义应用和生产自动化；Agent SDK 本质上仍会为每个会话拉起一个 `claude` 子进程，只是提供原生消息、回调、结构化结果、会话和生命周期控制。[Agent SDK 概览](https://code.claude.com/docs/en/agent-sdk/overview) [生产托管](https://code.claude.com/docs/en/agent-sdk/hosting)
3. **新闻发现可以用内建 `WebSearch` + `WebFetch`，但不能把它当成可审计的原始新闻采集层。** WebSearch 只返回标题和 URL；WebFetch 会把 HTML 转换为 Markdown，再用小模型做提取，通常不给主 agent 原始页面，而且大页面会截断、结果默认缓存 15 分钟，因此是“有损”的。[工具参考](https://code.claude.com/docs/en/tools-reference)
4. **共享生产日报应使用 Claude Platform API key 或受支持云提供商认证，而不是借用某个用户的 Pro/Max OAuth。** Anthropic 明确要求构建产品/服务的开发者使用 Console API key 或受支持云提供商，不允许第三方代用户路由 Free/Pro/Max 凭证。[法律与认证边界](https://code.claude.com/docs/en/legal-and-compliance)
5. **推荐形态是“确定性采集器 + Agent 编辑器 + 确定性发布器”。** RSS、新闻 API、站点适配器或受控 MCP 负责获取并保存来源证据；Claude 负责搜索补全、聚类、去重建议、摘要和栏目编排；普通代码负责 schema 校验、事实/URL/时间校验、Markdown/PDF 渲染、幂等发布、邮件和 Android 推送。这是基于官方工具行为与安全边界作出的工程判断，而不是 Anthropic 的产品承诺。

## 1. `claude -p` 到底做什么

### 1.1 基本调用、prompt、stdin 与工作目录

最小调用是：

```text
claude -p "Summarize today's verified source bundle"
```

`-p` 是 `--print` 的短形式：运行非交互会话，打印结果，然后退出。prompt 可以作为命令行参数传入；非交互模式也读取 stdin，因此可以把已有的 RSS/API 聚合包通过管道送入 Claude。[非交互模式](https://code.claude.com/docs/en/headless)

```powershell
Get-Content -LiteralPath '.\input\source-bundle.json' -Raw |
  claude -p '基于输入材料生成日报；不得发明输入中没有的事实' --output-format json
```

当前官方边界：管道 stdin 上限为 10 MB，超过会以非零状态退出；更大的材料应落盘后在 prompt 中引用文件路径。Windows 上“stdin 不可读导致崩溃/静默退出”的问题在 v2.1.211 以前存在。[stdin 边界](https://code.claude.com/docs/en/headless)

CLI 会把**启动进程时所在目录**作为主工作目录；默认文件访问以该目录为边界，`--add-dir` 只是扩展可访问目录。要固定 CLI 的 cwd，应由 PowerShell 的 `Push-Location`、Task Scheduler 的 WorkingDirectory、systemd 的 `WorkingDirectory=` 或容器配置来设定。Agent SDK 则有显式 `cwd`/`ClaudeAgentOptions(cwd=...)`。[工作目录权限](https://code.claude.com/docs/en/permissions) [SDK 子进程模型](https://code.claude.com/docs/en/agent-sdk/hosting)

### 1.2 `--bare` 与隐式配置污染

普通 `claude -p` 会像交互会话一样发现并加载工作目录或用户目录中的 hooks、skills、commands、subagents、plugins、MCP、auto memory 和 `CLAUDE.md`。更重要的是：在一个从未信任过的目录里，`-p` 不显示 workspace trust 对话框，却仍可能运行项目 hook、连接 `.mcp.json` 中的服务器。[bare mode](https://code.claude.com/docs/en/headless)

因此自动化任务应优先使用 `--bare`，然后显式传入所需配置：

```text
claude --bare -p "..." \
  --settings ./automation.settings.json \
  --mcp-config ./news.mcp.json
```

官方把 `--bare` 列为脚本和 SDK 调用的推荐模式。它跳过上述自动发现；但它也**不读取订阅 OAuth、系统 keychain、Anthropic profile 或 federation profile**。直接调用 Anthropic API 时，需要 `ANTHROPIC_API_KEY` 或 `apiKeyHelper`；Bedrock、Google Cloud Agent Platform、Foundry 等仍读取各自提供商凭证。[bare mode 认证](https://code.claude.com/docs/en/headless) [认证优先级](https://code.claude.com/docs/en/authentication)

### 1.3 输出格式

CLI 支持三种输出：[非交互模式](https://code.claude.com/docs/en/headless)

| 格式 | 用途 | 关键边界 |
|---|---|---|
| `text` | 人直接读、直接要求 Markdown | 默认格式；机器校验最弱 |
| `json` | 批处理和最终结果 | 包含 `result`、`session_id`、usage/cost 等元数据 |
| `stream-json` | 进度、工具调用、重试和流式 UI | NDJSON；应读到流结束，最后有 `result` 消息 |

日报服务应让 agent 先产生**结构化 JSON**，再由应用层渲染 Markdown/PDF。用 `--output-format json --json-schema '<schema>'` 时，符合 schema 的数据位于 `structured_output`。无效 schema 会报错；但 JSON Schema 的 `format`（例如 email/URI/date-time）只被当作 annotation，并不执行客户端格式验证，所以 URL 和时间仍必须由应用层校验。[结构化输出](https://code.claude.com/docs/en/headless) [SDK 结构化输出](https://code.claude.com/docs/en/agent-sdk/structured-outputs)

`stream-json` 配合 `--verbose --include-partial-messages` 可获得 token 增量和事件；遇到可重试 API 错误时还会发出 `system/api_retry`。消费者必须处理慢消费、截断、重复事件与最终状态，而不能把“收到部分文本”等同于成功。[流式输出与重试事件](https://code.claude.com/docs/en/headless)

### 1.4 退出码、失败判定与超时

- 正常完成：进程退出码 `0`；运行失败：非零。无效 flag 会在启动前写入 stderr；认证缺失等运行内失败可能把失败结果写到 stdout。因此调度器要同时检查**退出码、stdout JSON 是否可解析、结果 subtype/必要字段是否正确**，不能只看 stderr。[退出行为](https://code.claude.com/docs/en/headless)
- `--max-turns` 达到上限时以错误结束；`--max-budget-usd` 可限定单次调用的客户端估算成本，子 agent 费用也计入。两者默认都没有上限，官方建议生产 agent 设置预算。[CLI flags](https://code.claude.com/docs/en/cli-reference) [agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop)
- `SIGTERM` 会让 `claude -p` 以 `143` 退出，当前 turn 不留下完成结果，但会话可以恢复；外部调度器仍应设置 wall-clock timeout，并把超时和业务失败分开记录。[SIGTERM 行为](https://code.claude.com/docs/en/headless)
- 官方没有给普通失败发布一张“所有非零退出码”的稳定枚举表。因此不要在业务逻辑里推断 `1/2/...` 的细粒度含义；Agent SDK 的 `ResultMessage.subtype`（如 `success`、`error_max_turns`、`error_max_budget_usd`、`error_during_execution`、`error_max_structured_output_retries`）更适合可靠分类。[ResultMessage](https://code.claude.com/docs/en/agent-sdk/agent-loop)

### 1.5 会话续跑

- `--continue`：继续当前目录最近的会话；在 `claude -p --continue` 下也会包含之前的 print/SDK 会话。
- `--resume <session_id>`：继续指定会话。多任务并行时应从 JSON 结果捕获 `session_id`，然后显式 resume，不要依赖“最近一个”。
- `--no-session-persistence`：不写会话，之后不能 resume。

官方示例与语义见[非交互模式](https://code.claude.com/docs/en/headless)和[CLI reference](https://code.claude.com/docs/en/cli-reference)。默认 transcript 是内部 JSONL，格式可能随版本变化；不应直接解析它来构建产品协议，应使用 CLI/SDK 输出接口。[会话存储](https://code.claude.com/docs/en/sessions)

对于每日独立刊次，建议每次创建新会话并显式传入“统计窗口、时区、已选来源”，避免多日上下文悄然污染；只有人工追问、失败恢复或延续同一专题时才 resume。这是工程建议。

## 2. 无人值守权限模型

### 2.1 `allowedTools` 不是“只允许这些工具”

`--allowedTools`/SDK `allowed_tools` 的含义是“这些工具无需再提示即可执行”。**未列出的工具仍可能出现在模型上下文里**，并继续经过 permission mode 或回调判定。若要真正缩小工具集合，内建工具用 `--tools`，拒绝工具用 `--disallowedTools`；`--tools` 不影响 MCP 工具，因此还要拒绝 `mcp__*`，或以 `--strict-mcp-config` 只载入显式 MCP。[CLI flags](https://code.claude.com/docs/en/cli-reference) [SDK 权限](https://code.claude.com/docs/en/agent-sdk/permissions)

日报采集 worker 的安全基线：

```text
--tools "WebSearch,WebFetch,Read" \
--allowedTools "WebSearch,WebFetch(domain:*),Read" \
--disallowedTools "mcp__*" \
--permission-mode dontAsk \
--permission-prompts none
```

其中：

- `dontAsk` 会拒绝所有未被规则或 hook 预先批准的动作，适合 locked-down CI；
- `--permission-prompts none` 告诉 print mode 没有人会回答提示，避免等待 host，并移除必须询问人的工具。它要求 Claude Code **v2.1.259+**；更旧版本会报 unknown option；
- 在没有 permission host 的 `-p` 中，原本也会拒绝需询问的动作，但新 flag 还会告诉 Claude 不要反复重试；
- 不应使用 `bypassPermissions`：`allowedTools` 无法约束它，未列工具也可能全部被批准。

依据见[无人值守提示控制](https://code.claude.com/docs/en/headless)和[权限求值顺序](https://code.claude.com/docs/en/agent-sdk/permissions)。

### 2.2 WebSearch、WebFetch 与网络

`WebSearch` 和 `WebFetch` 都是需要权限的内建工具。[工具列表](https://code.claude.com/docs/en/tools-reference)

- WebSearch 使用 Anthropic 的搜索后端，返回标题与 URL，不读取结果页面；一次工具调用内部最多可发出 8 次后端搜索。可在单次搜索参数中指定 allowed domains 或 blocked domains，但二者不能同时用；搜索后端不可替换，如需其它供应商必须接 MCP。[WebSearch 行为](https://code.claude.com/docs/en/tools-reference)
- 默认每会话最多 200 次 WebSearch，主会话与所有 subagent 共享；可用 `CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION` 调高为正整数，但不能关闭上限。[WebSearch 会话上限](https://code.claude.com/docs/en/tools-reference)
- WebFetch 是有损提取：HTML 转 Markdown 后再由小模型提取；大页截断，默认缓存 15 分钟，跨域 redirect 需要第二次 fetch。它适合“读出要点”，不适合作为原始证据归档器。[WebFetch 行为](https://code.claude.com/docs/en/tools-reference)
- Provider 能力不同：当前官方文档称 WebSearch 可用于 Claude API、Claude Platform on AWS；Google Cloud Agent Platform 上需 Claude 4+；Microsoft Foundry 需 Anthropic-hosted deployment；Amazon Bedrock 不暴露该 server-side web search tool。选择 provider 前必须做实际能力探测。[Provider 差异](https://code.claude.com/docs/en/tools-reference)
- 拒绝 WebFetch 并不等于断网：如果允许 Bash/PowerShell，agent 仍可用 `curl`/`wget` 等访问网络。生产上要同时收紧工具权限与 OS/container/egress proxy 网络边界。[权限与网络](https://code.claude.com/docs/en/permissions) [安全部署](https://code.claude.com/docs/en/agent-sdk/secure-deployment)

这也是为何新闻服务不能只写一句“请访问可信网站”：来源域、可调用工具、出网代理、原始响应存档和后续校验都应由代码强制执行。

### 2.3 MCP 作为新闻源接入面

MCP 可以连接本地 stdio 进程、HTTP/SSE 远程服务，或 Agent SDK 进程内工具；适合封装 RSS、付费新闻 API、EDGAR/交易所公告、社交平台 API、去重索引和内部证据库。[Agent SDK MCP](https://code.claude.com/docs/en/agent-sdk/mcp)

生产建议：

1. 用 `--mcp-config <file>` 显式加载，配合 `--strict-mcp-config` 忽略其它 MCP 来源；在 `--bare` 下也不会误载用户/项目 MCP。[CLI flags](https://code.claude.com/docs/en/cli-reference)
2. 只允许精确工具名，例如 `mcp__news_ingest__search`、`mcp__news_ingest__get_article`，而不是直接 `bypassPermissions`。
3. 将工具声明为 read-only 时，SDK 能并行执行只读工具；写工具应继续串行，避免竞态。[工具并行语义](https://code.claude.com/docs/en/agent-sdk/agent-loop)
4. 官方示例允许把 token 作为 MCP env/header 传入，但高安全生产部署更推荐把凭证放在 agent 隔离边界之外，由 egress/MCP proxy 注入并审计。[安全部署](https://code.claude.com/docs/en/agent-sdk/secure-deployment)

## 3. 身份认证、订阅、API 与 CI 边界

### 3.1 可用认证方式

Claude Code CLI 支持 Claude.ai 订阅 OAuth、Console/API key、`apiKeyHelper`、以及 Bedrock、Google Cloud Agent Platform、Microsoft Foundry 等。非交互模式下若环境存在 `ANTHROPIC_API_KEY`，会直接使用它；认证有明确优先级，错误的高优先级 key 可能遮蔽有效订阅登录。[Claude Code 认证](https://code.claude.com/docs/en/authentication)

官方也提供 `claude setup-token` 生成长期 OAuth token，存入 `CLAUDE_CODE_OAUTH_TOKEN`，用于没有浏览器登录的 CI/脚本；但它依赖 Pro/Max/Team/Enterprise 订阅、面向订阅身份，而且 `--bare` 不读取它。[setup-token](https://code.claude.com/docs/en/authentication)

边界应这样理解：

- **自己的个人自动化/实验**：可以用自己的订阅登录或 `setup-token`，受订阅使用限制和“ordinary individual usage”约束。
- **面向 Android 客户端的共享服务/第三方产品**：使用 Claude Platform API key（最好是 service account key）、受支持的云提供商身份，或与 Anthropic 单独约定；不得让用户把 Claude.ai OAuth/会话 token 交给服务端，也不得替用户共享/中转其 Pro/Max 配额。[法律与认证边界](https://code.claude.com/docs/en/legal-and-compliance) [Agent SDK 概览](https://code.claude.com/docs/en/agent-sdk/overview)
- **云生产**：Claude API 支持 API key 和 Workload Identity Federation；WIF 适合 CI/Kubernetes 等消除静态 secret 的场景。但当前 `--bare` 不读取 Anthropic federation profiles，因此若坚持 bare CLI，应使用 secret manager 注入 API key、`apiKeyHelper`，或使用受支持云 provider 的原生凭证；不要假定所有认证组合都可叠加。[Claude API 认证](https://platform.claude.com/docs/en/manage-claude/authentication) [bare mode](https://code.claude.com/docs/en/headless)

### 3.2 2026-06 Agent SDK 额度公告存在官方文档漂移

一些 Claude Code 开发文档仍显示“从 2026-06-15 起，Agent SDK 与 `claude -p` 将使用独立月度额度”。但是更新日期为 2026-06-16 的官方帮助中心明确写明：**该变更已暂停；目前 Agent SDK、`claude -p` 和第三方 app 仍消耗订阅使用额度，原计划月度 credit 当前不可用。** [官方暂停更新](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)

因此本报告以帮助中心的后续更新为当前口径，同时把开发文档的残留 banner 视为文档漂移。无论以后额度方案是否重启，官方仍建议共享、规模化生产自动化使用 Claude Platform API key 以获得可预测的按量计费；上线前必须重新核对此页面和合同。

### 3.3 费用、限流与并发

- `json`/SDK result 中的 `total_cost_usd` 与分模型费用是**客户端估算**，可能因价格变化、SDK 价格表落后或特殊计费规则而偏离账单；权威费用应读 Console 或 Usage & Cost API。[成本追踪](https://code.claude.com/docs/en/agent-sdk/cost-tracking)
- API 组织同时受月度 spend limit 和 RPM/ITPM/OTPM 限制；限制按组织/工作区聚合，并使用 token bucket，短时并发突发仍可能 429。429 一般带 `retry-after`，但达到组织月度 spend cap 的 429 没有该 header，反复重试不会恢复。[API rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- 500/504/529 与连接/限流属于必须观测和重试的失败类型；官方 SDK 对部分瞬态错误默认指数退避重试两次，但业务调度器仍要做有上限、带 jitter 的整次 job 重试和 dead-letter 告警。[API errors](https://platform.claude.com/docs/en/api/errors)
- Agent SDK 的一个会话对应一个 `claude` 子进程；N 个并发会话就是 N 个子进程/进程树/本地 transcript。官方给出的初始资源估算是每 agent 1 GiB RAM、5 GiB disk、1 CPU，且 1 GiB 只是起点，不是峰值上限。[SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting)

四类日报可以并行，但应通过有界 worker queue 控制并发，而不是同一时刻无限 fan-out；每个刊次/栏目使用独立 cwd 和输出临时目录，并对 API 429、WebSearch session limit、MCP timeout、PDF 渲染和推送分别记录状态。

## 4. CLI 与 Agent SDK 的关系和选择

### 4.1 不是两个不同的 agent 引擎

Agent SDK 提供和 Claude Code 相同的工具、agent loop 与上下文管理。官方 Python SDK 仓库显示 SDK wheel 自动捆绑 Claude Code CLI，`query()` 返回异步消息迭代器，也可以指定 `cli_path`；官方托管文档进一步说明 `query()` 会通过 stdio 拉起并监督一个 `claude` CLI 子进程。[Python SDK 官方仓库](https://github.com/anthropics/claude-agent-sdk-python) [SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting)

差异主要在控制接口：

| 需求 | `claude -p` | Agent SDK |
|---|---|---|
| 一次性 shell/CI 调用 | 最直接 | 可用但稍重 |
| Python/TypeScript 原生消息 | 需解析 JSON/NDJSON | 原生类型/异步迭代器 |
| 工具审批回调、hooks、自定义进程内工具 | 有 CLI 配置，控制较粗 | 原生 callbacks/hooks/MCP SDK tools |
| 会话 interrupt、持久化适配器、细粒度错误 | 外部进程管理 | SDK API 更完整 |
| 多租户隔离、并发监督、OTel | 需自行搭建 | 官方有生产模式，但仍需容器/进程治理 |

官方选择表将 CLI 推荐给交互开发/one-off task，将 Agent SDK 推荐给 CI/CD、自定义应用和 production automation；无需自建 sandbox/session 基础设施时，可考虑独立的 Managed Agents 托管 REST API。[Agent SDK 概览](https://code.claude.com/docs/en/agent-sdk/overview) [SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting)

### 4.2 成熟度与升级风险

官方文档提供完整生产托管建议，但截至研究日，Python 官方仓库的 `pyproject.toml` 仍标记 `Development Status :: 3 - Alpha`；同时很多 CLI 行为带明确的最低版本说明。SDK 捆绑的 CLI 版本由 SDK 包版本固定，官方建议持续接收 patch、在升级 minor 前检查 changelog。[Python package metadata](https://github.com/anthropics/claude-agent-sdk-python/blob/main/pyproject.toml) [SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting)

工程含义：锁定 SDK/CLI 版本；预发布环境跑来源、权限、schema、超时和失败注入 canary；不要把内部 transcript JSONL 或未文档化字段当长期协议。

## 5. 对每日新闻服务的适用性判定

### 推荐分级

| 场景 | 判定 | 原因 |
|---|---|---|
| 本人使用、单机、每天一次、允许偶发人工介入 | `claude -p` 可行 | 实现快，JSON/schema、预算、工具权限和外部 scheduler 足够 |
| 单租户服务器、固定四类日报、要求稳定推送 | Agent SDK 更合适 | 可观测消息、明确 ResultMessage、并发/interrupt/session 控制更好 |
| 多用户 Android 产品或大规模并发 | 自托管 Agent SDK + 强隔离，或 Managed Agents | 需要每租户 cwd/config/network 隔离、稳定认证、持久化和容量规划 |
| 严格审计、财经决策或必须完整复现来源 | 不能只靠 WebSearch/WebFetch | WebFetch 有损、搜索后端不可配置；必须保存原始 feed/API/page evidence 并做二次校验 |

### 推荐流水线

```text
外部 scheduler
  -> Source Collector（RSS/API/MCP；保存原始响应、URL、发布时间、抓取时间、hash）
  -> Claude Worker（发现补全、聚类、摘要、栏目归类、风险/置信标注）
  -> Schema + Policy Validator（URL、时间窗、引用覆盖、重复、禁用源、栏目配额）
  -> Renderer（同一规范对象生成 MD/PDF）
  -> Publisher（邮件 / server API / Android push；幂等 edition_id）
  -> Audit + Metrics（每源、每栏目、每模型、费用、延迟、失败原因）
```

关键业务字段至少包括：`edition_id`、`category`、`headline`、`summary`、`why_it_matters`、`event_time`、`published_at`、`fetched_at`、`source_name`、`canonical_url`、`evidence_ids`、`confidence`、`uncertainties`。不要让模型直接把最终 Markdown/PDF 当唯一事实存储；保留结构化中间对象和来源证据。

## 6. 最小无人值守调用轮廓

以下都是**示意**，不会在本次研究中执行。假设 `daily-news.schema.json` 已存在，凭证由服务账号的 secret manager 或 `apiKeyHelper` 提供，绝不能硬编码在脚本或日志中。

### 6.1 Windows PowerShell + Task Scheduler

`run-daily.ps1` 的核心：

```powershell
$ErrorActionPreference = 'Stop'

$jobRoot = 'C:\news-agent'
$workDir = Join-Path $jobRoot 'work'
$outDir = Join-Path $jobRoot 'out'
$schema = Get-Content -LiteralPath (Join-Path $jobRoot 'daily-news.schema.json') -Raw
$edition = Get-Date -Format 'yyyy-MM-dd'
$stdoutPath = Join-Path $outDir "$edition.claude.json.tmp"
$stderrPath = Join-Path $outDir "$edition.claude.stderr.log"

$prompt = @"
为 Asia/Shanghai 日期 $edition 生成日报候选数据。
仅收录已由 WebFetch 读取或输入证据包提供的事实；每条必须带 canonical_url、published_at、fetched_at 和 uncertainties。
栏目限定为 ai、finance、frontier_tech、social_discourse。不要发送邮件、不要推送、不要修改文件。
"@

Push-Location -LiteralPath $workDir
try {
    $lines = & claude --bare -p $prompt `
      --model 'sonnet' `
      --output-format 'json' `
      --json-schema $schema `
      --tools 'WebSearch,WebFetch,Read' `
      --allowedTools 'WebSearch,WebFetch(domain:*),Read' `
      --disallowedTools 'mcp__*' `
      --permission-mode 'dontAsk' `
      --permission-prompts 'none' `
      --max-turns 20 `
      --max-budget-usd 3.00 `
      --no-session-persistence 2> $stderrPath

    $exitCode = $LASTEXITCODE
    $raw = [string]::Join([Environment]::NewLine, $lines)
    [System.IO.File]::WriteAllText($stdoutPath, $raw, [System.Text.UTF8Encoding]::new($false))

    if ($exitCode -ne 0) { throw "claude failed with exit code $exitCode" }
    $result = $raw | ConvertFrom-Json
    if ($null -eq $result.structured_output) { throw 'missing structured_output' }

    # 下一步由确定性 validator 验证字段、来源和时间，再原子发布；不要直接推送 tmp 文件。
}
finally {
    Pop-Location
}
```

生产上应把 `sonnet` alias 换成经过验收的完整 model ID，以免 alias 漂移。由于使用了 `--permission-prompts none`，目标运行机需 Claude Code v2.1.259+。

一次性注册 Task Scheduler 的轮廓：

```powershell
$action = New-ScheduledTaskAction `
  -Execute 'C:\Program Files\PowerShell\7\pwsh.exe' `
  -Argument '-NoProfile -NonInteractive -File "C:\news-agent\run-daily.ps1"' `
  -WorkingDirectory 'C:\news-agent'

$trigger = New-ScheduledTaskTrigger -Daily -At '06:17'
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName 'Observer-Daily-News' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings
```

账号、`Run whether user is logged on or not`、密码/托管服务账号和 secret 注入必须按部署环境配置；不要把 key 放入 `-Argument`。

### 6.2 Linux systemd timer

把同样的 `claude --bare -p ...` 命令放入 `/srv/observer/bin/run-daily-news` wrapper，并在 wrapper 中完成 JSON/schema/退出码校验与原子落盘。systemd service 只负责 cwd、身份和总超时：

```ini
# /etc/systemd/system/observer-daily-news.service
[Unit]
Description=Observer daily news generation
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=observer-news
Group=observer-news
WorkingDirectory=/srv/observer/work
EnvironmentFile=/etc/observer-news/claude.env
ExecStart=/srv/observer/bin/run-daily-news
TimeoutStartSec=30min
```

```ini
# /etc/systemd/system/observer-daily-news.timer
[Unit]
Description=Run Observer daily news every day

[Timer]
OnCalendar=*-*-* 06:17:00 Asia/Shanghai
Persistent=true
RandomizedDelaySec=3min
Unit=observer-daily-news.service

[Install]
WantedBy=timers.target
```

`Persistent=true` 允许机器错过触发时间后补跑；wrapper 仍需 edition-level 幂等锁，防止补跑与人工重跑重复发布。`RandomizedDelaySec` 能减少所有栏目/租户同时撞击 API 的瞬时峰值。

不要用 Claude 会话内 `/loop` 代替耐久 scheduler：官方说明 `/loop` 任务是 session-scoped、只在会话运行且空闲时触发、无 missed-run catch-up，并在 7 天后过期；长期自动化应使用外部 scheduler、GitHub Actions、Desktop task 或 cloud Routine。[scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)

## 7. 上线前必须验证的项目

1. **版本**：目标机 `claude --version`；对 `--bare`、`--permission-prompts none`、schema、Windows stdin 设最低版本并在启动时 fail fast。
2. **认证**：用 `/status` 在人工预检中确认认证来源；自动化环境验证 API key/service account/provider，不打印 secret。
3. **权限**：注入恶意网页指令，确认不能 Bash/PowerShell、不能写文件、不能调用未知 MCP、不能访问未许可域。
4. **结果**：测试成功、schema 重试耗尽、max turns、max budget、无 auth、429、529、MCP 超时、外部 timeout 和磁盘满。
5. **证据**：每条新闻都能回到保存的原始 evidence；WebFetch 摘要不是原文副本。
6. **时区**：明确“昨日/今日”的事件窗口、发布日期窗口、抓取截止时间和晚到新闻策略。
7. **幂等**：同一 `edition_id + category + revision` 不重复发邮件或 push；只有 validator 通过后才从临时对象提升为可发布版。
8. **费用与容量**：设置每次 `max-budget-usd`、工作区 spend/rate limits、worker 并发上限、日/月告警；用 Console/Usage API 对账，不把 CLI 估算当账单。
9. **回滚**：保留上一刊和 renderer 版本；agent 输出失败时宁可发布“延迟/降级版”，不要悄悄复用过期结果而标成今日。

## 8. 本机只读核验与仍不确定项

本次在 `O:\GenesisCode\Observer` 只做了只读版本核验：本机 `claude --version` 为 **2.1.252**，没有运行 prompt、没有使用凭证、没有产生模型费用。该版本低于 `--permission-prompts none` 要求的 v2.1.259，所以第 6 节脚本是**目标基线轮廓，当前机器不可原样运行**；升级或暂时删掉该 flag 后仍需在隔离环境做无费用/限额 canary。当前目录也不是 Git repository。

仍需在实施阶段确认：

- 选定 Anthropic provider、模型和账号的实时 WebSearch/WebFetch 可用性、地域和合同条款；provider 支持矩阵会变化。
- 具体套餐的当前订阅限额和未来 Agent SDK credit 政策；官方开发文档与 2026-06-16 帮助中心目前存在残留冲突。
- 目标新闻源的许可、robots、付费墙、转载/摘要权利和 API SLA；Claude 工具可访问不等于有权再分发。
- PDF 字体、中文断行、邮件附件大小、Android push payload 和服务端保留期；不属于本报告的 Claude 调起机制范围。
- Python SDK 当前包 metadata 仍为 Alpha；必须通过项目自己的 soak/canary 才能决定生产准入，不能把官方“production automation”定位误读为 SLA。

## 官方一手资料索引

- [Run Claude Code programmatically](https://code.claude.com/docs/en/headless)
- [CLI reference](https://code.claude.com/docs/en/cli-reference)
- [Tools reference](https://code.claude.com/docs/en/tools-reference)
- [Permissions](https://code.claude.com/docs/en/permissions)
- [Authentication](https://code.claude.com/docs/en/authentication)
- [Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK hosting](https://code.claude.com/docs/en/agent-sdk/hosting)
- [Secure deployment](https://code.claude.com/docs/en/agent-sdk/secure-deployment)
- [Agent SDK permissions](https://code.claude.com/docs/en/agent-sdk/permissions)
- [Agent SDK MCP](https://code.claude.com/docs/en/agent-sdk/mcp)
- [Agent loop and ResultMessage](https://code.claude.com/docs/en/agent-sdk/agent-loop)
- [Structured outputs](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
- [Cost tracking](https://code.claude.com/docs/en/agent-sdk/cost-tracking)
- [API authentication](https://platform.claude.com/docs/en/manage-claude/authentication)
- [API rate limits](https://platform.claude.com/docs/en/api/rate-limits)
- [API errors](https://platform.claude.com/docs/en/api/errors)
- [2026-06-16 Agent SDK credit pause](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
- [Official Python Agent SDK repository](https://github.com/anthropics/claude-agent-sdk-python)
- [Official Python SDK package metadata](https://github.com/anthropics/claude-agent-sdk-python/blob/main/pyproject.toml)
