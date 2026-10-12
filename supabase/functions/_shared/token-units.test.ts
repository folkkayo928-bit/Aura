/// <reference lib="deno.ns" />
import { formatUnitsExact, parseUnitsStrict } from "./token-units.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}
function assertThrows(fn: () => unknown, expectedMessage: string) {
  try { fn(); } catch (error) {
    if (error instanceof Error && error.message.includes(expectedMessage)) return;
    throw new Error(`Expected error containing ${expectedMessage}; received ${String(error)}`);
  }
  throw new Error("Expected function to throw");
}

Deno.test("parses and formats six-decimal USDT amounts exactly", () => {
  assertEquals(parseUnitsStrict("12.345678", 6), 12345678n);
  assertEquals(formatUnitsExact(12345678n, 6), "12.345678");
  assertEquals(formatUnitsExact(12000000n, 6), "12");
});
Deno.test("parses BSC eighteen-decimal units without floating point", () => {
  assertEquals(parseUnitsStrict("1.000000000000000001", 18), 1000000000000000001n);
  assertEquals(formatUnitsExact(1000000000000000001n, 18), "1.000000000000000001");
});
Deno.test("rejects excess precision and non-decimal notation", () => {
  assertThrows(() => parseUnitsStrict("1.0000001", 6), "TOKEN_AMOUNT_PRECISION_EXCEEDED");
  assertThrows(() => parseUnitsStrict("1e-6", 6), "INVALID_TOKEN_AMOUNT");
  assertThrows(() => parseUnitsStrict("-1", 6), "INVALID_TOKEN_AMOUNT");
  assertThrows(() => parseUnitsStrict("01.2", 6), "INVALID_TOKEN_AMOUNT");
});
Deno.test("rejects invalid decimal configuration and negative base units", () => {
  assertThrows(() => parseUnitsStrict("1", 31), "INVALID_TOKEN_DECIMALS");
  assertThrows(() => formatUnitsExact(-1n, 6), "INVALID_TOKEN_AMOUNT");
});
