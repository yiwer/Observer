# 世界要闻、财经日报：来源选择与接入动作

调研日期：2026-09-08。仅研究，没有注册、购买、启用新源或发送邮件。目标是每天给 Owner 的中文原创 HTML 摘要，不是全文转载服务。

## 结论与推荐组合

**不必先购买新闻数据库。先用多媒体 RSS 做发现、官方公告做核实，再由 Agent 补充检索。财经可选注册 Alpha Vantage 免费 key。** 官方组织消息不能代替独立媒体报道；统计数据不能代替财经新闻；聚合 API 的“全文搜索”也不等于它返回全文。

- 世界要闻：BBC World + DW 英文/中文 + 联合国新闻中英文 + GDELT 跨地区发现；中国政策用国务院原文，国际事件补所在地机构声明和独立媒体。不要再让 USGS 承担整个世界栏目。
- 财经：BBC Business / DW Economy 等媒体发现 + Fed / ECB / BLS / Eurostat + 人民银行 / 国家统计局 / 国务院政策 + SEC / 中国交易所披露 + 公司 IR。Alpha Vantage 是可选的市场新闻候选补充，不是必需品。
- 建议至少分中国、北美、欧洲及其他地区检索，按事件合并多篇转载，限制单一机构占满栏目；这是编辑建议，不是新的发布硬门槛。有几条有价值内容就发几条。
- 空源不能静默：区分“没有更新”“访问失败”“只有标题无法核实”“需要账号/付费”，先换备用入口，仍缺失则告知 Owner 缺什么、是否需要操作。不要把旧稿改成今日新闻。

## 1. 无需 Owner 注册/购买的入口

下表的“直接”指技术接入不需要账号；它不自动表示获得全文复制、图片、AI 处理或对外分发的一揽子许可。建议邮件写原创事实摘要、保留归因和链接，不拷贝新闻正文。媒体只给标题时应读取可访问原文或另找证据，不能靠标题编写细节。

| 来源与角色 | 直接入口 / 获取方式 | 得到什么、主要缺口 |
| --- | --- | --- |
| BBC World / Business：广谱媒体发现 | [World RSS](https://feeds.bbci.co.uk/news/world/rss.xml)、[Business RSS](https://feeds.bbci.co.uk/news/business/rss.xml)；[官方 Feed 入口](https://support.bbc.co.uk/platform/feeds.htm) | 标题、短描述、原文链接；并非保证正文。英国编辑视角，需搭配其他地区来源。RSS 使用需遵守 BBC 来源标注等要求；本次没有把旧 PDF 条款当作完整的当前 AI 授权。 |
| DW：欧洲视角及中文国际报道 | [英文 RSS](https://rss.dw.com/rdf/rss-en-all)、[中文 RSS](https://rss.dw.com/rdf/rss-chi-all)；[官方 RSS 目录](https://corporate.dw.com/en/rss-feeds/a-68693346) | RSS 候选与文章链接，英中版本不是两份独立证据；正文重用与定制分发可走 [DW 合作入口](https://www.dw.com/downloads/35915853/contentbox_english.pdf)。 |
| 联合国新闻：国际组织第一方消息 | [英文 RSS](https://news.un.org/feed/subscribe/en/news/all/rss.xml)、[中文 RSS](https://news.un.org/feed/subscribe/zh/news/all/rss.xml)；[官方服务说明](https://www.un.org/zh/department-global-communications/news-media) | 人道、国际安全、发展议题，免费订阅；这是联合国视角，不能代表全部世界要闻。用“联合国称/据其报告”，不用作独立佐证自身主张。 |
| GDELT DOC：跨国新闻发现 | [DOC API 文档](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/amp/)，公开 `/api/v2/doc/doc`，ArticleList 模式 | 跨语言检索、标题/URL/来源等；所谓 full-text search 是检索能力，ArticleList 并非完整正文服务。无 key；[GDELT 数据集允许免费使用、要求引用](https://gdeltproject.org/about.html)。该许可不转授链接文章版权。检索覆盖不等于媒体质量，必须筛源、去重和读原文。 |
| Fed / ECB：货币政策原始发布 | [Fed RSS 目录](https://www.federalreserve.gov/feeds/feeds.htm)、[ECB RSS 目录](https://www.ecb.europa.eu/home/html/rss.bg.html)、[ECB MID](https://www.ecb.europa.eu/press/html/mid.en.html) | 政策决定、讲话、统计发布；无需 key。按发布节奏更新，不保证每天有新闻。ECB MID 明确公开可自动处理，不能扩大到所有第三方内容。 |
| BLS / Eurostat：宏观统计发布 | [BLS RSS](https://www.bls.gov/feed/)、[Eurostat RSS 目录](https://ec.europa.eu/eurostat/web/rss) | 就业、物价、经济等的发布稿与数据更新，非市场解读。保留数据对应月份/季度、初值/修订值、同比/环比。优先新闻发布 RSS，别把全量数据集更新都当新闻。 |
| 中国人民银行 / 国家统计局 / 国务院：中文宏观政策 | [人民银行新闻](https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/index.html)、[统计局数据发布](https://www.stats.gov.cn/sj/zxfb/)、[统计发布日程](https://www.stats.gov.cn/xxgk/sjfb/fbrcb/)、[政策文件库](https://sousuo.www.gov.cn/zcwjk/policyDocumentLibrary) | 公开列表→文章/公告原文，无需注册。此次未核实到可承诺稳定的公共新闻 API，使用网页适配与检索补充，不能杜撰 RSS 地址。发布日程有助解释无更新日。 |
| SEC EDGAR：美股及在美上市公司原始披露 | [官方公开 API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) + 公告原文 | submissions/XBRL JSON 不需要 key，实时更新；财报/8-K 等不是媒体新闻，按关注公司读取。须设置真实联系信息的 User-Agent，并遵守 [总计不超过 10 请求/秒的 fair access](https://www.sec.gov/about/developer-resources)。不要误去注册“提交申报”的 EDGAR Next。 |
| 中国交易所公告：A 股公司披露 | [上交所公司公告全文](https://www.sse.com.cn/assortment/stock/list/info/announcement/)、[北交所公告](https://www.bse.cn/disclosure/announcement.html)；补公司官方 IR | 公开查询与文件；无需为浏览购买数据终端，但网站入口不等于获准高频批量 API。先低频按关注公司/重大事项取文，动态查询失败就报告；批量稳定数据可再询价巨潮/交易所。此轮未核实巨潮正式 API 套餐价格，不编造免费额度。 |

### 本机真实轻量访问结果

2026-09-08 使用普通匿名 HTTP GET，对来源正文只统计 RSS item，不保存全文、不运行产品回归：BBC World **200 / 28 items**；DW English **200 / 135 items**；UN English **200 / 30 items**；UN Chinese **200 / 30 items**。这些证明入口此刻能取回非空 RSS，不证明每条都是今天、内容全部可复用或长期 SLA。BBC Business、DW 中文本轮未做同样的 live probe。GDELT 未执行实时 API 查询，结论来自官方文档。

## 2. 需要注册、审批或付费的可选项

| 服务 | Owner 要做什么 | 本项目价值与选择 |
| --- | --- | --- |
| **Alpha Vantage** | [申请免费 key](https://www.alphavantage.co/support/#api-key)，作为本地环境变量提供；暂不买 Premium | 官方 [NEWS_SENTIMENT 文档](https://www.alphavantage.co/documentation/)提供新闻检索；[标准额度 25 请求/日](https://www.alphavantage.co/premium/)。适合补公司、市场、主题候选，不是全文授权库，也不能让供应商情绪分直接变成投资结论。[条款](https://www.alphavantage.co/terms_of_service/)基础授权为个人非商业，业务或扩大发送需另谈。新 key 的实际端点 entitlement 尚未实测，若提示 Premium 应报告，不自动购买。 |
| **Finnhub** | 注册 API key；如果要把数据交托管 Codex 处理并长期邮件留存，先向供应商确认该用途 | [Market/Company News 文档](https://finnhub.io/docs/api/quote)给 headline/summary/url，普通公司新闻限北美，免费 tier 标明一年历史及新更新；不能补齐 A 股。独立 Newsroom Premium 才有 fullText 入口。[条款](https://finnhub.io/terms-of-service)限制向第三方分享数据及衍生结果、订阅终止须删除；因此不是本项目优先免费推荐。 |
| **NewsAPI.ai / Event Registry**，不是 NewsAPI.org | 企业/学校邮箱注册，先评估，再决定订阅；无此邮箱先咨询支持 | [价格页](https://newsapi.ai/plans)显示 5K Plan **US$90/月**，返回正文、事件聚类、去重；免费 2,000 搜索不是每月续杯。[条款](https://newsapi.ai/terms)要求公司/学术邮箱，免费仅评估测试，不转授第三方出版权。对“省爬虫维护”有价值，对“自动取得新闻版权”无效。购买前用中英文样本验证覆盖，并确认私人 AI 摘要邮件用途。 |
| **Reuters Connect / AP Media API** | 联系销售说明私用中文摘要、每日一次、六栏目、AI 处理及邮件留存需求，索取报价和授权 | 高质量全球新闻线的长期升级项，不是免费 RSS 的等价物。[Reuters 订阅](https://www.reutersconnect.com/plans-and-pricing)包含文字等并按协议限定平台/期限；个人图片单买不是文字新闻 API 订阅。[AP API](https://api.ap.org/media/v/docs/Getting_Started_API.htm)只能访问合同许可内容，价格依合同；[AP 销售入口](https://www.ap.org/content/)。无公开可核实统一月价，不猜报价。 |
| **Guardian Open Platform** | 若坚持使用，联系 licensing 商谈本项目权限 | 免费 key 可取正文；标准条款限制 AI/改写，本项目须另谈授权，不列免费即用。[访问套餐](https://open-platform.theguardian.com/access/)、[条款](https://www.theguardian.com/open-platform/terms-and-conditions)。 |
| **NewsAPI.org** | 不建议为当前需求购买 | [官方定价](https://newsapi.org/pricing)：免费仅开发测试、延迟 24 小时，不能用于生产（含内部）；Business **US$449/月**。所有计划都不提供全文。采购解决检索量，不解决原文获取与授权，不适合本项目快速低摩擦起步。 |

## 3. 真正需要 Owner 操作的最小清单

1. **目前不必买任何新闻 API**。上面的公开媒体发现与官方原文已足以开展可用的世界/财经日报。是否启用由主任务统一确认，本研究未擅自改配置。
2. **可选一项免费注册：Alpha Vantage key**，用于增强财经发现；不需要交出账户密码。不要为了新闻采购实时行情权限，新闻和行情是两种不同产品。
3. **有预算且希望少维护采集器：评估 NewsAPI.ai 试用**；条件是公司/学校邮箱或供应商支持。若要求真正授权新闻线而不是聚合抓取，改为 **Reuters/AP 询价**。这两项是不同升级路径，不建议同时购买。

获取顺序建议：RSS/公告收集 → 跨地区检索补漏 → 读被选候选的可访问原文 → 按事件整理中文原创摘要 → HTML 邮件。有证据就发，不要求凑满 7 条；未知原因不能在邮件中伪装为“今日无新闻”。本报告的用途边界是供应商文档核对，不是法律保证。
