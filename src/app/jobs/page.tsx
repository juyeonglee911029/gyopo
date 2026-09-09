'use client';

import Link from 'next/link';
import { useEffect, useEffectEvent, useState, type FormEvent } from 'react';
import { createDocument, getDocument, getSessionToken, listDocuments } from '@/lib/firebase';
import { CONTENT_SOURCES, sourceItemId } from '@/lib/contentSources';
import { curateSourceItems, fetchSourceCategory, isGenuineJobListing, normalizeSourceText, normalizeSourceTitle } from '@/lib/sourcepreview';
import { useGlobalStore } from '@/store/useGlobalStore';

type Job = { id: string; title: string; company: string; location: string; salary: string; tag: string; country: string; authorId: string; createdAt: string; body?: string; image?: string; images?: string[]; sourceId?: string; sourceName?: string; sourceUrl?: string; sourceCategory?: string; sourceContentId?: string };
type ContentSourceSettings = { disabledSourceIds?: string[] };

function curateJobs(items: Job[]) {
  const byOrigin = new Map<string, Job>();
  for (const job of items) {
    if (!job.authorId || !isGenuineJobListing(job)) continue;
    byOrigin.set(job.sourceUrl || job.id, { ...job, title: normalizeSourceTitle(job.title), company: normalizeSourceText(job.company), location: normalizeSourceText(job.location), country: normalizeSourceText(job.country) });
  }
  const seen = new Set<string>();
  return [...byOrigin.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)).filter((job) => {
    const key = `${job.title.toLocaleLowerCase()}:${job.company.toLocaleLowerCase()}:${job.location.toLocaleLowerCase()}:${job.country.toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function JobsPage() {
  const { user } = useGlobalStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [form, setForm] = useState({ title: '', company: '', location: '', country: '', salary: '', tag: '정규직' });
  const [disabledSourceIds, setDisabledSourceIds] = useState<string[]>([]);

  const loadJobs = async () => {
    const settings = await getDocument<ContentSourceSettings>('adminSettings', 'contentSources').catch(() => null);
    const disabled = settings?.disabledSourceIds || [];
    setDisabledSourceIds(disabled);
    const sources = CONTENT_SOURCES.filter((source) => !disabled.includes(source.id) && source.categories.includes('jobs'));
    const [data, sourceResults] = await Promise.all([
      listDocuments<Omit<Job, 'id'>>('jobs', getSessionToken()).catch(() => []),
      Promise.allSettled(sources.map(async (source) => ({ source, result: await fetchSourceCategory(source.id, 'jobs') }))),
    ]);
    const sourceJobs = sourceResults.flatMap((entry) => {
      if (entry.status !== 'fulfilled' || !entry.value.result) return [];
      const { source, result } = entry.value;
      return result.items.map((item) => {
        const id = sourceItemId(source.id, 'jobs', item.url);
        return { id, title: item.title, company: item.company || source.name, location: item.location || item.country || source.region, salary: item.salary || '상세 내용 참조', tag: item.tag || '채용', country: item.country || source.region, authorId: 'source', createdAt: item.publishedAt || result.fetchedAt, body: item.body || item.description, image: item.image, images: item.images, sourceId: source.id, sourceName: source.name, sourceUrl: item.url, sourceCategory: 'jobs', sourceContentId: id };
      });
    });
    setJobs(curateJobs([...data as Job[], ...sourceJobs]).filter((job) => !job.sourceId || !disabled.includes(job.sourceId)));
  };
  const loadJobsEffect = useEffectEvent(loadJobs);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadJobsEffect(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return window.alert('로그인 후 공고를 등록할 수 있습니다.');
    const token = getSessionToken();
    if (!token) return;
    const values = Object.values(form).map((value) => value.trim());
    if (form.title.trim().length < 4 || form.company.trim().length < 2 || form.location.trim().length < 2 || form.country.trim().length < 2 || !form.salary.trim()) return window.alert('공고 제목·회사명·근무 지역·국가·급여를 정확히 입력해주세요.');
    if (values.some((value) => /<[^>]+>|javascript:|data:text\/html|https?:\/\//i.test(value))) return window.alert('공고 내용에 HTML 또는 외부 링크를 입력할 수 없습니다.');
    try {
      await createDocument('jobs', crypto.randomUUID(), { ...form, title: form.title.trim(), company: form.company.trim(), location: form.location.trim(), country: form.country.trim(), salary: form.salary.trim(), authorId: user.id, createdAt: new Date().toISOString() }, token);
      setForm({ title: '', company: '', location: '', country: '', salary: '', tag: '정규직' });
      setIsWriting(false);
      await loadJobs();
    } catch { window.alert('공고를 저장하지 못했습니다.'); }
  };

  const filteredJobs = jobs.filter((job) => !job.sourceId || !disabledSourceIds.includes(job.sourceId));

  return (
    <div className="jobs-page min-h-screen bg-transparent px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white">구인/구직</h1>
            <p className="mt-2 text-sm font-bold text-blue-200">실제 구인 정보만 등록해주세요. 국가 선택 없이 전체 공고를 국가 태그로 구분해 보여드립니다.</p>
          </div>
          <button onClick={() => setIsWriting(true)} className="rounded-lg bg-blue-600 px-5 py-2.5 font-bold text-white shadow-md transition hover:bg-blue-500">구인 글쓰기</button>
        </header>
        <main className="space-y-4">
          {filteredJobs.length === 0 && <div className="rounded-xl border border-dashed border-white/15 py-20 text-center"><span className="mb-4 block text-4xl">📭</span><p className="text-slate-500">등록된 구인/구직 공고가 없습니다.</p></div>}
          {filteredJobs.map((job) => <Link href={job.sourceContentId ? `/content/${job.sourceContentId}?source=${encodeURIComponent(job.sourceId || '')}&category=jobs&url=${encodeURIComponent(job.sourceUrl || '')}` : `/jobs?job=${job.id}`} key={job.id} className="group block"><div className="flex items-center gap-3 border-b border-white/5 bg-white/[.045] px-3 py-3 transition-colors hover:bg-white/[.06] sm:gap-4"><div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-blue-400/10">{job.image ? <img src={job.image} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xl">💼</div>}</div><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold"><span className="rounded-full bg-blue-400/10 px-2 py-0.5 text-blue-100">{job.country}</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-200">{job.tag}</span><span className="truncate text-slate-300">{job.company}</span>{job.sourceName && <span className="truncate text-teal-200">출처: {job.sourceName}</span>}</div><h3 className="truncate text-base font-bold text-white transition-colors group-hover:text-blue-200">{job.title}</h3><div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-300"><span>📍 {job.location}</span><span>💰 {job.salary}</span></div></div><span className="hidden shrink-0 text-xs font-black text-teal-200 sm:block">상세 보기 →</span></div></Link>)}
        </main>
      </div>
      {isWriting && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => event.target === event.currentTarget && setIsWriting(false)}><form onSubmit={handleSubmit} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black text-slate-900">구인 공고 등록</h2><input required placeholder="공고 제목" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><input required placeholder="회사명" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><input required placeholder="근무 지역" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><input required placeholder="국가 태그 (예: 독일, 미국, 브라질)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><input required placeholder="급여" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} className="w-full rounded-xl border px-4 py-3" /><select value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} className="w-full rounded-xl border px-4 py-3"><option>정규직</option><option>파트타임</option><option>계약직</option><option>재택근무</option></select><div className="flex gap-2 pt-2"><button type="button" onClick={() => setIsWriting(false)} className="flex-1 rounded-xl border py-3 font-bold">취소</button><button className="flex-1 rounded-xl bg-blue-600 py-3 font-bold text-white">등록</button></div></form></div>}
    </div>
  );
}
