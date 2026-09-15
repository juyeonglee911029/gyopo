import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('GYOPO 환불 정책', 'GYOPO 서비스 잔액과 결제 관련 환불 기준 및 문의 방법을 확인하세요.', '/refund');

export default function RefundPage() {
  return <article className="category-page container mx-auto max-w-3xl px-4 py-12 text-slate-100">
    <header className="category-header"><div className="category-heading">
      <p className="text-xs font-black uppercase tracking-[.24em] text-amber-300">Refund Policy</p>
      <h1 className="mt-3 text-3xl font-black">환불 정책</h1>
      <p className="mt-4 text-sm leading-7 text-slate-400">GYOPO 서비스 잔액과 카드 결제의 환불 기준입니다.</p>
    </div></header>
    <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
      <section><h2 className="text-lg font-black text-white">1. 환불 요청</h2><p className="mt-2">결제 중복, 결제 오류, 승인되지 않은 결제 또는 사용하지 않은 서비스 잔액에 대한 환불을 요청할 수 있습니다. 환불 요청은 <Link href="/help" className="text-cyan-200 underline underline-offset-4">고객센터</Link>를 통해 접수해주세요.</p></section>
      <section><h2 className="text-lg font-black text-white">2. 환불 검토</h2><p className="mt-2">GYOPO는 결제 기록과 서비스 잔액 사용 여부를 확인한 뒤 환불 가능 여부를 안내합니다. 이미 사용된 잔액이나 법률상 환불이 제한되는 경우에는 환불이 거절될 수 있습니다.</p></section>
      <section><h2 className="text-lg font-black text-white">3. 환불 처리</h2><p className="mt-2">승인된 환불은 원래 결제 수단으로 처리합니다. 카드사와 결제 처리사의 반영 시점에 따라 실제 입금까지 시간이 달라질 수 있습니다.</p></section>
      <section><h2 className="text-lg font-black text-white">4. Paddle 결제</h2><p className="mt-2">카드 결제와 환불 처리는 Paddle의 결제 서비스 및 관련 약관의 적용을 받을 수 있습니다. 결제 완료 후 받은 영수증이나 거래 번호를 함께 제출하면 확인이 빠릅니다.</p></section>
      <nav className="flex flex-wrap gap-4 border-t border-white/10 pt-5 text-cyan-200" aria-label="결제 정책">
        <Link href="/pricing" className="underline underline-offset-4">가격 안내</Link>
        <Link href="/terms" className="underline underline-offset-4">이용약관</Link>
        <Link href="/privacy" className="underline underline-offset-4">개인정보처리방침</Link>
      </nav>
    </div>
  </article>;
}
