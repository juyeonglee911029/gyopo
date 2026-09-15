import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('글로벌 한인 업소록', '미국과 전 세계 한인 식당, 병원, 법률, 교육과 생활 서비스를 지역과 카테고리별로 찾아보세요.', '/directory');

export default function DirectoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
