import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { callReadOnlyJsonRpc } from "./multichain-json-rpc.ts";

function mockFetch(payload: unknown, status = 200): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assertEquals(init?.method, "POST");
    assertEquals((init?.redirect ?? "follow"), "error");
    const request = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: request.id, ...payload as object }), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

Deno.test("read-only JSON-RPC returns a correctly matched result", async () => {
  const result = await callReadOnlyJsonRpc<string>({
    endpoint: "https://rpc.example.test",
    method: "eth_chainId",
    fetchImpl: mockFetch({ result: "0x1" }),
  });
  assertEquals(result, "0x1");
});

Deno.test("read-only JSON-RPC rejects non-HTTPS endpoints before fetch", async () => {
  await assertRejects(
    () => callReadOnlyJsonRpc({ endpoint: "http://rpc.example.test", method: "eth_blockNumber", fetchImpl: mockFetch({ result: "0x1" }) }),
    Error,
    "UNSAFE_RPC_ENDPOINT",
  );
});

Deno.test("read-only JSON-RPC rejects endpoint credentials", async () => {
  await assertRejects(
    () => callReadOnlyJsonRpc({ endpoint: "https://user:pass@rpc.example.test", method: "eth_blockNumber", fetchImpl: mockFetch({ result: "0x1" }) }),
    Error,
    "UNSAFE_RPC_ENDPOINT",
  );
});

Deno.test("read-only JSON-RPC blocks syntactically valid transaction submission methods", async () => {
  await assertRejects(
    () => callReadOnlyJsonRpc({ endpoint: "https://rpc.example.test", method: "eth_sendRawTransaction", fetchImpl: mockFetch({ result: "0x1" }) }),
    Error,
    "RPC_METHOD_NOT_ALLOWED",
  );
});

Deno.test("read-only JSON-RPC rejects invalid method names", async () => {
  await assertRejects(
    () => callReadOnlyJsonRpc({ endpoint: "https://rpc.example.test", method: "eth_sendRawTransaction;bad", fetchImpl: mockFetch({ result: "0x1" }) }),
    Error,
    "INVALID_RPC_METHOD",
  );
});

Deno.test("read-only JSON-RPC rejects mismatched response IDs", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: -1, result: "0x1" }))) as typeof fetch;
  await assertRejects(
    () => callReadOnlyJsonRpc({ endpoint: "https://rpc.example.test", method: "eth_chainId", fetchImpl }),
    Error,
    "RPC_INVALID_ENVELOPE",
  );
});

Deno.test("read-only JSON-RPC propagates provider error without accepting result", async () => {
  await assertRejects(
    () => callReadOnlyJsonRpc({ endpoint: "https://rpc.example.test", method: "eth_blockNumber", fetchImpl: mockFetch({ error: { code: -32000, message: "provider unavailable" } }) }),
    Error,
    "RPC_PROVIDER_ERROR_-32000",
  );
});

Deno.test("read-only JSON-RPC rejects missing result", async () => {
  await assertRejects(
    () => callReadOnlyJsonRpc({ endpoint: "https://rpc.example.test", method: "eth_blockNumber", fetchImpl: mockFetch({}) }),
    Error,
    "RPC_MISSING_RESULT",
  );
});

Deno.test("read-only JSON-RPC rejects oversized response body", async () => {
  const fetchImpl = (async () => new Response("x".repeat(2_000_001))) as typeof fetch;
  await assertRejects(
    () => callReadOnlyJsonRpc({ endpoint: "https://rpc.example.test", method: "eth_blockNumber", fetchImpl }),
    Error,
    "RPC_RESPONSE_TOO_LARGE",
  );
});
