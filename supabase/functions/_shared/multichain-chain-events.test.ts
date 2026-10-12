import { normalizeChainEvent } from "./multichain-chain-events.ts";

const evmEvent = {
  networkKey: "ethereum" as const,
  family: "evm" as const,
  assetKey: "usdt_ethereum",
  txHash: "0x" + "AB".repeat(32),
  eventIndex: 2,
  direction: "deposit" as const,
  amountRaw: "1234567",
  decimals: 6,
  fromAddress: "0x" + "CD".repeat(20),
  toAddress: "0x" + "EF".repeat(20),
  blockNumber: "21000000",
};

Deno.test("normalizes EVM hash and addresses without converting raw units", () => {
  const result = normalizeChainEvent(evmEvent);
  if (result.txHash !== evmEvent.txHash.toLowerCase()) throw new Error("EVM hash not normalized");
  if (result.fromAddress !== evmEvent.fromAddress.toLowerCase()) throw new Error("sender not normalized");
  if (result.toAddress !== evmEvent.toAddress.toLowerCase()) throw new Error("recipient not normalized");
  if (result.amountRaw !== "1234567" || result.decimals !== 6) throw new Error("raw token units changed");
  if (result.blockNumber !== "21000000") throw new Error("block number changed");
});

Deno.test("keeps case-sensitive Solana signatures and creates stable scoped keys", () => {
  const input = {
    networkKey: "solana" as const,
    family: "solana" as const,
    assetKey: "usdt_solana",
    txHash: "5HueCGU8rMjxEXxiPuD5BDku4B9pL8Q2",
    eventIndex: 0,
    direction: "deposit" as const,
    amountRaw: "1000000",
    decimals: 6,
  };
  const first = normalizeChainEvent(input);
  const again = normalizeChainEvent({ ...input });
  if (first.txHash !== input.txHash) throw new Error("Solana signature casing changed");
  if (first.idempotencyKey !== again.idempotencyKey) throw new Error("key is not stable");
  if (first.idempotencyKey === normalizeChainEvent({ ...input, eventIndex: 1 }).idempotencyKey) {
    throw new Error("different events collided");
  }
  if (first.idempotencyKey === normalizeChainEvent({ ...input, assetKey: "usdc_solana" }).idempotencyKey) {
    throw new Error("different assets collided");
  }
});

Deno.test("rejects family mismatch, malformed raw units, and unsafe event indexes", () => {
  const cases = [
    { ...evmEvent, family: "solana" as const },
    { ...evmEvent, assetKey: "usdt_ton" },
    { ...evmEvent, decimals: 18 },
    { ...evmEvent, amountRaw: "1.5" },
    { ...evmEvent, amountRaw: "-1" },
    { ...evmEvent, eventIndex: -1 },
    { ...evmEvent, eventIndex: Number.MAX_SAFE_INTEGER + 1 },
  ];
  for (const candidate of cases) {
    let rejected = false;
    try { normalizeChainEvent(candidate); } catch { rejected = true; }
    if (!rejected) throw new Error("invalid chain event was accepted");
  }
});

Deno.test("preserves TON transaction hash casing and normalizes absent fields", () => {
  const input = {
    networkKey: "ton" as const,
    family: "ton" as const,
    assetKey: "usdt_ton",
    txHash: "AbCdEf0123456789AbCdEf0123456789",
    eventIndex: 4,
    direction: "deposit" as const,
    amountRaw: "2500000",
    decimals: 6,
  };
  const result = normalizeChainEvent(input);
  if (result.txHash !== input.txHash) throw new Error("TON hash casing changed");
  if (result.fromAddress !== null || result.toAddress !== null) throw new Error("missing addresses not normalized");
  if (result.blockNumber !== null) throw new Error("missing block number not normalized");
});
