# AURA backend rebuild: multichain USDT

## Scope
- Preserve the current React/Vite frontend and its user experience.
- Rebuild backend services behind stable interfaces, starting with USDT on Ethereum, BNB Smart Chain, Solana, and TON.
- Do not touch FineTime or any unrelated repository/project.
- Do not drop existing production tables, migrations, Edge Functions, scheduled jobs, Telegram workflows, or ledger history during the rebuild.

## What inspection found
- Supabase project: `rtqcistkoomzmzxzasxc` (Aura; ACTIVE_HEALTHY).
- Existing backend contains profiles, wallet ledger, wallet deposits/withdrawals, P2P escrow, artwork ownership, Telegram queues, and 80+ migrations.
- Current `deposit-indexer` and `withdrawal-broadcaster` are EVM-focused and currently define Ethereum, Polygon, Arbitrum, and BSC—not a complete Solana + TON implementation.
- Existing deposit cursors are present. Treat chain cursors and any ledger/deposit/withdrawal records as operational state, not disposable scaffolding.
- Current client expects Supabase and existing table/RPC shapes in several places. Replace backend contracts only after the frontend has been adapted and regression-tested.

## Target design
1. **Chain registry**: explicit network family, native gas asset, confirmation/finality requirements, and verified token identifier per chain. Important: the existing BSC contract `0x55d398326f99059fF775485246999027B3197955` is labelled Binance-Peg BSC-USD by BscScan, so it must not be presented as issuer-native Tether USDt. The registry labels it as a bridged USDT representation until the exact supported asset is approved.
2. **Wallet ownership**: store public addresses only. Never store seed phrases/private keys in ordinary tables, browser logs, telemetry, or client-readable metadata. Require proof of control for imported external addresses. A backend must not be able to sign for a wallet marketed as non-custodial.
3. **Chain adapters**:
   - EVM adapter shared by Ethereum and BNB Smart Chain, with chain-specific token, RPC, gas, nonce, receipt, and reorg handling.
   - Solana adapter using the verified USDT mint and token-account semantics.
   - TON adapter using the issuer-published USDT jetton master and TON transaction/message semantics.
4. **Event ingestion**: idempotent on-chain event identity, raw integer amounts, confirmation/finality state, reorg/revert handling, and auditable status transitions. Never credit the same transfer twice.
5. **Send path**: validate network and token, destination format, exact token decimals, available native gas, user signature, and broadcast result. UI success only after a real accepted transaction result; final status only after chain confirmation.
6. **Account balance**: distinguish native on-chain balances from AURA internal ledger balances. Do not add external-wallet balances to internal spendable balance, and do not imply that a chain-to-chain transfer happened without an actual bridge.
7. **P2P**: keep out of the first cutover. Reconnect it only after the new wallet ledger is verified; no silent escrow migration or balance resets.
8. **Telegram**: preserve the existing bot and notification flows; use TON Connect for TON wallet connections and separately validate Telegram's current Mini App rules before enabling other wallet interactions in that surface.

## Rollout gates
- The schema in this branch is additive and is not yet applied to the live Supabase project.
- Network and token registry rows are disabled by default. A chain must not be enabled until receive, send, token identity, gas, duplicate detection, and failure/reorg tests pass.
- Run old and new deposit observers in read-only/shadow mode first. Compare event counts and balances before any cutover.
- Do not migrate or delete legacy ledger data until a reconciliation report proves balances and open P2P orders match.
- Require an independent security review before real-money embedded-wallet signing or P2P escrow goes live.

## Current first milestone
Add a secure, additive multichain registry and append-only transaction-event model. Keep all legacy backend components intact while the replacement is implemented and tested on this branch.

## Adapter implementation status (branch-only)
- The shared read-only JSON-RPC transport now allowlists read methods and rejects transaction submission methods. It requires HTTPS, rejects endpoint credentials/redirects, bounds timeouts and response size, and verifies the JSON-RPC response ID.
- The first EVM scan adapter now checks the RPC chain ID, bounds the requested range, enforces the configured confirmation depth, requests only the candidate token's ERC-20 Transfer logs, and rejects provider responses with malformed or out-of-range logs.
- This adapter returns normalized observations only. It does not look up account ownership, write the database, advance a cursor, sign transactions, or credit balances. Those remain explicit caller/transaction responsibilities.
- CI runs Deno tests for shared helpers and a separate PostgreSQL 16 service to apply both additive migrations and verify atomic cursor/event persistence plus rollback on malformed input. This PostgreSQL database exists only inside the workflow; it is not the live AURA Supabase project.
- Solana and TON parsers are still parsing helpers, not complete provider scanners. No network is enabled by this work, and no real-money send/deposit claim should be made until per-chain provider scanning, finality, ownership mapping, send/gas paths, and ledger reconciliation pass the acceptance checklist.
