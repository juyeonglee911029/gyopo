'use client';

import { useEffect, useState } from 'react';
import BannerAd from '@/components/ads/BannerAd';
import Link from 'next/link';
import { createDocument, getSessionToken, listDocuments } from '@/lib/firebase';
import { useGlobalStore } from '@/store/useGlobalStore';

type Job = { id: string; title: string; company: string; location: string; salary: string; tag: string; country: string; authorId: string; createdAt: string; image?: string; images?: string[]; sourceName?: string; sourceContentId?: string };

export default function JobsPage() {
  const { selectedCountry, user } = useGlobalStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', salary: '', tag: '정규직' });

  const loadJobs = async () => {
    try {
      const data = await listDocuments<Omit<Job, 'id'>>('jobs', getSessionToken());
      setJobs(data.filter((job) => job.authorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch {
      setJobs([]);
    }
  };

  useEffect(() => { void loadJobs(); }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return window.alert('로그인 후 공고를 등록할 수 있습니다.');
    const token = getSessionToken();
    if (!token) return;
    try {
      await createDocument('jobs', crypto.randomUUID(), { ...form, country: selectedCountry, authorId: user.id, createdAt: new Date().toISOString() }, token);
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
        <aside className="w-full md:w-64 flex-shrink-0"><div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100"><h3 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">안내</h3><p className="text-sm leading-6 text-gray-500">등록된 실제 공고만 표시됩니다. 국가 선택은 상단 메뉴에서 변경할 수 있습니다.</p></div><div className="mt-6"><BannerAd type="vertical" /></div></aside>
        <main className="flex-1 space-y-4">
          {filteredJobs.length === 0 && <div className="text-center py-20 bg-gray-50 rounded-xl border border-gray-100"><span className="text-4xl block mb-4">📭</span><p className="text-gray-500">해당 국가의 구인/구직 공고가 없습니다.</p></div>}
            {filteredJobs.map((job) => <Link href={job.sourceContentId ? `/content/${job.sourceContentId}` : `/jobs?job=${job.id}`} key={job.id} className="group block"><div className="flex flex-col justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-4">{job.image ? <img src={job.image} alt={job.title} className="h-20 w-20 shrink-0 rounded-xl object-cover" /> : <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-blue-50 text-2xl">💼</div>}<div className="space-y-1"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">[{job.country}]</span><span className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{job.tag}</span><span className="text-sm font-medium text-gray-500">{job.company}</span></div><h3 className="text-xl font-bold text-gray-900 transition-colors group-hover:text-blue-600">{job.title}</h3><div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500"><span>📍 {job.location}</span><span>💰 {job.salary}</span></div></div></div>{job.sourceContentId && <span className="text-xs font-black text-teal-600">상세 읽기 →</span>}</div></Link>)}
        </main>
      </div>
      {isWriting && <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl space-y-3"><h2 className="text-xl font-black">구인 공고 등록</h2><input required placeholder="공고 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="회사명" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="근무 지역" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><input required placeholder="급여" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="w-full border rounded-xl px-4 py-3" /><select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} className="w-full border rounded-xl px-4 py-3"><option>정규직</option><option>파트타임</option><option>계약직</option><option>재택근무</option></select><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 border rounded-xl py-3 font-bold">취소</button><button className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-bold">등록</button></div></form></div>}
    </div>
  );
}
