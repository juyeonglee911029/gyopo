import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('GYOPO 라이브 룸', '전 세계 교민이 함께 보는 라이브 룸과 방송 콘텐츠를 둘러보고 참여하세요.', '/theater');

export default function TheaterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
