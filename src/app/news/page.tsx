'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight, Clock3, Newspaper, Radio, RefreshCcw, ShieldCheck } from 'lucide-react';
import { listDocuments } from '@/lib/firebase';
import { regionLabel } from '@/lib/regions';
import { CONTENT_SOURCES, sourceItemId } from '@/lib/contentSources';
import { useGlobalStore } from '@/store/useGlobalStore';

type SnapshotItem = { title: string; url: string; description?: string; body?: string; image?: string; images?: string[]; publishedAt?: string };
type SnapshotSection = { category: string; label: string; url: string; items: SnapshotItem[] };
type Snapshot = { id: string; sourceId: string; sourceName: string; region: string; url: string; title: string; description?: string; image?: string; images?: string[]; fetchedAt: string; verified?: boolean; status?: string; items?: SnapshotItem[]; sections?: SnapshotSection[]; sourceSnapshot?: boolean };
type NewsStory = { entry: SnapshotItem; category: string; categoryLabel: string; source: Snapshot };

const categoryLabels: Record<string, string> = {
  news: '뉴스',
  events: '행사',
  jobs: '구인구직',
  directory: '업소',
  market: '장터',
  community: '커뮤니티',
};

function contentHref(sourceId: string, category: string, entry: SnapshotItem) {
  return `/content/${sourceItemId(sourceId, category, entry.url)}?source=${encodeURIComponent(sourceId)}&category=${encodeURIComponent(category)}&url=${encodeURIComponent(entry.url)}`;
}

function formatStoryDate(value?: string) {
  if (!value) return '최신 업데이트';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '최신 업데이트';
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

async function loadStoredSources() {
  const [rows, posts] = await Promise.all([
    listDocuments<Omit<Snapshot, 'id'>>('contentSnapshots').catch(() => []),
    listDocuments<Snapshot>('posts').catch(() => []),
  ]);
  const knownSources = new Set(rows.map((row) => row.sourceId));
  const fallbackRows = posts.filter((post) => post.sourceSnapshot && post.sourceId && !knownSources.has(post.sourceId));
  return [...rows, ...fallbackRows].sort((a, b) => new Date(b.fetchedAt || '').getTime() - new Date(a.fetchedAt || '').getTime());
}

function StoryCard({ story, featured = false }: { story: NewsStory; featured?: boolean }) {
  const image = story.entry.image || story.entry.images?.[0] || story.source.image || story.source.images?.[0];
  const publishedAt = story.entry.publishedAt || story.source.fetchedAt;

  return (
    <Link href={contentHref(story.source.sourceId, story.category, story.entry)} className={`news-story-card group relative flex overflow-hidden rounded-[26px] border border-white/10 bg-[#10182b] transition duration-300 hover:-translate-y-1 hover:border-teal-300/35 hover:shadow-[0_24px_70px_rgba(0,0,0,.28)] ${featured ? 'min-h-[360px] flex-col md:grid md:grid-cols-[1.1fr_.9fr]' : 'min-h-[310px] flex-col'}`}>
      {image ? (
        <div className={`relative overflow-hidden bg-slate-900 ${featured ? 'min-h-52 md:order-2 md:min-h-full' : 'h-44'}`}>
          <Image src={image} alt="" fill unoptimized sizes={featured ? '(min-width: 768px) 40vw, 100vw' : '(min-width: 768px) 50vw, 100vw'} className="object-cover transition duration-500 group-hover:scale-[1.03]" />
        </div>
      ) : (
        <div className={`news-story-placeholder relative flex items-center justify-center overflow-hidden ${featured ? 'min-h-48 md:order-2 md:min-h-full' : 'h-36'}`} aria-hidden="true">
          <Newspaper size={featured ? 54 : 38} strokeWidth={1.25} className="relative z-10 text-white/70" />
        </div>
      )}
      <div className={`flex flex-1 flex-col ${featured ? 'p-6 sm:p-8' : 'p-5'}`}>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.14em]">
          <span className="rounded-full bg-teal-300/10 px-2.5 py-1 text-teal-200">{story.categoryLabel}</span>
          <span className="text-slate-500">{regionLabel(story.source.region)}</span>
          {story.source.verified && <span className="inline-flex items-center gap-1 text-emerald-300"><ShieldCheck size={12} /> 확인 출처</span>}
        </div>
        <h2 className={`mt-4 font-black leading-snug tracking-[-.025em] text-white ${featured ? 'text-2xl sm:text-3xl' : 'line-clamp-3 text-lg'}`}>{story.entry.title}</h2>
        {story.entry.description && <p className={`mt-3 text-sm leading-6 text-slate-400 ${featured ? 'line-clamp-3' : 'line-clamp-2'}`}>{story.entry.description}</p>}
        <div className="mt-auto pt-6">
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-500"><span className="max-w-[65%] truncate font-bold text-slate-300">{story.source.sourceName}</span><span>·</span><Clock3 size={12} /><span>{formatStoryDate(publishedAt)}</span></div>
          <div className="flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-xs font-black text-teal-200">기사 읽기</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[.06] text-white transition group-hover:border-teal-300/30 group-hover:bg-teal-300 group-hover:text-slate-950"><ArrowUpRight size={16} /></span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function NewsPage() {
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const [items, setItems] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveSources, setLiveSources] = useState<Snapshot[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSource, setActiveSource] = useState('all');
  const [filterRegion, setFilterRegion] = useState(selectedCountry);

  const load = async () => {
    setLoading(true);
    setItems(await loadStoredSources());
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    void loadStoredSources().then((nextItems) => {
      if (!active) return;
      setItems(nextItems);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadLive = async () => {
      const exactSources = selectedCountry === 'Global'
        ? CONTENT_SOURCES.filter((source) => source.categories.includes('news')).slice(0, 10)
        : CONTENT_SOURCES.filter((source) => source.region === selectedCountry && source.categories.includes('news'));
      const direct = await Promise.all(exactSources.map(async (source) => {
        const response = await fetch(`/api/content/preview?source=${encodeURIComponent(source.id)}`).catch(() => null);
        if (!response?.ok) return null;
        return response.json() as Promise<Snapshot>;
      }));
      const regionalResponse = await fetch(`/api/content/preview?region=${encodeURIComponent(selectedCountry)}`).catch(() => null);
      const regional = regionalResponse?.ok ? await regionalResponse.json() as Snapshot : null;
      const next = [...direct.filter((snapshot): snapshot is Snapshot => Boolean(snapshot && (snapshot.items?.length || snapshot.sections?.some((section) => section.items.length)))), ...(regional?.items?.length ? [regional] : [])]
        .map((snapshot) => ({ ...snapshot, id: snapshot.id || snapshot.sourceId }));
      if (active) setLiveSources(next);
    };
    void loadLive();
    return () => { active = false; };
  }, [selectedCountry]);

  const liveIds = new Set(liveSources.map((item) => item.sourceId));
  const visible = [...liveSources, ...items.filter((item) => !liveIds.has(item.sourceId))].filter((item) => selectedCountry === 'Global' || item.region === selectedCountry || item.region === 'Global');
  const sourceOptions = visible.filter((source, index, sources) => sources.findIndex((candidate) => candidate.sourceId === source.sourceId) === index);
  const storyKeys = new Set<string>();
  const stories: NewsStory[] = [];

  visible.forEach((source) => {
    source.sections?.filter((section) => section.items.length).forEach((section) => {
      section.items.forEach((entry) => {
        const key = `${source.sourceId}:${entry.url}`;
        if (storyKeys.has(key)) return;
        storyKeys.add(key);
        stories.push({ entry, category: section.category, categoryLabel: section.label || categoryLabels[section.category] || '소식', source });
      });
    });
    source.items?.forEach((entry) => {
      const key = `${source.sourceId}:${entry.url}`;
      if (storyKeys.has(key)) return;
      storyKeys.add(key);
      stories.push({ entry, category: 'news', categoryLabel: categoryLabels.news, source });
    });
  });

  const categoryOptions = Array.from(new Map(stories.map((story) => [story.category, story.categoryLabel])).entries());
  const currentCategory = filterRegion === selectedCountry ? activeCategory : 'all';
  const currentSource = filterRegion === selectedCountry ? activeSource : 'all';
  const filteredStories = stories.filter((story) => (currentCategory === 'all' || story.category === currentCategory) && (currentSource === 'all' || story.source.sourceId === currentSource));
  const regionName = selectedCountry === 'Global' ? '글로벌' : regionLabel(selectedCountry);

  const selectCategory = (category: string) => {
    setFilterRegion(selectedCountry);
    setActiveCategory(category);
  };

  const selectSource = (source: string) => {
    setFilterRegion(selectedCountry);
    setActiveSource(source);
    setActiveCategory('all');
  };

  const resetFilters = () => {
    setFilterRegion(selectedCountry);
    setActiveCategory('all');
    setActiveSource('all');
  };

  return (
    <div className="news-page min-h-screen bg-[#070b17] text-slate-100">
      <section className="relative overflow-hidden border-b border-white/10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="home-grid absolute inset-0 opacity-35" />
        <div className="news-header-glow pointer-events-none absolute -right-20 -top-40 h-96 w-96 rounded-full" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 text-[10px] font-black uppercase tracking-[.2em]"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-emerald-200"><Radio size={12} /> Live desk</span><span className="text-slate-500">{regionName} 에디션</span></div>
            <h1 className="font-display mt-5 text-4xl font-extrabold tracking-[-.055em] text-white sm:text-6xl">오늘의 뉴스</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">카테고리나 출처를 고른 뒤, 읽고 싶은 카드 전체를 누르세요. 검증된 출처의 최신 소식으로 바로 연결됩니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[.05] px-1 py-3 text-center"><div className="min-w-20 px-4"><strong className="font-display block text-xl font-extrabold text-white">{sourceOptions.length}</strong><span className="text-[10px] font-bold text-slate-500">확인 출처</span></div><div className="min-w-20 px-4"><strong className="font-display block text-xl font-extrabold text-white">{stories.length}</strong><span className="text-[10px] font-bold text-slate-500">새 소식</span></div></div>
            <button onClick={() => void load()} className="inline-flex min-h-14 items-center gap-2 rounded-2xl border border-white/10 bg-white/[.06] px-4 text-xs font-black text-slate-200 transition hover:border-teal-300/30 hover:text-teal-200"><RefreshCcw size={15} /> 새로고침</button>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 lg:px-8">
        <nav className="rounded-[26px] border border-white/10 bg-[#0d1527] p-4 shadow-[0_18px_55px_rgba(0,0,0,.16)]" aria-label="뉴스 필터">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Category</span>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
              <button onClick={() => selectCategory('all')} aria-pressed={currentCategory === 'all'} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition ${currentCategory === 'all' ? 'bg-teal-300 text-slate-950' : 'bg-white/[.06] text-slate-400 hover:text-white'}`}>전체</button>
              {categoryOptions.map(([category, label]) => <button key={category} onClick={() => selectCategory(category)} aria-pressed={currentCategory === category} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition ${currentCategory === category ? 'bg-teal-300 text-slate-950' : 'bg-white/[.06] text-slate-400 hover:text-white'}`}>{label}</button>)}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-4">
            <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Source</span>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
              <button onClick={() => selectSource('all')} aria-pressed={currentSource === 'all'} className={`shrink-0 rounded-xl border px-3.5 py-2 text-left text-xs font-black transition ${currentSource === 'all' ? 'border-white/20 bg-white text-slate-950' : 'border-white/10 bg-white/[.035] text-slate-400 hover:border-white/20 hover:text-white'}`}>모든 출처</button>
              {sourceOptions.map((source) => <button key={source.sourceId} onClick={() => selectSource(source.sourceId)} aria-pressed={currentSource === source.sourceId} className={`shrink-0 rounded-xl border px-3.5 py-2 text-left transition ${currentSource === source.sourceId ? 'border-white/20 bg-white text-slate-950' : 'border-white/10 bg-white/[.035] text-slate-400 hover:border-white/20 hover:text-white'}`}><span className="block max-w-44 truncate text-xs font-black">{source.sourceName}</span><span className={`mt-0.5 block text-[9px] font-bold ${currentSource === source.sourceId ? 'text-slate-500' : 'text-slate-600'}`}>{regionLabel(source.region)}</span></button>)}
            </div>
          </div>
        </nav>

        <div className="mb-5 mt-8 flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-teal-300">Latest stories</p><h2 className="mt-1 text-xl font-black text-white">읽을 수 있는 이야기 <span className="text-slate-600">{filteredStories.length}</span></h2></div>{(currentCategory !== 'all' || currentSource !== 'all') && <button onClick={resetFilters} className="inline-flex items-center gap-1 text-xs font-black text-slate-500 transition hover:text-teal-200">필터 초기화 <ArrowRight size={13} /></button>}</div>

        {loading && stories.length === 0 && <div className="rounded-[26px] border border-dashed border-white/15 bg-white/[.03] p-12 text-center text-sm font-bold text-slate-500">확인된 출처를 불러오는 중입니다...</div>}
        {!loading && filteredStories.length === 0 && <div className="rounded-[26px] border border-dashed border-white/15 bg-white/[.03] p-12 text-center"><Newspaper size={28} className="mx-auto text-slate-600" /><p className="mt-4 text-sm font-bold text-slate-400">선택한 조건에 맞는 이야기가 없습니다.</p><button onClick={resetFilters} className="mt-3 text-xs font-black text-teal-300">전체 뉴스 보기</button></div>}

        {filteredStories[0] && <StoryCard story={filteredStories[0]} featured />}
        {filteredStories.length > 1 && <div className="mt-4 grid gap-4 md:grid-cols-2">{filteredStories.slice(1).map((story) => <StoryCard key={`${story.source.sourceId}-${story.category}-${story.entry.url}`} story={story} />)}</div>}
      </main>
    </div>
  );
}
