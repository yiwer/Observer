# 本机六栏 HTML 日报

2026-09-08 按 Owner 最新请求落地的手动流程：真实来源采集、账户权限检查、本机已登录 Codex 编写、HTML 正文邮件。这里不要求每栏七条，也不要求 PDF；有数据就写，来源或权限问题明确提示。

## 运行

需要项目现有 Node 24.x 与依赖，以及本机已登录 Codex CLI 0.153.4。固定模型 `gpt-6-astra`、推理 `medium`，复用既有只读工具限制和 Windows Job 进程管理。没有调用 Claude。CLI 的非交互输出见 [OpenAI 官方说明](https://learn.chatgpt.com/docs/non-interactive-mode)。

密钥从进程环境或 Windows User 环境读取，不写入仓库。采集器只读取所需服务凭据；Codex 子进程不继承这些凭据。邮件阶段独立读取 `QQ_SMTP_KEY`；收件地址只通过 `OBSERVER_OWNER_QQ_ADDRESS` 注入，发件与收件相同。

```powershell
# 每次明确重采使用新的 run ID，日期必须为北京时间今天。
node scripts/daily-html.mjs collect YYYY-MM-DD-update-01
node scripts/daily-html.mjs generate YYYY-MM-DD-update-01
# 查看 data/daily-html/<run ID>/daily.html 后再明确发信：
node scripts/daily-html.mjs send YYYY-MM-DD-update-01
node scripts/daily-html.mjs status YYYY-MM-DD-update-01
```

输出在 Git 忽略的 `data/daily-html/<run ID>/`。`acquisition.json` 包含来源片段、时间及脱敏权限检查；单栏结果可恢复复用；`report.json`、`daily.html`、`daily.md` 是本次实际生成稿。HTML 为邮件主正文，纯文本备选，不附 MD/PDF，无图片或跟踪资源，链接由实际采集记录提供而非模型自行生成。

搜索与元数据并不等于已阅读全文；模型提示要求保留厂商归因、论文阶段、日期不确定性。社交热度仅代表所采平台样本；GitHub 首次快照不是每日增长。已发新流程报告及旧流程导出记录中的 GitHub URL 作为重复报道降权输入，此处是编辑选题提示，不宣称沿用了旧生产排名公式。

## 与原有服务的边界

这是一条明确请求的本机手动更新稿流程，不覆盖旧版已发日报，不改旧 SQLite 归档、来源策略或定时调度。它不把手动更新稿冒充原有强校验发布流程的通过结果；也不宣称已接入 Android 同步、14 天验收或 07:30/08:30 定时服务。现阶段优先验收真实六栏内容和邮件阅读，后续可将这条实际有效的采集链整合回服务。

`send` 首先以独占创建写入 `smtp-attempt.json`，再调用既有 QQ TLS 传输，结果写入 `smtp-result.json`。同一 run ID 一旦尝试发送便禁止盲目重发，包括进程崩溃或 SMTP 结果未知的情况；检查收件箱和记录后另行决定。SMTP 250 表示服务器接受，不等于用户确认收件。不同 run ID 是一次新的显式更新，不能拿新 ID 隐藏上一次未知交付。

按 Owner 最新快速验证策略，本轮不跑测试套件、夹具、hash 校验、构建或逐步回归；检查真实接口与最终内容，再做简短代码 review。第三方额度无法查询时明确记录未知，不用免费套餐默认值伪装账户实际余额，不自动采购或充值。
