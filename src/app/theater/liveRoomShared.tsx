'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { getDocument, getSessionToken, mergeDocument, type PortalUser } from '@/lib/firebase';

export type LiveRoom = { id: string; roomNumber: number; title?: string; category?: string; hostId?: string | null; hostName?: string | null; hostImage?: string | null; status?: 'offline' | 'live'; viewers?: number; thumbnail?: string | null; sessionId?: string | null; updatedAt?: string };
export type LiveMessage = { id: string; roomId: string; sessionId?: string; authorId: string; user: string; text: string; createdAt: string };
type ViewerSignal = { id: string; roomId: string; sessionId?: string; viewerId: string; hostId: string; status: 'offer' | 'answer' | 'connected' | 'ended'; offer?: string; answer?: string; updatedAt?: string };

const iceServers = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject' },
];

const waitForIce = (peer: RTCPeerConnection) => new Promise<void>((resolve) => {
  if (peer.iceGatheringState === 'complete') return resolve();
  const finish = () => { if (peer.iceGatheringState === 'complete') { peer.removeEventListener('icegatheringstatechange', finish); resolve(); } };
  peer.addEventListener('icegatheringstatechange', finish);
  window.setTimeout(() => { peer.removeEventListener('icegatheringstatechange', finish); resolve(); }, 4_000);
});

export function LiveRoomPlayer({ room, user, compact = false }: { room: LiveRoom; user: PortalUser | null; compact?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewerIdRef = useRef(`viewer-${user?.id || 'guest'}-${room.id}-${Math.random().toString(36).slice(2)}`);
  const [status, setStatus] = useState('시청 연결 준비 중');
  const [needsPlay, setNeedsPlay] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!user || room.status !== 'live' || !room.hostId) return;
    const token = getSessionToken();
    if (!token) return;
    let active = true;
    viewerIdRef.current = `viewer-${user.id}-${room.id}-${Math.random().toString(36).slice(2)}`;
    const peer = new RTCPeerConnection({ iceServers });
    peer.addTransceiver('video', { direction: 'recvonly' });
    peer.addTransceiver('audio', { direction: 'recvonly' });
    peer.ontrack = (event) => {
      const video = videoRef.current;
      if (!video) return;
      const remoteStream = event.streams[0] || (video.srcObject instanceof MediaStream ? video.srcObject : new MediaStream());
      if (!event.streams[0] && !remoteStream.getTracks().some((track) => track.id === event.track.id)) remoteStream.addTrack(event.track);
      video.srcObject = remoteStream;
      void (async () => {
        try {
          video.muted = true;
          await video.play();
          setNeedsPlay(false);
          setStatus('LIVE 수신 중 · 화면을 누르면 소리 켜기');
        } catch {
          video.muted = true;
          try {
            await video.play();
            setNeedsPlay(false);
            setStatus('LIVE 수신 중 · 음소거 자동재생');
          } catch {
            setNeedsPlay(true);
          }
        }
      })();
    };
    peer.onconnectionstatechange = () => {
      if (!active) return;
      if (peer.connectionState === 'connected') setStatus('방송 연결 완료');
      if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') setStatus('재연결 중');
    };
    const touchPresence = (nextStatus: ViewerSignal['status']) => mergeDocument('liveRoomViewers', viewerIdRef.current, { roomId: room.id, sessionId: room.sessionId, viewerId: user.id, hostId: room.hostId, status: nextStatus, updatedAt: new Date() }, token).catch(() => undefined);
    const signal = async () => {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIce(peer);
      const created = await mergeDocument('liveRoomViewers', viewerIdRef.current, { roomId: room.id, sessionId: room.sessionId, viewerId: user.id, hostId: room.hostId, status: 'offer', offer: JSON.stringify(peer.localDescription), updatedAt: new Date() }, token).then(() => true).catch(() => false);
      if (!created) { setStatus('라이브 권한을 확인하는 중'); return; }
      for (let attempt = 0; active && attempt < 40; attempt += 1) {
        const current = await getDocument<ViewerSignal>('liveRoomViewers', viewerIdRef.current, token).catch(() => null);
        if (current?.answer && !peer.currentRemoteDescription) {
          await peer.setRemoteDescription(JSON.parse(current.answer) as RTCSessionDescriptionInit);
          await touchPresence('connected');
          setStatus('방송 연결 완료');
          break;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 1_000));
      }
    };
    void signal();
    const presenceTimer = window.setInterval(() => { if (active) void touchPresence(peer.connectionState === 'connected' ? 'connected' : 'offer'); }, 5_000);
    return () => {
      active = false;
      window.clearInterval(presenceTimer);
      peer.close();
      void mergeDocument('liveRoomViewers', viewerIdRef.current, { sessionId: room.sessionId, status: 'ended', updatedAt: new Date() }, token).catch(() => undefined);
    };
  }, [room.id, room.hostId, room.sessionId, room.status, user?.id]);

  if (!user) return <div className={`live-room-player live-room-player-empty ${compact ? 'live-room-player-compact' : ''}`}>로그인 후 방송을 시청할 수 있습니다.</div>;
  if (room.status !== 'live' || !room.hostId) return <div className={`live-room-player live-room-player-empty ${compact ? 'live-room-player-compact' : ''}`}>방송 상태를 확인하는 중입니다.<br />방송이 시작되면 자동으로 연결됩니다.</div>;
  return <div className={`live-room-player ${compact ? 'live-room-player-compact' : ''}`}><video ref={videoRef} autoPlay playsInline muted={compact || muted} controls={!compact} onClick={() => { const video = videoRef.current; if (!video || compact) return; const nextMuted = !video.muted; video.muted = nextMuted; setMuted(nextMuted); void video.play().catch(() => undefined); }} className="h-full w-full object-cover" />{needsPlay && <button type="button" onClick={() => { const video = videoRef.current; if (!video) return; video.muted = true; setMuted(true); void video.play().then(() => setNeedsPlay(false)); }} className="live-room-play-button">영상 재생</button>}<div className="live-room-player-status"><span />{room.viewers || 0}명 온라인 · {status}</div></div>;
}

export function RoomChatPanel({ room, user, messages, message, onMessageChange, onSubmit }: { room: LiveRoom; user: PortalUser | null; messages: LiveMessage[]; message: string; onMessageChange: (value: string) => void; onSubmit: (event: FormEvent) => void }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);
  return <div className="live-room-chat-panel"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-black"><MessageCircle size={16} className="text-rose-300" />{room.title} 채팅</div><span className="text-[10px] font-bold text-slate-500">{room.viewers || 0}명 온라인</span></div><div className="mt-3 h-52 space-y-2 overflow-y-auto rounded-sm bg-black/10 p-2">{messages.length ? messages.map((item) => <div key={item.id} className={`text-xs ${item.authorId === user?.id ? 'live-chat-own' : 'live-chat-other'}`}><b>{item.user}</b> {item.text}</div>) : <p className="py-10 text-center text-xs text-slate-600">아직 메시지가 없습니다.</p>}<div ref={endRef} /></div><form onSubmit={onSubmit} className="mt-3 flex gap-2"><input value={message} onChange={(event) => onMessageChange(event.target.value)} disabled={!user} placeholder={user ? '방송인에게 메시지 보내기' : '로그인 후 채팅할 수 있습니다'} className="live-room-input" /><button type="submit" disabled={!user} aria-label="메시지 보내기" className="live-room-send disabled:cursor-not-allowed disabled:opacity-40"><Send size={14} /></button></form></div>;
}
