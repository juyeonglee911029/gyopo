export type AdminFirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: AdminFirestoreValue[] } }
  | { mapValue: { fields?: Record<string, AdminFirestoreValue> } };

type AdminFirestoreDocument = {
  name?: string;
  updateTime?: string;
  fields?: Record<string, AdminFirestoreValue>;
};

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

const defaultProjectId = 'gyopo-live-portal-506019';

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function pemToBytes(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\s/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function serviceAccount(): ServiceAccount {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON 설정이 필요합니다.');
  const account = JSON.parse(raw) as ServiceAccount;
  if (!account.client_email || !account.private_key) throw new Error('Firebase 서비스 계정 JSON이 올바르지 않습니다.');
  return account;
}

async function accessToken(scope = 'https://www.googleapis.com/auth/datastore'): Promise<{ token: string; projectId: string }> {
  const account = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: 'RS256', typ: 'JWT' });
  const payload = encodeJson({
    iss: account.client_email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3_600,
  });
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(account.private_key!.replaceAll('\\n', '\n')),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${payload}`));
  const assertion = `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const result = await response.json() as { access_token?: string; error?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error || 'Firebase 관리자 인증에 실패했습니다.');
  return { token: result.access_token, projectId: account.project_id || process.env.FIREBASE_PROJECT_ID || defaultProjectId };
}

export async function serviceAccountAccessToken(scope: string): Promise<string> {
  return (await accessToken(scope)).token;
}

function documentName(projectId: string, collection: string, id: string): string {
  return `projects/${projectId}/databases/(default)/documents/${collection}/${id}`;
}

function documentUrl(projectId: string, collection: string, id: string): string {
  return `https://firestore.googleapis.com/v1/${documentName(projectId, collection, encodeURIComponent(id))}`;
}

function firestoreNumber(value?: AdminFirestoreValue): number {
  if (!value) return 0;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  return 0;
}

function decodeFirestoreValue(value: AdminFirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map((item) => decodeFirestoreValue(item));
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeFirestoreValue(item)]));
  return undefined;
}

function firestoreValue(value: unknown): AdminFirestoreValue {
  if (typeof value === 'number' && Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value === null) return { nullValue: null };
  return { stringValue: String(value) };
}

async function adminRequest(path: (projectId: string) => string, options: RequestInit = {}): Promise<Response> {
  const auth = await accessToken();
  const headers = new Headers(options.headers);
  headers.set('authorization', `Bearer ${auth.token}`);
  headers.set('content-type', 'application/json');
  return fetch(path(auth.projectId), { ...options, headers });
}

async function getDocument(collection: string, id: string): Promise<AdminFirestoreDocument | null> {
  const response = await adminRequest((projectId) => documentUrl(projectId, collection, id));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firebase 문서 조회 실패: ${response.status}`);
  return await response.json() as AdminFirestoreDocument;
}

export async function listAdminJsonDocuments(collection: string): Promise<Array<{ id: string; data: Record<string, unknown>; updatedAt?: string }>> {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(collection)) throw new Error('Firestore 컬렉션 이름이 올바르지 않습니다.');
  const response = await adminRequest((projectId) => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=300`);
  if (!response.ok) throw new Error(`Firebase 문서 목록 조회 실패: ${response.status}`);
  const payload = await response.json() as { documents?: AdminFirestoreDocument[] };
  return (payload.documents || []).map((document) => {
    const id = decodeURIComponent(document.name?.split('/').pop() || '');
    const raw = document.fields?.payload;
    let data: Record<string, unknown> = {};
    if (raw && 'stringValue' in raw) {
      try { data = JSON.parse(raw.stringValue) as Record<string, unknown>; } catch { data = {}; }
    }
    return { id, data, updatedAt: document.fields?.updatedAt && 'timestampValue' in document.fields.updatedAt ? document.fields.updatedAt.timestampValue : undefined };
  });
}

export async function listAdminDocuments(collection: string): Promise<Array<{ id: string; data: Record<string, unknown>; updatedAt?: string }>> {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(collection)) throw new Error('Firestore 컬렉션 이름이 올바르지 않습니다.');
  const response = await adminRequest((projectId) => `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=300`);
  if (!response.ok) throw new Error(`Firebase 문서 목록 조회 실패: ${response.status}`);
  const payload = await response.json() as { documents?: AdminFirestoreDocument[] };
  return (payload.documents || []).map((document) => ({
    id: decodeURIComponent(document.name?.split('/').pop() || ''),
    data: Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)])),
    updatedAt: document.updateTime,
  }));
}

export async function upsertAdminJsonDocument(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
  if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(collection) || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Firestore 문서 식별자가 올바르지 않습니다.');
  const now = new Date().toISOString();
  const response = await adminRequest((projectId) => documentUrl(projectId, collection, id), {
    method: 'PATCH',
    body: JSON.stringify({ fields: { payload: { stringValue: JSON.stringify(data) }, updatedAt: { timestampValue: now } } }),
  });
  if (!response.ok) throw new Error(`Firebase 문서 저장 실패: ${response.status}`);
}

export async function creditUsdBalance(params: { userId: string; transactionId: string; amountUsd: number; currencyCode: string }): Promise<{ amountUsd: number; alreadyCredited: boolean }> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.userId)) throw new Error('결제 회원 식별자가 올바르지 않습니다.');
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(params.transactionId)) throw new Error('결제 식별자가 올바르지 않습니다.');
  if (!Number.isFinite(params.amountUsd) || params.amountUsd <= 0 || params.amountUsd > 1_000_000) throw new Error('USD 충전 금액이 올바르지 않습니다.');
  if (params.currencyCode !== 'USD') throw new Error('USD 결제만 잔액에 반영할 수 있습니다.');

  const [profile, payment] = await Promise.all([
    getDocument('profiles', params.userId),
    getDocument('paddlePayments', params.transactionId),
  ]);
  if (payment?.name) {
    const creditedAmount = firestoreNumber(payment.fields?.amountUsd);
    if (!Number.isFinite(creditedAmount) || creditedAmount <= 0) throw new Error('기존 결제 원장의 금액이 올바르지 않습니다.');
    return { amountUsd: creditedAmount, alreadyCredited: true };
  }
  if (!profile?.name || !profile.updateTime) throw new Error('결제 회원 프로필을 찾을 수 없습니다.');

   const currentBalance = firestoreNumber(profile.fields?.usdBalance);
  if (!Number.isFinite(currentBalance) || currentBalance < 0) throw new Error('회원 USD 잔액 원장이 올바르지 않습니다.');
  const amountUsd = Math.round(params.amountUsd * 100) / 100;
  const now = new Date().toISOString();
  const auth = await accessToken();
  const paymentName = documentName(auth.projectId, 'paddlePayments', params.transactionId);
  const ledgerName = documentName(auth.projectId, 'walletLedger', `paddle-${params.transactionId}`);
  const profileFields = {
    ...(profile.fields || {}),
    usdBalance: firestoreValue(Math.round((currentBalance + amountUsd) * 100) / 100),
    updatedAt: { timestampValue: now },
  };
  const paymentFields = {
    transactionId: firestoreValue(params.transactionId),
    userId: firestoreValue(params.userId),
     amountUsd: firestoreValue(amountUsd),
    currencyCode: firestoreValue(params.currencyCode),
    status: firestoreValue('COMPLETED'),
    createdAt: { timestampValue: now },
  };
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${auth.projectId}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      writes: [
        { update: { name: profile.name, fields: profileFields }, currentDocument: { updateTime: profile.updateTime } },
        { update: { name: paymentName, fields: paymentFields }, currentDocument: { exists: false } },
        { update: { name: ledgerName, fields: {
          userId: firestoreValue(params.userId),
          type: firestoreValue('DEPOSIT'),
          direction: firestoreValue('IN'),
           amount: firestoreValue(amountUsd),
          status: firestoreValue('COMPLETED'),
          network: firestoreValue('Paddle'),
          symbol: firestoreValue('USD'),
          requestId: firestoreValue(params.transactionId),
          memo: firestoreValue('Paddle 카드 결제 USD 충전'),
          createdAt: { timestampValue: now },
        } }, currentDocument: { exists: false } },
      ],
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    if (body.includes('ALREADY_EXISTS')) return { amountUsd, alreadyCredited: true };
    throw new Error('결제 금액을 USD 잔액에 반영하지 못했습니다.');
  }
  return { amountUsd, alreadyCredited: false };
}
