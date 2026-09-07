# Docker + Sandcastle 作为 coding agent 沙箱的可行性研究

> 研究日期：2026-09-07（Asia/Shanghai）；首次版本查询：2026-09-07 11:56 UTC。  
> 对象仅为 `mattpocock/sandcastle` / npm `@ai-hero/sandcastle`，不是其他同名项目，也不是 Docker 官方 Sandboxes。  
> 固定源码：`e99f832f26dc9d245c019a9ddd19fa5dee792427`，对应 package version `0.12.0`；GitHub latest release 为 `v0.12.0`，发布时间 `2026-06-29T20:16:27Z`。仓库查询时未归档。[固定提交][commit]｜[release][release]｜[package.json][package]
> 方法：research skill 指定的独立后台研究；Codex 细节辅以 OpenAI Docs 和当前官方文档。只读取官方仓库、源码、测试、文档，以及 Observer 已实现 Runner；没有安装依赖、执行 Sandcastle 代码、启动容器或模型、读取凭据，也没有进行安全攻击测试。研究不等于采纳、实现验收或安全认证。

## 结论

**技术上可行，作为“可信代码仓库上的并行编码/评审编排层”有条件推荐；作为 Observer V1 新闻研究 Runner 的直接替换，不推荐。** 它的优势是统一 agent 调用、Git worktree/分支流程、会话、流式输出及沙箱生命周期；安全隔离主要来自所选 provider，而不是一个叠加在 Docker 之上的新安全内核。[README][readme]｜[Docker provider][docker-provider]

默认接入不能称为 Observer 的“安全升级”：当前 Sandcastle Docker 路径是可写工作区、默认联网、允许 agent 完整编码工具的工作流；Observer 当前是离线、只读、资源受限的容器，通过宿主可信 model broker 处理指定 Evidence Bundle。两者目标不同。下文建议保留后者，仅把前者作为独立开发工具候选。[Sandcastle 启动参数][docker-life]｜[Observer 容器边界](../../src/agent-container.ts)｜[Observer Codex Runner](../../src/codex-runner.ts)｜[Observer Claude Runner](../../src/claude-runner.ts)

## 1. 它实际提供什么

通常的组合是“可信宿主上的 TypeScript 调度程序 → Sandcastle 的 `docker()` provider → Docker daemon 创建普通 Linux container → 容器内 Codex/Claude CLI”。**不要求 Docker-in-Docker，也不要求给 agent 挂宿主 Docker socket。** 宿主编排程序当然需要控制 daemon 的权限；该程序及其配置、hooks 属于可信控制面。[Docker provider][docker-provider]｜[容器启动实现][docker-life]

Sandcastle 与 Docker 的关系是互补：Docker 负责操作系统进程/文件系统/网络边界；Sandcastle 负责工作区、调用和结果管理。再次把整套控制面装进外层 Docker，不会自动增加有效隔离；若为了调度内层容器而把宿主 socket 传进去，反而扩大控制面的权限。rootful daemon 的控制权通常足以挂载、修改宿主文件系统，不能交给处理不可信材料的 agent。[Docker daemon 安全文档][docker-security]

还要区分 **Docker 官方 Sandboxes**：其当前架构是独立 VM、独立 Docker daemon、代理和 MCP gateway；Sandcastle 的内置 `docker()` 调用普通 `docker run`，没有自动使用这套产品。若未来考虑 VM 型隔离，应单独评估 provider 与平台支持，不能把名字相似当成已经集成。[Docker Sandboxes 架构][docker-sandboxes]｜[Sandcastle Docker 实现][docker-life]

### Codex / Claude 的调起

- 内置 Codex provider 用 `codex exec`、JSONL、stdin；默认添加 `--dangerously-bypass-approvals-and-sandbox`。`auto_review` 选项改用审批 reviewer，但仍设置 `danger-full-access`。内置 Claude provider 用 print/stream-json/stdin，AFK 编排默认传入跳过权限的设置；显式 `permissionMode` 可替代它。[AgentProvider][agent]｜[Orchestrator][orchestrator]
- 这些 dangerous flags 表示把相应的内层沙箱/授权责任交给外层环境，**本身不是“已经发现容器逃逸漏洞”**。是否合适取决于外层的真实挂载、网络、身份和能力限制。无人值守也不必然需要 full access：OpenAI 官方支持明确的只读非交互模式；Claude 官方也提供程序化输出与工具权限配置。[OpenAI 非交互模式][codex-headless]｜[OpenAI 授权与安全][codex-security]｜[Claude 程序化调用][claude-headless]
- Sandcastle 内置 provider 没有表达 Observer 当前完整的禁工具、空 MCP、忽略个人配置、临时会话、原生输出 schema 及 broker 协议配置。`Output.object` 是在结果文本中取最后一个标签、解析 JSON、做 Standard Schema 校验；它不是自动透传 Codex `--output-schema` / Claude `--json-schema`，更不是事实真实性证明。[AgentProvider][agent]｜[结构化输出提取][output]

## 2. 安全边界：默认行为与需要补齐的部分

下表是固定源码的静态结论，不是已经执行过的逃逸测试。

| 边界 | 固定版本实际行为 | 判断与建议 |
|---|---|---|
| 工作区 / Git | Docker 默认 branch strategy 是 `head`；工作目录及 Git 相关目录使用 bind mount，内部 Git mounts 未标只读。worktree 模式仍会挂共享父 `.git`。 | 可写宿主当前 checkout 或共享 Git 元数据是设计授权，不是容器逃逸；worktree 不是恶意 agent 之间的安全隔离。试点用无秘密的独立 clone，显式独立 branch，不自动合并生产分支。[默认策略][run]｜[Git mounts][factory] |
| 文件 / 进程 | Docker 提供 namespaces；provider 默认按宿主 UID/GID（不可用时 1000）运行，但显式配置或 root 宿主可改变它；不是无条件保证非 root。 | 不挂 HOME、SSH、生产数据、浏览器 profile；最小 writable scratch、只读输入。保留 Docker 默认 seccomp，并审查额外能力。[provider][docker-provider]｜[Docker 安全][docker-security]｜[seccomp][seccomp] |
| 额外加固 / 资源 | `DockerOptions` 提供 CPU 选项，但未提供 memory、pids、只读 rootfs、cap-drop、no-new-privileges 的配置；启动实现也没有这些 flags。未设 CPU 时也不限制它。 | 不能靠一份 Dockerfile补上全部 runtime 控制；若用于不可信运行，需自定义 provider/受控运行层，补齐资源与权限约束。[选项][docker-provider]｜[启动命令][docker-life] |
| 网络 | 未设 `network` 时走 default bridge；支持显式 `none` 或指定网络，但没有内置域名/方法/路径级 egress policy。 | “没暴露端口”不等于不能向外连接；默认还可能访问同桥容器。VPN/VPS 改变可达性，不构成来源授权或数据外泄防线。研究任务优先继续可信采集 + 离线推理；确需联网时由外部 broker/proxy 限制请求。[provider][docker-provider]｜[Docker networking][docker-network] |
| secrets | `.sandcastle/.env` 声明的键可从文件或 process.env 解析，再通过 Docker 环境变量进入容器；不是把所有宿主 env 无差别继承，但被注入的值对容器进程可见。 | 不注入 QQ SMTP、GitHub 管理 PAT、云权限等与研究无关的秘密；日志、模型输入或允许的外联都可能成为泄漏出口。优先短期最小凭据或宿主代签/broker。[EnvResolver][env]｜[Docker env 传递][docker-life] |
| Docker socket / devices | 默认不挂 socket、不加 privileged；可配置 mounts、groups、devices，文档明确给出 socket 用途。 | 不向 agent 开放宿主 daemon/socket 或任意 host device。需要 agent 构建 Docker 时另开专用隔离主机/VM 方案，不能把它当一个无害参数。[provider][docker-provider]｜[Docker daemon 边界][docker-security] |
| browser / MCP | 内置 provider 不提供统一浏览器/MCP安全策略；这些能力取决于 CLI 配置与接入服务。 | 容器内 browser/stdio MCP 继承容器边界；远端 MCP、宿主浏览器控制端点仍拥有自身权限，容器不会撤销它们的外部写权限。禁用无关连接，分离只读工具与发布/邮件工具。[AgentProvider][agent]｜[OpenAI 通道边界][codex-security]｜[Claude scope][claude-sandbox] |
| prompt injection | 沙箱限制可执行动作及可接触资源，不判定新闻或 repo 文本是否可信。 | 仍可能污染摘要、伪造引用、输出不实结果，或滥用已允许的域名/API。域名 allowlist 不是内容防泄漏承诺；最终来源、时效、引用和发布校验必须留在可信应用。[OpenAI 安全][codex-security]｜[Claude 安全限制][claude-sandbox] |

Claude 的内置 Bash sandbox 与外层 Docker 也不是一回事：官方说明其 OS sandbox 只覆盖 Bash 子进程；原生 Windows 不支持，Linux/WSL2 有依赖和嵌套限制。在容器里启用内层隔离可能涉及 weaker nested mode；不要为“能启动”就自动加 privileged、放开 seccomp 或暴露 socket。先验证外层满足所需边界，再决定是否保留内层机制。[Claude sandbox 平台、scope 与 nested 限制][claude-sandbox]

## 3. 无人值守、并发与生命周期

有用的现成能力包括 `run()` 的自动生命周期、可复用 `createSandbox()`、会话 resume/fork、流式文本/工具事件/usage、日志，以及 worktree lock。命名 branch 的 lock 采用 PID 存活判断并在冲突时快速失败；它不是跨主机队列，也不覆盖 `head` 的宿主工作目录。Observer 的每日调度、截稿、重试与并发配额仍需应用自己管理。[README][readme]｜[worktree lock ADR][locks]

关键限制：

1. **Idle timeout 不是总截止时间。** 默认 idle 600 秒，每条输出重置；completion signal 后还有默认 60 秒 grace，并可能在进程未退出时使用已缓冲结果完成。活跃输出可以一直延长运行。总 wall-clock deadline、输出总量、并发上限应由上层强制执行，不能用完成字符串代替实际成功退出和完整结果验收。[Orchestrator][orchestrator]
2. **暖沙箱取消存在需要实测的静态缺口。** `createSandbox().run()` 文档声称 abort 杀掉在途 subprocess；但所读调用链是 Orchestrator 竞速 AbortSignal → `makeSandboxFromHandle` 包装 Promise → Docker `exec` 启动 child。该 exec 接口未传 signal，也没看到取消时 kill child 的实现。推断：Promise 拒绝未必停止暖容器里的实际任务，旧任务可能与下一轮重叠。**尚未复现，不能当成已确认漏洞或完整故障诊断；纳入采用前硬性 PoC。** 一次性 `run()` 另有外层 close，但还受下一项限制。[warm API][create]｜[竞速路径][orchestrator]｜[Promise wrapper][factory]｜[Docker exec][docker-provider]
3. **删除不是确认删除。** 常规 `removeContainer()` 忽略 `stop` 与 `rm` 错误；退出时 `rm -f` 也是 best-effort，且同步调用未设超时。不能由 `close()` 返回就认定整个进程树已消失。还需按不可变容器 ID/任务身份 readback，并把无法确认清理作为失败；宿主被强杀、daemon 不可达、机器重启另需可靠回收策略。[常规清理][docker-life]｜[退出清理][docker-provider]｜[shutdown registry][shutdown]
4. **流式尾部有界不等于全链路有界。** Docker provider 在 `onLine` 模式限制返回的 stdout/stderr tail，但没有 callback 时会累积输出；Orchestrator 另累积 parsed output，日志也持续写入。需要独立 total bytes、日志轮转/脱敏和磁盘限额。[Docker exec][docker-provider]｜[输出累积][orchestrator]｜[日志实现][display]
5. **重试有意不内置。** 官方项目决策把 provider 错误重试留给 harness，Sandcastle 自身 fail-fast；CLI 自己的重试与上层重试不能混为一谈。[不内置重试的项目决策][retry]

会话捕获默认对当前 Codex/Claude provider 开启，会把 session 内容带回宿主。对个人编码续跑很有价值；对来源材料带引用权限/有效期、需要最少留存的日报，需要显式禁用或受控存储及保留策略，不能把它当无成本附属日志。[AgentProvider 会话配置与存储][agent]

## 4. Linux / Windows 与成熟度

- **Linux 单机：可行性较高。** 标准路径只依赖宿主 Node/Git/Docker 与容器内所需 CLI，不要求嵌套虚拟化。建议专用非 root 调度身份，并评估 rootless Docker；rootless 能缩小 daemon 权限，但不能撤销已授权挂载和网络访问。[Docker provider][docker-provider]｜[rootless 官方文档][rootless]
- **Windows + Docker Desktop Linux engine：有意支持，但仍需真实平台验收。** 项目有针对 Windows `.git` worktree 指针的 POSIX mount 重映射 ADR，以及 Windows mounts/session-path 测试；不能因此宣称本机路径、权限、取消与清理已通过。所读 CI 仅 Ubuntu + Node 22 build/test，没有 Windows 真 Docker 矩阵。[Windows mounts ADR][windows]｜[测试源码目录][source-tree]｜[CI][ci]
- **维护状态：早期但非空壳。** 查询时仓库创建于 2026-03-17、最新 push/release 为 2026-06-29，版本仍为 0.x；距研究日约 70 天无新 push 不能单独推断项目已放弃。固定 tree 有 53 个 `.test.ts` 文件，但读取的 Docker 生命周期/provider 测试 mock 了 `node:child_process`，不是 53 个真实容器验收，更不是本次测试 PASS。[GitHub API 元数据][repo-api]｜[release][release]｜[测试目录][source-tree]｜[生命周期测试][lifecycle-tests]｜[provider 测试][provider-tests]
- **依赖与供应链：必须锁定。** package 包含 lockfile、MIT 许可证；Effect 等构建输入被打包，发布包不能仅按 package.json 的一个直接 runtime dependency 判断攻击面。仓库示例 Dockerfile 使用 `node:22-bookworm` 标签和在线 Claude installer，不能据此得到可复现 CLI 版本。PoC 应固定 npm 包、lock、构建依赖、基础 image digest 和 CLI 版本，记录镜像 digest；不在任务启动时追 latest。[package][package]｜[打包配置][tsup]｜[lockfile][lockfile]｜[示例 Dockerfile][dockerfile]｜[MIT][license]

未在本次抽样材料中建立独立安全审计、长期支持、故障恢复 SLA 或对 Observer 所固定 CLI 版本的兼容保证；也没有下载 npm 发布 tarball 核对其与该 Git commit 的逐字节一致性。这些保持“未验证”，不写成“已安全”。

## 5. 与 Observer 当前实现的适配成本

本次对照基线为本地 master `f9371ec5af8d7a4eb4dbc9dfeb3ee268e0cb85b1`；研究末复查下列三个文件相对该 SHA 无差异。这里以当前实现为准，不把较早的开放式研究建议当成已经采纳的运行权限。

| 方面 | Observer 现有实现 | 换成 Sandcastle 内置 provider 的影响 |
|---|---|---|
| 运行目标 | 指定 Evidence Bundle → Claim candidates；不在 agent 内任意抓取/编译/安装 | 编码、分支、commit 收集并不是日报的核心收益 |
| 容器身份 / 资源 | image 必须 SHA-256；唯一任务容器；network none、rootfs read-only、cap-drop ALL、no-new-privileges；PID 32、CPU 1、内存 256/512 MiB；只读 worker 挂载、限额 tmpfs | 默认能力不等价，需要新 provider 或继续使用当前运行层 |
| 模型 / 秘密 | stdio broker；宿主限制 model、请求次数、tool/storage 设置，并检查返回中不可含执行工具；环境最小化 | 直接 env token + 出网 CLI 不可无损替换；broker 是应用安全边界，不只是登录方式 |
| 可交付结果 | CLI 版本/终态/退出码/结构与 usage 验证；输入/输出/时限有界；取消、过期、清理失败区分 | 文本 completion 与 tag/schema 校验不足以取代这些协议与账本 |
| 清理 | 核对容器 ID、创建时间、镜像、任务 labels，强制删除后 readback；不能确认即 cleanup-failed | 需要补齐，不能仅依赖 `close()` |

以上逐项对应 [agent-container.ts](../../src/agent-container.ts)、[codex-runner.ts](../../src/codex-runner.ts)、[claude-runner.ts](../../src/claude-runner.ts)；Sandcastle 的对应实现见 [Docker provider][docker-provider]、[AgentProvider][agent]、[cleanup][docker-life]。

工程判断：单独做一个编码辅助脚本的接入成本低至中；**保留 Observer 当前安全/审计契约的生产迁移成本中至高**，因为需要自定义 provider、CLI 协议适配、broker、失败语义和重新验收，而不只是换一行 `run()`。这里是工作量性质判断，不是已估算工期。若最终仍调用现有 Runner，仅为研究调用增加一层 Git 编排，收益可能不足以抵消维护面。

## 6. 最小可验证 PoC（建议，未执行、未采纳）

限定为一个独立、无真实秘密的临时仓库与专用 Docker 环境；不接 Observer 正式库、SMTP、发布 API、真实新闻数据或 #13 数据库。先 mock agent/模型路径验证 runtime，再在单独批准的阶段接本机可用 Codex；Claude 按用户既有决定继续等待后续环境。

1. **冻结与配置检查：** 固定上述源码/npm 版本、CLI、image digest 与测试宿主；默认 provider 与加固候选分别记录实际 inspect 参数、mounts、网络、UID、资源。禁止 `head`、宿主 socket/device、共享 HOME；使用独立 clone 和命名 branch。与上表逐项比较，不靠 README 宣称达标。
2. **文件与外联边界：** 使用自建 canary 文件和本地测试服务，验证只能修改授权 scratch；无法读取宿主 canary、改其他任务/主库 Git 元数据、访问未批准网络/宿主服务。模拟秘密不能经日志或请求外发；整个测试不用真实 token。网络失败必须显式报告，不降级到无限制出网。
3. **取消与清理硬门：** one-shot 和 warm 两条路径分别运行可控的父/子进程，测试 idle、持续输出直到总 deadline、AbortSignal、退出信号；检查旧任务确实停止，下一任务不被旧进程影响。注入 daemon 不可达或删除失败，结果必须是 cleanup-failed，不能假成功。按任务不可变 ID 验证，禁止广域清理。
4. **并发与容量：** 同一 branch 冲突要明确失败；不同 clone/branch 两任务可并发且互不修改。验证总输出限制、磁盘日志上限、资源上限、任务排队与总 deadline。先验证有界性，再测吞吐；不先承诺启动速度或节省比例。
5. **输入与结果：** 用固定中文 Evidence Bundle（含伪造指令/来源/完成字符串）测试 prompt injection 不产生越权副作用；严格 JSON、来源/时效校验拒绝不合格结果。验收依赖真实 exit/协议和可信检查，而非 `<promise>` 或“模型说已完成”。记录 provider/CLI 的退出与 usage 差异。
6. **Go / no-go：** 仅当边界、cleanup 和并发门通过，且对比现有 Runner 有明确可量化收益，才提出单独 ADR/ticket。否则保留为开发编排工具；不替换生产 Runner。任何 VM/provider 扩展或真实 Claude 测试另列范围与验收。

**建议下一步只批准这个有限 PoC，而不是把 Sandcastle 加入 V1 主依赖。** 它有真实的编排价值，但“采用 Docker + Sandcastle”本身不能证明沙箱足够强、新闻足够真或 8:30 必达。

[commit]: https://github.com/mattpocock/sandcastle/commit/e99f832f26dc9d245c019a9ddd19fa5dee792427
[release]: https://github.com/mattpocock/sandcastle/releases/tag/v0.12.0
[repo-api]: https://api.github.com/repos/mattpocock/sandcastle
[readme]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/README.md
[package]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/package.json
[docker-provider]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/sandboxes/docker.ts
[docker-life]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/DockerLifecycle.ts
[agent]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/AgentProvider.ts
[orchestrator]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/Orchestrator.ts
[factory]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/SandboxFactory.ts
[run]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/run.ts
[env]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/EnvResolver.ts
[output]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/extractStructuredOutput.ts
[create]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/createSandbox.ts
[shutdown]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/shutdownRegistry.ts
[display]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/Display.ts
[locks]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/docs/adr/0007-worktree-locking.md
[windows]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/docs/adr/0006-git-worktree-mounts-on-windows.md
[retry]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/.out-of-scope/provider-error-retry.md
[dockerfile]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/.sandcastle/Dockerfile
[source-tree]: https://github.com/mattpocock/sandcastle/tree/e99f832f26dc9d245c019a9ddd19fa5dee792427/src
[ci]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/.github/workflows/ci.yml
[lifecycle-tests]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/DockerLifecycle.test.ts
[provider-tests]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/src/sandboxes/docker.test.ts
[tsup]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/tsup.config.ts
[lockfile]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/package-lock.json
[license]: https://github.com/mattpocock/sandcastle/blob/e99f832f26dc9d245c019a9ddd19fa5dee792427/LICENSE
[docker-security]: https://docs.docker.com/engine/security/
[docker-network]: https://docs.docker.com/engine/network/
[rootless]: https://docs.docker.com/engine/security/rootless/
[seccomp]: https://docs.docker.com/engine/security/seccomp/
[docker-sandboxes]: https://docs.docker.com/ai/sandboxes/architecture/
[codex-headless]: https://learn.chatgpt.com/docs/non-interactive-mode
[codex-security]: https://learn.chatgpt.com/docs/agent-approvals-security
[claude-headless]: https://code.claude.com/docs/en/headless
[claude-sandbox]: https://code.claude.com/docs/en/sandboxing
