'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Send, Users } from 'lucide-react';
import { createDocument, deleteExpiredChatMessages, getOnlineCount, getSessionToken, queryDocumentsWhere } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';
import { usePathname } from 'next/navigation';

type ChatMessage = {
  id: string;
  authorId: string;
  user: string;
  country?: string;
  text: string;
  createdAt: string;
  expiresAt?: string | Date;
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function GlobalChat() {
  const { user, selectedCountry } = useGlobalStore();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let lastCleanupAt = 0;
    const load = async () => {
      const token = getSessionToken();
      if (token && Date.now() - lastCleanupAt > 30_000) {
        lastCleanupAt = Date.now();
        await deleteExpiredChatMessages(token).catch(() => undefined);
      }
      await Promise.all([
        queryDocumentsWhere<Omit<ChatMessage, 'id'>>('chatMessages', [{ field: 'expiresAt', op: 'GREATER_THAN', value: new Date() }], token, 100)
          .then((nextMessages) => {
            if (!active) return;
            setMessages(nextMessages.filter((message) => message.authorId).filter((message) => !message.expiresAt || new Date(message.expiresAt).getTime() > Date.now()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-100));
          })
          .catch(() => undefined),
        getOnlineCount().then((count) => { if (active) setOnlineCount(count); }).catch(() => undefined),
      ]);
    };
    void load();
    const interval = window.setInterval(load, 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !user) return;
    const token = getSessionToken();
    if (!token) return;
    const message = {
      authorId: user.id,
      user: user.name,
      country: selectedCountry === 'Global' ? 'Global' : selectedCountry,
      text: input.trim(),
      createdAt: new Date().toISOString(),
       expiresAt: new Date(Date.now() + 60 * 1000),
    };
    try {
      const id = crypto.randomUUID();
      await createDocument('chatMessages', id, message, token);
      setMessages((current) => [...current, { ...message, id }].slice(-100));
      setInput('');
    } catch {
      window.alert('메시지를 보내지 못했습니다. 다시 시도해주세요.');
    }
  };

  if (pathname === '/games' || pathname.startsWith('/webrtc') || pathname.startsWith('/theater')) return null;

  return (
    <>
    <aside className="fixed bottom-0 right-0 top-16 z-40 hidden w-80 flex-col border-l border-white/10 bg-[#0a1120] shadow-2xl lg:flex">
       <div className="border-b border-white/8 bg-[#0d1628] p-4">
         <div className="flex items-center justify-between gap-3">
           <div><div className="flex items-center gap-2 font-black text-white"><MessageCircle size={17} className="text-teal-300" /> 실시간 라운지</div><p className="mt-1 text-[11px] text-slate-500">지역에 관계없이 연결된 교민들</p></div>
         <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-300">
           <Users size={12} />
           <span>{onlineCount}명 접속중</span>
         </div>
         </div>
       </div>

       <div className="flex-1 space-y-4 overflow-y-auto p-4">
         {messages.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">아직 대화가 없습니다.</p>}
         {messages.map((message) => (
           <div key={message.id} className="text-sm">
             <div className="mb-1 flex items-baseline gap-1.5">
               <span className="font-bold text-slate-200">{message.user}</span>
               <span className="rounded bg-teal-300/10 px-1.5 text-[10px] font-bold text-teal-200">{message.country || 'Global'}</span>
               <span className="text-xs text-slate-600">{formatTime(message.createdAt)}</span>
             </div>
             <div className="break-words rounded-xl rounded-tl-none border border-white/8 bg-white/[.06] p-2.5 text-slate-300">
               {message.text}
             </div>
          </div>
        ))}
      </div>

       <div className="border-t border-white/8 bg-[#0d1628] p-4">
        {user ? (
          <form onSubmit={handleSend} className="relative">
             <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="메시지를 입력하세요..."
               className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-4 pr-10 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/20"
            />
             <button type="submit" aria-label="메시지 보내기" className="absolute bottom-1 right-1 top-1 flex w-8 items-center justify-center rounded-full bg-teal-300 text-slate-950 transition-colors hover:bg-teal-200">
              <Send size={14} />
            </button>
          </form>
        ) : (
           <div className="rounded-xl border border-white/8 bg-white/5 p-3 text-center text-sm font-medium text-slate-500">로그인 후 채팅에 참여하세요.</div>
        )}
      </div>
    </aside>
     <div className="fixed bottom-3 left-3 right-3 z-40 lg:hidden">
      {mobileOpen && <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10182b]">
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto p-3">
          {messages.length === 0 && <p className="py-4 text-center text-xs text-slate-400">아직 대화가 없습니다.</p>}
          {messages.slice(-8).map((message) => <div key={message.id} className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-white/5"><b>{message.user}</b><span className="ml-2 text-[10px] text-slate-400">{message.country || 'Global'}</span><p className="mt-1 break-words text-slate-600 dark:text-slate-300">{message.text}</p></div>)}
        </div>
        {user ? <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-2 dark:border-white/10"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="라운지에 메시지..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-white/10 dark:bg-black/20" /><button className="rounded-xl bg-blue-600 px-3 text-xs font-black text-white">전송</button></form> : <p className="border-t border-slate-200 p-3 text-center text-xs text-slate-500 dark:border-white/10">로그인 후 채팅에 참여하세요.</p>}
      </div>}
       <button onClick={() => setMobileOpen((open) => !open)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#10182b]/95 px-4 py-3 text-sm font-black text-white shadow-xl backdrop-blur"><span>실시간 라운지</span><span className="rounded-full bg-emerald-300/10 px-2 py-1 text-xs text-emerald-300">{onlineCount}명 접속중</span></button>
    </div>
    </>
  );
}
'use client';

import { useEffect, useState } from 'react';
import { Send, Users } from 'lucide-react';
import { createDocument, deleteExpiredChatMessages, getOnlineCount, getSessionToken, queryDocumentsWhere } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';
import { usePathname } from 'next/navigation';

type ChatMessage = {
  id: string;
  authorId: string;
  user: string;
  country?: string;
  text: string;
  createdAt: string;
  expiresAt?: string | Date;
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function GlobalChat() {
  const { user, selectedCountry } = useGlobalStore();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let active = true;
    let lastCleanupAt = 0;
    const load = async () => {
      const token = getSessionToken();
      if (token && Date.now() - lastCleanupAt > 30_000) {
        lastCleanupAt = Date.now();
        await deleteExpiredChatMessages(token).catch(() => undefined);
      }
      await Promise.all([
        queryDocumentsWhere<Omit<ChatMessage, 'id'>>('chatMessages', [{ field: 'expiresAt', op: 'GREATER_THAN', value: new Date() }], token, 100)
          .then((nextMessages) => {
            if (!active) return;
            setMessages(nextMessages.filter((message) => message.authorId).filter((message) => !message.expiresAt || new Date(message.expiresAt).getTime() > Date.now()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).slice(-100));
          })
          .catch(() => undefined),
        getOnlineCount().then((count) => { if (active) setOnlineCount(count); }).catch(() => undefined),
      ]);
    };
    void load();
    const interval = window.setInterval(load, 1500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !user) return;
    const token = getSessionToken();
    if (!token) return;
    const message = {
      authorId: user.id,
      user: user.name,
      country: selectedCountry === 'Global' ? 'Global' : selectedCountry,
      text: input.trim(),
      createdAt: new Date().toISOString(),
       expiresAt: new Date(Date.now() + 60 * 1000),
    };
    try {
      const id = crypto.randomUUID();
      await createDocument('chatMessages', id, message, token);
      setMessages((current) => [...current, { ...message, id }].slice(-100));
      setInput('');
    } catch {
      window.alert('메시지를 보내지 못했습니다. 다시 시도해주세요.');
    }
  };

  if (pathname === '/games') return null;

  return (
    <>
    <aside className="fixed top-0 left-0 bottom-0 w-80 bg-white border-r border-gray-200 flex-col z-40 hidden lg:flex shadow-lg pt-16">
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="font-black text-gray-800">글로벌 라운지</div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
          <Users size={12} />
          <span>{onlineCount}명 접속중</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 && <p className="text-center text-sm text-gray-400 py-8">아직 대화가 없습니다.</p>}
        {messages.map((message) => (
          <div key={message.id} className="text-sm">
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-bold text-gray-700">{message.user}</span>
               <span className="text-[10px] font-bold px-1.5 rounded bg-blue-100 text-blue-700">{message.country || 'Global'}</span>
              <span className="text-xs text-gray-400">{formatTime(message.createdAt)}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl rounded-tl-none shadow-sm border border-gray-100 text-gray-800 break-words">
              {message.text}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        {user ? (
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="메시지를 입력하세요..."
              className="w-full bg-gray-100 border border-gray-200 rounded-full pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <button type="submit" aria-label="메시지 보내기" className="absolute right-1 top-1 bottom-1 w-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
              <Send size={14} />
            </button>
          </form>
        ) : (
          <div className="text-center p-3 bg-gray-100 rounded-lg text-sm text-gray-500 font-medium">로그인 후 채팅에 참여하세요.</div>
        )}
      </div>
    </aside>
    <div className="fixed bottom-3 left-3 right-3 z-40 lg:hidden">
      {mobileOpen && <div className="mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#10182b]">
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto p-3">
          {messages.length === 0 && <p className="py-4 text-center text-xs text-slate-400">아직 대화가 없습니다.</p>}
          {messages.slice(-8).map((message) => <div key={message.id} className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-white/5"><b>{message.user}</b><span className="ml-2 text-[10px] text-slate-400">{message.country || 'Global'}</span><p className="mt-1 break-words text-slate-600 dark:text-slate-300">{message.text}</p></div>)}
        </div>
        {user ? <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-2 dark:border-white/10"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="라운지에 메시지..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-white/10 dark:bg-black/20" /><button className="rounded-xl bg-blue-600 px-3 text-xs font-black text-white">전송</button></form> : <p className="border-t border-slate-200 p-3 text-center text-xs text-slate-500 dark:border-white/10">로그인 후 채팅에 참여하세요.</p>}
      </div>}
      <button onClick={() => setMobileOpen((open) => !open)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm font-black text-slate-800 shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#10182b]/95 dark:text-white"><span>글로벌 라운지</span><span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">{onlineCount}명 접속중</span></button>
    </div>
    </>
  );
}
