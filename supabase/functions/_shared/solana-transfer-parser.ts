import { normalizeChainEvent, type NormalizedChainEvent } from "./multichain-chain-events.ts";

const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;

function tokenAccountMeta(value: unknown, accountKeys: string[]) {
  if (!Array.isArray(value)) return new Map<string, { mint: string; owner: string; decimals: number }>();
  const result = new Map<string, { mint: string; owner: string; decimals: number }>();
  for (const entry of value) {
    const item = record(entry);
    if (!item || !Number.isInteger(item.accountIndex) || typeof item.mint !== "string" ||
        typeof item.owner !== "string") continue;
    const key = accountKeys[Number(item.accountIndex)];
    const tokenAmount = record(item.uiTokenAmount);
    const decimals = tokenAmount?.decimals;
    if (!key || !Number.isInteger(decimals)) continue;
    result.set(key, { mint: item.mint, owner: item.owner, decimals: Number(decimals) });
  }
  return result;
}

function parsedTransfer(instruction: unknown) {
  const item = record(instruction);
  const parsed = record(item?.parsed);
  if (item?.program !== "spl-token" || !parsed ||
      (parsed.type !== "transfer" && parsed.type !== "transferChecked")) return null;
  const info = record(parsed.info);
  if (!info || typeof info.destination !== "string" || typeof info.source !== "string") return null;
  const tokenAmount = record(info.tokenAmount);
  const amount = typeof tokenAmount?.amount === "string" ? tokenAmount.amount : info.amount;
  const decimals = tokenAmount?.decimals;
  const mint = typeof info.mint === "string" ? info.mint : null;
  if (typeof amount !== "string" || !/^(0|[1-9][0-9]*)$/.test(amount)) return null;
  return {
    source: info.source,
    destination: info.destination,
    amount,
    decimals: Number.isInteger(decimals) ? Number(decimals) : null,
    mint,
  };
}

/**
 * Extracts incoming USDT SPL token transfers from a confirmed jsonParsed
 * getTransaction result. It does not fetch RPC data, credit a ledger, or decide
 * finality. Destination ownership is accepted only when Solana token-balance
 * metadata identifies the destination token account's owner.
 */
export function parseSolanaUsdtTransfers(
  transaction: unknown,
  walletAddress: string,
): NormalizedChainEvent[] {
  if (typeof walletAddress !== "string" || walletAddress.length < 8 || walletAddress.length > 160) {
    throw new Error("INVALID_WALLET_ADDRESS");
  }
  const root = record(transaction);
  const tx = record(root?.transaction);
  const message = record(tx?.message);
  const meta = record(root?.meta);
  if (!root || !tx || !message || !meta) throw new Error("INVALID_SOLANA_TRANSACTION");
  if (meta.err !== null && meta.err !== undefined) return [];
  const signatures = tx.signatures;
  if (!Array.isArray(signatures) || typeof signatures[0] !== "string") {
    throw new Error("INVALID_SOLANA_SIGNATURE");
  }
  const slot = root.slot;
  if (!Number.isSafeInteger(slot) || Number(slot) < 0) throw new Error("INVALID_SOLANA_SLOT");
  const rawKeys = message.accountKeys;
  if (!Array.isArray(rawKeys)) throw new Error("INVALID_SOLANA_ACCOUNT_KEYS");
  const accountKeys = rawKeys.map((key) => {
    if (typeof key === "string") return key;
    const item = record(key);
    return typeof item?.pubkey === "string" ? item.pubkey : "";
  });
  const balances = tokenAccountMeta(meta.postTokenBalances, accountKeys);
  const preBalances = tokenAccountMeta(meta.preTokenBalances, accountKeys);
  for (const [key, value] of preBalances) if (!balances.has(key)) balances.set(key, value);

  const instructions = Array.isArray(message.instructions) ? message.instructions : [];
  const innerGroups = Array.isArray(meta.innerInstructions) ? meta.innerInstructions : [];
  const innerByParent = new Map<number, unknown[]>();
  for (const groupValue of innerGroups) {
    const group = record(groupValue);
    if (!group || !Number.isInteger(group.index) || !Array.isArray(group.instructions)) continue;
    innerByParent.set(Number(group.index), group.instructions);
  }

  const ordered: unknown[] = [];
  for (let index = 0; index < instructions.length; index++) {
    ordered.push(instructions[index]);
    for (const inner of innerByParent.get(index) ?? []) ordered.push(inner);
  }
  const events: NormalizedChainEvent[] = [];
  let transferOrdinal = 0;
  for (const instruction of ordered) {
    const transfer = parsedTransfer(instruction);
    if (!transfer) continue;
    const ordinal = transferOrdinal++;
    const destinationMeta = balances.get(transfer.destination);
    const mint = transfer.mint ?? destinationMeta?.mint;
    const decimals = transfer.decimals ?? destinationMeta?.decimals;
    if (mint !== USDT_MINT || destinationMeta?.owner !== walletAddress) continue;
    if (decimals !== 6) throw new Error("SOLANA_USDT_DECIMALS_MISMATCH");
    events.push(normalizeChainEvent({
      networkKey: "solana",
      family: "solana",
      assetKey: "usdt_solana",
      txHash: signatures[0],
      eventIndex: ordinal,
      direction: "deposit",
      amountRaw: transfer.amount,
      decimals,
      fromAddress: null,
      toAddress: walletAddress,
      blockNumber: String(slot),
    }));
  }
  return events;
}
