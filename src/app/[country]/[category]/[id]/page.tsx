import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostActions from '@/components/posts/PostActions';
import PostComments from '@/components/posts/PostComments';
import { getRegionalPost, isIndexableRegionalPost } from '@/lib/regionalContent';
import { getCountryRoute, getRegionalCategory, isRegionalPostId } from '@/lib/regionRoutes';
import { canonicalUrl, pageMetadata, seoExcerpt, serializeJsonLd } from '@/lib/seo';
import { postThreadKey } from '@/lib/comments';

type Props = { params: Promise<{ country: string; category: string; id: string }> };

async function resolve(props: Props) {
  const { country: countrySlug, category: categorySlug, id } = await props.params;
  const country = getCountryRoute(countrySlug);
  const category = getRegionalCategory(categorySlug);
  if (!country || !category || !isRegionalPostId(id)) notFound();
  const result = await getRegionalPost(country.slug, category.slug, id);
  return { country, category, id, result };
}

export async function generateMetadata(props: Props) {
  const { country, category, result } = await resolve(props);
  if (result.status !== 'ok') return pageMetadata(`${country.label} ${category.label}`, `${country.label} ${category.label} 게시글`, `/${country.slug}/${category.slug}`, false);
  return pageMetadata(result.post.title, seoExcerpt(result.post.body || result.post.description || `${country.label} ${category.label} 게시글`), `/${country.slug}/${category.slug}/${result.post.id}`, isIndexableRegionalPost(result.post));
}

export default async function RegionalPostPage(props: Props) {
  const { country, category, result } = await resolve(props);
  if (result.status !== 'ok') {
    if (result.status === 'not-found') notFound();
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-amber-100">게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;
  }

  const post = result.post;
  const threadKey = post.sourceBacked ? postThreadKey('source', post.id) : postThreadKey(post.collection, post.id);
  const path = `/${country.slug}/${category.slug}/${post.id}`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: seoExcerpt(post.body || post.description), url: canonicalUrl(path), datePublished: post.createdAt, dateModified: post.updatedAt || post.createdAt, author: { '@type': 'Person', name: post.author || 'GYOPO 회원' } };

  return (
    <article className="mx-auto max-w-4xl px-4 py-8 text-slate-100 sm:px-6">
      <Link href={`/${country.slug}/${category.slug}`} className="text-sm font-bold text-teal-200">← {country.label} {category.label}</Link>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#10182b]">
        {post.images[0] && <img src={post.images[0]} alt={post.title} className="max-h-[34rem] w-full bg-black/20 object-contain" />}
        <div className="p-6 sm:p-9">
          <div className="flex flex-wrap gap-2 text-xs text-slate-400"><span>{country.flag} {country.label}</span><span>{category.label}</span>{post.sourceName && <span>출처: {post.sourceName}</span>}{post.createdAt && <time dateTime={post.createdAt}>{post.createdAt.slice(0, 10)}</time>}</div>
          <h1 className="mt-4 break-words text-3xl font-black leading-tight sm:text-4xl">{post.title}</h1>
          {post.facts.length > 0 && <dl className="mt-6 grid gap-2 rounded-xl bg-white/[.04] p-4 text-sm sm:grid-cols-2">{post.facts.map((fact) => <div key={fact.label}><dt className="inline text-slate-500">{fact.label}: </dt><dd className="inline font-bold text-slate-200">{fact.value}</dd></div>)}</dl>}
          {post.description && post.description !== post.body && <p className="mt-6 rounded-xl bg-teal-300/[.06] p-4 text-sm leading-7 text-teal-50">{post.description}</p>}
          <div className="mt-8 whitespace-pre-wrap break-words text-[17px] leading-8 text-slate-200">{post.body || '상세 본문이 제공되지 않은 게시글입니다.'}</div>
          {post.sourceUrl && <a href={post.sourceUrl} target="_blank" rel="noreferrer" className="mt-7 inline-block text-sm font-bold text-teal-200">원문 출처 열기 ↗</a>}
        </div>
      </div>
      {!post.sourceBacked && <PostActions collection={post.collection} id={post.id} authorId={post.authorId} backHref={`/${country.slug}/${category.slug}`} />}
      {threadKey && <PostComments threadKey={threadKey} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
    </article>
  );
}
