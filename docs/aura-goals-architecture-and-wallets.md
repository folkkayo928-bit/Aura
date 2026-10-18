# AURA wallet architecture and migration status

This is the source of truth for the wallet direction. Keep the product small: Supabase Auth for AURA accounts, client-side keys for the non-custodial EVM wallet, and dRPC for blockchain RPC access. Do not introduce another wallet platform unless a specific required feature cannot be implemented safely without it.

## Product rules

1. Users control their own EVM recovery phrase and private key. New phrases are generated in the browser. AURA must never upload a recovery phrase, private key, PIN, or decrypted wallet material to Supabase, Render, logs, analytics, or support.
2. The personal wallet uses the standard EVM path m/44'/60'/0'/0/0. Ethereum, Polygon, Arbitrum One, and BNB Smart Chain use the same EVM address for this account.
3. The phrase is encrypted on the current device with AES-GCM. The encryption key is derived using PBKDF2-SHA256 with 600,000 iterations and a unique salt. The local record contains public address metadata plus ciphertext; it does not store the plaintext phrase. The 8–12 digit device PIN is not the recovery phrase. Recommend a longer, unpredictable PIN and maintain an offline phrase backup.
4. Google/Apple/email/Telegram sign-in establishes the AURA app identity. It does not control or recover the non-custodial wallet. TOTP MFA already exists for the AURA account. Passkey sign-in is not yet implemented/enabled in the current project and must not be advertised as available.
5. User-owned wallet funds are not the same as the legacy AURA internal USDT ledger. Never credit the internal ledger based only on a local address, submitted transaction, or frontend success message. Server-side on-chain proof and a deliberately designed ledger policy are required before any reconciliation feature is added.

## What is in the current non-custodial foundation

- Wallet creation and import run in the client using BIP-39 and viem.
- The user confirms three randomly selected recovery words before a new phrase is encrypted locally.
- The encrypted local wallet can be locked, unlocked by PIN, and restored from the recovery phrase.
- The receive panel reads the public address from the current account's local wallet record. It no longer requests a new server-controlled deposit address.
- Thirdweb's optional Base Sepolia preview and its direct frontend dependency have been removed.
- The deposit indexer now prefers its dRPC endpoint list and public fallbacks instead of reaching for Alchemy first.

This is a wallet-key foundation, not a claim that all crypto functions are production-ready. The current in-app balance, send/broadcast, fee quote, and on-chain transaction-history paths are not yet fully connected to the new local wallet. The receive UI warns users about that limitation. Do not remove that warning until balances and transaction flows are implemented and independently verified.

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
- Passkeys are a follow-on item. The current Supabase JS dependency and hosted Auth configuration need to be upgraded/configured before passkeys can be exposed to users. Supabase documents current JS passkey support as experimental and requiring a newer SDK; validate the current configuration before implementing.
- No recovery phrase or private key may appear in logs, crash reports, URLs, clipboard automatically, database tables, or server requests.

## Release checklist

- [x] Client-side create/import, recovery-word check, local encryption and PIN unlock implemented in the branch.
- [x] Google OAuth and TOTP reviewed as existing features rather than rebuilt.
- [x] Thirdweb browser preview removed.
- [x] Deposit indexer moved to dRPC-first fallbacks.
- [ ] Complete dRPC API configuration and test every target network.
- [ ] Read on-chain balances and USDT balances for the local wallet, using verified token contracts and correct decimals.
- [ ] Implement client-side signing and broadcasting for non-custodial sends; validate chain, recipient, amount and gas before signing.
- [ ] Implement reliable transaction status and history; do not report success before observing the transaction hash and confirmed receipt.
- [ ] Retire legacy server-managed receiving, sweeping and Thirdweb payout code only after old funds and queued operations are reconciled.
- [ ] Upgrade/configure Supabase Auth and implement passkeys.
- [ ] Run security and end-to-end tests on web and Telegram Mini App before calling the wallet production-ready.
