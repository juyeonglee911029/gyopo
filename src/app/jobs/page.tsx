'use client';

import { useEffect, useState } from 'react';
import BannerAd from '@/components/ads/BannerAd';
import Link from 'next/link';
import { createDocument, getSessionToken, listDocuments } from '@/lib/firebase';
import { CONTENT_SOURCES, sourceItemId } from '@/lib/contentSources';
import { fetchSourceCategory } from '@/lib/sourcepreview';
import { useGlobalStore } from '@/store/useGlobalStore';

type Job = { id: string; title: string; company: string; location: string; salary: string; tag: string; country: string; authorId: string; createdAt: string; image?: string; images?: string[]; sourceId?: string; sourceName?: string; sourceUrl?: string; sourceContentId?: string };

export default function JobsPage() {
  const { selectedCountry, user } = useGlobalStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', salary: '', tag: '정규직' });

  const loadJobs = async () => {
    const sources = CONTENT_SOURCES.filter((source) => source.categories.includes('jobs') && (selectedCountry === 'Global' || source.region === selectedCountry || source.region === 'Global'));
    const [data, sourceResults] = await Promise.all([
      listDocuments<Omit<Job, 'id'>>('jobs', getSessionToken()).catch(() => []),
      Promise.allSettled(sources.map(async (source) => ({ source, result: await fetchSourceCategory(source.id, 'jobs') }))),
    ]);
    const sourceJobs = sourceResults.flatMap((entry) => {
      if (entry.status !== 'fulfilled' || !entry.value.result) return [];
      const { source, result } = entry.value;
      return result.items.map((item) => {
        const id = sourceItemId(source.id, 'jobs', item.url);
        return { id, title: item.title, company: item.company || source.name, location: item.location || source.region, salary: item.salary || '상세 내용 참조', tag: item.tag || '출처 자동수집', country: source.region, authorId: 'source', createdAt: item.publishedAt || result.fetchedAt, image: item.image, images: item.images, sourceId: source.id, sourceName: source.name, sourceUrl: item.url, sourceContentId: id };
      });
    });
    const merged = new Map<string, Job>();
    [...data, ...sourceJobs].filter((job) => job.authorId).forEach((job) => merged.set(job.sourceUrl || job.id, job as Job));
    setJobs([...merged.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  };

  useEffect(() => { void loadJobs(); }, [selectedCountry]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return window.alert('로그인 후 공고를 등록할 수 있습니다.');
    const token = getSessionToken();
    if (!token) return;
    const values = Object.values(form).map((value) => value.trim());
    if (form.title.trim().length < 4 || form.company.trim().length < 2 || form.location.trim().length < 2 || !form.salary.trim()) return window.alert('공고 제목·회사명·근무 지역·급여를 정확히 입력해주세요.');
    if (values.some((value) => /<[^>]+>|javascript:|data:text\/html|https?:\/\//i.test(value))) return window.alert('공고 내용에 HTML 또는 외부 링크를 입력할 수 없습니다.');
    try {
      await createDocument('jobs', crypto.randomUUID(), { ...form, title: form.title.trim(), company: form.company.trim(), location: form.location.trim(), salary: form.salary.trim(), country: selectedCountry, authorId: user.id, createdAt: new Date().toISOString() }, token);
      setForm({ title: '', company: '', location: '', salary: '', tag: '정규직' });
      setIsWriting(false);
      await loadJobs();
    } catch { window.alert('공고를 저장하지 못했습니다.'); }
  };

  const filteredJobs = selectedCountry === 'Global' ? jobs : jobs.filter((job) => job.country === selectedCountry);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-8 gap-4"><div><h1 className="text-3xl font-black text-gray-800">구인/구직</h1><p className="text-gray-500 mt-2 font-bold text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full inline-block">{selectedCountry === 'Global' ? '전체 국가 결과' : `${selectedCountry} 맞춤 검색 결과`}</p></div><button onClick={() => setIsWriting(true)} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-md transition">구인 글쓰기</button></div>
      <div className="mb-8"><BannerAd type="horizontal" /></div>
      <div className="flex flex-col md:flex-row gap-8">
       <aside className="w-full md:w-64 flex-shrink-0"><div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100"><h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">안내</h3><p className="text-sm leading-6 text-gray-500">실제 구인 정보만 등록해주세요. 국가 선택 없이 전체 공고를 국가 태그로 구분해 보여드립니다.</p></div><div className="mt-6"><BannerAd type="vertical" /></div></aside>
        <main className="flex-1 space-y-4">
          {filteredJobs.length === 0 && <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100"><span className="text-4xl block mb-4">📭</span><p className="text-gray-500">해당 국가의 구인/구직 공고가 없습니다.</p></div>}
             {filteredJobs.map((job) => <Link href={job.sourceContentId ? `/content/${job.sourceContentId}?source=${encodeURIComponent(job.sourceId || '')}&category=jobs&url=${encodeURIComponent(job.sourceUrl || '')}` : `/jobs?job=${job.id}`} key={job.id} className="group block"><div className="flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-3 transition-colors hover:bg-blue-50/50 dark:border-white/5 dark:bg-[#10182b] dark:hover:bg-white/[.04] sm:gap-4"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-blue-50">{job.image ? <img src={job.image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xl">💼</div>}</div><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold"><span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">{job.country}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{job.tag}</span><span className="truncate text-slate-400">{job.company}</span></div><h3 className="truncate text-base font-bold text-slate-900 transition-colors group-hover:text-blue-600 dark:text-white">{job.title}</h3><div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500"><span>📍 {job.location}</span><span>💰 {job.salary}</span></div></div><span className="hidden shrink-0 text-xs font-black text-teal-600 sm:block">상세 보기 →</span></div></Link>)}
        </main>
      </div>
      {isWriting && <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-3"><h2 className="text-xl font-black">구인 공고 등록</h2><input required placeholder="공고 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="회사명" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="근무 지역" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="급여" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} className="w-full border rounded-xl px-4 py-3"><option>정규직</option><option>파트타임</option><option>계약직</option><option>재택근무</option></select><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 border rounded-xl py-3 font-bold">취소</button><button className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold">등록</button></div></form></div>}
    </div>
  );
}
