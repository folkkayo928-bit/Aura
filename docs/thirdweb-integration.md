# AURA thirdweb integration (isolated rollout)

## Goal

Evaluate thirdweb for in-app wallets/smart accounts, NFT minting, IPFS artwork storage, gas sponsorship, and token swap/bridge routes while preserving AURA's existing wallet and trading infrastructure.

## Current state

- Added the official `thirdweb` TypeScript SDK dependency.
- Added `lib/thirdweb.ts`, which initializes a browser client only when `VITE_THIRDWEB_CLIENT_ID` is present.
- Test chain is Base Sepolia only.
- The Wallet screen includes an opt-in thirdweb connection preview for MetaMask and Phantom, with auto-connect disabled and the chain pinned to Base Sepolia.
- AURA's internal send/withdrawal, swap, bridge, mint, authentication, and balance-ledger flows are not wired to this connection; it is not linked to the Supabase account or AURA internal ledger. Use only a disposable test wallet and never use real funds with this preview. A wallet provider may have its own testnet controls outside AURA's app flows.
- No minting, swapping, bridging, schema changes, or live Supabase function changes are enabled by this scaffold.
- No API key or secret is committed.

## Setup

1. Create a project in the thirdweb dashboard: https://thirdweb.com/dashboard
2. Create a Client ID and restrict its allowed origins to the deployed AURA domains and local development origin.
3. Add `VITE_THIRDWEB_CLIENT_ID` to the frontend environment for preview/testing. This is a public Client ID, not a Secret Key.
4. Never put a thirdweb Secret Key in a `VITE_*` variable or frontend code. Any backend-only secret must be configured in the hosting provider's server-side environment.
5. Install dependencies and run the normal build/lint checks before merging.

## Base Sepolia wallet preview test checklist

Run this checklist only in an isolated preview deployment of this feature branch, never by merging it to production just to test it.

- [ ] Confirm the preview URL is restricted to the intended test environment and the public thirdweb Client ID has the expected allowed origins.
- [ ] Open the Wallet screen with the Client ID configured; verify the testnet preview is visible.
- [ ] Open the Wallet screen without the Client ID configured; verify the normal AURA wallet UI still renders and no crash occurs.
- [ ] Connect a disposable MetaMask test wallet and confirm the wallet UI identifies the external connection.
- [ ] Repeat with a disposable Phantom test wallet where the browser/extension supports it.
- [ ] Verify the selected chain is Base Sepolia; reject any request to switch to a production chain for this preview.
- [ ] Disconnect and reload; confirm auto-connect remains disabled and no wallet is silently reconnected.
- [ ] Confirm connecting/disconnecting does not change AURA's Supabase session, internal USDT balance, ledger, deposit/withdrawal state, or P2P state.
- [ ] Confirm no signing, minting, swap, bridge, send, or withdrawal action is initiated from the preview.
- [ ] Review browser console/network requests for errors and ensure no thirdweb Secret Key or wallet private material appears in client bundles or logs.

Do not call the preview validated until these checks have been performed in a real browser. CI passing confirms typecheck/build only, not extension behavior or on-chain transactions.

## Safe implementation order

1. Validate client initialization on Base Sepolia.
2. Add wallet authentication only after choosing how thirdweb identity links to the existing Supabase user ID. Do not create duplicate AURA accounts or silently replace current authentication.
3. Add a testnet NFT mint flow using a dedicated test contract and verified upload/storage behavior.
4. Add swap/bridge quote previews with explicit chain, token, slippage, fees, destination, and user confirmation. Treat quotes as estimates and verify final on-chain status before updating AURA UI or ledger.
5. Add bounded gas sponsorship policies (testnet first); limit by chain, contract, wallet, and spend budget.
6. Review production chain support, token liquidity, country/provider availability, smart-contract security, and cost before enabling mainnet.

## Existing AURA protections

- Supabase remains the source of truth for AURA balances, internal ledger, deposits, withdrawals, and P2P reservations.
- Do not migrate or replace current HD deposit addresses, signing paths, withdrawal broadcasters, Telegram flows, or auth.
- Never credit an internal balance from a submitted quote or frontend success state. Verify the actual transaction and reconcile it server-side.
- Do not expose server secrets or wallet private keys to the browser.
- Mainnet transaction execution stays disabled until explicit security review and tests pass.

## Cost controls to apply

- Begin with Base Sepolia; thirdweb documents testnet gas sponsorship without a billing method.
- Set hard sponsorship spend limits and only sponsor approved contract calls.
- Monitor monthly active wallets, server-wallet requests, sponsored transactions, storage, RPC, and swap/bridge fees in the thirdweb dashboard.
- thirdweb swap/bridge routes have a documented 0.3% protocol fee, excluding network and any onramp provider fees; verify current pricing before launch.
