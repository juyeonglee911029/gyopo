'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CandlestickChart, ChevronDown, RefreshCw } from 'lucide-react';

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
  const tickerAssets = [
    assetGroups.find((asset) => asset.key === 'bitcoin') || { key: 'bitcoin', label: 'BTC', value: null, change: null, currency: 'USD' },
    assetGroups.find((asset) => asset.key === 'ethereum') || { key: 'ethereum', label: 'ETH', value: null, change: null, currency: 'USD' },
    { key: 'usdt', label: 'USDT', value: 1, change: 0, currency: 'USD' },
    assetGroups.find((asset) => asset.key === 'solana') || { key: 'solana', label: 'SOL', value: null, change: null, currency: 'USD' },
  ];

  return (
    <div className={`market-bar ${expanded ? 'market-bar-expanded' : ''}`}>
      <div className="market-bar-heading">
        <div className="market-detail-label"><CandlestickChart size={12} className="text-cyan-300" /> MARKET DATA</div>
        <button type="button" onClick={() => setExpanded((value) => !value)} className="market-toggle" aria-expanded={expanded}>
          <ChevronDown size={13} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <div className="market-table">
        {tickerAssets.map((asset) => <div key={asset.key} className="market-table-row"><div><b>{asset.label}</b><span>{asset.key === 'usdt' ? 'Tether' : asset.currency}</span></div><div className="market-table-value"><strong>{formatValue(asset.value, asset.currency)}</strong><Change value={asset.change} /></div></div>)}
        {!payload && <div className="market-loading"><RefreshCw size={12} className="animate-spin" /> 시세 연결 중</div>}
      </div>
      {expanded && <div className="market-detail">
        <div className="market-detail-card market-fx-card"><div className="market-detail-label">FX CONVERTER</div><div className="market-fx-row"><input aria-label="환전 금액" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /><select aria-label="환전 시작 통화" value={from} onChange={(event) => setFrom(event.target.value)}>{currencies.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></div><div className="market-fx-equals">=</div><div className="market-fx-result"><strong>{converted === null ? '--' : formatValue(converted, to)}</strong></div><select aria-label="환전 대상 통화" value={to} onChange={(event) => setTo(event.target.value)}>{currencies.map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select><p>USD 기준 실시간 환율</p></div>
      </div>}
    </div>
  );
}
