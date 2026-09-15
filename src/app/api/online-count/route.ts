import { NextResponse } from 'next/server';

export const runtime = 'edge';

const FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/gyopo-live-portal-506019/databases/(default)/documents';

async function readActualOnlineCount() {
  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const response = await fetch(`${FIRESTORE_URL}:runAggregationQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(4_000),
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: {
          from: [{ collectionId: 'publicPresence' }],
          where: { fieldFilter: { field: { fieldPath: 'lastSeenAt' }, op: 'GREATER_THAN', value: { timestampValue: cutoff } } },
        },
        aggregations: [{ count: {}, alias: 'online' }],
      },
    }),
  });
  if (!response.ok) throw new Error(`Firestore online count failed (${response.status})`);
  const rows = await response.json() as Array<{ result?: { aggregateFields?: { online?: { integerValue?: string } } } }>;
  const value = rows.find((row) => row.result?.aggregateFields?.online)?.result?.aggregateFields?.online?.integerValue;
  const count = value === undefined ? NaN : Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid online count');
  return count;
}

export async function GET() {
  try {
    const count = await readActualOnlineCount();
    return NextResponse.json({ count }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ count: null, error: 'Online count unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
