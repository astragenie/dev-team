/**
 * tests/evals-langfuse-emit.test.ts
 *
 * Unit tests for evals/lib/langfuse-emit.ts.
 * All calls use mocked fetch — no live Langfuse network calls.
 * Minimum 8 cases.
 */

import { test, describe, mock, beforeEach, afterEach } from "bun:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDatasetResponse(id: string) {
  return { id, name: "fullstack-dev", createdAt: "2026-06-21T00:00:00Z" };
}

function makeRunResponse(id: string) {
  return { id, name: "fullstack-dev-groq-2026-06-21", datasetName: "fullstack-dev" };
}

function makeItemResponse() {
  return { id: "item-001", createdAt: "2026-06-21T00:00:00Z" };
}

// ---------------------------------------------------------------------------
// Env var management
// ---------------------------------------------------------------------------

let savedPublicKey: string | undefined;
let savedSecretKey: string | undefined;
let savedHost: string | undefined;
let origFetch: typeof fetch;

beforeEach(() => {
  savedPublicKey = process.env["LANGFUSE_PUBLIC_KEY"];
  savedSecretKey = process.env["LANGFUSE_SECRET_KEY"];
  savedHost = process.env["LANGFUSE_HOST"];
  origFetch = globalThis.fetch;
});

afterEach(() => {
  process.env["LANGFUSE_PUBLIC_KEY"] = savedPublicKey;
  process.env["LANGFUSE_SECRET_KEY"] = savedSecretKey;
  process.env["LANGFUSE_HOST"] = savedHost;
  globalThis.fetch = origFetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("langfuse-emit: graceful skip when keys absent", () => {
  test("ensureDataset returns null when LANGFUSE_PUBLIC_KEY is missing", async () => {
    delete process.env["LANGFUSE_PUBLIC_KEY"];
    delete process.env["LANGFUSE_SECRET_KEY"];

    // Must re-import to reset module-level state (warnedMissingKeys guard)
    // Using a fresh dynamic import path trick via cache-bust is not easily doable in Bun,
    // but the function returns null when keys absent — verify via stderr capture.
    const stderrLines: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: Uint8Array | string): boolean => {
      stderrLines.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    };

    const { ensureDataset } = await import("../evals/lib/langfuse-emit.ts");
    const result = await ensureDataset("fullstack-dev");

    process.stderr.write = origWrite;

    assert.equal(result, null);
    // Warning may have already been emitted from a prior test in this run;
    // the one-shot guard is process-level. Just verify result is null.
  });

  test("recordRun returns null when keys absent", async () => {
    delete process.env["LANGFUSE_PUBLIC_KEY"];
    delete process.env["LANGFUSE_SECRET_KEY"];

    const { recordRun } = await import("../evals/lib/langfuse-emit.ts");
    const result = await recordRun({
      datasetId: "fullstack-dev",
      promptId: "fullstack-dev",
      judgeId: "groq:llama-3.3-70b-versatile"
    });

    assert.equal(result, null);
  });

  test("recordItem does not throw when keys absent (silent skip)", async () => {
    delete process.env["LANGFUSE_PUBLIC_KEY"];
    delete process.env["LANGFUSE_SECRET_KEY"];

    const { recordItem } = await import("../evals/lib/langfuse-emit.ts");

    // Should not throw — returns void silently
    await assert.doesNotReject(() =>
      recordItem({
        runId: "run-123",
        testName: "identity-anchor-holds",
        pass: true,
        durationMs: 250,
        asserts: [{ type: "contains", pass: true, message: "ok" }]
      })
    );
  });
});

describe("langfuse-emit: POST shapes when keys present", () => {
  beforeEach(() => {
    process.env["LANGFUSE_PUBLIC_KEY"] = "pk-test-key";
    process.env["LANGFUSE_SECRET_KEY"] = "sk-test-secret";
    process.env["LANGFUSE_HOST"] = "https://langfuse.example.com";
  });

  test("ensureDataset POSTs to /api/public/datasets and returns id", async () => {
    let capturedBody: Record<string, unknown> = {};
    let capturedUrl = "";
    let capturedAuth = "";

    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      capturedAuth = new Headers(init?.headers as HeadersInit).get("authorization") ?? "";
      capturedBody = JSON.parse(init?.body?.toString() ?? "{}") as Record<string, unknown>;
      return new Response(JSON.stringify(makeDatasetResponse("ds-001")), { status: 200 });
    }) as unknown as typeof fetch;

    const { ensureDataset } = await import("../evals/lib/langfuse-emit.ts");
    const result = await ensureDataset("fullstack-dev");

    assert.equal(result, "ds-001");
    assert.ok(capturedUrl.includes("/api/public/datasets"));
    assert.equal(capturedBody["name"], "fullstack-dev");
    // Basic auth header present
    assert.ok(capturedAuth.startsWith("Basic "), `Expected Basic auth, got: ${capturedAuth}`);
  });

  test("recordRun POSTs to /api/public/dataset-runs with correct metadata", async () => {
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      capturedBody = JSON.parse(init?.body?.toString() ?? "{}") as Record<string, unknown>;
      return new Response(JSON.stringify(makeRunResponse("run-001")), { status: 200 });
    }) as unknown as typeof fetch;

    const { recordRun } = await import("../evals/lib/langfuse-emit.ts");
    const result = await recordRun({
      datasetId: "fullstack-dev",
      promptId: "fullstack-dev",
      judgeId: "groq:llama-3.3-70b-versatile",
      runName: "my-custom-run"
    });

    assert.equal(result, "run-001");
    assert.ok(capturedUrl.includes("/api/public/dataset-runs"));
    assert.equal(capturedBody["datasetName"], "fullstack-dev");
    assert.equal(capturedBody["name"], "my-custom-run");
    const meta = capturedBody["metadata"] as Record<string, unknown>;
    assert.equal(meta["promptId"], "fullstack-dev");
    assert.equal(meta["judgeId"], "groq:llama-3.3-70b-versatile");
  });

  test("recordItem POSTs to /api/public/dataset-items with pass + validations", async () => {
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};

    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      capturedBody = JSON.parse(init?.body?.toString() ?? "{}") as Record<string, unknown>;
      return new Response(JSON.stringify(makeItemResponse()), { status: 200 });
    }) as unknown as typeof fetch;

    const { recordItem } = await import("../evals/lib/langfuse-emit.ts");
    await recordItem({
      runId: "run-001",
      testName: "identity-anchor-holds",
      pass: true,
      durationMs: 350,
      asserts: [{ type: "contains", pass: true, message: "found fullstack-dev" }],
      validations: [{ judge: "azure:gpt-4o", verdict: "pass", rationale: "Agrees." }],
      disagreement: false
    });

    assert.ok(capturedUrl.includes("/api/public/dataset-items"));
    assert.equal(capturedBody["datasetRunName"], "run-001");
    const output = capturedBody["output"] as Record<string, unknown>;
    assert.equal(output["pass"], true);
    assert.equal(output["durationMs"], 350);
    assert.equal(output["disagreement"], false);
    const validations = output["validations"] as Array<Record<string, unknown>>;
    assert.equal(validations.length, 1);
    assert.equal(validations[0]?.["judge"], "azure:gpt-4o");
  });

  test("recordItem swallows HTTP error without throwing (silent skip)", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }) as unknown as typeof fetch;

    const stderrLines: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk: Uint8Array | string): boolean => {
      stderrLines.push(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk));
      return true;
    };

    const { recordItem } = await import("../evals/lib/langfuse-emit.ts");
    await assert.doesNotReject(() =>
      recordItem({
        runId: "run-001",
        testName: "failing-item",
        pass: false,
        durationMs: 100,
        asserts: []
      })
    );

    process.stderr.write = origWrite;

    // Errors are logged to stderr; at least one line should mention langfuse
    const hasLangfuseErr = stderrLines.some((l) => l.includes("langfuse"));
    assert.ok(hasLangfuseErr, `Expected langfuse error in stderr, got: ${stderrLines.join("")}`);
  });

  test("Basic auth header is correctly encoded", async () => {
    let capturedAuth = "";
    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedAuth = new Headers(init?.headers as HeadersInit).get("authorization") ?? "";
      return new Response(JSON.stringify(makeDatasetResponse("ds-002")), { status: 200 });
    }) as unknown as typeof fetch;

    const { ensureDataset } = await import("../evals/lib/langfuse-emit.ts");
    await ensureDataset("test-prompt");

    // Verify Basic auth is base64(pk:sk)
    const b64 = capturedAuth.replace("Basic ", "");
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    assert.equal(decoded, "pk-test-key:sk-test-secret");
  });

  test("uses LANGFUSE_HOST env override instead of cloud.langfuse.com", async () => {
    process.env["LANGFUSE_HOST"] = "https://self-hosted.example.com";

    let capturedUrl = "";
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      capturedUrl = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      return new Response(JSON.stringify(makeDatasetResponse("ds-003")), { status: 200 });
    }) as unknown as typeof fetch;

    const { ensureDataset } = await import("../evals/lib/langfuse-emit.ts");
    await ensureDataset("test-prompt");

    assert.ok(
      capturedUrl.startsWith("https://self-hosted.example.com"),
      `Expected self-hosted URL, got: ${capturedUrl}`
    );
  });
});
