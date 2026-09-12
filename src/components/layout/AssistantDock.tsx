'use client';

import { type FormEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { GripHorizontal, Minus, Send, Sparkles, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

type Message = { role: 'user' | 'assistant'; content: string };
type DockPosition = { left: number; top: number };

const POSITION_KEY = 'gyopo-assistant-dock-position';
const INITIAL_MESSAGE: Message = { role: 'assistant', content: '안녕하세요. GYOPO AI입니다. 국가별 생활정보부터 일반적인 질문까지 도와드릴게요.' };

export default function AssistantDock() {
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null);
  const [open, setOpen] = useState(pathname === '/assistant');
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<DockPosition | null>(null);
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(POSITION_KEY) || 'null') as DockPosition | null;
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) setPosition(saved);
    } catch {
      setPosition(null);
    }
  }, []);

  useEffect(() => {
    if (pathname === '/assistant') {
      setOpen(true);
      setMinimized(false);
    }
  }, [pathname]);

  useEffect(() => {
    const openAssistant = () => {
      setOpen((value) => !value);
      setMinimized(false);
    };
    window.addEventListener('gyopo-assistant-open', openAssistant);
    return () => window.removeEventListener('gyopo-assistant-open', openAssistant);
  }, []);

  const positionStyle = position ? { left: position.left, top: position.top } : undefined;

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('button, input, textarea')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, width: rect.width, height: rect.height };
    setPosition({ left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPosition({
      left: Math.max(8, Math.min(window.innerWidth - drag.width - 8, event.clientX - drag.offsetX)),
      top: Math.max(72, Math.min(window.innerHeight - drag.height - 8, event.clientY - drag.offsetY)),
    });
  };

  const stopDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (drag) {
      const nextPosition = {
        left: Math.max(8, Math.min(window.innerWidth - drag.width - 8, event.clientX - drag.offsetX)),
        top: Math.max(72, Math.min(window.innerHeight - drag.height - 8, event.clientY - drag.offsetY)),
      };
      setPosition(nextPosition);
      window.localStorage.setItem(POSITION_KEY, JSON.stringify(nextPosition));
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

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

  if (!open) return null;

  if (minimized) {
    return <button type="button" className="assistant-dock-tab" style={positionStyle} onClick={() => setMinimized(false)} aria-label="GYOPO AI 다시 열기"><Sparkles size={14} /><span>AI</span></button>;
  }

  return (
    <aside ref={panelRef} className="assistant-dock" style={positionStyle} aria-label="GYOPO AI">
      <header className="assistant-dock-header" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <div className="assistant-dock-title"><span className="assistant-dock-mark"><Sparkles size={14} /></span><span>GYOPO AI</span><GripHorizontal size={15} className="assistant-dock-grip" /></div>
        <div className="assistant-dock-actions"><button type="button" onClick={() => setMinimized(true)} aria-label="AI 최소화"><Minus size={15} /></button><button type="button" onClick={() => setOpen(false)} aria-label="AI 닫기"><X size={15} /></button></div>
      </header>
      <div className="assistant-dock-messages">
        {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`assistant-dock-message ${message.role === 'user' ? 'assistant-dock-message-user' : ''}`}>{message.content}</div>)}
        {loading && <div className="assistant-dock-loading"><span /> <span /> <span /></div>}
      </div>
      <form onSubmit={ask} className="assistant-dock-form"><input value={input} onChange={(event) => setInput(event.target.value)} disabled={loading} placeholder="무엇이든 질문하세요" aria-label="AI 질문" /><button type="submit" disabled={loading || !input.trim()} aria-label="AI 질문 보내기"><Send size={15} /></button></form>
    </aside>
  );
}
