# V1 orchestrator 执行记录

Owner 已授权：按 ticket 顺序逐个派发 fresh-context subagent，使用 implement skill 实现并提交，由 orchestrator review、验收和集成。此授权不包含资源购买、未经批准的真实付费调用、正式投递或自动跳过人工验收。

## 接续规则

1. 从当前 Git 和 GitHub 实际状态恢复，不从聊天摘要猜测完成。
2. 每次只推进一张实施票；固定 worktree、起始提交和验收范围，再派发 subagent。
3. 采用已确认 PRD T1 seam 做 TDD；定期 typecheck、针对性测试，票末运行完整测试。
4. implement 的 code-review 使用 Standards / Spec 两轴独立审查；orchestrator 另做结果核对和集成基线验收。未解决阻断发现不算完成。
5. 票通过后集成提交、记录证据，再关闭 Issue 并推进下一张；外部门槛单独记录，不把开发测试替代实测。
6. 提交代码不等于 push。当前 GitHub 票已发布，代码是否推送由实际 Git 状态说明。

## 当前停止点

- 已完成票：#1、#2、#3、#4，均完成实施、双轴 review、独立冻结验收及本地 master 集成，GitHub 已读回 CLOSED。
- 当前票：V1-05 / GitHub #5，进行中；原生依赖只有 #3，已于 2026-09-05 读回 CLOSED。fresh-context implement agent `/root/implement_v1_05` 已派发，base `8e35d12470c14f2638d3adbcd1901935feeaa593`；worktree `O:/GenesisCode/Observer-worktrees/v1-05`，branch `ticket/v1-05`；[启动回写](https://github.com/yiwer/Observer/issues/5#issuecomment-5550574214)已读回 OPEN、assignee=yiwer，详见 [#5 执行边界](acceptance/05-claude-runner.md)。
- #5 首个冻结候选 `0b967c6273b2d768f46df4ce8b546508a0d41784`（26 files，+1023/-57）；作者 check 94/94、smoke 3/3，工作树干净。Root 已固定非空三点 diff，派发 fresh Standards / Spec 两轴，在 detached `O:/GenesisCode/Observer-worktrees/accept-v1-05` 独立复跑；未出最终验收结论，不启动 #6 实施。
- #4 最终实施 `139dc1388cb01d68df12554f85003ac41bbd20b8`，固定起点 `320ab620a2d3f22c09e13334a68f06a3b664af05`；worktree `O:/GenesisCode/Observer-worktrees/v1-04`，分支 `ticket/v1-04`，干净；[验收回写](https://github.com/yiwer/Observer/issues/4#issuecomment-5550565579)已读回 CLOSED。
- #4 首轮 Spec 用量丢失 P2 已修复并复审关闭。最终 Standards 1 项 P3 非阻断重复解帧建议、硬违反 0；Spec 0。Root 独立冻结和集成均 check **74/74**、smoke **3/3**（旧子集），额外公开 seam 专项 **3/3**；详见 [V1-04 记录](acceptance/04-codex-runner.md)。CLI + 模型协议替身不代表真实模型或生产资格。
- 并行只读预检 `/root/research_v1_05_preflight` 已完成 [Claude 增量研究](../../research/claude-cli-preflight-2026-09-05.md)；Root 独立复跑帮助/版本确认本机仍为 2.1.252。`permission-prompts` 版本差异及 `subtype=success` 仍可能 `is_error=true` 已记录；预检时未实施/触发模型/升级，现已交给 #5 fresh 实施 agent，仍须实测目标 Linux CLI 和完整隔离契约。
- #3 最终实施提交：67401aca6bcc0cd943f0b3fb9257ac7e7288f214；worktree：`O:/GenesisCode/Observer-worktrees/v1-03`；分支：`ticket/v1-03`；[验收回写](https://github.com/yiwer/Observer/issues/3#issuecomment-5550293271)。
- 最新已验收集成提交：f59bcad37f200e848eff305c6aeff0a5f1cb22e9。
- 2026-09-05 17:59:25 +08:00 后读到 `origin/master` 与 `git ls-remote` 均为 `e475bc18620d1d052f6effcb648fbc4ec66150d2`；已确认 #1–#4 实施和集成提交都可从该远端提交到达。该 push 不是本次 orchestrator 执行；#5 候选仍未集成、未推送（远端无 ticket/v1-05）。远端代码存在不代表生产部署或模型资格通过。Root 新出现未跟踪 `.idea/`，保留不纳入任务提交。
- #3 首轮测试虽通过，但两轴及 Root 额外发现阻断；最终重新冻结、复审关闭全部发现，再集成验收。Root 在最终工作区及 master 均复跑 check 52/52、smoke 3/3；smoke 属于总测试子集。详见 [V1-03 验收记录](acceptance/03-evidence-publication-gate.md)。

## 已验收

- [V1-01 验收记录](acceptance/01-private-brief-spine.md)：实施 35c647c，集成 1798613；orchestrator 在固定工作区和集成基线均复跑 typecheck/build、13/13 测试及 2/2 smoke。Standards 有 1 项非阻塞建议，Spec 无发现。
- [V1-02 验收记录](acceptance/02-policy-bound-collection.md)：最终实施 2931098，集成 7fdef67；orchestrator 在固定工作区和集成基线均复跑 typecheck/build、32/32 测试及 3/3 smoke。两轴原 3 项阻断和 root 删除准入发现均修复；余 1 项非阻塞维护建议。
- [V1-03 验收记录](acceptance/03-evidence-publication-gate.md)：最终实施 67401ac，集成 a83cf2a；orchestrator 冻结和集成各复跑 typecheck/build、52/52 与 3/3 smoke；Standards、Spec 最终各 0 项；Root 矛盾回执及 24 场景 TTL 回归通过。只有标注语义替身证据。
- [V1-04 验收记录](acceptance/04-codex-runner.md)：最终实施 139dc13，集成 f59bcad；冻结和集成各 check 74/74、smoke 3/3；Root 首次发送 TTL 与拒绝用量专项 3/3。Standards 留 1 项非阻断 P3，Spec 原 P2 关闭、最终 0。真实 CLI + 无凭证模型替身，不是模型/地区/生产资格。

## 协作容量

#2 的第二个 reviewer spawn 曾返回 `collab spawn failed: agent thread limit reached`。Standards 使用独立新 reviewer，Spec 复用未参与 #2 实施的 #1 agent，两轴没有互换报告内容。后续实施仍要求 fresh context；若平台无法释放线程，不得把旧实施上下文冒充 fresh context，需核实容量或请求 Owner 调整会话。

#3 的 fresh implementation 和两个 fresh reviewer 均实际启动成功；不要把 #2 的历史错误当作当前容量阻断。

## 外部就绪项

V1-26 起的真实环境、Provider 资格/凭证、来源许可、费用、收件人与备份资源需授权和实测；V1-28 需要连续 14 天真实记录及规定比例的人工事实核查。没有这些证据时不得宣布 V1 生产通过。

## 下一票只读预检

2026-09-05，orchestrator 在等待 #3 时执行了本机 `codex --version`、根/exec/sandbox/features 帮助命令及无调用参数解析检查。当前二进制为 `C:/Users/16348/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe`，版本 **codex-cli 0.153.4**，已不同于历史研究的 0.151.0。`--search -a never` 放在 `exec` 前可通过帮助解析，`exec --ask-for-approval never --help` 仍被拒绝。没有读取凭证、修改配置或发起模型请求。

#4 实施时必须重验实际二进制与完整终态契约，不得从历史版本或帮助解析推定认证、费用、事实质量、OS 隔离或进程树清理已经合格。预检已重新打开官方[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)、[安全边界](https://learn.chatgpt.com/docs/agent-approvals-security)和[配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)；这些文档与本机帮助仅作后续测试依据，不是实际拒绝边界的测试证据。预检时未开始实施，现已按上述固定基线派发。

本机有 Docker CLI、WSL CLI，但 `wsl --list --quiet` 只列 docker-desktop；读取 Docker Server 版本时 Linux Engine named pipe 不存在，不能视为容器运行环境已就绪。此次只读预检没有启动虚拟机/容器、安装组件或修改配置。

随后 #4 实施 agent 明确需要 Linux 隔离测试，root 启动已有 Docker Desktop 并读取运行库存：Engine 29.6.1、Linux amd64；已有 10 个其他项目容器仍全部 exited，未修改或删除。已交付固定 Python 镜像身份供无模型协议/权限探测使用。详见 [V1-04 执行与待验收记录](acceptance/04-codex-runner.md)；环境启动不等于安全边界或实际 Codex 接入通过。
