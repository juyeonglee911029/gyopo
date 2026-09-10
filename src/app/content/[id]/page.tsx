'use client';

import Link from 'next/link';
import { Image as ImageIcon, ShieldCheck } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getDocument, getSessionToken } from '@/lib/firebase';
import { POST_COLLECTIONS, isPostCollection, postThreadKey, type PostCollection } from '@/lib/comments';
import { sourceItemId } from '@/lib/contentSources';
import PostComments from '@/components/posts/PostComments';
import PostActions from '@/components/posts/PostActions';

export const runtime = 'edge';

type ContentRecord = {
  id: string;
  title?: string;
  name?: string;
  body?: string;
  desc?: string;
  description?: string;
  image?: string;
  images?: string[];
  sourceUrl?: string;
  sourceId?: string;
  sourceContentId?: string;
  sourceName?: string;
  sourceCategory?: string;
  authorId?: string;
  authorName?: string;
  author?: string;
  type?: string;
  country?: string;
  location?: string;
  company?: string;
  salary?: string;
  price?: string;
  address?: string;
  tel?: string;
  createdAt?: string;
};

type ResolvedContent = ContentRecord & { collection: PostCollection | 'source'; threadKey: string };
type SourceItem = Omit<ContentRecord, 'id'> & { title: string; url: string; publishedAt?: string; phone?: string };

function categoryLabel(category?: string) {
  return ({ news: '뉴스', directory: '업소록', jobs: '구인구직', market: '장터', events: '공동구매·행사', community: '커뮤니티' } as Record<string, string>)[category || ''] || '출처 콘텐츠';
}

async function findLiveContent(id: string, sourceId: string, category: string, sourceUrl: string): Promise<ResolvedContent | null> {
  if (!['news', 'directory', 'jobs', 'market', 'events', 'community'].includes(category) || sourceItemId(sourceId, category, sourceUrl) !== id) return null;
  const query = sourceId.startsWith('regional-')
    ? `region=${encodeURIComponent(sourceId.replace(/^regional-/, ''))}`
    : `source=${encodeURIComponent(sourceId)}&category=${encodeURIComponent(category)}`;
  const response = await fetch(`/api/content/preview?${query}`);
  if (!response.ok) throw new Error('Source unavailable');
  const snapshot = await response.json() as { sourceName?: string; region?: string; fetchedAt?: string; items?: SourceItem[]; sections?: Array<{ category: string; items: SourceItem[] }> };
  const entries = [...(snapshot.items || []), ...(snapshot.sections || []).filter((section) => section.category === category).flatMap((section) => section.items)];
  const entry = entries.find((item) => item.url === sourceUrl);
  if (!entry) return null;
  return { ...entry, id, collection: 'source', threadKey: postThreadKey('source', id), sourceId, sourceContentId: id, body: entry.body || '', description: entry.description || '', tel: entry.tel || entry.phone, sourceName: snapshot.sourceName, country: entry.country || snapshot.region, sourceCategory: category, sourceUrl: entry.url, createdAt: entry.publishedAt || snapshot.fetchedAt };
}

async function findContent(id: string, requestedCollection: string | null, sourceId: string | null, category: string | null, sourceUrl: string | null): Promise<ResolvedContent | null> {
  if (!postThreadKey('posts', id) || (requestedCollection !== null && !isPostCollection(requestedCollection))) return null;
  let failure: unknown;
  if (!requestedCollection && sourceId && category && sourceUrl) {
    if (sourceItemId(sourceId, category, sourceUrl) !== id) return null;
    const live = await findLiveContent(id, sourceId, category, sourceUrl).catch((error: unknown) => { failure = error; return null; });
    if (live) return live;
  }
  const token = getSessionToken();
  const collections = requestedCollection && isPostCollection(requestedCollection) ? [requestedCollection] : POST_COLLECTIONS;
  for (const collection of collections) {
    const record = await getDocument<Omit<ContentRecord, 'id'>>(collection, id, token).catch((error: unknown) => { failure = error; return null; });
    if (record) {
      const sourceContentId = record.sourceContentId || (record.sourceId ? id : undefined);
      return { ...record, id, collection, threadKey: postThreadKey(collection, id, sourceContentId), sourceCategory: record.sourceCategory || ({ posts: record.type === 'news' ? 'news' : 'community', jobs: 'jobs', directories: 'directory', marketItems: 'market' })[collection] };
    }
  }
  if (failure) throw failure;
  return null;
}

export default function ContentDetailPage() {
  return <Suspense fallback={<div className="px-4 py-24 text-center text-slate-400">콘텐츠를 불러오는 중입니다...</div>}><ContentDetailRoute /></Suspense>;
}

function ContentDetailRoute() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  return <ContentDetail key={`${id}?${searchParams.toString()}`} id={id} collection={searchParams.get('collection')} source={searchParams.get('source')} category={searchParams.get('category')} url={searchParams.get('url')} />;
}

function ContentDetail({ id, collection, source, category, url }: { id: string; collection: string | null; source: string | null; category: string | null; url: string | null }) {
  const [content, setContent] = useState<ResolvedContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void findContent(id, collection, source, category, url)
      .then((record) => { if (active) setContent(record); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, collection, source, category, url, revision]);

  if (loading) return <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-slate-500">콘텐츠를 불러오는 중입니다...</div>;
  if (error) return <div className="mx-auto max-w-3xl px-4 py-24 text-center"><p role="alert" className="text-slate-400">콘텐츠를 불러오지 못했습니다.</p><button type="button" className="mt-4 text-teal-300" onClick={() => { setError(false); setLoading(true); setRevision((value) => value + 1); }}>다시 시도</button></div>;
  if (!content) return <div className="mx-auto max-w-3xl px-4 py-24 text-center"><p className="text-slate-500">게시된 콘텐츠를 찾을 수 없습니다.</p><Link href="/news" className="mt-4 inline-block font-bold text-teal-400">뉴스 허브로 돌아가기</Link></div>;

  const title = content.title || content.name || '출처 콘텐츠';
  const body = content.body?.trim() || content.desc?.trim() || '';
  const description = content.description?.trim() || '';
  const images = [content.image, ...(content.images || [])].filter((image, index, values): image is string => Boolean(image) && values.indexOf(image) === index);
  const backHref = content.sourceCategory === 'jobs' ? '/jobs' : content.sourceCategory === 'directory' ? '/directory' : content.sourceCategory === 'market' ? '/market' : content.sourceCategory === 'community' ? '/community' : '/news';
  const imported = content.collection === 'source' || Boolean(content.sourceId || content.sourceContentId || content.sourceUrl);

  return (
    <article className="w-full px-4 py-8 sm:px-6 lg:px-10">
      <Link href={backHref} className="text-sm font-bold text-teal-300 hover:text-teal-200">← 목록으로 돌아가기</Link>
      <div className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-[#10182b] shadow-2xl">
        {images[0] ? <img src={images[0]} alt={title} className="max-h-[42rem] w-full bg-black/20 object-contain" /> : imported ? <div className="grid h-52 place-items-center bg-gradient-to-br from-teal-500/20 via-slate-900 to-slate-950 text-sm font-bold text-teal-200">원문 대표 이미지가 없습니다</div> : null}
        <div className="p-6 sm:p-10">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {content.country && <span className="rounded-full bg-teal-300/10 px-2.5 py-1 font-bold text-teal-200">{content.country}</span>}
            <span className="rounded-full bg-white/10 px-2.5 py-1 font-bold text-slate-300">{categoryLabel(content.sourceCategory)}</span>
            {content.sourceName && <span className="inline-flex items-center gap-1 font-bold text-emerald-300"><ShieldCheck size={14} /> {content.sourceName}</span>}
            {(content.author || content.authorName) && <span>{content.author || content.authorName}</span>}
            {content.createdAt && <span>{new Date(content.createdAt).toLocaleDateString('ko-KR')}</span>}
          </div>
          <h1 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl">{title}</h1>

          {description && description !== body && <p className="mt-5 rounded-2xl border border-teal-300/10 bg-teal-300/[.06] p-4 text-sm leading-7 text-teal-50">{description}</p>}

           {(content.company || content.location || content.salary || content.price || content.address || content.tel) && (
            <div className="mt-6 grid gap-2 rounded-2xl border border-white/8 bg-white/[.04] p-4 text-sm text-slate-300 sm:grid-cols-2">
              {content.company && <div><span className="text-slate-500">회사</span><strong className="ml-2">{content.company}</strong></div>}
              {content.location && <div><span className="text-slate-500">지역</span><strong className="ml-2">{content.location}</strong></div>}
              {content.salary && <div><span className="text-slate-500">급여</span><strong className="ml-2">{content.salary}</strong></div>}
              {content.price && <div><span className="text-slate-500">가격</span><strong className="ml-2">{content.price}</strong></div>}
              {content.address && <div><span className="text-slate-500">주소</span><strong className="ml-2">{content.address}</strong></div>}
              {content.tel && <div><span className="text-slate-500">연락처</span><strong className="ml-2">{content.tel}</strong></div>}
            </div>
          )}

            <section className="mx-auto mt-8 max-w-5xl"><h2 className="mb-3 text-xs font-black uppercase tracking-[.18em] text-slate-500">본문</h2>{body ? <div className="whitespace-pre-wrap text-[17px] leading-8 text-slate-200">{body}</div> : <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm leading-6 text-slate-500">{imported ? '이 출처는 상세 본문을 제공하지 않습니다.' : '등록된 상세 정보는 위에서 확인할 수 있습니다.'}</p>}</section>
           {images.length > 1 && <div className="mx-auto mt-8 grid max-w-5xl gap-3 sm:grid-cols-2"><div className="col-span-full mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-slate-500"><ImageIcon size={14} /> 원문 이미지 {images.length - 1}장</div>{images.slice(1).map((image) => <img key={image} src={image} alt={title} className="max-h-96 w-full rounded-2xl bg-black/20 object-contain" />)}</div>}
        </div>
      </div>
      {!imported && <PostActions collection={content.collection} id={content.id} authorId={content.authorId} backHref={backHref} />}
      <PostComments threadKey={content.threadKey} />
    </article>
  );
}
