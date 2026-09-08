# V1-26 — 真实接入、部署与发布前冒烟验收

状态：ready-for-agent · 已发布：[GitHub #26](https://github.com/yiwer/Observer/issues/26)。标签不表示依赖或外部验收已完成；执行状态以 GitHub 为准。

<!-- observer-ticket: V1-26 -->

规划 ID：V1-26 · 类型：live-gate

## What to build

在 Owner 授权且资格合规的实际环境完成六栏服务、可用 Provider、邮件、私有访问和灾备的冒烟取证，明确哪些能力可以进入真实影子评测。

## Acceptance criteria

- [ ] 代码依赖已集成，并按 Owner 快速 V1 策略完成最少必要检查；记录候选代码、配置、Schema、来源政策、CLI/模型、评分及评测规则版本。不要求开发 hash 验收或全量/逐步/集成回归，未测范围明示；真实接入结果仍须来自本票实际操作。
- [ ] 真实来源、账户/地域、Provider 认证、收件人、邮件服务和节点外存储逐项列出授权与就绪条件；费用和基础设施操作需明确授权，不把依赖完成视为代购/发送许可。
- [ ] 已批准真实源生成六栏含缺口的私有报告；无合规社交源保留缺栏，实测可用 Provider，未启用 Provider 记录未验证及原因。
- [ ] 在目标 Linux 环境验证网络/工具权限、超时终止和秘密隔离；真实登录成功不等于 Agent 沙箱约束有效。
- [ ] 用实际长文 PDF 完成人工中文/分页/链接视觉核查，并在 Owner 邮箱核对 HTML、链接与附件；分别保存受理、投递和收件箱检查结果。
- [ ] 验证未鉴权、签名过期、设备撤销和对象存储私有性；不以公开测试链接代替私有交付验证。
- [ ] 从真实节点外备份恢复到干净隔离环境，按冻结口径测量 RPO/RTO；记录实际结果及证据，失败不能标上线就绪。

## Blocked by

- #10 — V1-10 — 合规社交样本到话语观察 Edition
- #21 — V1-21 — 最近 7 天来源更正与撤回巡检
- #24 — V1-24 — 节点外一致性备份与干净环境恢复
- #25 — V1-25 — 影子评测记录、抽样与事实核查工具

## Scope boundary

一次有界真实验收批次；不在同一个 agent 上下文等待 14 天，不实现 Android UI 或购买未经授权资源。

## Decisions and evidence

若外部授权/凭证不足，记录具体缺项后暂停本门，已完成开发票不回退，也不伪造真实 PASS。

验收交接需区分固定数据/替身、真实外部接入和人工检查；结果绑定实际代码及配置版本，缺少证据的类别标为未验证。

## Traceability

- PRD 用户故事：US-55、US-56、US-60、US-67、US-69、US-70、US-73。
- PRD 行为验收：AC-15、AC-16、AC-18、AC-19。
- 参考分支：D6、D7、D9、D10、T3、ADR-0002。

## External prerequisites

- Owner-authorized environment, accounts, sources, credentials, costs and test recipient
- 当前 #23 容器入口使用专用 `OBSERVER_OPENAI_API_KEY` / `OBSERVER_ANTHROPIC_API_KEY`（支持 `_FILE`）通过受控 API broker 驱动 CLI，不复用本机个人 Codex 登录。#26 必须区分 native CLI 已登录/本机测试获批与部署 Runner 的 API 凭证、地区及计费授权；不能前者替代后者，也不得复制 OAuth/订阅认证文件。实际测试路径仍需结合 Owner 输入确认，不新增调用许可。
- 2026-09-08 对齐[Owner 最新输入](../OWNER-INPUTS.md)：本机 Codex 真实测试已批准且不设额度上限；Claude 外部测试延期、由 Owner 后续提供环境。邮件采用 QQ SMTP、同一发件收件邮箱；Owner 已在本机环境变量 `QQ_SMTP_KEY` 配置授权码并批准测试，单封 SMTP 预检已受理，2026-09-06 Owner 已确认实际收件与中文显示。不得再将“授权码未提供”列为已知阻断；也不因此声称产品 HTML/PDF 附件投递、当前进程环境或目标部署已实测。具体地址及秘密不写入本票。本机地区资格与产品实际运行边界仍须独立确认，不能仅因额度获批将本门记 PASS。
