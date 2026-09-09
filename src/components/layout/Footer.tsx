'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getOnlineCount, getSiteStats, SiteStats } from '@/lib/firebase';

const emptyStats: SiteStats = { today: 0, month: 0, total: 0 };

export default function Footer() {
  const [stats, setStats] = useState(emptyStats);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [nextStats, nextOnlineCount] = await Promise.all([getSiteStats(), getOnlineCount()]);
        setStats(nextStats);
        setOnlineCount(nextOnlineCount);
      } catch {
        // Statistics are non-critical and may be unavailable during first setup.
      }
    };
    void load();
    const interval = window.setInterval(load, 30000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <footer className="mt-16 border-t border-cyan-300/10 bg-[#060a14] text-white">
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-6">
          <div><div className="text-[10px] font-black uppercase tracking-[.3em] text-cyan-300">Global gaming community</div><div className="mt-1 text-2xl font-black tracking-tight">GYOPO NETWORK</div></div>
          <div className="flex gap-2 text-[10px] font-black"><Link href="/games" className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-cyan-200">LIVE ARENA</Link><Link href="/community" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-slate-300">COMMUNITY</Link><Link href="/music" className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-2 text-violet-200">K-POP RADIO</Link></div>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="col-span-1 md:col-span-2">
            <h3 className="mb-3 text-lg font-black">PLAY · CONNECT · BELONG</h3>
            <p className="max-w-md text-sm leading-6 text-slate-500">
              전 세계 한인이 게임, 라이브 채팅, 음악과 지역 정보를 함께 나누는 글로벌 커뮤니티입니다.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-black uppercase tracking-[.2em] text-slate-300">Network</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="/community?category=notice" className="transition-colors hover:text-cyan-200">공지사항</Link></li>
              <li><Link href="/ads" className="transition-colors hover:text-cyan-200">광고 문의</Link></li>
              <li><Link href="/community?category=partnership" className="transition-colors hover:text-cyan-200">제휴 제안</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-xs font-black uppercase tracking-[.2em] text-slate-300">Support</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><Link href="/terms" className="transition-colors hover:text-cyan-200">이용약관</Link></li>
              <li><Link href="/privacy" className="transition-colors hover:text-cyan-200">개인정보처리방침</Link></li>
              <li><Link href="/help" className="transition-colors hover:text-cyan-200">고객센터</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          {[['오늘 방문', stats.today], ['이번 달', stats.month], ['누적 방문', stats.total], ['현재 접속', onlineCount]].map(([label, value], index) => <div key={String(label)} className={`rounded-xl border p-3 ${index === 3 ? 'border-emerald-300/20 bg-emerald-300/[.07]' : 'border-white/10 bg-white/[.03]'}`}><div className="text-[10px] font-bold text-slate-500">{label}</div><div className={`text-lg font-black ${index === 3 ? 'text-emerald-300' : 'text-white'}`}>{Number(value).toLocaleString()}</div></div>)}
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-[11px] font-bold tracking-wider text-slate-600">
          &copy; 2026 GYOPO GLOBAL NETWORK. ALL RIGHTS RESERVED.
        </div>
      </div>
    </footer>
  );
}
