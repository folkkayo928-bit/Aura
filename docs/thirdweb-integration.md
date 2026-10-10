# AURA thirdweb integration (isolated rollout)

## Goal

Evaluate thirdweb for in-app wallets/smart accounts, NFT minting, IPFS artwork storage, gas sponsorship, and token swap/bridge routes while preserving AURA's existing wallet and trading infrastructure.

## Current state

- Added the official `thirdweb` TypeScript SDK dependency.
- Added `lib/thirdweb.ts`, which initializes a browser client only when `VITE_THIRDWEB_CLIENT_ID` is present.
- Test chain is Base Sepolia only.
- The Wallet screen includes an opt-in thirdweb connection preview for MetaMask and Phantom, with auto-connect disabled and the chain pinned to Base Sepolia.
- The preview does not sign messages or submit transactions on AURA's behalf; it is not linked to the Supabase account or AURA internal ledger.
- No minting, swapping, bridging, schema changes, or live Supabase function changes are enabled by this scaffold.
- No API key or secret is committed.

## Setup

1. Create a project in the thirdweb dashboard: https://thirdweb.com/dashboard
2. Create a Client ID and restrict its allowed origins to the deployed AURA domains and local development origin.
3. Add `VITE_THIRDWEB_CLIENT_ID` to the frontend environment for preview/testing. This is a public Client ID, not a Secret Key.
4. Never put a thirdweb Secret Key in a `VITE_*` variable or frontend code. Any backend-only secret must be configured in the hosting provider's server-side environment.
5. Install dependencies and run the normal build/lint checks before merging.

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
