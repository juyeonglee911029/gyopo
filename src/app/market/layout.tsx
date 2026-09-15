import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('해외 한인 중고장터', '지역 교민과 안전하게 물품을 나누고 거래할 수 있는 글로벌 한인 중고장터입니다.', '/market');

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return children;
}
