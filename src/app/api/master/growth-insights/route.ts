import { requireMasterUser, unauthorizedResponse } from '@/lib/apiSecurity';
import { listAdminJsonDocuments } from '@/lib/firebaseAdmin';

export const runtime = 'edge';

type GrowthEvent = {
  event?: unknown;
  path?: unknown;
  country?: unknown;
  visitorId?: unknown;
  sessionId?: unknown;
  campaigns?: unknown;
  createdAt?: unknown;
};

function addCount(map: Map<string, number>, value: unknown) {
  if (typeof value !== 'string' || !value) return;
  map.set(value, (map.get(value) || 0) + 1);
}

function topRows(map: Map<string, number>, limit = 10) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([value, count]) => ({ value, count }));
}

export async function GET(request: Request) {
  try { await requireMasterUser(request); } catch (error) { return unauthorizedResponse(error); }
  const daysParam = Number(new URL(request.url).searchParams.get('days') || 7);
  const days = [7, 15, 30, 60, 90].includes(daysParam) ? daysParam : 7;
  const cutoff = Date.now() - days * 24 * 60 * 60_000;
  try {
    const events = await listAdminJsonDocuments('growthEvents');
    const eventCounts = new Map<string, number>();
    const pathCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    const visitors = new Set<string>();
    const sessions = new Set<string>();
    let included = 0;
    for (const item of events) {
      const event = item.data as GrowthEvent;
      const createdAt = typeof event.createdAt === 'string' ? event.createdAt : item.updatedAt || '';
      if (!Number.isFinite(Date.parse(createdAt)) || Date.parse(createdAt) < cutoff) continue;
      included += 1;
      addCount(eventCounts, event.event);
      addCount(pathCounts, event.path);
      addCount(countryCounts, event.country);
      if (typeof event.visitorId === 'string' && event.visitorId) visitors.add(event.visitorId);
      if (typeof event.sessionId === 'string' && event.sessionId) sessions.add(event.sessionId);
      const campaigns = event.campaigns && typeof event.campaigns === 'object' ? event.campaigns as Record<string, unknown> : {};
      addCount(sourceCounts, campaigns.utm_source || campaigns.gclid ? String(campaigns.utm_source || 'google') : 'direct');
    }
    return Response.json({ days, total: included, uniqueVisitors: visitors.size, sessions: sessions.size, events: topRows(eventCounts), paths: topRows(pathCounts), countries: topRows(countryCounts), sources: topRows(sourceCounts) });
  } catch { return Response.json({ error: '성장 분석 데이터를 불러오지 못했습니다.' }, { status: 503 }); }
}
