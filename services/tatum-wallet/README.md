# AURA Tatum Wallet Service (isolated preparation scaffold)

This service is isolated from AURA's existing Express server and Supabase Edge Functions. It is not wired to live wallets and has no transaction-signing or broadcasting endpoint.

## Why it is fail-closed
- Smart Wallets activation is not yet confirmed.
- A Tatum API key alone does not prove that Smart Wallets features are enabled.
- Mainnet transactions must remain disabled until signing-share security, recovery, treasury, gas, chain/token configuration, and ledger reconciliation are tested.

## Runtime
- Node.js 20+
- `npm install` then `npm start`
- `GET /health` is a liveness check.
- `GET /ready` reports only boolean configuration flags; it never reveals secrets.

## Environment variables (server-side only)
- `TATUM_API_KEY`: Tatum API key from the account dashboard.
- `TATUM_SMART_WALLETS_ACTIVATED`: set to `true` only after Tatum confirms activation.
- `AURA_TATUM_SERVICE_SECRET`: long random secret for service-to-service authentication; not the Tatum API key.
- `AURA_TATUM_MAINNET_ENABLED`: must remain `false` during preparation and testing.

Do not set any of these as frontend `VITE_*` variables. Do not commit their values, log them, or paste them into chat.

## Before production routes are implemented
1. Confirm Smart Wallets activation with Tatum.
2. Confirm SDK version and supported methods against the activated account and current provider docs.
3. Design encrypted persistence, backup, and recovery for any client signing share required by the SDK.
4. Define server-to-server authentication and least-privilege Supabase access.
5. Add idempotent wallet provisioning and provider event verification.
6. Reconcile deposits and withdrawals against the current AURA ledger without changing existing HD deposit addresses.
7. Run testnet and failure/recovery tests.
8. Enable mainnet only after review and explicit approval.

## Existing AURA compatibility
Keep current `provision-deposit-address`, `deposit-indexer`, `deposit-sweep`, `withdrawal-request`, `withdrawal-broadcaster`, and `withdrawal-indexer` flows intact during integration. Do not migrate existing addresses or retry a pending withdrawal without on-chain reconciliation.