import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('해외 한인 커뮤니티', '지역별 교민들이 직접 나누는 생활 질문, 정보, 후기와 이야기를 확인하고 함께 참여하세요.', '/community');

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
