'use client';

import { useEffect, useReducer, useRef, useState, type FormEvent, type TouchEvent, type CSSProperties } from 'react';
import { Gamepad2, MessageCircle, Pause, Play, RotateCw, Send, Users } from 'lucide-react';
import { claimTetrisMatch, createDocument, deleteDocument, deleteExpiredChatMessages, getDocument, getSessionToken, listDocuments, listOnlineUsers, mergeDocument, OnlineUser, queryDocuments, queryDocumentsWhere, refreshStoredUser, reserveGameStake, upsertDocument, type TetrisQueueProfile } from '@/lib/firebase';
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
const DEFAULT_ENTRY_FEE = 1;
const MIN_ENTRY_FEE = 1;
const MAX_ENTRY_FEE = 100;
type Piece = { type: number; shape: number[][]; x: number; y: number };
type ChatMessage = { id: string; authorId: string; user: string; country?: string; text: string; createdAt: string; expiresAt?: string | Date };
type GameState = { board: number[][]; piece: Piece; nextPiece: Piece; running: boolean; started: boolean; paused: boolean; score: number; lines: number; notice: string; noticeId: number };
type TetrisProfile = { id: string; name: string; image: string; country?: string };
type TetrisLobby = { status?: 'waiting' | 'matched'; waitingUserId?: string; waitingUser?: TetrisProfile; matchId?: string; playerAId?: string; playerBId?: string; playerA?: TetrisProfile; playerB?: TetrisProfile; updatedAt?: string };
type MatchPhase = 'idle' | 'waiting' | 'betting' | 'countdown' | 'playing' | 'finished';
type TetrisInvite = { id: string; senderId: string; recipientId: string; sender: TetrisProfile; recipient: TetrisProfile; matchId: string; status: 'pending' | 'accepted' | 'rejected'; createdAt: string; updatedAt?: string };
type TetrisQueueRecord = TetrisQueueProfile & { userId: string; status: 'waiting' | 'matched'; matchId?: string; role?: 'A' | 'B'; opponent?: TetrisProfile; lastSeenAt: string | Date };
type TetrisRoom = TetrisLobby & {
  phase?: 'betting' | 'countdown' | 'playing' | 'finished';
  betAmount?: number;
  readyA?: boolean;
  readyB?: boolean;
  readyAAt?: string;
  readyBAt?: string;
  startAt?: string;
  startRequestedBy?: string;
  playerAResult?: 'win' | 'lose';
  playerBResult?: 'win' | 'lose';
  playerAState?: GameState;
  playerBState?: GameState;
};
type GameAction =
  | { type: 'START' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'MOVE'; dx: number; dy: number }
  | { type: 'ROTATE' }
  | { type: 'SWAP_NEXT' }
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

const createGame = (): GameState => ({ board: emptyBoard(), piece: randomPiece(), nextPiece: randomPiece(), running: false, started: false, paused: false, score: 0, lines: 0, notice: '', noticeId: 0 });
const buildVisual = (state: GameState) => {
  const visual = state.board.map((row) => [...row]);
  let ghostDistance = 0;
  while (!collides(state.board, state.piece, 0, ghostDistance + 1)) ghostDistance += 1;
  const ghostY = state.piece.y + ghostDistance;
  state.piece.shape.forEach((row, y) => row.forEach((cell, x) => {
    if (!cell) return;
    if (ghostY + y >= 0 && ghostY + y < HEIGHT && !visual[ghostY + y][state.piece.x + x]) visual[ghostY + y][state.piece.x + x] = -1;
    if (state.piece.y + y >= 0 && state.piece.y + y < HEIGHT) visual[state.piece.y + y][state.piece.x + x] = state.piece.type + 1;
  }));
  return visual;
};

function BoardGrid({ cells, compact = false }: { cells: number[][]; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-10 rounded-xl bg-[#0b1221] ${compact ? 'gap-px p-1' : 'gap-1 p-2'}`}>
      {cells.flatMap((row, y) => row.map((cell, x) => (
        <div
          key={`${x}-${y}`}
          className={`aspect-square rounded-[3px] ${compact ? '' : 'md:rounded-[4px]'} ${cell === 0 ? 'border border-white/[0.05] bg-white/[0.025]' : cell === -1 ? 'border border-dashed border-cyan-100/60 bg-cyan-200/10' : 'border-white/50 shadow-[inset_0_2px_0_rgba(255,255,255,.55),0_0_12px_var(--cell)]'}`}
          style={cell > 0 ? ({ '--cell': COLORS[cell - 1], backgroundColor: COLORS[cell - 1] } as CSSProperties) : undefined}
        />
      )))}
    </div>
  );
}

function NextBlock({ piece, compact = false }: { piece: Piece; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-4 rounded-xl bg-black/20 ${compact ? 'gap-px p-1' : 'gap-1 p-2'}`}>
      {Array.from({ length: 16 }, (_, index) => {
        const x = index % 4;
        const y = Math.floor(index / 4);
        return <div key={index} className="aspect-square rounded" style={piece.shape[y]?.[x] ? { backgroundColor: COLORS[piece.type] } : undefined} />;
      })}
    </div>
  );
}

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
  if (action.type === 'START') return { ...createGame(), running: true, started: true, notice: '게임 시작 · 방향키로 조작하세요', noticeId: Date.now() };
  if (action.type === 'TOGGLE_PAUSE') return state.running ? { ...state, paused: !state.paused } : state;
  if (!state.running || state.paused) return state;
  if (action.type === 'ROTATE') {
    const rotated = rotate(state.piece.shape);
    return collides(state.board, state.piece, 0, 0, rotated) ? state : { ...state, piece: { ...state.piece, shape: rotated } };
  }
  if (action.type === 'SWAP_NEXT') {
    const current = { ...clonePiece(state.piece), x: 3, y: 0 };
    const next = { ...clonePiece(state.nextPiece), x: 3, y: 0 };
    if (collides(state.board, next)) return state;
    return { ...state, piece: next, nextPiece: current, notice: '다음 블록으로 교체', noticeId: Date.now() };
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
  const setUser = useGlobalStore((state) => state.setUser);
  const updateUsdt = useGlobalStore((state) => state.updateUsdt);
  const [game, dispatch] = useReducer(gameReducer, undefined, createGame);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchRole, setMatchRole] = useState<'A' | 'B' | null>(null);
  const [opponent, setOpponent] = useState<TetrisProfile | null>(null);
  const [opponentState, setOpponentState] = useState<GameState | null>(null);
  const [matchStatus, setMatchStatus] = useState('대전 준비 안됨');
  const [matchPhase, setMatchPhase] = useState<MatchPhase>('idle');
  const [incomingInvite, setIncomingInvite] = useState<TetrisInvite | null>(null);
  const [sentInviteId, setSentInviteId] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState('');
  const [readyForBattle, setReadyForBattle] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [selectedOnlineUserId, setSelectedOnlineUserId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(DEFAULT_ENTRY_FEE);
  const [stakeReserved, setStakeReserved] = useState(false);
  const [countdown, setCountdown] = useState<number | 'START' | null>(null);
  const [matchResult, setMatchResult] = useState<'WIN' | 'LOSE' | null>(null);
  const [roomStartAt, setRoomStartAt] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const firstChatLoad = useRef(true);
  const lastMessageId = useRef<string | null>(null);
  const lastChatCleanup = useRef(0);
  const queuePollingRef = useRef(false);
  const gameRef = useRef(game);
  const resultSent = useRef(false);
  const gameStartedRef = useRef(false);
  const startRequestedRef = useRef(false);
  const roomCleanupTimer = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

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
        await deleteExpiredChatMessages(token, 'tetrisChatMessages').catch(() => undefined);
      }
      const next = (await queryDocumentsWhere<Omit<ChatMessage, 'id'>>('tetrisChatMessages', [{ field: 'expiresAt', op: 'GREATER_THAN', value: new Date() }], token, 60).catch(() => []))
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
       if (event.key.toLowerCase() === 'c') { event.preventDefault(); dispatch({ type: 'SWAP_NEXT' }); }
      if (event.key === ' ') { event.preventDefault(); dispatch({ type: 'DROP' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.running]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || !game.running || game.paused) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) {
      dispatch({ type: 'DROP' });
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) dispatch({ type: 'MOVE', dx: dx > 0 ? 1 : -1, dy: 0 });
    else if (dy < 0) dispatch({ type: 'ROTATE' });
    else dispatch({ type: 'MOVE', dx: 0, dy: 1 });
  };

  useEffect(() => {
    if (!game.running || game.paused) return;
    const timer = window.setInterval(() => dispatch({ type: 'MOVE', dx: 0, dy: 1 }), Math.max(180, 850 - Math.floor(game.lines / 5) * 45));
    return () => window.clearInterval(timer);
  }, [game.running, game.paused, game.lines]);

  const updateRoom = async (patch: Record<string, unknown>) => {
    if (!matchId || !matchRole || !user) throw new Error('대전 방 정보가 없습니다.');
    const token = getSessionToken();
    if (!token) throw new Error('로그인 세션이 만료되었습니다.');
    const profile: TetrisProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
    await mergeDocument('tetrisRooms', matchId, {
      ...patch,
      matchId,
      ...(matchRole === 'A' ? { playerAId: user.id, playerA: profile } : { playerBId: user.id, playerB: profile }),
      updatedAt: new Date(),
    }, token);
  };

  const beginCountdown = (startAt = new Date(Date.now() + 5000).toISOString()) => {
    setMatchResult(null);
    setMatchPhase('countdown');
    setRoomStartAt(startAt);
  };

  useEffect(() => {
    if (!roomStartAt) return;
    const startTime = new Date(roomStartAt).getTime();
    const timer = window.setInterval(() => {
      const remaining = Math.ceil((startTime - Date.now()) / 1000);
      if (remaining > 1) {
        setCountdown(Math.min(5, remaining));
        return;
      }
      setCountdown('START');
      if (remaining <= 0) {
        window.clearInterval(timer);
         window.setTimeout(() => {
           setCountdown(null);
           setMatchPhase('playing');
           gameStartedRef.current = true;
           dispatch({ type: 'START' });
        }, 650);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [roomStartAt]);

  const practiceStart = () => {
    if (!user) return window.alert('로그인 후 게임을 시작할 수 있습니다.');
    const token = getSessionToken();
    if (token) void deleteDocument('tetrisQueue', user.id, token).catch(() => undefined);
    setMatchId(null);
    setMatchRole(null);
    setSentInviteId(null);
    setOpponent(null);
    setOpponentState(null);
    setReadyForBattle(false);
    setOpponentReady(false);
    startRequestedRef.current = false;
    setStakeReserved(false);
    setRoomStartAt(null);
    setCountdown(null);
    gameStartedRef.current = false;
    resultSent.current = false;
    setMatchStatus('연습 모드');
    beginCountdown();
  };

  const findMatch = async () => {
    if (!user) return window.alert('로그인 후 게임을 시작할 수 있습니다.');
    const token = getSessionToken();
    if (!token) return window.alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    const profile: TetrisQueueProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
    setOpponentState(null);
    setOpponent(null);
    setMatchId(null);
    setMatchRole(null);
    setSentInviteId(null);
    setReadyForBattle(false);
    setOpponentReady(false);
    startRequestedRef.current = false;
    setStakeReserved(false);
    setRoomStartAt(null);
    setCountdown(null);
    gameStartedRef.current = false;
    resultSent.current = false;
    setMatchPhase('waiting');
    setMatchStatus('매칭 상대를 찾는 중...');
    setInviteStatus('다른 회원이 입장하면 양쪽 화면이 자동으로 대전 준비로 전환됩니다.');
    try {
      await upsertDocument('tetrisQueue', user.id, {
        userId: user.id,
        name: profile.name,
        image: profile.image,
        country: profile.country || 'Global',
        status: 'waiting',
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      }, token);
    } catch {
      setMatchStatus('매칭 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setMatchPhase('idle');
      setMatchId(null);
      setMatchRole(null);
    }
  };

  const cancelMatch = async () => {
    if (user) {
      const token = getSessionToken();
      if (token) await deleteDocument('tetrisQueue', user.id, token).catch(() => undefined);
      if (token && sentInviteId) await mergeDocument('tetrisInvites', sentInviteId, { status: 'rejected', updatedAt: new Date() }, token).catch(() => undefined);
    }
    setSentInviteId(null);
    setMatchPhase('idle');
    setMatchStatus('대전 준비 안됨');
    setInviteStatus('');
    setOpponentReady(false);
    startRequestedRef.current = false;
  };

  const sendInvite = async (online: OnlineUser) => {
    if (!user) return window.alert('로그인 후 대전 신청을 보낼 수 있습니다.');
    const recipientId = online.userId || online.id;
    if (recipientId === user.id) return;
    const token = getSessionToken();
    if (!token) return window.alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    const matchId = `tetris-${user.id}-${recipientId}-${crypto.randomUUID()}`;
    const inviteId = crypto.randomUUID();
    const sender: TetrisProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
    const recipient: TetrisProfile = { id: recipientId, name: online.name, image: online.image, country: online.country || 'Global' };
    try {
      await createDocument('tetrisInvites', inviteId, {
        senderId: user.id,
        recipientId,
        sender,
        recipient,
        matchId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }, token);
      await deleteDocument('tetrisQueue', user.id, token).catch(() => undefined);
      setSelectedOnlineUserId(null);
      setSentInviteId(inviteId);
      setMatchId(null);
      setMatchRole(null);
      setOpponent(recipient);
       setOpponentState(null);
       setReadyForBattle(false);
       setOpponentReady(false);
       startRequestedRef.current = false;
       setStakeReserved(false);
      setRoomStartAt(null);
      setCountdown(null);
      gameStartedRef.current = false;
      setMatchPhase('waiting');
      setMatchStatus(`${recipient.name}님에게 대전 신청을 보냈습니다`);
      setInviteStatus('상대방 화면에 수락 / 거절 메시지가 표시됩니다.');
    } catch {
      setInviteStatus('대전 신청을 보내지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const acceptInvite = async () => {
    if (!incomingInvite) return;
    const token = getSessionToken();
    if (!token || !user) return;
    await deleteDocument('tetrisQueue', user.id, token).catch(() => undefined);
    await mergeDocument('tetrisInvites', incomingInvite.id, { status: 'accepted', updatedAt: new Date() }, token).catch(() => undefined);
    setMatchId(incomingInvite.matchId);
    setMatchRole('B');
    setSentInviteId(null);
    setOpponent(incomingInvite.sender);
    setReadyForBattle(false);
    setOpponentReady(false);
    setStakeReserved(false);
    setRoomStartAt(null);
    setCountdown(null);
    gameStartedRef.current = false;
    resultSent.current = false;
    setIncomingInvite(null);
    setMatchPhase('betting');
    setMatchStatus('대전 신청 수락 · 상대의 배팅금액을 기다리는 중');
  };

  const rejectInvite = async () => {
    const token = getSessionToken();
    if (incomingInvite && token) await mergeDocument('tetrisInvites', incomingInvite.id, { status: 'rejected', updatedAt: new Date() }, token).catch(() => undefined);
    setIncomingInvite(null);
  };

  const confirmBet = async () => {
    if (!matchId || !matchRole) return;
    const token = getSessionToken();
    if (!token || !user) return window.alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    let roomBeforeBet = await getDocument<TetrisRoom>('tetrisRooms', matchId, token).catch(() => null);
    if (matchRole === 'B') {
      for (let attempt = 0; attempt < 4 && !roomBeforeBet?.betAmount; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        roomBeforeBet = await getDocument<TetrisRoom>('tetrisRooms', matchId, token).catch(() => null);
      }
    }
    const amount = matchRole === 'B' ? Number(roomBeforeBet?.betAmount || 0) : Number(betAmount);
    if (!Number.isFinite(amount) || amount < MIN_ENTRY_FEE || amount > MAX_ENTRY_FEE) {
      window.alert(`참가비는 ${MIN_ENTRY_FEE}~${MAX_ENTRY_FEE} USDT 사이로 입력해주세요.`);
      return;
    }
     if (matchRole === 'B' && !roomBeforeBet?.betAmount) {
      window.alert('상대방이 참가비를 먼저 설정해야 합니다. 잠시 후 다시 시도해주세요.');
       return;
     }
    try {
      // Create the room with both identity fields before reserving or marking ready.
      await updateRoom({ betAmount: amount, phase: 'betting' });
      if (!stakeReserved) {
        await reserveGameStake(user.id, matchId, amount, token);
        setStakeReserved(true);
        const refreshed = await refreshStoredUser().catch(() => null);
        if (refreshed) setUser(refreshed);
        else updateUsdt(-amount, { type: 'GAME', amount, status: 'COMPLETED', details: '테트리스 매칭 참가비' });
      }
      await updateRoom({
        betAmount: amount,
        phase: 'betting',
        ...(matchRole === 'A' ? { readyA: true, readyAAt: new Date() } : { readyB: true, readyBAt: new Date() }),
      });
      setReadyForBattle(true);
      setMatchPhase('betting');
      setMatchStatus('서버 준비 완료 · 상대 준비를 기다리는 중');
    } catch (error) {
      setMatchStatus(error instanceof Error ? error.message : '대전 설정을 저장하지 못했습니다. 다시 눌러주세요.');
    }
  };

  useEffect(() => {
    if (!user || matchPhase !== 'waiting' || matchId || sentInviteId) return;
    const token = getSessionToken();
    if (!token) return;
    let stopped = false;
    const profile: TetrisQueueProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
    const applyMatch = (record: TetrisQueueRecord) => {
      if (stopped || !record.matchId || !record.role || !record.opponent) return;
      setMatchId(record.matchId);
      setMatchRole(record.role);
       setOpponent(record.opponent);
       setMatchPhase('betting');
       setReadyForBattle(false);
       setOpponentReady(false);
        startRequestedRef.current = false;
       setStakeReserved(false);
       setRoomStartAt(null);
       setCountdown(null);
       gameStartedRef.current = false;
      setMatchStatus('상대 입장 완료 · 배팅금액을 입력해주세요');
      setInviteStatus('상대가 방에 입장했습니다. 양쪽 모두 배팅금액을 확정하면 자동으로 시작합니다.');
    };
    const poll = async () => {
      if (stopped || queuePollingRef.current) return;
      queuePollingRef.current = true;
      try {
        const own = await getDocument<TetrisQueueRecord>('tetrisQueue', user.id, token).catch(() => null);
        if (own?.status === 'matched') {
          applyMatch(own);
          return;
        }
        await mergeDocument('tetrisQueue', user.id, { lastSeenAt: new Date(), status: 'waiting' }, token).catch(() => undefined);
        const claimed = await claimTetrisMatch(profile, token).catch(() => null);
        if (claimed) applyMatch({ ...profile, userId: user.id, status: 'matched', ...claimed, lastSeenAt: new Date() });
      } finally {
        queuePollingRef.current = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [matchId, matchPhase, sentInviteId, user?.country, user?.id, user?.image, user?.name]);

  useEffect(() => {
    if (!user) return;
    const token = getSessionToken();
    if (!token) return;
    const pollInvites = async () => {
      const [received, sent] = await Promise.all([
        queryDocuments<TetrisInvite>('tetrisInvites', 'recipientId', user.id, token),
        queryDocuments<TetrisInvite>('tetrisInvites', 'senderId', user.id, token),
      ]).catch(() => [[], []] as [TetrisInvite[], TetrisInvite[]]);
      const invites = [...received, ...sent];
      const pending = invites
        .filter((invite) => invite.recipientId === user.id && invite.status === 'pending' && Date.now() - new Date(invite.createdAt).getTime() < 120_000)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (pending && pending.id !== incomingInvite?.id) setIncomingInvite(pending);
       const accepted = invites.find((invite) => invite.id === sentInviteId && invite.status === 'accepted');
       const rejected = invites.find((invite) => invite.id === sentInviteId && invite.status === 'rejected');
       if (rejected) {
         setSentInviteId(null);
         setMatchPhase('idle');
         setMatchStatus('상대방이 대전 신청을 거절했습니다.');
         setInviteStatus('다른 온라인 회원에게 대전 신청을 보낼 수 있습니다.');
       }
       if (accepted && !matchId) {
        setMatchId(accepted.matchId);
        setMatchRole('A');
        setOpponent(accepted.recipient);
        setMatchPhase('betting');
        setReadyForBattle(false);
         setOpponentReady(false);
         startRequestedRef.current = false;
        setStakeReserved(false);
        setRoomStartAt(null);
        setCountdown(null);
        gameStartedRef.current = false;
        setMatchStatus('대전 신청 수락 · 배팅금액을 입력해주세요');
      }
    };
    void pollInvites();
    const timer = window.setInterval(() => void pollInvites(), 1200);
    return () => window.clearInterval(timer);
  }, [matchId, incomingInvite?.id, sentInviteId, user?.id]);

  useEffect(() => {
     if (!matchId || !matchRole || !user || matchPhase === 'finished') return;
    const token = getSessionToken();
    if (!token) return;
    const syncRoom = async () => {
      const state = gameRef.current;
      const current = await getDocument<TetrisRoom>('tetrisRooms', matchId, token).catch(() => null);
      const profile: TetrisProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
      const ownPatch = {
        matchId,
        ...(matchRole === 'A' ? {
          playerAId: user.id,
          playerA: profile,
          playerAState: state,
          readyA: readyForBattle,
        } : {
          playerBId: user.id,
          playerB: profile,
          playerBState: state,
          readyB: readyForBattle,
        }),
        phase: matchPhase === 'playing' ? 'playing' : current?.phase || 'betting',
        updatedAt: new Date(),
      };
      await mergeDocument('tetrisRooms', matchId, ownPatch, token).catch(() => undefined);
       const room = await getDocument<TetrisRoom>('tetrisRooms', matchId, token).catch(() => null);
       if (!room) return;
       const nextOpponent = matchRole === 'A' ? room.playerB : room.playerA;
       const nextState = matchRole === 'A' ? room.playerBState : room.playerAState;
       const nextReady = matchRole === 'A' ? Boolean(room.readyB) : Boolean(room.readyA);
        if (room.betAmount && room.betAmount !== betAmount) setBetAmount(room.betAmount);
       setOpponentReady(nextReady);
       if (nextOpponent) setOpponent(nextOpponent);
        if (room.startAt && roomStartAt !== room.startAt) beginCountdown(room.startAt);
        if (room.readyA && room.readyB && !room.startAt && room.phase !== 'finished') {
          setMatchStatus('양쪽 모두 서버 준비 완료 · 잠시 후 자동 시작');
          if (matchRole === 'A' && !startRequestedRef.current) {
            startRequestedRef.current = true;
            const startAt = new Date(Date.now() + 5000).toISOString();
            void updateRoom({ phase: 'countdown', startAt, startRequestedBy: user.id })
              .then(() => beginCountdown(startAt))
              .catch(() => {
                startRequestedRef.current = false;
                setMatchStatus('자동 시작 신호를 저장하지 못했습니다. 잠시 후 다시 시도합니다.');
              });
          }
        } else if (readyForBattle && nextReady) setMatchStatus('양쪽 모두 서버 준비 완료 · 잠시 후 자동 시작');
       else if (readyForBattle) setMatchStatus('내 준비 완료 · 상대 준비를 기다리는 중');
       else if (nextReady) setMatchStatus('상대 준비 완료 · 내 배팅금액을 확정해주세요');
      if (room.phase === 'finished') setMatchPhase('finished');
      const ownResult = matchRole === 'A' ? room.playerAResult : room.playerBResult;
      const opponentResult = matchRole === 'A' ? room.playerBResult : room.playerAResult;
      if (ownResult === 'lose') setMatchResult('LOSE');
      if (opponentResult === 'lose') setMatchResult('WIN');
      if (nextState) {
        setOpponentState(nextState);
        setMatchStatus('실시간 대전 중 · 상대 화면 동기화됨');
      }
    };
    void syncRoom();
    const timer = window.setInterval(() => void syncRoom(), 1200);
    return () => window.clearInterval(timer);
     }, [matchId, matchRole, matchPhase, readyForBattle, user?.id]);

  useEffect(() => {
    if (!matchId || matchPhase !== 'finished' || !user) return;
    const token = getSessionToken();
    if (!token) return;
    const timer = window.setTimeout(() => {
      void deleteDocument('tetrisRooms', matchId, token).catch(() => undefined);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [matchId, matchPhase, user?.id]);

  useEffect(() => () => {
    if (roomCleanupTimer.current) window.clearTimeout(roomCleanupTimer.current);
  }, []);

  useEffect(() => {
    if (!matchId || !matchRole || matchPhase !== 'playing' || game.running || !game.started || resultSent.current) return;
    resultSent.current = true;
    void updateRoom(matchRole === 'A' ? { phase: 'finished', playerAResult: 'lose' } : { phase: 'finished', playerBResult: 'lose' }).catch(() => undefined);
    setMatchPhase('finished');
    setMatchResult('LOSE');
  }, [game.running, matchId, matchPhase, matchRole]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !chatInput.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    const message = { authorId: user.id, user: user.name, country: user.country || 'Global', text: chatInput.trim(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60 * 1000) };
    try {
      const id = crypto.randomUUID();
      await createDocument('tetrisChatMessages', id, message, token);
      setChatInput('');
      showToast(`${user.name}: ${message.text}`);
    } catch {
      window.alert('메시지를 보내지 못했습니다. 다시 시도해주세요.');
    }
  };

  const visual = buildVisual(game);
  const opponentVisual = opponentState ? buildVisual(opponentState) : emptyBoard();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#070b17] px-4 py-8 text-white">
      {incomingInvite && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-3xl border border-cyan-300/30 bg-[#111a2d] p-6 shadow-2xl"><div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Battle request</div><h2 className="text-2xl font-black">대전 신청이 왔습니다</h2><div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3"><img src={incomingInvite.sender.image} alt="" className="h-12 w-12 rounded-full object-cover" /><div><div className="font-black">{incomingInvite.sender.name}</div><div className="text-xs text-slate-400">{incomingInvite.sender.country || 'Global'}</div></div></div><p className="mt-4 text-sm text-slate-400">수락하면 상대가 배팅금액을 정하고 카운트다운 후 대전이 시작됩니다.</p><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => void rejectInvite()} className="rounded-xl border border-white/10 bg-white/5 py-3 font-bold">거절</button><button onClick={() => void acceptInvite()} className="rounded-xl bg-cyan-400 py-3 font-black text-slate-950">수락</button></div></div></div>}
       <div className="mx-auto max-w-7xl">
         <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300"><Gamepad2 size={16} /> Arcade live</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">GLOBAL TETRIS</h1><p className="mt-2 text-sm text-slate-400">실제 접속 회원과 채팅하며 즐기는 실시간 테트리스 대전</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><Users size={16} className="text-emerald-300" /><b>{onlineUsers.length}</b><span className="text-slate-400">실시간 인증 회원</span></div></header>
         <div className="games-layout grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-5">
           <section className="game-main rounded-[1.5rem] border border-white/10 bg-[#10182b] p-3 shadow-2xl md:rounded-[2rem] md:p-6"><div className="mb-3 flex flex-wrap items-center justify-between gap-2 md:mb-4 md:gap-3"><div><span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 md:text-xs">Current run</span><div className="mt-1 text-base font-black md:text-lg">{user?.name || '로그인 필요'}</div></div><div className="flex gap-4 text-right md:gap-6"><div><div className="text-[10px] font-bold text-slate-500">SCORE</div><b className="text-lg text-cyan-300 md:text-xl">{game.score.toLocaleString()}</b></div><div><div className="text-[10px] font-bold text-slate-500">LINES</div><b className="text-lg text-emerald-300 md:text-xl">{game.lines}</b></div></div></div>
              <div className="game-stage grid grid-cols-[minmax(0,1fr)_92px] items-start gap-2 md:block" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}><div className="relative mx-auto w-full max-w-[min(100%,360px)] rounded-3xl border border-cyan-300/30 bg-[#050914] p-2 shadow-[0_0_60px_rgba(34,211,238,0.14)] md:p-3"><BoardGrid cells={visual} />{toast && <div key={toast.id} className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-2xl border border-cyan-200/30 bg-slate-950/90 px-5 py-3 text-sm font-black text-cyan-100 shadow-2xl animate-[portal-toast_4.2s_ease-out_forwards]">{toast.text}</div>}{countdown && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><span className="text-6xl font-black tracking-widest text-cyan-200 drop-shadow-[0_0_18px_rgba(34,211,238,.8)]">{countdown}</span></div>}{matchResult && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/45"><span className={`text-6xl font-black tracking-widest drop-shadow-[0_0_18px_rgba(255,255,255,.7)] ${matchResult === 'WIN' ? 'text-emerald-300' : 'text-rose-300'}`}>{matchResult}</span></div>}</div><div className="space-y-2 lg:hidden"><div className="rounded-xl border border-cyan-300/20 bg-[#050914] p-1.5"><div className="mb-1 text-center text-[9px] font-black text-cyan-200">내 화면</div><BoardGrid cells={visual} compact /></div><div className="grid grid-cols-2 gap-1"><div className="rounded-xl border border-amber-300/20 bg-[#050914] p-1"><div className="mb-1 text-center text-[8px] font-black text-amber-200">다음</div><NextBlock piece={game.nextPiece} compact /></div><div className="rounded-xl border border-emerald-300/20 bg-[#050914] p-1"><div className="mb-1 text-center text-[8px] font-black text-emerald-200">상대</div><BoardGrid cells={opponentVisual} compact /></div></div></div></div>
              <div className="mx-auto mt-3 grid max-w-[360px] grid-cols-2 gap-2 md:mt-4"><button onClick={practiceStart} disabled={matchPhase === 'countdown' || matchPhase === 'playing'} className="rounded-xl bg-cyan-400 px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"><Play size={15} className="mr-1 inline" />연습 시작</button><button onClick={matchPhase === 'waiting' ? () => void cancelMatch() : () => void findMatch()} disabled={matchPhase === 'betting' || matchPhase === 'countdown' || matchPhase === 'playing'} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2.5 text-sm font-black text-cyan-100 disabled:opacity-40">{matchPhase === 'waiting' ? '매칭 취소' : '매칭 찾기'}</button><button onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })} disabled={!game.running} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-30">{game.paused ? <Play size={15} className="mr-1 inline" /> : <Pause size={15} className="mr-1 inline" />}{game.paused ? '계속' : '일시정지'}</button><button onClick={() => dispatch({ type: 'ROTATE' })} disabled={!game.running || game.paused} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold disabled:opacity-30"><RotateCw size={15} className="mr-1 inline" />회전</button></div><div className="mt-3 grid grid-cols-4 gap-2 sm:hidden"><button onClick={() => dispatch({ type: 'MOVE', dx: -1, dy: 0 })} disabled={!game.running || game.paused} className="touch-control">←</button><button onClick={() => dispatch({ type: 'MOVE', dx: 0, dy: 1 })} disabled={!game.running || game.paused} className="touch-control">↓</button><button onClick={() => dispatch({ type: 'ROTATE' })} disabled={!game.running || game.paused} className="touch-control">회전</button><button onClick={() => dispatch({ type: 'MOVE', dx: 1, dy: 0 })} disabled={!game.running || game.paused} className="touch-control">→</button></div><div className="mt-2 text-center text-[10px] text-slate-500 md:mt-3 md:text-[11px]">← → 이동 · ↓ 내리기 · ↑ 회전 · C 다음 블록 · Space 즉시 내리기 · 탭 즉시 내리기</div>
          </section>
            <aside className="space-y-5"><section className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Next block</div><div className="w-24"><NextBlock piece={game.nextPiece} /></div><p className="mt-4 text-sm text-slate-400">상대가 같은 대전방에 들어오면 상대 블록 화면이 실시간으로 표시됩니다.</p></section>
              <section className="rounded-[2rem] border border-cyan-300/20 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between gap-2"><div className="font-black">상대방 보드</div><span className="text-[10px] font-bold text-cyan-300">{matchStatus}</span></div>{opponent ? <div className="mb-3 flex items-center gap-2"><img src={opponent.image} alt="" className="h-8 w-8 rounded-full object-cover" /><div className="min-w-0"><div className="truncate text-sm font-bold">{opponent.name}</div><div className="text-[10px] text-slate-500">{opponent.country || 'Global'}</div></div></div> : <p className="mb-3 text-xs text-slate-500">매칭 찾기를 누르면 접속 회원에게 대전 신청을 보냅니다.</p>}<div className="mx-auto max-w-[230px] rounded-2xl border border-white/10 bg-[#050914] p-2"><BoardGrid cells={opponentVisual} compact /></div><p className="mt-3 text-center text-[11px] text-slate-500">{opponentState ? '상대 게임 상태를 수신 중' : '상대가 연결되면 보드가 나타납니다.'}</p></section>
              <section className="rounded-[2rem] border border-amber-300/20 bg-[#10182b] p-5"><div className="mb-2 flex items-center justify-between"><div className="font-black">대전 설정</div><span className="text-[10px] font-bold text-amber-300">{matchPhase}</span></div><p className="mb-3 text-xs text-slate-400">{inviteStatus || matchStatus}</p>{matchPhase === 'waiting' && <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm font-bold text-cyan-100">상대방을 찾는 중입니다...</div>}{matchPhase === 'betting' && <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">참가비는 매 경기 서버 잔고에서 설정한 금액만 예약됩니다.</div>}{matchPhase === 'betting' && matchRole === 'A' && <div className="space-y-2"><label className="block text-xs font-bold text-amber-100">참가비 설정 (1~100 USDT)<input type="number" min={MIN_ENTRY_FEE} max={MAX_ENTRY_FEE} step="1" value={betAmount} onChange={(event) => setBetAmount(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-amber-300" /></label><button onClick={() => void confirmBet()} disabled={readyForBattle} className="w-full rounded-xl bg-amber-300 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40">참가비 확정 · 준비하기</button></div>}{matchPhase === 'betting' && matchRole === 'B' && <div className="space-y-2"><div className="rounded-xl bg-amber-300/10 px-3 py-2 text-sm text-amber-100">상대가 설정한 참가비: <b>{betAmount} USDT</b></div><button onClick={() => void confirmBet()} disabled={readyForBattle} className="w-full rounded-xl bg-amber-300 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40">수락하고 준비하기</button></div>}{matchPhase === 'finished' && <div className={`rounded-xl px-3 py-3 text-center text-xl font-black ${matchResult === 'WIN' ? 'bg-emerald-300/10 text-emerald-200' : 'bg-rose-300/10 text-rose-200'}`}>{matchResult || '대전 종료'}</div>}</section>
              {matchId && matchPhase === 'betting' && <section className="rounded-[2rem] border border-rose-400/30 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between"><div className="font-black">실시간 준비 상태</div><span className="text-[10px] font-bold text-slate-500">서버 신호 · 자동 시작</span></div><div className="grid grid-cols-2 gap-2 text-center text-xs"><div className={`rounded-xl px-3 py-3 ${readyForBattle ? 'bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/50' : 'bg-white/[.05] text-slate-400'}`}><span className={`mb-1 inline-block h-2 w-2 rounded-full ${readyForBattle ? 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.9)]' : 'bg-slate-600'}`} /><br /><b className="text-sm">나 · {readyForBattle ? '준비 완료' : '준비 전'}</b></div><div className={`rounded-xl px-3 py-3 ${opponentReady ? 'bg-amber-300/20 text-amber-100 ring-1 ring-amber-300/50' : 'bg-white/[.05] text-slate-400'}`}><span className={`mb-1 inline-block h-2 w-2 rounded-full ${opponentReady ? 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.9)]' : 'bg-slate-600'}`} /><br /><b className="text-sm">상대 · {opponentReady ? '준비 완료' : '준비 전'}</b></div></div>{readyForBattle && opponentReady && !roomStartAt && <p className="mt-3 text-center text-xs font-bold text-amber-200">양쪽 준비 신호 확인 · 5초 후 자동 시작</p>}{readyForBattle && !opponentReady && <p className="mt-3 text-center text-xs text-slate-500">상대방의 준비 완료를 기다리는 중입니다.</p>}</section>}
            <section className="flex min-h-[360px] flex-col rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-black"><MessageCircle size={17} className="text-cyan-300" /> 실시간 메시지</div><span className="text-[10px] font-bold text-emerald-300">LIVE</span></div><div className="flex-1 space-y-3 overflow-y-auto pr-1">{messages.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">아직 메시지가 없습니다.</p> : messages.map((message) => <div key={message.id} className="rounded-2xl bg-white/[0.045] p-3"><div className="mb-1 flex justify-between gap-2 text-[10px]"><b className="text-cyan-200">{message.user}</b><span className="text-slate-600">{formatTime(message.createdAt)}</span></div><p className="break-words text-sm text-slate-200">{message.text}</p></div>)}</div>{user ? <form onSubmit={sendMessage} className="mt-4 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="게임 중 메시지..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300" /><button aria-label="메시지 보내기" className="rounded-xl bg-cyan-400 px-3 text-slate-950"><Send size={16} /></button></form> : <p className="mt-4 text-center text-xs text-slate-500">로그인 후 참여할 수 있습니다.</p>}</section>
             <section className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 font-black"><Users size={17} className="text-emerald-300" /> 실제 접속 회원</div><span className="text-[10px] font-bold text-emerald-300">클릭하여 신청</span></div>{onlineUsers.length === 0 ? <p className="text-sm text-slate-500">현재 접속 중인 인증 회원이 없습니다.</p> : <div className="space-y-2">{onlineUsers.filter((online) => online.id !== user?.id).map((online) => <div key={online.id} className={`rounded-xl p-2.5 transition ${selectedOnlineUserId === online.id ? 'bg-cyan-300/10 ring-1 ring-cyan-300/40' : 'bg-white/[0.04]'}`}><button onClick={() => setSelectedOnlineUserId(selectedOnlineUserId === online.id ? null : online.id)} className="flex w-full items-center gap-2 text-left"><img src={online.image} alt="" className="h-8 w-8 rounded-full object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{online.name}</span><span className="text-[10px] text-emerald-300">● {online.country || '국가 미설정'}</span></span></button>{selectedOnlineUserId === online.id && <button onClick={() => void sendInvite(online)} disabled={matchPhase === 'betting' || matchPhase === 'countdown' || matchPhase === 'playing'} className="mt-2 w-full rounded-lg bg-cyan-400 py-2 text-xs font-black text-slate-950 disabled:opacity-40">대전 신청하기</button>}</div>)}</div>}</section></aside>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useEffect, useReducer, useRef, useState, type FormEvent, type TouchEvent, type CSSProperties } from 'react';
import { Gamepad2, MessageCircle, Pause, Play, RotateCw, Send, Users } from 'lucide-react';
import { claimTetrisMatch, createDocument, deleteDocument, deleteExpiredChatMessages, getDocument, getSessionToken, listDocuments, listOnlineUsers, mergeDocument, OnlineUser, queryDocuments, queryDocumentsWhere, refreshStoredUser, reserveGameStake, upsertDocument, type TetrisQueueProfile } from '@/lib/firebase';
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
const DEFAULT_ENTRY_FEE = 1;
const MIN_ENTRY_FEE = 1;
const MAX_ENTRY_FEE = 100;
const formatUsdt = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Piece = { type: number; shape: number[][]; x: number; y: number };
type ChatMessage = { id: string; authorId: string; user: string; country?: string; text: string; createdAt: string; expiresAt?: string | Date };
type GameState = { board: number[][]; piece: Piece; nextPiece: Piece; running: boolean; started: boolean; paused: boolean; score: number; lines: number; notice: string; noticeId: number };
type TetrisProfile = { id: string; name: string; image: string; country?: string };
type TetrisLobby = { status?: 'waiting' | 'matched'; waitingUserId?: string; waitingUser?: TetrisProfile; matchId?: string; playerAId?: string; playerBId?: string; playerA?: TetrisProfile; playerB?: TetrisProfile; updatedAt?: string };
type MatchPhase = 'idle' | 'waiting' | 'betting' | 'countdown' | 'playing' | 'finished';
type TetrisInvite = { id: string; senderId: string; recipientId: string; sender: TetrisProfile; recipient: TetrisProfile; matchId: string; status: 'pending' | 'accepted' | 'rejected'; createdAt: string; updatedAt?: string };
type TetrisQueueRecord = TetrisQueueProfile & { userId: string; status: 'waiting' | 'matched'; matchId?: string; role?: 'A' | 'B'; opponent?: TetrisProfile; lastSeenAt: string | Date };
type TetrisRoom = TetrisLobby & {
  phase?: 'betting' | 'countdown' | 'playing' | 'finished';
  betAmount?: number;
  readyA?: boolean;
  readyB?: boolean;
  readyAAt?: string;
  readyBAt?: string;
  startAt?: string;
  playerAResult?: 'win' | 'lose';
  playerBResult?: 'win' | 'lose';
  playerAState?: GameState;
  playerBState?: GameState;
};
type GameAction =
  | { type: 'START' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'MOVE'; dx: number; dy: number }
  | { type: 'ROTATE' }
  | { type: 'SWAP_NEXT' }
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

const createGame = (): GameState => ({ board: emptyBoard(), piece: randomPiece(), nextPiece: randomPiece(), running: false, started: false, paused: false, score: 0, lines: 0, notice: '', noticeId: 0 });
const buildVisual = (state: GameState) => {
  const visual = state.board.map((row) => [...row]);
  let ghostDistance = 0;
  while (!collides(state.board, state.piece, 0, ghostDistance + 1)) ghostDistance += 1;
  const ghostY = state.piece.y + ghostDistance;
  state.piece.shape.forEach((row, y) => row.forEach((cell, x) => {
    if (!cell) return;
    if (ghostY + y >= 0 && ghostY + y < HEIGHT && !visual[ghostY + y][state.piece.x + x]) visual[ghostY + y][state.piece.x + x] = -1;
    if (state.piece.y + y >= 0 && state.piece.y + y < HEIGHT) visual[state.piece.y + y][state.piece.x + x] = state.piece.type + 1;
  }));
  return visual;
};

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
  if (action.type === 'START') return { ...createGame(), running: true, started: true, notice: '게임 시작 · 방향키로 조작하세요', noticeId: Date.now() };
  if (action.type === 'TOGGLE_PAUSE') return state.running ? { ...state, paused: !state.paused } : state;
  if (!state.running || state.paused) return state;
  if (action.type === 'ROTATE') {
    const rotated = rotate(state.piece.shape);
    return collides(state.board, state.piece, 0, 0, rotated) ? state : { ...state, piece: { ...state.piece, shape: rotated } };
  }
  if (action.type === 'SWAP_NEXT') {
    const current = { ...clonePiece(state.piece), x: 3, y: 0 };
    const next = { ...clonePiece(state.nextPiece), x: 3, y: 0 };
    if (collides(state.board, next)) return state;
    return { ...state, piece: next, nextPiece: current, notice: '다음 블록으로 교체', noticeId: Date.now() };
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
  const setUser = useGlobalStore((state) => state.setUser);
  const updateUsdt = useGlobalStore((state) => state.updateUsdt);
  const [game, dispatch] = useReducer(gameReducer, undefined, createGame);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [matchRole, setMatchRole] = useState<'A' | 'B' | null>(null);
  const [opponent, setOpponent] = useState<TetrisProfile | null>(null);
  const [opponentState, setOpponentState] = useState<GameState | null>(null);
  const [matchStatus, setMatchStatus] = useState('대전 준비 안됨');
  const [matchPhase, setMatchPhase] = useState<MatchPhase>('idle');
  const [incomingInvite, setIncomingInvite] = useState<TetrisInvite | null>(null);
  const [sentInviteId, setSentInviteId] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState('');
  const [readyForBattle, setReadyForBattle] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [selectedOnlineUserId, setSelectedOnlineUserId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(DEFAULT_ENTRY_FEE);
  const [stakeReserved, setStakeReserved] = useState(false);
  const [countdown, setCountdown] = useState<number | 'START' | null>(null);
  const [matchResult, setMatchResult] = useState<'WIN' | 'LOSE' | null>(null);
  const [roomStartAt, setRoomStartAt] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const firstChatLoad = useRef(true);
  const lastMessageId = useRef<string | null>(null);
  const lastChatCleanup = useRef(0);
  const queuePollingRef = useRef(false);
  const gameRef = useRef(game);
  const resultSent = useRef(false);
  const gameStartedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

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
        await deleteExpiredChatMessages(token, 'tetrisChatMessages').catch(() => undefined);
      }
      const next = (await queryDocumentsWhere<Omit<ChatMessage, 'id'>>('tetrisChatMessages', [{ field: 'expiresAt', op: 'GREATER_THAN', value: new Date() }], token, 60).catch(() => []))
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
      if (event.key.toLowerCase() === 'c') { event.preventDefault(); dispatch({ type: 'ROTATE' }); }
      if (event.key === ' ') { event.preventDefault(); dispatch({ type: 'DROP' }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game.running]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || !game.running || game.paused) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) {
      dispatch({ type: 'DROP' });
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) dispatch({ type: 'MOVE', dx: dx > 0 ? 1 : -1, dy: 0 });
    else if (dy < 0) dispatch({ type: 'ROTATE' });
    else dispatch({ type: 'MOVE', dx: 0, dy: 1 });
  };

  useEffect(() => {
    if (!game.running || game.paused) return;
    const timer = window.setInterval(() => dispatch({ type: 'MOVE', dx: 0, dy: 1 }), Math.max(180, 850 - Math.floor(game.lines / 5) * 45));
    return () => window.clearInterval(timer);
  }, [game.running, game.paused, game.lines]);

  const updateRoom = async (patch: Record<string, unknown>) => {
    if (!matchId || !matchRole || !user) throw new Error('대전 정보가 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.');
    const token = getSessionToken();
    if (!token) throw new Error('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    const profile: TetrisProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
    const identityPatch = matchRole === 'A' ? { playerAId: user.id, playerA: profile } : { playerBId: user.id, playerB: profile };
    await mergeDocument('tetrisRooms', matchId, { ...identityPatch, ...patch, matchId, updatedAt: new Date() }, token);
  };

  const beginCountdown = (startAt = new Date(Date.now() + 5000).toISOString()) => {
    setMatchResult(null);
    setMatchPhase('countdown');
    setRoomStartAt(startAt);
  };

  useEffect(() => {
    if (!roomStartAt) return;
    const startTime = new Date(roomStartAt).getTime();
    const timer = window.setInterval(() => {
      const remaining = Math.ceil((startTime - Date.now()) / 1000);
      if (remaining > 1) {
        setCountdown(Math.min(5, remaining));
        return;
      }
      setCountdown('START');
      if (remaining <= 0) {
        window.clearInterval(timer);
         window.setTimeout(() => {
           setCountdown(null);
           setMatchPhase('playing');
           gameStartedRef.current = true;
           dispatch({ type: 'START' });
        }, 650);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [roomStartAt]);

  const practiceStart = () => {
    if (!user) return window.alert('로그인 후 게임을 시작할 수 있습니다.');
    const token = getSessionToken();
    if (token) void deleteDocument('tetrisQueue', user.id, token).catch(() => undefined);
    setMatchId(null);
    setMatchRole(null);
    setSentInviteId(null);
    setOpponent(null);
    setOpponentState(null);
    setReadyForBattle(false);
    setOpponentReady(false);
    setStakeReserved(false);
    setRoomStartAt(null);
    setCountdown(null);
    gameStartedRef.current = false;
    resultSent.current = false;
    setMatchStatus('연습 모드');
    beginCountdown();
  };

  const findMatch = async () => {
    if (!user) return window.alert('로그인 후 게임을 시작할 수 있습니다.');
    const token = getSessionToken();
    if (!token) return window.alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    const profile: TetrisQueueProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
    setOpponentState(null);
    setOpponent(null);
    setMatchId(null);
    setMatchRole(null);
    setSentInviteId(null);
    setReadyForBattle(false);
    setOpponentReady(false);
    setStakeReserved(false);
    setRoomStartAt(null);
    setCountdown(null);
    gameStartedRef.current = false;
    resultSent.current = false;
    setMatchPhase('waiting');
    setMatchStatus('매칭 상대를 찾는 중...');
    setInviteStatus('다른 회원이 입장하면 양쪽 화면이 자동으로 대전 준비로 전환됩니다.');
    try {
      await upsertDocument('tetrisQueue', user.id, {
        userId: user.id,
        name: profile.name,
        image: profile.image,
        country: profile.country || 'Global',
        status: 'waiting',
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      }, token);
    } catch {
      setMatchStatus('매칭 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
      setMatchPhase('idle');
      setMatchId(null);
      setMatchRole(null);
    }
  };

  const cancelMatch = async () => {
    if (user) {
      const token = getSessionToken();
      if (token) await deleteDocument('tetrisQueue', user.id, token).catch(() => undefined);
      if (token && sentInviteId) await mergeDocument('tetrisInvites', sentInviteId, { status: 'rejected', updatedAt: new Date() }, token).catch(() => undefined);
    }
    setSentInviteId(null);
    setMatchPhase('idle');
    setMatchStatus('대전 준비 안됨');
    setInviteStatus('');
    setOpponentReady(false);
  };

  const sendInvite = async (online: OnlineUser) => {
    if (!user) return window.alert('로그인 후 대전 신청을 보낼 수 있습니다.');
    const recipientId = online.userId || online.id;
    if (recipientId === user.id) return;
    const token = getSessionToken();
    if (!token) return window.alert('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
    const matchId = `tetris-${user.id}-${recipientId}-${crypto.randomUUID()}`;
    const inviteId = crypto.randomUUID();
    const sender: TetrisProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
    const recipient: TetrisProfile = { id: recipientId, name: online.name, image: online.image, country: online.country || 'Global' };
    try {
      await createDocument('tetrisInvites', inviteId, {
        senderId: user.id,
        recipientId,
        sender,
        recipient,
        matchId,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      }, token);
      await deleteDocument('tetrisQueue', user.id, token).catch(() => undefined);
      setSelectedOnlineUserId(null);
      setSentInviteId(inviteId);
      setMatchId(null);
      setMatchRole(null);
      setOpponent(recipient);
      setOpponentState(null);
      setReadyForBattle(false);
      setOpponentReady(false);
      setStakeReserved(false);
      setRoomStartAt(null);
      setCountdown(null);
      gameStartedRef.current = false;
      setMatchPhase('waiting');
      setMatchStatus(`${recipient.name}님에게 대전 신청을 보냈습니다`);
      setInviteStatus('상대방 화면에 수락 / 거절 메시지가 표시됩니다.');
    } catch {
      setInviteStatus('대전 신청을 보내지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const acceptInvite = async () => {
    if (!incomingInvite) return;
    const token = getSessionToken();
    if (!token || !user) return;
    await deleteDocument('tetrisQueue', user.id, token).catch(() => undefined);
    await mergeDocument('tetrisInvites', incomingInvite.id, { status: 'accepted', updatedAt: new Date() }, token).catch(() => undefined);
    setMatchId(incomingInvite.matchId);
    setMatchRole('B');
    setSentInviteId(null);
    setOpponent(incomingInvite.sender);
    setReadyForBattle(false);
    setOpponentReady(false);
    setStakeReserved(false);
    setRoomStartAt(null);
    setCountdown(null);
    gameStartedRef.current = false;
    resultSent.current = false;
    setIncomingInvite(null);
    setMatchPhase('betting');
    setMatchStatus('대전 신청 수락 · 상대의 배팅금액을 기다리는 중');
  };

  const rejectInvite = async () => {
    const token = getSessionToken();
    if (incomingInvite && token) await mergeDocument('tetrisInvites', incomingInvite.id, { status: 'rejected', updatedAt: new Date() }, token).catch(() => undefined);
    setIncomingInvite(null);
  };

  const confirmBet = async () => {
    if (!matchId || !matchRole) return;
    const token = getSessionToken();
    if (!token || !user) {
      setMatchStatus('로그인 세션이 만료되었습니다. 다시 로그인해주세요.');
      return;
    }
    let roomBeforeBet = await getDocument<TetrisRoom>('tetrisRooms', matchId, token).catch(() => null);
    if (matchRole === 'B') {
      for (let attempt = 0; attempt < 4 && !roomBeforeBet?.betAmount; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 400));
        roomBeforeBet = await getDocument<TetrisRoom>('tetrisRooms', matchId, token).catch(() => null);
      }
    }
    const amount = matchRole === 'B' ? Number(roomBeforeBet?.betAmount || 0) : Number(betAmount);
    if (!Number.isFinite(amount) || amount < MIN_ENTRY_FEE || amount > MAX_ENTRY_FEE) {
      setReadyForBattle(false);
      setMatchStatus('참가비는 ' + MIN_ENTRY_FEE + '~' + MAX_ENTRY_FEE + ' USDT 사이로 입력해주세요.');
      return;
    }
    if (matchRole === 'B' && !roomBeforeBet?.betAmount) {
      setReadyForBattle(false);
      setMatchStatus('상대방의 참가비 저장을 기다리고 있습니다. 잠시 후 다시 눌러주세요.');
      return;
    }
    if (!stakeReserved) {
      try {
        await reserveGameStake(user.id, matchId, amount, token);
        setStakeReserved(true);
        const refreshed = await refreshStoredUser().catch(() => null);
        if (refreshed) setUser(refreshed);
        else updateUsdt(-amount, { type: 'GAME', amount, status: 'COMPLETED', details: '테트리스 매칭 참가비' });
      } catch (error) {
        const message = error instanceof Error ? error.message : '게임 참가비를 예약하지 못했습니다.';
        setReadyForBattle(false);
        setMatchStatus(message);
        setInviteStatus(message);
        return;
      }
    }
    try {
      await updateRoom({
        betAmount: amount,
        phase: 'betting',
        ...(matchRole === 'A' ? { readyA: true, readyAAt: new Date() } : { readyB: true, readyBAt: new Date() }),
      });
      setReadyForBattle(true);
      setMatchPhase('betting');
      setMatchStatus('배팅금액 확정 · 상대 준비를 기다리는 중');
    } catch (error) {
      setReadyForBattle(false);
      setMatchStatus(error instanceof Error ? error.message : '대전 설정을 저장하지 못했습니다. 다시 눌러주세요.');
    }
  };

  const startBattle = async () => {
    if (matchRole !== 'A' || !matchId || !readyForBattle || !opponentReady || roomStartAt) return;
    const startAt = new Date(Date.now() + 4500).toISOString();
    try {
      await updateRoom({ phase: 'countdown', startAt, startRequestedBy: user?.id || '' });
      beginCountdown(startAt);
    } catch {
      setMatchStatus('대전을 시작하지 못했습니다. 다시 눌러주세요.');
    }
  };

  useEffect(() => {
    if (!user || matchPhase !== 'waiting' || matchId || sentInviteId) return;
    const token = getSessionToken();
    if (!token) return;
    let stopped = false;
    const profile: TetrisQueueProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
    const applyMatch = (record: TetrisQueueRecord) => {
      if (stopped || !record.matchId || !record.role || !record.opponent) return;
      setMatchId(record.matchId);
      setMatchRole(record.role);
       setOpponent(record.opponent);
       setMatchPhase('betting');
       setReadyForBattle(false);
       setOpponentReady(false);
       setStakeReserved(false);
       setRoomStartAt(null);
       setCountdown(null);
       gameStartedRef.current = false;
      setMatchStatus('상대 입장 완료 · 참가비를 설정해주세요');
      setInviteStatus('상대가 방에 입장했습니다. 양쪽 모두 배팅금액을 확정하면 자동으로 시작합니다.');
    };
    const poll = async () => {
      if (stopped || queuePollingRef.current) return;
      queuePollingRef.current = true;
      try {
        const own = await getDocument<TetrisQueueRecord>('tetrisQueue', user.id, token).catch(() => null);
        if (own?.status === 'matched') {
          applyMatch(own);
          return;
        }
        await mergeDocument('tetrisQueue', user.id, { lastSeenAt: new Date(), status: 'waiting' }, token).catch(() => undefined);
        const claimed = await claimTetrisMatch(profile, token).catch(() => null);
        if (claimed) applyMatch({ ...profile, userId: user.id, status: 'matched', ...claimed, lastSeenAt: new Date() });
      } finally {
        queuePollingRef.current = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 800);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [matchId, matchPhase, sentInviteId, user?.country, user?.id, user?.image, user?.name]);

  useEffect(() => {
    if (!user) return;
    const token = getSessionToken();
    if (!token) return;
    const pollInvites = async () => {
      const [received, sent] = await Promise.all([
        queryDocuments<TetrisInvite>('tetrisInvites', 'recipientId', user.id, token),
        queryDocuments<TetrisInvite>('tetrisInvites', 'senderId', user.id, token),
      ]).catch(() => [[], []] as [TetrisInvite[], TetrisInvite[]]);
      const invites = [...received, ...sent];
      const pending = invites
        .filter((invite) => invite.recipientId === user.id && invite.status === 'pending' && Date.now() - new Date(invite.createdAt).getTime() < 120_000)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (pending && pending.id !== incomingInvite?.id) setIncomingInvite(pending);
       const accepted = invites.find((invite) => invite.id === sentInviteId && invite.status === 'accepted');
       const rejected = invites.find((invite) => invite.id === sentInviteId && invite.status === 'rejected');
       if (rejected) {
         setSentInviteId(null);
         setMatchPhase('idle');
         setMatchStatus('상대방이 대전 신청을 거절했습니다.');
         setInviteStatus('다른 온라인 회원에게 대전 신청을 보낼 수 있습니다.');
       }
       if (accepted && !matchId) {
        setMatchId(accepted.matchId);
        setMatchRole('A');
        setOpponent(accepted.recipient);
        setMatchPhase('betting');
        setReadyForBattle(false);
        setOpponentReady(false);
        setStakeReserved(false);
        setRoomStartAt(null);
        setCountdown(null);
        gameStartedRef.current = false;
        setMatchStatus('대전 신청 수락 · 배팅금액을 입력해주세요');
      }
    };
    void pollInvites();
    const timer = window.setInterval(() => void pollInvites(), 1200);
    return () => window.clearInterval(timer);
  }, [matchId, incomingInvite?.id, sentInviteId, user?.id]);

  useEffect(() => {
    if (!matchId || !matchRole || !user) return;
    const token = getSessionToken();
    if (!token) return;
    const syncRoom = async () => {
      const state = gameRef.current;
      const current = await getDocument<TetrisRoom>('tetrisRooms', matchId, token).catch(() => null);
      const profile: TetrisProfile = { id: user.id, name: user.name, image: user.image, country: user.country || 'Global' };
      const ownPatch = {
        matchId,
        ...(matchRole === 'A' ? {
          playerAId: user.id,
          playerA: profile,
          playerAState: state,
          readyA: readyForBattle,
        } : {
          playerBId: user.id,
          playerB: profile,
          playerBState: state,
          readyB: readyForBattle,
        }),
        phase: matchPhase === 'playing' ? 'playing' : current?.phase || 'betting',
        updatedAt: new Date(),
      };
      await mergeDocument('tetrisRooms', matchId, ownPatch, token).catch(() => undefined);
       const room = await getDocument<TetrisRoom>('tetrisRooms', matchId, token).catch(() => null);
       if (!room) return;
       const nextOpponent = matchRole === 'A' ? room.playerB : room.playerA;
       const nextState = matchRole === 'A' ? room.playerBState : room.playerAState;
       const nextReady = matchRole === 'A' ? Boolean(room.readyB) : Boolean(room.readyA);
        if (room.betAmount && room.betAmount !== betAmount) setBetAmount(room.betAmount);
       setOpponentReady(nextReady);
       if (nextOpponent) setOpponent(nextOpponent);
       
       if (room.startAt && roomStartAt !== room.startAt) beginCountdown(room.startAt);
       if (room.readyA && room.readyB && !room.startAt && room.phase !== 'finished') setMatchStatus('양쪽 모두 준비 완료 · 빨간 시작 버튼을 눌러주세요');
       else if (readyForBattle && nextReady) setMatchStatus('양쪽 모두 준비 완료 · 빨간 시작 버튼을 눌러주세요');
       else if (readyForBattle) setMatchStatus('내 준비 완료 · 상대 준비를 기다리는 중');
       else if (nextReady) setMatchStatus('상대 준비 완료 · 내 배팅금액을 확정해주세요');
      if (room.phase === 'finished') setMatchPhase('finished');
      const ownResult = matchRole === 'A' ? room.playerAResult : room.playerBResult;
      const opponentResult = matchRole === 'A' ? room.playerBResult : room.playerAResult;
      if (ownResult === 'lose') setMatchResult('LOSE');
      if (opponentResult === 'lose') setMatchResult('WIN');
      if (nextState) {
        setOpponentState(nextState);
        setMatchStatus('실시간 대전 중 · 상대 화면 동기화됨');
      }
    };
    void syncRoom();
    const timer = window.setInterval(() => void syncRoom(), 1200);
    return () => window.clearInterval(timer);
   }, [matchId, matchRole, matchPhase, readyForBattle, roomStartAt, betAmount, user?.id]);

  useEffect(() => {
    if (!matchId || !matchRole || matchPhase !== 'playing' || game.running || !game.started || resultSent.current) return;
    resultSent.current = true;
    void updateRoom(matchRole === 'A' ? { phase: 'finished', playerAResult: 'lose' } : { phase: 'finished', playerBResult: 'lose' });
    setMatchPhase('finished');
    setMatchResult('LOSE');
  }, [game.running, matchId, matchPhase, matchRole]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !chatInput.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    const message = { authorId: user.id, user: user.name, country: user.country || 'Global', text: chatInput.trim(), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60 * 1000) };
    try {
      const id = crypto.randomUUID();
      await createDocument('tetrisChatMessages', id, message, token);
      setChatInput('');
      showToast(`${user.name}: ${message.text}`);
    } catch {
      window.alert('메시지를 보내지 못했습니다. 다시 시도해주세요.');
    }
  };

  const visual = buildVisual(game);
  const opponentVisual = opponentState ? buildVisual(opponentState) : emptyBoard();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#070b17] px-3 py-5 text-white md:px-4 md:py-8">
      {incomingInvite && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-3xl border border-cyan-300/30 bg-[#111a2d] p-6 shadow-2xl"><div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Battle request</div><h2 className="text-2xl font-black">대전 신청이 왔습니다</h2><div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3"><img src={incomingInvite.sender.image} alt="" className="h-12 w-12 rounded-full object-cover" /><div><div className="font-black">{incomingInvite.sender.name}</div><div className="text-xs text-slate-400">{incomingInvite.sender.country || 'Global'}</div></div></div><p className="mt-4 text-sm text-slate-400">수락하면 상대가 배팅금액을 정하고 카운트다운 후 대전이 시작됩니다.</p><div className="mt-5 grid grid-cols-2 gap-2"><button onClick={() => void rejectInvite()} className="rounded-xl border border-white/10 bg-white/5 py-3 font-bold">거절</button><button onClick={() => void acceptInvite()} className="rounded-xl bg-cyan-400 py-3 font-black text-slate-950">수락</button></div></div></div>}
      <div className="mx-auto max-w-7xl">
         <header className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-cyan-300"><Gamepad2 size={16} /> Arcade live</div><h1 className="text-3xl font-black tracking-tight md:text-5xl">GLOBAL TETRIS</h1><p className="mt-2 text-sm text-slate-400">실제 접속 회원과 채팅하며 즐기는 실시간 테트리스 대전</p></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><Users size={16} className="text-emerald-300" /><b>{onlineUsers.length}</b><span className="text-slate-400">실시간 인증 회원</span></div></header>
        <div className="games-layout grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-5">
          <section className="game-main rounded-[1.5rem] border border-white/10 bg-[#10182b] p-3 shadow-2xl md:rounded-[2rem] md:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-widest text-slate-500">Current run</span><div className="mt-1 text-lg font-black">{user?.name || '로그인 필요'}</div></div><div className="flex gap-6 text-right"><div><div className="text-[10px] font-bold text-slate-500">SCORE</div><b className="text-xl text-cyan-300">{game.score.toLocaleString()}</b></div><div><div className="text-[10px] font-bold text-slate-500">LINES</div><b className="text-xl text-emerald-300">{game.lines}</b></div></div></div>
            <div className="relative mx-auto max-w-[min(100%,360px)] rounded-3xl border border-cyan-300/30 bg-[#050914] p-2 shadow-[0_0_60px_rgba(34,211,238,0.14)] md:p-3" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}><div className="grid grid-cols-10 gap-0.5 rounded-2xl bg-[#0b1221] p-1.5 md:gap-1 md:p-2">{visual.flatMap((row, y) => row.map((cell, x) => <div key={`${x}-${y}`} className={`aspect-square rounded-[3px] border md:rounded-[4px] ${cell === 0 ? 'border-white/[0.05] bg-white/[0.025]' : cell === -1 ? 'border-2 border-dashed border-cyan-100/60 bg-cyan-200/10' : 'border-white/50 shadow-[inset_0_2px_0_rgba(255,255,255,.55),0_0_12px_var(--cell)]'}`} style={cell > 0 ? ({ '--cell': COLORS[cell - 1], backgroundColor: COLORS[cell - 1] } as CSSProperties) : undefined} />))}</div>{toast && <div key={toast.id} className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-2xl border border-cyan-200/30 bg-slate-950/90 px-5 py-3 text-sm font-black text-cyan-100 shadow-2xl animate-[portal-toast_4.2s_ease-out_forwards]">{toast.text}</div>}{countdown && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><span className="text-6xl font-black tracking-widest text-cyan-200 drop-shadow-[0_0_18px_rgba(34,211,238,.8)]">{countdown}</span></div>}{matchResult && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/45"><span className={`text-6xl font-black tracking-widest drop-shadow-[0_0_18px_rgba(255,255,255,.7)] ${matchResult === 'WIN' ? 'text-emerald-300' : 'text-rose-300'}`}>{matchResult}</span></div>}</div>
             <div className="mx-auto mt-3 grid max-w-[360px] grid-cols-2 gap-2 md:mt-4"><button onClick={practiceStart} disabled={matchPhase === 'countdown' || matchPhase === 'playing'} className="rounded-xl bg-cyan-400 px-3 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"><Play size={15} className="mr-1 inline" />연습 시작</button><button onClick={matchPhase === 'waiting' ? () => void cancelMatch() : () => void findMatch()} disabled={matchPhase === 'betting' || matchPhase === 'countdown' || matchPhase === 'playing'} className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-2.5 text-sm font-black text-cyan-100 disabled:opacity-40">{matchPhase === 'waiting' ? '매칭 취소' : '매칭 찾기'}</button><button onClick={() => dispatch({ type: 'TOGGLE_PAUSE' })} disabled={!game.running} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-30">{game.paused ? <Play size={15} className="mr-1 inline" /> : <Pause size={15} className="mr-1 inline" />}{game.paused ? '계속' : '일시정지'}</button><button onClick={() => dispatch({ type: 'ROTATE' })} disabled={!game.running || game.paused} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold disabled:opacity-30"><RotateCw size={15} className="mr-1 inline" />회전</button></div><div className="mt-2 text-center text-[10px] text-slate-500 md:mt-3 md:text-[11px]">← → 이동 · ↓ 내리기 · ↑ 회전 · C 다음 블록 · Space 즉시 내리기 · 탭 즉시 내리기</div>
          </section>
           <aside className="space-y-5"><section className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-slate-500">Next block</div><div className="grid w-24 grid-cols-4 gap-1 rounded-xl bg-black/20 p-2">{Array.from({ length: 16 }, (_, i) => { const x = i % 4; const y = Math.floor(i / 4); return <div key={i} className="aspect-square rounded" style={game.nextPiece.shape[y]?.[x] ? { backgroundColor: COLORS[game.nextPiece.type] } : undefined} />; })}</div><p className="mt-4 text-sm text-slate-400">상대가 같은 대전방에 들어오면 상대 블록 화면이 실시간으로 표시됩니다.</p></section>
             <section className="rounded-[2rem] border border-cyan-300/20 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between gap-2"><div className="font-black">상대방 보드</div><span className="text-[10px] font-bold text-cyan-300">{matchStatus}</span></div>{opponent ? <div className="mb-3 flex items-center gap-2"><img src={opponent.image} alt="" className="h-8 w-8 rounded-full object-cover" /><div className="min-w-0"><div className="truncate text-sm font-bold">{opponent.name}</div><div className="text-[10px] text-slate-500">{opponent.country || 'Global'}</div></div></div> : <p className="mb-3 text-xs text-slate-500">매칭 찾기를 누르면 접속 회원에게 대전 신청을 보냅니다.</p>}<div className="mx-auto max-w-[230px] rounded-2xl border border-white/10 bg-[#050914] p-2"><div className="grid grid-cols-10 gap-0.5 rounded-xl bg-[#0b1221] p-1">{opponentVisual.flatMap((row, y) => row.map((cell, x) => <div key={`${x}-${y}`} className={`aspect-square rounded-[2px] ${cell === 0 ? 'bg-white/[0.025]' : cell === -1 ? 'border border-dashed border-cyan-100/50 bg-cyan-200/10' : 'shadow-[inset_0_1px_0_rgba(255,255,255,.55)]'}`} style={cell > 0 ? { backgroundColor: COLORS[cell - 1] } : undefined} />))}</div></div><p className="mt-3 text-center text-[11px] text-slate-500">{opponentState ? '상대 게임 상태를 수신 중' : '상대가 연결되면 보드가 나타납니다.'}</p></section>
             <section className="rounded-[2rem] border border-amber-300/20 bg-[#10182b] p-5"><div className="mb-2 flex items-center justify-between"><div className="font-black">대전 설정</div><span className="text-[10px] font-bold text-amber-300">{matchPhase}</span></div><p className="mb-3 text-xs text-slate-400">{inviteStatus || matchStatus}</p>{matchPhase === 'waiting' && <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm font-bold text-cyan-100">상대방을 찾는 중입니다...</div>}{matchPhase === 'betting' && <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">참가비는 매 경기 서버 잔고에서 설정한 금액만 예약됩니다.</div>}{matchPhase === 'betting' && matchRole === 'A' && <div className="space-y-2"><label className="block text-xs font-bold text-amber-100">참가비 설정 (1~100 USDT)<input type="number" min={MIN_ENTRY_FEE} max={MAX_ENTRY_FEE} step="1" value={betAmount} onChange={(event) => setBetAmount(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-amber-300" /></label><button onClick={() => void confirmBet()} disabled={readyForBattle} className="w-full rounded-xl bg-amber-300 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40">참가비 확정 · 준비하기</button></div>}{matchPhase === 'betting' && matchRole === 'B' && <div className="space-y-2"><div className="rounded-xl bg-amber-300/10 px-3 py-2 text-sm text-amber-100">상대가 설정한 참가비: {formatUsdt(betAmount)} USDT</div><button onClick={() => void confirmBet()} disabled={readyForBattle} className="w-full rounded-xl bg-amber-300 py-2.5 text-sm font-black text-slate-950 disabled:opacity-40">수락하고 준비하기</button></div>}{matchPhase === 'finished' && <div className={`rounded-xl px-3 py-3 text-center text-xl font-black ${matchResult === 'WIN' ? 'bg-emerald-300/10 text-emerald-200' : 'bg-rose-300/10 text-rose-200'}`}>{matchResult || '대전 종료'}</div>}</section>
             {matchId && matchPhase === 'betting' && <section className="rounded-[2rem] border border-rose-400/30 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between"><div className="font-black">실시간 준비 상태</div><span className="text-[10px] font-bold text-slate-500">자동 갱신</span></div><div className="grid grid-cols-2 gap-2 text-center text-xs"><div className={`rounded-xl px-3 py-3 ${readyForBattle ? 'bg-emerald-300/15 text-emerald-200' : 'bg-white/[.05] text-slate-400'}`}>나<br /><b className="text-sm">{readyForBattle ? '준비 완료' : '준비 전'}</b></div><div className={`rounded-xl px-3 py-3 ${opponentReady ? 'bg-emerald-300/15 text-emerald-200' : 'bg-white/[.05] text-slate-400'}`}>상대<br /><b className="text-sm">{opponentReady ? '준비 완료' : '준비 전'}</b></div></div>{matchRole === 'A' && readyForBattle && opponentReady && !roomStartAt && <button onClick={() => void startBattle()} className="mt-4 w-full rounded-xl bg-rose-500 py-3.5 text-sm font-black text-white shadow-[0_0_24px_rgba(244,63,94,.35)] transition hover:bg-rose-400">빨간 시작 버튼 · 대전 시작</button>}{readyForBattle && !opponentReady && <p className="mt-3 text-center text-xs text-slate-500">상대방의 준비 완료를 기다리는 중입니다.</p>}</section>}
            <section className="flex min-h-[240px] flex-col md:min-h-[360px] rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-black"><MessageCircle size={17} className="text-cyan-300" /> 실시간 메시지</div><span className="text-[10px] font-bold text-emerald-300">LIVE</span></div><div className="flex-1 space-y-3 overflow-y-auto pr-1">{messages.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">아직 메시지가 없습니다.</p> : messages.map((message) => <div key={message.id} className="rounded-2xl bg-white/[0.045] p-3"><div className="mb-1 flex justify-between gap-2 text-[10px]"><b className="text-cyan-200">{message.user}</b><span className="text-slate-600">{formatTime(message.createdAt)}</span></div><p className="break-words text-sm text-slate-200">{message.text}</p></div>)}</div>{user ? <form onSubmit={sendMessage} className="mt-4 flex gap-2"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} placeholder="게임 중 메시지..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300" /><button aria-label="메시지 보내기" className="rounded-xl bg-cyan-400 px-3 text-slate-950"><Send size={16} /></button></form> : <p className="mt-4 text-center text-xs text-slate-500">로그인 후 참여할 수 있습니다.</p>}</section>
             <section className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5"><div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 font-black"><Users size={17} className="text-emerald-300" /> 실제 접속 회원</div><span className="text-[10px] font-bold text-emerald-300">클릭하여 신청</span></div>{onlineUsers.length === 0 ? <p className="text-sm text-slate-500">현재 접속 중인 인증 회원이 없습니다.</p> : <div className="space-y-2">{onlineUsers.filter((online) => online.id !== user?.id).map((online) => <div key={online.id} className={`rounded-xl p-2.5 transition ${selectedOnlineUserId === online.id ? 'bg-cyan-300/10 ring-1 ring-cyan-300/40' : 'bg-white/[0.04]'}`}><button onClick={() => setSelectedOnlineUserId(selectedOnlineUserId === online.id ? null : online.id)} className="flex w-full items-center gap-2 text-left"><img src={online.image} alt="" className="h-8 w-8 rounded-full object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{online.name}</span><span className="text-[10px] text-emerald-300">● {online.country || '국가 미설정'}</span></span></button>{selectedOnlineUserId === online.id && <button onClick={() => void sendInvite(online)} disabled={matchPhase === 'betting' || matchPhase === 'countdown' || matchPhase === 'playing'} className="mt-2 w-full rounded-lg bg-cyan-400 py-2 text-xs font-black text-slate-950 disabled:opacity-40">대전 신청하기</button>}</div>)}</div>}</section></aside>
        </div>
      </div>
    </div>
  );
}
