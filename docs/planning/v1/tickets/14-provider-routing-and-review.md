# V1-14 — 双 Provider 路由、复核与有界降级

状态：ready-for-agent · 已发布：[GitHub #14](https://github.com/yiwer/Observer/issues/14)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-14 -->

规划 ID：V1-14 · 类型：implementation

## What to build

一次 Edition 研究选择一个主 Provider，按明确条件触发另一 Provider 的复核或故障替代；无可用 Provider 时返回可解释失败，交由出版流程降级。

## Acceptance criteria

- [ ] 任务选择、失败替代、高风险条件复核和复核分歧的仲裁形成明确状态；日常不默认完整双份生成，两个 Provider 可互换主次。
- [ ] 六个 Edition 的研究及 Final Editor 通过已定义业务契约运行；Final Editor 的工具配置保持无网络/无 shell，只有已校验输入。
- [ ] 每个 Provider 的账户/地域资格作为启用前条件；资格失效禁用该 Runner，单 Provider 可运行但不声称双 Provider 对照通过。
- [ ] 总时长、调用轮数、重试、并发和异常用量有明确可配置上限；预算不设业务硬封顶，统计实际可获得的消耗并标明缺失。
- [ ] 单栏失败不取消已完成栏目；双 Provider 都失败返回采集仍可用与不可用两种可区分结果，不伪造摘要。
- [ ] 测试主成功、主失败备成功、复核不一致、同源转载不能仲裁、双失败、超时取消及恶意工具请求；记录每次决策和终态而不是仅最终字符串。

## Blocked by

- #4 — V1-04 — Codex 单栏研究到受控候选输出
- #5 — V1-05 — Claude 单栏研究到受控候选输出
- #9 — V1-09 — 高风险新闻与 AI／科技证据标签

## Scope boundary

任务级路由与安全限制；日刊时间窗口、链接降级版和恢复发布由调度票消费这些结果。

## Decisions and evidence

固定仲裁及有界运行参数的初始技术规格，后续容量实测只调整参数版本，不取消保护。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-18、US-44、US-67、US-68、US-73。
- PRD 行为验收：AC-11、AC-18。
- 参考分支：D5、D7、T3、ADR-0001、ADR-0002。
