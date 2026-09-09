'use client';

import Link from 'next/link';
import { ChevronDown, ChevronUp, Heart, Pause, Play, Search, SkipBack, SkipForward, Volume2, VolumeX, Music2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { emitMusicEvent, MUSIC_HOT_KEYWORDS, MUSIC_TRACKS, searchMusicTracks, type MusicSyncDetail, type MusicTrack } from '@/lib/music';

function sendPlayerCommand(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
}

export default function MusicPlayer() {
  const [track, setTrack] = useState<MusicTrack>(MUSIC_TRACKS[0]);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<MusicTrack[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const pendingSyncRef = useRef<MusicSyncDetail | null>(null);
  const localResults = useMemo(() => searchMusicTracks(query), [query]);
  const results = query.trim() ? (remoteResults.length ? remoteResults : localResults) : MUSIC_TRACKS;

  useEffect(() => {
    const savedVolume = Number(window.localStorage.getItem('gyopo-music-volume'));
    if (Number.isFinite(savedVolume)) setVolume(Math.min(100, Math.max(0, savedVolume)));
    try {
      setFavoriteIds(JSON.parse(window.localStorage.getItem('gyopo-music-favorites') || '[]'));
    } catch {
      setFavoriteIds([]);
    }
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

  const syncFrame = (detail?: MusicSyncDetail) => {
    const current = detail || pendingSyncRef.current;
    sendPlayerCommand(frameRef.current, 'loadVideoById', [current?.track.videoId || track.videoId]);
    sendPlayerCommand(frameRef.current, 'setVolume', [current?.volume ?? volume]);
    if (current?.position) sendPlayerCommand(frameRef.current, 'seekTo', [current.position, true]);
    if (current?.playing ?? playing) sendPlayerCommand(frameRef.current, 'playVideo');
    else sendPlayerCommand(frameRef.current, 'pauseVideo');
    pendingSyncRef.current = null;
  };

  useEffect(() => {
    const receiveMusicSync = (event: Event) => {
      const detail = (event as CustomEvent<MusicSyncDetail>).detail;
      if (!detail?.track?.videoId) return;
      pendingSyncRef.current = detail;
      setTrack(detail.track);
      setPlaying(detail.playing);
      if (typeof detail.volume === 'number') setVolume(detail.volume);
      window.setTimeout(() => syncFrame(detail), 180);
    };
    window.addEventListener('gyopo-music-sync', receiveMusicSync);
    window.addEventListener('gyopo-music-local', receiveMusicSync);
    const sendCurrentMusic = () => emitMusicEvent('gyopo-music-local', { source: 'local', track, playing, position: 0, startedAt: Date.now(), volume });
    window.addEventListener('gyopo-music-request-state', sendCurrentMusic);
    return () => {
      window.removeEventListener('gyopo-music-sync', receiveMusicSync);
      window.removeEventListener('gyopo-music-local', receiveMusicSync);
      window.removeEventListener('gyopo-music-request-state', sendCurrentMusic);
    };
  }, [playing, track, volume]);

  const selectTrack = (next: MusicTrack) => {
    setTrack(next);
    setPlaying(true);
    const detail: MusicSyncDetail = { source: 'local', track: next, playing: true, position: 0, startedAt: Date.now(), volume };
    pendingSyncRef.current = detail;
    emitMusicEvent('gyopo-music-local', detail);
  };

  const selectRelativeTrack = (direction: -1 | 1) => {
    const index = MUSIC_TRACKS.findIndex((item) => item.id === track.id);
    selectTrack(MUSIC_TRACKS[(index + direction + MUSIC_TRACKS.length) % MUSIC_TRACKS.length]);
  };

  const togglePlaying = () => {
    const next = !playing;
    setPlaying(next);
    sendPlayerCommand(frameRef.current, next ? 'playVideo' : 'pauseVideo');
    emitMusicEvent('gyopo-music-local', { source: 'local', track, playing: next, position: 0, startedAt: Date.now(), volume });
  };

  const changeVolume = (next: number) => {
    setVolume(next);
    window.localStorage.setItem('gyopo-music-volume', String(next));
    sendPlayerCommand(frameRef.current, 'setVolume', [next]);
    emitMusicEvent('gyopo-music-local', { source: 'local', track, playing, position: 0, startedAt: Date.now(), volume: next });
  };

  const toggleFavorite = (item: MusicTrack) => {
    const next = favoriteIds.includes(item.id) ? favoriteIds.filter((id) => id !== item.id) : [...favoriteIds, item.id];
    setFavoriteIds(next);
    window.localStorage.setItem('gyopo-music-favorites', JSON.stringify(next));
  };

  useEffect(() => {
    sendPlayerCommand(frameRef.current, 'setVolume', [volume]);
    if (playing) sendPlayerCommand(frameRef.current, 'playVideo');
  }, [track.videoId, playing, volume]);

  return (
    <section className="border-b border-white/10 bg-[#0b1222] px-3 py-2 text-white shadow-[0_8px_30px_rgba(0,0,0,.18)] sm:px-5">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3">
        <Music2 size={17} className="shrink-0 text-teal-300" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <b className="truncate text-sm">{track.title}</b>
            <span className="hidden truncate text-xs text-slate-400 sm:block">{track.artist}</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">GYOPO K-POP RADIO</div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => selectRelativeTrack(-1)} aria-label="이전 곡" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><SkipBack size={15} /></button>
           <button type="button" onClick={togglePlaying} aria-label={playing ? '일시정지' : '재생'} className="rounded-full bg-teal-300 p-2 text-slate-950 hover:bg-teal-200">
             {playing ? <Pause size={15} /> : <Play size={15} />}
           </button>
           <button type="button" onClick={() => selectRelativeTrack(1)} aria-label="다음 곡" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><SkipForward size={15} /></button>
         </div>
         <div className="hidden items-center gap-1.5 sm:flex"><span className="text-slate-500">{volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}</span><input aria-label="음악 볼륨" type="range" min="0" max="100" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} className="w-16 accent-teal-300" /></div>
         <button type="button" onClick={() => toggleFavorite(track)} aria-label="즐겨찾기" className={`rounded-lg p-2 ${favoriteIds.includes(track.id) ? 'text-rose-300' : 'text-slate-400'} hover:bg-white/10`}><Heart size={15} fill={favoriteIds.includes(track.id) ? 'currentColor' : 'none'} /></button>
        <Link href="/music" className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-300 hover:border-teal-300/40 hover:text-teal-200 sm:block">MUSIC</Link>
        <button type="button" onClick={() => setExpanded((open) => !open)} aria-label="음악 검색 열기" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
         <iframe ref={frameRef} onLoad={() => syncFrame()} title="GYOPO music player" src={`https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&origin=https%3A%2F%2Fgyopo.pages.dev&autoplay=0`} className="pointer-events-none absolute h-px w-px opacity-0" allow="autoplay; encrypted-media" />
      </div>

      {expanded && (
        <div className="mx-auto mt-3 max-w-[1440px] border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Search size={15} className="text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="곡·아티스트 검색" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MUSIC_HOT_KEYWORDS.map((keyword) => <button type="button" key={keyword} onClick={() => setQuery(keyword)} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:border-teal-300/40 hover:text-teal-200">#{keyword}</button>)}
            </div>
          </div>
           {query && <div className="mt-3 grid gap-2 sm:grid-cols-2">{results.length ? results.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${item.id === track.id ? 'border-teal-300/50 bg-teal-300/10' : 'border-white/10 bg-white/5'}`}><button type="button" onClick={() => selectTrack(item)} className="flex min-w-0 flex-1 items-center gap-2 text-left">{item.thumbnail && <img src={item.thumbnail} alt="" className="h-10 w-16 rounded object-cover" />}<span className="min-w-0"><b className="block truncate text-xs">{item.title}</b><span className="block truncate text-[11px] text-slate-400">{item.artist}</span><span className="block truncate text-[10px] text-slate-500">{item.views || 'YouTube 검색 결과'}{item.published ? ` · ${item.published}` : ''}</span></span></button><button type="button" onClick={() => toggleFavorite(item)} aria-label="즐겨찾기" className={favoriteIds.includes(item.id) ? 'text-rose-300' : 'text-slate-500'}><Heart size={14} fill={favoriteIds.includes(item.id) ? 'currentColor' : 'none'} /></button></div>) : <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-teal-200 underline">YouTube에서 이 키워드 검색하기</a>}</div>}
        </div>
      )}
    </section>
  );
}
'use client';

import Link from 'next/link';
import { ChevronDown, ChevronUp, Pause, Play, Search, SkipBack, SkipForward, Music2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MUSIC_HOT_KEYWORDS, MUSIC_TRACKS, searchMusicTracks, type MusicTrack } from '@/lib/music';

function sendPlayerCommand(frame: HTMLIFrameElement | null, func: 'playVideo' | 'pauseVideo') {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), 'https://www.youtube.com');
}

export default function MusicPlayer() {
  const [track, setTrack] = useState<MusicTrack>(MUSIC_TRACKS[0]);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const frameRef = useRef<HTMLIFrameElement>(null);
  const results = useMemo(() => searchMusicTracks(query), [query]);

  const selectTrack = (next: MusicTrack) => {
    setTrack(next);
    setPlaying(true);
  };

  const selectRelativeTrack = (direction: -1 | 1) => {
    const index = MUSIC_TRACKS.findIndex((item) => item.id === track.id);
    selectTrack(MUSIC_TRACKS[(index + direction + MUSIC_TRACKS.length) % MUSIC_TRACKS.length]);
  };

  useEffect(() => {
    if (playing) sendPlayerCommand(frameRef.current, 'playVideo');
  }, [track.videoId, playing]);

  return (
    <section className="border-b border-white/10 bg-[#0b1222] px-3 py-2 text-white shadow-[0_8px_30px_rgba(0,0,0,.18)] sm:px-5">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3">
        <Music2 size={17} className="shrink-0 text-teal-300" />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <b className="truncate text-sm">{track.title}</b>
            <span className="hidden truncate text-xs text-slate-400 sm:block">{track.artist}</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">GYOPO K-POP RADIO</div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => selectRelativeTrack(-1)} aria-label="이전 곡" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><SkipBack size={15} /></button>
          <button type="button" onClick={() => { const next = !playing; setPlaying(next); sendPlayerCommand(frameRef.current, next ? 'playVideo' : 'pauseVideo'); }} aria-label={playing ? '일시정지' : '재생'} className="rounded-full bg-teal-300 p-2 text-slate-950 hover:bg-teal-200">
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button type="button" onClick={() => selectRelativeTrack(1)} aria-label="다음 곡" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><SkipForward size={15} /></button>
        </div>
        <Link href="/music" className="hidden rounded-lg border border-white/10 px-3 py-2 text-xs font-black text-slate-300 hover:border-teal-300/40 hover:text-teal-200 sm:block">MUSIC</Link>
        <button type="button" onClick={() => setExpanded((open) => !open)} aria-label="음악 검색 열기" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <iframe ref={frameRef} onLoad={() => { if (playing) sendPlayerCommand(frameRef.current, 'playVideo'); }} title="GYOPO music player" src={`https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&origin=https%3A%2F%2Fgyopo.pages.dev&autoplay=0`} className="pointer-events-none absolute h-px w-px opacity-0" allow="autoplay; encrypted-media" />
      </div>

      {expanded && (
        <div className="mx-auto mt-3 max-w-[1440px] border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <Search size={15} className="text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="곡·아티스트 검색" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MUSIC_HOT_KEYWORDS.map((keyword) => <button type="button" key={keyword} onClick={() => setQuery(keyword)} className="rounded-full border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:border-teal-300/40 hover:text-teal-200">#{keyword}</button>)}
            </div>
          </div>
          {query && <div className="mt-3 grid gap-2 sm:grid-cols-3">{results.length ? results.map((item) => <button type="button" key={item.id} onClick={() => selectTrack(item)} className={`rounded-xl border px-3 py-2 text-left ${item.id === track.id ? 'border-teal-300/50 bg-teal-300/10' : 'border-white/10 bg-white/5 hover:border-white/20'}`}><b className="block truncate text-xs">{item.title}</b><span className="text-[11px] text-slate-500">{item.artist}</span></button>) : <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-teal-200 underline">YouTube에서 이 키워드 검색하기</a>}</div>}
        </div>
      )}
    </section>
  );
}
