# 财经日报市场面板：可直接实现的行情来源

核查日期：2026-09-08。使用 research 技能查阅供应方/交易所第一方资料，并进行一次匿名 Yahoo 11标的读取及一次腾讯3标的批量读取；未读取或打印密钥，未注册、购买、绕过限制、执行模型或发信。只交付研究与唯一真实样本，不修改采集代码。

## 推荐结论

**v1 用 Yahoo Finance 公开 chart 端点统一取11项；腾讯作为上证、创业板、恒科的国内备用。现在不需要新增 key。** 两者公开端点这次确实可读，但不是附带可用性保证的正式签约数据 API。低频日报适合先验证；401/403/429明确提示，不轮换身份绕过。

黄金建议明确采用 **COMEX黄金期货 `GC=F`**，布油采用 **NYMEX布伦特最后一日金融期货 `BZ=F`**。这是可实施的报价基准选择，不冒称伦敦现货黄金或ICE布伦特原合约；邮件名称必须带“期货”。若 Owner 想要现货黄金，再单独确认现货源与前收口径。

## 准确标的、单位与时区

以下11个代码全部在本次 Yahoo 实际响应中成功返回对应名称与 `instrumentType`；链接为供应方原始报价入口。指数一律用“点”，不能因为 `currency` 为USD、JPY、KRW、CNY就写成美元/日元等。

| 面板名称 | Yahoo symbol / 原页 | 类型与显示单位 | 响应时区 / 注意 |
| --- | --- | --- | --- |
| 布伦特原油期货 | [BZ=F](https://finance.yahoo.com/quote/BZ%3DF/) | FUTURE，美元/桶 | America/New_York；Yahoo NYMEX布油金融期货，不等同ICE直接报价 |
| COMEX黄金期货 | [GC=F](https://finance.yahoo.com/quote/GC%3DF/) | FUTURE，美元/金衡盎司 | America/New_York；本次名称为Gold Dec 26，保留合约月份 |
| 费城半导体指数 | [^SOX](https://finance.yahoo.com/quote/%5ESOX/) | INDEX，点 | America/New_York；不是SOXX ETF |
| 标普500指数 | [^GSPC](https://finance.yahoo.com/quote/%5EGSPC/) | INDEX，点 | America/New_York；不是SPY ETF |
| 道琼斯工业平均指数 | [^DJI](https://finance.yahoo.com/quote/%5EDJI/) | INDEX，点 | America/New_York |
| 纳斯达克综合指数 | [^IXIC](https://finance.yahoo.com/quote/%5EIXIC/) | INDEX，点 | America/New_York；不是纳指100/QQQ |
| 韩国综合指数KOSPI | [^KS11](https://finance.yahoo.com/quote/%5EKS11/) | INDEX，点 | Asia/Seoul |
| 日经225指数 | [^N225](https://finance.yahoo.com/quote/%5EN225/) | INDEX，点 | Asia/Tokyo；返回exchangeName=OSA不改变INDEX身份 |
| 上证综合指数 | [000001.SS](https://finance.yahoo.com/quote/000001.SS/) | INDEX，点 | Asia/Shanghai；不能误用深圳000001平安银行 |
| 创业板指 | [399006.SZ](https://finance.yahoo.com/quote/399006.SZ/) | INDEX，点 | Asia/Shanghai |
| 恒生科技指数 | [HSTECH.HK](https://hk.finance.yahoo.com/quote/HSTECH.HK/) | INDEX，点 | Asia/Hong_Kong；不是恒生指数^HSI；本次currency=null |

CME原始规格说明：GC报价为美元/金衡盎司，100金衡盎司是**合约规模**，不是把面板价格乘100的理由；BZ报价美元/桶、合约规模1000桶。合约选择/滚动会影响连续代码，不能把换月价差解释成现货涨跌。[CME GC规格](https://www.cmegroup.com/market-regulation/files/gold-futures-and-options-fact-card.pdf)、[CME BZ规格](https://www.cmegroup.com/cn-s/markets/energy/crude-oil/brent-crude-oil-last-day.quotes.html)

## 直接可用路径与一次读取结果

匿名端点模板：`https://query1.finance.yahoo.com/v8/finance/chart/{encodeURIComponent(symbol)}?interval=1d&range=5d`。读取 `chart.result[0].meta`，HTTP200仍须检查 `chart.error` 与结果是否存在。这次11/11成功，未使用登录Cookie、crumb或API key。此为供应方公开原始响应验证，不宣称 Yahoo 提供了正式受支持的该端点文档/限额/SLA。

唯一真实样本精简记录保存在私有 `data/operator/market-source-probe-2026-09-08.json`，含11个meta及完整 `currentTradingPeriod`；原请求未记精确抓取时刻，因此文件没有伪造retrievedAt。它是实现参考，不能拿研究样本冒充下一次新采集。

| symbol | 返回价格 | 返回涨跌 | 返回涨跌幅（%） | 报价所属当地日期 |
| --- | ---: | ---: | ---: | --- |
| BZ=F | 98.72 | +2.44 | +2.534 | 2026-09-08 |
| GC=F | 4446.50 | -30.10 | -0.672 | 2026-09-08 |
| ^SOX | 11735.263 | +383.163 | +3.375 | 2026-09-04 |
| ^GSPC | 7718.60 | -29.11 | -0.376 | 2026-09-04 |
| ^DJI | 53414.25 | -271.852 | -0.506 | 2026-09-04 |
| ^IXIC | 26506.99 | -77.109 | -0.290 | 2026-09-04 |
| ^KS11 | 6954.52 | -40.87 | -0.584 | 2026-09-08 |
| ^N225 | 65269.33 | -1130.516 | -1.703 | 2026-09-08 |
| 000001.SS | 3940.551 | +7.852 | +0.200 | 2026-09-08 |
| 399006.SZ | 3359.7156 | -38.9656 | -1.1465 | 2026-09-08 |
| HSTECH.HK | 4454.85 | -72.86 | -1.609 | 2026-09-08 |

数字是本次响应证据，不保证读者阅读时仍最新，也不是今日市场原因解读。

### 涨跌基准：不要用五日图的chartPreviousClose

- 11项都有 `regularMarketPrice/regularMarketTime/regularMarketChangePercent` 与 `fulldayPrice/fulldayChange/fulldayChangePercent`；本次两套价格和百分比逐项相等。`regularMarketChange` 全部**缺失**；缺失不是0。`2.534`已经是百分数，应显示`+2.534%`，不能再乘100。
- 建议使用同一响应的完整供应方三元组 `fulldayPrice/fulldayChange/fulldayChangePercent`；确认与regular字段匹配后，时间用 `regularMarketTime`。未来若两组不一致，不混拼；显示字段不完整或参考口径不一致。
- **`range=5d` 的 `chartPreviousClose` 是图表范围基准，不可靠地等于上个交易日收盘。** 实测GC的该值4366.3，实际平台日变动却是4446.5、-30.1、-0.672%；错用4366.3会把下跌算成上涨。日K数组也可能漏某个交易日/只有1根（本次创业板和恒科），不能机械取倒数第二根补前收。
- `price-change`仅能导出**供应方隐含参考价**（GC为4476.6，BZ为96.28），不能无文档地命名为官方结算价。指数可写“供应方日涨跌”，期货写“供应方日变动口径”；未拿到独立明确的前收/昨结字段时，不冒称已验证前收/结算。
- 百分比有显示舍入，允许小数位造成的微差；不要用价格四舍五入后的数字重算覆盖原涨跌幅。

### 时间、延迟、节假日

- `regularMarketTime` 是供应方报价时间（秒），不是新闻发表时间，也不一定等于交易所官方收盘时刻；`retrievedAt`另存。用 `exchangeTimezoneName` IANA时区转换，不能把EDT固定成全年UTC-4。面板同时写当地报价日期、北京时间更新时间；GC/BZ夜盘可能跨日，不自行断言期货tradeDate。
- 本次响应没有 `exchangeDataDelayedBy/sourceInterval/marketState`。缺少延迟字段**不意味着实时**。Yahoo有交易所延迟说明页，但本次正文读取最终429，未绕过；已确认的恒科报价页明确标Delayed Quote。v1统一可写“供应方最新可得报价，可能延迟；实际时间见各行”，不编造每个市场固定延迟分钟数。[Yahoo延迟说明入口](https://help.yahoo.com/kb/finance/article-exchanges-data-delays-sln2310.html)、[恒科原页](https://hk.finance.yahoo.com/quote/HSTECH.HK/)
- **2026-09-07是美国Labor Day休市**，NYSE官方日历已核实。本次美国指数报价停留当地9月4日，并不自动等于源故障；9月8日美国当日开盘前应写“最近交易日9月4日”，不能把9月4日变动配上9月8日新闻解释为当日行情。[NYSE交易日历](https://www.nyse.com/trade/hours-calendars)
- 国内/日本/韩国上午07:30尚未开盘时，应展示各自最近交易日，不要将报价当新闻按“昨天00:00”过滤掉。行情面板是“截至采集点最新可得市场状态”，新闻解读仍遵守新闻时间窗；两者明确区分。

## 腾讯备用：三个中文指数已实际交叉核对

一次匿名GET：[腾讯原始报价](https://qt.gtimg.cn/q=sh000001,sz399006,hkHSTECH)，返回200及三个有效标的，使用GB18030解码，不执行响应JavaScript。样本以`~`分隔：下标1名称、2代码、3价格、4参考前收、30时间、31涨跌、32百分比；这是本次原始响应观察，不是公开承诺不变的API契约。

- `sh000001`：3940.55 / 3932.70 / +7.85 / +0.20%，时间20260908161403。
- `sz399006`：3359.72 / 3398.68 / -38.96 / -1.15%，同上时间。
- `hkHSTECH`：4454.850 / 4527.710 / -72.860 / -1.61%，时间2026/09/08 16:09:00。

与Yahoo价格/涨跌方向及显示舍入一致；不声称两家上游完全独立。腾讯沪深与港股时间格式不同，必须分开解析并保留原串。异常/空内容时明确缺项，不凭字符串位置硬产出数字。东方财富本轮没有再额外请求；已有统一可用源，不为凑备用数量增加试探或未经验证的secid清单。

## 现有Alpha Vantage key能否直接覆盖

**不能把之前NEWS_SENTIMENT成功推断为这11项实时指数权限齐全。** 当前官方已有 `INDEX_DATA`，美股三大对应DJI、SPX、COMP，但目录将Index Data APIs标为Premium；其余所需指数支持情况应查官方catalog及实际账户权限，不能套Yahoo代码。此次没有使用Owner密钥探测，实际授权未知。

黄金有 `GOLD_SILVER_SPOT`，`symbol=GOLD/XAU`；这是可研究的现货替代，不与GC期货混拼前收。布油 `BRENT` 明确是EIA/FRED日/周/月价格，默认例子monthly，不是当前期货盘口；即使daily也不能冒充实时布油。v1不用此key兜底全市场，不额外消费额度。[Alpha Vantage官方接口文档](https://www.alphavantage.co/documentation/)

## 简短“主要影响”解读怎么写

行情API本身只证明价格与变动，不证明原因。用现有Tavily/Exa、财经新闻及企业/央行原始公告获得时间匹配的事件，按市场分组写1–2句并附来源：油价看供应/地缘/需求的新信息；黄金看已报道的利率、美元、避险因素；美股/费半看宏观和企业驱动；亚洲指数看本地政策、权重行业和公司事件。以上是检索方向，不是本期已证实因果。

允许“据某报道，市场关注……”“可能影响……”；没有对应证据就只描述分化/涨跌，不套模板宣称“因降息预期上涨”。不得用9月8日才发生的事件解释9月4日已收盘的美股。休市时主要说明最近交易日与待观察事项，新闻与行情日期各自可见。

Owner目前不必配置新数据源。只需明确黄金采用期货口径（本研究推荐）；正式交易级实时性、稳定API及再分发要求若提高，再采购有对应市场授权的数据计划，而不是把免费公开接口包装成实时保证。
