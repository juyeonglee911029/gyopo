import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('GYOPO 광고센터', '글로벌 한인 고객에게 지역 기반 광고와 제휴를 소개하는 GYOPO 광고센터입니다.', '/ads');

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
