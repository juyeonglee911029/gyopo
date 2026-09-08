'use client';

import { useEffect, useState } from 'react';

export default function PortalFrame({ children }: { children: React.ReactNode }) {
  const [loungeOpen, setLoungeOpen] = useState(true);

  useEffect(() => {
    const handleLoungeChange = (event: Event) => {
      setLoungeOpen(Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open));
    };
    window.addEventListener('gyopo-lounge-change', handleLoungeChange);
    return () => window.removeEventListener('gyopo-lounge-change', handleLoungeChange);
  }, []);

  return (
    <div className={`portal-frame flex min-w-0 flex-grow flex-col transition-[padding] duration-300 ${loungeOpen ? 'lg:pr-80' : 'lg:pr-0'} lg:pl-64`}>
      {children}
    </div>
  );
}
