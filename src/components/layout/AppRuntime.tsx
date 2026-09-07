'use client';

import { useEffect } from 'react';
import { getStoredSession, recordVisit, refreshStoredUser } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

export default function AppRuntime({ children }: { children: React.ReactNode }) {
  const setUser = useGlobalStore((state) => state.setUser);
  const user = useGlobalStore((state) => state.user);
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const setSelectedCountry = useGlobalStore((state) => state.setSelectedCountry);
  const darkMode = useGlobalStore((state) => state.darkMode);
  const setDarkMode = useGlobalStore((state) => state.setDarkMode);

  useEffect(() => {
    setDarkMode(window.localStorage.getItem('gyopo-dark-mode') === '1');
    const savedRegion = window.localStorage.getItem('gyopo-region');
    if (savedRegion) setSelectedCountry(savedRegion);
  }, [setDarkMode, setSelectedCountry]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    window.localStorage.setItem('gyopo-dark-mode', darkMode ? '1' : '0');
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem('gyopo-region', selectedCountry);
  }, [selectedCountry]);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const savedUser = getStoredSession()?.user || null;
      if (savedUser) setUser(savedUser);
      const refreshedUser = await refreshStoredUser();
      if (active) setUser(refreshedUser || savedUser);
    };
    void hydrate();
    const beat = () => recordVisit(getStoredSession()?.user || user || null, selectedCountry);
    void beat();
    const heartbeat = window.setInterval(() => {
      void beat();
    }, 10_000);
    window.addEventListener('focus', beat);
    window.addEventListener('storage', hydrate);
    return () => {
      active = false;
      window.clearInterval(heartbeat);
      window.removeEventListener('focus', beat);
      window.removeEventListener('storage', hydrate);
    };
  }, [selectedCountry, setUser, user?.id]);

  useEffect(() => {
    const refresh = async () => {
      const refreshedUser = await refreshStoredUser();
      if (refreshedUser) setUser(refreshedUser);
    };
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [setUser]);

  return children;
}
