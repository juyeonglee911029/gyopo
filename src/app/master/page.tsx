'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CheckCircle2, Copy, Database, ExternalLink, FilePenLine, ImagePlus, LockKeyhole Save, Search, ShieldAlert, SlidersHorizontal, WalletCards, WandSparkles } from 'lucide-react';
import { approveDepositRequest, approveTransferRequest, createDocument, getDocument, getFreshSessionToken, getOnlineCount, getSessionToken, getSiteStats, isMasterUser, listDocuments, MASTER_DEPOSIT_ADDRESS, MASTER_EMAIL, mergeDocument, reviewDepositRequest, reviewTransferRequest, USDT_NETWORK, type PortalUser, type SiteStats } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';
import { CONTENT_SOURCES, REVIEW_REGIONS, sourceItemId, type ContentCategory, type ContentSource } from '@/lib/contentSources';
import { curateSourceItems } from '@/lib/sourcepreview';
import { regionLabel } from '@/lib/regions';

type RequestRow = { id: string; userId: string; amount: number; status: string; createdAt?: string; network?: string; depositAddress?: string; targetAddress?: string; senderId?: string; recipientId?: string; fee?: number; source?: string; sourceWalletAddress?: string; txHash?: string };
type OnchainDeposit = { txHash: string; from: string; to: string; amount: number; blockTimestamp: number; network: string; symbol: string };
type WalletSettings = { depositAddress?: string; network?: string; updatedAt?: string };
type ContentSourceSettings = { disabledSourceIds?: string[]; updatedAt?: string };
type SourceItem = { title: string; url: string; description?: string; body?: string; image?: string; images?: string[]; publishedAt?: string; category?: string; company?: string; location?: string; country?: string; salary?: string; tag?: string; author?: string };
type SourceSection = { category: ContentCategory; label: string; url: string; items: SourceItem[] };
type SourcePayload = { error?: string; warning?: string; status?: string; sourceId?: string; sourceName?: string; region?: string; url?: string; title?: string; description?: string; image?: string; images?: string[]; fetchedAt?: string; verified?: boolean; items?: SourceItem[]; sections?: SourceSection[] };
type SafetyReportRow = { id: string; reporterId: string; reportedUserId: string; callId?: string; category: string; details?: string; createdAt?: string; status: 'open' | 'resolved' };
type ModerationRow = { id: string; userId: string; status: 'active' | 'suspended' | 'banned'; reason?: string; until?: string; updatedAt?: string; updatedBy?: string };
type KeywordMetricRow = { query: string; clicks: number; impressions: number; ctr: number; position: number };
type GoldenKeywordRow = { query: string; clicks: number; impressions: number; ctr: number; position: number | null; cpc: number | null; country: string; city: string; category: string; page: string; sources: string[]; siteCoverage?: 'ON_SITE' | 'NOT_MAPPED' };
type GoldenWeights = { impressions: number; ctr: number; position: number; cpc: number };
type SearchInsightRow = { query: string; count: number; ai: number; portal: number; countries: Array<{ value: string; count: number }>; audiences: Array<{ value: string; count: number }>; destinations: Array<{ value: string; count: number }>; lastSearchedAt: string };
type GrowthInsight = { value: string; count: number };
type GrowthInsightPayload = { days: number; total: number; uniqueVisitors: number; sessions: number; events: GrowthInsight[]; paths: GrowthInsight[]; countries: GrowthInsight[]; sources: GrowthInsight[]; error?: string };
type StructuredDraft = { title: string; summary: string; body: string; seoTitle: string; metaDescription: string; tags: string[]; imageBrief: string; factsToVerify: string[] };

const SEARCH_CONSOLE_WINDOWS = [3, 7, 15, 30, 45, 60, 90] as const;

const categoryLabels: Record<ContentCategory, string> = { news: '뉴스', directory: '업소록', jobs: '구인구직', market: '장터', events: '행사', community: '커뮤니티' };

function scoreGoldenKeyword(row: GoldenKeywordRow, rows: GoldenKeywordRow[], weights: GoldenWeights) {
  const maxImpressions = Math.max(...rows.map((item) => item.impressions), 0);
  const maxCtr = Math.max(...rows.map((item) => item.ctr), 0);
  const positions = rows.map((item) => item.position || 0).filter(Boolean);
  const maxPosition = Math.max(...positions, 0);
  const maxCpc = Math.max(...rows.map((item) => item.cpc || 0), 0);
  const metrics: Array<[number, number | null]> = [
    [weights.impressions, maxImpressions ? row.impressions / maxImpressions : null],
    [weights.ctr, maxCtr ? row.ctr / maxCtr : null],
    [weights.position, row.position && maxPosition ? Math.max(0, 1 - (row.position - 1) / maxPosition) : null],
    [weights.cpc, row.cpc !== null && maxCpc ? row.cpc / maxCpc : null],
  ];
  const available = metrics.filter(([, value]) => value !== null);
  const totalWeight = available.reduce((sum, [weight]) => sum + Math.max(0, weight), 0);
  const score = totalWeight ? available.reduce((sum, [weight, value]) => sum + Math.max(0, weight) * Number(value), 0) / totalWeight * 100 : 0;
  return Math.round(Math.min(100, Math.max(0, score)));
}

async function retryPublish(action: () => Promise<void>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await action();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('게시 요청에 실패했습니다.');
}

export default function MasterPage() {
  const user = useGlobalStore((state) => state.user);
  const [profiles, setProfiles] = useState<Array<PortalUser & { id: string }>>([]);
  const [deposits, setDeposits] = useState<RequestRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<RequestRow[]>([]);
  const [transfers, setTransfers] = useState<RequestRow[]>([]);
  const [settings, setSettings] = useState<WalletSettings>({ depositAddress: MASTER_DEPOSIT_ADDRESS, network: USDT_NETWORK });
  const [disabledSourceIds, setDisabledSourceIds] = useState<string[]>([]);
  const [contentSettingsLoaded, setContentSettingsLoaded] = useState(false);
  const [address, setAddress] = useState(MASTER_DEPOSIT_ADDRESS);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [savingAction, setSavingAction] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<Record<string, string>>({});
  const [siteStats, setSiteStats] = useState<SiteStats>({ today: 0, month: 0, total: 0 });
  const [onlineCount, setOnlineCount] = useState(0);
  const [syncingDeposits, setSyncingDeposits] = useState(false);
  const [unmatchedDeposits, setUnmatchedDeposits] = useState<OnchainDeposit[]>([]);
  const [masterTab, setMasterTab] = useState<'overview' | 'wallets'>('overview');
  const [walletSearch, setWalletSearch] = useState('');
  const [walletBalances, setWalletBalances] = useState<Record<string, { balance: number; syncedAt: string }>>({});
  const [walletBalanceErrors, setWalletBalanceErrors] = useState<Record<string, string>>({});
  const [walletBalanceLoading, setWalletBalanceLoading] = useState<Record<string, boolean>>({});
  const [safetyReports, setSafetyReports] = useState<SafetyReportRow[]>([]);
  const [moderationRows, setModerationRows] = useState<ModerationRow[]>([]);
  const [analyticsDays, setAnalyticsDays] = useState<(typeof SEARCH_CONSOLE_WINDOWS)[number]>(7);
  const [keywordRows, setKeywordRows] = useState<KeywordMetricRow[]>([]);
  const [keywordStatus, setKeywordStatus] = useState('');
  const [keywordDataSource, setKeywordDataSource] = useState('');
  const [keywordCpcMessage, setKeywordCpcMessage] = useState('');
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordMetricRow | null>(null);
  const [goldenRows, setGoldenRows] = useState<GoldenKeywordRow[]>([]);
  const [goldenStatus, setGoldenStatus] = useState('');
  const [goldenSources, setGoldenSources] = useState<{ searchConsole: string; googleAds: string; searchConsoleMessage?: string; googleAdsMessage?: string }>({ searchConsole: 'not_configured', googleAds: 'not_configured' });
  const [goldenCountry, setGoldenCountry] = useState('');
  const [goldenCity, setGoldenCity] = useState('');
  const [goldenCategory, setGoldenCategory] = useState('');
  const [goldenWeights, setGoldenWeights] = useState<GoldenWeights>({ impressions: 35, ctr: 25, position: 25, cpc: 15 });
  const [searchInsightDays, setSearchInsightDays] = useState<7 | 15 | 30 | 60 | 90>(30);
  const [searchInsights, setSearchInsights] = useState<SearchInsightRow[]>([]);
  const [searchInsightStatus, setSearchInsightStatus] = useState('');
  const [growthInsightDays, setGrowthInsightDays] = useState<7 | 15 | 30 | 60 | 90>(7);
  const [growthInsights, setGrowthInsights] = useState<GrowthInsightPayload | null>(null);
  const [growthInsightStatus, setGrowthInsightStatus] = useState('');
  const [growthTab, setGrowthTab] = useState<'golden' | 'workspace'>('golden');
  const [workspaceTab, setWorkspaceTab] = useState<'write' | 'data' | 'seo' | 'preview'>('write');
  const [structuredDraft, setStructuredDraft] = useState<StructuredDraft | null>(null);
  const [seoTitle, setSeoTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [seoTags, setSeoTags] = useState('');
  const [imageBrief, setImageBrief] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postSummary, setPostSummary] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postImage, setPostImage] = useState('');
  const [postImageUrls, setPostImageUrls] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [postSaving, setPostSaving] = useState(false);
  const masterUserId = user?.id && isMasterUser(user) ? user.id : undefined;

  const load = async () => {
    const token = await getFreshSessionToken();
    if (!token || !isMasterUser(user)) return;
    setLoading(true);
    const [nextProfiles, nextDeposits, nextWithdrawals, nextTransfers, nextSettings, nextSiteStats, nextOnlineCount, nextSafetyReports, nextModerationRows] = await Promise.all([
      listDocuments<PortalUser>('profiles', token).catch(() => []),
      listDocuments<RequestRow>('depositRequests', token).catch(() => []),
      listDocuments<RequestRow>('withdrawalRequests', token).catch(() => []),
      listDocuments<RequestRow>('transferRequests', token).catch(() => []),
      listDocuments<WalletSettings>('adminSettings', token).catch(() => []),
      getSiteStats().catch(() => ({ today: 0, month: 0, total: 0 })),
      getOnlineCount().catch(() => 0),
      listDocuments<SafetyReportRow>('safetyReports', token).catch(() => []),
      listDocuments<ModerationRow>('accountModeration', token).catch(() => []),
    ]);
    const wallet: WalletSettings = nextSettings.find((item) => item.id === 'wallet') || { depositAddress: MASTER_DEPOSIT_ADDRESS, network: USDT_NETWORK };
    setProfiles(nextProfiles);
    setDeposits(nextDeposits.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    setWithdrawals(nextWithdrawals.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    setTransfers(nextTransfers.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    setSettings({ ...wallet, network: USDT_NETWORK });
    setSiteStats(nextSiteStats);
    setOnlineCount(nextOnlineCount);
    setSafetyReports(nextSafetyReports.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    setModerationRows(nextModerationRows);
    setAddress(wallet.depositAddress || MASTER_DEPOSIT_ADDRESS);
    const contentSettings = await getDocument<ContentSourceSettings>('adminSettings', 'contentSources', token).catch(() => null);
    setDisabledSourceIds(contentSettings?.disabledSourceIds || []);
    setContentSettingsLoaded(true);
    setLoading(false);
  };
  const loadEffect = useEffectEvent(load);

  const loadKeywordAnalytics = async (days = analyticsDays) => {
    const sessionToken = await getFreshSessionToken();
    if (!sessionToken || !isMasterUser(user)) return;
    setKeywordStatus('Google Search Console 데이터를 불러오는 중...');
    try {
      const response = await fetch(`/api/master/search-console?days=${days}`, { cache: 'no-store', headers: { authorization: `Bearer ${sessionToken}` } });
      const payload = await response.json() as { rows?: KeywordMetricRow[]; error?: string; message?: string; dataSource?: string; cpcMessage?: string };
      if (!response.ok) throw new Error(payload.message || payload.error || '검색 데이터를 가져오지 못했습니다.');
      setKeywordRows(payload.rows || []);
      setKeywordDataSource(payload.dataSource || 'Google Search Console');
      setKeywordCpcMessage(payload.cpcMessage || '');
      setKeywordStatus(payload.rows?.length ? `${payload.rows.length.toLocaleString()}개 키워드를 확인했습니다.` : '선택한 기간에 검색 키워드가 없습니다.');
    } catch (error) {
      setKeywordRows([]);
      setKeywordDataSource('');
      setKeywordCpcMessage('');
      setKeywordStatus(error instanceof Error ? error.message : '검색 데이터를 가져오지 못했습니다.');
    }
  };
  const loadKeywordAnalyticsEffect = useEffectEvent(() => void loadKeywordAnalytics());

  const loadGoldenKeywords = async (days = analyticsDays) => {
    const sessionToken = await getFreshSessionToken();
    if (!sessionToken || !isMasterUser(user)) return;
    setGoldenStatus('Google Ads와 Search Console의 실제 키워드를 불러오는 중...');
    try {
      const response = await fetch(`/api/master/golden-keywords?days=${days}`, { cache: 'no-store', headers: { authorization: `Bearer ${sessionToken}` } });
      const payload = await response.json() as { rows?: GoldenKeywordRow[]; error?: string; sources?: typeof goldenSources; range?: { startDate?: string; endDate?: string } };
      setGoldenSources(payload.sources || { searchConsole: 'not_configured', googleAds: 'not_configured' });
      if (!response.ok && response.status !== 503) throw new Error(payload.error || 'Golden Keywords 데이터를 가져오지 못했습니다.');
      setGoldenRows(payload.rows || []);
      const range = payload.range?.startDate && payload.range?.endDate ? ` · ${payload.range.startDate} ~ ${payload.range.endDate}` : '';
      setGoldenStatus(payload.rows?.length ? `${payload.rows.length.toLocaleString()}개 실제 키워드를 확인했습니다${range}.` : payload.error || '연결된 출처에 실제 키워드가 없습니다. 데모 숫자는 표시하지 않습니다.');
    } catch (error) {
      setGoldenRows([]);
      setGoldenStatus(error instanceof Error ? error.message : 'Golden Keywords 데이터를 가져오지 못했습니다.');
    }
  };
  const loadGoldenKeywordsEffect = useEffectEvent(() => void loadGoldenKeywords());

  const loadSearchInsights = async (days = searchInsightDays) => {
    const sessionToken = await getFreshSessionToken();
    if (!sessionToken || !isMasterUser(user)) return;
    setSearchInsightStatus('포털 검색 기록을 집계하는 중...');
    try {
      const response = await fetch(`/api/master/search-insights?days=${days}`, { cache: 'no-store', headers: { authorization: `Bearer ${sessionToken}` } });
      const payload = await response.json() as { rows?: SearchInsightRow[]; total?: number; error?: string };
      if (!response.ok) throw new Error(payload.error || '검색 기록을 가져오지 못했습니다.');
      setSearchInsights(payload.rows || []);
      setSearchInsightStatus(payload.rows?.length ? `${payload.total || 0}건의 실제 검색 기록에서 상위 키워드를 집계했습니다.` : '선택한 기간에 저장된 검색 기록이 없습니다.');
    } catch (error) {
      setSearchInsights([]);
      setSearchInsightStatus(error instanceof Error ? error.message : '검색 기록을 가져오지 못했습니다.');
    }
  };
  const loadSearchInsightsEffect = useEffectEvent(() => void loadSearchInsights());

  const loadGrowthInsights = async (days = growthInsightDays) => {
    const sessionToken = await getFreshSessionToken();
    if (!sessionToken || !isMasterUser(user)) return;
    setGrowthInsightStatus('방문·세션·유입 데이터를 집계하는 중...');
    try {
      const response = await fetch(`/api/master/growth-insights?days=${days}`, { cache: 'no-store', headers: { authorization: `Bearer ${sessionToken}` } });
      const payload = await response.json() as GrowthInsightPayload;
      if (!response.ok) throw new Error(payload.error || '성장 데이터를 가져오지 못했습니다.');
      setGrowthInsights(payload);
      setGrowthInsightStatus(payload.total ? `${payload.total.toLocaleString()}건의 실제 이벤트를 집계했습니다.` : '아직 저장된 성장 이벤트가 없습니다.');
    } catch (error) {
      setGrowthInsights(null);
      setGrowthInsightStatus(error instanceof Error ? error.message : '성장 데이터를 가져오지 못했습니다.');
    }
  };
  const loadGrowthInsightsEffect = useEffectEvent(() => void loadGrowthInsights());

  useEffect(() => {
    const timer = window.setTimeout(loadKeywordAnalyticsEffect, 0);
    return () => window.clearTimeout(timer);
  }, [masterUserId]);

  useEffect(() => {
    const timer = window.setTimeout(loadGoldenKeywordsEffect, 0);
    return () => window.clearTimeout(timer);
  }, [masterUserId]);

  useEffect(() => {
    const timer = window.setTimeout(loadSearchInsightsEffect, 0);
    return () => window.clearTimeout(timer);
  }, [masterUserId]);

  useEffect(() => {
    const timer = window.setTimeout(loadGrowthInsightsEffect, 0);
    return () => window.clearTimeout(timer);
  }, [masterUserId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEffect(), 0);
    return () => window.clearTimeout(timer);
  }, [masterUserId]);

  const chooseKeyword = (row: KeywordMetricRow) => {
    setSelectedKeyword(row);
    setPostTitle(row.query);
    setPostSummary(`${row.query} 관련 검색 관심이 높은 주제입니다. ${analyticsDays}일간 노출 ${row.impressions.toLocaleString()}회, 클릭 ${row.clicks.toLocaleString()}회, 평균 CTR ${(row.ctr * 100).toFixed(1)}% 데이터를 바탕으로 독자에게 도움이 되는 내용을 정리합니다.`);
    setPostBody('');
    setStructuredDraft(null);
    setSeoTitle(row.query);
    setMetaDescription('');
    setSeoTags(row.query);
    setImageBrief('');
    setGrowthTab('workspace');
    setWorkspaceTab('write');
    setMessage('키워드를 선택했습니다. 요약을 확인한 뒤 초안을 강화하거나 직접 수정하세요.');
  };

  const chooseGoldenKeyword = (row: GoldenKeywordRow, action: 'write' | 'update' = 'write') => {
    chooseKeyword({ query: row.query, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position || 0 });
    setMessage(action === 'update' ? '선택한 키워드의 업데이트 작업 공간을 열었습니다. 게시 전 기존 내용과 사실관계를 확인하세요.' : '선택한 Golden Keyword의 작성 작업 공간을 열었습니다.');
  };

  const enhanceKeywordDraft = async () => {
    if (!selectedKeyword) return setMessage('먼저 핫 키워드 제목을 선택해주세요.');
    const sessionToken = await getFreshSessionToken();
    if (!sessionToken) return setMessage('로그인 세션이 없습니다. 다시 로그인해주세요.');
    setDraftLoading(true);
    try {
      const response = await fetch('/api/master/keyword-draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ keyword: selectedKeyword.query, summary: postSummary, metrics: selectedKeyword }),
      });
      const payload = await response.json() as { body?: string; draft?: StructuredDraft; error?: string };
      if (!response.ok) throw new Error(payload.error || 'AI 초안을 만들지 못했습니다.');
      setPostBody(payload.body || '');
      if (payload.draft) {
        setStructuredDraft(payload.draft);
        setPostTitle(payload.draft.title);
        setPostSummary(payload.draft.summary);
        setSeoTitle(payload.draft.seoTitle);
        setMetaDescription(payload.draft.metaDescription);
        setSeoTags(payload.draft.tags.join(', '));
        setImageBrief(payload.draft.imageBrief);
      }
      setMessage('초안을 만들었습니다. 사실관계와 사진 사용 권한을 확인한 뒤 게시하세요.');
    } catch (error) {
      setMessage(error instanceof Error ? `초안 강화 실패: ${error.message}` : '초안 강화에 실패했습니다.');
    } finally {
      setDraftLoading(false);
    }
  };

  const publishKeywordPost = async () => {
    const sessionToken = await getFreshSessionToken();
    if (!sessionToken || !user) return setMessage('로그인 세션이 없습니다. 다시 로그인해주세요.');
    if (!selectedKeyword || !postTitle.trim() || !postBody.trim()) return setMessage('키워드, 제목, 본문을 모두 확인해주세요.');
    const exposureResponse = await fetch('/api/master/exposure?days=7', { cache: 'no-store', headers: { authorization: `Bearer ${sessionToken}` } });
    const exposurePayload = await exposureResponse.json().catch(() => null) as { contracts?: Array<{ primaryKeyword?: string; status?: string }> } | null;
    const exposureReady = exposureResponse.ok && exposurePayload?.contracts?.some((contract) => contract.primaryKeyword?.toLocaleLowerCase() === selectedKeyword.query.toLocaleLowerCase() && ['EXPOSURE_READY', 'PUBLISHED', 'MONITORING', 'PROTECTED'].includes(String(contract.status)));
    if (!exposureReady) return setMessage('먼저 Exposure OS에서 이 키워드의 Exposure Contract를 완성하고 EXPOSURE_READY로 저장해주세요. SEO 콘텐츠는 노출 목표 없이 발행할 수 없습니다.');
    const images = [...new Set([postImage.trim(), ...postImageUrls.split(/[\n,]/).map((item) => item.trim())].filter(Boolean))].slice(0, 8);
    setPostSaving(true);
    try {
      await createDocument('posts', crypto.randomUUID(), {
        type: 'general',
        title: postTitle.trim(),
        body: postBody.trim(),
        authorId: user.id,
        author: user.name,
        country: user.country || 'Global',
        createdAt: new Date(),
        views: 0,
        likes: 0,
        comments: 0,
        keyword: selectedKeyword.query,
        searchWindowDays: analyticsDays,
         searchMetrics: selectedKeyword,
         seoTitle: seoTitle.trim(),
         metaDescription: metaDescription.trim(),
         seoTags: seoTags.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8),
         imageBrief: imageBrief.trim(),
         draftFactsToVerify: structuredDraft?.factsToVerify || [],
         image: images[0] || '',
        images,
      }, sessionToken);
      setMessage('핫 키워드 게시글을 커뮤니티에 게시했습니다.');
      setPostBody('');
      setPostImage('');
      setPostImageUrls('');
    } catch (error) {
      setMessage(error instanceof Error ? `게시 실패: ${error.message}` : '게시에 실패했습니다.');
    } finally {
      setPostSaving(false);
    }
  };

  const token = getSessionToken();
  const scoredGoldenRows = goldenRows
    .filter((row) => !goldenCountry || row.country === goldenCountry)
    .filter((row) => !goldenCity || row.city === goldenCity)
    .filter((row) => !goldenCategory || row.category === goldenCategory)
    .map((row) => ({ ...row, score: scoreGoldenKeyword(row, goldenRows, goldenWeights) }))
    .sort((a, b) => b.score - a.score || b.impressions - a.impressions);
  const goldenCountries = [...new Set(goldenRows.map((row) => row.country).filter(Boolean))].sort();
  const goldenCities = [...new Set(goldenRows.map((row) => row.city).filter(Boolean))].sort();
  const goldenCategories = [...new Set(goldenRows.map((row) => row.category).filter(Boolean))].sort();
  const selectedGoldenRow = goldenRows.find((row) => row.query === selectedKeyword?.query);
  const totalBalance = profiles.reduce((sum, profile) => sum + Number(profile.usdtBalance || 0), 0);
  const totalDeposits = deposits.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const registeredWallets = profiles.filter((profile) => Boolean(profile.walletAddress?.trim()));
  const filteredWallets = registeredWallets.filter((profile) => {
    const query = walletSearch.trim().toLocaleLowerCase('ko-KR');
    if (!query) return true;
    return [profile.name, profile.email, profile.id, profile.walletAddress, profile.walletNetwork].some((value) => String(value || '').toLocaleLowerCase('ko-KR').includes(query));
  });
  const loadWalletBalance = async (profile: PortalUser & { id: string }) => {
    const address = profile.walletAddress?.trim();
    if (!address) return;
    setWalletBalanceLoading((current) => ({ ...current, [profile.id]: true }));
    setWalletBalanceErrors((current) => ({ ...current, [profile.id]: '' }));
    try {
       const response = await fetch(`/api/tron/balance?address=${encodeURIComponent(address)}`, { cache: 'no-store', headers: { authorization: `Bearer ${await getFreshSessionToken() || ''}` } });
      const result = await response.json() as { balance?: number; syncedAt?: string; error?: string };
      if (!response.ok) throw new Error(result.error || '체인 잔고 조회 실패');
      setWalletBalances((current) => ({ ...current, [profile.id]: { balance: Number(result.balance || 0), syncedAt: result.syncedAt || new Date().toISOString() } }));
    } catch (error) {
      setWalletBalanceErrors((current) => ({ ...current, [profile.id]: error instanceof Error ? error.message : '체인 잔고 조회 실패' }));
    } finally {
      setWalletBalanceLoading((current) => ({ ...current, [profile.id]: false }));
    }
  };
  const loadAllWalletBalances = async () => {
    await Promise.all(filteredWallets.map((profile) => loadWalletBalance(profile)));
  };
  const saveSettings = async () => {
    const nextAddress = address.trim();
    if (!token) return setMessage('로그인 세션이 없습니다. 다시 로그인해주세요.');
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(nextAddress)) return setMessage('올바른 TRX 지갑 주소를 입력해주세요.');
    setSavingAction('settings');
    try {
      await mergeDocument('adminSettings', 'wallet', { depositAddress: nextAddress, network: USDT_NETWORK, updatedAt: new Date() }, token);
      setSettings({ depositAddress: nextAddress, network: USDT_NETWORK });
      setMessage('TRX 입금 주소가 서버에 저장되었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? `설정 저장 실패: ${error.message.slice(0, 120)}` : '설정 저장에 실패했습니다.');
    } finally {
      setSavingAction(null);
    }
  };
  const syncIncomingDeposits = async () => {
    if (!token || !isMasterUser(user) || syncingDeposits) return;
    setSyncingDeposits(true);
    try {
       const response = await fetch(`/api/tron/deposits?address=${encodeURIComponent(MASTER_DEPOSIT_ADDRESS)}&limit=200`, { cache: 'no-store', headers: { authorization: `Bearer ${await getFreshSessionToken() || ''}` } });
      const payload = await response.json() as { deposits?: OnchainDeposit[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'TRON 입금 내역을 가져오지 못했습니다.');
      const unmatched: OnchainDeposit[] = [];
       let pending = 0;
      for (const deposit of payload.deposits || []) {
        const profile = profiles.find((item) => item.walletAddress?.trim().toLowerCase() === deposit.from.toLowerCase());
        if (!profile) {
          unmatched.push(deposit);
          continue;
        }
        const requestId = `tron-${deposit.txHash}`;
        const existing = await getDocument<RequestRow>('depositRequests', requestId, token).catch(() => null);
        if (existing?.status === 'APPROVED' || existing?.status === 'REJECTED') continue;
         if (!existing) {
           await createDocument('depositRequests', requestId, {
            userId: profile.id,
            amount: deposit.amount,
            network: USDT_NETWORK,
            depositAddress: MASTER_DEPOSIT_ADDRESS,
            source: 'TRONCHAIN',
            sourceWalletAddress: deposit.from,
            txHash: deposit.txHash,
            status: 'PENDING',
             createdAt: new Date(deposit.blockTimestamp || Date.now()),
           }, token);
           pending += 1;
         }
         else if (existing.status === 'PENDING') pending += 1;
       }
       setUnmatchedDeposits(unmatched);
       setMessage(pending ? `${pending}건의 TRON 입금이 확인되어 서버 승인 대기 중입니다.` : '새로 확인할 TRON 입금이 없습니다.');
       if (pending) await load();
    } catch (error) {
      setMessage(error instanceof Error ? `자동 입금 확인 실패: ${error.message.slice(0, 140)}` : '자동 입금 확인에 실패했습니다.');
    } finally {
      setSyncingDeposits(false);
    }
  };
  const syncIncomingDepositsEffect = useEffectEvent(syncIncomingDeposits);
  useEffect(() => {
    if (!masterUserId || !profiles.length) return;
    const initial = window.setTimeout(() => void syncIncomingDepositsEffect(), 2_000);
    const interval = window.setInterval(() => void syncIncomingDepositsEffect(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [masterUserId, profiles.length]);
  const syncSource = async (source: ContentSource, requestedCategory?: ContentCategory) => {
    if (!token) return setMessage('로그인 세션이 없습니다. 다시 로그인해주세요.');
    const authorId = user?.id;
    if (!authorId) return setMessage('마스터 계정 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
    const statusKey = `${source.id}:${requestedCategory || 'all'}`;
    const updateSourceStatus = (status: string) => setSourceStatus((current) => ({ ...current, [source.id]: status, [statusKey]: status }));
    updateSourceStatus('확인 중...');
    try {
       if (disabledSourceIds.includes(source.id)) return;
       const query = requestedCategory ? `&category=${encodeURIComponent(requestedCategory)}` : '';
       const response = await fetch(`/api/content/preview?source=${encodeURIComponent(source.id)}${query}`);
      const data = await response.json() as SourcePayload;
      if (!response.ok) throw new Error(String(data.error || '출처를 확인하지 못했습니다.'));
      if (data.status === 'unavailable') {
         updateSourceStatus('연결 불가');
        setMessage(`${source.name}: 현재 원문 서버가 응답하지 않습니다. 원문 링크는 계속 열 수 있습니다.`);
        return;
      }
      const snapshot = { ...data, updatedAt: new Date() };
      try {
        await retryPublish(() => mergeDocument('contentSnapshots', source.id, snapshot, token));
      } catch {
        // Production may still have the old Firestore rules. Posts is the public fallback publishing channel.
          await retryPublish(() => mergeDocument('posts', `source-snapshot-${source.id}${requestedCategory ? `-${requestedCategory}` : ''}`, {
           type: requestedCategory === 'community' ? 'general' : 'news',
           sourceSnapshot: true,
           sourceId: source.id,
           sourceCategory: requestedCategory || source.categories[0] || 'news',
           title: data.title || `${source.name} · ${requestedCategory ? categoryLabels[requestedCategory] : '전체 분류'}`,
          body: data.description || source.note,
          authorId,
          author: source.name,
          country: source.region,
          createdAt: data.fetchedAt || new Date().toISOString(),
          sourceUrl: data.url || source.url,
          sourceName: source.name,
          sections: data.sections || [],
          items: data.items || [],
          image: data.image || '',
          images: data.images || [],
          verified: data.verified !== false,
        }, token));
      }
      const publishErrors: string[] = [];
       const sections = (data.sections || []).filter((section) => !requestedCategory || section.category === requestedCategory);
       const items = requestedCategory ? (data.items || []).filter((item) => !item.category || item.category === requestedCategory) : (data.items || []);
       const inferredCategory = requestedCategory || (items.find((item) => item.category)?.category as ContentCategory | undefined) || (items.length ? source.categories[0] : undefined);
       if (items.length && inferredCategory && !sections.some((section) => section.category === inferredCategory)) {
         sections.unshift({ category: inferredCategory, label: categoryLabels[inferredCategory], url: data.url || source.url, items });
      }
      for (const section of sections) {
        const curatedItems = curateSourceItems(section.items || [], section.category);
        for (const item of curatedItems) {
          const createdAt = item.publishedAt || data.fetchedAt || new Date().toISOString();
          const id = sourceItemId(source.id, section.category, item.url);
          try {
            if (section.category === 'jobs') {
              await retryPublish(() => mergeDocument('jobs', id, { title: item.title, company: item.company || source.name, location: item.location || item.country || source.region, salary: item.salary || '원문 확인', tag: item.tag || '채용', country: item.country || source.region, authorId, createdAt, sourceId: source.id, sourceCategory: 'jobs', sourceUrl: item.url, sourceName: source.name, sourceContentId: id, body: item.body || item.description || '', image: item.image || '', images: item.images || [] }, token));
            } else if (section.category === 'directory') {
              await retryPublish(() => mergeDocument('directories', id, { name: item.title, category: item.tag || source.name, desc: item.description || '공식 출처에서 확인된 정보입니다.', tel: '원문 확인', address: item.location || source.region, rating: 0, reviews: 0, country: item.country || source.region, authorId, createdAt, sourceId: source.id, sourceCategory: 'directory', sourceUrl: item.url, sourceName: source.name, sourceContentId: id, body: item.body || item.description || '', image: item.image || '', images: item.images || [] }, token));
             } else if (section.category === 'community' || section.category === 'news' || section.category === 'events') {
              await retryPublish(() => mergeDocument('posts', id, { type: section.category === 'community' ? 'general' : 'news', title: item.title, body: item.body || item.description || '상세 본문이 제공되지 않은 출처 콘텐츠입니다.', authorId, author: item.author || source.name, country: item.country || source.region, createdAt, sourceId: source.id, sourceUrl: item.url, sourceName: source.name, sourceContentId: id, image: item.image || '', images: item.images || [], sourceCategory: section.category }, token));
            }
          } catch {
            publishErrors.push(item.title);
          }
        }
      }
      const partial = publishErrors.length > 0 || data.status === 'partial';
       updateSourceStatus(partial ? '부분 확인' : '게시 완료');
       setMessage(`${source.name}${requestedCategory ? ` · ${categoryLabels[requestedCategory]}` : ''}: 카테고리를 구분해 게시했습니다${partial ? ' 일부 목록은 원문 서버 제한으로 부분 확인 상태입니다.' : '.'}`);
    } catch (error) {
      updateSourceStatus('확인 실패');
      setMessage(error instanceof Error ? `${source.name}: ${error.message.slice(0, 140)}` : `${source.name}: 확인 실패`);
    }
  };
  const syncAllSources = async () => {
    setMessage('등록된 공식·검증 출처를 순서대로 확인하고 있습니다.');
    for (const source of CONTENT_SOURCES.filter((item) => !disabledSourceIds.includes(item.id))) await syncSource(source);
    setMessage('출처 확인이 끝났습니다. 확인된 결과를 뉴스·커뮤니티·구인구직 등 원래 카테고리에 나누어 게시했습니다.');
  };
  const syncAutoSources = async () => {
    for (const source of CONTENT_SOURCES.filter((item) => item.autoImport && !disabledSourceIds.includes(item.id))) await syncSource(source);
  };
  const syncAutoSourcesEffect = useEffectEvent(syncAutoSources);
  useEffect(() => {
    if (!masterUserId || !contentSettingsLoaded) return;
    const timer = window.setTimeout(() => void syncAutoSourcesEffect(), 0);
    const interval = window.setInterval(() => void syncAutoSourcesEffect(), 30 * 60 * 1000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [contentSettingsLoaded, masterUserId]);
  const removeSource = async (sourceId: string) => {
    if (!token) return;
    const next = [...new Set([...disabledSourceIds, sourceId])];
    setSavingAction(`source-${sourceId}`);
    try {
      await mergeDocument('adminSettings', 'contentSources', { disabledSourceIds: next, updatedAt: new Date() }, token);
      setDisabledSourceIds(next);
      setMessage('선택한 출처를 목록과 자동 수집에서 제외했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '출처 삭제에 실패했습니다.');
    } finally {
      setSavingAction(null);
    }
  };
  const restoreSource = async (sourceId: string) => {
    if (!token) return;
    const next = disabledSourceIds.filter((id) => id !== sourceId);
    setSavingAction(`source-${sourceId}`);
    try {
      await mergeDocument('adminSettings', 'contentSources', { disabledSourceIds: next, updatedAt: new Date() }, token);
      setDisabledSourceIds(next);
      setMessage('출처를 다시 활성화했습니다.');
    } finally {
      setSavingAction(null);
    }
  };
  const approveDeposit = async (request: RequestRow) => {
    if (!token || request.status !== 'PENDING') return;
    setSavingAction(request.id);
    try {
      await approveDepositRequest(request.id, request.userId, user?.email || MASTER_EMAIL, token);
      setMessage(`${request.amount} USDT 승인 및 회원 잔고 반영이 완료되었습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? `승인 실패: ${error.message.slice(0, 120)}` : '입금 승인에 실패했습니다.');
    } finally {
      setSavingAction(null);
      await load();
    }
  };
  const updateRequest = async (collection: string, request: RequestRow, status: string) => {
    if (!token || request.status !== 'PENDING') return;
    setSavingAction(request.id);
    try {
      if (collection === 'depositRequests' && status === 'REJECTED') {
        await reviewDepositRequest(request.id, 'REJECTED', user?.email || MASTER_EMAIL, token);
        setMessage('입금 신청을 거절하고 서버에 기록했습니다.');
      } else {
        await mergeDocument(collection, request.id, { status, reviewedAt: new Date(), reviewedBy: user?.email || MASTER_EMAIL }, token);
        setMessage('신청 상태가 서버에 저장되었습니다.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? `처리 실패: ${error.message.slice(0, 120)}` : '신청 처리에 실패했습니다.');
    } finally {
      setSavingAction(null);
      await load();
    }
  };
  const approveTransfer = async (request: RequestRow) => {
    if (!token || request.status !== 'PENDING') return;
    setSavingAction(request.id);
    try {
      await approveTransferRequest(request.id, user?.email || MASTER_EMAIL, token);
      setMessage('송금 승인 및 양쪽 회원 잔고 반영이 완료되었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? `송금 승인 실패: ${error.message.slice(0, 120)}` : '송금 승인에 실패했습니다.');
    } finally {
      setSavingAction(null);
      await load();
    }
  };
  const rejectTransfer = async (request: RequestRow) => {
    if (!token || request.status !== 'PENDING') return;
    setSavingAction(request.id);
    try {
      await reviewTransferRequest(request.id, 'REJECTED', user?.email || MASTER_EMAIL, token);
      setMessage('송금 신청을 거절했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? `송금 거절 실패: ${error.message.slice(0, 120)}` : '송금 거절에 실패했습니다.');
    } finally {
      setSavingAction(null);
      await load();
    }
  };

  const updateSafetyModeration = async (report: SafetyReportRow, status: ModerationRow['status']) => {
    if (!token || !user) return;
    setSavingAction(`safety-${report.id}`);
    try {
      const until = status === 'suspended' ? new Date(Date.now() + 7 * 24 * 60 * 60_000) : null;
      await mergeDocument('accountModeration', report.reportedUserId, { userId: report.reportedUserId, status, reason: `신고 ${report.id} 검토 결과`, until, updatedAt: new Date(), updatedBy: user.email }, token);
      await mergeDocument('safetyReports', report.id, { status: 'resolved', reviewedAt: new Date(), reviewedBy: user.email }, token);
      setMessage(`${report.reportedUserId.slice(0, 10)} 계정에 ${status === 'banned' ? '영구 정지' : status === 'suspended' ? '7일 정지' : '정상화'}를 적용했습니다.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? `안전 조치 실패: ${error.message.slice(0, 140)}` : '안전 조치에 실패했습니다.');
    } finally {
      setSavingAction(null);
    }
  };

  if (!isMasterUser(user)) return <div className="mx-auto max-w-xl px-4 py-24 text-center"><ShieldAlert className="mx-auto mb-4 text-rose-400" size={42} /><h1 className="text-2xl font-black">마스터 전용 페이지</h1><p className="mt-3 text-sm text-slate-500">관리자 계정으로 로그인해야 접근할 수 있습니다.</p></div>;

  return (
       <div className="category-page master-page mx-auto max-w-7xl px-4 py-8 text-slate-100">
         <header className="category-header"><div className="category-heading"><p className="text-xs font-black uppercase tracking-[0.28em] text-amber-500">Master Operations</p><h1 className="mt-2 text-4xl font-black">운영자 센터</h1><p className="mt-2 text-sm text-slate-500">회원 잔고·입출금 신청·입금 지갑 설정을 서버 기준으로 관리합니다.</p></div><div className="flex flex-wrap items-center gap-2"><Link href="/admin/growth/exposure/" className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 text-sm font-black text-slate-950">Exposure OS →</Link></div></header>
         <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100"><strong>게시 기준:</strong> 뉴스는 뉴스로, 커뮤니티는 커뮤니티로만 게시됩니다. 아래 출처의 지원 카테고리를 확인한 뒤 전체 확인 또는 원하는 카테고리만 확인하세요.</div>
         <section className="mb-6 overflow-hidden rounded-3xl border border-fuchsia-200/20 bg-[#0e1324] shadow-2xl shadow-fuchsia-950/10">
           <div className="border-b border-white/10 bg-[radial-gradient(circle_at_8%_0%,rgba(217,70,239,.18),transparent_32%),radial-gradient(circle_at_92%_0%,rgba(45,212,191,.12),transparent_28%)] p-5">
             <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-300">Admin Growth · Real Data Only</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-white"><Database size={20} className="text-fuchsia-300" /> Hot Keywords 100</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">Google Ads와 Search Console에서 실제로 반환된 키워드만 최대 100개 표시합니다. Search Console은 사이트 노출 키워드이고, Google Ads-only 행은 아직 GYOPO 페이지에 매핑되지 않은 후보입니다. 연결되지 않은 지표와 CPC는 빈 값으로 남깁니다.</p></div>
               <div className="flex rounded-xl border border-white/10 bg-black/20 p-1" role="tablist" aria-label="Growth menu"><button type="button" role="tab" aria-selected={growthTab === 'golden'} onClick={() => setGrowthTab('golden')} className={`rounded-lg px-3 py-2 text-xs font-black ${growthTab === 'golden' ? 'bg-fuchsia-300 text-slate-950' : 'text-slate-400'}`}>Golden Keywords</button><button type="button" role="tab" aria-selected={growthTab === 'workspace'} onClick={() => setGrowthTab('workspace')} className={`rounded-lg px-3 py-2 text-xs font-black ${growthTab === 'workspace' ? 'bg-teal-300 text-slate-950' : 'text-slate-400'}`}>글쓰기 Workspace</button></div>
             </div>
           </div>
           {growthTab === 'golden' ? <div className="space-y-4 p-5">
             <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-1.5">{SEARCH_CONSOLE_WINDOWS.map((days) => <button key={days} type="button" onClick={() => { setAnalyticsDays(days); void loadGoldenKeywords(days); }} className={`rounded-lg px-2.5 py-2 text-[11px] font-black ${analyticsDays === days ? 'bg-fuchsia-300 text-slate-950' : 'bg-white/5 text-slate-400 hover:bg-fuchsia-300/10 hover:text-white'}`}>{days}일</button>)}</div><div className="flex flex-wrap gap-2 text-[10px] font-black"><span className={`rounded-full px-2.5 py-1 ${goldenSources.searchConsole === 'connected' ? 'bg-emerald-300/15 text-emerald-200' : 'bg-white/10 text-slate-500'}`}>Search Console {goldenSources.searchConsole === 'connected' ? '연결됨' : '미연결'}</span><span className={`rounded-full px-2.5 py-1 ${goldenSources.googleAds === 'connected' ? 'bg-emerald-300/15 text-emerald-200' : 'bg-white/10 text-slate-500'}`}>Google Ads {goldenSources.googleAds === 'connected' ? '연결됨' : '미연결'}</span></div></div>
             <div className="grid gap-2 sm:grid-cols-3"><label className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">국가<select value={goldenCountry} onChange={(event) => setGoldenCountry(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs font-bold text-white"><option value="">Global · 전체 국가</option>{goldenCountries.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">도시<select value={goldenCity} onChange={(event) => setGoldenCity(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs font-bold text-white"><option value="">전체 도시</option>{goldenCities.map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">카테고리<select value={goldenCategory} onChange={(event) => setGoldenCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs font-bold text-white"><option value="">전체 카테고리</option>{goldenCategories.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
             <div className="rounded-2xl border border-white/10 bg-black/15 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-black text-white"><SlidersHorizontal size={14} className="text-fuchsia-300" /> Opportunity Score 가중치 <span className="text-[10px] font-normal text-slate-500">0 이상이면 적용되며, 사용 가능한 실제 지표만 계산합니다.</span></div><div className="grid gap-2 sm:grid-cols-4">{([['impressions', '노출'], ['ctr', 'CTR'], ['position', '검색 위치'], ['cpc', 'CPC']] as const).map(([key, label]) => <label key={key} className="text-[10px] font-bold text-slate-500">{label}<input type="number" min="0" max="100" value={goldenWeights[key]} onChange={(event) => setGoldenWeights((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value) || 0) }))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-xs font-black text-white" /></label>)}</div></div>
             {goldenStatus && <p className="rounded-xl bg-fuchsia-300/10 px-3 py-2 text-xs font-bold text-fuchsia-100" role="status">{goldenStatus}</p>}
              {(goldenSources.searchConsoleMessage || goldenSources.googleAdsMessage) && <p className="text-[11px] leading-5 text-amber-200/80">{goldenSources.searchConsoleMessage || goldenSources.googleAdsMessage}</p>}
              {scoredGoldenRows.length > 50 && <div className="rounded-2xl border border-amber-300/15 bg-amber-300/5 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-[.14em] text-amber-200">Additional candidates · 51–100</span><span className="text-[10px] text-slate-500">사이트 매핑 없음 후보 포함</span></div><div className="flex flex-wrap gap-1.5">{scoredGoldenRows.slice(50, 100).map((row) => <button key={`${row.query}-${row.country}-${row.category}`} type="button" onClick={() => chooseGoldenKeyword(row)} className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold ${row.siteCoverage === 'NOT_MAPPED' ? 'border-amber-300/20 text-amber-100' : 'border-white/10 text-slate-300'}`}>{row.query}</button>)}</div></div>}
             {scoredGoldenRows.length ? <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[880px] text-left text-xs"><thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">등급</th><th className="p-3">키워드</th><th className="p-3">출처</th><th className="p-3 text-right">Score</th><th className="p-3 text-right">클릭</th><th className="p-3 text-right">노출</th><th className="p-3 text-right">CPC</th><th className="p-3 text-right">작업</th></tr></thead><tbody>{scoredGoldenRows.slice(0, 50).map((row) => { const label = row.score >= 75 ? 'GOLDEN' : row.score >= 55 ? 'HOT' : 'WATCH'; return <tr key={`${row.query}-${row.country}-${row.category}`} className="border-b border-white/5 last:border-0"><td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${label === 'GOLDEN' ? 'bg-amber-300 text-slate-950' : label === 'HOT' ? 'bg-rose-300 text-slate-950' : 'bg-white/10 text-slate-400'}`}>{label}</span></td><td className="max-w-[18rem] p-3"><button type="button" onClick={() => chooseGoldenKeyword(row)} className="text-left font-black text-white hover:text-fuchsia-200">{row.query}</button><small className="mt-1 block truncate text-[10px] text-slate-500">{[row.country, row.city, row.category].filter(Boolean).join(' · ') || 'Global'}</small></td><td className="p-3 text-[10px] text-slate-400">{row.sources.join(' + ')}</td><td className="p-3 text-right font-black text-fuchsia-200">{row.score}</td><td className="p-3 text-right text-slate-300">{row.clicks.toLocaleString()}</td><td className="p-3 text-right text-slate-300">{row.impressions.toLocaleString()}</td><td className="p-3 text-right text-slate-300">{row.cpc === null ? '—' : `$${row.cpc.toFixed(2)}`}</td><td className="p-3 text-right"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => chooseGoldenKeyword(row, 'write')} className="inline-flex items-center gap-1 rounded-lg bg-teal-300 px-2 py-1.5 text-[10px] font-black text-slate-950"><FilePenLine size={12} /> 글쓰기</button><button type="button" onClick={() => chooseGoldenKeyword(row, 'update')} className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-300/30 px-2 py-1.5 text-[10px] font-black text-fuchsia-100"><RefreshCw size={11} /> 업데이트</button></div></td></tr>; })}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center"><Database className="mx-auto mb-3 text-slate-600" size={28} /><p className="text-sm font-black text-slate-400">실제 연결 데이터가 없습니다.</p><p className="mt-1 text-xs text-slate-600">Google Ads 또는 Search Console을 연결하면 반환된 키워드만 표시됩니다.</p></div>}
           </div> : <div className="p-5">
             <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-300">Editorial Workspace</p><h3 className="mt-1 text-xl font-black text-white">{selectedKeyword?.query || '키워드를 먼저 선택하세요'}</h3></div>{selectedGoldenRow?.page && <a href={selectedGoldenRow.page} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">원문 보기 <ExternalLink size={12} /></a>}</div>
             <div className="mb-4 flex flex-wrap gap-1.5 border-b border-white/10 pb-3" role="tablist" aria-label="게시글 workspace"><button type="button" onClick={() => setWorkspaceTab('write')} className={`rounded-lg px-3 py-2 text-xs font-black ${workspaceTab === 'write' ? 'bg-teal-300 text-slate-950' : 'text-slate-400'}`}>작성</button><button type="button" onClick={() => setWorkspaceTab('data')} className={`rounded-lg px-3 py-2 text-xs font-black ${workspaceTab === 'data' ? 'bg-fuchsia-300 text-slate-950' : 'text-slate-400'}`}>자료</button><button type="button" onClick={() => setWorkspaceTab('seo')} className={`rounded-lg px-3 py-2 text-xs font-black ${workspaceTab === 'seo' ? 'bg-amber-300 text-slate-950' : 'text-slate-400'}`}>SEO</button><button type="button" onClick={() => setWorkspaceTab('preview')} className={`rounded-lg px-3 py-2 text-xs font-black ${workspaceTab === 'preview' ? 'bg-white text-slate-950' : 'text-slate-400'}`}>미리보기</button></div>
             {!selectedKeyword ? <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-xs text-slate-500">Golden Keywords에서 작성 또는 업데이트할 키워드를 선택하세요.</div> : workspaceTab === 'write' ? <div className="grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]"><div><label className="text-xs font-bold text-slate-400">운영자 요약<textarea value={postSummary} onChange={(event) => setPostSummary(event.target.value)} rows={6} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-teal-300/50" /></label><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500"><div className="rounded-xl bg-white/5 p-2"><b className="block text-sm text-white">{selectedKeyword.clicks.toLocaleString()}</b>클릭</div><div className="rounded-xl bg-white/5 p-2"><b className="block text-sm text-white">{(selectedKeyword.ctr * 100).toFixed(1)}%</b>CTR</div><div className="rounded-xl bg-white/5 p-2"><b className="block text-sm text-white">{selectedKeyword.position ? selectedKeyword.position.toFixed(1) : '—'}</b>평균 위치</div></div></div><div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="게시글 제목" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-teal-300/50" /><button type="button" onClick={() => void enhanceKeywordDraft()} disabled={draftLoading} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-300 px-3 py-2.5 text-[11px] font-black text-slate-950 disabled:opacity-50"><WandSparkles size={13} /> {draftLoading ? '생성 중...' : 'DeepSeek 초안'}</button></div><textarea value={postBody} onChange={(event) => setPostBody(event.target.value)} placeholder="본문을 직접 작성하거나 구조화 초안을 생성하세요." rows={9} className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-white outline-none focus:border-teal-300/50" /><div className="mt-1 text-right text-[10px] text-slate-500">{postBody.length.toLocaleString()} / 1,000자 권장</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={postImage} onChange={(event) => setPostImage(event.target.value)} placeholder="대표 이미지 URL (사용 권한 확인)" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none" /><textarea value={postImageUrls} onChange={(event) => setPostImageUrls(event.target.value)} placeholder="추가 이미지 URL" rows={2} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none" /></div><button type="button" onClick={() => void publishKeywordPost()} disabled={postSaving || !postTitle.trim() || !postBody.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-300 py-2.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><FilePenLine size={15} /> {postSaving ? '게시 중...' : '커뮤니티에 게시'}</button></div></div> : workspaceTab === 'data' ? <div className="grid gap-3 sm:grid-cols-2">{selectedGoldenRow ? <>{[['출처', selectedGoldenRow.sources.join(' + ')], ['검색 기간', `${analyticsDays}일`], ['클릭', selectedGoldenRow.clicks.toLocaleString()], ['노출', selectedGoldenRow.impressions.toLocaleString()], ['CTR', `${(selectedGoldenRow.ctr * 100).toFixed(1)}%`], ['평균 위치', selectedGoldenRow.position === null ? '미제공' : selectedGoldenRow.position.toFixed(1)], ['CPC', selectedGoldenRow.cpc === null ? '미제공' : `$${selectedGoldenRow.cpc.toFixed(2)}`], ['범위', [selectedGoldenRow.country, selectedGoldenRow.city, selectedGoldenRow.category].filter(Boolean).join(' · ') || 'Global']].map(([label, value]) => <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="block text-[10px] font-bold text-slate-500">{label}</span><b className="mt-1 block text-sm text-white">{value}</b></div>)}</> : <p className="text-xs text-slate-500">선택된 키워드의 실제 자료가 없습니다.</p>}</div> : workspaceTab === 'seo' ? <div className="grid gap-3 lg:grid-cols-2"><label className="text-xs font-bold text-slate-400">SEO 제목<input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs font-bold text-slate-400">메타 설명<textarea value={metaDescription} onChange={(event) => setMetaDescription(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs font-bold text-slate-400">태그<input value={seoTags} onChange={(event) => setSeoTags(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white" /></label><label className="text-xs font-bold text-slate-400">이미지 방향<textarea value={imageBrief} onChange={(event) => setImageBrief(event.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white" /></label>{structuredDraft?.factsToVerify.length ? <div className="lg:col-span-2 rounded-xl bg-amber-300/10 p-3 text-xs leading-5 text-amber-100"><b>게시 전 확인할 사실</b><ul className="mt-1 list-disc pl-4">{structuredDraft.factsToVerify.map((fact) => <li key={fact}>{fact}</li>)}</ul></div> : null}</div> : <article className="mx-auto max-w-2xl rounded-2xl border border-white/10 bg-white p-6 text-slate-900"><p className="text-[10px] font-black uppercase tracking-[.18em] text-fuchsia-600">GYOPO Community Preview</p><h3 className="mt-2 text-2xl font-black">{postTitle || '제목을 입력하세요'}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{postSummary || '요약이 표시됩니다.'}</p><div className="my-5 h-px bg-slate-200" /><p className="whitespace-pre-wrap text-sm leading-7">{postBody || '본문이 표시됩니다.'}</p></article>}
           </div>}
          </section>
          <section className="mb-6 rounded-3xl border border-cyan-200/20 bg-[#0e1726] p-5 shadow-2xl shadow-cyan-950/10">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">Portal Search · First-party data</p><h2 className="mt-1 flex items-center gap-2 text-xl font-black text-white"><Search size={19} className="text-cyan-300" /> 포털 검색 기록</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">GYOPO 안에서 실제로 입력된 검색어를 AI 질문과 핫키워드로 나누고, 국가·방문자 유형별로 집계합니다. 외부 검색량이나 광고 수치를 대신하지 않습니다.</p></div>
              <div className="flex flex-wrap items-center gap-1.5">{([7, 15, 30, 60, 90] as const).map((days) => <button key={days} type="button" onClick={() => { setSearchInsightDays(days); void loadSearchInsights(days); }} className={`rounded-lg px-2.5 py-2 text-[11px] font-black ${searchInsightDays === days ? 'bg-cyan-300 text-slate-950' : 'bg-white/5 text-slate-400 hover:bg-cyan-300/10 hover:text-white'}`}>{days}일</button>)}</div>
            </div>
            {searchInsightStatus && <p className="mb-4 rounded-xl bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-100" role="status">{searchInsightStatus}</p>}
            {searchInsights.length > 0 ? <div className="overflow-x-auto rounded-2xl border border-white/10"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">검색어</th><th className="p-3 text-right">횟수</th><th className="p-3 text-right">AI</th><th className="p-3 text-right">포털</th><th className="p-3">주요 국가</th><th className="p-3">방문자 유형</th><th className="p-3">최근 검색</th></tr></thead><tbody>{searchInsights.map((row) => <tr key={row.query} className="border-b border-white/5 last:border-0"><td className="p-3 font-black text-white">{row.query}</td><td className="p-3 text-right font-black text-cyan-200">{row.count.toLocaleString()}</td><td className="p-3 text-right text-slate-300">{row.ai.toLocaleString()}</td><td className="p-3 text-right text-slate-300">{row.portal.toLocaleString()}</td><td className="p-3 text-slate-400">{row.countries[0] ? `${row.countries[0].value} (${row.countries[0].count})` : '—'}</td><td className="p-3 text-slate-400">{row.audiences.map((item) => `${item.value} ${item.count}`).join(' · ') || '—'}</td><td className="p-3 text-[10px] text-slate-500">{row.lastSearchedAt ? new Date(row.lastSearchedAt).toLocaleString('ko-KR') : '—'}</td></tr>)}</tbody></table></div> : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-slate-500">아직 저장된 포털 검색 기록이 없습니다. 사용자가 검색하면 이곳에 실제 기록이 표시됩니다.</div>}
           </section>
           <section className="mb-6 rounded-3xl border border-emerald-200/20 bg-[#0e1c1a] p-5 shadow-2xl shadow-emerald-950/10">
             <div className="mb-4 flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-300">Growth Funnel · First-party data</p><h2 className="mt-1 flex items-center gap-2 text-xl font-black text-white"><BarChart3 size={19} className="text-emerald-300" /> 방문·전환 퍼널</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">개인정보 대신 익명 방문자·세션 ID로 페이지 방문, 검색, 로그인 화면과 온보딩 완료를 집계합니다.</p></div><div className="flex flex-wrap items-center gap-1.5">{([7, 15, 30, 60, 90] as const).map((days) => <button key={days} type="button" onClick={() => { setGrowthInsightDays(days); void loadGrowthInsights(days); }} className={`rounded-lg px-2.5 py-2 text-[11px] font-black ${growthInsightDays === days ? 'bg-emerald-300 text-slate-950' : 'bg-white/5 text-slate-400 hover:bg-emerald-300/10 hover:text-white'}`}>{days}일</button>)}</div></div>
             {growthInsightStatus && <p className="mb-4 rounded-xl bg-emerald-300/10 px-3 py-2 text-xs font-bold text-emerald-100" role="status">{growthInsightStatus}</p>}
             {growthInsights ? <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-white/[.05] p-4"><span className="text-[10px] font-bold text-slate-500">이벤트</span><b className="mt-1 block text-2xl text-white">{growthInsights.total.toLocaleString()}</b></div><div className="rounded-2xl bg-white/[.05] p-4"><span className="text-[10px] font-bold text-slate-500">고유 방문자</span><b className="mt-1 block text-2xl text-emerald-200">{growthInsights.uniqueVisitors.toLocaleString()}</b></div><div className="rounded-2xl bg-white/[.05] p-4"><span className="text-[10px] font-bold text-slate-500">세션</span><b className="mt-1 block text-2xl text-cyan-200">{growthInsights.sessions.toLocaleString()}</b></div><div className="rounded-2xl border border-white/10 p-4 sm:col-span-3"><div className="grid gap-4 md:grid-cols-4">{[['이벤트', growthInsights.events], ['경로', growthInsights.paths], ['국가', growthInsights.countries], ['유입', growthInsights.sources]].map(([label, rows]) => <div key={String(label)}><h3 className="mb-2 text-[10px] font-black uppercase tracking-[.16em] text-slate-500">{String(label)}</h3><div className="space-y-1.5">{(rows as GrowthInsight[]).slice(0, 5).map((row) => <div key={`${label}-${row.value}`} className="flex justify-between gap-3 text-xs"><span className="truncate text-slate-300">{row.value}</span><b className="text-emerald-200">{row.count.toLocaleString()}</b></div>)}{(rows as GrowthInsight[]).length === 0 && <span className="text-xs text-slate-600">데이터 없음</span>}</div></div>)}</div></div></div> : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-slate-500">사용자 방문과 검색이 발생하면 실제 퍼널 데이터가 표시됩니다.</div>}
           </section>
           <section className="master-legacy-keyword-section mb-6 rounded-3xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-300/20 dark:bg-[#10182b]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Search Console · Editorial</p>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-black"><BarChart3 size={19} className="text-violet-300" /> 핫 키워드 분석과 게시글 작성</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Google Search Console의 실제 노출·클릭 데이터를 기간별로 확인하고, 키워드를 눌러 커뮤니티 초안으로 연결합니다. 숫자와 원문은 게시 전에 운영자가 확인합니다.</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {SEARCH_CONSOLE_WINDOWS.map((days) => <button key={days} type="button" onClick={() => { setAnalyticsDays(days); void loadKeywordAnalytics(days); }} className={`rounded-lg px-2.5 py-2 text-[11px] font-black ${analyticsDays === days ? 'bg-violet-300 text-slate-950' : 'bg-white/5 text-slate-400 hover:bg-violet-300/10 hover:text-violet-100'}`}>{days}일</button>)}
              
            </div>
          </div>
          {keywordStatus && <p className="mb-4 rounded-xl bg-violet-300/10 px-3 py-2 text-xs font-bold text-violet-100" role="status">{keywordStatus}</p>}
          {keywordDataSource && <p className="mb-3 text-[11px] text-slate-500">출처: {keywordDataSource} · {analyticsDays}일간 · 제목을 누르면 게시글 작성으로 이어집니다.</p>}
          {keywordRows.length > 0 ? <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-white/10 bg-white/5 text-[10px] uppercase tracking-[.12em] text-slate-500"><tr><th className="p-3">핫 키워드</th><th className="p-3 text-right">클릭</th><th className="p-3 text-right">노출</th><th className="p-3 text-right">CTR</th><th className="p-3 text-right">평균 위치</th><th className="p-3 text-right">작업</th></tr></thead>
              <tbody>{keywordRows.slice(0, 100).map((row) => <tr key={row.query} className={`border-b border-white/5 last:border-0 ${selectedKeyword?.query === row.query ? 'bg-violet-300/10' : ''}`}>
                <td className="max-w-[20rem] p-3"><button type="button" onClick={() => chooseKeyword(row)} className="text-left font-black text-violet-100 hover:text-white">{row.query}</button></td>
                <td className="p-3 text-right text-slate-300">{row.clicks.toLocaleString()}</td><td className="p-3 text-right text-slate-300">{row.impressions.toLocaleString()}</td><td className="p-3 text-right text-slate-300">{(row.ctr * 100).toFixed(1)}%</td><td className="p-3 text-right text-slate-300">{row.position.toFixed(1)}</td>
                <td className="p-3 text-right"><button type="button" onClick={() => chooseKeyword(row)} className="inline-flex items-center gap-1 rounded-lg bg-violet-300 px-2 py-1.5 text-[10px] font-black text-slate-950"><FilePenLine size={12} /> 글 작성</button></td>
              </tr>)}</tbody>
            </table>
          </div> : <div className="rounded-2xl border border-dashed border-white/10 px-4 py-7 text-center text-xs text-slate-500">Search Console 연결 후 실제 검색 키워드가 표시됩니다. 현재 데모 숫자는 만들지 않습니다.</div>}
          {keywordCpcMessage && <p className="mt-3 text-[11px] leading-5 text-amber-200/80">참고: {keywordCpcMessage}</p>}
          {selectedKeyword && <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div>
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-teal-300">Selected Keyword</p><h3 className="mt-1 text-lg font-black text-white">{selectedKeyword.query}</h3></div><span className="rounded-full bg-violet-300/10 px-2.5 py-1 text-[10px] font-black text-violet-100">노출 {selectedKeyword.impressions.toLocaleString()}</span></div>
              <label className="mt-4 block text-xs font-bold text-slate-400">사용자 요약<input value={postSummary} onChange={(event) => setPostSummary(event.target.value)} placeholder="독자에게 전달할 핵심 요약을 입력하세요." className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/50" /></label>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500"><div className="rounded-xl bg-white/5 p-2"><b className="block text-sm text-white">{selectedKeyword.clicks.toLocaleString()}</b>클릭</div><div className="rounded-xl bg-white/5 p-2"><b className="block text-sm text-white">{(selectedKeyword.ctr * 100).toFixed(1)}%</b>CTR</div><div className="rounded-xl bg-white/5 p-2"><b className="block text-sm text-white">{selectedKeyword.position.toFixed(1)}</b>평균 위치</div></div>
            </div>
            <div className="rounded-2xl bg-white/[.04] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-black"><FilePenLine size={16} className="text-teal-300" /> 게시글 초안</h3><button type="button" onClick={() => void enhanceKeywordDraft()} disabled={draftLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-teal-300 px-3 py-2 text-[11px] font-black text-slate-950 disabled:opacity-50"><WandSparkles size={13} /> {draftLoading ? '강화 중...' : 'AI로 초안 강화'}</button></div>
              <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="게시글 제목" className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-teal-300/50" />
              <textarea value={postBody} onChange={(event) => setPostBody(event.target.value)} placeholder="본문을 직접 작성하거나 초안 강화 버튼을 누르세요." rows={8} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm leading-6 text-white outline-none focus:border-teal-300/50" />
              <div className="mt-1 text-right text-[10px] text-slate-500">{postBody.length.toLocaleString()} / 1,000자 권장</div>
              <label className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-2.5 text-xs text-slate-400"><ImagePlus size={15} className="shrink-0 text-teal-300" /><input value={postImage} onChange={(event) => setPostImage(event.target.value)} placeholder="대표 이미지 URL (직접 사용 권한이 있는 주소)" className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none" /></label>
              <textarea value={postImageUrls} onChange={(event) => setPostImageUrls(event.target.value)} placeholder="추가 이미지 URL (줄바꿈 또는 쉼표로 구분)" rows={2} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-xs text-white outline-none focus:border-teal-300/50" />
              <button type="button" onClick={() => void publishKeywordPost()} disabled={postSaving || !postTitle.trim() || !postBody.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-300 py-2.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"><FilePenLine size={15} /> {postSaving ? '게시 중...' : '커뮤니티에 게시'}</button>
            </div>
          </div>}
        </section>
        <section className="mb-6 rounded-3xl border border-cyan-200 bg-white p-5 shadow-sm dark:border-cyan-300/20 dark:bg-[#10182b]"><div className="mb-3"><h2 className="font-black">카테고리별 빠른 게시</h2><p className="mt-1 text-xs text-slate-500">버튼에 표시된 분류만 가져와 해당 메뉴에 게시합니다.</p></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{CONTENT_SOURCES.filter((source) => !disabledSourceIds.includes(source.id)).map((source) => <div key={source.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5"><div className="truncate text-xs font-black">{source.name}</div><div className="mt-2 flex flex-wrap gap-1.5">{source.categories.map((category) => <button key={category} onClick={() => void syncSource(source, category)} disabled={sourceStatus[`${source.id}:${category}`] === '확인 중...'} className="rounded-lg border border-cyan-200 px-2 py-1 text-[10px] font-black text-cyan-700 disabled:opacity-50 dark:border-cyan-300/20 dark:text-cyan-200">{sourceStatus[`${source.id}:${category}`] || `${categoryLabels[category]}만 게시`}</button>)}</div></div>)}</div></section>
       <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-7"><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-300/20 dark:bg-emerald-300/10"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">전체 회원</p><p className="mt-2 text-3xl font-black">{profiles.length}</p></div><div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-300/20 dark:bg-cyan-300/10"><p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">회원 잔고 합계</p><p className="mt-2 text-3xl font-black">{totalBalance.toFixed(2)} USDT</p></div><div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-300/20 dark:bg-amber-300/10"><p className="text-xs font-bold text-amber-700 dark:text-amber-300">승인 입금 합계</p><p className="mt-2 text-3xl font-black">{totalDeposits.toFixed(2)} USDT</p></div><div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5"><p className="text-xs font-bold text-slate-500">오늘 방문</p><p className="mt-2 text-3xl font-black">{siteStats.today.toLocaleString()}</p></div><div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5"><p className="text-xs font-bold text-slate-500">이번 달</p><p className="mt-2 text-3xl font-black">{siteStats.month.toLocaleString()}</p></div><div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-white/5"><p className="text-xs font-bold text-slate-500">누적 방문</p><p className="mt-2 text-3xl font-black">{siteStats.total.toLocaleString()}</p></div><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-300/20 dark:bg-emerald-300/10"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">현재 접속</p><p className="mt-2 text-3xl font-black">{onlineCount.toLocaleString()}</p></div></div>
       <section className="mb-6 rounded-3xl border border-teal-200 bg-white p-5 shadow-sm dark:border-teal-300/20 dark:bg-[#10182b]"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">실제 출처 뉴스 허브</h2><p className="mt-1 text-xs text-slate-500">운영자가 확인한 출처의 홈페이지 정보만 Firestore에 저장합니다. 검증되지 않은 국가는 자동 게시하지 않습니다.</p></div><button onClick={() => void syncAllSources()} className="rounded-xl bg-teal-400 px-4 py-2 text-xs font-black text-slate-950">전체 출처 확인</button></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{CONTENT_SOURCES.filter((source) => !disabledSourceIds.includes(source.id)).map((source) => <div key={source.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 dark:border-white/5 dark:bg-white/5"><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{source.name}</div><div className="mt-1 truncate text-[10px] text-slate-500">{source.region} · {source.trust === 'official' ? '공식' : '검증'}</div></div><button onClick={() => void syncSource(source)} disabled={sourceStatus[source.id] === '확인 중...'} className="shrink-0 rounded-lg border border-teal-200 px-2.5 py-1.5 text-[10px] font-black text-teal-700 disabled:opacity-50 dark:border-teal-300/20 dark:text-teal-200">{sourceStatus[source.id] || '확인'}</button><button onClick={() => void removeSource(source.id)} disabled={savingAction === `source-${source.id}`} className="shrink-0 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[10px] font-black text-rose-600 disabled:opacity-50 dark:border-rose-300/20 dark:text-rose-200">삭제</button></div>)}</div>{disabledSourceIds.length > 0 && <div className="mt-4 rounded-2xl border border-dashed border-slate-200 p-3 dark:border-white/10"><p className="text-xs font-bold text-slate-500">제외된 출처</p><div className="mt-2 flex flex-wrap gap-2">{CONTENT_SOURCES.filter((source) => disabledSourceIds.includes(source.id)).map((source) => <button key={source.id} onClick={() => void restoreSource(source.id)} disabled={savingAction === `source-${source.id}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 hover:border-teal-300 hover:text-teal-300 disabled:opacity-50">{source.name} 복원</button>)}</div></div>}<p className="mt-4 text-xs leading-5 text-amber-700 dark:text-amber-200">출처 확인 대기: {REVIEW_REGIONS.map(regionLabel).join(' · ')}. 실제 공식 사이트를 확인하기 전에는 자동 게시하지 않습니다.</p></section>
       <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-2" role="tablist" aria-label="마스터 사용자 보기">
         <button type="button" role="tab" aria-selected={masterTab === 'overview'} onClick={() => setMasterTab('overview')} className={`rounded-xl px-4 py-2 text-xs font-black ${masterTab === 'overview' ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>회원 잔고 요약</button>
         <button type="button" role="tab" aria-selected={masterTab === 'wallets'} onClick={() => setMasterTab('wallets')} className={`rounded-xl px-4 py-2 text-xs font-black ${masterTab === 'wallets' ? 'bg-cyan-300 text-slate-950' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>사용자 지갑 목록</button>
       </div>
       <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
         {masterTab === 'overview' ? (
         <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-black"><WalletCards size={19} className="text-cyan-400" /> 회원 잔고 순위</h2><span className="text-xs text-slate-500">{loading ? '동기화 중...' : '서버 기준'}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10"><tr><th className="p-3">순위</th><th className="p-3">회원</th><th className="p-3">이메일</th><th className="p-3">가입 정보</th><th className="p-3 text-right">USDT</th></tr></thead><tbody>{[...profiles].sort((a, b) => Number(b.usdtBalance || 0) - Number(a.usdtBalance || 0)).map((profile, index) => <tr key={profile.id} className="border-b border-slate-100 dark:border-white/5"><td className="p-3 font-black text-amber-500">#{index + 1}</td><td className="p-3"><div className="flex items-center gap-2"><img src={profile.image} alt="" className="h-8 w-8 rounded-full" /><span className="font-bold">{profile.name}</span></div></td><td className="p-3 text-slate-500">{profile.email}</td><td className="p-3 text-slate-500">{profile.country || 'Global'} · {profile.gender || '미설정'}</td><td className="p-3 text-right font-black text-emerald-500">{Number(profile.usdtBalance || 0).toFixed(2)}</td></tr>)}</tbody></table></div></section>
         ) : (
           <section className="rounded-3xl border border-cyan-200 bg-white p-5 shadow-sm dark:border-cyan-300/20 dark:bg-[#10182b]">
             <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-black"><WalletCards size={19} className="text-cyan-400" /> 사용자 지갑 목록</h2><p className="mt-1 text-xs leading-5 text-slate-500">현재 프로필에 등록된 TRON 지갑과 서비스 잔고를 조회합니다. 개인키를 보관하지 않아 사이트가 임의로 지갑을 자동 발급하지는 않습니다.</p></div><button type="button" onClick={() => void loadAllWalletBalances()} disabled={registeredWallets.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-40"><RefreshCw size={14} /> 전체 체인 잔고 조회</button></div>
             <div className="mb-4 flex gap-2"><label className="relative min-w-0 flex-1"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={walletSearch} onChange={(event) => setWalletSearch(event.target.value)} placeholder="이름, 이메일, UID, 지갑 주소 검색" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-black/20" /></label><span className="flex items-center whitespace-nowrap rounded-xl bg-white/5 px-3 text-xs font-black text-slate-400">{filteredWallets.length}개</span></div>
             <div className="space-y-3">{filteredWallets.map((profile) => { const chain = walletBalances[profile.id]; const address = profile.walletAddress?.trim() || ''; return <article key={profile.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"><div className="flex flex-wrap items-start gap-3"><img src={profile.image} alt="" className="h-10 w-10 rounded-full object-cover" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{profile.name}</h3><span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[10px] font-black text-emerald-300">{profile.walletNetwork || USDT_NETWORK}</span></div><p className="mt-1 truncate text-xs text-slate-500">{profile.email} · UID {profile.id}</p><p className="mt-2 break-all font-mono text-[11px] text-cyan-200">{address}</p></div><div className="flex shrink-0 gap-1.5"><button type="button" onClick={() => void navigator.clipboard?.writeText(address)} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="지갑 주소 복사"><Copy size={14} /></button><button type="button" onClick={() => void loadWalletBalance(profile)} disabled={walletBalanceLoading[profile.id]} className="inline-flex items-center gap-1 rounded-lg bg-cyan-300 px-2.5 py-2 text-[10px] font-black text-slate-950 disabled:opacity-50"><RefreshCw size={12} className={walletBalanceLoading[profile.id] ? 'animate-spin' : ''} /> 조회</button></div></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-black/10 px-3 py-2 dark:bg-black/20"><span className="block text-[10px] font-bold text-slate-500">서비스 잔고</span><b className="mt-1 block text-sm text-emerald-300">{Number(profile.usdtBalance || 0).toFixed(2)} USDT</b></div><div className="rounded-xl bg-black/10 px-3 py-2 dark:bg-black/20"><span className="block text-[10px] font-bold text-slate-500">실제 체인 잔고</span><b className="mt-1 block text-sm text-cyan-200">{chain ? `${chain.balance.toFixed(6)} USDT` : walletBalanceErrors[profile.id] || '조회 전'}</b>{chain && <small className="mt-1 block text-[9px] text-slate-500">{new Date(chain.syncedAt).toLocaleTimeString('ko-KR')}</small>}</div></div></article>; })}{filteredWallets.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-500 dark:border-white/10">등록된 지갑이 없거나 검색 결과가 없습니다.</div>}</div>
           </section>
         )}
        <aside className="space-y-6"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]"><h2 className="mb-3 flex items-center gap-2 font-black"><LockKeyhole size={17} className="text-amber-400" /> TRON 입금 지갑</h2><p className="mb-3 text-xs leading-5 text-slate-500">회원은 이 서버 주소를 읽기만 합니다. 브라우저 localStorage 주소는 사용하지 않습니다.</p><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="T... 마스터 지갑 주소" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20" /><button onClick={() => void saveSettings()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 py-2.5 text-sm font-black text-slate-950"><Save size={16} /> 설정 저장</button>{message && <p className="mt-3 text-xs font-bold text-emerald-500">{message}</p>}</section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]"><h2 className="mb-3 flex items-center gap-2 font-black"><CheckCircle2 size={17} className="text-emerald-400" /> 입금 신청</h2><div className="space-y-2">{deposits.filter((item) => item.status === 'PENDING').map((request) => <div key={request.id} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5"><div className="flex justify-between font-bold"><span>{request.userId.slice(0, 10)}...</span><span>{request.amount} USDT</span></div><p className="mt-1 break-all text-[10px] text-slate-500">{request.network || 'USDT-TRC20'} · {request.depositAddress || '서버 주소'}</p><div className="mt-2 flex gap-2"><button onClick={() => void approveDeposit(request)} className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-black text-white">승인</button><button onClick={() => void updateRequest('depositRequests', request, 'REJECTED')} className="flex-1 rounded-lg border border-red-200 py-2 text-xs font-black text-red-500">거절</button></div></div>)}{deposits.filter((item) => item.status === 'PENDING').length === 0 && <p className="text-sm text-slate-500">대기 중인 입금 신청이 없습니다.</p>}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]"><h2 className="mb-3 font-black">출금 승인</h2><div className="space-y-2">{withdrawals.filter((item) => item.status === 'PENDING').map((request) => <div key={request.id} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5"><div className="flex justify-between font-bold"><span>{request.userId.slice(0, 10)}...</span><span>{request.amount} USDT</span></div><p className="mt-1 break-all text-[10px] text-slate-500">{request.targetAddress || '주소 없음'}</p><button onClick={() => void updateRequest('withdrawalRequests', request, 'APPROVED')} className="mt-2 w-full rounded-lg bg-cyan-500 py-2 text-xs font-black text-white">승인 처리</button></div>)}{withdrawals.filter((item) => item.status === 'PENDING').length === 0 && <p className="text-sm text-slate-500">대기 중인 출금 신청이 없습니다.</p>}</div></section></aside>
       </div>
        <section className="mt-6 rounded-3xl border border-rose-300/20 bg-[#10182b] p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-black text-rose-100">안전 신고·제재 센터</h2><p className="mt-1 text-xs text-slate-500">신고 원문은 최소한으로만 확인하고, 조치 사유와 운영자 작업은 감사 대상으로 남깁니다.</p></div><span className="text-xs font-black text-rose-200">미처리 {safetyReports.filter((item) => item.status === 'open').length}건</span></div><div className="space-y-3">{safetyReports.filter((item) => item.status === 'open').map((report) => <article key={report.id} className="border border-white/10 bg-white/[.04] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="text-xs font-black text-rose-200">{report.category} · 신고자 {report.reporterId.slice(0, 10)}...</div><p className="mt-1 break-all text-sm font-bold">대상 {report.reportedUserId}</p><p className="mt-2 text-xs leading-5 text-slate-400">{report.details || '상세 내용 없음'}</p></div><div className="flex shrink-0 gap-2"><button type="button" disabled={savingAction === `safety-${report.id}`} onClick={() => void updateSafetyModeration(report, 'suspended')} className="border border-amber-300/30 px-3 py-2 text-[11px] font-black text-amber-100 disabled:opacity-50">7일 정지</button><button type="button" disabled={savingAction === `safety-${report.id}`} onClick={() => void updateSafetyModeration(report, 'banned')} className="bg-rose-500 px-3 py-2 text-[11px] font-black text-white disabled:opacity-50">영구 정지</button><button type="button" disabled={savingAction === `safety-${report.id}`} onClick={() => void updateSafetyModeration(report, 'active')} className="border border-emerald-300/30 px-3 py-2 text-[11px] font-black text-emerald-100 disabled:opacity-50">정상화</button></div></div></article>)}{safetyReports.filter((item) => item.status === 'open').length === 0 && <p className="text-sm text-slate-500">처리할 안전 신고가 없습니다.</p>}</div><div className="mt-5 border-t border-white/10 pt-4"><div className="mb-2 text-xs font-black uppercase tracking-[.18em] text-slate-500">현재 제재 계정</div><div className="flex flex-wrap gap-2">{moderationRows.filter((item) => item.status !== 'active').map((item) => <span key={item.id} className="border border-rose-300/20 px-2 py-1 text-[10px] font-bold text-rose-100">{item.userId.slice(0, 10)} · {item.status}</span>)}{moderationRows.filter((item) => item.status !== 'active').length === 0 && <span className="text-xs text-slate-500">현재 제재 계정 없음</span>}</div></div></section>
        <section className="mt-6 rounded-3xl border border-orange-200 bg-white p-5 shadow-sm dark:border-orange-300/20 dark:bg-[#10182b]"><div className="mb-4 flex items-center justify-between"><h2 className="font-black">회원 송금 신청</h2><span className="text-xs text-slate-500">{transfers.filter((item) => item.status === 'PENDING').length}건 대기</span></div><div className="grid gap-3 md:grid-cols-2">{transfers.filter((item) => item.status === 'PENDING').map((request) => <div key={request.id} className="rounded-2xl bg-orange-50 p-4 text-sm dark:bg-orange-300/10"><div className="flex items-center justify-between font-black"><span>{request.amount} USDT</span><span className="text-xs text-orange-600">수수료 {request.fee || 0} USDT</span></div><p className="mt-2 break-all text-xs text-slate-500">보내는 회원: {request.senderId}</p><p className="break-all text-xs text-slate-500">받는 회원: {request.recipientId}</p><div className="mt-3 flex gap-2"><button disabled={savingAction === request.id} onClick={() => void approveTransfer(request)} className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-black text-white disabled:opacity-50">승인</button><button disabled={savingAction === request.id} onClick={() => void rejectTransfer(request)} className="flex-1 rounded-xl border border-rose-200 py-2 text-xs font-black text-rose-600 disabled:opacity-50">거절</button></div></div>)}{transfers.filter((item) => item.status === 'PENDING').length === 0 && <p className="text-sm text-slate-500">대기 중인 송금 신청이 없습니다.</p>}</div></section>
     </div>
  );
}
