'use client';

import { useEffect, useRef, useState } from 'react';
import { completeProfileOnboarding, getSessionToken, getStoredSession, hasCompletedProfile, recordVisit, refreshStoredUser, type Gender } from '@/lib/firebase';
import { REGIONS } from '@/lib/regions';
import { useGlobalStore } from '@/store/useGlobalStore';

export default function AppRuntime({ children }: { children: React.ReactNode }) {
  const setUser = useGlobalStore((state) => state.setUser);
  const user = useGlobalStore((state) => state.user);
  const darkMode = useGlobalStore((state) => state.darkMode);
  const setDarkMode = useGlobalStore((state) => state.setDarkMode);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [gender, setGender] = useState<Gender | ''>('');
  const [country, setCountry] = useState('');
  const [age, setAge] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setDarkMode(true);
  }, [setDarkMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.style.colorScheme = 'dark';
    window.localStorage.setItem('gyopo-dark-mode', '1');
  }, [darkMode]);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const savedUser = getStoredSession()?.user || null;
      if (savedUser) setUser(savedUser);
      const refreshedUser = await refreshStoredUser();
      if (active) {
        setUser(refreshedUser || savedUser);
        setSessionChecked(true);
      }
    };
    void hydrate();
    const beat = () => recordVisit(getStoredSession()?.user || user || null);
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
  }, [setUser, user?.id]);

  useEffect(() => {
    const refresh = async () => {
      const refreshedUser = await refreshStoredUser();
      if (refreshedUser) setUser(refreshedUser);
    };
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [setUser]);

  const savedGender = user?.gender === 'male' || user?.gender === 'female' ? user.gender : '';
  const savedCountry = user?.country && user.country.trim() !== 'Global' ? user.country.trim() : '';
  const savedAge = user?.age && user.age >= 13 ? String(user.age) : '';
  const onboardingRequired = Boolean(sessionChecked && user && !hasCompletedProfile(user));
  const blocked = !sessionChecked || onboardingRequired;

  useEffect(() => {
    setGender(savedGender);
    setCountry(savedCountry);
    setAge(savedAge);
    setSaveError('');
  }, [savedAge, savedCountry, savedGender, user?.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (blocked && !dialog.open) dialog.showModal();
    if (!blocked && dialog.open) dialog.close();
    const previousOverflow = document.body.style.overflow;
    if (blocked) document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [blocked]);

  const saveOnboarding = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const nextGender = savedGender || gender;
    const nextCountry = savedCountry || country;
    const nextAge = Number(savedAge || age);
    if (!nextGender || !nextCountry || !Number.isInteger(nextAge) || nextAge < 13 || nextAge > 130) {
      setSaveError('성별·나이·국가를 모두 선택해주세요.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const completedUser = await completeProfileOnboarding(user, nextGender, nextCountry, nextAge, getSessionToken());
      setUser(completedUser);
      void recordVisit(completedUser);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {children}
      {!sessionChecked && <div className="fixed inset-0 z-[190] cursor-wait bg-[#070b17]" aria-hidden="true" />}
      <dialog ref={dialogRef} onCancel={(event) => event.preventDefault()} className="m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#10182b] p-0 text-white shadow-2xl backdrop:bg-[#050812]/90">
        {!sessionChecked ? (
          <div className="flex min-h-40 items-center justify-center gap-3 p-8 text-sm font-bold text-slate-300">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
            로그인 정보를 확인하고 있습니다.
          </div>
        ) : onboardingRequired ? (
          <form onSubmit={saveOnboarding} className="p-6 md:p-8">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">First profile setup</div>
            <h2 className="mt-3 text-3xl font-black">필수 프로필 설정</h2>
             <p className="mt-3 text-sm leading-6 text-slate-300">회원 활동을 시작하려면 성별·나이·거주 국가를 선택해주세요. 저장 후에는 일반 계정에서 변경할 수 없습니다.</p>

            <label className="mt-6 block text-sm font-bold text-slate-200">
              성별
              <select required disabled={Boolean(savedGender) || saving} value={savedGender || gender} onChange={(event) => setGender(event.target.value as Gender | '')} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60">
                <option value="">선택해주세요</option>
                <option value="male">남성</option>
                <option value="female">여성</option>
              </select>
            </label>

            <label className="mt-4 block text-sm font-bold text-slate-200">
              나이
              <select required disabled={Boolean(savedAge) || saving} value={savedAge || age} onChange={(event) => setAge(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60">
                <option value="">선택해주세요</option>
                {Array.from({ length: 88 }, (_, index) => index + 13).map((value) => <option key={value} value={value}>{value}세</option>)}
              </select>
            </label>

            <label className="mt-4 block text-sm font-bold text-slate-200">
              거주 국가/지역
              <select required disabled={Boolean(savedCountry) || saving} value={savedCountry || country} onChange={(event) => setCountry(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 text-white outline-none ring-cyan-300 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60">
                <option value="">선택해주세요</option>
                {savedCountry && !REGIONS.some((region) => region.id === savedCountry) && <option value={savedCountry}>{savedCountry}</option>}
                {REGIONS.filter((region) => region.id !== 'Global').map((region) => <option key={region.id} value={region.id}>{region.flag} {region.label}</option>)}
              </select>
            </label>

            {saveError && <p className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm font-bold text-red-200">{saveError}</p>}
            <button disabled={saving || !(savedGender || gender) || !(savedCountry || country) || !(savedAge || age)} className="mt-6 w-full rounded-xl bg-cyan-300 py-3.5 font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? '안전하게 저장 중...' : '확인하고 시작하기'}
            </button>
          </form>
        ) : null}
      </dialog>
    </>
  );
}
