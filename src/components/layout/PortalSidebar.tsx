'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BriefcaseBusiness, Film, Gamepad2, Globe2, Home, MessageCircle, Newspaper, ShoppingBag, Sparkles, Store, Users, Video } from 'lucide-react';

const primaryLinks = [
  { href: '/', label: '홈', icon: Home },
  { href: '/news', label: '오늘의 뉴스', icon: Newspaper },
  { href: '/jobs', label: '구인구직', icon: BriefcaseBusiness },
  { href: '/directory', label: '업소록', icon: Store },
  { href: '/market', label: '장터', icon: ShoppingBag },
  { href: '/community', label: '커뮤니티', icon: MessageCircle },
];

const utilityLinks = [
  { href: '/users', label: '유저 목록', icon: Users },
  { href: '/games', label: '테트리스', icon: Gamepad2 },
  { href: '/webrtc', label: '화상채팅', icon: Video },
  { href: '/theater', label: '극장', icon: Film },
  { href: '/assistant', label: 'AI 검색', icon: Sparkles },
];

function LinkRow({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof Home; active: boolean }) {
  return (
    <Link href={href} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? 'bg-teal-300 text-slate-950 shadow-[0_8px_24px_rgba(45,212,191,.16)]' : 'text-slate-400 hover:bg-white/7 hover:text-white'}`}>
      <Icon size={17} className={active ? 'text-slate-950' : 'text-slate-500 transition group-hover:text-teal-300'} />
      <span>{label}</span>
    </Link>
  );
}

export default function PortalSidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/10 bg-[#090f1d]/95 pt-24 shadow-[20px_0_60px_rgba(0,0,0,.12)] backdrop-blur-xl lg:flex">
       <div className="border-b border-white/8 px-4 py-4">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.24em] text-slate-500"><Globe2 size={14} className="text-teal-300" /> 지역 허브</div>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-teal-300/15 bg-teal-300/[.06] px-3 py-2.5">
          <span className="text-lg">🌐</span>
          <div><p className="text-sm font-black text-white">전체 지역</p><p className="mt-0.5 text-[10px] text-slate-500">국가 태그로 출처를 구분합니다</p></div>
        </div>
      </div>

       <nav className="flex-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[.2em] text-slate-600">둘러보기</p>
        <div className="space-y-1">
          {primaryLinks.map((link) => <LinkRow key={link.href} {...link} active={link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)} />)}
        </div>
        <p className="mb-2 mt-7 px-3 text-[10px] font-black uppercase tracking-[.2em] text-slate-600">더 보기</p>
        <div className="space-y-1">
          {utilityLinks.map((link) => <LinkRow key={link.href} {...link} active={pathname.startsWith(link.href)} />)}
        </div>
      </nav>

      <div className="border-t border-white/8 p-4">
         <div className="rounded-2xl border border-teal-300/15 bg-gradient-to-br from-teal-300/[.10] to-cyan-300/[.03] p-3 shadow-[0_0_30px_rgba(45,212,191,.05)]">
          <p className="text-xs font-black text-teal-200">실시간 글로벌 라운지</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">오른쪽 패널에서 다른 교민들과 바로 대화하세요.</p>
        </div>
      </div>
    </aside>
  );
}
