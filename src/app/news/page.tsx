'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, RefreshCcw, ShieldCheck } from 'lucide-react';
import { listDocuments } from '@/lib/firebase';
import { regionLabel } from '@/lib/regions';
import { useGlobalStore } from '@/store/useGlobalStore';

type SnapshotItem = { title: string; url: string; description?: string; publishedAt?: string };
type Snapshot = { id: string; sourceId: string; sourceName: string; region: string; url: string; title: string; description?: string; fetchedAt: string; verified?: boolean; items?: SnapshotItem[] };

export default function NewsPage() {
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const [items, setItems] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const rows = await listDocuments<Omit<Snapshot, 'id'>>('contentSnapshots').catch(() => []);
    setItems(rows.sort((a, b) => new Date(b.fetchedAt).getTime() - new Date(a.fetchedAt).getTime()));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const visible = items.filter((item) => selectedCountry === 'Global' || item.region === selectedCountry || item.region === 'Global');

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-black uppercase tracking-[.24em] text-teal-500">Verified source desk</p><h1 className="mt-2 text-4xl font-black text-slate-950 dark:text-white">오늘의 교민 정보</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">운영자가 확인한 실제 출처의 최신 홈페이지 요약만 보여드립니다. 원문은 출처 링크에서 확인하세요.</p></div>
      <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"><RefreshCcw size={15} /> 새로고침</button>
    </header>
    {loading && <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">확인된 출처를 불러오는 중입니다...</div>}
    {!loading && visible.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">아직 운영자가 확인한 출처 정보가 없습니다.</div>}
    <div className="grid gap-4 md:grid-cols-2">
      {visible.map((item) => <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]">
        <div className="flex items-center justify-between gap-3 text-xs"><span className="rounded-full bg-teal-50 px-2.5 py-1 font-bold text-teal-700 dark:bg-teal-300/10 dark:text-teal-200">{regionLabel(item.region)}</span>{item.verified && <span className="inline-flex items-center gap-1 font-bold text-emerald-600"><ShieldCheck size={14} /> 확인 출처</span>}</div>
        <h2 className="mt-4 text-xl font-black text-slate-950 dark:text-white">{item.title}</h2>
        {item.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.description}</p>}
        {item.items?.slice(0, 3).map((entry) => <a key={`${item.id}-${entry.url}`} href={entry.url} target="_blank" rel="noreferrer" className="mt-3 block rounded-xl bg-slate-50 p-3 text-sm hover:bg-teal-50 dark:bg-white/5 dark:hover:bg-teal-300/10"><b className="line-clamp-2 text-slate-800 dark:text-slate-200">{entry.title}</b>{entry.description && <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{entry.description}</span>}</a>)}
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-white/10"><span>{item.sourceName} · {new Date(item.fetchedAt).toLocaleString('ko-KR')}</span><a href={item.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-bold text-teal-600 hover:underline">원문 <ExternalLink size={13} /></a></div>
      </article>)}
    </div>
  </div>;
}
