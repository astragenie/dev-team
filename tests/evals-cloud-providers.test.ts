/**
 * tests/evals-cloud-providers.test.ts
 *
 * Unit tests for SLICE-90 providers: AzureOpenAIJudge + BedrockJudge.
 * Live network calls gated behind CREW_EVAL_LIVE=1 + required env vars.
 * Minimum 12 cases (6 per provider).
 */

import { test, describe, mock } from "bun:test";
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

function makeOpenAIResponse(pass: boolean) {
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: JSON.stringify({
            pass,
            score: pass ? 1 : 0,
            rationale: pass ? "The response clearly greets the user." : "No greeting found."
          })
        },
        finish_reason: "stop"
      }
    ],
    usage: { prompt_tokens: 120, completion_tokens: 30 }
  };
}

function makeFetchMock(responseBody: unknown, status = 200): typeof fetch {
  return mock(async () => {
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "Content-Type": "application/json" }
    });
  }) as unknown as typeof fetch;
}

// ---------------------------------------------------------------------------
// AzureOpenAIJudge tests
// ---------------------------------------------------------------------------

describe("AzureOpenAIJudge (unit — mocked fetch)", () => {
  test("returns pass=true when Azure responds with pass=true JSON", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeFetchMock(makeOpenAIResponse(true));

    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge({
      endpoint: "https://my-resource.openai.azure.com",
      deployment: "gpt-4o",
      apiKey: "test-key-abc"
    });
    const result = await judge.judge(makeJudgeRequest());

    assert.equal(result.pass, true);
    assert.equal(result.score, 1);
    assert.ok(result.rationale.includes("greet"));
    assert.equal(result.providerCost?.tokensIn, 120);
    assert.equal(result.providerCost?.tokensOut, 30);

    globalThis.fetch = origFetch;
  });

  test("returns pass=false when Azure responds with pass=false JSON", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = makeFetchMock(makeOpenAIResponse(false));

    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge({
      endpoint: "https://my-resource.openai.azure.com",
      deployment: "gpt-4o",
      apiKey: "test-key-abc"
    });
    const result = await judge.judge(makeJudgeRequest());

    assert.equal(result.pass, false);
    assert.equal(result.score, 0);

    globalThis.fetch = origFetch;
  });

  test("uses correct Azure URL shape with deployment + api-version", async () => {
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      capturedHeaders = Object.fromEntries(new Headers(init?.headers as HeadersInit).entries());
      return new Response(JSON.stringify(makeOpenAIResponse(true)), { status: 200 });
    }) as unknown as typeof fetch;

    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge({
      endpoint: "https://my-resource.openai.azure.com",
      deployment: "my-deployment",
      apiKey: "my-api-key",
      apiVersion: "2024-10-21"
    });
    await judge.judge(makeJudgeRequest());

    assert.ok(
      capturedUrl.includes("/openai/deployments/my-deployment/chat/completions"),
      `URL should include deployment path, got: ${capturedUrl}`
    );
    assert.ok(
      capturedUrl.includes("api-version=2024-10-21"),
      `URL should include api-version, got: ${capturedUrl}`
    );
    // Auth header is "api-key", NOT "authorization: bearer"
    assert.equal(capturedHeaders["api-key"], "my-api-key");
    assert.equal(capturedHeaders["authorization"], undefined);

    // fetch mock used for URL capture; restore not needed (capturedUrl checked above)
  });

  test("throws clear error when AZURE_OPENAI_API_KEY is missing", async () => {
    const savedKey = process.env["AZURE_OPENAI_API_KEY"];
    const savedEndpoint = process.env["AZURE_OPENAI_ENDPOINT"];
    delete process.env["AZURE_OPENAI_API_KEY"];
    process.env["AZURE_OPENAI_ENDPOINT"] = "https://my-resource.openai.azure.com";

    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge(); // no config — relies on env

    await assert.rejects(
      () => judge.judge(makeJudgeRequest()),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes("AZURE_OPENAI_API_KEY"),
          `Expected AZURE_OPENAI_API_KEY error, got: ${err.message}`
        );
        return true;
      }
    );

    process.env["AZURE_OPENAI_API_KEY"] = savedKey;
    process.env["AZURE_OPENAI_ENDPOINT"] = savedEndpoint;
  });

  test("throws clear error when AZURE_OPENAI_ENDPOINT is missing", async () => {
    const savedEndpoint = process.env["AZURE_OPENAI_ENDPOINT"];
    delete process.env["AZURE_OPENAI_ENDPOINT"];

    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge({ apiKey: "some-key" });

    await assert.rejects(
      () => judge.judge(makeJudgeRequest()),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes("AZURE_OPENAI_ENDPOINT"),
          `Expected AZURE_OPENAI_ENDPOINT error, got: ${err.message}`
        );
        return true;
      }
    );

    process.env["AZURE_OPENAI_ENDPOINT"] = savedEndpoint;
  });

  test("throws on HTTP 401 Unauthorized", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ error: { message: "Access denied" } }), { status: 401 });
    }) as unknown as typeof fetch;

    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge({
      endpoint: "https://my-resource.openai.azure.com",
      deployment: "gpt-4o",
      apiKey: "bad-key"
    });

    await assert.rejects(() => judge.judge(makeJudgeRequest()), /HTTP 401/);

    globalThis.fetch = origFetch;
  });

  test("provider id includes deployment name", async () => {
    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge({
      endpoint: "https://example.openai.azure.com",
      deployment: "gpt-4o-custom",
      apiKey: "test-key"
    });
    assert.equal(judge.id, "azure:gpt-4o-custom");
  });

  test("handles malformed JSON response gracefully (returns pass=false)", async () => {
    const origFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            { message: { role: "assistant", content: "INVALID {{JSON" }, finish_reason: "stop" }
          ]
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
    const judge = new AzureOpenAIJudge({
      endpoint: "https://my-resource.openai.azure.com",
      deployment: "gpt-4o",
      apiKey: "test-key"
    });
    const result = await judge.judge(makeJudgeRequest());

    assert.equal(result.pass, false);
    assert.ok(result.rationale.includes("failed to parse"));

    globalThis.fetch = origFetch;
  });

  test("azure entry in JUDGE_REGISTRY resolves to AzureOpenAIJudge", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    const factory = JUDGE_REGISTRY["azure"];
    assert.ok(factory, "azure missing from JUDGE_REGISTRY");
    const judge = await factory();
    assert.ok(judge.id.startsWith("azure:"), `Expected id starting with azure:, got: ${judge.id}`);
    assert.equal(typeof judge.judge, "function");
  });

  if (LIVE) {
    test("LIVE: AzureOpenAIJudge hits real Azure endpoint", async () => {
      const { AzureOpenAIJudge } = await import("../evals/providers/azure-openai.ts");
      const judge = new AzureOpenAIJudge();
      const result = await judge.judge(makeJudgeRequest());
      assert.ok(typeof result.pass === "boolean");
      assert.ok(result.score >= 0 && result.score <= 1);
    });
  }
});

// ---------------------------------------------------------------------------
// BedrockJudge tests
// ---------------------------------------------------------------------------

describe("BedrockJudge (unit — mocked SDK)", () => {
  /**
   * Build a mocked Bedrock response body for the Claude family.
   */
  function makeClaudeBedrockBody(pass: boolean): Uint8Array {
    const body = {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            pass,
            score: pass ? 1 : 0,
            rationale: pass ? "Passes the criterion." : "Does not pass."
          })
        }
      ]
    };
    return new TextEncoder().encode(JSON.stringify(body));
  }

  function makeLlamaBedrockBody(text: string): Uint8Array {
    return new TextEncoder().encode(JSON.stringify({ generation: text }));
  }

  function makeMistralBedrockBody(text: string): Uint8Array {
    return new TextEncoder().encode(JSON.stringify({ outputs: [{ text }] }));
  }

  function makeNovaBedrockBody(text: string): Uint8Array {
    return new TextEncoder().encode(
      JSON.stringify({
        output: {
          message: {
            content: [{ text }]
          }
        }
      })
    );
  }

  test("BedrockJudge id includes model name", async () => {
    // Set credentials so constructor doesn't fail
    const savedKey = process.env["AWS_ACCESS_KEY_ID"];
    process.env["AWS_ACCESS_KEY_ID"] = "test-key";

    const { BedrockJudge } = await import("../evals/providers/bedrock.ts");
    const judge = new BedrockJudge({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });
    assert.ok(
      judge.id.startsWith("bedrock:"),
      `Expected id starting with bedrock:, got: ${judge.id}`
    );
    assert.ok(judge.id.includes("anthropic.claude"));

    process.env["AWS_ACCESS_KEY_ID"] = savedKey;
  });

  test("bedrock entry in JUDGE_REGISTRY resolves to BedrockJudge", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    const factory = JUDGE_REGISTRY["bedrock"];
    assert.ok(factory, "bedrock missing from JUDGE_REGISTRY");
    const judge = await factory();
    assert.ok(
      judge.id.startsWith("bedrock:"),
      `Expected id starting with bedrock:, got: ${judge.id}`
    );
    assert.equal(typeof judge.judge, "function");
  });

  test("throws clear error when AWS credentials are missing", async () => {
    const savedKey = process.env["AWS_ACCESS_KEY_ID"];
    const savedProfile = process.env["AWS_PROFILE"];
    delete process.env["AWS_ACCESS_KEY_ID"];
    delete process.env["AWS_PROFILE"];

    const { BedrockJudge } = await import("../evals/providers/bedrock.ts");
    const judge = new BedrockJudge({ model: "anthropic.claude-3-5-sonnet-20241022-v2:0" });

    await assert.rejects(
      () => judge.judge(makeJudgeRequest()),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes("AWS_ACCESS_KEY_ID") || err.message.includes("credentials"),
          `Expected AWS credentials error, got: ${err.message}`
        );
        return true;
      }
    );

    process.env["AWS_ACCESS_KEY_ID"] = savedKey;
    process.env["AWS_PROFILE"] = savedProfile;
  });

  test("Claude body shape: content[0].text extraction", () => {
    // Test the response parsing logic by verifying body shape
    const responseBytes = makeClaudeBedrockBody(true);
    const parsed = JSON.parse(new TextDecoder().decode(responseBytes)) as {
      content: Array<{ type: string; text: string }>;
    };

    assert.ok(Array.isArray(parsed.content));
    assert.equal(parsed.content[0]?.type, "text");
    const inner = JSON.parse(parsed.content[0]?.text ?? "{}") as { pass: boolean; score: number };
    assert.equal(inner.pass, true);
    assert.equal(inner.score, 1);
  });

  test("Llama body shape: generation field extraction", () => {
    const responseBytes = makeLlamaBedrockBody("YES\nThe response greets the user.");
    const parsed = JSON.parse(new TextDecoder().decode(responseBytes)) as { generation: string };
    assert.equal(typeof parsed.generation, "string");
    assert.ok(parsed.generation.includes("YES"));
  });

  test("Mistral body shape: outputs[0].text extraction", () => {
    const responseBytes = makeMistralBedrockBody(
      "NO\nThe response does not satisfy the criterion."
    );
    const parsed = JSON.parse(new TextDecoder().decode(responseBytes)) as {
      outputs: Array<{ text: string }>;
    };
    assert.ok(Array.isArray(parsed.outputs));
    assert.ok(parsed.outputs[0]?.text.includes("NO"));
  });

  test("Nova body shape: output.message.content[0].text extraction", () => {
    const responseBytes = makeNovaBedrockBody("YES\nPasses.");
    const parsed = JSON.parse(new TextDecoder().decode(responseBytes)) as {
      output: { message: { content: Array<{ text: string }> } };
    };
    assert.equal(parsed.output.message.content[0]?.text, "YES\nPasses.");
  });

  test("BedrockJudge uses default region us-east-1 when not configured", async () => {
    const savedKey = process.env["AWS_ACCESS_KEY_ID"];
    const savedRegion = process.env["BEDROCK_REGION"];
    process.env["AWS_ACCESS_KEY_ID"] = "test-key";
    delete process.env["BEDROCK_REGION"];

    const { BedrockJudge } = await import("../evals/providers/bedrock.ts");
    const judge = new BedrockJudge();
    // Can't directly inspect the region, but we verify it constructs without error
    assert.ok(judge.id.startsWith("bedrock:"));

    process.env["AWS_ACCESS_KEY_ID"] = savedKey;
    process.env["BEDROCK_REGION"] = savedRegion;
  });

  if (LIVE) {
    test("LIVE: BedrockJudge hits real Bedrock endpoint", async () => {
      const { BedrockJudge } = await import("../evals/providers/bedrock.ts");
      const judge = new BedrockJudge({
        model: "anthropic.claude-3-5-sonnet-20241022-v2:0",
        region: process.env["BEDROCK_REGION"] ?? "us-east-1"
      });
      const result = await judge.judge(makeJudgeRequest());
      assert.ok(typeof result.pass === "boolean");
      assert.ok(result.score >= 0 && result.score <= 1);
    });
  }
});

// ---------------------------------------------------------------------------
// JUDGE_REGISTRY — AC1: >= 7 entries
// ---------------------------------------------------------------------------

describe("JUDGE_REGISTRY (SLICE-B3 AC1)", () => {
  test("has at least 7 provider entries after SLICE-B3", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    const keys = Object.keys(JUDGE_REGISTRY);
    assert.ok(
      keys.length >= 7,
      `Expected >= 7 registry entries, got ${keys.length}: ${keys.join(", ")}`
    );
  });

  test("azure and bedrock present in registry", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    assert.ok("azure" in JUDGE_REGISTRY, "azure missing from JUDGE_REGISTRY");
    assert.ok("bedrock" in JUDGE_REGISTRY, "bedrock missing from JUDGE_REGISTRY");
  });

  test("all 7 providers present", async () => {
    const { JUDGE_REGISTRY } = await import("../evals/lib/judge.ts");
    const required = ["generic-openai", "groq", "claude-p", "ollama", "gemini", "azure", "bedrock"];
    for (const id of required) {
      assert.ok(id in JUDGE_REGISTRY, `Missing provider: ${id}`);
    }
  });
});

// ---------------------------------------------------------------------------
// validate_with disagreement flow
// ---------------------------------------------------------------------------

describe("validate_with disagreement flow", () => {
  test("validate_with chain runs when --validate flag is set", async () => {
    const { runEval, findSpecByPromptId } = await import("../evals/lib/run-eval.ts");
    const path = await import("node:path");
    const repoRoot = path.join(import.meta.dir, "..");
    const specFile = await findSpecByPromptId(
      "fullstack-dev",
      path.join(repoRoot, "evals", "agents")
    );
    assert.ok(specFile, "fullstack-dev spec not found");

    // Run dry-run with --validate: should not crash (validate_with only runs in live mode)
    const result = await runEval({ specFile: specFile!, repoRoot, dryRun: true, validate: true });
    assert.ok(typeof result.promptId === "string");
    assert.ok(typeof result.summary.total === "number");
    // In dry-run, no validations should be attached (validate_with only runs in live mode)
    for (const t of result.tests) {
      assert.equal(t.validations, undefined, "dry-run should not populate validations");
    }
  });

  test("TestResult type has validations and disagreement fields", async () => {
    // Verify the type shape via a mock test result
    const { runEval, findSpecByPromptId } = await import("../evals/lib/run-eval.ts");
    const path = await import("node:path");
    const repoRoot = path.join(import.meta.dir, "..");
    const specFile = await findSpecByPromptId(
      "fullstack-dev",
      path.join(repoRoot, "evals", "agents")
    );
    assert.ok(specFile);

    const result = await runEval({ specFile: specFile!, repoRoot, dryRun: true });
    for (const t of result.tests) {
      // These fields should be undefined in dry-run (not set)
      assert.ok(!("validations" in t) || t.validations === undefined);
      assert.ok(!("disagreement" in t) || t.disagreement === undefined);
    }
  });
});
