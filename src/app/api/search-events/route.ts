import { clientAddress, consumeRateLimit, rateLimitResponse } from '@/lib/apiSecurity';
import { upsertAdminJsonDocument } from '@/lib/firebaseAdmin';

export const runtime = 'edge';

const MODES = new Set(['AI', 'PORTAL']);
const AUDIENCES = new Set(['guest', 'member', 'master']);

export async function POST(request: Request) {
  const rate = consumeRateLimit(`search-event:${clientAddress(request)}`, 60, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterMs);
  const rawBody = await request.text().catch(() => '');
  if (rawBody.length > 8_000) return Response.json({ error: '검색 기록 데이터가 너무 큽니다.' }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    return Response.json({ error: '검색 기록 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 160) : '';
  const mode = typeof body.mode === 'string' && MODES.has(body.mode) ? body.mode : '';
  if (!query || !mode) return Response.json({ error: '검색어와 검색 모드가 필요합니다.' }, { status: 400 });

  const audience = typeof body.audience === 'string' && AUDIENCES.has(body.audience) ? body.audience : 'guest';
  const event = {
    query,
    normalizedQuery: query.toLocaleLowerCase('ko-KR'),
    mode,
    destination: typeof body.destination === 'string' ? body.destination.slice(0, 160) : '',
    country: typeof body.country === 'string' ? body.country.slice(0, 80) : 'Global',
    audience,
    visitorId: typeof body.visitorId === 'string' ? body.visitorId.slice(0, 80) : '',
    locale: typeof body.locale === 'string' ? body.locale.slice(0, 32) : '',
    device: typeof body.device === 'string' ? body.device.slice(0, 16) : '',
    path: typeof body.path === 'string' ? body.path.slice(0, 160) : '',
    referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 120) : '',
    createdAt: new Date().toISOString(),
  };

  try {
    await upsertAdminJsonDocument('searchEvents', crypto.randomUUID(), event);
    return Response.json({ ok: true }, { status: 202 });
  } catch {
    return Response.json({ error: '검색 기록을 저장하지 못했습니다.' }, { status: 503 });
  }
}
