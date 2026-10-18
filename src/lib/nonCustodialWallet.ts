import { generateMnemonic, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { mnemonicToAccount } from 'viem/accounts';

const STORAGE_PREFIX = 'aura:noncustodial-evm:v1:';
const STORAGE_VERSION = 1 as const;
const PBKDF2_ITERATIONS = 600_000;
const DERIVATION_PATH = "m/44'/60'/0'/0/0";
const encoder = new TextEncoder();

export type LocalEvmWalletMetadata = {
  version: typeof STORAGE_VERSION;
  address: \`0x\${string}\`;
  derivationPath: string;
};

type StoredLocalEvmWallet = LocalEvmWalletMetadata & {
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export type UnlockedLocalEvmWallet = LocalEvmWalletMetadata & {
  mnemonic: string;
};

export function normalizeRecoveryPhrase(value: string): string {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
}

export function createRecoveryPhrase(): string {
  return generateMnemonic(wordlist, 128);
}

export function isValidRecoveryPhrase(value: string): boolean {
  const normalized = normalizeRecoveryPhrase(value);
  return validateMnemonic(normalized, wordlist);
}

export function deriveEvmAddress(value: string): \`0x\${string}\` {
  const mnemonic = normalizeRecoveryPhrase(value);
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error('That recovery phrase is not a valid English BIP-39 phrase.');
  }
  return mnemonicToAccount(mnemonic, { path: DERIVATION_PATH }).address;
}

function storageKey(userId: string): string {
  const id = userId.trim();
  if (!id) throw new Error('Sign in to AURA before creating a local wallet.');
  return STORAGE_PREFIX + id;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const output = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }
  return output;
}

function isStoredWallet(value: unknown): value is StoredLocalEvmWallet {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<StoredLocalEvmWallet>;
  return record.version === STORAGE_VERSION
    && typeof record.address === 'string'
    && /^0x[0-9a-fA-F]{40}$/.test(record.address)
    && record.derivationPath === DERIVATION_PATH
    && record.kdf === 'PBKDF2-SHA256'
    && record.iterations === PBKDF2_ITERATIONS
    && typeof record.salt === 'string'
    && typeof record.iv === 'string'
    && typeof record.ciphertext === 'string';
}

function readStoredWallet(userId: string): StoredLocalEvmWallet | null {
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The saved wallet record is damaged. Do not overwrite it; use your recovery phrase to restore the wallet safely.');
  }
  if (!isStoredWallet(parsed)) {
    throw new Error('The saved wallet record is invalid. Do not overwrite it; restore from your recovery phrase after preserving the old data.');
  }
  return parsed;
}

/** Public address metadata is safe to read while the wallet is locked. */
export function getLocalEvmWalletMetadata(userId: string): LocalEvmWalletMetadata | null {
  const record = readStoredWallet(userId);
  if (!record) return null;
  return {
    version: STORAGE_VERSION,
    address: record.address,
    derivationPath: record.derivationPath,
  };
}

async function deriveEncryptionKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('This browser does not support secure local wallet encryption. Open AURA in a secure browser and try again.');
  }
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function additionalData(userId: string): Uint8Array {
  return encoder.encode(userId.trim() + ':aura-local-evm-wallet:v' + STORAGE_VERSION);
}

function validatePin(pin: string): void {
  if (!/^\d{8,12}$/.test(pin)) {
    throw new Error('Choose an 8–12 digit wallet PIN. A longer, unpredictable PIN is safer.');
  }
}

export async function storeEncryptedLocalEvmWallet(
  userId: string,
  recoveryPhrase: string,
  pin: string,
): Promise<LocalEvmWalletMetadata> {
  const key = storageKey(userId);
  validatePin(pin);

  if (window.localStorage.getItem(key)) {
    throw new Error('A local wallet record already exists. It will not be overwritten automatically.');
  }

  const mnemonic = normalizeRecoveryPhrase(recoveryPhrase);
  const address = deriveEvmAddress(mnemonic);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptionKey = await deriveEncryptionKey(pin, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(userId) },
    encryptionKey,
    encoder.encode(mnemonic),
  );

  const record: StoredLocalEvmWallet = {
    version: STORAGE_VERSION,
    address,
    derivationPath: DERIVATION_PATH,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };

  try {
    window.localStorage.setItem(key, JSON.stringify(record));
  } catch {
    throw new Error('AURA could not save the encrypted wallet on this device. Free up browser storage and retry; your recovery phrase has not been saved.');
  }

  return {
    version: STORAGE_VERSION,
    address,
    derivationPath: DERIVATION_PATH,
  };
}

export async function unlockLocalEvmWallet(
  userId: string,
  pin: string,
): Promise<UnlockedLocalEvmWallet> {
  validatePin(pin);
  const record = readStoredWallet(userId);
  if (!record) throw new Error('No local wallet is saved for this AURA account on this device.');

  try {
    const key = await deriveEncryptionKey(pin, fromBase64(record.salt));
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(record.iv),
        additionalData: additionalData(userId),
      },
      key,
      fromBase64(record.ciphertext),
    );
    const mnemonic = normalizeRecoveryPhrase(new TextDecoder().decode(decrypted));
    const address = deriveEvmAddress(mnemonic);
    if (address.toLowerCase() !== record.address.toLowerCase()) {
      throw new Error('Wallet address integrity check failed.');
    }
    return {
      version: STORAGE_VERSION,
      address: record.address,
      derivationPath: record.derivationPath,
      mnemonic,
    };
  } catch {
    throw new Error('The PIN was incorrect or the encrypted wallet could not be verified. Your saved wallet was not changed.');
  }
}
