# V1-05 — Claude 单栏研究到受控候选输出

状态：ready-for-agent · 已发布：[GitHub #5](https://github.com/yiwer/Observer/issues/5)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-05 -->

规划 ID：V1-05 · 类型：implementation

## What to build

同一栏目的 Evidence Bundle 经 Claude 非交互子进程返回可核验候选，与 Codex 对业务层暴露相同成功、失败和用量契约。

## Acceptance criteria

- [ ] 按实现时本机帮助和官方资料核对 claude -p 的参数、认证、结构输出和流事件，固定测试过的 CLI/模型版本并接入共有 AgentRunner。
- [ ] 联合校验进程退出、最终结果和运行终态；处理拒绝、错误结构、超时、取消及部分输出，失败内容不进入正常出版。
- [ ] 把只读检索权限、MCP、网络和工作目录约束落实到运行环境；禁止执行候选仓库、读取无关秘密、改配置和外发邮件。
- [ ] 恶意网页越权、子进程卡死和协议异常的契约测试能够观察到隔离/终止；日志脱敏，无法取得的用量明确未知。
- [ ] 相同标准化任务可以使用本适配器产生候选并经过 Publication Gate；测试依据是业务结果，不假定两个 Provider 的文本或事件完全一致。
- [ ] 无真实账户也能完成可控协议样本测试；真实连通、账户/地域资格与付费调用留在授权实测记录中，未实测不记 PASS。

## Blocked by

- #3 — V1-03 — 陈述级证据核验与 Publication Gate

## Scope boundary

一个 Claude 适配器；与 Codex 票可并行，公共契约由 orchestrator 统一管理。

## Decisions and evidence

记录确切进程协议及允许工具能力；禁用未能保证约束的执行模式。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-39、US-67、US-68。
- PRD 行为验收：AC-18。
- 参考分支：D7、ADR-0001、ADR-0002、research:claude。
