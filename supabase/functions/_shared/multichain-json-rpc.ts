export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
};

export type JsonRpcEnvelope = {
  jsonrpc?: unknown;
  id?: unknown;
  result?: unknown;
  error?: { code?: unknown; message?: unknown; data?: unknown } | null;
};

export type JsonRpcOptions = {
  endpoint: string;
  method: string;
  params?: unknown[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

let nextRequestId = 1;

/**
 * Read-only JSON-RPC transport for trusted, server-configured HTTPS endpoints.
 * Never accept endpoint URLs from browser/user input. This helper performs no
 * signing, transaction submission, event persistence, cursor updates, or credits.
 */
export async function callReadOnlyJsonRpc<T = unknown>(options: JsonRpcOptions): Promise<T> {
  const { endpoint, method } = options;
  if (typeof endpoint !== "string") throw new Error("INVALID_RPC_ENDPOINT");
  let parsedUrl: URL;
  try { parsedUrl = new URL(endpoint); } catch { throw new Error("INVALID_RPC_ENDPOINT"); }
  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password ||
      parsedUrl.hash || parsedUrl.hostname.length === 0) {
    throw new Error("UNSAFE_RPC_ENDPOINT");
  }
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(method)) throw new Error("INVALID_RPC_METHOD");

  const timeoutMs = options.timeoutMs ?? 8_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new Error("INVALID_RPC_TIMEOUT");
  }
  const id = nextRequestId++;
  if (nextRequestId > 2_000_000_000) nextRequestId = 1;
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id,
    method,
    params: options.params ?? [],
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error("RPC_HTTP_STATUS_" + response.status);
    const contentLength = response.headers.get("content-length");
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > 2_000_000)) {
      throw new Error("RPC_RESPONSE_TOO_LARGE");
    }
    const body = await response.text();
    if (body.length > 2_000_000) throw new Error("RPC_RESPONSE_TOO_LARGE");
    let envelope: JsonRpcEnvelope;
    try { envelope = JSON.parse(body) as JsonRpcEnvelope; } catch { throw new Error("RPC_INVALID_JSON"); }
    if (!envelope || typeof envelope !== "object" || envelope.jsonrpc !== "2.0" || envelope.id !== id) {
      throw new Error("RPC_INVALID_ENVELOPE");
    }
    if (envelope.error) {
      const code = typeof envelope.error.code === "number" ? envelope.error.code : "unknown";
      const message = typeof envelope.error.message === "string"
        ? envelope.error.message.slice(0, 240)
        : "Provider returned an error";
      throw new Error("RPC_PROVIDER_ERROR_" + code + ": " + message);
    }
    if (!Object.prototype.hasOwnProperty.call(envelope, "result")) throw new Error("RPC_MISSING_RESULT");
    return envelope.result as T;
  } catch (error) {
    if (controller.signal.aborted) throw new Error("RPC_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
