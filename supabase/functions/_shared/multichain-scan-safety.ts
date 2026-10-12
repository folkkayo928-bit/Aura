export type ScanWindowInput = {
  latestBlock: string;
  lastScannedBlock: string | null;
  initialBlock: string;
  finalityDepth: number;
  maxBlocks: number;
};

export type ScanWindow = {
  fromBlock: string;
  toBlock: string;
  finalizedHead: string;
  blockCount: number;
};

/**
 * Calculates a bounded, finality-aware scan range using integer arithmetic.
 * The caller must persist lastScannedBlock only after every event in the
 * returned range has been durably persisted. This helper never advances cursors.
 */
export function planFinalizedScanWindow(input: ScanWindowInput): ScanWindow | null {
  const parseHeight = (value: string, name: string) => {
    if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78) {
      throw new Error("INVALID_" + name.toUpperCase());
    }
    return BigInt(value);
  };

  const latest = parseHeight(input.latestBlock, "latest_block");
  const initial = parseHeight(input.initialBlock, "initial_block");
  const cursor = input.lastScannedBlock === null
    ? null
    : parseHeight(input.lastScannedBlock, "last_scanned_block");

  if (!Number.isSafeInteger(input.finalityDepth) || input.finalityDepth < 0 || input.finalityDepth > 10_000_000) {
    throw new Error("INVALID_FINALITY_DEPTH");
  }
  if (!Number.isSafeInteger(input.maxBlocks) || input.maxBlocks < 1 || input.maxBlocks > 100_000) {
    throw new Error("INVALID_MAX_BLOCKS");
  }

  const finalizedHead = latest - BigInt(input.finalityDepth);
  if (finalizedHead < 0n) return null;

  const from = cursor === null ? initial : cursor + 1n;
  if (cursor !== null && cursor > latest) throw new Error("CURSOR_AHEAD_OF_CHAIN");
  if (from > finalizedHead) return null;

  const proposedTo = from + BigInt(input.maxBlocks) - 1n;
  const to = proposedTo < finalizedHead ? proposedTo : finalizedHead;
  return {
    fromBlock: from.toString(),
    toBlock: to.toString(),
    finalizedHead: finalizedHead.toString(),
    blockCount: Number(to - from + 1n),
  };
}

/** Stable key for an independent scanner range; safe for bigint block heights. */
export function scanRangeKey(networkKey: string, fromBlock: string, toBlock: string): string {
  if (!/^[a-z][a-z0-9_-]{1,39}$/.test(networkKey)) throw new Error("INVALID_NETWORK_KEY");
  const from = BigInt(fromBlock);
  const to = BigInt(toBlock);
  if (from < 0n || to < from) throw new Error("INVALID_SCAN_RANGE");
  return [networkKey, from.toString(), to.toString()].map((part) => `${part.length}:${part}`).join("|");
}
