'use client';

import { useEffect, useRef, useState } from 'react';
import { MUSIC_TRACKS, type MusicSyncDetail } from '@/lib/music';
import { SITE_URL } from '@/lib/seo';

export default function SiteBackgroundVideo() {
  const [videoId, setVideoId] = useState(MUSIC_TRACKS[0].videoId);
  const [playing, setPlaying] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);

  const sendCommand = (func: string, args: unknown[] = []) => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
  };

  useEffect(() => {
    const syncTrack = (event: Event) => {
      const detail = (event as CustomEvent<MusicSyncDetail>).detail;
      const next = detail?.track?.videoId;
      if (!next) return;
      setVideoId(next);
      setPlaying(detail.playing);
    };
    window.addEventListener('gyopo-music-local', syncTrack);
    window.addEventListener('gyopo-music-sync', syncTrack);
    return () => {
      window.removeEventListener('gyopo-music-local', syncTrack);
      window.removeEventListener('gyopo-music-sync', syncTrack);
    };
  }, []);

  useEffect(() => {
    sendCommand(playing ? 'playVideo' : 'pauseVideo');
  }, [playing]);

  return (
    <div className="site-background-video" aria-hidden="true">
       <iframe
         key={videoId}
         ref={frameRef}
         onLoad={() => {
           sendCommand('mute');
           sendCommand('setVolume', [0]);
           sendCommand(playing ? 'playVideo' : 'pauseVideo');
         }}
         title="GYOPO background music video"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&cc_load_policy=0&iv_load_policy=3&origin=${encodeURIComponent(SITE_URL)}`}
         allow="autoplay; encrypted-media"
       />
      <div className="site-background-video-shade" />
    </div>
  );
}
