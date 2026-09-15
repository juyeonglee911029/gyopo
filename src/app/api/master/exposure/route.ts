import { requireMasterUser, unauthorizedResponse } from '@/lib/apiSecurity';
import { listAdminJsonDocuments, upsertAdminJsonDocument } from '@/lib/firebaseAdmin';
import { googleAdsConfigured, loadExposureRows } from '@/lib/master/keywordData';
import { buildClusters, buildExposureQueue, summarizeExposure, validateExposureContract, type ExposureContract } from '@/lib/master/exposure';

export const runtime = 'edge';

const WINDOWS = [3, 5, 7, 15, 30, 60, 90] as const;

function selectedDays(value: string | null): number {
  const days = Number(value || 7);
  return WINDOWS.includes(days as (typeof WINDOWS)[number]) ? days : 7;
}

export async function GET(request: Request) {
  try {
    await requireMasterUser(request);
  } catch (error) {
    return unauthorizedResponse(error);
  }
  const url = new URL(request.url);
  const days = selectedDays(url.searchParams.get('days'));
  const [current, previous] = await Promise.all([loadExposureRows(days), loadExposureRows(days, true)]);
  const rows = current.rows;
  const metrics = summarizeExposure(rows, previous.rows);
  const contracts = await listAdminJsonDocuments('exposureContracts').catch(() => []);
  const storedContracts = contracts.map((item) => ({ id: item.id, ...(item.data as Partial<ExposureContract>), updatedAt: item.updatedAt || item.data.updatedAt })) as Array<ExposureContract & { id: string }>;
  return Response.json({
    generatedAt: new Date().toISOString(),
    days,
    range: current.range,
    sources: {
      searchConsole: current.source,
      googleAds: googleAdsConfigured() ? 'connected' : 'not_configured',
      searchConsoleMessage: current.message,
      googleAdsMessage: googleAdsConfigured() ? undefined : 'Google Ads Developer Token·Customer ID·OAuth 연결이 필요합니다.',
    },
    metrics,
    rows: rows.slice(0, 5_000),
    queue: buildExposureQueue(rows),
    clusters: buildClusters(rows),
    contracts: storedContracts,
    monitoring: storedContracts.filter((contract) => ['PUBLISHED', 'MONITORING', 'OPTIMIZE', 'PROTECTED', 'RECOVERY'].includes(String(contract.status))),
    previousRange: previous.range,
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireMasterUser(request);
  } catch (error) {
    return unauthorizedResponse(error);
  }
  const body = await request.json().catch(() => null) as { action?: string; contract?: Partial<ExposureContract> } | null;
  if (body?.action !== 'saveContract' || !body.contract) return Response.json({ error: 'Exposure Contract 요청 형식이 올바르지 않습니다.' }, { status: 400 });
  const errors = validateExposureContract(body.contract);
  if (errors.length) return Response.json({ error: `발행 전 필수 항목을 완성해주세요: ${errors.join(', ')}`, missing: errors }, { status: 422 });
  const now = new Date().toISOString();
  const articleId = String(body.contract.articleId || crypto.randomUUID()).slice(0, 128);
  await upsertAdminJsonDocument('exposureContracts', articleId, { ...body.contract, articleId, updatedBy: user.email || user.uid, updatedAt: now, createdAt: body.contract.createdAt || now });
  return Response.json({ ok: true, articleId, status: body.contract.status, updatedAt: now });
}
