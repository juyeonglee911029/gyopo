'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const STARTUP_SEEN_KEY = 'gyopo-startup-experience-seen';

export default function StartupExperience({ children, ready }: { children: React.ReactNode; ready: boolean }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'blank' | 'reveal' | 'done'>('done');

  useEffect(() => {
    if (!ready || pathname !== '/') {
      setPhase('done');
      return;
    }
    if (window.sessionStorage.getItem(STARTUP_SEEN_KEY) === '1') {
      setPhase('done');
      return;
    }
    setPhase('blank');
    const revealTimer = window.setTimeout(() => setPhase('reveal'), 30_000);
    const doneTimer = window.setTimeout(() => {
      window.sessionStorage.setItem(STARTUP_SEEN_KEY, '1');
      setPhase('done');
    }, 32_200);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(doneTimer);
    };
  }, [pathname, ready]);

  return (
    <>
      {children}
      {phase !== 'done' && <div className={`startup-experience startup-experience-${phase}`} aria-hidden="true"><div className="startup-experience-logo"><span className="startup-experience-mark"><svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current" strokeWidth="2.2"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg></span><b>GYOPO</b><small>GLOBAL NETWORK</small></div></div>}
    </>
  );
}
