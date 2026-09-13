import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostActions from '@/components/posts/PostActions';
import PostComments from '@/components/posts/PostComments';
import { getCountryOverview, getRegionalListing, getRegionalPost, isIndexableRegionalPost, type RegionalListing } from '@/lib/regionalContent';
import { cityHref, cityRegionalPostHref, getCityRoute, getCountryRoute, getRegionalCategory, isRegionalPostId, regionalPostHref, type CityRoute, type CountryRoute, type RegionalCategory } from '@/lib/regionRoutes';
import { canonicalUrl, pageMetadata, seoExcerpt, serializeJsonLd } from '@/lib/seo';
import { postThreadKey } from '@/lib/comments';
import RegionalNavigation from '../RegionalNavigation';
import RegionalPostComposer from '../RegionalPostComposer';
import RegionalPostList from '../RegionalPostList';

export const runtime = 'edge';

type Props = {
  params: Promise<{ country: string; segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type CategoryRoute = NonNullable<ReturnType<typeof getRegionalCategory>>;

type ResolvedRoute =
  | { kind: 'country'; country: CountryRoute; overview: Awaited<ReturnType<typeof getCountryOverview>> }
  | { kind: 'city'; country: CountryRoute; city: CityRoute }
  | { kind: 'category'; country: CountryRoute; category: CategoryRoute; listing: RegionalListing; after?: string }
  | { kind: 'city-category'; country: CountryRoute; city: CityRoute; category: CategoryRoute; listing: RegionalListing; after?: string }
  | { kind: 'detail'; country: CountryRoute; category: CategoryRoute; id: string; result: Awaited<ReturnType<typeof getRegionalPost>> }
  | { kind: 'city-detail'; country: CountryRoute; city: CityRoute; category: CategoryRoute; id: string; result: Awaited<ReturnType<typeof getRegionalPost>> };

function categoryOrNotFound(value: ReturnType<typeof getRegionalCategory>): RegionalCategory {
  if (!value) notFound();
  return value.slug;
}

async function readAfter(searchParams: Props['searchParams']) {
  const value = (await searchParams).after;
  if (value !== undefined && (typeof value !== 'string' || !isRegionalPostId(value))) notFound();
  return value;
}

async function resolveRoute({ params, searchParams }: Props): Promise<ResolvedRoute> {
  const { country: countrySlug, segments = [] } = await params;
  const country = getCountryRoute(countrySlug);
  if (!country) notFound();
  const [first, second, third, ...rest] = segments;
  if (!first) return { kind: 'country', country, overview: await getCountryOverview(country.slug) };

  const category = getRegionalCategory(first);
  if (category && !second) {
    const after = await readAfter(searchParams);
    return { kind: 'category', country, category, after, listing: await getRegionalListing(country.slug, category.slug, after) };
  }

  const city = getCityRoute(country.slug, first);
  if (city && !second) return { kind: 'city', country, city };

  if (category && second && !third && isRegionalPostId(second)) {
    return { kind: 'detail', country, category, id: second, result: await getRegionalPost(country.slug, category.slug, second) };
  }

  const cityCategory = city && second ? getRegionalCategory(second) : undefined;
  if (city && cityCategory && !third) {
    const after = await readAfter(searchParams);
    return { kind: 'city-category', country, city, category: cityCategory, after, listing: await getRegionalListing(country.slug, cityCategory.slug, after) };
  }
  if (city && cityCategory && third && !rest.length && isRegionalPostId(third)) {
    return { kind: 'city-detail', country, city, category: cityCategory, id: third, result: await getRegionalPost(country.slug, cityCategory.slug, third) };
  }
  notFound();
}

export async function generateMetadata(props: Props) {
  const route = await resolveRoute(props);
  if (route.kind === 'country') return pageMetadata(`${route.country.label} 한인 커뮤니티`, `${route.country.label} 교민을 위한 구인구직, 주거, 생활 이야기, 뉴스, 업소록과 장터 게시판입니다.`, `/${route.country.slug}`, route.overview.every(({ listing }) => listing.status === 'ok') && route.overview.some(({ listing }) => listing.posts.slice(0, 3).some(isIndexableRegionalPost)));
  if (route.kind === 'city') return pageMetadata(`${route.city.label} 한인 생활`, `${route.country.label} ${route.city.label} 교민을 위한 구인구직, 생활 정보, 커뮤니티와 지역 서비스를 찾아보세요.`, cityHref(route.city));
  if (route.kind === 'category' || route.kind === 'city-category') {
    const path = route.kind === 'city-category' ? cityHref(route.city, route.category.slug) : `/${route.country.slug}/${route.category.slug}`;
    const title = route.kind === 'city-category' ? `${route.city.label} ${route.category.label}` : `${route.country.label} ${route.category.label}`;
    return pageMetadata(title, `${title}: ${route.category.description}. 공개된 게시글의 내용을 확인하세요.`, path, !route.after && route.listing.status === 'ok' && route.listing.posts.some(isIndexableRegionalPost));
  }
  const title = route.result.status === 'ok' ? route.result.post.title : `${route.country.label} ${route.category.label}`;
  const description = route.result.status === 'ok' ? seoExcerpt(route.result.post.body || route.result.post.description || title) : `${title} 게시글`;
  const path = route.kind === 'city-detail' ? cityRegionalPostHref(route.city, route.category.slug, route.id) : regionalPostHref(route.country, route.category.slug, route.id);
  return pageMetadata(title, description, path, route.result.status === 'ok' && isIndexableRegionalPost(route.result.post));
}

function CityPage({ city }: { city: CityRoute }) {
  const primaryCategories = ['jobs', 'community', 'housing', 'food', 'directory', 'market'] as const;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 sm:px-6">
      <Link href="/regions" className="text-sm font-bold text-teal-200">지역 탐색 / Regions</Link>
      <header className="mt-8 border-b border-white/10 pb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-teal-200">{city.country.flag} {city.country.english} / {city.english}</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">{city.label} 한인 생활</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{city.country.label} {city.label}에 거주하거나 방문하는 교민을 위한 지역별 게시판입니다. 필요한 분야를 골라 구인구직, 주거, 커뮤니티와 생활 서비스를 확인하세요.</p>
      </header>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {primaryCategories.map((slug) => {
          const category = getRegionalCategory(slug);
          if (!category) return null;
          return <Link key={slug} href={cityHref(city, slug)} className="rounded-2xl border border-white/10 bg-white/[.045] p-5 transition hover:border-teal-300/30 hover:bg-teal-300/[.06]"><h2 className="font-black text-white">{category.label}</h2><p className="mt-2 text-xs leading-5 text-slate-400">{category.description}</p><span className="mt-5 block text-xs font-black text-teal-200">게시판 보기 →</span></Link>;
        })}
      </div>
      <Link href={`/${city.country.slug}`} className="mt-8 inline-flex text-sm font-bold text-slate-400 hover:text-white">{city.country.label} 국가 전체 게시판 보기 →</Link>
    </div>
  );
}

function CategoryPage({ country, city, category, listing, after }: { country: CountryRoute; city?: CityRoute; category: CategoryRoute; listing: RegionalListing; after?: string }) {
  const categorySlug = categoryOrNotFound(category);
  const path = city ? cityHref(city, categorySlug) : `/${country.slug}/${categorySlug}`;
  const heading = city ? `${city.label} ${category.label}` : `${country.label} ${category.label}`;
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 sm:px-6">
      <Link href={city ? cityHref(city) : `/${country.slug}`} className="text-sm font-bold text-teal-200">{city ? `${city.label} 한인 생활` : `${country.label} 한인 커뮤니티`}</Link>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><h1 className="text-3xl font-black sm:text-4xl">{heading}</h1><RegionalPostComposer country={country} category={categorySlug} label={category.label} /></div>
      <p className="mt-4 text-sm leading-7 text-slate-300">{city ? `${city.label}에서 확인할 수 있는 국가 단위 공개 게시글과 생활 정보를 분야별로 살펴보세요.` : `${country.label} 지역의 ${category.description}를 확인하세요.`}</p>
      {!city && <RegionalNavigation country={country} current={categorySlug} />}
      {listing.status === 'unavailable' ? <div role="status" className="rounded-xl border border-amber-300/20 p-6 text-amber-100"><h2 className="font-bold">게시글을 불러오지 못했습니다</h2><p className="mt-2 text-sm">현재 공개 데이터에 연결할 수 없습니다. 잠시 후 다시 확인해주세요.</p></div>
        : listing.posts.length ? <RegionalPostList posts={listing.posts} basePath={path} />
          : <div className="rounded-xl border border-dashed border-white/15 p-8 text-slate-300"><h2 className="font-bold">{after || listing.nextCursor ? '이 목록 구간에 표시할 게시글이 없습니다' : '아직 공개된 게시글이 없습니다'}</h2><p className="mt-2 text-sm">다른 분야의 지역 게시판도 살펴보세요.</p></div>}
      <nav aria-label="게시글 목록 이동" className="mt-6 flex gap-5 text-sm font-bold text-teal-200">
        {after && <Link href={path}>첫 목록</Link>}
        {listing.nextCursor && <Link href={`${path}?after=${encodeURIComponent(listing.nextCursor)}`} rel="next">다음 목록</Link>}
      </nav>
      {listing.posts.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: heading, url: canonicalUrl(path), mainEntity: { '@type': 'ItemList', itemListElement: listing.posts.map((post, index) => ({ '@type': 'ListItem', position: index + 1, name: post.title, url: canonicalUrl(`${path}/${encodeURIComponent(post.id)}`) })) } }) }} />}
    </div>
  );
}

function DetailPage({ country, city, category, result }: { country: CountryRoute; city?: CityRoute; category: CategoryRoute; result: Awaited<ReturnType<typeof getRegionalPost>> }) {
  const categorySlug = categoryOrNotFound(category);
  if (result.status !== 'ok') {
    if (result.status === 'not-found') notFound();
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-amber-100">게시글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>;
  }
  const post = result.post;
  const path = city ? cityRegionalPostHref(city, categorySlug, post.id) : regionalPostHref(country, categorySlug, post.id);
  const backHref = city ? cityHref(city, categorySlug) : `/${country.slug}/${categorySlug}`;
  const threadKey = post.sourceBacked ? postThreadKey('source', post.id) : postThreadKey(post.collection, post.id);
  return (
    <article className="mx-auto max-w-4xl px-4 py-8 text-slate-100 sm:px-6">
      <Link href={backHref} className="text-sm font-bold text-teal-200">← {city ? `${city.label} ${category.label}` : `${country.label} ${category.label}`}</Link>
      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#10182b]">
        {post.images[0] && <img src={post.images[0]} alt={post.title} className="max-h-[34rem] w-full bg-black/20 object-contain" />}
        <div className="p-6 sm:p-9">
          <div className="flex flex-wrap gap-2 text-xs text-slate-400"><span>{country.flag} {city ? city.label : country.label}</span><span>{category.label}</span>{post.sourceName && <span>출처: {post.sourceName}</span>}{post.createdAt && <time dateTime={post.createdAt}>{post.createdAt.slice(0, 10)}</time>}</div>
          <h1 className="mt-4 break-words text-3xl font-black leading-tight sm:text-4xl">{post.title}</h1>
          {post.facts.length > 0 && <dl className="mt-6 grid gap-2 rounded-xl bg-white/[.04] p-4 text-sm sm:grid-cols-2">{post.facts.map((fact) => <div key={fact.label}><dt className="inline text-slate-500">{fact.label}: </dt><dd className="inline font-bold text-slate-200">{fact.value}</dd></div>)}</dl>}
          {post.description && post.description !== post.body && <p className="mt-6 rounded-xl bg-teal-300/[.06] p-4 text-sm leading-7 text-teal-50">{post.description}</p>}
          <div className="mt-8 whitespace-pre-wrap break-words text-[17px] leading-8 text-slate-200">{post.body || '상세 본문이 제공되지 않은 게시글입니다.'}</div>
          {post.sourceUrl && <a href={post.sourceUrl} target="_blank" rel="noreferrer" className="mt-7 inline-block text-sm font-bold text-teal-200">원문 출처 열기 ↗</a>}
        </div>
      </div>
      {!post.sourceBacked && <PostActions collection={post.collection} id={post.id} authorId={post.authorId} backHref={backHref} />}
      {threadKey && <PostComments threadKey={threadKey} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ '@context': 'https://schema.org', '@type': 'Article', headline: post.title, description: seoExcerpt(post.body || post.description), url: canonicalUrl(path), datePublished: post.createdAt, dateModified: post.updatedAt || post.createdAt, author: { '@type': 'Person', name: post.author || 'GYOPO 회원' } }) }} />
    </article>
  );
}

export default async function CountrySegmentsPage(props: Props) {
  const route = await resolveRoute(props);
  if (route.kind === 'country') {
    return <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 sm:px-6"><Link href="/regions" className="text-sm font-bold text-teal-200">지역 탐색 / Regions</Link><header className="mt-6"><p className="text-xs font-bold uppercase tracking-widest text-teal-200">{route.country.english} / GYOPO</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">{route.country.label} 한인 커뮤니티</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{route.country.label} 교민의 생활 이야기와 공개 게시글을 분야별로 살펴보세요.</p></header><RegionalNavigation country={route.country} /><div className="space-y-10">{route.overview.map(({ category, listing }) => <section key={category.slug}><div className="mb-3 flex flex-wrap items-baseline justify-between gap-3"><h2 className="text-xl font-bold"><Link href={`/${route.country.slug}/${category.slug}`} className="hover:text-teal-200">{route.country.label} {category.label}</Link></h2><Link href={`/${route.country.slug}/${category.slug}`} className="text-sm text-teal-200">게시판 보기</Link></div><p className="mb-4 text-sm text-slate-400">{category.description}</p>{listing.status === 'unavailable' ? <p role="status" className="text-sm text-amber-200">게시글을 불러오지 못했습니다.</p> : listing.posts.length ? <RegionalPostList posts={listing.posts} /> : <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-400">아직 이 지역에 공개된 게시글이 없습니다.</p>}</section>)}</div></div>;
  }
  if (route.kind === 'city') return <CityPage city={route.city} />;
  if (route.kind === 'category') return <CategoryPage country={route.country} category={route.category} listing={route.listing} after={route.after} />;
  if (route.kind === 'city-category') return <CategoryPage country={route.country} city={route.city} category={route.category} listing={route.listing} after={route.after} />;
  if (route.kind === 'detail') return <DetailPage country={route.country} category={route.category} result={route.result} />;
  return <DetailPage country={route.country} city={route.city} category={route.category} result={route.result} />;
}
