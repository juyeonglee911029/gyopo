'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Camera, CheckCircle2, Flag, LoaderCircle, Mic, MicOff, MonitorUp, PhoneCall, RefreshCcw, ShieldAlert, Users, VideoOff } from 'lucide-react';
import {
  deleteDocument,
  claimWebrtcMatch,
  createDocument,
  deleteExpiredChatMessages,
  createSafetyAuditLog,
  createSafetyReport,
  createUserBlock,
  getAccountModeration,
  getDocument,
  getSessionToken,
  mergeDocument,
  listBlockedUserIds,
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
import { allowClientAction, getVideoAlias, inspectSafetyText, RANDOM_VIDEO_MIN_AGE } from '@/lib/safety';
import '@/styles/call-ui.css';

type QueueEntry = OnlineUser & {
  status?: 'waiting' | 'matched';
  callId?: string;
  opponent?: TetrisQueueProfile;
};

type CallDocument = {
  callId: string;
  callerId: string;
  calleeId: string;
  status?: 'offer' | 'answer' | 'connected' | 'ended';
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
const turnServers = [
  { urls: 'turn:openrelay.metered.ca:80', username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: process.env.NEXT_PUBLIC_TURN_USERNAME || 'openrelayproject', credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || 'openrelayproject' },
];
const iceServers = [...stunServers, ...turnServers];
const waitForIce = (peer: RTCPeerConnection) => new Promise<void>((resolve) => {
  if (peer.iceGatheringState === 'complete') return resolve();
  const finish = () => {
    if (peer.iceGatheringState === 'complete') {
      peer.removeEventListener('icegatheringstatechange', finish);
      resolve();
    }
  };
  peer.addEventListener('icegatheringstatechange', finish);
  window.setTimeout(() => {
    peer.removeEventListener('icegatheringstatechange', finish);
    resolve();
  }, 4_000);
});
const requestMediaWithTimeout = (constraints: MediaStreamConstraints) => new Promise<MediaStream>((resolve, reject) => {
  let timedOut = false;
  const timer = window.setTimeout(() => {
    timedOut = true;
    reject(new Error('카메라와 마이크 권한 응답이 지연되고 있습니다. 브라우저 권한을 확인해주세요.'));
  }, 12000);
  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
    window.clearTimeout(timer);
    if (timedOut) stream.getTracks().forEach((track) => track.stop());
    else resolve(stream);
  }, (error) => { window.clearTimeout(timer); reject(error); });
});

function formatCallDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

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
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(60);
  const [targetUserId, setTargetUserId] = useState('');
  const [callKind, setCallKind] = useState<'random' | 'friend' | 'game'>('random');
  const [compactMode, setCompactMode] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);
  const [adultConsent, setAdultConsent] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportCategory, setReportCategory] = useState<'sexual_content' | 'minor_safety' | 'harassment' | 'privacy' | 'spam' | 'other'>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [safetyActionError, setSafetyActionError] = useState('');
  const [safetyActionBusy, setSafetyActionBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sidebarVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const callRef = useRef<ActiveCall | null>(null);
  const pollingRef = useRef(false);
  const connectionStartedAt = useRef<number | null>(null);
  const connectedAtRef = useRef<number | null>(null);
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
  const operationRef = useRef(0);
  const startedRef = useRef(false);
  const startingRef = useRef(false);
  const terminalRef = useRef(false);
  const mountedRef = useRef(true);
  const blockedUserIdsRef = useRef<string[]>([]);
  const pollTimerRef = useRef<number | null>(null);
  const callIdentityRef = useRef({ id: '', kind: 'random', targetUserId: '' });
  const targetedCall = Boolean(targetUserId) || callKind !== 'random';
  const matchGenderPreference = targetedCall ? 'any' : genderPreference;

  const signalEnded = (callId?: string) => {
    const token = getSessionToken();
    const identity = callIdentityRef.current;
    const terminalId = identity.id ? `webrtc-end-${identity.kind}-${identity.id}` : '';
    // The shared admission marker also covers hangup before the queue is matched.
    for (const id of new Set([callId, terminalId].filter((value): value is string => Boolean(value)))) {
      if (token) void mergeDocument('webrtcCalls', id, { status: 'ended', endedAt: new Date() }, token).catch(() => undefined);
    }
  };

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
    setCallKind(params.get('gameRoom') || params.get('callKind') === 'game' ? 'game' : params.get('friend') ? 'friend' : 'random');
    setCompactMode(params.get('compact') === '1');
    setAutoStart(params.get('auto') === '1');
    callIdentityRef.current = {
      id: params.get('gameRoom') || params.get('callId') || '',
      kind: params.get('gameRoom') || params.get('callKind') === 'game' ? 'game' : params.get('friend') ? 'friend' : 'random',
      targetUserId: params.get('friend') || '',
    };
  }, []);

  useEffect(() => {
    if (!compactMode) return;
    document.body.classList.add('webrtc-compact-shell');
    return () => document.body.classList.remove('webrtc-compact-shell');
  }, [compactMode]);

  useEffect(() => {
    if (!isConnected) {
      connectedAtRef.current = null;
      setCallElapsed(0);
      return;
    }
    connectedAtRef.current ||= Date.now();
    const timer = window.setInterval(() => {
      if (connectedAtRef.current) setCallElapsed(Math.floor((Date.now() - connectedAtRef.current) / 1_000));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [isConnected]);

  useEffect(() => {
    userRef.current = user;
    if (!user) return;
    if (!active) {
      setGenderPreference(user.genderPreference || 'any');
    }
  }, [user, active]);

  const requestMedia = async (operation: number) => {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저는 카메라와 마이크를 지원하지 않습니다.');
    if (!streamRef.current) {
      let stream: MediaStream;
      try {
        stream = await requestMediaWithTimeout({ video: { facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (error) {
        if (operation !== operationRef.current || !mountedRef.current) return;
        if (error instanceof DOMException && error.name === 'NotFoundError') {
          stream = await requestMediaWithTimeout({ video: true, audio: false });
        } else {
          throw error;
        }
      }
      if (operation !== operationRef.current || !mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
    }
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play().catch(() => undefined);
    }
    if (operation === operationRef.current && streamRef.current) setAudioEnabled(streamRef.current.getAudioTracks().some((track) => track.enabled));
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
    const operation = operationRef.current;
    if (terminalRef.current) return;
    const screenTrack = screenTrackRef.current;
    screenTrackRef.current = null;
    if (screenTrack) screenTrack.onended = null;
    screenTrack?.stop();
    const cameraTrack = outgoingVideoTrackRef.current || streamRef.current?.getVideoTracks()[0] || null;
    const microphoneTrack = streamRef.current?.getAudioTracks()[0] || null;
    if (videoSenderRef.current && cameraTrack) await videoSenderRef.current.replaceTrack(cameraTrack).catch(() => undefined);
    if (terminalRef.current || operation !== operationRef.current) return;
    if (audioSenderRef.current && microphoneTrack) await audioSenderRef.current.replaceTrack(microphoneTrack).catch(() => undefined);
    if (terminalRef.current || operation !== operationRef.current) return;
    screenAudioTrackRef.current?.stop();
    screenAudioTrackRef.current = null;
    mixedAudioTrackRef.current?.stop();
    mixedAudioTrackRef.current = null;
    await audioContextRef.current?.close().catch(() => undefined);
    if (terminalRef.current || operation !== operationRef.current) return;
    audioContextRef.current = null;
    if (videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play().catch(() => undefined);
    }
    if (terminalRef.current || operation !== operationRef.current) return;
    setIsSharingScreen(false);
  };

  const toggleScreenShare = async () => {
    const operation = operationRef.current;
    const cancelled = () => terminalRef.current || operation !== operationRef.current || !mountedRef.current;
    if (cancelled()) return;
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
      if (cancelled()) {
        display.getTracks().forEach((track) => track.stop());
        return;
      }
      const screenTrack = display.getVideoTracks()[0];
      if (!screenTrack) { display.getTracks().forEach((track) => track.stop()); return; }
      screenTrackRef.current = screenTrack;
      const systemAudioTrack = display.getAudioTracks()[0] || null;
      screenAudioTrackRef.current = systemAudioTrack;
      await videoSenderRef.current!.replaceTrack(screenTrack);
      if (cancelled()) return;
      if (systemAudioTrack && audioSenderRef.current) {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        context.createMediaStreamSource(new MediaStream([systemAudioTrack])).connect(destination);
        const microphoneTrack = streamRef.current?.getAudioTracks()[0];
        if (microphoneTrack) context.createMediaStreamSource(new MediaStream([microphoneTrack])).connect(destination);
        const mixedTrack = destination.stream.getAudioTracks()[0] || systemAudioTrack;
        audioContextRef.current = context;
        mixedAudioTrackRef.current = mixedTrack;
        await audioSenderRef.current.replaceTrack(mixedTrack);
        if (cancelled()) return;
      }
      screenTrack.onended = () => { void restoreCameraTrack(); };
      if (videoRef.current) {
        videoRef.current.srcObject = new MediaStream([screenTrack, ...(streamRef.current?.getAudioTracks() || []), ...(systemAudioTrack ? [systemAudioTrack] : [])]);
        await videoRef.current.play().catch(() => undefined);
      }
      if (cancelled()) return;
      setIsSharingScreen(true);
    } catch (error) {
      if (cancelled()) return;
      await restoreCameraTrack();
      if (cancelled()) return;
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
    if (targetedCall) {
      endMatch('통화가 종료되었습니다. 새 통화 요청으로 다시 연결해주세요.');
      return;
    }
    if (terminalRef.current) return;
    operationRef.current += 1;
    const callId = callRef.current?.callId;
    if (connectionRef.current) {
      connectionRef.current.onconnectionstatechange = null;
      connectionRef.current.oniceconnectionstatechange = null;
    }
    connectionRef.current?.close();
    connectionRef.current = null;
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    videoSenderRef.current = null;
    callRef.current = null;
    blockedUserIdsRef.current = [];
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
      if (callId) signalEnded(callId);
    }
  };

  const requestSafetyGuard = async (action: 'match' | 'message' | 'report' | 'block') => {
    const response = await fetch('/api/safety/guard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, automated: Boolean(navigator.webdriver) }),
    });
    const result = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(result.error || '안전 확인에 실패했습니다.');
  };

  const blockPeer = async () => {
    if (!peer || !user || safetyActionBusy) return;
    if (!window.confirm('이 상대를 차단하고 현재 연결을 종료할까요?')) return;
    const token = getSessionToken();
    if (!token) return;
    setSafetyActionBusy(true);
    setSafetyActionError('');
    try {
      if (!allowClientAction(`${user.id}:block`, 30, 60 * 60_000)) throw new Error('차단 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      await requestSafetyGuard('block');
      await createUserBlock(user.id, peer.userId, peer.name, activeCallId || undefined, token);
      await createSafetyAuditLog({ actorId: user.id, action: 'block', targetUserId: peer.userId, callId: activeCallId || undefined }, token);
      endMatch('상대를 차단했습니다. 해당 상대와 다시 연결되지 않습니다.');
    } catch (error) {
      setSafetyActionError(error instanceof Error ? error.message : '차단하지 못했습니다.');
    } finally {
      setSafetyActionBusy(false);
    }
  };

  const submitReport = async () => {
    if (!peer || !user || !activeCallId || safetyActionBusy) return;
    const token = getSessionToken();
    if (!token) return;
    setSafetyActionBusy(true);
    setSafetyActionError('');
    try {
      if (!allowClientAction(`${user.id}:report`, 10, 60 * 60_000)) throw new Error('신고 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      await requestSafetyGuard('report');
      await createSafetyReport({ reporterId: user.id, reportedUserId: peer.userId, callId: activeCallId, category: reportCategory, details: reportDetails, createdAt: new Date(), status: 'open' }, token);
      await createSafetyAuditLog({ actorId: user.id, action: 'report', targetUserId: peer.userId, callId: activeCallId, metadata: reportCategory }, token);
      setShowReport(false);
      setReportDetails('');
      endMatch('신고가 접수되었습니다. 안전을 위해 연결을 종료했습니다.');
    } catch (error) {
      setSafetyActionError(error instanceof Error ? error.message : '신고를 접수하지 못했습니다.');
    } finally {
      setSafetyActionBusy(false);
    }
  };

  const startMatch = async () => {
    if (startingRef.current || active || (terminalRef.current && targetedCall)) return;
    if (!user) {
      window.alert('로그인이 필요합니다.');
      return;
    }
    const token = getSessionToken();
    if (!token) {
      window.alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
      return;
    }
    if (!Number.isInteger(user.age) || user.age < RANDOM_VIDEO_MIN_AGE) {
      setPermissionError('영상채팅은 만 18세 이상 인증 회원만 이용할 수 있습니다.');
      setStatus('18세 이상 이용 가능');
      return;
    }
    if (callKind === 'random' && !adultConsent) {
      setPermissionError('랜덤 화상채팅은 만 18세 이상이며 안전수칙에 동의해야 시작할 수 있습니다.');
      setStatus('안전수칙 동의 필요');
      return;
    }
    const moderation = await getAccountModeration(user.id, token);
    if (moderation?.status === 'banned' || (moderation?.status === 'suspended' && (!moderation.until || new Date(moderation.until).getTime() > Date.now()))) {
      setPermissionError(moderation.reason || '안전 정책 위반으로 영상채팅 이용이 제한된 계정입니다.');
      setStatus('이용 제한');
      return;
    }
    try {
      if (!allowClientAction(`${user.id}:match`, 3, 5 * 60_000)) throw new Error('매칭 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      await requestSafetyGuard('match');
    } catch (error) {
      setPermissionError(error instanceof Error ? error.message : '안전 확인에 실패했습니다.');
      return;
    }
    const blockedUserIds = await listBlockedUserIds(user.id, token);
    blockedUserIdsRef.current = blockedUserIds;
    if (!targetedCall && ageMin > ageMax) {
      setPermissionError('최소 나이는 최대 나이보다 작거나 같아야 합니다.');
      return;
    }
    const operation = ++operationRef.current;
    const cancelled = () => operation !== operationRef.current || !mountedRef.current;
    terminalRef.current = false;
    startedRef.current = true;
    startingRef.current = true;
    setHasEnded(false);
    setIsStarting(true);
    setStatus('카메라와 마이크 권한을 확인하는 중');
    setPermissionError('');
    const profile = targetedCall ? user : { ...user, genderPreference };
    const videoAlias = getVideoAlias(user.id, user.name, callKind !== 'random');
    const profileChanged = profile.genderPreference !== user.genderPreference;
    if (profileChanged) {
      try {
        await saveProfile(profile, token);
      } catch {
        if (cancelled()) return;
        setPermissionError('프로필 저장은 지연되고 있지만 현재 설정으로 연결을 계속합니다.');
      }
    }
    if (cancelled()) return;
    if (!targetedCall) setUser(profile);
    try {
      await requestMedia(operation);
    } catch (error) {
      if (cancelled()) return;
      startingRef.current = false;
      setIsStarting(false);
      setStatus('카메라 권한 확인 필요');
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
    if (cancelled()) return;
    getOutgoingStream();
    resetSignalingState();
    callRef.current = null;
    setPeer(null);
    setIsConnected(false);
    setHasRemoteVideo(false);
    setStatus(targetedCall ? '수락한 상대에게 연결하는 중' : '다른 인증 회원을 찾는 중');
    setIsMatching(true);
    const queued = await mergeDocument('webrtcQueue', user.id, {
      userId: user.id,
      name: videoAlias,
      image: user.image,
       age: user.age || 0,
      country: user.country || 'Global',
       gender: user.gender || '',
         genderPreference: matchGenderPreference,
        ageMin,
        ageMax,
        targetUserId: targetUserId || undefined,
       queueKind: callKind,
       isSubscribed: Boolean(user.isSubscribed),
       status: 'waiting',
      lastSeenAt: new Date(),
    }, token).then(() => true).catch((error) => {
      if (cancelled()) return false;
      const detail = error instanceof Error ? error.message.slice(0, 180) : '알 수 없는 오류';
      setPermissionError(`매칭 서버 오류: ${detail}`);
      return false;
    });
    if (cancelled()) {
      await deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
      return;
    }
    startingRef.current = false;
    setIsStarting(false);
    if (!queued) {
      endMatch('매칭 서버에 연결하지 못했습니다.');
      return;
    }
    setActive(true);
  };

  useEffect(() => {
    if (!autoStart || !targetUserId || !user || active || autoStartRef.current || terminalRef.current) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || terminalRef.current) return;
      autoStartRef.current = true;
      void startMatch();
    });
    return () => { cancelled = true; };
  }, [autoStart, callKind, targetUserId, user?.id, active]);

  function endMatch(message = '통화가 종료되었습니다.', notifyParent = true) {
    if (terminalRef.current) return;
    terminalRef.current = true;
    operationRef.current += 1;
    startingRef.current = false;
    if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    const token = getSessionToken();
    const currentCall = callRef.current;
    setIsStarting(false);
    setHasEnded(true);
    setActive(false);
    setIsMatching(false);
    setIsConnected(false);
    setHasRemoteVideo(false);
    setPeer(null);
    setActiveCallId(null);
    setChatMessages([]);
    setShowReport(false);
    setReportDetails('');
    setSafetyActionError('');
    setStatus(message);
    if (connectionRef.current) {
      connectionRef.current.onconnectionstatechange = null;
      connectionRef.current.oniceconnectionstatechange = null;
      connectionRef.current.onicecandidate = null;
      connectionRef.current.ontrack = null;
    }
    connectionRef.current?.close();
    connectionRef.current = null;
    stopOutgoingVideo();
    if (screenTrackRef.current) screenTrackRef.current.onended = null;
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    screenAudioTrackRef.current?.stop();
    screenAudioTrackRef.current = null;
    mixedAudioTrackRef.current?.stop();
    mixedAudioTrackRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    videoSenderRef.current = null;
    audioSenderRef.current = null;
    setIsSharingScreen(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (sidebarVideoRef.current) sidebarVideoRef.current.srcObject = null;
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current = null;
    callRef.current = null;
    resetSignalingState();
    connectionStartedAt.current = null;
    connectedRef.current = false;
    signalEnded(currentCall?.callId);
    if (token && userRef.current && startedRef.current) {
      void deleteDocument('webrtcQueue', userRef.current.id, token).catch(() => undefined);
    }
    const identity = callIdentityRef.current;
    if (notifyParent && identity.id && window.parent !== window) {
      window.parent.postMessage({ type: 'gyopo-call-ended', callKind: identity.kind, callId: identity.id }, window.location.origin);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    const onMessage = (event: MessageEvent) => {
      const identity = callIdentityRef.current;
      if (window.parent === window || event.origin !== window.location.origin || event.source !== window.parent) return;
      if (!identity.id || event.data?.type !== 'gyopo-call-end' || event.data.callId !== identity.id || event.data.callKind !== identity.kind) return;
      endMatch();
    };
    const onPageHide = () => { if (startedRef.current) endMatch(); };
    window.addEventListener('message', onMessage);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mountedRef.current = false;
      window.removeEventListener('message', onMessage);
      window.removeEventListener('pagehide', onPageHide);
      if (startedRef.current) endMatch('통화가 종료되었습니다.', false);
    };
  }, []);

  useEffect(() => {
    const identity = callIdentityRef.current;
    if (!targetedCall || !identity.id || !user || hasEnded) return;
    let cancelled = false;
    let polling = false;
    const checkEnd = async () => {
      if (cancelled || polling || terminalRef.current) return;
      polling = true;
      try {
        const marker = await getDocument<CallDocument>('webrtcCalls', `webrtc-end-${identity.kind}-${identity.id}`, getSessionToken()).catch(() => null);
        if (!cancelled && marker?.status === 'ended') endMatch('상대가 통화를 종료했습니다.');
      } finally { polling = false; }
    };
    void checkEnd();
    const timer = window.setInterval(() => void checkEnd(), 700);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [targetedCall, callKind, targetUserId, user?.id, hasEnded]);

  useEffect(() => {
    if (!active || !user || terminalRef.current) return;
    let cancelled = false;
    const token = getSessionToken();
    if (!token) {
      endMatch('로그인 세션이 만료되었습니다');
      return;
    }

    const ensureConnection = (call: ActiveCall) => {
      if (connectionRef.current) return connectionRef.current;
       const connection = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });
      connectionRef.current = connection;
      const outgoing = createOutgoingStream();
      outgoing?.getTracks().forEach((track) => {
        const sender = connection.addTrack(track, outgoing);
        if (track.kind === 'video') videoSenderRef.current = sender;
        if (track.kind === 'audio') audioSenderRef.current = sender;
      });
      connection.onicecandidate = ({ candidate }) => {
        if (!candidate || terminalRef.current || connectionRef.current !== connection) return;
        void upsertDocument('webrtcCandidates', `${call.callId}-${user.id}-${crypto.randomUUID()}`, {
          callId: call.callId,
          fromUserId: user.id,
          candidate: candidate.toJSON(),
        }, token).catch(() => undefined);
      };
      connection.ontrack = (event) => {
        if (terminalRef.current || connectionRef.current !== connection) return;
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
        if (terminalRef.current || connectionRef.current !== connection) return;
        if (connection.connectionState === 'connecting') setStatus('보안 연결을 설정하는 중');
        if (connection.connectionState === 'connected') {
          setIsConnected(true);
          connectedRef.current = true;
          setIsMatching(false);
          connectionStartedAt.current = null;
          connectedAtRef.current = Date.now();
          setCallElapsed(0);
          setStatus('연결 성공');
        }
        if (connection.connectionState === 'disconnected') {
          connectedRef.current = false;
          connectionStartedAt.current ||= Date.now();
          setStatus('연결이 불안정합니다');
        }
        if (connection.connectionState === 'failed') {
          connectedRef.current = false;
          closeCallForRematch('연결 실패, 다른 상대를 자동으로 찾는 중');
        }
        if (connection.connectionState === 'closed') setStatus('연결 종료');
      };
      connection.oniceconnectionstatechange = () => {
        if (terminalRef.current || connectionRef.current !== connection) return;
        if (connection.iceConnectionState === 'checking') setStatus('네트워크 경로를 확인하는 중');
        if (connection.iceConnectionState === 'connected' || connection.iceConnectionState === 'completed') {
          setStatus('상대 영상 연결 중');
        }
        if (connection.iceConnectionState === 'failed') closeCallForRematch('네트워크 연결 실패, 다른 상대를 자동으로 찾는 중');
      };
      return connection;
    };

    const poll = async () => {
      if (cancelled || terminalRef.current || pollingRef.current) return;
      const operation = operationRef.current;
      const stale = () => cancelled || terminalRef.current || !mountedRef.current || operation !== operationRef.current;
      pollingRef.current = true;
      try {
        const current = callRef.current;
        if (!current) {
          const ownQueue = await getDocument<QueueEntry>('webrtcQueue', user.id, token).catch(() => null);
          if (stale()) return;
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
            if (stale()) {
              if (terminalRef.current) void deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
              return;
            }
             const claimed = await claimWebrtcMatch({ id: user.id, name: getVideoAlias(user.id, user.name, callKind !== 'random'), image: user.image, country: user.country || 'Global', age: user.age, gender: user.gender || '', genderPreference: matchGenderPreference, ageMin, ageMax, isSubscribed: Boolean(user.isSubscribed), targetUserId: targetUserId || undefined, queueKind: callKind }, token, blockedUserIdsRef.current).catch(() => null);
            if (claimed) nextCall = { callId: claimed.callId, peer: makePeer(claimed.opponent), initiator: claimed.initiator };
          }
          if (stale()) {
            if (terminalRef.current) {
              signalEnded(nextCall?.callId);
              void deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
            }
            return;
          }
          if (!nextCall) {
            setStatus(targetedCall ? '수락한 상대의 카메라를 기다리는 중' : '다른 인증 회원을 찾는 중');
            return;
          }
          const existingCall = await getDocument<CallDocument>('webrtcCalls', nextCall.callId, token).catch(() => null);
          if (stale()) return;
          if (existingCall?.status === 'ended') {
            closeCallForRematch('상대가 연결을 종료했습니다. 다른 상대를 자동으로 찾는 중');
            return;
          }
           const currentUser = userRef.current;
             if (!targetedCall && currentUser && (currentUser.genderPreference || 'any') !== 'any' && !chargedMatchIds.current.has(nextCall.callId)) {
             try {
                await reserveGenderMatchStake(currentUser.id, nextCall.callId, 0.25, token);
                if (stale()) return;
               chargedMatchIds.current.add(nextCall.callId);
                const refreshed = await refreshStoredUser().catch(() => null);
                if (stale()) return;
               if (refreshed) setUser(refreshed);
              } catch (error) {
                 if (stale()) return;
                setPermissionError(error instanceof Error ? error.message : 'LIVE CHAT 필터 이용료를 예약하지 못했습니다.');
                 await deleteDocument('webrtcQueue', currentUser.id, token).catch(() => undefined);
                 if (stale()) return;
                 await deleteDocument('webrtcQueue', nextCall.peer.userId, token).catch(() => undefined);
                 if (stale()) return;
                 await mergeDocument('webrtcCalls', nextCall.callId, { status: 'ended' }, token).catch(() => undefined);
                 if (stale()) return;
                setIsMatching(false);
                setActive(false);
                setStatus('결제 후 성별 매칭을 시작할 수 있습니다');
                router.push('/wallet?reason=video-filter');
                return;
             }
           }
           if (stale()) return;
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
              if (stale()) return;
              await connection.setLocalDescription(offer);
              await waitForIce(connection);
              if (stale()) return;
             // Only termination writes status, so late SDP writes cannot erase an ended marker.
             await mergeDocument('webrtcCalls', nextCall.callId, { callId: nextCall.callId, callerId: user.id, calleeId: nextCall.peer.userId, offer }, token);
             if (stale()) return;
            setStatus('상대 응답을 기다리는 중');
          }
          return;
        }

        await mergeDocument('webrtcQueue', user.id, { lastSeenAt: new Date(), status: 'matched', callId: current.callId }, token);
        if (stale()) {
          if (terminalRef.current) void deleteDocument('webrtcQueue', user.id, token).catch(() => undefined);
          return;
        }
        const connection = ensureConnection(current);
        if (!connectedRef.current && connectionStartedAt.current && Date.now() - connectionStartedAt.current > 20_000) {
            closeCallForRematch('연결 시간이 초과되어 다른 상대를 자동으로 찾는 중');
           return;
        }
        const call = await getDocument<CallDocument>('webrtcCalls', current.callId, token).catch(() => null);
        if (stale()) return;
        if (!call) {
          if (current.initiator) {
              const offer = await connection.createOffer();
              if (stale()) return;
              await connection.setLocalDescription(offer);
              await waitForIce(connection);
              if (stale()) return;
             await mergeDocument('webrtcCalls', current.callId, { callId: current.callId, callerId: user.id, calleeId: current.peer.userId, offer }, token);
             if (stale()) return;
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
          if (stale()) return;
          offerApplied.current = true;
           const answer = await connection.createAnswer();
           if (stale()) return;
           await connection.setLocalDescription(answer);
           await waitForIce(connection);
           if (stale()) return;
          await mergeDocument('webrtcCalls', current.callId, { answer }, token);
          if (stale()) return;
        }
        if (current.initiator && call.answer && !answerApplied.current) {
          await connection.setRemoteDescription(call.answer);
          if (stale()) return;
          answerApplied.current = true;
        }
        const candidates = await queryDocumentsWhere<CandidateDocument>('webrtcCandidates', [{ field: 'callId', op: 'EQUAL', value: current.callId }], token).catch(() => []);
        if (stale()) return;
        if (!connection.remoteDescription) return;
        for (const item of candidates.filter((candidate) => candidate.callId === current.callId && candidate.fromUserId !== user.id)) {
          if (appliedCandidates.current.has(item.id)) continue;
          const added = await connection.addIceCandidate(item.candidate).then(() => true).catch(() => false);
          if (stale()) return;
          if (added) appliedCandidates.current.add(item.id);
        }
      } catch {
        if (!stale()) closeCallForRematch('연결 오류, 다른 상대를 자동으로 찾는 중');
      } finally {
        pollingRef.current = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 700);
    pollTimerRef.current = timer;
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      if (pollTimerRef.current === timer) pollTimerRef.current = null;
    };
  }, [active, ageMax, ageMin, callKind, genderPreference, targetUserId, user]);

  useEffect(() => {
    if (!activeCallId || !user) return;
    let live = true;
    const loadChat = async () => {
      if (!live || terminalRef.current) return;
      const token = getSessionToken();
      if (!token) return;
      await deleteExpiredChatMessages(token, 'webrtcChatMessages').catch(() => undefined);
      if (!live || terminalRef.current) return;
      const rows = await queryDocumentsWhere<Omit<VideoChatMessage, 'id'>>('webrtcChatMessages', [
        { field: 'callId', op: 'EQUAL', value: activeCallId },
      ], token, 60).catch(() => []);
      if (live && !terminalRef.current) setChatMessages(rows.filter((row) => new Date(row.expiresAt).getTime() > Date.now()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
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
    const safety = inspectSafetyText(chatInput);
    if (!safety.allowed) {
      setChatError(safety.message || '안전 정책에 따라 보낼 수 없는 메시지입니다.');
      return;
    }
    if (!allowClientAction(`${user.id}:message`, 20, 60_000)) {
      setChatError('메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    const message = { callId: activeCallId, authorId: user.id, user: getVideoAlias(user.id, user.name, callKind !== 'random'), text: chatInput.trim(), createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000) };
    try {
      await requestSafetyGuard('message');
      await createDocument('webrtcChatMessages', crypto.randomUUID(), message, token);
      if (terminalRef.current || callRef.current?.callId !== activeCallId) return;
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
    const safety = inspectSafetyText(question);
    if (!safety.allowed) {
      setChatError(safety.message || '안전 정책에 따라 보낼 수 없는 질문입니다.');
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
      if (terminalRef.current || callRef.current?.callId !== activeCallId) return;
      if (!response.ok || !result.answer) throw new Error(result.error || 'AI 답변을 가져오지 못했습니다.');
      const aiText = inspectSafetyText(result.answer).allowed ? result.answer : '안전 정책에 따라 외부 연락처나 링크가 포함된 AI 답변은 표시하지 않았습니다.';
      await createDocument('webrtcChatMessages', crypto.randomUUID(), { callId: activeCallId, authorId: user.id, user: 'GYOPO AI', text: aiText, createdAt: new Date(), expiresAt: new Date(Date.now() + 60_000) }, token);
      if (terminalRef.current || callRef.current?.callId !== activeCallId) return;
      setChatInput('');
      setChatError('');
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'AI 답변을 가져오지 못했습니다.');
    }
  };

  if (compactMode) {
    return (
      <div className="gyopo-compact-call h-full min-h-0 w-full overflow-hidden bg-[#050914] text-white">
        <div className="relative flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-transparent px-3 py-2">
            <div className="min-w-0">
              <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">{callKind === 'friend' ? 'FRIEND' : 'GAME'} VOICE + VIDEO</div>
              <div className="truncate text-xs font-bold text-slate-300">{peer?.name || '상대방 연결 대기'}</div>
            </div>
             <span className="flex shrink-0 items-center gap-1.5"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${isConnected ? 'bg-emerald-300/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'}`}>{hasEnded ? 'ENDED' : permissionError ? 'CHECK CAMERA' : isConnected ? 'CONNECTED' : active || isStarting ? 'CONNECTING' : 'READY'}</span>{isConnected && <span className="font-mono text-[11px] font-black text-cyan-100">{formatCallDuration(callElapsed)}</span>}</span>
          </div>

           <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
             <video ref={remoteVideoRef} autoPlay playsInline className={`h-full w-full object-contain bg-[#030611] ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`} />
             <span className="absolute left-2 top-2 rounded-md bg-black/65 px-1.5 py-1 text-[9px] font-black text-slate-200">상대 화면</span>
             {!hasRemoteVideo && <div className="call-connecting-overlay absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_center,#172b50,#050914_72%)] p-3 text-center" role="status"><div>{!hasEnded && !permissionError ? <div className="call-connecting-logo" aria-label="GYOPO 연결 중">{'GYOPO'.split('').map((letter, index) => <span key={index} style={{ animationDelay: `${index * 100}ms` }} aria-hidden="true">{letter}</span>)}</div> : <VideoOff size={24} className="mx-auto mb-2 text-slate-400" />}<p className="mt-2 text-xs font-black">{status}</p></div></div>}
             <div className={`call-local-preview absolute bottom-2 right-2 w-[30%] max-w-[160px] overflow-hidden rounded-xl border border-white/80 bg-black shadow-xl ${!active || permissionError ? 'hidden' : ''}`}>
               <span className="absolute left-1.5 top-1.5 z-10 rounded-md bg-black/65 px-1.5 py-1 text-[8px] font-black text-white">내 화면</span>
               <video ref={videoRef} muted autoPlay playsInline className={`aspect-video h-full w-full object-contain bg-[#030611] ${flip ? 'scale-x-[-1]' : ''}`} />
             </div>
          </div>

          {permissionError && !hasEnded && <div className="call-permission-error" role="alert"><span>{permissionError}</span>{!active && <button type="button" onClick={() => void startMatch()} disabled={isStarting}>권한 확인 후 다시 시도</button>}</div>}
          <div className="call-compact-controls grid shrink-0 grid-cols-3 gap-1.5 border-t border-white/10 bg-[#10182b] p-2">
             <button type="button" onClick={toggleMicrophone} disabled={!active} className="flex min-h-9 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-1 text-[10px] font-black disabled:opacity-40">{audioEnabled ? <Mic size={13} /> : <MicOff size={13} />}{audioEnabled ? '마이크' : '음소거'}</button>
              <button type="button" onClick={() => void toggleScreenShare()} disabled={!isConnected} className="flex min-h-9 items-center justify-center gap-1 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-1 text-[10px] font-black text-cyan-100 disabled:opacity-40"><MonitorUp size={13} />{isSharingScreen ? '공유 중지' : '화면 공유'}</button>
            <button type="button" onClick={() => endMatch()} disabled={hasEnded} className="flex min-h-9 items-center justify-center gap-1 rounded-lg bg-rose-500/90 px-1 text-[10px] font-black text-white disabled:opacity-40"><VideoOff size={13} />종료</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="webrtc-page min-h-[calc(100vh-64px)] bg-[#080d1c] px-4 py-8 text-white">
      <div className="webrtc-shell mx-auto max-w-6xl">
         <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="webrtc-title-stack"><div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300">LIVE CHAT</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">LIVE CHAT</h1><p className="mt-2 text-sm text-slate-400">현재 접속 중인 인증 회원과 자동으로 연결됩니다.</p></div>
         </header>

         <section className="mb-5 grid gap-3 border border-amber-300/20 bg-amber-300/[.06] p-4 text-sm text-amber-50 lg:grid-cols-[1fr_auto] lg:items-center">
           <div><div className="flex items-center gap-2 font-black"><ShieldAlert size={17} className="text-amber-200" /> 랜덤 화상채팅 안전정책</div><p className="mt-1 text-xs leading-5 text-amber-100/70">만 18세 이상만 이용할 수 있습니다. 실명·전화번호·주소·외부 연락처·링크 공유는 차단되며, 신고·차단·계정 정지와 운영자 검토가 적용됩니다.</p></div>
           {callKind === 'random' && <label className="flex min-w-0 items-start gap-2 text-xs font-bold text-amber-100"><input type="checkbox" checked={adultConsent} onChange={(event) => setAdultConsent(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-amber-300" />안전수칙을 읽었고 만 18세 이상입니다.</label>}
         </section>

         {peer && <section className="mb-5 border border-rose-300/20 bg-rose-300/[.05] p-4">
           <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-[.18em] text-rose-200">상대방 안전 도구</div><p className="mt-1 text-xs text-slate-400">불쾌하거나 위험한 상황이면 즉시 종료하고 신고 또는 차단하세요.</p></div><div className="flex gap-2"><button type="button" onClick={() => setShowReport((value) => !value)} disabled={safetyActionBusy} className="inline-flex items-center gap-1.5 border border-rose-300/25 px-3 py-2 text-xs font-black text-rose-100 disabled:opacity-50"><Flag size={14} /> 신고</button><button type="button" onClick={() => void blockPeer()} disabled={safetyActionBusy} className="inline-flex items-center gap-1.5 border border-white/10 px-3 py-2 text-xs font-black text-slate-200 disabled:opacity-50"><Ban size={14} /> 차단</button></div></div>
           {showReport && <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]"><select value={reportCategory} onChange={(event) => setReportCategory(event.target.value as typeof reportCategory)} className="border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none"><option value="sexual_content">성적·불법 콘텐츠</option><option value="minor_safety">미성년자 안전 우려</option><option value="harassment">괴롭힘·위협</option><option value="privacy">개인정보 노출</option><option value="spam">도배·사기·악성 링크</option><option value="other">기타</option></select><input value={reportDetails} onChange={(event) => setReportDetails(event.target.value.slice(0, 500))} maxLength={500} placeholder="상황을 간단히 설명해주세요 (선택)" className="min-w-0 border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none" /><button type="button" onClick={() => void submitReport()} disabled={safetyActionBusy} className="bg-rose-500 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{safetyActionBusy ? '처리 중...' : '신고 접수'}</button></div>}
           {safetyActionError && <p className="mt-2 text-xs font-bold text-rose-200">{safetyActionError}</p>}
         </section>}

         <div className="webrtc-grid grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="relative aspect-video overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-2xl">
             <video ref={remoteVideoRef} autoPlay playsInline className={`h-full w-full object-contain bg-[#030611] transition-opacity ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`} />
            {!hasRemoteVideo && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,#172b50,#050914_70%)] text-center"><div className="rounded-full border border-cyan-300/20 bg-cyan-300/10 p-5">{isMatching || active ? <LoaderCircle size={42} className="animate-spin text-cyan-300" /> : <Camera size={42} className="text-slate-500" />}</div><div><p className="text-xl font-black">{active ? status : '연결 대기 중'}</p><p className="mt-2 text-sm text-slate-400">{active ? '상대방의 카메라 연결을 기다리고 있습니다.' : '시작 버튼을 누르면 카메라와 마이크를 준비합니다.'}</p></div></div>}
            {(isConnected || hasRemoteVideo) && <div className="absolute left-4 top-4 flex items-center gap-2 rounded-xl bg-black/60 px-3 py-2 text-xs font-bold backdrop-blur"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {status}</div>}
             {peer && <div className="webrtc-peer-card absolute bottom-4 left-4 rounded-2xl bg-black/60 px-4 py-3 backdrop-blur"><div className="flex items-center gap-3"><img src={peer.image} alt="" className="h-10 w-10 rounded-full object-cover" /><div><div className="font-black">{peer.name}</div><div className="text-xs text-slate-300">{peer.gender || '성별 미설정'} · {peer.age || '나이 미설정'} · {peer.country || '국가 미설정'}</div></div></div></div>}
              <div className="absolute bottom-4 right-4 w-1/4 min-w-[100px] overflow-hidden rounded-2xl border-2 border-white/60 bg-black shadow-2xl"><video ref={videoRef} muted autoPlay playsInline className={`aspect-video h-full w-full object-contain bg-[#030611] ${flip ? 'scale-x-[-1]' : ''}`} /></div>
             <div className="webrtc-mobile-controls">
               <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                 <span className="truncate font-bold text-slate-200">{active ? status : '카메라와 마이크를 준비하세요'}</span>
                 <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-slate-300"><input type="checkbox" checked={flip} onChange={(event) => setFlip(event.target.checked)} className="h-3.5 w-3.5 accent-cyan-400" /> 좌우 반전</label>
               </div>
               <div className="grid grid-cols-3 gap-2">
                 {!active ? <button onClick={startMatch} className="col-span-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-3 text-sm font-black text-slate-950"><PhoneCall size={17} /> LIVE CHAT 시작</button> : <button onClick={() => void endMatch()} className="col-span-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-3 text-sm font-black text-white"><VideoOff size={17} /> 연결 종료</button>}
                  <button onClick={toggleMicrophone} disabled={!active} aria-label={audioEnabled ? '마이크 끄기' : '마이크 켜기'} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/10 px-2 text-xs font-black disabled:opacity-40">{audioEnabled ? <Mic size={14} /> : <MicOff size={14} />}{audioEnabled ? '마이크' : '음소거'}</button>
                   <button onClick={() => void toggleScreenShare()} disabled={!isConnected} className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-2 text-xs font-black text-cyan-100 disabled:opacity-40"><MonitorUp size={14} /> {isSharingScreen ? '공유 중지' : '화면·오디오 공유'}</button>
                 <span className="flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-2 text-[11px] font-bold text-slate-400">{isConnected ? '연결됨' : '대기 중'}</span>
               </div>
             </div>
           </section>

          <aside className="space-y-5">
              <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">LIVE CHAT 상태</span><span className="text-xs font-bold text-cyan-300">{status}</span></div>{peer ? <div className="mb-5 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3"><img src={peer.image} alt="" className="h-12 w-12 rounded-full object-cover" /><div><div className="font-black">{peer.name}</div><div className="mt-1 text-xs text-slate-400">{peer.gender || '성별 미설정'} · {peer.age || '나이 미설정'} · {peer.country || '국가 미설정'}</div></div></div> : <div className="mb-5 rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500"><Users className="mx-auto mb-2" size={22} />현재 연결된 상대가 없습니다.</div>}{permissionError && <p className="mb-4 rounded-xl bg-amber-500/10 p-3 text-xs font-bold text-amber-100">{permissionError}</p>}{!active ? <button onClick={startMatch} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 py-4 font-black text-slate-950 transition hover:bg-cyan-300"><PhoneCall size={19} /> LIVE CHAT 시작</button> : <button onClick={() => void endMatch()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-4 font-black text-white transition hover:bg-red-400"><VideoOff size={19} /> 연결 종료</button>}</section>
              <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="font-black">카메라 설정</span><span className="text-xs text-slate-500">상대 화면에도 적용</span></div><label className="flex cursor-pointer items-center justify-between rounded-xl bg-white/[0.04] p-3 text-sm font-bold"><span>내 화면 좌우 반전</span><input type="checkbox" checked={flip} onChange={(event) => setFlip(event.target.checked)} className="h-4 w-4 accent-cyan-400" /></label><div className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500"><CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" />내 영상과 상대방에게 전송되는 영상 모두에 적용됩니다.</div></section>
              <section className="rounded-[2rem] border border-cyan-300/20 bg-[#111a2d] p-5"><div className="mb-4 flex items-center justify-between"><span className="font-black">LIVE CHAT 필터 / Filters</span><span className="text-xs font-bold text-cyan-300">18–60</span></div><label className="block text-xs font-bold text-slate-400">찾고 싶은 상대 / Gender<select value={genderPreference} onChange={(event) => setGenderPreference(event.target.value as GenderPreference)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none"><option value="any">모두 / Any</option><option value="male">남성 / Male</option><option value="female">여성 / Female</option></select></label><div className="mt-4 grid grid-cols-2 gap-2"><label className="text-xs font-bold text-slate-400">최소 나이 / Min<select value={ageMin} onChange={(event) => setAgeMin(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none">{Array.from({ length: 43 }, (_, index) => index + 18).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-xs font-bold text-slate-400">최대 나이 / Max<select value={ageMax} onChange={(event) => setAgeMax(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none">{Array.from({ length: 43 }, (_, index) => index + 18).map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><p className="mt-3 text-xs leading-5 text-slate-500">랜덤 화상 매칭은 18–60세 범위에서만 연결합니다. 친구 통화는 서로 지정한 상대에게 직접 연결됩니다.</p></section>
              <section className="rounded-[2rem] border border-white/10 bg-[#111a2d] p-5 text-sm text-slate-400"><div className="mb-2 flex items-center gap-2 font-black text-white"><RefreshCcw size={16} className="text-cyan-300" /> 자동 연결 안내</div><p>연결이 끊기거나 상대가 나가면 연결 종료를 누르지 않아도 다음 인증 회원을 계속 찾습니다.</p></section>
           <section className="webrtc-sidebar-screen rounded-[2rem] border border-cyan-300/20 bg-[#111a2d] p-3">
             <div className="mb-2 flex items-center justify-between px-1"><span className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">상대 화면</span><span className="text-[10px] font-bold text-slate-500">글로벌 라운지 위치</span></div>
             <div className="relative aspect-video overflow-hidden rounded-2xl bg-black"><video ref={sidebarVideoRef} autoPlay playsInline className="h-full w-full object-cover" />{!hasRemoteVideo && <div className="absolute inset-0 grid place-items-center text-xs text-slate-500">상대 영상 대기 중</div>}</div>
              <div className="mt-3 grid grid-cols-3 gap-2"><button onClick={toggleMicrophone} disabled={!active} className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-black disabled:opacity-40">{audioEnabled ? <Mic size={14} /> : <MicOff size={14} />}{audioEnabled ? '마이크 켜짐' : '마이크 꺼짐'}</button><button onClick={() => void toggleScreenShare()} disabled={!isConnected} className="flex items-center justify-center gap-1 rounded-xl border border-cyan-300/20 bg-cyan-300/10 py-2 text-xs font-black text-cyan-100 disabled:opacity-40"><MonitorUp size={14} />{isSharingScreen ? '공유 중지' : '화면·오디오 공유'}</button><span className="flex items-center justify-center rounded-xl border border-white/10 px-2 text-[10px] font-bold text-slate-400">{isConnected ? '연결됨' : '대기 중'}</span></div>
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
