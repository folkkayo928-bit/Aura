const DECIMAL_PATTERN = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

export function parseUnitsStrict(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new Error("INVALID_TOKEN_DECIMALS");
  }
  if (typeof value !== "string" || value.length > 120 || value.trim() !== value) {
    throw new Error("INVALID_TOKEN_AMOUNT");
  }
  const match = DECIMAL_PATTERN.exec(value);
  if (!match) throw new Error("INVALID_TOKEN_AMOUNT");
  const whole = match[1];
  const fraction = match[2] ?? "";
  if (fraction.length > decimals) throw new Error("TOKEN_AMOUNT_PRECISION_EXCEEDED");
  const scale = 10n ** BigInt(decimals);
  const fractionUnits = fraction ? BigInt(fraction.padEnd(decimals, "0")) : 0n;
  return BigInt(whole) * scale + fractionUnits;
}

export function formatUnitsExact(amount: bigint, decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    throw new Error("INVALID_TOKEN_DECIMALS");
  }
  if (amount < 0n) throw new Error("INVALID_TOKEN_AMOUNT");
  if (decimals === 0) return amount.toString();
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const fraction = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
