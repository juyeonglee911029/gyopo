import { requireMasterUser, unauthorizedResponse } from '@/lib/apiSecurity';
import { searchConsoleAccessToken, searchConsoleConfigured } from '@/lib/master/keywordData';

export const runtime = 'edge';

const WINDOWS = [3, 7, 15, 30, 45, 60, 90] as const;
type WindowDays = typeof WINDOWS[number];

function isWindowDays(value: number): value is WindowDays {
  return WINDOWS.includes(value as WindowDays);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    await requireMasterUser(request);
  } catch (error) {
    return unauthorizedResponse(error);
  }

  const url = new URL(request.url);
  const requestedDays = Number(url.searchParams.get('days') || 7);
  const days = isWindowDays(requestedDays) ? requestedDays : 7;
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL?.trim() || 'https://gyopo.kr/';
  if (!searchConsoleConfigured()) {
    return Response.json({
      code: 'NOT_CONFIGURED',
      error: 'Google Search Console 연결 정보가 아직 설정되지 않았습니다.',
      message: 'Search Console OAuth refresh token과 클라이언트 설정, 속성 권한이 필요합니다.',
      days,
      siteUrl,
      rows: [],
      cpcAvailable: false,
    }, { status: 503 });
  }

  const accessToken = await searchConsoleAccessToken().catch(() => '');
  if (!accessToken) {
    return Response.json({
      code: 'AUTH_FAILED',
      error: 'Google Search Console 인증이 만료되었거나 올바르지 않습니다.',
      days,
      siteUrl,
      rows: [],
      cpcAvailable: false,
    }, { status: 502 });
  }

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      startDate: isoDate(start),
      endDate: isoDate(end),
      dimensions: ['query'],
      rowLimit: 1_000,
      dataState: 'final',
    }),
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);

  if (!response) return Response.json({ error: 'Google Search Console에 연결하지 못했습니다.' }, { status: 502 });
  const payload = await response.json().catch(() => null) as {
    rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
    error?: { message?: string };
  } | null;
  if (!response.ok) {
    const message = response.status === 401 || response.status === 403
      ? 'Search Console 토큰이 만료되었거나 해당 속성 권한이 없습니다.'
      : payload?.error?.message || 'Google Search Console이 요청을 처리하지 못했습니다.';
    return Response.json({ error: message, days, siteUrl, rows: [], cpcAvailable: false }, { status: response.status === 401 || response.status === 403 ? 502 : response.status });
  }

  const rows = (payload?.rows || [])
    .map((row) => ({
      query: String(row.keys?.[0] || '').trim(),
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: Number(row.ctr || 0),
      position: Number(row.position || 0),
    }))
    .filter((row) => row.query)
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks);

  return Response.json({
    days,
    siteUrl,
    startDate: isoDate(start),
    endDate: isoDate(end),
    dataSource: 'Google Search Console',
    rows,
    cpcAvailable: false,
    cpcMessage: 'Search Console은 CPC와 전체 검색량을 제공하지 않습니다. CPC는 Google Ads Keyword Planner 연결이 필요합니다.',
  });
}
