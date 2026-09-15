'use client';

import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';
import { useEffect, useRef, useState } from 'react';
import { Languages, LogIn, LogOut } from 'lucide-react';
import { isMasterUser, MASTER_DEPOSIT_ADDRESS, signOut } from '@/lib/firebase';
import MusicPlayer from './musicplayer';

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
  const [masterChainBalance, setMasterChainBalance] = useState<number | null>(null);
  const [localTime, setLocalTime] = useState('');
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const chrome = headerRef.current?.parentElement;
    if (!chrome) return;
    const updateChromeBottom = () => {
      chrome.style.setProperty('--portal-chrome-bottom', `${Math.max(0, Math.ceil(chrome.getBoundingClientRect().bottom))}px`);
    };
    const observer = new ResizeObserver(updateChromeBottom);
    observer.observe(chrome);
    updateChromeBottom();
    window.addEventListener('resize', updateChromeBottom);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateChromeBottom);
      chrome.style.removeProperty('--portal-chrome-bottom');
    };
  }, []);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const update = () => setLocalTime(formatter.format(new Date()));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
    <header ref={headerRef} className="site-header">
      <div className="site-header-inner">
        <div className="site-header-primary">
          <Link href="/" className="group flex flex-shrink-0 items-center gap-2" aria-label="GYOPO 홈">
            <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-none text-slate-950 transition-transform group-hover:rotate-6 sm:h-9 sm:w-9">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg>
            </span>
            <span className="hidden leading-none sm:block"><span className="font-display block text-[15px] font-extrabold tracking-[.18em] text-white">GYOPO</span><span className="mt-1 block text-[8px] font-bold tracking-[.22em] text-cyan-300/60">GLOBAL NETWORK</span></span>
          </Link>
        </div>

        <div className="site-header-music flex-1">
          <MusicPlayer embedded />
        </div>

        <div className="site-header-actions">
          <time className="local-clock hidden whitespace-nowrap text-[14px] font-normal text-white/75 xl:block">{localTime || '--:-- --'}</time>
          <TranslateMenu />
          {user ? (
            <div className="site-header-account">
              <Link href="/wallet" aria-label={`${formatUsdt(isMasterUser(user) && masterChainBalance !== null ? masterChainBalance : user.usdtBalance)} USDT`} className="usdt-balance">
                <span className="usdt-mark" aria-hidden="true">₮</span>
                <span>{formatUsdt(isMasterUser(user) && masterChainBalance !== null ? masterChainBalance : user.usdtBalance)} <small>{isMasterUser(user) && masterChainBalance !== null ? 'CHAIN USDT' : 'USDT'}</small></span>
              </Link>
              {isMasterUser(user) && <Link href="/master" className="hidden rounded-lg border border-amber-300 bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-800 sm:inline-flex">MASTER</Link>}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => window.dispatchEvent(new Event('gyopo-profile-edit'))} aria-label="프로필 편집 / Edit profile" className="header-profile-button"><img src={user.image} alt="Profile" className="h-8 w-8 rounded-full border border-white/15 object-cover" /></button>
                <button type="button" onClick={handleLogout} aria-label="로그아웃" className="header-logout">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          ) : (
            <Link href="/login" aria-label="로그인" className="header-login inline-flex items-center gap-2 px-3 py-2 text-sm font-bold">
              <LogIn size={16} />
              <span>로그인</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
