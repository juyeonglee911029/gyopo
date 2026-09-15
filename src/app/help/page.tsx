import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('GYOPO 고객센터', 'GYOPO 서비스 이용 방법과 안전 관련 도움을 확인하고 광고·제휴 문의를 접수하세요.', '/help');

export default function HelpPage() {
  return <article className="category-page container mx-auto px-4 py-12 max-w-3xl"><header className="category-header"><div className="category-heading"><h1 className="text-3xl font-black mb-8">고객센터</h1></div></header><p className="max-w-3xl text-gray-600 leading-8">서비스 이용 중 문제가 있으면 커뮤니티에 문의를 남겨주세요. 광고와 제휴 문의는 광고 센터에서 접수할 수 있습니다.</p></article>;
}
