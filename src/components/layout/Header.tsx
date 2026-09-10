'use client';

import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';
import { useEffect, useState } from 'react';
import { Gamepad2, Languages, LogIn, LogOut, Video } from 'lucide-react';
import { isMasterUser, MASTER_DEPOSIT_ADDRESS, signOut } from '@/lib/firebase';

function formatUsdt(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const [masterChainBalance, setMasterChainBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user || !isMasterUser(user)) {
      setMasterChainBalance(null);
      return;
    }
    let active = true;
    const loadBalance = async () => {
      const response = await fetch(`/api/tron/balance?address=${encodeURIComponent(MASTER_DEPOSIT_ADDRESS)}`, { cache: 'no-store' }).catch(() => null);
      if (!response?.ok) return;
      const result = await response.json() as { balance?: number };
      if (active && typeof result.balance === 'number') setMasterChainBalance(result.balance);
    };
    void loadBalance();
    const timer = window.setInterval(() => void loadBalance(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);

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
                <Link href="/wallet" aria-label={`${formatUsdt(isMasterUser(user) && masterChainBalance !== null ? masterChainBalance : user.usdtBalance)} USDT`} className="usdt-balance">
                   <span className="usdt-mark" aria-hidden="true">₮</span>
                  <span>{formatUsdt(isMasterUser(user) && masterChainBalance !== null ? masterChainBalance : user.usdtBalance)} <small>{isMasterUser(user) && masterChainBalance !== null ? 'CHAIN USDT' : 'USDT'}</small></span>
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
