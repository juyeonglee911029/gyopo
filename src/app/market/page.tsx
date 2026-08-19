'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createDocument, getSessionToken, listDocuments } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type Product = { id: string; title: string; price: string; location: string; image?: string; country: string; createdAt: string };

export default function MarketPage() {
  const { selectedCountry, user } = useGlobalStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ title: '', price: '', location: '', image: '' });

  const loadProducts = async () => {
    try {
      const data = await listDocuments<Omit<Product, 'id'>>('marketItems', getSessionToken());
      setProducts(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch { setProducts([]); }
  };

  useEffect(() => { void loadProducts(); }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return window.alert('로그인 후 물품을 등록할 수 있습니다.');
    const token = getSessionToken();
    if (!token) return;
    try {
      await createDocument('marketItems', crypto.randomUUID(), { ...form, country: selectedCountry, authorId: user.id, createdAt: new Date().toISOString() }, token);
      setForm({ title: '', price: '', location: '', image: '' });
      setIsWriting(false);
      await loadProducts();
    } catch { window.alert('물품을 저장하지 못했습니다.'); }
  };

  const filteredProducts = products.filter((product) => (selectedCountry === 'Global' || product.country === selectedCountry) && product.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4"><div><h1 className="text-3xl font-black text-gray-800">에스크로 중고장터</h1><p className="text-gray-500 mt-2">실제 등록된 물품을 확인하고 판매자에게 문의하세요.</p></div><div className="flex gap-2 w-full md:w-auto"><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="물품 검색..." className="flex-1 md:w-64 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none" /><button onClick={() => setIsWriting(true)} className="bg-orange-500 text-white px-5 py-2 rounded-lg font-bold hover:bg-orange-600 transition whitespace-nowrap shadow-md">내 물건 팔기</button></div></div>
      {filteredProducts.length === 0 && <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100"><span className="text-4xl block mb-4">🛒</span><p className="text-gray-500">등록된 매물이 없습니다.</p></div>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">{filteredProducts.map((item) => <Link href={`/market?item=${item.id}`} key={item.id} className="group"><div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all relative"><div className="absolute top-2 left-2 z-10"><span className="bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded">{item.country}</span></div><div className="aspect-square overflow-hidden bg-gray-100 flex items-center justify-center">{item.image ? <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /> : <span className="text-gray-400 text-4xl">📦</span>}</div><div className="p-4 space-y-2"><h3 className="text-gray-900 font-medium truncate group-hover:text-orange-600">{item.title}</h3><div className="font-black text-lg text-green-600 bg-green-50 px-2 py-1 rounded inline-block">{item.price}</div><div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-50"><span>{item.location}</span><span>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</span></div></div></div></Link>)}</div>
      {isWriting && <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-3"><h2 className="text-xl font-black">물품 등록</h2><input required placeholder="물품명" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="가격 (예: 50 USDT)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="거래 지역" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input type="url" placeholder="상품 이미지 URL (선택)" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 border rounded-xl py-3 font-bold">취소</button><button className="flex-1 bg-orange-500 text-white rounded-xl py-3 font-bold">등록</button></div></form></div>}
    </div>
  );
}
