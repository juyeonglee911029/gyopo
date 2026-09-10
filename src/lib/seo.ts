import type { Metadata } from 'next';

export function resolveSiteUrl(value?: string): string {
  if (!value?.trim()) return 'https://gyopo.pages.dev';
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an absolute HTTP(S) origin');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('NEXT_PUBLIC_SITE_URL must be an HTTP(S) origin without credentials, path, query, or fragment');
  }
  return url.origin;
}

export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
export const NOINDEX_FOLLOW: Metadata['robots'] = {
  index: false,
  follow: true,
  googleBot: { index: false, follow: true },
};

export function canonicalUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) throw new Error('Canonical path must be site-relative');
  const url = new URL(path, SITE_URL);
  url.search = '';
  url.hash = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.href;
}

export function seoExcerpt(text: string, limit = 160): string {
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > limit ? `${plain.slice(0, limit - 3).trimEnd()}...` : plain;
}

export function pageMetadata(title: string, description: string, path: string, index = true): Metadata {
  const url = canonicalUrl(path);
  return {
    title: { absolute: `${title} | GYOPO` },
    description,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true, googleBot: { index: true, follow: true } } : NOINDEX_FOLLOW,
    openGraph: { title, description, url, siteName: 'GYOPO', type: 'website' },
    twitter: { card: 'summary', title, description },
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
