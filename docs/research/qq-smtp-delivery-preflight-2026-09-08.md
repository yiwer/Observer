# QQ SMTP 交付预检：#19 实施输入

2026-09-08。只读研究；以下建议尚非已采纳技术决策，未连接 SMTP、读取秘密或发送邮件。范围依据 [#19](../planning/v1/tickets/19-email-delivery-and-reconciliation.md)，实测状态以最新 [Owner 邮件输入](../planning/v1/OWNER-INPUTS.md#邮件)为准。

## 连接与证据边界

**文档事实：**[腾讯官方 Email 连接器](https://cloud.tencent.com/document/product/1270/55456) 明确 QQ 邮箱客户端密码使用授权码。[QQ 授权码帮助](https://service.mail.qq.com/cgi-bin/help?id=28&no=1001256&subtype=1)及其 SMTP 设置页本次超时；新帮助页仅返回目录。个人 QQ 的 SMTP 附件硬上限、发信配额、服务商幂等键、程序化状态查询及回调能力均未取得可用官方契约，不能假定存在。

**本地历史观察：**[脱敏预检](../planning/v1/acceptance/qq-smtp-preflight-2026-09-05.md)记录 `smtp.qq.com:465`、隐式 TLS、证书与主机名验证、TLS 1.3、AUTH 235、DATA 250；Owner 次日确认收件与中文显示。这仅覆盖一封无附件测试邮件，未覆盖 #19 产品链或目标 Linux 环境。

**V1 建议：**沿用该主机、465、`secure:true`、授权码认证、最低 TLS 1.2及默认受信证书验证。587 是 STARTTLS 提交通用端口，若使用应强制升级并拒绝降级；本次未核实 QQ 587 的实际能力，不设自动端口回退。[RFC 8314 §3.3](https://www.rfc-editor.org/rfc/rfc8314.html#section-3.3)、[Nodemailer SMTP](https://nodemailer.com/smtp)

## 受理、未知与重试

**协议事实：**只有正文结束后的最终 250 才表示服务器承担交付责任；RCPT 250、DATA 354均不足，最终250也不是收件箱投递证明。终止符已提交而回执丢失可能导致重复发送；标准建议等待最终回执10分钟。[RFC 5321 §4.1.1.4、§4.5.3.2.6、§6.1](https://www.rfc-editor.org/rfc/rfc5321.html#section-4.1.1.4)

**V1 建议：**刊次、版本、收件人与通知类型组成持久交付身份，发送前记录尝试；已受理不重发。明确未受理的暂时错误可退避重试，永久拒绝或认证配置错误停止自动尝试；DATA 结果或崩溃恢复无法确认时保留 `unknown` 待查。QQ 未取得查询/幂等契约，不能用相同 Message-ID 证明去重；本地 Message-ID 与可取得的服务器标识分开保存，投递/退信无证据则未知。[RFC 5321 §4.2.5、§4.5.4](https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.5)

## 传输、附件与链接建议

Nodemailer 可作为可替换适配器。建议 DNS/连接/问候/空闲超时分别30秒/120秒/300秒/600秒；空闲超时不等于完整事务期限。错误的 `code`、`command`、`responseCode`有助定位，但单凭 `ETIMEDOUT`或命令名不足以证明尚未提交正文；无法判定阶段时按未知处理。仅保存脱敏分类、阶段、时间和确有的标识，关闭原始协议与正文日志。[SMTP 选项](https://nodemailer.com/smtp)、[错误字段](https://nodemailer.com/errors)

同一 Canonical Brief 的 Today Overview 进入固定转义 HTML 模板；优先附同版本 PDF。建议 PDF 原始大小≤5 MiB且完整编码邮件≤8 MiB，超预算只保留总览与下载链接；这是项目预算，**不是 QQ 限额或受理保证**。附件以已校验的 Buffer 传入，固定安全文件名及 `application/pdf`，启用 `disableFileAccess`、`disableUrlAccess`；按实际 MIME 大小计预算。[附件配置](https://nodemailer.com/message/attachments)、[消息安全选项](https://nodemailer.com/message)

[PRD D9](../PRD.md#d9-正文文件与同步契约)要求短期私有链接。现有 #17 五分钟签名容易在稍后读信时过期，普通点击也不能附 Authorization；当前无浏览器登录流程或 Phase 2 Android 客户端可供假定。建议 #19 技术决策明确**邮件用途对象签名 24 小时**，绑定对象/版本并沿用 #17 每次访问的撤销检查，显示到期时间；只扩展既有签名访问契约，不新增公开认证入口或在 URL 放长期访问令牌。稳定鉴权归档地址仅作过期后的程序化回退，不能宣称邮件点击可用；已附 PDF 仍可打开。以上期限、撤销与普通邮件点击行为均须由 #19 实现和验收，本研究不代替验收。
