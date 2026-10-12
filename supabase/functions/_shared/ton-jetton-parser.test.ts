import { parseTonUsdtTransfers } from "./ton-jetton-parser.ts";

const wallet = "0:" + "11".repeat(32);
const source = "0:" + "22".repeat(32);
const usdtMaster = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const txHash = "ab".repeat(32);

function row(overrides: Record<string, unknown> = {}) {
  return {
    amount: "1500000",
    destination: wallet,
    source,
    jetton_master: usdtMaster,
    transaction_aborted: false,
    transaction_hash: txHash,
    transaction_lt: "1234567",
    ...overrides,
  };
}

Deno.test("parses incoming TON USDT jetton transfers using exact base units", () => {
  const events = parseTonUsdtTransfers({ jetton_transfers: [row()] }, wallet);
  if (events.length !== 1) throw new Error("expected one TON USDT transfer");
  const event = events[0];
  if (event.networkKey !== "ton" || event.assetKey !== "usdt_ton") throw new Error("wrong asset identity");
  if (event.amountRaw !== "1500000" || event.decimals !== 6) throw new Error("raw amount changed");
  if (event.toAddress !== wallet || event.fromAddress !== source) throw new Error("source or destination mismatch");
  if (event.txHash !== txHash || event.blockNumber !== "1234567") throw new Error("transaction identity changed");
});

Deno.test("ignores other jetton masters, other recipients, and aborted transactions", () => {
  const rows = [
    row({ jetton_master: "0:" + "99".repeat(32) }),
    row({ destination: "0:" + "33".repeat(32) }),
    row({ transaction_aborted: true }),
  ];
  if (parseTonUsdtTransfers({ jetton_transfers: rows }, wallet).length !== 0) {
    throw new Error("untrusted TON transfer was accepted");
  }
});

Deno.test("rejects malformed amounts and transaction hashes for matching USDT transfers", () => {
  const cases = [
    row({ amount: "-1" }),
    row({ amount: "1.5" }),
    row({ transaction_hash: "not-a-hash" }),
  ];
  for (const candidate of cases) {
    let rejected = false;
    try { parseTonUsdtTransfers({ jetton_transfers: [candidate] }, wallet); } catch { rejected = true; }
    if (!rejected) throw new Error("malformed TON transfer was accepted");
  }
});

Deno.test("rejects invalid response structure and wallet address", () => {
  let badResponse = false;
  try { parseTonUsdtTransfers({}, wallet); } catch { badResponse = true; }
  if (!badResponse) throw new Error("invalid response was accepted");
  let badAddress = false;
  try { parseTonUsdtTransfers({ jetton_transfers: [] }, "not-a-ton-address"); } catch { badAddress = true; }
  if (!badAddress) throw new Error("invalid TON wallet address was accepted");
});
