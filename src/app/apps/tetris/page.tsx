import type { Metadata } from 'next';
import GamesPage from '@/app/games/page';

export const metadata: Metadata = { title: '실시간 교민 랭킹 테트리스 | GYOPO' };
export default function AppsTetrisPage() { return <GamesPage />; }
