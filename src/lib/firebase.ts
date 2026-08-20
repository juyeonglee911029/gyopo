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
export const MASTER_EMAIL = 'juyeonglee911029@gmail.com';
export const MASTER_DEPOSIT_ADDRESS = 'TNg65wc1DnQdyVfUXbRj4rmtfxwdKXGKtX';
export const MASTER_NETWORK = 'TRX';

export type Gender = 'male' | 'female';
export type GenderPreference = 'any' | Gender;

export type PortalUser = {
  id: string;
  name: string;
  email: string;
  image: string;
  usdtBalance: number;
  isSubscribed: boolean;
  gender?: string;
  genderPreference?: GenderPreference;
  premiumExpiresAt?: string;
  age?: number;
  country?: string;
};

export function isMasterUser(user?: Pick<PortalUser, 'email'> | null): boolean {
  return user?.email?.toLowerCase() === MASTER_EMAIL;
}

export type OnlineUser = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string;
  gender?: string;
  genderPreference?: GenderPreference;
  isSubscribed?: boolean;
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

type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
};

export type FirestoreFilter = {
  field: string;
  op: 'EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL';
  value: unknown;
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

function encodeFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
}

async function getRawDocument(collection: string, id: string, token?: string): Promise<FirestoreDocument | null> {
  const response = await authenticatedFetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}`, {}, token);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<FirestoreDocument>;
}

function buildFieldFilter(filter: FirestoreFilter) {
  return {
    fieldFilter: {
      field: { fieldPath: filter.field },
      op: filter.op,
      value: toFirestoreValue(filter.value),
    },
  };
}

async function runQueryDocuments(collection: string, filters: FirestoreFilter[], token?: string, limit?: number): Promise<FirestoreDocument[]> {
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId: collection }] };
  if (filters.length === 1) structuredQuery.where = buildFieldFilter(filters[0]);
  if (filters.length > 1) structuredQuery.where = { compositeFilter: { op: 'AND', filters: filters.map(buildFieldFilter) } };
  if (limit) structuredQuery.limit = limit;
  const data = await firestoreRequest<Array<{ document?: FirestoreDocument }>>(
    `${firestoreBase}:runQuery`,
    { method: 'POST', body: JSON.stringify({ structuredQuery }) },
    token,
  );
  return data.flatMap((item) => item.document ? [item.document] : []);
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

export async function queryDocuments<T>(collection: string, field: string, value: unknown, token?: string): Promise<Array<T & { id: string }>> {
  return (await runQueryDocuments(collection, [{ field, op: 'EQUAL', value }], token)).map((document) => decodeDocument<T>(document));
}

export async function queryDocumentsWhere<T>(collection: string, filters: FirestoreFilter[], token?: string, limit?: number): Promise<Array<T & { id: string }>> {
  return (await runQueryDocuments(collection, filters, token, limit)).map((document) => decodeDocument<T>(document));
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

export async function mergeDocument<T extends Record<string, unknown>>(
  collection: string,
  id: string,
  data: T,
  token?: string,
): Promise<void> {
  const fieldPaths = Object.keys(data).map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
  const response = await authenticatedFetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}?${fieldPaths}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(data) }),
  }, token);
  if (response.ok) return;
  if (response.status !== 404) throw new Error(await response.text());
  try {
    await createDocument(collection, id, data, token);
  } catch (error) {
    // A concurrent creator may have won the first write; retry as a merge.
    if (error instanceof Error && /already exists|409|ALREADY_EXISTS/i.test(error.message)) {
      await mergeDocument(collection, id, data, token);
      return;
    }
    throw error;
  }
}

export async function incrementDocument(collection: string, id: string, field: string, amount: number, token?: string): Promise<void> {
  await firestoreRequest(`${firestoreBase}:commit`, {
    method: 'POST',
    body: JSON.stringify({
      writes: [{
        transform: {
          document: `${firestoreBase}/${collection}/${encodeURIComponent(id)}`,
          fieldTransforms: [{ fieldPath: field, increment: toFirestoreValue(amount) }],
        },
      }],
    }),
  }, token);
}

export async function approveDepositRequest(requestId: string, userId: string, reviewedBy: string, token?: string): Promise<void> {
  const [requestDocument, profileDocument] = await Promise.all([
    getRawDocument('depositRequests', requestId, token),
    getRawDocument('profiles', userId, token),
  ]);
  if (!requestDocument?.name || !requestDocument.updateTime) throw new Error('입금 신청을 찾을 수 없습니다.');
  if (!profileDocument?.name || !profileDocument.updateTime) throw new Error('회원 지갑을 찾을 수 없습니다.');

  const request = decodeDocument<{ userId?: string; amount?: number; status?: string }>(requestDocument);
  if (request.status !== 'PENDING') throw new Error('이미 처리된 입금 신청입니다.');
  if (request.userId !== userId) throw new Error('입금 신청 회원 정보가 일치하지 않습니다.');
  const amount = Number(request.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('입금 금액이 올바르지 않습니다.');

  const currentBalance = Number(fromFirestoreValue(profileDocument.fields?.usdtBalance) || 0);
  const requestFields = {
    ...(requestDocument.fields || {}),
    ...encodeFields({ status: 'APPROVED', reviewedAt: new Date(), reviewedBy }),
  };
  const profileFields = {
    ...(profileDocument.fields || {}),
    ...encodeFields({ usdtBalance: currentBalance + amount, updatedAt: new Date() }),
  };
  const response = await authenticatedFetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        { update: { name: profileDocument.name, fields: profileFields }, currentDocument: { updateTime: profileDocument.updateTime } },
        { update: { name: requestDocument.name, fields: requestFields }, currentDocument: { updateTime: requestDocument.updateTime } },
      ],
    }),
  }, token);
  if (!response.ok) throw new Error('승인 처리 중 서버 원장 충돌이 발생했습니다. 목록을 새로고침해주세요.');
}

export async function reviewDepositRequest(requestId: string, status: 'REJECTED', reviewedBy: string, token?: string): Promise<void> {
  const requestDocument = await getRawDocument('depositRequests', requestId, token);
  if (!requestDocument?.name || !requestDocument.updateTime) throw new Error('입금 신청을 찾을 수 없습니다.');
  const request = decodeDocument<{ status?: string }>(requestDocument);
  if (request.status !== 'PENDING') throw new Error('이미 처리된 입금 신청입니다.');
  const response = await authenticatedFetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [{
        update: {
          name: requestDocument.name,
          fields: { ...(requestDocument.fields || {}), ...encodeFields({ status, reviewedAt: new Date(), reviewedBy }) },
        },
        currentDocument: { updateTime: requestDocument.updateTime },
      }],
    }),
  }, token);
  if (!response.ok) throw new Error('거절 처리 중 서버 원장 충돌이 발생했습니다. 목록을 새로고침해주세요.');
}

export type TetrisQueueProfile = {
  id: string;
  name: string;
  image: string;
  country?: string;
  gender?: string;
  genderPreference?: GenderPreference;
  isSubscribed?: boolean;
};
export type TetrisMatchClaim = { matchId: string; role: 'A' | 'B'; opponent: TetrisQueueProfile };
export type WebrtcMatchClaim = { callId: string; opponent: TetrisQueueProfile; initiator: boolean };

async function getWaitingQueueDocuments(collection: string, token?: string): Promise<FirestoreDocument[]> {
  try {
    const queried = await runQueryDocuments(collection, [{ field: 'status', op: 'EQUAL', value: 'waiting' }], token, 50);
    if (queried.length) return queried;
  } catch {
    // The collection read below keeps matching alive when a REST query briefly fails.
  }
  const response = await authenticatedFetch(`${firestoreBase}/${collection}`, {}, token);
  if (!response.ok) return [];
  const data = (await response.json()) as { documents?: FirestoreDocument[] };
  return (data.documents || []).filter((row) => fromFirestoreValue(row.fields?.status) === 'waiting');
}

function isFreshQueueDocument(row: FirestoreDocument, maxAgeMs: number): boolean {
  const lastSeenAt = fromFirestoreValue(row.fields?.lastSeenAt);
  return typeof lastSeenAt === 'string' && new Date(lastSeenAt).getTime() > Date.now() - maxAgeMs && Boolean(row.name && row.updateTime);
}

export async function claimTetrisMatch(profile: TetrisQueueProfile, token?: string): Promise<TetrisMatchClaim | null> {
  const waiting = await getWaitingQueueDocuments('tetrisQueue', token);
  const candidateRow = waiting.find((row) => {
    const candidate = decodeDocument<TetrisQueueProfile & { userId?: string }>(row);
    const candidateId = candidate.userId || candidate.id;
    const requesterPreference = profile.genderPreference || 'any';
    const candidatePreference = candidate.genderPreference || 'any';
    const requesterMatches = requesterPreference === 'any' || candidate.gender === requesterPreference;
    const candidateMatches = candidatePreference === 'any' || profile.gender === candidatePreference;
    return candidateId !== profile.id && isFreshQueueDocument(row, 120_000) && requesterMatches && candidateMatches;
  });
  if (!candidateRow?.name || !candidateRow.updateTime) return null;

  const candidate = decodeDocument<TetrisQueueProfile & { userId: string }>(candidateRow);
  candidate.userId = candidate.userId || candidate.id;
  const matchId = `tetris-${profile.id}-${candidate.userId}-${crypto.randomUUID()}`;
  const opponent: TetrisQueueProfile = { id: candidate.userId, name: candidate.name, image: candidate.image, country: candidate.country };
  const candidateData = {
    status: 'matched',
    matchedBy: profile.id,
    matchId,
    role: 'B',
    opponent: profile,
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  };
  const ownData = {
    userId: profile.id,
    name: profile.name,
    image: profile.image,
    country: profile.country || 'Global',
    status: 'matched',
    matchedBy: profile.id,
    matchId,
    role: 'A',
    opponent,
    lastSeenAt: new Date(),
    updatedAt: new Date(),
  };
  const candidateFields = { ...(candidateRow.fields || {}), ...encodeFields(candidateData) };
  const ownName = `${firestoreBase}/tetrisQueue/${encodeURIComponent(profile.id)}`;
  const response = await authenticatedFetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        { update: { name: candidateRow.name, fields: candidateFields }, currentDocument: { updateTime: candidateRow.updateTime } },
        { update: { name: ownName, fields: encodeFields(ownData) } },
      ],
    }),
  }, token);
  if (!response.ok) return null;
  return { matchId, role: 'A', opponent };
}

export async function claimWebrtcMatch(profile: TetrisQueueProfile, token?: string): Promise<WebrtcMatchClaim | null> {
  const waiting = await getWaitingQueueDocuments('webrtcQueue', token);
  const candidateRow = waiting.find((row) => {
    const candidate = decodeDocument<{ userId?: string }>(row);
    const candidateId = candidate.userId || candidate.id;
    return candidateId !== profile.id && isFreshQueueDocument(row, 120_000);
  });
  if (!candidateRow?.name || !candidateRow.updateTime) return null;
  const candidate = decodeDocument<TetrisQueueProfile & { userId: string }>(candidateRow);
  candidate.userId = candidate.userId || candidate.id;
  const callId = `webrtc-${profile.id}-${candidate.userId}-${crypto.randomUUID()}`;
  const opponent: TetrisQueueProfile = {
    id: candidate.userId,
    name: candidate.name,
    image: candidate.image,
    country: candidate.country,
    gender: candidate.gender,
    genderPreference: candidate.genderPreference,
    isSubscribed: candidate.isSubscribed,
  };
  const candidateFields = {
    ...(candidateRow.fields || {}),
    ...encodeFields({ status: 'matched', matchedBy: profile.id, callId, opponent: profile, lastSeenAt: new Date(), updatedAt: new Date() }),
  };
  const ownName = `${firestoreBase}/webrtcQueue/${encodeURIComponent(profile.id)}`;
  const response = await authenticatedFetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        { update: { name: candidateRow.name, fields: candidateFields }, currentDocument: { updateTime: candidateRow.updateTime } },
        { update: { name: ownName, fields: encodeFields({ userId: profile.id, name: profile.name, image: profile.image, country: profile.country || 'Global', status: 'matched', matchedBy: profile.id, callId, opponent, lastSeenAt: new Date(), updatedAt: new Date() }) } },
      ],
    }),
  }, token);
  if (!response.ok) return null;
  return { callId, opponent, initiator: profile.id < candidate.userId };
}

export async function reserveGameStake(userId: string, matchId: string, amount: number, token?: string): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const stakeId = `game-${matchId}-${userId}`;
  if (await getRawDocument('gameStakes', stakeId, token)) return;
  const profileDocument = await getRawDocument('profiles', userId, token);
  if (!profileDocument?.name) throw new Error('프로필을 찾을 수 없습니다.');
  const currentBalance = Number(fromFirestoreValue(profileDocument.fields?.usdtBalance) || 0);
  if (currentBalance < amount) throw new Error(`게임 참가비 ${amount} USDT가 부족합니다.`);
  const profileName = `${firestoreBase}/profiles/${encodeURIComponent(userId)}`;
  const stakeName = `${firestoreBase}/gameStakes/${encodeURIComponent(stakeId)}`;
  const profileFields = {
    ...(profileDocument.fields || {}),
    usdtBalance: toFirestoreValue(currentBalance - amount),
    updatedAt: toFirestoreValue(new Date()),
  };
  const response = await authenticatedFetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        { update: { name: profileName, fields: profileFields }, currentDocument: { updateTime: profileDocument.updateTime } },
        { update: { name: stakeName, fields: encodeFields({ userId, matchId, amount, createdAt: new Date(), status: 'RESERVED' }) }, currentDocument: { exists: false } },
      ],
    }),
  }, token);
  if (!response.ok) {
    if (await getRawDocument('gameStakes', stakeId, token)) return;
    throw new Error('게임 참가비 예약에 실패했습니다. 다시 시도해주세요.');
  }
}

export async function reserveGenderMatchStake(userId: string, callId: string, amount: number, token?: string): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const stakeId = `gender-${callId}-${userId}`;
  if (await getRawDocument('genderMatchStakes', stakeId, token)) return;
  const profileDocument = await getRawDocument('profiles', userId, token);
  if (!profileDocument?.name) throw new Error('프로필을 찾을 수 없습니다.');
  const currentBalance = Number(fromFirestoreValue(profileDocument.fields?.usdtBalance) || 0);
  if (currentBalance < amount) throw new Error(`성별 매칭 이용료 ${amount} USDT가 부족합니다.`);
  const profileName = `${firestoreBase}/profiles/${encodeURIComponent(userId)}`;
  const stakeName = `${firestoreBase}/genderMatchStakes/${encodeURIComponent(stakeId)}`;
  const response = await authenticatedFetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        { update: { name: profileName, fields: { ...(profileDocument.fields || {}), usdtBalance: toFirestoreValue(currentBalance - amount), updatedAt: toFirestoreValue(new Date()) } }, currentDocument: { updateTime: profileDocument.updateTime } },
        { update: { name: stakeName, fields: encodeFields({ userId, callId, amount, createdAt: new Date(), status: 'RESERVED' }) }, currentDocument: { exists: false } },
      ],
    }),
  }, token);
  if (!response.ok) {
    if (await getRawDocument('genderMatchStakes', stakeId, token)) return;
    throw new Error('성별 매칭 이용료 예약에 실패했습니다. 다시 시도해주세요.');
  }
}

export async function purchasePremiumSubscription(userId: string, token?: string): Promise<PortalUser> {
  const cost = 30;
  const profileDocument = await getRawDocument('profiles', userId, token);
  if (!profileDocument?.name || !profileDocument.updateTime) throw new Error('프로필을 찾을 수 없습니다.');
  const profile = decodeDocument<PortalUser>(profileDocument);
  const currentExpiry = profile.premiumExpiresAt ? new Date(profile.premiumExpiresAt) : null;
  if (profile.isSubscribed && (!currentExpiry || currentExpiry.getTime() > Date.now())) return (await refreshStoredUser()) || profile;
  const currentBalance = Number(profile.usdtBalance || 0);
  if (currentBalance < cost) throw new Error(`USDT 잔고가 부족합니다. (월정액 ${cost} USDT 필요)`);
  const nextExpiry = currentExpiry && currentExpiry.getTime() > Date.now() ? new Date(currentExpiry) : new Date();
  nextExpiry.setUTCMonth(nextExpiry.getUTCMonth() + 1);
  const subscriptionId = `premium-${userId}-${nextExpiry.toISOString().slice(0, 7)}`;
  if (await getRawDocument('premiumSubscriptions', subscriptionId, token)) return (await refreshStoredUser()) || profile;
  const profileName = `${firestoreBase}/profiles/${encodeURIComponent(userId)}`;
  const subscriptionName = `${firestoreBase}/premiumSubscriptions/${encodeURIComponent(subscriptionId)}`;
  const response = await authenticatedFetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        { update: { name: profileName, fields: { ...(profileDocument.fields || {}), usdtBalance: toFirestoreValue(currentBalance - cost), isSubscribed: toFirestoreValue(true), premiumExpiresAt: toFirestoreValue(nextExpiry), updatedAt: toFirestoreValue(new Date()) } }, currentDocument: { updateTime: profileDocument.updateTime } },
        { update: { name: subscriptionName, fields: encodeFields({ userId, amount: cost, startedAt: new Date(), expiresAt: nextExpiry, status: 'ACTIVE' }) }, currentDocument: { exists: false } },
      ],
    }),
  }, token);
  if (!response.ok) {
    if (await getRawDocument('premiumSubscriptions', subscriptionId, token)) return (await refreshStoredUser()) || profile;
    throw new Error('프리미엄 결제 처리 중 서버 원장 충돌이 발생했습니다. 잔고를 확인해주세요.');
  }
  return (await refreshStoredUser()) || { ...profile, usdtBalance: currentBalance - cost, isSubscribed: true, premiumExpiresAt: nextExpiry.toISOString() };
}

export async function reserveEscrowPurchase(
  buyerId: string,
  productId: string,
  sellerId: string,
  amount: number,
  token?: string,
): Promise<string> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('유효한 상품 금액이 아닙니다.');
  const orderId = `order-${buyerId}-${productId}-${crypto.randomUUID()}`;
  const buyerDocument = await getRawDocument('profiles', buyerId, token);
  if (!buyerDocument?.name) throw new Error('구매자 프로필을 찾을 수 없습니다.');
  const currentBalance = Number(fromFirestoreValue(buyerDocument.fields?.usdtBalance) || 0);
  if (currentBalance < amount) throw new Error(`잔고가 부족합니다. ${amount} USDT가 필요합니다.`);
  const profileName = `${firestoreBase}/profiles/${encodeURIComponent(buyerId)}`;
  const orderName = `${firestoreBase}/escrowOrders/${encodeURIComponent(orderId)}`;
  const profileFields = { ...(buyerDocument.fields || {}), usdtBalance: toFirestoreValue(currentBalance - amount), updatedAt: toFirestoreValue(new Date()) };
  const orderFields = encodeFields({ buyerId, sellerId, productId, amount, status: 'PAYMENT_HELD', createdAt: new Date(), updatedAt: new Date(), timeline: [{ status: 'PAYMENT_HELD', at: new Date(), note: '구매자 결제 금액을 에스크로에 보관했습니다.' }] });
  const response = await authenticatedFetch(`${firestoreBase}:commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      writes: [
        { update: { name: profileName, fields: profileFields }, currentDocument: { updateTime: buyerDocument.updateTime } },
        { update: { name: orderName, fields: orderFields }, currentDocument: { exists: false } },
      ],
    }),
  }, token);
  if (!response.ok) throw new Error('에스크로 주문을 생성하지 못했습니다. 다시 시도해주세요.');
  return orderId;
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

export async function refreshStoredUser(): Promise<PortalUser | null> {
  const session = getStoredSession();
  if (!session) return null;
  const profile = await getDocument<PortalUser>('profiles', session.user.id, session.idToken).catch(() => null);
  if (!profile) return session.user;
  const premiumExpiresAt = profile.premiumExpiresAt || session.user.premiumExpiresAt;
  const isSubscribed = Boolean(profile.isSubscribed && (!premiumExpiresAt || new Date(premiumExpiresAt).getTime() > Date.now()));
  const user = { ...session.user, ...profile, id: session.user.id, isSubscribed, premiumExpiresAt };
  if (typeof window !== 'undefined') window.localStorage.setItem(sessionKey, JSON.stringify({ ...session, user }));
  return user;
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
    genderPreference: savedProfile?.genderPreference,
    premiumExpiresAt: savedProfile?.premiumExpiresAt,
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
    ...(user.gender ? { gender: user.gender } : {}),
    ...(user.genderPreference ? { genderPreference: user.genderPreference } : {}),
    ...(user.premiumExpiresAt ? { premiumExpiresAt: user.premiumExpiresAt } : {}),
    updatedAt: new Date(),
  }, result.idToken);
  await upsertDocument('publicProfiles', user.id, {
    name: user.name,
    email: user.email,
    image: user.image,
    country: user.country || 'Global',
    gender: user.gender || '',
    genderPreference: user.genderPreference || 'any',
    isSubscribed: Boolean(user.isSubscribed),
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
    ...(user.genderPreference ? { genderPreference: user.genderPreference } : {}),
    ...(user.premiumExpiresAt ? { premiumExpiresAt: user.premiumExpiresAt } : {}),
    ...(user.age ? { age: user.age } : {}),
    ...(user.country ? { country: user.country } : {}),
    updatedAt: new Date(),
  }, token);
  await upsertDocument('publicProfiles', user.id, {
    name: user.name,
    email: user.email,
    image: user.image,
    country: user.country || 'Global',
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
  const presence = await queryDocumentsWhere<{ lastSeenAt?: string; userId?: string }>('presence', [{ field: 'lastSeenAt', op: 'GREATER_THAN', value: new Date(Date.now() - 90_000) }]);
  return presence.filter((item) => item.userId).length;
}

export async function listOnlineUsers(): Promise<OnlineUser[]> {
  const presence = await queryDocumentsWhere<Omit<OnlineUser, 'id'>>('presence', [{ field: 'lastSeenAt', op: 'GREATER_THAN', value: new Date(Date.now() - 90_000) }]);
  return presence
    .filter((item) => item.userId)
    .map((item) => ({ ...item, id: item.userId as string, userId: item.userId as string }))
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
}

export async function deleteDocument(collection: string, id: string, token?: string): Promise<void> {
  const response = await authenticatedFetch(`${firestoreBase}/${collection}/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, token);
  if (!response.ok && response.status !== 404) throw new Error(await response.text());
}

export async function deleteExpiredChatMessages(token?: string, collection = 'chatMessages'): Promise<number> {
  if (!token) return 0;
  const rows = await firestoreRequest<Array<{ document?: { name?: string; fields?: Record<string, FirestoreValue> } }>>(
    `${firestoreBase}:runQuery`,
    {
      method: 'POST',
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collection }],
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
  await Promise.all(expired.map((message) => deleteDocument(collection, message.id, token)));
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
