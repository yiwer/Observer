# V1-09 六个来源提案的独立证据审查

审查日期：2026-09-06（Asia/Shanghai）。结论：**原提案需要补正 OCHA oPt 站点使用条款和 NASA AI 输出归因规则；六条来源继续 `pending`，C/M/D/A 全为 `false`。** 本报告是来源提案审查，不是许可批准、配置或 Collector 验收。

## 输入与审查边界

- 只读输入：`O:/GenesisCode/Observer-worktrees/v1-09/docs/research/domain-evidence-source-proposals-2026-09-05.md`，原调研日期为 2026-09-05。
- 本报告的原文行号绑定 SHA-256 `EE7A0DBBE45AC0C46F454D2146DBE199B96582C256F5AB2DAB7BCCEC6BB4D3C5`；读取时工作树 HEAD 为 `df63b78875a1fb8b4c85389ac6797ddfc5e75400`。工作文件指纹与 HEAD 分别记录，不能假设文件已提交。后续修订不改变这里记录的原文定位。
- 使用 research 技能执行独立研究，实际浏览六家第一方页面；对已知候选 feed 做少量一次性 GET 和内存 XML 检查。没有运行 Observer Collector、Research Agent/Provider、真实模型或 SMTP，没有产生生产 Evidence，没有改原提案、SourcePolicy、许可、配置或 tracker。
- **官方文档确认**表示第一方页面直接写明该信息或直接链接该入口；**endpoint/payload 实测**只表示下述一次 HTTP 请求和 XML 结构观察；**许可未定**表示当前拟用字段、处理方、分发和存留尚未形成 Owner 决定。公开访问、RSS 入口和 HTTP 200 均不替代内容权利依据。
- 有公开许可依据与内部仍待审可以同时成立。不能把内部 `pending` 写成权利人没有授予任何权利，也不能因某页读取失败推断没有授权。

## 六条来源核对

### 1. OCHA oPt：官方入口成立，遗漏了本站条款

**官方文档确认：** [Publications](https://www.ochaopt.org/publications) 和[主页](https://www.ochaopt.org/)确有该地域的人道报告；[原提案报告示例](https://www.ochaopt.org/content/humanitarian-situation-report-28-august-2026)标题日期是 8 月 28 日，页面发布日期显示 8 月 29 日，正文还分别列出报告时段及上游归因。提案要求保留归因与统计截止时间有依据，报告标题日期不能自动充当发布时间。

**权利重要遗漏：** Publications 原始 HTML 直接链接本站 [Terms of use](https://www.ochaopt.org/page/terms-use)。其中 (a)/(b) 对本站 UN 材料授予个人、非商业的访问、下载和复制，同时明确不授予转售、再分发、汇编或制作衍生作品的权利，并受具体材料限制。原文第 15 行只记版权标识及 UN 商店规则的适用性未知，未反映这个直接适用本站的条款入口。若要覆盖提案中的邮件/PDF 分发和衍生文本，当前条款不足以支持这些用途；可能存在的逐件另行许可仍为 **unknown**，本轮未取得。[UN Rights & Permissions](https://shop.un.org/rights-permissions)区分出版物摘录、数据库等使用，不能拿它覆盖本站限制。

**访问限制：** 本次 Publications GET 为 HTTP 200；在检查的 HTML `link`/`a` 标签中未找到 RSS/Atom 入口。这只支持“本次未发现”，不能证明该站没有 feed/API。`feedUrl` 继续 **unknown**，本报告未构造猜测路径。状态：`pending / false / false / false / false`。

### 2. Eurostat：入口与一般许可主张成立，需明确翻译义务和覆盖范围

**官方文档确认：** [RSS 目录](https://ec.europa.eu/eurostat/web/rss)将 News releases、Eurostat news、Datasets 分开，并在各自下列主题；原提案选的是 News releases → Economy and finance。官方链接的查询参数与原文第 26 行一致，浏览工具展示时重排参数不构成另一个 feed。[Euro indicators](https://ec.europa.eu/eurostat/news/euro-indicators)说明按预定日历发布月度/季度指标，但该总栏目范围大于本次经济金融主题。

**权利确认与限制：** [Copyright notice](https://ec.europa.eu/eurostat/help/copyright-notice)确认 EU 自有编辑内容为 CC BY 4.0，统计数据、元数据、出版物等可署名复用，并列出逐件、第三方与商业复用例外。翻译或修改必须明确告知最终用户，并附 Eurostat 不承担责任的声明；出版物翻译还有指定版权与译者说明。原文“翻译/修改告知另查”应补成已查得的义务，不能简化为署名即可。一般许可已经存在；待审的是实际字段、材料例外和拟用流程如何满足这些条件。

**payload 与范围：** 下表单次 Atom 响应可解析，11 条中有 GDP/就业合并发布，但不应据此宣称涵盖全部就业/失业发布；官方总栏目将当期失业率发布归于 Population and social conditions。此为原窄来源的覆盖限制，本报告不新增该主题来源。[Euro indicators](https://ec.europa.eu/eurostat/news/euro-indicators)。状态：`pending / false / false / false / false`。

### 3. Fed Board：原许可概括基本准确，不能外推其他机构

**官方文档确认：** [RSS 目录](https://www.federalreserve.gov/feeds/feeds.htm)的 Press Releases → Monetary Policy 直接链接 [press_monetary.xml](https://www.federalreserve.gov/feeds/press_monetary.xml)，与原提案一致；目录将其他数据更新 feed 分列。

**权利确认与限制：** [Disclaimer](https://www.federalreserve.gov/disclaimer.htm)明确除另有标识外，Board 站点信息属于公有领域，可未经许可复制和分发，并请求注明 Board 来源；标明来自非 Board 的材料需向相应权利方取得许可。Board 标识与外站材料也不能据此一并放行。原文第 17 行的核心概括有依据；本页没有替其他机构授予权利，不能外推到 FRED。尚待 Owner 决定所选公告字段、实际处理和存留；不应把文档没有单列“模型”二字解释成上述一般依据不存在。

**payload 限制：** 下表成功读取 RSS，共 15 条。仅验证入口和 XML 结构，未验证 Observer 解析适配、新闻筛选、部署连续访问或模型用途。状态：`pending / false / false / false / false`。

### 4. arXiv 描述性元数据：CC0 与限流主张成立，补充精确候选 endpoint

**官方文档确认：** [cs.AI 索引](https://arxiv.org/list/cs.AI/recent)与 [RSS 文档](https://info.arxiv.org/help/rss.html)确认类别及 `https://rss.arxiv.org/rss/`、`https://rss.arxiv.org/atom/` 构造规则。由此得到的 [cs.AI RSS](https://rss.arxiv.org/rss/cs.AI)已在本次请求返回 RSS XML；不再只是未请求的推导地址。这里只补充候选 URL 的技术证据，未填写产品配置。

**权利确认与限制：** [API Terms](https://info.arxiv.org/help/api/tou.html)明确描述性元数据可按 CC0 使用，脚注包含题名、摘要、作者、标识和分类，并允许获取、保存、转换和分享这类元数据。论文 PDF、源文件和其他正文的权利须按各篇许可另判，API 条款不是全文再分发授权。原文第 18 行与第 28 行基本准确；legacy API（含 RSS）的所有受控机器合计限流是每三秒最多一次、一次一个连接，本次未并行请求 arXiv 接口。

**研究状态与适配限制：** [审核说明](https://info.arxiv.org/help/moderation/index.html)直接说明 moderation 不是同行评审。RSS 中观察到 `description`、`rights` 等元素，不代表这些元素可整体无差别映射成正文；元数据与论文许可的映射仍待审。原提案不含全文的首轮边界可保留。状态：`pending / false / false / false / false`。

### 5. Anthropic newsroom：索引与条款描述成立，newsroom 具体许可仍未定

**官方文档确认：** [Newsroom](https://www.anthropic.com/news)实际返回日期、类别和公告链接。对能力与安全结果保留发布者归因，是合适的证据边界，不能从第一方公告推定独立验证。

**权利观察：** [Consumer Terms](https://www.anthropic.com/legal/consumer-terms)本次返回的默认正文标示生效日期为 2025-10-08，Services 定义涉及 Claude.ai、Claude Pro、其他面向个人的产品服务及关联网站；其使用章节列出抓取及自动化访问限制。Newsroom 原始 HTML 页脚确有 Consumer Terms 与 Commercial Terms 链接，但页脚链接本身不能解决 Consumer Services 的定义如何覆盖每篇 newsroom 公告，也不是公告复用授权。原文第 19 行将具体适用范围及分发、衍生、处理用途保持 **unknown** 是准确的观察边界；不宜升级为“已获许可”或“所有 newsroom 使用已被禁止”。

**访问限制：** 本次 Newsroom GET 为 HTTP 200，检查的 HTML `link`/`a` 标签未发现官方 RSS/Atom/news API 文档入口；未找到不等于不存在。未猜测或探测未记载 feed 路径。`feedUrl` 继续 **unknown**。状态：`pending / false / false / false / false`。

### 6. NASA news：官方 feed 成立，AI 输出规则必须补入待审项

**官方文档确认：** [2026 News Releases](https://www.nasa.gov/2026-news-releases/)为年度新闻发布索引；[RSS 目录](https://www.nasa.gov/rss-feeds/)原始 HTML 的 News Releases 链接指向 [news-release/feed/](https://www.nasa.gov/news-release/feed/)，区别于全站 Recently Published feed。

**权利重要遗漏：** 原文引用的 [Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)不只包含媒体使用规则，还包含 **Artificial Intelligence (AI) Applications** 专节；页面标示最后更新 2026-08-13。该节将 AI 输出归因于 AI 产品本身，禁止 AI 产品使用 “according to NASA” 或类似说法；允许事实性披露 AI 工具使用 NASA 源材料，但不得暗示 NASA 审阅或批准，并要求澄清 NASA 不对 AI 输出准确性负责。页面也要求注意第三方材料和禁止暗示背书。

**适用限制与判断：** 原文第 20 行“主要涉及媒体材料”的概括遗漏了与计划中的模型处理和输出直接相关的规则，第 46 行统一机构归因建议也需要对照这一限制。上述页面同时使用 AI development、AI model outputs 和 AI products 等措辞；它如何适用于仅检索/当次推理的新闻摘要、以及原始出处列示与生成文字归因如何区分，仍为 **unknown**，不能擅自缩窄成仅训练适用，也不能据此认定全部新闻文字的任何用途均被禁止。现有提案不能把一般媒体署名建议直接当成 AI 输出模板。

**payload 限制：** 下表 RSS 可解析，10 条，含 `description` 和 `content:encoded` 类正文元素。这是格式观察，不能自动允许正文进入模型、邮件/PDF 或永久归档。状态：`pending / false / false / false / false`。

## 一次性 endpoint/payload 观察

以下 UTC 时间对应上海时间 **2026-09-06 03:03** 左右。GET 使用 PowerShell HTTP 客户端；XML 在内存中解析，禁用外部解析器与 DTD。表内 bytes 为客户端报告的 `RawContentLength`，不是生产 `maxResponseBytes` 建议。成功行的最终 URL 与请求 URL 相同，未记录完整逐跳链，因此不作“绝无中间重定向”的证明。

| 候选 endpoint | 请求观察 UTC | HTTP / Content-Type | XML / 条目数 / bytes | 首条日期字段原值 |
|---|---|---|---|---|
| [Eurostat Economy and finance Atom](https://ec.europa.eu/eurostat/en/search?p_p_id=estatsearchportlet_WAR_estatsearchportlet&p_p_lifecycle=2&p_p_state=maximized&p_p_mode=view&p_p_resource_id=atom&_estatsearchportlet_WAR_estatsearchportlet_theme=PER_ECOFIN&_estatsearchportlet_WAR_estatsearchportlet_collection=CAT_PREREL) | `2026-09-05T19:03:17.6152260Z` | `200` / `application/atom+xml; charset=UTF-8` | `feed`，Atom namespace；11；10295 | `published`、`updated` 均为 `2026-09-01T09:00:00Z` |
| [Fed Monetary Policy RSS](https://www.federalreserve.gov/feeds/press_monetary.xml) | `2026-09-05T19:03:50.7088430Z` | `200` / `text/xml` | `rss`；15；9637 | `Tue, 25 Aug 2026 18:00:00 GMT` |
| [arXiv cs.AI RSS](https://rss.arxiv.org/rss/cs.AI) | `2026-09-05T19:03:19.3280997Z` | `200` / `application/rss+xml` | `rss`；269；574889 | `Sat, 05 Sep 2026 00:00:00 -0400` |
| [NASA News Releases RSS](https://www.nasa.gov/news-release/feed/) | `2026-09-05T19:03:16.4054079Z` | `200` / `application/rss+xml; charset=UTF-8` | `rss`；10；227345 | `Sat, 05 Sep 2026 04:05:00 +0000` |

观察到的首条字段分别包括：Eurostat 的 `title/link/author/id/updated/published/summary`；Fed 的 `title/link/guid/description/category/pubDate`；arXiv 的 `title/link/description/guid/category/pubDate/announce_type/rights/creator`；NASA 的 `title/link/creator/pubDate/category/guid/description/encoded`。此处字段名只描述响应结构；RSS 的日期语义、HTML 清理、重复/修订识别、条目筛选和正文映射未做 Collector 联调。269 条和 574889 bytes 尤其不能被误写成 arXiv 未来固定容量或允许的生产上限。

浏览工具点击 Eurostat/Fed 官方目录链接时报告不支持 `application/atom+xml` / `text/xml`；这是该浏览工具的格式限制。随后使用 HTTP 客户端得到上表可解析响应。Fed 第一次本地 XML Load 还报告根部字符错误；加入字符串/BOM 规范化后的第二次 GET 解析成功。未保留首份响应，不能进一步证明第一次失败的具体原因，更不能把它断言为 Fed 站点故障。

原文第 30 行记录的是 **9 月 5 日调研时**看到的 08:00–18:00 维护提示。本轮 [Eurostat RSS 目录](https://ec.europa.eu/eurostat/web/rss)可读文本未出现该提示，Atom 单次 GET 成功；这些只说明本次观察，不证明维护何时结束、全服务已经恢复或未来持续可用。原提案的历史观察不必被改成当时已实测 feed，但后续使用“当前”必须带上原观察日期。

## 交给作者的具体修订项

下列行号只对应开头记录的原文件指纹；建议措辞是审查意见，**尚未修改原提案或任何来源策略**。

| 原文定位与主张 | 审查意见 | 可用建议措辞 |
|---|---|---|
| 第 15 行：仅记 OCHA 版权标识，站点/逐件许可统称 unknown | **必须补正**：漏掉本站直接链接的限制性使用条款。 | “已核对 OCHA oPt 本站 Terms of use：一般许可限个人非商业访问、下载和复制，不授予再分发或汇编/衍生权；未取得覆盖当前拟用链路的另行许可，逐件例外仍未知。继续 pending，全开关 false。” |
| 第 20 行“主要涉及媒体材料”；第 46 行统一机构归因建议 | **必须补正**：NASA 同页 AI Applications 规则与默认 AI 归因方案有直接关联。 | “该指南另含 AI Applications 专节，要求区分 NASA 源材料披露和 AI 产品输出归因；在该规则对本项目的适用范围及可行输出表达明确前，模型/衍生/分发/归档继续未批准。” |
| 第 16 行“翻译/修改告知另查” | **需具体化**：已查到告知、责任声明及出版物翻译说明，不应只留泛化待查。 | “翻译或修改需明确告知用户并加入 Eurostat 不承担责任的声明；出版物翻译另按官网要求保留版权、原出版物及译者信息。逐件条件与商业复用例外仍逐项检查。” |
| 第 18、24、28 行：未实测 feed / arXiv URL unknown | **可补充新日期证据**，原 9 月 5 日观察本身不因此变错。 | “2026-09-06 独立复核对 Eurostat、Fed、NASA 和 arXiv cs.AI 候选 feed 做了单次 HTTP/XML 检查；结果见审查报告。未作 Collector、持续可用性或许可验收。” |
| 第 30 行：“当前页面”显示 9 月 5 日维护提示 | **后续引用须定年定日**，不能沿用为 9 月 6 日仍故障。 | “2026-09-05 调研时页面显示当日维护窗口；2026-09-06 单次页面/feed 观察另见报告，不能据任一观察证明整体恢复或持续可用。” |

原第 17 行 Fed 公有领域概括、第 18/28 行 arXiv 元数据许可和限流、第 19 行 Anthropic newsroom 权利未定的主要边界可保留。正式批准仍需要 Owner 将实际字段、来源权属、处理用途、分发形式及存留逐项落到可审核决定；本报告没有替 Owner 作出该决定，也没有新增来源。
