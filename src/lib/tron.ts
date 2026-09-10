'use client';

export const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const TRON_USDT_DECIMALS = 6;

type TronContract = {
  balanceOf: (address: string) => { call: () => Promise<unknown> };
  transfer: (address: string, amount: string) => { send: (options?: { feeLimit?: number }) => Promise<unknown> };
};

type TronWebLike = {
  defaultAddress?: { base58?: string; hex?: string };
  isAddress?: (address: string) => boolean;
  address?: { fromHex?: (address: string) => string };
  contract: () => { at: (address: string) => Promise<TronContract> };
};

type TronWindow = Window & {
  tronLink?: { tronWeb?: TronWebLike; request?: (args: { method: string }) => Promise<unknown> };
  tronWeb?: TronWebLike;
};

function getTronWeb(): TronWebLike {
  const browser = window as TronWindow;
  const tronWeb = browser.tronLink?.tronWeb || browser.tronWeb;
  if (!tronWeb) throw new Error('TronLink 지갑을 설치하고 연결해주세요.');
  return tronWeb;
}

function toAtomicUnits(amount: number | string): string {
  const value = String(amount).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(value) || Number(value) <= 0) throw new Error('올바른 USDT 금액을 입력해주세요.');
  const atomic = Math.round(Number(value) * 1_000_000);
  if (!Number.isSafeInteger(atomic)) throw new Error('송금 금액이 너무 큽니다.');
  return String(atomic);
}

export function isTronLinkAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const browser = window as TronWindow;
  return Boolean(browser.tronLink?.tronWeb || browser.tronLink?.request || browser.tronWeb);
}

export async function connectTronWallet(): Promise<string> {
  const browser = window as TronWindow;
  if (browser.tronLink?.request) await browser.tronLink.request({ method: 'tron_requestAccounts' });
  const tronWeb = getTronWeb();
  const address = tronWeb.defaultAddress?.base58 || (tronWeb.defaultAddress?.hex && tronWeb.address?.fromHex ? tronWeb.address.fromHex(tronWeb.defaultAddress.hex) : '');
  if (!address || tronWeb.isAddress?.(address) === false) throw new Error('TRON 지갑 주소를 확인할 수 없습니다.');
  return address;
}

export async function getUsdtBalance(address: string): Promise<number> {
  const tronWeb = getTronWeb();
  const contract = await tronWeb.contract().at(TRON_USDT_CONTRACT);
  const raw = await contract.balanceOf(address).call();
  return Number(raw) / 10 ** TRON_USDT_DECIMALS;
}

export async function sendUsdt(address: string, amount: number | string): Promise<string> {
  const tronWeb = getTronWeb();
  if (!tronWeb.isAddress?.(address)) throw new Error('받는 사람의 TRON 주소가 올바르지 않습니다.');
  const contract = await tronWeb.contract().at(TRON_USDT_CONTRACT);
  const result = await contract.transfer(address, toAtomicUnits(amount)).send({ feeLimit: 150_000_000 });
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const record = result as { txid?: string; transaction?: { txID?: string } };
    if (record.txid) return record.txid;
    if (record.transaction?.txID) return record.transaction.txID;
  }
  return String(result);
}



export async function provisionTronWallet(userId: string, token: string): Promise<{ address: string; network: string; status: 'CUSTODIAL'; createdAt?: string }> {
  const response = await fetch('/api/tron/wallet', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const result = await response.json() as { address?: string; network?: string; status?: 'CUSTODIAL'; createdAt?: string; error?: string };
  if (!response.ok || !result.address) throw new Error(result.error || '자동 TRON 지갑을 발급하지 못했습니다.');
  return { address: result.address, network: result.network || 'TRC20', status: result.status || 'CUSTODIAL', createdAt: result.createdAt };
}
'use client';

export const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const TRON_USDT_DECIMALS = 6;

type TronContract = {
  balanceOf: (address: string) => { call: () => Promise<unknown> };
  transfer: (address: string, amount: string) => { send: (options?: { feeLimit?: number }) => Promise<unknown> };
};

type TronWebLike = {
  defaultAddress?: { base58?: string; hex?: string };
  isAddress?: (address: string) => boolean;
  address?: { fromHex?: (address: string) => string };
  contract: () => { at: (address: string) => Promise<TronContract> };
};

type TronWindow = Window & {
  tronLink?: { tronWeb?: TronWebLike; request?: (args: { method: string }) => Promise<unknown> };
  tronWeb?: TronWebLike;
};

function getTronWeb(): TronWebLike {
  const browser = window as TronWindow;
  const tronWeb = browser.tronLink?.tronWeb || browser.tronWeb;
  if (!tronWeb) throw new Error('TronLink 지갑을 설치하고 연결해주세요.');
  return tronWeb;
}

function toAtomicUnits(amount: number | string): string {
  const value = String(amount).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(value) || Number(value) <= 0) throw new Error('올바른 USDT 금액을 입력해주세요.');
  const atomic = Math.round(Number(value) * 1_000_000);
  if (!Number.isSafeInteger(atomic)) throw new Error('송금 금액이 너무 큽니다.');
  return String(atomic);
}

export function isTronLinkAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const browser = window as TronWindow;
  return Boolean(browser.tronLink?.tronWeb || browser.tronLink?.request || browser.tronWeb);
}

export async function connectTronWallet(): Promise<string> {
  const browser = window as TronWindow;
  if (browser.tronLink?.request) await browser.tronLink.request({ method: 'tron_requestAccounts' });
  const tronWeb = getTronWeb();
  const address = tronWeb.defaultAddress?.base58 || (tronWeb.defaultAddress?.hex && tronWeb.address?.fromHex ? tronWeb.address.fromHex(tronWeb.defaultAddress.hex) : '');
  if (!address || tronWeb.isAddress?.(address) === false) throw new Error('TRON 지갑 주소를 확인할 수 없습니다.');
  return address;
}

export async function getUsdtBalance(address: string): Promise<number> {
  const tronWeb = getTronWeb();
  const contract = await tronWeb.contract().at(TRON_USDT_CONTRACT);
  const raw = await contract.balanceOf(address).call();
  return Number(raw) / 10 ** TRON_USDT_DECIMALS;
}

export async function sendUsdt(address: string, amount: number | string): Promise<string> {
  const tronWeb = getTronWeb();
  if (!tronWeb.isAddress?.(address)) throw new Error('받는 사람의 TRON 주소가 올바르지 않습니다.');
  const contract = await tronWeb.contract().at(TRON_USDT_CONTRACT);
  const result = await contract.transfer(address, toAtomicUnits(amount)).send({ feeLimit: 150_000_000 });
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    const record = result as { txid?: string; transaction?: { txID?: string } };
    if (record.txid) return record.txid;
    if (record.transaction?.txID) return record.transaction.txID;
  }
  return String(result);
}

