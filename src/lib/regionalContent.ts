import 'server-only';
import { cache } from 'react';
import { cityRegionalPostHref, countryForRegion, getCityRoute, getCountryRoute, isRegionalPostId, regionalPostHref, REGIONAL_CATEGORIES, COUNTRY_LIFE_CATEGORIES, type CityRoute, type CountryRoute, type RegionalCategory } from './regionRoutes';

// The same public project as firebase.ts; no user token or admin credentials are used.
const DOCUMENT_ROOT = 'projects/gyopo-live-portal-506019/databases/(default)/documents';
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/${DOCUMENT_ROOT}`;
export const PUBLIC_COLLECTIONS = ['posts', 'jobs', 'directories', 'marketItems'] as const;
export type PublicCollection = (typeof PUBLIC_COLLECTIONS)[number];
export const REGIONAL_PAGE_SIZE = 50;
const MAX_SITEMAP_PAGES = 10;
const MAX_SEARCH_PAGES = 3;

export type RegionalPost = {
  id: string;
  collection: PublicCollection;
  country: CountryRoute;
  region: string;
  city?: string;
  category: RegionalCategory;
  title: string;
  body: string;
  description: string;
  author?: string;
  authorId?: string;
  createdAt?: string;
  updatedAt?: string;
  sourceUrl?: string;
  sourceName?: string;
  sourceBacked: boolean;
  images: string[];
  facts: Array<{ label: string; value: string }>;
};

type FirestoreValue = { stringValue?: string; timestampValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number; arrayValue?: { values?: FirestoreValue[] }; mapValue?: { fields?: Record<string, FirestoreValue> } };
type FirestoreDocument = { name: string; fields?: Record<string, FirestoreValue>; updateTime?: string };
export type RegionalListing = { status: 'ok' | 'unavailable'; posts: RegionalPost[]; nextCursor?: string };
export type RegionalDetail = { status: 'ok'; post: RegionalPost } | { status: 'not-found' | 'unavailable' };
export type RegionalSearchMatch = {
  id: string;
  href: string;
  title: string;
  snippet: string;
  category: string;
  region: string;
  city?: string;
};

function decode(value: FirestoreValue): unknown {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decode);
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, entry]) => [key, decode(entry)]));
  return null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function publicHttpUrl(value: unknown): string | undefined {
  try {
    const url = new URL(text(value));
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function date(value: unknown): string | undefined {
  const parsed = text(value);
  return parsed && Number.isFinite(Date.parse(parsed)) ? new Date(parsed).toISOString() : undefined;
}

export function regionalPostFromRecord(collection: PublicCollection, id: string, record: Record<string, unknown>): RegionalPost | null {
  const country = countryForRegion(text(record.country));
  const title = text(record.title) || text(record.name);
  if (!country || !title || !isRegionalPostId(id) || record.sourceSnapshot || record.deleted === true || record.isPublic === false || record.expiresAt) return null;
  if (['draft', 'private', 'deleted', 'hidden', 'pending'].includes(text(record.status).toLowerCase())) return null;
  let category: RegionalCategory;
  if (collection === 'jobs') category = 'jobs';
  else if (collection === 'directories') category = record.type === 'food' || record.sourceCategory === 'food' ? 'food' : 'directory';
  else if (collection === 'marketItems') category = 'market';
  else if (record.type === 'housing') category = 'housing';
  else if (record.type === 'news' || record.sourceCategory === 'news') category = 'news';
  else if (record.type === 'immigration' || record.sourceCategory === 'immigration') category = 'immigration';
  else if (record.type === 'education' || record.sourceCategory === 'education') category = 'education';
  else if (record.type === 'cars' || record.sourceCategory === 'cars') category = 'cars';
  else if (record.type === 'tax-finance' || record.sourceCategory === 'tax-finance') category = 'tax-finance';
  else if (record.type === 'food' || record.sourceCategory === 'food') category = 'food';
  else if (record.type === 'safety' || record.sourceCategory === 'safety') category = 'safety';
  else if (record.type === 'freeboard' || record.sourceCategory === 'freeboard') category = 'freeboard';
  else if (['general', 'notice', 'community'].includes(text(record.type)) || record.sourceCategory === 'community') category = 'community';
  else return null;
  if (text(record.sourceCategory) && record.sourceCategory !== category) return null;

  const sourceBacked = Boolean(record.sourceUrl || record.sourceId || record.sourceContentId || id.startsWith('source-'));
  const sourceUrl = publicHttpUrl(record.sourceUrl);
  if (sourceBacked) {
    if (!sourceUrl) return null;
    const url = new URL(sourceUrl);
    // Homepage/board imports are not individual articles. Company homepages can be directory entries.
    if (category !== 'directory' && !url.search && /^\/(?:news|jobs|community|market|businesses|board|게시판|구인구직)?\/?$/i.test(decodeURI(url.pathname))) return null;
  }
  const facts = [
    ['회사', record.company], ['지역', record.location], ['급여', record.salary],
    ['가격', record.price], ['주소', record.address], ['연락처', record.tel],
  ].flatMap(([label, value]) => text(value) ? [{ label: String(label), value: text(value) }] : []);
  const images = [record.image, ...(Array.isArray(record.images) ? record.images : [])]
    .map(publicHttpUrl).filter((value): value is string => Boolean(value));
  return {
    id, collection, country, category, title,
    region: text(record.country),
    city: text(record.city) || text(record.citySlug) || text(record.cityName) || text(record.locationCity) || undefined,
    body: text(record.body) || text(record.desc) || text(record.description),
    description: text(record.description),
    author: text(record.author) || undefined,
    authorId: text(record.authorId) || undefined,
    createdAt: date(record.createdAt),
    updatedAt: date(record.updatedAt),
    sourceBacked, sourceUrl, sourceName: text(record.sourceName) || undefined,
    images: [...new Set(images)].slice(0, 12), facts,
  };
}

export function isIndexableRegionalPost(post: RegionalPost): boolean {
  const body = post.body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return body.length >= 80 && (body.match(/[\p{L}\p{N}]/gu)?.length || 0) >= 40
    && body !== post.title && !/^(?:공식 출처에서 확인된 정보입니다\.?|출처에서 확인된 업소 정보입니다\.?)$/.test(body);
}

function fromDocument(collection: PublicCollection, document: FirestoreDocument): RegionalPost | null {
  const record = Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]));
  const post = regionalPostFromRecord(collection, document.name.split('/').pop() || '', record);
  if (post && !post.updatedAt) post.updatedAt = date(document.updateTime);
  return post;
}

function collectionFor(category: RegionalCategory): PublicCollection {
  return category === 'jobs' ? 'jobs' : category === 'directory' ? 'directories' : category === 'market' ? 'marketItems' : 'posts';
}

const POST_TYPES: Partial<Record<RegionalCategory, string[]>> = {
  housing: ['housing'],
  immigration: ['immigration'],
  education: ['education'],
  cars: ['cars'],
  'tax-finance': ['tax-finance'],
  food: ['food'],
  safety: ['safety'],
  freeboard: ['freeboard'],
  community: ['general', 'notice', 'community'],
  news: ['news'],
};

function fieldFilter(fieldPath: string, values: readonly string[]) {
  return { fieldFilter: { field: { fieldPath }, op: values.length === 1 ? 'EQUAL' : 'IN', value: values.length === 1 ? { stringValue: values[0] } : { arrayValue: { values: values.map((stringValue) => ({ stringValue })) } } } };
}

async function readBatch(collection: PublicCollection, country?: CountryRoute, category?: RegionalCategory, cursor = '') {
  const filters: unknown[] = country ? [fieldFilter('country', country.aliases)] : [];
  if (collection === 'posts' && category) {
    const types = POST_TYPES[category] || [category];
    filters.push({ compositeFilter: { op: 'OR', filters: [fieldFilter('type', types), fieldFilter('sourceCategory', [category])] } });
  }
  const response = await fetch(`${FIRESTORE_URL}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: collection }],
      ...(filters.length ? { where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } } } : {}),
      orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
      limit: REGIONAL_PAGE_SIZE + 1,
      ...(cursor ? { startAt: { values: [{ referenceValue: `${DOCUMENT_ROOT}/${collection}/${cursor}` }], before: false } } : {}),
    } }),
  });
  if (!response.ok) throw new Error(`Public content read failed (${response.status})`);
  const rows = await response.json() as Array<{ document?: FirestoreDocument; error?: unknown }>;
  if (!Array.isArray(rows) || rows.some((row) => row.error)) throw new Error('Invalid public content response');
  const documents = rows.flatMap((row) => row.document ? [row.document] : []);
  const page = documents.slice(0, REGIONAL_PAGE_SIZE);
  return { documents: page, nextCursor: documents.length > REGIONAL_PAGE_SIZE ? page.at(-1)?.name.split('/').pop() : undefined };
}

function postMatchesCity(post: RegionalPost, city: CityRoute) {
  if (!post.city) return false;
  const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/[\s_]+/g, '-');
  const value = normalize(post.city);
  return [city.slug, city.label, city.english].some((candidate) => normalize(candidate) === value);
}

function postMatchesCategory(post: RegionalPost, category: RegionalCategory) {
  return category === 'directory' ? post.category === 'directory' || post.category === 'food' : post.category === category;
}

export const getRegionalListing = cache(async (slug: string, category: RegionalCategory, cursor = '', citySlug?: string): Promise<RegionalListing> => {
  const country = getCountryRoute(slug);
  const city = citySlug ? getCityRoute(slug, citySlug) : undefined;
  if (!country || (cursor && !isRegionalPostId(cursor)) || (citySlug && !city)) return { status: 'ok', posts: [] };
  const canonicalSlug = country.slug;
  const collection = collectionFor(category);
  try {
    const batch = await readBatch(collection, country, category, cursor);
    const seen = new Set<string>();
    const posts = batch.documents.flatMap((document) => {
      const post = fromDocument(collection, document);
      if (!post || post.country.slug !== canonicalSlug || !postMatchesCategory(post, category) || (city && !postMatchesCity(post, city))) return [];
      const key = post.sourceUrl || post.id;
      if (seen.has(key)) return [];
      seen.add(key);
      return [post];
    });
    posts.sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0) || a.id.localeCompare(b.id));
    return { status: 'ok', posts, nextCursor: batch.nextCursor };
  } catch (error) {
    console.warn('[regional-content]', collection, error instanceof Error ? error.message : 'Read unavailable');
    return { status: 'unavailable', posts: [] };
  }
});

export const getCountryOverview = cache(async (slug: string) => Promise.all(
  COUNTRY_LIFE_CATEGORIES.map(async (category) => ({ category, listing: await getRegionalListing(slug, category.slug) })),
));

export const getCityOverview = cache(async (slug: string, citySlug: string) => Promise.all(
  COUNTRY_LIFE_CATEGORIES.map(async (category) => ({ category, listing: await getRegionalListing(slug, category.slug, '', citySlug) })),
));

export const getRegionalPost = cache(async (slug: string, category: RegionalCategory, id: string, citySlug?: string): Promise<RegionalDetail> => {
  const country = getCountryRoute(slug);
  const city = citySlug ? getCityRoute(slug, citySlug) : undefined;
  if (!country || !isRegionalPostId(id) || (citySlug && !city)) return { status: 'not-found' };
  const collection = collectionFor(category);
  try {
    const response = await fetch(`${FIRESTORE_URL}/${collection}/${encodeURIComponent(id)}`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (response.status === 404) return { status: 'not-found' };
    if (!response.ok) throw new Error(`Public content read failed (${response.status})`);
    const post = fromDocument(collection, await response.json() as FirestoreDocument);
    return post && post.country.slug === country.slug && postMatchesCategory(post, category) && (!city || postMatchesCity(post, city)) ? { status: 'ok', post } : { status: 'not-found' };
  } catch (error) {
    console.warn('[regional-content]', collection, error instanceof Error ? error.message : 'Read unavailable');
    return { status: 'unavailable' };
  }
});

function normalizeSearchText(value: string) {
  return value.toLocaleLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

function searchSnippet(post: RegionalPost, query: string) {
  const body = normalizeSearchText(post.body || post.description || post.title);
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  const start = Math.max(0, terms.map((term) => body.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] || 0);
  const excerpt = body.slice(start, start + 180).trim();
  return `${start > 0 ? '…' : ''}${excerpt}${start + excerpt.length < body.length ? '…' : ''}`;
}

export async function searchRegionalPosts(query: string, region = '', limit = 5): Promise<RegionalSearchMatch[]> {
  const normalizedQuery = normalizeSearchText(query);
  const terms = normalizedQuery.split(' ').filter((term) => term.length > 1).slice(0, 8);
  if (!terms.length) return [];
  const country = countryForRegion(region);

  const batches = await Promise.all(PUBLIC_COLLECTIONS.map(async (collection) => {
    const posts: RegionalPost[] = [];
    let cursor: string | undefined;
    try {
      for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
        const batch = await readBatch(collection, country, undefined, cursor);
        for (const document of batch.documents) {
          const post = fromDocument(collection, document);
          if (post && (!country || post.country.slug === country.slug)) posts.push(post);
        }
        cursor = batch.nextCursor;
        if (!cursor) break;
      }
    } catch (error) {
      console.warn('[regional-search]', collection, error instanceof Error ? error.message : 'Read unavailable');
    }
    return posts;
  }));

  const seen = new Set<string>();
  return batches.flat().flatMap((post) => {
    const categoryLabel = REGIONAL_CATEGORIES.find((category) => category.slug === post.category)?.label || post.category;
    const metadata = [post.title, post.body, post.description, post.region, post.city || '', post.country.label, post.country.english, ...post.country.aliases, categoryLabel].map(normalizeSearchText).join(' ');
    const title = normalizeSearchText(post.title);
    const matchedTerms = terms.filter((term) => metadata.includes(term));
    if (!matchedTerms.length) return [];
    const key = post.sourceUrl || post.id;
    if (seen.has(key)) return [];
    seen.add(key);
    const score = matchedTerms.length * 4 + matchedTerms.filter((term) => title.includes(term)).length * 8 + (title.includes(normalizedQuery) ? 20 : 0);
    const city = post.city ? getCityRoute(post.country.slug, post.city) : undefined;
    return [{
      score,
      post,
      match: {
        id: post.id,
        href: city ? cityRegionalPostHref(city, post.category, post.id) : regionalPostHref(post.country, post.category, post.id),
        title: post.title,
        snippet: searchSnippet(post, query),
        category: categoryLabel,
        region: post.country.label,
        city: post.city,
      },
    }];
  }).sort((a, b) => b.score - a.score || (Date.parse(b.post.updatedAt || b.post.createdAt || '') || 0) - (Date.parse(a.post.updatedAt || a.post.createdAt || '') || 0)).slice(0, limit).map(({ match }) => match);
}

export async function getRegionalSitemapPosts(): Promise<RegionalPost[]> {
  const batches = await Promise.all(PUBLIC_COLLECTIONS.map(async (collection) => {
    const posts: RegionalPost[] = [];
    let cursor: string | undefined;
    try {
      for (let page = 0; page < MAX_SITEMAP_PAGES; page += 1) {
        const batch = await readBatch(collection, undefined, undefined, cursor);
        for (const document of batch.documents) {
          const post = fromDocument(collection, document);
          if (post && isIndexableRegionalPost(post)) posts.push(post);
        }
        cursor = batch.nextCursor;
        if (!cursor) break;
      }
      if (cursor) console.warn('[regional-sitemap] Collection scan capped:', collection);
      return posts;
    } catch (error) {
      console.warn('[regional-sitemap]', collection, error instanceof Error ? error.message : 'Read unavailable');
      return [];
    }
  }));
  return batches.flat();
}
