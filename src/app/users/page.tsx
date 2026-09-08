'use client';

import { useEffect, useState } from 'react';
import { MapPin, Users as UsersIcon } from 'lucide-react';
import { listOnlineUsers, type OnlineUser } from '@/lib/firebase';

export default function UsersPage() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const users = await listOnlineUsers().catch(() => []);
      if (active) setOnlineUsers(users);
    };
    void load();
    const timer = window.setInterval(load, 3_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f5f7fb] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="mb-2 text-xs font-black uppercase tracking-[0.28em] text-indigo-500">Open directory</div>
            <h1 className="text-4xl font-black tracking-tight text-slate-950 md:text-6xl">실시간 회원</h1>
            <p className="mt-3 text-sm text-slate-500">로그인이나 결제 없이 현재 접속 중인 회원을 공개합니다.</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-5 py-3 shadow-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
            <b className="text-2xl text-slate-950">{onlineUsers.length}</b>
            <span className="text-sm font-bold text-slate-500">online now</span>
          </div>
        </header>

        {onlineUsers.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-20 text-center shadow-sm">
            <UsersIcon className="mx-auto mb-4 text-slate-300" size={38} />
            <h2 className="font-black text-slate-700">현재 접속 중인 회원이 없습니다.</h2>
            <p className="mt-2 text-sm text-slate-400">다른 회원이 로그인하면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {onlineUsers.map((online) => (
              <article key={online.id} className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="h-24 bg-[linear-gradient(135deg,#111827,#334155,#4f46e5)]" />
                <div className="relative px-5 pb-5">
                  <img src={online.image} alt="" className="-mt-10 h-20 w-20 rounded-3xl border-4 border-white object-cover shadow-lg" />
                  <h2 className="mt-4 text-xl font-black text-slate-950">{online.name}</h2>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> 지금 접속 중</div>
                  <div className="mt-4 flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} /> {online.country || 'Global'}</div>
                  {online.age ? <p className="mt-2 text-xs text-slate-400">{online.age}세 · {online.gender || '성별 미설정'}</p> : <p className="mt-2 text-xs text-slate-400">{online.gender || '성별 미설정'}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
