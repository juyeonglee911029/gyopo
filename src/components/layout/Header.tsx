'use client';

import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';
import { Globe, Wallet, LogIn, LogOut, Users, Activity, Film } from 'lucide-react';

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
  const { selectedCountry, setSelectedCountry, user, setUser } = useGlobalStore();

  const handleLoginMock = () => {
    setUser({
      name: '홍길동',
      email: 'hong@gmail.com',
      image: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&q=80',
      usdtBalance: 150.0,
      isSubscribed: false,
    });
  };

  const handleLogoutMock = () => {
    setUser(null);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200 ml-0 lg:ml-80 transition-all shadow-sm">
      <div className="px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 tracking-tighter group-hover:from-indigo-600 group-hover:to-blue-600 transition-all">
              GLOBAL 교포
            </span>
          </Link>
          
          <nav className="hidden xl:flex space-x-5 text-sm font-bold text-gray-700">
            <Link href="/jobs" className="hover:text-blue-600 transition-colors">구인구직</Link>
            <Link href="/directory" className="hover:text-blue-600 transition-colors">업소록</Link>
            <Link href="/market" className="hover:text-blue-600 transition-colors">에스크로장터</Link>
            <Link href="/community" className="hover:text-blue-600 transition-colors">커뮤니티</Link>
            <Link href="/games" className="hover:text-blue-600 transition-colors">테트리스</Link>
            <Link href="/theater" className="hover:text-blue-600 transition-colors flex items-center gap-1"><Film size={14}/> 극장</Link>
            <Link href="/users" className="hover:text-blue-600 transition-colors flex items-center gap-1"><Users size={14}/> 유저목록</Link>
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden md:flex flex-col items-end mr-2 text-[10px] font-bold text-gray-400">
            <div className="flex items-center gap-1"><Activity size={10} className="text-green-500"/> TODAY: 1,402</div>
            <div>MONTH: 45,901</div>
          </div>

          <div className="relative group flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 cursor-pointer border border-gray-200">
            <Globe size={16} className="text-gray-500" />
            <select 
              className="bg-transparent text-sm font-bold text-gray-700 focus:outline-none appearance-none pr-4 cursor-pointer"
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              {countries.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>

          {user ? (
            <div className="flex items-center gap-4">
              <Link href="/wallet" className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 font-bold text-sm hover:bg-green-100 transition">
                <Wallet size={16} />
                <span>{user.usdtBalance.toFixed(2)}</span>
              </Link>
              <div className="flex items-center gap-2">
                <img src={user.image} alt="Profile" className="w-8 h-8 rounded-full border border-gray-200" />
                <button onClick={handleLogoutMock} className="text-gray-500 hover:text-red-500 transition-colors p-1">
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleLoginMock}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-md hover:bg-gray-800 transition-colors"
            >
              <LogIn size={16} />
              <span>로그인</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}