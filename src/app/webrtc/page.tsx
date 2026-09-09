'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, CheckCircle2, LoaderCircle, Mic, MicOff, MonitorUp, PhoneCall, RefreshCcw, ShieldCheck, Users, VideoOff } from 'lucide-react';
import {
  deleteDocument,
  deleteWebrtcRoomData,
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
const requestMediaWithTimeout = (constraints: MediaStreamConstraints) => Promise.race([
  navigator.mediaDevices.getUserMedia(constraints),
  new Promise<MediaStream>((_, reject) => window.setTimeout(() => reject(new Error('카메라와 마이크 권한 응답이 지연되고 있습니다. 브라우저 권한을 확인해주세요.')), 12000)),
]);

export default function WebRTCPage() {
  const router = useRouter();
  const user = useGlobalStore((state) => state.user);
  const setUser = useGlobalStore((state) => state.setUser);
  const [isMatching, setIsMatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [status, setStatus] = useState('대기 중');
  const [peer, setPeer] = useState<QueueEntry | null>(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [flip, setFlip] = useState(true);
  const [active, setActive] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<VideoChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [genderPreference, setGenderPreference] = useState<GenderPreference>(user?.genderPreference || 'any');
  const [targetUserId, setTargetUserId] = useState('');
  const [compactMode, setCompactMode] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sidebarVideoRef = useRef<HTMLVideoElement>(null);
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
  const flipRef = useRef(flip);
  const outgoingVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const outgoingAnimationRef = useRef<number | null>(null);
  const outgoingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const mixedAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const autoStartRef = useRef(false);

  const resetSignalingState = () => {
    appliedCandidates.current.clear();
    offerApplied.current = false;
    answerApplied.current = false;
  };

  useEffect(() => {
    flipRef.current = flip;
  }, [flip]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTargetUserId(params.get('friend') || '');
    setCompactMode(params.get('compact') === '1');
    setAutoStart(params.get('auto') === '1');
  }, []);

  useEffect(() => {
    userRef.current = user;
    if (!user) return;
    if (!active) {
      setGenderPreference(user.genderPreference || 'any');
    }
  }, [user, active]);

  const requestMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라와 마이크를 지원하지 않습니다.');
    if (!streamRef.current) {
      try {
          streamRef.current = await requestMediaWithTimeout({ video: { facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          streamRef.current = await requestMediaWithTimeout({ video: true, audio: false });
        } else {
          throw error;
        }
      }
    }
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play().catch(() => undefined);
    }
    setAudioEnabled(streamRef.current.getAudioTracks().some((track) => track.enabled));
  };

  const toggleMicrophone = () => {
    const next = !audioEnabled;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = next; });
    setAudioEnabled(next);
  };

  const stopOutgoingVideo = () => {
    if (outgoingAnimationRef.current) window.cancelAnimationFrame(outgoingAnimationRef.current);
    outgoingAnimationRef.current = null;
    outgoingVideoTrackRef.current?.stop();
    outgoingVideoTrackRef.current = null;
    outgoingCanvasRef.current = null;
  };

  const restoreCameraTrack = async () => {
    const screenTrack = screenTrackRef.current;
    screenTrackRef.current = null;
    screenTrack?.stop();
    const cameraTrack = outgoingVideoTrackRef.current || streamRef.current?.getVideoTracks()[0] || null;
    const microphoneTrack = streamRef.current?.getAudioTracks()[0] || null;
    if (videoSenderRef.current && cameraTrack) await videoSenderRef.current.replaceTrack(cameraTrack).catch(() => undefined);
    if (audioSenderRef.current && microphoneTrack) await audioSenderRef.current.replaceTrack(microphoneTrack).catch(() => undefined);
    screenAudioTrackRef.current?.stop();
    screenAudioTrackRef.current = null;
    mixedAudioTrackRef.current?.stop();
    mixedAudioTrackRef.current = null;
    await audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play().catch(() => undefined);
    }
    setIsSharingScreen(false);
  };

  const toggleScreenShare = async () => {
    if (isSharingScreen) {
      await restoreCameraTrack();
      return;
    }
    if (!videoSenderRef.current || !navigator.mediaDevices?.getDisplayMedia) {
      setPermissionError('연결 후 화면 공유를 사용할 수 있습니다.');
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) return;
      await videoSenderRef.current.replaceTrack(screenTrack);
      screenTrackRef.current = screenTrack;
      const systemAudioTrack = display.getAudioTracks()[0] || null;
      if (systemAudioTrack && audioSenderRef.current) {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        context.createMediaStreamSource(new MediaStream([systemAudioTrack])).connect(destination);
        const microphoneTrack = streamRef.current?.getAudioTracks()[0];
        if (microphoneTrack) context.createMediaStreamSource(new MediaStream([microphoneTrack])).connect(destination);
        const mixedTrack = destination.stream.getAudioTracks()[0] || systemAudioTrack;
        await audioSenderRef.current.replaceTrack(mixedTrack);
        audioContextRef.current = context;
        screenAudioTrackRef.current = systemAudioTrack;
        mixedAudioTrackRef.current = mixedTrack;
      }
      screenTrack.onended = () => { void restoreCameraTrack(); };
      if (videoRef.current) {
        videoRef.current.srcObject = new MediaStream([screenTrack, ...(streamRef.current?.getAudioTracks() || []), ...(systemAudioTrack ? [systemAudioTrack] : [])]);
        await videoRef.current.play().catch(() => undefined);
      }
      setIsSharingScreen(true);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      setPermissionError('화면 공유를 시작하지 못했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  const getOutgoingStream = () => {
    if (!streamRef.current) return null;
    if (!outgoingVideoTrackRef.current && videoRef.current && typeof document.createElement('canvas').captureStream === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const context = canvas.getContext('2d');
      outgoingCanvasRef.current = canvas;
      const draw = () => {
        if (context && videoRef.current) {
          const width = videoRef.current.videoWidth || canvas.width;
          const height = videoRef.current.videoHeight || canvas.height;
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }
          context.save();
          context.clearRect(0, 0, canvas.width, canvas.height);
          if (flipRef.current) {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
          }
          context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          context.restore();
        }
        outgoingAnimationRef.current = window.requestAnimationFrame(draw);
      };
      draw();
      outgoingVideoTrackRef.current = canvas.captureStream(30).getVideoTracks()[0] || null;
    }
    const tracks = [
      ...(outgoingVideoTrackRef.current ? [outgoingVideoTrackRef.current] : streamRef.current.getVideoTracks()),
      ...streamRef.current.getAudioTracks(),
    ];
    return new MediaStream(tracks);
  };

  /* The caller's camera is mirrored in the outgoing canvas, so the peer sees the same orientation. */
  const createOutgoingStream = () => getOutgoingStream() || streamRef.current;

  const closeCallForRematch = (message: string) => {
    const callId = callRef.current?.callId;
    connectionRef.current?.close();
    connectionRef.current = null;
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    videoSenderRef.current = null;
    callRef.current = null;
    resetSignalingState();
    connectedRef.current = false;
    connectionStartedAt.current = null;
    setIsConnected(false);
    setHasRemoteVideo(false);
    setPeer(null);
    setActiveCallId(null);
    setIsMatching(true);
    setStatus(message);
    const token = getSessionToken();
    if (token && userRef.current) {
      void deleteDocument('webrtcQueue', userRef.current.id, token).catch(() => undefined);
      if (callId) {
        void mergeDocument('webrtcCalls', callId, { status: 'ended' }, token)
          .then(() => deleteWebrtcRoomData(callId, token))
          .catch(() => undefined);
      }
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
    const profile = { ...user, genderPreference };
    const profileChanged = profile.genderPreference !== user.genderPreference;
    if (profileChanged) {
      try {
        await saveProfile(profile, token);
      } catch {
        setPermissionError('프로필 저장은 지연되고 있지만 현재 설정으로 연결을 계속합니다.');
      }
    }
    setUser(profile);
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
    getOutgoingStream();
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
       age: user.age || 0,
      country: user.country || 'Global',
      gender: user.gender || '',
      genderPreference,
      targetUserId: targetUserId || undefined,
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
      return;
    }
  };

  useEffect(() => {
    if (!autoStart || !targetUserId || !user || active || autoStartRef.current) return;
    autoStartRef.current = true;
    void startMatch();
  }, [autoStart, targetUserId, user?.id, active]);

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
    stopOutgoingVideo();
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    screenAudioTrackRef.current?.stop();
    screenAudioTrackRef.current = null;
    mixedAudioTrackRef.current?.stop();
    mixedAudioTrackRef.current = null;
    await audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    videoSenderRef.current = null;
    audioSenderRef.current = null;
    setIsSharingScreen(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (sidebarVideoRef.current) sidebarVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    callRef.current = null;
    resetSignalingState();
    connectionStartedAt.current = null;
    connectedRef.current = false;
    if (token && user) {
      await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
      if (currentCall) {
        await mergeDocument('webrtcCalls', currentCall.callId, { status: 'ended' }, token).catch(() => undefined);
        await deleteWebrtcRoomData(currentCall.callId, token).catch(() => undefined);
      }
    }
  };

  useEffect(() => () => {
    connectionRef.current?.close();
    stopOutgoingVideo();
    screenTrackRef.current?.stop();
    screenAudioTrackRef.current?.stop();
    mixedAudioTrackRef.current?.stop();
    void audioContextRef.current?.close();
    videoSenderRef.current = null;
    audioSenderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const token = getSessionToken();
    if (token && userRef.current) {
      void deleteDocument('webrtcQueue', userRef.current.id, token);
      const callId = callRef.current?.callId;
      if (callId) {
        void mergeDocument('webrtcCalls', callId, { status: 'ended' }, token)
          .then(() => deleteWebrtcRoomData(callId, token))
          .catch(() => undefined);
      }
    }
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
      const outgoing = createOutgoingStream();
      outgoing?.getTracks().forEach((track) => {
        const sender = connection.addTrack(track, outgoing);
        if (track.kind === 'video') videoSenderRef.current = sender;
        if (track.kind === 'audio') audioSenderRef.current = sender;
      });
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
        if (sidebarVideoRef.current) {
          sidebarVideoRef.current.srcObject = remoteStream;
          void sidebarVideoRef.current.play().catch(() => undefined);
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
          closeCallForRematch('연결 실패, 다른 상대를 자동으로 찾는 중');
        }
        if (connection.connectionState === 'closed') setStatus('연결 종료');
      };
      connection.oniceconnectionstatechange = () => {
        if (connection.iceConnectionState === 'checking') setStatus('네트워크 경로를 확인하는 중');
        if (connection.iceConnectionState === 'connected' || connection.iceConnectionState === 'completed') {
          setStatus('상대 영상 연결 중');
        }
        if (connection.iceConnectionState === 'failed') closeCallForRematch('네트워크 연결 실패, 다른 상대를 자동으로 찾는 중');
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
             image: profile.image,
              country: profile.country,
              age: profile.age,
              gender: profile.gender === 'male' || profile.gender === 'female' ? profile.gender : undefined,
             lastSeenAt: new Date().toISOString(),
           });
          let nextCall: ActiveCall | null = null;
          if (ownQueue?.status === 'matched' && ownQueue.callId && ownQueue.opponent) {
            const matchedPeer = makePeer(ownQueue.opponent);
            nextCall = { callId: ownQueue.callId, peer: matchedPeer, initiator: user.id < matchedPeer.userId };
          } else {
            await mergeDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'waiting' }, token);
            const claimed = await claimWebrtcMatch({ id: user.id, name: user.name, image: user.image, country: user.country || 'Global', age: user.age, gender: user.gender || '', genderPreference, isSubscribed: Boolean(user.isSubscribed), targetUserId: targetUserId || undefined }, token).catch(() => null);
           if (claimed) nextCall = { callId: claimed.callId, peer: makePeer(claimed.opponent), initiator: claimed.initiator };
          }
          if (!nextCall) {
            setStatus('다른 인증 회원을 찾는 중');
            return;
          }
           const currentUser = userRef.current;
            if (currentUser && (currentUser.genderPreference || 'any') !== 'any' && !chargedMatchIds.current.has(nextCall.callId)) {
             try {
               await reserveGenderMatchStake(currentUser.id, nextCall.callId, 0.25, token);
               chargedMatchIds.current.add(nextCall.callId);
               const refreshed = await refreshStoredUser().catch(() => null);
               if (refreshed) setUser(refreshed);
             } catch (error) {
                setPermissionError(error instanceof Error ? error.message : 'LIVE CHAT 필터 이용료를 예약하지 못했습니다.');
                await deleteDocument('webrtcQueue', currentUser.id, token).catch(() => undefined);
                await deleteDocument('webrtcQueue', nextCall.peer.userId, token).catch(() => undefined);
                await mergeDocument('webrtcCalls', nextCall.callId, { status: 'ended' }, token).catch(() => undefined);
                await deleteWebrtcRoomData(nextCall.callId, token).catch(() => undefined);
                setIsMatching(false);
                setActive(false);
                setStatus('결제 후 성별 매칭을 시작할 수 있습니다');
                router.push('/wallet?reason=video-filter');
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
           closeCallForRematch('연결 시간이 초과되어 다른 상대를 자동으로 찾는 중');
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
          closeCallForRematch('상대가 연결을 종료했습니다. 다른 상대를 자동으로 찾는 중');
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

  const askSharedAi = async () => {
    if (!activeCallId || !user) return;
    const question = chatInput.trim();
    if (!question) {
      setChatError('AI에게 물어볼 내용을 먼저 입력해주세요.');
      return;
    }
    const token = getSessionToken();
    if (!token) return;
    setChatError('AI가 함께 답변을 준비하고 있습니다...');
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages.slice(-8).map((message) => ({ role: message.user === 'GYOPO AI' ? 'assistant' : 'user', content: message.text })), { role: 'user', content: question }],
        }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || 'AI 답변을 가져오지 못했습니다.');
      await createDocument('webrtcChatMessages', crypto.randomUUID(), { callId: activeCallId, authorId: user.id, user: 'GYOPO AI', text: result.answer, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000) }, token);
      setChatInput('');
      setChatError('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'AI 답변을 가져오지 못했습니다.');
    }
  };

  if (compactMode) {
    return (
      <div className="h-full min-h-0 w-full overflow-hidden bg-[#050914] text-white">
        <div className="relative flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#10182b] px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">GAME VOICE + VIDEO</div>
              <div className="truncate text-xs font-bold text-slate-300">{peer?.name || '상대방 연결 대기'}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${isConnected ? 'bg-emerald-300/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'}`}>{isConnected ? 'CONNECTED' : active ? 'CONNECTING' : 'READY'}</span>
          </div>

           <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
             <video ref={remoteVideoRef} autoPlay playsInline className={`h-full w-full object-contain bg-[#030611] ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`} />
             <span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-1 text-[9px] font-black text-slate-200">상대 화면</span>
             {!hasRemoteVideo && <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,#172b50,#050914_72%)] p-4 text-center"><div><Camera size={26} className="mx-auto mb-2 text-cyan-200" /><p className="text-xs font-black">{active ? status : '카메라·마이크 준비 중'}</p><p className="mt-1 text-[10px] text-slate-500">게임방 영상 연결</p></div></div>}
             <div className="absolute bottom-2 right-2 w-[42%] max-w-[220px] min-w-[96px] overflow-hidden rounded-xl border border-white/80 bg-black shadow-xl">
               <span className="absolute left-1.5 top-1.5 z-10 rounded-md bg-black/65 px-1.5 py-1 text-[8px] font-black text-white">내 화면</span>
               <video ref={videoRef} muted autoPlay playsInline className={`aspect-video h-full w-full object-contain bg-[#030611] ${flip ? 'scale-x-[-1]' : ''}`} />
             </div>
          </div>

          <div className="grid shrink-0 grid-cols-4 gap-1.5 border-t border-white/10 bg-[#10182b] p-2">
             <button type="button" onClick={toggleMicrophone} disabled={!active} className="flex min-h-9 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1 text-[10px] font-black disabled:opacity-40">{audioEnabled ? <Mic size={13} /> : <MicOff size={13} />}{audioEnabled ? '마이크' : '음소거'}</button>
             <button type="button" onClick={() => void toggleScreenShare()} disabled={!isConnected} className="flex min-h-9 items-center justify-center gap-1 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-1 text-[10px] font-black text-cyan-100 disabled:opacity-40"><MonitorUp size={13} />{isSharingScreen ? '공유 중지' : '화면+음악'}</button>
             <span className="flex min-h-9 items-center justify-center rounded-lg border border-white/10 px-1 text-[10px] font-bold text-slate-400">{status}</span>
            <button type="button" onClick={() => void endMatch()} disabled={!active} className="flex min-h-9 items-center justify-center gap-1 rounded-lg bg-rose-500/90 px-1 text-[10px] font-black text-white disabled:opacity-40"><VideoOff size={13} />종료</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="webrtc-page min-h-[calc(100vh-64px)] bg-[#080d1c] px-4 py-8 text-white">
      <div className="webrtc-shell mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div><div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">LIVE CHAT</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">LIVE CHAT</h1><p className="mt-2 text-sm text-slate-400">현재 접속 중인 인증 회원과 자동으로 연결됩니다.</p></div>
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-200"><ShieldCheck size={17} /> 브라우저 간 암호화 연결</div>
        </header>

        <div className="webrtc-grid grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="relative aspect-video overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
             <video ref={remoteVideoRef} autoPlay playsInline className={`h-full w-full object-contain bg-[#030611] transition-opacity ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`} />
            {!hasRemoteVideo && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,#172b50,#050914_70%)] text-center"><div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 p-5">{isMatching || active ? <LoaderCircle size={42} className="animate-spin text-cyan-300" /> : <Camera size={42} className="text-slate-500" />}</div><div><p className="text-xl font-black">{active ? status : '연결 대기 중'}</p><p className="mt-2 text-sm text-slate-400">{active ? '상대방의 카메라 연결을 기다리고 있습니다.' : '시작 버튼을 누르면 카메라와 마이크를 준비합니다.'}</p></div></div>}
            {(isConnected || hasRemoteVideo) && <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-2 text-xs font-bold backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {status}</div>}
             {peer && <div className="webrtc-peer-card absolute bottom-4 left-4 rounded-2xl bg-black/60 px-4 py-3 backdrop-blur"><div className="flex items-center gap-3"><img src={peer.image} alt="" className="h-10 w-10 rounded-full object-cover" /><div><div className="font-black">{peer.name}</div><div className="text-xs text-slate-300">{peer.gender || '성별 미설정'} · {peer.age || '나이 미설정'} · {peer.country || '국가 미설정'}</div></div></div></div>}
             <div className="absolute bottom-4 right-4 w-1/4 min-w-[100px] overflow-hidden rounded-2xl border-2 border-white/60 bg-black shadow-2xl"><video ref={videoRef} muted autoPlay playsInline className={`aspect-video h-full w-full object-cover ${flip ? 'scale-x-[-1]' : ''}`} /></div>
             <div className="webrtc-mobile-controls">
               <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                 <span className="truncate font-bold text-slate-200">{active ? status : '카메라와 마이크를 준비하세요'}</span>
                 <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-slate-300"><input type="checkbox" checked={flip} onChange={(event) => setFlip(event.target.checked)} className="h-3.5 w-3.5 accent-cyan-400" /> 좌우 반전</label>
               </div>
               <div className="grid grid-cols-3 gap-2">
                 {!active ? <button onClick={startMatch} className="col-span-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-3 text-sm font-black text-slate-950"><PhoneCall size={17} /> LIVE CHAT 시작</button> : <button onClick={() => void endMatch()} className="col-span-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-3 text-sm font-black text-white"><VideoOff size={17} /> 연결 종료</button>}
                  <button onClick={toggleMicrophone} disabled={!active} aria-label={audioEnabled ? '마이크 끄기' : '마이크 켜기'} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/10 px-2 text-xs font-black disabled:opacity-40">{audioEnabled ? <Mic size={14} /> : <MicOff size={14} />}{audioEnabled ? '마이크' : '음소거'}</button>
                  <button onClick={() => void toggleScreenShare()} disabled={!isConnected} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-2 text-xs font-black text-cyan-100 disabled:opacity-40"><MonitorUp size={14} /> {isSharingScreen ? '공유 중지' : '화면 + 음악'}</button>
                 <span className="flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-2 text-[11px] font-bold text-slate-400">{isConnected ? '연결됨' : '대기 중'}</span>
               </div>
             </div>
           </section>

          <aside className="space-y-5">
              <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">LIVE CHAT 상태</span><span className="text-xs font-bold text-cyan-300">{status}</span></div>{peer ? <div className="mb-5 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3"><img src={peer.image} alt="" className="h-12 w-12 rounded-full object-cover" /><div><div className="font-black">{peer.name}</div><div className="mt-1 text-xs text-slate-400">{peer.gender || '성별 미설정'} · {peer.age || '나이 미설정'} · {peer.country || '국가 미설정'}</div></div></div> : <div className="mb-5 rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500"><Users className="mx-auto mb-2" size={22} />현재 연결된 상대가 없습니다.</div>}{permissionError && <p className="mb-4 rounded-xl bg-amber-500/10 p-3 text-xs font-bold text-amber-100">{permissionError}</p>}{!active ? <button onClick={startMatch} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-4 font-black text-slate-950 transition hover:bg-cyan-300"><PhoneCall size={19} /> LIVE CHAT 시작</button> : <button onClick={() => void endMatch()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-4 font-black text-white transition hover:bg-red-400"><VideoOff size={19} /> 연결 종료</button>}</section>
              <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="font-black">카메라 설정</span><span className="text-xs text-slate-500">상대 화면에도 적용</span></div><label className="flex cursor-pointer items-center justify-between rounded-xl bg-white/[0.04] p-3 text-sm font-bold"><span>내 화면 좌우 반전</span><input type="checkbox" checked={flip} onChange={(event) => setFlip(event.target.checked)} className="h-4 w-4 accent-cyan-400" /></label><div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" />내 영상과 상대방에게 전송되는 영상 모두에 적용됩니다.</div></section>
              <section className="rounded-[2rem] border border-cyan-300/20 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="font-black">LIVE CHAT 필터</span><span className="text-xs font-bold text-cyan-300">활성화</span></div><label className="block text-xs font-bold text-slate-400">찾고 싶은 상대<select value={genderPreference} onChange={(event) => setGenderPreference(event.target.value as GenderPreference)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none"><option value="any">모두</option><option value="male">남성</option><option value="female">여성</option></select></label><p className="mt-3 text-xs leading-5 text-slate-500">내 성별은 필터에서 선택하지 않습니다. 상대 성별을 지정하면 연결될 때마다 0.25 USDT가 차감되며, 잔고가 부족하면 충전 화면으로 이동합니다.</p></section>
              <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5 text-sm text-slate-400"><div className="mb-2 flex items-center gap-2 font-black text-white"><RefreshCcw size={16} className="text-cyan-300" /> 자동 연결 안내</div><p>연결이 끊기거나 상대가 나가면 연결 종료를 누르지 않아도 다음 인증 회원을 계속 찾습니다.</p></section>
           <section className="webrtc-sidebar-screen rounded-[2rem] border border-cyan-300/20 bg-[#111a2d] p-3">
             <div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">상대 화면</span><span className="text-[10px] font-bold text-slate-500">글로벌 라운지 위치</span></div>
             <div className="relative aspect-video overflow-hidden rounded-2xl bg-black"><video ref={sidebarVideoRef} autoPlay playsInline className="h-full w-full object-cover" />{!hasRemoteVideo && <div className="absolute inset-0 grid place-items-center text-xs text-slate-500">상대 영상 대기 중</div>}</div>
              <div className="mt-3 grid grid-cols-3 gap-2"><button onClick={toggleMicrophone} disabled={!active} className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-black disabled:opacity-40">{audioEnabled ? <Mic size={14} /> : <MicOff size={14} />}{audioEnabled ? '마이크 켜짐' : '마이크 꺼짐'}</button><button onClick={() => void toggleScreenShare()} disabled={!isConnected} className="flex items-center justify-center gap-1 rounded-xl border border-cyan-300/20 bg-cyan-300/10 py-2 text-xs font-black text-cyan-100 disabled:opacity-40"><MonitorUp size={14} />{isSharingScreen ? '공유 중지' : '화면 + 음악'}</button><span className="flex items-center justify-center rounded-xl border border-white/10 px-2 text-[10px] font-bold text-slate-400">{isConnected ? '연결됨' : '대기 중'}</span></div>
             <div className="mt-3 max-h-36 space-y-2 overflow-y-auto">{chatMessages.length === 0 ? <p className="py-4 text-center text-xs text-slate-500">연결 후 메시지를 보낼 수 있습니다.</p> : chatMessages.map((message) => <div key={`side-${message.id}`} className="rounded-xl bg-white/[0.05] p-2 text-xs"><b className="text-cyan-200">{message.user}</b><p className="mt-1 break-words text-slate-300">{message.text}</p></div>)}</div>
              {user && activeCallId && <form onSubmit={sendVideoChat} className="mt-2 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="메시지 또는 AI 질문..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none" /><button type="button" onClick={() => void askSharedAi()} className="rounded-xl border border-violet-300/30 bg-violet-300/10 px-3 text-[11px] font-black text-violet-100">AI 함께</button><button className="rounded-xl bg-cyan-400 px-3 text-xs font-black text-slate-950">전송</button></form>}
           </section>
           </aside>
         </div>
         <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-black">화상 채팅</h2><span className="text-[10px] font-bold text-emerald-300">1분 후 자동 삭제</span></div><div className="max-h-48 space-y-2 overflow-y-auto">{chatMessages.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">상대와 연결되면 메시지를 보낼 수 있습니다.</p> : chatMessages.map((message) => <div key={message.id} className="rounded-xl bg-white/[0.05] p-3 text-sm"><div className="mb-1 text-[10px] font-bold text-cyan-300">{message.user}</div><div className="break-words text-slate-200">{message.text}</div></div>)}</div>{chatError && <p className="mt-2 text-xs font-bold text-rose-300">{chatError}</p>}{user && activeCallId && <form onSubmit={sendVideoChat} className="mt-3 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="화상 채팅 메시지..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none" /><button className="rounded-xl bg-cyan-400 px-4 text-sm font-black text-slate-950">전송</button></form>}</section>
       </div>
    </div>
  );
}
