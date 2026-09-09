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
  regions?: RegionId[];
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
  { id: 'kba-europe-jobs', region: 'Global', regions: ['Germany', 'Netherlands', 'Hungary', 'Spain', 'Portugal', 'Romania', 'Malta'], name: 'KBA Europe · EU Job Search', url: 'https://kba-europe.com/member/eu-job-search/', kind: 'business', categories: ['jobs'], trust: 'official', autoImport: true, note: '유럽한국기업연합회가 확인·게시하는 유럽 현지 채용 공고', crawlPaths: [{ category: 'jobs', label: 'EU 구인구직', path: '/member/eu-job-search/' }] },
  { id: 'brazil-korea', region: 'Brazil', name: 'BrazilKorea', url: 'https://brazilkorea.com.br/', kind: 'news', categories: ['news', 'events'], trust: 'verified', autoImport: false, note: '브라질·한국 관계 및 현지 한국 문화 뉴스' },
  { id: 'hanin-argentina', region: 'Argentina', name: '재아르헨티나 한인회 · Hanin', url: 'https://hanin.org.ar/', kind: 'association', categories: ['news', 'jobs', 'community', 'events'], trust: 'official', autoImport: true, note: '재아르헨티나 한인회 공식 안내와 교민 소식', crawlPaths: [{ category: 'news', label: '한인회 소식', path: '/' }, { category: 'community', label: '교민 소식', path: '/?page_id=70' }] },
  { id: 'chile-hanin', region: 'Chile', name: '칠레 한인회', url: 'https://chilehanin.cl/', kind: 'association', categories: ['news', 'jobs', 'community', 'directory'], trust: 'official', autoImport: true, note: '칠레 한인회 공지·한인신문·업소·생활 게시판', crawlPaths: [{ category: 'news', label: '한인회 소식', path: '/' }, { category: 'community', label: '한인 소식', path: '/' }, { category: 'directory', label: '한인 업소', path: '/' }] },
  { id: 'paraguay-korean-association', region: 'Paraguay', name: '재파라과이 한인회', url: 'https://www.asocoreapy.org.py/', kind: 'association', categories: ['news', 'jobs', 'community', 'events'], trust: 'official', autoImport: true, note: '재파라과이 한인회 공식 행사·공지·교민 소식', crawlPaths: [{ category: 'news', label: '한인회 소식', path: '/' }, { category: 'community', label: '교민 소식', path: '/' }] },
  { id: 'panama-korean-association', region: 'Panama', name: '파나마 한인회', url: 'https://sites.google.com/view/koreanpanama', kind: 'association', categories: ['news', 'jobs', 'community', 'directory'], trust: 'verified', autoImport: true, note: '파나마 한인회 공지·월간 소식지·한인 업체 안내' },
  { id: 'spainagain-koreans', region: 'Spain', name: 'Spain Again · 스페인 어게인', url: 'https://spainagain.net/koreans-in-spain/', kind: 'news', categories: ['news', 'community', 'directory', 'events'], trust: 'verified', autoImport: false, note: '스페인 한인 뉴스·생활 정보·커뮤니티 출처', crawlPaths: [{ category: 'news', label: '스페인 한인 뉴스', path: '/koreans-in-spain/' }] },
  { id: 'gutentag-korea', region: 'Germany', name: 'Gutentag Korea', url: 'https://gutentagkorea.com/', kind: 'news', categories: ['news', 'community', 'directory', 'jobs', 'events'], trust: 'verified', autoImport: false, note: '독일 한인 뉴스·구인구직·업소록·생활·행사 정보 출처' },
  { id: 'naver-news', region: 'Global', name: '네이버 뉴스', url: 'https://news.naver.com/', kind: 'news', categories: ['news'], trust: 'verified', autoImport: false, note: '정치·경제·사회·세계·연예·생활 분야 최신 공개 뉴스', crawlPaths: [{ category: 'news', label: '정치', path: '/section/100' }, { category: 'news', label: '사회', path: '/section/102' }, { category: 'news', label: '생활·여행', path: '/section/103' }, { category: 'news', label: '세계', path: '/section/104' }, { category: 'news', label: '연예', path: '/section/106' }] },
  { id: 'uruguay-korean-embassy', region: 'Global', regions: ['Uruguay'], name: '주우루과이 대한민국 대사관', url: 'https://ury.mofa.go.kr/', kind: 'government', categories: ['news', 'events', 'jobs'], trust: 'official', autoImport: true, note: '우루과이 공관 공지·영사·동포 행사 정보' },
