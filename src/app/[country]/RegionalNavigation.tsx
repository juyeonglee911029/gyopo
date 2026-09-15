import Link from 'next/link';
import { PUBLIC_SERVICE_ROUTES, serviceHref, type CountryRoute, type PublicServiceSlug, type RegionalCategory } from '@/lib/regionRoutes';

export default function RegionalNavigation({ country, current }: { country: CountryRoute; current?: RegionalCategory | PublicServiceSlug }) {
  return (
    <nav aria-label={`${country.label} 게시판`} className="my-6 flex flex-wrap gap-2 text-sm font-bold">
      <Link href={`/${country.slug}`} aria-current={!current ? 'page' : undefined} className="rounded-lg border border-white/15 px-3 py-2 text-slate-200 hover:bg-white/10">{country.label} 전체</Link>
      {PUBLIC_SERVICE_ROUTES.map((service) => (
        <Link key={service.slug} href={serviceHref(country, service.slug)} aria-current={current === service.slug || Boolean(service.category && current === service.category) ? 'page' : undefined} className={`rounded-lg border px-3 py-2 ${current === service.slug || Boolean(service.category && current === service.category) ? 'border-teal-300/40 bg-teal-300/10 text-teal-200' : 'border-white/15 text-slate-200 hover:bg-white/10'}`}>
          {service.label}
        </Link>
      ))}
    </nav>
  );
}
