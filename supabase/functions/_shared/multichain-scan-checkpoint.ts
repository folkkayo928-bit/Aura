import { planFinalizedScanWindow, type ScanWindow } from "./multichain-scan-safety.ts";

export type CheckpointCommitInput = {
  window: ScanWindow;
  expectedPreviousCursor: string | null;
  actualPreviousCursor: string | null;
  allEventsDurablyPersisted: boolean;
  providerResponseComplete: boolean;
};

/**
 * Returns the only cursor value a scanner may persist after a finalized range.
 * This is a policy guard, not a database transaction: callers must re-read the
 * cursor under a lock/compare-and-set and commit event rows plus cursor atomically
 * (or use an equivalent recoverable write protocol).
 */
export function getSafeCheckpointToCommit(input: CheckpointCommitInput): string {
  if (!input || typeof input !== "object" || !input.window) {
    throw new Error("INVALID_CHECKPOINT_INPUT");
  }
  const { fromBlock, toBlock, finalizedHead, blockCount } = input.window;
  const from = parseHeight(fromBlock, "from_block");
  const to = parseHeight(toBlock, "to_block");
  const finalized = parseHeight(finalizedHead, "finalized_head");
  if (to < from || to > finalized) throw new Error("INVALID_FINALIZED_RANGE");
  if (!Number.isSafeInteger(blockCount) || blockCount < 1 || BigInt(blockCount) !== to - from + 1n) {
    throw new Error("INVALID_BLOCK_COUNT");
  }

  if (input.actualPreviousCursor !== input.expectedPreviousCursor) {
    throw new Error("SCAN_CURSOR_CHANGED");
  }
  const previous = input.actualPreviousCursor === null
    ? null
    : parseHeight(input.actualPreviousCursor, "previous_cursor");
  if (previous !== null && from !== previous + 1n) {
    throw new Error("NON_CONTIGUOUS_SCAN_RANGE");
  }
  if (previous === null && from !== 0n && fromBlock.length === 0) {
    throw new Error("INVALID_INITIAL_SCAN_RANGE");
  }
  if (input.providerResponseComplete !== true) {
    throw new Error("PROVIDER_RESPONSE_INCOMPLETE");
  }
  if (input.allEventsDurablyPersisted !== true) {
    throw new Error("EVENTS_NOT_DURABLY_PERSISTED");
  }
  return to.toString();
}

function parseHeight(value: unknown, name: string): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78) {
    throw new Error("INVALID_" + name.toUpperCase());
  }
  return BigInt(value);
}
