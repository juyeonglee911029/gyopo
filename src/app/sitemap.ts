import type { MetadataRoute } from 'next';
import { getRegionalSitemapPosts } from '@/lib/regionalContent';
import { canonicalUrl } from '@/lib/seo';
import { regionalPostHref } from '@/lib/regionRoutes';

const routes = ['/', '/news', '/jobs', '/directory', '/market', '/community', '/ads', '/privacy', '/terms'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows = await getRegionalSitemapPosts();
  const regional = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const post of rows) {
    const countryPath = `/${post.country.slug}`;
    const categoryPath = `${countryPath}/${post.category}`;
    regional.set(countryPath, { url: canonicalUrl(countryPath), changeFrequency: 'daily', priority: 0.8 });
    regional.set(categoryPath, { url: canonicalUrl(categoryPath), changeFrequency: 'daily', priority: 0.85 });
    const detailPath = regionalPostHref(post.country, post.category, post.id);
    regional.set(detailPath, { url: canonicalUrl(detailPath), lastModified: post.updatedAt || post.createdAt, changeFrequency: 'weekly', priority: 0.7 });
  }
  return [...routes.map((route) => ({
    url: canonicalUrl(route),
    changeFrequency: route === '/' || route === '/news' ? 'daily' as const : 'weekly' as const,
    priority: route === '/' ? 1 : route === '/news' || route === '/jobs' || route === '/directory' ? 0.8 : 0.6,
  })), ...regional.values()];
}
