export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  videoId: string;
  keywords: string[];
  views?: string;
  published?: string;
  thumbnail?: string;
};

export type MusicSyncDetail = {
  source?: 'local' | 'room';
  player?: 'top' | 'radio' | 'game';
  origin?: string;
  track: MusicTrack;
  playing: boolean;
  position?: number;
  startedAt?: number;
  volume?: number;
};

export function emitMusicEvent(name: 'gyopo-music-local' | 'gyopo-music-sync', detail: MusicSyncDetail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<MusicSyncDetail>(name, { detail }));
}

export function emitMusicPlayerEvent(detail: { player: 'top' | 'radio' | 'game'; playing: boolean }) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gyopo-music-player', { detail }));
}

export function musicFavoritesKey(userId?: string) {
  return `gyopo-music-favorites:${userId || 'guest'}`;
}

export async function hydrateMusicTrack(track: MusicTrack) {
  try {
    const response = await fetch(`/api/music/search?videoId=${encodeURIComponent(track.videoId)}`);
    const data = await response.json() as { results?: MusicTrack[] };
    const match = data.results?.find((item) => item.videoId === track.videoId);
    return match ? { ...track, ...match } : { ...track, thumbnail: track.thumbnail || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg` };
  } catch {
    return { ...track, thumbnail: track.thumbnail || `https://i.ytimg.com/vi/${track.videoId}/hqdefault.jpg` };
  }
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'would-you', title: 'WOULD YOU (feat. TARZZAN, WOOCHAN)', artist: 'TAEYANG', videoId: 'K1VTsnCNu3Y', published: '3 months ago', views: '1,088,718 views', thumbnail: 'https://i.ytimg.com/vi/K1VTsnCNu3Y/hqdefault.jpg', keywords: ['TAEYANG', '태양', 'WOULD YOU', 'QUINTESSENCE'] },
  { id: 'swim', title: 'SWIM', artist: 'BTS', videoId: 'b4iVv91Z6lY', published: '5 months ago', views: '158,339,429 views', thumbnail: 'https://i.ytimg.com/vi/b4iVv91Z6lY/hqdefault.jpg', keywords: ['BTS', 'SWIM', '신곡'] },
  { id: 'droptop', title: 'DROP TOP', artist: 'MEOVV (미야오)', videoId: 'l4On7TQoM-M', thumbnail: 'https://i.ytimg.com/vi/l4On7TQoM-M/hqdefault.jpg', keywords: ['미야오', 'DROPTOP', 'MEOVV'] },
  { id: 'supernova', title: 'Supernova', artist: 'aespa', videoId: 'phuiiNCxRMg', published: '2 years ago', views: '253,905,377 views', thumbnail: 'https://i.ytimg.com/vi/phuiiNCxRMg/hqdefault.jpg', keywords: ['aespa', 'Supernova', 'SM'] },
  { id: 'supershy', title: 'Super Shy', artist: 'NewJeans', videoId: 'ArmDp-zijuc', published: '3y ago', views: '297,168,378 views', thumbnail: 'https://i.ytimg.com/vi/ArmDp-zijuc/hqdefault.jpg', keywords: ['NewJeans', 'Super Shy', '뉴진스'] },
  { id: 'ddu-du', title: 'DDU-DU DDU-DU', artist: 'BLACKPINK', videoId: 'IHNzOHi8sJs', published: '8 years ago', views: '2,408,383,029 views', thumbnail: 'https://i.ytimg.com/vi/IHNzOHi8sJs/hqdefault.jpg', keywords: ['BLACKPINK', '블랙핑크', 'DANCE'] },
  { id: 'butter', title: 'Butter', artist: 'BTS', videoId: 'WMweEpGlu_U', published: '5 years ago', views: '1,108,576,766 views', thumbnail: 'https://i.ytimg.com/vi/WMweEpGlu_U/hqdefault.jpg', keywords: ['BTS', 'Butter', 'K-pop'] },
];

export const MUSIC_HOT_KEYWORDS = ['WOULD YOU', 'SWIM', '미야오 DROP TOP', 'K-pop 최신곡', 'BTS 전곡', 'K-POP TOP 100', '뉴진스', 'BLACKPINK'];

export function searchMusicTracks(query: string): MusicTrack[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return MUSIC_TRACKS;
  return MUSIC_TRACKS.filter((track) => `${track.title} ${track.artist} ${track.keywords.join(' ')}`.toLowerCase().includes(normalized));
}
