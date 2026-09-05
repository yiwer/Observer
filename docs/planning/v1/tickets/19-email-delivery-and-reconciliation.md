# V1-19 — 同版本邮件交付与未知受理对账

状态：ready-for-agent · 已发布：[GitHub #19](https://github.com/yiwer/Observer/issues/19)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-19 -->

规划 ID：V1-19 · 类型：implementation

## What to build

报告发布后向 Owner 发送同版本 HTML 总览、私有链接及预算内 PDF，并将发布、服务商受理、实际投递、退信或未知状态分别呈现。

## Acceptance criteria

- [ ] 使用固定安全 HTML 模板从同一 Canonical Brief 取 Today Overview，不新增事实；附件符合明确预算时附 PDF，否则保留可用私有下载链接。
- [ ] 邮件服务商通过可替换邮件传输适配器接入；首个实现采用 Owner 选定的 QQ SMTP + TLS + 授权码。具体连接参数、附件大小和链接期限写成技术决策，未经授权不创建账户或付费开通。
- [ ] 刊次、版本、收件人和通知类型组成幂等交付身份；待交付状态可靠保存，进程重启不重复已完成发送。
- [ ] 服务商已受理但响应丢失标为未知；按提供商幂等/查询能力对账，无确认依据时保持可追踪待查，不盲目重发。
- [ ] 受理、投递、退信、拒绝与未知分别记录可取得的服务商消息标识和时间，缺失不虚构；有回调能力的适配器须验证回调来源、重复和乱序，无查询/回调证据时不得把 SMTP 受理冒充实际投递。
- [ ] 固定报告经过发布事件、渲染、发送替身、状态查询形成完整验证；实际收件箱与客户端排版在授权实测验收。

## Blocked by

- #17 — V1-17 — 私有归档、可撤销配对与同步 API
- #18 — V1-18 — Canonical Markdown 到中文 PDF

## Scope boundary

正常日报邮件与可复用通知契约；重大 Correction 会调用同一交付机制，不另建发送路径。

## Decisions and evidence

固定 provider 不具备查询/幂等能力时的未知状态处置，不能用 at-least-once 宣称邮件 exactly-once。

2026-09-05 Owner 选定 QQ SMTP 授权码并确认发件与收件同一邮箱，详见 [最新运行输入](../OWNER-INPUTS.md)。具体地址在 ignored 本地配置，不复制至公开仓库/Issue；授权码后续本地秘密配置，当前没有邮件实测证据。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-53、US-56、US-57、US-60。
- PRD 行为验收：AC-14、AC-15、AC-16。
- 参考分支：D4、D9、research:sources。
