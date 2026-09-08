// GitHub's actual public daily/all-languages list. No Search API substitution.
export const GITHUB_TRENDING_URL = 'https://github.com/trending?since=daily';

function text(html) {
  return String(html ?? '').replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, value => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[value])
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value) => {
      const point = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return Number.isInteger(point) && point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ' ';
    }).replace(/\s+/g, ' ').trim();
}

function count(value) {
  const clean = text(value);
  // Do not invent exact integers from compact/rounded values such as 1.2k.
  return /^[\d,]+$/.test(clean) ? Number(clean.replaceAll(',', '')) : null;
}

function parseTrending(html, observedAt) {
  if (!/<h1\b[^>]*>\s*Trending\s*<\/h1>/i.test(html)) throw new Error('trending-page-not-recognized');
  const rows = [...html.matchAll(/<article\b[^>]*class=["'][^"']*\bBox-row\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)];
  if (!rows.length || rows.length > 50) throw new Error('trending-list-empty-or-structure-changed');
  const repositories = new Set();
  return rows.map(([, row], index) => {
    const heading = row.match(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/i)?.[1];
    const path = heading?.match(/<a\b[^>]*href=["'](\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)["']/i)?.[1];
    if (!path || repositories.has(path.toLowerCase())) throw new Error('trending-repository-row-invalid');
    repositories.add(path.toLowerCase());
    const repositoryUrl = `https://github.com${path}`;
    const anchor = [...row.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].find(([, href]) => href === `${path}/stargazers`);
    const starsText = anchor ? text(anchor[2]) : null;
    // Only GitHub's right-aligned counter; a repository description may itself
    // contain "N stars today" and must never supply the metric.
    const counters = [...row.matchAll(/<span\b[^>]*class=["'][^"']*\bfloat-sm-right\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi)]
      .map(([, content]) => text(content).match(/^([\d,.]+(?:[kKmM])?)\s+stars?\s+today$/)?.[1]).filter(Boolean);
    const starsTodayText = counters.length === 1 ? counters[0] : null;
    const description = text(row.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]).slice(0, 1400);
    const language = text(row.match(/<span\b[^>]*itemprop=["']programmingLanguage["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]) || null;
    const stars = count(starsText); const starsToday = count(starsTodayText);
    const title = path.slice(1); const rank = index + 1;
    return { id: `github-trending-${rank}`, edition: 'github', title, url: repositoryUrl, repositoryUrl,
      source: 'GitHub 官方 Trending · daily', evidenceKind: 'github-trending', trendPeriod: 'daily',
      trendingRank: rank, stars, starsToday, starsText, starsTodayText, language,
      observedAt, retrievedAt: observedAt, trendingUrl: GITHUB_TRENDING_URL, publishedAt: null,
      text: `${description || '榜单未提供项目描述。'} 官方每日Trending榜单第${rank}位。${starsText !== null ? `页面总stars：${starsText}。` : ''}${starsTodayText !== null ? `页面显示今日stars：${starsTodayText}。` : '页面未显示今日stars数量。'}${language ? `语言：${language}。` : ''}这是GitHub榜单采集快照，不是项目创建或首次发布日期。`,
      publicationBasis: 'not-applicable: official daily Trending observation; no repository publication-date restriction' };
  });
}

export async function collectGitHubTrending() {
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(GITHUB_TRENDING_URL, { redirect: 'error', signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'Observer-Personal-Daily/1.0', Accept: 'text/html', 'Accept-Language': 'en' } });
    if (!response.ok) throw new Error(`http-${response.status}`);
    const reader = response.body.getReader(); const chunks = []; let bytes = 0;
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 3 * 1024 * 1024) throw new Error('trending-response-too-large'); chunks.push(value); } } finally { await reader.cancel().catch(() => {}); }
    const observedAt = new Date().toISOString();
    const items = parseTrending(Buffer.concat(chunks).toString('utf8'), observedAt);
    return { items, check: { service: 'GitHub', operation: 'official-trending-daily', status: 'ok', details: { trendingUrl: GITHUB_TRENDING_URL, startedAt, observedAt, received: items.length, rankBasis: 'official page order', language: 'any', credential: 'anonymous', balance: 'not-applicable' } }, warnings: [] };
  } catch (error) {
    const reason = /^(?:http-\d+|trending-[a-z-]+)$/.test(error.message) ? error.message : ['TimeoutError', 'AbortError'].includes(error.name) ? 'timeout' : 'network-or-parser-failed';
    const description = reason === 'http-429' ? '官方榜单访问频率受限，请稍后再取；未使用搜索榜替代。' : ['http-401', 'http-403'].includes(reason) ? '官方榜单访问被拒绝；未绕过登录或访问限制，也未用搜索结果冒充Trending。' : reason === 'timeout' ? '官方榜单请求超时；本次不生成替代榜单。' : '官方榜单无法读取、为空或页面结构已变化，需要修复采集；未用stars搜索冒充Trending。';
    return { items: [], check: { service: 'GitHub', operation: 'official-trending-daily', status: 'failed', details: { trendingUrl: GITHUB_TRENDING_URL, startedAt, reason, description } }, warnings: [`GitHub：${description}`] };
  }
}
