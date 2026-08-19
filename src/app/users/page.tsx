'use client';

import { useGlobalStore } from '@/store/useGlobalStore';
import { Lock, Crown, Users as UsersIcon, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

// Mock data
const mockUsers = [
  { id: 'user_12345', name: '도쿄토끼', location: '일본 도쿄', joinDate: '2026.01' },
  { id: 'user_98765', name: '워킹홀리', location: '호주 시드니', joinDate: '2026.03' },
  { id: 'user_45678', name: '뉴욕김사장', location: '미국 뉴욕', joinDate: '2025.11' },
  { id: 'user_34567', name: '하노이별', location: '베트남 하노이', joinDate: '2026.06' },
  { id: 'user_11223', name: '파리유학생', location: '프랑스 파리', joinDate: '2026.08' },
];

export default function UsersPage() {
  const { user, subscribe, updateUsdt } = useGlobalStore();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">로그인이 필요합니다.</h2>
        <Link href="/login" className="text-blue-600 underline">로그인 페이지로 이동</Link>
      </div>
    );
  }

  const handleSubscribe = () => {
    const cost = 30; // 30 USDT per month
    if (user.usdtBalance < cost) {
      return alert(`USDT 잔고가 부족합니다. (월정액 ${cost} USDT 필요)`);
    }
    updateUsdt(-cost, { type: 'FEE', amount: cost, status: 'COMPLETED', details: '월정액 구독 (1개월)' });
    subscribe();
    alert('[시스템] 프리미엄 월정액 구독이 완료되었습니다!\n이제 유저 디렉토리 및 화상채팅(무료)을 이용하실 수 있습니다.');
  };

  if (!user.isSubscribed) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-gray-900 rounded-3xl p-8 md:p-16 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
              <Lock size={40} className="text-blue-200" />
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black text-white mb-6">
              글로벌 교포 프리미엄 멤버십
            </h1>
            <p className="text-blue-100 text-lg mb-10 max-w-xl leading-relaxed">
              전 세계 교민들의 네트워킹 풀(Pool)인 <strong>유저 디렉토리</strong> 열람 권한은 월정액 구독자에게만 제공됩니다.
            </p>

            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 md:p-8 max-w-md w-full backdrop-blur-md mb-8">
              <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                <Crown className="text-yellow-400" /> Premium Plan
              </h3>
              <div className="text-4xl font-black text-white my-4">30 <span className="text-xl text-blue-200">USDT / 월</span></div>
              
              <ul className="text-left text-blue-50 space-y-4 my-8">
                <li className="flex items-center gap-3"><CheckCircle2 className="text-green-400"/> 전 세계 유저 목록 및 프로필 조회</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-green-400"/> <strong>랜덤 화상 채팅 무제한 무료</strong> (회당 1 USDT 면제)</li>
                <li className="flex items-center gap-3"><CheckCircle2 className="text-green-400"/> 프리미엄 전용 배지 부여</li>
              </ul>

              <button 
                onClick={handleSubscribe}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white font-black py-4 rounded-xl shadow-lg transition-transform hover:scale-105"
              >
                결제하고 혜택 받기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <div>
           <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
             <UsersIcon size={32} className="text-blue-600" />
             프리미엄 유저 디렉토리
           </h1>
           <p className="text-sm text-gray-500 mt-2">
             글로벌 교포 멤버십 유저들을 위한 네트워킹 공간입니다.
           </p>
        </div>
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-1.5 rounded-full font-bold text-sm shadow-md flex items-center gap-1">
          <Crown size={14} /> VIP 멤버
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockUsers.map(u => (
          <div key={u.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center font-black text-blue-600 text-xl border-2 border-white shadow-sm">
              {u.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{u.name}</h3>
              <p className="text-sm text-gray-500">{u.location}</p>
              <p className="text-xs text-gray-400 mt-1">가입: {u.joinDate}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}