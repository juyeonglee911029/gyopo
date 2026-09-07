'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createDocument, getSessionToken, listDocuments, mergeDocument, reserveEscrowPurchase } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type Product = { id: string; title: string; price: string; location: string; image?: string; country: string; authorId: string; createdAt: string; sourceUrl?: string; sourceName?: string; sourceContentId?: string };
type EscrowOrder = { id: string; buyerId: string; sellerId: string; productId: string; amount: number; status: string; createdAt: string; updatedAt?: string; timeline?: Array<{ status: string; at: string; note?: string }> };

const parsePrice = (value: string) => Number(value.replace(/,/g, '').match(/\d+(?:\.\d+)?/)?.[0] || 0);

export default function MarketPage() {
  const { selectedCountry, user } = useGlobalStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ title: '', price: '', location: '', image: '' });
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [orderNotice, setOrderNotice] = useState('');

  const loadProducts = async () => {
    try {
      const data = await listDocuments<Omit<Product, 'id'>>('marketItems', getSessionToken());
       setProducts(data.filter((item) => item.authorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
     } catch { setProducts([]); }
  };

  useEffect(() => { void loadProducts(); }, []);

  useEffect(() => {
    if (!user) return;
    void listDocuments<EscrowOrder>('escrowOrders', getSessionToken()).then((rows) => setOrders(rows.filter((order) => order.buyerId === user.id || order.sellerId === user.id))).catch(() => setOrders([]));
  }, [user?.id]);

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

  const handleBuy = async (item: Product) => {
    if (!user) return window.alert('로그인 후 구매할 수 있습니다.');
    if (item.sourceUrl) return window.alert('공식 참고 상품은 구매할 수 없습니다. 회원 판매 상품을 선택해주세요.');
    const amount = parsePrice(item.price);
    if (!amount) return window.alert('판매자가 유효한 USDT 가격을 등록하지 않았습니다.');
    const token = getSessionToken();
    if (!token) return;
    try {
      const orderId = await reserveEscrowPurchase(user.id, item.id, item.authorId, amount, token);
      setOrderNotice(`${amount} USDT가 에스크로에 보관되었습니다. 판매자의 배송 시작을 기다립니다.`);
      setOrders((current) => [{ id: orderId, buyerId: user.id, sellerId: item.authorId, productId: item.id, amount, status: 'PAYMENT_HELD', createdAt: new Date().toISOString(), timeline: [{ status: 'PAYMENT_HELD', at: new Date().toISOString(), note: '결제 금액 보관' }] }, ...current]);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '구매를 처리하지 못했습니다.');
    }
  };

  const updateOrder = async (order: EscrowOrder, status: string, note: string) => {
    const token = getSessionToken();
    if (!token) return;
    const timeline = [...(order.timeline || []), { status, at: new Date().toISOString(), note }];
    await mergeDocument('escrowOrders', order.id, { status, timeline, updatedAt: new Date() }, token);
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status, timeline } : item));
  };

  const filteredProducts = products.filter((product) => (selectedCountry === 'Global' || product.country === selectedCountry) && product.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
       <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4"><div><h1 className="text-3xl font-black text-gray-800">에스크로 중고장터</h1><p className="text-gray-500 mt-2">실제 등록 물품과 공식 출처 제품 정보를 확인하고 판매자에게 문의하세요.</p></div><div className="flex gap-2 w-full md:w-auto"><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="물품 검색..." className="flex-1 md:w-64 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:outline-none" /><button onClick={() => setIsWriting(true)} className="bg-orange-500 text-white px-5 py-2 rounded-lg font-bold hover:bg-orange-600 transition whitespace-nowrap shadow-md">내 물건 팔기</button></div></div>
       {orderNotice && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{orderNotice}</div>}
       {filteredProducts.length === 0 && <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100"><span className="text-4xl block mb-4">🛒</span><p className="text-gray-500">등록된 매물이 없습니다.</p></div>}
         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 md:gap-6">{filteredProducts.map((item) => <div key={item.id} className="group relative overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-lg"><div className="absolute left-2 top-2 z-10"><span className="rounded bg-black/60 px-2 py-1 text-[10px] font-bold text-white">{item.country}</span></div><div className="flex aspect-square items-center justify-center overflow-hidden bg-gray-100">{item.image ? <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" /> : <span className="text-4xl text-gray-400">📦</span>}</div><div className="space-y-2 p-4"><h3 className="truncate font-medium text-gray-900 group-hover:text-orange-600">{item.title}</h3><div className="inline-block rounded bg-green-50 px-2 py-1 text-lg font-black text-green-600">{item.price}</div><div className="flex justify-between border-t border-gray-50 pt-2 text-xs text-gray-500"><span>{item.location}</span><span>{new Date(item.createdAt).toLocaleDateString('ko-KR')}</span></div>{item.sourceName && <div className="text-[10px] text-blue-500">출처: {item.sourceName}</div>}{item.sourceContentId ? <Link href={`/content/${item.sourceContentId}`} className="mt-2 block w-full rounded-xl border border-orange-200 py-2 text-center text-xs font-black text-orange-600">상세 읽기</Link> : <button onClick={() => void handleBuy(item)} className="mt-2 w-full rounded-xl bg-orange-500 py-2 text-xs font-black text-white hover:bg-orange-600">구매 · 에스크로 보관</button>}</div></div>)}</div>
       {orders.length > 0 && <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5"><h2 className="mb-4 text-xl font-black">내 에스크로 진행 내역</h2><div className="space-y-3">{orders.map((order) => <div key={order.id} className="rounded-xl border border-gray-100 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{order.amount} USDT · {order.status}</span>{order.sellerId === user?.id && order.status === 'PAYMENT_HELD' && <button onClick={() => void updateOrder(order, 'SHIPPING', '판매자가 배송을 시작했습니다.')} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-black text-white">배송 시작</button>}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-4">{['PAYMENT_HELD', 'SHIPPING', 'IN_TRANSIT', 'DELIVERED'].map((step) => <div key={step} className={`rounded-lg px-2 py-2 text-center ${order.timeline?.some((item) => item.status === step) || order.status === step ? 'bg-emerald-100 font-bold text-emerald-700' : 'bg-gray-100'}`}>{step}</div>)}</div></div>)}</div></section>}
      {isWriting && <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-3"><h2 className="text-xl font-black">물품 등록</h2><input required placeholder="물품명" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="가격 (예: 50 USDT)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="거래 지역" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input type="url" placeholder="상품 이미지 URL (선택)" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 border rounded-xl py-3 font-bold">취소</button><button className="flex-1 bg-orange-500 text-white rounded-xl py-3 font-bold">등록</button></div></form></div>}
    </div>
  );
}
