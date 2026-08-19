'use client';

import { useState } from 'react';
import { Send, Users } from 'lucide-react';
import { useGlobalStore } from '@/store/useGlobalStore';

// Mock data for chat
const initialMessages = [
  { id: 1, user: '알렉스', country: 'US', time: '10:30', text: '뉴욕 오늘 날씨 엄청 춥네요 ㅠㅠ' },
  { id: 2, user: '도쿄토끼', country: 'JP', time: '10:32', text: '여긴 벚꽃 피기 시작했어요!' },
  { id: 3, user: '워킹홀리', country: 'AU', time: '10:33', text: '시드니 룸쉐어 구하시는 분 계신가요?' },
];

export default function GlobalChat() {
  const { user, selectedCountry } = useGlobalStore();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const newMsg = {
      id: Date.now(),
      user: user.name,
      country: selectedCountry === 'Global' ? 'KR' : selectedCountry, // Default fallback
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: input
    };

    setMessages([...messages, newMsg]);
    setInput('');
  };

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-80 bg-white border-r border-gray-200 flex flex-col z-40 hidden lg:flex shadow-lg pt-16">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="font-black text-gray-800 flex items-center gap-2">
          <span>글로벌 라운지</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">
          <Users size={12} />
          <span>1,204 명 접속중</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className="text-sm">
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="font-bold text-gray-700">{msg.user}</span>
              <span className="text-[10px] font-bold px-1.5 rounded bg-blue-100 text-blue-700">{msg.country}</span>
              <span className="text-xs text-gray-400">{msg.time}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl rounded-tl-none shadow-sm border border-gray-100 text-gray-800 break-words">
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        {user ? (
          <form onSubmit={handleSend} className="relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="메시지를 입력하세요..." 
              className="w-full bg-gray-100 border border-gray-200 rounded-full pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            <button 
              type="submit"
              className="absolute right-1 top-1 bottom-1 w-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
            >
              <Send size={14} />
            </button>
          </form>
        ) : (
          <div className="text-center p-3 bg-gray-100 rounded-lg text-sm text-gray-500 font-medium">
            로그인 후 채팅에 참여하세요.
          </div>
        )}
      </div>
    </aside>
  );
}