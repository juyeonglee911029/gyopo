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
  { href: '/music', label: 'K-POP 라디오', english: 'Radio', icon: Music2 },
  { href: '/theater', label: '극장', english: 'Theater', icon: Film },
  { href: '/assistant', label: 'AI 검색', english: 'AI Search', icon: Sparkles },
];


function LinkRow({ href, label, english, icon: Icon, active, language }: { href: string; label: string; english: string; icon: typeof Home; active: boolean; language: 'ko' | 'en' }) {
  return (
    <Link href={href} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active ? 'bg-teal-300 text-slate-950 shadow-[0_8px_24px_rgba(45,212,191,.16)]' : 'text-slate-400 hover:bg-white/7 hover:text-white'}`}>
      <Icon size={17} className={active ? 'text-slate-950' : 'text-slate-500 transition group-hover:text-teal-300'} />
       <span>{language === 'ko' ? label : english}<small className="ml-1.5 text-[10px] font-semibold opacity-45">/ {language === 'ko' ? english : label}</small></span>
    </Link>
  );
}


export default function PortalSidebar() {
  const pathname = usePathname();
