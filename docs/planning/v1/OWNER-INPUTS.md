# Owner 最新运行授权与服务选择

更新日期：2026-09-05。本文件记录已确认输入；它不代表这些能力已实际通过。较早票据中的外部未授权状态应结合本记录判断，其他来源许可、安全、地区和生产验收要求不变。

## Codex

Owner 明确批准使用**本机已有 Codex** 做真实测试，**不设置额度上限**。这允许任务所需的模型消耗，不要求购买额外资源、修改全局配置或无限重试；PRD D7 的进程时限、调用轮数、取消、用量记录及防失控边界仍保留。

本机重新读取 `codex --version` 为 **0.153.4**，`codex login status` 为 **Logged in using ChatGPT**；只读取登录状态，未输出/复制认证文件、令牌或用户配置。官方[非交互认证文档](https://learn.chatgpt.com/docs/non-interactive-mode#authenticate-in-automation)说明 `codex exec` 可复用已保存的 CLI 认证。使用已有登录应由 CLI 自身处理，不能把认证复制到候选运行环境、公共仓库或日志中。

本机实际运行国家/地区尚待 Owner 提供；现有 ADR-0002 的资格要求未被额度授权取消。登录成功与模型网络连通不等于地区/账户合格，也不证明 Linux 产品 Runner 的隔离。本机 native CLI 预检/实测、隔离适配器实际模型测试、目标 VPS 测试及 14 天影子质量记录分别取证。当前仅完成 version/help/login-status，**未发起真实模型请求**。

## Claude

Owner 将后续提供真实 Claude 环境，当前**跳过真实环境测试**并标为 `owner-deferred / NOT VERIFIED`。不再把当前缺少 Claude 真实凭证当成开发票的等待条件，但也不宣称双 Provider 实测通过。

这不跳过 #5 的离线适配器实现、协议替身测试、真实固定 CLI + 无凭证模型替身，以及已发现的 SSE/用量 P2 修复和双轴复审。任何实际 Claude 认证/模型调用继续禁用，直至 Owner 提供并授权适合的环境。T3 已允许按可用 Provider 记录单 Provider 范围，不把 Claude 缺项伪装成 PASS。

## 邮件

Owner 选择 **QQ 邮箱 SMTP + 授权码**，并确认发件与收件使用同一邮箱。#19 的传输要求因此由仅 HTTPS 修订为可替换邮件传输适配器、首个实现采用 SMTP/TLS；具体端口、TLS 模式、附件预算与提供商能力在实施时核对官方资料和实际环境。

仓库 `yiwer/Observer` 已读回 **PUBLIC**，因此具体邮箱地址仅存于 Git 忽略的本地 `data/operator/owner-inputs.json`，不写入公共 Issue、提交或研究文档。该文件是运行输入交接记录，**不是已经生效的产品配置**；不得把授权码填进这个非秘密字段集合。Owner 已将授权码存入 Windows 用户级环境变量 `QQ_SMTP_KEY` 并明确授权调用及测试；Root 仅把它传入一次 SMTP 测试子进程，没有回显、持久化或修改全局变量。

QQ SMTP 选择不改变邮件状态语义：SMTP 受理与 Owner 收件箱实际可读必须分开；没有幂等/查询/回调证据时保持可追踪未知，不盲目重发、不伪造投递/退信回执或 exactly-once。2026-09-05 已向已确认的同一发件/收件邮箱发送 **1 封自测邮件**：TLS 1.3 且证书/主机名验证启用，AUTH 235、DATA 250；状态为 **SMTP 已接收，收件箱及显示待 Owner 确认**。详见 [脱敏预检记录](acceptance/qq-smtp-preflight-2026-09-05.md)。这不完成 #19 产品实现/验收，也未启用日常自动投递。
