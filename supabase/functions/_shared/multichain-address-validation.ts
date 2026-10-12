function decodeBase58(value: string): Uint8Array {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("INVALID_SOLANA_ADDRESS");
    n = n * 58n + BigInt(digit);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n & 255n));
    n >>= 8n;
  }
  bytes.reverse();
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes++;
  const decoded = new Uint8Array([...new Array(leadingZeroes).fill(0), ...bytes]);
  if (decoded.length !== 32) throw new Error("INVALID_SOLANA_ADDRESS");
  return decoded;
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{48}$/.test(value)) throw new Error("INVALID_TON_ADDRESS");
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(standard);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function crc16Xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function validateTonAddress(value: string): string {
  const raw = /^(-?\d+):([a-fA-F0-9]{64})$/.exec(value);
  if (raw) {
    const workchain = Number(raw[1]);
    if (!Number.isInteger(workchain) || workchain < -128 || workchain > 127) {
      throw new Error("INVALID_TON_ADDRESS");
    }
    return `${workchain}:${raw[2].toLowerCase()}`;
  }

  const bytes = decodeBase64Url(value);
  if (bytes.length !== 36) throw new Error("INVALID_TON_ADDRESS");
  const expected = crc16Xmodem(bytes.slice(0, 34));
  const actual = (bytes[34] << 8) | bytes[35];
  if (expected !== actual) throw new Error("INVALID_TON_ADDRESS");
  const workchain = bytes[1] > 127 ? bytes[1] - 256 : bytes[1];
  const account = Array.from(bytes.slice(2, 34), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${workchain}:${account}`;
}

function validateAddress(network: string, address: string) {
  switch (network) {
    case "ethereum":
    case "bsc":
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error("INVALID_EVM_ADDRESS");
      return address.toLowerCase();
    case "solana":
      decodeBase58(address);
      return address;
    case "ton":
      return validateTonAddress(address);
    default:
      throw new Error("UNSUPPORTED_NETWORK");
  }
}

export { decodeBase58, validateAddress, validateTonAddress };
