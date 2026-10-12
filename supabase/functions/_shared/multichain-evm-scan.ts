import { parseEvmUsdtTransferLog, type EvmTransferLog } from "./evm-transfer-log.ts";

export type EvmNetworkKey = "ethereum" | "bsc";
export type EvmReadRpc = (method: string, params: unknown[]) => Promise<unknown>;

const NETWORKS = {
  ethereum: {
    chainId: 1n,
    token: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    minConfirmations: 12,
  },
  bsc: {
    chainId: 56n,
    token: "0x55d398326f99059ff775485246999027b3197955",
    minConfirmations: 15,
  },
} as const;

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export type EvmFinalizedScan = {
  networkKey: EvmNetworkKey;
  latestBlock: string;
  finalizedHead: string;
  fromBlock: string;
  toBlock: string;
  events: ReturnType<typeof parseEvmUsdtTransferLog>[];
};

/**
 * Fetches a bounded ERC-20 Transfer log range for an explicitly configured
 * Ethereum/BSC RPC. Does not persist events, advance cursors, or credit balances.
 * Callers must verify registry/recipient ownership and atomically commit events
 * plus cursor using commit_wallet_chain_scan_range.
 */
export async function fetchFinalizedEvmUsdtTransfers(input: {
  networkKey: EvmNetworkKey;
  fromBlock: string;
  toBlock: string;
  rpc: EvmReadRpc;
  maxBlocks?: number;
  recipientAddresses: string[];
  recipientBatchSize?: number;
}): Promise<EvmFinalizedScan> {
  if (!input || (input.networkKey !== "ethereum" && input.networkKey !== "bsc")) {
    throw new Error("UNSUPPORTED_EVM_NETWORK");
  }
  const from = parseHeight(input.fromBlock, "from_block");
  const to = parseHeight(input.toBlock, "to_block");
  const maxBlocks = input.maxBlocks ?? 2_000;
  if (!Number.isSafeInteger(maxBlocks) || maxBlocks < 1 || maxBlocks > 10_000) {
    throw new Error("INVALID_MAX_BLOCKS");
  }
  if (to < from) throw new Error("INVALID_SCAN_RANGE");
  if (to - from + 1n > BigInt(maxBlocks)) throw new Error("SCAN_RANGE_TOO_LARGE");

  if (!Array.isArray(input.recipientAddresses) || input.recipientAddresses.length > 5_000) {
    throw new Error("INVALID_RECIPIENT_ADDRESSES");
  }
  const recipients = [...new Set(input.recipientAddresses.map((address) => {
    if (typeof address !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      throw new Error("INVALID_RECIPIENT_ADDRESS");
    }
    return address.toLowerCase();
  }))];
  const recipientBatchSize = input.recipientBatchSize ?? 100;
  if (!Number.isSafeInteger(recipientBatchSize) || recipientBatchSize < 1 || recipientBatchSize > 100) {
    throw new Error("INVALID_RECIPIENT_BATCH_SIZE");
  }

  const network = NETWORKS[input.networkKey];
  const rawChainId = await input.rpc("eth_chainId", []);
  const chainId = parseRpcHex(rawChainId, "chain_id");
  if (chainId !== network.chainId) throw new Error("RPC_CHAIN_ID_MISMATCH");

  const latestBlock = parseRpcHex(await input.rpc("eth_blockNumber", []), "latest_block");
  if (latestBlock < BigInt(network.minConfirmations)) {
    throw new Error("CHAIN_HEAD_BELOW_FINALITY_DEPTH");
  }
  const finalizedHead = latestBlock - BigInt(network.minConfirmations);
  if (to > finalizedHead) throw new Error("SCAN_RANGE_NOT_FINALIZED");

  const logsByIdentity = new Map<string, EvmTransferLog>();
  for (let offset = 0; offset < recipients.length; offset += recipientBatchSize) {
    const batch = recipients.slice(offset, offset + recipientBatchSize);
    const rawLogs = await input.rpc("eth_getLogs", [{
      fromBlock: "0x" + from.toString(16),
      toBlock: "0x" + to.toString(16),
      address: network.token,
      topics: [TRANSFER_TOPIC, null, batch.map((address) => "0x" + address.slice(2).padStart(64, "0"))],
    }]);
    if (!Array.isArray(rawLogs)) throw new Error("RPC_LOG_RESPONSE_INVALID");
    for (const raw of rawLogs) {
      if (!raw || typeof raw !== "object") throw new Error("RPC_LOG_RESPONSE_INVALID");
      const event = parseEvmUsdtTransferLog(input.networkKey, raw as EvmTransferLog);
      if (!event) throw new Error("RPC_RETURNED_NONMATCHING_LOG");
      if (!event.toAddress || !recipients.includes(event.toAddress.toLowerCase())) {
        throw new Error("RPC_LOG_RECIPIENT_MISMATCH");
      }
      if (event.blockNumber === null) throw new Error("RPC_LOG_MISSING_BLOCK_NUMBER");
      const eventBlock = BigInt(event.blockNumber);
      if (eventBlock < from || eventBlock > to) throw new Error("RPC_LOG_OUTSIDE_SCAN_RANGE");
      const identity = event.txHash + ":" + event.eventIndex;
      const existing = logsByIdentity.get(identity);
      if (existing) {
        const prior = parseEvmUsdtTransferLog(input.networkKey, existing);
        if (!prior || prior.amountRaw !== event.amountRaw || prior.toAddress !== event.toAddress) {
          throw new Error("RPC_LOG_IDENTITY_CONFLICT");
        }
      } else {
        logsByIdentity.set(identity, raw as EvmTransferLog);
      }
    }
  }
  const events = [...logsByIdentity.values()].map((raw) => {
    const event = parseEvmUsdtTransferLog(input.networkKey, raw);
    if (!event) throw new Error("RPC_RETURNED_NONMATCHING_LOG");
    return event;
  });

  return {
    networkKey: input.networkKey,
    latestBlock: latestBlock.toString(),
    finalizedHead: finalizedHead.toString(),
    fromBlock: from.toString(),
    toBlock: to.toString(),
    events,
  };
}

function parseHeight(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78) {
    throw new Error("INVALID_" + name.toUpperCase());
  }
  return BigInt(value);
}

function parseRpcHex(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) {
    throw new Error("INVALID_RPC_" + name.toUpperCase());
  }
  return BigInt(value);
}
