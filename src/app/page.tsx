'use client';

import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Gamepad2,
  MessageCircle,
  Newspaper,
  Play,
  Radio,
  Sparkles,
  Store,
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
  { href: '/news', label: '오늘의 뉴스', detail: '검증된 출처의 핵심 소식을 빠르게', icon: Newspaper, tone: 'text-lime-200 bg-lime-300/10', layout: 'sm:col-span-7' },
  { href: '/community', label: '커뮤니티', detail: '해외 생활의 진짜 이야기가 모이는 곳', icon: UsersRound, tone: 'text-violet-200 bg-violet-300/10', layout: 'sm:col-span-5' },
  { href: '/jobs', label: '구인구직', detail: '나에게 맞는 글로벌 기회 찾기', icon: BriefcaseBusiness, tone: 'text-sky-200 bg-sky-300/10', layout: 'sm:col-span-5' },
  { href: '/directory', label: '한인 업소록', detail: '가까운 한인 비즈니스를 한 번에', icon: Store, tone: 'text-emerald-200 bg-emerald-300/10', layout: 'sm:col-span-7' },
  { href: '/assistant', label: '정보 도우미', detail: '궁금한 해외 생활 정보를 바로 질문', icon: Sparkles, tone: 'text-cyan-200 bg-cyan-300/10', layout: 'sm:col-span-5' },
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
              <span className="inline-flex items-center gap-2"><Zap size={13} className="text-amber-300" /> 빠른 랜덤 매칭</span>
              <span className="inline-flex items-center gap-2"><UsersRound size={13} className="text-violet-300" /> 글로벌 교민 네트워크</span>
            </div>
          </div>

          <Link href="/webrtc" aria-label="랜덤 화상채팅 시작하기" className="home-video-stage group relative z-10 flex min-h-[330px] flex-col justify-between overflow-hidden border-t border-white/10 p-5 sm:min-h-[400px] sm:p-8 2xl:min-h-0 2xl:border-l 2xl:border-t-0">
            <div className="relative z-10 flex items-center justify-between">
              <span className="rounded-full border border-white/15 bg-slate-950/35 px-3 py-1.5 text-[10px] font-black tracking-[.2em] text-white backdrop-blur-md">1:1 MATCH</span>
              <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-emerald-100"><Radio size={14} /> Ready</span>
            </div>
            <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 items-center justify-center py-8">
              <div className="home-video-orb absolute h-48 w-48 rounded-full border border-white/15 sm:h-60 sm:w-60" />
              <div className="home-video-orb home-video-orb-delay absolute h-36 w-36 rounded-full border border-white/20 sm:h-44 sm:w-44" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[30px] border border-white/20 bg-white/15 text-white shadow-[0_24px_80px_rgba(4,10,30,.35)] backdrop-blur-xl transition-transform duration-300 group-hover:scale-105 sm:h-28 sm:w-28">
                <Play size={34} fill="currentColor" />
              </div>
              <span className="absolute bottom-5 left-0 rounded-xl border border-white/15 bg-slate-950/35 px-3 py-2 text-[10px] font-black text-white backdrop-blur-md">SEOUL · ONLINE</span>
              <span className="absolute right-0 top-5 rounded-xl border border-white/15 bg-slate-950/35 px-3 py-2 text-[10px] font-black text-white backdrop-blur-md">GLOBAL · LIVE</span>
            </div>
            <div className="relative z-10 flex items-center justify-between rounded-2xl border border-white/15 bg-slate-950/30 p-3 backdrop-blur-xl">
              <div><p className="text-[10px] font-bold text-white/60">카메라를 켜고</p><p className="mt-0.5 text-sm font-black text-white">새로운 대화 시작</p></div>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-950 transition-transform group-hover:translate-x-1"><ArrowUpRight size={19} /></span>
            </div>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 sm:px-6 lg:px-8 2xl:grid-cols-[1.05fr_.95fr]">
        <Link href="/games" className="home-tetris-card group relative min-h-[210px] overflow-hidden rounded-[28px] p-6 text-slate-950 sm:p-8">
          <div className="relative z-10 flex h-full max-w-md flex-col justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em]"><Gamepad2 size={16} /> Quick play</div>
            <div className="mt-8">
              <p className="font-display text-3xl font-extrabold tracking-[-.05em] sm:text-4xl">테트리스 한 판?</p>
              <p className="mt-2 text-sm font-bold text-slate-800/70">설치 없이 바로 시작하는 짜릿한 블록 대전</p>
            </div>
            <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white transition-transform group-hover:translate-x-1">게임 입장 <ArrowRight size={14} /></span>
          </div>
          <div className="tetris-piece absolute -right-4 top-5 grid rotate-6 grid-cols-3 gap-1 opacity-90 sm:right-8 sm:top-7" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <span key={index} className={index === 0 || index === 2 ? 'invisible' : ''} />)}</div>
        </Link>
        <div className="surface home-clock flex flex-col justify-between rounded-[28px] p-5 sm:p-7">
          <div className="flex items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">World sync</p><h2 className="mt-1 text-xl font-black text-white">우리의 지금</h2></div><span className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-bold text-slate-400">{regionName}</span></div>
          <WorldClock />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-12 sm:px-6 lg:px-8 2xl:grid-cols-[1.25fr_.75fr]">
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-teal-300">Pick your route</p><h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">지금 필요한 곳으로</h2></div>
            <span className="hidden text-xs font-bold text-slate-500 sm:block">한 번에 바로 이동하세요</span>
          </div>
          <nav className="grid gap-3 sm:grid-cols-12" aria-label="주요 서비스">
            {services.map(({ href, label, detail, icon: Icon, tone, layout }, index) => (
              <Link key={href} href={href} className={`home-route-card group relative min-h-[150px] overflow-hidden rounded-3xl border border-white/10 bg-white/[.045] p-5 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[.075] ${layout}`}>
                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-center justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}><Icon size={19} /></span><span className="font-display text-[10px] font-extrabold tracking-[.18em] text-slate-600">0{index + 1}</span></div>
                  <h3 className="mt-5 text-lg font-black text-white transition-colors group-hover:text-teal-100">{label}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
                  <ArrowUpRight size={16} className="mt-4 text-slate-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-300" />
                </div>
              </Link>
            ))}
          </nav>
        </div>

        <div className="surface flex flex-col rounded-[28px] p-5 sm:p-6">
          <div className="flex items-end justify-between border-b border-white/10 pb-5">
            <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Live board</div><h2 className="mt-1 text-xl font-black text-white">방금 올라온 이야기</h2></div>
            <Link href="/community" className="inline-flex items-center gap-1 text-xs font-black text-slate-500 transition hover:text-teal-300">전체 보기 <ArrowRight size={13} /></Link>
          </div>
          <div className="flex-1 divide-y divide-white/8">
            {visiblePosts.length === 0 && <p className="py-10 text-center text-sm text-slate-500">아직 등록된 이야기가 없습니다.</p>}
            {visiblePosts.map((post) => (
              <Link href={post.sourceUrl || `/community/${post.id}`} key={post.id} className="group flex items-center gap-3 py-4">
                <span className="shrink-0 rounded-lg bg-teal-300/10 px-2 py-1 text-[10px] font-black text-teal-200">{typeLabels[post.type] || '소식'}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-300 transition group-hover:text-white">{post.title}</span>
                <ArrowUpRight size={14} className="shrink-0 text-slate-600 transition group-hover:text-teal-300" />
              </Link>
            ))}
          </div>
          <div className="mt-5"><BannerAd type="horizontal" /></div>
        </div>
      </section>
    </div>
  );
}
