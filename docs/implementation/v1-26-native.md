# V1-26：本机已登录 Codex

2026-09-08，基于 `fe9e7a62c3664e44133ecf64d7d6403d0a75a47d`。本块实现 Owner 选择的 Windows native 通路，模型按最新决定为 `gpt-6-astra`、`medium`。旧容器 API/fixture 的历史模型、传输和收据保持各自事实。Claude 仍延期。#26 云部署、真实来源、成品投递、备份/恢复、人审和后续 14 日门分别取证，本块不代签这些结果。

## 使用

[非秘密配置示例](../../config/runtime.native.example.v1.json)可供本机生产装配使用：`createProductionRuntime(configPath, ownerToken)` 返回 `observer`、`collection`、`configuration` 和 `routing`。`routing.providers.codex` 包含六栏研究 Runner 和独立语义 Verifier；启用 native Provider 就会装配，无需先开启日常 schedule。现有定时生产流沿同一 research → semantic → publication 路由，手动补发由独立 Owner 入口承接。

示例保持 `schedule/collect/email/corrections` 关闭，来源文件保持原 pending 示例。复制到私人配置后，按实际运行位置修改 CLI 绝对路径、配置/数据库路径和已获批来源；检查授权记录的生效/到期时刻。使用原应用 Owner 凭据，原生配置没有 API key，也不需要新 API 计费。不要向公共提交写邮箱、令牌或真实私人存储地址。

原生授权明确保存 `nativeAuthorization: owner-approved-existing-login`、`regionReview: skipped-by-owner`，两个 eligibility 布尔旧字段为 `null`。它只适用于 native Codex；原容器 Provider 仍走其原资格/密钥通路。状态中的 `runner-configured` 仅表示接线，首次请求前 `actualConnectivity: not-probed`、`credential: cli-managed-not-read`。运行后状态报告最近实际成功/失败时间；失败详情以任务结果的安全类别为准。

## 执行和用量边界

[native 执行器](../../src/codex-native.ts)直接启动受信宿主的 CLI，由 Windows PowerShell `-NoProfile -NonInteractive` 的[专用 supervisor](../../src/codex-native-worker.ps1)在创建 CLI 子进程前加入独立 Windows Job Object。Job 持有到 supervisor 退出，kill-on-close 收束其全部继承子进程；应用取消仅终止自己持有的 supervisor 句柄，另有独立总时限。没有按名称扫描、全局 taskkill 或触碰其他 Codex 会话。此 native 实现仅支持 Windows；其他平台返回 unavailable，Linux 容器验收仍未完成。

任务在新建 OS 临时目录运行，使用 `read-only`、`approval never`、`--ignore-user-config`、`--ignore-rules`、`--ephemeral`，关闭 shell/apps/hooks/MCP/web、额外 agent/JS/image 工具及项目说明加载。宿主 CLI 自己通过原认证位置使用 ChatGPT 登录，`forced_login_method=chatgpt`，Observer 不读取、复制或输出认证文件。子环境仅保留 Windows 执行和原登录位置所需变量，排除 Owner/SMTP/provider key、远程会话、代理覆盖和 Node 注入变量；不重写 HOME/CODEX_HOME、网络或全局配置。总进程时限最多 300 秒，原生全局最多 2 个并发进程，沿用路由更紧的限制及取消；输入/输出有界，过期 Evidence 在派发前拒绝并缩短进程时限。原始 stderr 不保留，只返回安全分类。

这是受信宿主 CLI 边界，Windows Job 负责进程生命周期，**不是容器或每次 API 请求的隔离证明**。请求参数固定模型/强度，但 CLI JSONL 不提供逐请求模型身份确认；记录的是实际调用 CLI 时指定的配置。CLI 工具约束来自此次显式配置，尚未通过对抗性工具/沙箱实测证明。`execution` 使用 `codex-native / codex-saved-login / cli-managed-chatgpt-login`、`trusted-host-windows-job`、`requestControl: process-only`，无容器 ID，退出记 `process-exited`，不伪写 `removed` 或 API broker 回执。

JSONL 来自实际 CLI，版本来自同一可执行文件的 `--version`；复用严格协议解析和任务/Bundle/配置绑定。Observer 的 version/event/result 是适配器封装，非伪造 CLI 原生事件。语义 Schema 的可选值在线上用必填 nullable 表示，回到业务解析前按原 Schema 还原，避免改变领域契约。

原生路由的 `modelRequests: null`、`nativeProcessStarts` 和 `requestAccounting` 明确表示内部模型请求数不可观察。`externalRequests` 仍只统计原 API broker 观察到的请求。原生不会声称 `maxModelRequestsPerAttempt / maxExternalRequests / maxConcurrentExternalRequests` 控制了 CLI 内部请求；它们只作用于 broker。CLI 完成事件可用时记总 tokens，未知分项和订阅成本为 `null`，不构造逐响应收据、不估算 Astra 订阅美元价。总量阈值在 CLI 回传总量后停止后续工作，不能追溯阻止已发生的用量。

## 本块验证记录

按 implement 技能实施；Owner RAPID V1 明确覆盖额外 tests/fixture、typecheck/build、hash 验收和完整回归要求，review 由 Root 静态完成。接手时未发现该工作树相关进程，也没有已有真实调用记录。本块唯一一次真实 native 启动使用内存中自写的虚构蓝色笔记本说明和一条中文 Claim，经 `createCodexVerifier` 调用；`example.invalid` 仅为自写材料的示例标识，没有抓取。

2026-09-08 **07:02:53.470Z → 07:02:54.158Z**，进程上限 90 秒，实际适配器时长 **683 ms**。CLI 版本 `codex-cli 0.153.4`，指定 `gpt-6-astra / medium`，结果 `failed / nonzero-exit`、CLI exit `1`、安全诊断 `configuration`、terminal `missing`。执行边界为 `codex-native / codex-saved-login / cli-managed-chatgpt-login`，container ID 为 `null`，cleanup 为 `process-exited`；调用后 `active=0`、`cleanupUnverified=false`，只读进程检查也未发现遗留任务。全部 tokens、成本为 `null`，没有模型响应收据或语义评估结果。原始 stderr、认证和环境秘密均未输出或保留。此结果只证明真实 CLI 启动及失败后退出，**不证明模型连接成功或语义通路可用**。

失败后使用 OpenAI Docs 读取[官方配置 JSON Schema](https://learn.chatgpt.com/docs/config-schema.json)：`ToolsToml` 不接受 `view_image`，而 `features` 声明了 `view_image` 与 `image_generation`。因此将原 `tools.view_image=false` 静态修正为 `features.view_image=false`，并显式关闭图像生成。官方文字配置参考仍列旧键，最终以机器可读 Schema 作为此次修正依据。Root 随后允许无模型的只读配置定位：本机 `codex -c tools.view_image=false features list` 返回 exit 0，但白名单输出仍为 `view_image stable true`、`image_generation stable true`，说明旧键没有关闭对应 feature；此子命令没有启用 strict-config，也不能单独证明原失败的唯一根因。只输出上述白名单状态，没有保留原 stdout/stderr。修正后的参数未执行验证，也没有第二次 native 模型调用或回归；当前仍待 Root 在完整批次中观察是否成功。

整块静态收尾另补 native 自身 300 秒硬上限、派发前重新计算材料有效期、UTF-8 流解码。研究 Runner、六栏装配、语义 nullable Schema 还原、取消/超时与 Windows Job 后代收束均未另行实测；没有添加测试或 fixture。该调用不采集新闻、不验证来源权利或新闻质量、不调用 Claude/SMTP/Docker/S3，也不启动日常采集或调度。

## 官方依据

已实际检索并打开 [Codex 非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)，并以本机 `codex exec --help` 核对 `--ignore-user-config` 保留原认证位置。官方[配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)说明推理强度覆盖；[模型使用示例](https://learn.chatgpt.com/use-cases/make-granular-ui-changes)列出 `gpt-6-astra` 配合 `medium`；[Hooks](https://learn.chatgpt.com/docs/hooks)说明 `features.hooks=false`。账户是否实际可用仍以此次调用为准，文档没有被当作账户资格 PASS。
