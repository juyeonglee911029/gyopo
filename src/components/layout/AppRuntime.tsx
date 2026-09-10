'use client';

import { useEffect, useRef, useState } from 'react';
import { completeProfileOnboarding, getSessionToken, getStoredSession, hasCompletedProfile, hashTransferPin, isValidTronAddress, recordVisit, refreshStoredUser, saveProfile, USDT_NETWORK, type Gender } from '@/lib/firebase';
import { REGIONS } from '@/lib/regions';
import { useGlobalStore } from '@/store/useGlobalStore';
import { connectTronWallet, provisionTronWallet } from '@/lib/tron';

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
  const [profileForm, setProfileForm] = useState({ name: '', country: '', image: '', walletAddress: '', walletNetwork: USDT_NETWORK, currentTransferPin: '', transferPin: '', transferPinConfirm: '' });
  const [walletChainBalance, setWalletChainBalance] = useState<number | null>(null);
  const [walletChainLoading, setWalletChainLoading] = useState(false);
  const [walletChainError, setWalletChainError] = useState('');

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

  useEffect(() => {
    const openProfile = async () => {
      if (!user) return;
      setProfileForm({ name: user.name, country: user.country || '', image: user.image, walletAddress: user.walletAddress || '', walletNetwork: user.walletNetwork || USDT_NETWORK, currentTransferPin: '', transferPin: '', transferPinConfirm: '' });
      setProfileError('');
      setProfileOpen(true);
      if (user.walletAddress) return;
      const token = getSessionToken();
      if (!token) return;
      try {
        const wallet = await provisionTronWallet(user.id, token);
        const nextUser = { ...user, walletAddress: wallet.address, walletNetwork: USDT_NETWORK, walletCreatedAt: wallet.createdAt };
        await saveProfile(nextUser, token);
        setUser(nextUser);
        setProfileForm((current) => ({ ...current, walletAddress: wallet.address, walletNetwork: USDT_NETWORK }));
        setProfileError('회원 전용 TRON 지갑을 자동 발급하고 주소를 입력했습니다.');
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : '자동 TRON 지갑 발급에 실패했습니다.');
      }
    };
    window.addEventListener('gyopo-profile-edit', openProfile);
    return () => window.removeEventListener('gyopo-profile-edit', openProfile);
  }, [user]);

  useEffect(() => {
    const address = profileForm.walletAddress.trim();
    if (!profileOpen || !isValidTronAddress(address)) {
      setWalletChainBalance(null);
      setWalletChainError('');
      setWalletChainLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setWalletChainLoading(true);
      try {
        const response = await fetch('/api/tron/balance?address=' + encodeURIComponent(address), { cache: 'no-store' });
        const result = await response.json() as { balance?: number; syncedAt?: string; error?: string };
        if (!response.ok) throw new Error(result.error || '체인 잔고를 조회하지 못했습니다.');
        if (active) { setWalletChainBalance(typeof result.balance === 'number' ? result.balance : 0); setWalletChainError(''); }
      } catch (error) {
        if (active) { setWalletChainBalance(null); setWalletChainError(error instanceof Error ? error.message : '체인 잔고를 조회하지 못했습니다.'); }
      } finally {
        if (active) setWalletChainLoading(false);
      }
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [profileForm.walletAddress, profileOpen]);

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

  const connectProfileWallet = async () => {
    try {
      const address = await connectTronWallet();
      setProfileForm((current) => ({ ...current, walletAddress: address, walletNetwork: USDT_NETWORK }));
      setProfileError('TronLink 지갑 주소를 입력했습니다. 프로필 저장을 눌러 반영하세요.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'TronLink 지갑 연결에 실패했습니다.');
    }
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
    const walletAddress = profileForm.walletAddress.trim();
    if (walletAddress && !isValidTronAddress(walletAddress)) {
      setProfileError('TRON 지갑 주소는 T로 시작하는 올바른 주소를 입력해주세요.');
      return;
    }
    const hasPinInput = Boolean(profileForm.currentTransferPin || profileForm.transferPin || profileForm.transferPinConfirm);
    let pinFields: { transferPinHash?: string; transferPinSalt?: string; transferPinSetAt?: string } = {};
    if (hasPinInput) {
      if (!/^\d{4}$/.test(profileForm.transferPin) || profileForm.transferPin !== profileForm.transferPinConfirm) {
        setProfileError('새 송금 PIN은 숫자 4자리로 동일하게 입력해주세요.');
        return;
      }
      if (user.transferPinHash) {
        if (!user.transferPinSalt || !/^\d{4}$/.test(profileForm.currentTransferPin)) {
          setProfileError('기존 PIN을 먼저 입력해주세요.');
          return;
        }
        const currentHash = await hashTransferPin(profileForm.currentTransferPin, user.transferPinSalt);
        if (currentHash !== user.transferPinHash) {
          setProfileError('기존 PIN이 일치하지 않습니다.');
          return;
        }
      }
      const salt = crypto.randomUUID();
      pinFields = { transferPinHash: await hashTransferPin(profileForm.transferPin, salt), transferPinSalt: salt, transferPinSetAt: new Date().toISOString() };
    }
    setProfileSaving(true);
    setProfileError('');
    try {
       const nextUser = { ...user, name, country, image: profileForm.image, walletAddress: walletAddress || undefined, walletNetwork: walletAddress ? profileForm.walletNetwork : undefined, ...pinFields };
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
             <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.05] p-4"><div className="text-sm font-black text-emerald-200">입금·출금 지갑 / Crypto wallet</div><p className="mt-1 text-xs leading-5 text-slate-400">TRON 네트워크에서 입금한 지갑을 등록하면 입금자 식별에 사용할 수 있습니다. 개인키는 입력하지 마세요.</p><div className="mt-3 flex items-end gap-2"><label className="block min-w-0 flex-1 text-sm font-bold text-slate-200">지갑 주소<input value={profileForm.walletAddress} onChange={(event) => setProfileForm((current) => ({ ...current, walletAddress: event.target.value }))} placeholder="T..." className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 font-mono text-sm text-white outline-none focus:border-emerald-300" /></label><button type="button" onClick={() => void connectProfileWallet()} className="shrink-0 rounded-xl bg-emerald-300 px-3 py-3 text-xs font-black text-slate-950 hover:bg-emerald-200">TronLink 연결</button></div><label className="mt-3 block text-sm font-bold text-slate-200">네트워크<select value={profileForm.walletNetwork} onChange={(event) => setProfileForm((current) => ({ ...current, walletNetwork: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 text-white outline-none focus:border-emerald-300"><option value={USDT_NETWORK}>USDT · TRC20 (TRON)</option></select></label></div>
            {profileForm.walletAddress && isValidTronAddress(profileForm.walletAddress) && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-black text-cyan-200">자동 chain 조회 · USDT</div><p className="mt-1 text-xs text-slate-400">입력한 지갑 주소의 실제 TRC20 잔고를 자동으로 조회합니다.</p></div><span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-black text-cyan-200">TRC20</span></div><div className="mt-3 text-2xl font-black text-cyan-200">{walletChainLoading ? '조회 중...' : walletChainBalance === null ? '조회 대기' : walletChainBalance.toFixed(6) + ' USDT'}</div>{walletChainError && <p className="mt-1 text-xs font-bold text-rose-300">{walletChainError}</p>}</div>}
            <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[.05] p-4"><div className="text-sm font-black text-violet-200">송금 안전번호 / Transfer PIN</div><p className="mt-1 text-xs leading-5 text-slate-400">가상 USDT 회원 송금 승인에 사용하는 숫자 4자리입니다. PIN 원문은 저장하지 않고 해시만 저장합니다.</p>{user.transferPinHash && <p className="mt-3 rounded-xl bg-emerald-300/10 p-2 text-xs font-bold text-emerald-200">현재 PIN이 설정되어 있습니다. 변경하려면 기존 PIN을 함께 입력하세요.</p>}{user.transferPinHash && <label className="mt-3 block text-sm font-bold text-slate-200">기존 PIN<input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={profileForm.currentTransferPin} onChange={(event) => setProfileForm((current) => ({ ...current, currentTransferPin: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 font-mono tracking-[.5em] text-white outline-none focus:border-violet-300" placeholder="••••" /></label>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-200">새 PIN<input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={profileForm.transferPin} onChange={(event) => setProfileForm((current) => ({ ...current, transferPin: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 font-mono tracking-[.5em] text-white outline-none focus:border-violet-300" placeholder="••••" /></label><label className="block text-sm font-bold text-slate-200">새 PIN 확인<input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={profileForm.transferPinConfirm} onChange={(event) => setProfileForm((current) => ({ ...current, transferPinConfirm: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 font-mono tracking-[.5em] text-white outline-none focus:border-violet-300" placeholder="••••" /></label></div></div>
            <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100/70">성별과 나이는 최초 가입 시 저장되며 변경할 수 없습니다. Gender and age are locked after signup.</p>
            {profileError && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{profileError}</p>}
            <button disabled={profileSaving} className="w-full rounded-xl bg-cyan-300 py-3.5 font-black text-slate-950 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50">{profileSaving ? '저장 중... / Saving...' : '프로필 저장 / Save profile'}</button>
          </form>
        </section>
      </div>}
    </>
  );
}
'use client';

import { useEffect, useRef, useState } from 'react';
import { completeProfileOnboarding, getSessionToken, getStoredSession, hasCompletedProfile, hashTransferPin, isValidTronAddress, recordVisit, refreshStoredUser, saveProfile, USDT_NETWORK, type Gender } from '@/lib/firebase';
import { REGIONS } from '@/lib/regions';
import { useGlobalStore } from '@/store/useGlobalStore';
import { provisionTronWallet } from '@/lib/tron';

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
  const [profileForm, setProfileForm] = useState({ name: '', country: '', image: '', walletAddress: '', walletNetwork: USDT_NETWORK, currentTransferPin: '', transferPin: '', transferPinConfirm: '' });
  const [walletChainBalance, setWalletChainBalance] = useState<number | null>(null);
  const [walletChainLoading, setWalletChainLoading] = useState(false);
  const [walletChainError, setWalletChainError] = useState('');

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

  useEffect(() => {
    const openProfile = async () => {
      if (!user) return;
      setProfileForm({ name: user.name, country: user.country || '', image: user.image, walletAddress: user.walletAddress || '', walletNetwork: user.walletNetwork || USDT_NETWORK, currentTransferPin: '', transferPin: '', transferPinConfirm: '' });
      setProfileError('');
      setProfileOpen(true);
      if (user.walletAddress) return;
      const token = getSessionToken();
      if (!token) return;
      try {
        const wallet = await provisionTronWallet(user.id, token);
        const nextUser = { ...user, walletAddress: wallet.address, walletNetwork: USDT_NETWORK, walletCreatedAt: wallet.createdAt };
        await saveProfile(nextUser, token);
        setUser(nextUser);
        setProfileForm((current) => ({ ...current, walletAddress: wallet.address, walletNetwork: USDT_NETWORK }));
        setProfileError('회원 전용 TRON 지갑을 자동 발급하고 주소를 입력했습니다.');
      } catch (error) {
        setProfileError(error instanceof Error ? error.message : '자동 TRON 지갑 발급에 실패했습니다.');
      }
    };
    window.addEventListener('gyopo-profile-edit', openProfile);
    return () => window.removeEventListener('gyopo-profile-edit', openProfile);
  }, [user]);

  useEffect(() => {
    const address = profileForm.walletAddress.trim();
    if (!profileOpen || !isValidTronAddress(address)) {
      setWalletChainBalance(null);
      setWalletChainError('');
      setWalletChainLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setWalletChainLoading(true);
      try {
        const response = await fetch('/api/tron/balance?address=' + encodeURIComponent(address), { cache: 'no-store' });
        const result = await response.json() as { balance?: number; syncedAt?: string; error?: string };
        if (!response.ok) throw new Error(result.error || '체인 잔고를 조회하지 못했습니다.');
        if (active) { setWalletChainBalance(typeof result.balance === 'number' ? result.balance : 0); setWalletChainError(''); }
      } catch (error) {
        if (active) { setWalletChainBalance(null); setWalletChainError(error instanceof Error ? error.message : '체인 잔고를 조회하지 못했습니다.'); }
      } finally {
        if (active) setWalletChainLoading(false);
      }
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [profileForm.walletAddress, profileOpen]);

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
    const walletAddress = profileForm.walletAddress.trim();
    if (walletAddress && !isValidTronAddress(walletAddress)) {
      setProfileError('TRON 지갑 주소는 T로 시작하는 올바른 주소를 입력해주세요.');
      return;
    }
    const hasPinInput = Boolean(profileForm.currentTransferPin || profileForm.transferPin || profileForm.transferPinConfirm);
    let pinFields: { transferPinHash?: string; transferPinSalt?: string; transferPinSetAt?: string } = {};
    if (hasPinInput) {
      if (!/^\d{4}$/.test(profileForm.transferPin) || profileForm.transferPin !== profileForm.transferPinConfirm) {
        setProfileError('새 송금 PIN은 숫자 4자리로 동일하게 입력해주세요.');
        return;
      }
      if (user.transferPinHash) {
        if (!user.transferPinSalt || !/^\d{4}$/.test(profileForm.currentTransferPin)) {
          setProfileError('기존 PIN을 먼저 입력해주세요.');
          return;
        }
        const currentHash = await hashTransferPin(profileForm.currentTransferPin, user.transferPinSalt);
        if (currentHash !== user.transferPinHash) {
          setProfileError('기존 PIN이 일치하지 않습니다.');
          return;
        }
      }
      const salt = crypto.randomUUID();
      pinFields = { transferPinHash: await hashTransferPin(profileForm.transferPin, salt), transferPinSalt: salt, transferPinSetAt: new Date().toISOString() };
    }
    setProfileSaving(true);
    setProfileError('');
    try {
       const nextUser = { ...user, name, country, image: profileForm.image, walletAddress: walletAddress || undefined, walletNetwork: walletAddress ? profileForm.walletNetwork : undefined, ...pinFields };
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
             <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.05] p-4"><div className="text-sm font-black text-emerald-200">입금·출금 지갑 / Crypto wallet</div><p className="mt-1 text-xs leading-5 text-slate-400">TRON 네트워크에서 입금한 지갑을 등록하면 입금자 식별에 사용할 수 있습니다. 개인키는 입력하지 마세요.</p><label className="mt-3 block text-sm font-bold text-slate-200">지갑 주소<input value={profileForm.walletAddress} onChange={(event) => setProfileForm((current) => ({ ...current, walletAddress: event.target.value }))} placeholder="T..." className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 font-mono text-sm text-white outline-none focus:border-emerald-300" /></label><label className="mt-3 block text-sm font-bold text-slate-200">네트워크<select value={profileForm.walletNetwork} onChange={(event) => setProfileForm((current) => ({ ...current, walletNetwork: event.target.value }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 text-white outline-none focus:border-emerald-300"><option value={USDT_NETWORK}>USDT · TRC20 (TRON)</option></select></label></div>
            {profileForm.walletAddress && isValidTronAddress(profileForm.walletAddress) && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.05] p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-black text-cyan-200">자동 chain 조회 · USDT</div><p className="mt-1 text-xs text-slate-400">입력한 지갑 주소의 실제 TRC20 잔고를 자동으로 조회합니다.</p></div><span className="rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] font-black text-cyan-200">TRC20</span></div><div className="mt-3 text-2xl font-black text-cyan-200">{walletChainLoading ? '조회 중...' : walletChainBalance === null ? '조회 대기' : walletChainBalance.toFixed(6) + ' USDT'}</div>{walletChainError && <p className="mt-1 text-xs font-bold text-rose-300">{walletChainError}</p>}</div>}
            <div className="rounded-2xl border border-violet-300/15 bg-violet-300/[.05] p-4"><div className="text-sm font-black text-violet-200">송금 안전번호 / Transfer PIN</div><p className="mt-1 text-xs leading-5 text-slate-400">가상 USDT 회원 송금 승인에 사용하는 숫자 4자리입니다. PIN 원문은 저장하지 않고 해시만 저장합니다.</p>{user.transferPinHash && <p className="mt-3 rounded-xl bg-emerald-300/10 p-2 text-xs font-bold text-emerald-200">현재 PIN이 설정되어 있습니다. 변경하려면 기존 PIN을 함께 입력하세요.</p>}{user.transferPinHash && <label className="mt-3 block text-sm font-bold text-slate-200">기존 PIN<input type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={profileForm.currentTransferPin} onChange={(event) => setProfileForm((current) => ({ ...current, currentTransferPin: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 font-mono tracking-[.5em] text-white outline-none focus:border-violet-300" placeholder="••••" /></label>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-200">새 PIN<input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={profileForm.transferPin} onChange={(event) => setProfileForm((current) => ({ ...current, transferPin: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 font-mono tracking-[.5em] text-white outline-none focus:border-violet-300" placeholder="••••" /></label><label className="block text-sm font-bold text-slate-200">새 PIN 확인<input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} value={profileForm.transferPinConfirm} onChange={(event) => setProfileForm((current) => ({ ...current, transferPinConfirm: event.target.value.replace(/\D/g, '').slice(0, 4) }))} className="mt-2 w-full rounded-xl border border-white/10 bg-[#070b17] px-4 py-3 font-mono tracking-[.5em] text-white outline-none focus:border-violet-300" placeholder="••••" /></label></div></div>
            <p className="rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100/70">성별과 나이는 최초 가입 시 저장되며 변경할 수 없습니다. Gender and age are locked after signup.</p>
            {profileError && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{profileError}</p>}
            <button disabled={profileSaving} className="w-full rounded-xl bg-cyan-300 py-3.5 font-black text-slate-950 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50">{profileSaving ? '저장 중... / Saving...' : '프로필 저장 / Save profile'}</button>
          </form>
        </section>
      </div>}
    </>
  );
}
