import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { fetchFinalizedEvmUsdtTransfers } from "./multichain-evm-scan.ts";

const topicAddress = (address: string) => "0x" + address.slice(2).toLowerCase().padStart(64, "0");
const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const from = "0x" + "12".repeat(20);
const to = "0x" + "34".repeat(20);
const txHash = "0x" + "ab".repeat(32);

function log(overrides: Record<string, unknown> = {}) {
  return {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    topics: [transferTopic, topicAddress(from), topicAddress(to)],
    data: "0x" + (1234567n).toString(16).padStart(64, "0"),
    transactionHash: txHash,
    logIndex: "0x2",
    blockNumber: "0x50",
    ...overrides,
  };
}

function rpcMock(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ method: string; params: unknown[] }> = [];
  const rpc = async (method: string, params: unknown[]) => {
    calls.push({ method, params });
    if (method === "eth_chainId") return overrides.chainId ?? "0x1";
    if (method === "eth_blockNumber") return overrides.latestBlock ?? "0x64";
    if (method === "eth_getLogs") return overrides.logs ?? [log()];
    throw new Error("UNEXPECTED_RPC_METHOD");
  };
  return { rpc, calls };
}

Deno.test("EVM scan requests exact token logs only through finalized head", async () => {
  const { rpc, calls } = rpcMock();
  const result = await fetchFinalizedEvmUsdtTransfers({
    networkKey: "ethereum",
    fromBlock: "80",
    toBlock: "88",
    rpc,
  });
  assertEquals(result.finalizedHead, "88");
  assertEquals(result.events.length, 1);
  assertEquals(result.events[0]?.amountRaw, "1234567");
  assertEquals(calls[2]?.method, "eth_getLogs");
  assertEquals((calls[2]?.params[0] as Record<string, unknown>).address, "0xdac17f958d2ee523a2206206994597c13d831ec7");
});

Deno.test("EVM scan rejects an RPC on the wrong chain", async () => {
  const { rpc } = rpcMock({ chainId: "0x38" });
  await assertRejects(
    () => fetchFinalizedEvmUsdtTransfers({ networkKey: "ethereum", fromBlock: "80", toBlock: "88", rpc }),
    Error,
    "RPC_CHAIN_ID_MISMATCH",
  );
});

Deno.test("EVM scan refuses ranges beyond configured finality depth", async () => {
  const { rpc } = rpcMock({ latestBlock: "0x64" });
  await assertRejects(
    () => fetchFinalizedEvmUsdtTransfers({ networkKey: "ethereum", fromBlock: "89", toBlock: "90", rpc }),
    Error,
    "SCAN_RANGE_NOT_FINALIZED",
  );
});

Deno.test("EVM scan enforces a bounded block range", async () => {
  const { rpc } = rpcMock();
  await assertRejects(
    () => fetchFinalizedEvmUsdtTransfers({ networkKey: "ethereum", fromBlock: "1", toBlock: "2001", rpc, maxBlocks: 2000 }),
    Error,
    "SCAN_RANGE_TOO_LARGE",
  );
});

Deno.test("EVM scan rejects non-array provider log responses", async () => {
  const { rpc } = rpcMock({ logs: { result: [] } });
  await assertRejects(
    () => fetchFinalizedEvmUsdtTransfers({ networkKey: "ethereum", fromBlock: "80", toBlock: "88", rpc }),
    Error,
    "RPC_LOG_RESPONSE_INVALID",
  );
});

Deno.test("EVM scan rejects logs returned outside requested range", async () => {
  const { rpc } = rpcMock({ logs: [log({ blockNumber: "0x59" })] });
  await assertRejects(
    () => fetchFinalizedEvmUsdtTransfers({ networkKey: "ethereum", fromBlock: "80", toBlock: "88", rpc }),
    Error,
    "RPC_LOG_OUTSIDE_SCAN_RANGE",
  );
});

Deno.test("BSC scan validates chain ID and uses its candidate token", async () => {
  const { rpc, calls } = rpcMock({
    chainId: "0x38",
    logs: [log({
      address: "0x55d398326f99059fF775485246999027B3197955",
      data: "0x" + (1234567890123456789n).toString(16).padStart(64, "0"),
    })],
  });
  const result = await fetchFinalizedEvmUsdtTransfers({
    networkKey: "bsc",
    fromBlock: "80",
    toBlock: "85",
    rpc,
  });
  assertEquals(result.events[0]?.assetKey, "usdt_bsc");
  assertEquals(result.events[0]?.decimals, 18);
  assertEquals((calls[2]?.params[0] as Record<string, unknown>).address, "0x55d398326f99059ff775485246999027b3197955");
});
