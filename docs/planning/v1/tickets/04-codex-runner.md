# V1-04 — Codex 单栏研究到受控候选输出

状态：ready-for-agent · 已发布：[GitHub #4](https://github.com/yiwer/Observer/issues/4)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-04 -->

规划 ID：V1-04 · 类型：implementation

## What to build

同一栏目的 Evidence Bundle 经 Codex 非交互子进程返回可核验候选；只有完整成功终态的结构化结果才能进入 Publication Gate。

## Acceptance criteria

- [ ] 按实现时本机帮助和官方资料核对 codex exec 的实际参数、认证和事件契约，固定测试过的 CLI/模型版本；接入共有 AgentRunner，而不把业务层绑定到供应商事件格式。
- [ ] 分别判断进程退出、终态事件和最终结构结果；中途文本、非零退出、超时、取消、错误 Schema 与缺失终态都不能冒充成功。
- [ ] 对任务目录、允许环境变量、只读工具、网络与 MCP 通道实施可验证约束；候选代码/二进制不能运行，Runner 无配置修改或邮件发送权限。
- [ ] 测试恶意网页要求读秘密、扩大权限或执行命令时的实际拒绝边界；只设置提示词不足以通过安全验收。
- [ ] 超时和取消终止本任务进程树，保留脱敏错误分类、版本、耗时和可取得的用量；取不到的用量明确未知，不虚构为零。
- [ ] 使用可控进程协议替身及许可可保存的脱敏事件样本跑通 Bundle→Runner→Gate；真实认证/地域/付费调用仅在授权实测阶段执行，未实测状态单独记录。

## Blocked by

- #3 — V1-03 — 陈述级证据核验与 Publication Gate

## Scope boundary

一个 Codex 适配器；不做全局调度、双 Provider 仲裁或生产连通声明。

## Decisions and evidence

记录确切进程协议、权限能力与不支持场景；资格不满足时禁用，不通过改变出口身份绕过。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-39、US-67、US-68。
- PRD 行为验收：AC-18。
- 参考分支：D7、ADR-0001、ADR-0002、research:codex。
