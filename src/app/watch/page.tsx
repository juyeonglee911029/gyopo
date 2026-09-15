import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('GYOPO 영상', 'GYOPO에서 교민 관련 영상 콘텐츠를 감상하세요.', '/watch', false);

export default function WatchPage() {
  return <div className="watch-page min-h-[calc(100dvh-7rem)]" aria-label="뮤직비디오 감상용 빈 화면" />;
}
