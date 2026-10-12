import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { getSafeCheckpointToCommit } from "./multichain-scan-checkpoint.ts";
import type { ScanWindow } from "./multichain-scan-safety.ts";

const window: ScanWindow = {
  fromBlock: "101",
  toBlock: "150",
  finalizedHead: "180",
  blockCount: 50,
};

const base = {
  window,
  expectedPreviousCursor: "100",
  actualPreviousCursor: "100",
  allEventsDurablyPersisted: true,
  providerResponseComplete: true,
};

Deno.test("checkpoint commits only the completed finalized range end", () => {
  assertEquals(getSafeCheckpointToCommit(base), "150");
});

Deno.test("checkpoint refuses an incomplete provider response", () => {
  assertThrows(() => getSafeCheckpointToCommit({ ...base, providerResponseComplete: false }), Error, "PROVIDER_RESPONSE_INCOMPLETE");
});

Deno.test("checkpoint refuses before every event is durable", () => {
  assertThrows(() => getSafeCheckpointToCommit({ ...base, allEventsDurablyPersisted: false }), Error, "EVENTS_NOT_DURABLY_PERSISTED");
});

Deno.test("checkpoint refuses a cursor changed by another worker", () => {
  assertThrows(() => getSafeCheckpointToCommit({ ...base, actualPreviousCursor: "99" }), Error, "SCAN_CURSOR_CHANGED");
});

Deno.test("checkpoint refuses skipped blocks", () => {
  assertThrows(() => getSafeCheckpointToCommit({
    ...base,
    window: { ...window, fromBlock: "102", toBlock: "150", blockCount: 49 },
  }), Error, "NON_CONTIGUOUS_SCAN_RANGE");
});

Deno.test("checkpoint refuses ranges past finalized head", () => {
  assertThrows(() => getSafeCheckpointToCommit({
    ...base,
    window: { ...window, toBlock: "181", blockCount: 81 },
  }), Error, "INVALID_FINALIZED_RANGE");
});

Deno.test("checkpoint validates initial scans without a prior cursor", () => {
  assertEquals(getSafeCheckpointToCommit({
    ...base,
    window: { fromBlock: "9000", toBlock: "9049", finalizedHead: "9100", blockCount: 50 },
    expectedPreviousCursor: null,
    actualPreviousCursor: null,
  }), "9049");
});

Deno.test("checkpoint rejects a bad block count", () => {
  assertThrows(() => getSafeCheckpointToCommit({
    ...base,
    window: { ...window, blockCount: 49 },
  }), Error, "INVALID_BLOCK_COUNT");
});
