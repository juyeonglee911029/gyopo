import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2';
import { keccak_256 } from '@noble/hashes/sha3';
import { consumeRateLimit, rateLimitResponse, requireAuthenticatedUser, unauthorizedResponse } from '@/lib/apiSecurity';

export const runtime = 'edge';

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/gyopo-live-portal-506019/databases/(default)/documents';
const NETWORK = 'TRC20';
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

type WalletResult = { address: string; network: string; status: 'CUSTODIAL'; createdAt?: string };

type FirestoreDocument = {
  fields?: { address?: { stringValue?: string }; network?: { stringValue?: string }; createdAt?: { timestampValue?: string } };
};

function base64(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base58Encode(bytes: Uint8Array): string {
  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let index = 0; index < digits.length; index += 1) {
      const value = digits[index] * 256 + carry;
      digits[index] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  return '1'.repeat(leadingZeroes) + digits.reverse().map((digit) => BASE58[digit]).join('');
}

function tronAddress(privateKey: Uint8Array): string {
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const raw = new Uint8Array(21);
  raw[0] = 0x41;
  raw.set(keccak_256(publicKey.slice(1)).slice(-20), 1);
  const checksum = sha256(sha256(raw)).slice(0, 4);
  const payload = new Uint8Array(25);
  payload.set(raw);
  payload.set(checksum, 21);
  return base58Encode(payload);
}

async function encryptPrivateKey(privateKey: Uint8Array): Promise<{ ciphertext: string; iv: string }> {
  const masterKey = process.env.WALLET_MASTER_KEY;
  if (!masterKey) throw new Error('WALLET_MASTER_KEY is not configured.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(masterKey));
  const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, privateKey as unknown as BufferSource);
  return { ciphertext: base64(new Uint8Array(encrypted)), iv: base64(iv) };
}

async function readWallet(userId: string, token: string): Promise<WalletResult | null> {
  const response = await fetch(FIRESTORE_BASE + '/walletVault/' + encodeURIComponent(userId), { headers: { Authorization: 'Bearer ' + token } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('기존 자동 지갑을 확인하지 못했습니다.');
  const document = await response.json() as FirestoreDocument;
  const address = document.fields?.address?.stringValue;
  if (!address) throw new Error('자동 지갑 주소가 올바르지 않습니다.');
  return { address, network: document.fields?.network?.stringValue || NETWORK, status: 'CUSTODIAL', createdAt: document.fields?.createdAt?.timestampValue };
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAuthenticatedUser(request);
  } catch (error) {
    return unauthorizedResponse(error);
  }
  const rate = consumeRateLimit(`tron-wallet:${user.uid}`, 3, 60 * 60_000);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterMs);
  const token = user.token;
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 4_000) return Response.json({ error: '요청 데이터가 너무 큽니다.' }, { status: 413 });
  const rawBody = await request.text().catch(() => '');
  if (rawBody.length > 4_000) return Response.json({ error: '요청 데이터가 너무 큽니다.' }, { status: 413 });
  let body: { userId?: string } = {};
  try {
    body = JSON.parse(rawBody || '{}') as { userId?: string };
  } catch {
    return Response.json({ error: '요청 데이터 형식이 올바르지 않습니다.' }, { status: 400 });
  }
  const userId = (typeof body.userId === 'string' ? body.userId.trim() : '') || user.uid;
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(userId)) return Response.json({ error: '회원 식별자가 올바르지 않습니다.' }, { status: 400 });
  if (userId !== user.uid) return Response.json({ error: '본인 계정의 자동 지갑만 발급할 수 있습니다.' }, { status: 403 });

  try {
    const existing = await readWallet(userId, token);
    if (existing) return Response.json(existing, { headers: { 'Cache-Control': 'no-store' } });

    const privateKey = secp256k1.utils.randomSecretKey();
    const address = tronAddress(privateKey);
    const encrypted = await encryptPrivateKey(privateKey);
    const createdAt = new Date().toISOString();
    const response = await fetch(FIRESTORE_BASE + '/walletVault?documentId=' + encodeURIComponent(userId), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        userId: { stringValue: userId },
        address: { stringValue: address },
        network: { stringValue: NETWORK },
        encryptedPrivateKey: { stringValue: encrypted.ciphertext },
        iv: { stringValue: encrypted.iv },
        immutable: { booleanValue: true },
        createdAt: { timestampValue: createdAt },
      } }),
    });
    if (response.status === 409) {
      const raced = await readWallet(userId, token);
      if (raced) return Response.json(raced, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!response.ok) return Response.json({ error: '자동 지갑을 저장하지 못했습니다.' }, { status: 502 });
    return Response.json({ address, network: NETWORK, status: 'CUSTODIAL', createdAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '자동 지갑 발급에 실패했습니다.' }, { status: 500 });
  }
}
