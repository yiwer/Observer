const DAY = 86400000;
const shanghaiDate = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));

export function createDailyWindow({ date, now = new Date() } = {}) {
  const cutoffMs = new Date(now).getTime();
  if (!Number.isFinite(cutoffMs)) throw new Error('invalid-collection-cutoff');
  const currentDate = shanghaiDate(cutoffMs);
  date ??= currentDate;
  if (date !== currentDate) throw new Error('collection-date-must-be-current-shanghai-date');
  return { date, windowStart: new Date(Date.parse(`${date}T00:00:00+08:00`) - DAY).toISOString(), cutoff: new Date(cutoffMs).toISOString(), timeZone: 'Asia/Shanghai', publicationPolicy: 'previous-day-midnight-v1' };
}

export function publicationDecision(value, window) {
  const input = typeof value === 'object' && value !== null ? value.publishedAt : value;
  if (typeof input !== 'string' || !input.trim()) return { eligible: false, publishedAt: null, precision: 'unknown', reason: 'missing-publication-time' };
  const text = input.trim(); const start = Date.parse(window.windowStart); const end = Date.parse(window.cutoff);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return { eligible: false, publishedAt: text, precision: 'unknown', reason: 'invalid-window' };
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const dayStart = Date.parse(`${text}T00:00:00+08:00`);
    if (!Number.isFinite(dayStart) || shanghaiDate(dayStart) !== text) return { eligible: false, publishedAt: text, precision: 'day', reason: 'invalid-publication-date' };
    const eligible = dayStart >= start && dayStart + DAY - 1 <= end;
    return { eligible, publishedAt: text, precision: 'day', reason: eligible ? null : dayStart < start ? 'before-window' : 'day-overlaps-cutoff', precisionNote: '来源仅提供日期；按北京时间日期窗判断，未推断真实发表小时，只有整个日期落窗才接纳' };
  }
  // A timezone-less clock cannot establish an absolute cutoff. RFC RSS dates
  // include a timezone; ISO datetimes must include Z or an explicit offset.
  if (!/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)$/i.test(text)) return { eligible: false, publishedAt: text, precision: 'unknown', reason: 'missing-publication-timezone' };
  const time = Date.parse(text);
  if (!Number.isFinite(time)) return { eligible: false, publishedAt: text, precision: 'unknown', reason: 'invalid-publication-time' };
  return { eligible: time >= start && time <= end, publishedAt: new Date(time).toISOString(), precision: 'timestamp', reason: time < start ? 'before-window' : time > end ? 'after-cutoff' : null };
}
