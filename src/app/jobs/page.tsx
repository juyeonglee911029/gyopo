'use client';
import BannerAd from '@/components/ads/BannerAd';
import Link from 'next/link';
import { useGlobalStore } from '@/store/useGlobalStore';

// Mock data for jobs
const jobs = [
  { id: 1, title: '한국 식당 홀 서빙 구합니다', company: 'K-BBQ', location: '시내 중심가', salary: '시급 $15', tag: '파트타임', country: 'US' },
  { id: 2, title: '웹 개발자 모십니다 (재택 가능)', company: 'Tech Korea', location: '재택/오피스', salary: '연봉 협의', tag: '정규직', country: 'KR' },
  { id: 3, title: '물류창고 포장 및 관리직', company: '글로벌 로지스', location: '외곽 산업단지', salary: '월 $3,000', tag: '정규직', country: 'AU' },
  { id: 4, title: '주말 카페 바리스타', company: '서울카페', location: '대학가', salary: '시급 $14', tag: '파트타임', country: 'JP' },
];

export default function JobsPage() {
  const { selectedCountry } = useGlobalStore();
  
  // Filter jobs based on global country selection (mock)
  const filteredJobs = selectedCountry === 'Global' 
    ? jobs 
    : jobs.filter(j => j.country === selectedCountry);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-800">구인/구직</h1>
          <p className="text-gray-500 mt-2 font-bold text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full inline-block">
            {selectedCountry === 'Global' ? '전체 국가 결과' : `${selectedCountry} 맞춤 검색 결과`}
          </p>
        </div>
        <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-md transition">
          구인 글쓰기
        </button>
      </div>

      <div className="mb-8">
        <BannerAd type="horizontal" />
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 flex-shrink-0 space-y-6">
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">필터</h3>
            <div className="space-y-3">
              <label className="flex items-center space-x-2 text-gray-600 cursor-pointer hover:text-blue-600">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>정규직</span>
              </label>
              <label className="flex items-center space-x-2 text-gray-600 cursor-pointer hover:text-blue-600">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>파트타임</span>
              </label>
              <label className="flex items-center space-x-2 text-gray-600 cursor-pointer hover:text-blue-600">
                <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span>재택근무</span>
              </label>
            </div>
          </div>
          <BannerAd type="vertical" />
        </aside>

        <main className="flex-1 space-y-4">
          {filteredJobs.length === 0 && (
             <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-4xl block mb-4">📭</span>
                <p className="text-gray-500">해당 국가의 구인/구직 공고가 없습니다.</p>
             </div>
          )}
          {filteredJobs.map((job) => (
            <Link href="#" key={job.id} className="block group">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-md">[{job.country}]</span>
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-md">{job.tag}</span>
                    <span className="text-gray-500 text-sm font-medium">{job.company}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {job.title}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                    <span className="flex items-center gap-1">📍 {job.location}</span>
                    <span className="flex items-center gap-1">💰 {job.salary}</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </main>
      </div>
    </div>
  );
}