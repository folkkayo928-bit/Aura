import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  createRecoveryPhrase,
  deriveEvmAddress,
  isValidRecoveryPhrase,
  normalizeRecoveryPhrase,
  storeEncryptedLocalEvmWallet,
  unlockLocalEvmWallet,
} from './nonCustodialWallet.ts';

test('local EVM wallet phrase, deterministic derivation, and encrypted recovery', async () => {
  const cryptoHost = globalThis as typeof globalThis & { crypto: Crypto };
  Object.defineProperty(cryptoHost, 'crypto', { value: webcrypto, configurable: true });

  const memory = new Map<string, string>();
  const localWindow = {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => { memory.set(key, value); },
      removeItem: (key: string) => { memory.delete(key); },
    },
  };
  Object.defineProperty(globalThis, 'window', { value: localWindow, configurable: true });

  const phrase = createRecoveryPhrase();
  assert.equal(phrase.split(' ').length, 12);
  assert.equal(isValidRecoveryPhrase(phrase), true);
  assert.equal(isValidRecoveryPhrase('not a valid wallet phrase'), false);
  assert.equal(normalizeRecoveryPhrase('  ABANDON   abandon\nABOUT  '), 'abandon abandon about');

  const knownPhrase = 'test test test test test test test test test test test junk';
  const address = deriveEvmAddress(knownPhrase);
  assert.match(address, /^0x[0-9a-fA-F]{40}$/);
  assert.equal(deriveEvmAddress(knownPhrase), address);

  const saved = await storeEncryptedLocalEvmWallet('test-user', knownPhrase, '81726354');
  assert.equal(saved.address, address);
  const storedText = memory.get('aura:noncustodial-evm:v1:test-user') || '';
  assert.ok(storedText.length > 0);
  assert.equal(storedText.includes(knownPhrase), false, 'recovery phrase must not be stored as plaintext');
  assert.equal(storedText.includes('81726354'), false, 'PIN must not be stored');

  const unlocked = await unlockLocalEvmWallet('test-user', '81726354');
  assert.equal(unlocked.mnemonic, knownPhrase);
  assert.equal(unlocked.address, address);
  await assert.rejects(() => unlockLocalEvmWallet('test-user', '00000000'), /PIN was incorrect/);
});
