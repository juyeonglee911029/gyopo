'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, Eye, Heart, MessageCircle, Radio, Send, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { createDocument, getDocument, getSessionToken, listDocuments, mergeDocument, queryDocumentsWhere, reserveEscrowPurchase, type PortalUser } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

const ROOM_COUNT = 30;
const PAGE_SIZE = 10;
const iceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];

type LiveRoom = { id: string; roomNumber: number; title?: string; category?: string; hostId?: string; hostName?: string; hostImage?: string; status?: 'offline' | 'live'; viewers?: number; thumbnail?: string; updatedAt?: string };
type LiveMessage = { id: string; roomId: string; authorId: string; user: string; text: string; createdAt: string };
type HelperRequest = { id: string; roomId: string; requesterId: string; helperId: string; amount: number; requestText: string; status: string; orderId: string; createdAt: string };
type ViewerSignal = { id: string; roomId: string; viewerId: string; hostId: string; status: 'offer' | 'answer' | 'connected' | 'ended'; offer?: string; answer?: string; updatedAt?: string };

const waitForIce = (peer: RTCPeerConnection) => new Promise<void>((resolve) => {
  if (peer.iceGatheringState === 'complete') return resolve();
  const finish = () => { if (peer.iceGatheringState === 'complete') { peer.removeEventListener('icegatheringstatechange', finish); resolve(); } };
  peer.addEventListener('icegatheringstatechange', finish);
  window.setTimeout(() => { peer.removeEventListener('icegatheringstatechange', finish); resolve(); }, 4_000);
});

function LiveRoomPlayer({ room, user }: { room: LiveRoom; user: PortalUser | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const viewerIdRef = useRef(`viewer-${user?.id || 'guest'}-${room.id}`);
  const [status, setStatus] = useState('시청 연결 준비 중');

  useEffect(() => {
    if (!user || room.status !== 'live' || !room.hostId) return;
    const token = getSessionToken();
    if (!token) return;
    let active = true;
    viewerIdRef.current = `viewer-${user.id}-${room.id}`;
    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;
    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });
    peer.ontrack = (event) => {
      if (!videoRef.current || !event.streams[0]) return;
      videoRef.current.srcObject = event.streams[0];
      void videoRef.current.play().catch(() => undefined);
      setStatus('LIVE 수신 중');
    };
    peer.onconnectionstatechange = () => {
      if (!active) return;
      if (peer.connectionState === 'connected') setStatus('방송 연결 완료');
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') setStatus('재연결 중');
    };
    const touchPresence = (nextStatus: ViewerSignal['status']) => mergeDocument('liveRoomViewers', viewerIdRef.current, { status: nextStatus, updatedAt: new Date() }, token).catch(() => undefined);
    const signal = async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIce(peer);
      await mergeDocument('liveRoomViewers', viewerIdRef.current, { roomId: room.id, viewerId: user.id, hostId: room.hostId, status: 'offer', offer: JSON.stringify(peer.localDescription), updatedAt: new Date() }, token).catch(() => undefined);
      for (let attempt = 0; active && attempt < 25; attempt += 1) {
        const current = await getDocument<ViewerSignal>('liveRoomViewers', viewerIdRef.current, token).catch(() => null);
        if (current?.answer && !peer.currentRemoteDescription) {
          await peer.setRemoteDescription(JSON.parse(current.answer) as RTCSessionDescriptionInit);
          await touchPresence('connected');
          setStatus('방송 연결 완료');
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1_500));
      }
    };
    void signal();
    const presenceTimer = window.setInterval(() => { if (active) void touchPresence(peer.connectionState === 'connected' ? 'connected' : 'offer'); }, 5_000);
    return () => {
      active = false;
      window.clearInterval(presenceTimer);
      peer.close();
      peerRef.current = null;
      void mergeDocument('liveRoomViewers', viewerIdRef.current, { status: 'ended', updatedAt: new Date() }, token).catch(() => undefined);
    };
  }, [room.id, room.hostId, room.status, user?.id]);

  if (!user) return <div className="live-room-player live-room-player-empty">로그인하면 방송 화면을 시청할 수 있습니다.</div>;
  return <div className="live-room-player"><video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" /><div className="live-room-player-status"><span />{status}</div></div>;
}

function RoomChatPanel({ room, user, messages, message, onMessageChange, onSubmit }: { room: LiveRoom; user: PortalUser | null; messages: LiveMessage[]; message: string; onMessageChange: (value: string) => void; onSubmit: (event: React.FormEvent) => void }) {
  return <div className="live-room-chat-panel"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-black"><MessageCircle size={16} className="text-rose-300" />{room.title} 채팅</div><span className="text-[10px] font-bold text-slate-500">방 안에서만 표시</span></div><div className="mt-3 h-52 space-y-2 overflow-y-auto rounded-sm bg-black/10 p-2">{messages.length ? messages.map((item) => <div key={item.id} className="text-xs text-slate-300"><b className="text-rose-200">{item.user}</b> {item.text}</div>) : <p className="py-10 text-center text-xs text-slate-600">아직 메시지가 없습니다.</p>}</div><form onSubmit={onSubmit} className="mt-3 flex gap-2"><input value={message} onChange={(event) => onMessageChange(event.target.value)} disabled={!user} placeholder={user ? '방송인에게 메시지 보내기' : '로그인 후 채팅할 수 있습니다'} className="live-room-input" /><button type="submit" disabled={!user} aria-label="메시지 보내기" className="live-room-send disabled:cursor-not-allowed disabled:opacity-40"><Send size={14} /></button></form></div>;
}

const fallbackRooms: LiveRoom[] = Array.from({ length: ROOM_COUNT }, (_, index) => ({ id: `live-room-${String(index + 1).padStart(2, '0')}`, roomNumber: index + 1, title: `LIVE ROOM ${String(index + 1).padStart(2, '0')}`, category: index % 3 === 0 ? 'K-POP' : index % 3 === 1 ? '교민 라이브' : '토크', status: 'offline', viewers: 0 }));
const roomNumber = (id: string, fallback: number) => Number(id.match(/(\d+)$/)?.[1] || fallback);

export default function LiveRoomPage() {
  const user = useGlobalStore((state) => state.user) as PortalUser | null;
  const [rooms, setRooms] = useState<LiveRoom[]>(fallbackRooms);
  const [page, setPage] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<LiveRoom | null>(null);
  const [entryRoom, setEntryRoom] = useState<LiveRoom | null>(null);
  const [roomOpen, setRoomOpen] = useState(false);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [message, setMessage] = useState('');
  const [helperAmount, setHelperAmount] = useState('5');
  const [helperText, setHelperText] = useState('방송 세팅과 채팅을 도와주세요.');
  const [helperMessage, setHelperMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRooms = async () => {
    const rows = await listDocuments<Omit<LiveRoom, 'id'>>('liveRooms', getSessionToken()).catch(() => []);
    const now = Date.now();
    setRooms(fallbackRooms.map((room) => {
      const remote = rows.find((row) => row.id === room.id);
      const lastSeen = remote?.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
      return { ...room, ...remote, status: remote?.status === 'live' && now - lastSeen < 15_000 ? 'live' : 'offline' };
    }));
  };

  useEffect(() => { void loadRooms(); const timer = window.setInterval(() => void loadRooms(), 5_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!selectedRoom) return;
    const load = async () => {
      const rows = await queryDocumentsWhere<LiveMessage>('liveRoomMessages', [{ field: 'roomId', op: 'EQUAL', value: selectedRoom.id }], getSessionToken(), 100).catch(() => []);
      setMessages(rows.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    void load();
    const timer = window.setInterval(load, 2_000);
    return () => window.clearInterval(timer);
  }, [selectedRoom?.id]);

  const visibleRooms = useMemo(() => rooms.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE), [page, rooms]);
  const maxPage = Math.ceil(rooms.length / PAGE_SIZE) - 1;
  const enterRoom = (room: LiveRoom, mode: 'watch' | 'broadcast') => {
    if (mode === 'broadcast') {
      const url = `/theater/broadcast?room=${encodeURIComponent(room.id)}`;
      const popup = window.open(url, '_blank', 'noopener,noreferrer');
      if (!popup) window.location.assign(url);
      setEntryRoom(null);
      return;
    }
    setSelectedRoom(room);
    setRoomOpen(true);
    setEntryRoom(null);
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !selectedRoom || !message.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    const text = message.trim();
    await createDocument('liveRoomMessages', crypto.randomUUID(), { roomId: selectedRoom.id, authorId: user.id, user: user.name, text, createdAt: new Date() }, token).catch(() => undefined);
    setMessage('');
  };

  const requestHelper = async () => {
    if (!user || !selectedRoom?.hostId || selectedRoom.hostId === user.id) return setHelperMessage('방송자가 있는 라이브 방에서만 도우미를 요청할 수 있습니다.');
    const amount = Number(helperAmount);
    const token = getSessionToken();
    if (!token || !Number.isFinite(amount) || amount <= 0 || !helperText.trim()) return setHelperMessage('요청 내용과 올바른 USDT 금액을 입력해주세요.');
    setBusy(true);
    try {
      const orderId = await reserveEscrowPurchase(user.id, `live-helper-${selectedRoom.id}`, selectedRoom.hostId, amount, token);
      await createDocument('liveRoomRequests', crypto.randomUUID(), { roomId: selectedRoom.id, requesterId: user.id, helperId: selectedRoom.hostId, amount, requestText: helperText.trim(), orderId, status: 'PAYMENT_HELD', createdAt: new Date() }, token);
      setHelperMessage(`${amount} USDT가 홀딩되었습니다. 방송자가 요청을 수락하면 진행됩니다.`);
    } catch (error) { setHelperMessage(error instanceof Error ? error.message : '도우미 요청을 저장하지 못했습니다.'); } finally { setBusy(false); }
  };

  return <div className="live-room-page min-h-[calc(100vh-7rem)] px-3 py-6 text-white sm:px-5 lg:px-8"><div className="mx-auto max-w-[1500px]">
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-rose-400"><Radio size={15} /> LIVE BROADCAST</div><h1 className="text-3xl font-black tracking-[-0.04em] text-rose-400 sm:text-4xl">LIVE ROOM</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">방송하기와 시청하기를 선택하고, 방 안에서 방송인과 실시간으로 소통하세요.</p></div><div className="flex items-center gap-3 text-xs font-bold text-slate-300"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-400 shadow-[0_0_14px_rgba(251,113,133,.9)]" />30개 방 · 페이지당 10개</div></header>
    <section className="live-room-frame grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><div className="min-w-0"><div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-black"><Sparkles size={16} className="text-rose-300" />방송방 목록</div><div className="flex items-center gap-1"><button type="button" aria-label="이전 방" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="live-room-icon-button"><ChevronLeft size={16} /></button><span className="px-2 text-[11px] font-black text-slate-400">{page + 1} / {maxPage + 1}</span><button type="button" aria-label="다음 방" disabled={page >= maxPage} onClick={() => setPage((value) => Math.min(maxPage, value + 1))} className="live-room-icon-button"><ChevronRight size={16} /></button></div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">{visibleRooms.map((room) => <article key={room.id} className="live-room-card overflow-hidden"><div className={`live-room-preview ${room.status === 'live' ? 'is-live' : ''}`} style={room.thumbnail ? { backgroundImage: `url(${room.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><div className="relative z-10 flex items-center justify-between"><span className={`live-room-status ${room.status === 'live' ? 'live' : ''}`}>{room.status === 'live' ? 'LIVE' : 'OFFLINE'}</span><span className="text-[10px] font-bold text-white/75"><Users size={12} className="mr-1 inline" />{room.viewers || 0}</span></div>{!room.thumbnail && <Camera size={28} className="relative z-10 mx-auto mt-5 text-white/65" />}</div><div className="p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate text-sm font-black">{room.title}</h2><p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">{room.category} · ROOM {String(room.roomNumber).padStart(2, '0')}</p></div><Heart size={15} className="shrink-0 text-slate-500" /></div><button type="button" onClick={() => setEntryRoom(room)} className="mt-3 flex w-full items-center justify-center gap-2 bg-rose-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-rose-300"><Eye size={14} /> {room.status === 'live' ? '입장하기' : '방송방 열기'}</button></div></article>)}</div>
    </div><aside className="live-room-side space-y-3"><div className="live-room-side-panel"><div className="flex items-center gap-2 text-sm font-black"><MessageCircle size={16} className="text-rose-300" />개별 방 채팅</div><p className="mt-3 text-xs leading-5 text-slate-500">방송방에 입장하면 해당 방의 방송인과 시청자만 보는 채팅이 열립니다.</p>{selectedRoom && !roomOpen && <button type="button" onClick={() => setRoomOpen(true)} className="mt-3 w-full bg-rose-400 px-3 py-2 text-xs font-black text-slate-950">{selectedRoom.title} 다시 입장</button>}</div><div className="live-room-side-panel"><div className="flex items-center gap-2 text-sm font-black"><ShieldCheck size={16} className="text-amber-300" />도우미 요청</div><p className="mt-2 text-xs leading-5 text-slate-500">방송 세팅, 번역, 채팅 관리 요청 금액은 먼저 홀딩되고 요청자가 완료를 누른 뒤 정산됩니다.</p><div className="mt-3 grid gap-2">{['방송 세팅 도우미', '번역·채팅 도우미', '화면 모니터링 도우미'].map((label) => <button key={label} type="button" onClick={() => setHelperText(`${label}를 도와주세요.`)} className="live-room-helper-card">{label}<span>방 안에서 요청</span></button>)}</div>{selectedRoom?.status === 'live' && <><input type="number" min="1" step="1" value={helperAmount} onChange={(event) => setHelperAmount(event.target.value)} className="live-room-input mt-3" placeholder="요청 금액 USDT" /><textarea value={helperText} onChange={(event) => setHelperText(event.target.value)} className="live-room-input mt-2 min-h-20" placeholder="요청사항" /><button type="button" disabled={busy} onClick={() => void requestHelper()} className="mt-2 w-full bg-amber-200 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50">{busy ? '홀딩 처리 중...' : '도우미 요청 보내기'}</button>{helperMessage && <p className="mt-2 text-xs leading-5 text-amber-100">{helperMessage}</p>}</>}</div></aside></section>
    {entryRoom && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4" onMouseDown={(event) => event.target === event.currentTarget && setEntryRoom(null)}><section className="live-room-modal w-full max-w-md p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">ROOM {String(roomNumber(entryRoom.id, entryRoom.roomNumber)).padStart(2, '0')}</div><h2 className="mt-1 text-2xl font-black">{entryRoom.title}</h2><p className="mt-2 text-sm text-slate-400">입장 방식을 선택하세요.</p></div><button type="button" onClick={() => setEntryRoom(null)} className="live-room-icon-button"><X size={16} /></button></div><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => enterRoom(entryRoom, 'broadcast')} className="flex items-center justify-center gap-2 bg-rose-400 px-3 py-3 text-sm font-black text-slate-950"><Camera size={16} />방송하기</button><button type="button" onClick={() => enterRoom(entryRoom, 'watch')} className="flex items-center justify-center gap-2 border border-white/10 bg-white/5 px-3 py-3 text-sm font-black text-white"><Eye size={16} />시청하기</button></div><p className="mt-4 text-xs leading-5 text-slate-500">방송하기는 새 탭에서 열립니다. 시청하기는 이 방 전용 영상과 채팅을 엽니다.</p></section></div>}
    {roomOpen && selectedRoom && <div className="fixed inset-0 z-[88] overflow-y-auto bg-black/80 p-3 sm:p-6"><section className="live-room-modal mx-auto w-full max-w-6xl p-4 sm:p-6"><header className="mb-4 flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-300">ROOM {String(roomNumber(selectedRoom.id, selectedRoom.roomNumber)).padStart(2, '0')} · {selectedRoom.status === 'live' ? 'LIVE' : 'OFFLINE'}</div><h2 className="mt-1 text-2xl font-black">{selectedRoom.title}</h2><p className="mt-1 text-xs text-slate-500">{selectedRoom.viewers || 0}명 시청 중 · 이 방의 방송과 채팅</p></div><button type="button" onClick={() => { setRoomOpen(false); setSelectedRoom(null); }} className="live-room-icon-button"><X size={16} /></button></header><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">{selectedRoom.status === 'live' && selectedRoom.hostId ? <LiveRoomPlayer room={selectedRoom} user={user} /> : <div className="live-room-player live-room-player-empty">현재 방송이 시작되지 않았습니다.<br />방송이 시작되면 이 방에서 영상이 표시됩니다.</div>}<RoomChatPanel room={selectedRoom} user={user} messages={messages} message={message} onMessageChange={setMessage} onSubmit={sendMessage} /></div></section></div>}
  </div></div>;
}
