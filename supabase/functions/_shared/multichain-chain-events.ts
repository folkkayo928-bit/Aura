export type ChainFamily = "evm" | "solana" | "ton";
export type ChainEventInput = {
  networkKey: "ethereum" | "bsc" | "solana" | "ton";
  family: ChainFamily;
  assetKey: string;
  txHash: string;
  eventIndex: number;
  direction: "deposit" | "withdrawal";
  amountRaw: string;
  decimals: number;
  fromAddress?: string | null;
  toAddress?: string | null;
  blockNumber?: string | null;
};

export type NormalizedChainEvent = ChainEventInput & {
  txHash: string;
  amountRaw: string;
  fromAddress: string | null;
  toAddress: string | null;
  blockNumber: string | null;
  idempotencyKey: string;
};

/**
 * Validates and normalizes a parsed chain observation before persistence.
 * This function does not fetch chain data, establish finality, or credit a ledger.
 */
export function normalizeChainEvent(input: ChainEventInput): NormalizedChainEvent {
  if (!input || !["ethereum", "bsc", "solana", "ton"].includes(input.networkKey)) {
    throw new Error("UNSUPPORTED_NETWORK");
  }
  const expectedFamily: Record<ChainEventInput["networkKey"], ChainFamily> = {
    ethereum: "evm", bsc: "evm", solana: "solana", ton: "ton",
  };
  if (input.family !== expectedFamily[input.networkKey]) throw new Error("NETWORK_FAMILY_MISMATCH");
  if (typeof input.assetKey !== "string" || !/^[a-z0-9_]{3,80}$/.test(input.assetKey)) {
    throw new Error("INVALID_ASSET_KEY");
  }
  // The migration stores event_index as PostgreSQL integer (signed 32-bit).
  if (!Number.isInteger(input.eventIndex) || input.eventIndex < 0 || input.eventIndex > 2_147_483_647) {
    throw new Error("INVALID_EVENT_INDEX");
  }
  if (input.direction !== "deposit" && input.direction !== "withdrawal") {
    throw new Error("INVALID_EVENT_DIRECTION");
  }
  if (typeof input.txHash !== "string" || input.txHash.length < 16 || input.txHash.length > 160) {
    throw new Error("INVALID_TX_HASH");
  }
  let txHash = input.txHash;
  if (input.family === "evm") {
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) throw new Error("INVALID_TX_HASH");
    txHash = txHash.toLowerCase();
  } else if (!/^[A-Za-z0-9_+/=-]+$/.test(txHash)) {
    throw new Error("INVALID_TX_HASH");
  }
  if (typeof input.amountRaw !== "string" || !/^(0|[1-9][0-9]*)$/.test(input.amountRaw) || input.amountRaw.length > 78) {
    throw new Error("INVALID_RAW_AMOUNT");
  }
  if (!Number.isInteger(input.decimals) || input.decimals < 0 || input.decimals > 30) {
    throw new Error("INVALID_TOKEN_DECIMALS");
  }
  const normalizeAddress = (value: string | null | undefined) => {
    if (value == null || value === "") return null;
    if (typeof value !== "string" || value.length > 160 || value.trim() !== value) {
      throw new Error("INVALID_EVENT_ADDRESS");
    }
    if (input.family === "evm") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error("INVALID_EVENT_ADDRESS");
      return value.toLowerCase();
    }
    return value;
  };
  let blockNumber: string | null = null;
  if (input.blockNumber != null) {
    if (!/^(0|[1-9][0-9]*)$/.test(input.blockNumber) || input.blockNumber.length > 78) {
      throw new Error("INVALID_BLOCK_NUMBER");
    }
    blockNumber = input.blockNumber;
  }
  // Length-prefixing avoids ambiguous concatenation; retain non-EVM hash casing.
  const keyParts = [input.networkKey, input.assetKey, txHash, String(input.eventIndex)];
  const idempotencyKey = keyParts.map((part) => `${part.length}:${part}`).join("|");
  return {
    ...input,
    txHash,
    fromAddress: normalizeAddress(input.fromAddress),
    toAddress: normalizeAddress(input.toAddress),
    blockNumber,
    idempotencyKey,
  };
}
