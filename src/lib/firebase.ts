const firebaseConfig = {
  apiKey: 'AIzaSyAne5XuEzN2sL3px0oY5Wxsgf3m0nHHIoY',
  authDomain: 'gyopo-live-portal-506019.firebaseapp.com',
  projectId: 'gyopo-live-portal-506019',
  storageBucket: 'gyopo-live-portal-506019.firebasestorage.app',
  messagingSenderId: '376649492363',
  appId: '1:376649492363:web:10e20f97af4ee5d2fc318e',
};

export const googleClientId =
  '376649492363-lgc1jrll9434im7ehi7o3o86ctrklr5u.apps.googleusercontent.com';

export type PortalUser = {
  id: string;
  name: string;
  email: string;
  image: string;
  usdtBalance: number;
  isSubscribed: boolean;
};

type StoredSession = {
  idToken: string;
  refreshToken?: string;
  user: PortalUser;
};

type FirestoreValue = {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  stringValue?: string;
  timestampValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

const sessionKey = 'gyopo-auth-session';
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, item]) => [
            key,
            toFirestoreValue(item),
          ]),
        ),
      },
    };
  }
  return { stringValue: String(value) };
}

function fromFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue?.values || []).map(fromFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue?.fields || {}).map(([key, item]) => [
        key,
        fromFirestoreValue(item),
      ]),
    );
  }
  return null;
}

function decodeDocument<T>(document: { name?: string; fields?: Record<string, FirestoreValue> }): T & { id: string } {
  const name = document.name || '';
  const id = name.split('/').pop() || '';
  const data = Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [key, fromFirestoreValue(value)]),
  );
  return { id, ...(data as T) };
}

async function firestoreRequest<T>(url: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Firestore request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function listDocuments<T>(collection: string, token?: string): Promise<Array<T & { id: string }>> {
  const response = await fetch(`${firestoreBase}/${collection}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(await response.text());
  const data = (await response.json()) as { documents?: Array<{ name?: string; fields?: Record<string, FirestoreValue> }> };
  return (data.documents || []).map((document) => decodeDocument<T>(document));
}

export async function getDocument<T>(collection: string, id: string, token?: string): Promise<(T & { id: string }) | null> {
  const response = await fetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await response.text());
  return decodeDocument<T>(await response.json());
}

export async function createDocument<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  data: T,
  token?: string,
): Promise<void> {
  await firestoreRequest(
    `${firestoreBase}/${collection}?documentId=${encodeURIComponent(id)}`,
    {
      method: 'POST',
      body: JSON.stringify({
        fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)])),
      }),
    },
    token,
  );
}

export async function upsertDocument<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  data: T,
  token?: string,
): Promise<void> {
  const body = JSON.stringify({
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)])),
  });
  const response = await fetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
  });
  if (response.ok) return;
  if (response.status !== 404) throw new Error(await response.text());
  await createDocument(collection, id, data, token);
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(sessionKey);
    return value ? (JSON.parse(value) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function getSessionToken(): string | undefined {
  return getStoredSession()?.idToken;
}

export function signOut(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(sessionKey);
}

export async function signInWithGoogleCredential(credential: string): Promise<PortalUser> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseConfig.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(credential)}&providerId=google.com`,
        requestUri: window.location.origin,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    },
  );
  if (!response.ok) throw new Error(await response.text());
  const result = (await response.json()) as {
    localId: string;
    email?: string;
    displayName?: string;
    photoUrl?: string;
    idToken: string;
    refreshToken?: string;
  };
  const user: PortalUser = {
    id: result.localId,
    name: result.displayName || result.email?.split('@')[0] || '교민 회원',
    email: result.email || '',
    image: result.photoUrl || 'https://www.gravatar.com/avatar/?d=mp',
    usdtBalance: 0,
    isSubscribed: false,
  };
  window.localStorage.setItem(sessionKey, JSON.stringify({ idToken: result.idToken, refreshToken: result.refreshToken, user }));
  await upsertDocument('profiles', user.id, {
    name: user.name,
    email: user.email,
    image: user.image,
    usdtBalance: user.usdtBalance,
    isSubscribed: user.isSubscribed,
    updatedAt: new Date(),
  }, result.idToken);
  return user;
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('google-identity-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google 로그인 스크립트를 불러오지 못했습니다.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google 로그인 스크립트를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });
}

export type SiteStats = {
  today: number;
  month: number;
  total: number;
  updatedAt?: string;
};

export async function recordVisit(): Promise<void> {
  if (typeof window === 'undefined') return;
  const visitorKey = window.localStorage.getItem('gyopo-visitor-id') || crypto.randomUUID();
  window.localStorage.setItem('gyopo-visitor-id', visitorKey);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const visitMarker = `gyopo-visited-${day}`;
  try {
    await upsertDocument('presence', visitorKey, { lastSeenAt: now, updatedAt: now });
    if (window.localStorage.getItem(visitMarker)) return;
    await createDocument('visits', `${visitorKey}-${day}`, { visitorKey, day, month, createdAt: now });
    const current = await getDocument<SiteStats>('stats', 'summary');
    await upsertDocument('stats', 'summary', {
      today: Number(current?.today || 0) + 1,
      month: Number(current?.month || 0) + 1,
      total: Number(current?.total || 0) + 1,
      updatedAt: now,
    });
    window.localStorage.setItem(visitMarker, '1');
  } catch {
    // The portal remains usable if anonymous statistics are temporarily unavailable.
  }
}

export async function getSiteStats(): Promise<SiteStats> {
  const stats = await getDocument<SiteStats>('stats', 'summary');
  return { today: stats?.today || 0, month: stats?.month || 0, total: stats?.total || 0, updatedAt: stats?.updatedAt };
}

export async function getOnlineCount(): Promise<number> {
  const presence = await listDocuments<{ lastSeenAt?: string }>('presence');
  const threshold = Date.now() - 90_000;
  return presence.filter((item) => item.lastSeenAt && new Date(item.lastSeenAt).getTime() > threshold).length;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
          prompt: () => void;
        };
      };
    };
  }
}
