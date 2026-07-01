/**
 * tests/langfuse-emit-trace.test.ts
 *
 * SLICE-114 (FEAT-186 S5) — AC-3 coverage for single-trace emission.
 *
 * Tests the new `recordTrace` + `deriveTraceId` exports added to
 * `evals/lib/langfuse-emit.ts`.
 *
 * Strategy: real HTTP calls are unavailable in CI, so we:
 *   1. Test `deriveTraceId` schema directly (pure function, no I/O).
 *   2. Test the graceful-skip paths (keys absent, LANGFUSE_DISABLE=1).
 *   3. Intercept global `fetch` to count trace POST calls without a live Langfuse host.
 *      The intercept asserts trace count === evaluate-call count on a mixed fixture.
 *
 * AC-3 fulfilled: trace count equals the number of `recordTrace` invocations
 * on a fixture mix of two pipelines ("eval" + "gepa"), each with one evaluate call.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { deriveTraceId, recordTrace } from "../evals/lib/langfuse-emit.ts";
import type { LangfuseTracePayload } from "../evals/lib/langfuse-emit.ts";

// ---------------------------------------------------------------------------
// Shared fixture payloads — one per pipeline (eval + gepa)
// ---------------------------------------------------------------------------

const EVAL_PAYLOAD: LangfuseTracePayload = {
  pipeline: "eval",
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  context: { promptId: "builder", fixture: "evals/fixtures/builder-basic.json", version: "1.0.0" },
  pass: true,
  score: 0.95,
  latency_ms: 1200,
  cost_usd: 0.004,
  tokens: { in: 1000, out: 200 }
};

const GEPA_PAYLOAD: LangfuseTracePayload = {
  pipeline: "gepa",
  provider: "groq",
  model: "llama3-8b-8192",
  context: { promptId: "builder", fixture: "evals/fixtures/builder-basic.json" },
  pass: false,
  score: 0.4,
  latency_ms: 800,
  cost_usd: 0.001
};

// ---------------------------------------------------------------------------
// AC-3a: deriveTraceId schema
// ---------------------------------------------------------------------------

describe("deriveTraceId — consistent trace_id schema", () => {
  test("schema: {promptId}:{fixture}:{timestamp}", () => {
    const id = deriveTraceId("builder", "evals/fixtures/builder.json", "2026-07-01T00:00:00.000Z");
    expect(id).toBe("builder:evals_fixtures_builder.json:2026-07-01T00:00:00.000Z");
  });

  test("undefined promptId falls back to 'unknown'", () => {
    const id = deriveTraceId(undefined, "fix.json", "2026-07-01T00:00:00.000Z");
    expect(id.startsWith("unknown:")).toBe(true);
  });

  test("undefined fixture falls back to '_'", () => {
    const id = deriveTraceId("builder", undefined, "2026-07-01T00:00:00.000Z");
    expect(id).toBe("builder:_:2026-07-01T00:00:00.000Z");
  });

  test("special chars in promptId and fixture are sanitised (no colon/slash)", () => {
    const id = deriveTraceId("my/prompt", "path/to/fixture.json", "2026-07-01T00:00:00.000Z");
    // slashes become underscores; dots in fixture name are preserved
    const [p, f] = id.split(":");
    expect(p).not.toContain("/");
    expect(f).not.toContain("/");
  });

  test("two calls with different timestamps produce different trace IDs", () => {
    const id1 = deriveTraceId("builder", "fix.json", "2026-07-01T00:00:00.000Z");
    const id2 = deriveTraceId("builder", "fix.json", "2026-07-01T00:00:01.000Z");
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// AC-3b: graceful skip — missing keys
// ---------------------------------------------------------------------------

describe("recordTrace — graceful skip when keys absent", () => {
  let origPubKey: string | undefined;
  let origSecKey: string | undefined;

  beforeEach(() => {
    origPubKey = process.env["LANGFUSE_PUBLIC_KEY"];
    origSecKey = process.env["LANGFUSE_SECRET_KEY"];
    delete process.env["LANGFUSE_PUBLIC_KEY"];
    delete process.env["LANGFUSE_SECRET_KEY"];
    // suppress the single stderr warning about missing keys
  });

  afterEach(() => {
    if (origPubKey !== undefined) process.env["LANGFUSE_PUBLIC_KEY"] = origPubKey;
    else delete process.env["LANGFUSE_PUBLIC_KEY"];
    if (origSecKey !== undefined) process.env["LANGFUSE_SECRET_KEY"] = origSecKey;
    else delete process.env["LANGFUSE_SECRET_KEY"];
  });

  test("returns null — no throw — when LANGFUSE keys absent", async () => {
    let threw = false;
    let result: string | null = "SENTINEL";
    try {
      result = await recordTrace(EVAL_PAYLOAD);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-3c: graceful skip — LANGFUSE_DISABLE=1
// ---------------------------------------------------------------------------

describe("recordTrace — graceful skip when LANGFUSE_DISABLE=1", () => {
  beforeEach(() => {
    process.env["LANGFUSE_DISABLE"] = "1";
    process.env["LANGFUSE_PUBLIC_KEY"] = "pub-test";
    process.env["LANGFUSE_SECRET_KEY"] = "sec-test";
  });

  afterEach(() => {
    delete process.env["LANGFUSE_DISABLE"];
    delete process.env["LANGFUSE_PUBLIC_KEY"];
    delete process.env["LANGFUSE_SECRET_KEY"];
  });

  test("returns null when LANGFUSE_DISABLE=1 even with keys set", async () => {
    const result = await recordTrace(EVAL_PAYLOAD);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-3d: trace count === evaluate-call count on a mixed fixture
//
// Intercepts global `fetch` to count POST /api/public/traces calls without
// a real Langfuse host. Simulates two evaluate() calls — one from the eval
// pipeline and one from the gepa pipeline.
// ---------------------------------------------------------------------------

describe("recordTrace — trace count equals evaluate-call count (AC-3 core)", () => {
  let tracePostCount: number;
  let savedFetch: typeof globalThis.fetch;

  beforeEach(() => {
    tracePostCount = 0;
    process.env["LANGFUSE_PUBLIC_KEY"] = "pub-test";
    process.env["LANGFUSE_SECRET_KEY"] = "sec-test";
    delete process.env["LANGFUSE_DISABLE"];

    savedFetch = globalThis.fetch;
    // Replace global fetch with a spy that counts trace POSTs and returns 200 OK.
    // Cast via unknown to avoid the `preconnect` compatibility requirement on the
    // built-in `fetch` type (we only need the basic RequestInfo + init signature).
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/public/traces") && init?.method === "POST") {
        tracePostCount++;
        return new Response(JSON.stringify({ id: "mock-trace-id" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      // Other endpoints (shouldn't be hit in these tests): return 200 OK stub
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = savedFetch;
    delete process.env["LANGFUSE_PUBLIC_KEY"];
    delete process.env["LANGFUSE_SECRET_KEY"];
    delete process.env["LANGFUSE_DISABLE"];
  });

  test("two evaluate() calls → two traces emitted (eval + gepa pipelines)", async () => {
    // Simulate one evaluate() call from the eval pipeline
    const trace1 = await recordTrace(EVAL_PAYLOAD);
    // Simulate one evaluate() call from the gepa pipeline
    const trace2 = await recordTrace(GEPA_PAYLOAD);

    // AC-3: trace count === evaluate-call count
    expect(tracePostCount).toBe(2);

    // Both calls returned trace IDs (non-null)
    expect(trace1).not.toBeNull();
    expect(trace2).not.toBeNull();
  });

  test("each trace has consistent schema (promptId:fixture:timestamp format)", async () => {
    const traceId = await recordTrace(EVAL_PAYLOAD);
    // Schema: {promptId}:{fixture_sanitised}:{iso-timestamp}
    // promptId = "builder", fixture = "evals/fixtures/builder-basic.json" → sanitised
    expect(traceId).not.toBeNull();
    const parts = (traceId ?? "").split(":");
    // Should have at least 3 segments: promptId, fixture, timestamp (ISO has colons too)
    // We verify the prefix is predictable
    expect(parts[0]).toBe("builder");
    expect(parts[1]).toMatch(/^evals_fixtures_builder-basic\.json$/);
  });

  test("payload without tokens field emits trace successfully", async () => {
    // exactOptionalPropertyTypes: cannot assign `undefined` to an optional key.
    // Build the payload by omitting `tokens` (and spelling out `context`) entirely
    // instead of spreading undefined values.
    const payloadNoTokens: LangfuseTracePayload = {
      pipeline: GEPA_PAYLOAD.pipeline,
      provider: GEPA_PAYLOAD.provider,
      model: GEPA_PAYLOAD.model,
      context: { promptId: "builder", fixture: "evals/fixtures/builder-basic.json" },
      pass: GEPA_PAYLOAD.pass,
      score: GEPA_PAYLOAD.score,
      latency_ms: GEPA_PAYLOAD.latency_ms,
      cost_usd: GEPA_PAYLOAD.cost_usd
      // `tokens` intentionally absent
    };
    const traceId = await recordTrace(payloadNoTokens);
    expect(traceId).not.toBeNull();
    expect(tracePostCount).toBe(1);
  });

  test("five sequential evaluate() calls → five traces (stress, count integrity)", async () => {
    const pipeline = ["eval", "gepa", "eval", "gepa", "eval"];
    for (const p of pipeline) {
      const payload: LangfuseTracePayload = {
        ...(p === "eval" ? EVAL_PAYLOAD : GEPA_PAYLOAD),
        pipeline: p
      };
      await recordTrace(payload);
    }
    expect(tracePostCount).toBe(5);
  });
});
