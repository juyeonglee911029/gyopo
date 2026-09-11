'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CircleStop, Grid3X3, Lightbulb, Mic, MonitorUp, Radio, RotateCcw, Settings2, Sparkles } from 'lucide-react';
import { getSessionToken, mergeDocument, queryDocumentsWhere, type PortalUser } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type FilterState = { brightness: number; contrast: number; saturation: number; softness: number; beauty: number };
type ViewerSignal = { id: string; roomId: string; viewerId: string; hostId: string; status: 'offer' | 'answer' | 'connected' | 'ended'; offer?: string; answer?: string };

const defaultFilters: FilterState = { brightness: 100, contrast: 100, saturation: 100, softness: 0, beauty: 0 };
const iceServers = [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }];

const waitForIce = (peer: RTCPeerConnection) => new Promise<void>((resolve) => {
  if (peer.iceGatheringState === 'complete') return resolve();
  const finish = () => { if (peer.iceGatheringState === 'complete') { peer.removeEventListener('icegatheringstatechange', finish); resolve(); } };
  peer.addEventListener('icegatheringstatechange', finish);
  window.setTimeout(() => { peer.removeEventListener('icegatheringstatechange', finish); resolve(); }, 4_000);
});

function filterString(filters: FilterState) {
  return `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${(filters.softness + filters.beauty) / 8}px)`;
}

export default function LiveBroadcastPage() {
  const user = useGlobalStore((state) => state.user) as PortalUser | null;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const viewerPeersRef = useRef(new Map<string, RTCPeerConnection>());
  const animationRef = useRef<number | null>(null);
  const roomRef = useRef('live-room-01');
  const [roomId, setRoomId] = useState('live-room-01');
  const [filters, setFilters] = useState(defaultFilters);
  const [live, setLive] = useState(false);
  const [endingIn, setEndingIn] = useState<number | null>(null);
  const [message, setMessage] = useState('카메라를 켜고 방송 설정을 확인하세요.');
  const [quality, setQuality] = useState('720p');
  const [micOn, setMicOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextRoom = params.get('room') || 'live-room-01';
    roomRef.current = nextRoom;
    setRoomId(nextRoom);
  }, []);

  const publishRoom = async (status: 'live' | 'offline') => {
    if (!user) return;
    const token = getSessionToken();
    if (!token) return;
    await mergeDocument('liveRooms', roomRef.current, { roomNumber: Number(roomRef.current.match(/\d+$/)?.[0] || 1), title: `LIVE ROOM ${roomRef.current.match(/\d+$/)?.[0] || '01'}`, category: '교민 라이브', hostId: user.id, hostName: user.name, hostImage: user.image, status, viewers: 0, updatedAt: new Date(), quality }, token).catch(() => undefined);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setMessage('이 브라우저는 카메라를 지원하지 않습니다.');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: quality === '1080p' ? 1920 : 1280, height: quality === '1080p' ? 1080 : 720 }, audio: true });
      stream.getAudioTracks().forEach((track) => { track.enabled = micOn; });
      cameraStreamRef.current = stream;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setMessage('카메라 준비 완료 · 방송 시작을 누르면 LIVE로 표시됩니다.');
    } catch {
      setMessage('카메라 또는 마이크 권한이 필요합니다. 브라우저 팝업에서 허용해주세요.');
    }
  };

  const replacePeerVideoTrack = async (track: MediaStreamTrack) => {
    await Promise.all([...viewerPeersRef.current.values()].map(async (peer) => {
      const sender = peer.getSenders().find((item) => item.track?.kind === 'video');
      await sender?.replaceTrack(track);
    }));
  };

  const toggleMic = () => {
    const nextValue = !micOn;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = nextValue; });
    setMicOn(nextValue);
    setMessage(nextValue ? '마이크가 켜졌습니다.' : '마이크가 꺼졌습니다.');
  };

  const stopScreenShare = async () => {
    const screenStream = screenStreamRef.current;
    const screenTrack = screenStream?.getVideoTracks()[0];
    const cameraTrack = cameraStreamRef.current?.getVideoTracks()[0];
    if (!screenTrack || !cameraTrack || !streamRef.current) return;
    screenTrack.onended = null;
    screenTrack.stop();
    screenStreamRef.current = null;
    streamRef.current.removeTrack(screenTrack);
    streamRef.current.addTrack(cameraTrack);
    if (videoRef.current) videoRef.current.srcObject = streamRef.current;
    await replacePeerVideoTrack(cameraTrack);
    setScreenSharing(false);
    setMessage('카메라 화면으로 돌아왔습니다.');
  };

  const toggleScreenShare = async () => {
    if (screenSharing) return stopScreenShare();
    if (!navigator.mediaDevices?.getDisplayMedia) return setMessage('이 브라우저는 화면 공유를 지원하지 않습니다.');
    if (!streamRef.current) await startCamera();
    if (!streamRef.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];
      const currentVideoTrack = streamRef.current.getVideoTracks()[0];
      if (!screenTrack || !currentVideoTrack) return;
      screenStreamRef.current = screenStream;
      streamRef.current.removeTrack(currentVideoTrack);
      streamRef.current.addTrack(screenTrack);
      screenTrack.onended = () => { void stopScreenShare(); };
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
      await replacePeerVideoTrack(screenTrack);
      setScreenSharing(true);
      setMessage('화면을 공유하는 중입니다. 브라우저의 공유 중지 버튼으로도 종료할 수 있습니다.');
    } catch {
      setMessage('화면 공유가 취소되었거나 권한이 없습니다.');
    }
  };

  const startBroadcast = async () => {
    if (!user) return setMessage('방송하려면 먼저 로그인해주세요.');
    if (!streamRef.current) await startCamera();
    if (!streamRef.current) return;
    setLive(true);
    setEndingIn(null);
    await publishRoom('live');
    setMessage('LIVE 방송 중 · 설정값은 송출 미리보기에 적용됩니다.');
  };

  const stopBroadcast = async () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current = null;
    cameraStreamRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScreenSharing(false);
    setLive(false);
    setEndingIn(null);
    await publishRoom('offline');
    setMessage('방송이 종료되었습니다. 방송방에는 20초 동안 종료 안내가 표시됩니다.');
  };

  const scheduleStop = () => {
    setEndingIn(20);
    const timer = window.setInterval(() => setEndingIn((value) => value && value > 1 ? value - 1 : null), 1_000);
    window.setTimeout(() => { window.clearInterval(timer); void stopBroadcast(); }, 20_000);
  };

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => void publishRoom('live'), 5_000);
    return () => window.clearInterval(timer);
  }, [live, quality, user?.id]);

  useEffect(() => {
    if (!live || !user || !streamRef.current) return;
    const token = getSessionToken();
    if (!token) return;
    let active = true;
    const acceptViewers = async () => {
      const rows = await queryDocumentsWhere<ViewerSignal>('liveRoomViewers', [{ field: 'roomId', op: 'EQUAL', value: roomRef.current }, { field: 'status', op: 'EQUAL', value: 'offer' }], token, 20).catch(() => []);
      for (const viewer of rows) {
        if (!active || viewerPeersRef.current.has(viewer.id) || !viewer.offer) continue;
        const peer = new RTCPeerConnection({ iceServers });
        viewerPeersRef.current.set(viewer.id, peer);
        const stream = streamRef.current;
        if (!stream) {
          peer.close();
          viewerPeersRef.current.delete(viewer.id);
          continue;
        }
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
            peer.close();
            viewerPeersRef.current.delete(viewer.id);
          }
        };
        try {
          await peer.setRemoteDescription(JSON.parse(viewer.offer) as RTCSessionDescriptionInit);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await waitForIce(peer);
          await mergeDocument('liveRoomViewers', viewer.id, { status: 'answer', answer: JSON.stringify(peer.localDescription) }, token);
        } catch {
          peer.close();
          viewerPeersRef.current.delete(viewer.id);
        }
      }
    };
    void acceptViewers();
    const timer = window.setInterval(() => void acceptViewers(), 1_500);
    return () => {
      active = false;
      window.clearInterval(timer);
      viewerPeersRef.current.forEach((peer) => peer.close());
      viewerPeersRef.current.clear();
    };
  }, [live, user?.id]);

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const updateFilter = (key: keyof FilterState, value: number) => setFilters((current) => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters(defaultFilters);

  return (
    <main className="live-broadcast-page min-h-screen bg-[#050812] px-3 py-5 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-rose-300"><Radio size={15} /> Broadcaster studio</div><h1 className="mt-1 text-2xl font-black text-white">LIVE ROOM · 방송 설정</h1><p className="mt-1 text-xs text-slate-500">{roomId} · 송출 화면 미리보기</p></div><span className={`live-indicator ${live ? 'is-live' : ''}`}><span />{live ? 'LIVE' : 'READY'}</span></header>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
         <section className="live-studio-preview"><div className="relative aspect-video overflow-hidden bg-black"><video ref={videoRef} muted playsInline className="h-full w-full object-cover" style={{ filter: filterString(filters) }} /><canvas ref={canvasRef} className="hidden" />{!streamRef.current && <div className="absolute inset-0 grid place-items-center text-center"><div><Camera size={38} className="mx-auto text-rose-300" /><p className="mt-3 text-sm font-black">카메라 미리보기</p><p className="mt-1 text-xs text-slate-500">시작하기를 눌러 본인 송출 화면을 확인하세요.</p></div></div>}{live && <div className="absolute left-3 top-3 live-indicator is-live"><span />LIVE</div>}</div><div className="flex flex-wrap items-center gap-2 p-3"><button type="button" onClick={() => void startCamera()} className="live-studio-button"><Camera size={15} />카메라 켜기</button><button type="button" onClick={toggleMic} className="live-studio-button"><Mic size={15} />{micOn ? '마이크 켜짐' : '마이크 꺼짐'}</button><button type="button" onClick={() => void toggleScreenShare()} className="live-studio-button"><MonitorUp size={15} />{screenSharing ? '화면 공유 중' : '화면 공유'}</button>{live ? <button type="button" onClick={scheduleStop} className="live-studio-stop"><CircleStop size={15} />{endingIn ? `${endingIn}초 후 종료` : '방송 종료 예약'}</button> : <button type="button" onClick={() => void startBroadcast()} className="live-studio-start"><Radio size={15} />방송 시작</button>}</div><p className="border-t border-white/10 px-3 py-2 text-xs text-slate-400">{message}</p></section>
          <aside className="live-studio-settings"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-black"><Settings2 size={16} className="text-rose-300" />고급 방송 설정</div><button type="button" onClick={resetFilters} className="text-xs text-slate-500 hover:text-white"><RotateCcw size={14} /></button></div><label className="mt-4 block text-xs font-bold text-slate-400">방송 품질<select value={quality} onChange={(event) => setQuality(event.target.value)} className="live-studio-select"><option>720p</option><option>1080p</option><option>480p</option></select></label><div className="mt-5 space-y-4"><div className="flex items-center gap-2 text-xs font-black text-amber-200"><Lightbulb size={14} />조도·색상</div>{([['brightness', '밝기', 70, 140], ['contrast', '대비', 70, 140], ['saturation', '채도', 70, 140]] as const).map(([key, label, min, max]) => <label key={key} className="block text-xs text-slate-400">{label}<input type="range" min={min} max={max} value={filters[key]} onChange={(event) => updateFilter(key, Number(event.target.value))} className="mt-2 w-full accent-rose-300" /></label>)}</div><div className="mt-5 space-y-4"><div className="flex items-center gap-2 text-xs font-black text-cyan-200"><Sparkles size={14} />피부 보정</div><label className="block text-xs text-slate-400">부드럽게<input type="range" min="0" max="12" value={filters.softness} onChange={(event) => updateFilter('softness', Number(event.target.value))} className="mt-2 w-full accent-cyan-300" /></label><label className="block text-xs text-slate-400">팔자주름 완화<input type="range" min="0" max="12" value={filters.beauty} onChange={(event) => updateFilter('beauty', Number(event.target.value))} className="mt-2 w-full accent-cyan-300" /></label></div><div className="mt-5 grid grid-cols-2 gap-2 text-[11px] text-slate-500"><div className="border border-white/10 p-3"><Grid3X3 size={14} className="mb-1 text-rose-300" />30개 방 용량</div><div className="border border-white/10 p-3"><Radio size={14} className="mb-1 text-emerald-300" />5초 자동 복구</div></div></aside>
        </div>
      </div>
    </main>
  );
}
