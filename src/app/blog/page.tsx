'use client';

import { useState } from 'react';

const articles = [
  { category: '생활', title: '해외 거주 교민이 이사 전에 확인할 7가지', date: '2026-08-20', body: '통신, 은행, 학교, 병원, 운전면허와 세금 신고를 나라별로 준비하는 실전 체크리스트입니다.' },
  { category: '금융', title: 'USDT를 안전하게 보관하고 송금하는 기본 원칙', date: '2026-08-20', body: '네트워크 확인, 주소 검증, 수수료 확인, 출금 승인 기록을 한 번에 관리하는 방법을 정리했습니다.' },
  { category: '비즈니스', title: '교민 고객을 위한 작은 가게의 온라인 시작법', date: '2026-08-19', body: '업소록 등록부터 리뷰, 전화 연결, 재방문 고객 관리까지 지역 기반 사업자가 바로 적용할 수 있는 방법입니다.' },
  { category: '이민·비자', title: '나라가 달라도 통하는 이주 서류 정리법', date: '2026-08-18', body: '원본, 번역본, 공증본을 분리하고 만료일과 담당기관을 기록하는 문서 관리 흐름입니다.' },
  { category: '커뮤니티', title: '처음 이민 온 가족이 한 달 안에 연결해야 할 사람들', date: '2026-08-17', body: '학교, 병원, 한인회, 통역, 지역 사업자를 연결해 생활의 시행착오를 줄이는 방법입니다.' },
  { category: '테크', title: '교민 포털에서 개인정보를 지키는 브라우저 습관', date: '2026-08-16', body: '공용 기기 로그아웃, 지갑 주소 보호, 링크 확인, 영상 통화 권한을 안전하게 관리하는 법입니다.' },
];

export default function BlogPage() {
  const [category, setCategory] = useState('전체');
  const categories = ['전체', ...Array.from(new Set(articles.map((article) => article.category)))];
  const visible = category === '전체' ? articles : articles.filter((article) => article.category === category);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 rounded-[2rem] bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 p-8 text-white shadow-2xl md:p-12">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Global Gyopo Editorial</p>
        <h1 className="text-4xl font-black tracking-tight md:text-6xl">교민을 위한<br />읽을거리</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">생활, 금융, 비즈니스, 이민 정보를 한 곳에서 읽고 저장할 수 있는 내부 블로그입니다.</p>
      </header>
      <div className="mb-6 flex flex-wrap gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${category === item ? 'bg-cyan-400 text-slate-950' : 'border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>{item}</button>)}</div>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{visible.map((article) => <article key={article.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-[#10182b]"><div className="mb-5 flex items-center justify-between text-xs font-bold"><span className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-200">{article.category}</span><time className="text-slate-400">{article.date}</time></div><h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">{article.title}</h2><p className="mt-4 text-sm leading-7 text-slate-500 dark:text-slate-400">{article.body}</p><button className="mt-6 text-sm font-black text-cyan-700 hover:underline dark:text-cyan-300">본문 읽기 →</button></article>)}</div>
    </div>
  );
}
