'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import {
  AppWindow,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Gamepad2,
  House,
  Map,
  MapPin,
  MessageCircle,
  Newspaper,
  Play,
  Radio,
  Search,
  Sparkles,
  UsersRound,
  Video,
  Zap,
} from 'lucide-react';
import BannerAd from '@/components/ads/BannerAd';
import WorldClock from '@/components/layout/WorldClock';
import { listDocuments } from '@/lib/firebase';
import { countryForRegion, serviceHref, type PublicServiceSlug } from '@/lib/regionRoutes';
import { REGIONS, regionLabel } from '@/lib/regions';
import { resolvePortalSearch } from '@/lib/searchRouting';
import { trackSearch } from '@/lib/searchTracking';
import { trackGrowth } from '@/lib/growthTracking';
import { useGlobalStore } from '@/store/useGlobalStore';

type HomePost = { id: string; title: string; type: string; authorId: string; views?: number; createdAt: string; country: string; sourceUrl?: string; sourceName?: string };

const homeRoutes: Array<{ href: string; service?: PublicServiceSlug; label: string; english: string; detail: string; icon: typeof BriefcaseBusiness; tone: string }> = [
  { href: '/jobs', service: 'jobs', label: '구인', english: 'Jobs', detail: '지금 열려 있는 글로벌 기회', icon: BriefcaseBusiness, tone: 'text-sky-200 bg-sky-300/10' },
  { href: '/directory', service: 'businesses', label: '업소록', english: 'Businesses', detail: '가까운 한인 업체와 서비스', icon: Building2, tone: 'text-emerald-200 bg-emerald-300/10' },
  { href: '/life', service: 'guides', label: '생활 가이드', english: 'Guides', detail: '이주·교육·자동차·도움 정보', icon: BookOpen, tone: 'text-amber-200 bg-amber-300/10' },
  { href: '/life', service: 'housing', label: '주거 찾기', english: 'Housing', detail: '살 곳과 정착에 필요한 다음 단계', icon: House, tone: 'text-violet-200 bg-violet-300/10' },
  { href: '/community', service: 'community', label: '커뮤니티', english: 'Community', detail: '먼저 살아본 사람들의 이야기', icon: MessageCircle, tone: 'text-fuchsia-200 bg-fuchsia-300/10' },
  { href: '/regions', label: '지역 둘러보기', english: 'Locations', detail: '국가와 도시별 교민 네트워크', icon: Map, tone: 'text-cyan-200 bg-cyan-300/10' },
  { href: '/news', service: 'news', label: '지역 뉴스', english: 'News', detail: '생활에 필요한 핵심 소식', icon: Newspaper, tone: 'text-lime-200 bg-lime-300/10' },
  { href: '/community', service: 'events', label: '이벤트', english: 'Events', detail: '이번 주 함께할 모임과 소식', icon: CalendarDays, tone: 'text-rose-200 bg-rose-300/10' },
];

const typeLabels: Record<string, string> = { notice: '공지', news: '뉴스', free: '자유' };

export default function Home() {
  const router = useRouter();
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const setSelectedCountry = useGlobalStore((state) => state.setSelectedCountry);
  const user = useGlobalStore((state) => state.user);
  const [posts, setPosts] = useState<HomePost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    void listDocuments<Omit<HomePost, 'id'>>('posts')
      .then((data) => setPosts(data.filter((post) => post.authorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5)))
      .catch(() => setPosts([]));
  }, []);

  const visiblePosts = posts.filter((post) => selectedCountry === 'Global' || post.country === selectedCountry || post.country === 'Global');
  const regionName = selectedCountry === 'Global' ? '전 세계' : regionLabel(selectedCountry);
  const selectedRoute = countryForRegion(selectedCountry);

  const submitSearchQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const portalRoute = resolvePortalSearch(trimmed);
    if (portalRoute) {
      trackGrowth({ event: 'search_submit', country: selectedCountry, audience: user ? 'member' : 'guest', details: { mode: portalRoute.mode, destination: portalRoute.href } });
      trackSearch({ query: trimmed, mode: portalRoute.mode, destination: portalRoute.href, country: selectedCountry, audience: user ? 'member' : 'guest' });
      router.push(portalRoute.href);
      return;
    }
    trackGrowth({ event: 'search_submit', country: selectedCountry, audience: user ? 'member' : 'guest', details: { mode: 'AI', destination: '/assistant' } });
    trackSearch({ query: trimmed, mode: 'AI', destination: '/assistant', country: selectedCountry, audience: user ? 'member' : 'guest' });
    window.dispatchEvent(new CustomEvent('gyopo-assistant-query', { detail: { query: trimmed } }));
  };

  const submitSmartSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitSearchQuery(searchQuery);
  };

  return (
    <div className="home-page min-h-screen bg-transparent text-slate-100">
      <section className="home-lead mx-auto max-w-7xl px-4 pb-6 pt-5 sm:px-6 lg:px-8">
        <div className="home-lead-grid relative overflow-hidden rounded-[30px] border border-white/10 p-5 sm:p-8 lg:p-10">
          <div className="home-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative z-10 min-w-0">
            <form onSubmit={submitSmartSearch} className="home-smart-search flex max-w-2xl items-center gap-3 rounded-2xl border border-teal-200/20 bg-slate-950/45 p-2 shadow-[0_18px_50px_rgba(2,8,23,.24)] backdrop-blur-xl">
              <Search size={19} className="ml-2 shrink-0 text-teal-200" />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Smart Search" placeholder="지역, 일자리, 업소, 생활정보를 검색하세요" className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-white outline-none placeholder:text-slate-500" />
              <button type="submit" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-300 px-4 py-3 text-xs font-black text-slate-950 transition hover:bg-teal-200"><Sparkles size={14} />검색</button>
            </form>
          </div>
          <aside className="home-context-card relative z-10 rounded-3xl border border-white/10 bg-white/[.06] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Location context</p><h2 className="mt-2 text-2xl font-black text-white">{regionName}</h2><p className="mt-2 text-xs leading-5 text-slate-400">현재 선택한 지역을 기준으로 콘텐츠와 검색 결과를 연결합니다.</p></div><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200"><MapPin size={19} /></span></div>
             <label className="home-region-select mt-5"><span>현재 지역</span><select value={selectedCountry} onChange={(event) => setSelectedCountry(event.target.value)} aria-label="현재 지역 선택">{REGIONS.map((region) => <option key={region.id} value={region.id}>{region.flag} {regionLabel(region.id)}</option>)}</select></label>
             <Link href="/regions" className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-black text-teal-200 transition hover:text-white"><span>지역 바꾸기</span><ArrowUpRight size={15} /></Link>
            <div className="mt-6 border-t border-white/10 pt-4"><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-500"><UsersRound size={13} className="text-emerald-300" />Around the world</div><WorldClock /></div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-3 px-4 pb-9 sm:grid-cols-3 sm:px-6 lg:px-8" aria-label="빠른 시작">
        <Link href="/webrtc" className="home-feature-card home-feature-video group"><span className="home-feature-icon"><Video size={19} /></span><span className="min-w-0 flex-1"><small>CONNECT NOW</small><b>영상으로 교민 만나기</b></span><ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
        <Link href="/games" className="home-feature-card home-feature-game group"><span className="home-feature-icon"><Gamepad2 size={19} /></span><span className="min-w-0 flex-1"><small>QUICK PLAY</small><b>테트리스 한 판</b></span><ArrowRight size={16} className="transition group-hover:translate-x-1" /></Link>
        <button type="button" onClick={() => window.dispatchEvent(new Event('gyopo-open-global-chat'))} className="home-feature-card home-feature-live group text-left"><span className="home-feature-icon"><Radio size={19} /></span><span className="min-w-0 flex-1"><small>LIVE BOARD</small><b>지금 올라온 이야기</b></span><ArrowRight size={16} className="transition group-hover:translate-x-1" /></button>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8" aria-labelledby="home-routes-heading">
        <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-teal-300">Start with what matters</p><h2 id="home-routes-heading" className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">지금 필요한 정보</h2></div><span className="hidden text-xs font-bold text-slate-500 sm:block">{regionName}에서 바로 시작</span></div>
        <nav className="home-route-grid" aria-label="생활 카테고리">
          {homeRoutes.map(({ href, service, label, english, detail, icon: Icon, tone }, index) => <Link key={`${href}-${label}`} href={service && selectedRoute ? serviceHref(selectedRoute, service) : href} className="home-route-card group"><div className="flex items-start justify-between gap-3"><span className={`home-route-icon ${tone}`}><Icon size={18} /></span><span className="font-display text-[10px] font-extrabold tracking-[.18em] text-slate-600">0{index + 1}</span></div><div className="mt-5"><h3 className="text-lg font-black text-white transition-colors group-hover:text-teal-100">{label}<span className="ml-2 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{english}</span></h3><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p></div><ArrowUpRight size={16} className="mt-5 text-slate-600 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-teal-300" /></Link>)}
        </nav>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 pb-10 sm:px-6 lg:px-8 2xl:grid-cols-[1.15fr_.85fr]" aria-labelledby="home-board-heading">
        <div className="surface home-board rounded-[28px] p-5 sm:p-6">
          <div className="flex items-end justify-between gap-4 border-b border-white/10 pb-5"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />Live board</div><h2 id="home-board-heading" className="mt-1 text-xl font-black text-white">방금 올라온 이야기</h2></div><Link href="/community" className="inline-flex items-center gap-1 text-xs font-black text-slate-500 transition hover:text-teal-300">전체 보기 <ArrowRight size={13} /></Link></div>
          <div className="divide-y divide-white/8">
            {visiblePosts.length === 0 && <p className="py-10 text-center text-sm text-slate-500">아직 등록된 이야기가 없습니다.</p>}
            {visiblePosts.map((post) => <Link href={post.sourceUrl || `/community/${post.id}`} key={post.id} className="group flex items-center gap-3 py-4"><span className="shrink-0 rounded-lg bg-teal-300/10 px-2 py-1 text-[10px] font-black text-teal-200">{typeLabels[post.type] || '소식'}</span><span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-300 transition group-hover:text-white">{post.title}</span><ArrowUpRight size={14} className="shrink-0 text-slate-600 transition group-hover:text-teal-300" /></Link>)}
          </div>
        </div>
        <aside className="home-support-panel rounded-[28px] border border-white/10 bg-white/[.045] p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-amber-200">Keep connected</p><h2 className="mt-1 text-xl font-black text-white">필요할 때 바로 이어지도록</h2></div><Zap size={18} className="text-amber-200" /></div><p className="mt-3 text-sm leading-6 text-slate-400">실시간 대화, 게임, 라이브 공간은 언제든 다시 열 수 있습니다.</p><div className="mt-5 grid gap-2 sm:grid-cols-2 2xl:grid-cols-1"><Link href="/webrtc" className="inline-flex items-center justify-between rounded-xl bg-white/[.06] px-3 py-3 text-xs font-black text-slate-200 hover:bg-teal-300/10 hover:text-teal-100"><span className="inline-flex items-center gap-2"><Video size={14} />영상채팅</span><ArrowUpRight size={14} /></Link><Link href="/theater" className="inline-flex items-center justify-between rounded-xl bg-white/[.06] px-3 py-3 text-xs font-black text-slate-200 hover:bg-rose-300/10 hover:text-rose-100"><span className="inline-flex items-center gap-2"><Play size={14} />LIVE ROOM</span><ArrowUpRight size={14} /></Link></div></aside>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8" aria-label="앱과 광고">
        <div className="home-lower-grid">
          <Link href="/apps" className="home-apps-card group"><div className="flex items-start justify-between gap-4"><span className="home-route-icon text-violet-200 bg-violet-300/10"><AppWindow size={19} /></span><ArrowUpRight size={18} className="text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-200" /></div><p className="mt-7 text-[10px] font-black uppercase tracking-[.2em] text-violet-200">More from GYOPO</p><h2 className="mt-2 text-2xl font-black text-white">앱으로 더 빠르게</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-400">AI 검색, 랜덤 채팅, 테트리스와 음악을 한 곳에서 열어보세요.</p></Link>
          <div className="home-ad-card rounded-[28px] border border-white/10 bg-white/[.035] p-4 sm:p-5"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[.2em] text-slate-500">Community support</span><span className="text-[10px] font-bold text-slate-600">AD</span></div><BannerAd type="horizontal" /></div>
        </div>
      </section>
    </div>
  );
}
