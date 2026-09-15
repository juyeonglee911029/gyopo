import { requireMasterUser, unauthorizedResponse } from '@/lib/apiSecurity';
import { listAdminJsonDocuments } from '@/lib/firebaseAdmin';

export const runtime = 'edge';

type SearchEvent = {
  query?: unknown;
  normalizedQuery?: unknown;
  mode?: unknown;
  country?: unknown;
  audience?: unknown;
  destination?: unknown;
  createdAt?: unknown;
};

export async function GET(request: Request) {
  try {
    await requireMasterUser(request);
  } catch (error) {
    return unauthorizedResponse(error);
  }

  const daysParam = Number(new URL(request.url).searchParams.get('days') || 30);
  const days = [7, 15, 30, 60, 90].includes(daysParam) ? daysParam : 30;
  const cutoff = Date.now() - days * 24 * 60 * 60_000;

  try {
    const events = await listAdminJsonDocuments('searchEvents');
    const groups = new Map<string, { query: string; count: number; ai: number; portal: number; countries: Map<string, number>; audiences: Map<string, number>; destinations: Map<string, number>; lastSearchedAt: string }>();
    let included = 0;
    for (const item of events) {
      const event = item.data as SearchEvent;
      const createdAt = typeof event.createdAt === 'string' ? event.createdAt : item.updatedAt || '';
      const timestamp = Date.parse(createdAt);
      if (!Number.isFinite(timestamp) || timestamp < cutoff) continue;
      const normalized = typeof event.normalizedQuery === 'string' ? event.normalizedQuery : typeof event.query === 'string' ? event.query.toLocaleLowerCase('ko-KR') : '';
      const query = typeof event.query === 'string' ? event.query.trim() : '';
      if (!normalized || !query) continue;
      included += 1;
      const row = groups.get(normalized) || { query, count: 0, ai: 0, portal: 0, countries: new Map(), audiences: new Map(), destinations: new Map(), lastSearchedAt: createdAt };
      row.count += 1;
      if (event.mode === 'AI') row.ai += 1;
      if (event.mode === 'PORTAL') row.portal += 1;
      const country = typeof event.country === 'string' && event.country ? event.country : 'Global';
      const audience = typeof event.audience === 'string' && event.audience ? event.audience : 'guest';
      const destination = typeof event.destination === 'string' && event.destination ? event.destination : '/assistant';
      row.countries.set(country, (row.countries.get(country) || 0) + 1);
      row.audiences.set(audience, (row.audiences.get(audience) || 0) + 1);
      row.destinations.set(destination, (row.destinations.get(destination) || 0) + 1);
      if (Date.parse(createdAt) > Date.parse(row.lastSearchedAt)) row.lastSearchedAt = createdAt;
      groups.set(normalized, row);
    }

    const rows = [...groups.values()].map((row) => ({
      query: row.query,
      count: row.count,
      ai: row.ai,
      portal: row.portal,
      countries: [...row.countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value, count })),
      audiences: [...row.audiences.entries()].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })),
      destinations: [...row.destinations.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value, count })),
      lastSearchedAt: row.lastSearchedAt,
    })).sort((a, b) => b.count - a.count || b.lastSearchedAt.localeCompare(a.lastSearchedAt)).slice(0, 100);

    return Response.json({ days, total: included, rows });
  } catch {
    return Response.json({ error: '검색 분석 데이터를 불러오지 못했습니다.' }, { status: 503 });
  }
}
