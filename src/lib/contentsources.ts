import type { RegionId } from '@/lib/regions';

export type ContentCategory = 'news' | 'directory' | 'jobs' | 'market' | 'events' | 'community';
export type SourceTrust = 'official' | 'verified' | 'review';

export type ContentSource = {
  id: string;
  region: RegionId;
  name: string;
  url: string;
  kind: 'government' | 'association' | 'news' | 'business';
  categories: ContentCategory[];
  trust: SourceTrust;
  autoImport: boolean;
  note: string;
  crawlPaths?: Array<{ category: ContentCategory; label: string; path: string }>;
};

// Only sources with a public, human-readable origin are listed here.
// A source is never auto-published until its feed/parser has been reviewed.
export const CONTENT_SOURCES: ContentSource[] = [
  { id: 'korea-net', region: 'Global', name: 'Korea.net · KOCIS', url: 'https://www.korea.net/', kind: 'government', categories: ['news', 'events'], trust: 'official', autoImport: false, note: '대한민국 문화체육관광부 해외홍보 포털' },
  { id: 'korea-herald', region: 'Global', name: 'The Korea Herald', url: 'https://www.koreaherald.com/', kind: 'news', categories: ['news'], trust: 'verified', autoImport: false, note: '영문 한국 뉴스 매체' },
  { id: 'kafla', region: 'USA-LA', name: 'Korean American Federation of Los Angeles', url: 'https://kafla.info/', kind: 'association', categories: ['news', 'directory', 'events'], trust: 'official', autoImport: false, note: 'LA 한인회 공식 사이트' },
  { id: 'la-kacc', region: 'USA-LA', name: 'Korean American Chamber of Commerce of Los Angeles', url: 'https://lakacc.com/', kind: 'business', categories: ['directory', 'jobs', 'events'], trust: 'official', autoImport: false, note: 'LA 한미상공회의소 공식 사이트' },
  { id: 'kiwa', region: 'USA-LA', name: 'Koreatown Immigrant Workers Alliance', url: 'https://kiwa.org/', kind: 'association', categories: ['news', 'jobs', 'events'], trust: 'official', autoImport: false, note: 'LA 코리아타운 이민자·노동자 지원 단체' },
  { id: 'kccla', region: 'USA-LA', name: 'Korean Cultural Center Los Angeles', url: 'https://kccla.org/', kind: 'government', categories: ['news', 'events'], trust: 'official', autoImport: false, note: 'LA 한국문화원·총영사관 문화행사 정보' },
  { id: 'kapn', region: 'USA', name: 'Korean American Professional Network', url: 'https://kapn.org/', kind: 'association', categories: ['jobs', 'events'], trust: 'verified', autoImport: false, note: '미국 한인 전문인 네트워크' },
  { id: 'brazil-korea', region: 'Brazil', name: 'BrazilKorea', url: 'https://brazilkorea.com.br/', kind: 'news', categories: ['news', 'events'], trust: 'verified', autoImport: false, note: '브라질·한국 관계 및 현지 한국 문화 뉴스' },
  {
    id: 'hanintoday-brazil',
    region: 'Brazil',
    name: '한인투데이 · HANIN TODAY',
    url: 'https://hanintoday.com.br/',
    kind: 'news',
    categories: ['news', 'jobs', 'directory', 'market', 'events', 'community'],
    trust: 'official',
    autoImport: true,
    note: '브라질 한인 뉴스·구인구직·업소·공동구매·장터·한인광장 통합 사이트',
    crawlPaths: [
      { category: 'news', label: '한인뉴스', path: '/news' },
      { category: 'jobs', label: '구인구직', path: '/jobs' },
      { category: 'directory', label: '업소', path: '/businesses' },
      { category: 'events', label: '공동구매', path: '/group-buying' },
      { category: 'market', label: '중고장터', path: '/market' },
      { category: 'community', label: '한인광장', path: '/community' },
    ],
  },
  { id: 'kccbrazil', region: 'Brazil', name: 'Centro Cultural Coreano no Brasil', url: 'https://brazil.korean-culture.org/', kind: 'government', categories: ['news', 'events'], trust: 'official', autoImport: false, note: '주브라질한국문화원 공식 사이트' },
  { id: 'miargentina', region: 'Argentina', name: 'MIArgentina', url: 'https://miargentina.us/', kind: 'association', categories: ['news', 'events'], trust: 'verified', autoImport: false, note: '아르헨티나 생활·커뮤니티 정보' },
  { id: 'spain-embassy', region: 'Spain', name: '주스페인 대한민국 대사관', url: 'https://overseas.mofa.go.kr/es-ko/index.do', kind: 'government', categories: ['news', 'events'], trust: 'official', autoImport: false, note: '공관 공지·영사·재외국민 정보' },
  { id: 'adece', region: 'Spain', name: 'ADECCE', url: 'https://adecce.blogspot.com/', kind: 'association', categories: ['news', 'events'], trust: 'verified', autoImport: false, note: '스페인 한국학·문화 교류 단체' },
  { id: 'nlkrg', region: 'Netherlands', name: 'Netherlands Korean Rights Group', url: 'https://nlkrg.nl/', kind: 'association', categories: ['news', 'events'], trust: 'verified', autoImport: false, note: '네덜란드 입양 한인 권리 단체' },
  { id: 'ksan', region: 'Netherlands', name: 'Korean Students Association in the Netherlands', url: 'https://linktr.ee/ksan_marketing', kind: 'association', categories: ['jobs', 'events'], trust: 'verified', autoImport: false, note: '네덜란드 한인 학생 커뮤니티' },
  { id: 'dkw', region: 'Germany', name: 'Deutsch-Koreanischer Wirtschaftskreis', url: 'https://korea-dkw.de/', kind: 'business', categories: ['directory', 'jobs', 'events'], trust: 'verified', autoImport: false, note: '독일·한국 경제 교류 단체' },
  { id: 'dekrforum', region: 'Germany', name: 'Deutsch-Koreanisches Forum', url: 'https://dekrforum.de/', kind: 'association', categories: ['news', 'events'], trust: 'verified', autoImport: false, note: '독일·한국 정치·경제·문화 교류 포럼' },
  { id: 'kocham-vietnam', region: 'Vietnam', name: 'KOCHAM Vietnam', url: 'https://kocham.kr/', kind: 'business', categories: ['directory', 'jobs', 'events'], trust: 'official', autoImport: false, note: '베트남 한인상공인 정보' },
];

export const REVIEW_REGIONS: RegionId[] = ['Chile', 'Colombia', 'Bolivia', 'Paraguay', 'Panama', 'Mexico', 'Portugal', 'Romania', 'Hungary', 'Malta', 'Thailand'];

export function sourceItemId(sourceId: string, category: string, url: string) {
  let hash = 0;
  for (const character of `${sourceId}:${category}:${url}`) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return `source-${sourceId}-${category}-${hash.toString(36)}`;
}

export function sourcesForRegion(region: string) {
  return CONTENT_SOURCES.filter((source) => source.region === 'Global' || source.region === region);
}
