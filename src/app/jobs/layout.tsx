import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('해외 한인 구인구직', '미국과 전 세계 한인을 위한 최신 채용 공고를 지역, 원격근무, 한국어, 비자 지원 조건으로 찾아보세요.', '/jobs');

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
