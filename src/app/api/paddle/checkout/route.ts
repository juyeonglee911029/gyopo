import { amountFromTransaction, paddleRequest, requirePaddleUser, type PaddleTransaction } from '@/lib/paddle';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { userId } = await requirePaddleUser(request);
    const body = await request.json().catch(() => null) as { amount?: number } | null;
    const amount = Math.round(Number(body?.amount || 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0.1 || amount > 1_000) {
      return Response.json({ error: '충전 금액은 $0.10 이상 $1,000 이하로 입력해주세요.' }, { status: 400 });
    }
    const origin = 'https://gyopo.pages.dev';
    const response = await paddleRequest('/transactions', {
      method: 'POST',
      body: JSON.stringify({
        items: [{
          quantity: 1,
          price: {
            description: 'GYOPO USD 서비스 잔액 충전',
            name: 'GYOPO USD Balance',
            billing_cycle: null,
            trial_period: null,
            tax_mode: 'account_setting',
            unit_price: { amount: String(Math.round(amount * 100)), currency_code: 'USD' },
            product: {
              name: 'GYOPO USD Balance',
              description: 'GYOPO 서비스 안에서 사용하는 USD 잔액입니다.',
              tax_category: 'digital-goods',
            },
          },
        }],
        currency_code: 'USD',
        collection_mode: 'automatic',
        custom_data: { userId, amountUsd: amount, kind: 'USD_BALANCE_TOPUP' },
        checkout: { url: `${origin}/wallet?payment=return` },
      }),
    });
    const result = await response.json() as { data?: PaddleTransaction; error?: { detail?: string; message?: string } };
    if (!response.ok || !result.data?.id || !result.data.checkout?.url) {
      return Response.json({ error: result.error?.detail || result.error?.message || 'Paddle 결제창을 만들지 못했습니다.' }, { status: 502 });
    }
    return Response.json({ transactionId: result.data.id, checkoutUrl: result.data.checkout.url, amountUsd: amountFromTransaction(result.data) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '결제 준비에 실패했습니다.' }, { status: 500 });
  }
}
