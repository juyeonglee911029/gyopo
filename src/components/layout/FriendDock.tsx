'use client';

import { type FormEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { Check, MessageCircle, PhoneCall, PhoneOff, Send, UserRoundCheck, Video, X } from 'lucide-react';
import { createDocument, createFriendCallRequest, getDocument, getSessionToken, listFriendConnections, listIncomingFriendCallRequests, queryDocumentsWhere, respondToFriendCallRequest, type FriendCallRequest, type PublicProfile } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type FriendMember = Partial<PublicProfile> & { id: string; friendshipId: string };
type FriendMessage = {
  id: string;
  friendshipId: string;
  participants: string[];
  authorId: string;
  user: string;
  text: string;
  createdAt: string;
  expiresAt: string;
};

export default function FriendDock() {
  const user = useGlobalStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<FriendMember[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [videoFriendId, setVideoFriendId] = useState('');
  const [messages, setMessages] = useState<FriendMessage[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [incomingCalls, setIncomingCalls] = useState<FriendCallRequest[]>([]);
  const [dockPosition, setDockPosition] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      const friendId = (event as CustomEvent<{ friendId?: string }>).detail?.friendId;
      if (friendId) setSelectedId(friendId);
      setOpen(true);
    };
    window.addEventListener('gyopo-friends-open', show);
    return () => window.removeEventListener('gyopo-friends-open', show);
  }, []);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setSelectedId('');
      setVideoFriendId('');
      return;
    }
    let active = true;
    const load = async () => {
      const token = getSessionToken();
      const connections = await listFriendConnections(user.id, token).catch(() => []);
      const accepted = connections.filter((item) => item.status === 'accepted');
      const rows = await Promise.all(accepted.map(async (connection) => {
        const id = connection.requesterId === user.id ? connection.addresseeId : connection.requesterId;
        const profile = await getDocument<PublicProfile>('publicProfiles', id, token).catch(() => null);
        return { id, friendshipId: connection.id, ...(profile || {}) } as FriendMember;
      }));
      if (!active) return;
      setFriends(rows);
      setSelectedId((current) => rows.some((friend) => friend.id === current) ? current : rows[0]?.id || '');
    };
    void load();
    const timer = window.setInterval(load, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setIncomingCalls([]);
      return;
    }
    let active = true;
    const load = async () => {
      const requests = await listIncomingFriendCallRequests(user.id, getSessionToken()).catch(() => []);
      if (active) {
        setIncomingCalls(requests);
        if (requests.length > 0) setOpen(true);
      }
    };
    void load();
    const timer = window.setInterval(load, 2_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id]);

  const selected = friends.find((friend) => friend.id === selectedId) || null;

  const startDockDrag = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button')) return;
    const panel = document.getElementById('friend-dock');
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    setDockPosition((current) => current || { left: rect.left, top: rect.top });
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDock = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setDockPosition({
      left: Math.max(8, Math.min(window.innerWidth - drag.width - 8, event.clientX - drag.offsetX)),
      top: Math.max(8, Math.min(window.innerHeight - drag.height - 8, event.clientY - drag.offsetY)),
    });
  };

  const stopDockDrag = (event: PointerEvent<HTMLElement>) => {
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!user || !selected) {
      setMessages([]);
      return;
    }
    let active = true;
    const load = async () => {
      const token = getSessionToken();
      const rows = await queryDocumentsWhere<Omit<FriendMessage, 'id'>>(
        'webrtcChatMessages',
        [{ field: 'participants', op: 'ARRAY_CONTAINS', value: user.id }],
        token,
        100,
      ).catch(() => []);
      if (!active) return;
      setMessages(rows
        .filter((message) => message.friendshipId === selected.friendshipId)
        .filter((message) => new Date(message.expiresAt).getTime() > Date.now())
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-40));
    };
    void load();
    const timer = window.setInterval(load, 1_500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selected?.friendshipId, user?.id]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !selected || !input.trim()) return;
    const token = getSessionToken();
    if (!token) return setError('다시 로그인해주세요.');
    const message = {
      friendshipId: selected.friendshipId,
      participants: [user.id, selected.id].sort(),
      authorId: user.id,
      user: user.name,
      text: input.trim(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    try {
      await createDocument('webrtcChatMessages', crypto.randomUUID(), message, token);
      setMessages((rows) => [...rows, { id: crypto.randomUUID(), ...message }]);
      setInput('');
      setError('');
    } catch {
      setError('메시지를 보내지 못했습니다. 다시 시도해주세요.');
    }
  };

  const requestVideoCall = async (friendId: string) => {
    if (!user) return;
    setVideoFriendId(friendId);
    setError('친구의 통화 수락을 기다리는 중입니다.');
    try {
      await createFriendCallRequest(friendId, user, getSessionToken());
      setError('통화 요청을 보냈습니다. 친구가 수락하면 바로 연결됩니다.');
    } catch (error) {
      setError(error instanceof Error ? error.message : '통화 요청을 보내지 못했습니다. 다시 시도해주세요.');
    }
  };

  const answerVideoCall = async (request: FriendCallRequest, status: 'accepted' | 'declined') => {
    try {
      await respondToFriendCallRequest(request, status, getSessionToken());
      setIncomingCalls((rows) => rows.filter((row) => row.id !== request.id));
      if (status === 'accepted') window.location.href = `/webrtc?friend=${encodeURIComponent(request.callerId)}&auto=1`;
    } catch {
      setError('통화 요청을 처리하지 못했습니다. 다시 시도해주세요.');
    }
  };

  if (!user) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="친구 채팅 열기" className="fixed bottom-20 left-3 z-[65] grid h-12 w-12 place-items-center rounded-2xl border border-cyan-200/20 bg-[#10182b] text-cyan-200 shadow-2xl lg:hidden">
        <UserRoundCheck size={21} />
      </button>

       <aside id="friend-dock" style={dockPosition ? { left: dockPosition.left, top: dockPosition.top, right: 'auto', bottom: 'auto' } : undefined} className={`fixed bottom-4 left-3 right-3 z-[70] overflow-hidden rounded-[1.5rem] border border-cyan-200/20 bg-[#091120] text-white shadow-[0_25px_100px_rgba(0,0,0,.7)] transition ${dragging ? 'cursor-grabbing select-none transition-none' : 'cursor-default'} lg:left-[17rem] lg:right-auto lg:w-[430px] ${open ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-5 opacity-0'}`}>
         <header onPointerDown={startDockDrag} onPointerMove={moveDock} onPointerUp={stopDockDrag} onPointerCancel={stopDockDrag} className={`flex items-center justify-between border-b border-white/10 px-4 py-3 ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}>
           <div className="flex items-center gap-2 text-sm font-black"><UserRoundCheck size={17} className="text-cyan-300" /> 친구 채팅·통화</div>
           <button type="button" onClick={() => setOpen(false)} aria-label="친구 패널 닫기" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X size={17} /></button>
         </header>

         {incomingCalls.length > 0 && <div className="mx-3 mt-3 rounded-2xl border border-emerald-300/25 bg-emerald-300/[.08] p-3"><div className="flex items-center gap-2 text-xs font-black text-emerald-100"><PhoneCall size={14} /> 영상 통화 요청 / Incoming call</div>{incomingCalls.map((request) => <div key={request.id} className="mt-3 flex items-center gap-2"><img src={request.callerImage} alt="" className="h-8 w-8 rounded-lg object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-white">{request.callerName}</p><p className="text-[10px] text-emerald-100/65">친구가 영상 통화를 요청했습니다.</p></div><button type="button" onClick={() => void answerVideoCall(request, 'accepted')} aria-label="통화 수락" className="rounded-lg bg-emerald-300 p-2 text-slate-950"><Check size={14} /></button><button type="button" onClick={() => void answerVideoCall(request, 'declined')} aria-label="통화 거절" className="rounded-lg bg-white/10 p-2 text-slate-300"><X size={14} /></button></div>)}</div>}

         {friends.length === 0 ? (
           <div className="p-8 text-center"><UserRoundCheck size={28} className="mx-auto text-slate-600" /><p className="mt-3 text-sm font-bold text-slate-300">수락된 친구가 없습니다.</p><p className="mt-1 text-xs text-slate-500">유저 목록에서 친구 요청을 보내보세요.</p></div>
         ) : (
           <>
             <div className="flex gap-2 overflow-x-auto border-b border-white/10 p-2.5">
              {friends.map((friend) => <button key={friend.id} type="button" onClick={() => setSelectedId(friend.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-black ${friend.id === selectedId ? 'bg-cyan-300 text-slate-950' : 'bg-white/5 text-slate-300'}`}>{friend.image ? <img src={friend.image} alt="" className="h-6 w-6 rounded-lg object-cover" /> : <span className="grid h-6 w-6 place-items-center rounded-lg bg-white/10">{friend.name?.slice(0, 1) || '?'}</span>}<span className="max-w-24 truncate">{friend.name || '친구'}</span></button>)}
            </div>

            {selected && <div className="p-3">
              {videoFriendId === selected.id ? (
                <div className="relative mb-3 aspect-video overflow-hidden rounded-xl bg-black"><iframe title={`${selected.name || '친구'} 영상 통화`} src={`/webrtc?friend=${encodeURIComponent(selected.id)}&auto=1&compact=1`} allow="camera; microphone; autoplay; display-capture" className="h-full w-full border-0" /><button type="button" onClick={() => setVideoFriendId('')} className="absolute right-2 top-2 rounded-lg bg-rose-500/90 p-2 text-white" aria-label="영상 통화 종료"><PhoneOff size={15} /></button></div>
              ) : (
                 <button type="button" onClick={() => void requestVideoCall(selected.id)} className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-2.5 text-xs font-black text-slate-950"><Video size={15} /> {selected.name || '친구'} 통화 요청 / Call</button>
              )}

              <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[.16em] text-slate-500"><span className="flex items-center gap-1.5"><MessageCircle size={13} /> Friend chat</span><span>24시간 보관</span></div>
              <div className="h-32 space-y-1.5 overflow-y-auto rounded-xl bg-black/20 p-2">{messages.length === 0 ? <p className="py-10 text-center text-xs text-slate-600">첫 메시지를 보내보세요.</p> : messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs ${message.authorId === user.id ? 'ml-auto bg-cyan-300 text-slate-950' : 'bg-white/10 text-slate-200'}`}><b className="block text-[9px] opacity-65">{message.user}</b><span className="break-words">{message.text}</span></div>)}</div>
              {error && <p role="alert" className="mt-2 text-xs font-bold text-rose-300">{error}</p>}
              <form onSubmit={sendMessage} className="mt-2 flex gap-2"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="친구에게 메시지..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300" /><button aria-label="친구 메시지 보내기" className="rounded-xl bg-cyan-300 px-3 text-slate-950"><Send size={15} /></button></form>
            </div>}
          </>
        )}
      </aside>
    </>
  );
}
