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
