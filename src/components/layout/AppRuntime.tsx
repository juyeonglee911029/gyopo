'use client';

import { useEffect } from 'react';
import { getStoredSession, recordVisit } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

export default function AppRuntime({ children }: { children: React.ReactNode }) {
  const setUser = useGlobalStore((state) => state.setUser);

  useEffect(() => {
    setUser(getStoredSession()?.user || null);
    void recordVisit();
  }, [setUser]);

  return children;
}
