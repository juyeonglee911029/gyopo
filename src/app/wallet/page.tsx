'use client';

import { useEffect, useState } from 'react';
import { useGlobalStore } from '@/store/useGlobalStore';
import { createDocument, getSessionToken } from '@/lib/firebase';
import { Wallet, Copy, History, Send, AlertCircle } from 'lucide-react';

const configuredDepositAddress = process.env.NEXT_PUBLIC_USDT_DEPOSIT_ADDRESS || '';

export default function WalletPage() {
  const { user, updateUsdt, addTransaction, transactions } = useGlobalStore();
  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'P2P'>('DEPOSIT');
  
  // Forms state
  const [amount, setAmount] = useState('');
  const [targetId, setTargetId] = useState('');
  const [depositAddress, setDepositAddress] = useState(() => {
    if (typeof window === 'undefined') return configuredDepositAddress;
    return window.localStorage.getItem('gyopo-usdt-deposit-address') || configuredDepositAddress;
  });

  useEffect(() => {
    if (depositAddress) window.localStorage.setItem('gyopo-usdt-deposit-address', depositAddress);
  }, [depositAddress]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-4">로그인이 필요합니다.</h2>
        <a href="/login" className="text-blue-600 underline">로그인 페이지로 이동</a>
      </div>
    );
  }

  const handleDeposit = async () => {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return alert("올바른 금액을 입력하세요.");
    if (!depositAddress.trim()) return alert('먼저 입금 받을 USDT 지갑 주소를 입력하세요.');
    const token = getSessionToken();
    if (!token) return alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    try {
      await createDocument('depositRequests', crypto.randomUUID(), {
        userId: user.id,
        amount: val,
        network: 'USDT-TRC20',
        depositAddress: depositAddress.trim(),
        status: 'PENDING',
        createdAt: new Date(),
      }, token);
      addTransaction({ type: 'DEPOSIT', amount: val, status: 'PENDING', details: 'USDT 입금 확인 대기' });
      alert(`[시스템] ${val} USDT 입금 신청이 접수되었습니다. 실제 입금 확인 후 잔고에 반영됩니다.`);
    } catch {
      alert('입금 신청을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setAmount('');
  };

  const handleWithdrawal = () => {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return alert("올바른 금액을 입력하세요.");
    if (user.usdtBalance < val + 9) return alert(`잔고가 부족합니다. (수수료 9 USDT 포함 ${val + 9} USDT 필요)`);

    // Deduct total amount + fee immediately
    updateUsdt(-(val + 9));
    
    // Log Withdrawal Request
    addTransaction({ type: 'WITHDRAWAL', amount: val, status: 'PENDING', details: `지갑 주소: ${targetId || '미입력'}` });
    
    // Record the network fee in the local transaction feed.
    addTransaction({ type: 'FEE', amount: 9, status: 'COMPLETED', details: '출금 수수료 차감 (시스템 회수)' });
    
    alert(`[시스템] ${val} USDT 출금 신청이 완료되었습니다. (수수료 9 USDT 차감 완료)`);
    setAmount('');
    setTargetId('');
  };

  const handleP2P = () => {
    const val = Number(amount);
    if (isNaN(val) || val <= 0) return alert("올바른 금액을 입력하세요.");
    if (!targetId) return alert("받는 사람의 ID를 입력하세요.");
    if (user.usdtBalance < val + 9) return alert(`잔고가 부족합니다. (수수료 9 USDT 포함 ${val + 9} USDT 필요)`);

    // Deduct total
    updateUsdt(-(val + 9), { type: 'P2P_SEND', amount: val, status: 'COMPLETED', details: `To: ${targetId}` });
    addTransaction({ type: 'FEE', amount: 9, status: 'COMPLETED', details: `P2P 송금 수수료 차감 (시스템 회수)` });

    alert(`[시스템] '${targetId}' 님에게 ${val} USDT를 송금했습니다. (수수료 9 USDT 차감)`);
    setAmount('');
    setTargetId('');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 text-white mb-8 shadow-xl flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
             <Wallet size={32} className="text-green-400"/> 내 지갑 (USDT)
           </h1>
           <p className="text-gray-400">UID: {user.id}</p>
        </div>
        <div className="text-right">
           <div className="text-sm text-gray-400 font-bold mb-1">사용 가능 잔액</div>
           <div className="text-5xl font-black text-green-400">{user.usdtBalance.toFixed(2)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Actions */}
        <div className="md:col-span-5 space-y-6">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="flex border-b border-gray-200">
               <button onClick={() => setActiveTab('DEPOSIT')} className={`flex-1 py-4 font-bold text-sm ${activeTab === 'DEPOSIT' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>입금</button>
               <button onClick={() => setActiveTab('WITHDRAWAL')} className={`flex-1 py-4 font-bold text-sm ${activeTab === 'WITHDRAWAL' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>출금</button>
               <button onClick={() => setActiveTab('P2P')} className={`flex-1 py-4 font-bold text-sm ${activeTab === 'P2P' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>송금</button>
             </div>

             <div className="p-6">
                 {activeTab === 'DEPOSIT' && (
                   <div className="space-y-4">
                     <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm mb-4">
                       <strong>USDT-TRC20 입금</strong><br/>아래 주소로 실제 입금한 뒤 신청하면 확인 후 잔고에 반영됩니다.
                     </div>
                     <label className="block text-sm font-bold text-gray-700">입금 받을 USDT 지갑 주소</label>
                     <div className="flex gap-2">
                       <input type="text" value={depositAddress} onChange={(event) => setDepositAddress(event.target.value)} className="min-w-0 flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="TRC20 지갑 주소를 입력하세요" />
                       <button type="button" onClick={() => void navigator.clipboard?.writeText(depositAddress)} className="rounded-xl bg-gray-200 px-3 text-gray-700 hover:bg-gray-300" aria-label="지갑 주소 복사"><Copy size={17} /></button>
                     </div>
                     {depositAddress ? <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(depositAddress)}`} alt="USDT 입금 지갑 QR 코드" className="h-44 w-44 rounded-lg" /><p className="break-all text-center text-[11px] text-gray-500">{depositAddress}</p></div> : <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">지갑 주소를 입력하면 QR 코드가 표시됩니다.</div>}
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
                    <label className="block text-sm font-bold text-gray-700">출금할 주소 (USDT-TRC20)</label>
                    <input type="text" value={targetId} onChange={e=>setTargetId(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="T..." />
                    
                    <label className="block text-sm font-bold text-gray-700 mt-4">출금할 금액 (USDT)</label>
                    <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="100" />
                    
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
                    <label className="block text-sm font-bold text-gray-700">받는 사람 아이디 (UID)</label>
                    <div className="flex gap-2">
                      <input type="text" value={targetId} onChange={e=>setTargetId(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm" placeholder="user_12345" />
                      <button className="bg-gray-200 text-gray-700 px-4 rounded-xl font-bold hover:bg-gray-300">검색</button>
                    </div>

                    <label className="block text-sm font-bold text-gray-700 mt-4">보낼 금액 (USDT)</label>
                    <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-blue-500 outline-none" placeholder="50" />
                    
                    <div className="text-right text-sm text-gray-500">
                      총 차감 예상액: <span className="font-bold text-red-600">{Number(amount) > 0 ? Number(amount) + 9 : 0} USDT</span>
                    </div>
                    <button onClick={handleP2P} className="w-full bg-orange-500 text-white font-bold py-3 rounded-xl hover:bg-orange-600 transition">송금하기</button>
                  </div>
                )}
             </div>
           </div>
        </div>

        {/* History */}
        <div className="md:col-span-7">
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col">
             <div className="p-6 border-b border-gray-100">
               <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                 <History size={20} className="text-blue-600"/> 거래 내역 (History)
               </h2>
             </div>
             
             <div className="flex-1 overflow-y-auto p-2">
               {transactions.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-gray-400 p-10">
                    <History size={48} className="mb-4 opacity-50"/>
                    <p>거래 내역이 없습니다.</p>
                 </div>
               ) : (
                 <ul className="divide-y divide-gray-100">
                   {transactions.map((tx) => (
                     <li key={tx.id} className="p-4 hover:bg-gray-50 transition-colors">
                       <div className="flex justify-between items-start mb-1">
                         <div className="flex items-center gap-2">
                            {tx.type === 'DEPOSIT' && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded">입금</span>}
                            {tx.type === 'WITHDRAWAL' && <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">출금</span>}
                            {tx.type === 'P2P_SEND' && <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded">송금(발신)</span>}
                            {tx.type === 'FEE' && <span className="text-xs font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">수수료</span>}
                            {tx.type === 'GAME' && <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">게임</span>}
                            
                            <span className="text-sm font-medium text-gray-800">{tx.details}</span>
                         </div>
                         <div className={`font-black ${tx.type === 'DEPOSIT' || tx.type === 'GAME' && tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {tx.type === 'DEPOSIT' || (tx.type === 'GAME' && tx.amount > 0) ? '+' : '-'}{tx.amount} USDT
                         </div>
                       </div>
                       <div className="flex justify-between items-center text-xs text-gray-500">
                         <span>{tx.date} • ID: {tx.id}</span>
                         <span className={`font-bold ${tx.status === 'PENDING' ? 'text-orange-500' : tx.status === 'COMPLETED' ? 'text-green-500' : 'text-gray-500'}`}>
                           {tx.status}
                         </span>
                       </div>
                     </li>
                   ))}
                 </ul>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
