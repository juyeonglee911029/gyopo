import type { Metadata } from 'next';
import AssistantPage from '@/app/assistant/page';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('해외 생활 AI 검색', '이민, 취업, 주거, 교육과 지역 생활에 대한 질문을 한국어로 묻고 다음 행동까지 찾아보세요.', '/apps/ai-search');
export default function AppsAiSearchPage() { return <AssistantPage />; }
