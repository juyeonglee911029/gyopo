import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, Building2, CarFront, GraduationCap, HeartHandshake, Home, Newspaper, ShoppingBag, Store } from 'lucide-react';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata('교민 생활 서비스', '해외 생활에 필요한 구인구직, 주거, 교육, 업소록, 장터와 지역 정보를 한곳에서 찾아보세요.', '/life');

const services = [
  { href: '/jobs', label: '구인구직', english: 'Jobs', detail: '현지 채용과 구직 기회', icon: BriefcaseBusiness, tone: 'text-sky-200 bg-sky-300/10' },
  { href: '/directory', label: '업소록', english: 'Directory', detail: '한인 업체와 생활 서비스', icon: Store, tone: 'text-emerald-200 bg-emerald-300/10' },
  { href: '/market', label: '장터', english: 'Market', detail: '교민 중고거래와 나눔', icon: ShoppingBag, tone: 'text-amber-200 bg-amber-300/10' },
  { href: '/news', label: '지역 뉴스', english: 'News', detail: '검증된 출처의 현지 소식', icon: Newspaper, tone: 'text-violet-200 bg-violet-300/10' },
  { href: '/help', label: '도움센터', english: 'Help', detail: '서비스 이용과 안전 안내', icon: HeartHandshake, tone: 'text-rose-200 bg-rose-300/10' },
  { href: '/regions', label: '지역 선택', english: 'Locations', detail: '국가와 도시별 게시판', icon: Home, tone: 'text-cyan-200 bg-cyan-300/10' },
];

export default function LifePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <header className="max-w-3xl border-b border-white/10 pb-8"><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">Everyday essentials / 생활</p><h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">해외 생활을 더 가볍게</h1><p className="mt-4 text-sm leading-7 text-slate-300">살 곳을 찾고, 일할 곳을 찾고, 믿을 만한 업소와 필요한 정보를 찾는 일까지. 지역을 중심으로 교민 생활의 다음 행동을 연결합니다.</p></header>
      <main className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{services.map(({ href, label, english, detail, icon: Icon, tone }) => <Link key={href} href={href} className="group rounded-3xl border border-white/10 bg-white/[.045] p-6 transition hover:-translate-y-0.5 hover:border-teal-300/30 hover:bg-white/[.075]"><div className="flex items-start justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon size={20} /></span><ArrowRight size={18} className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-teal-300" /></div><h2 className="mt-6 text-xl font-black text-white">{label}<span className="ml-2 text-xs font-semibold text-slate-500">{english}</span></h2><p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p></Link>)}</main>
      <section className="mt-10 grid gap-4 rounded-3xl border border-teal-300/15 bg-teal-300/[.05] p-6 md:grid-cols-3"><div><Building2 size={19} className="text-teal-200" /><h2 className="mt-3 font-black text-white">지역 기반</h2><p className="mt-1 text-xs leading-5 text-slate-400">국가와 도시를 선택하면 필요한 게시판으로 바로 이동합니다.</p></div><div><GraduationCap size={19} className="text-teal-200" /><h2 className="mt-3 font-black text-white">생활 분야</h2><p className="mt-1 text-xs leading-5 text-slate-400">주거, 교육, 자동차, 세금과 이민 정보를 분야별로 모읍니다.</p></div><div><CarFront size={19} className="text-teal-200" /><h2 className="mt-3 font-black text-white">다음 단계</h2><p className="mt-1 text-xs leading-5 text-slate-400">검색 결과가 없으면 커뮤니티에 질문을 남겨보세요.</p></div></section>
    </div>
  );
}
