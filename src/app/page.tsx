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
