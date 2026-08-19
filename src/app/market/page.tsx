'use client';
import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';

const products = [
  { id: 1, title: '거의 새것 아이폰 14 프로 팔아요', price: '850 USDT', location: '시내', time: '10분 전', country: 'US', img: 'https://images.unsplash.com/photo-1678652197831-2d180705cd2c?w=500&q=80' },
  { id: 2, title: '이케아 2인용 소파 (배달 불가)', price: '50 USDT', location: '외곽 주택가', time: '1시간 전', country: 'KR', img: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500&q=80' },
  { id: 3, title: '귀국이사 가전제품 일괄 처분', price: '400 USDT', location: '대학가', time: '3시간 전', country: 'AU', img: 'https://images.unsplash.com/photo-1626222880054-99890a8276f7?w=500&q=80' },
  { id: 4, title: '전공 서적 및 교양 책', price: '무료나눔', location: '도서관 앞', time: '5시간 전', country: 'US', img: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=500&q=80' },
  { id: 5, title: '자전거 출퇴근용', price: '120 USDT', location: '역 근처', time: '어제', country: 'JP', img: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=500&q=80' },
];

export default function MarketPage() {
  const { selectedCountry } = useGlobalStore();

  const filteredProducts = selectedCountry === 'Global' 
    ? products 
    : products.filter(p => p.country === selectedCountry);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800">에스크로 중고장터</h1>
          <p className="text-gray-500 mt-2">USDT 안전 결제(에스크로)를 지원하는 믿을 수 있는 마켓.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <input 
            type="text" 
            placeholder="물품 검색..." 
            className="flex-1 md:w-64 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
          <button className="bg-orange-500 text-white px-5 py-2 rounded-lg font-bold hover:bg-orange-600 transition whitespace-nowrap shadow-md">
            내 물건 팔기
          </button>
        </div>
      </div>

      {filteredProducts.length === 0 && (
         <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100">
            <span className="text-4xl block mb-4">🛒</span>
            <p className="text-gray-500">해당 국가의 중고장터 매물이 없습니다.</p>
         </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {filteredProducts.map((item) => (
          <Link href="#" key={item.id} className="group">
            <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 relative">
              <div className="absolute top-2 left-2 z-10">
                <span className="bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md">
                  {item.country}
                </span>
              </div>
              <div className="aspect-square overflow-hidden bg-gray-100">
                <img 
                  src={item.img} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="p-4 space-y-2">
                <h3 className="text-gray-900 font-medium truncate group-hover:text-orange-600">{item.title}</h3>
                <div className="font-black text-lg text-green-600 bg-green-50 px-2 py-1 rounded inline-block">
                  {item.price}
                </div>
                <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
                  <span>{item.location}</span>
                  <span>{item.time}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}