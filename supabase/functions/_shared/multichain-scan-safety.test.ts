import { planFinalizedScanWindow, scanRangeKey } from "./multichain-scan-safety.ts";

Deno.test("scan window respects finality and maximum range", () => {
  const result = planFinalizedScanWindow({ latestBlock: "1000", lastScannedBlock: null, initialBlock: "900", finalityDepth: 12, maxBlocks: 100 });
  if (!result || result.fromBlock !== "900" || result.toBlock !== "988" || result.blockCount !== 89) throw new Error("incorrect finalized scan window");
});

Deno.test("cursor resumes after last persisted block using bigint-safe heights", () => {
  const result = planFinalizedScanWindow({ latestBlock: "100000000000000000000", lastScannedBlock: "99999999999999999900", initialBlock: "0", finalityDepth: 20, maxBlocks: 50 });
  if (!result || result.fromBlock !== "99999999999999999901" || result.toBlock !== "99999999999999999950" || result.blockCount !== 50) throw new Error("incorrect cursor resume");
});

Deno.test("does not scan if finality head has not passed the cursor", () => {
  const result = planFinalizedScanWindow({ latestBlock: "10", lastScannedBlock: "8", initialBlock: "0", finalityDepth: 5, maxBlocks: 100 });
  if (result !== null) throw new Error("unfinalized range was returned");
});

Deno.test("rejects malformed heights, a cursor ahead of chain, and unsafe limits", () => {
  const cases = [
    { latestBlock: "01", lastScannedBlock: null, initialBlock: "0", finalityDepth: 1, maxBlocks: 10 },
    { latestBlock: "100", lastScannedBlock: "101", initialBlock: "0", finalityDepth: 1, maxBlocks: 10 },
    { latestBlock: "100", lastScannedBlock: null, initialBlock: "-1", finalityDepth: 1, maxBlocks: 10 },
    { latestBlock: "100", lastScannedBlock: null, initialBlock: "0", finalityDepth: -1, maxBlocks: 10 },
    { latestBlock: "100", lastScannedBlock: null, initialBlock: "0", finalityDepth: 1, maxBlocks: 0 },
  ];
  for (const input of cases) {
    let rejected = false;
    try { planFinalizedScanWindow(input); } catch { rejected = true; }
    if (!rejected) throw new Error("invalid scan input was accepted");
  }
});

Deno.test("range keys distinguish network and block ranges", () => {
  const first = scanRangeKey("ethereum", "1", "100");
  if (first !== scanRangeKey("ethereum", "1", "100")) throw new Error("range key not stable");
  if (first === scanRangeKey("bsc", "1", "100") || first === scanRangeKey("ethereum", "1", "101")) throw new Error("range key collision");
  let rejected = false;
  try { scanRangeKey("ETHEREUM", "1", "100"); } catch { rejected = true; }
  if (!rejected) throw new Error("invalid network key accepted");
});
