'use client';
import { useState } from 'react';
import { PlayCircle, Star, Clock, Calendar } from 'lucide-react';

const movies = [
  { id: 1, title: '범죄도시4 (2024)', genre: '액션/범죄', playtime: '109분', rating: '8.5', url: 'https://www.youtube.com/embed/5-bKqT9B0XQ?autoplay=1', desc: '괴물형사 마석도, 대규모 온라인 불법 도박 조직을 소탕하기 위해 사이버수사대와 공조하여 진실을 파헤친다.', actors: '마동석, 김무열, 박지환' },
  { id: 2, title: '파묘 (2024)', genre: '미스터리/오컬트', playtime: '134분', rating: '9.0', url: 'https://www.youtube.com/embed/EdeH3x4Fw-I?autoplay=1', desc: '미국 LA, 거액의 의뢰를 받은 무당 화림과 봉길은 기이한 병이 대물림되는 집안의 장손을 만난다.', actors: '최민식, 김고은, 유해진' },
  { id: 3, title: '눈물의 여왕 (드라마)', genre: '로맨스/코미디', playtime: '총 16부작', rating: '9.5', url: 'https://www.youtube.com/embed/Zz_jA7sR-hE?autoplay=1', desc: '퀸즈 그룹 재벌 3세, 백화점의 여왕 홍해인. 용두리 이장 아들, 슈퍼마켓 왕자 백현우. 3년 차 부부의 아찔한 위기와 기적처럼 다시 시작되는 사랑 이야기.', actors: '김수현, 김지원' },
];

export default function TheaterPage() {
  const [activeMovie, setActiveMovie] = useState(movies[0]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
             <PlayCircle size={32} className="text-red-600" />
             글로벌 교포 극장 (VOD)
           </h1>
           <p className="text-sm text-gray-500 mt-2">
             해외에서 즐기는 최신 한국 영화 및 드라마 상영관입니다.
           </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Video Player */}
        <div className="lg:col-span-2 space-y-6">
          <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-gray-900">
            {/* Mock iframe player (using Youtube for demo) */}
            <iframe 
              src={activeMovie.url} 
              title={activeMovie.title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
            ></iframe>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
             <h2 className="text-2xl font-black text-gray-900 mb-2">{activeMovie.title}</h2>
             <div className="flex gap-4 text-sm text-gray-600 font-bold mb-6">
                <span className="flex items-center gap-1"><Star size={16} className="text-yellow-500"/> 평점: {activeMovie.rating}</span>
                <span className="flex items-center gap-1"><Clock size={16} className="text-blue-500"/> {activeMovie.playtime}</span>
                <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-600">{activeMovie.genre}</span>
             </div>
             
             <div className="space-y-4">
                <div>
                   <h3 className="text-gray-500 text-xs font-bold mb-1 uppercase tracking-widest">줄거리 (SYNOPSIS)</h3>
                   <p className="text-gray-800 leading-relaxed">{activeMovie.desc}</p>
                </div>
                <div>
                   <h3 className="text-gray-500 text-xs font-bold mb-1 uppercase tracking-widest">출연 (CAST)</h3>
                   <p className="text-gray-800 font-medium">{activeMovie.actors}</p>
                </div>
             </div>
          </div>
        </div>

        {/* Playlist */}
        <div className="space-y-4">
           <h3 className="font-black text-xl text-gray-800 border-b border-gray-200 pb-2">현재 상영작 리스트</h3>
           <div className="space-y-3">
             {movies.map(movie => (
               <div 
                 key={movie.id} 
                 onClick={() => setActiveMovie(movie)}
                 className={`cursor-pointer rounded-2xl p-4 transition-all flex gap-4 ${activeMovie.id === movie.id ? 'bg-red-50 border-2 border-red-200 shadow-md' : 'bg-white border border-gray-100 hover:shadow hover:border-gray-300'}`}
               >
                 <div className="w-24 h-32 bg-gray-200 rounded-lg shrink-0 overflow-hidden relative flex items-center justify-center border border-gray-300">
                    <span className="text-4xl">🎬</span>
                    {activeMovie.id === movie.id && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                         <span className="text-white text-xs font-bold bg-red-600 px-2 py-1 rounded-full">재생중</span>
                      </div>
                    )}
                 </div>
                 <div className="flex flex-col justify-center">
                    <h4 className={`font-bold ${activeMovie.id === movie.id ? 'text-red-700' : 'text-gray-800'}`}>{movie.title}</h4>
                    <span className="text-xs text-gray-500 mt-1">{movie.genre}</span>
                    <span className="text-xs text-yellow-600 font-bold mt-2">★ {movie.rating}</span>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}