export type FeaturedRestaurant = {
  id: string;
  name: string;
  city: string;
  country: string;
  category: string;
  description: string;
  address: string;
  rating: number;
  reviews: number;
  image: string;
  images: string[];
  mapUrl: string;
  ratingSource: string;
};

type RestaurantSeed = Omit<FeaturedRestaurant, 'id' | 'category' | 'description' | 'image' | 'images' | 'mapUrl' | 'ratingSource'>;

const foodImages = [
  'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=900&q=82',
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=82',
  'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=900&q=82',
  'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=82',
  'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=82',
];

const restaurants: RestaurantSeed[] = [
  { name: 'Her Name is Han', city: 'New York', country: 'USA', address: '17 E 31st St, New York, NY', rating: 4.5, reviews: 2923 },
  { name: 'KJUN', city: 'New York', country: 'USA', address: '334 Lexington Ave, New York, NY', rating: 4.8, reviews: 2470 },
  { name: 'Cho Dang Gol', city: 'New York', country: 'USA', address: '55 W 35th St, New York, NY', rating: 4.5, reviews: 2030 },
  { name: 'Hangawi', city: 'New York', country: 'USA', address: '12 E 32nd St, New York, NY', rating: 4.5, reviews: 2800 },
  { name: 'Atoboy', city: 'New York', country: 'USA', address: '36 E 31st St, New York, NY', rating: 4.6, reviews: 1944 },
  { name: 'Jua', city: 'New York', country: 'USA', address: '36 E 22nd St, New York, NY', rating: 4.7, reviews: 1050 },
  { name: 'Kochi', city: 'New York', country: 'USA', address: '652 10th Ave, New York, NY', rating: 4.7, reviews: 1460 },
  { name: 'Jeju Noodle Bar', city: 'New York', country: 'USA', address: '679 Greenwich St, New York, NY', rating: 4.6, reviews: 3220 },
  { name: "Park's BBQ", city: 'Los Angeles', country: 'USA', address: '955 S Vermont Ave, Los Angeles, CA', rating: 4.6, reviews: 1440 },
  { name: 'Sun Nong Dan', city: 'Los Angeles', country: 'USA', address: '927 N Broadway, Los Angeles, CA', rating: 4.5, reviews: 2100 },
  { name: 'Kobawoo House', city: 'Los Angeles', country: 'USA', address: '698 S Vermont Ave, Los Angeles, CA', rating: 4.6, reviews: 790 },
  { name: 'Han Bat Sul Lung Tang', city: 'Los Angeles', country: 'USA', address: '4163 W 5th St, Los Angeles, CA', rating: 4.6, reviews: 1520 },
  { name: 'Soban', city: 'Los Angeles', country: 'USA', address: '4001 W Olympic Blvd, Los Angeles, CA', rating: 4.7, reviews: 1100 },
  { name: 'The Corner Place', city: 'Los Angeles', country: 'USA', address: '2819 James M Wood Blvd, Los Angeles, CA', rating: 4.5, reviews: 1800 },
  { name: 'Jinsol Gukbap', city: 'Los Angeles', country: 'USA', address: '4215 W 3rd St, Los Angeles, CA', rating: 4.5, reviews: 800 },
  { name: 'Toyose', city: 'San Francisco', country: 'USA', address: '3814 Noriega St, San Francisco, CA', rating: 4.5, reviews: 1510 },
  { name: 'Surisan', city: 'San Francisco', country: 'USA', address: '505 Beach St, San Francisco, CA', rating: 4.5, reviews: 2900 },
  { name: 'Han Il Kwan', city: 'San Francisco', country: 'USA', address: '1802 Balboa St, San Francisco, CA', rating: 4.5, reviews: 980 },
  { name: 'Aria Korean Street Food', city: 'San Francisco', country: 'USA', address: '1700 Fillmore St, San Francisco, CA', rating: 4.6, reviews: 610 },
  { name: 'Hanuri', city: 'San Francisco', country: 'USA', address: '1628 Geary Blvd, San Francisco, CA', rating: 4.6, reviews: 840 },
  { name: 'Daeho Kalbijjim', city: 'San Francisco', country: 'USA', address: '2172 San Bruno Ave, San Francisco, CA', rating: 4.6, reviews: 3900 },
  { name: 'San Soo Gab San', city: 'Chicago', country: 'USA', address: '5247 N Western Ave, Chicago, IL', rating: 4.5, reviews: 1550 },
  { name: 'Parachute', city: 'Chicago', country: 'USA', address: '3500 N Elston Ave, Chicago, IL', rating: 4.5, reviews: 1100 },
  { name: 'Mott St', city: 'Chicago', country: 'USA', address: '1401 N Ashland Ave, Chicago, IL', rating: 4.6, reviews: 2250 },
  { name: 'Perilla Korean American Fare', city: 'Chicago', country: 'USA', address: '401 N Milwaukee Ave, Chicago, IL', rating: 4.5, reviews: 920 },
  { name: 'Jeong', city: 'Chicago', country: 'USA', address: '1460 W Chicago Ave, Chicago, IL', rating: 4.7, reviews: 530 },
  { name: 'Daebak Korean BBQ', city: 'Chicago', country: 'USA', address: '3939 N Harlem Ave, Chicago, IL', rating: 4.6, reviews: 1050 },
  { name: 'Dahn', city: 'Toronto', country: 'Canada', address: '1049 Bloor St W, Toronto, ON', rating: 4.7, reviews: 1230 },
  { name: 'Mapo Korean BBQ', city: 'Toronto', country: 'Canada', address: '4744 Yonge St, North York, ON', rating: 4.5, reviews: 950 },
  { name: 'Han Ba Tang', city: 'Toronto', country: 'Canada', address: '5165 Yonge St, North York, ON', rating: 4.5, reviews: 1200 },
  { name: 'Sariwon', city: 'Toronto', country: 'Canada', address: '7388 Yonge St, Thornhill, ON', rating: 4.5, reviews: 840 },
  { name: 'Seoul Shakers', city: 'Toronto', country: 'Canada', address: '1241 Bloor St W, Toronto, ON', rating: 4.6, reviews: 720 },
  { name: 'Koba', city: 'London', country: 'UK', address: '11 Rathbone St, London W1T', rating: 4.5, reviews: 1840 },
  { name: 'Yijo', city: 'London', country: 'UK', address: '21 Kingly St, London W1B', rating: 4.6, reviews: 850 },
  { name: 'Assa', city: 'London', country: 'UK', address: '53 St Giles High St, London WC2H', rating: 4.5, reviews: 960 },
  { name: 'Seoul Bakery', city: 'London', country: 'UK', address: '14 Hanway St, London W1T', rating: 4.5, reviews: 1400 },
  { name: 'Dae Yang', city: 'Berlin', country: 'Germany', address: 'Potsdamer Str. 102, Berlin', rating: 4.5, reviews: 1600 },
  { name: 'Core', city: 'Berlin', country: 'Germany', address: 'Kantstr. 30, Berlin', rating: 4.6, reviews: 720 },
  { name: 'Seoulkitchen', city: 'Berlin', country: 'Germany', address: 'Gormannstr. 31, Berlin', rating: 4.5, reviews: 900 },
  { name: 'Arirang', city: 'Berlin', country: 'Germany', address: 'Bülowstr. 7, Berlin', rating: 4.5, reviews: 1150 },
  { name: 'Soon Grill', city: 'Paris', country: 'France', address: '20 Rue de la Tour d’Auvergne, Paris', rating: 4.5, reviews: 1220 },
  { name: 'Jjin', city: 'Paris', country: 'France', address: '12 Rue du Faubourg Montmartre, Paris', rating: 4.6, reviews: 760 },
  { name: 'Guibine', city: 'Paris', country: 'France', address: '44 Rue Sainte-Anne, Paris', rating: 4.5, reviews: 1000 },
  { name: 'Arisun', city: 'Sydney', country: 'Australia', address: '1/1 Dixon St, Haymarket NSW', rating: 4.5, reviews: 1350 },
  { name: 'Danjee', city: 'Sydney', country: 'Australia', address: '107-109 O’Connell St, North Adelaide NSW', rating: 4.6, reviews: 1080 },
  { name: 'Mapo Galbi', city: 'Sydney', country: 'Australia', address: '1/73-75 King St, Rockdale NSW', rating: 4.5, reviews: 800 },
  { name: 'Madang', city: 'Sydney', country: 'Australia', address: '49 Market St, Sydney NSW', rating: 4.5, reviews: 1900 },
  { name: 'Jihwaja', city: 'Seoul', country: 'South Korea', address: '143-1 Samcheong-ro, Jongno-gu, Seoul', rating: 4.5, reviews: 920 },
  { name: 'Tosokchon', city: 'Seoul', country: 'South Korea', address: '5 Jahamun-ro 5-gil, Jongno-gu, Seoul', rating: 4.6, reviews: 1132 },
  { name: 'Woo Lae Oak', city: 'Seoul', country: 'South Korea', address: '62-29 Changgyeonggung-ro, Jung-gu, Seoul', rating: 4.5, reviews: 1800 },
];

export const FEATURED_KOREAN_RESTAURANTS: FeaturedRestaurant[] = restaurants.map((restaurant, index) => {
  const id = `${restaurant.country}-${restaurant.city}-${restaurant.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const image = foodImages[index % foodImages.length];
  return {
    ...restaurant,
    id: `featured-${id}`,
    category: '음식점·카페',
    description: `평점 ${restaurant.rating.toFixed(1)} · 리뷰 ${restaurant.reviews.toLocaleString()}개 · GYOPO 추천 한식당`,
    image,
    images: [image],
    mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`,
    ratingSource: 'Google Maps 검색 기준 · 방문 전 최신 정보 확인',
  };
});
