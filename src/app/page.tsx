'use client';


import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  AppWindow,
  BriefcaseBusiness,
  Gamepad2,
  Home as HomeIcon,
  Map,
  MessageCircle,
  Newspaper,
  Play,
  Radio,
  UsersRound,
  Video,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import BannerAd from '@/components/ads/BannerAd';
import WorldClock from '@/components/layout/WorldClock';
import { listDocuments } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';


type HomePost = { id: string; title: string; type: string; authorId: string; views?: number; createdAt: string; country: string; sourceUrl?: string; sourceName?: string };


const services = [
  { href: '/regions', label: '지역', detail: '국가와 도시별 교민 네트워크', icon: Map, tone: 'text-cyan-200 bg-cyan-300/10', layout: 'sm:col-span-6' },
  { href: '/jobs', label: '구인', detail: '나에게 맞는 글로벌 기회 찾기', icon: BriefcaseBusiness, tone: 'text-sky-200 bg-sky-300/10', layout: 'sm:col-span-6' },
  { href: '/life', label: '생활', detail: '주거·업소록·장터와 생활 정보', icon: HomeIcon, tone: 'text-emerald-200 bg-emerald-300/10', layout: 'sm:col-span-6' },
  { href: '/community', label: '커뮤니티', detail: '해외 생활의 진짜 이야기가 모이는 곳', icon: MessageCircle, tone: 'text-violet-200 bg-violet-300/10', layout: 'sm:col-span-6' },
  { href: '/apps', label: '앱', detail: 'AI·영상·게임·음악을 바로 시작', icon: AppWindow, tone: 'text-amber-200 bg-amber-300/10', layout: 'sm:col-span-6' },
  { href: '/news', label: '뉴스', detail: '검증된 출처의 핵심 소식을 빠르게', icon: Newspaper, tone: 'text-lime-200 bg-lime-300/10', layout: 'sm:col-span-6' },
];


const typeLabels: Record<string, string> = { notice: '공지', news: '뉴스', free: '자유' };


export default function Home() {
  const { selectedCountry } = useGlobalStore();
  const [posts, setPosts] = useState<HomePost[]>([]);


  useEffect(() => {
    void listDocuments<Omit<HomePost, 'id'>>('posts')
      .then((data) => setPosts(data.filter((post) => post.authorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)))
      .catch(() => setPosts([]));
  }, []);


  const visiblePosts = posts.filter((post) => selectedCountry === 'Global' || post.country === selectedCountry || post.country === 'Global');
  const regionName = selectedCountry === 'Global' ? '전 세계' : selectedCountry;


  return (
    <div className="home-page min-h-screen overflow-hidden bg-transparent text-slate-100">
      <section className="relative mx-auto max-w-7xl px-4 pb-7 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <div className="home-grid pointer-events-none absolute inset-0 opacity-35" />
        <div className="home-video-hero relative isolate overflow-hidden rounded-[30px] border border-white/10 2xl:grid 2xl:min-h-[530px] 2xl:grid-cols-[1.08fr_.92fr]">
          <div className="relative z-10 flex flex-col justify-center p-6 sm:p-10 2xl:p-12">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-emerald-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" /> Live now
              </span>
              <span className="text-xs font-bold text-slate-400">{regionName} 네트워크 연결 중</span>
            </div>


            <p className="mt-8 text-xs font-black uppercase tracking-[.24em] text-teal-200">Random video meet</p>
            <h1 className="font-display mt-3 max-w-3xl text-[2.65rem] font-extrabold leading-[1.02] tracking-[-.06em] text-white sm:text-6xl 2xl:text-7xl">
              어색함은 짧게,
              <span className="block bg-gradient-to-r from-teal-200 via-cyan-300 to-violet-300 bg-clip-text text-transparent">연결은 진짜로.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
              지금 접속한 교민과 가볍게 1:1 랜덤 영상 대화. 멀리 있어도 같은 언어로 바로 통하는 순간을 만나보세요.
            </p>


            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/webrtc" className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-white px-6 text-sm font-black text-slate-950 shadow-[0_14px_40px_rgba(45,212,191,.18)] transition hover:-translate-y-0.5 hover:bg-teal-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-300"><Video size={17} /></span>
                지금 영상으로 만나기
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
              </Link>
              <button onClick={() => window.dispatchEvent(new Event('gyopo-open-global-chat'))} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[.06] px-5 text-sm font-bold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-100">
                <MessageCircle size={17} /> 먼저 채팅으로 인사하기
              </button>
            </div>


            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-[11px] font-bold text-slate-500">

