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

- 当前票：V1-03 / GitHub #3，进行中；原生依赖只有 #2 且 CLOSED，fresh-context 实施 agent 为 `/root/implement_v1_03`。
- #3 固定起点：aa2a90fd5f72b225051bff6d52bea9114a96523f；worktree：`O:/GenesisCode/Observer-worktrees/v1-03`；分支：`ticket/v1-03`；[启动记录](https://github.com/yiwer/Observer/issues/3#issuecomment-5550133552)。
- #1、#2 已完成实施、双轴 review、独立冻结验收及本地 master 集成，GitHub 均已读回 CLOSED。
- 最新已验收集成提交：7fdef6736f0629850cba11061bf9607a853e3d2a。
- 当前仍未 push；已关闭的 Issue 表示本地实施验收，不表示远程代码或生产部署已更新。
- 下一步：等待 #3 的固定实施提交，执行 Standards / Spec 独立双轴 review 与 orchestrator 冻结验收；重点核对逐陈述证据绑定、正常发布与隔离路径，以及结构、政策、语义结论和测试/真实质量边界。

## 已验收

- [V1-01 验收记录](acceptance/01-private-brief-spine.md)：实施 35c647c，集成 1798613；orchestrator 在固定工作区和集成基线均复跑 typecheck/build、13/13 测试及 2/2 smoke。Standards 有 1 项非阻塞建议，Spec 无发现。
- [V1-02 验收记录](acceptance/02-policy-bound-collection.md)：最终实施 2931098，集成 7fdef67；orchestrator 在固定工作区和集成基线均复跑 typecheck/build、32/32 测试及 3/3 smoke。两轴原 3 项阻断和 root 删除准入发现均修复；余 1 项非阻塞维护建议。

## 协作容量

#2 的第二个 reviewer spawn 曾返回 `collab spawn failed: agent thread limit reached`。Standards 使用独立新 reviewer，Spec 复用未参与 #2 实施的 #1 agent，两轴没有互换报告内容。后续实施仍要求 fresh context；若平台无法释放线程，不得把旧实施上下文冒充 fresh context，需核实容量或请求 Owner 调整会话。

## 外部就绪项

V1-26 起的真实环境、Provider 资格/凭证、来源许可、费用、收件人与备份资源需授权和实测；V1-28 需要连续 14 天真实记录及规定比例的人工事实核查。没有这些证据时不得宣布 V1 生产通过。

## 下一票只读预检

2026-09-05，orchestrator 在等待 #3 时执行了本机 `codex --version`、根/exec/sandbox/features 帮助命令及无调用参数解析检查。当前二进制为 `C:/Users/16348/AppData/Local/Programs/OpenAI/Codex/bin/codex.exe`，版本 **codex-cli 0.153.4**，已不同于历史研究的 0.151.0。`--search -a never` 放在 `exec` 前可通过帮助解析，`exec --ask-for-approval never --help` 仍被拒绝。没有读取凭证、修改配置或发起模型请求。

#4 实施时必须重验实际二进制与完整终态契约，不得从历史版本或帮助解析推定认证、费用、事实质量、OS 隔离或进程树清理已经合格。预检已重新打开官方[非交互模式](https://learn.chatgpt.com/docs/non-interactive-mode)、[安全边界](https://learn.chatgpt.com/docs/agent-approvals-security)和[配置参考](https://learn.chatgpt.com/docs/config-file/config-reference)；这些文档与本机帮助仅作后续测试依据，不是实际拒绝边界的测试证据。#4 尚未派发或开始实施。
