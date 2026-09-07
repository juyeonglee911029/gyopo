import { CONTENT_SOURCES } from '@/lib/contentSources';

export const runtime = 'edge';

function clean(value: string | undefined) {
  return (value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function meta(html: string, key: string) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  return clean(html.match(pattern)?.[1] || html.match(reverse)?.[1]);
}

function tag(block: string, name: string) {
  return clean(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]);
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('source');
  const source = CONTENT_SOURCES.find((item) => item.id === id);
  if (!source) return Response.json({ error: '등록되지 않은 출처입니다.' }, { status: 404 });

  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'GYOPO-Content-Preview/1.0 (+https://gyopo.pages.dev)' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return Response.json({ error: `출처 응답 ${response.status}` }, { status: 502 });
    const html = await response.text();
    const title = meta(html, 'og:title') || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || source.name;
    const description = meta(html, 'og:description') || meta(html, 'description') || '';
    const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] || source.url;
    const feedHref = html.match(/<link[^>]+type=["']application\/(?:rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];
    let items: Array<{ title: string; url: string; description: string; publishedAt?: string }> = [];
    if (feedHref) {
      const feedResponse = await fetch(new URL(feedHref, source.url), { headers: { 'User-Agent': 'GYOPO-Content-Preview/1.0' }, signal: AbortSignal.timeout(8_000) }).catch(() => null);
      if (feedResponse?.ok) {
        const feed = await feedResponse.text();
        const blocks = feed.match(/<item[\s>][\s\S]*?<\/item>/gi) || feed.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
        items = blocks.slice(0, 8).map((block) => ({
          title: tag(block, 'title'),
          url: tag(block, 'link') || block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || canonical,
          description: tag(block, 'description') || tag(block, 'summary'),
          publishedAt: tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || undefined,
        })).filter((item) => item.title);
      }
    }
    return Response.json({
      sourceId: source.id,
      sourceName: source.name,
      region: source.region,
      url: canonical,
      title: clean(title).slice(0, 240),
      description: clean(description).slice(0, 600),
      items,
      fetchedAt: new Date().toISOString(),
      verified: source.trust === 'official' || source.trust === 'verified',
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '출처를 확인하지 못했습니다.' }, { status: 502 });
  }
}
