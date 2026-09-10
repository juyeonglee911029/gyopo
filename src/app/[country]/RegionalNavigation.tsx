import Link from 'next/link';
import { REGIONAL_CATEGORIES, type CountryRoute, type RegionalCategory } from '@/lib/regionRoutes';

export default function RegionalNavigation({ country, current }: { country: CountryRoute; current?: RegionalCategory }) {
  return (
    <nav aria-label={`${country.label} 게시판`} className="my-6 flex flex-wrap gap-2 text-sm font-bold">
      <Link href={`/${country.slug}`} aria-current={!current ? 'page' : undefined} className="rounded-lg border border-white/15 px-3 py-2 text-slate-200 hover:bg-white/10">{country.label} 전체</Link>
      {REGIONAL_CATEGORIES.map((category) => (
        <Link key={category.slug} href={`/${country.slug}/${category.slug}`} aria-current={current === category.slug ? 'page' : undefined} className={`rounded-lg border px-3 py-2 ${current === category.slug ? 'border-teal-300/40 bg-teal-300/10 text-teal-200' : 'border-white/15 text-slate-200 hover:bg-white/10'}`}>
          {category.label}
        </Link>
      ))}
    </nav>
  );
}
