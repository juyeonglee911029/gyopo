'use client';

import { useEffect, useState } from 'react';
import { Send, Users } from 'lucide-react';
import { getOnlineCount, getSessionToken, listDocuments, createDocument } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type ChatMessage = {
  id: string;
  authorId: string;
  user: string;
  country: string;
  text: string;
  createdAt: string;
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function GlobalChat() {
  const { user, selectedCountry } = useGlobalStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextMessages, nextOnlineCount] = await Promise.all([
          listDocuments<Omit<ChatMessage, 'id'>>('chatMessages', getSessionToken()),
          getOnlineCount(),
        ]);
        if (!active) return;
        setMessages(
          nextMessages
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .slice(-100),
        );
        setOnlineCount(nextOnlineCount);
      } catch {
        // An empty lounge is preferable to blocking the rest of the portal.
      }
    };
    void load();
    const interval = window.setInterval(load, 4000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user]);

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
    };
    try {
      await createDocument('chatMessages', crypto.randomUUID(), message, token);
      setMessages((current) => [...current, { ...message, id: crypto.randomUUID() }].slice(-100));
      setInput('');
    } catch {
      window.alert('메시지를 보내지 못했습니다. 다시 시도해주세요.');
    }
  };

  return (
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
              <span className="text-[10px] font-bold px-1.5 rounded bg-blue-100 text-blue-700">{message.country}</span>
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
  );
}
