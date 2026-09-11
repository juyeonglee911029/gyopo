'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { CheckCircle2, Copy, LockKeyhole, RefreshCcw, RefreshCw, Save, Search, ShieldAlert, WalletCards } from 'lucide-react';
import { approveDepositRequest, approveTransferRequest, createDocument, getDocument, getOnlineCount, getSessionToken, getSiteStats, isMasterUser, listDocuments, MASTER_DEPOSIT_ADDRESS, MASTER_EMAIL, mergeDocument, reviewDepositRequest, reviewTransferRequest, USDT_NETWORK, type PortalUser, type SiteStats } from '@/lib/firebase';
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

const categoryLabels: Record<ContentCategory, string> = { news: '뉴스', directory: '업소록', jobs: '구인구직', market: '장터', events: '행사', community: '커뮤니티' };

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
  const masterUserId = user?.id && isMasterUser(user) ? user.id : undefined;

  const load = async () => {
    const token = getSessionToken();
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

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEffect(), 0);
    return () => window.clearTimeout(timer);
  }, [masterUserId]);

  const token = getSessionToken();
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
      const response = await fetch(`/api/tron/balance?address=${encodeURIComponent(address)}`, { cache: 'no-store' });
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
      const response = await fetch(`/api/tron/deposits?address=${encodeURIComponent(MASTER_DEPOSIT_ADDRESS)}&limit=200`, { cache: 'no-store' });
      const payload = await response.json() as { deposits?: OnchainDeposit[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'TRON 입금 내역을 가져오지 못했습니다.');
      const unmatched: OnchainDeposit[] = [];
      let credited = 0;
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
        }
        await approveDepositRequest(requestId, profile.id, user?.email || MASTER_EMAIL, token);
        credited += 1;
      }
      setUnmatchedDeposits(unmatched);
      setMessage(credited ? `${credited}건의 TRON 입금을 회원 잔고에 자동 반영했습니다.` : '새로 반영할 TRON 입금이 없습니다.');
      if (credited) await load();
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
       <div className="master-page mx-auto max-w-7xl px-4 py-8 text-slate-100">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.28em] text-amber-500">Master Operations</p><h1 className="mt-2 text-4xl font-black">운영자 센터</h1><p className="mt-2 text-sm text-slate-500">회원 잔고·입출금 신청·입금 지갑 설정을 서버 기준으로 관리합니다.</p></div><button onClick={() => void Promise.all([load(), syncIncomingDeposits()])} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCcw size={16} /> 새로고침</button></header>
       <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100"><strong>게시 기준:</strong> 뉴스는 뉴스로, 커뮤니티는 커뮤니티로만 게시됩니다. 아래 출처의 지원 카테고리를 확인한 뒤 전체 확인 또는 원하는 카테고리만 확인하세요.</div>
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
