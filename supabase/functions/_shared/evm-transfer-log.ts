import { normalizeChainEvent, type NormalizedChainEvent } from "./multichain-chain-events.ts";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TOKEN_BY_NETWORK = {
  ethereum: { assetKey: "usdt_ethereum", address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
  bsc: { assetKey: "usdt_bsc", address: "0x55d398326f99059ff775485246999027b3197955", decimals: 18 },
} as const;

export type EvmTransferLog = {
  address?: unknown;
  topics?: unknown;
  data?: unknown;
  transactionHash?: unknown;
  logIndex?: unknown;
  blockNumber?: unknown;
  removed?: unknown;
};

function asHex(value: unknown, length: number, error: string): string {
  if (typeof value !== "string" || !new RegExp("^0x[0-9a-fA-F]{" + length + "}$").test(value)) {
    throw new Error(error);
  }
  return value;
}

/**
 * Parses only ERC-20 Transfer logs for AURA's currently reviewed candidate
 * Ethereum/BSC token addresses. It is read-only: callers must separately verify
 * destination ownership, chain finality, registry enablement, and ledger policy.
 */
export function parseEvmUsdtTransferLog(
  networkKey: "ethereum" | "bsc",
  log: EvmTransferLog,
): NormalizedChainEvent | null {
  if (!log || typeof log !== "object") throw new Error("INVALID_EVM_LOG");
  const token = TOKEN_BY_NETWORK[networkKey];
  if (typeof log.address !== "string" || log.address.toLowerCase() !== token.address) return null;
  if (!Array.isArray(log.topics) || log.topics.length < 3) throw new Error("INVALID_TRANSFER_TOPICS");
  if (typeof log.topics[0] !== "string" || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) return null;
  if (log.removed === true) throw new Error("REMOVED_LOG_REORG");
  const fromTopic = asHex(log.topics[1], 64, "INVALID_TRANSFER_FROM");
  const toTopic = asHex(log.topics[2], 64, "INVALID_TRANSFER_TO");
  const data = asHex(log.data, 64, "INVALID_TRANSFER_AMOUNT");
  const txHash = asHex(log.transactionHash, 64, "INVALID_TX_HASH");
  const logIndexHex = typeof log.logIndex === "string" && /^0x[0-9a-fA-F]+$/.test(log.logIndex)
    ? log.logIndex
    : null;
  if (!logIndexHex) throw new Error("INVALID_LOG_INDEX");
  const eventIndex = Number(BigInt(logIndexHex));
  if (!Number.isSafeInteger(eventIndex) || eventIndex > 2_147_483_647) throw new Error("INVALID_LOG_INDEX");
  let blockNumber: string | null = null;
  if (log.blockNumber != null) {
    if (typeof log.blockNumber !== "string" || !/^0x[0-9a-fA-F]+$/.test(log.blockNumber)) {
      throw new Error("INVALID_BLOCK_NUMBER");
    }
    blockNumber = BigInt(log.blockNumber).toString();
  }
  return normalizeChainEvent({
    networkKey,
    family: "evm",
    assetKey: token.assetKey,
    txHash,
    eventIndex,
    direction: "deposit",
    amountRaw: BigInt(data).toString(),
    decimals: token.decimals,
    fromAddress: "0x" + fromTopic.slice(-40),
    toAddress: "0x" + toTopic.slice(-40),
    blockNumber,
  });
}
