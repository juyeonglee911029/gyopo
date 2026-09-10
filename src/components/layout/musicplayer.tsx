'use client';

import Link from 'next/link';
import { Heart, Pause, Play, Search, SkipBack, SkipForward, Volume2, VolumeX, Music2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { emitMusicEvent, emitMusicPlayerEvent, MUSIC_HOT_KEYWORDS, MUSIC_TRACKS, searchMusicTracks, type MusicSyncDetail, type MusicTrack } from '@/lib/music';
import { getSessionToken, saveProfile } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

function sendPlayerCommand(frame: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
}

function subscribeToPlayerState(frame: HTMLIFrameElement | null) {
  const target = frame?.contentWindow;
  if (!target) return;
  target.postMessage(JSON.stringify({ event: 'listening', id: 'gyopo-top-player' }), 'https://www.youtube.com');
  target.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }), 'https://www.youtube.com');
}

export default function MusicPlayer() {
  const user = useGlobalStore((state) => state.user);
  const setUser = useGlobalStore((state) => state.setUser);
  const [track, setTrack] = useState<MusicTrack>(MUSIC_TRACKS[0]);
  const [playing, setPlaying] = useState(true);
  const [volume, setVolume] = useState(70);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [remoteResults, setRemoteResults] = useState<MusicTrack[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoriteTracks, setFavoriteTracks] = useState<MusicTrack[]>([]);
  const [favoriteLoop, setFavoriteLoop] = useState(false);
  const [favoriteMenuOpen, setFavoriteMenuOpen] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const searchShellRef = useRef<HTMLElement>(null);
  const pendingSyncRef = useRef<MusicSyncDetail | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const autoAdvanceTimerRef = useRef<number | null>(null);
  const metadataLoadedRef = useRef(new Set<string>());
  const originRef = useRef('top-player');
  const loadedVideoIdRef = useRef<string | null>(null);
  const localResults = useMemo(() => searchMusicTracks(query), [query]);
  const results = query.trim() ? (remoteResults.length ? remoteResults : localResults) : MUSIC_TRACKS;

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
      const stored = user?.musicFavorites || JSON.parse(window.localStorage.getItem(`gyopo-music-favorites:${user?.id || 'guest'}`) || '[]');
      setFavoriteTracks(stored);
      setFavoriteIds(stored.map((item: MusicTrack) => item.id));
    } catch {
      setFavoriteIds([]);
      setFavoriteTracks([]);
    }
    setFavoriteLoop(window.localStorage.getItem(`gyopo-music-favorite-loop:${user?.id || 'guest'}`) === '1');
  }, [user?.id, user?.musicFavorites]);

  useEffect(() => {
    const receiveLoop = (event: Event) => setFavoriteLoop(Boolean((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled));
    window.addEventListener('gyopo-music-favorite-loop', receiveLoop);
    return () => window.removeEventListener('gyopo-music-favorite-loop', receiveLoop);
  }, []);

  useEffect(() => {
    const receiveFavorites = (event: Event) => {
      const tracks = (event as CustomEvent<{ tracks?: MusicTrack[] }>).detail?.tracks || [];
      setFavoriteTracks(tracks);
      setFavoriteIds(tracks.map((item) => item.id));
    };
    window.addEventListener('gyopo-music-favorites', receiveFavorites);
    return () => window.removeEventListener('gyopo-music-favorites', receiveFavorites);
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

  useEffect(() => {
    if (metadataLoadedRef.current.has(track.videoId) || (track.views && track.published)) return;
    metadataLoadedRef.current.add(track.videoId);
    void fetch(`/api/music/details?videoId=${encodeURIComponent(track.videoId)}`, { cache: 'no-store' })
      .then((response) => response.ok ? response.json() as Promise<Partial<MusicTrack>> : null)
      .then((metadata) => {
        if (!metadata) return;
        setTrack((current) => current.videoId === track.videoId ? { ...current, ...metadata } : current);
        setFavoriteTracks((current) => current.map((item) => item.videoId === track.videoId ? { ...item, ...metadata } : item));
      })
      .catch(() => undefined);
  }, [track.videoId, track.views, track.published]);

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
    } else {
      applyPlayback();
    }
    pendingSyncRef.current = null;
  };

  useEffect(() => {
    const receiveMusicSync = (event: Event) => {
      const detail = (event as CustomEvent<MusicSyncDetail>).detail;
      if (!detail?.track?.videoId) return;
      if (detail.player === 'radio') return;
      if (detail.origin === originRef.current) return;
      pendingSyncRef.current = detail;
      setTrack(detail.track);
      setPlaying(detail.playing);
      if (typeof detail.volume === 'number') setVolume(detail.volume);
      syncFrame(detail);
    };
    window.addEventListener('gyopo-music-sync', receiveMusicSync);
    window.addEventListener('gyopo-music-local', receiveMusicSync);
     const sendCurrentMusic = () => emitMusicEvent('gyopo-music-local', { source: 'local', player: 'top', origin: originRef.current, track, playing, position: 0, startedAt: Date.now(), volume });
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

  const selectTrack = (next: MusicTrack) => {
    setTrack(next);
    setPlaying(true);
    const detail: MusicSyncDetail = { source: 'local', player: 'top', origin: originRef.current, track: next, playing: true, position: 0, startedAt: Date.now(), volume };
    pendingSyncRef.current = detail;
    syncFrame(detail);
    emitMusicEvent('gyopo-music-local', detail);
    emitMusicPlayerEvent({ player: 'top', playing: true });
  };

  const selectRelativeTrack = (direction: -1 | 1) => {
    const pool = favoriteLoop && favoriteTracks.length ? favoriteTracks : MUSIC_TRACKS;
    const index = pool.findIndex((item) => item.id === track.id);
    selectTrack(pool[(index + direction + pool.length) % pool.length]);
  };

  useEffect(() => {
    const handlePlayerMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.youtube.com' || typeof event.data !== 'string') return;
      let payload: { event?: string; info?: number | { playerState?: number } };
      try {
        payload = JSON.parse(event.data) as typeof payload;
      } catch {
        return;
      }
      const ended = payload.event === 'onStateChange'
        ? Number(payload.info) === 0
        : payload.event === 'infoDelivery' && typeof payload.info === 'object' && payload.info?.playerState === 0;
      if (!ended) return;
      if (autoAdvanceTimerRef.current) window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = window.setTimeout(() => selectRelativeTrack(1), 250);
    };
    window.addEventListener('message', handlePlayerMessage);
    return () => {
      window.removeEventListener('message', handlePlayerMessage);
      if (autoAdvanceTimerRef.current) window.clearTimeout(autoAdvanceTimerRef.current);
    };
  }, [track.id]);

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
    const nextTracks = favoriteIds.includes(item.id) ? favoriteTracks.filter((favorite) => favorite.id !== item.id) : [...favoriteTracks, item];
    const nextIds = nextTracks.map((favorite) => favorite.id);
    setFavoriteTracks(nextTracks);
    setFavoriteIds(nextIds);
    window.localStorage.setItem(`gyopo-music-favorites:${user?.id || 'guest'}`, JSON.stringify(nextTracks));
    if (user) {
      const nextUser = { ...user, musicFavorites: nextTracks };
      setUser(nextUser);
      void saveProfile(nextUser, getSessionToken()).catch(() => undefined);
    }
    window.dispatchEvent(new CustomEvent('gyopo-music-favorites', { detail: { tracks: nextTracks } }));
  };

  const toggleFavoriteLoop = () => {
    const next = !favoriteLoop;
    setFavoriteLoop(next);
    window.localStorage.setItem(`gyopo-music-favorite-loop:${user?.id || 'guest'}`, next ? '1' : '0');
    window.dispatchEvent(new CustomEvent('gyopo-music-favorite-loop', { detail: { enabled: next } }));
  };

  const toggleFavoriteMenu = () => setFavoriteMenuOpen((open) => !open);

  useEffect(() => {
    sendPlayerCommand(frameRef.current, 'setVolume', [volume]);
  }, [volume]);

  return (
    <section ref={searchShellRef} className="music-player-shell border-b border-white/10 bg-[#0b1222] px-3 py-2 text-white shadow-[0_8px_30px_rgba(0,0,0,.18)] sm:px-5">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3">
        <Music2 size={17} className="shrink-0 text-teal-300" />
         <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <b className="truncate text-sm">{track.title}</b>
            <span className="hidden truncate text-xs text-slate-400 sm:block">{track.artist}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => selectRelativeTrack(-1)} aria-label="이전 곡" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><SkipBack size={15} /></button>
           <button type="button" onClick={togglePlaying} aria-label={playing ? '일시정지' : '재생'} className="rounded-full bg-teal-300 p-2 text-slate-950 hover:bg-teal-200">
             {playing ? <Pause size={15} /> : <Play size={15} />}
           </button>
           <button type="button" onClick={() => selectRelativeTrack(1)} aria-label="다음 곡" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><SkipForward size={15} /></button>
         </div>
          <div className="music-player-search relative flex min-w-[110px] max-w-[360px] flex-1 items-center gap-2 border border-white/10 bg-white/[.07] px-2 py-2 sm:min-w-[180px] sm:px-3">
           <Search size={15} className="shrink-0 text-slate-400" />
             <input aria-label="음악 검색" value={query} onFocus={() => setSearchFocused(true)} onBlur={() => window.setTimeout(() => setSearchFocused(false), 160)} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
         </div>
         <div className="hidden items-center gap-1.5 sm:flex"><span className="text-slate-500">{volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}</span><input aria-label="음악 볼륨" type="range" min="0" max="100" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} className="w-16 accent-teal-300" /></div>
           <div className="relative">
             <button type="button" onClick={toggleFavoriteMenu} aria-expanded={favoriteMenuOpen} aria-label="즐겨찾기 목록" className={`p-2 ${favoriteIds.includes(track.id) ? 'text-rose-300' : 'text-slate-400'} hover:bg-white/10`}><Heart size={15} fill={favoriteIds.includes(track.id) ? 'currentColor' : 'none'} /></button>
             {favoriteMenuOpen && <div className="music-favorites-popover absolute right-0 top-full z-50 mt-2 w-64 border-0 bg-black/80 p-2 text-white shadow-2xl backdrop-blur-2xl">
               <div className="flex items-center justify-between px-2 py-1.5 text-[10px] font-medium uppercase tracking-[.16em] text-white/55"><span>Favorites</span><span>{favoriteTracks.length}</span></div>
               {favoriteTracks.length > 0 ? favoriteTracks.map((item) => <div key={item.id} className="flex items-center gap-1 bg-white/[.06] px-2 py-1.5">
                 <button type="button" onClick={() => { selectTrack(item); setFavoriteMenuOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 text-left"><Play size={11} className="shrink-0 text-teal-200" /><span className="min-w-0 truncate text-xs">{item.title}</span></button>
                 <button type="button" onClick={() => toggleFavorite(item)} aria-label={`${item.title} 즐겨찾기 삭제`} className="shrink-0 p-1 text-rose-200"><Heart size={12} fill="currentColor" /></button>
               </div>) : <p className="px-2 py-3 text-xs text-white/45">저장한 곡이 없습니다.</p>}
               {!favoriteIds.includes(track.id) && <button type="button" onClick={() => toggleFavorite(track)} className="mt-1 w-full bg-white/[.08] px-2 py-2 text-left text-xs text-teal-100 hover:bg-white/[.14]">현재 곡 저장</button>}
             </div>}
           </div>
           <button type="button" onClick={toggleFavoriteLoop} className={`music-player-utility hidden sm:block ${favoriteLoop ? 'text-rose-200' : 'text-slate-300'}`}>Repeat</button>
             <Link href="/music" className="music-player-utility hidden sm:block text-slate-300 hover:text-teal-200">MUSIC VIDEO</Link>
           <iframe ref={frameRef} onLoad={() => { subscribeToPlayerState(frameRef.current); syncFrame(); }} title="GYOPO music player" src={`https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&origin=https%3A%2F%2Fgyopo.pages.dev&autoplay=1&mute=1&cc_load_policy=0&iv_load_policy=3&playsinline=1`} className="pointer-events-none absolute h-px w-px opacity-0" allow="autoplay; encrypted-media" />
      </div>

         {searchFocused && <div className="music-player-results mx-auto mt-2 max-w-[1440px] border-0 bg-[#0b1222]/92 p-2 shadow-none backdrop-blur-none"><div className="flex flex-wrap gap-1.5">{MUSIC_HOT_KEYWORDS.map((keyword) => <button type="button" key={keyword} onMouseDown={(event) => event.preventDefault()} onClick={() => setQuery(keyword)} className="border-0 bg-white/[.06] px-2.5 py-1.5 text-[11px] font-bold text-slate-400 outline-none ring-0 hover:bg-teal-300/10 hover:text-teal-200">#{keyword}</button>)}</div>{favoriteTracks.length > 0 && <div className="mt-2 flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-400"><span>♥ 즐겨찾기 {favoriteTracks.length}곡 {favoriteLoop ? '반복 재생 중' : ''}</span><button type="button" onClick={toggleFavoriteLoop} className="border-0 text-rose-200">{favoriteLoop ? '반복 끄기' : '즐겨찾기만 반복'}</button></div>}{query && <div className="mt-2 grid gap-2 sm:grid-cols-2">{results.length ? results.map((item) => <div key={item.id} className={`flex items-center gap-2 border-0 px-2 py-2 ${item.id === track.id ? 'bg-teal-300/10' : 'bg-white/[.05]'}`}><button type="button" onClick={() => selectTrack(item)} className="flex min-w-0 flex-1 items-center gap-2 border-0 text-left outline-none ring-0">{item.thumbnail ? <img src={item.thumbnail} alt="" className="h-10 w-16 object-cover" /> : <span className="h-10 w-16 bg-black" />}<span className="min-w-0"><b className="block truncate text-xs">{item.title}</b><span className="block truncate text-[11px] text-slate-400">{item.artist}</span><span className="block truncate text-[10px] text-slate-500">{item.views || 'YouTube 검색 결과'}{item.published ? ` · ${item.published}` : ''}</span></span></button><button type="button" onClick={() => toggleFavorite(item)} aria-label="즐겨찾기" className={`border-0 outline-none ring-0 ${favoriteIds.includes(item.id) ? 'text-rose-300' : 'text-slate-500'}`}><Heart size={14} fill={favoriteIds.includes(item.id) ? 'currentColor' : 'none'} /></button></div>) : <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-teal-200 no-underline">YouTube에서 이 키워드 검색하기</a>}</div>}</div>}
    </section>
  );
}
