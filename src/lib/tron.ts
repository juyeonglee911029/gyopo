export const TRON_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
export const TRON_USDT_DECIMALS = 6;
export const TRON_NETWORK = 'TRC20';

type TronTransaction = Record<string, unknown> & { txID?: string };

type TronWebLike = {
  defaultAddress?: { base58?: string };
  address: { toHex: (address: string) => string };
  transactionBuilder: {
    triggerSmartContract: (
      contractAddress: string,
      functionSelector: string,
      options: { feeLimit: number },
      parameters: Array<{ type: string; value: string }>,
      issuerAddress: string,
    ) => Promise<{ result?: { result?: boolean }; transaction?: TronTransaction }>;
  };
  trx: {
    sign: (transaction: TronTransaction) => Promise<TronTransaction>;
    sendRawTransaction: (transaction: TronTransaction) => Promise<{ result?: boolean; txid?: string }>;
  };
};

type TronLinkLike = {
  request: (request: { method: string }) => Promise<unknown>;
};

declare global {
  interface Window {
    tronLink?: TronLinkLike;
    tronWeb?: TronWebLike;
  }
}

function getProvider(): { tronLink: TronLinkLike; tronWeb: TronWebLike } {
  if (typeof window === 'undefined' || !window.tronLink || !window.tronWeb) {
    throw new Error('TronLink 지갑 확장이 필요합니다. TronLink을 설치하고 잠금 해제해주세요.');
  }
  return { tronLink: window.tronLink, tronWeb: window.tronWeb };
}

export function isValidTronAddress(value: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value.trim());
}

export async function connectTronLink(): Promise<string> {
  const { tronLink, tronWeb } = getProvider();
  await tronLink.request({ method: 'tron_requestAccounts' });
  const address = tronWeb.defaultAddress?.base58?.trim() || '';
  if (!isValidTronAddress(address)) throw new Error('TronLink에서 활성화된 TRON 지갑을 찾지 못했습니다.');
  return address;
}

export async function sendUsdtWithTronLink(targetAddress: string, amount: number, expectedSender?: string): Promise<{ txHash: string; from: string; to: string; amount: number }> {
  if (!isValidTronAddress(targetAddress)) throw new Error('받는 지갑 주소가 올바르지 않습니다.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('송금 금액이 올바르지 않습니다.');

  const { tronWeb } = getProvider();
  const sender = await connectTronLink();
  if (expectedSender && sender !== expectedSender) {
    throw new Error('TronLink의 활성 지갑이 프로필에 등록된 지갑과 다릅니다.');
  }

  const rawAmount = String(Math.round(amount * (10 ** TRON_USDT_DECIMALS)));
  const built = await tronWeb.transactionBuilder.triggerSmartContract(
    TRON_USDT_CONTRACT,
    'transfer(address,uint256)',
    { feeLimit: 100_000_000 },
    [
      { type: 'address', value: tronWeb.address.toHex(targetAddress) },
      { type: 'uint256', value: rawAmount },
    ],
    sender,
  );
  if (!built.transaction || built.result?.result === false) throw new Error('송금 트랜잭션을 생성하지 못했습니다.');

  const signed = await tronWeb.trx.sign(built.transaction);
  const broadcast = await tronWeb.trx.sendRawTransaction(signed);
  if (broadcast.result === false) throw new Error('TRON 네트워크가 송금 트랜잭션을 거부했습니다.');
  const txHash = broadcast.txid || signed.txID || '';
  if (!txHash) throw new Error('송금은 제출되었지만 트랜잭션 ID를 받지 못했습니다.');
  return { txHash, from: sender, to: targetAddress, amount };
}
