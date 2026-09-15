'use client';

export type GrowthEventName = 'page_view' | 'login_view' | 'onboarding_completed' | 'search_submit';
export type GrowthAudience = 'guest' | 'member' | 'master';

type GrowthTrackingInput = {
  event: GrowthEventName;
  path?: string;
  country?: string;
  audience?: GrowthAudience;
  details?: Record<string, string | number | boolean | undefined>;
};

function browserIds() {
  const visitorKey = 'gyopo-visitor-id';
  const sessionKey = 'gyopo-growth-session-id';
  const visitorId = window.localStorage.getItem(visitorKey) || crypto.randomUUID();
  const sessionId = window.sessionStorage.getItem(sessionKey) || crypto.randomUUID();
  window.localStorage.setItem(visitorKey, visitorId);
  window.sessionStorage.setItem(sessionKey, sessionId);
  return { visitorId, sessionId };
}

function campaignParams() {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid'].map((key) => [key, params.get(key) || '']).filter(([, value]) => value));
}

export function trackGrowth(input: GrowthTrackingInput) {
  if (typeof window === 'undefined') return;
  const ids = browserIds();
  const payload = {
    event: input.event,
    path: (input.path || window.location.pathname).slice(0, 160),
    country: (input.country || 'Global').slice(0, 80),
    audience: input.audience || 'guest',
    visitorId: ids.visitorId,
    sessionId: ids.sessionId,
    locale: navigator.language.slice(0, 32),
    device: window.matchMedia('(max-width: 639px)').matches ? 'mobile' : 'desktop',
    referrer: document.referrer ? new URL(document.referrer).hostname.slice(0, 120) : '',
    campaigns: campaignParams(),
    details: input.details || {},
  };
  void fetch('/api/growth-events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => undefined);
}
