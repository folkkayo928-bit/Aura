import { parseEvmUsdtTransferLog } from "./evm-transfer-log.ts";

const topicAddress = (address: string) => "0x" + address.slice(2).toLowerCase().padStart(64, "0");
const txHash = "0x" + "ab".repeat(32);
const from = "0x" + "12".repeat(20);
const to = "0x" + "34".repeat(20);
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    topics: [transferTopic, topicAddress(from), topicAddress(to)],
    data: "0x" + (1234567n).toString(16).padStart(64, "0"),
    transactionHash: txHash,
    logIndex: "0x2",
    blockNumber: "0x1406f40",
    ...overrides,
  };
}

Deno.test("parses Ethereum USDT Transfer logs into exact raw units", () => {
  const event = parseEvmUsdtTransferLog("ethereum", fixture());
  if (!event) throw new Error("expected a USDT transfer event");
  if (event.amountRaw !== "1234567" || event.decimals !== 6) throw new Error("amount precision changed");
  if (event.fromAddress !== from || event.toAddress !== to) throw new Error("addresses parsed incorrectly");
  if (event.eventIndex !== 2 || event.blockNumber !== BigInt("0x1406f40").toString()) {
    throw new Error("log index or block number parsed incorrectly");
  }
});

Deno.test("uses BSC's 18-decimal Binance-Peg BSC-USD candidate", () => {
  const event = parseEvmUsdtTransferLog("bsc", fixture({
    address: "0x55d398326f99059fF775485246999027B3197955",
    data: "0x" + (1234567890123456789n).toString(16).padStart(64, "0"),
  }));
  if (!event) throw new Error("expected a BSC transfer event");
  if (event.assetKey !== "usdt_bsc" || event.decimals !== 18) throw new Error("wrong BSC asset identity");
  if (event.amountRaw !== "1234567890123456789") throw new Error("BSC raw units changed");
});

Deno.test("ignores other token contracts and non-Transfer logs", () => {
  if (parseEvmUsdtTransferLog("ethereum", fixture({ address: "0x" + "99".repeat(20) })) !== null) {
    throw new Error("unrelated token contract was accepted");
  }
  if (parseEvmUsdtTransferLog("ethereum", fixture({ topics: ["0x" + "00".repeat(32)] })) !== null) {
    throw new Error("non-Transfer log was accepted");
  }
});

Deno.test("rejects malformed log fields and removed logs from reorgs", () => {
  const cases = [
    fixture({ transactionHash: "not-a-hash" }),
    fixture({ logIndex: "-1" }),
    fixture({ data: "0x01" }),
    fixture({ removed: true }),
  ];
  for (const candidate of cases) {
    let rejected = false;
    try { parseEvmUsdtTransferLog("ethereum", candidate); } catch { rejected = true; }
    if (!rejected) throw new Error("malformed or removed log was accepted");
  }
});
