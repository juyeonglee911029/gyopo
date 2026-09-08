'use client';

import { Search, Play, Music2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { MUSIC_HOT_KEYWORDS, MUSIC_TRACKS, searchMusicTracks, type MusicTrack } from '@/lib/music';

export default function MusicPage() {
  const [track, setTrack] = useState<MusicTrack>(MUSIC_TRACKS[0]);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMusicTracks(query), [query]);

  return (
    <div className="min-h-screen bg-[#070b17] px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-teal-300"><Music2 size={16} /> K-pop video</div><h1 className="text-4xl font-black tracking-tight md:text-6xl">K-POP MUSIC</h1><p className="mt-3 text-sm text-slate-400">검색하고, 고르고, 바로 함께 듣는 교포 음악관.</p></div>
          <div className="flex flex-wrap gap-2">{MUSIC_HOT_KEYWORDS.map((keyword) => <button type="button" key={keyword} onClick={() => setQuery(keyword)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:border-teal-300/50 hover:text-teal-200">#{keyword}</button>)}</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#10182b] shadow-2xl">
            <div className="aspect-video bg-black"><iframe key={track.videoId} src={`https://www.youtube.com/embed/${track.videoId}?autoplay=1&rel=0`} title={track.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
            <div className="p-5 md:p-7"><div className="text-xs font-black uppercase tracking-[0.2em] text-teal-300">Now playing</div><h2 className="mt-2 text-3xl font-black">{track.title}</h2><p className="mt-1 text-sm font-bold text-slate-400">{track.artist}</p></div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Search size={16} className="text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="곡·아티스트 검색" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" /></div>
            <h3 className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Playlist</h3>
            <div className="mt-3 space-y-2">{results.map((item) => <button type="button" key={item.id} onClick={() => setTrack(item)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${track.id === item.id ? 'border-teal-300/50 bg-teal-300/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-teal-300"><Play size={14} fill="currentColor" /></span><span className="min-w-0"><b className="block truncate text-sm">{item.title}</b><span className="block truncate text-xs text-slate-500">{item.artist}</span></span></button>)}{!results.length && <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" className="block text-sm font-bold text-teal-200 underline">YouTube에서 이 키워드 검색하기</a>}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
