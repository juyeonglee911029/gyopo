export type CityLocation = {
  slug: string;
  label: string;
  english: string;
};

export type CountryLocation = {
  id: string;
  slug: string;
  label: string;
  english: string;
  flag: string;
  group: 'asia' | 'americas' | 'europe' | 'oceania';
  cities: readonly CityLocation[];
};

export const COUNTRY_LOCATIONS: readonly CountryLocation[] = [
  { id: 'SouthKorea', slug: 'korea', label: '한국', english: 'South Korea', flag: '🇰🇷', group: 'asia', cities: [
    { slug: 'seoul', label: '서울', english: 'Seoul' }, { slug: 'busan', label: '부산', english: 'Busan' }, { slug: 'incheon', label: '인천', english: 'Incheon' }, { slug: 'daejeon', label: '대전', english: 'Daejeon' },
  ] },
  { id: 'USA', slug: 'usa', label: '미국', english: 'United States', flag: '🇺🇸', group: 'americas', cities: [
    { slug: 'los-angeles', label: '로스앤젤레스', english: 'Los Angeles' }, { slug: 'new-york', label: '뉴욕', english: 'New York' }, { slug: 'chicago', label: '시카고', english: 'Chicago' }, { slug: 'atlanta', label: '애틀랜타', english: 'Atlanta' }, { slug: 'san-francisco', label: '샌프란시스코', english: 'San Francisco' }, { slug: 'seattle', label: '시애틀', english: 'Seattle' },
  ] },
  { id: 'Canada', slug: 'canada', label: '캐나다', english: 'Canada', flag: '🇨🇦', group: 'americas', cities: [
    { slug: 'toronto', label: '토론토', english: 'Toronto' }, { slug: 'vancouver', label: '밴쿠버', english: 'Vancouver' }, { slug: 'montreal', label: '몬트리올', english: 'Montreal' }, { slug: 'calgary', label: '캘거리', english: 'Calgary' },
  ] },
  { id: 'Australia', slug: 'australia', label: '호주', english: 'Australia', flag: '🇦🇺', group: 'oceania', cities: [
    { slug: 'sydney', label: '시드니', english: 'Sydney' }, { slug: 'melbourne', label: '멜버른', english: 'Melbourne' }, { slug: 'brisbane', label: '브리즈번', english: 'Brisbane' }, { slug: 'perth', label: '퍼스', english: 'Perth' },
  ] },
  { id: 'Japan', slug: 'japan', label: '일본', english: 'Japan', flag: '🇯🇵', group: 'asia', cities: [
    { slug: 'tokyo', label: '도쿄', english: 'Tokyo' }, { slug: 'osaka', label: '오사카', english: 'Osaka' }, { slug: 'kyoto', label: '교토', english: 'Kyoto' }, { slug: 'fukuoka', label: '후쿠오카', english: 'Fukuoka' },
  ] },
  { id: 'China', slug: 'china', label: '중국', english: 'China', flag: '🇨🇳', group: 'asia', cities: [
    { slug: 'beijing', label: '베이징', english: 'Beijing' }, { slug: 'shanghai', label: '상하이', english: 'Shanghai' }, { slug: 'guangzhou', label: '광저우', english: 'Guangzhou' }, { slug: 'qingdao', label: '칭다오', english: 'Qingdao' },
  ] },
  { id: 'NewZealand', slug: 'new-zealand', label: '뉴질랜드', english: 'New Zealand', flag: '🇳🇿', group: 'oceania', cities: [
    { slug: 'auckland', label: '오클랜드', english: 'Auckland' }, { slug: 'wellington', label: '웰링턴', english: 'Wellington' }, { slug: 'christchurch', label: '크라이스트처치', english: 'Christchurch' },
  ] },
  { id: 'Singapore', slug: 'singapore', label: '싱가포르', english: 'Singapore', flag: '🇸🇬', group: 'asia', cities: [
    { slug: 'central', label: '센트럴', english: 'Central' }, { slug: 'jurong', label: '주롱', english: 'Jurong' }, { slug: 'tampines', label: '탐피네스', english: 'Tampines' },
  ] },
  { id: 'UnitedKingdom', slug: 'uk', label: '영국', english: 'United Kingdom', flag: '🇬🇧', group: 'europe', cities: [
    { slug: 'london', label: '런던', english: 'London' }, { slug: 'manchester', label: '맨체스터', english: 'Manchester' }, { slug: 'birmingham', label: '버밍엄', english: 'Birmingham' }, { slug: 'edinburgh', label: '에든버러', english: 'Edinburgh' },
  ] },
  { id: 'Germany', slug: 'germany', label: '독일', english: 'Germany', flag: '🇩🇪', group: 'europe', cities: [
    { slug: 'berlin', label: '베를린', english: 'Berlin' }, { slug: 'frankfurt', label: '프랑크푸르트', english: 'Frankfurt' }, { slug: 'munich', label: '뮌헨', english: 'Munich' }, { slug: 'hamburg', label: '함부르크', english: 'Hamburg' },
  ] },
  { id: 'France', slug: 'france', label: '프랑스', english: 'France', flag: '🇫🇷', group: 'europe', cities: [
    { slug: 'paris', label: '파리', english: 'Paris' }, { slug: 'lyon', label: '리옹', english: 'Lyon' }, { slug: 'marseille', label: '마르세유', english: 'Marseille' },
  ] },
  { id: 'Italy', slug: 'italy', label: '이탈리아', english: 'Italy', flag: '🇮🇹', group: 'europe', cities: [
    { slug: 'rome', label: '로마', english: 'Rome' }, { slug: 'milan', label: '밀라노', english: 'Milan' }, { slug: 'florence', label: '피렌체', english: 'Florence' },
  ] },
  { id: 'Spain', slug: 'spain', label: '스페인', english: 'Spain', flag: '🇪🇸', group: 'europe', cities: [
    { slug: 'madrid', label: '마드리드', english: 'Madrid' }, { slug: 'barcelona', label: '바르셀로나', english: 'Barcelona' }, { slug: 'valencia', label: '발렌시아', english: 'Valencia' },
  ] },
  { id: 'Portugal', slug: 'portugal', label: '포르투갈', english: 'Portugal', flag: '🇵🇹', group: 'europe', cities: [
    { slug: 'lisbon', label: '리스본', english: 'Lisbon' }, { slug: 'porto', label: '포르투', english: 'Porto' }, { slug: 'faro', label: '파루', english: 'Faro' },
  ] },
  { id: 'Netherlands', slug: 'netherlands', label: '네덜란드', english: 'Netherlands', flag: '🇳🇱', group: 'europe', cities: [
    { slug: 'amsterdam', label: '암스테르담', english: 'Amsterdam' }, { slug: 'rotterdam', label: '로테르담', english: 'Rotterdam' }, { slug: 'the-hague', label: '헤이그', english: 'The Hague' },
  ] },
  { id: 'Romania', slug: 'romania', label: '루마니아', english: 'Romania', flag: '🇷🇴', group: 'europe', cities: [{ slug: 'bucharest', label: '부쿠레슈티', english: 'Bucharest' }] },
  { id: 'Hungary', slug: 'hungary', label: '헝가리', english: 'Hungary', flag: '🇭🇺', group: 'europe', cities: [{ slug: 'budapest', label: '부다페스트', english: 'Budapest' }] },
  { id: 'Malta', slug: 'malta', label: '몰타', english: 'Malta', flag: '🇲🇹', group: 'europe', cities: [{ slug: 'valletta', label: '발레타', english: 'Valletta' }] },
  { id: 'Brazil', slug: 'brazil', label: '브라질', english: 'Brazil', flag: '🇧🇷', group: 'americas', cities: [
    { slug: 'sao-paulo', label: '상파울루', english: 'Sao Paulo' }, { slug: 'rio-de-janeiro', label: '리우데자네이루', english: 'Rio de Janeiro' }, { slug: 'curitiba', label: '쿠리치바', english: 'Curitiba' }, { slug: 'brasilia', label: '브라질리아', english: 'Brasilia' },
  ] },
  { id: 'Argentina', slug: 'argentina', label: '아르헨티나', english: 'Argentina', flag: '🇦🇷', group: 'americas', cities: [{ slug: 'buenos-aires', label: '부에노스아이레스', english: 'Buenos Aires' }, { slug: 'cordoba', label: '코르도바', english: 'Cordoba' }] },
  { id: 'Chile', slug: 'chile', label: '칠레', english: 'Chile', flag: '🇨🇱', group: 'americas', cities: [{ slug: 'santiago', label: '산티아고', english: 'Santiago' }, { slug: 'vina-del-mar', label: '비냐델마르', english: 'Vina del Mar' }] },
  { id: 'Colombia', slug: 'colombia', label: '콜롬비아', english: 'Colombia', flag: '🇨🇴', group: 'americas', cities: [{ slug: 'bogota', label: '보고타', english: 'Bogota' }, { slug: 'medellin', label: '메데인', english: 'Medellin' }] },
  { id: 'Bolivia', slug: 'bolivia', label: '볼리비아', english: 'Bolivia', flag: '🇧🇴', group: 'americas', cities: [{ slug: 'la-paz', label: '라파스', english: 'La Paz' }, { slug: 'santa-cruz', label: '산타크루즈', english: 'Santa Cruz' }] },
  { id: 'Paraguay', slug: 'paraguay', label: '파라과이', english: 'Paraguay', flag: '🇵🇾', group: 'americas', cities: [{ slug: 'asuncion', label: '아순시온', english: 'Asuncion' }] },
  { id: 'Uruguay', slug: 'uruguay', label: '우루과이', english: 'Uruguay', flag: '🇺🇾', group: 'americas', cities: [{ slug: 'montevideo', label: '몬테비데오', english: 'Montevideo' }] },
  { id: 'Panama', slug: 'panama', label: '파나마', english: 'Panama', flag: '🇵🇦', group: 'americas', cities: [{ slug: 'panama-city', label: '파나마시티', english: 'Panama City' }] },
  { id: 'Mexico', slug: 'mexico', label: '멕시코', english: 'Mexico', flag: '🇲🇽', group: 'americas', cities: [{ slug: 'mexico-city', label: '멕시코시티', english: 'Mexico City' }, { slug: 'monterrey', label: '몬테레이', english: 'Monterrey' }] },
  { id: 'Thailand', slug: 'thailand', label: '태국', english: 'Thailand', flag: '🇹🇭', group: 'asia', cities: [{ slug: 'bangkok', label: '방콕', english: 'Bangkok' }, { slug: 'chiang-mai', label: '치앙마이', english: 'Chiang Mai' }, { slug: 'pattaya', label: '파타야', english: 'Pattaya' }] },
  { id: 'Vietnam', slug: 'vietnam', label: '베트남', english: 'Vietnam', flag: '🇻🇳', group: 'asia', cities: [{ slug: 'ho-chi-minh', label: '호찌민', english: 'Ho Chi Minh City' }, { slug: 'hanoi', label: '하노이', english: 'Hanoi' }, { slug: 'da-nang', label: '다낭', english: 'Da Nang' }] },
  { id: 'Philippines', slug: 'philippines', label: '필리핀', english: 'Philippines', flag: '🇵🇭', group: 'asia', cities: [{ slug: 'manila', label: '마닐라', english: 'Manila' }, { slug: 'cebu', label: '세부', english: 'Cebu' }, { slug: 'davao', label: '다바오', english: 'Davao' }] },
] as const;

export const LOCATION_GROUPS = [
  { id: 'asia', label: '아시아', english: 'Asia' },
  { id: 'americas', label: '미주', english: 'Americas' },
  { id: 'europe', label: '유럽', english: 'Europe' },
  { id: 'oceania', label: '오세아니아', english: 'Oceania' },
] as const;
