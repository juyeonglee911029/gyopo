import { creditUsdBalance } from '@/lib/firebaseAdmin';
import { amountFromTransaction, paddleRequest, requirePaddleUser, type PaddleTransaction } from '@/lib/paddle';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const { userId } = await requirePaddleUser(request);
    const body = await request.json().catch(() => null) as { transactionId?: string } | null;
    const transactionId = body?.transactionId?.trim() || '';
    if (!/^txn_[a-z\d]{20,}$/i.test(transactionId)) return Response.json({ error: '결제 번호가 올바르지 않습니다.' }, { status: 400 });
    const response = await paddleRequest(`/transactions/${encodeURIComponent(transactionId)}`);
    const result = await response.json() as { data?: PaddleTransaction; error?: { detail?: string; message?: string } };
    if (!response.ok || !result.data) return Response.json({ error: result.error?.detail || result.error?.message || 'Paddle 결제를 확인하지 못했습니다.' }, { status: 502 });
    const transaction = result.data;
    if (!['paid', 'completed'].includes(transaction.status || '')) return Response.json({ status: transaction.status || 'pending', credited: false }, { status: 202 });
    if (transaction.currency_code !== 'USD' || transaction.custom_data?.userId !== userId) return Response.json({ error: '결제 회원 또는 통화가 일치하지 않습니다.' }, { status: 403 });
    const amountUsd = amountFromTransaction(transaction);
    const credited = await creditUsdBalance({ userId, transactionId, amountUsd, currencyCode: transaction.currency_code });
    return Response.json({ status: 'completed', credited: true, ...credited });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '결제 금액 반영에 실패했습니다.' }, { status: 500 });
  }
}
