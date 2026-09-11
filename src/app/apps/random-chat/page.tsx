import type { Metadata } from 'next';
import WebrtcPage from '@/app/webrtc/page';

export const metadata: Metadata = { title: '18+ 안전 랜덤 화상채팅 | GYOPO', description: '만 18세 이상 인증 회원을 위한 안전 운영 랜덤 화상채팅' };
export default function AppsRandomChatPage() { return <WebrtcPage />; }
