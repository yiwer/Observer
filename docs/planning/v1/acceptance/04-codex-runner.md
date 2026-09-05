# V1-04 审查与验收记录

状态：**实施中，尚未验收**。GitHub #4 OPEN；没有固定实施候选或双轴最终结论。此文是执行与证据边界，不是通过证明。

- 范围：[GitHub #4](https://github.com/yiwer/Observer/issues/4)、[本地票](../tickets/04-codex-runner.md)。
- 固定起点：`320ab620a2d3f22c09e13334a68f06a3b664af05`；fresh agent `/root/implement_v1_04`。
- 工作区：`O:/GenesisCode/Observer-worktrees/v1-04`，分支 `ticket/v1-04`。
- [启动记录](https://github.com/yiwer/Observer/issues/4#issuecomment-5550300477)；依赖 #3 已关闭且本地验收集成。

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

## Root 网络前提核查

Root 实际打开 Docker 官方 [network create](https://docs.docker.com/reference/cli/docker/network/create/#network-internal-mode---internal) 和 [gateway modes](https://docs.docker.com/engine/network/port-publishing/#gateway-modes)：普通 `--internal` bridge 仍可访问网关地址上的宿主服务，包含监听所有地址的服务；`isolated` gateway mode 配合 internal 才不向 bridge 分配地址。因此仅检查 `Internal=true` 及已连接容器名单，不能证明模型专用网络已隔离宿主旁路。

已将此约束传给实施 agent：专用网络须核验实际等效隔离条件，并同时保留代理正常可达和宿主旁路拒绝证据，覆盖启用的地址族。不修改用户已有网络或全局 daemon。此处是官方行为与实现验收前提，尚非候选代码的实测通过结论。

## Standards

等待固定非空三点 diff 后独立 review；当前没有结论。

## Spec

等待固定非空三点 diff 后独立 review；当前没有结论。

## 外部门槛

没有真实 Provider 认证、地域资格、付费调用、事实质量或生产部署证据。生产发布仍不得因本地测试开启。当前提交均未 push。
