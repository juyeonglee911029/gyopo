'use client';

import { useEffect } from 'react';
import { getStoredSession, recordVisit } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

export default function AppRuntime({ children }: { children: React.ReactNode }) {
  const setUser = useGlobalStore((state) => state.setUser);
  const user = useGlobalStore((state) => state.user);
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);

  useEffect(() => {
    const sessionUser = getStoredSession()?.user || null;
    setUser(sessionUser);
    void recordVisit(sessionUser, selectedCountry);
    const heartbeat = window.setInterval(() => {
      void recordVisit(getStoredSession()?.user || user, selectedCountry);
    }, 20_000);
    return () => window.clearInterval(heartbeat);
  }, [selectedCountry, setUser, user]);

  return children;
}
