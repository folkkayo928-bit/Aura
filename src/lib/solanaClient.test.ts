import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readSolanaUsdtBalance } from './solanaClient.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('rejects malformed Solana wallet addresses before RPC calls', async () => {
  await assert.rejects(() => readSolanaUsdtBalance('not-a-solana-address'), /INVALID_SOLANA_WALLET_ADDRESS/);
});

test('sums confirmed USDT token accounts using integer units', async () => {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const endpoint = String(input);
    const request = JSON.parse(String(init?.body)) as { method: string };
    calls.push(request.method + '@' + endpoint);
    const result = request.method === 'getGenesisHash'
      ? '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
      : {
          context: { slot: 12345 },
          value: [
            { account: { data: { parsed: { info: { tokenAmount: { amount: '1000000', decimals: 6 } } } } } },
            { account: { data: { parsed: { info: { tokenAmount: { amount: '2500000', decimals: 6 } } } } } },
          ],
        };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const snapshot = await readSolanaUsdtBalance('11111111111111111111111111111111');
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.tokenSymbol, 'USDT');
  assert.equal(snapshot.tokenBalance, '3.5');
  assert.equal(snapshot.slot, 12345);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].startsWith('getGenesisHash@https://api.mainnet-beta.solana.com'));
});

test('falls back when a Solana RPC endpoint reports a non-mainnet genesis hash', async () => {
  const endpoints: string[] = [];
  globalThis.fetch = async (input, init) => {
    const endpoint = String(input);
    const request = JSON.parse(String(init?.body)) as { method: string };
    endpoints.push(endpoint);
    const result = endpoint.includes('api.mainnet-beta.solana.com')
      ? 'wrong-cluster'
      : request.method === 'getGenesisHash'
        ? '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
        : { context: { slot: 7 }, value: [] };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const snapshot = await readSolanaUsdtBalance('11111111111111111111111111111111');
  assert.equal(snapshot.available, true);
  assert.equal(snapshot.tokenBalance, '0');
  assert.ok(endpoints.includes('https://solana-rpc.publicnode.com'));
});
