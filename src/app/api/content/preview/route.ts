import { CONTENT_SOURCES } from '@/lib/contentSources';
import type { ContentCategory } from '@/lib/contentSources';

export const runtime = 'edge';

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
    const url = new URL(match[1], pageUrl);
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
    articleBody: typeof article.articleBody === 'string' ? textContent(article.articleBody) : undefined,
    image: images.map((image) => typeof image === 'string' ? image : image && typeof image === 'object' && typeof image.url === 'string' ? image.url : '').filter(Boolean),
    datePublished: typeof article.datePublished === 'string' ? article.datePublished : undefined,
    url: typeof article.url === 'string' ? article.url : undefined,
  };
}

function extractImages(html: string, pageUrl: string, data: StructuredData = {}) {
  const images: string[] = [];
  const candidates = [meta(html, 'og:image'), meta(html, 'twitter:image'), ...(data.image || [])];
  const imagePattern = /<(?:img|source)\b[^>]*(?:src|data-src|data-lazy-src|data-original|data-image|srcset|data-srcset)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(imagePattern)) candidates.push(...match[1].split(',').map((value) => value.trim().split(/\s+/)[0]));
  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith('data:')) continue;
    try {
      const url = new URL(candidate, pageUrl);
      if ((url.protocol !== 'http:' && url.protocol !== 'https:') || images.includes(url.href)) continue;
      images.push(url.href);
      if (images.length >= 8) break;
    } catch {
      // Ignore malformed image URLs.
    }
  }
  return images;
}

function extractBody(html: string, data: StructuredData = {}) {
  if (data.articleBody && data.articleBody.length > 80) return data.articleBody.slice(0, 16_000);
  const block = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<(?:div|section)\b[^>]*(?:itemprop|class|id)=["'][^"']*(?:articleBody|article-body|post-content|entry-content|article-content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i)?.[1]
    || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html.match(/<div\b[^>]*(?:class|id)=["'][^"']*(?:article|post|content|entry)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || '';
  return textContent(block.replace(/<(script|style|noscript|nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')).slice(0, 16_000);
}

function extractImage(html: string, pageUrl: string, data: StructuredData = {}) {
  return extractImages(html, pageUrl, data)[0];
}

function fallbackItem(sourceName: string, sourceUrl: string, category: ContentCategory, title: string, description: string, body: string, image: string | undefined, images: string[]) {
  return { title: title || sourceName, url: sourceUrl, description, body, image, images, category };
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
  const id = new URL(request.url).searchParams.get('source');
  const source = CONTENT_SOURCES.find((item) => item.id === id);
  if (!source) return Response.json({ error: '등록되지 않은 출처입니다.' }, { status: 404 });

  try {
    const html = await fetchHtml(source.url);
    const pageData = structuredData(html);
    const title = meta(html, 'og:title') || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || pageData.headline || source.name;
    const description = pageData.description || meta(html, 'og:description') || meta(html, 'description') || '';
    const canonicalRaw = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || pageData.url || source.url;
    const canonical = new URL(canonicalRaw, source.url).href;
    const pageImages = extractImages(html, source.url, pageData);
    const pageBody = extractBody(html, pageData);
    const feedHref = html.match(/<link[^>]+type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
    const sourceItem = fallbackItem(source.name, canonical, source.categories[0] || 'news', title, description, pageBody, pageImages[0], pageImages);
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
    const sections = source.crawlPaths
      ? await Promise.all(source.crawlPaths.map(async (crawlPath) => {
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
    if (!source.crawlPaths?.length) items = [sourceItem];
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
