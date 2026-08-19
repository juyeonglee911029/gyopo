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
  gender?: string;
  age?: number;
  country?: string;
};

export type OnlineUser = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string;
  gender?: string;
  age?: number;
  country?: string;
  lastSeenAt: string;
};

type StoredSession = {
  idToken: string;
  refreshToken?: string;
  user: PortalUser;
};

type RefreshResponse = {
  id_token: string;
  refresh_token?: string;
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
let refreshPromise: Promise<string | undefined> | null = null;

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

async function refreshSessionToken(): Promise<string | undefined> {
  if (refreshPromise) return refreshPromise;
  const session = getStoredSession();
  if (!session?.refreshToken) return undefined;
  refreshPromise = fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,
  })
    .then(async (response) => {
      if (!response.ok) return undefined;
      const data = (await response.json()) as RefreshResponse;
      if (!data.id_token) return undefined;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(sessionKey, JSON.stringify({
          ...session,
          idToken: data.id_token,
          refreshToken: data.refresh_token || session.refreshToken,
        }));
      }
      return data.id_token;
    })
    .catch(() => undefined)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function authenticatedFetch(url: string, options: RequestInit = {}, token?: string): Promise<Response> {
  const send = (requestToken?: string) => fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
    },
  });
  let response = await send(token);
  if (response.status === 401 && token) {
    const refreshed = await refreshSessionToken();
    if (refreshed) response = await send(refreshed);
  }
  return response;
}

async function firestoreRequest<T>(url: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await authenticatedFetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  }, token);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Firestore request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function listDocuments<T>(collection: string, token?: string): Promise<Array<T & { id: string }>> {
  const response = await authenticatedFetch(`${firestoreBase}/${collection}`, {}, token);
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(await response.text());
  const data = (await response.json()) as { documents?: Array<{ name?: string; fields?: Record<string, FirestoreValue> }> };
  return (data.documents || []).map((document) => decodeDocument<T>(document));
}

export async function getDocument<T>(collection: string, id: string, token?: string): Promise<(T & { id: string }) | null> {
  const response = await authenticatedFetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}`, {}, token);
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
  const response = await authenticatedFetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  }, token);
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
  const savedProfile = await getDocument<Partial<PortalUser>>('profiles', result.localId, result.idToken).catch(() => null);
  const user: PortalUser = {
    id: result.localId,
    name: savedProfile?.name || result.displayName || result.email?.split('@')[0] || '교민 회원',
    email: savedProfile?.email || result.email || '',
    image: savedProfile?.image || result.photoUrl || 'https://www.gravatar.com/avatar/?d=mp',
    usdtBalance: Number(savedProfile?.usdtBalance || 0),
    isSubscribed: Boolean(savedProfile?.isSubscribed),
    gender: savedProfile?.gender,
    age: savedProfile?.age,
    country: savedProfile?.country,
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

export async function saveProfile(user: PortalUser, token = getSessionToken()): Promise<void> {
  await upsertDocument('profiles', user.id, {
    name: user.name,
    email: user.email,
    image: user.image,
    usdtBalance: Number(user.usdtBalance || 0),
    isSubscribed: Boolean(user.isSubscribed),
    ...(user.gender ? { gender: user.gender } : {}),
    ...(user.age ? { age: user.age } : {}),
    ...(user.country ? { country: user.country } : {}),
    updatedAt: new Date(),
  }, token);
  if (typeof window !== 'undefined') {
    const session = getStoredSession();
    if (session?.user.id === user.id) {
      window.localStorage.setItem(sessionKey, JSON.stringify({ ...session, user }));
    }
  }
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

export async function recordVisit(user?: PortalUser | null, country = 'Global'): Promise<void> {
  if (typeof window === 'undefined') return;
  const visitorKey = window.localStorage.getItem('gyopo-visitor-id') || crypto.randomUUID();
  window.localStorage.setItem('gyopo-visitor-id', visitorKey);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const visitMarker = `gyopo-visited-${day}`;
  try {
    await upsertDocument('presence', visitorKey, {
      lastSeenAt: now,
      updatedAt: now,
      ...(user
        ? {
            userId: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            gender: user.gender || '',
            age: user.age || 0,
            country: user.country || country,
          }
        : {}),
    });
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
  const presence = await listDocuments<{ lastSeenAt?: string; userId?: string }>('presence');
  const threshold = Date.now() - 90_000;
  return presence.filter((item) => item.userId && item.lastSeenAt && new Date(item.lastSeenAt).getTime() > threshold).length;
}

export async function listOnlineUsers(): Promise<OnlineUser[]> {
  const presence = await listDocuments<Omit<OnlineUser, 'id'>>('presence');
  const threshold = Date.now() - 90_000;
  return presence
    .filter((item) => item.userId && item.lastSeenAt && new Date(item.lastSeenAt).getTime() > threshold)
    .map((item) => ({ ...item, id: item.userId as string, userId: item.userId as string }))
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
}

export async function deleteDocument(collection: string, id: string, token?: string): Promise<void> {
  const response = await authenticatedFetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, token);
  if (!response.ok && response.status !== 404) throw new Error(await response.text());
}

export async function deleteExpiredChatMessages(token?: string): Promise<number> {
  if (!token) return 0;
  const rows = await firestoreRequest<Array<{ document?: { name?: string; fields?: Record<string, FirestoreValue> } }>>(
    `${firestoreBase}:runQuery`,
    {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'chatMessages' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'expiresAt' },
              op: 'LESS_THAN_OR_EQUAL',
              value: toFirestoreValue(new Date()),
            },
          },
        },
      }),
    },
    token,
  );
  const expired = rows
    .filter((row) => row.document)
    .map((row) => decodeDocument<Record<string, unknown>>(row.document as { name: string; fields?: Record<string, FirestoreValue> }));
  await Promise.all(expired.map((message) => deleteDocument('chatMessages', message.id, token)));
  return expired.length;
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
