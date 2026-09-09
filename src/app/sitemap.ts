import type { MetadataRoute } from 'next';

const routes = ['/', '/news', '/jobs', '/directory', '/community', '/users', '/games', '/webrtc', '/music', '/theater', '/assistant', '/ads', '/privacy', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `https://gyopo.pages.dev${route}`,
    changeFrequency: route === '/' || route === '/news' ? 'daily' : 'weekly',
    priority: route === '/' ? 1 : route === '/news' || route === '/jobs' || route === '/directory' ? 0.8 : 0.6,
  }));
}
