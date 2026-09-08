import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SaxesParser } from 'saxes';
import { createDailyWindow, publicationDecision, sourceEligible } from './daily-window.mjs';
import { collectGitHubTrending } from './daily-github-trending.mjs';
import { collectMarketSnapshot } from './daily-markets.mjs';

const EDITIONS = ['world', 'ai', 'finance', 'frontier', 'social', 'github'];
const KEY_NAMES = ['TAVILY_API_KEY', 'EXA_API_KEY', 'OPENALEX_API_KEY', 'ZHIHU_ACCESS_SECRET', 'ALPHAVANTAGE_API_KEY'];
const RSS = [
  ['BBC World', 'world', 'https://feeds.bbci.co.uk/news/world/rss.xml'],
  ['DW 中文', 'world', 'https://rss.dw.com/rdf/rss-chi-all'],
  ['联合国新闻', 'world', 'https://news.un.org/feed/subscribe/zh/news/all/rss.xml'],
  ['BBC Business', 'finance', 'https://feeds.bbci.co.uk/news/business/rss.xml'],
  ['OpenAI', 'ai', 'https://openai.com/news/rss.xml'],
  ['Hugging Face', 'ai', 'https://huggingface.co/blog/feed.xml'],
  ['NASA', 'frontier', 'https://www.nasa.gov/news-release/feed/'],
];
const QUERIES = {
  world: ['world major developments diplomacy conflict humanitarian international news', '国际新闻 全球 政策 外交 最新进展'],
  ai: ['AI model releases OpenAI Anthropic Google DeepMind open source latest announcement', '人工智能 大模型 通义 千问 DeepSeek 新发布 开源', 'Anthropic Claude announced launched latest official news', '中国 人工智能 大模型 阿里 腾讯 字节 智谱 今日 新发布'],
  finance: ['global economy central bank inflation companies earnings financial news', '中国 财经 央行 统计局 上市公司 最新 消息'],
  frontier: ['science breakthrough space semiconductor robotics quantum energy materials latest research', '科技前沿 航天 芯片 机器人 量子 新能源 科研 最新进展', 'semiconductor robotics breakthrough research announced latest official'],
  social: ['Hacker News technology discussion controversy community today', '知乎 今日 热点 讨论 社会议题'],
};

function credentials() {
  const values = Object.fromEntries(KEY_NAMES.map(name => [name, process.env[name]?.trim() || '']));
  if (process.platform === 'win32' && KEY_NAMES.some(name => !values[name])) {
    // Only static variable names enter the command; captured stdout never reaches logs.
    const command = `$v=@{}; ${KEY_NAMES.map(name => `$v['${name}']=[Environment]::GetEnvironmentVariable('${name}','User');`).join(' ')} $v|ConvertTo-Json -Compress`;
    try {
      const userValues = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] }));
      for (const name of KEY_NAMES) values[name] ||= userValues[name]?.trim() || '';
    } catch { /* Missing user environment is reported by the per-service check. */ }
  }
  return values;
}

function plain(value) {
  return String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, match => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[match])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value) => { const code = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value); return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' '; })
    .replace(/\s+/g, ' ').trim();
}

function published(value) {
  if (!value) return null;
  // Preserve date-only precision; never substitute retrieval/indexing time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function parseFeed(xml) {
  const entries = []; let entry; const stack = [];
  const parser = new SaxesParser({ xmlns: true });
  parser.on('doctype', () => { throw new Error('xml-doctype-not-supported'); });
  parser.on('opentag', node => {
    stack.push(node.local);
    if (node.local === 'item' || node.local === 'entry') entry = {};
    if (entry && node.local === 'link') {
      const attrs = Object.fromEntries(Object.values(node.attributes).map(a => [a.local, a.value]));
      if (attrs.href && (!attrs.rel || attrs.rel === 'alternate')) entry.link = attrs.href;
    }
  });
  const text = value => { if (entry) { const key = stack.at(-1); entry[key] = (entry[key] ?? '') + value; } };
  parser.on('text', text); parser.on('cdata', text);
  parser.on('closetag', node => { if (entry && (node.local === 'item' || node.local === 'entry')) { entries.push(entry); entry = undefined; } stack.pop(); });
  parser.write(xml).close();
  return entries.map(e => ({ title: e.title, url: e.link || e.guid, publishedAt: e.pubDate || e.published || e.date, text: e.description || e.summary || '', updatedAt: e.updated || null }));
}

export async function collectDaily({ date, outputDir } = {}) {
  const now = new Date();
  const window = createDailyWindow({ date, now }); date = window.date;
  if (outputDir && await access(resolve(outputDir, 'acquisition.json')).then(() => true, () => false)) throw new Error('acquisition-already-exists');
  const keys = credentials();
  const redact = value => { let text = String(value ?? ''); for (const secret of Object.values(keys)) if (secret) text = text.split(secret).join('[redacted]'); return text.replace(/(api[_-]?key|access[_-]?secret|authorization)\s*[=:]\s*[^\s&,]+/gi, '$1=[redacted]'); };
  const checks = []; const warnings = []; const items = []; const seen = new Set();
  let markets;
  const cutoff = Date.parse(window.cutoff);
  const earliest = Date.parse(window.windowStart);
  const since = new Date(earliest).toISOString();
  const sinceDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(earliest));
  const filteredOut = Object.fromEntries(EDITIONS.map(e => [e, {}]));
  const rejected = (edition, reason) => { filteredOut[edition][reason] = (filteredOut[edition][reason] ?? 0) + 1; };
  const request = async (url, options = {}) => {
    const response = await fetch(url, { ...options, redirect: options.headers?.Authorization || options.headers?.['x-api-key'] || new URL(url).searchParams.has('apikey') || new URL(url).searchParams.has('api_key') ? 'error' : 'follow', signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'Observer-Personal-Daily/1.0', ...options.headers } });
    const reader = response.body.getReader(); let bytes = 0; const chunks = [];
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 8 * 1024 * 1024) throw new Error('response-size-limit'); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!response.ok) throw new Error(`http-${response.status}`);
    const headers = Object.fromEntries(['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'x-ratelimit-resource', 'x-ratelimit-credits-used'].map(name => [name, response.headers.get(name)]).filter(([, v]) => v !== null));
    return { raw, headers, json: () => JSON.parse(raw) };
  };
  const add = (edition, source, item) => {
    let url; try { const parsed = new URL(item.url); if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return; for (const name of [...parsed.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(name)) parsed.searchParams.delete(name); parsed.hash = ''; url = parsed.href; } catch { return; }
    const title = redact(plain(item.title)).slice(0, 280); if (!title) return;
    const decision = publicationDecision(item.publishedAt, window);
    const time = decision.publishedAt;
    if (!decision.eligible && !['missing-publication-time', 'day-overlaps-cutoff'].includes(decision.reason)) { rejected(edition, decision.reason); return; }
    const key = `${edition}:${url}`; if (seen.has(key)) return; seen.add(key);
    items.push({ id: `e${String(items.length + 1).padStart(3, '0')}`, edition, title, url: redact(url), publishedAt: time, publicationPrecision: decision.precision, retrievedAt: new Date().toISOString(), text: redact(plain(item.text)).slice(0, 2000), source, ...item.metadata });
  };
  const task = async (service, operation, action) => {
    const start = items.length;
    try { const details = await action(); checks.push({ service, operation, status: 'ok', details: JSON.parse(redact(JSON.stringify(details ?? {}))) }); }
    catch (error) { const reason = /^http-\d+$|response-size-limit|xml-doctype-not-supported$/.test(error.message) ? error.message : error.name === 'TimeoutError' || error.name === 'AbortError' ? 'timeout' : 'request-or-response-failed'; const description = reason === 'http-401' || reason === 'http-403' ? '访问未获授权，请检查密钥或服务权限' : reason === 'http-429' ? '请求额度或频率受限，请查看服务控制台' : reason === 'timeout' ? '请求超时，未获得材料' : `获取失败（${reason}），其他来源继续`; checks.push({ service, operation, status: 'failed', details: { reason, description, addedBeforeFailure: items.length - start } }); warnings.push(`${service}: ${description}`); }
  };
  const hasKey = (service, name) => { if (keys[name]) return true; checks.push({ service, operation: 'credential', status: 'not-configured', details: { variable: name } }); warnings.push(`${service}: 需要配置 ${name}`); return false; };
  const post = (url, headers, body) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  // Each service is isolated. API failures cannot cancel the public-source fallback.
  const jobs = RSS.map(([source, edition, url]) => () => task(source, 'rss', async () => {
    const response = await request(url); const rows = parseFeed(response.raw); let accepted = 0;
    for (const row of rows.sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))) { const before = items.length; add(edition, source, { ...row, metadata: { evidenceKind: 'publisher-feed-summary' } }); accepted += items.length - before; if (accepted >= 14) break; }
    if (!accepted) warnings.push(`${source}: feed可读，但昨天北京时间00:00至采集截止无可用新条目`);
    return { received: rows.length, accepted, balance: 'not-applicable' };
  }));

  jobs.push(() => task('Hacker News', 'top-stories', async () => {
    const ids = (await request('https://hacker-news.firebaseio.com/v0/topstories.json')).json().slice(0, 25); let accepted = 0;
    for (const id of ids) {
      const item = (await request(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json();
      if (!item || item.deleted || item.dead || item.type !== 'story') continue;
      const discussion = `https://news.ycombinator.com/item?id=${item.id}`;
      const before = items.length;
      add('social', 'Hacker News 平台样本', { title: item.title, url: discussion, publishedAt: new Date(item.time * 1000).toISOString(), text: `${plain(item.text)} 平台观测：${item.score ?? 0} points，${item.descendants ?? 0}条评论。这里只证明讨论热度，不证明观点或外链事实。`, metadata: { evidenceKind: 'social-metadata', linkedArticle: item.url || null, score: item.score ?? 0, commentCount: item.descendants ?? 0, sampleScope: 'HN top 25 stories at collection time; no comment-content sampling' } });
      accepted += items.length - before;
    }
    return { sampled: ids.length, accepted, balance: 'not-applicable' };
  }));

  jobs.push(async () => {
    const result = await collectGitHubTrending();
    items.push(...result.items); checks.push(result.check); warnings.push(...result.warnings);
  });

  if (hasKey('Tavily', 'TAVILY_API_KEY')) jobs.push(async () => {
    const headers = { Authorization: `Bearer ${keys.TAVILY_API_KEY}` };
    const usage = label => task('Tavily', label, async () => {
      const data = (await request('https://api.tavily.com/usage', { headers })).json();
      const pick = (obj, names) => Object.fromEntries(names.filter(name => ['number', 'string'].includes(typeof obj?.[name])).map(name => [name, obj[name]]));
      return { keyUsage: pick(data.key, ['usage', 'limit', 'search_usage']), accountUsage: pick(data.account, ['current_plan', 'plan_usage', 'plan_limit', 'paygo_usage', 'paygo_limit']), balanceMeaning: 'API reports credits/limits, not cash balance' };
    });
    await usage('usage-before');
    for (const [edition, queries] of Object.entries(QUERIES)) for (const query of queries) await task('Tavily', `search-${edition}`, async () => {
      const data = (await post('https://api.tavily.com/search', headers, { query: `${query} ${sinceDate} ${date}`, topic: 'news', search_depth: 'basic', max_results: 6, start_date: sinceDate, end_date: date, include_answer: false, include_raw_content: false, include_usage: true })).json();
      if (!Array.isArray(data.results)) throw new Error('invalid-search-response');
      for (const row of data.results) add(edition, `Tavily · ${new URL(row.url).hostname}`, { title: row.title, url: row.url, publishedAt: row.published_date, text: row.content, metadata: { evidenceKind: 'search-excerpt', discoveryQuery: query, providerScore: row.score ?? null } });
      return { received: data.results.length, credits: data.usage?.credits ?? null, scope: edition };
    });
    await usage('usage-after');
  });

  if (hasKey('Exa', 'EXA_API_KEY')) jobs.push(async () => {
    for (const edition of ['world', 'ai', 'frontier']) await task('Exa', `search-${edition}`, async () => {
      const response = await post('https://api.exa.ai/search', { 'x-api-key': keys.EXA_API_KEY }, { query: `${QUERIES[edition][0]} ${date}`, type: 'auto', numResults: 4, startPublishedDate: since, endPublishedDate: new Date(cutoff).toISOString(), contents: { text: false, highlights: true } });
      const data = response.json(); if (!Array.isArray(data.results)) throw new Error('invalid-search-response');
      for (const row of data.results) add(edition, `Exa · ${new URL(row.url).hostname}`, { title: row.title, url: row.url, publishedAt: row.publishedDate, text: (row.highlights ?? []).join(' '), metadata: { evidenceKind: 'search-excerpt' } });
      return { received: data.results.length, reportedCostDollars: data.costDollars?.total ?? null, balance: 'not-available-from-confirmed-public-search-API; check Exa dashboard' };
    });
  });

  if (hasKey('OpenAlex', 'OPENALEX_API_KEY')) jobs.push(async () => {
    const headers = { Authorization: `Bearer ${keys.OPENALEX_API_KEY}` };
    await task('OpenAlex', 'works', async () => {
      const url = new URL('https://api.openalex.org/works'); url.searchParams.set('filter', `from_publication_date:${sinceDate},to_publication_date:${date}`); url.searchParams.set('search', 'robotics semiconductor quantum energy'); url.searchParams.set('per_page', '8'); url.searchParams.set('sort', 'publication_date:desc');
      const response = await request(url, { headers }); const data = response.json(); if (!Array.isArray(data.results)) throw new Error('invalid-works-response');
      for (const work of data.results) {
        const words = []; for (const [word, positions] of Object.entries(work.abstract_inverted_index ?? {})) for (const position of positions) if (position < 300) words[position] = word;
        add('frontier', 'OpenAlex 论文元数据', { title: work.display_name, url: work.doi || work.primary_location?.landing_page_url || work.id, publishedAt: work.publication_date, text: words.join(' '), metadata: { evidenceKind: 'research-metadata', workType: work.type, publicationStatus: 'index metadata; peer-review status not verified' } });
      }
      return { received: data.results.length, rateLimits: response.headers };
    });
    await task('OpenAlex', 'rate-limit', async () => {
      const response = await request('https://api.openalex.org/rate-limit', { headers }); const data = response.json();
      // Only numeric quota fields survive; no account identity or key is archived.
      const numeric = {}; const walk = (obj, prefix = '') => { for (const [k, v] of Object.entries(obj ?? {})) { const path = prefix ? `${prefix}.${k}` : k; if (typeof v === 'number') numeric[path] = v; else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, path); } }; walk(data);
      return { rateLimits: response.headers, numericQuota: numeric };
    });
  });

  if (hasKey('Alpha Vantage', 'ALPHAVANTAGE_API_KEY')) jobs.push(() => task('Alpha Vantage', 'news-sentiment', async () => {
    const url = new URL('https://www.alphavantage.co/query'); url.searchParams.set('function', 'NEWS_SENTIMENT'); url.searchParams.set('time_from', since.replace(/[-:]/g, '').slice(0, 13)); url.searchParams.set('sort', 'LATEST'); url.searchParams.set('limit', '12'); url.searchParams.set('apikey', keys.ALPHAVANTAGE_API_KEY);
    const data = (await request(url)).json();
    if (!Array.isArray(data.feed)) {
      const message = redact(plain(data.Information || data.Note || data['Error Message'] || 'No feed returned')).slice(0, 300);
      warnings.push(`Alpha Vantage: ${message}`); return { usable: false, providerMessage: message, balance: 'no-confirmed-balance-API' };
    }
    for (const row of data.feed) { const t = row.time_published; const iso = /^\d{8}T\d{6}$/.test(t ?? '') ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15)}Z` : null; add('finance', `Alpha Vantage · ${row.source}`, { title: row.title, url: row.url, publishedAt: iso, text: row.summary, metadata: { evidenceKind: 'provider-news-summary' } }); }
    return { usable: true, received: data.feed.length, balance: 'no-confirmed-balance-API; use dashboard/support' };
  }));

  if (hasKey('知乎', 'ZHIHU_ACCESS_SECRET')) jobs.push(() => task('知乎', 'search', async () => {
    const url = new URL('https://developer.zhihu.com/api/v1/content/zhihu_search'); url.searchParams.set('Query', `${date} 热点 社会 科技 讨论`);
    const response = await request(url, { headers: { Authorization: `Bearer ${keys.ZHIHU_ACCESS_SECRET}`, 'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)), 'Content-Type': 'application/json' } });
    const data = response.json(); let candidates = 0;
    const walk = node => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { for (const value of node) walk(value); return; }
      const title = node.Title || node.title || node.question?.title; const link = node.Url || node.url || node.link || node.question?.url;
      if (title && link) { candidates++; add('social', '知乎官方搜索 · 平台样本', { title, url: link, publishedAt: node.published_at || node.publish_time || null, text: node.ContentText || node.snippet || node.excerpt || node.content || node.text || '', metadata: { evidenceKind: 'social-search-excerpt', author: node.AuthorName || null, commentCount: node.CommentCount ?? null, voteCount: node.VoteUpCount ?? null, lastEditedAt: typeof node.EditTime === 'number' ? new Date(node.EditTime * 1000).toISOString() : null, sampleScope: 'Zhihu topical search, not full-platform sentiment survey; EditTime is last edit, not publication time' } }); }
      for (const value of Object.values(node)) if (typeof value === 'object') walk(value);
    }; walk(data);
    const message = redact(plain(data.Message || data.message || data.msg || data.error || '')).slice(0, 200);
    if (!candidates) warnings.push(`知乎: 接口返回但未取得可用条目${message ? `；${message}` : ''}`);
    return { usable: candidates > 0, received: candidates, responseFields: Object.keys(data).slice(0, 15), providerCode: data.Code ?? data.code ?? null, providerMessage: message || null, balance: 'unknown：无已确认余额API，请查看知乎个人中心' };
  }));

  jobs.push(async () => {
    markets = await collectMarketSnapshot();
    checks.push(markets.check); warnings.push(...markets.warnings);
  });
  let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (next < jobs.length) await jobs[next++](); }));
  // Keep a bounded, source-diverse bundle. No minimum count is a publication gate.
  const selected = [];
  for (const edition of EDITIONS) {
    const groups = new Map();
    for (const item of items.filter(row => row.edition === edition)) { if (!groups.has(item.source)) groups.set(item.source, []); groups.get(item.source).push(item); }
    let remaining = 40;
    while (remaining > 0 && [...groups.values()].some(group => group.length)) for (const group of groups.values()) if (group.length && remaining > 0) { selected.push(group.shift()); remaining--; }
    if (!selected.some(item => item.edition === edition)) warnings.push(edition === 'github' ? 'GitHub：本轮未取得官方Trending榜单，不使用替代搜索榜；请查看访问或解析错误。' : `${edition}: 本轮没有可用内容，需检查该栏数据源或权限；不会以凑满7条为门槛`);
  }
  const completedAt = new Date().toISOString();
  const result = { ...window, date, retrievedAt: completedAt, completedAt, discoveryWindowStart: since, items: selected, markets, checks, filteredOut, warnings: [...new Set(warnings)] };
  await enrichBundle(result, keys);
  enforcePublicationWindow(result);
  if (outputDir) { await mkdir(outputDir, { recursive: true }); await writeFile(resolve(outputDir, 'acquisition.json'), JSON.stringify(result, null, 2), { flag: 'wx', encoding: 'utf8' }); }
  return result;
}

export function sourceWarningsForEdition(bundle, edition) {
  const routes = [...RSS.map(([source, target]) => [source, target]),
    ['Alpha Vantage', 'finance'], ['行情', 'finance'], ['OpenAlex', 'frontier'], ['知乎', 'social'],
    ['Hacker News', 'social'], ['GitHub', 'github'], ...EDITIONS.map(name => [name, name])];
  const relevant = (bundle.sourceWarnings ?? bundle.warnings ?? []).filter(warning => {
    const route = routes.find(([source]) => warning.startsWith(source));
    // General search providers and unrecognized failures remain visible, never silent.
    return !route || route[1] === edition;
  });
  return [...new Set([...relevant, ...(bundle.warningsByEdition?.[edition] ?? [])])];
}

function enforcePublicationWindow(bundle) {
  if (bundle.publicationPolicy !== 'previous-day-midnight-v1') throw new Error('legacy-bundle-requires-new-collection');
  bundle.filteredOut ??= Object.fromEntries(EDITIONS.map(e => [e, {}]));
  bundle.warningsByEdition = Object.fromEntries(EDITIONS.map(e => [e, []]));
  bundle.items = bundle.items.filter(item => {
    const eligible = sourceEligible(item, bundle);
    const result = item.edition === 'github' ? { reason: 'invalid-official-trending-snapshot' } : publicationDecision(item.publishedAt, bundle);
    if (!eligible) { const counts = bundle.filteredOut[item.edition]; counts[result.reason] = (counts[result.reason] ?? 0) + 1; return false; }
    if (item.edition === 'github') return true;
    item.publishedAt = result.publishedAt; item.publicationPrecision = result.precision;
    if (result.precisionNote) item.publicationPrecisionNote = result.precisionNote;
    return true;
  });
  for (const edition of EDITIONS) {
    if (edition === 'github') {
      if (!bundle.items.some(item => item.edition === 'github')) bundle.warningsByEdition.github.push('本次没有取得有效的GitHub官方每日Trending快照；这不是项目发布日期不足，不会改用搜索结果凑榜。');
      continue;
    }
    const rejected = bundle.filteredOut[edition]; const unknown = (rejected['missing-publication-time'] ?? 0) + (rejected['missing-publication-timezone'] ?? 0); const imprecise = rejected['day-overlaps-cutoff'] ?? 0;
    if (unknown) bundle.warningsByEdition[edition].push(`${unknown}条候选缺少可确认的发布日期/时区，已剔除；观察、编辑或抓取时间不能代替发布。`);
    if (imprecise) bundle.warningsByEdition[edition].push(`${imprecise}条候选只有当日日期、无小时，无法确认早于截止，已剔除。`);
    if (!bundle.items.some(item => item.edition === edition)) bundle.warningsByEdition[edition].push('本次没有取得昨天北京时间00:00至采集截止之间发布的可用资料；未放宽时间范围或凑条数。');
  }
  bundle.checks.push({ service: '来源资格', operation: 'edition-source-policy', status: 'ok', details: { windowStart: bundle.windowStart, cutoff: bundle.cutoff, rejectedByEdition: bundle.filteredOut, description: '五个新闻栏目按发布时间过滤；GitHub仅接受当前采集的官方daily Trending快照，不限制项目发布日期' } });
}

function pagePublicationTime(html) {
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const find = object => {
        if (!object || typeof object !== 'object') return null;
        if (Array.isArray(object)) { for (const entry of object) { const found = find(entry); if (found) return found; } return null; }
        const types = [].concat(object['@type'] ?? []);
        if (types.some(type => ['Article', 'NewsArticle', 'BlogPosting', 'DiscussionForumPosting', 'Question', 'QAPage'].includes(type))) {
          const value = object.datePublished || (types.includes('Question') ? object.dateCreated : null);
          if (value) return { value, basis: 'publisher JSON-LD datePublished/dateCreated on content page' };
        }
        return find(object['@graph']) || find(object.mainEntity);
      };
      const found = find(JSON.parse(match[1])); if (found) return found;
    } catch { /* A malformed metadata block is not a publication date. */ }
  }
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
    const name = attrs.property || attrs.name || attrs.itemprop;
    if (['article:published_time', 'datePublished', 'dateCreated', 'pubdate', 'publishdate'].includes(name) && attrs.content) return { value: attrs.content, basis: `publisher content-page metadata ${name}` };
  }
  return null;
}

async function enrichBundle(bundle, keys) {
  if (bundle.publicationPolicy !== 'previous-day-midnight-v1') throw new Error('legacy-bundle-requires-new-collection');
  // Existing successful or failed checks prevent retries during collection.
  if (!bundle.checks.some(check => check.operation === 'official-trending-daily')) {
    const trending = await collectGitHubTrending();
    bundle.items = [...bundle.items.filter(item => item.edition !== 'github'), ...trending.items];
    bundle.checks.push(trending.check); bundle.warnings.push(...trending.warnings);
  }
  const redact = text => { for (const secret of Object.values(keys)) if (secret) text = text.split(secret).join('[redacted]'); return text; };
  const getJson = async (url, options = {}) => {
    const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`http-${response.status}`);
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 8 * 1024 * 1024) throw new Error('response-size-limit'); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  };
  if (keys.ZHIHU_ACCESS_SECRET && !bundle.checks.some(c => c.operation === 'hot-list')) {
    try {
      const data = await getJson('https://developer.zhihu.com/api/v1/content/hot_list', { headers: { Authorization: `Bearer ${keys.ZHIHU_ACCESS_SECRET}`, 'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)), 'Content-Type': 'application/json' } });
      let accepted = 0;
      const walk = node => {
        if (!node || typeof node !== 'object' || accepted >= 15) return;
        if (Array.isArray(node)) { for (const value of node) walk(value); return; }
        const title = node.Title || node.title; const link = node.Url || node.url;
        if (title && link) {
          let url; try { url = new URL(link); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return; } catch { return; }
          if (!bundle.items.some(i => i.edition === 'social' && i.url === url.href)) {
            const observedAt = new Date().toISOString();
            bundle.items.push({ id: `zhihu-hot-${++accepted}`, edition: 'social', title: redact(plain(title)).slice(0, 280), url: redact(url.href), publishedAt: null, retrievedAt: observedAt, observedAt, source: '知乎官方热榜 · 平台样本', text: redact(plain(node.Summary || node.summary || node.ContentText || node.description || '')).slice(0, 2000), evidenceKind: 'social-hot-list', rank: node.Rank ?? node.rank ?? null, sampleScope: 'Zhihu hot list observed now; rank is platform ranking, not population opinion; no verified original publication time' });
          }
        }
        for (const value of Object.values(node)) if (typeof value === 'object') walk(value);
      }; walk(data);
      bundle.checks.push({ service: '知乎', operation: 'hot-list', status: accepted ? 'ok' : 'empty', details: { accepted, responseFields: Object.keys(data).slice(0, 10), dataFields: data.Data && typeof data.Data === 'object' ? Object.keys(data.Data).slice(0, 10) : [], providerCode: data.Code ?? data.code ?? null, message: redact(plain(data.Message || data.message || '')).slice(0, 200), balance: 'unknown：热榜接口不等于余额接口' } });
      if (!accepted) bundle.warnings.push('知乎：热榜接口未取得可用话题；搜索权限成功不等于热榜或全面社会讨论覆盖');
    } catch { bundle.checks.push({ service: '知乎', operation: 'hot-list', status: 'failed', details: { description: '官方热榜接口未能取得可用响应，请检查是否开通热榜权限；未绕过限制' } }); bundle.warnings.push('知乎：热榜未取得，已保留成功的搜索及HN样本，中文热点覆盖有限'); }
  }
  if (!bundle.checks.some(c => c.operation === 'bounded-comment-sample')) {
    let comments = 0;
    for (const item of bundle.items.filter(i => i.source === 'Hacker News 平台样本').slice(0, 6)) {
      try {
        const story = await getJson(`https://hacker-news.firebaseio.com/v0/item/${new URL(item.url).searchParams.get('id')}.json`); const samples = [];
        for (const id of (story.kids ?? []).slice(0, 2)) {
          const c = await getJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (c && !c.deleted && !c.dead && c.text && publicationDecision(new Date(c.time * 1000).toISOString(), bundle).eligible) samples.push({ url: `https://news.ycombinator.com/item?id=${id}`, text: redact(plain(c.text)).slice(0, 350), publishedAt: new Date(c.time * 1000).toISOString() });
        }
        item.commentSamples = samples; item.observedAt = new Date().toISOString(); comments += samples.length;
        item.text = `${item.text} 抽样评论（不是整体民意）：${samples.map(s => s.text).join(' ')}`.slice(0, 2000);
        item.sampleScope = 'HN top stories; first 2 ranked top-level comments on up to 6 stories; not a representative survey';
      } catch { bundle.warnings.push('Hacker News：部分评论采集失败，保留已取得的帖子与样本'); }
    }
    bundle.checks.push({ service: 'Hacker News', operation: 'bounded-comment-sample', status: comments ? 'ok' : 'empty', details: { commentsReceived: comments, description: '最多6个主题、每主题最多2条评论，不代表整体立场' } });
  }
  // Public metadata lookup can establish publication time; hot-list rank and
  // EditTime never do. No cookies/auth or challenge bypass is attempted.
  const dateDomains = new Set(['www.zhihu.com', 'zhuanlan.zhihu.com', 'www.anthropic.com', 'openai.com', 'huggingface.co', 'www.nasa.gov', 'science.nasa.gov']);
  const unresolved = bundle.items.filter(item => !publicationDecision(item.publishedAt, bundle).eligible && dateDomains.has(new URL(item.url).hostname))
    .sort((a, b) => Number(b.evidenceKind === 'social-hot-list') - Number(a.evidenceKind === 'social-hot-list'));
  let resolvedTimes = 0; let inspected = 0; let zhihuInspected = 0;
  for (const item of unresolved) {
    if (inspected >= 10) break;
    const isZhihu = new URL(item.url).hostname.endsWith('zhihu.com');
    if (isZhihu && zhihuInspected >= 3) continue;
    if (isZhihu) zhihuInspected++; inspected++;
    try {
      const response = await fetch(item.url, { redirect: 'error', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Observer-Personal-Daily/1.0' } });
      if (!response.ok) { item.publicationLookup = `http-${response.status}; no bypass`; continue; }
      const reader = response.body.getReader(); const chunks = []; let bytes = 0;
      try { for (;;) { const {done, value} = await reader.read(); if (done) break; bytes += value.length; if (bytes > 4 * 1024 * 1024) throw new Error('metadata-page-too-large'); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
      const found = pagePublicationTime(Buffer.concat(chunks).toString('utf8'));
      if (found) { item.publishedAt = found.value; item.publicationBasis = found.basis; resolvedTimes++; } else item.publicationLookup = 'page-has-no-recognized-publication-metadata';
    } catch { item.publicationLookup = 'public-page-unavailable; no bypass'; }
  }
  bundle.checks.push({ service: '发布者页面', operation: 'publication-metadata', status: 'ok', details: { inspected, resolvedTimes, description: '只有JSON-LD/文章发布时间字段可用于补日期；编辑、抓取、热榜观察时间不采用' } });
  if (keys.TAVILY_API_KEY && !bundle.checks.some(c => c.operation === 'bounded-extract')) {
    const selected = [];
    for (const edition of ['world', 'ai', 'finance', 'frontier']) {
      const candidates = bundle.items.filter(i => i.edition === edition && i.evidenceKind === 'publisher-feed-summary' && i.text.length < 500)
        .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
      selected.push(...candidates.slice(0, 2));
    }
    selected.push(...bundle.items.filter(i => i.source === 'Hugging Face' && !selected.includes(i) && i.text.length < 100).slice(0, 2));
    const urls = [...new Set(selected.map(i => i.url))].slice(0, 10);
    try {
      const data = await getJson('https://api.tavily.com/extract', { method: 'POST', headers: { Authorization: `Bearer ${keys.TAVILY_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ urls, extract_depth: 'basic', format: 'text', include_images: false, include_usage: true }) });
      if (!Array.isArray(data.results)) throw new Error('invalid-extract-response');
      let accepted = 0;
      for (const row of data.results) {
        const item = selected.find(i => i.url === row.url); const text = redact(plain(row.raw_content));
        if (!item || text.length < 100 || /^(?:just a moment|client challenge|access denied|verify you are human)/i.test(text)) continue;
        item.text = `${item.text}\n网页摘录（已截断）：${text}`.slice(0, 3000); item.evidenceKind = 'publisher-page-excerpt'; item.extractedAt = new Date().toISOString(); accepted++;
      }
      bundle.checks.push({ service: 'Tavily', operation: 'bounded-extract', status: accepted ? 'ok' : 'empty', details: { requested: urls.length, accepted, failed: data.failed_results?.length ?? 0, credits: data.usage?.credits ?? null, description: '只补充已有候选的短片段，未再次搜索，未保存全文' } });
      if (accepted < urls.length) bundle.warnings.push(`Tavily：${urls.length - accepted}篇候选未能补充网页片段，仍保留原摘要；不绕过登录或访问挑战`);
    } catch { bundle.checks.push({ service: 'Tavily', operation: 'bounded-extract', status: 'failed', details: { requested: urls.length, description: '网页补充提取失败，已保留原摘要；未重试或重搜' } }); bundle.warnings.push('Tavily：网页补充提取失败，本期使用已取得摘要与检索片段'); }
  }
  bundle.completedAt = new Date().toISOString(); bundle.retrievedAt = bundle.completedAt;
  bundle.warnings = [...new Set(bundle.warnings)];
}

export async function enrichDaily({ outputDir }) {
  for (const edition of EDITIONS) if (await access(resolve(outputDir, `${edition}.json`)).then(() => true, () => false)) throw new Error('bundle-already-in-use');
  const file = resolve(outputDir, 'acquisition.json'); const bundle = JSON.parse(await readFile(file, 'utf8'));
  await enrichBundle(bundle, credentials());
  enforcePublicationWindow(bundle);
  await writeFile(file, JSON.stringify(bundle, null, 2), 'utf8');
  return bundle;
}

// A narrowly scoped repair for an unfrozen bundle: no repeated paid web search.
// Refuses to alter evidence once any edition generation has begun.
export async function supplementSocial({ outputDir }) {
  for (const edition of EDITIONS) {
    if (await access(resolve(outputDir, `${edition}.json`)).then(() => true, () => false)) throw new Error('bundle-already-in-use');
  }
  const file = resolve(outputDir, 'acquisition.json'); const bundle = JSON.parse(await readFile(file, 'utf8'));
  if (bundle.publicationPolicy !== 'previous-day-midnight-v1') throw new Error('legacy-bundle-requires-new-collection');
  if (bundle.socialSupplementCompletedAt) return bundle;
  const keys = credentials();
  const scrub = text => { for (const key of Object.values(keys)) if (key) text = text.split(key).join('[redacted]'); return text; };
  const get = async (url, headers = {}) => { const response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) }); if (!response.ok) throw new Error(`http-${response.status}`); const raw = await response.text(); if (raw.length > 2000000) throw new Error('response-size-limit'); return JSON.parse(raw); };
  if (keys.ZHIHU_ACCESS_SECRET) {
    try {
      const url = new URL('https://developer.zhihu.com/api/v1/content/zhihu_search'); url.searchParams.set('Query', `${bundle.date} 热点 社会 科技 讨论`);
      const data = await get(url, { Authorization: `Bearer ${keys.ZHIHU_ACCESS_SECRET}`, 'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)), 'Content-Type': 'application/json' });
      const rows = data.Data?.Items;
      if (data.Code !== 0 || !Array.isArray(rows)) throw new Error('provider-no-items');
      let accepted = 0;
      for (const row of rows.slice(0, 10)) {
        let url; try { url = new URL(row.Url); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue; } catch { continue; }
        if (bundle.items.some(item => item.edition === 'social' && item.url === url.href)) continue;
        bundle.items.push({ id: `zhihu-supplement-${++accepted}`, edition: 'social', title: plain(row.Title).slice(0, 280), url: url.href, publishedAt: null, retrievedAt: new Date().toISOString(), text: plain(row.ContentText).slice(0, 2000), source: '知乎官方搜索 · 平台样本', author: row.AuthorName || null, commentCount: row.CommentCount ?? null, voteCount: row.VoteUpCount ?? null, lastEditedAt: typeof row.EditTime === 'number' ? new Date(row.EditTime * 1000).toISOString() : null, evidenceKind: 'social-search-excerpt', sampleScope: 'Zhihu topical search, not hot list or full-platform sentiment survey; EditTime is not publication date' });
      }
      bundle.checks.push({ service: '知乎', operation: 'search-capitalized-response-fix', status: 'ok', details: { usable: accepted > 0, received: rows.length, accepted, providerCode: data.Code, balance: 'unknown：官方搜索未提供余额，需查看个人中心', permission: '已实际取得标题、回答片段、链接、作者及互动计数；不代表其他API权限' } });
      bundle.warnings = bundle.warnings.filter(w => w !== '知乎: 接口返回但未取得可用条目');
    } catch { bundle.warnings.push('知乎补充采集未成功，请查看接口权限或稍后处理；其他内容保留'); bundle.checks.push({ service: '知乎', operation: 'social-supplement', status: 'failed', details: { description: '未能取得可用搜索响应，未重新调用其他付费搜索服务' } }); }
  }
  let sampledComments = 0;
  const hn = bundle.items.filter(item => item.source === 'Hacker News 平台样本').slice(0, 6);
  for (const item of hn) {
    try {
      const id = new URL(item.url).searchParams.get('id');
      const story = await get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      const excerpts = [];
      for (const child of (story.kids ?? []).slice(0, 2)) {
        const comment = await get(`https://hacker-news.firebaseio.com/v0/item/${child}.json`);
        if (comment && !comment.deleted && !comment.dead && comment.text && publicationDecision(new Date(comment.time * 1000).toISOString(), bundle).eligible) {
          excerpts.push({ url: `https://news.ycombinator.com/item?id=${child}`, text: plain(comment.text).slice(0, 350), publishedAt: new Date(comment.time * 1000).toISOString() });
        }
      }
      if (excerpts.length) {
        item.commentSamples = excerpts; item.text = `${item.text} 抽样评论（不是整体民意）：${excerpts.map((row, index) => `${index + 1}. ${row.text}`).join(' ')}`.slice(0, 2000);
        item.sampleScope = 'HN top 25 stories; this story additionally sampled first 2 top-level ranked comment IDs, excluding deleted/dead comments'; sampledComments += excerpts.length;
      }
    } catch { bundle.warnings.push('Hacker News：部分评论样本未取得，仍可使用已取得的帖子热度与其余评论'); }
  }
  bundle.checks.push({ service: 'Hacker News', operation: 'bounded-comment-sample', status: sampledComments ? 'ok' : 'empty', details: { storiesSampled: hn.length, commentsReceived: sampledComments, description: '至多6个主题、每主题至多2条排序靠前评论，不能代表全部社区立场' } });
  bundle.completedAt = new Date().toISOString(); bundle.retrievedAt = bundle.completedAt; bundle.socialSupplementCompletedAt = bundle.completedAt;
  bundle.warnings = [...new Set(bundle.warnings)];
  enforcePublicationWindow(bundle);
  await writeFile(file, scrub(JSON.stringify(bundle, null, 2)), { encoding: 'utf8' });
  return bundle;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  collectDaily({ date: process.argv[2], outputDir: process.argv[3] }).then(result => console.log(JSON.stringify({ date: result.date, counts: Object.fromEntries(EDITIONS.map(e => [e, result.items.filter(i => i.edition === e).length])), checks: result.checks, warnings: result.warnings }, null, 2))).catch(() => { console.error('daily-acquisition-failed (details suppressed to protect credentials)'); process.exitCode = 1; });
}
