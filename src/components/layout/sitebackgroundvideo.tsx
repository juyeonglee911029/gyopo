'use client';

import { useEffect, useState } from 'react';
import { MUSIC_TRACKS } from '@/lib/music';

export default function SiteBackgroundVideo() {
  const [videoId, setVideoId] = useState(MUSIC_TRACKS[0].videoId);

  useEffect(() => {
    const syncTrack = (event: Event) => {
      const next = (event as CustomEvent<{ track?: { videoId?: string } }>).detail?.track?.videoId;
      if (next) setVideoId(next);
    };
    window.addEventListener('gyopo-music-local', syncTrack);
    window.addEventListener('gyopo-music-sync', syncTrack);
    return () => {
      window.removeEventListener('gyopo-music-local', syncTrack);
      window.removeEventListener('gyopo-music-sync', syncTrack);
    };
  }, []);

  return (
    <div className="site-background-video" aria-hidden="true">
      <iframe
        key={videoId}
        title="GYOPO background music video"
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${videoId}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=https%3A%2F%2Fgyopo.pages.dev`}
        allow="autoplay; encrypted-media"
      />
      <div className="site-background-video-shade" />
    </div>
  );
}
