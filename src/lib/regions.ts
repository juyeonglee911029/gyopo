export const REGIONS = [
  { id: 'Global', label: '전체 지역', short: '전체', flag: '🌐' },
  { id: 'USA', label: '미국 전체', short: '미국', flag: '🇺🇸' },
  { id: 'USA-LA', label: '미국 · 로스앤젤레스', short: 'LA', flag: '🇺🇸' },
  { id: 'Brazil', label: '브라질', short: '브라질', flag: '🇧🇷' },
  { id: 'Argentina', label: '아르헨티나', short: '아르헨티나', flag: '🇦🇷' },
  { id: 'Chile', label: '칠레', short: '칠레', flag: '🇨🇱' },
  { id: 'Colombia', label: '콜롬비아', short: '콜롬비아', flag: '🇨🇴' },
  { id: 'Bolivia', label: '볼리비아', short: '볼리비아', flag: '🇧🇴' },
  { id: 'Paraguay', label: '파라과이', short: '파라과이', flag: '🇵🇾' },
  { id: 'Panama', label: '파나마', short: '파나마', flag: '🇵🇦' },
  { id: 'Mexico', label: '멕시코', short: '멕시코', flag: '🇲🇽' },
  { id: 'Portugal', label: '포르투갈', short: '포르투갈', flag: '🇵🇹' },
  { id: 'Spain', label: '스페인', short: '스페인', flag: '🇪🇸' },
  { id: 'Netherlands', label: '네덜란드', short: '네덜란드', flag: '🇳🇱' },
  { id: 'Germany', label: '독일', short: '독일', flag: '🇩🇪' },
  { id: 'Romania', label: '루마니아', short: '루마니아', flag: '🇷🇴' },
  { id: 'Hungary', label: '헝가리', short: '헝가리', flag: '🇭🇺' },
  { id: 'Malta', label: '몰타', short: '몰타', flag: '🇲🇹' },
  { id: 'Thailand', label: '태국', short: '태국', flag: '🇹🇭' },
  { id: 'Vietnam', label: '베트남', short: '베트남', flag: '🇻🇳' },
] as const;

export type RegionId = (typeof REGIONS)[number]['id'];

export const REGION_TIME_ZONES: Record<RegionId, string> = {
  Global: 'UTC',
  USA: 'America/New_York',
  'USA-LA': 'America/Los_Angeles',
  Brazil: 'America/Sao_Paulo',
  Argentina: 'America/Argentina/Buenos_Aires',
  Chile: 'America/Santiago',
  Colombia: 'America/Bogota',
  Bolivia: 'America/La_Paz',
  Paraguay: 'America/Asuncion',
  Panama: 'America/Panama',
  Mexico: 'America/Mexico_City',
  Portugal: 'Europe/Lisbon',
  Spain: 'Europe/Madrid',
  Netherlands: 'Europe/Amsterdam',
  Germany: 'Europe/Berlin',
  Romania: 'Europe/Bucharest',
  Hungary: 'Europe/Budapest',
  Malta: 'Europe/Malta',
  Thailand: 'Asia/Bangkok',
  Vietnam: 'Asia/Ho_Chi_Minh',
};

export function regionLabel(id: string) {
  return REGIONS.find((region) => region.id === id)?.label || id;
}

export function regionTimeZone(id: string) {
  return REGION_TIME_ZONES[id as RegionId] || 'UTC';
}

