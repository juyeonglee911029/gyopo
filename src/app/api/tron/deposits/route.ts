import { MASTER_DEPOSIT_ADDRESS } from '@/lib/firebase';

export const runtime = 'edge';

const TRONSCAN_API = process.env.TRONGRID_API_URL || 'https://api.trongrid.io';
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const USDT_DECIMALS = 6;

function isTronAddress(value: string) {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const address = params.get('address') || MASTER_DEPOSIT_ADDRESS;
  const limit = Math.min(200, Math.max(1, Number(params.get('limit') || 50)));
  if (!isTronAddress(address)) return Response.json({ error: '올바른 TRON 주소가 아닙니다.' }, { status: 400 });

  const response = await fetch(`${TRONSCAN_API}/v1/accounts/${address}/transactions/trc20?only_confirmed=true&limit=${limit}&order_by=block_timestamp,desc&contract_address=${USDT_CONTRACT}`, {
    headers: {
      Accept: 'application/json',
      ...(process.env.TRONGRID_API_KEY ? { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY } : {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) return Response.json({ error: `TRON 입금 내역 조회 실패 (${response.status})` }, { status: 502 });

  const payload = await response.json() as { data?: Array<{ transaction_id?: string; from?: string; to?: string; value?: string; block_timestamp?: number; token_info?: { address?: string; symbol?: string; decimals?: number } }> };
  const deposits = (payload.data || [])
    .filter((item) => item.token_info?.address === USDT_CONTRACT && item.to?.toLowerCase() === address.toLowerCase())
    .map((item) => ({
      txHash: item.transaction_id || '',
      from: item.from || '',
      to: item.to || address,
      amount: Number(item.value || 0) / (10 ** (item.token_info?.decimals || USDT_DECIMALS)),
      blockTimestamp: item.block_timestamp || 0,
      network: 'TRC20',
      symbol: 'USDT',
    }))
    .filter((item) => item.txHash && item.from && item.amount > 0);

  return Response.json({ address, contract: USDT_CONTRACT, deposits, syncedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
