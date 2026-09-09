'use client';

import { Pause, Play, Search, Music2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { emitMusicEvent, MUSIC_HOT_KEYWORDS, MUSIC_TRACKS, searchMusicTracks, type MusicSyncDetail, type MusicTrack } from '@/lib/music';

export default function MusicPage() {
  const [track, setTrack] = useState<MusicTrack>(MUSIC_TRACKS[0]);
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<MusicTrack[]>([]);
  const [volume, setVolume] = useState(70);
  const [playing, setPlaying] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const originRef = useRef('music-page');
  const localResults = useMemo(() => searchMusicTracks(query), [query]);
  const results = query.trim() ? (remoteResults.length ? remoteResults : localResults) : MUSIC_TRACKS;

  useEffect(() => {
    const saved = Number(window.localStorage.getItem('gyopo-music-volume'));
    if (Number.isFinite(saved)) setVolume(Math.min(100, Math.max(0, saved)));
    const syncTopPlayer = (event: Event) => {
      const detail = (event as CustomEvent<MusicSyncDetail>).detail;
      if (!detail?.track?.videoId || detail.player !== 'top') return;
      setTrack(detail.track);
      setPlaying(detail.playing);
      if (typeof detail.volume === 'number') setVolume(detail.volume);
    };
    window.addEventListener('gyopo-music-local', syncTopPlayer);
    window.dispatchEvent(new Event('gyopo-music-request-state'));
    return () => window.removeEventListener('gyopo-music-local', syncTopPlayer);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setRemoteResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/music/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then((response) => response.json())
        .then((data: { results?: MusicTrack[] }) => setRemoteResults(data.results || []))
        .catch(() => undefined);
    }, 280);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const selectTrack = (item: MusicTrack) => {
    setTrack(item);
    setPlaying(true);
    emitMusicEvent('gyopo-music-local', { source: 'local', player: 'top', origin: originRef.current, track: item, playing: true, position: 0, startedAt: Date.now(), volume });
  };

  const togglePlaying = () => {
    const next = !playing;
    setPlaying(next);
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: next ? 'playVideo' : 'pauseVideo', args: [] }), 'https://www.youtube.com');
    emitMusicEvent('gyopo-music-local', { source: 'local', player: 'top', origin: originRef.current, track, playing: next, position: 0, startedAt: Date.now(), volume });
  };

  const changeVolume = (next: number) => {
    setVolume(next);
    window.localStorage.setItem('gyopo-music-volume', String(next));
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [next] }), 'https://www.youtube.com');
    emitMusicEvent('gyopo-music-local', { source: 'local', player: 'top', origin: originRef.current, track, playing, position: 0, startedAt: Date.now(), volume: next });
  };

  return (
    <div className="music-page min-h-screen bg-[#070b17] px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-teal-300"><Music2 size={16} /> K-pop video</div><h1 className="text-4xl font-black tracking-tight md:text-6xl">K-POP MUSIC</h1><p className="mt-3 text-sm text-slate-400">등록곡뿐 아니라 YouTube에서 검색한 뮤직비디오도 바로 재생하고 함께 들을 수 있습니다.</p></div>
          <div className="flex flex-wrap gap-2">{MUSIC_HOT_KEYWORDS.map((keyword) => <button type="button" key={keyword} onClick={() => setQuery(keyword)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300 hover:border-teal-300/50 hover:text-teal-200">#{keyword}</button>)}</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#10182b] shadow-2xl">
              <div className="aspect-video bg-black"><iframe ref={frameRef} key={track.videoId} onLoad={() => { const frame = frameRef.current?.contentWindow; frame?.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), 'https://www.youtube.com'); frame?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }), 'https://www.youtube.com'); frame?.postMessage(JSON.stringify({ event: 'command', func: playing ? 'playVideo' : 'pauseVideo', args: [] }), 'https://www.youtube.com'); }} src={`https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&origin=https%3A%2F%2Fgyopo.pages.dev&autoplay=1&mute=1&rel=0`} title={track.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 md:p-7"><div><div className="text-xs font-black uppercase tracking-[0.2em] text-teal-300">Now playing</div><h2 className="mt-2 text-3xl font-black">{track.title}</h2><p className="mt-1 text-sm font-bold text-slate-400">{track.artist}</p><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500"><span className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1.5">조회수 · {track.views || '집계 중'}</span><span className="rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1.5">공개일 · {track.published || '정보 확인 중'}</span></div></div><div className="flex items-center gap-3"><button type="button" onClick={togglePlaying} className="flex items-center gap-2 rounded-xl bg-teal-300 px-3 py-2 text-xs font-black text-slate-950">{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? '일시정지' : '재생'}</button><label className="flex items-center gap-2 text-xs text-slate-400">볼륨<input type="range" min="0" max="100" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} className="accent-teal-300" /></label></div></div>
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"><Search size={16} className="text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="YouTube 곡·가수 검색" className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" /></div>
            <h3 className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-slate-500">YouTube 검색 결과</h3>
            <div className="mt-3 space-y-2">{results.map((item) => <button type="button" key={item.id} onClick={() => selectTrack(item)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${track.id === item.id ? 'border-teal-300/50 bg-teal-300/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>{item.thumbnail ? <img src={item.thumbnail} alt="" className="h-12 w-20 rounded object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-teal-300"><Play size={14} fill="currentColor" /></span>}<span className="min-w-0"><b className="block truncate text-sm">{item.title}</b><span className="block truncate text-xs text-slate-400">{item.artist}</span><span className="block truncate text-[10px] text-slate-500">{item.views || '등록곡'}{item.published ? ` · ${item.published}` : ''}</span></span></button>)}{!results.length && <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" className="block text-sm font-bold text-teal-200 underline">YouTube에서 이 키워드 검색하기</a>}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
