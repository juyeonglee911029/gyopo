'use client';

import Link from 'next/link';
import BannerAd from '@/components/ads/BannerAd';
import { useGlobalStore } from '@/store/useGlobalStore';
import { ArrowUpRight, BriefcaseBusiness, CircleDollarSign, Globe2, Megaphone, PlayCircle, ShoppingBag, Store, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listDocuments } from '@/lib/firebase';
import { seedPosts } from '@/lib/seedData';

type HomePost = { id: string; title: string; type: string; authorId: string; views?: number; createdAt: string; country: string; sourceUrl?: string; sourceName?: string };

const services = [
  { href: '/jobs', label: '구인구직', detail: '일과 사람을 연결합니다', icon: BriefcaseBusiness, color: 'text-sky-300', bg: 'bg-sky-300/10' },
  { href: '/market', label: '에스크로 장터', detail: '안전한 거래를 시작하세요', icon: ShoppingBag, color: 'text-amber-300', bg: 'bg-amber-300/10' },
  { href: '/directory', label: '한인 업소록', detail: '검증된 로컬 비즈니스', icon: Store, color: 'text-emerald-300', bg: 'bg-emerald-300/10' },
  { href: '/community', label: '커뮤니티', detail: '지금 필요한 이야기를 나눠요', icon: Megaphone, color: 'text-violet-300', bg: 'bg-violet-300/10' },
];

const typeLabels: Record<string, string> = { notice: '공지', news: '뉴스', free: '자유' };

export default function Home() {
  const { selectedCountry } = useGlobalStore();
  const [posts, setPosts] = useState<HomePost[]>([]);

  useEffect(() => {
    void listDocuments<Omit<HomePost, 'id'>>('posts')
      .then((data) => setPosts([...data, ...seedPosts].filter((post) => post.authorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)))
      .catch(() => setPosts(seedPosts));
  }, []);

  const visiblePosts = posts.filter((post) => selectedCountry === 'Global' || post.country === selectedCountry || post.country === 'Global');

  return (
    <div className="min-h-screen overflow-hidden bg-[#070b17] text-slate-100">
      <section className="relative isolate mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-14 lg:pt-12">
        <div className="home-grid absolute inset-0 -z-20 opacity-50" />
        <div className="home-glow absolute -right-40 top-0 -z-10 h-[520px] w-[520px] rounded-full" />
        <div className="grid items-end gap-10 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-7 flex flex-wrap items-center gap-3 text-[11px] font-bold uppercase tracking-[.24em] text-teal-300">
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1.5"><span className="h-1.5 w-1.5 rounded-full bg-teal-300 shadow-[0_0_12px_#2dd4bf]" />Live network</span>
              <span className="text-slate-500">2026 / {selectedCountry === 'Global' ? 'Worldwide' : selectedCountry}</span>
            </div>
            <h1 className="font-display max-w-3xl text-5xl font-extrabold leading-[.98] tracking-[-.065em] text-white sm:text-6xl lg:text-8xl">
              연결의 기준을
              <span className="block bg-gradient-to-r from-teal-200 via-cyan-300 to-sky-400 bg-clip-text text-transparent">다시 만듭니다.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-slate-400 sm:text-lg">
              세계 어디서든 한국인으로 살아가는 사람들을 위한 신뢰의 네트워크. 일, 거래, 정보, 그리고 새로운 만남을 한 곳에서 시작하세요.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/community" className="group inline-flex items-center gap-2 rounded-xl bg-teal-300 px-5 py-3.5 text-sm font-extrabold text-slate-950 transition hover:bg-teal-200">
                커뮤니티 둘러보기 <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link href="/games" className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-bold text-slate-200 transition hover:border-teal-300/40 hover:bg-teal-300/10 hover:text-teal-200">
                <PlayCircle size={17} /> 테트리스 대전
              </Link>
            </div>
          </div>

          <div className="relative hidden min-h-[300px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/45 p-6 lg:block">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-teal-300/20" />
            <div className="absolute -right-4 top-0 h-56 w-56 rounded-full border border-teal-300/10" />
            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.22em] text-slate-500"><span>Network pulse</span><Globe2 size={16} className="text-teal-300" /></div>
              <div>
                <div className="font-display text-7xl font-extrabold tracking-[-.08em] text-white">24<span className="text-3xl text-teal-300">/7</span></div>
                <p className="mt-2 text-sm leading-6 text-slate-400">시간대가 달라도<br />연결은 계속됩니다.</p>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs"><span className="text-slate-500">현재 접속 지역</span><span className="font-bold text-teal-200">{selectedCountry === 'Global' ? 'Global' : selectedCountry}</span></div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-3 divide-x divide-white/10 border-y border-white/10 py-5 sm:max-w-xl">
          <div className="pr-4"><p className="font-display text-2xl font-extrabold text-white">GLOBAL</p><p className="mt-1 text-[11px] text-slate-500">활동 지역</p></div>
          <div className="px-4"><p className="font-display text-2xl font-extrabold text-white">SAFE</p><p className="mt-1 text-[11px] text-slate-500">에스크로 거래</p></div>
          <div className="pl-4"><p className="font-display text-2xl font-extrabold text-white">REAL</p><p className="mt-1 text-[11px] text-slate-500">실시간 커뮤니티</p></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 sm:px-6 lg:grid-cols-[.9fr_1.6fr_1fr] lg:px-8">
        <div className="surface rounded-3xl p-5">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-teal-300">Explore</p><h2 className="mt-1 text-xl font-extrabold text-white">주요 서비스</h2></div><ArrowUpRight size={18} className="text-slate-600" /></div>
          <div className="space-y-2">
            {services.map(({ href, label, detail, icon: Icon, color, bg }) => <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl p-3 transition hover:bg-white/5"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}><Icon size={18} /></span><span className="min-w-0"><span className="block text-sm font-bold text-slate-200 group-hover:text-teal-200">{label}</span><span className="mt-0.5 block truncate text-[11px] text-slate-500">{detail}</span></span><ArrowUpRight size={14} className="ml-auto shrink-0 text-slate-600 transition group-hover:text-teal-300" /></Link>)}
          </div>
        </div>

        <div className="surface rounded-3xl p-5 sm:p-7">
          <div className="mb-6 flex items-end justify-between border-b border-white/10 pb-5"><div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-teal-300">Community desk</p><h2 className="mt-1 text-2xl font-extrabold text-white">오늘의 이야기</h2></div><Link href="/community" className="text-xs font-bold text-slate-500 transition hover:text-teal-300">전체 보기 <ArrowUpRight size={13} className="inline" /></Link></div>
          <div className="space-y-1">
            {visiblePosts.length === 0 && <p className="py-6 text-sm text-slate-500">아직 등록된 게시글이 없습니다.</p>}
            {visiblePosts.map((post) => <Link href={post.sourceUrl || `/community/${post.id}`} key={post.id} className="group flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-white/5"><span className="w-9 shrink-0 text-center text-[10px] font-bold text-teal-300">{typeLabels[post.type] || '소식'}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-300 transition group-hover:text-white">{post.title}</span>{post.sourceName && <span className="hidden text-[10px] text-slate-600 sm:block">{post.sourceName}</span>}<span className="shrink-0 text-[10px] text-slate-600">{post.views || 0}</span></Link>)}
          </div>
          <div className="mt-6"><BannerAd type="horizontal" /></div>
        </div>

        <div className="space-y-5">
          <div className="surface rounded-3xl p-6">
            <div className="flex items-center gap-2 text-teal-300"><UsersRound size={18} /><span className="text-[10px] font-bold uppercase tracking-[.22em]">Member space</span></div>
            <h2 className="mt-5 text-2xl font-extrabold leading-tight text-white">혼자가 아니라는<br />감각을 만나세요.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">관심사가 맞는 사람과 대화하고, 필요한 정보를 빠르게 찾아보세요.</p>
            <Link href="/users" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-teal-300 transition hover:text-teal-200">멤버 둘러보기 <ArrowUpRight size={15} /></Link>
          </div>
          <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[.07] p-6"><div className="flex items-center gap-2 text-amber-200"><CircleDollarSign size={17} /><span className="text-[10px] font-bold uppercase tracking-[.22em]">Secure exchange</span></div><p className="mt-4 text-sm font-bold leading-6 text-amber-50">신뢰할 수 있는 거래는<br />에스크로에서 시작됩니다.</p><Link href="/market" className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-amber-200">장터 입장 <ArrowUpRight size={14} /></Link></div>
        </div>
      </section>
    </div>
  );
}
'use client';

import Link from 'next/link';
import BannerAd from '@/components/ads/BannerAd';
import { useGlobalStore } from '@/store/useGlobalStore';
import { PlayCircle, Users, Briefcase, ShoppingCart, Store, Megaphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { listDocuments } from '@/lib/firebase';
import { seedPosts } from '@/lib/seedData';

type HomePost = { id: string; title: string; type: string; authorId: string; views?: number; createdAt: string; country: string; sourceUrl?: string; sourceName?: string };

export default function Home() {
  const { selectedCountry } = useGlobalStore();
  const [posts, setPosts] = useState<HomePost[]>([]);

  useEffect(() => {
     void listDocuments<Omit<HomePost, 'id'>>('posts')
       .then((data) => setPosts([...data, ...seedPosts].filter((post) => post.authorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)))
       .catch(() => setPosts(seedPosts));
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Banner / Hero */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-900 rounded-3xl p-8 md:p-12 text-white mb-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between">
          <div className="mb-6 md:mb-0">
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-bold backdrop-blur-sm mb-4 inline-block shadow-inner">
              {selectedCountry === 'Global' ? '🌍 글로벌 (전체)' : `📍 ${selectedCountry} 지역 접속 중`}
            </span>
            <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter">
              전 세계 교민의 중심,<br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-cyan-200">GLOBAL 교포</span>
            </h1>
            <p className="text-blue-100 max-w-xl text-lg font-light leading-relaxed">
              USDT 에스크로 중고장터, 프리미엄 구인구직, 실시간 화상채팅까지.<br/>전 세계 한인 네트워크를 지금 바로 경험하세요.
            </p>
          </div>
          <div className="flex gap-4">
            <Link href="/games" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 px-6 py-4 rounded-2xl font-black text-white shadow-lg transition-transform hover:scale-105 flex flex-col items-center">
              <span className="text-2xl mb-1">🕹️</span>
              <span>테트리스 대전</span>
            </Link>
            <Link href="/webrtc" className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 px-6 py-4 rounded-2xl font-black text-white shadow-lg transition-transform hover:scale-105 flex flex-col items-center">
              <span className="text-2xl mb-1">📸</span>
              <span>랜덤 화상채팅</span>
            </Link>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Quick Links & Ads */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h3 className="font-bold text-gray-800 mb-4 px-2">바로가기</h3>
            <div className="space-y-2">
              <Link href="/jobs" className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-bold transition">
                <Briefcase size={20} className="text-blue-500" /> 프리미엄 구인/구직
              </Link>
              <Link href="/market" className="flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 text-gray-700 hover:text-orange-700 font-bold transition">
                <ShoppingCart size={20} className="text-orange-500" /> 에스크로 중고장터
              </Link>
              <Link href="/directory" className="flex items-center gap-3 p-3 rounded-xl hover:bg-green-50 text-gray-700 hover:text-green-700 font-bold transition">
                <Store size={20} className="text-green-500" /> 한인 업소록
              </Link>
              <Link href="/community" className="flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 text-gray-700 hover:text-purple-700 font-bold transition">
                <Megaphone size={20} className="text-purple-500" /> 뉴스 / 아쥬게시판
              </Link>
              <Link href="/theater" className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-gray-700 hover:text-red-700 font-bold transition">
                <PlayCircle size={20} className="text-red-500" /> 글로벌 극장 (VOD)
              </Link>
            </div>
          </div>
          
          <BannerAd type="square" />
        </div>

        {/* Middle Column: News & Popular Posts */}
        <div className="lg:col-span-6 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-end mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">🔥 실시간 핫이슈</h2>
              <Link href="/community" className="text-sm font-bold text-blue-600 hover:underline">더보기</Link>
            </div>
            
             <div className="space-y-5">
               {posts.length === 0 && <p className="text-sm text-gray-400 py-4">아직 등록된 게시글이 없습니다.</p>}
               {posts.filter((post) => selectedCountry === 'Global' || post.country === selectedCountry || post.country === 'Global').map((post) => (
                  <Link href={post.sourceUrl || `/community/${post.id}`} key={post.id} className="group block">
                   <div className="flex items-center gap-3">
                     <span className="text-xs font-bold px-2 py-1 rounded shrink-0 text-blue-600 bg-blue-50">{post.type === 'notice' ? '공지' : post.type === 'news' ? '뉴스' : '자유'}</span>
                      <h3 className="text-gray-800 font-medium truncate group-hover:text-blue-600 transition-colors">
                        {post.title}
                      </h3>
                      {post.sourceName && <span className="hidden text-[10px] text-blue-500 lg:inline">{post.sourceName}</span>}
                     <span className="text-xs text-gray-400 ml-auto shrink-0 pr-2">조회 {post.views || 0}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <BannerAd type="horizontal" />
        </div>

        {/* Right Column: Reels & Entertainment */}
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 h-[600px] flex flex-col">
            <h3 className="font-bold text-gray-800 mb-4 px-2 flex items-center gap-2">
              <span>📱 숏폼 릴스</span>
              <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black">HOT</span>
            </h3>
            
            {/* Embedded Instagram Reels Container */}
            <div className="flex-1 rounded-xl overflow-hidden relative bg-black">
              <iframe 
                src="https://www.instagram.com/reels/embed/" 
                className="w-full h-full border-none"
                scrolling="yes"
                allowTransparency={true}
                allow="encrypted-media"
                title="Instagram Reels"
              ></iframe>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
