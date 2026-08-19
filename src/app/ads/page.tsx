'use client';

import { useState } from 'react';
import { useGlobalStore } from '@/store/useGlobalStore';
import { Megaphone, Image as ImageIcon, Link as LinkIcon, Calendar, Info } from 'lucide-react';

export default function AdsPage() {
  const { user, updateUsdt, addTransaction } = useGlobalStore();
  const [days, setDays] = useState(1);
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const totalCost = days * 60;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("로그인이 필요합니다.");
    if (!imageUrl || !linkUrl) return alert("이미지 URL과 연결 링크를 모두 입력해주세요.");
    if (user.usdtBalance < totalCost) return alert(`잔고가 부족합니다. (${totalCost} USDT 필요)`);

    // Process payment
    updateUsdt(-totalCost);
    addTransaction({
      type: 'ADS',
      amount: totalCost,
      status: 'COMPLETED',
      details: `셀프 광고 등록 (${days}일)`
    });

    alert(`[시스템] 광고 등록이 완료되었습니다! ${totalCost} USDT가 차감되었습니다.\n(설정하신 기간이 지나면 자동 삭제됩니다.)`);
    setDays(1);
    setImageUrl('');
    setLinkUrl('');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-10 space-y-4">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 flex items-center justify-center gap-3">
          <Megaphone className="text-blue-600" size={36} />
          셀프서비스 광고 센터
        </h1>
        <p className="text-gray-500 text-lg">
          누구의 도움 없이도 직접 배너 광고를 올리세요. <strong className="text-gray-800">하루 60 USDT</strong>로 전 세계 교민들에게 도달합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Form */}
        <div className="bg-white rounded-3xl p-8 shadow-lg border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                <ImageIcon size={16} /> 배너 이미지 업로드
              </label>
              <input 
                type="file" 
                accept="image/*"
                required
                onChange={e => {
                  if(e.target.files && e.target.files[0]){
                    setImageUrl(URL.createObjectURL(e.target.files[0]));
                  }
                }}
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">
                권장 사이즈: <strong>가로형(1200x300), 세로형(300x600), 정사각형(500x500)</strong>
              </p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                <LinkIcon size={16} /> 클릭 시 연결될 링크
              </label>
              <input 
                type="url" 
                required
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://mybusiness.com" 
                className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                <Calendar size={16} /> 게재 기간 (일)
              </label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="1" max="30" 
                  value={days}
                  onChange={e => setDays(Number(e.target.value))}
                  className="flex-1 accent-blue-600"
                />
                <span className="font-black text-xl text-blue-600 w-16 text-right">{days} 일</span>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <span className="text-gray-500 font-bold">총 결제 금액:</span>
                <span className="text-3xl font-black text-gray-900">{totalCost} <span className="text-lg text-gray-500">USDT</span></span>
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 shadow-md transition text-lg"
              >
                결제 및 광고 시작하기
              </button>
            </div>
          </form>
        </div>

        {/* Instructions & Preview */}
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-3xl p-6 border border-blue-100">
            <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
              <Info size={18} /> 이용 안내
            </h3>
            <ul className="space-y-3 text-sm text-blue-700/80 list-disc pl-5">
              <li>등록 즉시 메인 페이지 및 각 서브 페이지 배너 영역에 광고가 노출됩니다.</li>
              <li>광고 비용은 <strong>하루(24시간) 기준 60 USDT</strong>입니다.</li>
              <li>설정하신 기간이 만료되면 시스템이 자동으로 광고를 내립니다.</li>
              <li>부적절한 내용의 광고는 관리자 직권으로 삭제될 수 있으며 환불되지 않습니다.</li>
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">미리보기 (Preview)</h3>
            <div className="w-full aspect-[21/9] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center relative">
              {imageUrl ? (
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 font-bold text-sm">이미지 URL을 입력하세요</span>
              )}
              <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded font-bold backdrop-blur-sm">AD</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}