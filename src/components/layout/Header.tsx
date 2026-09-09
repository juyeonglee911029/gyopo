'use client';

import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';
import { useEffect, useRef, useState } from 'react';
import { Gamepad2, Languages, LogIn, LogOut, Video, Menu, X } from 'lucide-react';
import { isMasterUser, signOut } from '@/lib/firebase';
import { REGIONS } from '@/lib/regions';

function formatUsdt(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TranslateMenu() {
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const setSelectedCountry = useGlobalStore((state) => state.setSelectedCountry);
  const language = useGlobalStore((state) => state.language);
  const setLanguage = useGlobalStore((state) => state.setLanguage);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedRegion = REGIONS.find((region) => region.id === selectedCountry) || REGIONS[0];

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={language === 'ko' ? '언어 및 지역 선택' : 'Language and region selector'} className="translate-control">
        <Languages size={15} className="text-teal-300" />
        <span className="hidden sm:inline">{language === 'ko' ? '언어' : 'Language'}</span>
        <span aria-hidden="true">{selectedRegion.flag}</span>
      </button>
      {open && <div className="translate-menu">
        <div className="border-b border-white/8 px-3 py-2"><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-300">{language === 'ko' ? '언어 / Language' : 'Language'}</p><p className="mt-0.5 text-[11px] text-slate-500">{language === 'ko' ? '사이트 표시 언어를 선택하세요.' : 'Choose the display language.'}</p></div>
        <div className="grid grid-cols-2 gap-1.5 p-1.5">
          <button type="button" onClick={() => setLanguage('ko')} className={`translate-option justify-center ${language === 'ko' ? 'translate-option-active' : ''}`}>한국어</button>
          <button type="button" onClick={() => setLanguage('en')} className={`translate-option justify-center ${language === 'en' ? 'translate-option-active' : ''}`}>English</button>
        </div>
        <div className="border-t border-white/8 px-3 py-2"><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-300">{language === 'ko' ? '지역' : 'Region'}</p><p className="mt-0.5 text-[11px] text-slate-500">{language === 'ko' ? '콘텐츠 지역을 선택하세요.' : 'Choose the content region.'}</p></div>
        <div className="max-h-60 overflow-y-auto p-1.5">
          {REGIONS.map((region) => <button key={region.id} type="button" onClick={() => { setSelectedCountry(region.id); setOpen(false); }} className={`translate-option ${region.id === selectedCountry ? 'translate-option-active' : ''}`}>
            <span className="text-base" aria-hidden="true">{region.flag}</span>
            <span className="min-w-0 flex-1 truncate text-left"><b>{region.label}</b><small>{region.short}</small></span>
            {region.id === selectedCountry && <span className="text-xs text-teal-300">✓</span>}
          </button>)}
        </div>
      </div>}
    </div>
  );
}

export default function Header() {
  const { user, setUser } = useGlobalStore();
  const language = useGlobalStore((state) => state.language);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    signOut();
    setUser(null);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-cyan-300/10 bg-[#050914]/72 shadow-[0_18px_60px_rgba(0,0,0,.28)] backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-6">
            <Link href="/" className="group flex flex-shrink-0 items-center gap-2">
            <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-[10px] text-slate-950 transition-transform group-hover:rotate-6 sm:h-9 sm:w-9">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg>
            </span>
            <span className="hidden leading-none sm:block"><span className="font-display block text-[15px] font-extrabold tracking-[.18em] text-white">GYOPO</span><span className="mt-1 block text-[8px] font-bold tracking-[.22em] text-cyan-300/60">GLOBAL NETWORK</span></span>
          </Link>
          
          <div className="hidden items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-slate-500 xl:flex"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,.8)]" /> Network live</div>
        </div>

        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
           <TranslateMenu />
            <Link href="/games" aria-label="테트리스" className="header-action header-action-secondary">
              <Gamepad2 size={16} />
              <span>{language === 'ko' ? '테트리스' : 'Tetris'} <em>/ {language === 'ko' ? 'Tetris' : '테트리스'}</em></span>
            </Link>
            <Link href="/webrtc" aria-label="화상채팅" className="header-action header-action-primary">
              <Video size={17} />
              <span>{language === 'ko' ? '화상채팅' : 'Video'} <em>/ {language === 'ko' ? 'Video' : '화상채팅'}</em></span>
           </Link>

           {user ? (
             <div className="flex items-center gap-2 sm:gap-4">
               <Link href="/wallet" aria-label={`${formatUsdt(user.usdtBalance)} USDT`} className="usdt-balance">
                  <span className="usdt-mark" aria-hidden="true">₮</span>
                 <span>{formatUsdt(user.usdtBalance)} <small>USDT</small></span>
               </Link>
               {isMasterUser(user) && <Link href="/master" className="rounded-lg border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800">MASTER</Link>}
               <div className="flex items-center gap-2">
                 <button type="button" onClick={() => window.dispatchEvent(new Event('gyopo-profile-edit'))} aria-label="프로필 편집 / Edit profile" className="header-profile-button"><img src={user.image} alt="Profile" className="h-8 w-8 rounded-full border border-white/15 object-cover" /></button>
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
           <TranslateMenu />
            <span className="text-slate-400">{language === 'ko' ? '지역 / Region' : 'Region / 지역'}</span>
         </div>
         <nav className="grid grid-cols-2 gap-2 text-sm font-bold text-slate-200">
           <Link onClick={() => setMenuOpen(false)} href="/jobs">구인구직 / Jobs</Link>
           <Link onClick={() => setMenuOpen(false)} href="/directory">업소록 / Directory</Link>
           <Link onClick={() => setMenuOpen(false)} href="/market">장터 / Market</Link>
           <Link onClick={() => setMenuOpen(false)} href="/community">커뮤니티 / Community</Link>
           <Link onClick={() => setMenuOpen(false)} href="/news">오늘의 뉴스 / News</Link>
           <Link onClick={() => setMenuOpen(false)} href="/games">테트리스 / Tetris</Link>
           <Link onClick={() => setMenuOpen(false)} href="/webrtc">화상채팅 / Video</Link>
           <Link onClick={() => setMenuOpen(false)} href="/theater">극장 / Theater</Link>
           <Link onClick={() => setMenuOpen(false)} href="/music">K-pop 음악 / Radio</Link>
           <Link onClick={() => setMenuOpen(false)} href="/users">유저목록 / Members</Link>
           <Link onClick={() => setMenuOpen(false)} href="/assistant">AI 검색 / AI Search</Link>
         </nav>
      </div>}
    </header>
  );
}
