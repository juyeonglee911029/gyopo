export const runtime = 'edge';

type ChartResult = { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; currency?: string } };
type AssetDefinition = { key: string; label: string; symbol: string; currency: string };

const assets: AssetDefinition[] = [
  { key: 'bitcoin', label: 'BTC', symbol: 'bitcoin', currency: 'USD' },
  { key: 'ethereum', label: 'ETH', symbol: 'ethereum', currency: 'USD' },
  { key: 'ripple', label: 'XRP', symbol: 'ripple', currency: 'USD' },
  { key: 'solana', label: 'SOL', symbol: 'solana', currency: 'USD' },
  { key: 'hynix', label: 'SK Hynix', symbol: '000660.KS', currency: 'KRW' },
  { key: 'samsung', label: 'Samsung', symbol: '005930.KS', currency: 'KRW' },
  { key: 'nvidia', label: 'NVIDIA', symbol: 'NVDA', currency: 'USD' },
  { key: 'apple', label: 'Apple', symbol: 'AAPL', currency: 'USD' },
  { key: 'kospi', label: 'KOSPI', symbol: '^KS11', currency: 'KRW' },
  { key: 'nasdaq', label: 'NASDAQ', symbol: '^IXIC', currency: 'USD' },
];

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { headers: { 'User-Agent': 'GYOPO-Market/1.0 (+https://gyopo.pages.dev)' }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`market source ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchYahooAsset(asset: AssetDefinition) {
  try {
    const result = await fetchJson<{ chart?: { result?: ChartResult[] } }>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(asset.symbol)}?range=1d&interval=1d&includePrePost=false`);
    const meta = result.chart?.result?.[0]?.meta;
    const value = typeof meta?.regularMarketPrice === 'number' ? meta.regularMarketPrice : null;
    const previous = typeof meta?.chartPreviousClose === 'number' ? meta.chartPreviousClose : null;
    return { key: asset.key, label: asset.label, value, change: value !== null && previous ? ((value - previous) / previous) * 100 : null, currency: meta?.currency || asset.currency };
  } catch {
    return { key: asset.key, label: asset.label, value: null, change: null, currency: asset.currency };
  }
}

export async function GET() {
  const [ratesResult, cryptoResult, equityResults] = await Promise.all([
    fetchJson<{ rates?: Record<string, number> }>('https://api.frankfurter.app/latest?from=USD&to=KRW,EUR,JPY,BRL,CAD,GBP').catch(() => ({ rates: {} })),
    fetchJson<Record<string, { usd?: number; usd_24h_change?: number }>>('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,ripple,solana&vs_currencies=usd&include_24hr_change=true').catch(() => ({})),
    Promise.all(assets.slice(4).map(fetchYahooAsset)),
  ]);

  const cryptoAssets = assets.slice(0, 4).map((asset) => ({ key: asset.key, label: asset.label, value: cryptoResult[asset.symbol]?.usd ?? null, change: cryptoResult[asset.symbol]?.usd_24h_change ?? null, currency: asset.currency }));
  return Response.json({ updatedAt: new Date().toISOString(), rates: ratesResult.rates || {}, assets: [...cryptoAssets, ...equityResults] }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' } });
}
