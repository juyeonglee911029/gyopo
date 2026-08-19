'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getDocument, getSessionToken } from '@/lib/firebase';

export const runtime = 'edge';

type Post = {
  id: string;
  title: string;
  body: string;
  author: string;
  country: string;
  createdAt: string;
};

export default function CommunityPostPage() {
  const params = useParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (!id) return;
    void getDocument<Omit<Post, 'id'>>('posts', id, getSessionToken())
      .then(setPost)
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="container mx-auto px-4 py-20 text-center text-gray-400">게시글을 불러오는 중입니다...</div>;
  if (!post) return <div className="container mx-auto px-4 py-20 text-center"><p className="text-gray-500 mb-4">게시글을 찾을 수 없습니다.</p><Link href="/community" className="text-blue-600 font-bold">커뮤니티로 돌아가기</Link></div>;

  return (
    <article className="container mx-auto px-4 py-8 max-w-3xl">
      <Link href="/community" className="text-sm font-bold text-blue-600">← 커뮤니티</Link>
      <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 md:p-10">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-4"><span className="bg-gray-100 text-gray-600 rounded px-2 py-1 font-bold">{post.country}</span><span>{post.author}</span><span>·</span><span>{new Date(post.createdAt).toLocaleString('ko-KR')}</span></div>
        <h1 className="text-3xl font-black text-gray-900 mb-8">{post.title}</h1>
        <div className="whitespace-pre-wrap text-gray-700 leading-8">{post.body}</div>
      </div>
    </article>
  );
}
