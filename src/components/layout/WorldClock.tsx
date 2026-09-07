'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { regionLabel, regionTimeZone } from '@/lib/regions';
import { useGlobalStore } from '@/store/useGlobalStore';

function formatClock(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function formatDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone,
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(date);
}

export default function WorldClock() {
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const koreaZone = 'Asia/Seoul';
  const selectedZone = regionTimeZone(selectedCountry);
  const selectedLabel = selectedCountry === 'Global' ? '세계 기준 (UTC)' : regionLabel(selectedCountry);

  return (
    <div className="mt-7 grid max-w-2xl gap-2 sm:grid-cols-2">
      <div className="rounded-2xl border border-teal-300/20 bg-teal-300/[.07] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-teal-200"><Clock3 size={14} /> 한국 시간</div>
        <div className="mt-1 flex items-baseline justify-between gap-3"><strong className="font-display text-2xl font-extrabold text-white tabular-nums">{now ? formatClock(now, koreaZone) : '--:--:--'}</strong><span className="text-[11px] text-slate-400">{now ? formatDate(now, koreaZone) : ''}</span></div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[.05] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-400"><Clock3 size={14} className="text-cyan-300" /> 선택 지역</div>
        <div className="mt-1 flex items-baseline justify-between gap-3"><strong className="font-display text-2xl font-extrabold text-white tabular-nums">{now ? formatClock(now, selectedZone) : '--:--:--'}</strong><span className="truncate text-right text-[11px] text-slate-400">{selectedLabel}</span></div>
      </div>
    </div>
  );
}

