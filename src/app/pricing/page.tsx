import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('GYOPO 서비스 가격 안내', 'GYOPO 서비스 잔액 충전 금액, 결제 방식과 환불 기준을 확인하세요.', '/pricing');

export default function PricingPage() {
  return <article className="category-page container mx-auto max-w-3xl px-4 py-12 text-slate-100">
    <header className="category-header"><div className="category-heading">
      <p className="text-xs font-black uppercase tracking-[.24em] text-cyan-300">Service Pricing</p>
      <h1 className="mt-3 text-3xl font-black">서비스 잔액 충전</h1>
      <p className="mt-4 text-sm leading-7 text-slate-400">GYOPO 안에서 사용할 서비스 잔액을 필요한 만큼 한 번 충전할 수 있습니다.</p>
    </div></header>
    <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
      <section className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
        <h2 className="text-lg font-black text-white">충전 금액</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {['$1', '$5', '$10', '$25'].map((amount) => <div key={amount} className="border border-cyan-300/20 bg-cyan-300/5 p-4 text-center text-xl font-black text-cyan-200">{amount}</div>)}
        </div>
        <p className="mt-4">직접 입력할 수 있는 금액은 <strong className="text-white">$0.10 이상 $1,000 이하</strong>입니다. 결제 전 최종 금액과 결제 조건이 표시됩니다.</p>
      </section>
      <section>
        <h2 className="text-lg font-black text-white">결제 방식</h2>
        <p className="mt-2">카드 결제는 Paddle의 보안 결제창에서 처리됩니다. 결제가 승인된 금액만 GYOPO 서비스 잔액에 반영되며, 결제가 완료되기 전에는 잔액이 변경되지 않습니다.</p>
      </section>
      <section>
        <h2 className="text-lg font-black text-white">충전하기</h2>
        <p className="mt-2"><Link href="/wallet" className="font-black text-cyan-200 underline underline-offset-4">로그인 후 지갑으로 이동</Link>하면 잔액을 충전하고 거래 기록을 확인할 수 있습니다.</p>
      </section>
      <nav className="flex flex-wrap gap-4 border-t border-white/10 pt-5 text-cyan-200" aria-label="결제 정책">
        <Link href="/terms" className="underline underline-offset-4">이용약관</Link>
        <Link href="/privacy" className="underline underline-offset-4">개인정보처리방침</Link>
        <Link href="/refund" className="underline underline-offset-4">환불 정책</Link>
      </nav>
    </div>
  </article>;
}
