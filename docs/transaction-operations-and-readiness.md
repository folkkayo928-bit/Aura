# AURA transaction operations and readiness

This runbook distinguishes the new non-custodial wallet from the legacy server-managed deposit/ledger path. Do not describe either path as production-ready until its own checklist has passed.

## Current wallet state

The non-custodial wallet foundation:
- generates or imports the EVM BIP-39 phrase in the browser;
- encrypts it locally using AES-GCM with a PBKDF2-SHA256-derived key;
- exposes only the public address while the wallet is locked;
- requires the phrase backup check before creating a new wallet.

The new local wallet does not yet power the AURA balance card, token balance reads, in-app signing/broadcast, or chain transaction history. The Receive panel states this explicitly. Do not tell users that a deposit has been credited to AURA's internal ledger just because an external transfer reaches the local address.

## Provider policy

dRPC is the intended RPC provider. Authenticated dRPC URLs should be stored as Supabase Edge Function secrets using the AURA_EVM_RPC_* names. Do not put server-side provider credentials in VITE_ variables or commit them to source control.

The deposit-indexer and withdrawal-indexer already include dRPC-first fallbacks. The old deposit-sweep still uses a legacy provider fallback in order to reconcile earlier server-derived deposit wallets; do not remove its required credentials until historic deposits are drained and reconciled. RPC is not a wallet, signer, treasury, gas faucet, or guarantee that a transaction will succeed.

## Current legacy custody path

The old server-managed path uses:
- server-derived per-user EVM deposit addresses;
- server-side custody derivation material in Supabase Vault;
- a deposit indexer that verifies token Transfer logs and confirmation depth;
- an internal AURA wallet ledger;
- a separate sweep transaction from eligible deposit addresses to a configured treasury;
- a withdrawal queue and transaction confirmation/indexing.

The old path is not the new non-custodial wallet. Keep existing on-chain records, ledger rows, Vault data, and any transaction hashes needed to reconcile earlier activity. Never reset, truncate, or delete them in the name of cleanup.

### Historic deposit handling

Deposit detection, ledger credit, and treasury sweeping are separate states:
1. Detect a Transfer event from the expected token contract to a mapped address.
2. Verify successful receipt, amount, destination, token contract and chain-specific confirmations.
3. Credit the internal ledger idempotently only after on-chain verification.
4. Sweep an eligible historic deposit only through its matching server-side derivation key and only to its configured, verified treasury.
5. Mark the sweep complete only after a real successful receipt and matching token Transfer event.
6. For an ambiguous broadcast result, reconcile the existing transaction hash; never submit a second transfer to compensate for uncertainty.

Do not delete historic custody secrets or old address mappings while funds or deposit rows still require them. Any migration must establish both the on-chain disposition and the user-balance disposition before retirement.

### Historic withdrawals

A withdrawal request may reserve an internal ledger balance and require a secure, one-time confirmation. A successful API response or queued job is not a successful payout. Success requires a real transaction hash, successful receipt, matching USDT contract, destination and amount, and the required chain confirmations.

Before changing the legacy broadcaster, check for queued withdrawals, provider submission IDs, transaction hashes, and confirmed-on-chain states. Never blindly resend a transaction if a provider may already have accepted it.

## Security requirements for the new wallet

- The recovery phrase/private key/PIN are never sent to Supabase or Render.
- The local encrypted wallet record is scoped to the current AURA user ID; the server does not receive the phrase.
- Google and TOTP protect AURA account access; they do not recover a non-custodial seed phrase.
- The user needs the relevant network's native gas asset to send from a standard EVM account. Gas sponsorship is not configured in this flow.
- Token contract addresses and decimals must be checked independently on each network.
- Treat malformed recovery data, address mismatch, RPC mismatch, inadequate gas, wrong chain, and ambiguous transaction results as fail-closed states.
- Do not log recovery phrases, private keys, PINs, authenticated RPC URLs, or bearer/worker secrets.

## Verified scope and remaining work

- [x] Existing Google OAuth and TOTP MFA implementation identified.
- [x] Local encrypted EVM wallet create/import/lock/unlock foundation added in the branch.
- [x] Current Receive address source changed to the local wallet record.
- [x] Deposit indexer changed to dRPC-first and public fallback RPCs.
- [ ] Verify dependency install, TypeScript typecheck, Edge Function typecheck, and production build.
- [ ] Configure the owner's authenticated dRPC endpoints in Supabase secrets.
- [ ] Implement and test local-wallet USDT balance reads for all four EVM networks.
- [ ] Implement user-signed, client-side USDT transfers with pre-signing display of network, token, recipient, amount and estimated gas.
- [ ] Implement on-chain confirmation/history for the new wallet.
- [ ] Reconcile and safely retire the old server-managed deposit/sweep flow.
- [ ] Remove the remaining legacy Thirdweb payout route after ensuring no historic transaction needs its reconciliation logic.
- [ ] Upgrade and configure Supabase Auth for passkeys before exposing passkey controls.

Do not declare the crypto wallet production-ready until the unchecked items that are in its launch scope pass real browser and chain tests.