import { requireMasterUser, unauthorizedResponse } from '@/lib/apiSecurity';
import { loadGoldenKeywordRows } from '@/lib/master/keywordData';

export const runtime = 'edge';

const WINDOWS = [3, 7, 15, 30, 45, 60, 90] as const;

export async function GET(request: Request) {
  try {
    await requireMasterUser(request);
  } catch (error) {
    return unauthorizedResponse(error);
  }
  const daysValue = Number(new URL(request.url).searchParams.get('days') || 7);
  const days = WINDOWS.includes(daysValue as (typeof WINDOWS)[number]) ? daysValue : 7;
  const payload = await loadGoldenKeywordRows(days).catch((error) => ({
    rows: [],
    sources: { searchConsole: 'error' as const, googleAds: 'error' as const, searchConsoleMessage: error instanceof Error ? error.message : '키워드 데이터를 가져오지 못했습니다.' },
    range: { startDate: '', endDate: '' },
  }));
  const configured = payload.sources.searchConsole !== 'not_configured' || payload.sources.googleAds !== 'not_configured';
  if (!configured) {
    return Response.json({ code: 'NOT_CONFIGURED', error: 'Google Ads 또는 Search Console 연결 정보가 아직 설정되지 않았습니다.', ...payload }, { status: 503 });
  }
  return Response.json({ days, ...payload });
}
