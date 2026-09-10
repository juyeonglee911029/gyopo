import type { Metadata } from 'next';
import WebrtcPage from '@/app/webrtc/page';

export const metadata: Metadata = { title: '실시간 교민 랜덤 화상채팅 | GYOPO' };
export default function AppsRandomChatPage() { return <WebrtcPage />; }
