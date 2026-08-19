'use client';
import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';

const posts = [
  { id: 1, type: 'notice', title: '[필독] 커뮤니티 이용 규정 안내', author: '운영자', date: '2026.08.19', views: 1204, likes: 45, country: 'Global' },
  { id: 2, type: 'news', title: '현지 대사관, 교민 안전 주의보 발령', author: '뉴스봇', date: '2026.08.18', views: 890, likes: 12, country: 'US' },
  { id: 3, type: 'general', title: '요즘 장바구니 물가 체감되시나요?', author: '교민A', date: '10분 전', views: 45, likes: 5, comments: 12, country: 'KR' },
  { id: 4, type: 'general', title: '이번 주말 가족과 가볼만한 곳 추천 부탁드려요', author: '초보맘', date: '1시간 전', views: 120, likes: 2, comments: 8, country: 'JP' },
  { id: 5, type: 'general', title: '현지 운전면허 갱신 후기 공유합니다', author: '드라이버', date: '3시간 전', views: 340, likes: 18, comments: 4, country: 'AU' },
];

export default function CommunityPage() {
  const { selectedCountry } = useGlobalStore();

  const filteredPosts = selectedCountry === 'Global'
    ? posts
    : posts.filter(p => p.country === selectedCountry || p.country === 'Global'); // Always show Global notices

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-black text-gray-800">아쥬게시판 & 뉴스</h1>
           <p className="text-sm text-gray-500 mt-1">상단에서 국가를 선택하면 해당 지역의 소식만 모아볼 수 있습니다.</p>
        </div>
        <button className="bg-blue-600 text-white px-5 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md transition">
          글쓰기
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-500">
          <div className="col-span-1 text-center">분류</div>
          <div className="col-span-1 text-center">국가</div>
          <div className="col-span-5">제목</div>
          <div className="col-span-2 text-center">작성자</div>
          <div className="col-span-1 text-center">날짜</div>
          <div className="col-span-1 text-center">조회</div>
          <div className="col-span-1 text-center">추천</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-gray-100">
          {filteredPosts.length === 0 && (
             <div className="text-center py-20 text-gray-500">
                게시글이 없습니다.
             </div>
          )}
          {filteredPosts.map((post) => (
            <Link href="#" key={post.id} className="block hover:bg-blue-50/50 transition-colors">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 items-center">
                <div className="col-span-1 text-xs md:text-sm font-bold text-center">
                  {post.type === 'notice' && <span className="text-red-500">공지</span>}
                  {post.type === 'news' && <span className="text-blue-500">뉴스</span>}
                  {post.type === 'general' && <span className="text-gray-400">자유</span>}
                </div>
                
                <div className="col-span-1 text-xs md:text-sm font-bold text-center">
                   <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">{post.country}</span>
                </div>

                <div className="col-span-1 md:col-span-5">
                  <h3 className={`text-base md:text-lg truncate ${post.type === 'notice' ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                    {post.title}
                  </h3>
                  {post.comments && (
                    <span className="text-blue-500 text-sm font-bold ml-2">[{post.comments}]</span>
                  )}
                </div>
                
                <div className="col-span-2 text-sm text-gray-500 flex items-center md:justify-center">
                  <span className="md:hidden mr-1">작성자: </span>
                  {post.author}
                </div>
                
                <div className="col-span-1 text-xs md:text-sm text-gray-400 text-center">
                  {post.date}
                </div>
                
                <div className="col-span-1 text-xs md:text-sm text-gray-400 text-center hidden md:block">
                  {post.views}
                </div>
                
                <div className="col-span-1 text-xs md:text-sm text-gray-400 text-center hidden md:block">
                  {post.likes}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center space-x-2">
        <button className="w-10 h-10 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center">&laquo;</button>
        <button className="w-10 h-10 rounded border border-blue-600 bg-blue-600 text-white font-bold flex items-center justify-center">1</button>
        <button className="w-10 h-10 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center">2</button>
        <button className="w-10 h-10 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center">3</button>
        <button className="w-10 h-10 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center">&raquo;</button>
      </div>
    </div>
  );
}