# 六栏来源研究：社交舆论与 GitHub 热门

核查日期：2026-09-08。范围：官方文档、官方协议、公开价格，以及四次匿名只读连通性检查。本文是来源建议，不表示已启用来源、取得商业授权或完成产品接入；未读取凭据、创建账号、购买服务或发信。

## 推荐结论

**先用 Hacker News + Bluesky 指定公开账号/主题 feed 构成可运行的国际社交样本；中文部分优先申请知乎官方数据平台。GitHub 直接使用官方 REST 仓库检索和每日快照，无需先购买服务。** X 是有价值的付费补充；Reddit 有价值但先审批，不能写成免注册即用。微博、B 站全站舆情先明确数据授权与接口范围，不能用网上流传的未文档化接口冒充稳定官方能力。

这不是“全网民意”。建议邮件写“社交讨论”，每条交代平台、采样时段、讨论焦点和不同观点；不同平台的赞/转/评论不能相加当作统一民意指数。这是基于平台样本差异的产品建议，不是某个平台的结论。

## 直接可用与需要 Owner 操作的分界

| 来源 | 获取方式与价值 | 接入状态 | Owner 要做什么 |
|---|---|---|---|
| Hacker News | 官方 Firebase JSON：top/new/best/ask/show 列表，再读 item 的链接、时间、分数、评论数；适合开发者/创业/科技讨论 | 无需账号或 API key；官方文档当前未设 rate limit；本机 topstories 返回 200 | 无需注册购买；配置主题范围即可。[官方 API](https://github.com/HackerNews/API) |
| Bluesky 公开账号/feed | 官方公开 AppView；跟踪媒体、研究者、机构和多立场主题列表 | 部分读接口可匿名；本机 getAuthorFeed 返回 200，**searchPosts 返回 403**，所以不能保证匿名全站关键词搜索 | 公开账号/feed 无需新 key；需要关键词搜索时注册账号，通过官方认证流程接入并另验权限。[API 限流/主机](https://bsky.network/docs/rate-limits/)、[官方 searchPosts schema](https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/searchPosts.json) |
| Mastodon | 指定实例的 public/tag/trending 线索；适合技术、学术等社区补充 | 视实例而定：公开预览可被关闭，需要 token；timeline 甚至可返回空数组而非错误 | 先选实例、看实例规则；若需认证，再注册该实例账号/应用。不要求买统一平台套餐。[官方 timelines](https://docs.joinmastodon.org/methods/timelines/) |
| Reddit | 按 subreddit 采集热门/新帖和有限评论，社区主题覆盖好 | **需先获明确批准**；OAuth 是技术必需，不是审批替代；免费资格并非个人账号自动拥有 | 提交 Observer 外部个人日报用途，明确“用模型摘要、发到本人邮箱、不训练、不公开转售、短期保存”；批准后配置 OAuth。[Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy)、[Data API Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki) |
| X | 官方搜索/关注列表/趋势，突发事件与机构、专家信息密度高 | 开发者账号、应用和付费 credits；按用量收费 | 申请开发者访问、如实描述用途、创建应用、充值并设置账单上限；先确认摘要/邮件使用范围。[访问入口](https://docs.x.com/x-api/getting-started/getting-access)、[当前价格](https://docs.x.com/x-api/getting-started/pricing) |
| 知乎 | **已存在官方数据开放平台**，列出 zhihu_search、global_search、hot_list；是中文部分优先候选 | 需个人中心 Access Secret；公开页未查到可以可靠引用的完整免费额度、定价、审批时长 | 登录/注册官方平台，获取接入资格与 Access Secret；询问热榜/搜索额度、是否包含回答、模型摘要与本人邮件用途授权；不先买第三方爬虫。[官方平台](https://developer.zhihu.com/) |
| 微博 | 热搜/事件传播适合中文社会热点，但官方旧 wiki 此次无可读接口权限说明；微指数官网提示网页版升级暂停 | **本次不能验证可即接的全站热搜/评论官方 API 与价格** | 若必须覆盖，向微博官方数据服务确认接口、账号资质、报价、允许用途；人工提供热点链接只作为临时补充。[微博开放平台旧入口](https://open.weibo.com/wiki/2/statuses/public_timeline)、[微指数官网](https://data.weibo.com/index) |
| 哔哩哔哩 | 官方开放平台的现有公开说明以账号授权、稿件管理、授权用户/稿件数据为主 | 需身份认证审核、应用和 UP 主授权；**不是已验证的全站热门/全部评论 API** | 只有要接特定已授权 UP 主数据时才值得注册；若要全站舆情，先向平台确认，暂不建议为此盲目开通。[官方文档](https://open.bilibili.com/doc)、[开发者服务协议](https://open.bilibili.com/agreement/developer-service) |
| GitHub | 官方 search/repositories + repository metadata，每日存 stars/forks 数量形成变化值 | 公共仓库可匿名；个人 token 可提高额度，无需购买 GitHub Pro | 少量采样无需操作；候选池扩大后配置专用最小权限凭据。已有 gh 登录不等于自动授权服务长期读取其凭据。[Search repositories](https://docs.github.com/en/rest/search/search#search-repositories)、[REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) |

“直接可用”指接入门槛，不是无限转载许可。HN API 文档仓库的 MIT license 不等于所有用户评论及外链新闻均为 MIT。公开可读也不等于可以永久存储原帖、复制全文或转售；建议邮件以自己的短摘要、必要归因和原链接为主，不打包评论库、头像、图片或视频。[YC 条款](https://www.ycombinator.com/legal/)、[Bluesky 条款](https://bsky.social/about/support/tos)、[GitHub 条款](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service)

## 值得提前知道的费用与限制

- **X 当前不是旧 Basic/Pro 月费模型。** 当前 pricing 页是预付 credits 按用量：Post read 为 **US$0.005/条**，User read 为 **US$0.010/个**，Trends 为 **US$0.010/请求**。按每天获取 1,000 条新 Post、30 天估算，仅 Post 读取约 **US$150/月**，不含用户对象等其他计费项；同一 UTC 日重复资源通常去重但不是绝对保证。最终以控制台为准，不在本轮购买。[X 价格](https://docs.x.com/x-api/getting-started/pricing)
- X Developer Policy 的某段仍出现旧 Free/Basic/Pro 词汇，与现行 pricing 页不同步；不能据旧套餐文字报价格。政策同时要求披露用途，限制内容再分发并处理删除。**自动邮件复制原帖不应套用“手动下载最多 500 对象”的例外。** 若采用模型摘要，要把推理处理、邮件输出与保存期限纳入用途确认。[X Developer Policy](https://docs.x.com/developer-terms/policy)
- Reddit Wiki 给符合免费资格的 OAuth client **100 QPM**（按窗口平均）；但首先必须获批。商业使用及不明确允许用途需另行协议，价格未在本次官方资料中核实。禁止未授权训练模型不等于“一切摘要推理自动禁止”，也不等于“个人摘要自动获准”；应就本用途获得明确答复。原帖删除后的内容处理要求使长期不可撤回全文邮件尤其不适合。[Reddit Wiki](https://support.reddithelp.com/hc/en-us/articles/16160319875092-Reddit-Data-API-Wiki)、[Data API Terms](https://redditinc.com/policies/data-api-terms)
- GitHub 普通 REST 匿名主额度 **60 次/小时/IP**，用户认证一般 **5,000 次/小时**；Search 另有 **匿名 10 次/分钟、认证 30 次/分钟**，还要遵守 secondary limits。各请求看实际响应头，不把不同桶简单相加。仓库搜索每个查询最多 1,000 结果，需分主题/语言/创建时间做候选覆盖，而非全网穷举。[REST 限流](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)、[官方 search 文档源码](https://github.com/github/docs/blob/main/content/rest/search/search.md)

## GitHub 热门如何做得有用

以下为建议方案，不是 GitHub 官方 Trending 算法：

1. **发现**：多个主题、语言、近期创建/更新窗口的官方仓库检索，加 HN Show/Top 指向的 GitHub 项目。不要只查询 `repo:openai/codex`，也不要只按总 stars 排榜。
2. **保存轻量快照**：稳定 repository ID、名称、链接、描述、语言、license 标识、stars/forks、采集时间。两个真实快照才有净增长；第一天标“新发现”，不编“今日新增 star”。净 stars 变化包含取消 star，不等同全部新增事件。
3. **排名**：同时考虑绝对增长、相对增长、与用户兴趣匹配、工程实用性和项目成熟度，防止大项目常年霸榜或极小项目百分比膨胀。这些为产品判断，不能宣称 GitHub 认证热度。
4. **历史降权**：记录 last_reported_at；例如 14 天内明显降权，重大新版本/新能力再出现可以突破。不是永远去重；讲清“本次有什么新变化”。14 天是建议配置，不是硬发布门。
5. **摘要**：仓库元数据用于发现；要描述具体功能，读取项目官方文档/主页并看许可，不能从一句 description 推导功能优劣。读源码/README 并非每天必须，复制大段内容更不是必须。

官方 Search API 可按 stars/forks/updated 排序，返回计数和时间，但没有文档化的“最近一天新增 stars 排序”参数。本次未在官方 REST 文档中找到 Trending endpoint，因此 **不要把第三方 github-trending-api 或网页抓取当成官方稳定接口**；如确实需要官网 Trending，单独作为可降级发现线索，接口主体仍用 REST。[Search repositories](https://docs.github.com/en/rest/search/search#search-repositories)

## 具体启动顺序

1. 无购买启动：HN + Bluesky 公共账号/feed + GitHub 多主题检索与快照。Mastodon 在选好实例后补充。
2. 优先 Owner 操作：**知乎平台登录/接入咨询**，解决中文讨论覆盖；**GitHub 专用最小权限 token**，解决规模与共享 IP 限额，不请求私有仓库权限。
3. 按价值加购：需要突发事件/专家信息覆盖时上 X，先用小样本估算实际账单；Reddit 并行申请，但不阻塞基础日报。
4. 中文综合覆盖仍不足时，再谈微博官方数据合作。B 站官方授权数据不是全站舆情替代品，不为“有平台账号”而盲目注册。

请求平台许可时可直接提交：Observer 是个人每日中文 HTML 邮件服务，仅收集选定主题的公开内容，使用 coding agent 做摘要推理而非训练模型，不转售帖子库，不抓私信/受保护内容；请明确允许的字段、采样频率、传给模型的范围、原始数据保存期、摘要邮件和删除后的处理义务。**注册账号和付钱解决访问问题，不必然解决所有用途许可。**

## 本次只读检查与不确定性

2026-09-08 本机匿名请求：HN `topstories.json` 200；Bluesky `getAuthorFeed?actor=bsky.app&limit=1` 200；同公共主机 `searchPosts?q=technology&limit=1` 403；知乎官网 200、页面标题“知乎数据开放平台”。未对 403 进行绕过，未访问受保护或付费内容。

知乎功能与鉴权信息来自官方站搜索索引可读文档；站点是前端应用，本次 web open 出现内部读取错误，普通 HTTP 能打开页面壳。**未登录个人中心，未实际调用其鉴权数据 API，价格/配额/审批和摘要许可仍待平台确认。** 微博旧接口此次无可读响应内容，不能据此断言平台绝对没有 API。本文不会把“未知”伪装成“免费即可用”或“必须付费”。
