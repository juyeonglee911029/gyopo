import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRegionalListing, isIndexableRegionalPost } from '@/lib/regionalContent';
import { getCountryRoute, getRegionalCategory, isRegionalPostId } from '@/lib/regionRoutes';
import { canonicalUrl, pageMetadata, serializeJsonLd } from '@/lib/seo';
import { regionalPostHref } from '@/lib/regionRoutes';
import RegionalNavigation from '../RegionalNavigation';
import RegionalPostList from '../RegionalPostList';
import RegionalPostComposer from '../RegionalPostComposer';

export const runtime = 'edge';

type Props = {
  params: Promise<{ country: string; category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function resolveListing({ params, searchParams }: Props) {
  const route = await params;
  const country = getCountryRoute(route.country);
  const category = getRegionalCategory(route.category);
  if (!country || !category) notFound();
  const { after } = await searchParams;
  if (after !== undefined && (typeof after !== 'string' || !isRegionalPostId(after))) notFound();
  return { country, category, after, listing: await getRegionalListing(country.slug, category.slug, after) };
}

export async function generateMetadata(props: Props) {
  const { country, category, listing, after } = await resolveListing(props);
  return pageMetadata(`${country.label} ${category.label}`, `${country.label} 한인 ${category.label} 게시판: ${category.description}. 공개된 게시글의 내용을 확인하세요.`, `/${country.slug}/${category.slug}`, !after && listing.status === 'ok' && listing.posts.some(isIndexableRegionalPost));
}

export default async function CountryCategoryPage(props: Props) {
  const { country, category, listing, after } = await resolveListing(props);
  const path = `/${country.slug}/${category.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'CollectionPage',
    name: `${country.label} ${category.label}`, url: canonicalUrl(path),
    mainEntity: { '@type': 'ItemList', itemListElement: listing.posts.map((post, index) => ({
      '@type': 'ListItem', position: index + 1, name: post.title,
      url: canonicalUrl(regionalPostHref(country, category.slug, post.id)),
    })) },
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 text-slate-100 sm:px-6">
      <Link href={`/${country.slug}`} className="text-sm font-bold text-teal-200">{country.label} 한인 커뮤니티</Link>
       <div className="mt-6 flex flex-wrap items-end justify-between gap-4"><h1 className="text-3xl font-black sm:text-4xl">{country.label} {category.label}</h1><RegionalPostComposer country={country} category={category.slug} label={category.label} /></div>
      <p className="mt-4 text-sm leading-7 text-slate-300">{country.label} 지역의 {category.description}를 확인하세요. 게시글 제목을 누르면 등록된 전체 내용과 출처를 볼 수 있습니다.</p>
      <RegionalNavigation country={country} current={category.slug} />
      {listing.status === 'unavailable' ? (
        <div role="status" className="rounded-xl border border-amber-300/20 p-6 text-amber-100"><h2 className="font-bold">게시글을 불러오지 못했습니다</h2><p className="mt-2 text-sm">현재 공개 데이터에 연결할 수 없습니다. 게시글이 없는 상태와는 다릅니다. 잠시 후 다시 확인해주세요.</p></div>
      ) : listing.posts.length ? <RegionalPostList posts={listing.posts} /> : (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-slate-300"><h2 className="font-bold">{after || listing.nextCursor ? '이 목록 구간에 표시할 게시글이 없습니다' : '아직 공개된 게시글이 없습니다'}</h2><p className="mt-2 text-sm">{listing.nextCursor ? '다음 목록을 확인하거나 다른 게시판을 살펴보세요.' : '다른 분야의 지역 게시판도 살펴보세요.'}</p></div>
      )}
      <nav aria-label="게시글 목록 이동" className="mt-6 flex gap-5 text-sm font-bold text-teal-200">
        {after && <Link href={path}>첫 목록</Link>}
        {listing.nextCursor && <Link href={`${path}?after=${encodeURIComponent(listing.nextCursor)}`} rel="next">다음 목록</Link>}
      </nav>
      {listing.posts.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />}
    </div>
  );
}
