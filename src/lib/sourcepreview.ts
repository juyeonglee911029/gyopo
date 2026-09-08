import type { ContentCategory } from '@/lib/contentSources';

export type LiveSourceItem = {
  title: string;
  url: string;
  description?: string;
  body?: string;
  image?: string;
  images?: string[];
  publishedAt?: string;
};

type LiveSourceResponse = {
  sourceName?: string;
  region?: string;
  fetchedAt?: string;
  sections?: Array<{ category: ContentCategory; items: LiveSourceItem[] }>;
  items?: LiveSourceItem[];
};

export async function fetchSourceCategory(sourceId: string, category: ContentCategory) {
  try {
     const response = await fetch(`/api/content/preview?source=${encodeURIComponent(sourceId)}&category=${encodeURIComponent(category)}`);
    if (!response.ok) return null;
    const data = await response.json() as LiveSourceResponse;
    const section = data.sections?.find((item) => item.category === category);
     if (!section && !data.items?.length) return null;
     return { sourceName: data.sourceName || sourceId, region: data.region || 'Global', fetchedAt: data.fetchedAt || new Date().toISOString(), items: section?.items || data.items || [] };
  } catch {
    return null;
  }
}
