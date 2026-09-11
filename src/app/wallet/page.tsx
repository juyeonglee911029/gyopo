'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';
import { createDocument, getDocument, getSessionToken, isMasterUser, MASTER_DEPOSIT_ADDRESS, queryDocuments, queryDocumentsWhere, saveProfile, USDT_NETWORK, type WalletLedgerEntry } from '@/lib/firebase';
import { connectTronLink, isValidTronAddress, sendUsdtWithTronLink } from '@/lib/tron';
import { Wallet, Copy, History, Send, AlertCircle, Download, Link2, ShieldCheck, RefreshCw } from 'lucide-react';

const configuredDepositAddress = process.env.NEXT_PUBLIC_USDT_DEPOSIT_ADDRESS || MASTER_DEPOSIT_ADDRESS;

type LedgerRow = WalletLedgerEntry & { id: string };

async function hashPin(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export default function WalletPage() {
  const { user, setUser, addTransaction, transactions } = useGlobalStore();
  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'P2P' | 'ONCHAIN'>('DEPOSIT');
  
  // Forms state
  const [amount, setAmount] = useState('');
  const [targetId, setTargetId] = useState('');
  const [depositAddress, setDepositAddress] = useState(configuredDepositAddress);
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; image?: string; country?: string }>>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<{ id: string; name: string; image?: string; country?: string } | null>(null);
  const [searchMessage, setSearchMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chainBalance, setChainBalance] = useState<number | null>(null);
  const [chainSyncedAt, setChainSyncedAt] = useState<string>('');
  const [chainError, setChainError] = useState('');
  const [chainLoading, setChainLoading] = useState(false);
  const [chainAddress, setChainAddress] = useState('');
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [requestPin, setRequestPin] = useState('');
  const [onchainTarget, setOnchainTarget] = useState('');
  const [onchainAmount, setOnchainAmount] = useState('');
  const [onchainPin, setOnchainPin] = useState('');
  const [isOnchainSending, setIsOnchainSending] = useState(false);

  useEffect(() => {
    const token = getSessionToken();
    if (!token) return;
      void getDocument<{ depositAddress?: string; network?: string }>('adminSettings', 'wallet', token).then((settings) => {
        if (settings?.depositAddress) setDepositAddress(settings.depositAddress);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const address = user.walletAddress?.trim() || (isMasterUser(user) ? MASTER_DEPOSIT_ADDRESS : '');
    setChainAddress(address);
    if (!address) {
      setChainBalance(null);
      setChainError('프로필에 TRON 지갑 주소를 먼저 등록해주세요.');
      return () => { active = false; };
    }
    const loadChainBalance = async () => {
      setChainLoading(true);
      try {
        const response = await fetch(`/api/tron/balance?address=${encodeURIComponent(address)}`, { cache: 'no-store' });
        const result = await response.json() as { balance?: number; syncedAt?: string; error?: string };
        if (!response.ok) throw new Error(result.error || 'TRON 잔고를 읽지 못했습니다.');
        if (active) {
          setChainBalance(typeof result.balance === 'number' ? result.balance : 0);
          setChainSyncedAt(result.syncedAt || new Date().toISOString());
          setChainError('');
        }
      } catch (error) {
        if (active) setChainError(error instanceof Error ? error.message : 'TRON 잔고를 읽지 못했습니다.');
      } finally {
        if (active) setChainLoading(false);
      }
    };
    void loadChainBalance();
    const timer = window.setInterval(() => void loadChainBalance(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [user?.id, user?.walletAddress]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadLedger = async () => {
      setLedgerLoading(true);
      try {
        const rows = await queryDocumentsWhere<WalletLedgerEntry>('walletLedger', [{ field: 'userId', op: 'EQUAL', value: user.id }], getSessionToken(), 200);
        if (active) {
          setLedger(rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
          setLedgerError('');
        }
      } catch (error) {
        if (active) setLedgerError(error instanceof Error ? error.message : '거래 원장을 불러오지 못했습니다.');
      } finally {
        if (active) setLedgerLoading(false);
      }
    };
    void loadLedger();
    const timer = window.setInterval(() => void loadLedger(), 15_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [user?.id]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">로그인이 필요합니다.</h2>
        <Link href="/login" className="text-blue-600 underline">로그인 페이지로 이동</Link>
      </div>
    );
  }

  const recordLedger = async (entry: Omit<WalletLedgerEntry, 'userId' | 'createdAt'>) => {
    const token = getSessionToken();
    if (!token) throw new Error('로그인 세션이 만료되었습니다.');
    const id = crypto.randomUUID();
    const row = { ...entry, userId: user.id, createdAt: new Date() };
    await createDocument('walletLedger', id, row, token);
    setLedger((current) => [{ ...row, id }, ...current]);
  };

  const verifyPin = async (value: string) => {
    if (!/^\d{4}$/.test(value)) {
      alert('4자리 숫자 PIN을 입력해주세요.');
      return false;
    }
    if (!user.walletPinHash) {
      alert('먼저 지갑 보안 PIN을 설정해주세요.');
      return false;
    }
    return (await hashPin(value)) === user.walletPinHash;
  };

  const saveWalletPin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{4}$/.test(newPin) || newPin !== confirmPin) {
      alert('PIN은 서로 같은 4자리 숫자여야 합니다.');
      return;
    }
    try {
      const nextUser = { ...user, walletPinHash: await hashPin(newPin) };
      await saveProfile(nextUser, getSessionToken());
      setUser(nextUser);
      setNewPin('');
      setConfirmPin('');
      alert('지갑 보안 PIN을 저장했습니다. 실제 송금은 TronLink 서명이 추가로 필요합니다.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'PIN을 저장하지 못했습니다.');
    }
  };

  const connectWallet = async () => {
    try {
      const address = await connectTronLink();
      const nextUser = { ...user, walletAddress: address, walletNetwork: USDT_NETWORK };
      await saveProfile(nextUser, getSessionToken());
      setUser(nextUser);
      setWalletConnected(true);
      alert(`TronLink 지갑을 연결했습니다.\n${address}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'TronLink 지갑을 연결하지 못했습니다.');
    }
  };

  const handleDeposit = async () => {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return alert("올바른 금액을 입력하세요.");
    if (!depositAddress.trim()) return alert('관리자가 입금 지갑을 설정하지 않았습니다.');
    const token = getSessionToken();
    if (!token) return alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    try {
      await createDocument('depositRequests', crypto.randomUUID(), {
        userId: user.id,
        amount: val,
         network: USDT_NETWORK,
        depositAddress: depositAddress.trim(),
        status: 'PENDING',
        createdAt: new Date(),
      }, token);
      await recordLedger({ type: 'DEPOSIT', direction: 'IN', amount: val, status: 'PENDING', network: USDT_NETWORK, symbol: 'USDT', memo: '입금 확인 대기' });
      addTransaction({ type: 'DEPOSIT', amount: val, status: 'PENDING', details: 'USDT 입금 확인 대기' });
      alert(`[시스템] ${val} USDT 입금 신청이 접수되었습니다. 실제 입금 확인 후 잔고에 반영됩니다.`);
    } catch {
      alert('입금 신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setAmount('');
  };

  const handleWithdrawal = async () => {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return alert("올바른 금액을 입력하세요.");
    if (user.usdtBalance < val + 9) return alert(`잔고가 부족합니다. (수수료 9 USDT 포함 ${val + 9} USDT 필요)`);
    const token = getSessionToken();
    if (!token || !targetId.trim()) return alert('출금 주소를 입력하세요.');
    if (!(await verifyPin(requestPin))) return alert('PIN이 올바르지 않습니다.');
     await createDocument('withdrawalRequests', crypto.randomUUID(), { userId: user.id, amount: val, fee: 9, targetAddress: targetId.trim(), network: USDT_NETWORK, status: 'PENDING', createdAt: new Date() }, token);
     await recordLedger({ type: 'WITHDRAWAL', direction: 'OUT', amount: val, fee: 9, status: 'PENDING', network: USDT_NETWORK, symbol: 'USDT', toAddress: targetId.trim(), memo: '운영자 출금 승인 대기' });
    addTransaction({ type: 'WITHDRAWAL', amount: val, status: 'PENDING', details: `승인 대기 · ${targetId.trim()}` });
     alert(`[시스템] ${val} USDT 출금 신청이 접수되었습니다. 운영자 승인 후 처리됩니다.`);
     setAmount('');
     setTargetId('');
     setRequestPin('');
  };

  const searchUsers = async () => {
    const token = getSessionToken();
    const value = userSearch.trim().toLocaleLowerCase('ko-KR');
    if (!token) return setSearchMessage('로그인 세션이 만료되었습니다.');
    if (!value) {
      setSearchResults([]);
      setSearchMessage('검색할 회원 이름을 입력해주세요.');
      return;
    }
    setIsSearching(true);
    setSearchMessage('회원 명단을 검색하는 중...');
    try {
      const rows = await queryDocuments<{ name: string; image?: string; country?: string }>('publicProfiles', 'isPublic', true, token);
      const results = rows
        .filter((row) => row.id !== user.id)
        .filter((row) => (row.name || '').toLocaleLowerCase('ko-KR').includes(value))
        .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'))
        .slice(0, 20);
      setSearchResults(results);
      setSearchMessage(results.length ? `${results.length}명의 회원을 찾았습니다.` : '검색어와 일치하는 등록 회원이 없습니다.');
    } catch (error) {
      setSearchResults([]);
      setSearchMessage(error instanceof Error ? `회원 검색 실패: ${error.message.slice(0, 120)}` : '회원 검색에 실패했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleP2P = async () => {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return alert("올바른 금액을 입력하세요.");
    if (!targetId) return alert("받는 사람을 선택하세요.");
    if (user.usdtBalance < val + 9) return alert(`잔고가 부족합니다. (수수료 9 USDT 포함 ${val + 9} USDT 필요)`);

    const token = getSessionToken();
    if (!token) return alert('로그인 세션이 만료되었습니다.');
    if (!(await verifyPin(requestPin))) return alert('PIN이 올바르지 않습니다.');
    setIsSending(true);
    try {
      await createDocument('transferRequests', crypto.randomUUID(), { senderId: user.id, recipientId: targetId, amount: val, fee: 9, status: 'PENDING', createdAt: new Date() }, token);
      await recordLedger({ type: 'INTERNAL_TRANSFER', direction: 'OUT', amount: val, fee: 9, status: 'PENDING', symbol: 'USDT', counterpartyId: targetId, memo: `내부 송금 승인 대기 · ${selectedRecipient?.name || targetId}` });
      addTransaction({ type: 'P2P_SEND', amount: val, status: 'PENDING', details: `송금 승인 대기 · ${selectedRecipient?.name || targetId}` });
      alert(`[시스템] ${selectedRecipient?.name || '회원'}에게 ${val} USDT 송금 신청이 접수되었습니다. 운영자 승인 후 잔고에 반영됩니다.`);
      setAmount('');
      setTargetId('');
      setUserSearch('');
      setSelectedRecipient(null);
       setSearchResults([]);
       setSearchMessage('');
       setRequestPin('');
    } catch (error) {
      alert(error instanceof Error ? `송금 신청 실패: ${error.message.slice(0, 160)}` : '송금 신청에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSending(false);
    }
  };

  const handleOnchainSend = async () => {
    const val = Number(onchainAmount);
    if (!user.walletAddress) return alert('먼저 TronLink 지갑을 연결하고 프로필에 저장해주세요.');
    if (!isValidTronAddress(onchainTarget)) return alert('받는 지갑 주소가 올바르지 않습니다.');
    if (!Number.isFinite(val) || val <= 0) return alert('송금 금액이 올바르지 않습니다.');
    if (!(await verifyPin(onchainPin))) return alert('PIN이 올바르지 않습니다.');
    setIsOnchainSending(true);
    try {
      const sent = await sendUsdtWithTronLink(onchainTarget.trim(), val, user.walletAddress);
      await recordLedger({ type: 'ONCHAIN_SEND', direction: 'OUT', amount: val, status: 'SUBMITTED', network: USDT_NETWORK, symbol: 'USDT', txHash: sent.txHash, fromAddress: sent.from, toAddress: sent.to, memo: 'TronLink 실제 USDT 송금 제출' });
      addTransaction({ type: 'WITHDRAWAL', amount: val, status: 'PENDING', details: `TRON 송금 제출 · ${sent.txHash}` });
      setOnchainAmount('');
      setOnchainTarget('');
      setOnchainPin('');
      alert(`송금 서명이 완료되었습니다.\n트랜잭션: ${sent.txHash}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '실제 USDT 송금에 실패했습니다.');
    } finally {
      setIsOnchainSending(false);
    }
  };

  const exportLedger = () => {
    const rows: Array<{ createdAt: string | Date; type: string; direction: string; amount: number; fee?: number; status: string; network?: string; txHash?: string; fromAddress?: string; toAddress?: string; memo?: string }> = ledger.length ? ledger : transactions.map((item) => ({ userId: user.id, type: item.type, direction: item.type === 'DEPOSIT' ? 'IN' : 'OUT', amount: item.amount, status: item.status, memo: item.details, createdAt: item.date, id: item.id }));
    const header = ['일시', '유형', '방향', '금액', '수수료', '상태', '네트워크', 'TXID', '보내는 주소', '받는 주소', '메모'];
    const body = rows.map((row) => [row.createdAt, row.type, row.direction, row.amount, row.fee || 0, row.status, row.network || '', row.txHash || '', row.fromAddress || '', row.toAddress || '', row.memo || ''].map(csvCell).join(','));
    const blob = new Blob([`\ufeff${[header.map(csvCell).join(','), ...body].join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gyopo-wallet-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
     <div className="wallet-page container mx-auto max-w-4xl px-4 py-8">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 text-white mb-8 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
            <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
              <Wallet size={32} className="text-green-400"/> 내 지갑 (USDT)
            </h1>
            <Link href="/wallet/history" className="mb-2 inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-300/20"><History size={14} /> 전문 거래내역</Link>
            </div>
            <p className="text-gray-400">UID: {user.id}</p>
            <button type="button" onClick={() => void connectWallet()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-200"><Link2 size={16} />{walletConnected ? 'TronLink 연결됨' : 'TronLink 연결 / 주소 저장'}</button>
        </div>
         <div className="text-right">
             <div className="text-sm text-gray-400 font-bold mb-1">서비스 잔액 (가상)</div>
             <div className="text-5xl font-black text-green-400">{user.usdtBalance.toFixed(2)}</div>
             <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-left"><div className="text-[10px] font-black uppercase tracking-wider text-emerald-200">실제 TRON 체인 잔고 · USDT TRC20</div><div className="mt-1 text-2xl font-black text-emerald-300">{chainLoading && chainBalance === null ? '조회 중...' : chainAddress ? `${(chainBalance ?? 0).toFixed(6)} USDT` : '지갑 주소 미등록'}</div><div className="mt-1 break-all text-[10px] text-emerald-100/60">{chainError || chainAddress || (chainSyncedAt ? `15초 주기 동기화 · ${new Date(chainSyncedAt).toLocaleTimeString()}` : '동기화 대기')}</div></div>
           </div>
        </div>
         <p className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">서비스 잔액은 사이트 내부 원장이고, 실제 체인 잔액은 TRON 블록체인 조회값입니다. 실제 송금은 TronLink 팝업에서 직접 서명해야 합니다. 사이트는 개인키를 보관하지 않으므로 지갑을 임의로 자동 발급하지 않습니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Actions */}
        <div className="md:col-span-5 space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-4 border-b border-gray-200">
                <button onClick={() => setActiveTab('DEPOSIT')} className={`py-4 font-bold text-xs ${activeTab === 'DEPOSIT' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>입금</button>
                <button onClick={() => setActiveTab('WITHDRAWAL')} className={`py-4 font-bold text-xs ${activeTab === 'WITHDRAWAL' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>가상 출금</button>
                <button onClick={() => setActiveTab('P2P')} className={`py-4 font-bold text-xs ${activeTab === 'P2P' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>내부 송금</button>
                <button onClick={() => setActiveTab('ONCHAIN')} className={`py-4 font-bold text-xs ${activeTab === 'ONCHAIN' ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600' : 'text-gray-500 hover:bg-gray-50'}`}>실제 송금</button>
             </div>

             <div className="p-6">
                 {activeTab === 'DEPOSIT' && (
                   <div className="space-y-4">
                     <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-4">
                         <strong>USDT · TRC20 (TRON) 네트워크 입금</strong><br/>아래 주소로 실제 입금하면 확인 후 잔고에 반영됩니다. 네트워크를 잘못 선택하면 자산을 잃을 수 있습니다.
                     </div>
                      <label className="block text-sm font-bold text-gray-700">마스터 입금 지갑 주소 (서버 고정)</label>
                      <div className="flex gap-2">
                        <input type="text" value={depositAddress} readOnly className="min-w-0 flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="관리자 설정 대기" />
                       <button type="button" onClick={() => void navigator.clipboard?.writeText(depositAddress)} className="rounded-xl bg-gray-200 px-3 text-gray-700 hover:bg-gray-300" aria-label="지갑 주소 복사"><Copy size={17} /></button>
                     </div>
                      {depositAddress ? <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`tron:${depositAddress}`)}`} alt="USDT TRC20 입금 지갑 QR 코드" className="h-44 w-44 rounded-lg" /><p className="break-all text-center text-[11px] text-gray-500">{depositAddress}</p><p className="text-[10px] font-bold text-emerald-700">USDT · TRC20 (TRON)</p></div> : <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">지갑 주소를 입력하면 QR 코드가 표시됩니다.</div>}
                     <label className="block text-sm font-bold text-gray-700">충전할 금액 (USDT)</label>
                    <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="100" />
                    <button onClick={handleDeposit} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition">입금 신청하기</button>
                  </div>
                )}

                {activeTab === 'WITHDRAWAL' && (
                  <div className="space-y-4">
                    <div className="bg-red-50 text-red-800 p-3 rounded-xl text-sm mb-4 flex gap-2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0"/> 
                      <span>출금 시 <strong>9 USDT</strong>의 시스템 수수료가 발생합니다. (보유 잔고에서 차감)</span>
                    </div>
                     <label className="block text-sm font-bold text-gray-700">출금할 주소 (TRX 네트워크)</label>
                    <input type="text" value={targetId} onChange={e=>setTargetId(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="T..." />
                    
                     <label className="block text-sm font-bold text-gray-700 mt-4">출금할 금액 (USDT)</label>
                     <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="100" />
                     <label className="block text-sm font-bold text-gray-700">4자리 지갑 PIN</label>
                     <input type="password" inputMode="numeric" maxLength={4} value={requestPin} onChange={(event) => setRequestPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold tracking-[0.4em] focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••" />
                    
                    <div className="text-right text-sm text-gray-500">
                      총 차감 예상액: <span className="font-bold text-red-600">{Number(amount) > 0 ? Number(amount) + 9 : 0} USDT</span>
                    </div>
                    <button onClick={handleWithdrawal} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition">출금 신청하기</button>
                  </div>
                )}

                {activeTab === 'P2P' && (
                  <div className="space-y-4">
                    <div className="bg-orange-50 text-orange-800 p-3 rounded-xl text-sm mb-4 flex gap-2">
                      <AlertCircle size={16} className="mt-0.5 shrink-0"/> 
                      <span>유저 간 송금 시 <strong>9 USDT</strong>의 시스템 수수료가 발생합니다.</span>
                    </div>
                     <label className="block text-sm font-bold text-gray-700">받는 사람 이름 검색</label>
                     <div className="flex gap-2">
                        <input type="text" value={userSearch} onChange={e=>{ setUserSearch(e.target.value); setTargetId(''); setSelectedRecipient(null); setSearchMessage(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void searchUsers(); } }} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="회원 이름 또는 이메일" />
                        <button type="button" onClick={() => void searchUsers()} disabled={isSearching} className="bg-gray-200 text-gray-700 px-4 rounded-xl font-bold hover:bg-gray-300 disabled:opacity-50">{isSearching ? '검색 중' : '검색'}</button>
                      </div>
                      {searchMessage && <p className="text-xs font-bold text-gray-500">{searchMessage}</p>}
                      {searchResults.length > 0 && <div className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-2">{searchResults.map((result) => <button type="button" key={result.id} onClick={() => { setTargetId(result.id); setSelectedRecipient(result); setUserSearch(result.name); setSearchResults([]); setSearchMessage(''); }} className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-white"><img src={result.image} alt="" className="h-7 w-7 rounded-full" /><span className="text-sm font-bold">{result.name}</span><span className="ml-auto text-[10px] text-gray-500">{result.country || 'Global'}</span></button>)}</div>}
                      {selectedRecipient && <div className="rounded-xl bg-green-50 p-2 text-xs font-bold text-green-700">선택된 수신자: {selectedRecipient.name}</div>}

                    <label className="block text-sm font-bold text-gray-700 mt-4">보낼 금액 (USDT)</label>
                    <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="50" />
                    
                     <div className="text-right text-sm text-gray-500">
                       총 차감 예상액: <span className="font-bold text-red-600">{Number(amount) > 0 ? Number(amount) + 9 : 0} USDT</span>
                     </div>
                     <label className="block text-sm font-bold text-gray-700">4자리 지갑 PIN</label>
                     <input type="password" inputMode="numeric" maxLength={4} value={requestPin} onChange={(event) => setRequestPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold tracking-[0.4em] focus:ring-2 focus:ring-orange-500 outline-none" placeholder="••••" />
                     <button onClick={handleP2P} disabled={isSending} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition disabled:opacity-50">{isSending ? '송금 신청 중...' : '송금하기'}</button>
                  </div>
                )}

                {activeTab === 'ONCHAIN' && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 text-emerald-900 p-3 rounded-xl text-sm flex gap-2"><ShieldCheck size={17} className="mt-0.5 shrink-0" /><span><strong>실제 USDT · TRC20 송금</strong><br />개인키는 사이트에 전달되지 않습니다. PIN 확인 후 TronLink 지갑 팝업에서 최종 서명합니다.</span></div>
                    <label className="block text-sm font-bold text-gray-700">받는 TRON 지갑 주소</label>
                    <input type="text" value={onchainTarget} onChange={(event) => setOnchainTarget(event.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-mono text-xs focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="T..." />
                    <label className="block text-sm font-bold text-gray-700">실제 송금 금액 (USDT)</label>
                    <input type="number" min="0.000001" step="0.000001" value={onchainAmount} onChange={(event) => setOnchainAmount(event.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="10" />
                    <label className="block text-sm font-bold text-gray-700">4자리 지갑 PIN</label>
                    <input type="password" inputMode="numeric" maxLength={4} value={onchainPin} onChange={(event) => setOnchainPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold tracking-[0.4em] focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="••••" />
                    <button type="button" onClick={() => void handleOnchainSend()} disabled={isOnchainSending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-black text-white hover:bg-emerald-700 disabled:opacity-50"><Send size={16} />{isOnchainSending ? 'TronLink 서명 대기 중...' : 'TronLink으로 실제 송금'}</button>
                  </div>
                )}
              </div>
           </div>
           <form onSubmit={saveWalletPin} className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2 text-sm font-black text-slate-800"><ShieldCheck size={18} className="text-indigo-600" /> 지갑 보안 PIN</div><p className="mt-2 text-xs leading-5 text-slate-500">4자리 PIN은 출금·내부 송금·실제 송금 전 추가 확인에 사용합니다. 실제 체인 송금은 항상 TronLink 서명이 필요합니다.</p><div className="mt-4 grid grid-cols-2 gap-2"><input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm tracking-[0.3em]" placeholder="새 PIN" /><input type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 4))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm tracking-[0.3em]" placeholder="다시 입력" /></div><button className="mt-3 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-black text-white hover:bg-indigo-700">PIN 저장·변경</button></form>
        </div>

        {/* History */}
        <div className="md:col-span-7">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-6">
                 <h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><History size={20} className="text-blue-600"/> 최근 거래 원장</h2>
                 <div className="flex items-center gap-2"><Link href="/wallet/history" className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100">전체 보기</Link><button type="button" onClick={exportLedger} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200"><Download size={14} />CSV</button></div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {ledgerError && <p className="m-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-700">{ledgerError}</p>}
                {ledgerLoading && ledger.length === 0 ? (
                  <div className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-gray-400"><RefreshCw size={16} className="animate-spin" /> 원장을 불러오는 중...</div>
                ) : ledger.length === 0 && transactions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 p-10">
                    <History size={48} className="mb-4 opacity-50"/>
                    <p>거래 내역이 없습니다.</p>
                 </div>
               ) : (
                  <ul className="divide-y divide-gray-100">
                    {ledger.length > 0 ? ledger.map((tx) => (
                      <li key={tx.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                             <span className={`text-xs font-bold px-2 py-0.5 rounded ${tx.direction === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{tx.type === 'ONCHAIN_SEND' ? '실제 송금' : tx.type === 'INTERNAL_TRANSFER' ? '내부 송금' : tx.type === 'WITHDRAWAL' ? '출금' : '입금'}</span>
                             <span className="text-sm font-medium text-gray-800">{tx.memo || tx.type}</span>
                          </div>
                          <div className={`font-black ${tx.direction === 'IN' ? 'text-green-600' : 'text-red-500'}`}>{tx.direction === 'IN' ? '+' : '-'}{tx.amount} USDT</div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>{String(tx.createdAt)} · ID: {tx.id}</span><span className={`font-bold ${tx.status === 'PENDING' || tx.status === 'SUBMITTED' ? 'text-orange-500' : tx.status === 'COMPLETED' ? 'text-green-500' : 'text-gray-500'}`}>{tx.status}</span>
                        </div>
                        {tx.txHash && <a href={`https://tronscan.org/#/transaction/${tx.txHash}`} target="_blank" rel="noreferrer" className="mt-2 block break-all font-mono text-[10px] text-blue-600 hover:underline">TXID: {tx.txHash}</a>}
                      </li>
                    )) : transactions.map((tx) => (<li key={tx.id} className="p-4 text-sm"><div className="flex justify-between"><span>{tx.details}</span><b>{tx.amount} USDT</b></div><div className="mt-1 text-xs text-gray-500">{tx.date} · {tx.status}</div></li>))}
                  </ul>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
