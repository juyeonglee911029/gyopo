import { clientAddress, consumeRateLimit, rateLimitResponse } from '@/lib/apiSecurity';
import { upsertAdminJsonDocument } from '@/lib/firebaseAdmin';

export const runtime = 'edge';

const EVENTS = new Set(['page_view', 'login_view', 'onboarding_completed', 'search_submit']);
const AUDIENCES = new Set(['guest', 'member', 'master']);

export async function POST(request: Request) {
  const rate = consumeRateLimit(`growth-event:${clientAddress(request)}`, 120, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterMs);
  const rawBody = await request.text().catch(() => '');
  if (rawBody.length > 10_000) return Response.json({ error: '성장 이벤트 데이터가 너무 큽니다.' }, { status: 413 });

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody || '{}') as Record<string, unknown>; } catch { return Response.json({ error: '성장 이벤트 형식이 올바르지 않습니다.' }, { status: 400 }); }
  const event = typeof body.event === 'string' && EVENTS.has(body.event) ? body.event : '';
  if (!event) return Response.json({ error: '허용되지 않은 성장 이벤트입니다.' }, { status: 400 });

  const campaigns = body.campaigns && typeof body.campaigns === 'object' ? body.campaigns as Record<string, unknown> : {};
  const details = body.details && typeof body.details === 'object' ? body.details as Record<string, unknown> : {};
  const cleanRecord = (value: Record<string, unknown>, limit: number) => Object.fromEntries(Object.entries(value).slice(0, 12).map(([key, item]) => [key.slice(0, 40), typeof item === 'string' ? item.slice(0, limit) : typeof item === 'number' || typeof item === 'boolean' ? item : undefined]).filter(([, item]) => item !== undefined));
  const record = {
    event,
    path: typeof body.path === 'string' ? body.path.slice(0, 160) : '',
    country: typeof body.country === 'string' ? body.country.slice(0, 80) : 'Global',
    audience: typeof body.audience === 'string' && AUDIENCES.has(body.audience) ? body.audience : 'guest',
    visitorId: typeof body.visitorId === 'string' ? body.visitorId.slice(0, 80) : '',
    sessionId: typeof body.sessionId === 'string' ? body.sessionId.slice(0, 80) : '',
    locale: typeof body.locale === 'string' ? body.locale.slice(0, 32) : '',
    device: typeof body.device === 'string' ? body.device.slice(0, 16) : '',
    referrer: typeof body.referrer === 'string' ? body.referrer.slice(0, 120) : '',
    campaigns: cleanRecord(campaigns, 120),
    details: cleanRecord(details, 120),
    createdAt: new Date().toISOString(),
  };
  try { await upsertAdminJsonDocument('growthEvents', crypto.randomUUID(), record); return Response.json({ ok: true }, { status: 202 }); } catch { return Response.json({ error: '성장 이벤트를 저장하지 못했습니다.' }, { status: 503 }); }
}
