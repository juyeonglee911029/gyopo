'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const focusedRoute = pathname === '/games' || pathname === '/webrtc';
  return <div key={pathname} className={`page-transition ${focusedRoute ? 'page-transition-focused' : ''}`}>{children}</div>;
}
