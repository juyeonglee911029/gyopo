'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="mt-5 bg-[#060a14]/52 text-white">
      <div className="container mx-auto px-4 py-2.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div><div className="text-[9px] font-black uppercase tracking-[.28em] text-cyan-300">Global gaming community</div><div className="mt-0.5 text-lg font-black tracking-tight">GYOPO NETWORK</div></div>
          <div className="flex gap-1.5 text-[9px] font-black"><Link href="/games" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1.5 text-cyan-200">LIVE ARENA</Link><Link href="/community" className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300">COMMUNITY</Link><Link href="/music" className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1.5 text-violet-200">K-POP RADIO</Link></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
          <p className="text-[10px] text-slate-500">게임, 라이브 채팅, 음악으로 연결되는 글로벌 교민 네트워크</p>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-500" aria-label="푸터 메뉴">
            <Link href="/community?category=notice" className="transition-colors hover:text-cyan-200">공지사항</Link>
            <Link href="/ads" className="transition-colors hover:text-cyan-200">광고 문의</Link>
            <Link href="/terms" className="transition-colors hover:text-cyan-200">이용약관</Link>
            <Link href="/privacy" className="transition-colors hover:text-cyan-200">개인정보처리방침</Link>
            <Link href="/help" className="transition-colors hover:text-cyan-200">고객센터</Link>
          </nav>
        </div>
        <div className="pt-2 text-center text-[9px] font-bold tracking-wider text-slate-600">
          &copy; 2026 GYOPO GLOBAL NETWORK. ALL RIGHTS RESERVED.
        </div>
      </div>
    </footer>
  );
}
