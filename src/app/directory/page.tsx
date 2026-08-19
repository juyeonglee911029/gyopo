'use client';

import { useEffect, useState } from 'react';
import BannerAd from '@/components/ads/BannerAd';
import { createDocument, getSessionToken, listDocuments } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';
import { seedDirectories } from '@/lib/seedData';

type Directory = { id: string; name: string; category: string; desc: string; tel: string; country: string; image?: string; authorId: string; createdAt: string; sourceUrl?: string; sourceName?: string };

export default function DirectoryPage() {
  const { selectedCountry, user } = useGlobalStore();
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [search, setSearch] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', desc: '', tel: '', image: '' });

  const loadDirectories = async () => {
    try {
      const data = await listDocuments<Omit<Directory, 'id'>>('directories', getSessionToken());
       setDirectories([...data, ...seedDirectories].filter((directory) => directory.authorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
     } catch { setDirectories(seedDirectories); }
  };

  useEffect(() => { void loadDirectories(); }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return window.alert('로그인 후 업체를 등록할 수 있습니다.');
    const token = getSessionToken();
    if (!token) return;
    try {
      await createDocument('directories', crypto.randomUUID(), { ...form, country: selectedCountry, authorId: user.id, createdAt: new Date().toISOString() }, token);
      setForm({ name: '', category: '', desc: '', tel: '', image: '' });
      setIsWriting(false);
      await loadDirectories();
    } catch { window.alert('업체 정보를 저장하지 못했습니다.'); }
  };

  const filteredDirectories = directories.filter((directory) => {
    const countryMatches = selectedCountry === 'Global' || directory.country === selectedCountry;
    const searchMatches = `${directory.name} ${directory.category} ${directory.desc}`.toLowerCase().includes(search.toLowerCase());
    return countryMatches && searchMatches;
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-black text-gray-900">글로벌 한인 업소록</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">실제로 등록된 한인 비즈니스를 찾고 연락해보세요.</p>
        <div className="max-w-xl mx-auto mt-6 flex gap-2"><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="업체명, 카테고리, 키워드 검색..." className="flex-1 bg-white border border-gray-300 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" /><button onClick={() => setIsWriting(true)} className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition shadow-sm whitespace-nowrap">업체 등록</button></div>
      </div>

      {filteredDirectories.length === 0 && <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 mb-12"><span className="text-4xl block mb-4">🏪</span><p className="text-gray-500">등록된 업체가 없습니다.</p></div>}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">{filteredDirectories.map((biz) => <div key={biz.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all relative"><div className="absolute top-3 right-3 z-10"><span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md">{biz.country}</span></div><div className="h-40 overflow-hidden relative bg-gray-100 flex items-center justify-center">{biz.image ? <img src={biz.image} alt={biz.name} className="w-full h-full object-cover" /> : <span className="text-4xl text-gray-400">🏢</span>}<div className="absolute top-3 left-3 bg-white/90 px-2 py-1 rounded text-xs font-bold text-gray-700">{biz.category}</div></div><div className="p-5 space-y-2"><h3 className="text-lg font-bold text-gray-900">{biz.name}</h3><p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{biz.desc}</p><div className="pt-4 mt-4 border-t border-gray-100 flex items-center text-sm font-medium text-gray-700">📞 {biz.tel}</div>{biz.sourceUrl && <a href={biz.sourceUrl} target="_blank" rel="noreferrer" className="block text-xs text-blue-600 hover:underline">공식 사이트: {biz.sourceName}</a>}</div></div>)}</div>
      <div className="max-w-4xl mx-auto"><BannerAd type="horizontal" /></div>

      {isWriting && <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-3"><h2 className="text-xl font-black">업체 등록</h2><input required placeholder="업체명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="카테고리" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><textarea required placeholder="업체 소개" rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className="w-full border rounded-xl px-4 py-3 resize-none" /><input required placeholder="전화번호" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input type="url" placeholder="대표 이미지 URL (선택)" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 border rounded-xl py-3 font-bold">취소</button><button className="flex-1 bg-gray-900 text-white rounded-xl py-3 font-bold">등록</button></div></form></div>}
    </div>
  );
}
