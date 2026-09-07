import { CONTENT_SOURCES } from '@/lib/contentSources';
import type { ContentCategory } from '@/lib/contentSources';

export const runtime = 'edge';

function clean(value: string | undefined) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
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
    const title = clean(match[2]);
    if (url.origin !== new URL(pageUrl).origin || !url.pathname.startsWith(pathPrefix) || url.pathname === pathPrefix || url.hash || title.length < 4 || title.length > 280) continue;
    if (seen.has(url.href) || /^(로그인|회원가입|전체보기|더보기|기사 보기|상품 등록|관심 상품|내 거래)$/i.test(title)) continue;
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

function extractImage(html: string, pageUrl: string) {
  const candidates = [
    meta(html, 'og:image'),
    meta(html, 'twitter:image'),
    html.match(/<img\b[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i)?.[1],
  ];
  for (const candidate of candidates) {
    if (!candidate || candidate.startsWith('data:')) continue;
    try {
      const url = new URL(candidate, pageUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch {
      // Ignore malformed source image URLs.
    }
  }
  return undefined;
}

function extractImages(html: string, pageUrl: string) {
  const images: string[] = [];
  const imagePattern = /<img\b[^>]*(?:src|data-src|data-lazy-src)=["']([^"']+)["']/gi;
  for (const match of html.matchAll(imagePattern)) {
    if (match[1].startsWith('data:')) continue;
    try {
      const url = new URL(match[1], pageUrl);
      if ((url.protocol !== 'http:' && url.protocol !== 'https:') || images.includes(url.href)) continue;
      images.push(url.href);
      if (images.length >= 8) break;
    } catch {
      // Ignore malformed image URLs.
    }
  }
  return images;
}

function extractBody(html: string) {
  const block = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    || html.match(/<div\b[^>]*(?:class|id)=["'][^"']*(?:article|post|content|entry)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || '';
  return textContent(block.replace(/<(script|style|noscript|nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')).slice(0, 16_000);
}

async function enrichItems(items: CrawlItem[]) {
  return Promise.all(items.map(async (item) => {
    try {
      const detail = await fetchHtml(item.url);
      const body = extractBody(detail);
      const images = extractImages(detail, item.url);
      return {
        ...item,
        title: meta(detail, 'og:title') || item.title,
        description: item.description || meta(detail, 'og:description') || '',
        body: body || item.description || '',
        image: extractImage(detail, item.url),
        images,
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
    const title = meta(html, 'og:title') || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || source.name;
    const description = meta(html, 'og:description') || meta(html, 'description') || '';
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || source.url;
    const feedHref = html.match(/<link[^>]+type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
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
          const items = extractLinks(page, url, crawlPath.path, crawlPath.category);
          return { category: crawlPath.category, label: crawlPath.label, url, items: await enrichItems(items) };
        } catch {
          return { category: crawlPath.category, label: crawlPath.label, url: new URL(crawlPath.path, source.url).href, items: [] as CrawlItem[] };
        }
      }))
      : [];
    return Response.json({
      sourceId: source.id,
      sourceName: source.name,
      region: source.region,
      url: canonical,
      title: clean(title).slice(0, 240),
      description: clean(description).slice(0, 600),
      items,
      sections,
      fetchedAt: new Date().toISOString(),
      verified: source.trust === 'official' || source.trust === 'verified',
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '출처를 확인하지 못했습니다.' }, { status: 502 });
  }
}
