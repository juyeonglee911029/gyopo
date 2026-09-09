'use client';

import { Heart, Pause, Play, Search, Music2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { emitMusicEvent, hydrateMusicTrack, musicFavoritesKey, MUSIC_HOT_KEYWORDS, MUSIC_TRACKS, searchMusicTracks, type MusicSyncDetail, type MusicTrack } from '@/lib/music';
import { useGlobalStore } from '@/store/useGlobalStore';

export default function MusicPage() {
  const user = useGlobalStore((state) => state.user);
  const [track, setTrack] = useState<MusicTrack>(MUSIC_TRACKS[0]);
  const [catalogTracks, setCatalogTracks] = useState<MusicTrack[]>(MUSIC_TRACKS);
  const [query, setQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<MusicTrack[]>([]);
  const [favoriteTracks, setFavoriteTracks] = useState<MusicTrack[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritesLoop, setFavoritesLoop] = useState(false);
  const [volume, setVolume] = useState(70);
  const [playing, setPlaying] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const originRef = useRef('music-page');
  const favoriteStorageKey = musicFavoritesKey(user?.id);
  const localResults = useMemo(() => searchMusicTracks(query).map((item) => catalogTracks.find((catalogItem) => catalogItem.id === item.id) || item), [catalogTracks, query]);
  const results = favoritesOnly && !query.trim() ? favoriteTracks : query.trim() ? (remoteResults.length ? remoteResults : localResults) : catalogTracks;

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
    try {
      const saved = JSON.parse(window.localStorage.getItem(favoriteStorageKey) || '[]') as unknown;
      if (Array.isArray(saved) && saved.every((item) => typeof item === 'object' && item !== null)) setFavoriteTracks(saved as MusicTrack[]);
      else if (Array.isArray(saved)) setFavoriteTracks(MUSIC_TRACKS.filter((item) => saved.includes(item.id)));
    } catch {
      setFavoriteTracks([]);
    }
  }, [favoriteStorageKey]);

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

  const saveFavorites = (next: MusicTrack[]) => {
    setFavoriteTracks(next);
    window.localStorage.setItem(favoriteStorageKey, JSON.stringify(next));
  };

  const toggleFavorite = (item: MusicTrack) => {
    saveFavorites(favoriteTracks.some((favorite) => favorite.id === item.id) ? favoriteTracks.filter((favorite) => favorite.id !== item.id) : [...favoriteTracks, item]);
  };

  const selectTrack = async (item: MusicTrack) => {
    const enriched = await hydrateMusicTrack(item);
    setTrack(enriched);
    setFavoriteTracks((current) => current.some((favorite) => favorite.id === enriched.id) ? current.map((favorite) => favorite.id === enriched.id ? enriched : favorite) : current);
    setPlaying(true);
    emitMusicEvent('gyopo-music-local', { source: 'local', player: 'top', origin: originRef.current, track: enriched, playing: true, position: 0, startedAt: Date.now(), volume });
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

  const playlist = favoritesLoop && favoriteTracks.length ? `&loop=1&playlist=${favoriteTracks.map((item) => item.videoId).join(',')}` : '&loop=0';

  return (
    <div className="music-page min-h-screen bg-[#070b17] px-4 py-8 text-white md:px-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <div className="music-page-header mb-8 flex flex-wrap items-end justify-between gap-5">
           <div><div className="music-page-kicker mb-3 flex items-center gap-2 text-[7px] font-normal uppercase tracking-[0.28em] text-teal-300"><Music2 size={14} /> MUSIC VIDEO</div><h1 className="music-page-title whitespace-nowrap text-4xl font-normal tracking-tight md:text-6xl">MUSIC VIDEO</h1><p className="mt-3 text-sm text-slate-400">등록곡과 YouTube 뮤직비디오를 검색하고 즐겨찾기 목록으로 계속 재생합니다.</p></div>
          <div className="flex flex-wrap gap-2">{MUSIC_HOT_KEYWORDS.map((keyword) => <button type="button" key={keyword} onClick={() => setQuery(keyword)} className="music-keyword-button rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-normal text-slate-300 hover:border-teal-300/50 hover:bg-teal-300/10 hover:text-teal-200">#{keyword}</button>)}</div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="music-video-card overflow-hidden bg-[#10182b] shadow-2xl">
            <div className="aspect-video bg-black"><iframe ref={frameRef} key={`${track.videoId}-${favoritesLoop ? favoriteTracks.map((item) => item.videoId).join('-') : 'all'}`} onLoad={() => { const frame = frameRef.current?.contentWindow; frame?.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), 'https://www.youtube.com'); frame?.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [volume] }), 'https://www.youtube.com'); frame?.postMessage(JSON.stringify({ event: 'command', func: playing ? 'playVideo' : 'pauseVideo', args: [] }), 'https://www.youtube.com'); }} src={`https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&origin=https%3A%2F%2Fgyopo.pages.dev&autoplay=1&mute=1&rel=0${playlist}`} title={track.title} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 md:p-7"><div><div className="text-xs font-medium uppercase tracking-[0.2em] text-teal-300">Now playing</div><h2 className="mt-2 text-3xl font-medium">{track.title}</h2><p className="mt-1 text-sm font-normal text-slate-400">{track.artist}</p><div className="mt-3 flex flex-wrap gap-2 text-[11px] font-normal text-slate-500"><span className="music-meta-chip px-2.5 py-1.5">조회수 · {track.views || '집계 중'}</span><span className="music-meta-chip px-2.5 py-1.5">발매일 · {track.published || '정보 확인 중'}</span></div></div><div className="flex items-center gap-3"><button type="button" onClick={togglePlaying} className="music-action-button flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-normal">{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? '일시정지' : '재생'}</button><label className="flex items-center gap-2 text-xs text-slate-400">볼륨<input type="range" min="0" max="100" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} className="accent-teal-300" /></label></div></div>
          </section>

          <aside className="music-search-aside p-5">
            <div className="music-search-field flex items-center gap-2 px-3 py-2.5"><Search size={16} className="text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="YouTube 곡·가수 검색" className="music-search-input w-full text-sm outline-none placeholder:text-slate-500" /></div>
            <div className="mt-5 flex items-center justify-between gap-2"><h3 className="music-section-heading text-xs uppercase tracking-[0.2em] text-slate-300">즐겨찾기 플레이리스트</h3><button type="button" disabled={!favoriteTracks.length} onClick={() => setFavoritesLoop((value) => !value)} className="music-toggle-button px-2.5 py-1 text-[10px] disabled:opacity-40">{favoritesLoop ? '즐겨찾기 반복 중' : '즐겨찾기만 반복'}</button></div>
            <div className="mt-2 space-y-2">{favoriteTracks.length ? favoriteTracks.map((item) => <div key={`favorite-${item.id}`} className="music-favorite-row flex items-center gap-2 p-2"><button type="button" onClick={() => void selectTrack(item)} className="flex min-w-0 flex-1 items-center gap-2 text-left">{item.thumbnail && <img src={item.thumbnail} alt="" className="h-9 w-14 shrink-0 object-cover" />}<span className="min-w-0"><b className="block truncate text-xs">{item.title}</b><span className="block truncate text-[10px] text-slate-400">{item.artist}</span></span></button><button type="button" onClick={() => toggleFavorite(item)} aria-label="즐겨찾기 해제" className="music-heart-button inline-flex items-center justify-center p-1 text-rose-300"><Heart size={14} fill="currentColor" /></button></div>) : <p className="music-empty-state p-2 text-[11px] text-slate-500">하트 버튼으로 좋아하는 뮤직비디오를 담아보세요.</p>}</div>
            <div className="mt-6 flex items-center justify-between gap-2"><h3 className="music-section-heading text-xs uppercase tracking-[0.2em] text-slate-300">YouTube 검색 결과</h3><button type="button" onClick={() => setFavoritesOnly((value) => !value)} className="music-toggle-button px-2.5 py-1 text-[10px]">{favoritesOnly ? '전체 보기' : '즐겨찾기만 보기'}</button></div>
            <div className="mt-3 space-y-2">{results.map((item) => <div key={item.id} className={`music-result-row flex items-center gap-2 p-2 ${track.id === item.id ? 'is-active' : ''}`}><button type="button" onClick={() => void selectTrack(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">{item.thumbnail ? <img src={item.thumbnail} alt="" className="h-12 w-20 shrink-0 object-cover" /> : <span className="music-result-placeholder flex h-9 w-9 shrink-0 items-center justify-center text-teal-300"><Play size={14} fill="currentColor" /></span>}<span className="min-w-0"><span className="block truncate text-sm font-normal">{item.title}</span><span className="block truncate text-xs text-slate-400">{item.artist}</span><span className="block truncate text-[10px] text-slate-500">{item.views || '등록곡'}{item.published ? ` · ${item.published}` : ''}</span></span></button><button type="button" onClick={() => toggleFavorite(item)} aria-label={favoriteTracks.some((favorite) => favorite.id === item.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'} className={`music-heart-button inline-flex items-center justify-center p-1 ${favoriteTracks.some((favorite) => favorite.id === item.id) ? 'text-rose-300' : 'text-slate-500'}`}><Heart size={15} fill={favoriteTracks.some((favorite) => favorite.id === item.id) ? 'currentColor' : 'none'} /></button></div>)}{!results.length && <p className="music-empty-state p-3 text-sm text-slate-500">즐겨찾기 목록이 비어 있습니다.</p>}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}
