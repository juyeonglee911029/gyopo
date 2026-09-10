import type { Metadata } from 'next';
import { NOINDEX_FOLLOW } from '@/lib/seo';

export const metadata: Metadata = { robots: NOINDEX_FOLLOW };

export default function AppsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
