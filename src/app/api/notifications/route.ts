import { listAdminDocuments } from '@/lib/firebaseAdmin';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type PostData = {
  title?: unknown;
  type?: unknown;
  createdAt?: unknown;
  country?: unknown;
  sourceName?: unknown;
};

function postTime(item: { data: PostData; updatedAt?: string }) {
  const value = typeof item.data.createdAt === 'string' ? item.data.createdAt : item.updatedAt || '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export async function GET(request: Request) {
  const since = Number(new URL(request.url).searchParams.get('since') || 0);
  try {
    const posts = (await listAdminDocuments('posts'))
      .map((item) => ({
        id: item.id,
        title: typeof item.data.title === 'string' && item.data.title ? item.data.title : '새로운 게시글',
        type: typeof item.data.type === 'string' ? item.data.type : 'general',
        country: typeof item.data.country === 'string' ? item.data.country : 'Global',
        sourceName: typeof item.data.sourceName === 'string' ? item.data.sourceName : '',
        createdAt: typeof item.data.createdAt === 'string' ? item.data.createdAt : item.updatedAt || new Date(0).toISOString(),
        timestamp: postTime(item),
      }))
      .filter((item) => item.timestamp > 0)
      .sort((a, b) => b.timestamp - a.timestamp);
    const latestAt = posts[0]?.timestamp || 0;
    const unreadCount = Number.isFinite(since) && since > 0 ? posts.filter((item) => item.timestamp > since).length : 0;
    return Response.json({
      latestAt,
      unreadCount: Math.min(unreadCount, 99),
      items: posts.slice(0, 8).map(({ timestamp, ...item }) => ({ ...item, href: `/community/${item.id}` })),
    }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: '새 게시글 알림을 불러오지 못했습니다.' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
