'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, PanelRightClose, PanelRightOpen, Send, Users } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createDocument, deleteExpiredChatMessages, getOnlineCount, getSessionToken, queryDocumentsWhere } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

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
  const { user } = useGlobalStore();
  const pathname = usePathname();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);

  const setDesktopLounge = (open: boolean) => {
    setDesktopOpen(open);
    window.dispatchEvent(new CustomEvent('gyopo-lounge-change', { detail: { open } }));
  };

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

  useEffect(() => {
    const openChat = () => {
      setDesktopOpen(true);
      setMobileOpen(true);
    };
    window.addEventListener('gyopo-open-global-chat', openChat);
    return () => window.removeEventListener('gyopo-open-global-chat', openChat);
  }, []);

  if (pathname === '/webrtc') return null;

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || !user) return;
    const token = getSessionToken();
    if (!token) return;
    const message = {
      authorId: user.id,
      user: user.name,
      country: 'Global',
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

  return (
    <>
      <aside id="global-lounge" className={`global-lounge fixed bottom-4 right-4 top-24 z-[240] hidden w-[22rem] flex-col overflow-hidden rounded-3xl border border-cyan-200/15 bg-[#0a1120]/46 shadow-[0_24px_90px_rgba(0,0,0,.35)] backdrop-blur-xl transition-transform duration-300 lg:flex ${desktopOpen ? 'translate-x-0' : 'translate-x-[calc(100%+1rem)]'}`}>
        <div className="border-b border-white/8 bg-[#0d1628]/45 p-4">
         <div className="flex items-center justify-between gap-3">
           <div><div className="flex items-center gap-2 font-black text-white"><MessageCircle size={17} className="text-teal-300" /> 실시간 라운지</div><p className="mt-1 text-[11px] text-slate-500">지역에 관계없이 연결된 교민들</p></div>
         <div className="flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-300">
           <Users size={12} />
           <span>{onlineCount}명 접속중</span>
         </div>
         </div>
       </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {messages.length === 0 && <div className="lounge-empty-mark" aria-hidden="true"><MessageCircle size={18} /></div>}
         {messages.map((message) => (
            <div key={message.id} className="text-[13px] leading-5">
              <div className="mb-0.5 flex items-baseline gap-1.5">
                <span className="font-bold text-slate-200">{message.user}</span>
               <span className="rounded bg-teal-300/10 px-1.5 text-[10px] font-bold text-teal-200">{message.country || 'Global'}</span>
               <span className="text-xs text-slate-600">{formatTime(message.createdAt)}</span>
             </div>
              <div className="break-words rounded-xl rounded-tl-none border border-white/8 bg-white/[.06] px-2.5 py-1.5 text-slate-300">
               {message.text}
             </div>
          </div>
        ))}
      </div>

        <div className="border-t border-white/8 bg-[#0d1628]/45 p-3">
        {user ? (
          <form onSubmit={handleSend} className="relative">
             <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="메시지를 입력하세요..."
                className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-3 pr-10 text-sm text-white outline-none transition-all placeholder:text-slate-600 focus:border-teal-300/50 focus:ring-2 focus:ring-teal-300/20"
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
        <button onClick={() => setDesktopLounge(!desktopOpen)} aria-label={desktopOpen ? '글로벌 라운지 최소화' : '글로벌 라운지 최대화'} title={desktopOpen ? '라운지 최소화' : '라운지 최대화'} className={`fixed bottom-5 z-[250] hidden h-9 w-9 place-items-center rounded-xl border border-cyan-200/15 bg-[#10182b]/52 text-white shadow-2xl backdrop-blur-xl transition-all lg:grid ${desktopOpen ? 'right-[23rem]' : 'right-5'}`}>
         {desktopOpen ? <PanelRightClose size={15} className="text-teal-300" /> : <PanelRightOpen size={15} className="text-teal-300" />}
       </button>
      <div className="fixed bottom-3 left-3 right-3 z-40 lg:hidden">
       {mobileOpen && <div className="mb-2 overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#10182b]/48">
        <div className="flex max-h-56 flex-col gap-2 overflow-y-auto p-3">
           {messages.length === 0 && <div className="lounge-empty-mark" aria-hidden="true"><MessageCircle size={16} /></div>}
          {messages.slice(-8).map((message) => <div key={message.id} className="rounded-xl bg-slate-50 p-2 text-xs dark:bg-white/5"><b>{message.user}</b><span className="ml-2 text-[10px] text-slate-400">{message.country || 'Global'}</span><p className="mt-1 break-words text-slate-600 dark:text-slate-300">{message.text}</p></div>)}
        </div>
        {user ? <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-2 dark:border-white/10"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="라운지에 메시지..." className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-white/10 dark:bg-black/20" /><button className="rounded-xl bg-blue-600 px-3 text-xs font-black text-white">전송</button></form> : <p className="border-t border-slate-200 p-3 text-center text-xs text-slate-500 dark:border-white/10">로그인 후 채팅에 참여하세요.</p>}
      </div>}
         <button onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? '실시간 라운지 최소화' : '실시간 라운지 최대화'} className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-cyan-200/15 bg-[#10182b]/52 text-white shadow-xl backdrop-blur"><MessageCircle size={17} className="text-teal-300" /></button>
    </div>
    </>
  );
}
