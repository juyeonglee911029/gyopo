'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock3, Newspaper, Radio, RefreshCcw, ShieldCheck } from 'lucide-react';
import { listDocuments } from '@/lib/firebase';
import { regionLabel } from '@/lib/regions';
import { CONTENT_SOURCES, sourceItemId } from '@/lib/contentSources';
import { useGlobalStore } from '@/store/useGlobalStore';

type SnapshotItem = { title: string; url: string; description?: string; body?: string; publishedAt?: string; category?: string };
type SnapshotSection = { category: string; label: string; url: string; items: SnapshotItem[] };
type Snapshot = { id: string; sourceId: string; sourceName: string; region: string; url: string; title: string; description?: string; fetchedAt: string; verified?: boolean; items?: SnapshotItem[]; sections?: SnapshotSection[]; sourceSnapshot?: boolean };
type NewsStory = { entry: SnapshotItem; category: string; categoryLabel: string; source: Snapshot };

const categoryLabels: Record<string, string> = { news: '뉴스', events: '행사', jobs: '구인구직', directory: '업소', market: '장터', community: '커뮤니티' };

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

export default function NewsPage() {
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const [items, setItems] = useState<Snapshot[]>([]);
  const [liveSources, setLiveSources] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

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
      const sources = CONTENT_SOURCES.filter((source) => source.autoImport && source.categories.includes('news') && (selectedCountry === 'Global' || source.region === selectedCountry || source.region === 'Global'));
      const direct = await Promise.all(sources.slice(0, 24).map(async (source) => {
        const response = await fetch(`/api/content/preview?source=${encodeURIComponent(source.id)}`).catch(() => null);
        return response?.ok ? response.json() as Promise<Snapshot> : null;
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
  const storyKeys = new Set<string>();
  const stories: NewsStory[] = [];
  visible.forEach((source) => {
    source.sections?.filter((section) => section.category === 'news' && section.items.length).forEach((section) => section.items.forEach((entry) => {
      const key = `${source.sourceId}:${entry.url}`;
      if (storyKeys.has(key)) return;
      storyKeys.add(key);
      stories.push({ entry, category: section.category, categoryLabel: section.label || categoryLabels[section.category] || '소식', source });
    }));
    const sourceCategory = CONTENT_SOURCES.find((item) => item.id === source.sourceId)?.categories[0];
    source.items?.filter((entry) => (entry.category || sourceCategory || 'news') === 'news').forEach((entry) => {
      const key = `${source.sourceId}:${entry.url}`;
      if (storyKeys.has(key)) return;
      storyKeys.add(key);
      stories.push({ entry, category: 'news', categoryLabel: categoryLabels.news, source });
    });
  });
  stories.sort((a, b) => new Date(b.entry.publishedAt || b.source.fetchedAt).getTime() - new Date(a.entry.publishedAt || a.source.fetchedAt).getTime());
  const regionName = selectedCountry === 'Global' ? '글로벌' : regionLabel(selectedCountry);

  return (
    <div className="min-h-screen bg-[#070b17] text-slate-100">
      <header className="border-b border-white/10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-emerald-200"><Radio size={12} /> {regionName} live desk</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">오늘의 뉴스</h1>
            <p className="mt-2 text-sm text-slate-400">카테고리 선택 없이 최신 소식을 목록에서 바로 확인하세요.</p>
          </div>
          <button onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-3 text-xs font-black text-slate-200 transition hover:border-teal-300/30 hover:text-teal-200"><RefreshCcw size={14} /> 새로고침</button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-teal-300">Latest stories</p><h2 className="mt-1 text-lg font-black text-white">최신 소식 <span className="text-slate-500">{stories.length}</span></h2></div><span className="text-xs text-slate-500">행을 클릭하면 원문을 확인합니다</span></div>
        {loading && stories.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm font-bold text-slate-500">확인된 출처를 불러오는 중입니다...</div>}
        {!loading && stories.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm font-bold text-slate-500"><Newspaper size={26} className="mx-auto mb-3 text-slate-600" />선택한 지역의 뉴스가 없습니다.</div>}
        {stories.length > 0 && <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d1527]">
          <div className="hidden grid-cols-[100px_minmax(0,1fr)_160px_110px] gap-4 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[.14em] text-slate-500 md:grid"><span>분류</span><span>제목</span><span>출처</span><span>업데이트</span></div>
          <div className="divide-y divide-white/7">{stories.map((story) => <Link key={`${story.source.sourceId}-${story.category}-${story.entry.url}`} href={contentHref(story.source.sourceId, story.category, story.entry)} className="grid gap-2 px-4 py-3 transition hover:bg-white/[.05] md:grid-cols-[100px_minmax(0,1fr)_160px_110px] md:items-center md:gap-4"><div className="flex items-center gap-2 text-[10px] font-black"><span className="rounded-full bg-teal-300/10 px-2 py-1 text-teal-200">{story.categoryLabel}</span><span className="text-slate-500 md:hidden">{regionLabel(story.source.region)}</span></div><div className="min-w-0"><h3 className="truncate text-sm font-bold text-white">{story.entry.title}</h3><p className="mt-1 line-clamp-1 text-xs text-slate-400">{story.entry.description || story.entry.body || '원문에서 자세한 내용을 확인하세요.'}</p></div><div className="flex min-w-0 items-center gap-1.5 text-xs text-slate-300"><span className="truncate">{story.source.sourceName}</span>{story.source.verified && <ShieldCheck size={12} className="shrink-0 text-emerald-300" />}</div><div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Clock3 size={12} />{formatStoryDate(story.entry.publishedAt || story.source.fetchedAt)}</div></Link>)}</div>
        </div>}
      </main>
    </div>
  );
}
