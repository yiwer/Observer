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

## Standards

待冻结后独立审查，无结论。

## Spec

待冻结后独立审查，无结论。

## 外部门槛

没有真实模型、认证、地域资格、费用、质量、邮件、生产 Linux 或人工验收证据。生产发布/fixture 隔离继续保留；未知不记 PASS。当前提交均未 push。
