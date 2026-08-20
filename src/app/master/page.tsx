'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, LockKeyhole, RefreshCcw, Save, ShieldAlert, WalletCards } from 'lucide-react';
import { getSessionToken, isMasterUser, listDocuments, mergeDocument, type PortalUser } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type RequestRow = { id: string; userId: string; amount: number; status: string; createdAt?: string; network?: string; depositAddress?: string; targetAddress?: string };
type WalletSettings = { depositAddress?: string; network?: string; updatedAt?: string };

export default function MasterPage() {
  const user = useGlobalStore((state) => state.user);
  const [profiles, setProfiles] = useState<Array<PortalUser & { id: string }>>([]);
  const [deposits, setDeposits] = useState<RequestRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<RequestRow[]>([]);
  const [settings, setSettings] = useState<WalletSettings>({ network: 'USDT-TRC20' });
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    const token = getSessionToken();
    if (!token || !isMasterUser(user)) return;
    setLoading(true);
    const [nextProfiles, nextDeposits, nextWithdrawals, nextSettings] = await Promise.all([
      listDocuments<PortalUser>('profiles', token).catch(() => []),
      listDocuments<RequestRow>('depositRequests', token).catch(() => []),
      listDocuments<RequestRow>('withdrawalRequests', token).catch(() => []),
      listDocuments<WalletSettings>('adminSettings', token).catch(() => []),
    ]);
    const wallet: WalletSettings = nextSettings.find((item) => item.id === 'wallet') || { network: 'USDT-TRC20' };
    setProfiles(nextProfiles);
    setDeposits(nextDeposits.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    setWithdrawals(nextWithdrawals.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
    setSettings(wallet);
    setAddress(wallet.depositAddress || '');
    setLoading(false);
  };

  useEffect(() => { void load(); }, [user?.id]);

  if (!isMasterUser(user)) return <div className="mx-auto max-w-xl px-4 py-24 text-center"><ShieldAlert className="mx-auto mb-4 text-rose-400" size={42} /><h1 className="text-2xl font-black">마스터 전용 페이지</h1><p className="mt-3 text-sm text-slate-500">관리자 계정으로 로그인해야 접근할 수 있습니다.</p></div>;

  const token = getSessionToken();
  const totalBalance = profiles.reduce((sum, profile) => sum + Number(profile.usdtBalance || 0), 0);
  const totalDeposits = deposits.filter((item) => item.status === 'APPROVED').reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const saveSettings = async () => {
    if (!token || !address.trim()) return;
    await mergeDocument('adminSettings', 'wallet', { depositAddress: address.trim(), network: settings.network || 'USDT-TRC20', updatedAt: new Date() }, token);
    setMessage('입금 지갑 주소가 서버 설정에 저장되었습니다.');
  };
  const approveDeposit = async (request: RequestRow) => {
    if (!token || request.status !== 'PENDING') return;
    const profile = profiles.find((item) => item.id === request.userId);
    if (!profile) return setMessage('대상 회원 프로필을 찾지 못했습니다.');
    await mergeDocument('profiles', profile.id, { usdtBalance: Number(profile.usdtBalance || 0) + Number(request.amount || 0), updatedAt: new Date() }, token);
    await mergeDocument('depositRequests', request.id, { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: user?.email || '' }, token);
    setMessage('입금 승인 및 잔고 반영이 완료되었습니다.');
    await load();
  };
  const updateRequest = async (collection: string, request: RequestRow, status: string) => {
    if (!token || request.status !== 'PENDING') return;
    await mergeDocument(collection, request.id, { status, reviewedAt: new Date(), reviewedBy: user?.email || '' }, token);
    await load();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-slate-900 dark:text-white">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.28em] text-amber-500">Master Operations</p><h1 className="mt-2 text-4xl font-black">운영자 센터</h1><p className="mt-2 text-sm text-slate-500">회원 잔고·입출금 신청·입금 지갑 설정을 서버 기준으로 관리합니다.</p></div><button onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold shadow-sm dark:border-white/10 dark:bg-white/5"><RefreshCcw size={16} /> 새로고침</button></header>
      <div className="mb-6 grid gap-4 sm:grid-cols-3"><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-300/20 dark:bg-emerald-300/10"><p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">전체 회원</p><p className="mt-2 text-3xl font-black">{profiles.length}</p></div><div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5 dark:border-cyan-300/20 dark:bg-cyan-300/10"><p className="text-xs font-bold text-cyan-700 dark:text-cyan-300">회원 잔고 합계</p><p className="mt-2 text-3xl font-black">{totalBalance.toFixed(2)} USDT</p></div><div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-300/20 dark:bg-amber-300/10"><p className="text-xs font-bold text-amber-700 dark:text-amber-300">승인 입금 합계</p><p className="mt-2 text-3xl font-black">{totalDeposits.toFixed(2)} USDT</p></div></div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-black"><WalletCards size={19} className="text-cyan-400" /> 회원 잔고 순위</h2><span className="text-xs text-slate-500">{loading ? '동기화 중...' : '서버 기준'}</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-white/10"><tr><th className="p-3">순위</th><th className="p-3">회원</th><th className="p-3">이메일</th><th className="p-3">가입 정보</th><th className="p-3 text-right">USDT</th></tr></thead><tbody>{[...profiles].sort((a, b) => Number(b.usdtBalance || 0) - Number(a.usdtBalance || 0)).map((profile, index) => <tr key={profile.id} className="border-b border-slate-100 dark:border-white/5"><td className="p-3 font-black text-amber-500">#{index + 1}</td><td className="p-3"><div className="flex items-center gap-2"><img src={profile.image} alt="" className="h-8 w-8 rounded-full" /><span className="font-bold">{profile.name}</span></div></td><td className="p-3 text-slate-500">{profile.email}</td><td className="p-3 text-slate-500">{profile.country || 'Global'} · {profile.gender || '미설정'}</td><td className="p-3 text-right font-black text-emerald-500">{Number(profile.usdtBalance || 0).toFixed(2)}</td></tr>)}</tbody></table></div></section>
        <aside className="space-y-6"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]"><h2 className="mb-3 flex items-center gap-2 font-black"><LockKeyhole size={17} className="text-amber-400" /> TRON 입금 지갑</h2><p className="mb-3 text-xs leading-5 text-slate-500">회원은 이 서버 주소를 읽기만 합니다. 브라우저 localStorage 주소는 사용하지 않습니다.</p><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="T... 마스터 지갑 주소" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-white/10 dark:bg-black/20" /><button onClick={() => void saveSettings()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 py-2.5 text-sm font-black text-slate-950"><Save size={16} /> 설정 저장</button>{message && <p className="mt-3 text-xs font-bold text-emerald-500">{message}</p>}</section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]"><h2 className="mb-3 flex items-center gap-2 font-black"><CheckCircle2 size={17} className="text-emerald-400" /> 입금 신청</h2><div className="space-y-2">{deposits.filter((item) => item.status === 'PENDING').map((request) => <div key={request.id} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5"><div className="flex justify-between font-bold"><span>{request.userId.slice(0, 10)}...</span><span>{request.amount} USDT</span></div><p className="mt-1 break-all text-[10px] text-slate-500">{request.network || 'USDT-TRC20'} · {request.depositAddress || '서버 주소'}</p><div className="mt-2 flex gap-2"><button onClick={() => void approveDeposit(request)} className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-black text-white">승인</button><button onClick={() => void updateRequest('depositRequests', request, 'REJECTED')} className="flex-1 rounded-lg border border-red-200 py-2 text-xs font-black text-red-500">거절</button></div></div>)}{deposits.filter((item) => item.status === 'PENDING').length === 0 && <p className="text-sm text-slate-500">대기 중인 입금 신청이 없습니다.</p>}</div></section><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#10182b]"><h2 className="mb-3 font-black">출금 승인</h2><div className="space-y-2">{withdrawals.filter((item) => item.status === 'PENDING').map((request) => <div key={request.id} className="rounded-2xl bg-slate-50 p-3 text-sm dark:bg-white/5"><div className="flex justify-between font-bold"><span>{request.userId.slice(0, 10)}...</span><span>{request.amount} USDT</span></div><p className="mt-1 break-all text-[10px] text-slate-500">{request.targetAddress || '주소 없음'}</p><button onClick={() => void updateRequest('withdrawalRequests', request, 'APPROVED')} className="mt-2 w-full rounded-lg bg-cyan-500 py-2 text-xs font-black text-white">승인 처리</button></div>)}{withdrawals.filter((item) => item.status === 'PENDING').length === 0 && <p className="text-sm text-slate-500">대기 중인 출금 신청이 없습니다.</p>}</div></section></aside>
      </div>
    </div>
  );
}
