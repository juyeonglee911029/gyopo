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
    <footer className="bg-gray-50 border-t border-gray-200 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-xl font-black text-gray-800 mb-4">K-Global Portal</h3>
            <p className="text-gray-500 text-sm leading-relaxed max-w-sm">
              전 세계 한인 교민을 위한 정보 포털입니다. 구인/구직, 업소록, 장터, 커뮤니티를 한곳에서 만나보세요.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 mb-4">바로가기</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/community?category=notice" className="hover:text-blue-600 transition-colors">공지사항</Link></li>
              <li><Link href="/ads" className="hover:text-blue-600 transition-colors">광고 문의</Link></li>
              <li><Link href="/community?category=partnership" className="hover:text-blue-600 transition-colors">제휴 제안</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-gray-800 mb-4">고객지원</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><Link href="/terms" className="hover:text-blue-600 transition-colors">이용약관</Link></li>
              <li><Link href="/privacy" className="hover:text-blue-600 transition-colors">개인정보처리방침</Link></li>
              <li><Link href="/help" className="hover:text-blue-600 transition-colors">고객센터</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl bg-white border border-gray-200 p-3"><div className="text-[11px] text-gray-400 font-bold">오늘 방문</div><div className="text-lg font-black text-gray-800">{stats.today.toLocaleString()}</div></div>
          <div className="rounded-xl bg-white border border-gray-200 p-3"><div className="text-[11px] text-gray-400 font-bold">이번 달</div><div className="text-lg font-black text-gray-800">{stats.month.toLocaleString()}</div></div>
          <div className="rounded-xl bg-white border border-gray-200 p-3"><div className="text-[11px] text-gray-400 font-bold">누적 방문</div><div className="text-lg font-black text-gray-800">{stats.total.toLocaleString()}</div></div>
          <div className="rounded-xl bg-green-50 border border-green-100 p-3"><div className="text-[11px] text-green-600 font-bold">현재 접속</div><div className="text-lg font-black text-green-700">{onlineCount.toLocaleString()}</div></div>
        </div>
        <div className="border-t border-gray-200 mt-10 pt-8 text-center text-sm text-gray-400">
          &copy; 2026 K-Global Portal. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
