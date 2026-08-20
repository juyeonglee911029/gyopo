'use client';

import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';
import { Globe, Wallet, LogIn, LogOut, Users, Film, Moon, Sun, BookOpen, Video } from 'lucide-react';
import { isMasterUser, signOut } from '@/lib/firebase';

const countries = [
  { code: 'Global', name: '전체 (Global)' },
  { code: 'KR', name: '한국 (Korea)' },
  { code: 'US', name: '미국 (USA)' },
  { code: 'JP', name: '일본 (Japan)' },
  { code: 'CN', name: '중국 (China)' },
  { code: 'VN', name: '베트남 (Vietnam)' },
  { code: 'AU', name: '호주 (Australia)' },
];

export default function Header() {
  const { selectedCountry, setSelectedCountry, user, setUser, darkMode, setDarkMode } = useGlobalStore();

  const handleLogout = () => {
    signOut();
    setUser(null);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#070b17]/90 backdrop-blur-xl border-b border-white/10 ml-0 lg:ml-80 transition-all">
      <div className="px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-[10px] text-slate-950 transition-transform group-hover:rotate-6">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="2.2" aria-hidden="true"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg>
            </span>
            <span className="leading-none"><span className="font-display block text-[15px] font-extrabold tracking-[.18em] text-white">GYOPO</span><span className="mt-1 block text-[8px] font-bold tracking-[.22em] text-slate-500">GLOBAL NETWORK</span></span>
          </Link>
          
          <nav className="hidden 2xl:flex space-x-4 whitespace-nowrap text-sm font-semibold text-slate-400">
            <Link href="/jobs" className="hover:text-teal-300 transition-colors">구인구직</Link>
            <Link href="/directory" className="hover:text-teal-300 transition-colors">업소록</Link>
            <Link href="/market" className="hover:text-teal-300 transition-colors">에스크로장터</Link>
            <Link href="/community" className="hover:text-teal-300 transition-colors">커뮤니티</Link>
            <Link href="/blog" className="hover:text-teal-300 transition-colors flex items-center gap-1"><BookOpen size={14}/> 블로그</Link>
            <Link href="/games" className="hover:text-teal-300 transition-colors">테트리스</Link>
            <Link href="/webrtc" className="hover:text-teal-300 transition-colors flex items-center gap-1"><Video size={14}/> 화상채팅</Link>
            <Link href="/theater" className="hover:text-teal-300 transition-colors flex items-center gap-1"><Film size={14}/> 극장</Link>
            <Link href="/users" className="hover:text-teal-300 transition-colors flex items-center gap-1"><Users size={14}/> 유저목록</Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="relative group flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 cursor-pointer">
            <Globe size={16} className="text-teal-300" />
            <select 
              className="bg-transparent text-sm font-bold text-slate-200 focus:outline-none appearance-none pr-4 cursor-pointer"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              {countries.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} aria-label="다크모드 전환" className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:text-teal-300">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {user ? (
            <div className="flex items-center gap-4">
              <Link href="/wallet" className="flex items-center gap-1.5 rounded-lg border border-teal-300/20 bg-teal-300/10 px-3 py-1.5 text-sm font-bold text-teal-200 transition hover:bg-teal-300/20">
                <Wallet size={16} />
                <span>{user.usdtBalance.toFixed(2)}</span>
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
        </div>
      </div>
    </header>
  );
}
