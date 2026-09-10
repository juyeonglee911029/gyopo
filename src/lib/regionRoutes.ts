import { REGIONS, type RegionId } from './regions';

export const REGIONAL_CATEGORIES = [
  { slug: 'jobs', label: '구인구직', description: '현지 채용 공고와 구직 정보' },
  { slug: 'community', label: '커뮤니티', description: '교민이 나누는 생활 질문과 이야기' },
  { slug: 'housing', label: '주거', description: '집 구하기, 임대와 룸메이트 게시글' },
  { slug: 'news', label: '뉴스', description: '지역 소식과 교민 뉴스' },
  { slug: 'directory', label: '업소록', description: '한인 업체와 지역 서비스 소개' },
  { slug: 'market', label: '장터', description: '교민들의 중고 물품과 거래 정보' },
] as const;

export type RegionalCategory = (typeof REGIONAL_CATEGORIES)[number]['slug'];
export type CountryRoute = {
  slug: string;
  id: RegionId;
  label: string;
  flag: string;
  regionIds: readonly RegionId[];
  aliases: readonly string[];
};

export const COUNTRY_ROUTES: readonly CountryRoute[] = REGIONS
  .filter((region) => region.id !== 'Global' && region.id !== 'USA-LA')
  .map((region) => {
    const slug = region.id === 'USA' ? 'us' : region.id === 'SouthKorea' ? 'korea' : region.id.toLowerCase();
    const members = REGIONS.filter((item) => item.id === region.id || (region.id === 'USA' && item.id === 'USA-LA'));
    const aliases = members.flatMap((item) => [item.id, item.id.toLowerCase(), item.label, item.short]);
    return {
      slug,
      id: region.id,
      label: region.short,
      flag: region.flag,
      regionIds: members.map((item) => item.id),
      aliases: [...new Set([...aliases, slug])],
    };
  });

export function getCountryRoute(slug: string): CountryRoute | undefined {
  return COUNTRY_ROUTES.find((country) => country.slug === slug);
}

export function getRegionalCategory(slug: string) {
  return REGIONAL_CATEGORIES.find((category) => category.slug === slug);
}

export function countryForRegion(region: string): CountryRoute | undefined {
  const value = region.trim().toLowerCase();
  return COUNTRY_ROUTES.find((country) => country.aliases.some((alias) => alias.toLowerCase() === value));
}

export function countryMatchesRegion(country: CountryRoute, region: string): boolean {
  return countryForRegion(region)?.slug === country.slug;
}

export function countryHref(region: string, category?: RegionalCategory): string {
  const country = countryForRegion(region);
  if (!country) return category ? `/${category === 'housing' ? 'community' : category}` : '/';
  return `/${country.slug}${category ? `/${category}` : ''}`;
}

export function isRegionalPostId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,200}$/.test(id);
}

export function regionalPostHref(country: CountryRoute, category: RegionalCategory, id: string): string {
  if (!isRegionalPostId(id)) throw new Error('Invalid regional post ID');
  return `/${country.slug}/${category}/${encodeURIComponent(id)}`;
}
