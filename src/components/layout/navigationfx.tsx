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
    const updateBlank = (event: Event) => {
      const visible = Boolean((event as CustomEvent<{ visible?: boolean }>).detail?.visible);
      document.body.classList.toggle('navigation-minimized', visible);
    };
    window.addEventListener('gyopo-navigation-fx', show);
    window.addEventListener('gyopo-navigation-blank', updateBlank);
    return () => {
      window.removeEventListener('gyopo-navigation-fx', show);
      window.removeEventListener('gyopo-navigation-blank', updateBlank);
      document.body.classList.remove('navigation-minimized');
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return <>
    {active && <div className="navigation-experience" aria-hidden="true"><span className="navigation-experience-mark"><svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="2.2"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg></span></div>}
  </>;
}
