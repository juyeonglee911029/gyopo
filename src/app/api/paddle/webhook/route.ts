import { creditUsdBalance } from '@/lib/firebaseAdmin';
import { amountFromTransaction, verifyPaddleSignature, type PaddleTransaction } from '@/lib/paddle';

export const runtime = 'edge';

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyPaddleSignature(rawBody, request.headers.get('paddle-signature')))) return Response.json({ error: '서명 검증에 실패했습니다.' }, { status: 401 });
  const event = JSON.parse(rawBody) as { event_type?: string; data?: PaddleTransaction };
  if (!['transaction.paid', 'transaction.completed'].includes(event.event_type || '')) return Response.json({ received: true, ignored: true });
  const transaction = event.data;
  const userId = typeof transaction?.custom_data?.userId === 'string' ? transaction.custom_data.userId : '';
  const transactionId = transaction?.id || '';
  if (!transaction || !userId || !transactionId || transaction.currency_code !== 'USD') return Response.json({ error: '결제 데이터가 올바르지 않습니다.' }, { status: 400 });
  const result = await creditUsdBalance({ userId, transactionId, amountUsd: amountFromTransaction(transaction), currencyCode: transaction.currency_code });
  return Response.json({ received: true, ...result });
}
