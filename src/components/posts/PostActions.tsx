'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { isPostCollection, postThreadKey } from '@/lib/comments';
import { deleteDocument, getDocument, getSessionToken, isMasterUser } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';
import '@/styles/posts.css';

export type PostActionsProps = { collection: string; id: string; authorId?: string; backHref: string };

export function PostActions({ collection, id, authorId, backHref }: PostActionsProps) {
  const user = useGlobalStore((state) => state.user);
  const router = useRouter();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const allowed = isPostCollection(collection) && Boolean(postThreadKey(collection, id));
  if (!allowed || !user || (user.id !== authorId && !isMasterUser(user))) return null;

  const remove = async () => {
    if (locked.current || !window.confirm('이 게시글을 삭제할까요? 댓글과 거래 내역은 삭제되지 않습니다.')) return;
    const token = getSessionToken();
    if (!token) return setError('로그인이 만료되었습니다. 다시 로그인해주세요.');
    locked.current = true;
    setPending(true);
    setError('');
    try {
      const stored = await getDocument<{ authorId?: string; sourceId?: string; sourceContentId?: string; sourceUrl?: string }>(collection, id, token);
      if (stored?.sourceId || stored?.sourceContentId || stored?.sourceUrl) {
        throw new Error('출처 콘텐츠는 여기에서 삭제할 수 없습니다.');
      }
      if (stored && stored.authorId !== user.id && !isMasterUser(user)) {
        throw new Error('작성자 또는 운영자만 삭제할 수 있습니다.');
      }
      if (stored) await deleteDocument(collection, id, token);
      // Never mutate comments, orders, or balances when removing a listing.
      router.replace(backHref.startsWith('/') && !backHref.startsWith('//') && !backHref.includes('\\') ? backHref : '/');
      router.refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      setError(message.startsWith('출처 콘텐츠') || message.startsWith('작성자 또는') ? message : '삭제하지 못했습니다. 권한과 로그인 상태를 확인한 뒤 다시 시도해주세요.');
    } finally {
      locked.current = false;
      setPending(false);
    }
  };

  return <div className="post-actions" aria-busy={pending}>
    <button type="button" className="post-delete-button" onClick={() => void remove()} disabled={pending}>{pending ? '삭제 중...' : '삭제'}</button>
    {error && <p className="post-error" role="alert">{error} <Link href="/login">로그인</Link></p>}
  </div>;
}

export default PostActions;
