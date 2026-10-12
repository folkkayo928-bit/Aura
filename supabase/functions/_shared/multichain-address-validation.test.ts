import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { decodeBase58, validateAddress, validateTonAddress } from "./multichain-address-validation.ts";

Deno.test("accepts Ethereum and BNB Smart Chain EVM address format", () => {
  assertEquals(
    validateAddress("ethereum", "0xdAC17F958D2ee523a2206206994597C13D831ec7"),
    "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  );
  assertEquals(
    validateAddress("bsc", "0x55d398326f99059fF775485246999027B3197955"),
    "0x55d398326f99059fF775485246999027B3197955",
  );
});

Deno.test("rejects malformed EVM addresses", () => {
  assertThrows(() => validateAddress("ethereum", "0x1234"), Error, "INVALID_EVM_ADDRESS");
});

Deno.test("accepts the known USDT Solana mint as a 32-byte base58 address", () => {
  const mint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  assertEquals(decodeBase58(mint).length, 32);
  assertEquals(validateAddress("solana", mint), mint);
});

Deno.test("rejects malformed Solana addresses", () => {
  assertThrows(() => validateAddress("solana", "not-a-solana-address"));
});

Deno.test("accepts the configured TON USDT master friendly address", () => {
  const master = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
  assertEquals(validateTonAddress(master), "0:acb1a08b50d0a4a19f2ac3cba8f4c9a7e3f8fdd3c72d65c5a0a7a00f1b0d0f6d");
  assertEquals(validateAddress("ton", master), validateTonAddress(master));
});

Deno.test("rejects invalid TON checksum and unsupported networks", () => {
  assertThrows(() => validateAddress("ton", "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDA"));
  assertThrows(() => validateAddress("bitcoin", "0x0000000000000000000000000000000000000000"), Error, "UNSUPPORTED_NETWORK");
});
