import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('GYOPO 회원 목록', 'GYOPO에서 활동하는 회원과 교민 네트워크를 확인합니다.', '/users', false);

export default function UsersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
