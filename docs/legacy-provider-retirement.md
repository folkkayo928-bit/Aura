# Legacy provider retirement notes

AURA's long-term provider set is deliberately small:
- dRPC: EVM RPC reads and broadcast of user-signed transactions.
- Supabase Auth/Database/Edge Functions: account identity, public address metadata where needed, and verified transaction indexing.
- No Thirdweb browser wallet UI or Thirdweb npm SDK is part of the new wallet.

This file exists only to prevent unsafe deletion of old transaction-reconciliation code.

## Remaining legacy references

The old server-managed ledger/treasury pipeline still contains Thirdweb API calls in:
- supabase/functions/withdrawal-request
- supabase/functions/withdrawal-broadcaster
- supabase/functions/treasury-health

The old deposit sweep also still contains Alchemy fallback code and uses server-side key derivation material. This legacy code may be needed to reconcile historic internal-ledger balances and previous server-derived deposit addresses. It must not be used for the new user's local wallet.

The current production database audit found no nonterminal withdrawal rows marked as Thirdweb-originated at the time of review. That is not a permanent guarantee: recheck the live queue and provider transaction IDs immediately before disabling reconciliation code.

## Safe retirement sequence

1. Finish the new user's own-wallet flows: local key generation/import, on-chain balances, client-side signing, RPC configuration, token and chain validation, fee estimation, broadcast and transaction confirmation.
2. Freeze creation of new legacy server-managed deposit addresses after verifying the new receive UI is released.
3. Reconcile all historic deposits and sweeps, including every confirmed ledger credit and its on-chain source.
4. Verify there are no queued or ambiguous withdrawals using a Thirdweb provider transaction ID and no provider submission marker requiring reconciliation.
5. Move remaining legitimate user balances through an auditable, authorized migration. Never delete ledger rows or key material to make counts zero.
6. Remove Thirdweb API calls and obsolete Alchemy integration from the legacy functions, then remove their secrets only after the old funds and transactions no longer rely on them.
7. Verify dRPC failover, native gas requirements, and all on-chain transactions after retirement.

Do not configure new Thirdweb credentials. Do not delete the existing legacy Vault entries until reconciliation and recovery checks are complete.