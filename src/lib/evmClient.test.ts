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
