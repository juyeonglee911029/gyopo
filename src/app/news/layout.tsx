import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('해외 한인 지역 뉴스', '국가와 도시별 한인 생활에 필요한 최신 뉴스와 지역 소식을 검증된 출처로 확인하세요.', '/news');

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
