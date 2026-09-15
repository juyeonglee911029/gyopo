'use client';

export type SearchMode = 'AI' | 'PORTAL';

type SearchTrackingInput = {
  query: string;
  mode: SearchMode;
  destination: string;
  country?: string;
  audience?: 'guest' | 'member' | 'master';
};

function visitorId() {
  const key = 'gyopo-visitor-id';
  const stored = window.localStorage.getItem(key);
  if (stored) return stored;
  const next = crypto.randomUUID();
  window.localStorage.setItem(key, next);
  return next;
}

export function trackSearch(input: SearchTrackingInput) {
  const query = input.query.trim().slice(0, 160);
  if (!query) return;
  const payload = {
    query,
    mode: input.mode,
    destination: input.destination.slice(0, 160),
    country: (input.country || 'Global').slice(0, 80),
    audience: input.audience || 'guest',
    visitorId: visitorId(),
    locale: navigator.language.slice(0, 32),
    device: window.matchMedia('(max-width: 639px)').matches ? 'mobile' : 'desktop',
    path: window.location.pathname.slice(0, 160),
    referrer: document.referrer ? new URL(document.referrer).hostname.slice(0, 120) : '',
  };
  void fetch('/api/search-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
