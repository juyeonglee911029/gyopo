'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSessionToken, listDocuments, createDocument } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';
import { seedPosts } from '@/lib/seedData';

type Post = {
  id: string;
  type: 'notice' | 'news' | 'general';
  title: string;
  body: string;
  authorId: string;
  author: string;
  country: string;
  createdAt: string;
  views?: number;
  likes?: number;
  comments?: number;
  sourceUrl?: string;
  sourceName?: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export default function CommunityPage() {
  const { selectedCountry, user } = useGlobalStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPosts = async () => {
    try {
      const data = await listDocuments<Omit<Post, 'id'>>('posts', getSessionToken());
       setPosts([...data, ...seedPosts].filter((post) => post.authorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
     } catch {
       setPosts(seedPosts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPosts();
  }, []);

  const handleWrite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      window.alert('로그인 후 글을 작성할 수 있습니다.');
      return;
    }
    if (!title.trim() || !body.trim()) return;
    const token = getSessionToken();
    if (!token) return;
    const post = {
      type: 'general' as const,
      title: title.trim(),
      body: body.trim(),
      authorId: user.id,
      author: user.name,
      country: selectedCountry,
      createdAt: new Date().toISOString(),
      views: 0,
      likes: 0,
      comments: 0,
    };
    try {
      await createDocument('posts', crypto.randomUUID(), post, token);
      setTitle('');
      setBody('');
      setIsWriting(false);
      await loadPosts();
    } catch {
      window.alert('게시글을 저장하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const filteredPosts = selectedCountry === 'Global'
    ? posts
    : posts.filter((post) => post.country === selectedCountry || post.country === 'Global');

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-800">커뮤니티 & 뉴스</h1>
          <p className="text-sm text-gray-500 mt-1">국가별 소식과 교민들의 이야기를 나눠보세요.</p>
        </div>
        <button onClick={() => setIsWriting(true)} className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transition">
          글쓰기
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-500">
          <div className="col-span-1 text-center">분류</div>
          <div className="col-span-1 text-center">국가</div>
          <div className="col-span-5">제목</div>
          <div className="col-span-2 text-center">작성자</div>
          <div className="col-span-2 text-center">날짜</div>
          <div className="col-span-1 text-center">조회</div>
        </div>

        <div className="divide-y divide-gray-100">
          {loading && <div className="text-center py-20 text-gray-400">게시글을 불러오는 중입니다...</div>}
          {!loading && filteredPosts.length === 0 && <div className="text-center py-20 text-gray-500">아직 게시글이 없습니다. 첫 글을 남겨보세요.</div>}
          {filteredPosts.map((post) => (
             <Link href={post.sourceUrl || `/community/${post.id}`} target={post.sourceUrl ? '_blank' : undefined} key={post.id} className="block hover:bg-blue-50/50 transition-colors">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 items-center">
                <div className="col-span-1 text-xs md:text-sm font-bold text-center">
                  <span className={post.type === 'notice' ? 'text-red-500' : post.type === 'news' ? 'text-blue-500' : 'text-gray-400'}>
                    {post.type === 'notice' ? '공지' : post.type === 'news' ? '뉴스' : '자유'}
                  </span>
                </div>
                <div className="col-span-1 text-xs md:text-sm font-bold text-center"><span className="bg-gray-100 px-2 py-1 rounded text-gray-600">{post.country}</span></div>
                <div className="col-span-1 md:col-span-5">
                   <h3 className="text-base md:text-lg truncate font-bold text-gray-800">{post.title}</h3>
                   {post.sourceName && <div className="text-xs text-blue-500">출처: {post.sourceName}</div>}
                  {!!post.comments && <span className="text-blue-500 text-sm font-bold">[{post.comments}]</span>}
                </div>
                   <div className="col-span-2 text-sm text-gray-500 flex items-center md:justify-center"><span className="md:hidden mr-1">작성자: </span>{post.author}</div>
                <div className="col-span-2 text-xs md:text-sm text-gray-400 text-center">{formatDate(post.createdAt)}</div>
                <div className="col-span-1 text-xs md:text-sm text-gray-400 text-center hidden md:block">{post.views || 0}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {isWriting && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}>
          <form onSubmit={handleWrite} className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-xl font-black">새 글 작성</h2><button type="button" onClick={() => setIsWriting(false)} className="text-gray-400 text-xl">×</button></div>
            <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="제목" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea value={body} onChange={(event) => setBody(event.target.value)} required rows={7} placeholder="내용을 입력하세요" className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            <button type="submit" className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold hover:bg-blue-700">게시하기</button>
          </form>
        </div>
      )}
    </div>
  );
}
