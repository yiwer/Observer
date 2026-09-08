# 六栏独立邮件与第二订阅者：实际交付

## 结果

运行 `2026-09-08-editions-02`：北京时间 2026-09-07 00:00:00 至 2026-09-08 18:13:02.500 冻结发布窗口。六栏共29条，世界7、AI4、财经6、科技前沿4、社交5、GitHub3。生成使用本机已登录 Codex，`gpt-6-astra` / `medium`；未使用Claude。

原订阅者与新增订阅者均保留在 Git 忽略的 `data/operator/daily-mail.json`，发件人未变。每个栏目、每位订阅者独立一封HTML正文邮件，无CC或公开收件人列表，共12封。12条SMTP结果全部 `accepted` / `250`，回执时间为北京时间18:28:05.948—18:28:10.665；发送进程退出0。SMTP接受不等于已确认进入收件箱。

实际内容与回执位于 `data/daily-html/2026-09-08-editions-02/`，属于私有忽略目录。未改动或重发较早合刊。时间未知的知乎候选未入稿，社交目前主要为HN样本。发送前剔除了4条没有明确新进展、重述窗口外模型发布或研究成果的稿件；未为达到条数而补旧稿。

## Standards

固定代码审阅范围 `232dc7f...a89fbe1`。独立审阅未发现硬标准违反或P1/P2；核对收件allowlist、单人To、密钥延迟读取、独占尝试记录和已尝试稿件不可重渲染。未运行测试、构建、类型检查或hash验证。

## Spec

独立审阅发现1项P2：真正的分栏邮件原先只显示时间过滤提醒，遗漏全局来源故障。`4094910` 通过共用来源警告路由修复：已知来源映射对应栏目，通用/未知故障继续可见；兼容已生成未发送报告，无需重采或再调用模型。世界和财经逐项对照引用摘录未发现重要事实错误。其余栏目主代理对照原始摘录作简短编辑审阅，不宣称所有二手报道均独立核实。

审阅汇总：Standards 0；Spec 1项P2已修复；没有将轻量审阅当作完整回归或生产定时验收。

## X / Apify 接入交接

X抓取选型补充见 [研究报告](../research/x-curated-accounts-acquisition-2026-09-08.md)。用户随后指定 `scrapier/twitter-posts-scraper`，已在本机Codex全局配置添加 `apify`：

```toml
[mcp_servers.apify]
url = "https://mcp.apify.com/?tools=actors%2Cdocs%2Cscrapier%2Ftwitter-posts-scraper"
bearer_token_env_var = "APIFY_TOKEN"
```

先按请求尝试OAuth，`codex mcp add`及`codex mcp login apify`均报告 `OAuth authorization endpoint origin does not match the authorization server origin without issuer-bound callbacks`，未成功登录，未关闭安全校验。随后配置官方支持的环境变量Bearer路径；隐藏输入终端创建失败，最后只核对环境变量存在性，`APIFY_TOKEN`仍未设置。没有将用户Key写入命令、配置、仓库或日志。

下一步由用户在Windows用户环境变量中设置 `APIFY_TOKEN` 并完全重启Codex。重启后先检查实际Apify工具可用性及指定Actor输入，再运行用户授权的 `elonmusk` / `maxTweets:10` / `useApifyProxy:false` 小样本并读取dataset。本次未运行Actor、未新增X内容到已发日报，也未验证该Key权限或额度。

Codex [官方MCP配置](https://learn.chatgpt.com/docs/extend/mcp)支持 `bearer_token_env_var`；Apify [官方接入说明](https://docs.apify.com/integrations/mcp)支持Bearer代替OAuth。配置存在、认证成功、工具加载和抓取成功是不同状态，不应混称接入完成。
