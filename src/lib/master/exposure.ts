import type { ExposureRow } from '@/lib/master/keywordData';

export const EXPOSURE_STATES = ['NOT_INDEXED', 'INDEXED_NO_EXPOSURE', 'EXPOSED', 'LOW_VISIBILITY', 'PAGE_2', 'TOP_10', 'TOP_3', 'DECLINING', 'GROWING', 'PROTECTED', 'RECOVERY'] as const;
export type ExposureState = typeof EXPOSURE_STATES[number];

export const EXPOSURE_ACTIONS = ['INDEX_FIX', 'CREATE', 'EXPAND', 'UPDATE', 'CTR_OPTIMIZE', 'TOP_3_PUSH', 'PAGE_1_PUSH', 'INTERNAL_LINK', 'MERGE', 'CANNIBALIZATION_FIX', 'REFRESH', 'PROTECT', 'NO_ACTION'] as const;
export type ExposureAction = typeof EXPOSURE_ACTIONS[number];

export type ExposureContract = {
  articleId: string;
  url: string;
  primaryKeyword: string;
  keywordClusterId: string;
  secondaryKeywords: string[];
  countryCode: string;
  cityId: string;
  language: string;
  searchIntent: string;
  contentType: string;
  targetAudience: string;
  baselineDate: string;
  baselineImpressions: number | null;
  baselineClicks: number | null;
  baselineCtr: number | null;
  baselinePosition: number | null;
  indexStatus: string;
  monthlySearchVolume: number | null;
  averageCpc: number | null;
  lowTopBid: number | null;
  highTopBid: number | null;
  trendScore: number | null;
  hotScore: number | null;
  goldenScore: number | null;
  exposureOpportunityScore: number | null;
  targetPosition: number | null;
  targetExposureState: ExposureState | '';
  review3d: string;
  review5d: string;
  review7d: string;
  review15d: string;
  review30d: string;
  review60d: string;
  review90d: string;
  status: 'DRAFT' | 'AI_ENHANCED' | 'REVIEW' | 'EXPOSURE_READY' | 'PUBLISHED' | 'MONITORING' | 'OPTIMIZE' | 'PROTECTED' | 'RECOVERY' | 'ARCHIVED';
  createdAt?: string;
  updatedAt?: string;
};

export type ExposureOpportunity = {
  id: string;
  query: string;
  page: string;
  country: string;
  city: string;
  action: ExposureAction;
  state: ExposureState;
  score: number;
  commercialScore: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  sources: string[];
  impressions: number;
  clicks: number;
  ctr: number;
  position: number | null;
  reason: string;
  nextReview: string;
};

export type ExposureCluster = {
  id: string;
  name: string;
  primaryKeyword: string;
  keywordVariants: string[];
  currentPages: string[];
  impressions: number;
  clicks: number;
  position: number | null;
  cannibalizationRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: 'KEEP' | 'MERGE' | 'CANONICAL_REVIEW' | 'INTERNAL_LINK_RESTRUCTURE' | 'RETARGET' | 'NO_ACTION';
};

export function normalizeQuery(value: string): string {
  return value.toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function validateExposureContract(contract: Partial<ExposureContract>): string[] {
  const errors: string[] = [];
  if (!contract.primaryKeyword?.trim()) errors.push('Primary Keyword');
  if (!contract.searchIntent?.trim()) errors.push('Search Intent');
  if (!contract.countryCode?.trim()) errors.push('Country 또는 Global');
  if (!contract.url?.trim()) errors.push('Target URL');
  if (!contract.indexStatus?.trim()) errors.push('Index Strategy');
  if (!contract.keywordClusterId?.trim()) errors.push('Keyword Cluster');
  if (!contract.status || !['EXPOSURE_READY', 'PUBLISHED', 'MONITORING', 'PROTECTED'].includes(contract.status)) errors.push('Exposure Contract 상태');
  if (![contract.review3d, contract.review5d, contract.review7d, contract.review15d, contract.review30d, contract.review60d, contract.review90d].every(Boolean)) errors.push('Review Schedule');
  return errors;
}

function ratio(value: number, maximum: number): number {
  return maximum > 0 ? Math.min(1, Math.max(0, value / maximum)) : 0;
}

export function summarizeExposure(rows: ExposureRow[], previousRows: ExposureRow[]) {
  const pages = new Set(rows.map((row) => row.page).filter(Boolean));
  const queries = new Set(rows.map((row) => row.query).filter(Boolean));
  const top3 = rows.filter((row) => row.position > 0 && row.position <= 3);
  const top10 = rows.filter((row) => row.position > 0 && row.position <= 10);
  const page2 = rows.filter((row) => row.position > 10 && row.position <= 20);
  const currentImpressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const currentClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const previousImpressions = previousRows.reduce((sum, row) => sum + row.impressions, 0);
  const previousClicks = previousRows.reduce((sum, row) => sum + row.clicks, 0);
  const ctr = currentImpressions ? currentClicks / currentImpressions : 0;
  const previousCtr = previousImpressions ? previousClicks / previousImpressions : 0;
  const positions = rows.filter((row) => row.position > 0);
  return {
    impressions: currentImpressions,
    clicks: currentClicks,
    ctr,
    position: positions.length ? positions.reduce((sum, row) => sum + row.position * row.impressions, 0) / Math.max(1, positions.reduce((sum, row) => sum + row.impressions, 0)) : null,
    indexedPages: pages.size,
    rankingKeywords: queries.size,
    top3Keywords: new Set(top3.map((row) => row.query)).size,
    top10Keywords: new Set(top10.map((row) => row.query)).size,
    page2Keywords: new Set(page2.map((row) => row.query)).size,
    zeroExposurePages: 0,
    exposureLost: Math.max(0, previousImpressions - currentImpressions),
    exposureGained: Math.max(0, currentImpressions - previousImpressions),
    clickChange: currentClicks - previousClicks,
    ctrChange: ctr - previousCtr,
  };
}

export function buildClusters(rows: ExposureRow[]): ExposureCluster[] {
  const groups = new Map<string, ExposureRow[]>();
  for (const row of rows) {
    const key = normalizeQuery(row.query);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  return [...groups.entries()].map(([id, items]) => {
    const pages = [...new Set(items.map((item) => item.page).filter(Boolean))];
    const impressions = items.reduce((sum, item) => sum + item.impressions, 0);
    const clicks = items.reduce((sum, item) => sum + item.clicks, 0);
    const weightedPosition = items.reduce((sum, item) => sum + item.position * item.impressions, 0);
    const risk: ExposureCluster['cannibalizationRisk'] = pages.length > 2 ? 'HIGH' : pages.length > 1 ? 'MEDIUM' : 'LOW';
    const recommendedAction: ExposureCluster['recommendedAction'] = risk === 'HIGH' ? 'MERGE' : risk === 'MEDIUM' ? 'CANONICAL_REVIEW' : 'NO_ACTION';
    return {
      id: `cluster-${id.replace(/[^a-z0-9]+/gi, '-').slice(0, 80)}`,
      name: items[0].query,
      primaryKeyword: items.sort((a, b) => b.impressions - a.impressions)[0].query,
      keywordVariants: [...new Set(items.map((item) => item.query))].slice(0, 20),
      currentPages: pages.slice(0, 10),
      impressions,
      clicks,
      position: weightedPosition && impressions ? weightedPosition / impressions : null,
      cannibalizationRisk: risk,
      recommendedAction,
    };
  }).sort((a, b) => b.impressions - a.impressions);
}

export function buildExposureQueue(rows: ExposureRow[]): ExposureOpportunity[] {
  const maxImpressions = Math.max(...rows.map((row) => row.impressions), 0);
  const maxClicks = Math.max(...rows.map((row) => row.clicks), 0);
  return rows
    .filter((row) => row.query || row.page)
    .map((row, index) => {
      const normalizedCtr = row.impressions ? row.ctr : 0;
      const state: ExposureState = row.position > 0 && row.position <= 3 ? 'TOP_3' : row.position <= 10 && row.position > 0 ? 'TOP_10' : row.position <= 20 && row.position > 0 ? 'PAGE_2' : row.impressions ? 'LOW_VISIBILITY' : 'INDEXED_NO_EXPOSURE';
      const action: ExposureAction = state === 'TOP_3' ? 'PROTECT' : state === 'PAGE_2' ? 'TOP_3_PUSH' : row.impressions > 50 && normalizedCtr < 0.02 ? 'CTR_OPTIMIZE' : state === 'LOW_VISIBILITY' ? 'EXPAND' : 'INTERNAL_LINK';
      const score = Math.round((ratio(row.impressions, maxImpressions) * 35 + ratio(row.clicks, maxClicks) * 15 + (state === 'PAGE_2' ? 25 : state === 'TOP_10' ? 18 : state === 'LOW_VISIBILITY' ? 20 : 8) + Math.min(15, Math.max(0, (0.04 - normalizedCtr) * 250))));
      return {
        id: `${normalizeQuery(row.query)}-${index}`,
        query: row.query,
        page: row.page,
        country: row.country,
        city: '',
        action,
        state,
        score: Math.min(100, score),
        commercialScore: 0,
        confidence: row.impressions > 100 ? 'HIGH' : row.impressions > 20 ? 'MEDIUM' : 'LOW',
        sources: ['GSC'],
        impressions: row.impressions,
        clicks: row.clicks,
        ctr: row.ctr,
        position: row.position || null,
        reason: action === 'PROTECT' ? '상위 3위 성과가 있는 보호 대상입니다.' : action === 'TOP_3_PUSH' ? '2페이지 상단의 상승 여지가 있는 키워드입니다.' : action === 'CTR_OPTIMIZE' ? '노출 대비 CTR이 낮아 제목·메타 개선 우선입니다.' : '검색의도와 콘텐츠 깊이, 내부링크를 점검해야 합니다.',
        nextReview: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10),
      } satisfies ExposureOpportunity;
    })
    .sort((a, b) => b.score - a.score || b.impressions - a.impressions)
    .slice(0, 100);
}
