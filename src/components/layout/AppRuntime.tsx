'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { completeProfileOnboarding, createDocument, deleteDocument, getSessionToken, getStoredSession, hasCompletedProfile, isMasterUser, mergeDocument, queryDocumentsWhere, recordVisit, refreshStoredUser, saveProfile, sendUserTransfer, USDT_NETWORK, type Gender } from '@/lib/firebase';
import { REGIONS } from '@/lib/regions';
import { useGlobalStore } from '@/store/useGlobalStore';
import StartupExperience from '@/components/layout/StartupExperience';
import { LiveRoomPlayer, RoomChatPanel, type LiveRoom } from '@/app/theater/page';

type FloatingLiveMessage = { id: string; roomId: string; sessionId?: string; authorId: string; user: string; text: string; createdAt: string };

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
  const [profileForm, setProfileForm] = useState({ name: '', country: '', image: '', walletAddress: '', walletNetwork: USDT_NETWORK, walletPublic: false });
  const [floatingRoom, setFloatingRoom] = useState<LiveRoom | null>(null);
  const [floatingMinimized, setFloatingMinimized] = useState(false);
  const [floatingOffset, setFloatingOffset] = useState({ x: 0, y: 0 });
  const [floatingMessages, setFloatingMessages] = useState<FloatingLiveMessage[]>([]);
  const [floatingInput, setFloatingInput] = useState('');
  const [floatingGiftAmount, setFloatingGiftAmount] = useState('1');
  const [floatingGiftMessage, setFloatingGiftMessage] = useState('');
  const floatingDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

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
    const openProfile = () => {
      if (!user) return;
       setProfileForm({ name: user.name, country: user.country || '', image: user.image, walletAddress: user.walletAddress || '', walletNetwork: user.walletNetwork || USDT_NETWORK, walletPublic: Boolean(user.walletPublic) });
      setProfileError('');
      setProfileOpen(true);
    };
    window.addEventListener('gyopo-profile-edit', openProfile);
    return () => window.removeEventListener('gyopo-profile-edit', openProfile);
  }, [user]);

  useEffect(() => {
    const openFloatingRoom = (event: Event) => {
      const room = (event as CustomEvent<LiveRoom>).detail;
      if (!room?.id) return;
      setFloatingRoom(room);
      setFloatingMinimized(false);
      setFloatingOffset({ x: 0, y: 0 });
      window.sessionStorage.setItem('gyopo-floating-live-room', JSON.stringify(room));
    };
    const saved = window.sessionStorage.getItem('gyopo-floating-live-room');
    if (saved) {
      try {
        setFloatingRoom(JSON.parse(saved) as LiveRoom);
        setFloatingMinimized(window.sessionStorage.getItem('gyopo-floating-live-room-minimized') === '1');
        const offset = JSON.parse(window.sessionStorage.getItem('gyopo-floating-live-room-offset') || '{}');
        if (Number.isFinite(offset.x) && Number.isFinite(offset.y)) setFloatingOffset({ x: offset.x, y: offset.y });
      } catch { window.sessionStorage.removeItem('gyopo-floating-live-room'); }
    }
    window.addEventListener('gyopo-live-room-open', openFloatingRoom);
    return () => window.removeEventListener('gyopo-live-room-open', openFloatingRoom);
  }, []);

  useEffect(() => {
    if (!floatingRoom) return;
    window.sessionStorage.setItem('gyopo-floating-live-room-minimized', floatingMinimized ? '1' : '0');
    window.sessionStorage.setItem('gyopo-floating-live-room-offset', JSON.stringify(floatingOffset));
  }, [floatingMinimized, floatingOffset, floatingRoom]);

  useEffect(() => {
    if (!floatingRoom?.id || !floatingRoom.sessionId) {
      setFloatingMessages([]);
      return;
    }
    let active = true;
    const load = async () => {
      const rows = await queryDocumentsWhere<FloatingLiveMessage>('liveRoomMessages', [{ field: 'roomId', op: 'EQUAL', value: floatingRoom.id }, { field: 'sessionId', op: 'EQUAL', value: floatingRoom.sessionId }], getSessionToken(), 100).catch(() => []);
      if (active) setFloatingMessages(rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    void load();
    const timer = window.setInterval(load, 1_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [floatingRoom?.id, floatingRoom?.sessionId]);

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

  const closeFloatingRoom = () => {
    setFloatingRoom(null);
    setFloatingMessages([]);
    window.sessionStorage.removeItem('gyopo-floating-live-room');
    window.sessionStorage.removeItem('gyopo-floating-live-room-minimized');
    window.sessionStorage.removeItem('gyopo-floating-live-room-offset');
  };

  const startFloatingDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest('button, input, textarea')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    floatingDragRef.current = { startX: event.clientX, startY: event.clientY, originX: floatingOffset.x, originY: floatingOffset.y };
  };
  const moveFloatingDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!floatingDragRef.current) return;
    setFloatingOffset({ x: floatingDragRef.current.originX + event.clientX - floatingDragRef.current.startX, y: floatingDragRef.current.originY + event.clientY - floatingDragRef.current.startY });
  };
  const stopFloatingDrag = () => { floatingDragRef.current = null; };

  const sendFloatingMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !floatingRoom?.sessionId || !floatingInput.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    await createDocument('liveRoomMessages', crypto.randomUUID(), { roomId: floatingRoom.id, sessionId: floatingRoom.sessionId, authorId: user.id, user: user.name, text: floatingInput.trim(), createdAt: new Date() }, token).catch(() => undefined);
    setFloatingInput('');
  };

  const sendFloatingGift = async () => {
    if (!user || !floatingRoom?.hostId || floatingRoom.hostId === user.id) return setFloatingGiftMessage('방송자에게만 선물할 수 있습니다.');
    const amount = Number(floatingGiftAmount);
    const token = getSessionToken();
    if (!token || !Number.isFinite(amount) || amount <= 0 || amount > user.usdtBalance) return setFloatingGiftMessage('USDT 잔고와 금액을 확인해주세요.');
    try {
      await sendUserTransfer(user.id, floatingRoom.hostId, amount, 0, token, { kind: 'LIVE_GIFT', roomId: floatingRoom.id, memo: `${floatingRoom.title} 방송 USDT 선물` });
      const refreshed = await refreshStoredUser().catch(() => null);
      if (refreshed) setUser(refreshed);
      setFloatingGiftMessage(`${amount} USDT 선물을 보냈습니다.`);
    } catch { setFloatingGiftMessage('선물에 실패했습니다. Firebase Rules와 잔고를 확인해주세요.'); }
  };

  const resetFloatingRoom = async () => {
    if (!floatingRoom || !isMasterUser(user)) return;
    try {
      const token = getSessionToken();
      if (!token) return;
      await mergeDocument('liveRooms', floatingRoom.id, { status: 'offline', hostId: null, hostName: null, hostImage: null, sessionId: null, viewers: 0, thumbnail: null, updatedAt: new Date() }, token);
      const [viewers, messages] = await Promise.all([
        queryDocumentsWhere<{ roomId?: string }>('liveRoomViewers', [{ field: 'roomId', op: 'EQUAL', value: floatingRoom.id }], token, 200).catch(() => []),
        floatingRoom.sessionId ? queryDocumentsWhere<{ roomId?: string; sessionId?: string }>('liveRoomMessages', [{ field: 'roomId', op: 'EQUAL', value: floatingRoom.id }, { field: 'sessionId', op: 'EQUAL', value: floatingRoom.sessionId }], token, 200).catch(() => []) : Promise.resolve([]),
      ]);
      await Promise.all([...viewers.map((item) => deleteDocument('liveRoomViewers', item.id, token)), ...messages.map((item) => deleteDocument('liveRoomMessages', item.id, token))]).catch(() => undefined);
    } finally {
      closeFloatingRoom();
    }
  };

  return (
    <>
      <StartupExperience ready={sessionChecked}>{children}</StartupExperience>
      {!sessionChecked && <div className="fixed inset-0 z-[190] cursor-wait bg-[#070b17]" aria-hidden="true" />}
      {floatingRoom && user && <div className={`global-live-room-window ${floatingMinimized ? 'is-minimized' : ''}`} style={{ transform: `translate(${floatingOffset.x}px, ${floatingOffset.y}px)` }}>
        <header className="global-live-room-header" onPointerDown={startFloatingDrag} onPointerMove={moveFloatingDrag} onPointerUp={stopFloatingDrag} onPointerCancel={stopFloatingDrag}><div className="min-w-0 flex-1 truncate text-left text-xs font-black"><span className="mr-1 text-rose-300">●</span>{floatingRoom.title || 'LIVE ROOM'}</div><div className="flex gap-1"><button type="button" onPointerDown={(event) => event.stopPropagation()} aria-label={floatingMinimized ? '라이브 창 복원' : '라이브 창 최소화'} onClick={() => setFloatingMinimized((value) => !value)} className="live-room-icon-button">{floatingMinimized ? '□' : '−'}</button><button type="button" onPointerDown={(event) => event.stopPropagation()} aria-label={isMasterUser(user) ? 'Master 방 종료 및 초기화' : '라이브 창 닫기'} onClick={() => isMasterUser(user) ? void resetFloatingRoom() : closeFloatingRoom()} className="live-room-icon-button">×</button></div></header>
        {floatingMinimized ? <div className="global-live-room-mini-video"><LiveRoomPlayer room={floatingRoom} user={user} compact /></div> : <div className="global-live-room-body"><LiveRoomPlayer room={floatingRoom} user={user} /><RoomChatPanel room={floatingRoom} user={user} messages={floatingMessages} message={floatingInput} onMessageChange={setFloatingInput} onSubmit={sendFloatingMessage} /><div className="global-live-room-gift"><div className="text-[10px] font-black text-pink-200">USDT 선물 · 방송인에게</div><div className="mt-1 flex gap-1"><input value={floatingGiftAmount} onChange={(event) => setFloatingGiftAmount(event.target.value)} type="number" min="1" step="1" className="min-w-0 flex-1 bg-white/10 px-2 py-1 text-xs text-white outline-none" /><button type="button" onClick={() => void sendFloatingGift()} className="bg-pink-300 px-2 py-1 text-[10px] font-black text-slate-950">선물</button></div>{floatingGiftMessage && <p className="mt-1 text-[10px] text-emerald-200">{floatingGiftMessage}</p>}</div></div>}
      </div>}
      <dialog ref={dialogRef} onCancel={(event) => event.preventDefault()} className={`m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#10182b] p-0 text-white shadow-2xl backdrop:bg-[#050812]/90 ${!sessionChecked ? 'session-loading-dialog' : ''}`}>
        {!sessionChecked ? (
          <div className="app-session-loading" role="status" aria-label="GYOPO 로딩 중">
            <div className="app-session-loading-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-9 w-9 fill-none stroke-current" strokeWidth="2.2"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg>
            </div>
            <strong>GYOPO</strong>
            <span>GLOBAL NETWORK</span>
            <i aria-hidden="true" />
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
         <section role="dialog" aria-modal="true" aria-label="프로필 편집 / Edit profile" className="profile-edit-panel max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-none border-0 bg-[rgba(8,16,31,.86)] p-6 text-white shadow-none md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-300">Profile / 프로필</p><h2 className="mt-2 text-2xl font-black">내 프로필 편집</h2><p className="mt-1 text-xs text-slate-500">Edit your public member profile</p></div>
             <button type="button" onClick={() => setProfileOpen(false)} aria-label="닫기" className="rounded-none border-0 bg-white/[.05] px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white">닫기</button>
          </div>
          <form onSubmit={saveEditableProfile} className="mt-6 space-y-4">
             <div className="flex items-center gap-4 bg-white/[.03] p-4">
               <img src={profileForm.image} alt="Profile preview" className="h-20 w-20 rounded-none object-cover" />
               <div><p className="text-sm font-black">프로필 사진 / Photo</p><p className="mt-1 text-xs leading-5 text-slate-500">정사각형으로 자동 정리됩니다. JPG, PNG, GIF 지원.</p><label className="mt-3 inline-flex cursor-pointer rounded-none bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-200">사진 선택<input type="file" accept="image/*" onChange={handleProfileImage} className="sr-only" /></label></div>
            </div>
             <label className="block text-sm font-bold text-slate-200">이름 / Name<input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} maxLength={40} className="mt-2 w-full rounded-none border-0 bg-[#070b17] px-4 py-3 text-white outline-none focus:bg-[#0b1221]" /></label>
             <label className="block text-sm font-bold text-slate-200">국가·지역 / Country<input value={profileForm.country} onChange={(event) => setProfileForm((current) => ({ ...current, country: event.target.value }))} list="profile-country-options" className="mt-2 w-full rounded-none border-0 bg-[#070b17] px-4 py-3 text-white outline-none focus:bg-[#0b1221]" /><datalist id="profile-country-options">{REGIONS.filter((region) => region.id !== 'Global').map((region) => <option key={region.id} value={region.id}>{region.flag} {region.label}</option>)}</datalist></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-200">성별 / Gender<input disabled value={user.gender === 'male' ? '남성 / Male' : '여성 / Female'} className="mt-2 w-full cursor-not-allowed rounded-none border-0 bg-white/5 px-4 py-3 text-slate-500" /></label><label className="block text-sm font-bold text-slate-200">나이 / Age<input disabled value={user.age ? `${user.age}세 / years` : ''} className="mt-2 w-full cursor-not-allowed rounded-none border-0 bg-white/5 px-4 py-3 text-slate-500" /></label></div>
               <div className="bg-emerald-300/[.05] p-4"><div className="text-sm font-black text-emerald-200">입금·출금 지갑 / Crypto wallet</div><p className="mt-1 text-xs leading-5 text-slate-400">지갑 주소는 Wallet 화면에서 생성·관리되는 잠금 정보입니다. 프로필 편집에서는 주소를 직접 입력하거나 변경할 수 없습니다.</p><div className="mt-3 bg-black/20 px-3 py-3 font-mono text-xs text-emerald-100">{user.walletAddress || '아직 생성된 Wallet이 없습니다.'}</div><p className="mt-2 text-[11px] text-slate-500">네트워크: {user.walletNetwork || USDT_NETWORK} · 개인키는 프로필에 저장하지 않습니다.</p></div>
             <p className="bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100/70">성별과 나이는 최초 가입 시 저장되며 변경할 수 없습니다. Gender and age are locked after signup.</p>
             {profileError && <p role="alert" className="bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{profileError}</p>}
             <button disabled={profileSaving} className="w-full rounded-none bg-cyan-300 py-3.5 font-black text-slate-950 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50">{profileSaving ? '저장 중... / Saving...' : '프로필 저장 / Save profile'}</button>
          </form>
        </section>
      </div>}
    </>
  );
}
'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { completeProfileOnboarding, createDocument, deleteDocument, getSessionToken, getStoredSession, hasCompletedProfile, isMasterUser, mergeDocument, queryDocumentsWhere, recordVisit, refreshStoredUser, saveProfile, sendUserTransfer, USDT_NETWORK, type Gender } from '@/lib/firebase';
import { REGIONS } from '@/lib/regions';
import { useGlobalStore } from '@/store/useGlobalStore';
import StartupExperience from '@/components/layout/StartupExperience';
import { LiveRoomPlayer, RoomChatPanel, type LiveRoom } from '@/app/theater/page';

type FloatingLiveMessage = { id: string; roomId: string; sessionId?: string; authorId: string; user: string; text: string; createdAt: string };

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
  const [profileForm, setProfileForm] = useState({ name: '', country: '', image: '', walletAddress: '', walletNetwork: USDT_NETWORK, walletPublic: false });
  const [floatingRoom, setFloatingRoom] = useState<LiveRoom | null>(null);
  const [floatingMinimized, setFloatingMinimized] = useState(false);
  const [floatingOffset, setFloatingOffset] = useState({ x: 0, y: 0 });
  const [floatingMessages, setFloatingMessages] = useState<FloatingLiveMessage[]>([]);
  const [floatingInput, setFloatingInput] = useState('');
  const [floatingGiftAmount, setFloatingGiftAmount] = useState('1');
  const [floatingGiftMessage, setFloatingGiftMessage] = useState('');
  const floatingDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

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
    const openProfile = () => {
      if (!user) return;
       setProfileForm({ name: user.name, country: user.country || '', image: user.image, walletAddress: user.walletAddress || '', walletNetwork: user.walletNetwork || USDT_NETWORK, walletPublic: Boolean(user.walletPublic) });
      setProfileError('');
      setProfileOpen(true);
    };
    window.addEventListener('gyopo-profile-edit', openProfile);
    return () => window.removeEventListener('gyopo-profile-edit', openProfile);
  }, [user]);

  useEffect(() => {
    const openFloatingRoom = (event: Event) => {
      const room = (event as CustomEvent<LiveRoom>).detail;
      if (!room?.id) return;
      setFloatingRoom(room);
      setFloatingMinimized(false);
      setFloatingOffset({ x: 0, y: 0 });
      window.sessionStorage.setItem('gyopo-floating-live-room', JSON.stringify(room));
    };
    const saved = window.sessionStorage.getItem('gyopo-floating-live-room');
    if (saved) {
      try {
        setFloatingRoom(JSON.parse(saved) as LiveRoom);
        setFloatingMinimized(window.sessionStorage.getItem('gyopo-floating-live-room-minimized') === '1');
        const offset = JSON.parse(window.sessionStorage.getItem('gyopo-floating-live-room-offset') || '{}');
        if (Number.isFinite(offset.x) && Number.isFinite(offset.y)) setFloatingOffset({ x: offset.x, y: offset.y });
      } catch { window.sessionStorage.removeItem('gyopo-floating-live-room'); }
    }
    window.addEventListener('gyopo-live-room-open', openFloatingRoom);
    return () => window.removeEventListener('gyopo-live-room-open', openFloatingRoom);
  }, []);

  useEffect(() => {
    if (!floatingRoom) return;
    window.sessionStorage.setItem('gyopo-floating-live-room-minimized', floatingMinimized ? '1' : '0');
    window.sessionStorage.setItem('gyopo-floating-live-room-offset', JSON.stringify(floatingOffset));
  }, [floatingMinimized, floatingOffset, floatingRoom]);

  useEffect(() => {
    if (!floatingRoom?.id || !floatingRoom.sessionId) {
      setFloatingMessages([]);
      return;
    }
    let active = true;
    const load = async () => {
      const rows = await queryDocumentsWhere<FloatingLiveMessage>('liveRoomMessages', [{ field: 'roomId', op: 'EQUAL', value: floatingRoom.id }, { field: 'sessionId', op: 'EQUAL', value: floatingRoom.sessionId }], getSessionToken(), 100).catch(() => []);
      if (active) setFloatingMessages(rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    void load();
    const timer = window.setInterval(load, 1_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [floatingRoom?.id, floatingRoom?.sessionId]);

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

  const closeFloatingRoom = () => {
    setFloatingRoom(null);
    setFloatingMessages([]);
    window.sessionStorage.removeItem('gyopo-floating-live-room');
    window.sessionStorage.removeItem('gyopo-floating-live-room-minimized');
    window.sessionStorage.removeItem('gyopo-floating-live-room-offset');
  };

  const startFloatingDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest('button, input, textarea')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    floatingDragRef.current = { startX: event.clientX, startY: event.clientY, originX: floatingOffset.x, originY: floatingOffset.y };
  };
  const moveFloatingDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!floatingDragRef.current) return;
    setFloatingOffset({ x: floatingDragRef.current.originX + event.clientX - floatingDragRef.current.startX, y: floatingDragRef.current.originY + event.clientY - floatingDragRef.current.startY });
  };
  const stopFloatingDrag = () => { floatingDragRef.current = null; };

  const sendFloatingMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !floatingRoom?.sessionId || !floatingInput.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    await createDocument('liveRoomMessages', crypto.randomUUID(), { roomId: floatingRoom.id, sessionId: floatingRoom.sessionId, authorId: user.id, user: user.name, text: floatingInput.trim(), createdAt: new Date() }, token).catch(() => undefined);
    setFloatingInput('');
  };

  const sendFloatingGift = async () => {
    if (!user || !floatingRoom?.hostId || floatingRoom.hostId === user.id) return setFloatingGiftMessage('방송자에게만 선물할 수 있습니다.');
    const amount = Number(floatingGiftAmount);
    const token = getSessionToken();
    if (!token || !Number.isFinite(amount) || amount <= 0 || amount > user.usdtBalance) return setFloatingGiftMessage('USDT 잔고와 금액을 확인해주세요.');
    try {
      await sendUserTransfer(user.id, floatingRoom.hostId, amount, 0, token, { kind: 'LIVE_GIFT', roomId: floatingRoom.id, memo: `${floatingRoom.title} 방송 USDT 선물` });
      const refreshed = await refreshStoredUser().catch(() => null);
      if (refreshed) setUser(refreshed);
      setFloatingGiftMessage(`${amount} USDT 선물을 보냈습니다.`);
    } catch { setFloatingGiftMessage('선물에 실패했습니다. Firebase Rules와 잔고를 확인해주세요.'); }
  };

  const resetFloatingRoom = async () => {
    if (!floatingRoom || !isMasterUser(user)) return;
    const token = getSessionToken();
    if (!token) return;
    const [viewers, messages] = await Promise.all([
      queryDocumentsWhere<{ roomId?: string }>('liveRoomViewers', [{ field: 'roomId', op: 'EQUAL', value: floatingRoom.id }], token, 200).catch(() => []),
      floatingRoom.sessionId ? queryDocumentsWhere<{ roomId?: string; sessionId?: string }>('liveRoomMessages', [{ field: 'roomId', op: 'EQUAL', value: floatingRoom.id }, { field: 'sessionId', op: 'EQUAL', value: floatingRoom.sessionId }], token, 200).catch(() => []) : Promise.resolve([]),
    ]);
    await Promise.all([...viewers.map((item) => deleteDocument('liveRoomViewers', item.id, token)), ...messages.map((item) => deleteDocument('liveRoomMessages', item.id, token))]);
    await mergeDocument('liveRooms', floatingRoom.id, { status: 'offline', hostId: null, hostName: null, hostImage: null, sessionId: null, viewers: 0, thumbnail: null, updatedAt: new Date() }, token);
    closeFloatingRoom();
  };

  return (
    <>
      <StartupExperience ready={sessionChecked}>{children}</StartupExperience>
      {!sessionChecked && <div className="fixed inset-0 z-[190] cursor-wait bg-[#070b17]" aria-hidden="true" />}
      {floatingRoom && user && <div className={`global-live-room-window ${floatingMinimized ? 'is-minimized' : ''}`} style={{ transform: `translate(${floatingOffset.x}px, ${floatingOffset.y}px)` }}>
        <header className="global-live-room-header" onPointerDown={startFloatingDrag} onPointerMove={moveFloatingDrag} onPointerUp={stopFloatingDrag} onPointerCancel={stopFloatingDrag}><div className="min-w-0 flex-1 truncate text-left text-xs font-black"><span className="mr-1 text-rose-300">●</span>{floatingRoom.title || 'LIVE ROOM'}</div><div className="flex gap-1"><button type="button" onPointerDown={(event) => event.stopPropagation()} aria-label={floatingMinimized ? '라이브 창 복원' : '라이브 창 최소화'} onClick={() => setFloatingMinimized((value) => !value)} className="live-room-icon-button">{floatingMinimized ? '□' : '−'}</button><button type="button" onPointerDown={(event) => event.stopPropagation()} aria-label={isMasterUser(user) ? 'Master 방 종료 및 초기화' : '라이브 창 닫기'} onClick={() => isMasterUser(user) ? void resetFloatingRoom() : closeFloatingRoom()} className="live-room-icon-button">×</button></div></header>
        {floatingMinimized ? <div className="global-live-room-mini-video"><LiveRoomPlayer room={floatingRoom} user={user} compact /></div> : <div className="global-live-room-body"><LiveRoomPlayer room={floatingRoom} user={user} /><RoomChatPanel room={floatingRoom} user={user} messages={floatingMessages} message={floatingInput} onMessageChange={setFloatingInput} onSubmit={sendFloatingMessage} /><div className="global-live-room-gift"><div className="text-[10px] font-black text-pink-200">USDT 선물 · 방송인에게</div><div className="mt-1 flex gap-1"><input value={floatingGiftAmount} onChange={(event) => setFloatingGiftAmount(event.target.value)} type="number" min="1" step="1" className="min-w-0 flex-1 bg-white/10 px-2 py-1 text-xs text-white outline-none" /><button type="button" onClick={() => void sendFloatingGift()} className="bg-pink-300 px-2 py-1 text-[10px] font-black text-slate-950">선물</button></div>{floatingGiftMessage && <p className="mt-1 text-[10px] text-emerald-200">{floatingGiftMessage}</p>}</div></div>}
      </div>}
      <dialog ref={dialogRef} onCancel={(event) => event.preventDefault()} className={`m-auto w-[calc(100%-2rem)] max-w-lg overflow-hidden rounded-[2rem] border border-white/10 bg-[#10182b] p-0 text-white shadow-2xl backdrop:bg-[#050812]/90 ${!sessionChecked ? 'session-loading-dialog' : ''}`}>
        {!sessionChecked ? (
          <div className="app-session-loading" role="status" aria-label="GYOPO 로딩 중">
            <div className="app-session-loading-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-9 w-9 fill-none stroke-current" strokeWidth="2.2"><path d="M5 5.5h14M5 12h14M5 18.5h14M5 5.5v13M19 5.5v13" /></svg>
            </div>
            <strong>GYOPO</strong>
            <span>GLOBAL NETWORK</span>
            <i aria-hidden="true" />
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
         <section role="dialog" aria-modal="true" aria-label="프로필 편집 / Edit profile" className="profile-edit-panel max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-none border-0 bg-[rgba(8,16,31,.86)] p-6 text-white shadow-none md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-cyan-300">Profile / 프로필</p><h2 className="mt-2 text-2xl font-black">내 프로필 편집</h2><p className="mt-1 text-xs text-slate-500">Edit your public member profile</p></div>
             <button type="button" onClick={() => setProfileOpen(false)} aria-label="닫기" className="rounded-none border-0 bg-white/[.05] px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white">닫기</button>
          </div>
          <form onSubmit={saveEditableProfile} className="mt-6 space-y-4">
             <div className="flex items-center gap-4 bg-white/[.03] p-4">
               <img src={profileForm.image} alt="Profile preview" className="h-20 w-20 rounded-none object-cover" />
               <div><p className="text-sm font-black">프로필 사진 / Photo</p><p className="mt-1 text-xs leading-5 text-slate-500">정사각형으로 자동 정리됩니다. JPG, PNG, GIF 지원.</p><label className="mt-3 inline-flex cursor-pointer rounded-none bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 hover:bg-cyan-200">사진 선택<input type="file" accept="image/*" onChange={handleProfileImage} className="sr-only" /></label></div>
            </div>
             <label className="block text-sm font-bold text-slate-200">이름 / Name<input value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} maxLength={40} className="mt-2 w-full rounded-none border-0 bg-[#070b17] px-4 py-3 text-white outline-none focus:bg-[#0b1221]" /></label>
             <label className="block text-sm font-bold text-slate-200">국가·지역 / Country<input value={profileForm.country} onChange={(event) => setProfileForm((current) => ({ ...current, country: event.target.value }))} list="profile-country-options" className="mt-2 w-full rounded-none border-0 bg-[#070b17] px-4 py-3 text-white outline-none focus:bg-[#0b1221]" /><datalist id="profile-country-options">{REGIONS.filter((region) => region.id !== 'Global').map((region) => <option key={region.id} value={region.id}>{region.flag} {region.label}</option>)}</datalist></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-bold text-slate-200">성별 / Gender<input disabled value={user.gender === 'male' ? '남성 / Male' : '여성 / Female'} className="mt-2 w-full cursor-not-allowed rounded-none border-0 bg-white/5 px-4 py-3 text-slate-500" /></label><label className="block text-sm font-bold text-slate-200">나이 / Age<input disabled value={user.age ? `${user.age}세 / years` : ''} className="mt-2 w-full cursor-not-allowed rounded-none border-0 bg-white/5 px-4 py-3 text-slate-500" /></label></div>
               <div className="bg-emerald-300/[.05] p-4"><div className="text-sm font-black text-emerald-200">입금·출금 지갑 / Crypto wallet</div><p className="mt-1 text-xs leading-5 text-slate-400">지갑 주소는 Wallet 화면에서 생성·관리되는 잠금 정보입니다. 프로필 편집에서는 주소를 직접 입력하거나 변경할 수 없습니다.</p><div className="mt-3 bg-black/20 px-3 py-3 font-mono text-xs text-emerald-100">{user.walletAddress || '아직 생성된 Wallet이 없습니다.'}</div><p className="mt-2 text-[11px] text-slate-500">네트워크: {user.walletNetwork || USDT_NETWORK} · 개인키는 프로필에 저장하지 않습니다.</p></div>
             <p className="bg-amber-300/[.06] p-3 text-xs leading-5 text-amber-100/70">성별과 나이는 최초 가입 시 저장되며 변경할 수 없습니다. Gender and age are locked after signup.</p>
             {profileError && <p role="alert" className="bg-rose-400/10 p-3 text-sm font-bold text-rose-200">{profileError}</p>}
             <button disabled={profileSaving} className="w-full rounded-none bg-cyan-300 py-3.5 font-black text-slate-950 hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50">{profileSaving ? '저장 중... / Saving...' : '프로필 저장 / Save profile'}</button>
          </form>
        </section>
      </div>}
    </>
  );
}
