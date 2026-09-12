'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BriefcaseBusiness, Film, Gamepad2, Home, MessageCircle, Music2, Newspaper, ShoppingBag, Sparkles, Store, UserRoundCheck, Users, Video } from 'lucide-react';
import { useGlobalStore } from '@/store/useGlobalStore';

const primaryLinks = [
  { href: '/', label: '홈', english: 'Home', icon: Home },
  { href: '/news', label: '오늘의 뉴스', english: 'News', icon: Newspaper },
  { href: '/jobs', label: '구인구직', english: 'Jobs', icon: BriefcaseBusiness },
  { href: '/directory', label: '업소록', english: 'Directory', icon: Store },
  { href: '/market', label: '장터', english: 'Market', icon: ShoppingBag },
  { href: '/community', label: '커뮤니티', english: 'Community', icon: MessageCircle },
];

const utilityLinks = [
  { href: '/users', label: '유저 목록', english: 'Members', icon: Users },
  { href: '/games', label: '테트리스', english: 'Tetris', icon: Gamepad2 },
  { href: '/webrtc', label: '화상채팅', english: 'Video', icon: Video },
  { href: '/music', label: 'MUSIC VIDEO', english: 'MUSIC VIDEO', icon: Music2 },
  { href: '/theater', label: '극장', english: 'Theater', icon: Film },
  { href: '/assistant', label: 'AI 검색', english: 'AI Search', icon: Sparkles },
];

function LinkRow({ href, label, english, icon: Icon, active, language }: { href: string; label: string; english: string; icon: typeof Home; active: boolean; language: 'ko' | 'en' }) {
  const accent = href === '/music' ? 'text-rose-400' : href === '/' ? 'text-white' : active ? 'text-white' : 'text-slate-400';
  return (
    <Link href={href} onClick={(event) => { if (href === '/assistant' && active) { event.preventDefault(); window.dispatchEvent(new CustomEvent('gyopo-assistant-open')); } }} className={`group flex items-center gap-3 rounded-none px-3 py-2.5 text-[12px] font-medium transition ${active ? 'bg-white/10' : 'text-slate-400 hover:bg-white/7 hover:text-white'} ${accent}`}>
      <Icon size={17} className={active ? 'text-cyan-200' : 'text-slate-500 transition group-hover:text-teal-300'} />
       <span>{language === 'ko' ? label : english}<small className="ml-1.5 text-[10px] font-semibold opacity-45">/ {language === 'ko' ? english : label}</small></span>
    </Link>
  );
}

export default function PortalSidebar() {
  const pathname = usePathname();
  const language = useGlobalStore((state) => state.language);
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-0 bg-transparent pt-24 shadow-none backdrop-blur-none lg:flex">
       <div className="border-b border-white/8 px-4 py-4">
        <div className="text-[10px] font-black uppercase tracking-[.24em] text-teal-300">GYOPO NETWORK</div>
       </div>

       <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[.2em] text-slate-600">{language === 'ko' ? '커뮤니티 / COMMUNITY' : 'COMMUNITY / 커뮤니티'}</p>
        <div className="space-y-1">
           {primaryLinks.map((link) => <LinkRow key={link.href} {...link} language={language} active={link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)} />)}
        </div>
          <p className="mb-2 mt-7 px-3 text-[10px] font-black uppercase tracking-[.2em] text-slate-600">{language === 'ko' ? '라이브 / LIVE & PLAY' : 'LIVE & PLAY / 라이브'}</p>
        <div className="space-y-1">
            {utilityLinks.map((link) => <LinkRow key={link.href} {...link} language={language} active={pathname.startsWith(link.href)} />)}
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('gyopo-friends-open'))} className="group flex w-full items-center gap-3 rounded-none px-3 py-2.5 text-[11px] font-medium text-slate-400 transition hover:bg-white/7 hover:text-white">
              <UserRoundCheck size={17} className="text-slate-500 transition group-hover:text-teal-300" />
                <span>{language === 'ko' ? '친구 채팅·통화' : 'Friends Chat / Call'}</span>
          </button>
        </div>
      </nav>

      <div className="border-t border-white/8 p-4">
         <div className="rounded-2xl border border-teal-300/15 bg-gradient-to-br from-teal-300/[.10] to-cyan-300/[.03] p-3 shadow-[0_0_30px_rgba(45,212,191,.05)]">
           <p className="text-xs font-black text-teal-200">GYOPO LIVE NETWORK</p>
           <p className="mt-1 text-[11px] leading-5 text-slate-500">게임, 영상, 음악으로 연결하세요.<br />Connect through play, video, and music.</p>
        </div>
      </div>
    </aside>
  );
}
