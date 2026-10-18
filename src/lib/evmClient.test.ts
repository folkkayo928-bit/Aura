import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  EVM_NETWORKS,
  estimateEvmUsdtTransfer,
  sendEvmUsdt,
} from './evmClient.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const knownPhrase = 'test test test test test test test test test test test junk';
const validRecipient = '0x000000000000000000000000000000000000dead';

test('EVM wallet supports only the intended four networks and token precision', () => {
  assert.deepEqual(EVM_NETWORKS.map((network) => network.key), [
    'ethereum', 'polygon', 'arbitrum', 'bsc',
  ]);
  assert.deepEqual(
    EVM_NETWORKS.map(({ key, tokenDecimals, tokenSymbol }) => [key, tokenDecimals, tokenSymbol]),
    [
      ['ethereum', 6, 'USDT'],
      ['polygon', 6, 'USDT0'],
      ['arbitrum', 6, 'USDT'],
      ['bsc', 18, 'USDT'],
    ],
  );
});

test('invalid recipient is rejected before any RPC request for estimate and send', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('RPC must not be reached for invalid input');
  };

  await assert.rejects(
    () => estimateEvmUsdtTransfer(knownPhrase, 'ethereum', '0x1234', '1'),
    /valid EVM recipient/,
  );
  await assert.rejects(
    () => sendEvmUsdt(knownPhrase, 'ethereum', '0x1234', '1'),
    /valid EVM recipient/,
  );
  assert.equal(calls, 0);
});

test('zero, scientific notation, and excess token precision are rejected before RPC', async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('RPC must not be reached for invalid amount');
  };

  await assert.rejects(
    () => estimateEvmUsdtTransfer(knownPhrase, 'ethereum', validRecipient, '0'),
    /greater than zero/,
  );
  await assert.rejects(
    () => sendEvmUsdt(knownPhrase, 'ethereum', validRecipient, '1e-6'),
    /using digits and an optional decimal point/,
  );
  await assert.rejects(
    () => estimateEvmUsdtTransfer(knownPhrase, 'ethereum', validRecipient, '0.0000001'),
    /up to 6 decimal places/,
  );
  assert.equal(calls, 0);
});


test('uncertain signed broadcast returns its hash without retrying on another RPC', async () => {
  const broadcastHosts: string[] = [];
  globalThis.fetch = async (input, init) => {
    const host = new URL(String(input)).host;
    const request = JSON.parse(String(init?.body)) as {
      id: number;
      method: string;
      params?: Array<{ data?: string } | string>;
    };
    if (request.method === 'eth_sendRawTransaction') {
      broadcastHosts.push(host);
      if (host === 'eth.drpc.org') {
        return new Response('temporary RPC failure', { status: 503 });
      }
      return new Response(JSON.stringify({
        jsonrpc: '2.0', id: request.id, result: '0x' + '11'.repeat(32),
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    let result: unknown = '0x' + '0'.repeat(64);
    if (request.method === 'eth_chainId') result = '0x1';
    else if (request.method === 'eth_getTransactionCount') result = '0x0';
    else if (request.method === 'eth_gasPrice') result = '0x3b9aca00';
    else if (request.method === 'eth_getBalance') result = '0x56bc75e2d63100000';
    else if (request.method === 'eth_estimateGas') result = '0x186a0';
    else if (request.method === 'eth_call') {
      const callData = String((request.params?.[0] as { data?: string } | undefined)?.data || '').toLowerCase();
      if (callData.startsWith('0x313ce567')) result = '0x6';
      else if (callData.startsWith('0x70a08231')) result = '0x3b9aca00';
      else if (callData.startsWith('0xa9059cbb')) result = '0x' + '0'.repeat(63) + '1';
    }
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const sent = await sendEvmUsdt(knownPhrase, 'ethereum', validRecipient, '1');
  assert.equal(sent.broadcastStatus, 'uncertain');
  assert.match(sent.hash, /^0x[a-fA-F0-9]{64}$/);
  assert.deepEqual(broadcastHosts, ['eth.drpc.org']);
});
