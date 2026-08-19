'use client';
import { useEffect, useRef, useState } from 'react';
import { useGlobalStore } from '@/store/useGlobalStore';
import { Camera, Wand2, RefreshCcw, VideoOff, PhoneCall, Users as UsersIcon } from 'lucide-react';

export default function WebRTCPage() {
  const { user, updateUsdt } = useGlobalStore();
  const [isMatching, setIsMatching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Mock Beauty Filter states
  const [smoothing, setSmoothing] = useState(50);
  const [lift, setLift] = useState(50); // 팔자주름 보정
  const [flip, setFlip] = useState(true);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (isConnected && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play();
    }
  }, [isConnected]);

  const requestMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('이 브라우저는 카메라와 마이크를 지원하지 않습니다.');
    }
    if (!streamRef.current) {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    }
    if (videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      await videoRef.current.play();
    }
  };

  const startMatch = async () => {
    if (!user) {
      window.alert('로그인이 필요합니다.');
      return;
    }

    setPermissionError('');
    try {
      await requestMedia();
    } catch {
      setPermissionError('카메라와 마이크 권한이 필요합니다. 브라우저 주소창의 권한 설정을 확인해주세요.');
      return;
    }
    
    // Check if user needs to pay
    const cost = user.isSubscribed ? 0 : 1;

    if (cost > 0 && user.usdtBalance < cost) {
      window.alert('USDT 잔고가 부족합니다. 충전하시거나 프리미엄을 구독하세요.');
      return;
    }
    
    // 차감
    if (cost > 0) {
      updateUsdt(-cost);
    }
    
    setIsMatching(true);

    setTimeout(() => {
      setIsMatching(false);
      setIsConnected(true);
    }, 2000);
  };

  const endMatch = () => {
    setIsConnected(false);
    setIsMatching(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-black text-gray-800">랜덤 화상 채팅 (뷰티 필터)</h1>
           <p className="text-sm text-gray-500 mt-1">1 USDT를 소모하여 글로벌 교민과 랜덤으로 매칭됩니다. (10초 내 끊김 시 전액 반환)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 비디오 영역 */}
        <div className="lg:col-span-2 bg-gray-900 rounded-3xl overflow-hidden aspect-video relative flex items-center justify-center shadow-xl border border-gray-800">
            {!isConnected ? (
             <div className="text-center text-white space-y-4">
                {isMatching ? (
                  <>
                    <div className="animate-spin text-blue-500 mx-auto">
                       <RefreshCcw size={48} />
                    </div>
                    <p className="font-bold text-xl">상대방을 찾는 중입니다...</p>
                  </>
                ) : (
                   <>
                     <Camera size={64} className="text-gray-600 mx-auto mb-4" />
                     <p className="text-gray-400">시작 버튼을 누르면 카메라와 마이크 권한을 요청합니다.</p>
                   </>
                 )}
              </div>
           ) : (
              <div className="relative w-full h-full flex flex-col">
                 <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-blue-900 to-slate-900 flex items-center justify-center text-center text-white p-8">
                   <div>
                     <UsersIcon />
                     <p className="mt-4 font-bold text-xl">상대방 연결을 기다리는 중입니다</p>
                     <p className="mt-2 text-sm text-blue-200">카메라와 마이크는 준비되었습니다.</p>
                   </div>
                 </div>
                 
                 {/* 내 화면 (우측 하단 PiP) */}
                 <div className="absolute bottom-4 right-4 w-1/4 aspect-video bg-black rounded-lg border-2 border-white overflow-hidden shadow-2xl">
                    <video ref={videoRef} muted playsInline className={`w-full h-full object-cover ${flip ? 'scale-x-[-1]' : ''}`} />
                </div>

                {/* 통화 컨트롤 */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4">
                   <button onClick={endMatch} className="bg-red-600 text-white p-4 rounded-full hover:bg-red-700 shadow-lg">
                     <VideoOff size={24} />
                   </button>
                </div>
             </div>
          )}
        </div>

        {/* 컨트롤 패널 */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
              <Wand2 size={20} className="text-purple-600" />
              AI 뷰티 필터 설정
            </h3>
            
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm font-bold text-gray-600 mb-2">
                  <span>피부 보정 (블러)</span>
                  <span>{smoothing}%</span>
                </div>
                <input type="range" min="0" max="100" value={smoothing} onChange={(e) => setSmoothing(Number(e.target.value))} className="w-full accent-purple-600" />
              </div>

              <div>
                <div className="flex justify-between text-sm font-bold text-gray-600 mb-2">
                  <span>팔자주름/리프팅</span>
                  <span>{lift}%</span>
                </div>
                <input type="range" min="0" max="100" value={lift} onChange={(e) => setLift(Number(e.target.value))} className="w-full accent-purple-600" />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-sm font-bold text-gray-600">좌우 반전 모드</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center space-y-4">
             <div className="font-bold text-gray-700">현재 잔고</div>
             <div className="text-3xl font-black text-blue-600">{user?.usdtBalance.toFixed(2) || '0.00'} USDT</div>
             
              {permissionError && <p className="text-sm text-red-600 font-bold bg-red-50 p-3 rounded-xl">{permissionError}</p>}

              {!isConnected ? (
                <button 
                  onClick={startMatch}
                  disabled={isMatching}
                  className={`w-full py-4 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 ${isMatching ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  <PhoneCall size={20} />
                  {isMatching ? '매칭 중...' : `매칭 시작 (${user?.isSubscribed ? '프리미엄 무료' : '-1 USDT'})`}
                </button>
             ) : (
                <button 
                  onClick={endMatch}
                  className="w-full py-4 rounded-xl font-bold text-white shadow-md bg-red-600 hover:bg-red-700"
                >
                  통화 종료
                </button>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
