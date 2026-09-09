'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BannerAd from '@/components/ads/BannerAd';
import { createDocument, deleteDocument, getSessionToken, isMasterUser, listDocuments } from '@/lib/firebase';
import { sourceItemId } from '@/lib/contentSources';
import { fetchSourceCategory } from '@/lib/sourcepreview';
import { FEATURED_KOREAN_RESTAURANTS } from '@/lib/featuredKoreanRestaurants';
import { useGlobalStore } from '@/store/useGlobalStore';

type Directory = { id: string; name: string; category: string; desc: string; body?: string; tel: string; address?: string; rating?: number; reviews?: number; lat?: number; lng?: number; country: string; image?: string; images?: string[]; authorId: string; createdAt: string; sourceUrl?: string; sourceName?: string; sourceContentId?: string; featured?: boolean };
const DIRECTORY_CATEGORIES = ['음식점·카페', '병원·의료', '마트·식품', '미용·뷰티', '법률·회계', '부동산', '교육', 'IT·서비스', '공공기관·단체', '종교·단체', '기타'];

export default function DirectoryPage() {
  const { selectedCountry, user } = useGlobalStore();
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [search, setSearch] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ name: '', category: DIRECTORY_CATEGORIES[0], desc: '', tel: '', address: '', image: '' });
  const [category, setCategory] = useState('전체');
  const [minRating, setMinRating] = useState('0');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const loadDirectories = async () => {
    try {
      const [data, source] = await Promise.all([
        listDocuments<Omit<Directory, 'id'>>('directories', getSessionToken()).catch(() => []),
        selectedCountry === 'Brazil' || selectedCountry === 'Global' ? fetchSourceCategory('hanintoday-brazil', 'directory') : Promise.resolve(null),
      ]);
      const featured = FEATURED_KOREAN_RESTAURANTS.map((restaurant) => ({ id: restaurant.id, name: restaurant.name, category: restaurant.category, desc: restaurant.description, tel: '', address: restaurant.city, rating: 0, reviews: 0, country: restaurant.country, authorId: 'gyopo-featured', createdAt: '2026-01-01T00:00:00.000Z', sourceUrl: restaurant.mapUrl, sourceName: 'GYOPO 추천', featured: true }));
      const sourceDirectories = source?.items.map((item) => ({ id: sourceItemId('hanintoday-brazil', 'directory', item.url), name: item.title, category: item.tag || item.category || '한인 업소', desc: item.description || '출처에서 확인된 업소 정보입니다.', body: item.body, tel: item.phone || '', address: item.address || source.region, lat: item.lat, lng: item.lng, rating: 0, reviews: 0, country: source.region, image: item.image, images: item.images, authorId: 'source', createdAt: item.publishedAt || source.fetchedAt, sourceUrl: item.url, sourceName: source.sourceName, sourceContentId: sourceItemId('hanintoday-brazil', 'directory', item.url) })) || [];
      setDirectories([...featured, ...sourceDirectories, ...data].filter((directory) => directory.authorId).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch { setDirectories([]); }
  };

  useEffect(() => { void loadDirectories(); }, [selectedCountry]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return window.alert('로그인 후 업체를 등록할 수 있습니다.');
    const token = getSessionToken();
    if (!token) return;
    const digits = form.tel.replace(/\D/g, '');
    if (form.name.trim().length < 2 || !DIRECTORY_CATEGORIES.includes(form.category) || form.desc.trim().length < 12 || digits.length < 7 || form.address.trim().length < 3) return window.alert('업체명·카테고리·소개·전화번호·주소를 정확히 입력해주세요.');
    if (/구인|구직|채용|모집|급여|시급|월급|파트타임|정규직/i.test(Object.values(form).join(' '))) return window.alert('구인 정보는 구인구직 메뉴에 등록해주세요.');
    try {
      await createDocument('directories', crypto.randomUUID(), { ...form, name: form.name.trim(), desc: form.desc.trim(), tel: digits, address: form.address.trim(), country: selectedCountry, authorId: user.id, createdAt: new Date().toISOString(), rating: 0, reviews: 0 }, token);
      setForm({ name: '', category: DIRECTORY_CATEGORIES[0], desc: '', tel: '', address: '', image: '' });
      setIsWriting(false);
      await loadDirectories();
    } catch { window.alert('업체 정보를 저장하지 못했습니다.'); }
  };

  const removeDirectory = async (directory: Directory) => {
    if (!user || !isMasterUser(user) || directory.featured || directory.sourceUrl && directory.authorId === 'source' || !window.confirm('이 업소 정보를 삭제할까요?')) return;
    const token = getSessionToken();
    if (!token) return;
    try {
      await deleteDocument('directories', directory.id, token);
      setDirectories((current) => current.filter((item) => item.id !== directory.id));
    } catch { window.alert('운영자 권한이 적용된 뒤 다시 시도해주세요.'); }
  };

  const filteredDirectories = directories.filter((directory) => {
    const countryMatches = selectedCountry === 'Global' || directory.country === selectedCountry;
    const categoryMatches = category === '전체' || directory.category === category;
    const ratingMatches = Number(directory.rating || 0) >= Number(minRating) || directory.featured;
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
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-7 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.18em] text-blue-600">Directory</p><h1 className="mt-1 text-3xl font-black">글로벌 한인 업소록</h1><p className="mt-2 text-sm text-slate-500">작은 목록으로 정리해 필요한 업소를 빠르게 찾으세요. 추천 한식당은 방문 전 영업 여부를 확인해주세요.</p></div><div className="flex gap-2"><button onClick={() => setIsWriting(true)} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white">업체 등록</button><button onClick={() => navigator.geolocation?.getCurrentPosition((position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }))} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">내 위치</button></div></header>
        <div className="mb-5 flex flex-wrap gap-2"><input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="업체명, 도시, 카테고리 검색..." className="min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"><option value="전체">모든 카테고리</option>{categories.filter((item) => item !== '전체').map((item) => <option key={item}>{item}</option>)}</select><select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"><option value="0">모든 평점</option><option value="4">4점 이상</option><option value="4.5">4.5점 이상</option></select></div>
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500"><span>{selectedCountry === 'Global' ? '전체 국가' : selectedCountry} · {filteredDirectories.length}개 업소</span><span>{FEATURED_KOREAN_RESTAURANTS.length}개 추천 한식당 포함</span></div>
        {filteredDirectories.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center text-sm text-slate-500">등록된 업소가 없습니다.</div>}
        {filteredDirectories.length > 0 && <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="hidden grid-cols-[minmax(0,1fr)_120px_180px_130px] gap-4 border-b border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-[.12em] text-slate-500 md:grid"><span>업소</span><span>카테고리</span><span>지역·연락처</span><span>링크</span></div><div className="divide-y divide-slate-100">{filteredDirectories.map((biz) => <div key={biz.id} className="grid gap-3 px-4 py-3 transition hover:bg-slate-50 md:grid-cols-[minmax(0,1fr)_120px_180px_130px] md:items-center md:gap-4"><div className="flex min-w-0 items-center gap-3">{biz.image ? <img src={biz.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-xl">🍚</div>}<div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-black text-slate-900">{biz.name}</h2>{biz.featured && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-700">추천</span>}</div><p className="mt-1 truncate text-xs text-slate-500">{biz.desc}</p></div></div><div className="text-xs font-bold text-slate-600">{biz.category}</div><div className="text-xs text-slate-500"><div>📍 {biz.address || biz.country}</div>{biz.tel && <div className="mt-1">☎ {biz.tel}</div>}{distanceKm(biz) && <div className="mt-1 font-bold text-cyan-600">{distanceKm(biz)} km</div>}</div><div className="flex flex-wrap gap-2 md:flex-col md:items-start">{biz.tel && biz.tel !== '원문 확인' ? <a href={`tel:${biz.tel.replace(/[^\d+]/g, '')}`} className="text-xs font-black text-emerald-600">전화</a> : biz.sourceUrl && <a href={biz.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-600">{biz.featured ? '지도에서 확인' : '공식 정보'}</a>}{biz.sourceContentId && <Link href={`/content/${biz.sourceContentId}?source=hanintoday-brazil&category=directory&url=${encodeURIComponent(biz.sourceUrl || '')}`} className="text-xs font-black text-teal-600">상세 보기</Link>}{user && isMasterUser(user) && !biz.featured && biz.authorId !== 'source' && <button onClick={() => void removeDirectory(biz)} className="text-left text-xs font-black text-red-500">운영자 삭제</button>}</div></div>)}</div></div>}
        <div className="mx-auto mt-6 max-w-4xl"><BannerAd type="horizontal" /></div>
        {isWriting && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">업체 등록</h2><input required minLength={2} placeholder="업체명" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border px-4 py-3" /><select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-xl border px-4 py-3">{DIRECTORY_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select><textarea required minLength={12} placeholder="업체 소개 (12자 이상)" rows={3} value={form.desc} onChange={(event) => setForm({ ...form, desc: event.target.value })} className="w-full resize-none rounded-xl border px-4 py-3" /><input required placeholder="전화번호" value={form.tel} onChange={(event) => setForm({ ...form, tel: event.target.value })} className="w-full rounded-xl border px-4 py-3" /><input required minLength={3} placeholder="주소" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="w-full rounded-xl border px-4 py-3" /><input type="url" placeholder="대표 이미지 URL (선택)" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} className="w-full rounded-xl border px-4 py-3" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 rounded-xl border py-3 font-bold">취소</button><button className="flex-1 rounded-xl bg-slate-900 py-3 font-bold text-white">등록</button></div></form></div>}
      </div>
    </div>
  );
}
