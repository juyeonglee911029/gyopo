import { MASTER_DEPOSIT_ADDRESS } from '@/lib/firebase';
import { clientAddress, consumeRateLimit, rateLimitResponse, readProfileWalletAddress, requireAuthenticatedUser, unauthorizedResponse } from '@/lib/apiSecurity';

export const runtime = 'edge';

const TRONSCAN_API = process.env.TRONGRID_API_URL || 'https://api.trongrid.io';
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_DECIMALS = 6;

function isTronAddress(value: string) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
}

function headers() {
  return {
    Accept: 'application/json',
    ...(process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {}),
  };
}

export async function GET(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser(request);
  } catch (error) {
    return unauthorizedResponse(error);
  }
  const rate = consumeRateLimit(`tron-balance:${user.uid}:${clientAddress(request)}`, 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterMs);

  const requestedAddress = new URL(request.url).searchParams.get('address')?.trim() || '';
  const isMaster = user.email === 'juyeonglee911029@gmail.com';
  const ownerAddress = isMaster ? MASTER_DEPOSIT_ADDRESS : await readProfileWalletAddress(user);
  const address = requestedAddress || ownerAddress || '';
  if (!isMaster && (!ownerAddress || address.toLowerCase() !== ownerAddress.toLowerCase())) {
    return Response.json({ error: '등록된 본인 지갑만 조회할 수 있습니다.' }, { status: 403 });
  }
  if (!isTronAddress(address)) return Response.json({ error: '올바른 TRON 주소가 아닙니다.' }, { status: 400 });

  const response = await fetch(`${TRONSCAN_API}/v1/accounts/${address}?only_confirmed=true`, {
    headers: headers(),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return Response.json({ error: `TRON 잔고 조회 실패 (${response.status})` }, { status: 502 });

  const payload = await response.json() as { data?: Array<{ trc20?: Array<Record<string, string>> }> };
  const entries = payload.data?.[0]?.trc20 || [];
  const token = entries.find((entry) => Object.prototype.hasOwnProperty.call(entry, USDT_CONTRACT));
  const rawBalance = token?.[USDT_CONTRACT] || '0';
  if (!/^\d{1,30}$/.test(rawBalance)) return Response.json({ error: 'TRON 잔고 형식이 올바르지 않습니다.' }, { status: 502 });
  const balance = Number(rawBalance) / (10 ** USDT_DECIMALS);

  return Response.json({
    address,
    network: 'TRC20',
    symbol: 'USDT',
    contract: USDT_CONTRACT,
    balance: Number.isFinite(balance) ? balance : 0,
    rawBalance,
    decimals: USDT_DECIMALS,
    syncedAt: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
