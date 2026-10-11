# AURA transaction operations and readiness

This runbook is the operational baseline for AURA's money movement. It deliberately keeps the existing Supabase internal wallet ledger and P2P escrow as the source of truth; Thirdweb is a transaction-signing/execution provider, not a replacement for the ledger.

## Important limitation

No centralized platform can honestly guarantee that every external blockchain transaction will succeed. RPC outages, chain congestion/reorganizations, insufficient native gas or token liquidity, provider failures, contract behavior and recipient/network mistakes are real failure modes. The production goal is to fail closed before submission, submit at most once, track the provider and on-chain transaction independently, credit deposits only after verified confirmations, and reconcile every ambiguous result without double-paying.

## Current supported scope

The live EVM withdrawal/deposit path currently covers these USDT configurations:

| Network | Chain ID | USDT token decimals | Native gas asset |
| --- | ---: | ---: | --- |
| Ethereum | 1 | 6 | ETH |
| Polygon | 137 | 6 | POL |
| Arbitrum One | 42161 | 6 | ETH |
| BNB Smart Chain | 56 | 18 | BNB |
| Base | 8453 | 6 | ETH |
| Optimism | 10 | 6 | ETH |
| Avalanche C-Chain | 43114 | 6 | AVAX |

Enabling a network is a three-part release, never a UI label alone: (1) apply the database migration
that updates the withdrawal allowlist and the deposit-address/scan-cursor constraints,
(2) deploy the edge functions (`provision-deposit-address`, `deposit-indexer`, `deposit-sweep`,
`withdrawal-request`, `withdrawal-broadcaster`, `withdrawal-indexer`, `treasury-health`), and
(3) configure that network's treasury signer below. Until the treasury is configured the withdrawal
request fails closed — it reserves nothing and broadcasts nothing.

Token addresses and decimals must be verified against the official token contract and the active chain before changing these values. Solana, TON, extra EVM networks, and additional assets must not be advertised as production-ready merely because a wallet-connect button or address exists.

## 1. Run the live treasury health check

1. Open the deployed AURA app and enter **AURA Operations → Health** using a finance/owner account.
2. Select **Run live treasury checks**.
3. The check is read-only. It verifies Thirdweb API authentication, whether the configured treasury matches a Server Wallet returned by that same Thirdweb project, the configured RPC's chain ID, the token contract/decimals, USDT liquidity, a simulated direct ERC-20 transfer, and direct-signer gas headroom. It does not send a transaction.
4. Fix each reported blocker. Never mark a blocked network as ready merely because the worker endpoint returns HTTP 200.

## 2. Thirdweb secrets and network configuration

Configure these values only in **Supabase Edge Function secrets**; never put them in a frontend `VITE_*` setting, code, issue, screenshot, or chat:

- `THIRDWEB_SECRET_KEY`: server-side secret key from the Thirdweb project that contains the intended Server Wallet.
- `THIRDWEB_SERVER_WALLET_ADDRESS`: the exact registered Server Wallet address or smart-wallet address returned by that project's Server Wallet API.
- `AURA_EVM_TREASURY_ETHEREUM`, `AURA_EVM_TREASURY_POLYGON`, `AURA_EVM_TREASURY_ARBITRUM`, `AURA_EVM_TREASURY_BSC`, `AURA_EVM_TREASURY_BASE`, `AURA_EVM_TREASURY_OPTIMISM`, `AURA_EVM_TREASURY_AVALANCHE`: sender address for each network. For a Thirdweb payout route this must exactly match the address configured for that route.
- Optional `AURA_EVM_RPC_ETHEREUM`, `AURA_EVM_RPC_POLYGON`, `AURA_EVM_RPC_ARBITRUM`, `AURA_EVM_RPC_BSC`, `AURA_EVM_RPC_BASE`, `AURA_EVM_RPC_OPTIMISM`, `AURA_EVM_RPC_AVALANCHE`: network-specific RPC overrides. When one is absent the worker uses the connected Alchemy app, then the public fallback list. A configured but broken override is not silently treated as healthy.
- `AURA_THIRDWEB_GAS_VERIFIED_ETHEREUM`, `AURA_THIRDWEB_GAS_VERIFIED_POLYGON`, `AURA_THIRDWEB_GAS_VERIFIED_ARBITRUM`, `AURA_THIRDWEB_GAS_VERIFIED_BSC`, `AURA_THIRDWEB_GAS_VERIFIED_BASE`, `AURA_THIRDWEB_GAS_VERIFIED_OPTIMISM`, `AURA_THIRDWEB_GAS_VERIFIED_AVALANCHE`: use `true` only after an operator has completed and verified a controlled small transfer for the corresponding smart-account route. This is an explicit operator attestation, not an automatic Thirdweb sponsorship check.

The Thirdweb Secret Key must belong to the project where the sender is registered. If API authentication returns 401/403, fix the project/key pairing; changing a wallet address does not fix an invalid key. If the wallet is not listed, create or select the intended Server Wallet in that same project first. Never paste a secret key here.

For direct EOA sends, the treasury needs enough USDT to cover the payout and enough native gas currency to cover fees with a margin. For smart-account sends, validate the correct account-abstraction/EntryPoint/paymaster setup with an actual controlled transaction before enabling payouts. A read-only RPC check cannot prove a sponsored transaction will be accepted.

## 3. Withdrawal state machine

- `pending_email_confirmation`: funds are reserved but the user has not completed the secure confirmation.
- `queued`: securely confirmed, awaiting server-side broadcast.
- `broadcast`: a transaction hash has been saved; the transaction may still be pending or reorged.
- `confirmed_onchain`: the configured chain's confirmation threshold was reached and the receipt's token contract, destination and amount matched.
- `cancelled` / `rejected`: terminal states; no future broadcaster should process the withdrawal.
- Ambiguous provider acceptance: preserve the submission marker or provider transaction ID and reconcile that existing attempt. Do not blindly submit a second payout.

The broadcaster must not be treated as successful merely because it returned HTTP 200. UI success for a blockchain send requires the transaction hash, and final success requires on-chain confirmation. If a provider accepted a request but the response was lost, investigate its existing provider ID and chain history; do not create a new withdrawal to compensate.

## 4. Deposit/receive path

For incoming USDT deposits, the indexer must match an actual ERC-20 Transfer log from the expected token contract to an address mapped to the correct AURA account. Confirm receipt success, chain-specific confirmation count, token decimals and transaction-log amount. Credit the internal ledger idempotently using the unique deposit/transaction identity; re-running an indexer must not credit twice.

Deposit detection and internal credit are different states from deposit sweep. A deposit can be detected/credited while its sweep remains pending. Do not report a sweep as complete until the sweep transaction is independently confirmed. A sender sending to an address on the wrong chain or using a different token contract cannot be inferred as a valid AURA USDT deposit.

## 5. Internal send/receive and P2P

Internal AURA transfers must use a single database transaction that locks the participating wallets, validates ownership/amount/available balance, posts matching ledger entries, and deduplicates an idempotency key. A timeout must not lead the client to submit a new transfer with a different key.

P2P escrow is a separate state machine from external blockchain transfers. Funds must be reserved once, released only by the audited settlement state transition, and never made spendable twice. A screenshot is evidence for review, not on-chain proof and not an automatic release signal.

## 6. Pre-release checklist

- [ ] Health check passes for the exact chain and token being enabled.
- [ ] Thirdweb project secret and wallet registration match the configured sender.
- [ ] Treasury has real token liquidity and required network gas, or a tested supported gas-sponsorship route.
- [ ] Amount precision matches the token contract; no rounding upward.
- [ ] Retry is idempotent and provider timeouts cannot trigger duplicate broadcasts.
- [ ] Receipt verification checks transaction success, expected token contract, destination, amount and confirmation threshold.
- [ ] Deposit scans have persistent cursors, bounded ranges, RPC fallback for reads, and no skipped-block advancement on failed scans.
- [ ] Refunds are atomic, one-time ledger credits, and only occur when the transaction is provably not broadcast or has verifiably reverted.
- [ ] User-facing states distinguish queued, submitted, confirmed, rejected, and manual reconciliation.
- [ ] CI typecheck/build and relevant Edge Function checks are green.
- [ ] A controlled end-to-end canary has been confirmed on that network before real withdrawals are enabled.

## 7. Adding another chain or asset safely

Do not just add a chain label. Each network/token adapter must specify chain ID, canonical token contract, decimals, RPC strategy, block/reorg policy, confirmation threshold, signer mode, token/native balance checks, gas strategy, destination validation, receipt verification, unique deposit identity, sweep support, UI disclosure, and an integration test. Keep unsupported options hidden or explicitly labelled unavailable until all those checks exist.

## Incident response

If a withdrawal stays queued, read `last_worker_error`, `provider_transaction_id`, `submission_started_at`, and `tx_hash` on the withdrawal row. Never delete a reservation or issue a second payment to make a UI balance look correct. If there is no transaction hash, provider transaction ID or submission marker, verify the absence of a broadcast before an atomic refund. If any marker exists, reconcile the existing transaction first.
