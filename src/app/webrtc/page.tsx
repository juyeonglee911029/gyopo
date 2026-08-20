'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, PhoneCall, RefreshCcw, ShieldCheck, Users, VideoOff } from 'lucide-react';
import {
  deleteDocument,
  claimWebrtcMatch,
  createDocument,
  deleteExpiredChatMessages,
  getDocument,
  getSessionToken,
  mergeDocument,
  OnlineUser,
  queryDocumentsWhere,
  upsertDocument,
  type TetrisQueueProfile,
} from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type QueueEntry = OnlineUser & {
  status?: 'waiting' | 'matched';
  callId?: string;
  opponent?: TetrisQueueProfile;
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
type VideoChatMessage = { id: string; callId: string; authorId: string; user: string; text: string; createdAt: string; expiresAt: string };

type ActiveCall = {
  callId: string;
  peer: QueueEntry;
  initiator: boolean;
};

const stunServers = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

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
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<VideoChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const pollingRef = useRef(false);
  const connectionStartedAt = useRef<number | null>(null);
  const connectedRef = useRef(false);
  const userRef = useRef(user);
  const appliedCandidates = useRef(new Set<string>());
  const offerApplied = useRef(false);
  const answerApplied = useRef(false);

  const resetSignalingState = () => {
    appliedCandidates.current.clear();
    offerApplied.current = false;
    answerApplied.current = false;
  };

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const requestMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라와 마이크를 지원하지 않습니다.');
    if (!streamRef.current) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw error;
        }
      }
    }
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
    } catch (error) {
      const name = error instanceof DOMException ? error.name : error instanceof Error ? error.message : '알 수 없는 오류';
      if (name === 'NotFoundError') {
        setPermissionError('이 기기에서 카메라 또는 마이크를 찾을 수 없습니다. 장치 연결 상태를 확인해주세요.');
      } else if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPermissionError('카메라와 마이크 권한이 필요합니다. 브라우저 주소창의 권한 설정을 확인해주세요.');
      } else {
        setPermissionError(`카메라와 마이크를 준비하지 못했습니다: ${name}`);
      }
      return;
    }
    resetSignalingState();
    callRef.current = null;
    setPeer(null);
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle, PhoneCall, RefreshCcw, ShieldCheck, Users, VideoOff } from 'lucide-react';
import {
  deleteDocument,
  claimWebrtcMatch,
  createDocument,
  deleteExpiredChatMessages,
  getDocument,
  getSessionToken,
  mergeDocument,
  OnlineUser,
  queryDocumentsWhere,
  refreshStoredUser,
  reserveGenderMatchStake,
  saveProfile,
  upsertDocument,
  type Gender,
  type GenderPreference,
  type TetrisQueueProfile,
} from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type QueueEntry = OnlineUser & {
  status?: 'waiting' | 'matched';
  callId?: string;
  opponent?: TetrisQueueProfile;
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
type VideoChatMessage = { id: string; callId: string; authorId: string; user: string; text: string; createdAt: string; expiresAt: string };

type ActiveCall = {
  callId: string;
  peer: QueueEntry;
  initiator: boolean;
};

const stunServers = [
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export default function WebRTCPage() {
  const user = useGlobalStore((state) => state.user);
  const setUser = useGlobalStore((state) => state.setUser);
  const [isMatching, setIsMatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [status, setStatus] = useState('대기 중');
  const [peer, setPeer] = useState<QueueEntry | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [flip, setFlip] = useState(true);
  const [active, setActive] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<VideoChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [gender, setGender] = useState<Gender | ''>(user?.gender === 'male' || user?.gender === 'female' ? user.gender : '');
  const [genderPreference, setGenderPreference] = useState<GenderPreference>(user?.genderPreference || 'any');
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const pollingRef = useRef(false);
  const connectionStartedAt = useRef<number | null>(null);
  const connectedRef = useRef(false);
  const userRef = useRef(user);
  const appliedCandidates = useRef(new Set<string>());
  const offerApplied = useRef(false);
  const answerApplied = useRef(false);
  const chargedMatchIds = useRef(new Set<string>());

  const resetSignalingState = () => {
    appliedCandidates.current.clear();
    offerApplied.current = false;
    answerApplied.current = false;
  };

  useEffect(() => {
    userRef.current = user;
    if (!user) return;
    if (!active) {
      setGender(user.gender === 'male' || user.gender === 'female' ? user.gender : '');
      setGenderPreference(user.genderPreference || 'any');
    }
  }, [user, active]);

  const requestMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라와 마이크를 지원하지 않습니다.');
    if (!streamRef.current) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw error;
        }
      }
    }
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
    if (genderPreference !== 'any' && !gender) {
      setPermissionError('성별 선호 매칭을 사용하려면 먼저 내 성별을 설정해주세요.');
      return;
    }
    setPermissionError('');
    const profile = { ...user, ...(gender ? { gender } : {}), genderPreference };
    try {
      await saveProfile(profile, token);
      setUser(profile);
    } catch {
      setPermissionError('프로필 설정을 저장하지 못했습니다. 다시 시도해주세요.');
      return;
    }
    try {
      await requestMedia();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : error instanceof Error ? error.message : '알 수 없는 오류';
      if (name === 'NotFoundError') {
        setPermissionError('이 기기에서 카메라 또는 마이크를 찾을 수 없습니다. 장치 연결 상태를 확인해주세요.');
      } else if (name === 'NotAllowedError' || name === 'SecurityError') {
        setPermissionError('카메라와 마이크 권한이 필요합니다. 브라우저 주소창의 권한 설정을 확인해주세요.');
      } else {
        setPermissionError(`카메라와 마이크를 준비하지 못했습니다: ${name}`);
      }
      return;
    }
    resetSignalingState();
    callRef.current = null;
    setPeer(null);
    setIsConnected(false);
    setHasRemoteVideo(false);
    setStatus('다른 인증 회원을 찾는 중');
    setIsMatching(true);
    setActive(true);
    const queued = await mergeDocument('webrtcQueue', user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      gender: user.gender || '',
      age: user.age || 0,
      country: user.country || 'Global',
      gender: gender || '',
      genderPreference,
      isSubscribed: Boolean(user.isSubscribed),
      status: 'waiting',
      lastSeenAt: new Date(),
    }, token).then(() => true).catch((error) => {
      const detail = error instanceof Error ? error.message.slice(0, 180) : '알 수 없는 오류';
      setPermissionError(`매칭 서버 오류: ${detail}`);
      return false;
    });
    if (!queued) {
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
    setActiveCallId(null);
    setChatMessages([]);
    setStatus('대기 중');
    connectionRef.current?.close();
    connectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    callRef.current = null;
    resetSignalingState();
    connectionStartedAt.current = null;
    connectedRef.current = false;
    if (token && user) {
      await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
      if (currentCall) await mergeDocument('webrtcCalls', currentCall.callId, { status: 'ended' }, token).catch(() => undefined);
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
      const connection = new RTCPeerConnection({ iceServers: stunServers, iceCandidatePoolSize: 10 });
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
          connectedRef.current = true;
          setIsMatching(false);
          connectionStartedAt.current = null;
          setStatus('연결 성공');
          void mergeDocument('webrtcCalls', call.callId, { status: 'connected' }, token);
        }
        if (connection.connectionState === 'disconnected') {
          connectedRef.current = false;
          setStatus('연결이 불안정합니다');
        }
        if (connection.connectionState === 'failed') {
          connectedRef.current = false;
          connectionStartedAt.current = Date.now() - 20_001;
          setIsMatching(true);
          setStatus('연결 실패, 다른 상대를 다시 찾는 중');
        }
        if (connection.connectionState === 'closed') setStatus('연결 종료');
      };
      connection.oniceconnectionstatechange = () => {
        if (connection.iceConnectionState === 'checking') setStatus('네트워크 경로를 확인하는 중');
        if (connection.iceConnectionState === 'connected' || connection.iceConnectionState === 'completed') {
          setStatus('상대 영상 연결 중');
        }
        if (connection.iceConnectionState === 'failed') {
          connectionStartedAt.current = Date.now() - 20_001;
          setIsMatching(true);
          setStatus('네트워크 연결 실패, 다른 상대를 다시 찾는 중');
        }
      };
      return connection;
    };

    const poll = async () => {
      if (cancelled || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const current = callRef.current;
        if (!current) {
          const ownQueue = await getDocument<QueueEntry>('webrtcQueue', user.id, token).catch(() => null);
          const makePeer = (profile: TetrisQueueProfile): QueueEntry => ({
            id: profile.id,
            userId: profile.id,
            name: profile.name,
            email: '',
            image: profile.image,
            country: profile.country,
            gender: profile.gender,
            genderPreference: profile.genderPreference,
            isSubscribed: profile.isSubscribed,
            lastSeenAt: new Date().toISOString(),
          });
          let nextCall: ActiveCall | null = null;
          if (ownQueue?.status === 'matched' && ownQueue.callId && ownQueue.opponent) {
            const matchedPeer = makePeer(ownQueue.opponent);
            nextCall = { callId: ownQueue.callId, peer: matchedPeer, initiator: user.id < matchedPeer.userId };
          } else {
            await mergeDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'waiting' }, token);
            const claimed = await claimWebrtcMatch({ id: user.id, name: user.name, image: user.image, country: user.country || 'Global', gender: gender || '', genderPreference, isSubscribed: Boolean(user.isSubscribed) }, token).catch(() => null);
            if (claimed) nextCall = { callId: claimed.callId, peer: makePeer(claimed.opponent), initiator: claimed.initiator };
          }
          if (!nextCall) {
            setStatus('다른 인증 회원을 찾는 중');
            return;
          }
                      const currentUser = userRef.current;
           const premiumActive = Boolean(currentUser?.isSubscribed && (!currentUser.premiumExpiresAt || new Date(currentUser.premiumExpiresAt).getTime() > Date.now()));
           if (currentUser && (currentUser.genderPreference || 'any') !== 'any' && !premiumActive && !chargedMatchIds.current.has(nextCall.callId)) {
             try {
               await reserveGenderMatchStake(currentUser.id, nextCall.callId, 1, token);
               chargedMatchIds.current.add(nextCall.callId);
               const refreshed = await refreshStoredUser().catch(() => null);
               if (refreshed) setUser(refreshed);
             } catch (error) {
               setPermissionError(error instanceof Error ? error.message : '성별 매칭 이용료를 예약하지 못했습니다.');
               await deleteDocument('webrtcQueue', currentUser.id, token).catch(() => undefined);
               setIsMatching(false);
               setActive(false);
               setStatus('결제 후 성별 매칭을 시작할 수 있습니다');
               return;
             }
           }
callRef.current = nextCall;
           resetSignalingState();
           connectionStartedAt.current = Date.now();
          connectedRef.current = false;
          setActiveCallId(nextCall.callId);
          setPeer(nextCall.peer);
          setIsMatching(false);
          setStatus('상대에게 연결을 요청하는 중');
          const connection = ensureConnection(nextCall);
          if (nextCall.initiator) {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await mergeDocument('webrtcCalls', nextCall.callId, { callId: nextCall.callId, callerId: user.id, calleeId: nextCall.peer.userId, status: 'offer', offer }, token);
            setStatus('상대 응답을 기다리는 중');
          }
          return;
        }

        await mergeDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'matched', callId: current.callId }, token);
        const connection = ensureConnection(current);
        if (!connectedRef.current && connectionStartedAt.current && Date.now() - connectionStartedAt.current > 20_000) {
          await mergeDocument('webrtcCalls', current.callId, { status: 'ended' }, token).catch(() => undefined);
          await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
          connection.close();
           connectionRef.current = null;
           callRef.current = null;
           resetSignalingState();
           connectionStartedAt.current = null;
          connectedRef.current = false;
          setIsConnected(false);
          setActiveCallId(null);
          setPeer(null);
          setIsMatching(true);
          setStatus('연결 시간이 초과되어 다른 상대를 다시 찾는 중');
          return;
        }
        const call = await getDocument<CallDocument>('webrtcCalls', current.callId, token).catch(() => null);
        if (!call) {
          if (current.initiator) {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await mergeDocument('webrtcCalls', current.callId, { callId: current.callId, callerId: user.id, calleeId: current.peer.userId, status: 'offer', offer }, token);
          }
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
          await mergeDocument('webrtcCalls', current.callId, { answer, status: 'answer' }, token);
        }
        if (current.initiator && call.answer && !answerApplied.current) {
          await connection.setRemoteDescription(call.answer);
          answerApplied.current = true;
        }
        const candidates = await queryDocumentsWhere<CandidateDocument>('webrtcCandidates', [{ field: 'callId', op: 'EQUAL', value: current.callId }], token).catch(() => []);
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
    const timer = window.setInterval(() => void poll(), 700);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, user]);

  useEffect(() => {
    if (!activeCallId || !user) return;
    let live = true;
    const loadChat = async () => {
      const token = getSessionToken();
      if (!token) return;
      await deleteExpiredChatMessages(token, 'webrtcChatMessages').catch(() => undefined);
      const rows = await queryDocumentsWhere<Omit<VideoChatMessage, 'id'>>('webrtcChatMessages', [
        { field: 'callId', op: 'EQUAL', value: activeCallId },
      ], token, 60).catch(() => []);
      if (live) setChatMessages(rows.filter((row) => new Date(row.expiresAt).getTime() > Date.now()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    void loadChat();
    const timer = window.setInterval(() => void loadChat(), 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [activeCallId, user?.id]);

  const sendVideoChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeCallId || !user || !chatInput.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    setChatError('');
    const message = { callId: activeCallId, authorId: user.id, user: user.name, text: chatInput.trim(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000) };
    try {
      await createDocument('webrtcChatMessages', crypto.randomUUID(), message, token);
      setChatInput('');
    } catch {
      setChatError('화상 채팅을 보내지 못했습니다.');
    }
  };

  return (
    <div className="webrtc-page min-h-[calc(100vh-64px)] bg-[#080d1c] px-4 py-8 text-white">
      <div className="webrtc-shell mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Private room / WebRTC</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">REAL VIDEO CONNECT</h1><p className="mt-2 text-sm text-slate-400">가짜 상대 없이, 실제 접속 중인 인증 회원과 직접 연결됩니다.</p></div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200"><ShieldCheck size={17} /> 브라우저 간 암호화 연결</div>
        </header>

        <div className="webrtc-grid grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
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
             <section className="rounded-[2rem] border border-cyan-300/20 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="font-black">매칭 설정</span><span className="text-xs font-bold text-cyan-300">성별 필터</span></div><label className="block text-xs font-bold text-slate-400">내 성별<select value={gender} onChange={(event) => setGender(event.target.value as Gender | '')} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none"><option value="">설정 안 함</option><option value="male">남성</option><option value="female">여성</option></select></label><label className="mt-3 block text-xs font-bold text-slate-400">찾고 싶은 상대<select value={genderPreference} onChange={(event) => setGenderPreference(event.target.value as GenderPreference)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none"><option value="any">모두</option><option value="male">남성</option><option value="female">여성</option></select></label><p className="mt-3 text-xs leading-5 text-slate-500">모두가 아닌 성별 필터는 매칭당 1 USDT입니다. 월 30 USDT 프리미엄 구독자는 무제한입니다.</p></section>
            <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5 text-sm text-slate-400"><div className="mb-2 flex items-center gap-2 font-black text-white"><RefreshCcw size={16} className="text-cyan-300" /> 연결 안내</div><p>두 명 이상의 인증 회원이 동시에 대기해야 연결됩니다. 아무도 없으면 실제로 연결될 때까지 대기 상태가 유지됩니다.</p></section>
          </aside>
         </div>
         <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">화상 채팅</h2><span className="text-[10px] font-bold text-emerald-300">1분 후 자동 삭제</span></div><div className="max-h-48 space-y-2 overflow-y-auto">{chatMessages.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">상대와 연결되면 메시지를 보낼 수 있습니다.</p> : chatMessages.map((message) => <div key={message.id} className="rounded-xl bg-white/[0.05] p-3 text-sm"><div className="mb-1 text-[10px] font-bold text-cyan-300">{message.user}</div><div className="break-words text-slate-200">{message.text}</div></div>)}</div>{chatError && <p className="mt-2 text-xs font-bold text-rose-300">{chatError}</p>}{user && activeCallId && <form onSubmit={sendVideoChat} className="mt-3 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="화상 채팅 메시지..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" /><button className="rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950">전송</button></form>}</section>
       </div>
    </div>
  );
}
    setIsConnected(false);
    setHasRemoteVideo(false);
    setStatus('다른 인증 회원을 찾는 중');
    setIsMatching(true);
    setActive(true);
    const queued = await mergeDocument('webrtcQueue', user.id, {
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      gender: user.gender || '',
      age: user.age || 0,
      country: user.country || 'Global',
      status: 'waiting',
      lastSeenAt: new Date(),
    }, token).then(() => true).catch((error) => {
      const detail = error instanceof Error ? error.message.slice(0, 180) : '알 수 없는 오류';
      setPermissionError(`매칭 서버 오류: ${detail}`);
      return false;
    });
    if (!queued) {
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
    setActiveCallId(null);
    setChatMessages([]);
    setStatus('대기 중');
    connectionRef.current?.close();
    connectionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    callRef.current = null;
    resetSignalingState();
    connectionStartedAt.current = null;
    connectedRef.current = false;
    if (token && user) {
      await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
      if (currentCall) await mergeDocument('webrtcCalls', currentCall.callId, { status: 'ended' }, token).catch(() => undefined);
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
      const connection = new RTCPeerConnection({ iceServers: stunServers, iceCandidatePoolSize: 10 });
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
          connectedRef.current = true;
          setIsMatching(false);
          connectionStartedAt.current = null;
          setStatus('연결 성공');
          void mergeDocument('webrtcCalls', call.callId, { status: 'connected' }, token);
        }
        if (connection.connectionState === 'disconnected') {
          connectedRef.current = false;
          setStatus('연결이 불안정합니다');
        }
        if (connection.connectionState === 'failed') {
          connectedRef.current = false;
          connectionStartedAt.current = Date.now() - 20_001;
          setIsMatching(true);
          setStatus('연결 실패, 다른 상대를 다시 찾는 중');
        }
        if (connection.connectionState === 'closed') setStatus('연결 종료');
      };
      connection.oniceconnectionstatechange = () => {
        if (connection.iceConnectionState === 'checking') setStatus('네트워크 경로를 확인하는 중');
        if (connection.iceConnectionState === 'connected' || connection.iceConnectionState === 'completed') {
          setStatus('상대 영상 연결 중');
        }
        if (connection.iceConnectionState === 'failed') {
          connectionStartedAt.current = Date.now() - 20_001;
          setIsMatching(true);
          setStatus('네트워크 연결 실패, 다른 상대를 다시 찾는 중');
        }
      };
      return connection;
    };

    const poll = async () => {
      if (cancelled || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const current = callRef.current;
        if (!current) {
          const ownQueue = await getDocument<QueueEntry>('webrtcQueue', user.id, token).catch(() => null);
          const makePeer = (profile: TetrisQueueProfile): QueueEntry => ({
            id: profile.id,
            userId: profile.id,
            name: profile.name,
            email: '',
            image: profile.image,
            country: profile.country,
            lastSeenAt: new Date().toISOString(),
          });
          let nextCall: ActiveCall | null = null;
          if (ownQueue?.status === 'matched' && ownQueue.callId && ownQueue.opponent) {
            const matchedPeer = makePeer(ownQueue.opponent);
            nextCall = { callId: ownQueue.callId, peer: matchedPeer, initiator: user.id < matchedPeer.userId };
          } else {
            await mergeDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'waiting' }, token);
            const claimed = await claimWebrtcMatch({ id: user.id, name: user.name, image: user.image, country: user.country || 'Global' }, token).catch(() => null);
            if (claimed) nextCall = { callId: claimed.callId, peer: makePeer(claimed.opponent), initiator: claimed.initiator };
          }
          if (!nextCall) {
            setStatus('다른 인증 회원을 찾는 중');
            return;
          }
           callRef.current = nextCall;
           resetSignalingState();
           connectionStartedAt.current = Date.now();
          connectedRef.current = false;
          setActiveCallId(nextCall.callId);
          setPeer(nextCall.peer);
          setIsMatching(false);
          setStatus('상대에게 연결을 요청하는 중');
          const connection = ensureConnection(nextCall);
          if (nextCall.initiator) {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await mergeDocument('webrtcCalls', nextCall.callId, { callId: nextCall.callId, callerId: user.id, calleeId: nextCall.peer.userId, status: 'offer', offer }, token);
            setStatus('상대 응답을 기다리는 중');
          }
          return;
        }

        await mergeDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'matched', callId: current.callId }, token);
        const connection = ensureConnection(current);
        if (!connectedRef.current && connectionStartedAt.current && Date.now() - connectionStartedAt.current > 20_000) {
          await mergeDocument('webrtcCalls', current.callId, { status: 'ended' }, token).catch(() => undefined);
          await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
          connection.close();
           connectionRef.current = null;
           callRef.current = null;
           resetSignalingState();
           connectionStartedAt.current = null;
          connectedRef.current = false;
          setIsConnected(false);
          setActiveCallId(null);
          setPeer(null);
          setIsMatching(true);
          setStatus('연결 시간이 초과되어 다른 상대를 다시 찾는 중');
          return;
        }
        const call = await getDocument<CallDocument>('webrtcCalls', current.callId, token).catch(() => null);
        if (!call) {
          if (current.initiator) {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            await mergeDocument('webrtcCalls', current.callId, { callId: current.callId, callerId: user.id, calleeId: current.peer.userId, status: 'offer', offer }, token);
          }
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
          await mergeDocument('webrtcCalls', current.callId, { answer, status: 'answer' }, token);
        }
        if (current.initiator && call.answer && !answerApplied.current) {
          await connection.setRemoteDescription(call.answer);
          answerApplied.current = true;
        }
        const candidates = await queryDocumentsWhere<CandidateDocument>('webrtcCandidates', [{ field: 'callId', op: 'EQUAL', value: current.callId }], token).catch(() => []);
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
    const timer = window.setInterval(() => void poll(), 700);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, user]);

  useEffect(() => {
    if (!activeCallId || !user) return;
    let live = true;
    const loadChat = async () => {
      const token = getSessionToken();
      if (!token) return;
      await deleteExpiredChatMessages(token, 'webrtcChatMessages').catch(() => undefined);
      const rows = await queryDocumentsWhere<Omit<VideoChatMessage, 'id'>>('webrtcChatMessages', [
        { field: 'callId', op: 'EQUAL', value: activeCallId },
      ], token, 60).catch(() => []);
      if (live) setChatMessages(rows.filter((row) => new Date(row.expiresAt).getTime() > Date.now()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    };
    void loadChat();
    const timer = window.setInterval(() => void loadChat(), 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [activeCallId, user?.id]);

  const sendVideoChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeCallId || !user || !chatInput.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    setChatError('');
    const message = { callId: activeCallId, authorId: user.id, user: user.name, text: chatInput.trim(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000) };
    try {
      await createDocument('webrtcChatMessages', crypto.randomUUID(), message, token);
      setChatInput('');
    } catch {
      setChatError('화상 채팅을 보내지 못했습니다.');
    }
  };

  return (
    <div className="webrtc-page min-h-[calc(100vh-64px)] bg-[#080d1c] px-4 py-8 text-white">
      <div className="webrtc-shell mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">Private room / WebRTC</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">REAL VIDEO CONNECT</h1><p className="mt-2 text-sm text-slate-400">가짜 상대 없이, 실제 접속 중인 인증 회원과 직접 연결됩니다.</p></div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200"><ShieldCheck size={17} /> 브라우저 간 암호화 연결</div>
        </header>

        <div className="webrtc-grid grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
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
         <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">화상 채팅</h2><span className="text-[10px] font-bold text-emerald-300">1분 후 자동 삭제</span></div><div className="max-h-48 space-y-2 overflow-y-auto">{chatMessages.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">상대와 연결되면 메시지를 보낼 수 있습니다.</p> : chatMessages.map((message) => <div key={message.id} className="rounded-xl bg-white/[0.05] p-3 text-sm"><div className="mb-1 text-[10px] font-bold text-cyan-300">{message.user}</div><div className="break-words text-slate-200">{message.text}</div></div>)}</div>{chatError && <p className="mt-2 text-xs font-bold text-rose-300">{chatError}</p>}{user && activeCallId && <form onSubmit={sendVideoChat} className="mt-3 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="화상 채팅 메시지..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" /><button className="rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950">전송</button></form>}</section>
       </div>
    </div>
  );
}
