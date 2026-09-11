export const runtime = 'edge';

type GuardAction = 'match' | 'message' | 'report' | 'block';
type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();
const limits: Record<GuardAction, { count: number; windowMs: number }> = {
  match: { count: 3, windowMs: 5 * 60_000 },
  message: { count: 20, windowMs: 60_000 },
  report: { count: 10, windowMs: 60 * 60_000 },
  block: { count: 30, windowMs: 60 * 60_000 },
};

function clientAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { action?: GuardAction; automated?: boolean; turnstileToken?: string } | null;
  const action = body?.action;
  if (!action || !limits[action]) return Response.json({ error: '보안 요청 종류가 올바르지 않습니다.' }, { status: 400 });
  if (body?.automated) return Response.json({ error: '자동화된 접속은 화상채팅을 사용할 수 없습니다.' }, { status: 403 });

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!body?.turnstileToken) return Response.json({ error: '추가 보안 확인이 필요합니다.', turnstileRequired: true }, { status: 403 });
    const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: turnstileSecret, response: body.turnstileToken, remoteip: clientAddress(request) }),
    }).then((response) => response.json() as Promise<{ success?: boolean }>).catch(() => ({ success: false }));
    if (!verification.success) return Response.json({ error: '보안 확인에 실패했습니다.' }, { status: 403 });
  }

  const { count, windowMs } = limits[action];
  const key = `${clientAddress(request)}:${action}`;
  const now = Date.now();
  const bucket = buckets.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < windowMs);
  if (bucket.timestamps.length >= count) {
    const retryAfterMs = Math.max(windowMs - (now - bucket.timestamps[0]), 1_000);
    buckets.set(key, bucket);
    return Response.json({ error: '잠시 후 다시 시도해주세요.', retryAfterMs }, { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1_000)) } });
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return Response.json({ allowed: true, captchaConfigured: Boolean(turnstileSecret) });
}
