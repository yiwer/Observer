# V1-04 审查与验收记录

状态：**候选审查发现缺陷，尚未验收**。GitHub #4 OPEN；原产品测试通过，但 Spec 负例已由 Root 复现，须修复后重新冻结，不能关闭票或宣告生产通过。

- 范围：[GitHub #4](https://github.com/yiwer/Observer/issues/4)、[本地票](../tickets/04-codex-runner.md)。
- 固定起点：`320ab620a2d3f22c09e13334a68f06a3b664af05`；fresh agent `/root/implement_v1_04`。
- 工作区：`O:/GenesisCode/Observer-worktrees/v1-04`，分支 `ticket/v1-04`。
- [启动记录](https://github.com/yiwer/Observer/issues/4#issuecomment-5550300477)；依赖 #3 已关闭且本地验收集成。

## 冻结候选与独立复跑

- 候选 SHA：`f836d7d49bb907b4b36a3843932e7b4e6297c403`；固定起点至 HEAD 只有 `f836d7d feat: add isolated Codex research runner (#4)`。Root 已核实三点 diff 非空（18 files，1117+/15-），实施工作树干净。
- 两个 fresh reviewer `/root/review_v1_04_standards` 与 `/root/review_v1_04_spec` 并行只读审查同一 SHA；不与作者互换结论。
- Root 独立 detached worktree：`O:/GenesisCode/Observer-worktrees/accept-v1-04`，HEAD 同上。`npm ci` 安装 7 个锁定包；`npm run check` typecheck/build 成功、**70/70**、0 skipped，测试阶段 **45.835 秒**；`npm run smoke` **3/3**（旧测试子集）。工作树 tracked diff 为空。
- Root 另在该工作树 ignored `data/root-acceptance/codex-first-send.test.ts` 通过公开 produce/readReport seam 加测 **2/2**：启动阶段后、首次实际模型发送前到期时 sends=0，错误为 `agent-evidence-expired`，没有报告；同样材料未到期时 sends=1，正文正常。两者都按返回的精确容器 ID 读回已不存在。此脚本不是产品测试计数的一部分。
- 70 个产品测试包含原生 Linux Codex 0.153.4 + 无凭证 Responses 协议替身、恶意工具拒绝、超时/取消后代清理、编译运行资产、第二次发送 TTL 及实际 Docker `none` 日志测试。因此后文“未冻结”阶段问题已有候选内修复与上述独立回归；保留阶段记录用于追踪，不把其早期状态误读为当前结论。
- 尚未本地集成，未 push；Standards/Spec 或 Root 后续发现若导致代码变化，必须重新冻结并复跑，不沿用该 SHA 的通过证据。

## 运行时预检

2026-09-05，root 启动本机已有 Docker Desktop，以便本票执行不需要模型的本地隔离测试；未读取凭证、安装虚拟机、调用模型或修改已有容器。启动后已有 10 个其他项目容器均保持 exited。

- Docker Desktop 4.82.0 (233772)；Linux Engine 29.6.1 / API 1.55 / amd64。
- Kernel `6.18.33.2-microsoft-standard-WSL2`；安全选项报告 `seccomp,builtin`、`cgroupns`。
- 本地可用 Python 镜像：`python:3.12-slim-bookworm`，镜像 ID `sha256:183e5ad42322fea6f731433ae7f6be7498812b31d2eaf05537ffed838dd1ba7c`，RepoDigest `python@sha256:a116514e19457bcb7af7efe9c3dd0b9b71e85b317694e7882a1c52aa15a78134`。
- 预检未发现 Linux Node/Codex 镜像。Windows 已安装 CLI 的帮助版本为 codex-cli 0.153.4，不能据此声称 Linux 二进制或权限行为已测试。

这些只是环境库存与就绪性，不证明实现的隔离、进程回收、协议或真实接入通过。本票新测试资源必须有独有身份；不清理现有容器、镜像、网络或卷。

## 待冻结后核验

沿已确认的公开 `produce` → `readReport` seam，关注完整 Bundle→外部进程→适配器→Gate→归档，不只验证事件解析函数。保留正常候选路径，同时验证失败不能生成发布版本。

1. 版本化 CLI 参数、进程退出、终态、最终结构、业务身份各自核验；矛盾/重复/晚到失败不能被有利结果遮盖。
2. 候选与原始事件始终是数据；正文必须经 Gate，stderr/错误事件不得带入秘密或归档。未知消耗不能等于零。
3. 实际读取/写入/联网/提权尝试的拒绝证据，区分工具权限、文件系统、进程和模型网络；`noexec` 不能单独证明解释器无法运行候选代码。
4. 超时、取消、异常路径回收本任务完整进程树，按不可变运行身份定位，不影响旁路正常任务；输出与耗时有界。
5. 协议替身、原生 CLI 帮助、Linux 容器运行、真实模型/地域资格分别标明。断网替身成功不证明真实模型可达；待授权实测和仍待实现的能力必须分开。

## 实施阶段更新（未冻结）

[GitHub 进度回写](https://github.com/yiwer/Observer/issues/4#issuecomment-5550338282)，已读回 OPEN。以下为实施 agent 的阶段报告，不替代 Root 独立验收或最终测试计数：

- 首片完整业务链路由 `agent-unknown` 红灯到正文正常归档绿灯；外部程序是实际隔离运行的 Python 协议替身，不是真实模型。
- 12 类退出/事件/最终输出异常矩阵由“非零退出仍归档”红灯推进到绿灯，阶段 typecheck 通过。
- 当前处理真实后代继承输出管道导致超时/取消悬挂的红灯；尚不能宣告进程树清理合格。
- 为避免 Windows bind mount 权限语义掩盖 Linux UID 不匹配，实施 agent 将采用受控 stdin 投送；编译产物也须包含进程辅助资产并实测。
- 拟获取固定且校验完整性的 Linux CLI，以本地无凭证模型协议替身测试实际工具拒绝；这项尚未完成，不能把计划写成实测。

后续阶段报告：timeout/cancel 已转绿，按 ID/label/Created 核验回收并读回 removed。为避免下面记录的 internal gateway 例外，模型通道改用断网容器内仅 loopback 的 HTTP broker，经可信 supervisor 的 stdout 控制帧与宿主 stdin 响应连接固定 ModelTransport；宿主仅执行模型协议，密钥留在隔离边界外。该通道与实际 CLI 拒绝测试仍在实施，未冻结，不能提前记通过。

## Linux CLI 依赖取得

实施 agent 的 `npm pack` 工具 session 18443 长时间无输出且目标目录空，但进程仍在运行。Root 没有凭观察超时重启或终止它；另对同一公开 tarball 做范围请求，确认服务返回 206 及总长度，再用独立临时目录执行有界 `curl -q` 下载。

- 包：`@openai/codex@0.153.4-linux-x64`；[版本元数据](https://registry.npmjs.org/@openai/codex/0.153.4-linux-x64)，[原始 tarball](https://registry.npmjs.org/@openai/codex/-/codex-0.153.4-linux-x64.tgz)。Root 独立重新读取 metadata 后核验。
- 下载退出 0，129272137 bytes，47.480581 秒。SHA-512 与 metadata `dist.integrity` 完全一致：`sha512-x1EcwBlY3AObM1VTUHNM2AzAJQsyreGdagpF+qFiYi/Oa30VBktvvG0C6tLtCzqW6hjZNWkGZQWmeVk7MuJKWg==`。
- 下载文件 SHA-256：`54818cb9fce3360cc6e44cfc5a96952cd5c1243efb43cbe488e11dda84663e08`。
- 只读 tar 清单确认 CLI 位于 `package/vendor/x86_64-unknown-linux-musl/bin/codex`，另有 code-mode host、bwrap、rg、zsh 等资源；不能沿用旧目录猜测。

已将已核验文件交给实施 agent 做本票镜像/CLI 测试，未改变宿主 CLI 安装或读取凭证。完整性匹配只确认取得了指定分发物，不证明模型可用性、安全拒绝、真实调用或生产资格。原 npm session 由创建它的 agent 按准确工具句柄或进程身份处理，不全局杀 node/npm。

实施 agent 随后确认：复制文件后再次匹配上述 SHA-256；按原工具 session 18443 发送 Ctrl-C，命令退出 1，未按裸 PID 杀进程。构建得到镜像 `sha256:12226892754c245087a7285475dad50d58322e7b9d637ba40850370c37cc5024`（tag `observer-v1-04-codex:0.153.4`），并报告首次真实 Linux CLI→本地无凭证 Responses 替身→JSONL/最终文件→Gate→SQLite 正文测试通过。

Root 独立读过 `config/codex-runtime.Dockerfile`，inspect 精确镜像身份为 Linux/amd64、459308449 bytes；另用独有名称/label、无网络、只读根、非 root、无 capabilities 的一次性容器执行 `/opt/codex/bin/codex --version`，输出 `codex-cli 0.153.4`、退出 0。只有无法写 PATH 别名的只读警告，自动移除后读回无该测试容器。Root 的这一步仅证明当前镜像二进制版本，尚未独立复跑完整业务或安全测试。

## Root 模型发送时刻的有效期检查

未冻结实现的接入检查发现：已有 Observer 在调用 Runner 前核验 Bundle v2 TTL，但容器启动和多轮 Responses 往返会跨越时间。每次实际 `ModelTransport.respond` 必须依据可信任务快照重新检查材料有效期，不能信任 CLI 请求体自行声称的 expiry。已交实施 agent 补延迟首请求及后续请求过期的红绿回归，保留未过期正常路径。此项目前是待实现/验收的 D6 约束，不记已修复或 PASS。

实施 agent 随后报告 red→green：受控时钟在第一次 Responses 后到期，旧实现仍发送第 2 次；现第 2 次发送前拒绝 `agent-evidence-expired`、清理容器且无报告，同一场景未过期正例仍发送两次并归档。Root 仍须在最终冻结 SHA 独立复跑。

## Root Docker 日志旁路检查

Root 实际读取 daemon logging driver 为 `json-file`，未冻结的 create 参数尚未覆盖它；可信 supervisor 的 stdout 含完整 `model-request` 控制帧，不能因为宿主只保留脱敏分类就推断容器日志未缓存原文。Docker 官方[日志说明](https://docs.docker.com/engine/logging/configure/)确认默认内部 JSON 缓存、可按容器选择 driver，`none` 不提供容器日志。

已要求只对本任务显式关闭原始 Docker 日志或做等效保护，验证 attach/正常业务仍可用且日志不可取原文；不修改全局 daemon 或既有容器。此项尚待修复与最终实测。

## 临时测试产物

实施 agent 报告 compiled 产物用例初次因 after 清理先于 SQLite close 而出现 EBUSY；改为 try/finally close 后转绿。那次失败遗留 `C:/Users/16348/AppData/Local/Temp/observer-codex-O2hbGJ`（仅本任务虚构归档）。其 PowerShell 清理命令被自动策略拒绝，未重试或换工具绕过，Root 也保持不触碰。该残留不代表用户原有数据被删；最终交接须保留此说明，不把 Git clean 扩写成全部临时目录已清理。实施 agent 报告当前没有任务容器残留。

## Root 网络前提核查

Root 实际打开 Docker 官方 [network create](https://docs.docker.com/reference/cli/docker/network/create/#network-internal-mode---internal) 和 [gateway modes](https://docs.docker.com/engine/network/port-publishing/#gateway-modes)：普通 `--internal` bridge 仍可访问网关地址上的宿主服务，包含监听所有地址的服务；`isolated` gateway mode 配合 internal 才不向 bridge 分配地址。因此仅检查 `Internal=true` 及已连接容器名单，不能证明模型专用网络已隔离宿主旁路。

已将此约束传给实施 agent：专用网络须核验实际等效隔离条件，并同时保留代理正常可达和宿主旁路拒绝证据，覆盖启用的地址族。不修改用户已有网络或全局 daemon。此处是官方行为与实现验收前提，尚非候选代码的实测通过结论。

## Standards

`/root/review_v1_04_standards` 针对 `f836d7d` 检查完整 18 文件差异及 CONTEXT、README、PRD D6/D7/T1、指定 ADR，报告 **0 项**有充分证据的标准违反或 Fowler smell；最高严重性：无。该轴仅执行只读 diff/状态检查，没有重复运行产品测试，也不把作者 70/70 当作其独立实测。

Reviewer 初步提出 `codex-container.ts` 可能 Divergent Change，最终未保留。Root 提醒实现说明中的职责描述本身不能把任何复杂模块自动视作被标准认可；当前没有独立可操作的维护成本证据，故仍不列额外发现。

## Spec

`/root/review_v1_04_spec` 已实测确认 **P2：拒绝模型工具时丢失已取得用量**，正式轴报告待收尾。#4 AC5 要求“保留……可取得的用量；取不到的用量明确未知”。`src/codex-container.ts:76` 在拿到带 usage 的 HTTP 200 完成响应后因 function_call 立即拒绝，`src/codex-runner.ts:46` 仅采用尚未产生的 CLI usage，故已取得的 input/output/cached/reasoning tokens 都变为 null。

Root 在同冻结 SHA 的独立工作树以公开 `produce` → 错误/私有读取 seam 复现：ignored `data/root-acceptance/codex-rejected-usage.test.ts`，真实固定 CLI + 自有模型替身返回 response.completed 含禁止工具和 tokens 12/21/2/3，任务正确拒绝 `agent-policy-violation`、cleanup=removed，但用量断言 **expected 12 / actual null** 红灯。应保留有明确来源的已观察用量，不把 transport 与 CLI 两份重复累加，未知字段仍 null；没有真实模型或凭证参与。

当前不得沿用产品 70/70 宣告验收。修复后需新 SHA、两轴复审和 Root 再跑完整及专项回归。

## 外部门槛

没有真实 Provider 认证、地域资格、付费调用、事实质量或生产部署证据。生产发布仍不得因本地测试开启。当前提交均未 push。
