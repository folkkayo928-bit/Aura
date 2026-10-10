/**
 * Isolated thirdweb client configuration for AURA.
 *
 * This module intentionally does not connect a wallet, sign, broadcast,
 * mint, swap, or bridge assets. Those operations must be added behind
 * explicit user confirmation and server-side policy after testnet validation.
 */
import { createThirdwebClient, type ThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

let cachedClient: ThirdwebClient | undefined;

/** Test network only; production chains must be selected explicitly later. */
export const AURA_THIRDWEB_TEST_CHAIN = baseSepolia;

export function isThirdwebConfigured(): boolean {
  return Boolean(import.meta.env.VITE_THIRDWEB_CLIENT_ID?.trim());
}

/**
 * Returns null when the public Client ID has not been configured yet.
 * Never put a thirdweb Secret Key in a VITE_ variable or browser bundle.
 */
export function getThirdwebClient(): ThirdwebClient | null {
  const clientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID?.trim();
  if (!clientId) return null;

  if (!cachedClient) {
    cachedClient = createThirdwebClient({ clientId });
  }

  return cachedClient;
}
