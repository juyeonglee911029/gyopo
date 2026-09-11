const firebaseProjectId = 'gyopo-live-portal-506019';

type IdTokenPayload = { sub?: string };

export type PaddleTransaction = {
  id?: string;
  status?: string;
  currency_code?: string;
  custom_data?: Record<string, unknown> | null;
  details?: { totals?: { grand_total?: string | number } };
  checkout?: { url?: string | null };
};

function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return atob(normalized);
}

function readUserId(token: string): string | null {
  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1] || '')) as IdTokenPayload;
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function requirePaddleUser(request: Request): Promise<{ userId: string; token: string }> {
  const value = request.headers.get('authorization') || '';
  const token = value.startsWith('Bearer ') ? value.slice(7).trim() : '';
  const userId = token ? readUserId(token) : null;
  if (!token || !userId) throw new Error('로그인 세션이 필요합니다.');
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents/profiles/${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('로그인 프로필을 확인하지 못했습니다.');
  return { userId, token };
}

export async function paddleRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error('PADDLE_API_KEY 설정이 필요합니다.');
  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${apiKey}`);
  headers.set('content-type', 'application/json');
  headers.set('paddle-version', '1');
  return fetch(`https://api.paddle.com${path}`, { ...options, headers });
}

export function amountFromTransaction(transaction: PaddleTransaction): number {
  const customAmount = Number(transaction.custom_data?.amountUsd);
  if (Number.isFinite(customAmount) && customAmount > 0) return Math.round(customAmount * 100) / 100;
  const total = Number(transaction.details?.totals?.grand_total);
  return Number.isFinite(total) && total > 0 ? Math.round((total / 100) * 100) / 100 : 0;
}

export function compareHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

export async function verifyPaddleSignature(rawBody: string, header: string | null): Promise<boolean> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const fields = Object.fromEntries(header.split(';').map((part) => {
    const [key, value] = part.split('=');
    return [key, value];
  }));
  const timestamp = fields.ts;
  const provided = fields.h1;
  if (!timestamp || !provided) return false;
  const age = Math.abs(Date.now() - Number(timestamp) * 1_000);
  if (!Number.isFinite(age) || age > 5 * 60 * 1_000) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}:${rawBody}`));
  const expected = Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return compareHex(expected, provided);
}
