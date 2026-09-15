'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppWindow, BriefcaseBusiness, Building2, CalendarDays, Gamepad2, Home, LogOut, Map, MessageCircle, Music2, Newspaper, Radio, Search, UserRound, Video, WalletCards, X } from 'lucide-react';
import { isMasterUser, signOut } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

const utilityLinks = [
  { href: '/jobs', label: '구인구직', icon: BriefcaseBusiness },
  { href: '/life', label: '생활 가이드', icon: Home },
  { href: '/directory', label: '업소록', icon: Building2 },
  { href: '/market', label: '장터', icon: WalletCards },
  { href: '/news', label: '오늘의 뉴스', icon: Newspaper },
  { href: '/games', label: '테트리스', icon: Gamepad2 },
  { href: '/webrtc', label: '화상채팅', icon: Video },
  { href: '/music', label: '음악', icon: Music2 },
  { href: '/watch', label: 'Watch', icon: Radio },
  { href: '/theater', label: 'LIVE ROOM', icon: CalendarDays },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const user = useGlobalStore((state) => state.user);
  const setUser = useGlobalStore((state) => state.setUser);
  const [myOpen, setMyOpen] = useState(false);

  useEffect(() => setMyOpen(false), [pathname]);

  const active = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);
  const close = () => setMyOpen(false);
  const logout = () => {
    signOut();
    setUser(null);
    close();
  };

  return <>
    {myOpen && <>
      <button type="button" className="mobile-my-backdrop" onClick={close} aria-label="MY 메뉴 닫기" />
      <aside className="mobile-my-panel" aria-label="MY 메뉴">
        <div className="mobile-my-panel-header">
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-300">Your space</p><h2 className="mt-1 text-lg font-black text-white">MY</h2></div>
          <button type="button" onClick={close} aria-label="MY 메뉴 닫기" className="header-icon-action"><X size={17} /></button>
        </div>
        <div className="mobile-my-profile">
          {user ? <><img src={user.image} alt="" className="h-10 w-10 rounded-full object-cover" /><div className="min-w-0 flex-1"><b className="block truncate text-sm text-white">{user.name || 'GYOPO 회원'}</b><span className="mt-1 block text-xs text-slate-400">내 프로필과 지갑을 관리하세요.</span></div><button type="button" onClick={() => window.dispatchEvent(new Event('gyopo-profile-edit'))} className="text-xs font-black text-teal-200">프로필</button></> : <><span className="mobile-my-avatar"><UserRound size={18} /></span><div className="min-w-0 flex-1"><b className="block text-sm text-white">로그인이 필요합니다</b><span className="mt-1 block text-xs text-slate-400">글쓰기와 개인 기능을 이용하세요.</span></div><Link href="/login" onClick={close} className="text-xs font-black text-teal-200">로그인</Link></>}
        </div>
        <div className="mobile-my-links">
          {user && <Link href="/wallet" onClick={close} className="mobile-my-link"><WalletCards size={16} /><span>서비스 잔액</span><span aria-hidden="true">→</span></Link>}
          {utilityLinks.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={close} className={`mobile-my-link ${!myOpen && active(href) ? 'mobile-my-link-active' : ''}`}><Icon size={16} /><span>{label}</span><span aria-hidden="true">→</span></Link>)}
          <Link href="/apps" onClick={close} className={`mobile-my-link ${!myOpen && active('/apps') ? 'mobile-my-link-active' : ''}`}><AppWindow size={16} /><span>앱 둘러보기</span><span aria-hidden="true">→</span></Link>
          <button type="button" onClick={() => { window.dispatchEvent(new Event('gyopo-friends-open')); close(); }} className="mobile-my-link"><MessageCircle size={16} /><span>친구 채팅·통화</span><span aria-hidden="true">→</span></button>
          {user && isMasterUser(user) && <Link href="/master" onClick={close} className="mobile-my-link"><UserRound size={16} /><span>관리자</span><span aria-hidden="true">→</span></Link>}
        </div>
        {user && <button type="button" onClick={logout} className="mobile-my-logout"><LogOut size={15} />로그아웃</button>}
      </aside>
    </>}
    <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴">
       <Link href="/" className={active('/') ? 'mobile-bottom-nav-link mobile-bottom-nav-link-active' : 'mobile-bottom-nav-link'}><Home size={18} /><span>홈</span></Link>
       <Link href="/watch" className={active('/watch') ? 'mobile-bottom-nav-link mobile-bottom-nav-link-active' : 'mobile-bottom-nav-link'}><Radio size={18} /><span>Watch</span></Link>
       <Link href="/regions" className={active('/regions') ? 'mobile-bottom-nav-link mobile-bottom-nav-link-active' : 'mobile-bottom-nav-link'}><Map size={18} /><span>지역</span></Link>
      <Link href="/assistant" className={active('/assistant') ? 'mobile-bottom-nav-link mobile-bottom-nav-link-active' : 'mobile-bottom-nav-link'}><Search size={18} /><span>검색</span></Link>
      <Link href="/community" className={active('/community') ? 'mobile-bottom-nav-link mobile-bottom-nav-link-active' : 'mobile-bottom-nav-link'}><MessageCircle size={18} /><span>커뮤니티</span></Link>
      <button type="button" onClick={() => setMyOpen((current) => !current)} aria-expanded={myOpen} className={myOpen ? 'mobile-bottom-nav-link mobile-bottom-nav-link-active' : 'mobile-bottom-nav-link'}><UserRound size={18} /><span>MY</span></button>
    </nav>
  </>;
}
