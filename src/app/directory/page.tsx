'use client';

import { useEffect, useState } from 'react';
import BannerAd from '@/components/ads/BannerAd';
import { createDocument, getSessionToken, listDocuments } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';
import { seedDirectories } from '@/lib/seedData';

type Directory = { id: string; name: string; category: string; desc: string; tel: string; address?: string; rating?: number; reviews?: number; lat?: number; lng?: number; country: string; image?: string; authorId: string; createdAt: string; sourceUrl?: string; sourceName?: string };

export default function DirectoryPage() {
  const { selectedCountry, user } = useGlobalStore();
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [search, setSearch] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', desc: '', tel: '', address: '', image: '' });
  const [category, setCategory] = useState('전체');
  const [minRating, setMinRating] = useState('0');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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
      await createDocument('directories', crypto.randomUUID(), { ...form, country: selectedCountry, authorId: user.id, createdAt: new Date().toISOString(), rating: 0, reviews: 0 }, token);
      setForm({ name: '', category: '', desc: '', tel: '', address: '', image: '' });
      setIsWriting(false);
      await loadDirectories();
    } catch { window.alert('업체 정보를 저장하지 못했습니다.'); }
  };

  const filteredDirectories = directories.filter((directory) => {
    const countryMatches = selectedCountry === 'Global' || directory.country === selectedCountry;
    const categoryMatches = category === '전체' || directory.category === category;
    const ratingMatches = Number(directory.rating || 0) >= Number(minRating);
    const searchMatches = `${directory.name} ${directory.category} ${directory.desc} ${directory.address || ''}`.toLowerCase().includes(search.toLowerCase());
    return countryMatches && categoryMatches && ratingMatches && searchMatches;
  });
  const categories = ['전체', ...Array.from(new Set(directories.map((directory) => directory.category).filter(Boolean)))];
  const distanceKm = (directory: Directory) => {
    if (!userLocation || !directory.lat || !directory.lng) return null;
    const r = Math.PI / 180;
    const a = Math.sin((directory.lat - userLocation.lat) * r / 2) ** 2 + Math.cos(userLocation.lat * r) * Math.cos(directory.lat * r) * Math.sin((directory.lng - userLocation.lng) * r / 2) ** 2;
    return (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl font-black text-gray-900">글로벌 한인 업소록</h1>
        <p className="text-gray-500 max-w-2xl mx-auto">실제로 등록된 한인 비즈니스를 찾고 연락해보세요.</p>
         <div className="mx-auto mt-6 flex max-w-xl flex-wrap gap-2"><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="업체명, 카테고리, 주소 검색..." className="min-w-[220px] flex-1 rounded-xl border border-gray-300 bg-white px-5 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /><button onClick={() => setIsWriting(true)} className="rounded-xl bg-gray-900 px-6 py-3 font-bold text-white shadow-sm transition hover:bg-gray-800">업체 등록</button><button onClick={() => navigator.geolocation?.getCurrentPosition((position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }))} className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold">내 위치</button></div>
         <div className="mt-3 flex justify-center gap-2"><select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold"><option value="전체">모든 카테고리</option>{categories.filter((item) => item !== '전체').map((item) => <option key={item}>{item}</option>)}</select><select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold"><option value="0">모든 평점</option><option value="4">4점 이상</option><option value="4.5">4.5점 이상</option></select></div>
      </div>

      {filteredDirectories.length === 0 && <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100 mb-12"><span className="text-4xl block mb-4">🏪</span><p className="text-gray-500">등록된 업체가 없습니다.</p></div>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">{filteredDirectories.map((biz) => <div key={biz.id} className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-xl"><div className="absolute right-3 top-3 z-10"><span className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-md">{biz.country}</span></div><div className="relative flex h-40 items-center justify-center overflow-hidden bg-gray-100">{biz.image ? <img src={biz.image} alt={biz.name} className="h-full w-full object-cover" /> : <span className="text-4xl text-gray-400">🏢</span>}<div className="absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-xs font-bold text-gray-700">{biz.category}</div></div><div className="space-y-2 p-5"><h3 className="text-lg font-bold text-gray-900">{biz.name}</h3><div className="flex items-center gap-2 text-sm"><span className="font-black text-amber-500">★ {Number(biz.rating || 0).toFixed(1)}</span><span className="text-xs text-gray-400">({biz.reviews || 0} reviews)</span>{distanceKm(biz) && <span className="ml-auto text-xs font-bold text-cyan-600">{distanceKm(biz)} km</span>}</div><p className="line-clamp-2 text-sm leading-relaxed text-gray-500">{biz.desc}</p>{biz.address && <p className="text-xs text-gray-500">📍 {biz.address}</p>}<div className="mt-4 flex gap-2 border-t border-gray-100 pt-4"><a href={`tel:${biz.tel.replace(/[^\d+]/g, '')}`} className="flex-1 rounded-xl bg-emerald-500 py-2 text-center text-sm font-black text-white">전화</a>{biz.sourceUrl && <a href={biz.sourceUrl} target="_blank" rel="noreferrer" className="flex-1 rounded-xl border border-blue-200 py-2 text-center text-xs font-bold text-blue-600">공식 정보</a>}</div></div></div>)}</div>
      <div className="max-w-4xl mx-auto"><BannerAd type="horizontal" /></div>

       {isWriting && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">업체 등록</h2><input required placeholder="업체명" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><input required placeholder="카테고리" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><textarea required placeholder="업체 소개" rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} className="w-full resize-none rounded-xl border px-4 py-3" /><input required placeholder="전화번호" value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><input required placeholder="주소" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><input type="url" placeholder="대표 이미지 URL (선택)" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 rounded-xl border py-3 font-bold">취소</button><button className="flex-1 rounded-xl bg-gray-900 py-3 font-bold text-white">등록</button></div></form></div>}
    </div>
  );
}
