# AURA wallet architecture and migration status

This is the source of truth for the wallet direction. Keep the product small: Supabase Auth for AURA accounts, client-side keys for the non-custodial EVM wallet, and dRPC for blockchain RPC access. Do not introduce another wallet platform unless a specific required feature cannot be implemented safely without it.

## Product rules

1. Users control their own EVM recovery phrase and private key. New phrases are generated in the browser. AURA must never upload a recovery phrase, private key, PIN, or decrypted wallet material to Supabase, Render, logs, analytics, or support.
2. The personal wallet uses the standard EVM path m/44'/60'/0'/0/0. Ethereum, Polygon, Arbitrum One, and BNB Smart Chain use the same EVM address for this account.
3. The phrase is encrypted on the current device with AES-GCM. The encryption key is derived using PBKDF2-SHA256 with 600,000 iterations and a unique salt. The local record contains public address metadata plus ciphertext; it does not store the plaintext phrase. The 8–12 digit device PIN is not the recovery phrase. Recommend a longer, unpredictable PIN and maintain an offline phrase backup.
4. Google/Apple/email/Telegram sign-in establishes the AURA app identity. It does not control or recover the non-custodial wallet. TOTP MFA already exists for the AURA account. Passkey registration, listing/removal and sign-in are implemented with the current Supabase JS SDK in this branch; the hosted Supabase Auth project must have passkeys enabled with the production WebAuthn relying-party ID/origin before they can work.
5. User-owned wallet funds are not the same as the legacy AURA internal USDT ledger. Never credit the internal ledger based only on a local address, submitted transaction, or frontend success message. Server-side on-chain proof and a deliberately designed ledger policy are required before any reconciliation feature is added.

## What is in the current non-custodial foundation

- Wallet creation and import run in the client using BIP-39 and viem.
- The user confirms three randomly selected recovery words before a new phrase is encrypted locally.
- The encrypted local wallet can be locked, unlocked by PIN, and restored from the recovery phrase.
- The receive panel reads the public address from the current account's local wallet record. It no longer requests a new server-controlled deposit address.
- Thirdweb's optional Base Sepolia preview and its direct frontend dependency have been removed.
- The deposit indexer now prefers its dRPC endpoint list and public fallbacks instead of reaching for Alchemy first.

This branch contains public-RPC balances and locally signed EVM sends for Ethereum, Polygon, Arbitrum One and BNB Smart Chain, with validation, simulation, precomputed transaction hashes, receipt verification and device-local outgoing history. It also adds opt-in incoming USDT/USDT0 indexing in a separate table. Incoming tracking starts from a bounded recent scan/cursor and is not a full historical archive; it never credits the AURA/P2P ledger. These are implementation milestones, not proof of production operation: no controlled mainnet send/receive has been verified and public RPC availability has not been load/soak-tested.

## RPC configuration

dRPC is the intended RPC provider. Each server-side EVM function accepts optional per-network overrides:

- AURA_EVM_RPC_ETHEREUM
- AURA_EVM_RPC_POLYGON
- AURA_EVM_RPC_ARBITRUM
- AURA_EVM_RPC_BSC

Add the user's authenticated dRPC endpoints as Supabase Edge Function secrets when they are ready. Do not paste API credentials into chat, source control, a VITE_ variable, or frontend bundles. Public fallback endpoints may be rate-limited and are not a substitute for testing the authenticated configuration.

Provider responsibility is simple: RPC reads chain state and submits signed transactions. It does not create wallets, own keys, pay gas, or guarantee execution. A non-custodial EOA must have the chain's native gas token for on-chain sends. There is no automatic gas sponsor in the non-custodial wallet foundation.

## Legacy custody must be migrated, not erased

Earlier AURA versions created server-derived per-user deposit addresses and used server-side mnemonic/XPub material, deposit sweeping, and an internal ledger. That is a custodial-compatible flow, not the same as the new locally controlled wallet.

A previously detected/credited deposit and an unfinished sweep may still depend on that old path. Keep its data and required secrets until each outstanding deposit is reconciled and affected users' balances are accounted for. Never delete the Vault mnemonic, XPub, RPC credential, deposit rows, or old wallet mappings merely to make the repository look clean.

Legacy code that still needs retirement:
- deposit-sweep still has the old server-side signing and Alchemy fallback path so historic funds can be reconciled safely.
- withdrawal-request, withdrawal-broadcaster and treasury-health still include the legacy Thirdweb server-wallet route alongside old treasury-signing checks.
- provision-deposit-address remains deployed for the old flow, although the current frontend no longer calls it.

These are explicitly legacy-only. Do not wire new non-custodial functionality through them. Remove their remaining vendor/custody code only after the old pipeline is drained, transaction records are reconciled, and a replacement flow is tested.

## Authentication and security status

- Google and Apple OAuth and email/password authentication exist in AuthContext.
- Telegram Mini App sign-in exists separately; do not replace or merge it with wallet identity.
- TOTP enrollment and sign-in challenge components exist. Sensitive actions must enforce MFA server-side where configured; hiding a button in the client is not authorization.
- A wallet PIN currently encrypts/unlocks the local wallet only. It does not replace Supabase authentication or TOTP.
- Passkey UI and SDK calls exist in this branch, but the hosted Supabase Auth setting and production WebAuthn relying-party ID/origin are not verified. Keep this out of the wallet launch gate until live registration and sign-in pass on web and Telegram WebView.
- No recovery phrase or private key may appear in logs, crash reports, URLs, clipboard automatically, database tables, or server requests.

## Release checklist

- [x] Client-side create/import, recovery-word check, local encryption and PIN unlock implemented in the branch.
- [x] Google OAuth and TOTP reviewed as existing features rather than rebuilt.
- [x] Thirdweb browser preview removed.
- [x] Deposit indexer moved to dRPC-first fallbacks.
- [ ] Complete dRPC API configuration and test every target network.
- [x] Implement public-RPC reads for native and network-token balances, with chain ID and token-decimal checks. Still verify every network against reliable production RPC endpoints.
- [x] Implement client-side signing/broadcast code for personal-wallet sends with recipient, chain, token-decimal, token-balance, native gas, simulation, and explicit-confirmation checks. Still require controlled mainnet transfer tests before launch.
- [x] Implement outgoing receipt checks, canonical block-hash checks before marking transfers confirmed, and device-local history.
- [x] Add opt-in incoming USDT/USDT0 transfer indexing with receipt/token/sender/recipient/amount verification, configured confirmation thresholds, and canonical block-hash checks before status changes. The latest indexer also stores the receipt block hash for detected/confirmed rows; historical coverage is bounded and users are told that transfers before tracking may not appear.
- [ ] Retire legacy server-managed receiving, sweeping and Thirdweb payout code only after old funds and queued operations are reconciled.
- [x] Implement passkey sign-in, registration, listing and removal using the current Supabase JS SDK.
- [ ] Enable passkeys on the hosted Supabase Auth service with the stable production RP ID/origin, then test registration and sign-in in the live browser/Telegram WebView.
- [ ] Test incoming indexing on all four chains under RPC failure, reorg, duplicate log, and catch-up conditions. Keep its rows read-only to users and separate from wallet_ledger.
- [ ] Implement and audit the on-chain-to-ledger funding path before enabling P2P funding from a personal wallet. Required design:
  1. The user explicitly initiates a transfer from their own wallet to a configured AURA-controlled treasury/deposit address; merely tracking their personal wallet never funds the AURA ledger.
  2. The backend independently verifies the chain, allowlisted token contract, destination treasury, sender, amount, transaction receipt, canonical block hash and chain-specific confirmation threshold. Never accept frontend-provided amount/status as proof.
  3. Record each transfer/log under a unique idempotency key (network + transaction hash + log index + token contract + treasury address) and atomically reconcile it to exactly one ledger credit. Retries must return the same result, not add another credit.
  4. Keep detected funds pending until confirmation; handle RPC outages and reorgs without prematurely crediting. If a credited transfer is later reorganized, apply a separately audited compensating ledger entry—never rewrite/delete ledger history.
  5. Verify treasury address ownership/configuration, signing and gas readiness, fee/minimum/deposit policy, unsupported-token rejection, monitoring, reconciliation and rollback before production enablement.
  6. Keep personal-wallet history, legacy custodial deposits and P2P escrow as distinct records. P2P escrow may reserve only confirmed, available internal-ledger funds; disputes and refunds must use existing server-enforced state transitions.
  No crediting function or automatic credit is enabled by the current personal-wallet indexer.
- [ ] Run controlled low-value mainnet sends/receives on each enabled network, verify balances and receipts across independent RPC/explorers, and test mobile/Telegram WebView recovery before release.
- [ ] Complete end-to-end P2P tests for funded buy/sell orders, escrow-lock/refund, payment-proof, dispute, and settlement. Preserve the existing open dispute.
- [ ] Implement TON Connect with server-side TON proof verification and additive database constraint migration; keep it disabled until verified.
- [ ] Run security and end-to-end tests on web and Telegram Mini App before calling the wallet production-ready.
