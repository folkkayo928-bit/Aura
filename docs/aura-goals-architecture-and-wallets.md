# AURA: Goals, Architecture, and Function Map

## Product goal

AURA is a mobile-first digital-art and Web3 community product, including the Telegram Mini App. Its user journey is:

**Create → Discover/Collect → Own → Value → Trade → Sell → Convert → Send/Receive → Manage.**

The product combines art publishing and collections, creator/collector profiles, community interactions, an AURA USDT internal ledger, on-chain funding/withdrawal, P2P trading, and account/admin tools.

## Major product areas

- **Accounts and identity:** email/password and supported OAuth paths, plus Telegram Mini App authentication that checks the signed Telegram identity and avoids cross-account session reuse.
- **Home and Discover:** artwork feeds, creator profiles, likes/saves/comments, collections, and artwork detail views.
- **Create and collections:** artwork uploads, creator-owned collection CRUD, optional scheduled release, and watcher notifications.
- **AURA Wallet:** internal USDT balance and ledger, internal transfers between AURA accounts, supported on-chain deposit addresses, withdrawal requests with confirmation, and transaction/withdrawal history.
- **P2P trading:** buy/sell offers, saved fiat payment methods, seller-side reserve/hold rules, 5-minute acceptance expiry, 15-minute payment stage, payment-proof uploads, chat, disputes, settlement, trader stats, notifications, and the dedicated My Trades history/recovery page.
- **Admin and drops:** authorized admin operations, drop/release management, scheduled publication, and audit-oriented operations.
- **Thirdweb:** optional wallet-connection preview on **Base Sepolia testnet only**. This preview is deliberately separate from AURA’s production ledger, deposits, withdrawals, and P2P escrow. It is not a production USDT bridge or transaction broadcaster.

## Wallet and USDT network map

The existing AURA custodial on-chain backend defines four supported EVM networks:

| Network | Chain ID | USDT contract | Token decimals | Deposit confirmations |
| --- | ---: | --- | ---: | ---: |
| Ethereum | 1 | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | 6 | 12 |
| Polygon | 137 | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` | 6 | 30 |
| Arbitrum One | 42161 | `0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9` | 6 | 20 |
| BNB Smart Chain | 56 | `0x55d398326f99059fF775485246999027B3197955` | 18 | 15 |

Mainnet token contracts and chain support must be confirmed independently from UI labels before enabling or changing a network.

### How the money paths work

1. **Receive on-chain:** the authenticated user gets a per-user HD deposit address from `provision-deposit-address`. `deposit-indexer` scans token transfer events and credits the internal wallet only after the configured confirmation threshold and server-side accounting checks.
2. **Deposit sweeping:** `deposit-sweep` moves eligible credited deposits from derived deposit wallets to configured treasury addresses. Credit-to-ledger and sweep-to-treasury are separate states: a credited balance must not be described as swept until the sweep transaction is confirmed.
3. **Withdraw on-chain:** `withdrawal-request` checks eligibility and reserves funds through the backend; Telegram/email confirmation precedes `withdrawal-broadcaster`. `withdrawal-indexer` reconciles the actual on-chain transfer and final status.
4. **Internal transfer:** `internal_transfer` moves USDT between two AURA accounts in the database ledger, with idempotency protection. It is not a blockchain transaction and does not need the sender to select a network.
5. **P2P escrow:** P2P holds and settlement are managed by server-side database functions and the internal ledger. Never mark a trade as settled because a browser modal, wallet connector, or transaction request appeared successful.
6. **External wallet linking:** MetaMask/Phantom connection is used to verify wallet ownership. A linked wallet is not automatically the owner of the AURA ledger and its balance is not automatically spendable by AURA.

### Explicitly unavailable / separate

- AURA’s on-chain deposit and withdrawal selectors currently support Ethereum, Polygon, Arbitrum One, and BNB Smart Chain.
- Solana is **not** enabled for AURA USDT deposits or withdrawals. Phantom can be linked for wallet-ownership verification; that is different from Solana USDT support.
- The thirdweb panel connects test wallets on Base Sepolia only. It does not move mainnet assets, credit AURA balances, or substitute for the custodial signer and treasury setup.
- Internal AURA USDT is an application ledger balance. It is not a promise that the same amount is immediately liquid in every chain’s external treasury.

## Deployment and operational components

- **Frontend:** React + TypeScript + Vite.
- **Hosting:** Render web service, auto-deployed from GitHub `main`.
- **Backend/data:** Supabase Auth, Postgres/RLS, Realtime, Storage, Edge Functions, and scheduled database jobs.
- **Key backend workers:** `provision-deposit-address`, `deposit-indexer`, `deposit-sweep`, `withdrawal-request`, `withdrawal-confirm`, `withdrawal-broadcaster`, `withdrawal-indexer`, `telegram-miniapp-auth`, `telegram-p2p-notifications`.
- **Safety model:** browser bundle uses only public Supabase configuration; signing keys, custody material, worker secrets, and provider secrets must remain server-side. Production balances should come from the database ledger and confirmed transaction records—not local state or thirdweb connection state.

## Required private deployment configuration

For real EVM withdrawals, the Edge Function runtime needs a matching server-side signer and treasury configuration:

- Shared signer: `AURA_EVM_PRIVATE_KEY`. Its public address must match the configured treasury address on every chain where it is used.
- Per-chain RPC endpoints: `AURA_EVM_RPC_ETHEREUM`, `AURA_EVM_RPC_POLYGON`, `AURA_EVM_RPC_ARBITRUM`, and `AURA_EVM_RPC_BSC`.
- Per-chain treasury addresses: `AURA_EVM_TREASURY_ETHEREUM`, `AURA_EVM_TREASURY_POLYGON`, `AURA_EVM_TREASURY_ARBITRUM`, and `AURA_EVM_TREASURY_BSC`.
- Deposit sweep needs a valid treasury for each chain and server-side derivation custody that matches the registered XPub; the deployment must log an actionable missing-configuration status rather than being mistaken for a completed sweep.
- `VITE_THIRDWEB_CLIENT_ID` is a **public** frontend Client ID for the optional Base Sepolia preview. It is separate from all custody secrets.

Set private values only in the Supabase Edge Function secrets/runtime configuration after independently verifying the address, signer ownership, token contract, and native-gas funding on each chain. Never paste private keys or secret values into chat, source control, browser variables, or logs. A production withdrawal should remain queued until those checks pass; do not manually replay a transfer to clear the queue.

## Release acceptance checklist

- [ ] Main GitHub typecheck and production build are green.
- [ ] Latest Render deployment commit matches the merged GitHub commit.
- [ ] P2P My Trades loads server-side rows and remains available after background/return.
- [ ] Two separate accounts pass the P2P acceptance, proof, release/cancel, chat, and notification flow.
- [ ] Deposit indexer cursor advances on each supported network and the credited amount matches the actual token transfer.
- [ ] Each credited deposit's treasury sweep reaches a confirmed on-chain state, or an actionable non-secret configuration error is recorded.
- [ ] Withdrawals have valid server-only signer/treasury configuration and pass confirmation, broadcast, and indexer reconciliation without stuck queued funds.
- [ ] Internal transfers are tested with idempotent retry, correct debits/credits, and updated history.
- [ ] Thirdweb test connection works only on Base Sepolia and cannot silently affect AURA balances or production transaction flows.
- [ ] Security advisor warnings and Auth dashboard settings are reviewed before declaring production readiness.

## Known release caveats (updated 2026-10-10)

- The BSC deposit record inspected during this audit is marked `credited` while its sweep state remains `pending`; ledger credit is not proof of a completed sweep.
- An Ethereum withdrawal inspected during this audit remains `queued` with no broadcast hash. The worker recorded that broadcaster credentials are not configured. Do not retry it manually or report it as sent until the server configuration and chain state have been reconciled.
- Supabase Edge Function logs show Alchemy free-tier `eth_getLogs` range warnings. The scanner also has fallback RPC endpoints and its chain cursors were observed advancing; continue monitoring cursor progress and confirmed deposit reconciliation.
- The thirdweb Client ID is a public frontend setting (`VITE_THIRDWEB_CLIENT_ID`) and must be configured/restricted by origin in the thirdweb dashboard if the testnet preview is to be used. Never expose a thirdweb Secret Key in frontend code.
