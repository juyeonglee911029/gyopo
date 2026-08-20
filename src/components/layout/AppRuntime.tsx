'use client';

import { useEffect } from 'react';
import { getStoredSession, recordVisit } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

export default function AppRuntime({ children }: { children: React.ReactNode }) {
  const setUser = useGlobalStore((state) => state.setUser);
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const darkMode = useGlobalStore((state) => state.darkMode);
  const setDarkMode = useGlobalStore((state) => state.setDarkMode);

  useEffect(() => {
    setDarkMode(window.localStorage.getItem('gyopo-dark-mode') === '1');
  }, [setDarkMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    window.localStorage.setItem('gyopo-dark-mode', darkMode ? '1' : '0');
  }, [darkMode]);

  useEffect(() => {
    const sessionUser = getStoredSession()?.user || null;
    setUser(sessionUser);
    void recordVisit(sessionUser, selectedCountry);
    const heartbeat = window.setInterval(() => {
      void recordVisit(getStoredSession()?.user || null, selectedCountry);
    }, 20_000);
    return () => window.clearInterval(heartbeat);
  }, [selectedCountry, setUser]);

  return children;
}
