# 指定人物 X 发言来源：接入建议

核查日期：2026-09-08。仅阅读当前第一方文档；未读取密钥、调用付费 API、注册、充值、发信或修改实现。`tibo`、“Claude 运营”尚无准确 handle，不能据称呼猜测身份。

## 结论

**可以接。现有 Tavily/Exa 适合有限发现；要稳定逐日跟踪特定公开账号，应使用 X 官方 API。** 不需要被跟踪人物授权，普通公开读取可使用自己的开发者应用 Bearer Token；不必把 Owner 浏览器 Cookie 或账号密码交给服务。[X 接入及鉴权说明](https://docs.x.com/x-api/getting-started/getting-access)、[鉴权映射](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping)

建议把人物加入账号白名单，再按内容分流：AI 公司人员的产品发言进入 AI，政策表态进入世界/财经，真正的社区争论才进入社交；不需要为了接人物再新增日报栏目。邮件写“某人在某时表示……”，发言本人是其说过这句话的第一方来源，**不是其主张已经证实的保证**。个人员工的表态也不自动等同公司正式公告。

## 两条获取路径

| 路径 | 能做什么 | 不应承诺什么 | Owner 操作 |
| --- | --- | --- | --- |
| 现有 Tavily | `include_domains:["x.com","twitter.com"]`、`include_domains_mode:"filter"`，query 带准确 handle 和主题；再检查命中 URL 的作者路径 | 没有已确认的 X `from:` 结构化操作符；域名筛选不等于作者验证。时间过滤可能使用发布日期**或最后更新时间**；不能当作原帖 `created_at`。未找到 X 全量覆盖/最长索引延迟承诺。[官方 Search](https://docs.tavily.com/documentation/api-reference/endpoint/search) | 不需新 key；须给准确 handle。此轮未实际调用，现有普通搜索成功不证明指定账号一定可搜全。 |
| 现有 Exa | `includeDomains:["x.com/HANDLE","twitter.com/HANDLE"]` 支持域名路径前缀，`startPublishedDate/endPublishedDate` 过滤，返回 text/highlights | 官方未承诺完整 timeline、精确作者认证或 X 索引最大延迟；仍要校验 `/HANDLE/status/ID` 及原帖时间。当前 `startCrawlDate/endCrawlDate` 已弃用且被忽略，不能拿它们实现最新发言订阅。[官方 Search](https://exa.ai/docs/reference/search) | 不需新 key；准确 handle 后做有限发现即可。 |
| X 官方 API | 指定用户 timeline、原帖 ID/作者 ID/发布时间、增量分页、编辑链；适合持续白名单 | 删除前没采到的帖不能保证补回；受保护/封禁/不可见内容不能绕过；没有“任何情况下绝不漏帖”的保证。[Timelines](https://docs.x.com/x-api/posts/timelines/introduction) | 开发者账号与应用、Bearer Token、预付 credits，设置支出上限。 |

搜索结果片段不是账号订阅；搜不到时应显示“未检索到/覆盖不完整”，不能写“该账号今天没有发言”。只有拿到原帖或 API 正文后才作为直接发言；媒体转述则明确“某媒体转述”，不能悄悄替换成原帖来源。以上为本项目编辑与数据处理建议，不是额外的双源硬门槛。

## X 官方最小接法

1. **准确 handle → 稳定 user ID**：`GET /2/users/by/username/{username}`。保存返回 ID 与当前 username，避免仅凭显示名认人；改名后更新映射。[User Lookup](https://docs.x.com/x-api/users/get-user-by-username)
2. **账号增量**：`GET /2/users/{id}/tweets`，传 `since_id` 或 `start_time/end_time`，`max_results` 5–100，沿 `meta.next_token` 用 `pagination_token` 翻页；需要 `tweet.fields=created_at,author_id,referenced_tweets,conversation_id,edit_controls` 等最小字段。timeline 可访问最近最多 3,200 条；不能无限倒历史。[User Posts](https://docs.x.com/x-api/users/get-posts)、[Timeline 概览](https://docs.x.com/x-api/posts/timelines/introduction)
3. **多账号合并搜索备选**：`GET /2/tweets/search/recent?query=(from:HANDLE_A OR from:HANDLE_B) -is:retweet -is:reply`，显式传 UTC `start_time/end_time`，用 `next_token` 分页；recent 的起点必须在最近 7 天，`max_results` 10–100。`from:` 是 X API 的作者操作符，不是把账号名当关键词。[Recent Search](https://docs.x.com/x-api/posts/search-recent-posts)、[Search Operators](https://docs.x.com/x-api/posts/search/integrate/operators)
4. **回复/转发选择**：timeline 的 `exclude=retweets,replies`、search 的负操作符可以降噪。但很多 AI 人员和 Musk 的实质信息在回复里；建议“排纯转发、保留有信息量回复”作为编辑默认，不能全排回复后仍宣称收集了该人全部发言。必要时读取引用帖/父帖说明上下文，额外返回资源也纳入费用。
5. **编辑/删除**：同一编辑链按 `edit_history_tweet_ids` 合并，不把编辑算新独立消息；默认取最新版本，保留“已编辑”提示。已不存在的 ID 不由缓存冒充当前原帖；少量入选帖可发前复查，持续留存则使用平台的 compliance 能力处理删除/保护/封禁。普通 timeline 不是删除事件订阅。[Edit Posts](https://docs.x.com/x-api/fundamentals/edit-posts)、[Batch Compliance](https://docs.x.com/x-api/compliance/batch-compliance/introduction)

以上读取公开账号用 app-only Bearer；**个人首页推荐/关注时间线** `/2/users/{id}/timelines/reverse_chronological` 是另一种接口，才需要用户上下文授权。跟踪公开白名单没必要为此增加 OAuth 回调与登录流程。[鉴权映射](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping)、[Timeline 说明](https://docs.x.com/x-api/posts/timelines/introduction)

## 当前费用：按返回资源，不按账号数或请求数

当前官方价格是预付 credits 按用量，不沿用旧 Basic/Pro 月费：Post Read **US$0.005/条**，User Read **US$0.010/个**。10 个账号每天合计返回 100 条新帖，30 天仅帖子读取为 `100 × 30 × 0.005 = US$15`；首次查 10 个用户约 US$0.10。不是“10 次请求只花 10×单帖价”。[X 当前定价](https://docs.x.com/x-api/getting-started/pricing)

同一 UTC 日内已计费资源重复读取通常去重，但只是软保证，跨 UTC 日重读可再计费；用户 expansions、关联帖、补历史等增加资源数。只查询变化、复用 ID，避免每天重拉所有历史。credits 余额不是总预算：还需设置每账期 Spending limit，自动充值另行选择；模型、其他搜索服务与税费未计入上述估算，支付前以控制台为准。[X 计费、去重与支出控制](https://docs.x.com/x-api/getting-started/pricing)

## Trump：同时考虑 Truth Social，不能假定 X 镜像及时完整

本人平台入口为 [Donald J. Trump / @realDonaldTrump](https://truthsocial.com/@realDonaldTrump)，官方平台的[原帖页面示例](https://truthsocial.com/users/realDonaldTrump/statuses/115582417825161974)也显示该身份。这个示例只用于核对账号入口，不是今日新闻。应分别读取两平台发言，不能假定完全同步；**本次没有测量哪边更快**。

Truth Social [官方帮助中心](https://help.truthsocial.com/)说明订阅提醒等功能，但本次未找到可据以承诺接入的公开开发者 API/RSS 文档、官方 key 申请或价格。因此归为“公开页面/检索补充；稳定自动化接口待官方确认”，而非免费 API 已可用。不把 Mastodon 风格内部 URL、第三方归档或爬虫商的 API 当作平台官方许可。[官方提醒说明](https://help.truthsocial.com/frequently-asked-questions/faq-alerts/)、[平台条款](https://help.truthsocial.com/legal/terms-of-service/)

## Owner 需要提供什么

- **现在就能做有限发现**：给准确账号主页链接/handle；尤其 `tibo` 与“Claude 运营”必须明确，不代猜身份。
- **希望每天稳定跟踪**：注册 [X Developer](https://docs.x.com/x-api/getting-started/getting-access)，创建 Observer 应用，如实说明私人摘要用途；把专用 Bearer Token 存入本地环境变量（建议名 `X_BEARER_TOKEN`，不要贴聊天）；确认可接受的每月 X 费用并在控制台设置上限。不要把已有 Codex“额度不限”自动扩大成 X 充值许可。
- **Truth Social 如必须稳定覆盖**：先向官方支持确认自动化获取方式；在此之前采用可访问原帖或明确标注的媒体转述，不默默漏报，也不绕登录/访问控制。X 付费解决技术读取，不等于获得任意全文转载、训练或永久帖子库许可；邮件仍用短原创摘要与原链接。

可直接向用户说：

> 可以。现有 Tavily/Exa 能发现部分 X 发言，但不能保证账号每天不漏帖；稳定跟踪建议接 X 官方 API。公开账号只需我们自己的开发者 Bearer Token，不需要对方授权。按每天合计100条新帖估算，帖子读取约15美元/月，其他资源另计。你先给准确账号链接，尤其 tibo 和“Claude运营”；Trump 再补 Truth Social，接口未确认前会明确标注覆盖限制。
