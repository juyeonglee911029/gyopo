'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Crown, Lock, MapPin, Sparkles, Users as UsersIcon } from 'lucide-react';
import { listOnlineUsers, OnlineUser } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

export default function UsersPage() {
  const { user, subscribe, updateUsdt } = useGlobalStore();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const users = await listOnlineUsers().catch(() => []);
      if (active) setOnlineUsers(users);
    };
    void load();
    const timer = window.setInterval(load, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  if (!user) {
    return <div className="min-h-[calc(100vh-64px)] bg-[#f5f7fb] px-4 py-24 text-center"><div className="mx-auto max-w-md rounded-[2rem] border border-slate-200 bg-white p-10 shadow-xl"><UsersIcon className="mx-auto mb-5 text-indigo-500" size={42} /><h2 className="text-2xl font-black text-slate-900">실시간 회원 디렉토리</h2><p className="mt-3 text-sm text-slate-500">Google 로그인 후 실제 접속 중인 회원만 확인할 수 있습니다.</p><Link href="/login" className="mt-7 inline-flex rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white">로그인하기</Link></div></div>;
  }

  const handleSubscribe = () => {
    const cost = 30;
    if (user.usdtBalance < cost) return window.alert(`USDT 잔고가 부족합니다. (월정액 ${cost} USDT 필요)`);
    updateUsdt(-cost, { type: 'FEE', amount: cost, status: 'COMPLETED', details: '월정액 구독 (1개월)' });
    subscribe();
    window.alert('프리미엄 구독이 완료되었습니다.');
  };

  if (!user.isSubscribed) {
    return <div className="min-h-[calc(100vh-64px)] bg-[#080d1c] px-4 py-12 text-white"><div className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,#273d74,#10182b_45%,#080d1c)] p-6 shadow-2xl md:p-14"><div className="mx-auto max-w-2xl text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/20 bg-amber-200/10 text-amber-200"><Crown size={30} /></div><div className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Private network</div><h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">REAL PEOPLE.<br /><span className="text-cyan-300">REAL CONNECTIONS.</span></h1><p className="mt-5 text-slate-300">가짜 프로필 없이, 현재 접속 중인 인증 회원을 위한 프리미엄 디렉토리입니다.</p><div className="mx-auto mt-9 max-w-md rounded-3xl border border-white/10 bg-white/[0.07] p-6 text-left backdrop-blur"><div className="flex items-end justify-between"><div><div className="text-sm font-bold text-slate-400">Premium access</div><div className="mt-1 text-4xl font-black">30 <span className="text-base font-bold text-slate-400">USDT / 월</span></div></div><Sparkles className="text-amber-200" /></div><div className="my-6 space-y-3 text-sm text-slate-200"><div className="flex gap-2"><Check className="text-emerald-300" size={18} />실제 인증 회원 디렉토리</div><div className="flex gap-2"><Check className="text-emerald-300" size={18} />성별·나이·국가 프로필 정보</div><div className="flex gap-2"><Check className="text-emerald-300" size={18} />실시간 온라인 상태</div></div><button onClick={handleSubscribe} className="w-full rounded-xl bg-cyan-400 py-3.5 font-black text-slate-950 transition hover:bg-cyan-300">프리미엄 시작하기</button></div></div></div></div>;
  }

  return <div className="min-h-[calc(100vh-64px)] bg-[#f5f7fb] px-4 py-8 md:py-12"><div className="mx-auto max-w-6xl"><header className="mb-8 flex flex-wrap items-end justify-between gap-5"><div><div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-indigo-500">Verified directory</div><h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">실시간 회원</h1><p className="mt-3 text-sm text-slate-500">현재 접속 중인 인증 회원만 표시됩니다.</p></div><div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-3 shadow-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" /><b className="text-2xl text-slate-950">{onlineUsers.length}</b><span className="text-sm font-bold text-slate-500">online now</span></div></header>{onlineUsers.length === 0 ? <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-20 text-center shadow-sm"><Lock className="mx-auto mb-4 text-slate-300" size={38} /><h2 className="font-black text-slate-700">현재 접속 중인 회원이 없습니다.</h2><p className="mt-2 text-sm text-slate-400">다른 회원이 로그인하면 이곳에 표시됩니다.</p></div> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{onlineUsers.map((online) => <article key={online.id} className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"><div className="h-24 bg-[linear-gradient(135deg,#111827,#334155,#4f46e5)]" /><div className="relative px-5 pb-5"><img src={online.image} alt="" className="-mt-10 h-20 w-20 rounded-3xl border-4 border-white object-cover shadow-lg" /><div className="mt-4 flex items-start justify-between"><div><h2 className="text-xl font-black text-slate-950">{online.name}</h2><div className="mt-1 flex items-center gap-1 text-xs font-bold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 지금 접속 중</div></div><div className="rounded-xl bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-600">VERIFIED</div></div><div className="mt-5 flex flex-wrap gap-2 text-xs font-bold text-slate-500"><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{online.gender || '성별 미설정'}</span><span className="rounded-lg bg-slate-100 px-2.5 py-1.5">{online.age || '나이 미설정'}</span><span className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5"><MapPin size={12} />{online.country || '국가 미설정'}</span></div></div></article>)}</div>}</div></div>;
}
