# Tatum Smart Wallet Integration — AURA

## Status
Preparation branch only. No live functions, database schema, wallets, balances, or deployment have been changed. Do not enable transaction signing or broadcasting until provider activation, custody/recovery, treasury, and gas checks are complete.

## Architecture decision
- Keep existing AURA HD deposit addresses and the current deposit-sweep path for already-issued addresses. Do not migrate or regenerate them as part of this integration.
- Integrate Tatum Smart Wallets behind a server-side adapter. Never call privileged Tatum APIs from browser or Telegram Mini App code.
- The Tatum Wallet SDK is Node.js/ESM-oriented. Prefer a dedicated Node.js service (Render or another approved server runtime) unless a tested compatibility check proves a current backend runtime can safely run the SDK.
- Supabase remains the source of truth for AURA identity, wallet-to-user association, internal ledger, deposits, withdrawals, and P2P reservations. Tatum is a wallet/signing provider, not the balance ledger.
- Do not treat a Tatum API key as sufficient custody configuration. Follow the provider's signing-share storage, encryption, backup, and recovery requirements.

## Required server-side configuration
Configure only in a secret manager, never commit values:
- Tatum API key (after Smart Wallets activation)
- Supabase project URL and a narrowly scoped server credential appropriate to the service
- AURA internal service authentication secret
- Any Tatum SDK client-share encryption key or KMS-backed key required by the chosen signing model
- Network RPC configuration, if needed
- Treasury addresses and gas-funding policy, configured and verified per chain

Never put service-role keys, Tatum API keys, signing shares, mnemonic phrases, xprvs, or private keys in Vite VITE_* variables, browser code, Telegram WebApp payloads, GitHub files, or logs.

## Implementation sequence
1. Confirm Tatum Smart Wallets is activated for the account and confirm supported chains/tokens for the intended production plan.
2. Add a separate server-side Tatum adapter with health/config readiness endpoints that reveal only boolean configuration status, never secret values.
3. Implement idempotent wallet provisioning and store provider identifiers/addresses mapped to authenticated AURA users.
4. Add provider event/webhook verification and/or polling with replay protection and database idempotency.
5. Reconcile on-chain deposits against the existing ledger; keep old HD deposit addresses supported.
6. Implement withdrawal authorization, destination/network checks, fee and gas policy, idempotency keys, broadcast tracking, confirmation, and reconciliation.
7. Test testnet and failure/recovery cases before any mainnet broadcast is enabled.
8. Roll out gradually behind a server-side feature flag; preserve current flows until validated.

## Production gates
- Smart Wallets activation confirmed.
- Signing-share encryption, backup, and recovery procedure tested.
- Treasury ownership and native gas coverage verified on each enabled chain.
- Exact token contract and decimals verified for each chain.
- Duplicate webhook/event and retry tests pass.
- Existing pending deposits/withdrawals reconciled before retries.
- Automated tests and CI pass; rollback procedure documented.
- No success UI or ledger credit until provider/chain evidence confirms the operation.

## Current AURA compatibility notes
Existing functions include provision-deposit-address, deposit-indexer, deposit-sweep, withdrawal-request, withdrawal-broadcaster, and withdrawal-indexer. Review these together before wiring the provider. In particular, existing deposit-sweep custody derives current AURA HD deposit addresses, while withdrawal broadcasting expects AURA EVM signer/RPC/treasury configuration. Do not switch these flows automatically as part of provider setup.