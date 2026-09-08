// Prices are rendered from acquisition, never copied from model output.
import { z } from 'zod';

export const MarketInsights = z.array(z.object({ id: z.string(), insight: z.string().trim().min(1).max(220) })).max(11);

export function attachMarketInsights(snapshot, insights) {
  if (!snapshot) throw new Error('market-snapshot-required');
  const expected = snapshot.rows.filter(row => row.status === 'ok').map(row => row.id);
  const ids = insights.map(row => row.id);
  if (new Set(ids).size !== ids.length || ids.length !== expected.length || ids.some(id => !expected.includes(id)))
    throw new Error('market-insights-must-match-available-quotes');
  return { ...snapshot, rows: snapshot.rows.map(row => ({ ...row, insight: insights.find(item => item.id === row.id)?.insight ?? '' })) };
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const number = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : '未取得';
const signed = value => Number.isFinite(value) ? `${value > 0 ? '+' : ''}${number(value)}` : '未取得';
const time = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value)) + ' 北京时间' : '未取得';

export function renderMarketPanel(snapshot) {
  if (!snapshot) return { html: '', text: '' }; // Immutable historical reports remain readable.
  const note = '新增行情来源：Yahoo Finance 公开行情。布油采用 NYMEX 布伦特金融期货（非 ICE 直接报价），黄金采用 COMEX 黄金期货，均非现货；指数单位为点。各市场报价不同步，可能延迟；涨跌按供应商当期参考口径，不是相对上封日报，也不保证等同交易所结算价。旧交易日与缺失数据逐项公示，AI 不补造行情或涨跌原因。';
  const text = ['### 市场行情与 AI 解读', note, `本次采集：${time(snapshot.observedAt)}`];
  let cards = '';
  for (const row of snapshot.rows) {
    const available = row.status === 'ok';
    const quote = available ? `${number(row.price)} ${row.unit} · 涨跌 ${signed(row.change)} · 涨跌幅 ${Number.isFinite(row.changePercent) ? signed(row.changePercent) + '%' : '未取得'}` : '行情未取得';
    const details = [row.quoteType === 'FUTURE' ? row.contract : '', `报价：${time(row.asOf)}`,
      row.quoteDate ? `交易地日期：${row.quoteDate}（${row.exchangeTimeZone}）` : '交易地日期未确认',
      Number.isFinite(row.referencePrice) ? `供应商涨跌参考价：${number(row.referencePrice)} ${row.unit}` : '',
      row.freshnessNote?.includes('非今日报价') ? '非今日报价，涨跌对应该交易地日期；可能休市或更新滞后' : '',
      row.reason, row.changeReason].filter(Boolean).join('；');
    // Only link back to the known provider quote page, not arbitrary payload URLs.
    const sourceUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(row.symbol)}/`;
    cards += `<div style="padding:14px 0;border-bottom:1px solid #e4e6ea"><h4 style="margin:0 0 6px;font-size:16px">${escape(row.label)}</h4><p style="margin:6px 0;font-weight:bold">${escape(quote)}</p><p style="margin:6px 0;font-size:12px;color:#6b7280;line-height:1.7">${escape(details)}</p>${row.insight ? `<p style="margin:6px 0;line-height:1.75"><strong>AI 一句话解读：</strong>${escape(row.insight)}</p>` : ''}<a style="font-size:12px;color:#245b93" href="${escape(sourceUrl)}" rel="noreferrer">来源：Yahoo Finance · ${escape(row.symbol)}</a></div>`;
    text.push(`#### ${row.label}`, quote, details, row.insight ? `AI 一句话解读：${row.insight}` : '', `来源：Yahoo Finance ${sourceUrl}`);
  }
  return { html: `<div style="margin:22px 0;padding:16px;background:#f6f8fb"><h3 style="margin:0 0 10px">市场行情与 AI 解读</h3><p style="font-size:12px;line-height:1.8;color:#536174">${escape(note)}<br>本次采集：${escape(time(snapshot.observedAt))}</p>${cards}</div>`, text: text.filter(Boolean).join('\n\n') };
}
