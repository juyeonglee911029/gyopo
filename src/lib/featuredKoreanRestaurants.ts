export type FeaturedRestaurant = {
  id: string;
  name: string;
  city: string;
  country: string;
  category: string;
  description: string;
  mapUrl: string;
};

type RestaurantGroup = { name: string; country: string; cities: string[]; category?: string };

const groups: RestaurantGroup[] = [
  { name: 'Gangnam Place', country: 'Panama', cities: ['Panama City'], category: '음식점·카페' },
  { name: 'Soban Korean', country: 'Panama', cities: ['Panama City'], category: '음식점·카페' },
  { name: 'Busan Korea', country: 'Panama', cities: ['Panama City'], category: '음식점·카페' },
  { name: 'Maru Korean', country: 'Panama', cities: ['Panama City'], category: '음식점·카페' },
  { name: 'Oriental Garden', country: 'Panama', cities: ['Panama City'], category: '음식점·카페' },
  { name: 'Chinnichinnipty Korean Restaurant', country: 'Panama', cities: ['Panama City'], category: '음식점·카페' },
  { name: 'Kokio Korean Cuisine', country: 'Panama', cities: ['Panama City'], category: '음식점·카페' },
  { name: 'Surakan Restaurante Coreano', country: 'Panama', cities: ['Panama City'], category: '음식점·카페' },
  { name: 'Bonchon Korean Fried Chicken', country: 'USA', cities: ['New York', 'Los Angeles', 'Chicago', 'Boston', 'Philadelphia', 'Seattle', 'San Francisco', 'San Jose', 'Irvine', 'Buena Park', 'Dallas', 'Houston', 'Atlanta', 'Fairfax', 'Annandale', 'Orlando', 'Tampa', 'Miami', 'Denver', 'Austin', 'Portland', 'Las Vegas', 'Honolulu', 'Charlotte'], category: '음식점·카페' },
  { name: 'bb.q Chicken', country: 'USA', cities: ['New York', 'Los Angeles', 'Chicago', 'Boston', 'Philadelphia', 'Seattle', 'San Francisco', 'San Jose', 'Irvine', 'Buena Park', 'Dallas', 'Houston', 'Atlanta', 'Fairfax', 'Centreville', 'Orlando', 'Tampa', 'Miami', 'Denver', 'Austin', 'Las Vegas', 'Honolulu'], category: '음식점·카페' },
  { name: 'Gen Korean BBQ House', country: 'USA', cities: ['Los Angeles', 'Irvine', 'Buena Park', 'Torrance', 'Cerritos', 'Santa Ana', 'San Diego', 'San Jose', 'Fremont', 'Las Vegas', 'Phoenix', 'Tempe', 'Dallas', 'Houston', 'Austin', 'Denver', 'Honolulu', 'Seattle', 'Chicago', 'New York', 'Atlanta', 'Orlando', 'Miami', 'Philadelphia'], category: '음식점·카페' },
  { name: 'BCD Tofu House', country: 'USA', cities: ['Los Angeles', 'Koreatown LA', 'Irvine', 'Buena Park', 'Cerritos', 'Torrance', 'San Diego', 'San Jose', 'Fremont', 'New York', 'Fort Lee', 'Palisades Park', 'Chicago', 'Atlanta', 'Dallas', 'Houston', 'Seattle', 'Las Vegas'], category: '음식점·카페' },
  { name: 'Kang Ho-Dong Baekjeong', country: 'USA', cities: ['Los Angeles', 'New York', 'Chicago', 'Buena Park', 'Las Vegas', 'San Jose', 'Atlanta', 'Honolulu'], category: '음식점·카페' },
  { name: 'Honey Pig Korean BBQ', country: 'USA', cities: ['Annandale', 'Fairfax', 'Centreville', 'Gainesville', 'Rockville', 'Ellicott City', 'Baltimore', 'Philadelphia'], category: '음식점·카페' },
  { name: 'Kaju Soft Tofu', country: 'USA', cities: ['Los Angeles', 'Koreatown LA', 'Irvine', 'Buena Park', 'Cerritos', 'Torrance', 'San Diego', 'San Jose', 'New York', 'Fort Lee', 'Chicago', 'Atlanta'], category: '음식점·카페' },
  { name: 'Daeho Kalbijjim & Beef Soup', country: 'USA', cities: ['San Francisco', 'San Jose', 'New York', 'Los Angeles'], category: '음식점·카페' },
  { name: 'Cote Korean Steakhouse', country: 'USA', cities: ['New York', 'Miami', 'Los Angeles', 'Las Vegas'], category: '음식점·카페' },
  { name: 'Sun Nong Dan', country: 'USA', cities: ['Los Angeles', 'Buena Park', 'Irvine', 'Rowland Heights'], category: '음식점·카페' },
  { name: "Park's BBQ", country: 'USA', cities: ['Los Angeles', 'Irvine', 'Las Vegas'], category: '음식점·카페' },
  { name: 'Jongro BBQ', country: 'USA', cities: ['New York', 'Los Angeles', 'Chicago', 'Atlanta'], category: '음식점·카페' },
  { name: 'Cho Dang Gol', country: 'USA', cities: ['New York'], category: '음식점·카페' },
  { name: 'Hangawi', country: 'USA', cities: ['New York'], category: '음식점·카페' },
  { name: 'Atoboy', country: 'USA', cities: ['New York'], category: '음식점·카페' },
  { name: 'Jua', country: 'USA', cities: ['New York'], category: '음식점·카페' },
  { name: 'Anju', country: 'USA', cities: ['Washington DC'], category: '음식점·카페' },
  { name: 'Mandu', country: 'USA', cities: ['Washington DC'], category: '음식점·카페' },
  { name: 'Mott St', country: 'USA', cities: ['Chicago'], category: '음식점·카페' },
  { name: 'San Soo Gab San', country: 'USA', cities: ['Chicago'], category: '음식점·카페' },
  { name: 'Parachute', country: 'USA', cities: ['Chicago'], category: '음식점·카페' },
  { name: 'Heirloom Market BBQ', country: 'USA', cities: ['Atlanta'], category: '음식점·카페' },
  { name: 'Han Il Kwan', country: 'USA', cities: ['Atlanta'], category: '음식점·카페' },
  { name: 'Jang Su Jang', country: 'USA', cities: ['Atlanta', 'Duluth'], category: '음식점·카페' },
  { name: 'Bori Korean Cuisine', country: 'USA', cities: ['Houston'], category: '음식점·카페' },
  { name: 'Korea Garden', country: 'USA', cities: ['Houston'], category: '음식점·카페' },
  { name: 'Mapojeong Galbi', country: 'USA', cities: ['Houston'], category: '음식점·카페' },
  { name: 'Jang Guem Tofu & BBQ', country: 'USA', cities: ['Houston'], category: '음식점·카페' },
  { name: 'Joule', country: 'USA', cities: ['Seattle'], category: '음식점·카페' },
  { name: 'Daeho Kalbijjim', country: 'USA', cities: ['San Francisco'], category: '음식점·카페' },
  { name: 'Toyose', country: 'USA', cities: ['San Francisco'], category: '음식점·카페' },
  { name: 'Surisan', country: 'USA', cities: ['San Francisco'], category: '음식점·카페' },
  { name: 'Mo Ran Gak', country: 'USA', cities: ['Garden Grove'], category: '음식점·카페' },
  { name: "Friend's House Korean Restaurant", country: 'USA', cities: ['San Diego'], category: '음식점·카페' },
  { name: 'Dae Jang Keum', country: 'USA', cities: ['San Diego'], category: '음식점·카페' },
  { name: 'Hobak Korean BBQ', country: 'USA', cities: ['Las Vegas'], category: '음식점·카페' },
  { name: 'Best Friend', country: 'USA', cities: ['Las Vegas'], category: '음식점·카페' },
  { name: '8oz Korean Steak House', country: 'USA', cities: ['Las Vegas'], category: '음식점·카페' },
];

export const FEATURED_KOREAN_RESTAURANTS: FeaturedRestaurant[] = groups.flatMap((group) => group.cities.map((city) => {
  const id = `${group.country.toLowerCase()}-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return {
    id: `featured-${id}`,
    name: group.name,
    city,
    country: group.country,
    category: group.category || '음식점·카페',
    description: 'GYOPO 추천 한식당 · 방문 전 영업시간과 지점을 확인하세요.',
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${group.name} ${city} ${group.country}`)}`,
  };
}));
