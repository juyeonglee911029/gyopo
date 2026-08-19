'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, PhoneCall, RefreshCcw, ShieldCheck, Users, VideoOff } from 'lucide-react';
import {
  deleteDocument,
  getDocument,
  getSessionToken,
  listDocuments,
  OnlineUser,
  upsertDocument,
} from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type QueueEntry = OnlineUser & {
  status?: 'waiting' | 'matched';
  callId?: string;
};

type CallDocument = {
  callId: string;
  callerId: string;
  calleeId: string;
  status: 'offer' | 'answer' | 'connected' | 'ended';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
};

type CandidateDocument = {
  callId: string;
  fromUserId: string;
  candidate: RTCIceCandidateInit;
};

type ActiveCall = {
  callId: string;
  peer: QueueEntry;
  initiator: boolean;
};

const stunServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function WebRTCPage() {
  const user = useGlobalStore((state) => state.user);
  const [isMatching, setIsMatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [status, setStatus] = useState('대기 중');
  const [peer, setPeer] = useState<QueueEntry | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [flip, setFlip] = useState(true);
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const pollingRef = useRef(false);
  const userRef = useRef(user);
  const appliedCandidates = useRef(new Set<string>());
  const offerApplied = useRef(false);
  const answerApplied = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const requestMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라와 마이크를 지원하지 않습니다.');
    if (!streamRef.current) streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play().catch(() => undefined);
    }
  };

  const startMatch = async () => {
    if (!user) {
      window.alert('로그인이 필요합니다.');
      return;
    }
    const token = getSessionToken();
    if (!token) {
      window.alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
      return;
    }
    setPermissionError('');
    try {
      await requestMedia();
    } catch {
      setPermissionError('카메라와 마이크 권한이 필요합니다. 브라우저 주소창의 권한 설정을 확인해주세요.');
      return;
    }
    appliedCandidates.current.clear();
    offerApplied.current = false;
    answerApplied.current = false;
    callRef.current = null;
    setPeer(null);
    setIsConnected(false);
    setHasRemoteVideo(false);
    setStatus('다른 인증 회원을 찾는 중');
    setIsMatching(true);
    setActive(true);
    const queued = await upsertDocument('webrtcQueue', user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      gender: user.gender || '',
      age: user.age || 0,
      country: user.country || 'Global',
      status: 'waiting',
      lastSeenAt: new Date(),
    }, token).then(() => true).catch(() => false);
    if (!queued) {
      setPermissionError('매칭 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setIsMatching(false);
      setActive(false);
    }
  };

  const endMatch = async () => {
    const token = getSessionToken();
    const currentCall = callRef.current;
    setActive(false);
    setIsMatching(false);
    setIsConnected(false);
    setHasRemoteVideo(false);
    setPeer(null);
    setStatus('대기 중');
    connectionRef.current?.close();
    connectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    callRef.current = null;
    if (token && user) {
      await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
      if (currentCall) await upsertDocument('webrtcCalls', currentCall.callId, { status: 'ended' }, token).catch(() => undefined);
    }
  };

  useEffect(() => () => {
    connectionRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const token = getSessionToken();
    if (token && userRef.current) void deleteDocument('webrtcQueue', userRef.current.id, token);
  }, []);

  useEffect(() => {
    if (!active || !user) return;
    let cancelled = false;
    const token = getSessionToken();
    if (!token) {
      setStatus('로그인 세션이 만료되었습니다');
      return;
    }

    const ensureConnection = (call: ActiveCall) => {
      if (connectionRef.current) return connectionRef.current;
      const connection = new RTCPeerConnection({ iceServers: stunServers });
      connectionRef.current = connection;
      streamRef.current?.getTracks().forEach((track) => connection.addTrack(track, streamRef.current as MediaStream));
      connection.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        void upsertDocument('webrtcCandidates', `${call.callId}-${user.id}-${crypto.randomUUID()}`, {
          callId: call.callId,
          fromUserId: user.id,
          candidate: candidate.toJSON(),
        }, token);
      };
      connection.ontrack = (event) => {
        const remoteStream = event.streams[0] || remoteStreamRef.current || new MediaStream();
        if (!event.streams[0]) remoteStream.addTrack(event.track);
        remoteStreamRef.current = remoteStream;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          void remoteVideoRef.current.play().catch(() => undefined);
        }
        setHasRemoteVideo(true);
        setStatus('상대 영상 수신 중');
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'connecting') setStatus('보안 연결을 설정하는 중');
        if (connection.connectionState === 'connected') {
          setIsConnected(true);
          setIsMatching(false);
          setStatus('연결 성공');
          void upsertDocument('webrtcCalls', call.callId, { status: 'connected' }, token);
        }
        if (connection.connectionState === 'disconnected') setStatus('연결이 불안정합니다');
        if (connection.connectionState === 'failed') setStatus('연결 실패, 다시 시도해주세요');
        if (connection.connectionState === 'closed') setStatus('연결 종료');
      };
      connection.oniceconnectionstatechange = () => {
        if (connection.iceConnectionState === 'checking') setStatus('네트워크 경로를 확인하는 중');
        if (connection.iceConnectionState === 'connected' || connection.iceConnectionState === 'completed') {
          setStatus('상대 영상 연결 중');
        }
        if (connection.iceConnectionState === 'failed') setStatus('네트워크 연결 실패');
      };
      return connection;
    };

    const poll = async () => {
      if (cancelled || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const current = callRef.current;
        if (!current) {
          const queue = await listDocuments<QueueEntry>('webrtcQueue', token).catch(() => []);
          const threshold = Date.now() - 45_000;
          const pendingInvite = queue
            .filter((entry) => entry.userId !== user.id && entry.status === 'matched' && entry.callId?.startsWith(`webrtc-${entry.userId}-${user.id}-`) && new Date(entry.lastSeenAt).getTime() > threshold)
            .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())[0];
          const available = queue
            .filter((entry) => entry.userId !== user.id && entry.status === 'waiting' && new Date(entry.lastSeenAt).getTime() > threshold)
            .sort((a, b) => new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime());
          if (pendingInvite) {
            const nextCall: ActiveCall = { callId: pendingInvite.callId as string, peer: pendingInvite, initiator: false };
            callRef.current = nextCall;
            setPeer(pendingInvite);
            setIsMatching(false);
            setStatus('상대 연결 요청을 받았습니다');
            ensureConnection(nextCall);
            return;
          }
          const candidate = available.find((entry) => user.id < entry.userId);
          if (!candidate) {
            await upsertDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'waiting' }, token);
            setStatus('다른 인증 회원을 찾는 중');
            return;
          }
          const callId = `webrtc-${user.id}-${candidate.userId}-${crypto.randomUUID()}`;
          const nextCall: ActiveCall = { callId, peer: candidate, initiator: user.id < candidate.userId };
          callRef.current = nextCall;
          setPeer(candidate);
          setIsMatching(false);
          setStatus('상대에게 연결을 요청하는 중');
          await Promise.all([
            upsertDocument('webrtcQueue', user.id, { status: 'matched', callId, lastSeenAt: new Date() }, token),
            upsertDocument('webrtcQueue', candidate.userId, { status: 'matched', callId, lastSeenAt: new Date() }, token),
          ]).catch(() => undefined);
          const connection = ensureConnection(nextCall);
          const offer = await connection.createOffer();
          await connection.setLocalDescription(offer);
          await upsertDocument('webrtcCalls', callId, {
            callId,
            callerId: user.id,
            calleeId: candidate.userId,
            status: 'offer',
            offer,
          }, token);
          setStatus('상대 응답을 기다리는 중');
          return;
        }

        await upsertDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'matched', callId: current.callId }, token);
        const connection = ensureConnection(current);
        const call = await getDocument<CallDocument>('webrtcCalls', current.callId, token).catch(() => null);
        if (!call) {
          setStatus(current.initiator ? '상대 응답을 기다리는 중' : '연결 정보를 기다리는 중');
          return;
        }
        if (call.status === 'ended') {
          connection.close();
          connectionRef.current = null;
          callRef.current = null;
          setIsConnected(false);
          setHasRemoteVideo(false);
          setStatus('상대가 연결을 종료했습니다');
          await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
          return;
        }
        if (!current.initiator && call.offer && !offerApplied.current) {
          await connection.setRemoteDescription(call.offer);
          offerApplied.current = true;
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          await upsertDocument('webrtcCalls', current.callId, { answer, status: 'answer' }, token);
        }
        if (current.initiator && call.answer && !answerApplied.current) {
          await connection.setRemoteDescription(call.answer);
          answerApplied.current = true;
        }
        const candidates = await listDocuments<CandidateDocument>('webrtcCandidates', token).catch(() => []);
        if (!connection.remoteDescription) return;
        for (const item of candidates.filter((candidate) => candidate.callId === current.callId && candidate.fromUserId !== user.id)) {
          if (appliedCandidates.current.has(item.id)) continue;
          const added = await connection.addIceCandidate(item.candidate).then(() => true).catch(() => false);
          if (added) appliedCandidates.current.add(item.id);
        }
      } finally {
        pollingRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 1800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, user]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#080d1c] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Private room / WebRTC</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">REAL VIDEO CONNECT</h1><p className="mt-2 text-sm text-slate-400">가짜 상대 없이, 실제 접속 중인 인증 회원과 직접 연결됩니다.</p></div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200"><ShieldCheck size={17} /> 브라우저 간 암호화 연결</div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="relative aspect-video overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
            <video ref={remoteVideoRef} autoPlay playsInline className={`h-full w-full object-cover transition-opacity ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`} />
            {!hasRemoteVideo && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,#172b50,#050914_70%)] text-center"><div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 p-5">{isMatching || active ? <LoaderCircle size={42} className="animate-spin text-cyan-300" /> : <Camera size={42} className="text-slate-500" />}</div><div><p className="text-xl font-black">{active ? status : '연결 대기 중'}</p><p className="mt-2 text-sm text-slate-400">{active ? '상대방의 카메라 연결을 기다리고 있습니다.' : '시작 버튼을 누르면 카메라와 마이크를 준비합니다.'}</p></div></div>}
            {(isConnected || hasRemoteVideo) && <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-2 text-xs font-bold backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {status}</div>}
            {peer && <div className="absolute bottom-4 left-4 rounded-2xl bg-black/60 px-4 py-3 backdrop-blur"><div className="flex items-center gap-3"><img src={peer.image} alt="" className="h-10 w-10 rounded-full object-cover" /><div><div className="font-black">{peer.name}</div><div className="text-xs text-slate-300">{peer.gender || '성별 미설정'} · {peer.age || '나이 미설정'} · {peer.country || '국가 미설정'}</div></div></div></div>}
            <div className="absolute bottom-4 right-4 w-1/4 min-w-[100px] overflow-hidden rounded-2xl border-2 border-white/60 bg-black shadow-2xl"><video ref={videoRef} muted autoPlay playsInline className={`aspect-video h-full w-full object-cover ${flip ? 'scale-x-[-1]' : ''}`} /></div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Connection status</span><span className="text-xs font-bold text-cyan-300">{status}</span></div>{peer ? <div className="mb-5 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3"><img src={peer.image} alt="" className="h-12 w-12 rounded-full object-cover" /><div><div className="font-black">{peer.name}</div><div className="mt-1 text-xs text-slate-400">{peer.gender || '성별 미설정'} · {peer.age || '나이 미설정'} · {peer.country || '국가 미설정'}</div></div></div> : <div className="mb-5 rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500"><Users className="mx-auto mb-2" size={22} />현재 연결된 상대가 없습니다.</div>}{permissionError && <p className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-200">{permissionError}</p>}{!active ? <button onClick={startMatch} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-4 font-black text-slate-950 transition hover:bg-cyan-300"><PhoneCall size={19} /> 실제 회원 찾기</button> : <button onClick={() => void endMatch()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-4 font-black text-white transition hover:bg-red-400"><VideoOff size={19} /> 연결 종료</button>}</section>
            <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="font-black">카메라 설정</span><span className="text-xs text-slate-500">브라우저 기본 기능</span></div><label className="flex cursor-pointer items-center justify-between rounded-xl bg-white/[0.04] p-3 text-sm font-bold"><span>내 화면 좌우 반전</span><input type="checkbox" checked={flip} onChange={(event) => setFlip(event.target.checked)} className="h-4 w-4 accent-cyan-400" /></label><div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" />영상은 서버에 저장하지 않고 상대 브라우저로 직접 전송됩니다.</div></section>
            <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5 text-sm text-slate-400"><div className="mb-2 flex items-center gap-2 font-black text-white"><RefreshCcw size={16} className="text-cyan-300" /> 연결 안내</div><p>두 명 이상의 인증 회원이 동시에 대기해야 연결됩니다. 아무도 없으면 실제로 연결될 때까지 대기 상태가 유지됩니다.</p></section>
          </aside>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, PhoneCall, RefreshCcw, ShieldCheck, Users, VideoOff } from 'lucide-react';
import {
  deleteDocument,
  getDocument,
  getSessionToken,
  listDocuments,
  OnlineUser,
  upsertDocument,
} from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type QueueEntry = OnlineUser & {
  status?: 'waiting' | 'matched';
  callId?: string;
};

type CallDocument = {
  callId: string;
  callerId: string;
  calleeId: string;
  status: 'offer' | 'answer' | 'connected' | 'ended';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
};

type CandidateDocument = {
  callId: string;
  fromUserId: string;
  candidate: RTCIceCandidateInit;
};

type ActiveCall = {
  callId: string;
  peer: QueueEntry;
  initiator: boolean;
};

const stunServers = [{ urls: 'stun:stun.l.google.com:19302' }];

export default function WebRTCPage() {
  const user = useGlobalStore((state) => state.user);
  const [isMatching, setIsMatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [status, setStatus] = useState('대기 중');
  const [peer, setPeer] = useState<QueueEntry | null>(null);
  const [flip, setFlip] = useState(true);
  const [active, setActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const pollingRef = useRef(false);
  const userRef = useRef(user);
  const appliedCandidates = useRef(new Set<string>());
  const offerApplied = useRef(false);
  const answerApplied = useRef(false);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const requestMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라와 마이크를 지원하지 않습니다.');
    if (!streamRef.current) streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play().catch(() => undefined);
    }
  };

  const startMatch = async () => {
    if (!user) {
      window.alert('로그인이 필요합니다.');
      return;
    }
    const token = getSessionToken();
    if (!token) {
      window.alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
      return;
    }
    setPermissionError('');
    try {
      await requestMedia();
    } catch {
      setPermissionError('카메라와 마이크 권한이 필요합니다. 브라우저 주소창의 권한 설정을 확인해주세요.');
      return;
    }
    appliedCandidates.current.clear();
    offerApplied.current = false;
    answerApplied.current = false;
    callRef.current = null;
    setPeer(null);
    setIsConnected(false);
    setStatus('다른 인증 회원을 찾는 중');
    setIsMatching(true);
    setActive(true);
    await upsertDocument('webrtcQueue', user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      gender: user.gender || '',
      age: user.age || 0,
      country: user.country || 'Global',
      status: 'waiting',
      lastSeenAt: new Date(),
    }, token).catch(() => setPermissionError('매칭 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.'));
  };

  const endMatch = async () => {
    const token = getSessionToken();
    const currentCall = callRef.current;
    setActive(false);
    setIsMatching(false);
    setIsConnected(false);
    setPeer(null);
    setStatus('대기 중');
    connectionRef.current?.close();
    connectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    callRef.current = null;
    if (token && user) {
      await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
      if (currentCall) await upsertDocument('webrtcCalls', currentCall.callId, { status: 'ended' }, token).catch(() => undefined);
    }
  };

  useEffect(() => () => {
    connectionRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const token = getSessionToken();
    if (token && userRef.current) void deleteDocument('webrtcQueue', userRef.current.id, token);
  }, []);

  useEffect(() => {
    if (!active || !user) return;
    let cancelled = false;
    const token = getSessionToken();
    if (!token) return;

    const ensureConnection = (call: ActiveCall) => {
      if (connectionRef.current) return connectionRef.current;
      const connection = new RTCPeerConnection({ iceServers: stunServers });
      connectionRef.current = connection;
      streamRef.current?.getTracks().forEach((track) => connection.addTrack(track, streamRef.current as MediaStream));
      connection.onicecandidate = ({ candidate }) => {
        if (!candidate) return;
        void upsertDocument('webrtcCandidates', `${call.callId}-${user.id}-${crypto.randomUUID()}`, {
          callId: call.callId,
          fromUserId: user.id,
          candidate: candidate.toJSON(),
        }, token);
      };
      connection.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (remoteVideoRef.current && remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
          void remoteVideoRef.current.play().catch(() => undefined);
        }
        setIsConnected(true);
        setIsMatching(false);
        setStatus('연결 성공');
        void upsertDocument('webrtcCalls', call.callId, { status: 'connected' }, token);
      };
      connection.onconnectionstatechange = () => {
        if (connection.connectionState === 'connecting') setStatus('보안 연결을 설정하는 중');
        if (connection.connectionState === 'connected') {
          setIsConnected(true);
          setIsMatching(false);
          setStatus('연결 성공');
        }
        if (['failed', 'disconnected'].includes(connection.connectionState)) setStatus('연결이 불안정합니다');
      };
      return connection;
    };

    const poll = async () => {
      if (cancelled || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const current = callRef.current;
        if (!current) {
          const queue = await listDocuments<QueueEntry>('webrtcQueue', token).catch(() => []);
          const threshold = Date.now() - 45_000;
          const available = queue
            .filter((entry) => entry.userId !== user.id && entry.status === 'waiting' && new Date(entry.lastSeenAt).getTime() > threshold)
            .sort((a, b) => new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime());
          const candidate = available[0];
          if (!candidate) {
            await upsertDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'waiting' }, token);
            return;
          }
          const callId = [user.id, candidate.userId].sort().join('--');
          const nextCall: ActiveCall = { callId, peer: candidate, initiator: user.id < candidate.userId };
          callRef.current = nextCall;
          setPeer(candidate);
          setIsMatching(false);
          setStatus('상대를 확인하는 중');
          await Promise.all([
            upsertDocument('webrtcQueue', user.id, { status: 'matched', callId, lastSeenAt: new Date() }, token),
            upsertDocument('webrtcQueue', candidate.userId, { status: 'matched', callId, lastSeenAt: new Date() }, token),
          ]).catch(() => undefined);
          const connection = ensureConnection(nextCall);
          if (nextCall.initiator) {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await upsertDocument('webrtcCalls', callId, {
              callId,
              callerId: user.id,
              calleeId: candidate.userId,
              status: 'offer',
              offer,
            }, token);
          }
          return;
        }

        await upsertDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'matched', callId: current.callId }, token);
        const connection = ensureConnection(current);
        const call = await getDocument<CallDocument>('webrtcCalls', current.callId, token).catch(() => null);
        if (!call || call.status === 'ended') return;
        if (!current.initiator && call.offer && !offerApplied.current) {
          await connection.setRemoteDescription(call.offer);
          offerApplied.current = true;
          const answer = await connection.createAnswer();
          await connection.setLocalDescription(answer);
          await upsertDocument('webrtcCalls', current.callId, { answer, status: 'answer' }, token);
        }
        if (current.initiator && call.answer && !answerApplied.current) {
          await connection.setRemoteDescription(call.answer);
          answerApplied.current = true;
        }
        const candidates = await listDocuments<CandidateDocument>('webrtcCandidates', token).catch(() => []);
        for (const item of candidates.filter((candidate) => candidate.callId === current.callId && candidate.fromUserId !== user.id)) {
          if (appliedCandidates.current.has(item.id)) continue;
          await connection.addIceCandidate(item.candidate).catch(() => undefined);
          appliedCandidates.current.add(item.id);
        }
      } finally {
        pollingRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 1800);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, user]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#080d1c] px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Private room / WebRTC</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">REAL VIDEO CONNECT</h1><p className="mt-2 text-sm text-slate-400">가짜 상대 없이, 실제 접속 중인 인증 회원과 직접 연결됩니다.</p></div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200"><ShieldCheck size={17} /> 브라우저 간 암호화 연결</div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="relative aspect-video overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
            {isConnected ? <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,#172b50,#050914_70%)] text-center"><div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 p-5">{isMatching ? <LoaderCircle size={42} className="animate-spin text-cyan-300" /> : <Camera size={42} className="text-slate-500" />}</div><div><p className="text-xl font-black">{isMatching ? '상대를 찾는 중입니다' : status}</p><p className="mt-2 text-sm text-slate-400">{isMatching ? '페이지를 닫지 말고 잠시 기다려주세요.' : '시작 버튼을 누르면 카메라와 마이크를 준비합니다.'}</p></div></div>}
            {isConnected && <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-2 text-xs font-bold backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {status}</div>}
            {isConnected && peer && <div className="absolute bottom-4 left-4 rounded-2xl bg-black/60 px-4 py-3 backdrop-blur"><div className="flex items-center gap-3"><img src={peer.image} alt="" className="h-10 w-10 rounded-full object-cover" /><div><div className="font-black">{peer.name}</div><div className="text-xs text-slate-300">{peer.gender || '성별 미설정'} · {peer.age || '나이 미설정'} · {peer.country || '국가 미설정'}</div></div></div></div>}
            <div className="absolute bottom-4 right-4 w-1/4 min-w-[100px] overflow-hidden rounded-2xl border-2 border-white/60 bg-black shadow-2xl"><video ref={videoRef} muted autoPlay playsInline className={`aspect-video h-full w-full object-cover ${flip ? 'scale-x-[-1]' : ''}`} /></div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Connection status</span><span className="text-xs font-bold text-cyan-300">{status}</span></div>{peer ? <div className="mb-5 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3"><img src={peer.image} alt="" className="h-12 w-12 rounded-full object-cover" /><div><div className="font-black">{peer.name}</div><div className="mt-1 text-xs text-slate-400">{peer.gender || '성별 미설정'} · {peer.age || '나이 미설정'} · {peer.country || '국가 미설정'}</div></div></div> : <div className="mb-5 rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500"><Users className="mx-auto mb-2" size={22} />현재 연결된 상대가 없습니다.</div>}{permissionError && <p className="mb-4 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-200">{permissionError}</p>}{!active ? <button onClick={startMatch} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-4 font-black text-slate-950 transition hover:bg-cyan-300"><PhoneCall size={19} /> 실제 회원 찾기</button> : <button onClick={() => void endMatch()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-4 font-black text-white transition hover:bg-red-400"><VideoOff size={19} /> 연결 종료</button>}</section>
            <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="font-black">카메라 설정</span><span className="text-xs text-slate-500">브라우저 기본 기능</span></div><label className="flex cursor-pointer items-center justify-between rounded-xl bg-white/[0.04] p-3 text-sm font-bold"><span>내 화면 좌우 반전</span><input type="checkbox" checked={flip} onChange={(event) => setFlip(event.target.checked)} className="h-4 w-4 accent-cyan-400" /></label><div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" />영상은 서버에 저장하지 않고 상대 브라우저로 직접 전송됩니다.</div></section>
            <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5 text-sm text-slate-400"><div className="mb-2 flex items-center gap-2 font-black text-white"><RefreshCcw size={16} className="text-cyan-300" /> 연결 안내</div><p>두 명 이상의 인증 회원이 동시에 대기해야 연결됩니다. 아무도 없으면 실제로 연결될 때까지 대기 상태가 유지됩니다.</p></section>
          </aside>
        </div>
      </div>
    </div>
  );
}
