import { REGIONS, type RegionId } from './regions';

export const REGIONAL_CATEGORIES = [
  { slug: 'jobs', label: '구인구직', description: '현지 채용 공고와 구직 정보' },
  { slug: 'immigration', label: '이민·비자', description: '비자, 영주권과 정착 정보' },
  { slug: 'community', label: '커뮤니티', description: '교민이 나누는 생활 질문과 이야기' },
  { slug: 'housing', label: '주거', description: '집 구하기, 임대와 룸메이트 게시글' },
  { slug: 'education', label: '교육', description: '학교, 유학과 자녀 교육 정보' },
  { slug: 'cars', label: '자동차', description: '차량 구매, 정비와 보험 정보' },
  { slug: 'tax-finance', label: '세금·금융', description: '현지 세금, 은행과 금융 정보' },
  { slug: 'food', label: '맛집·업소', description: '한식당과 현지 생활 업소 정보' },
  { slug: 'safety', label: '사건·안전', description: '지역 안전 소식과 도움 요청' },
  { slug: 'freeboard', label: '자유게시판', description: '자유롭게 나누는 지역 이야기' },
  { slug: 'news', label: '뉴스', description: '지역 소식과 교민 뉴스' },
  { slug: 'directory', label: '업소록', description: '한인 업체와 지역 서비스 소개' },
  { slug: 'market', label: '장터', description: '교민들의 중고 물품과 거래 정보' },
] as const;

const COUNTRY_LIFE_CATEGORY_ORDER = ['immigration', 'jobs', 'housing', 'education', 'cars', 'tax-finance', 'food', 'safety', 'freeboard'] as const;
export const COUNTRY_LIFE_CATEGORIES = COUNTRY_LIFE_CATEGORY_ORDER.flatMap((slug) => {
  const category = REGIONAL_CATEGORIES.find((item) => item.slug === slug);
  return category ? [category] : [];
});

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
    const slugs: Record<string, string> = {
      SouthKorea: 'korea', USA: 'usa', Canada: 'canada', Australia: 'australia', Japan: 'japan',
      UnitedKingdom: 'uk', NewZealand: 'new-zealand', Singapore: 'singapore', Germany: 'germany',
      France: 'france', Spain: 'spain', Italy: 'italy', UnitedArabEmirates: 'uae',
      Thailand: 'thailand', Vietnam: 'vietnam', Philippines: 'philippines', Indonesia: 'indonesia', India: 'india',
    };
    const slug = slugs[region.id] || region.id.toLowerCase();
    const members = REGIONS.filter((item) => item.id === region.id || (region.id === 'USA' && item.id === 'USA-LA'));
    const aliases = members.flatMap((item) => [item.id, item.id.toLowerCase(), item.label, item.short]);
    if (region.id === 'USA') aliases.push('usa', 'us');
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
  const value = slug.trim().toLowerCase();
  return COUNTRY_ROUTES.find((country) => country.slug === value || country.aliases.some((alias) => alias.toLowerCase() === value));
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
