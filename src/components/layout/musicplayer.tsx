'use client';

import Link from 'next/link';
import { Heart, Pause, Play, Search, SkipBack, SkipForward, Volume2, VolumeX, Music2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { emitMusicEvent, emitMusicPlayerEvent, hydrateMusicTrack, musicFavoritesKey, MUSIC_HOT_KEYWORDS, MUSIC_TRACKS, searchMusicTracks, type MusicSyncDetail, type MusicTrack } from '@/lib/music';
import { useGlobalStore } from '@/store/useGlobalStore';

function sendPlayerCommand(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
}

export default function MusicPlayer() {
  const user = useGlobalStore((state) => state.user);
  const [track, setTrack] = useState<MusicTrack>(MUSIC_TRACKS[0]);
  const [catalogTracks, setCatalogTracks] = useState<MusicTrack[]>(MUSIC_TRACKS);
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(70);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [remoteResults, setRemoteResults] = useState<MusicTrack[]>([]);
  const [favoriteTracks, setFavoriteTracks] = useState<MusicTrack[]>([]);
  const [favoritesLoop, setFavoritesLoop] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const searchShellRef = useRef<HTMLElement>(null);
  const pendingSyncRef = useRef<MusicSyncDetail | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const originRef = useRef('top-player');
  const loadedVideoIdRef = useRef<string | null>(null);
  const favoriteStorageKey = musicFavoritesKey(user?.id);
  const localResults = useMemo(() => searchMusicTracks(query).map((item) => catalogTracks.find((catalogItem) => catalogItem.id === item.id) || item), [catalogTracks, query]);
  const results = query.trim() ? (remoteResults.length ? remoteResults : localResults) : catalogTracks;

  useEffect(() => {
    const closeSearch = (event: PointerEvent) => {
      if (!searchShellRef.current?.contains(event.target as Node)) setSearchFocused(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchFocused(false);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    document.addEventListener('pointerdown', closeSearch);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeSearch);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    const savedVolume = Number(window.localStorage.getItem('gyopo-music-volume'));
    if (Number.isFinite(savedVolume)) setVolume(Math.min(100, Math.max(0, savedVolume)));
    try {
      const saved = JSON.parse(window.localStorage.getItem(favoriteStorageKey) || '[]') as unknown;
      if (Array.isArray(saved) && saved.every((item) => typeof item === 'object' && item !== null)) setFavoriteTracks(saved as MusicTrack[]);
      else if (Array.isArray(saved)) setFavoriteTracks(MUSIC_TRACKS.filter((item) => saved.includes(item.id)));
    } catch {
      setFavoriteTracks([]);
    }
  }, [favoriteStorageKey]);

  useEffect(() => {
    const missing = MUSIC_TRACKS.filter((item) => !item.views || !item.published);
    if (!missing.length) return;
    let active = true;
    void Promise.all(missing.map((item) => hydrateMusicTrack(item))).then((enriched) => {
      if (!active) return;
      setCatalogTracks((current) => current.map((item) => enriched.find((next) => next.id === item.id) || item));
    });
    return () => { active = false; };
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
    const videoId = current?.track.videoId || track.videoId;
    const nextVolume = current?.volume ?? volume;
    const nextPlaying = current?.playing ?? playing;
    const needsLoad = loadedVideoIdRef.current !== videoId;
    const applyPlayback = () => {
      if (nextPlaying) sendPlayerCommand(frameRef.current, 'unMute');
      sendPlayerCommand(frameRef.current, 'setVolume', [nextVolume]);
      if (current?.position) sendPlayerCommand(frameRef.current, 'seekTo', [current.position, true]);
      sendPlayerCommand(frameRef.current, nextPlaying ? 'playVideo' : 'pauseVideo');
    };
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    if (needsLoad) {
      loadedVideoIdRef.current = videoId;
      sendPlayerCommand(frameRef.current, 'loadVideoById', [videoId]);
      syncTimerRef.current = window.setTimeout(applyPlayback, 160);
    } else applyPlayback();
    pendingSyncRef.current = null;
  };

  useEffect(() => {
    const receiveMusicSync = (event: Event) => {
      const detail = (event as CustomEvent<MusicSyncDetail>).detail;
      if (!detail?.track?.videoId || detail.player === 'radio' || detail.origin === originRef.current) return;
      pendingSyncRef.current = detail;
      setTrack(detail.track);
      setPlaying(detail.playing);
      if (typeof detail.volume === 'number') setVolume(detail.volume);
      syncFrame(detail);
    };
    const sendCurrentMusic = () => emitMusicEvent('gyopo-music-local', { source: 'local', player: 'top', origin: originRef.current, track, playing, position: 0, startedAt: Date.now(), volume });
    window.addEventListener('gyopo-music-sync', receiveMusicSync);
    window.addEventListener('gyopo-music-local', receiveMusicSync);
    window.addEventListener('gyopo-music-request-state', sendCurrentMusic);
    return () => {
      window.removeEventListener('gyopo-music-sync', receiveMusicSync);
      window.removeEventListener('gyopo-music-local', receiveMusicSync);
      window.removeEventListener('gyopo-music-request-state', sendCurrentMusic);
    };
  }, [playing, track, volume]);

  useEffect(() => {
    const resumeAudio = () => {
      if (!playing) return;
      sendPlayerCommand(frameRef.current, 'unMute');
      sendPlayerCommand(frameRef.current, 'playVideo');
    };
    window.addEventListener('pointerdown', resumeAudio, { once: true, passive: true });
    window.addEventListener('keydown', resumeAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
  }, [playing]);

  const selectTrack = async (next: MusicTrack) => {
    const enriched = await hydrateMusicTrack(next);
    setTrack(enriched);
    setFavoriteTracks((current) => current.some((favorite) => favorite.id === enriched.id) ? current.map((favorite) => favorite.id === enriched.id ? enriched : favorite) : current);
    setPlaying(true);
    const detail: MusicSyncDetail = { source: 'local', player: 'top', origin: originRef.current, track: enriched, playing: true, position: 0, startedAt: Date.now(), volume };
    pendingSyncRef.current = detail;
    syncFrame(detail);
    emitMusicEvent('gyopo-music-local', detail);
    emitMusicPlayerEvent({ player: 'top', playing: true });
  };

  const selectRelativeTrack = (direction: -1 | 1) => {
    const playlist = favoritesLoop && favoriteTracks.length ? favoriteTracks : MUSIC_TRACKS;
    const index = playlist.findIndex((item) => item.id === track.id);
    void selectTrack(playlist[(index + direction + playlist.length) % playlist.length]);
  };

  const togglePlaying = () => {
    const next = !playing;
    setPlaying(next);
    if (next) sendPlayerCommand(frameRef.current, 'unMute');
    sendPlayerCommand(frameRef.current, next ? 'playVideo' : 'pauseVideo');
    emitMusicEvent('gyopo-music-local', { source: 'local', player: 'top', origin: originRef.current, track, playing: next, position: 0, startedAt: Date.now(), volume });
    emitMusicPlayerEvent({ player: 'top', playing: next });
  };

  const changeVolume = (next: number) => {
    setVolume(next);
    window.localStorage.setItem('gyopo-music-volume', String(next));
    sendPlayerCommand(frameRef.current, 'setVolume', [next]);
    emitMusicEvent('gyopo-music-local', { source: 'local', player: 'top', origin: originRef.current, track, playing, position: 0, startedAt: Date.now(), volume: next });
  };

  const toggleFavorite = (item: MusicTrack) => {
    const next = favoriteTracks.some((favorite) => favorite.id === item.id) ? favoriteTracks.filter((favorite) => favorite.id !== item.id) : [...favoriteTracks, item];
    setFavoriteTracks(next);
    window.localStorage.setItem(favoriteStorageKey, JSON.stringify(next));
  };

  const playlist = favoritesLoop && favoriteTracks.length ? `&loop=1&playlist=${favoriteTracks.map((item) => item.videoId).join(',')}` : '&loop=0';

  return (
    <section ref={searchShellRef} className="music-player-shell border-b border-white/10 bg-[#0b1222] px-3 py-2 text-white shadow-[0_8px_30px_rgba(0,0,0,.18)] sm:px-5">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3">
        <Music2 size={17} className="shrink-0 text-teal-300" />
        <div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><b className="truncate text-sm">{track.title}</b><span className="hidden truncate text-xs text-slate-400 sm:block">{track.artist}</span></div></div>
        <div className="flex items-center gap-1"><button type="button" onClick={() => selectRelativeTrack(-1)} aria-label="이전 곡" className="inline-flex items-center justify-center rounded-none border-0 bg-white/10 p-2 text-slate-300 hover:bg-white/20 hover:text-white"><SkipBack size={15} /></button><button type="button" onClick={togglePlaying} aria-label={playing ? '일시정지' : '재생'} className="inline-flex items-center justify-center rounded-none border-0 bg-white/15 p-2 text-white hover:bg-white/25">{playing ? <Pause size={15} /> : <Play size={15} />}</button><button type="button" onClick={() => selectRelativeTrack(1)} aria-label="다음 곡" className="inline-flex items-center justify-center rounded-none border-0 bg-white/10 p-2 text-slate-300 hover:bg-white/20 hover:text-white"><SkipForward size={15} /></button></div>
        <div className="music-player-search relative flex min-w-[110px] max-w-[360px] flex-1 items-center gap-2 rounded-none border-0 bg-white/[.07] px-2 py-2 sm:min-w-[180px] sm:px-3"><Search size={15} className="shrink-0 text-slate-400" /><input value={query} onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)} onChange={(event) => setQuery(event.target.value)} placeholder="음악 검색 · 핫키워드" className="w-full rounded-none border-0 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" /></div>
        <div className="hidden items-center gap-1.5 sm:flex"><span className="text-slate-500">{volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}</span><input aria-label="음악 볼륨" type="range" min="0" max="100" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} className="w-16 accent-teal-300" /></div>
        <button type="button" onClick={() => toggleFavorite(track)} aria-label="즐겨찾기" className={`inline-flex items-center justify-center rounded-none border-0 bg-white/10 p-2 ${favoriteTracks.some((favorite) => favorite.id === track.id) ? 'text-rose-300' : 'text-slate-400'} hover:bg-white/20`}><Heart size={15} fill={favoriteTracks.some((favorite) => favorite.id === track.id) ? 'currentColor' : 'none'} /></button>
         <Link href="/music" className="hidden rounded-none border-0 bg-white/10 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/20 hover:text-white sm:block">MUSIC VIDEO</Link>
        <iframe key={`${track.videoId}-${favoritesLoop ? favoriteTracks.map((item) => item.videoId).join('-') : 'all'}`} ref={frameRef} onLoad={() => syncFrame()} title="GYOPO music player" src={`https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&origin=https%3A%2F%2Fgyopo.pages.dev&autoplay=1&mute=1&cc_load_policy=0&iv_load_policy=3&playsinline=1${playlist}`} className="pointer-events-none absolute h-px w-px opacity-0" allow="autoplay; encrypted-media" />
      </div>
      {searchFocused && <div className="music-player-results mx-auto mt-2 max-w-[1440px] rounded-none bg-[#0b1222]/92 p-2 backdrop-blur-xl"><div className="mb-2 flex items-center justify-between gap-2"><b className="text-[11px] font-black uppercase tracking-[.12em] text-slate-300">즐겨찾기 플레이리스트</b><button type="button" disabled={!favoriteTracks.length} onMouseDown={(event) => event.preventDefault()} onClick={() => setFavoritesLoop((value) => !value)} className="rounded-none border-0 bg-white/10 px-2 py-1 text-[10px] font-black text-white disabled:opacity-40">{favoritesLoop ? '즐겨찾기 반복 중' : '즐겨찾기만 반복'}</button></div>{favoriteTracks.length ? <div className="mb-3 grid gap-1.5 sm:grid-cols-2">{favoriteTracks.map((item) => <button type="button" key={`top-favorite-${item.id}`} onMouseDown={(event) => event.preventDefault()} onClick={() => void selectTrack(item)} className="flex min-w-0 items-center gap-2 rounded-none border-0 bg-white/[.06] p-2 text-left">{item.thumbnail && <img src={item.thumbnail} alt="" className="h-8 w-12 object-cover" />}<span className="min-w-0 truncate text-[11px] font-bold text-slate-300">{item.title}</span></button>)}</div> : <p className="mb-3 text-[10px] text-slate-500">하트 버튼으로 좋아하는 영상을 담아보세요.</p>}<div className="flex flex-wrap gap-1.5">{MUSIC_HOT_KEYWORDS.map((keyword) => <button type="button" key={keyword} onMouseDown={(event) => event.preventDefault()} onClick={() => setQuery(keyword)} className="rounded-none border-0 bg-white/[.06] px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:bg-teal-300/10 hover:text-teal-200">#{keyword}</button>)}</div>{query && <div className="mt-2 grid gap-2 sm:grid-cols-2">{results.length ? results.map((item) => <div key={item.id} className={`flex items-center gap-2 rounded-none px-2 py-2 ${item.id === track.id ? 'bg-teal-300/10' : 'bg-white/[.05]'}`}><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void selectTrack(item)} className="flex min-w-0 flex-1 items-center gap-2 text-left">{item.thumbnail && <img src={item.thumbnail} alt="" className="h-10 w-16 object-cover" />}<span className="min-w-0"><b className="block truncate text-xs">{item.title}</b><span className="block truncate text-[11px] text-slate-400">{item.artist}</span><span className="block truncate text-[10px] text-slate-500">{item.views || 'YouTube 검색 결과'}{item.published ? ` · ${item.published}` : ''}</span></span></button><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => toggleFavorite(item)} aria-label="즐겨찾기" className={`inline-flex items-center justify-center rounded-none border-0 bg-transparent p-1 ${favoriteTracks.some((favorite) => favorite.id === item.id) ? 'text-rose-300' : 'text-slate-500'}`}><Heart size={14} fill={favoriteTracks.some((favorite) => favorite.id === item.id) ? 'currentColor' : 'none'} /></button></div>) : <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-teal-200 underline">YouTube에서 이 키워드 검색하기</a>}</div>}</div>}
    </section>
  );
}
