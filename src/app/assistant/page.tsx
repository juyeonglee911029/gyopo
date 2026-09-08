'use client';

import { FormEvent, useState } from 'react';
import { Bot, Send, Sparkles, UserRound } from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '안녕하세요. 국가별 생활정보, 교민 뉴스, 여행, 이민, 거래 관련 질문을 한국어로 답해드릴게요.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const question = input.trim();
    if (!question || loading) return;
    const next = [...messages, { role: 'user' as const, content: question }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const response = await fetch('/api/assistant', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      const data = await response.json() as { answer?: string; error?: string };
      setMessages((current) => [...current, { role: 'assistant', content: data.answer || data.error || '답변을 가져오지 못했습니다.' }]);
    } catch {
      setMessages((current) => [...current, { role: 'assistant', content: 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#080d1c] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-128px)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#10182b] shadow-2xl">
        <header className="border-b border-white/10 bg-[radial-gradient(circle_at_top_right,#164e63,#10182b_52%)] p-5 sm:p-7">
          <div className="flex items-center gap-3"><span className="rounded-2xl bg-cyan-300/15 p-3 text-cyan-200"><Sparkles size={23} /></span><div><p className="text-xs font-black uppercase tracking-[.25em] text-cyan-300">GYOPO AI</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">글로벌 정보 도우미</h1></div></div>
           <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">교민 생활과 국가별 정보를 질문하세요. 답변은 참고용이며 포털에 정리된 최신 정보와 함께 확인하세요.</p>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-7">
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><span className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${message.role === 'user' ? 'order-2 bg-cyan-300 text-slate-950' : 'bg-white/10 text-cyan-200'}`}>{message.role === 'user' ? <UserRound size={16} /> : <Bot size={17} />}</span><div className={`max-w-[min(90%,680px)] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-7 ${message.role === 'user' ? 'order-1 bg-cyan-300 font-bold text-slate-950' : 'border border-white/10 bg-white/[.05] text-slate-200'}`}>{message.content}</div></div>)}
          {loading && <div className="flex items-center gap-2 text-sm text-slate-500"><Bot size={17} className="text-cyan-300" /> 답변을 작성하고 있습니다...</div>}
        </div>
        <form onSubmit={ask} className="border-t border-white/10 bg-[#0d1628] p-4 sm:p-5"><div className="flex gap-2 rounded-2xl border border-white/10 bg-black/20 p-2 focus-within:border-cyan-300/50"><input value={input} onChange={(event) => setInput(event.target.value)} disabled={loading} placeholder="예: 브라질 교민이 알아야 할 오늘의 생활 정보를 알려줘" className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-600" /><button disabled={loading || !input.trim()} aria-label="AI 질문 보내기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:opacity-40"><Send size={17} /></button></div></form>
      </div>
    </div>
  );
}
