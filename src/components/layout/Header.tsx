'use client';

import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';
import { useEffect, useState } from 'react';
import { Gamepad2, Languages, LogIn, LogOut, Video } from 'lucide-react';
import { signOut } from '@/lib/firebase';
import { handleNavigationClick } from '@/lib/navigation';

function formatUsd(value: number) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TranslateMenu() {
  const language = useGlobalStore((state) => state.language);
  const setLanguage = useGlobalStore((state) => state.setLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <button type="button" onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')} aria-label={language === 'ko' ? 'Switch to English' : '한국어로 전환'} className="translate-control">
      <Languages size={15} className="text-teal-300" />
      <span>{language === 'ko' ? 'English' : '한국어'}</span>
    </button>
  );
}

export default function Header() {
  const { user, setUser } = useGlobalStore();
  const language = useGlobalStore((state) => state.language);
  const [localTime, setLocalTime] = useState('');

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const update = () => setLocalTime(formatter.format(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = () => {
    signOut();
    setUser(null);
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-0 bg-transparent shadow-none backdrop-blur-none">
      <div className="flex h-16 items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex items-center gap-6">
            <Link href="/" className="group flex flex-shrink-0 items-center gap-2">
            <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-none text-slate-950 transition-transform group-hover:rotate-6 sm:h-9 sm:w-9">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg>
            </span>
            <span className="hidden leading-none sm:block"><span className="font-display block text-[15px] font-extrabold tracking-[.18em] text-white">GYOPO</span><span className="mt-1 block text-[8px] font-bold tracking-[.22em] text-cyan-300/60">GLOBAL NETWORK</span></span>
          </Link>
          
        </div>

         <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <time className="local-clock hidden whitespace-nowrap text-[14px] font-normal text-white/75 sm:block">{localTime || '--:-- --'}</time>
            <TranslateMenu />
             <Link href="/games" onClick={(event) => handleNavigationClick(event, '/games', window.location.pathname)} aria-label="테트리스" className="header-action header-action-secondary">
              <Gamepad2 size={16} />
              <span>{language === 'ko' ? '테트리스' : 'Tetris'}</span>
            </Link>
             <Link href="/webrtc" onClick={(event) => handleNavigationClick(event, '/webrtc', window.location.pathname)} aria-label="화상채팅" className="header-action header-action-primary">
              <Video size={17} />
              <span>{language === 'ko' ? '화상채팅' : 'Video'}</span>
            </Link>

           {user ? (
             <div className="flex items-center gap-2 sm:gap-4">
                 <Link href="/wallet" aria-label={`${formatUsd(user.usdBalance)} USD`} className="usdt-balance">
                    <span className="usdt-mark" aria-hidden="true">$</span>
                   <span>{formatUsd(user.usdBalance)} <small>USD</small></span>
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
        </div>
      </div>
    </header>
  );
}
