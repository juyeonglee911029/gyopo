'use client';

import { useEffect, useReducer, useRef, useState, type FormEvent, type CSSProperties } from 'react';
import { Gamepad2, MessageCircle, Pause, Play, RotateCw, Send, Users } from 'lucide-react';
import { deleteExpiredChatMessages, getSessionToken, listDocuments, listOnlineUsers, OnlineUser, upsertDocument } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

const WIDTH = 10;
const HEIGHT = 20;
const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
  [[1, 1, 0], [0, 1, 1]],
];
const COLORS = ['#2dd4bf', '#facc15', '#c084fc', '#60a5fa', '#fb923c', '#f472b6', '#4ade80'];
type Piece = { type: number; shape: number[][]; x: number; y: number };
type ChatMessage = { id: string; authorId: string; user: string; country?: string; text: string; createdAt: string; expiresAt?: string | Date };
type GameState = { board: number[][]; piece: Piece; nextPiece: Piece; running: boolean; paused: boolean; score: number; lines: number; notice: string; noticeId: number };
type GameAction =
  | { type: 'START' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'MOVE'; dx: number; dy: number }
  | { type: 'ROTATE' }
  | { type: 'DROP' };

const emptyBoard = () => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(0));
const cloneShape = (shape: number[][]) => shape.map((row) => [...row]);
const clonePiece = (piece: Piece): Piece => ({ ...piece, shape: cloneShape(piece.shape) });
const randomPiece = (): Piece => {
  const type = Math.floor(Math.random() * SHAPES.length);
  return { type, shape: cloneShape(SHAPES[type]), x: 3, y: 0 };
};
const rotate = (shape: number[][]) => shape[0].map((_, index) => shape.map((row) => row[index]).reverse());
const collides = (board: number[][], piece: Piece, dx = 0, dy = 0, shape = piece.shape) => shape.some((row, y) => row.some((cell, x) => {
  if (!cell) return false;
  const nextX = piece.x + x + dx;
  const nextY = piece.y + y + dy;
  return nextX < 0 || nextX >= WIDTH || nextY >= HEIGHT || (nextY >= 0 && Boolean(board[nextY]?.[nextX]));
}));

const createGame = (): GameState => ({ board: emptyBoard(), piece: randomPiece(), nextPiece: randomPiece(), running: false, paused: false, score: 0, lines: 0, notice: '', noticeId: 0 });

function lockPiece(state: GameState, landed: Piece): GameState {
  const merged = state.board.map((row) => [...row]);
  landed.shape.forEach((row, y) => row.forEach((cell, x) => {
    if (cell && landed.y + y >= 0 && landed.y + y < HEIGHT) merged[landed.y + y][landed.x + x] = landed.type + 1;
  }));
  const kept = merged.filter((row) => row.some((cell) => !cell));
  const cleared = HEIGHT - kept.length;
  const nextBoard = [...Array.from({ length: cleared }, () => Array(WIDTH).fill(0)), ...kept];
  const spawned = { ...clonePiece(state.nextPiece), x: 3, y: 0 };
  const gameOver = collides(nextBoard, spawned);
  const points = [0, 100, 300, 500, 800][cleared];
  return {
    ...state,
    board: nextBoard,
    piece: spawned,
    nextPiece: randomPiece(),
    running: !gameOver,
    score: state.score + points,
    lines: state.lines + cleared,
    notice: gameOver ? '게임 오버 · 새 게임을 시작하세요' : cleared ? `${cleared}줄 클리어 · +${points}` : '',
    noticeId: Date.now(),
  };
}

function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === 'START') return { ...createGame(), running: true, notice: '게임 시작 · 방향키로 조작하세요', noticeId: Date.now() };
  if (action.type === 'TOGGLE_PAUSE') return state.running ? { ...state, paused: !state.paused } : state;
  if (!state.running || state.paused) return state;
  if (action.type === 'ROTATE') {
    const rotated = rotate(state.piece.shape);
    return collides(state.board, state.piece, 0, 0, rotated) ? state : { ...state, piece: { ...state.piece, shape: rotated } };
  }
  if (action.type === 'DROP') {
    let distance = 0;
    while (!collides(state.board, state.piece, 0, distance + 1)) distance += 1;
    return lockPiece(state, { ...state.piece, y: state.piece.y + distance });
  }
  if (!collides(state.board, state.piece, action.dx, action.dy)) return { ...state, piece: { ...state.piece, x: state.piece.x + action.dx, y: state.piece.y + action.dy } };
  return action.dy === 1 ? lockPiece(state, state.piece) : state;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function GamesPage() {
  const user = useGlobalStore((state) => state.user);
  const [game, dispatch] = useReducer(gameReducer, undefined, createGame);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const toastTimer = useRef<number | null>(null);
  const firstChatLoad = useRef(true);
  const lastMessageId = useRef<string | null>(null);
  const lastChatCleanup = useRef(0);

  const showToast = (text: string) => {
    setToast({ id: Date.now(), text });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4200);
  };

  useEffect(() => {
    if (game.notice) showToast(game.notice);
  }, [game.noticeId]);

  useEffect(() => {
    const load = async () => setOnlineUsers(await listOnlineUsers().catch(() => []));
    void load();
    const timer = window.setInterval(load, 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      const token = getSessionToken();
      if (token && Date.now() - lastChatCleanup.current > 30_000) {
        lastChatCleanup.current = Date.now();
        await deleteExpiredChatMessages(token).catch(() => undefined);
      }
      const next = (await listDocuments<Omit<ChatMessage, 'id'>>('chatMessages', token).catch(() => []))
        .filter((message) => message.authorId)
        .filter((message) => !message.expiresAt || new Date(message.expiresAt).getTime() > Date.now())
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(-24);
      const latest = next[next.length - 1];
      if (!firstChatLoad.current && latest && latest.id !== lastMessageId.current) showToast(`${latest.user}: ${latest.text}`);
      firstChatLoad.current = false;
      lastMessageId.current = latest?.id || null;
      setMessages(next);
    };
    void load();
    const timer = window.setInterval(load, 1500);
    return () => window.clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!game.running) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); dispatch({ type: 'MOVE', dx: -1, dy: 0 }); }
      if (event.key === 'ArrowRight') { event.preventDefault(); dispatch({ type: 'MOVE', dx: 1, dy: 0 }); }
      if (event.key === 'ArrowDown') { event.preventDefault(); dispatch({ type: 'MOVE', dx: 0, dy: 1 }); }
      if (event.key === 'ArrowUp') { event.preventDefault(); dispatch({ type: 'ROTATE' }); }
      if (event.key === ' ') { event.preventDefault(); dispatch({ type: 'DROP' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.running]);

  useEffect(() => {
    if (!game.running || game.paused) return;
    const timer = window.setInterval(() => dispatch({ type: 'MOVE', dx: 0, dy: 1 }), Math.max(180, 850 - Math.floor(game.lines / 5) * 45));
    return () => window.clearInterval(timer);
  }, [game.running, game.paused, game.lines]);

  const start = () => {
    if (!user) return window.alert('로그인 후 게임을 시작할 수 있습니다.');
    dispatch({ type: 'START' });
  };

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !chatInput.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    const message = { authorId: user.id, user: user.name, country: user.country || 'Global', text: chatInput.trim(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3 * 60 * 1000) };
    try {
      await upsertDocument('chatMessages', crypto.randomUUID(), message, token);
      setChatInput('');
      showToast(`${user.name}: ${message.text}`);
    } catch {
      window.alert('메시지를 보내지 못했습니다. 다시 시도해주세요.');
    }
  };

  const visual = game.board.map((row) => [...row]);
  let ghostDistance = 0;
  while (!collides(game.board, game.piece, 0, ghostDistance + 1)) ghostDistance += 1;
  const ghostY = game.piece.y + ghostDistance;
  game.piece.shape.forEach((row, y) => row.forEach((cell, x) => {
    if (!cell) return;
    if (ghostY + y >= 0 && ghostY + y < HEIGHT && !visual[ghostY + y][game.piece.x + x]) visual[ghostY + y][game.piece.x + x] = -1;
    if (game.piece.y + y >= 0 && game.piece.y + y < HEIGHT) visual[game.piece.y + y][game.piece.x + x] = game.piece.type + 1;
  }));

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#070b17] px-4 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300"><Gamepad2 size={16} /> Arcade live</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">GLOBAL TETRIS</h1><p className="mt-2 text-sm text-slate-400">실제 접속 회원과 채팅하며 즐기는 싱글 테트리스</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><Users size={16} className="text-emerald-300" /><b>{onlineUsers.length}</b><span className="text-slate-400">실시간 인증 회원</span></div></header>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[2rem] border border-white/10 bg-[#10182b] p-4 shadow-2xl md:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-widest text-slate-500">Current run</span><div className="mt-1 text-lg font-black">{user?.name || '로그인 필요'}</div></div><div className="flex gap-6 text-right"><div><div className="text-[10px] font-bold text-slate-500">SCORE</div><b className="text-xl text-cyan-300">{game.score.toLocaleString()}</b></div><div><div className="text-[10px] font-bold text-slate-500">LINES</div><b className="text-xl text-emerald-300">{game.lines}</b></div></div></div>
            <div className="relative mx-auto max-w-[360px] rounded-3xl border border-cyan-300/30 bg-[#050914] p-3 shadow-[0_0_60px_rgba(34,211,238,0.14)]"><div className="grid grid-cols-10 gap-1 rounded-2xl bg-[#0b1221] p-2">{visual.flatMap((row, y) => row.map((cell, x) => <div key={`${x}-${y}`} className={`aspect-square rounded-[4px] border ${cell === 0 ? 'border-white/[0.05] bg-white/[0.025]' : cell === -1 ? 'border-2 border-dashed border-cyan-100/60 bg-cyan-200/10' : 'border-white/50 shadow-[inset_0_2px_0_rgba(255,255,255,.55),0_0_12px_var(--cell)]'}`} style={cell > 0 ? ({ '--cell': COLORS[cell - 1], backgroundColor: COLORS[cell - 1] } as CSSProperties) : undefined} />))}</div>{toast && <div key={toast.id} className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-2xl border border-cyan-200/30 bg-slate-950/90 px-5 py-3 text-sm font-black text-cyan-100 shadow-2xl animate-[portal-toast_4.2s_ease-out_forwards]">{toast.text}</div>}</div>
            <div className="mx-auto mt-4 flex max-w-[360px] items-center justify-between gap-2"><button onClick={start} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300"><Play size={15} className="mr-1 inline" />{game.running ? '새 게임' : '게임 시작'}</button><button onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })} disabled={!game.running} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-30">{game.paused ? <Play size={15} className="mr-1 inline" /> : <Pause size={15} className="mr-1 inline" />}{game.paused ? '계속' : '일시정지'}</button><button onClick={() => dispatch({ type: 'ROTATE' })} disabled={!game.running || game.paused} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold disabled:opacity-30"><RotateCw size={15} className="mr-1 inline" />회전</button></div><div className="mt-3 text-center text-[11px] text-slate-500">← → 이동 · ↓ 내리기 · ↑ 회전 · Space 즉시 내리기</div>
          </section>
          <aside className="space-y-5"><section className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Next block</div><div className="grid w-24 grid-cols-4 gap-1 rounded-xl bg-black/20 p-2">{Array.from({ length: 16 }, (_, i) => { const x = i % 4; const y = Math.floor(i / 4); return <div key={i} className="aspect-square rounded" style={game.nextPiece.shape[y]?.[x] ? { backgroundColor: COLORS[game.nextPiece.type] } : undefined} />; })}</div><p className="mt-4 text-sm text-slate-400">실제 인증 회원과 보이는 메시지만 표시합니다.</p></section>
            <section className="flex min-h-[360px] flex-col rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-black"><MessageCircle size={17} className="text-cyan-300" /> 실시간 메시지</div><span className="text-[10px] font-bold text-emerald-300">LIVE</span></div><div className="flex-1 space-y-3 overflow-y-auto pr-1">{messages.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">아직 메시지가 없습니다.</p> : messages.map((message) => <div key={message.id} className="rounded-2xl bg-white/[0.045] p-3"><div className="mb-1 flex justify-between gap-2 text-[10px]"><b className="text-cyan-200">{message.user}</b><span className="text-slate-600">{formatTime(message.createdAt)}</span></div><p className="break-words text-sm text-slate-200">{message.text}</p></div>)}</div>{user ? <form onSubmit={sendMessage} className="mt-4 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="게임 중 메시지..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300" /><button aria-label="메시지 보내기" className="rounded-xl bg-cyan-400 px-3 text-slate-950"><Send size={16} /></button></form> : <p className="mt-4 text-center text-xs text-slate-500">로그인 후 참여할 수 있습니다.</p>}</section>
            <section className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 flex items-center gap-2 font-black"><Users size={17} className="text-emerald-300" /> 실제 접속 회원</div>{onlineUsers.length === 0 ? <p className="text-sm text-slate-500">현재 접속 중인 인증 회원이 없습니다.</p> : <div className="space-y-2">{onlineUsers.map((online) => <div key={online.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] p-2.5"><img src={online.image} alt="" className="h-8 w-8 rounded-full object-cover" /><div className="min-w-0"><div className="truncate text-sm font-bold">{online.name}</div><div className="text-[10px] text-emerald-300">● {online.country || '국가 미설정'}</div></div></div>)}</div>}</section></aside>
        </div>
      </div>
    </div>
  );
}
