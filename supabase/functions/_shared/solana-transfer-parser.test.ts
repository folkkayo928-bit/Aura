import { parseSolanaUsdtTransfers } from "./solana-transfer-parser.ts";

const wallet = "UserWalletBase58Address123456789";
const sender = "SenderWalletBase58Address123456789";
const sourceAccount = "SourceTokenAccountBase58Address123456789";
const destinationAccount = "DestinationTokenAccountBase58Address12345";
const signature = "5HueCGU8rMjxEXxiPuD5BDku4B9pL8Q2";
const usdtMint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const otherMint = "OtherMint1111111111111111111111111111111111";

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    slot: 321,
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [
          { pubkey: wallet, signer: true, writable: true },
          { pubkey: sourceAccount, signer: false, writable: true },
          { pubkey: destinationAccount, signer: false, writable: true },
        ],
        instructions: [{
          program: "spl-token",
          parsed: {
            type: "transferChecked",
            info: {
              source: sourceAccount,
              destination: destinationAccount,
              mint: usdtMint,
              tokenAmount: { amount: "1500000", decimals: 6, uiAmountString: "1.5" },
            },
          },
        }],
      },
    },
    meta: {
      err: null,
      preTokenBalances: [{
        accountIndex: 1, mint: usdtMint, owner: sender,
        uiTokenAmount: { amount: "2000000", decimals: 6, uiAmountString: "2" },
      }],
      postTokenBalances: [{
        accountIndex: 1, mint: usdtMint, owner: sender,
        uiTokenAmount: { amount: "500000", decimals: 6, uiAmountString: "0.5" },
      }, {
        accountIndex: 2, mint: usdtMint, owner: wallet,
        uiTokenAmount: { amount: "1500000", decimals: 6, uiAmountString: "1.5" },
      }],
      innerInstructions: [],
    },
    ...overrides,
  };
}

Deno.test("parses incoming Solana USDT with exact raw units and slot", () => {
  const events = parseSolanaUsdtTransfers(fixture(), wallet);
  if (events.length !== 1) throw new Error("expected one incoming USDT transfer");
  const event = events[0];
  if (event.networkKey !== "solana" || event.assetKey !== "usdt_solana") throw new Error("wrong asset identity");
  if (event.amountRaw !== "1500000" || event.decimals !== 6) throw new Error("raw units changed");
  if (event.toAddress !== wallet || event.blockNumber !== "321") throw new Error("recipient or slot incorrect");
  if (event.txHash !== signature) throw new Error("signature changed");
});

Deno.test("ignores other mints and transfers to accounts not owned by the wallet", () => {
  const other = fixture({
    transaction: {
      signatures: [signature],
      message: {
        accountKeys: [
          { pubkey: wallet }, { pubkey: sourceAccount }, { pubkey: destinationAccount },
        ],
        instructions: [{
          program: "spl-token",
          parsed: {
            type: "transferChecked",
            info: {
              source: sourceAccount, destination: destinationAccount, mint: otherMint,
              tokenAmount: { amount: "1500000", decimals: 6 },
            },
          },
        }],
      },
    },
    meta: {
      err: null,
      preTokenBalances: [],
      postTokenBalances: [{
        accountIndex: 2, mint: otherMint, owner: wallet,
        uiTokenAmount: { amount: "1500000", decimals: 6 },
      }],
      innerInstructions: [],
    },
  });
  if (parseSolanaUsdtTransfers(other, wallet).length !== 0) throw new Error("non-USDT mint accepted");

  const notOwned = fixture({
    meta: {
      err: null, preTokenBalances: [],
      postTokenBalances: [{
        accountIndex: 2, mint: usdtMint, owner: sender,
        uiTokenAmount: { amount: "1500000", decimals: 6 },
      }],
      innerInstructions: [],
    },
  });
  if (parseSolanaUsdtTransfers(notOwned, wallet).length !== 0) throw new Error("unowned token account accepted");
});

Deno.test("does not emit deposits for failed transactions", () => {
  const originalMeta = fixture().meta;
  const failed = fixture({ meta: { ...originalMeta, err: { InstructionError: [0, "Custom"] } } });
  if (parseSolanaUsdtTransfers(failed, wallet).length !== 0) throw new Error("failed transaction was credited");
});

Deno.test("rejects invalid transaction structure", () => {
  let rejected = false;
  try { parseSolanaUsdtTransfers({}, wallet); } catch { rejected = true; }
  if (!rejected) throw new Error("invalid transaction was accepted");
});
