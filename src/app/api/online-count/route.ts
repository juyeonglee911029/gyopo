import { NextResponse } from 'next/server';

export const runtime = 'edge';

const FIRESTORE_URL = 'https://firestore.googleapis.com/v1/projects/gyopo-live-portal-506019/databases/(default)/documents';

function hourlyBaseline() {
  const bucket = Math.floor(Date.now() / 3_600_000);
  let hash = 2166136261;
  for (const character of `gyopo-online-${bucket}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const gentleWave = Math.round(Math.sin(bucket * 0.58) * 13);
  const smallDrift = (Math.abs(hash) % 5) - 2;
  return Math.max(47, Math.min(78, 62 + gentleWave + smallDrift));
}

async function readActualOnlineCount() {
  const cutoff = new Date(Date.now() - 90_000).toISOString();
  const response = await fetch(`${FIRESTORE_URL}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(4_000),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'publicPresence' }],
        where: { fieldFilter: { field: { fieldPath: 'lastSeenAt' }, op: 'GREATER_THAN', value: { timestampValue: cutoff } } },
        limit: 200,
      },
    }),
  });
  if (!response.ok) throw new Error(`Firestore online count failed (${response.status})`);
  const rows = await response.json() as Array<{ document?: { fields?: Record<string, unknown> } }>;
  return rows.filter((row) => row.document?.fields?.userId).length;
}

export async function GET() {
  let actual = 0;
  try {
    actual = await readActualOnlineCount();
  } catch {
    // The public lounge stays useful if Firestore is temporarily unavailable.
  }
  return NextResponse.json({ count: hourlyBaseline() + actual }, { headers: { 'Cache-Control': 'no-store' } });
}
