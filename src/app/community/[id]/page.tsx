'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { deleteDocument, getDocument, getSessionToken, incrementDocument, mergeDocument } from '@/lib/firebase';
import { seedPosts } from '@/lib/seedData';
import { useGlobalStore } from '@/store/useGlobalStore';

export const runtime = 'edge';

type Post = {
  id: string;
  title: string;
  body: string;
  author: string;
  country: string;
  createdAt: string;
  authorId: string;
  views?: number;
  sourceName?: string;
  sourceUrl?: string;
};

export default function CommunityPostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useGlobalStore((state) => state.user);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!id) return;
    const load = async () => {
      const stored = await getDocument<Omit<Post, 'id'>>('posts', id, getSessionToken()).catch(() => null);
      const next = stored || seedPosts.find((item) => item.id === id) || null;
      setPost(next);
      setTitle(next?.title || '');
      setBody(next?.body || '');
      if (next && !id.startsWith('seed-')) {
        await incrementDocument('posts', id, 'views', 1, getSessionToken()).catch(() => undefined);
        setPost((current) => current ? { ...current, views: Number(current.views || 0) + 1 } : current);
      }
      setLoading(false);
    };
    void load();
  }, [params.id]);

  if (loading) return <div className="container mx-auto px-4 py-20 text-center text-gray-400">게시글을 불러오는 중입니다...</div>;
  if (!post) return <div className="container mx-auto px-4 py-20 text-center"><p className="text-gray-500 mb-4">게시글을 찾을 수 없습니다.</p><Link href="/community" className="text-blue-600 font-bold">커뮤니티로 돌아가기</Link></div>;

  const canEdit = Boolean(user && user.id === post.authorId && !post.id.startsWith('seed-'));
  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = getSessionToken();
    if (!token || !canEdit || !title.trim() || !body.trim()) return;
    await mergeDocument('posts', post.id, { title: title.trim(), body: body.trim(), updatedAt: new Date() }, token);
    setPost({ ...post, title: title.trim(), body: body.trim() });
    setEditing(false);
  };

  const removePost = async () => {
    const token = getSessionToken();
    if (!token || !canEdit || !window.confirm('이 게시글을 삭제할까요?')) return;
    await deleteDocument('posts', post.id, token);
    router.push('/community');
  };

  return (
    <article className="container mx-auto px-4 py-8 max-w-3xl">
      <Link href="/community" className="text-sm font-bold text-blue-600">← 커뮤니티</Link>
      <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-10">
         <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-4"><span className="bg-gray-100 text-gray-600 rounded px-2 py-1 font-bold">{post.country}</span><span>{post.author}</span><span>·</span><span>{new Date(post.createdAt).toLocaleString('ko-KR')}</span><span>· 조회 {post.views || 0}</span>{post.sourceName && <span>· 출처 {post.sourceName}</span>}</div>
         <h1 className="text-3xl font-black text-gray-900 mb-8">{post.title}</h1>
         <div className="whitespace-pre-wrap text-gray-700 leading-8">{post.body}</div>
         {post.sourceUrl && <a href={post.sourceUrl} target="_blank" rel="noreferrer" className="mt-8 inline-block text-sm font-bold text-blue-600 hover:underline">원문 출처 보기</a>}
         {canEdit && <div className="mt-10 flex gap-2 border-t border-gray-100 pt-5"><button onClick={() => setEditing(true)} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">수정</button><button onClick={() => void removePost()} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600">삭제</button></div>}
      </div>
      {editing && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"><form onSubmit={saveEdit} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">게시글 수정</h2><input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3" /><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3" /><div className="flex gap-2"><button type="button" onClick={() => setEditing(false)} className="flex-1 rounded-xl border py-3 font-bold">취소</button><button className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white">저장</button></div></form></div>}
    </article>
  );
}
