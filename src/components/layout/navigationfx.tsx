'use client';

import { useEffect, useRef, useState } from 'react';

export default function NavigationFX() {
  const [active, setActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const show = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setActive(true);
      timerRef.current = window.setTimeout(() => setActive(false), 760);
    };
    window.addEventListener('gyopo-navigation-fx', show);
    return () => {
      window.removeEventListener('gyopo-navigation-fx', show);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!active) return null;
  return <div className="navigation-experience" aria-hidden="true"><span className="navigation-experience-mark"><svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="2.2"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg></span></div>;
}
