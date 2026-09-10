'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { COMMENT_MAX_LENGTH, flattenComments, isThreadKey, validCommentBody, type PostComment } from '@/lib/comments';
import { createDocument, getSessionToken, isMasterUser, mergeDocument, queryDocumentsWhere } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';
import '@/styles/posts.css';

export function PostComments({ threadKey }: { threadKey: string }) {
  // A route change must never reuse a draft, reply target, or in-flight result from another thread.
  return <CommentThread key={threadKey} threadKey={threadKey} />;
}

function CommentThread({ threadKey }: { threadKey: string }) {
  const user = useGlobalStore((state) => state.user);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [body, setBody] = useState('');
  const [replyId, setReplyId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const locked = useRef(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fieldId = useId();
  const validThread = isThreadKey(threadKey);

  useEffect(() => {
    if (!validThread) return;
    let active = true;
    void queryDocumentsWhere<Omit<PostComment, 'id'>>('comments', [{ field: 'targetKey', op: 'EQUAL', value: threadKey }])
      .then((data) => { if (active) setComments(data); })
      .catch(() => { if (active) setLoadError('댓글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [threadKey, revision, validThread]);

  const reload = () => {
    if (loading || locked.current) return;
    setLoadError('');
    setLoading(true);
    setRevision((value) => value + 1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (locked.current || loading || loadError || !validThread) return;
    setError('');
    setNotice('');
    const token = getSessionToken();
    if (!user || !token) return setError('댓글을 작성하려면 다시 로그인해주세요.');
    if (!validCommentBody(body)) return setError('댓글은 1자 이상 2,000자 이하로 입력해주세요.');
    if (replyId && !comments.some((comment) => comment.id === replyId && comment.targetKey === threadKey)) {
      return setError('답글 대상을 찾을 수 없습니다. 댓글을 새로고침해주세요.');
    }
    const data: Omit<PostComment, 'id'> = {
      targetKey: threadKey, parentId: replyId, authorId: user.id,
      authorName: user.name.trim().slice(0, 100) || '회원', body: body.trim(),
      createdAt: new Date().toISOString(), deleted: false,
    };
    const id = crypto.randomUUID();
    locked.current = true;
    setPending('submit');
    try {
      await createDocument('comments', id, data, token);
      setComments((current) => [...current, { ...data, id }]);
      setBody('');
      setReplyId(null);
      setNotice('댓글을 등록했습니다.');
    } catch {
      setError('댓글을 저장하지 못했습니다. 입력한 내용은 유지됩니다. 로그인과 권한을 확인한 뒤 다시 시도해주세요.');
    } finally {
      locked.current = false;
      setPending(null);
    }
  };

  const remove = async (comment: PostComment) => {
    if (locked.current || loading || comment.deleted || !user || (comment.authorId !== user.id && !isMasterUser(user))) return;
    if (!window.confirm('댓글을 삭제할까요? 연결된 답글은 그대로 남습니다.')) return;
    const token = getSessionToken();
    if (!token) return setError('댓글을 삭제하려면 다시 로그인해주세요.');
    locked.current = true;
    setPending(comment.id);
    setError('');
    setNotice('');
    const tombstone = { body: '', deleted: true, deletedAt: new Date().toISOString() };
    try {
      await mergeDocument('comments', comment.id, tombstone, token);
      setComments((current) => current.map((item) => item.id === comment.id ? { ...item, ...tombstone } : item));
      setNotice('댓글을 삭제했습니다. 답글은 유지됩니다.');
    } catch {
      setError('댓글을 삭제하지 못했습니다. 로그인과 권한을 확인한 뒤 다시 시도해주세요.');
    } finally {
      locked.current = false;
      setPending(null);
    }
  };

  if (!validThread) return <section className="post-comments"><p className="post-error" role="alert">댓글을 연결할 게시글 정보가 올바르지 않습니다.</p></section>;

  const rows = flattenComments(comments, threadKey);
  const reply = comments.find((comment) => comment.id === replyId);
  const busy = Boolean(pending) || loading;
  return <section className="post-comments" aria-labelledby={`${fieldId}-heading`} aria-busy={busy}>
    <header className="post-comments-header">
      <h2 id={`${fieldId}-heading`}>댓글 <span>{rows.filter(({ comment }) => !comment.deleted).length}</span></h2>
      <button type="button" onClick={reload} disabled={busy}>새로고침</button>
    </header>
    {loading && <p className="post-muted" role="status">댓글을 불러오는 중입니다...</p>}
    {loadError && <p className="post-error" role="alert">{loadError} <button type="button" onClick={reload}>다시 시도</button></p>}
    {error && <p className="post-error" role="alert">{error} <Link href="/login">로그인</Link></p>}
    {notice && <p className="post-notice" role="status">{notice}</p>}
    {user ? <form className="post-comment-form" onSubmit={submit}>
      <label htmlFor={fieldId}>{reply ? `${reply.deleted ? '삭제된 댓글' : reply.authorName}에 답글` : '댓글 남기기'}</label>
      {reply && <div className="post-reply-target"><span>{reply.deleted ? '삭제된 댓글입니다.' : reply.body}</span><button type="button" disabled={Boolean(pending)} onClick={() => setReplyId(null)}>답글 취소</button></div>}
      <textarea ref={textarea} id={fieldId} value={body} maxLength={COMMENT_MAX_LENGTH} rows={3} required disabled={Boolean(pending)} onChange={(event) => setBody(event.target.value)} placeholder="서로 존중하는 대화를 나눠주세요." aria-describedby={`${fieldId}-length`} />
      <div className="post-comment-form-footer"><span id={`${fieldId}-length`}>{body.length.toLocaleString()} / 2,000</span><button type="submit" disabled={busy || Boolean(loadError) || !validCommentBody(body)}>{pending === 'submit' ? '등록 중...' : reply ? '답글 등록' : '댓글 등록'}</button></div>
    </form> : <p className="post-login-prompt">댓글과 답글은 로그인 후 작성할 수 있습니다. <Link href="/login">로그인</Link></p>}
    {!loading && !loadError && rows.length === 0 && <p className="post-muted">첫 댓글을 남겨보세요.</p>}
    <ol className="post-comment-list">
      {rows.map(({ comment, depth, parent }) => <li key={comment.id} id={`comment-${comment.id}`} className="post-comment" style={{ marginInlineStart: `${Math.min(depth, 3) * 0.75}rem` }}>
        <div className="post-comment-meta"><strong>{comment.deleted ? '삭제된 댓글' : comment.authorName}</strong><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ko-KR')}</time></div>
        {parent && <a className="post-comment-parent" href={`#comment-${parent.id}`}>{parent.deleted ? '삭제된 댓글' : parent.authorName}에게 답글</a>}
        <p className={comment.deleted ? 'post-muted' : 'post-comment-body'}>{comment.deleted ? '삭제된 댓글입니다.' : comment.body}</p>
        <div className="post-comment-actions">
          {user && <button type="button" disabled={busy} onClick={() => { setReplyId(comment.id); textarea.current?.focus(); textarea.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }}>답글</button>}
          {user && !comment.deleted && (comment.authorId === user.id || isMasterUser(user)) && <button type="button" className="post-delete-button" disabled={busy} onClick={() => void remove(comment)}>{pending === comment.id ? '삭제 중...' : '삭제'}</button>}
        </div>
      </li>)}
    </ol>
  </section>;
}

export default PostComments;
