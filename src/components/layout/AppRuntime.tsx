'use client';

import { useEffect, useRef, useState } from 'react';
import { completeProfileOnboarding, getSessionToken, getStoredSession, hasCompletedProfile, recordVisit, refreshStoredUser, saveProfile, type Gender } from '@/lib/firebase';
import { REGIONS } from '@/lib/regions';
import { useGlobalStore } from '@/store/useGlobalStore';

function resizeProfileImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('이미지 파일만 선택해주세요.'));
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('프로필 사진은 5MB 이하로 선택해주세요.'));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('이미지 형식을 확인해주세요.'));
      image.onload = () => {
        const size = Math.min(640, Math.max(image.width, image.height));
        const scale = size / Math.max(image.width, image.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', country: '', image: '' });

  useEffect(() => {
    setDarkMode(true);
  }, [setDarkMode]);

  useEffect(() => {
    const enterFullscreen = () => {
      if (document.fullscreenElement || !document.documentElement.requestFullscreen) return;
      void document.documentElement.requestFullscreen().catch(() => undefined);
    };
    void Promise.resolve().then(enterFullscreen);
    window.addEventListener('pointerdown', enterFullscreen, { once: true });
    window.addEventListener('keydown', enterFullscreen, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enterFullscreen);
      window.removeEventListener('keydown', enterFullscreen);
    };
  }, []);

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

  useEffect(() => {
    const openProfile = () => {
      if (!user) return;
      setProfileForm({ name: user.name, country: user.country || '', image: user.image });
      setProfileError('');
      setProfileOpen(true);
    };
    window.addEventListener('gyopo-profile-edit', openProfile);
    return () => window.removeEventListener('gyopo-profile-edit', openProfile);
  }, [user]);

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

  const handleProfileImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await resizeProfileImage(file);
      setProfileForm((current) => ({ ...current, image }));
      setProfileError('');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '프로필 사진을 불러오지 못했습니다.');
    }
    event.target.value = '';
  };

  const saveEditableProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const name = profileForm.name.trim();
    const country = profileForm.country.trim();
    if (!name || !country || country === 'Global' || !profileForm.image) {
      setProfileError('이름, 국가, 프로필 사진을 확인해주세요.');
      return;
    }
    setProfileSaving(true);
    setProfileError('');
    try {
      const nextUser = { ...user, name, country, image: profileForm.image };
      await saveProfile(nextUser, getSessionToken());
      setUser(nextUser);
      setProfileOpen(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.');
    } finally {
      setProfileSaving(false);
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
      {profileOpen && user && <div className="fixed inset-0 z-[180] flex items-center justify-center bg-[#050812]/85 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setProfileOpen(false)}>
        <section role="dialog" aria-modal="true" aria-label="프로필 편집 / Edit profile" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#10182b] p-6 text-white shadow-2xl md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-300">Profile / 프로필</p><h2 className="mt-2 text-2xl font-black">내 프로필 편집</h2><p className="mt-1 text-xs text-slate-500">Edit your public member profile</p></div>
            <button type="button" onClick={() => setProfileOpen(false)} aria-label="닫기" className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">닫기</button>
          </div>
          <form onSubmit={saveEditableProfile} className="mt-6 space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-white/[.03] p-4">
              <img src={profileForm.image} alt="Profile preview" className="h-20 w-20 rounded-2xl object-cover" />
              <div><p className="text-sm font-black">프로필 사진 / Photo</p><p className="mt-1 text-xs leading-5 text-slate-500">정사각형으로 자동 정리됩니다. JPG, PNG, GIF 지원.</p><label className="mt-3 inline-flex cursor-pointer rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-200">사진 선택<input type="file" accept="image/*" onChange={handleProfileImage} className="sr-only" /></label></div>
            </div>
            <label className="block text-sm font-bold text-slate-200">이름 / Name<input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} maxLength={40} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 text-white outline-none focus:border-cyan-300" /></label>
            <label className="block text-sm font-bold text-slate-200">국가·지역 / Country<input value={profileForm.country} onChange={(event) => setProfileForm((current) => ({ ...current, country: event.target.value }))} list="profile-country-options" className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 text-white outline-none focus:border-cyan-300" /><datalist id="profile-country-options">{REGIONS.filter((region) => region.id !== 'Global').map((region) => <option key={region.id} value={region.id}>{region.flag} {region.label}</option>)}</datalist></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-200">성별 / Gender<input disabled value={user.gender === 'male' ? '남성 / Male' : '여성 / Female'} className="mt-2 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-500" /></label><label className="block text-sm font-bold text-slate-200">나이 / Age<input disabled value={user.age ? `${user.age}세 / years` : ''} className="mt-2 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-slate-500" /></label></div>
            <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100/70">성별과 나이는 최초 가입 시 저장되며 변경할 수 없습니다. Gender and age are locked after signup.</p>
            {profileError && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{profileError}</p>}
            <button disabled={profileSaving} className="w-full rounded-xl bg-cyan-300 py-3.5 font-black text-slate-950 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50">{profileSaving ? '저장 중... / Saving...' : '프로필 저장 / Save profile'}</button>
          </form>
        </section>
      </div>}
    </>
  );
}
