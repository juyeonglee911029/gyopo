'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CandlestickChart, ChevronDown, CircleDollarSign, RefreshCw } from 'lucide-react';

type MarketAsset = { key: string; label: string; value: number | null; change: number | null; currency: string };
type MarketPayload = {
  updatedAt: string;
  rates: Record<string, number>;
  assets: MarketAsset[];
};

const currencies = [
  ['USD', '미국 달러'], ['KRW', '한국 원'], ['EUR', '유로'], ['JPY', '일본 엔'], ['BRL', '브라질 헤알'], ['CAD', '캐나다 달러'], ['GBP', '영국 파운드'],
] as const;

function formatValue(value: number | null, currency: string) {
  if (value === null) return '--';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: currency === 'KRW' || currency === 'JPY' ? 0 : 2 }).format(value);
}

function formatChange(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '--';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function Change({ value }: { value: number | null }) {
  const positive = (value || 0) >= 0;
  return <span className={positive ? 'market-up' : 'market-down'}>{positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{formatChange(value)}</span>;
}

export default function MarketTicker() {
  const [payload, setPayload] = useState<MarketPayload | null>(null);
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('KRW');
  const [amount, setAmount] = useState('1');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch('/api/content/preview?source=market', { cache: 'no-store' }).catch(() => null);
      if (!response?.ok) return;
      const next = await response.json().catch(() => null) as MarketPayload | null;
      if (active && next) setPayload(next);
    };
    void load();
    const timer = window.setInterval(load, 120_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const converted = useMemo(() => {
    const numericAmount = Number(amount);
    if (!payload || !Number.isFinite(numericAmount)) return null;
    const fromRate = from === 'USD' ? 1 : payload.rates[from] || 1;
    const toRate = to === 'USD' ? 1 : payload.rates[to] || 1;
    return numericAmount * (toRate / fromRate);
  }, [amount, from, payload, to]);

  const assetGroups = payload?.assets || [];

  return (
    <div className={`market-bar fixed left-0 right-0 top-16 z-40 border-b border-white/10 bg-[#080e1c]/95 text-white backdrop-blur-xl ${expanded ? 'market-bar-expanded' : ''}`}>
      <div className="market-bar-inner mx-auto flex min-h-10 max-w-[1800px] items-center gap-2 px-3 lg:pl-5 lg:pr-4">
        <button type="button" onClick={() => setExpanded((value) => !value)} className="market-toggle shrink-0" aria-expanded={expanded}>
          <CandlestickChart size={14} className="text-cyan-300" />
          <span className="hidden sm:inline">GLOBAL MARKETS</span>
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <div className="market-converter flex min-w-0 items-center gap-1.5">
          <CircleDollarSign size={13} className="hidden text-amber-300 sm:block" />
          <input aria-label="환전 금액" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="market-amount" />
          <select aria-label="환전 시작 통화" value={from} onChange={(event) => setFrom(event.target.value)} className="market-select">{currencies.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select>
          <span className="text-slate-600">→</span>
          <select aria-label="환전 대상 통화" value={to} onChange={(event) => setTo(event.target.value)} className="market-select">{currencies.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select>
          <b className="market-result">{converted === null ? '--' : formatValue(converted, to)} <span>{to}</span></b>
        </div>
        <div className="market-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {assetGroups.map((asset) => <div key={asset.key} className="market-chip"><span>{asset.label}</span><b>{formatValue(asset.value, asset.currency)}</b><Change value={asset.change} /></div>)}
          {!payload && <div className="market-loading"><RefreshCw size={12} className="animate-spin" /> 실시간 시세 연결 중</div>}
        </div>
        <span className="market-updated hidden shrink-0 xl:inline">{payload ? `업데이트 ${new Date(payload.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : 'LIVE'}</span>
      </div>
      {expanded && <div className="market-detail mx-auto grid max-w-[1800px] gap-3 px-3 pb-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)] lg:pl-5 lg:pr-4">
        <div className="market-detail-card"><div className="market-detail-label">TODAY'S FX CONVERTER</div><div className="mt-2 text-sm text-slate-300">유럽중앙은행 기준 환율을 바탕으로 계산합니다.</div><div className="mt-3 text-2xl font-black text-white">{converted === null ? '--' : formatValue(converted, to)} <span className="text-sm text-cyan-200">{to}</span></div></div>
        <div className="market-detail-card"><div className="market-detail-label">CRYPTO · EQUITIES · INDEX</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{assetGroups.map((asset) => <div key={asset.key} className="rounded-xl bg-white/[.04] px-2.5 py-2"><div className="truncate text-[10px] font-bold text-slate-500">{asset.label}</div><div className="mt-1 text-sm font-black text-white">{formatValue(asset.value, asset.currency)}</div><Change value={asset.change} /></div>)}</div></div>
      </div>}
    </div>
  );
}
