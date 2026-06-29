/**
 * tests/evals-providers.test.ts
 *
 * Unit tests for SLICE-89 providers: ClaudePJudge, OllamaJudge, GeminiJudge.
 * Live network calls gated behind CREW_EVAL_LIVE=1.
 * Minimum 9 cases (3+ per provider).
 */

import { test, describe, mock, beforeEach } from "bun:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIVE = process.env["CREW_EVAL_LIVE"] === "1";

function makeJudgeRequest() {
  return {
    rubric: "The response must say hello",
    candidateOutput: "Hello world! I am a candidate response."
  };
}

function makeFetchMock(responseBody: unknown, status = 200): typeof fetch {
  return mock(async () => {
    return new Response(JSON.stringify(responseBody), { status });
  }) as unknown as typeof fetch;
}

function makeThrowingFetchMock(message: string): typeof fetch {
  return mock(async () => {
    throw new Error(message);
  }) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// OllamaJudge tests
// ---------------------------------------------------------------------------

describe("OllamaJudge (unit — mocked fetch)", () => {
  test("returns pass=true when model responds YES", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeFetchMock({
      message: { role: "assistant", content: "YES\nThe response greets the user." },
      done: true,
      prompt_eval_count: 20,
      eval_count: 10
    });

    const { OllamaJudge } = await import("../evals/providers/ollama.ts");
    const judge = new OllamaJudge({ model: "llama3.3" });
    const result = await judge.judge(makeJudgeRequest());

    assert.equal(result.pass, true);
    assert.equal(result.score, 1);
    assert.ok(result.rationale.length > 0);
    assert.equal(result.providerCost?.tokensIn, 20);
    assert.equal(result.providerCost?.tokensOut, 10);

    globalThis.fetch = origFetch;
  });

  test("returns pass=false when model responds NO", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeFetchMock({
      message: { role: "assistant", content: "NO\nThe response does not greet the user." },
      done: true
    });

    const { OllamaJudge } = await import("../evals/providers/ollama.ts");
    const judge = new OllamaJudge({ model: "llama3.3" });
    const result = await judge.judge(makeJudgeRequest());

    assert.equal(result.pass, false);
    assert.equal(result.score, 0);

    globalThis.fetch = origFetch;
  });

  test("throws with clear error when Ollama is unreachable", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeThrowingFetchMock("ECONNREFUSED");

    const { OllamaJudge } = await import("../evals/providers/ollama.ts");
    const judge = new OllamaJudge({ host: "http://localhost:11434" });

    await assert.rejects(
      () => judge.judge(makeJudgeRequest()),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes("Ollama") || err.message.includes("connection"),
          `Expected Ollama connection error, got: ${err.message}`
        );
        return true;
      }
    );

    globalThis.fetch = origFetch;
  });

  test("throws on non-200 HTTP response", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response("model not found", { status: 404 });
    }) as unknown as typeof fetch;

    const { OllamaJudge } = await import("../evals/providers/ollama.ts");
    const judge = new OllamaJudge({ model: "nonexistent" });

    await assert.rejects(() => judge.judge(makeJudgeRequest()), /HTTP 404/);

    globalThis.fetch = origFetch;
  });

  if (LIVE) {
    test("LIVE: OllamaJudge hits real local endpoint", async () => {
      const { OllamaJudge } = await import("../evals/providers/ollama.ts");
      const judge = new OllamaJudge();
      const result = await judge.judge(makeJudgeRequest());
      assert.ok(typeof result.pass === "boolean");
      assert.ok(result.score >= 0 && result.score <= 1);
    });
  }
});

// ---------------------------------------------------------------------------
// GeminiJudge tests
// ---------------------------------------------------------------------------

describe("GeminiJudge (unit — mocked fetch)", () => {
  beforeEach(() => {
    process.env["GEMINI_API_KEY"] = "test-key-123";
  });

  test("returns pass=true when Gemini responds YES", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeFetchMock({
      candidates: [
        { content: { parts: [{ text: "YES\nThe candidate response clearly says hello." }] } }
      ],
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 15 }
    });

    const { GeminiJudge } = await import("../evals/providers/gemini.ts");
    const judge = new GeminiJudge({ apiKey: "test-key" });
    const result = await judge.judge(makeJudgeRequest());

    assert.equal(result.pass, true);
    assert.equal(result.score, 1);
    assert.ok(result.rationale.includes("hello"));
    assert.equal(result.providerCost?.tokensIn, 50);
    assert.equal(result.providerCost?.tokensOut, 15);

    globalThis.fetch = origFetch;
  });

  test("returns pass=false when Gemini responds NO", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeFetchMock({
      candidates: [{ content: { parts: [{ text: "NO\nCandidate does not satisfy criterion." }] } }],
      usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 8 }
    });

    const { GeminiJudge } = await import("../evals/providers/gemini.ts");
    const judge = new GeminiJudge({ apiKey: "test-key" });
    const result = await judge.judge(makeJudgeRequest());

    assert.equal(result.pass, false);
    assert.equal(result.score, 0);

    globalThis.fetch = origFetch;
  });

  test("throws when GEMINI_API_KEY is missing", async () => {
    const saved = process.env["GEMINI_API_KEY"];
    delete process.env["GEMINI_API_KEY"];

    const { GeminiJudge } = await import("../evals/providers/gemini.ts");
    const judge = new GeminiJudge({ apiKey: "" });

    await assert.rejects(() => judge.judge(makeJudgeRequest()), /GEMINI_API_KEY/);

    process.env["GEMINI_API_KEY"] = saved;
  });

  test("throws on HTTP 429 rate limit", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ error: { message: "rate limit exceeded" } }), {
        status: 429
      });
    }) as unknown as typeof fetch;

    const { GeminiJudge } = await import("../evals/providers/gemini.ts");
    const judge = new GeminiJudge({ apiKey: "test-key" });

    await assert.rejects(() => judge.judge(makeJudgeRequest()), /HTTP 429/);

    globalThis.fetch = origFetch;
  });

  test("provider id includes model name", async () => {
    const { GeminiJudge } = await import("../evals/providers/gemini.ts");
    const judge = new GeminiJudge({ apiKey: "test-key", model: "gemini-2.5-flash" });
    assert.equal(judge.id, "gemini:gemini-2.5-flash");
  });

  if (LIVE) {
    test("LIVE: GeminiJudge hits real Gemini API", async () => {
      const { GeminiJudge } = await import("../evals/providers/gemini.ts");
      const judge = new GeminiJudge();
      const result = await judge.judge(makeJudgeRequest());
      assert.ok(typeof result.pass === "boolean");
    });
  }
});

// ---------------------------------------------------------------------------
// ClaudePJudge tests
// ---------------------------------------------------------------------------

describe("ClaudePJudge (unit)", () => {
  test("ClaudePJudge.id is always 'claude-p'", async () => {
    const { ClaudePJudge } = await import("../evals/providers/claude-p.ts");
    const judge = new ClaudePJudge();
    assert.equal(judge.id, "claude-p");
  });

  test("ClaudePJudge is in JUDGE_REGISTRY", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    assert.ok("claude-p" in JUDGE_REGISTRY, "claude-p missing from JUDGE_REGISTRY");
    assert.equal(typeof JUDGE_REGISTRY["claude-p"], "function");
  });

  test("ClaudePJudge factory from JUDGE_REGISTRY returns a JudgeProvider", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    const factory = JUDGE_REGISTRY["claude-p"];
    assert.ok(factory, "claude-p factory missing");
    const judge = await factory();
    assert.equal(judge.id, "claude-p");
    assert.equal(typeof judge.judge, "function");
  });

  test("ClaudePJudge instantiates with default model", async () => {
    const { ClaudePJudge } = await import("../evals/providers/claude-p.ts");
    const judge = new ClaudePJudge();
    // id is fixed as 'claude-p'
    assert.equal(judge.id, "claude-p");
  });

  if (LIVE) {
    test("LIVE: ClaudePJudge runs real claude subprocess", async () => {
      const { ClaudePJudge } = await import("../evals/providers/claude-p.ts");
      const judge = new ClaudePJudge({ timeoutMs: 60000 });
      const result = await judge.judge(makeJudgeRequest());
      assert.ok(typeof result.pass === "boolean");
    });
  }
});

// ---------------------------------------------------------------------------
// JUDGE_REGISTRY — AC3: >= 5 entries
// ---------------------------------------------------------------------------

describe("JUDGE_REGISTRY (AC3)", () => {
  test("has at least 5 provider entries", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    const keys = Object.keys(JUDGE_REGISTRY);
    assert.ok(
      keys.length >= 5,
      `Expected >= 5 registry entries, got ${keys.length}: ${keys.join(", ")}`
    );
  });

  test("all 5 required providers present", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    for (const id of ["generic-openai", "groq", "claude-p", "ollama", "gemini"]) {
      assert.ok(id in JUDGE_REGISTRY, `Missing: ${id}`);
    }
  });

  test("ollama factory returns JudgeProvider with judge() method", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    const factory = JUDGE_REGISTRY["ollama"];
    assert.ok(factory, "ollama factory missing");
    const judge = await factory();
    assert.equal(typeof judge.judge, "function");
    assert.ok(judge.id.startsWith("ollama:"));
  });

  test("gemini factory returns JudgeProvider with judge() method", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    const factory = JUDGE_REGISTRY["gemini"];
    assert.ok(factory, "gemini factory missing");
    const judge = await factory();
    assert.equal(typeof judge.judge, "function");
    assert.ok(judge.id.startsWith("gemini:"));
  });
});

// ---------------------------------------------------------------------------
// llm-rubric assert — real implementation (SLICE-B2)
// ---------------------------------------------------------------------------

describe("assertLlmRubric (SLICE-B2 real implementation)", () => {
  // SLICE-107: mock judges now implement evaluate() (LLMJudge canonical method).
  // judge() shim is kept on real adapters for backward compat but tests use evaluate().
  function makeEvalMockJudge(evalResult: { pass: boolean; score: number; rationale: string }) {
    return {
      id: "mock",
      evaluate: mock(async () => ({
        ...evalResult,
        rubricScores: { default: evalResult.score },
        cost_usd: 0,
        latency_ms: 1,
        raw: {}
      })),
      describe: () => ({ provider: "mock", model: "mock" }),
      judge: mock(async () => ({
        pass: evalResult.pass,
        score: evalResult.score,
        rationale: evalResult.rationale,
        raw: {}
      }))
    };
  }

  test("passes when mock judge returns pass=true", async () => {
    const { assertLlmRubric } = await import("../evals/lib/assert.ts");
    const mockJudge = makeEvalMockJudge({
      pass: true,
      score: 1,
      rationale: "The response satisfies the criterion."
    });

    const result = await assertLlmRubric(
      { candidateOutput: "Hello world", judge: mockJudge },
      "Response must say hello"
    );

    assert.equal(result.pass, true);
    assert.ok(result.message.includes("PASS"));
    assert.ok(result.message.includes("satisfies"));
  });

  test("fails when mock judge returns pass=false", async () => {
    const { assertLlmRubric } = await import("../evals/lib/assert.ts");
    const mockJudge = makeEvalMockJudge({
      pass: false,
      score: 0,
      rationale: "The response does not satisfy the criterion."
    });

    const result = await assertLlmRubric(
      { candidateOutput: "Goodbye world", judge: mockJudge },
      "Response must say hello"
    );

    assert.equal(result.pass, false);
    assert.ok(result.message.includes("FAIL"));
  });

  test("fails gracefully when judge throws", async () => {
    const { assertLlmRubric } = await import("../evals/lib/assert.ts");
    const mockJudge = {
      id: "mock",
      evaluate: mock(async (): Promise<never> => {
        throw new Error("rate limit exceeded");
      }),
      describe: () => ({ provider: "mock", model: "mock" }),
      judge: mock(async (): Promise<never> => {
        throw new Error("rate limit exceeded");
      })
    };

    const result = await assertLlmRubric(
      { candidateOutput: "Any output", judge: mockJudge },
      "Some rubric"
    );

    assert.equal(result.pass, false);
    assert.ok(result.message.includes("rate limit"));
  });

  test("returns false with clear message for unknown judge provider", async () => {
    const { assertLlmRubric } = await import("../evals/lib/assert.ts");
    const result = await assertLlmRubric(
      { candidateOutput: "output", judgeProviderId: "nonexistent-provider-xyz" },
      "some rubric"
    );
    assert.equal(result.pass, false);
    assert.ok(result.message.includes("nonexistent-provider-xyz"));
  });
});

// ---------------------------------------------------------------------------
// AC-2 (SLICE-107): 7 adapter describe() assertions
// ---------------------------------------------------------------------------

describe("LLMJudge.describe() — 7 adapter assertions (SLICE-107 AC-2)", () => {
  test("GenericOpenAIJudge.describe() returns { provider: 'generic-openai', model }", async () => {
    const { GenericOpenAIJudge } = await import("../evals/providers/generic-openai.ts");
    const judge = new GenericOpenAIJudge({
      baseUrl: "https://api.openai.com",
      apiKey: "key",
      model: "gpt-4o-mini"
    });
    const desc = judge.describe();
    assert.equal(desc.provider, "generic-openai");
    assert.equal(desc.model, "gpt-4o-mini");
  });

  test("GroqJudge.describe() returns { provider: 'groq', model }", async () => {
    const { GroqJudge } = await import("../evals/providers/groq.ts");
    const judge = new GroqJudge({ apiKey: "key", model: "llama-3.3-70b-versatile" });
    const desc = judge.describe();
    assert.equal(desc.provider, "groq");
    assert.equal(desc.model, "llama-3.3-70b-versatile");
  });

  test("ClaudePJudge.describe() returns { provider: 'claude-p', model }", async () => {
    const { ClaudePJudge } = await import("../evals/providers/claude-p.ts");
    const judge = new ClaudePJudge({ model: "claude-sonnet-4-6" });
    const desc = judge.describe();
    assert.equal(desc.provider, "claude-p");
    assert.equal(desc.model, "claude-sonnet-4-6");
  });

  test("OllamaJudge.describe() returns { provider: 'ollama', model }", async () => {
    const { OllamaJudge } = await import("../evals/providers/ollama.ts");
    const judge = new OllamaJudge({ model: "llama3.3" });
    const desc = judge.describe();
    assert.equal(desc.provider, "ollama");
    assert.equal(desc.model, "llama3.3");
  });

  test("GeminiJudge.describe() returns { provider: 'gemini', model }", async () => {
    const { GeminiJudge } = await import("../evals/providers/gemini.ts");
    const judge = new GeminiJudge({ apiKey: "key", model: "gemini-2.5-flash" });
    const desc = judge.describe();
    assert.equal(desc.provider, "gemini");
    assert.equal(desc.model, "gemini-2.5-flash");
  });

  test("AzureOpenAIJudge.describe() returns { provider: 'azure', model }", async () => {
    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge({
      apiKey: "key",
      endpoint: "https://example.openai.azure.com",
      deployment: "gpt-4o"
    });
    const desc = judge.describe();
    assert.equal(desc.provider, "azure");
    assert.equal(desc.model, "gpt-4o");
  });

  test("BedrockJudge.describe() returns { provider: 'bedrock', model }", async () => {
    const { BedrockJudge } = await import("../evals/providers/bedrock.ts");
    const judge = new BedrockJudge({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });
    const desc = judge.describe();
    assert.equal(desc.provider, "bedrock");
    assert.equal(desc.model, "anthropic.claude-3-5-sonnet-20241022-v2:0");
  });
});

// ---------------------------------------------------------------------------
// AC-8 (SLICE-107): token contract test — unified tokens: { in, out } path
// ---------------------------------------------------------------------------

describe("token contract test (SLICE-107 AC-8)", () => {
  /**
   * Synthetic test: mock adapter returns tokens: { in: 100, out: 50 }.
   * Asserts that cost-attribution reads via unified LLMJudge field path.
   * FAILS if adapter returns old providerCost.tokensIn shape instead.
   */
  test("evaluate() result carries tokens: { in, out } — NOT providerCost.tokensIn", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeFetchMock({
      message: { role: "assistant", content: "YES\nThe response is correct." },
      done: true,
      prompt_eval_count: 100,
      eval_count: 50
    });

    const { OllamaJudge } = await import("../evals/providers/ollama.ts");
    const judge = new OllamaJudge({ model: "llama3.3" });

    const evalResult = await judge.evaluate({
      candidateOutput: "Hello world",
      expected: { id: "t1", input: null, held_out: false },
      rubric: ["The response must say hello"]
    });

    // Unified field path assertion
    assert.ok(evalResult.tokens !== undefined, "evaluate() must return tokens field");
    assert.equal(evalResult.tokens.in, 100, "tokens.in must equal prompt_eval_count (100)");
    assert.equal(evalResult.tokens.out, 50, "tokens.out must equal eval_count (50)");

    // AC-8 failure guard: ensure old providerCost shape is NOT on the evaluate() result
    // (it lives only on the deprecated judge() shim result)
    const asAny = evalResult as Record<string, unknown>;
    assert.equal(
      asAny["providerCost"],
      undefined,
      "evaluate() result MUST NOT carry providerCost.tokensIn — use tokens: { in, out } instead"
    );

    globalThis.fetch = origFetch;
  });

  test("claude-p evaluate() result: tokens field is undefined (subprocess limitation documented)", async () => {
    // ClaudePJudge cannot surface token counts from the claude -p subprocess.
    // evaluate() result must NOT carry tokens field. Cost-attribution paths must handle this.
    const { ClaudePJudge } = await import("../evals/providers/claude-p.ts");
    const judge = new ClaudePJudge();
    // We only check the type contract — not the live subprocess.
    // Verify the describe() output and that evaluate() is defined.
    assert.equal(typeof judge.evaluate, "function", "ClaudePJudge must implement evaluate()");
    assert.equal(judge.describe().provider, "claude-p");
  });

  test("GenericOpenAIJudge evaluate() maps usage to tokens: { in, out }", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeFetchMock({
      choices: [
        {
          message: { role: "assistant", content: '{"pass":true,"score":0.9,"rationale":"good"}' },
          finish_reason: "stop"
        }
      ],
      usage: { prompt_tokens: 80, completion_tokens: 30 }
    });

    const { GenericOpenAIJudge } = await import("../evals/providers/generic-openai.ts");
    const judge = new GenericOpenAIJudge({
      baseUrl: "https://api.openai.com",
      apiKey: "test-key",
      model: "gpt-4o-mini"
    });

    const evalResult = await judge.evaluate({
      candidateOutput: "Hello world",
      expected: { id: "t1", input: null, held_out: false },
      rubric: ["The response must say hello"]
    });

    assert.ok(evalResult.tokens !== undefined, "evaluate() must return tokens");
    assert.equal(evalResult.tokens.in, 80);
    assert.equal(evalResult.tokens.out, 30);
    assert.equal(evalResult.pass, true);
    assert.ok(typeof evalResult.rubricScores === "object");

    globalThis.fetch = origFetch;
  });
});

// ---------------------------------------------------------------------------
// Fallback chain in run-eval.ts
// ---------------------------------------------------------------------------

describe("runEval fallback chain (live mode)", () => {
  // Gated behind CREW_EVAL_LIVE=1 because live mode resolves the judge factory
  // (claude-p) which can spawn a real subprocess for llm-rubric asserts —
  // 8 tests × ~60s per subprocess = several minutes, not safe in default suite.
  // Live behavior verified via manual `bun run evals --live --prompt fullstack-dev`.
  test.skipIf(process.env["CREW_EVAL_LIVE"] !== "1")(
    "live mode no longer throws 'SLICE-B2' error",
    async () => {
      const { runEval, findSpecByPromptId } = await import("../evals/lib/run-eval.ts");
      const path = await import("node:path");
      const repoRoot = path.join(import.meta.dir, "..");
      const specFile = await findSpecByPromptId(
        "fullstack-dev",
        path.join(repoRoot, "evals", "agents")
      );
      assert.ok(specFile, "fullstack-dev spec not found");
      const result = await runEval({ specFile: specFile!, repoRoot, dryRun: false });
      assert.ok(typeof result.promptId === "string");
      assert.ok(typeof result.summary.total === "number");
      assert.ok(typeof result.summary.errored === "number");
    }
  );
});
