import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrationPath = new URL("../supabase/migrations/20261012160000_multichain_usdt_wallet_foundation.sql", import.meta.url);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.toLowerCase();

for (const network of ["ethereum", "bsc", "solana", "ton"]) {
  assert.ok(sql.includes("'" + network + "'"), `Missing network registry entry: ${network}`);
}
for (const asset of ["usdt_ethereum", "usdt_bsc", "usdt_solana", "usdt_ton"]) {
  assert.ok(sql.includes("'" + asset + "'"), `Missing USDT registry entry: ${asset}`);
}
for (const table of [
  "wallet_network_registry",
  "wallet_asset_registry",
  "wallet_chain_addresses",
  "wallet_chain_events",
]) {
  assert.ok(normalized.includes(`alter table public.${table} enable row level security`), `RLS not enabled for ${table}`);
  assert.ok(normalized.includes(`revoke all on public.${table} from public, anon, authenticated`), `Client write privileges not revoked for ${table}`);
}

assert.ok(normalized.includes("wallet_chain_events_network_tx_event_uq"), "Missing idempotent event identity index");
assert.ok(normalized.includes("case when network_key in ('ethereum', 'bsc') then lower(tx_hash) else tx_hash end"), "On-chain event identity must normalize EVM hashes only");
assert.ok(normalized.includes("amount_raw numeric(78, 0)"), "Token amounts must use integer base units, not floating point");
assert.ok(normalized.includes("finality_mode text not null"), "Chain-specific finality policy is required");
assert.ok(normalized.includes("binance-peg bsc-usd (bridged usdt representation)"), "BSC bridged asset must be identified honestly");
assert.ok(normalized.includes("https://bscscan.com/token/0x55d398326f99059ff775485246999027b3197955"), "BSC asset must cite its explorer identity");
assert.ok(normalized.includes("case when network_key in ('ethereum', 'bsc') then lower(address) else address end"), "Address normalization must not lowercase Solana or TON addresses");
assert.ok(normalized.includes("false, false, 'confirmations'") && normalized.includes("false, false, 'finalized'") && normalized.includes("false, false, 'ton_finalized'"), "New networks must remain disabled until integration tests pass");
assert.doesNotMatch(normalized, /\b(drop\s+table|truncate\s+table|disable\s+row\s+level\s+security)\b/i, "Foundation migration must not contain destructive DDL");

const addressValidatorPath = new URL("../supabase/functions/_shared/multichain-address-validation.ts", import.meta.url);
const addressValidator = readFileSync(addressValidatorPath, "utf8");
const addressHandler = readFileSync(new URL("../supabase/functions/multichain-wallet-validate-address/index.ts", import.meta.url), "utf8");
const supabaseConfig = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");
assert.ok(addressValidator.includes('case "ethereum":') && addressValidator.includes('case "bsc":'), "Address validator must support both EVM target networks");
assert.ok(addressValidator.includes('case "solana":') && addressValidator.includes('case "ton":'), "Address validator must support Solana and TON");
assert.ok(addressHandler.includes('client.auth.getUser()'), "Address validation must require an authenticated user");
assert.ok(addressHandler.includes('validation: "format_only"'), "Address validation must not claim ownership or transaction verification");
assert.ok(!addressHandler.includes("SUPABASE_SERVICE_ROLE_KEY"), "Address validator must not use a service-role key");
assert.match(supabaseConfig, /\[functions\.multichain-wallet-validate-address\]\s+verify_jwt = true/i, "Address validator must require Supabase JWT verification");


const scanCommitPath = new URL("../supabase/migrations/20261012170000_wallet_chain_atomic_scan_commit.sql", import.meta.url);
const scanCommitSql = readFileSync(scanCommitPath, "utf8");
const scanCommitNormalized = scanCommitSql.toLowerCase();
assert.ok(scanCommitNormalized.includes("create table if not exists public.wallet_chain_scan_cursors"), "Missing durable multichain scan cursor table");
assert.ok(scanCommitNormalized.includes("for update"), "Scan cursor must be locked during commit");
assert.ok(scanCommitNormalized.includes("trunc(p_from_block) <> p_from_block") && scanCommitNormalized.includes("trunc(v_event_block) <> v_event_block"), "Block heights must be integer values");
assert.ok(scanCommitNormalized.includes("jsonb_array_length(p_events) > 10000"), "Scan event batch must be bounded");
assert.ok(scanCommitNormalized.includes("commit_wallet_chain_scan_range"), "Missing atomic scan-range commit RPC");
assert.ok(scanCommitNormalized.includes("on conflict do nothing"), "Chain event writes must be idempotent");
assert.ok(scanCommitNormalized.includes("unverified_recipient_address"), "Deposit event must map to a verified recipient address");
assert.ok(scanCommitNormalized.includes("network_receive_disabled") && scanCommitNormalized.includes("asset_disabled"), "Disabled networks/assets must reject scan commits");
assert.ok(scanCommitNormalized.includes("grant execute on function public.commit_wallet_chain_scan_range") && scanCommitNormalized.includes("to service_role"), "Scan commit RPC must be service-role only");
assert.doesNotMatch(scanCommitNormalized, /\b(drop\s+table|truncate\s+table|disable\s+row\s+level\s+security)\b/i, "Scan commit migration must not contain destructive DDL");

console.log("AURA multichain wallet foundation checks passed.");
