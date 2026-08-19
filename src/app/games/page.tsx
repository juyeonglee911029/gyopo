'use client';
import { useState } from 'react';
import { useGlobalStore } from '@/store/useGlobalStore';
import { Users, Gamepad2, Play, Coins } from 'lucide-react';

const onlineUsers = [
  { id: 1, name: '도쿄토끼', country: 'JP', rank: '골드' },
  { id: 2, name: '워킹홀리', country: 'AU', rank: '실버' },
  { id: 3, name: '뉴욕김사장', country: 'US', rank: '브론즈' },
  { id: 4, name: '하노이별', country: 'VN', rank: '플래티넘' },
];

export default function GamesPage() {
  const { user, updateUsdt } = useGlobalStore();
  const [inGame, setInGame] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Betting states
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<string>('5');
  const [activeBet, setActiveBet] = useState<number>(0);
  const [opponentName, setOpponentName] = useState<string>('');

  const handleOpenChallenge = (opponent: string) => {
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    setChallengeTarget(opponent);
    setBetAmount('5'); // 기본값
  };

  const submitChallenge = () => {
    const amount = Number(betAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("올바른 판돈을 입력해주세요.");
      return;
    }
    if (user!.usdtBalance < amount) {
      alert("USDT 잔고가 부족합니다.");
      return;
    }

    setOpponentName(challengeTarget!);
    setChallengeTarget(null);
    setActiveBet(amount);

    // Mock: 대전 신청 후 서버에서 상대방 승락 대기
    alert(`[시스템] '${challengeTarget}' 님에게 ${amount} USDT 빵 대전을 신청했습니다. 수락을 대기합니다...`);
    
    // Mock: 상대방이 수락했다고 가정
    setTimeout(() => {
      alert(`[시스템] '${challengeTarget}' 님이 대전을 수락했습니다! 게임 방으로 이동합니다.`);
      startCountdown();
    }, 1500);
  };

  const startCountdown = () => {
    setInGame(true);
    let count = 5;
    setCountdown(count);
    
    const timer = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(timer);
        setCountdown(null);
      }
    }, 1000);
  };

  // 게임 종료 로직 (Mock)
  const handleGameEnd = (isWinner: boolean) => {
    if (isWinner) {
      alert(`🎉 승리하셨습니다! 판돈 ${activeBet} USDT를 획득합니다.`);
      updateUsdt(activeBet); // 승리 시 획득 (상대방 돈을 가져오는 개념)
    } else {
      alert(`💀 패배하셨습니다. 판돈 ${activeBet} USDT를 잃었습니다.`);
      updateUsdt(-activeBet); // 패배 시 차감
    }
    setInGame(false);
    setActiveBet(0);
    setOpponentName('');
  };

  if (inGame) {
    return (
      <div className="container mx-auto px-4 py-8 h-[80vh] flex flex-col">
        {/* 게임 화면 상단 정보 */}
        <div className="bg-gray-800 text-white p-4 rounded-t-3xl flex justify-between items-center px-8 border-b border-gray-700">
           <div className="font-bold text-xl">{user?.name}</div>
           <div className="flex flex-col items-center">
              <span className="text-yellow-400 font-black text-2xl flex items-center gap-2">
                 <Coins size={24} /> {activeBet * 2} USDT 판돈
              </span>
              <span className="text-xs text-gray-400">(승자 독식)</span>
           </div>
           <div className="font-bold text-xl">{opponentName}</div>
        </div>

        {/* 게임 화면 Mock */}
        <div className="flex-1 bg-gray-900 rounded-b-3xl relative overflow-hidden flex items-center justify-center border-4 border-t-0 border-gray-800">
          
          {countdown !== null ? (
            <div className="text-9xl font-black text-white animate-bounce drop-shadow-2xl">
              {countdown}
            </div>
          ) : (
            <div className="w-full h-full flex justify-around items-center p-8 relative">
              
              {/* 승/패 시뮬레이션 버튼 (개발용 목업) */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex gap-4 z-50">
                <button onClick={() => handleGameEnd(true)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]">
                  [테스트] 내가 승리
                </button>
                <button onClick={() => handleGameEnd(false)} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                  [테스트] 내가 패배
                </button>
              </div>

              {/* 내 보드 */}
              <div className="w-64 h-full max-h-[600px] border-2 border-blue-500 bg-black flex flex-col justify-end p-1 relative shadow-[0_0_30px_rgba(59,130,246,0.3)]">
                {/* Mock Tetris Blocks */}
                <div className="w-full h-1/4 bg-blue-600/80 border-t-2 border-white"></div>
              </div>

              <div className="text-white text-center flex flex-col items-center">
                 <div className="text-6xl font-black text-orange-500 mb-4 drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]">VS</div>
                 <div className="text-sm bg-red-600 px-4 py-2 rounded-full animate-pulse font-bold shadow-lg">상대방에게 방해 줄 전송 중! 💥</div>
              </div>

              {/* 상대 보드 */}
              <div className="w-64 h-full max-h-[600px] border-2 border-red-500 bg-black flex flex-col justify-end p-1 relative opacity-70 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
                {/* Mock Tetris Blocks */}
                <div className="w-full h-1/2 bg-red-600/80 border-t-2 border-white"></div>
              </div>
            </div>
          )}

          <button onClick={() => { setInGame(false); setActiveBet(0); }} className="absolute bottom-6 right-6 text-white bg-white/10 px-6 py-3 rounded-xl backdrop-blur-md hover:bg-red-500/80 hover:text-white transition font-bold border border-white/20">
             항복하고 나가기 (-{activeBet} USDT)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl relative">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
             <Gamepad2 size={32} className="text-blue-600" />
             멀티플레이어 테트리스 대전 (에스크로)
           </h1>
           <p className="text-sm text-gray-500 mt-2">
             원하는 판돈(USDT)을 걸고 실시간 대전을 즐겨보세요! 승자가 판돈을 모두 가져갑니다.
           </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-xl text-gray-800 flex items-center gap-2">
            <Users size={24} className="text-blue-600" />
            대기실 (온라인 유저)
          </h2>
          {user && (
            <div className="text-sm font-bold bg-green-50 text-green-700 px-4 py-2 rounded-xl border border-green-200 flex items-center gap-2">
              <Coins size={16} /> 내 잔고: {user.usdtBalance.toFixed(2)} USDT
            </div>
          )}
        </div>
        
        <div className="divide-y divide-gray-100">
          {onlineUsers.map((u) => (
            <div key={u.id} className="p-5 flex items-center justify-between hover:bg-blue-50/30 transition-colors">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 text-lg shadow-inner">
                   {u.name.charAt(0)}
                 </div>
                 <div>
                   <div className="font-bold text-gray-900 text-lg">{u.name}</div>
                   <div className="text-sm text-gray-500 flex gap-2 mt-1">
                     <span className="bg-gray-100 px-2 py-0.5 rounded font-medium">{u.country}</span>
                     <span className="text-orange-500 font-bold">{u.rank}</span>
                   </div>
                 </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    alert(`'${u.name}' 님에게 송금하시겠습니까? 지갑 페이지로 이동합니다.`);
                    window.location.href = '/wallet';
                  }}
                  className="flex items-center gap-1.5 bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-bold hover:bg-green-100 transition shadow-sm hover:-translate-y-0.5"
                >
                  <Coins size={16} />
                  송금
                </button>
                <button 
                  onClick={() => handleOpenChallenge(u.name)}
                  className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-gray-800 transition shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Play size={16} />
                  대전 신청
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 대전 신청 모달 (Betting Modal) */}
      {challengeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl transform scale-100 transition-transform">
            <h3 className="text-2xl font-black text-gray-900 mb-2">대전 신청</h3>
            <p className="text-gray-500 mb-6">
              <span className="font-bold text-blue-600">{challengeTarget}</span> 님과 대전할 판돈을 입력하세요.
            </p>
            
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Coins size={20} className="text-yellow-500" />
              </div>
              <input 
                type="number" 
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                min="1"
                className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl py-3 pl-12 pr-12 text-xl font-bold text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                <span className="text-gray-500 font-bold">USDT</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setChallengeTarget(null)}
                className="flex-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 transition"
              >
                취소
              </button>
              <button 
                onClick={submitChallenge}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-md transition"
              >
                신청하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}