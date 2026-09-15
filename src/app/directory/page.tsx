'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Clock3, MessageCircle, Navigation, Phone, Star } from 'lucide-react';
import BannerAd from '@/components/ads/BannerAd';
import { createDocument, deleteDocument, getSessionToken, isMasterUser, listDocuments } from '@/lib/firebase';
import { sourceItemId } from '@/lib/contentSources';
import { fetchSourceCategory } from '@/lib/sourcepreview';
import { FEATURED_KOREAN_RESTAURANTS } from '@/lib/featuredKoreanRestaurants';
import { useGlobalStore } from '@/store/useGlobalStore';
import ImageCarousel from '@/components/media/ImageCarousel';

type DirectoryReview = { author: string; rating: number; text: string; relativeTime?: string };
type Directory = { id: string; name: string; category: string; desc: string; body?: string; tel: string; address?: string; rating?: number; reviews?: number; hours?: string[]; openNow?: boolean; recentReviews?: DirectoryReview[]; ratingSource?: string; lat?: number; lng?: number; country: string; image?: string; images?: string[]; authorId: string; createdAt: string; sourceId?: string; sourceUrl?: string; sourceName?: string; sourceContentId?: string; featured?: boolean };
type UserLocation = { lat: number; lng: number };
type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable';

const DIRECTORY_CATEGORIES = ['음식점·카페', '병원·의료', '마트·식품', '미용·뷰티', '법률·회계', '부동산', '교육', 'IT·서비스', '공공기관·단체', '종교·단체', '기타'];
const isNativeDirectory = (directory: Directory) => !directory.featured && directory.authorId !== 'source' && !directory.sourceId && !directory.sourceContentId && !directory.sourceUrl;

function directoryQuery(directory: Directory) {
  if (directory.address?.trim()) return `${directory.name}, ${directory.address}`;
  if (typeof directory.lat === 'number' && typeof directory.lng === 'number') return `${directory.lat},${directory.lng}`;
  return directory.name;
}

function mapsEmbedUrl(directory: Directory) {
  return `https://www.google.com/maps?q=${encodeURIComponent(directoryQuery(directory))}&z=16&output=embed`;
}

function mapsRouteEmbedUrl(directory: Directory, location: UserLocation) {
  const destination = typeof directory.lat === 'number' && typeof directory.lng === 'number' ? `${directory.lat},${directory.lng}` : directoryQuery(directory);
  return `https://www.google.com/maps?output=embed&dirflg=d&saddr=${encodeURIComponent(`${location.lat},${location.lng}`)}&daddr=${encodeURIComponent(destination)}`;
}

function wazeUrl(directory: Directory) {
  return `https://waze.com/ul?q=${encodeURIComponent(directoryQuery(directory))}&navigate=yes`;
}

const DIAL_CODES: Array<[RegExp, string]> = [
  [/usa|united states|미국/i, '1'], [/canada|캐나다/i, '1'], [/brazil|브라질/i, '55'], [/argentina|아르헨티나/i, '54'],
  [/south korea|korea|대한민국|한국/i, '82'], [/japan|일본/i, '81'], [/china|중국/i, '86'], [/australia|호주/i, '61'],
  [/united kingdom|uk|영국/i, '44'], [/germany|독일/i, '49'], [/france|프랑스/i, '33'], [/italy|이탈리아/i, '39'],
  [/hungary|헝가리/i, '36'], [/turkey|튀르키예|터키/i, '90'], [/cyprus|키프로스/i, '357'], [/romania|루마니아/i, '40'],
  [/thailand|태국/i, '66'], [/vietnam|베트남/i, '84'], [/philippines|필리핀/i, '63'], [/singapore|싱가포르/i, '65'],
  [/mexico|멕시코/i, '52'], [/spain|스페인/i, '34'], [/portugal|포르투갈/i, '351'],
];

function phoneHref(directory: Directory) {
  const raw = directory.tel?.trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (raw.startsWith('+')) return `tel:+${digits}`;
  const code = DIAL_CODES.find(([pattern]) => pattern.test(directory.country))?.[1];
  const national = code === '39' ? digits : digits.replace(/^0+/, '');
  return `tel:+${code ? `${code}${national}` : national}`;
}

function phoneLabel(directory: Directory) {
  return phoneHref(directory)?.replace(/^tel:/, '') || '';
}

function whatsappHref(directory: Directory) {
  const value = phoneHref(directory)?.replace(/^tel:\+/, '');
  return value ? `https://wa.me/${value}` : null;
}

function requestUserLocation(onSuccess: (location: UserLocation) => void, onError: () => void) {
  if (!navigator.geolocation) return onError();
  navigator.geolocation.getCurrentPosition(
    (position) => onSuccess({ lat: position.coords.latitude, lng: position.coords.longitude }),
    onError,
    { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
  );
}

export default function DirectoryPage() {
  const selectedCountry = useGlobalStore((state) => state.selectedCountry);
  const user = useGlobalStore((state) => state.user);
  const [directories, setDirectories] = useState<Directory[]>([]);
  const [selectedDirectory, setSelectedDirectory] = useState<Directory | null>(null);
  const [search, setSearch] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ name: '', category: DIRECTORY_CATEGORIES[0], desc: '', tel: '', address: '', image: '' });
  const [category, setCategory] = useState('전체');
  const [minRating, setMinRating] = useState('0');
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [routeMode, setRouteMode] = useState<'place' | 'drive'>('place');
  const [routeRequested, setRouteRequested] = useState(false);
  const [placeLoading, setPlaceLoading] = useState(false);

  const enrichWithGooglePlace = async (directory: Directory) => {
    setPlaceLoading(true);
    try {
      const response = await fetch(`/api/directory/place?query=${encodeURIComponent(directoryQuery(directory))}`);
      const place = await response.json() as Partial<Directory> & { status?: string; source?: string };
      if (!response.ok || place.status !== 'ready') return;
      setDirectories((current) => current.map((item) => item.id === directory.id ? { ...item, ...place, image: place.images?.[0] || item.image, images: place.images?.length ? place.images : item.images, ratingSource: place.source } : item));
      setSelectedDirectory((current) => current?.id === directory.id ? { ...current, ...place, image: place.images?.[0] || current.image, images: place.images?.length ? place.images : current.images, ratingSource: place.source } : current);
    } finally { setPlaceLoading(false); }
  };

  const loadDirectories = async () => {
    try {
      const [data, source] = await Promise.all([
        listDocuments<Omit<Directory, 'id'>>('directories', getSessionToken()).catch(() => []),
        selectedCountry === 'Brazil' || selectedCountry === 'Global' ? fetchSourceCategory('hanintoday-brazil', 'directory').catch(() => null) : Promise.resolve(null),
      ]);
       const featured: Directory[] = FEATURED_KOREAN_RESTAURANTS.map((restaurant) => ({ id: restaurant.id, name: restaurant.name, category: restaurant.category, desc: restaurant.description, tel: restaurant.tel || '', address: restaurant.address, rating: restaurant.rating, reviews: restaurant.reviews, ratingSource: restaurant.ratingSource, lat: restaurant.lat, lng: restaurant.lng, country: restaurant.country, image: restaurant.image, images: restaurant.images, authorId: 'gyopo-featured', createdAt: '2026-01-01T00:00:00.000Z', sourceUrl: restaurant.mapUrl, sourceName: restaurant.ratingSource, featured: true }));
      const sourceDirectories: Directory[] = source?.items.map((item) => ({ id: sourceItemId('hanintoday-brazil', 'directory', item.url), name: item.title, category: item.tag || item.category || '한인 업소', desc: item.description || '출처에서 확인된 업소 정보입니다.', body: item.body, tel: item.phone || '', address: item.address || source.region, lat: item.lat, lng: item.lng, rating: 0, reviews: 0, country: source.region, image: item.image, images: item.images, authorId: 'source', createdAt: item.publishedAt || source.fetchedAt, sourceUrl: item.url, sourceName: source.sourceName, sourceContentId: sourceItemId('hanintoday-brazil', 'directory', item.url) })) || [];
      const next = [...featured, ...sourceDirectories, ...data].filter((directory) => directory.authorId).sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDirectories(next);
      setSelectedDirectory((current) => next.find((directory) => directory.id === current?.id) || next[0] || null);
    } catch {
      setDirectories([]);
      setSelectedDirectory(null);
    }
  };

  useEffect(() => { void loadDirectories(); }, [selectedCountry]);

  useEffect(() => {
    if (selectedDirectory && selectedDirectory.ratingSource !== 'Google Places') void enrichWithGooglePlace(selectedDirectory);
  }, [selectedDirectory?.id]);

  useEffect(() => {
    let active = true;
    requestUserLocation(
      (location) => { if (active) { setUserLocation(location); setLocationStatus('ready'); } },
      () => { if (active) setLocationStatus(navigator.geolocation ? 'denied' : 'unavailable'); },
    );
    return () => { active = false; };
  }, []);

  const locateUser = () => {
    setLocationStatus('loading');
    requestUserLocation(
      (location) => { setUserLocation(location); setLocationStatus('ready'); if (routeRequested) { setRouteMode('drive'); setRouteRequested(false); } },
      () => setLocationStatus(navigator.geolocation ? 'denied' : 'unavailable'),
    );
  };

  const selectDirectory = (directory: Directory) => {
    setSelectedDirectory(directory);
    setRouteMode('place');
    setRouteRequested(false);
    void enrichWithGooglePlace(directory);
  };

  const requestRoute = () => {
    if (userLocation) return setRouteMode('drive');
    setRouteRequested(true);
    locateUser();
  };

  const handleSubmit = async (event: FormEvent) => {
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
    if (!user || !isNativeDirectory(directory) || (user.id !== directory.authorId && !isMasterUser(user)) || !window.confirm('이 업소 정보를 삭제할까요?')) return;
    const token = getSessionToken();
    if (!token) return;
    try {
      await deleteDocument('directories', directory.id, token);
      setDirectories((current) => current.filter((item) => item.id !== directory.id));
      setSelectedDirectory((current) => current?.id === directory.id ? null : current);
    } catch { window.alert('운영자 권한이 적용된 뒤 다시 시도해주세요.'); }
  };

  const categories = ['전체', ...Array.from(new Set(directories.map((directory) => directory.category).filter(Boolean)))];
  const distanceKm = (directory: Directory) => {
    if (!userLocation || typeof directory.lat !== 'number' || typeof directory.lng !== 'number') return null;
    const r = Math.PI / 180;
    const a = Math.sin((directory.lat - userLocation.lat) * r / 2) ** 2 + Math.cos(userLocation.lat * r) * Math.cos(directory.lat * r) * Math.sin((directory.lng - userLocation.lng) * r / 2) ** 2;
    return (6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
  };
  const filteredDirectories = directories.filter((directory) => (selectedCountry === 'Global' || directory.country === selectedCountry) && (category === '전체' || directory.category === category) && (Number(directory.rating || 0) >= Number(minRating) || directory.featured) && `${directory.name} ${directory.category} ${directory.desc} ${directory.address || ''}`.toLowerCase().includes(search.toLowerCase()));
  if (userLocation) filteredDirectories.sort((a, b) => (Number(distanceKm(a) ?? Number.POSITIVE_INFINITY) - Number(distanceKm(b) ?? Number.POSITIVE_INFINITY)) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  const routeDistance = selectedDirectory && userLocation ? distanceKm(selectedDirectory) : null;
  const routeMinutes = routeDistance ? Math.max(1, Math.round(Number(routeDistance) / 35 * 60)) : null;
  const locationLabel = locationStatus === 'loading' ? '위치 확인 중...' : locationStatus === 'ready' ? '가까운 순' : locationStatus === 'denied' ? '내 위치 다시 시도' : '내 위치';
  const locationMessage = locationStatus === 'denied' ? '위치 권한이 없어 거리순 정렬을 사용할 수 없습니다.' : locationStatus === 'unavailable' ? '이 브라우저에서는 위치 기능을 사용할 수 없습니다.' : null;

  return (
    <div className="category-page directory-page min-h-screen bg-transparent px-4 py-7 text-slate-100">
      <div className="category-shell mx-auto max-w-6xl">
        <header className="category-header"><div className="category-heading"><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-300">Directory</p><h1 className="mt-1 text-3xl font-black">글로벌 한인 업소록</h1><p className="mt-2 text-sm text-slate-400">업체를 선택하면 현재 위치에서 자동차 경로와 예상 시간·거리를 같은 지도에서 확인할 수 있습니다.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setIsWriting(true)} className="bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950">업체 등록</button><button type="button" onClick={locateUser} disabled={locationStatus === 'loading'} aria-pressed={Boolean(userLocation)} className="border border-white/10 bg-white/[.06] px-4 py-2.5 text-sm font-bold text-slate-200 disabled:cursor-wait disabled:opacity-60">{locationLabel}</button></div></header>
        {locationMessage && <p role="status" className="mt-3 text-xs text-amber-200">{locationMessage}</p>}
        <div className="mb-5 flex flex-wrap gap-2"><input type="text" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="업체명, 도시, 카테고리 검색..." className="min-w-[220px] flex-1 border border-white/10 bg-white/[.06] px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="border border-white/10 bg-[#0b1221] px-3 py-2 text-sm font-bold text-white"><option value="전체">모든 카테고리</option>{categories.filter((item) => item !== '전체').map((item) => <option key={item}>{item}</option>)}</select><select value={minRating} onChange={(event) => setMinRating(event.target.value)} className="border border-white/10 bg-[#0b1221] px-3 py-2 text-sm font-bold text-white"><option value="0">모든 평점</option><option value="4">4점 이상</option><option value="4.5">4.5점 이상</option></select></div>
        {selectedDirectory && (() => { const selectedMapUrl = routeMode === 'drive' && userLocation ? mapsRouteEmbedUrl(selectedDirectory, userLocation) : mapsEmbedUrl(selectedDirectory); const tel = phoneHref(selectedDirectory); const whatsapp = whatsappHref(selectedDirectory); return <section className="directory-map-panel mb-5 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[.18em] text-cyan-300">Selected business</p><h2 className="mt-1 truncate text-lg font-black text-white">{selectedDirectory.name}</h2><p className="mt-1 truncate text-xs text-slate-400">{selectedDirectory.address || selectedDirectory.country}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={requestRoute} disabled={locationStatus === 'loading'} className="inline-flex items-center gap-1.5 bg-cyan-300 px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"><Navigation size={13} />{routeMode === 'drive' ? '경로 다시 계산' : '자동차 길찾기'}</button>{tel && <a href={tel} className="inline-flex items-center gap-1.5 border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100"><Phone size={13} />전화하기</a>}{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 border border-green-300/25 bg-green-300/10 px-3 py-2 text-xs font-black text-green-100"><MessageCircle size={13} />WhatsApp 문의</a>}<a href={wazeUrl(selectedDirectory)} target="_blank" rel="noreferrer" className="border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100">Waze</a></div></div>{routeMode === 'drive' && userLocation && routeDistance && <div className="directory-route-summary distance-readout flex flex-wrap items-center gap-3 px-4 py-3 text-xs text-cyan-100"><Navigation size={15} /><strong>내 위치에서 자동차 기준 예상 약 {routeMinutes}분</strong><span className="text-cyan-100/70">약 {routeDistance} km · 실제 시간은 교통 상황에 따라 달라질 수 있습니다.</span></div>}{locationStatus === 'loading' && routeRequested && <p className="px-4 py-3 text-xs text-cyan-100">현재 위치를 확인한 뒤 이 지도에 경로를 표시합니다.</p>}<iframe key={selectedMapUrl} title={`${selectedDirectory.name} 지도`} src={selectedMapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="directory-map-frame" /></section>; })()}
         {selectedDirectory && <div className="mb-5 overflow-hidden rounded-2xl border border-white/10"><div className="aspect-[16/7]"><ImageCarousel images={selectedDirectory.images || (selectedDirectory.image ? [selectedDirectory.image] : [])} alt={selectedDirectory.name} emptyLabel="Google Maps 사진을 불러오는 중입니다." /></div><div className="grid gap-3 border-t border-white/10 bg-white/[.035] p-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">평점</p><p className="mt-1 flex items-center gap-1.5 text-lg font-black text-amber-200"><Star size={16} fill="currentColor" />{selectedDirectory.rating?.toFixed(1) || '미확인'}</p><p className="text-[11px] text-slate-500">{selectedDirectory.reviews ? `${selectedDirectory.reviews.toLocaleString()}개 리뷰` : '공개 리뷰 수 미확인'}</p></div><div className="sm:col-span-2"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">운영시간</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-200"><Clock3 size={14} />{selectedDirectory.openNow === true ? '현재 영업 중' : selectedDirectory.openNow === false ? '현재 영업 종료' : '시간 확인 필요'}</p><p className="mt-1 text-[11px] leading-5 text-slate-400">{selectedDirectory.hours?.join(' · ') || 'Google Places 연동 후 표시됩니다.'}</p></div><div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">데이터 출처</p><p className="mt-1 text-sm font-bold text-cyan-100">{placeLoading ? '확인 중...' : selectedDirectory.ratingSource || selectedDirectory.sourceName || 'GYOPO 등록 정보'}</p></div></div>{selectedDirectory.recentReviews?.length ? <div className="border-t border-white/10 bg-white/[.02] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">최근 공개 리뷰 5개</p><span className="text-[11px] text-slate-500">Google Places 제공</span></div><div className="grid gap-2 md:grid-cols-2">{selectedDirectory.recentReviews.slice(0, 5).map((review, index) => <div key={`${review.author}-${index}`} className="rounded-xl bg-white/[.035] p-3"><div className="flex items-center justify-between gap-2 text-xs"><strong className="text-slate-200">{review.author}</strong><span className="text-amber-200">{'★'.repeat(Math.max(0, Math.min(5, review.rating)))}</span></div><p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-400">{review.text || '리뷰 본문이 공개되지 않았습니다.'}</p><p className="mt-1 text-[10px] text-slate-600">{review.relativeTime}</p></div>)}</div></div> : null}</div>}
         <div className="mb-4 flex items-center justify-between text-xs text-slate-400"><span>{selectedCountry === 'Global' ? '전체 국가' : selectedCountry} · {filteredDirectories.length}개 업소{userLocation ? ' · 가까운 순' : ''}</span><span>{FEATURED_KOREAN_RESTAURANTS.length}개 추천 한식당 포함</span></div>
        {filteredDirectories.length === 0 && <div className="border border-dashed border-white/20 bg-white/[.035] py-20 text-center text-sm text-slate-500">등록된 업소가 없습니다.</div>}
        {filteredDirectories.length > 0 && <div className="directory-list overflow-hidden"><div className="hidden grid-cols-[minmax(0,1fr)_120px_180px_130px] gap-4 border-b border-white/10 px-4 py-3 text-[10px] font-black uppercase tracking-[.12em] text-slate-500 md:grid"><span>업소</span><span>카테고리</span><span>지역·연락처</span><span>링크</span></div><div className="divide-y divide-white/10">{filteredDirectories.map((biz) => { const distance = distanceKm(biz); const tel = phoneHref(biz); return <div key={biz.id} role="button" tabIndex={0} onClick={() => selectDirectory(biz)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectDirectory(biz); } }} className={`grid cursor-pointer gap-3 px-4 py-3 transition md:grid-cols-[minmax(0,1fr)_120px_180px_130px] md:items-center md:gap-4 ${selectedDirectory?.id === biz.id ? 'bg-cyan-300/10' : 'hover:bg-white/[.05]'}`}><div className="flex min-w-0 items-center gap-3">{biz.image ? <img src={biz.image} alt="" className="h-12 w-12 shrink-0 object-cover" /> : <div className="grid h-12 w-12 shrink-0 place-items-center bg-white/10 text-xl">🍚</div>}<div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-black text-white">{isNativeDirectory(biz) ? <Link href={`/content/${encodeURIComponent(biz.id)}?collection=directories`} onClick={(event) => event.stopPropagation()} className="hover:text-cyan-200">{biz.name}</Link> : biz.name}</h2>{biz.featured && <span className="shrink-0 bg-amber-300/15 px-2 py-0.5 text-[10px] font-black text-amber-200">추천</span>}</div><p className="mt-1 truncate text-xs text-slate-400">{biz.desc}</p></div></div><div className="text-xs font-bold text-slate-300">{biz.category}</div><div className="text-xs text-slate-400"><div>{biz.address || biz.country}</div>{tel && <a href={tel} onClick={(event) => event.stopPropagation()} className="mt-1 block text-cyan-100 hover:text-cyan-300">{phoneLabel(biz)}</a>}{distance && <span className="distance-readout mt-1 block font-bold text-cyan-300">약 {distance} km</span>}</div><div className="flex flex-wrap gap-1.5 text-[10px] font-black"><button type="button" onClick={(event) => { event.stopPropagation(); selectDirectory(biz); }} className="border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-cyan-100">지도</button>{tel && <a href={tel} onClick={(event) => event.stopPropagation()} className="border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-emerald-100">전화</a>}{user && isNativeDirectory(biz) && (user.id === biz.authorId || isMasterUser(user)) && <button type="button" onClick={(event) => { event.stopPropagation(); void removeDirectory(biz); }} className="border border-rose-300/20 bg-rose-300/10 px-2 py-1 text-rose-100">삭제</button>}</div></div>; })}</div></div>}
        <div className="mx-auto mt-6 max-w-4xl"><BannerAd type="horizontal" /></div>
        {isWriting && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="directory-form w-full max-w-lg space-y-3 p-6"><h2 className="text-xl font-black text-white">업체 등록</h2><input required minLength={2} placeholder="업체명" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full" /><select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full">{DIRECTORY_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select><textarea required minLength={12} placeholder="업체 소개 (12자 이상)" rows={3} value={form.desc} onChange={(event) => setForm({ ...form, desc: event.target.value })} className="w-full resize-none" /><input required placeholder="전화번호" value={form.tel} onChange={(event) => setForm({ ...form, tel: event.target.value })} className="w-full" /><input required minLength={3} placeholder="주소" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="w-full" /><input type="url" placeholder="대표 이미지 URL (선택)" value={form.image} onChange={(event) => setForm({ ...form, image: event.target.value })} className="w-full" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 border border-white/10 py-3 font-bold text-slate-300">취소</button><button className="flex-1 bg-cyan-300 py-3 font-bold text-slate-950">등록</button></div></form></div>}
      </div>
    </div>
  );
}
