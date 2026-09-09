'use client';

import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';
import { useState } from 'react';
import { Gamepad2, Wallet, LogIn, LogOut, Moon, Video, Menu, X, Globe2 } from 'lucide-react';
import { isMasterUser, signOut } from '@/lib/firebase';

function formatUsdt(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Header() {
  const { user, setUser } = useGlobalStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    signOut();
    setUser(null);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-cyan-300/10 bg-[#050914]/94 shadow-[0_18px_60px_rgba(0,0,0,.28)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-[10px] text-slate-950 transition-transform group-hover:rotate-6 sm:h-9 sm:w-9">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg>
            </span>
            <span className="hidden leading-none sm:block"><span className="font-display block text-[15px] font-extrabold tracking-[.18em] text-white">GYOPO</span><span className="mt-1 block text-[8px] font-bold tracking-[.22em] text-cyan-300/60">GLOBAL GAMING NETWORK</span></span>
          </Link>
          
          <div className="hidden items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-slate-500 xl:flex"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,.8)]" /> Network live</div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-slate-300 md:flex" aria-label="전체 지역">
            <Globe2 size={14} className="text-teal-300" /> 전체 지역
          </div>
          <Link href="/games" aria-label="테트리스" className="header-action header-action-secondary">
            <Gamepad2 size={16} />
            <span>테트리스</span>
          </Link>
          <Link href="/webrtc" aria-label="화상채팅" className="header-action header-action-primary">
            <Video size={17} />
            <span>화상채팅</span>
          </Link>
          <div aria-label="다크모드 적용" className="header-night-mode"><Moon size={14} /><span className="hidden xl:inline">NIGHT MODE</span></div>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <Link href="/wallet" className="flex items-center gap-1.5 rounded-lg border border-teal-300/20 bg-teal-300/10 px-3 py-1.5 text-sm font-bold text-teal-200 transition hover:bg-teal-300/20">
                <Wallet size={16} />
                <span className="text-[10px] sm:text-sm">{formatUsdt(user.usdtBalance)} USDT</span>
              </Link>
              {isMasterUser(user) && <Link href="/master" className="rounded-lg border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">MASTER</Link>}
              <div className="flex items-center gap-2">
                <img src={user.image} alt="Profile" className="w-8 h-8 rounded-full border border-white/15" />
                <button onClick={handleLogout} aria-label="로그아웃" className="p-1 text-slate-500 transition-colors hover:text-rose-300">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg bg-teal-300 px-4 py-1.5 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(45,212,191,.16)] transition-colors hover:bg-teal-200"
            >
              <LogIn size={16} />
              <span>로그인</span>
            </Link>
          )}
          <button onClick={() => setMenuOpen((open) => !open)} aria-label="메뉴 열기" className="header-menu-button lg:hidden">
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>
      {menuOpen && <div className="header-mobile-menu lg:hidden">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-slate-200">
          <Globe2 size={16} className="text-teal-300" />
          <span className="text-slate-400">표시 범위</span>
          <span className="ml-auto font-black text-white">전체 지역</span>
        </div>
        <nav className="grid grid-cols-2 gap-2 text-sm font-bold text-slate-200">
          <Link onClick={() => setMenuOpen(false)} href="/jobs">구인구직</Link>
          <Link onClick={() => setMenuOpen(false)} href="/directory">업소록</Link>
          <Link onClick={() => setMenuOpen(false)} href="/market">장터</Link>
          <Link onClick={() => setMenuOpen(false)} href="/community">커뮤니티</Link>
          <Link onClick={() => setMenuOpen(false)} href="/news">오늘의 뉴스</Link>
          <Link onClick={() => setMenuOpen(false)} href="/games">테트리스</Link>
          <Link onClick={() => setMenuOpen(false)} href="/webrtc">화상채팅</Link>
           <Link onClick={() => setMenuOpen(false)} href="/theater">극장</Link>
            <Link onClick={() => setMenuOpen(false)} href="/music">K-pop 음악</Link>
            <Link onClick={() => setMenuOpen(false)} href="/users">유저목록</Link>
           <Link onClick={() => setMenuOpen(false)} href="/assistant">AI 검색</Link>
        </nav>
      </div>}
    </header>
  );
}
