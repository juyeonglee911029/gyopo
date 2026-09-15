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
  player?: 'top' | 'video' | 'radio' | 'game';
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

export function emitMusicPlayerEvent(detail: { player: 'top' | 'video' | 'radio' | 'game'; playing: boolean }) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gyopo-music-player', { detail }));
}

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: 'like-jennie', title: 'like JENNIE', artist: 'JENNIE', videoId: 'JSFG-IE8n_c', keywords: ['JENNIE', '제니', 'like JENNIE', 'BLACKPINK'], thumbnail: 'https://i.ytimg.com/vi/JSFG-IE8n_c/hqdefault.jpg' },
  { id: 'earthquake', title: 'earthquake', artist: 'JISOO', videoId: '2V6lvCUPT8I', keywords: ['JISOO', '지수', 'earthquake', 'AMORTAGE'], thumbnail: 'https://i.ytimg.com/vi/2V6lvCUPT8I/hqdefault.jpg' },
  { id: 'sawadika', title: 'SaWaDiKa', artist: 'LISA', videoId: 'FyS5dAywkEo', keywords: ['LISA', '리사', 'SaWaDiKa', 'Sawasdee Ka', 'BLACKPINK'], thumbnail: 'https://i.ytimg.com/vi/FyS5dAywkEo/hqdefault.jpg' },
  { id: 'would-you', title: 'WOULD YOU (feat. TARZZAN, WOOCHAN)', artist: 'TAEYANG', videoId: 'K1VTsnCNu3Y', keywords: ['TAEYANG', '태양', 'WOULD YOU', 'QUINTESSENCE'], thumbnail: 'https://i.ytimg.com/vi/K1VTsnCNu3Y/hqdefault.jpg' },
  { id: 'swim', title: 'SWIM', artist: 'BTS', videoId: 'b4iVv91Z6lY', keywords: ['BTS', 'SWIM', '신곡'], thumbnail: 'https://i.ytimg.com/vi/b4iVv91Z6lY/hqdefault.jpg' },
  { id: 'droptop', title: 'DROP TOP', artist: 'MEOVV (미야오)', videoId: 'l4On7TQoM-M', keywords: ['미야오', 'DROPTOP', 'MEOVV'], thumbnail: 'https://i.ytimg.com/vi/l4On7TQoM-M/hqdefault.jpg' },
  { id: 'supernova', title: 'Supernova', artist: 'aespa', videoId: 'phuiiNCxRMg', keywords: ['aespa', 'Supernova', 'SM'], thumbnail: 'https://i.ytimg.com/vi/phuiiNCxRMg/hqdefault.jpg' },
  { id: 'supershy', title: 'Super Shy', artist: 'NewJeans', videoId: 'ArmDp-zijuc', keywords: ['NewJeans', 'Super Shy', '뉴진스'], thumbnail: 'https://i.ytimg.com/vi/ArmDp-zijuc/hqdefault.jpg' },
  { id: 'ddu-du', title: 'DDU-DU DDU-DU', artist: 'BLACKPINK', videoId: 'IHNzOHi8sJs', keywords: ['BLACKPINK', '블랙핑크', 'DANCE'], thumbnail: 'https://i.ytimg.com/vi/IHNzOHi8sJs/hqdefault.jpg' },
  { id: 'butter', title: 'Butter', artist: 'BTS', videoId: 'WMweEpGlu_U', keywords: ['BTS', 'Butter', 'K-pop'], thumbnail: 'https://i.ytimg.com/vi/WMweEpGlu_U/hqdefault.jpg' },
];

export const MUSIC_HOT_KEYWORDS = ['like JENNIE', 'earthquake', 'SaWaDiKa', 'K-pop 최신곡', 'BTS 전곡', 'K-POP TOP 100', '뉴진스', 'BLACKPINK'];

export function searchMusicTracks(query: string): MusicTrack[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return MUSIC_TRACKS;
  return MUSIC_TRACKS.filter((track) => `${track.title} ${track.artist} ${track.keywords.join(' ')}`.toLowerCase().includes(normalized));
}
