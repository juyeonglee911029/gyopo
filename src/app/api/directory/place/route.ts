import { consumeRateLimit, rateLimitResponse } from '@/lib/apiSecurity';

export const runtime = 'edge';

type GooglePlace = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  opening_hours?: { open_now?: boolean; weekday_text?: string[] };
  photos?: Array<{ photo_reference?: string }>;
  reviews?: Array<{ author_name?: string; rating?: number; text?: string; relative_time_description?: string; time?: number }>;
};

function placePhotoUrl(reference: string, key: string) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${encodeURIComponent(reference)}&key=${encodeURIComponent(key)}`;
}

export async function GET(request: Request) {
  const rate = consumeRateLimit(`directory-place:${request.headers.get('cf-connecting-ip') || 'anonymous'}`, 30, 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterMs);
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  const query = new URL(request.url).searchParams.get('query')?.trim().slice(0, 240) || '';
  if (!query) return Response.json({ error: '검색할 업소명이 없습니다.' }, { status: 400 });
  if (!key) return Response.json({ status: 'unconfigured', message: 'Google Places API 키가 아직 설정되지 않았습니다.' }, { status: 200 });

  const findUrl = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  findUrl.searchParams.set('input', query);
  findUrl.searchParams.set('inputtype', 'textquery');
  findUrl.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,rating,user_ratings_total,types,opening_hours,photos');
  findUrl.searchParams.set('key', key);
  const findResponse = await fetch(findUrl, { signal: AbortSignal.timeout(8_000) });
  const findData = await findResponse.json() as { status?: string; candidates?: GooglePlace[] };
  const place = findData.candidates?.[0];
  if (!place?.place_id) return Response.json({ status: 'not_found', message: 'Google Maps에서 일치하는 업소를 찾지 못했습니다.' }, { status: 200 });

  const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  detailsUrl.searchParams.set('place_id', place.place_id);
  detailsUrl.searchParams.set('fields', 'place_id,name,formatted_address,formatted_phone_number,rating,user_ratings_total,types,opening_hours,photos,reviews');
  detailsUrl.searchParams.set('reviews_sort', 'newest');
  detailsUrl.searchParams.set('key', key);
  const detailsResponse = await fetch(detailsUrl, { signal: AbortSignal.timeout(8_000) });
  const detailsData = await detailsResponse.json() as { result?: GooglePlace };
  const result = detailsData.result || place;
  const photos = (result.photos || []).flatMap((photo) => photo.photo_reference ? [placePhotoUrl(photo.photo_reference, key)] : []).slice(0, 8);
  return Response.json({
    status: 'ready',
    source: 'Google Places',
    placeId: result.place_id,
    name: result.name,
    address: result.formatted_address,
    tel: result.formatted_phone_number,
    rating: result.rating,
    reviews: result.user_ratings_total,
    category: result.types?.find((type) => type !== 'point_of_interest' && type !== 'establishment') || undefined,
    hours: result.opening_hours?.weekday_text || [],
    openNow: result.opening_hours?.open_now,
    images: photos,
    recentReviews: (result.reviews || []).slice(0, 5).map((review) => ({ author: review.author_name || 'Google 사용자', rating: review.rating || 0, text: review.text || '', relativeTime: review.relative_time_description || '' })),
  }, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
