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
  track: MusicTrack;
  playing: boolean;
  position?: number;
  startedAt?: number;
  volume?: number;
};

export function emitMusicEvent(name: 'gyopo-music-local' | 'gyopo-music-sync', detail: MusicSyncDetail) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<MusicSyncDetail>(name, { detail }));
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'swim', title: 'SWIM', artist: 'BTS', videoId: 'b4iVv91Z6lY', keywords: ['BTS', 'SWIM', '신곡'] },
  { id: 'droptop', title: 'DROP TOP', artist: 'MEOVV (미야오)', videoId: 'l4On7TQoM-M', keywords: ['미야오', 'DROPTOP', 'MEOVV'] },
  { id: 'supernova', title: 'Supernova', artist: 'aespa', videoId: 'phuiiNCxRMg', keywords: ['aespa', 'Supernova', 'SM'] },
  { id: 'supershy', title: 'Super Shy', artist: 'NewJeans', videoId: 'ArmDp-zijuc', keywords: ['NewJeans', 'Super Shy', '뉴진스'] },
  { id: 'ddu-du', title: 'DDU-DU DDU-DU', artist: 'BLACKPINK', videoId: 'IHNzOHi8sJs', keywords: ['BLACKPINK', '블랙핑크', 'DANCE'] },
  { id: 'butter', title: 'Butter', artist: 'BTS', videoId: 'WMweEpGlu_U', keywords: ['BTS', 'Butter', 'K-pop'] },
];

export const MUSIC_HOT_KEYWORDS = ['SWIM', '미야오 DROP TOP', 'K-pop 최신곡', 'BTS 전곡', 'K-POP TOP 100', '뉴진스', 'BLACKPINK'];

export function searchMusicTracks(query: string): MusicTrack[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return MUSIC_TRACKS;
  return MUSIC_TRACKS.filter((track) => `${track.title} ${track.artist} ${track.keywords.join(' ')}`.toLowerCase().includes(normalized));
}
export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  videoId: string;
  keywords: string[];
};

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'swim', title: 'SWIM', artist: 'BTS', videoId: 'b4iVv91Z6lY', keywords: ['BTS', 'SWIM', '신곡'] },
  { id: 'droptop', title: 'DROP TOP', artist: 'MEOVV (미야오)', videoId: 'l4On7TQoM-M', keywords: ['미야오', 'DROPTOP', 'MEOVV'] },
  { id: 'supernova', title: 'Supernova', artist: 'aespa', videoId: 'phuiiNCxRMg', keywords: ['aespa', 'Supernova', 'SM'] },
  { id: 'supershy', title: 'Super Shy', artist: 'NewJeans', videoId: 'ArmDp-zijuc', keywords: ['NewJeans', 'Super Shy', '뉴진스'] },
  { id: 'ddu-du', title: 'DDU-DU DDU-DU', artist: 'BLACKPINK', videoId: 'IHNzOHi8sJs', keywords: ['BLACKPINK', '블랙핑크', 'DANCE'] },
  { id: 'butter', title: 'Butter', artist: 'BTS', videoId: 'WMweEpGlu_U', keywords: ['BTS', 'Butter', 'K-pop'] },
];

export const MUSIC_HOT_KEYWORDS = ['SWIM', '미야오 DROP TOP', 'K-pop 최신곡', 'BTS 전곡', 'K-POP TOP 100', '뉴진스', 'BLACKPINK'];

export function searchMusicTracks(query: string): MusicTrack[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return MUSIC_TRACKS;
  return MUSIC_TRACKS.filter((track) => `${track.title} ${track.artist} ${track.keywords.join(' ')}`.toLowerCase().includes(normalized));
}
