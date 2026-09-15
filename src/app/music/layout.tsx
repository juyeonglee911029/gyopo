import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('K-POP 뮤직비디오 라디오', 'GYOPO에서 최신 K-POP 뮤직비디오를 검색하고 즐겨찾기하며 교민들과 함께 감상하세요.', '/music');

export default function MusicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
