import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('GYOPO 방송 스튜디오', 'GYOPO 라이브 방송 운영 화면입니다.', '/theater/broadcast', false);

export default function BroadcastLayout({ children }: { children: React.ReactNode }) {
  return children;
}
