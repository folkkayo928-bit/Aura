import { validateTonAddress } from "./multichain-address-validation.ts";
import { normalizeChainEvent, type NormalizedChainEvent } from "./multichain-chain-events.ts";

const USDT_JETTON_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const TON_USDT_DECIMALS = 6;
type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;

function canonicalAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { return validateTonAddress(value); } catch { return null; }
}

/**
 * Parses TON Center API v3 jetton transfer rows in read-only mode.
 * It requires the issuer-published USDT jetton master, the tracked owner as the
 * destination, a successful transaction, and integer base units. This parser
 * does not fetch data, prove provider completeness, determine finality, or credit balances.
 */
export function parseTonUsdtTransfers(response: unknown, walletAddress: string): NormalizedChainEvent[] {
  const canonicalWallet = canonicalAddress(walletAddress);
  if (!canonicalWallet) throw new Error("INVALID_TON_WALLET_ADDRESS");
  const root = record(response);
  const rows = root?.jetton_transfers;
  if (!Array.isArray(rows)) throw new Error("INVALID_TON_JETTON_RESPONSE");
  const canonicalMaster = canonicalAddress(USDT_JETTON_MASTER)!;
  const events: NormalizedChainEvent[] = [];
  for (const rowValue of rows) {
    const row = record(rowValue);
    if (!row || row.transaction_aborted === true) continue;
    if (canonicalAddress(row.jetton_master) !== canonicalMaster) continue;
    if (canonicalAddress(row.destination) !== canonicalWallet) continue;
    if (typeof row.amount !== "string" || !/^(0|[1-9][0-9]*)$/.test(row.amount) || row.amount.length > 78) {
      throw new Error("INVALID_TON_RAW_AMOUNT");
    }
    if (typeof row.transaction_hash !== "string" || row.transaction_hash.length < 16 ||
        row.transaction_hash.length > 160 || !/^[A-Za-z0-9_+/=-]+$/.test(row.transaction_hash)) {
      throw new Error("INVALID_TON_TRANSACTION_HASH");
    }
    const logicalTime = row.transaction_lt;
    const blockNumber = typeof logicalTime === "string" && /^(0|[1-9][0-9]*)$/.test(logicalTime)
      ? logicalTime
      : null;
    const source = canonicalAddress(row.source) ? String(row.source) : null;
    events.push(normalizeChainEvent({
      networkKey: "ton",
      family: "ton",
      assetKey: "usdt_ton",
      txHash: row.transaction_hash,
      eventIndex: 0,
      direction: "deposit",
      amountRaw: row.amount,
      decimals: TON_USDT_DECIMALS,
      fromAddress: source,
      toAddress: walletAddress,
      blockNumber,
    }));
  }
  return events;
}
