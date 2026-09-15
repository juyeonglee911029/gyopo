import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('해외 생활 가이드', '이민, 취업, 금융, 비자와 교민 생활에 바로 적용할 수 있는 실전 가이드를 확인하세요.', '/blog');

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
