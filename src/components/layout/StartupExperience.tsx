'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function StartupExperience({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<'blank' | 'reveal' | 'done'>('blank');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPhase('reveal');
      if (pathname !== '/') router.replace('/');
      window.setTimeout(() => setPhase('done'), 1400);
    }, 30_000);
    return () => window.clearTimeout(timer);
  }, [pathname, router]);

  return (
    <>
      {children}
      {phase !== 'done' && <div className={`startup-experience startup-experience-${phase}`} aria-hidden="true" />}
    </>
  );
}
