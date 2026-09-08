// The public chart endpoint has no documented stable API contract or SLA.
// Only these fixed, anonymous requests are allowed; there is no search/fallback.
export const MARKET_INSTRUMENTS = Object.freeze([
  { id: 'brent', label: '布伦特原油期货', symbol: 'BZ=F', unit: '美元/桶', quoteType: 'FUTURE' },
  { id: 'gold', label: 'COMEX黄金期货（非现货）', symbol: 'GC=F', unit: '美元/金衡盎司', quoteType: 'FUTURE' },
  { id: 'sox', label: '费城半导体指数', symbol: '^SOX', unit: '点', quoteType: 'INDEX' },
  { id: 'sp500', label: '标普500指数', symbol: '^GSPC', unit: '点', quoteType: 'INDEX' },
  { id: 'dow', label: '道琼斯工业平均指数', symbol: '^DJI', unit: '点', quoteType: 'INDEX' },
  { id: 'nasdaq', label: '纳斯达克综合指数', symbol: '^IXIC', unit: '点', quoteType: 'INDEX' },
  { id: 'kospi', label: '韩国KOSPI指数', symbol: '^KS11', unit: '点', quoteType: 'INDEX' },
  { id: 'nikkei', label: '日经225指数', symbol: '^N225', unit: '点', quoteType: 'INDEX' },
  { id: 'shanghai', label: '上证综合指数', symbol: '000001.SS', unit: '点', quoteType: 'INDEX' },
  { id: 'chinext', label: '创业板指数', symbol: '399006.SZ', unit: '点', quoteType: 'INDEX' },
  { id: 'hstech', label: '恒生科技指数', symbol: 'HSTECH.HK', unit: '点', quoteType: 'INDEX' },
].map(instrument => Object.freeze(instrument)));

const SOURCE_NOTE = 'Yahoo Finance公开行情端点没有公开稳定API契约或SLA；实时性和具体延迟未经确认。';
const BASIS_NOTE = '涨跌采用供应商fullday字段，与regularMarket字段及隐含参考价计算交叉核对；参考价=报价−供应商涨跌额，不代表交易所官方昨收或期货结算价。';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const finite = value => typeof value === 'number' && Number.isFinite(value);

function emptyRow(instrument) {
  return { ...instrument, status: 'unavailable', price: null, change: null,
    changePercent: null, referencePrice: null, asOf: null, observedAt: null,
    exchangeTimeZone: null, quoteDate: null, currency: null, contract: null,
    source: 'Yahoo Finance',
    sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(instrument.symbol)}/`,
    basisNote: `${BASIS_NOTE}${SOURCE_NOTE}`, freshnessNote: '尚无可用报价时间。',
    reason: null, changeReason: null };
}

function localDate(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function applyFreshness(row, quoteMs, observedMs) {
  if (row.exchangeTimeZone) {
    row.quoteDate = localDate(quoteMs, row.exchangeTimeZone);
    const observedDate = localDate(observedMs, row.exchangeTimeZone);
    row.freshnessNote = row.quoteDate !== observedDate
      ? `最近可得报价日期为${row.quoteDate}（${row.exchangeTimeZone}），非今日报价；可能因休市或供应商更新滞后，无法确认是否最新。涨跌对应该报价日期，不是今日涨幅。`
      : `报价日期为${row.quoteDate}（${row.exchangeTimeZone}）；是否最新及具体延迟未经确认，涨跌仅对应供应商当前报价。`;
  } else {
    row.freshnessNote = `供应商报价时间为${row.asOf}；交易所时区缺失或无效，无法判断当地交易日，无法确认是否最新或延迟。`;
  }
}

function applyChanges(row, meta) {
  // chartPreviousClose is a range-dependent baseline (range=5d), NOT yesterday's
  // close. Never use chart bars or that field to fill missing daily changes.
  const values = [meta.fulldayPrice, meta.fulldayChange, meta.fulldayChangePercent,
    meta.regularMarketChangePercent];
  if (!values.every(finite)) {
    row.changeReason = '供应商日涨跌字段不完整，保留价格但不计算或猜测涨跌、参考价。';
    return;
  }
  const reference = row.price - meta.fulldayChange;
  const impliedPercent = meta.fulldayChange / reference * 100;
  // Percent fields are percentage points (2.534 means 2.534%), not ratios.
  // Allow rounding to 3 decimal places, not materially different baselines.
  const priceTolerance = Math.max(1e-8, Math.abs(row.price) * 1e-9);
  if (Math.abs(meta.fulldayPrice - row.price) > priceTolerance ||
      !finite(reference) || reference === 0 || !finite(impliedPercent) ||
      Math.abs(meta.fulldayChangePercent - meta.regularMarketChangePercent) > 0.001 ||
      Math.abs(impliedPercent - meta.fulldayChangePercent) > 0.002) {
    row.changeReason = '供应商价格、日涨跌额或百分比不一致，保留价格但不展示未核实涨跌、参考价。';
    return;
  }
  row.change = meta.fulldayChange;
  row.changePercent = meta.fulldayChangePercent;
  row.referencePrice = Number(reference.toPrecision(15));
}

async function readQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const response = await fetch(url, {
    method: 'GET', redirect: 'error', credentials: 'omit',
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json', 'User-Agent': 'Observer-Personal-Daily/1.0' },
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`http-${response.status}`);
  }
  if (!response.body) throw new Error('missing-body');
  const reader = response.body.getReader();
  const chunks = []; let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) throw new Error('response-too-large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new Error('invalid-json'); }
  if (body?.chart?.error) throw new Error('provider-error');
  const results = body?.chart?.result;
  if (!Array.isArray(results) || results.length !== 1 || !results[0]?.meta) {
    throw new Error('missing-quote');
  }
  return results[0].meta;
}

function failureReason(error) {
  if (['TimeoutError', 'AbortError'].includes(error?.name)) return '行情请求超过20秒或被中止，本次不重试。';
  if (error?.message === 'http-429') return '供应商限制访问频率，本次不重试，请稍后再采集。';
  if (['http-401', 'http-403'].includes(error?.message)) return '供应商拒绝公开访问；未尝试凭据、登录或绕过限制。';
  if (/^http-\d+$/.test(error?.message ?? '')) return '供应商HTTP服务异常，本次未取得可用报价。';
  if (error?.message === 'response-too-large') return '行情响应超过1MiB安全上限，已停止读取。';
  if (['missing-body', 'invalid-json', 'provider-error', 'missing-quote'].includes(error?.message)) {
    return '供应商未返回可识别的行情数据，可能为空、接口变化或服务错误。';
  }
  return '行情网络请求失败或重定向被拒绝，本次未取得报价且未重试。';
}

async function collectInstrument(instrument) {
  const row = emptyRow(instrument);
  try {
    const meta = await readQuote(instrument.symbol);
    row.observedAt = new Date().toISOString();
    const observedMs = Date.parse(row.observedAt);
    if ((meta.symbol !== undefined && meta.symbol !== instrument.symbol) ||
        meta.instrumentType !== instrument.quoteType ||
        (instrument.quoteType === 'FUTURE' && meta.currency !== 'USD')) {
      row.reason = '供应商标的、类型或期货计价币种不符，不能作为该标的报价使用。';
      return row;
    }
    row.contract = typeof meta.shortName === 'string' ? meta.shortName.slice(0, 200) : null;
    row.currency = typeof meta.currency === 'string' ? meta.currency.slice(0, 12) : null;
    if (typeof meta.exchangeTimezoneName === 'string') {
      try {
        localDate(observedMs, meta.exchangeTimezoneName);
        row.exchangeTimeZone = meta.exchangeTimezoneName;
      } catch { /* Unknown exchange timezone remains explicitly unknown. */ }
    }
    const quoteMs = finite(meta.regularMarketTime) ? meta.regularMarketTime * 1000 : NaN;
    if (!finite(quoteMs) || quoteMs <= 0 || quoteMs > observedMs) {
      row.reason = '供应商报价时间缺失、无效或位于未来；不以采集时间冒充报价时间。';
      return row;
    }
    row.asOf = new Date(quoteMs).toISOString();
    applyFreshness(row, quoteMs, observedMs);
    if (observedMs - quoteMs > MAX_AGE_MS) {
      row.reason = '最近可得报价已超过7日，价格及涨跌不再作为可用行情展示。';
      row.freshnessNote += '报价已过期（超过7日）。';
      return row;
    }
    if (!finite(meta.regularMarketPrice)) {
      row.reason = '供应商当前价格缺失或无效；不从历史图表推算或由模型补值。';
      return row;
    }
    row.price = meta.regularMarketPrice;
    row.status = 'ok';
    applyChanges(row, meta);
    return row;
  } catch (error) {
    row.observedAt = new Date().toISOString();
    row.reason = failureReason(error);
    return row;
  }
}

export async function collectMarketSnapshot() {
  const startedAt = new Date().toISOString();
  const rows = new Array(MARKET_INSTRUMENTS.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (nextIndex < MARKET_INSTRUMENTS.length) {
      const index = nextIndex++;
      rows[index] = await collectInstrument(MARKET_INSTRUMENTS[index]);
    }
  }));
  const observedAt = new Date().toISOString();
  const warnings = rows.flatMap(row => {
    if (row.status !== 'ok') return [`行情：${row.label}：${row.reason}`];
    const messages = [];
    if (row.changeReason) messages.push(`行情：${row.label}：${row.changeReason}`);
    if (!row.exchangeTimeZone || row.quoteDate !== localDate(Date.parse(row.observedAt), row.exchangeTimeZone)) {
      messages.push(`行情：${row.label}：${row.freshnessNote}`);
    }
    return messages;
  });
  const available = rows.filter(row => row.status === 'ok').length;
  return { observedAt, rows, warnings, note: SOURCE_NOTE,
    check: { service: '行情 Yahoo Finance', operation: 'fixed-public-chart-quotes',
      status: available === rows.length ? 'ok' : available ? 'partial' : 'failed',
      details: { startedAt, observedAt, requested: rows.length, available,
        unavailable: rows.length - available,
        changesUnavailable: rows.filter(row => row.status === 'ok' && row.change === null).length,
        maxConcurrency: 3, timeoutMs: 20000, maxResponseBytes: 1024 * 1024,
        retries: 0, credentials: 'none', note: SOURCE_NOTE } } };
}
