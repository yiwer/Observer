# 六栏日报：数据怎么取、哪些要开通、哪些值得买

调研日期：2026-09-08。目标是私人中文 HTML 日报，不要求每栏凑满 7 条。本报告是选型研究，不代表来源已经启用、第三方已经批准用途或六栏生产已经可用；本轮没有注册、购买、发信或修改业务代码。

## 先给结论

推荐「公开订阅/官方接口持续收集 + 一个搜索/网页提取服务补遗漏 + 平台专用接口」组合，而不是单买一家新闻 API，也不是让模型凭记忆写新闻。

- 可以先不买新闻数据库。公开发布能覆盖大量世界、AI、财经和科技事件；HN 和 GitHub 也有公开接口。
- 最值得先注册的是一个搜索服务，建议 Tavily；Exa 为替代，不要求同时开通。它们帮助发现与读取网页，不替代原出版者的内容权利，也不保证拿到付费墙后的正文。
- GitHub 已有账号，不需要再注册；正式批量观测建议最小权限只读身份，凭据只交采集器，不交新闻正文中的 Agent。
- 中文社交是最大接入缺口。优先申请知乎官方数据开放平台；Reddit 要走准入，X 要开开发者接口并付费。不要把 HN/Bluesky 当成中国或全球公众意见的替代物。
- 全文订阅和 API 授权是不同产品：购买媒体阅读会员，不自动获得批量抓取、模型处理或外发全文的许可。

下面“直接”只表示相关公开入口无需注册/密钥即可开始取数；若仅有公开网页，仍要完成适配并遵循站点实际使用规则。文档确认、匿名实测、生产运行是三种不同证据，不混称“全部已接好”。

## 六栏推荐组合

| 栏目 | 基础来源与取法 | 需要补的部分 | Owner 操作 |
|---|---|---|---|
| 世界要闻 | 多家媒体 RSS/公开报道做发现，GDELT 做跨语言线索；联合国、各国机构和事件所在地官方发布做核对 | 中外媒体及不同地区的视角；官方发布不能替代独立报道，USGS 仅灾害子项 | 基础入口不用新账号；推荐一个搜索 API；需要 Reuters/AP 结构化全文时再谈许可 |
| AI | OpenAI RSS、Anthropic/DeepMind 官方新闻页、HF 博客与 Daily Papers、arXiv 多分类；加入 Qwen/DeepSeek 等中国模型团队发布 | 产品、开源生态、论文、监管与行业应用分别检索；公司性能声明须保留归因 | 大部分公开源无需开通；可选 OpenAlex 免费 key、搜索 API |
| 财经 | 中国及主要经济体央行/统计发布、上市公司公告；财经媒体和搜索补公司、政策、市场原因 | 原始宏观数据不是财经新闻；如要行情表再接行情 API，不能用旧价冒充实时 | 可选 Alpha Vantage 免费 key；专业行情与通讯社全文后置购买 |
| 科技前沿 | NASA/ESA RSS、中国科学院进展、芯片与机器人公司新闻、arXiv、Crossref/OpenAlex；专业科技媒体补独立解读 | 航天、芯片、机器人、量子、生物、能源材料分别覆盖，不能只订 quant-ph | 公开机构源无需账户；推荐 OpenAlex key；遇挑战/付费墙的媒体不是必需依赖 |
| 社交舆论 | HN 热门/新帖及评论；Bluesky 定向公开账号样本；申请知乎、Reddit，按需接 X | 中文覆盖、跨平台偏差、评论上下文；热榜代表平台排序，不代表民意比例 | HN 无；Bluesky 搜索另核权限；知乎/Reddit 需申请；X 需开发者账户与 credits |
| GitHub 热门 | GitHub REST 搜索扩大候选，再记录仓库 stars/forks 等快照；榜单网页仅作候选发现 | 新项目与成熟项目分组；真正增长靠历史双点，重复报道按既定历史降权 | 公开小样本无；扩大采集建议只读 token，无需付费套餐 |

世界/财经的逐源证据和条款见[分项报告](six-editions-world-finance-2026-09-08.md)；社交/GitHub 的准入和端点见[分项报告](six-editions-social-github-2026-09-08.md)。表中的组合是研究建议，不是对新闻完整性的承诺。

## AI、科技前沿：可直接接的具体入口

| 来源 | 入口/数据 | 注册与付费 | 用法与局限 |
|---|---|---|---|
| OpenAI 新闻 | [官方 RSS](https://openai.com/news/rss.xml) | RSS 无账户或 API key | 模型、产品、政策公告；是厂商视角，不代表独立测评。无需购买 OpenAI API 来读取 RSS |
| Anthropic | [Newsroom](https://www.anthropic.com/news) | 公开 HTML 无账户 | 用列表与文章页适配；本轮没有证实官方 RSS，不能用第三方生成 feed 冒充官方接口 |
| Google DeepMind | [官方新闻页](https://deepmind.google/blog/) | 公开页面无需账户 | 研究、模型、机器人进展；按真实文章日期提取，不能只读首页标题 |
| Hugging Face | [博客 RSS](https://huggingface.co/blog/feed.xml)、[Hub API](https://huggingface.co/docs/hub/api)、[Daily Papers 接口文档](https://huggingface.co/docs/huggingface_hub/en/package_reference/hf_api) | 公开博客无需账户；受限资源另行授权 | 开源模型/工具和社区关注论文。Daily Papers 是社区选题信号，不是全球论文全集或同行评审证明 |
| 中国模型团队 | [Qwen 博客](https://qwen.ai/blog)、[DeepSeek 官方入口](https://www.deepseek.com/)及其链接的官方仓库/报告 | 公开发布无需新付费订阅 | Qwen 页面动态内容在本轮文本浏览器不可提取，需网页适配或官方关联仓库，不能宣称现成 RSS |
| arXiv | [RSS](https://info.arxiv.org/help/rss.html)、[查询 API](https://info.arxiv.org/help/api/user-manual.html) | 公开接口无 key，免费 | AI 合并 cs.AI/cs.LG/cs.CL/cs.CV 等相关分类；前沿按量子/机器人/材料等主题查询，并按论文 ID 去重；这是建议配置，不是已实施 |
| Crossref | [REST 访问说明](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/) | 无需注册；建议提供有效联系邮箱进入 polite pool | DOI、出版日期与期刊信息补全；不能保证有摘要或全文，也不是实时科研新闻总线；速率看响应头 |
| OpenAlex | [认证](https://help.openalex.org/api/authentication/)、[费用](https://help.openalex.org/access/pricing/) | 当前允许轻量匿名，推荐注册免费 key；免费 $1 用量/日，无需支付方式 | 跨学科发现和论文元数据补查。2026-02 老公告曾称全部请求要 key；本报告采用 2026-08 更新的帮助页，不沿用过时说法。索引日期不是事件发生日 |
| NASA / ESA | [NASA RSS 目录](https://www.nasa.gov/rss-feeds/)、[NASA 新闻 RSS](https://www.nasa.gov/news-release/feed/)、[ESA RSS 目录](https://www.esa.int/Services/RSS_Feeds) | 无需账户 | 航天、航空、任务与科研原始发布，不是整个科技栏；图片/第三方内容单独处理，本日报无需搬运图片 |
| 中国科学院 | [科研进展](https://www.cas.cn/syky/) | 公开网页 | 中国科研与机构发布；需 HTML 适配，未确认稳定官方新闻 API |
| 行业一手发布 | [NVIDIA Newsroom](https://nvidianews.nvidia.com/)、[Boston Dynamics](https://bostondynamics.com/blog/)、[美国能源部 Science Highlights](https://www.energy.gov/science/listings/science-highlights) | 公开页面可发现/阅读 | 芯片、机器人、能源材料的起始节点；每个主题还需同行与独立解读，不把市场营销当成实验结论 |
| Nature | [新闻订阅入口](https://www.nature.com/nature/articles?format=rss&type=news)、[使用条款](https://www.nature.com/info/tandc.html) | 部分内容可能需订阅；技术入口也可能被挑战拦住 | 本机本轮实际收到 Client Challenge HTML，不是可用 RSS；列为可选补充，不让它阻断基础日报，不建议为了接入先买个人会员 |

arXiv 的描述性元数据（含摘要）可按 CC0 使用；论文全文的分发许可另看每篇许可证。官方要求 legacy API/RSS 在所有受控机器合计每 3 秒最多一次且单连接；不能用并发机器规避。[arXiv API 条款](https://info.arxiv.org/help/api/tou.html)

arXiv 按发布日程工作，不是 24×7 滚动新闻；2026-09-07 在其假日日历内，是本次空 feed 的相关背景，不能据此断定所有空结果都由假日引起。RSS 为空时，用 API 查询最近若干发布日并与已报道记录对比，保留原始发布日期；旧论文只有确有新进展或补报价值才进入日报，不改日期凑数。[发布时间表](https://info.arxiv.org/help/availability.html)、[API 日期/排序说明](https://info.arxiv.org/help/api/user-manual.html)

## 搜索与正文补充：只开通一家即可起步

价格为本次官方页面快照，美元、未含税；示例不含 Codex/Claude 消耗。这里是获取层，不需要重复购买另一套“生成日报的 AI”。

| 服务 | 可取得什么 | 注册/费用 | 推荐程度 |
|---|---|---|---|
| Tavily | 新闻/网页搜索、日期和域名过滤、网页提取 | 注册 key；1,000 credits/月免费、无需信用卡；Basic Search 1 credit，Advanced 2；按量 $0.008/credit，4,000 credits 套餐 $30/月 | 首选试用，搜索和提取同一套接口，便于快速接入；没有声称已经做过召回质量对比 |
| Exa | 搜索、网页正文、语义发现；不同端点不同价 | 注册 key；当前页面列注册 $20 credits、每月 $10，无需支付方式；基础 Search $7/千次（至多10结果），Contents $1/千页/内容类型 | Tavily 的替代，不需同时购买；多结果与附加功能可能另计 |
| Brave Search API | 网页/新闻结果与面向模型的上下文 | 注册并开通 key；Search $5/千次，每月 $5 credits；页面为预付模式，账户开通具体支付要求以控制台为准 | 如果更看重检索覆盖而自行做正文提取，可选；不是永久免费的无限新闻 API |
| NewsAPI.org | 新闻发现、标题、摘要与 URL | 免费仅开发测试、延迟24h；生产 Business $449/月；所有方案不提供文章全文 | 不推荐本项目第一笔购买：费用高，仍未解决正文获取 |
| NewsAPI.ai / Event Registry | 新闻正文获取、事件聚类和去重 | 与 NewsAPI.org 不是一家；5K 方案 $90/月，免费2000次仅评估且不按月刷新；注册涉及公司/学校邮箱要求 | 可选付费省维护路线；需先用中英文样本评估，并确认所需 AI 摘要用途。不是文章版权买断 |

依据：[Tavily 官方计费](https://docs.tavily.com/documentation/api-credits)、[搜索参数](https://docs.tavily.com/documentation/api-reference/endpoint/search)、[Exa 官方价格](https://exa.ai/pricing?tab=api)、[Brave 官方价格](https://api-dashboard.search.brave.com/app/plans)、[NewsAPI 官方价格与 FAQ](https://newsapi.org/pricing)。

NewsAPI.ai 依据：[套餐](https://newsapi.ai/plans)、[注册和内容条款](https://newsapi.ai/terms)。Guardian 免费正文 API 不纳入本项目即用清单，因标准许可不适合直接 AI 摘要，应另谈授权；Finnhub 对第三方数据/衍生结果分享的限制也需要澄清，详见世界/财经报告。

量级示例（不是保证账单）：每天 24 个 Basic Search 查询，30 天为 720 Tavily credits；另做 300 个成功 Basic Extract 页面，按每5页1credit约60，共约780，可能落在免费额度内。同样查询若用 Advanced，就会超过免费量。实际中文覆盖与正文成功率需一次真实取样比较，不能凭价格认定“最全面”。

## 怎样取才比较全面：建议而非额外发布门槛

1. 每栏分主题查询，并同时做中文、英文；世界要闻再补事件发生地的本地来源。不是把语言数量设成发刊门槛。
2. 订阅源用于稳定发现，搜索用于遗漏与重要事件的另一视角，原文用于摘要依据。搜索片段不足以支持具体数字时继续取原文，取不到就明确“仅有标题/摘要”，不假装读过全文。
3. 从过去数日发现候选，按实际发布日期、新进展和已报道历史决定今天写什么。这样能容忍周末、节假日、RSS 故障，不用强制扩大事件日期造“今日”。
4. 针对普通官方发布写清“某机构公布/某公司称”；对争议、伤亡或复杂因果再找另一独立来源。转载同一通讯社稿不是第二个独立来源。
5. 六栏有多少可读内容就发多少；空栏要区分当天无新条目、源无法访问、需要账户、额度耗尽，并点名具体缺什么。正常新闻邮件不灌入内部协议说明。
6. 社交栏围绕同一话题抽多个立场和平台，保留样本边界；用户帖子不是公共意见统计。GitHub 先积累历史，再称增长，避免把一个已知仓库当全网热门。

## Owner 最少操作清单

| 优先级 | 你需要做什么 | 现在是否要付钱 |
|---|---|---|
| 1 | Tavily 注册，取得 API key；若偏好 Exa 则二选一 | 不需要，先用免费额度 |
| 2 | 使用既有 GitHub 账号，为公开仓库采集选择最小只读凭据；不需要重新注册 | 不需要 |
| 3 | 若要跨学科论文发现，OpenAlex 注册并取得 key | 不需要 |
| 4 | 若重视中文社交，申请知乎开放平台；若重视 Reddit，提交官方准入申请 | 先申请；批准范围和商业价格未确定，不代你作承诺 |
| 5 | 若必须覆盖 X，开开发者项目、买 credits，并确认所需读取端点 | 需要；见社交报告中的单位价格与量级例子 |
| 可选 | Alpha Vantage 免费 key，用于财经新闻发现补充 | 免费额度可起步，不能假设覆盖全部新闻或实时行情 |
| 暂不做 | 买 NewsAPI、Reuters/AP 新闻全文许可、专业行情包、媒体阅读会员 | 未发现现阶段必需的理由；通讯社授权需销售报价 |

拿到 key 后放本机秘密环境变量或秘密存储，仅告诉我变量名，不把值贴在聊天或提交到 Git。源清单、抓取与 HTML 整理应由我完成，不要求你手工编辑来源配置。

## 本次最少实际可用性观察

2026-09-08 从当前个人主机匿名 GET，不使用登录或绕过挑战，没有调用任何付费 API：

| 入口 | 观察 |
|---|---|
| OpenAI News RSS | HTTP200、XML，1173个item；这不是1173条今日新闻 |
| Hugging Face Blog RSS | HTTP200、RSS，859个item；仍需日期过滤 |
| NASA 新闻 RSS | HTTP200、RSS，10个item |
| Anthropic Newsroom | HTTP200、HTML，页面标题正确；不是结构化API |
| Nature news RSS | 跳到访问挑战，HTTP200但HTML标题为Client Challenge，不能当RSS成功 |
| BBC World / DW English | HTTP200，分别28/135个item；不是全部当日新闻 |
| 联合国英/中文 RSS | HTTP200，各30个item |
| HN / Bluesky | HN topstories及Bluesky指定公开账号feed为200；Bluesky匿名关键词搜索为403，未绕过 |

当前旧采集器有每源1000条上限，OpenAI Feed 的全历史数量已超过该上限，因此“数据免费且存在”不等于“只粘贴URL就能运行”，还需适配分页/候选截取策略。HN、Bluesky 的匿名观察见社交分项报告。其余来源主要依据官方文档，不声称全部从当前主机端到端跑通。

研究使用 research skill 的后台分项调研与第一方证据要求；结果仅落本文及两份分项报告，不改变已批准 PRD/ADR、生产 Source Policy 或费用授权。
