# AURA — working notes for this repository

## How this app runs here

- The sandbox runs **only the Vite/React client** on host port 3000 via
  `docker-compose.base44.yml` (`web` service, source bind-mounted, hot reload).
- The backend is the **hosted Supabase project** (`rtqcistkoomzmzxzasxc`): auth, Postgres
  with RLS, RPCs, storage and the Deno Edge Functions in `supabase/functions/` all run
  there. There is no local database, so sandbox changes to `supabase/migrations/*.sql`
  or edge functions take effect **only after they are pushed/deployed** to the project.
- Public browser values (Supabase URL + publishable key) come from `.env.base44-defaults`.
  Values delivered to `/run/base44/app.env` override them.
- `server.js` (Express) is the production host for the Telegram bot webhook and the
  `/aura-bot-avatar.jpg` asset. The browser client never calls it, so the sandbox stack
  does not start it.

## Non-obvious commands

- Typecheck the client: `npx tsc --noEmit -p tsconfig.web.json` (this is what `npm run lint`
  and CI use). The root `tsconfig.json` does **not** exclude `supabase/functions`, and those
  Deno sources import `npm:`/`https:` specifiers, so typechecking with it alone is noise.
- Typecheck the transaction edge functions:
  `deno check --no-config supabase/functions/<name>/index.ts`
- `npm run build` runs `scripts/configure-telegram.mjs` before `vite build`.

## Domain rules that must not be broken

- The internal wallet ledger is **single-asset (USDT on EVM chains)**. `wallet_accounts.balance_usdt`
  and `wallet_ledger.amount_usdt` are the source of truth; the P2P escrow, artwork collection and
  internal transfer RPCs all read those columns.
- Adding a chain or a token is a **backend-first** change, never a UI label. Each network needs a
  chain id, canonical token contract, decimals, RPC strategy, confirmation threshold, treasury
  signer and receipt verification before its option may appear in the UI. See
  `docs/transaction-operations-and-readiness.md` §7.
- Money paths fail closed: an unconfigured treasury/signer returns a 503 and reserves nothing.
  Never present a queued, submitted or broadcast transaction as confirmed.
- Supported networks are USDT on Ethereum, Polygon, Arbitrum One, BNB Smart Chain, Base, Optimism
  and Avalanche C-Chain. The browser-side list lives only in `src/config/crypto.ts`; never re-declare
  a network union in a component (that is how BSC stayed missing from the withdraw form).
- Enabling a network is one release, not a UI label: the migration
  (`supabase/migrations/20261011120000_enable_base_optimism_avalanche_usdt.sql` and later ones), the
  seven Edge Functions that carry a chain map, and that network's `AURA_EVM_TREASURY_*` secret must
  all land together. Each Edge Function keeps its own chain map
  (`deposit-indexer`, `deposit-sweep`, `withdrawal-request`, `withdrawal-broadcaster`,
  `withdrawal-indexer`, `treasury-health`, `provision-deposit-address`) — extending one and not the
  others silently breaks that network's money path.
- The internal ledger is single-asset, so USDC or a native gas coin needs a real multi-asset ledger
  migration first; do not add such an asset by extending only the UI or a chain map.
- Several core tables (`wallet_accounts`, `wallet_ledger`, `profiles`, artwork/P2P tables) are
  **not created by any migration in this repo** — they pre-date it in the hosted project. Check the
  live schema before writing migrations that touch them.
