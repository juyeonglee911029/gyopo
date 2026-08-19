'use client';
import BannerAd from '@/components/ads/BannerAd';
import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';

const directories = [
  { id: 1, name: '서울종합병원', category: '의료/건강', desc: '한인 전문의 진료, 내과/외과/치과', tel: '010-1234-5678', country: 'KR', img: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=500&q=80' },
  { id: 2, name: '가나다 부동산', category: '부동산', desc: '유학생 렌트, 상가 임대, 주택 매매 전문', tel: '+1-123-456-7890', country: 'US', img: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=500&q=80' },
  { id: 3, name: '맛있는 코리안BBQ', category: '식당/요식업', desc: '참숯 구이, 무한리필, 단체 회식 환영', tel: '+81-90-1234-5678', country: 'JP', img: 'https://images.unsplash.com/photo-1544025162-81111420d4d1?w=500&q=80' },
  { id: 4, name: '스피드 이삿짐', category: '생활/서비스', desc: '포장이사, 귀국이사, 소형 화물 운송', tel: '+61-4-1234-5678', country: 'AU', img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&q=80' },
];

export default function DirectoryPage() {
  const { selectedCountry } = useGlobalStore();

  const filteredDirectories = selectedCountry === 'Global'
    ? directories
    : directories.filter(d => d.country === selectedCountry);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-black text-gray-900">글로벌 한인 업소록</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">
          {selectedCountry === 'Global' ? '전 세계' : selectedCountry} 현지 믿을 수 있는 한인 비즈니스를 쉽게 찾고 연락해보세요.
        </p>
        <div className="max-w-xl mx-auto mt-6 flex gap-2">
          <input 
            type="text" 
            placeholder="업체명, 카테고리, 키워드 검색..." 
            className="flex-1 bg-white border border-gray-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
          <button className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-sm">
            검색
          </button>
        </div>
      </div>

      {filteredDirectories.length === 0 && (
         <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 mb-12">
            <span className="text-4xl block mb-4">🏪</span>
            <p className="text-gray-500">해당 국가에 등록된 업체가 없습니다.</p>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {filteredDirectories.map((biz) => (
          <Link href="#" key={biz.id} className="group">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative">
               <div className="absolute top-3 right-3 z-10">
                <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md">
                  {biz.country}
                </span>
              </div>
              <div className="h-40 overflow-hidden relative">
                <img src={biz.img} alt={biz.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-gray-700">
                  {biz.category}
                </div>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600">{biz.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                  {biz.desc}
                </p>
                <div className="pt-4 mt-4 border-t border-gray-100 flex items-center text-sm font-medium text-gray-700">
                  📞 {biz.tel}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="max-w-4xl mx-auto">
        <BannerAd type="horizontal" />
      </div>
    </div>
  );
}