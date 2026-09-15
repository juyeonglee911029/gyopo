import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('안전한 랜덤 화상채팅', '만 18세 이상 인증 회원을 위한 안전 운영 기준의 글로벌 교민 랜덤 화상채팅입니다.', '/webrtc', true, '/apps/random-chat');

export default function WebrtcLayout({ children }: { children: React.ReactNode }) {
  return children;
}
