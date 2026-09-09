'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MapPin, ShieldCheck, UserPlus, Users as UsersIcon, Video, X } from 'lucide-react';
import { getDocument, listFriendConnections, listOnlineUsers, respondToFriendRequest, sendFriendRequest, type FriendConnection, type OnlineUser, type PublicProfile } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type SelectedMember = Partial<PublicProfile> & Pick<OnlineUser, 'id' | 'name' | 'image'>;


export default function UsersPage() {
  const user = useGlobalStore((state) => state.user);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [selectedMember, setSelectedMember] = useState<SelectedMember | null>(null);
  const [friendships, setFriendships] = useState<FriendConnection[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, Partial<PublicProfile>>>({});
  const [friendBusy, setFriendBusy] = useState('');
  const [friendError, setFriendError] = useState('');
  const selectionRequest = useRef(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const users = await listOnlineUsers().catch(() => []);
      if (active) setOnlineUsers(users);
    };
    void load();
    const timer = window.setInterval(load, 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) {
      setFriendships([]);
      return () => { active = false; };
    }
    const load = async () => {
      const rows = await listFriendConnections(user.id).catch(() => []);
      if (active) setFriendships(rows);
    };
    void load();
    const timer = window.setInterval(load, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    if (!user || friendships.length === 0) {
      setFriendProfiles({});
      return () => { active = false; };
    }
    const ids = [...new Set(friendships.map((connection) => connection.requesterId === user.id ? connection.addresseeId : connection.requesterId))];
    void Promise.all(ids.map(async (id) => [id, await getDocument<PublicProfile>('publicProfiles', id).catch(() => null)] as const)).then((rows) => {
      if (!active) return;
      setFriendProfiles(Object.fromEntries(rows.filter(([, profile]) => profile).map(([id, profile]) => [id, profile as PublicProfile])));
    });
    return () => { active = false; };
  }, [friendships, user?.id]);

  const relationshipFor = (memberId: string) => friendships.find((item) => item.requesterId === memberId || item.addresseeId === memberId);
  const isFriend = (memberId: string) => relationshipFor(memberId)?.status === 'accepted';

  const requestFriend = async (memberId: string) => {
    setFriendBusy(memberId);
    setFriendError('');
    try {
      await sendFriendRequest(memberId);
      const rows = user ? await listFriendConnections(user.id).catch(() => []) : [];
      setFriendships(rows);
    } catch (error) {
      setFriendError(error instanceof Error && error.message.includes('PERMISSION_DENIED')
        ? '친구 요청 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.'
        : '친구 요청을 보내지 못했습니다. 다시 시도해주세요.');
    } finally {
      setFriendBusy('');
    }
  };

  const acceptFriend = async (connection: FriendConnection) => {
    setFriendBusy(connection.id);
    try {
      await respondToFriendRequest(connection, 'accepted');
      setFriendships((rows) => rows.map((row) => row.id === connection.id ? { ...row, status: 'accepted' } : row));
    } finally {
      setFriendBusy('');
    }
  };

  const showMember = async (online: OnlineUser) => {
    const requestId = ++selectionRequest.current;
    setSelectedMember({
      id: online.id,
      name: online.name,
      image: online.image,
      gender: online.gender,
      country: online.country,
      age: online.age,
    });
    const profile = await getDocument<PublicProfile>('publicProfiles', online.id).catch(() => null);
    if (selectionRequest.current !== requestId) return;
    if (profile) setSelectedMember(profile);
  };

  const closeMember = () => {
    selectionRequest.current += 1;
    setSelectedMember(null);
  };

  return (
    <div className="users-page min-h-[calc(100vh-64px)] bg-transparent px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-indigo-500">Open directory</div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">실시간 회원</h1>
            <p className="mt-3 text-sm text-slate-500">로그인이나 결제 없이 현재 접속 중인 회원을 공개합니다.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-3 shadow-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            <b className="text-2xl text-slate-950">{onlineUsers.length}</b>
            <span className="text-sm font-bold text-slate-500">online now</span>
          </div>
        </header>

        {user && <section className="mb-8 rounded-[2rem] border border-indigo-100 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">My network</div><h2 className="mt-1 text-xl font-black text-slate-950">친구 목록</h2><p className="mt-1 text-xs text-slate-500">친구를 선택해 바로 영상 통화를 시작하세요.</p></div><span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">{friendships.filter((item) => item.status === 'accepted').length}명 친구</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{friendships.length === 0 ? <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm font-bold text-slate-500">아직 친구가 없습니다. 아래 회원 목록에서 친구 추가를 눌러보세요.</div> : friendships.map((connection) => { const memberId = connection.requesterId === user.id ? connection.addresseeId : connection.requesterId; const online = onlineUsers.find((item) => item.id === memberId); const profile = friendProfiles[memberId]; const name = online?.name || profile?.name || '친구 회원'; const image = online?.image || profile?.image; const incoming = connection.addresseeId === user.id && connection.status === 'pending'; return <div key={connection.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"><div className="relative shrink-0">{image ? <img src={image} alt="" className="h-11 w-11 rounded-2xl object-cover" /> : <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-100 text-sm font-black text-indigo-700">{name.slice(0, 1)}</div>}{online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-black text-slate-900">{name}</div><div className="truncate text-[11px] text-slate-400">{online?.country || profile?.country || (online ? '온라인' : '오프라인')}</div></div>{connection.status === 'accepted' ? <Link href={`/webrtc?friend=${encodeURIComponent(memberId)}`} className="shrink-0 rounded-xl bg-indigo-600 px-2.5 py-2 text-[11px] font-black text-white">영상통화</Link> : incoming ? <button type="button" disabled={friendBusy === connection.id} onClick={() => void acceptFriend(connection)} className="shrink-0 rounded-xl bg-emerald-500 px-2.5 py-2 text-[11px] font-black text-slate-950 disabled:opacity-50">수락</button> : <span className="shrink-0 text-[10px] font-bold text-slate-400">대기 중</span>}</div>; })}</div></section>}

        {friendError && <p role="alert" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{friendError}</p>}

        {onlineUsers.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-20 text-center shadow-sm">
            <UsersIcon className="mx-auto mb-4 text-slate-300" size={38} />
            <h2 className="font-black text-slate-700">현재 접속 중인 회원이 없습니다.</h2>
            <p className="mt-2 text-sm text-slate-400">다른 회원이 로그인하면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {onlineUsers.map((online) => (
              <article key={online.id} className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                 <div role="button" tabIndex={0} onClick={() => void showMember(online)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') void showMember(online); }} className="block w-full text-left">
                  <div className="h-24 bg-[linear-gradient(135deg,#111827,#334155,#4f46e5)]" />
                  <div className="relative px-5 pb-5">
                    <img src={online.image} alt="" className="-mt-10 h-20 w-20 rounded-3xl border-4 border-white object-cover shadow-lg" />
                    <h2 className="mt-4 text-xl font-black text-slate-950">{online.name}</h2>
                    <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 지금 접속 중</div>
                     <div className="mt-4 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} /> {online.country || '국가 미설정'}</div>
                     {online.age ? <p className="mt-2 text-xs text-slate-400">{online.age}세 · {online.gender === 'male' ? '남성' : online.gender === 'female' ? '여성' : '성별 미설정'}</p> : <p className="mt-2 text-xs text-slate-400">{online.gender === 'male' ? '남성' : online.gender === 'female' ? '여성' : '성별 미설정'}</p>}
                     {user && online.id !== user.id && <div className="mt-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
                       {isFriend(online.id) ? <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('gyopo-friends-open', { detail: { friendId: online.id } }))} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-black text-white hover:bg-indigo-500"><Video size={14} /> 친구 통화</button> : relationshipFor(online.id)?.status === 'pending' && relationshipFor(online.id)?.addresseeId === user.id ? <button type="button" disabled={friendBusy === relationshipFor(online.id)?.id} onClick={() => { const relation = relationshipFor(online.id); if (relation) void acceptFriend(relation); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-black text-slate-950 disabled:opacity-50">친구 수락</button> : <button type="button" disabled={relationshipFor(online.id)?.status === 'pending' || friendBusy === online.id} onClick={() => void requestFriend(online.id)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs font-black text-indigo-700 disabled:opacity-50"><UserPlus size={14} /> {relationshipFor(online.id)?.status === 'pending' ? '요청 보냄' : relationshipFor(online.id)?.status === 'declined' ? '다시 요청' : '친구 추가'}</button>}
                     </div>}
                   </div>
                 </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selectedMember && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4" onMouseDown={(event) => event.target === event.currentTarget && closeMember()}>
          <section role="dialog" aria-modal="true" aria-label={`${selectedMember.name} 공개 프로필`} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] bg-white p-6 text-slate-900 shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <img src={selectedMember.image} alt="" className="h-20 w-20 rounded-3xl object-cover shadow-md" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-500"><ShieldCheck size={15} /> Public profile</div>
                  <h2 className="mt-2 truncate text-3xl font-black">{selectedMember.name}</h2>
                </div>
              </div>
              <button type="button" onClick={closeMember} aria-label="닫기" className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"><X size={19} /></button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-4"><span className="block text-xs font-bold text-slate-400">국가/지역</span><b className="mt-1 block">{selectedMember.country || '공개 정보 없음'}</b></div>
              <div className="rounded-2xl bg-slate-50 p-4"><span className="block text-xs font-bold text-slate-400">프로필</span><b className="mt-1 block">{selectedMember.gender === 'male' ? '남성' : selectedMember.gender === 'female' ? '여성' : '공개 정보 없음'}{selectedMember.age ? ` · ${selectedMember.age}세` : ''}</b></div>
            </div>

          </section>
        </div>
      )}
    </div>
  );
}
