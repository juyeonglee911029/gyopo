import { CONTENT_SOURCES } from '@/lib/contentSources';
import type { ContentCategory } from '@/lib/contentSources';

export const runtime = 'edge';
type MarketAssetDefinition = { key: string; label: string; symbol: string; currency: string };
type MarketYahooResult = { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; chartPreviousClose?: number; currency?: string } }> } };

const MARKET_ASSETS: MarketAssetDefinition[] = [
  { key: 'bitcoin', label: 'BTC', symbol: 'bitcoin', currency: 'USD' },
  { key: 'ethereum', label: 'ETH', symbol: 'ethereum', currency: 'USD' },
  { key: 'ripple', label: 'XRP', symbol: 'ripple', currency: 'USD' },
  { key: 'solana', label: 'SOL', symbol: 'solana', currency: 'USD' },
  { key: 'hynix', label: 'SK Hynix', symbol: '000660.KS', currency: 'KRW' },
  { key: 'samsung', label: 'Samsung', symbol: '005930.KS', currency: 'KRW' },
  { key: 'nvidia', label: 'NVIDIA', symbol: 'NVDA', currency: 'USD' },
  { key: 'apple', label: 'Apple', symbol: 'AAPL', currency: 'USD' },
  { key: 'kospi', label: 'KOSPI', symbol: '^KS11', currency: 'KRW' },
  { key: 'nasdaq', label: 'NASDAQ', symbol: '^IXIC', currency: 'USD' },
];

async function fetchMarketJson<T>(url: string) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'GYOPO-Market/1.0 (+https://gyopo.pages.dev)' } });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function fetchMarketData() {
  const rates = await fetchMarketJson<{ rates?: Record<string, number> }>('https://api.frankfurter.app/latest?from=USD&to=KRW,EUR,JPY,BRL,CAD,GBP');
  const crypto = await fetchMarketJson<Array<{ symbol?: string; quotes?: { USD?: { price?: number; percent_change_24h?: number } } }>>('https://api.coinpaprika.com/v1/tickers?quotes=USD');
  const cryptoBySymbol = Object.fromEntries((crypto || []).map((item) => [item.symbol?.toLowerCase(), item.quotes?.USD]));
  const cryptoSymbolById: Record<string, string> = { bitcoin: 'btc', ethereum: 'eth', ripple: 'xrp', solana: 'sol' };
  const equities = await Promise.all(MARKET_ASSETS.slice(4).map(async (asset) => {
    const result = await fetchMarketJson<MarketYahooResult>('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(asset.symbol) + '?range=1d&interval=1d&includePrePost=false');
    const meta = result?.chart?.result?.[0]?.meta;
    const value = typeof meta?.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
    const previous = typeof meta?.chartPreviousClose === 'number' ? meta.chartPreviousClose : null;
    return { key: asset.key, label: asset.label, value, change: value !== null && previous ? ((value - previous) / previous) * 100 : null, currency: meta?.currency || asset.currency };
  }));
  const cryptoAssets = MARKET_ASSETS.slice(0, 4).map((asset) => { const quote = cryptoBySymbol[cryptoSymbolById[asset.symbol]]; return { key: asset.key, label: asset.label, value: quote?.price ?? null, change: quote?.percent_change_24h ?? null, currency: asset.currency }; });
  return { updatedAt: new Date().toISOString(), rates: rates?.rates || {}, assets: [...cryptoAssets, ...equities] };
}


function clean(value: string | undefined) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(x?[0-9a-f]+);/gi, (_, code: string) => {
      const value = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isNaN(value) ? '' : String.fromCodePoint(value);
    })
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function textContent(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function cleanArticleBody(value: string) {
  const lines = value
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/^(기사 듣기|재생|공유|WhatsApp|TALK|KakaoTalk|f Facebook|링크 복사|AD)$/i.test(line));
  const body = lines.join('\n\n');
  return body
    .replace(/\n\n(?:Story Timeline|이 뉴스의 흐름)[\s\S]*$/i, '')
    .replace(/\n\n(?:SPONSORED(?: · AD)?|AD)\b[\s\S]*$/i, '')
    .trim()
    .slice(0, 16_000);
}

type CrawlItem = { title: string; url: string; description?: string; body?: string; image?: string; images?: string[]; publishedAt?: string; category: ContentCategory };
type StructuredData = { headline?: string; description?: string; articleBody?: string; image?: string[]; datePublished?: string; url?: string };

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'GYOPO-Content-Crawler/1.0 (+https://gyopo.pages.dev)' },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`출처 응답 ${response.status}`);
  return response.text();
}

function extractLinks(html: string, pageUrl: string, pathPrefix: string, category: ContentCategory): CrawlItem[] {
  const items: CrawlItem[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    let url: URL;
    try {
      url = new URL(match[1], pageUrl);
    } catch {
      continue;
    }
    const heading = match[2].match(/<(h[1-6]|strong|b)[^>]*>([\s\S]*?)<\/\1>/i)?.[2];
    const title = clean(heading || match[2]);
    if (url.origin !== new URL(pageUrl).origin || !url.pathname.startsWith(pathPrefix) || url.pathname === pathPrefix || url.hash || title.length < 4 || title.length > 280) continue;
    if (seen.has(url.href) || /^(로그인|회원가입|전체보기|전체 상품|더보기|기사 보기|상품 등록|공고 등록|업체 등록|관심 상품|내 거래|글쓰기|이용약관|개인정보처리방침|커뮤니티 운영정책|편집·정정정책|제보·문의|검색|앱 설치하기)$/i.test(title) || /(운영정책|이용약관|개인정보|편집·정정|제보·문의)/i.test(title)) continue;
    seen.add(url.href);
    items.push({ title, url: url.href, category });
    if (items.length >= 8) break;
  }
  return items;
}

function meta(html: string, key: string) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  return clean(html.match(pattern)?.[1] || html.match(reverse)?.[1]);
}

function tag(block: string, name: string) {
  return clean(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);
}

function structuredData(html: string): StructuredData {
  const records: Array<Record<string, unknown>> = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      const values = Array.isArray(parsed) ? parsed : [parsed];
      for (const value of values) {
        if (!value || typeof value !== 'object') continue;
        const record = value as Record<string, unknown>;
        const graph = Array.isArray(record['@graph']) ? record['@graph'] : [];
        records.push(record, ...graph.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')));
      }
    } catch {
      // Ignore malformed structured data and continue with HTML metadata.
    }
  }
  const article = records.find((record) => ['Article', 'NewsArticle', 'BlogPosting', 'Product', 'LocalBusiness'].some((kind) => String(record['@type'] || '').includes(kind)))
    || records.find((record) => typeof record.headline === 'string')
    || records.find((record) => typeof record.name === 'string' && !['PostalAddress', 'Organization', 'WebSite', 'WebPage'].includes(String(record['@type'])))
    || records[0];
  if (!article) return {};
  const images = Array.isArray(article.image) ? article.image : article.image ? [article.image] : [];
  return {
    headline: typeof article.headline === 'string' ? clean(article.headline) : typeof article.name === 'string' ? clean(article.name) : undefined,
    description: typeof article.description === 'string' ? clean(article.description) : undefined,
    articleBody: typeof article.articleBody === 'string' ? cleanArticleBody(textContent(article.articleBody)) : undefined,
    image: images.map((image) => typeof image === 'string' ? image : image && typeof image === 'object' && typeof image.url === 'string' ? image.url : '').filter(Boolean),
    datePublished: typeof article.datePublished === 'string' ? article.datePublished : undefined,
    url: typeof article.url === 'string' ? article.url : undefined,
  };
}

function extractImages(html: string, pageUrl: string, data: StructuredData = {}) {
  const images: string[] = [];
  const contentBlock = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0]
    || html.match(/<(?:main|div|section)\b[^>]*(?:articleBody|article-body|post-content|entry-content|article-content)[^>]*>[\s\S]*?<\/(?:main|div|section)>/i)?.[0]
    || '';
  const bodyCandidates: string[] = [];
  const imagePattern = /<(?:img|source)\b[^>]*(?:src|data-src|data-lazy-src|data-original|data-image|srcset|data-srcset)=["']([^"']+)["']/gi;
  for (const match of contentBlock.matchAll(imagePattern)) bodyCandidates.push(...match[1].split(',').map((value) => value.trim().split(/\s+/)[0]));
  const candidates = [...(data.image || []), ...bodyCandidates, meta(html, 'og:image'), meta(html, 'twitter:image')];
  for (const match of html.matchAll(imagePattern)) candidates.push(...match[1].split(',').map((value) => value.trim().split(/\s+/)[0]));
  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith('data:')) continue;
    try {
      const url = new URL(candidate, pageUrl);
      if ((url.protocol !== 'http:' && url.protocol !== 'https:') || images.includes(url.href) || /(?:logo|favicon|sprite|placeholder|avatar|banner|advert|\/icon[/.])/i.test(url.pathname)) continue;
      images.push(url.href);
      if (images.length >= 8) break;
    } catch {
      // Ignore malformed image URLs.
    }
  }
  return images;
}

function extractBody(html: string, data: StructuredData = {}) {
  if (data.articleBody && data.articleBody.length > 80) return data.articleBody;
  const block = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<(?:div|section)\b[^>]*(?:itemprop|class|id)=["'][^"']*(?:articleBody|article-body|post-content|entry-content|article-content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i)?.[1]
    || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html.match(/<div\b[^>]*(?:class|id)=["'][^"']*(?:article|post|content|entry)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || '';
  return cleanArticleBody(textContent(block.replace(/<(script|style|noscript|nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')));
}

function extractImage(html: string, pageUrl: string, data: StructuredData = {}) {
  return extractImages(html, pageUrl, data)[0];
}

function fallbackItem(sourceName: string, sourceUrl: string, category: ContentCategory, title: string, description: string, body: string, image: string | undefined, images: string[]) {
  return { title: title || sourceName, url: sourceUrl, description, body, image, images, category };
}

const regionNames: Record<string, string> = {
  Global: '글로벌', USA: '미국', 'USA-LA': '로스앤젤레스', Brazil: '브라질', Argentina: '아르헨티나', Chile: '칠레', Colombia: '콜롬비아', Bolivia: '볼리비아', Paraguay: '파라과이', Panama: '파나마', Mexico: '멕시코', Portugal: '포르투갈', Spain: '스페인', Netherlands: '네덜란드', Germany: '독일', Romania: '루마니아', Hungary: '헝가리', Malta: '몰타', Thailand: '태국', Vietnam: '베트남',
};

async function fetchRegionalNews(region: string) {
  const label = regionNames[region] || region;
  const feedUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`한인 ${label}`)}&hl=ko&gl=KR&ceid=KR:ko`;
  const feed = await fetchHtml(feedUrl);
  const blocks = feed.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const items = blocks.slice(0, 12).map((block) => {
    const title = tag(block, 'title');
    const url = tag(block, 'link');
    const description = textContent(tag(block, 'description') || '');
    const image = block.match(/<(?:media:content|media:thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1];
    return { title, url, description, body: description, image, images: image ? [image] : [], publishedAt: tag(block, 'pubDate'), category: 'news' as ContentCategory };
  }).filter((item) => item.title && item.url);
  return { sourceId: `regional-${region}`, sourceName: `${label} 지역 뉴스 검색`, region, url: feedUrl, title: `${label} 오늘의 뉴스`, description: `${label} 관련 최신 공개 뉴스 피드입니다.`, items, sections: [], status: items.length ? 'ready' : 'unavailable', warnings: items.length ? [] : ['지역 뉴스 피드를 찾지 못했습니다.'], fetchedAt: new Date().toISOString(), verified: false };
}

async function enrichItems(items: CrawlItem[]) {
  return Promise.all(items.map(async (item) => {
    try {
      const detail = await fetchHtml(item.url);
      const data = structuredData(detail);
      const body = extractBody(detail, data);
      const images = extractImages(detail, item.url, data);
      return {
        ...item,
        // The list card title is more specific than the site's shared og:title.
        title: item.title || data.headline || meta(detail, 'og:title') || '출처 콘텐츠',
        description: item.description || data.description || meta(detail, 'og:description') || '',
        body: data.articleBody || body || item.description || '',
        image: extractImage(detail, item.url, data),
        images,
        publishedAt: item.publishedAt || data.datePublished,
      };
    } catch {
      return item;
    }
  }));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const region = params.get('region');
  if (region) {
    try {
      return Response.json(await fetchRegionalNews(region));
    } catch (error) {
      return Response.json({ sourceId: `regional-${region}`, sourceName: `${region} 지역 뉴스 검색`, region, items: [], sections: [], status: 'unavailable', warnings: [error instanceof Error ? error.message : '지역 뉴스 피드를 확인하지 못했습니다.'], fetchedAt: new Date().toISOString() }, { status: 200 });
    }
  }
  const id = params.get('source');
  if (id === 'market') return Response.json(await fetchMarketData(), { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } });

  const requestedCategory = params.get('category') as ContentCategory | null;
  const source = CONTENT_SOURCES.find((item) => item.id === id);
  if (!source) return Response.json({ error: '등록되지 않은 출처입니다.' }, { status: 404 });

  try {
    if (source.id === 'hanintoday-brazil' && requestedCategory === 'jobs') {
      const response = await fetch('https://hanintoday.com.br/api/jobs', { headers: { 'User-Agent': 'GYOPO-Content-Crawler/1.0 (+https://gyopo.pages.dev)' }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`구인 API 응답 ${response.status}`);
      const payload = await response.json() as { jobs?: Array<{ id?: string; title?: string; company?: string; area?: string; category?: string; employmentType?: string; salaryType?: string; salary?: number; description?: string; requirements?: string; contact?: string; createdAt?: string; details?: { workplaceAddress?: string; salaryConditions?: string } }> };
      const items = (payload.jobs || []).filter((job) => job.id && job.title).slice(0, 50).map((job) => ({
        title: clean(job.title),
        url: `https://hanintoday.com.br/jobs/${job.id}`,
        description: clean(job.description || ''),
        body: clean([job.description, job.requirements, job.details?.workplaceAddress, job.details?.salaryConditions, job.contact].filter(Boolean).join('\n\n')),
        publishedAt: job.createdAt,
        category: 'jobs' as ContentCategory,
        company: clean(job.company || ''),
        location: clean(job.area || ''),
        salary: job.details?.salaryConditions || (job.salary ? `${job.salary} · ${job.salaryType || ''}` : '상세 내용 참조'),
        tag: clean(job.category || job.employmentType || '구인구직'),
      }));
      return Response.json({ sourceId: source.id, sourceName: source.name, region: source.region, url: 'https://hanintoday.com.br/jobs', title: '한인투데이 구인구직', description: '한인투데이에서 확인된 최신 구인구직 공고입니다.', items, sections: [{ category: 'jobs', label: '구인구직', url: 'https://hanintoday.com.br/jobs', items }], status: items.length ? 'ready' : 'unavailable', warnings: items.length ? [] : ['구인구직 공고가 없습니다.'], fetchedAt: new Date().toISOString(), verified: true });
    }
    if (source.id === 'hanintoday-brazil' && requestedCategory === 'directory') {
      const response = await fetch('https://hanintoday.com.br/api/businesses', { headers: { 'User-Agent': 'GYOPO-Content-Crawler/1.0 (+https://gyopo.pages.dev)' }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`업소 API 응답 ${response.status}`);
      const payload = await response.json() as { businesses?: Array<{ id?: string; tradeName?: string; entityType?: string; category?: string; phone?: string; whatsapp?: string; area?: string; address?: string; description?: string; logoUrl?: string; coverImageUrl?: string; latitude?: number; longitude?: number }> };
      const categoryLabels: Record<string, string> = { health_clinic: '병원·의료', grocery_market: '마트·식품', restaurant_cafe: '음식점·카페', it_services: 'IT·서비스', buddhist_temple: '종교·단체', consulate_organization: '공공기관·단체' };
      const items = (payload.businesses || []).filter((business) => business.id && business.tradeName && business.entityType !== 'job').slice(0, 100).map((business) => ({
        title: clean(business.tradeName),
        url: `https://hanintoday.com.br/businesses/${business.id}`,
        description: clean(business.description || `${categoryLabels[business.category || ''] || '한인 업소'} · ${business.area || ''}`),
        body: clean([business.description, business.address, business.phone || business.whatsapp].filter(Boolean).join('\n\n')),
        category: 'directory' as ContentCategory,
        company: clean(business.tradeName),
        tag: categoryLabels[business.category || ''] || '한인 업소',
        phone: clean(business.phone || business.whatsapp || ''),
        address: clean([business.area, business.address].filter(Boolean).join(' · ')),
        image: business.coverImageUrl || business.logoUrl,
        images: [business.coverImageUrl, business.logoUrl].filter(Boolean) as string[],
        lat: business.latitude,
        lng: business.longitude,
      }));
      return Response.json({ sourceId: source.id, sourceName: source.name, region: source.region, url: 'https://hanintoday.com.br/businesses', title: '한인투데이 업소록', description: '한인투데이에서 확인된 실제 업소 정보입니다.', items, sections: [{ category: 'directory', label: '업소', url: 'https://hanintoday.com.br/businesses', items }], status: items.length ? 'ready' : 'unavailable', warnings: items.length ? [] : ['업소 정보가 없습니다.'], fetchedAt: new Date().toISOString(), verified: true });
    }
    const html = await fetchHtml(source.url);
    const pageData = structuredData(html);
    const title = meta(html, 'og:title') || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || pageData.headline || source.name;
    const description = pageData.description || meta(html, 'og:description') || meta(html, 'description') || '';
    const canonicalRaw = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || pageData.url || source.url;
    const canonical = new URL(canonicalRaw, source.url).href;
    const pageImages = extractImages(html, source.url, pageData);
    const pageBody = extractBody(html, pageData);
    const feedHref = html.match(/<link[^>]+type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
    const sourceItem = fallbackItem(source.name, canonical, requestedCategory || source.categories[0] || 'news', title, description, pageBody, pageImages[0], pageImages);
    const warnings: string[] = [];
    let items: CrawlItem[] = [];
    if (feedHref) {
      const feedResponse = await fetch(new URL(feedHref, source.url), { headers: { 'User-Agent': 'GYOPO-Content-Preview/1.0' }, signal: AbortSignal.timeout(8_000) }).catch(() => null);
      if (feedResponse?.ok) {
        const feed = await feedResponse.text();
        const blocks = feed.match(/<item[\s>][\s\S]*?<\/item>/gi) || feed.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
        items = await enrichItems(blocks.slice(0, 8).map((block) => ({
          title: tag(block, 'title'),
          url: tag(block, 'link') || block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || canonical,
          description: tag(block, 'description') || tag(block, 'summary'),
          publishedAt: tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || undefined,
          category: 'news' as ContentCategory,
        })).filter((item) => item.title));
      }
    }
    const crawlPaths = source.crawlPaths?.filter((crawlPath) => !requestedCategory || crawlPath.category === requestedCategory) || [];
    const sections = source.crawlPaths
      ? await Promise.all(crawlPaths.map(async (crawlPath) => {
        try {
          const url = new URL(crawlPath.path, source.url).href;
          const page = await fetchHtml(url);
           const extracted = extractLinks(page, url, crawlPath.path, crawlPath.category);
           const enriched = await enrichItems(extracted);
           const fallback = source.categories.includes(crawlPath.category) && enriched.length === 0
             ? [{ ...sourceItem, category: crawlPath.category, title: `${source.name} · ${crawlPath.label}`, url: canonical }]
             : [];
           return { category: crawlPath.category, label: crawlPath.label, url, items: enriched.length ? enriched : fallback };
        } catch (error) {
          warnings.push(`${crawlPath.label}: ${error instanceof Error ? error.message : '목록을 읽지 못했습니다.'}`);
          return { category: crawlPath.category, label: crawlPath.label, url: new URL(crawlPath.path, source.url).href, items: source.categories.includes(crawlPath.category) ? [{ ...sourceItem, category: crawlPath.category, title: `${source.name} · ${crawlPath.label}` }] : [] };
        }
      }))
      : [];
    if (!source.crawlPaths?.length || (requestedCategory && !crawlPaths.length)) items = [sourceItem];
    return Response.json({
      sourceId: source.id,
      sourceName: source.name,
      region: source.region,
      url: canonical,
      title: clean(title).slice(0, 240),
      description: clean(description).slice(0, 600),
      items,
      sections,
      image: pageImages[0],
      images: pageImages,
      status: warnings.length ? 'partial' : 'ready',
      warnings,
      fetchedAt: new Date().toISOString(),
      verified: source.trust === 'official' || source.trust === 'verified',
    });
  } catch (error) {
    return Response.json({
      sourceId: source.id,
      sourceName: source.name,
      region: source.region,
      url: source.url,
      title: source.name,
      description: source.note,
      items: [],
      sections: [],
      status: 'unavailable',
      warning: error instanceof Error ? error.message : '출처 연결을 확인하지 못했습니다.',
      fetchedAt: new Date().toISOString(),
      verified: source.trust === 'official' || source.trust === 'verified',
    }, { status: 200 });
  }
}
