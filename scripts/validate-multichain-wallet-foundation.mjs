import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationPath = new URL("../supabase/migrations/20261012160000_multichain_usdt_wallet_foundation.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");

const requiredNetworks = ["ethereum", "bsc", "solana", "ton"];
for (const network of requiredNetworks) {
  assert.match(sql, new RegExp("'" + network + "'"), `Missing network registry entry: ${network}`);
}
for (const asset of ["usdt_ethereum", "usdt_bsc", "usdt_solana", "usdt_ton"]) {
  assert.match(sql, new RegExp("'" + asset + "'"), `Missing USDT registry entry: ${asset}`);
}

for (const table of [
  "wallet_network_registry",
  "wallet_asset_registry",
  "wallet_chain_addresses",
  "wallet_chain_events",
]) {
  assert.match(sql, new RegExp("alter table public\\." + table + " enable row level security", "i"), `RLS not enabled for ${table}`);
  assert.match(sql, new RegExp("revoke all on public\\." + table + " from public, anon, authenticated", "i"), `Client write privileges not revoked for ${table}`);
}

assert.match(sql, /unique \(network_key, tx_hash, event_index\)/i, "On-chain event identity must be idempotent");
assert.match(sql, /amount_raw numeric\(78, 0\)/i, "Token amounts must use integer base units, not floating point");
assert.match(sql, /finality_mode text not null/i, "Chain-specific finality policy is required");
assert.match(sql, /case when network_key in \('ethereum', 'bsc'\) then lower\(address\) else address end/i, "Address normalization must not lowercase Solana or TON addresses");
assert.match(sql, /enabled_for_receive, enabled_for_send, finality_mode, min_confirmations\)[\s\S]*?false, false/i, "New networks must remain disabled until integration tests pass");
assert.doesNotMatch(sql, /\b(drop\s+table|truncate\s+table|disable\s+row\s+level\s+security)\b/i, "Foundation migration must not contain destructive DDL");

console.log("AURA multichain wallet foundation checks passed.");
