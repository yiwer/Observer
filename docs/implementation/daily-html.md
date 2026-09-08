# 本机六栏 HTML 日报

2026-09-08 按 Owner 最新请求落地的手动流程：真实来源采集、账户权限检查、本机已登录 Codex 编写，**每栏独立一封 HTML 邮件**。世界、AI、财经、科技前沿、社交五栏只收北京时间昨天00:00至本次采集冻结点内发布的信息；旧事件在此窗口新报道可以收录，窗口外旧稿和未知发布时间不收。**GitHub例外：按官方Trending Today全语言榜选题，不限制项目/仓库/Release发布时间**，记录榜单顺序与实际观察时间。这里不要求每栏七条，也不要求 PDF；有数据就写，来源或权限问题明确提示。

## 运行

需要项目现有 Node 24.x 与依赖，以及本机已登录 Codex CLI 0.153.4。固定模型 `gpt-6-astra`、推理 `medium`，复用既有只读工具限制和 Windows Job 进程管理。没有调用 Claude。CLI 的非交互输出见 [OpenAI 官方说明](https://learn.chatgpt.com/docs/non-interactive-mode)。

密钥从进程环境或 Windows User 环境读取，不写入仓库。采集器只读取所需服务凭据；Codex 子进程不继承这些凭据。邮件阶段独立读取 `QQ_SMTP_KEY`。私有收件配置默认 `data/operator/daily-mail.json`（Git忽略，可用 `OBSERVER_MAIL_CONFIG` 指定），包含 `sender` 和 `subscribers:[{id,address}]`，ID须稳定且唯一；实际地址不写公共示例。未提供配置文件时兼容 `OBSERVER_OWNER_QQ_ADDRESS` 发给自己。当前固定QQ传输支持显式QQ/foxmail收件白名单，既有服务调用不传名单时仍只允许发给自己。

```powershell
# 每次明确重采使用新的 run ID，日期必须为北京时间今天。
node scripts/daily-html.mjs collect YYYY-MM-DD-update-01
node scripts/daily-html.mjs generate YYYY-MM-DD-update-01
# 仅需要更新未发稿排版时使用 render，不再调用模型：
node scripts/daily-html.mjs render YYYY-MM-DD-update-01
# 查看 data/daily-html/<run ID>/daily.html 后再明确发信：
node scripts/daily-html.mjs send YYYY-MM-DD-update-01
# 可选只发送某一尚未尝试过的栏目：
node scripts/daily-html.mjs send YYYY-MM-DD-update-01 ai
node scripts/daily-html.mjs status YYYY-MM-DD-update-01
```

输出在 Git 忽略的 `data/daily-html/<run ID>/`。`acquisition.json` 包含来源片段、时间及脱敏权限检查；单栏结果可恢复复用；`report.json`、`daily.html`、`daily.md` 为本地合刊预览，`world/ai/finance/frontier/social/github.html` 才是各栏邮件。HTML 为邮件主正文，纯文本备选，不附 MD/PDF，无图片或跟踪资源，链接由实际采集记录提供而非模型自行生成。

采集、生成输入、来源引用及发送前复用同一栏目资格判定。五个新闻栏目在采集开始时冻结发布截止点；日精度元数据必须整个日期落窗，不伪造小时，观察/编辑时间不替代发布。GitHub改用本次Trending快照：记录页面名次、观察时间、总Star和可见的今日新增Star；不需要新建仓库或新Release。无法取得真实榜单时明确失败，不以旧榜或总Star搜索兜底冒充；榜单统计日不擅自等同北京时间精确24小时。`render` 只重新排版尚未尝试发送的报告；一旦任一栏目有 SMTP 尝试记录就拒绝改动。

搜索与元数据并不等于已阅读全文；模型提示要求保留厂商归因、论文阶段、日期不确定性。社交热度仅代表所采平台样本；GitHub总Star不是每日增长，仅页面明确显示的starsToday可作为榜单今日新增。已发新流程报告及旧流程导出中的GitHub URL归一为仓库身份（Release链接也映射仓库），作为重复报道降权输入；这不是永久排除或旧生产排名公式。

## 与原有服务的边界

这是一条明确请求的本机手动更新稿流程，不覆盖旧版已发日报，不改旧 SQLite 归档、来源策略或定时调度。它不把手动更新稿冒充原有强校验发布流程的通过结果；也不宣称已接入 Android 同步、14 天验收或 07:30/08:30 定时服务。现阶段优先验收真实六栏内容和邮件阅读，后续可将这条实际有效的采集链整合回服务。

`send` 默认向每位订阅者分别发送六个独立栏目，最多2个并行连接；不会把别人的地址放到To/CC。每个“栏目+订阅者ID”先独占创建 `smtp-attempt-<edition>-<subscriberId>.json`，再调用既有 QQ TLS 传输，结果写入对应 `smtp-result-...json`。重新运行只处理尚未尝试的组合，已接受/结果未知/明确失败的尝试均不会自动重发，一封失败不取消其余组合。邮件主题含栏目名称及日期。SMTP 250 表示服务器接受，不等于用户确认收件。不同 run ID 是一次新的显式更新，不能拿新 ID 隐藏上一次未知交付。已发送旧合刊不支持直接再发，必须按新时间规则重新采集生成。

按 Owner 最新快速验证策略，本轮不跑测试套件、夹具、hash 校验、构建或逐步回归；检查真实接口与最终内容，再做简短代码 review。第三方额度无法查询时明确记录未知，不用免费套餐默认值伪装账户实际余额，不自动采购或充值。
