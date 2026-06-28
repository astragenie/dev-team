/**
 * Judge interface + registry for the pluggable agent eval framework.
 * Module boundary: this file MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * FEAT-184: Unified judge interface — re-exports LLMJudge from @astragenie/gepa-core
 * as the canonical type. The old JudgeProvider is a @deprecated alias for one minor
 * version; it will be removed in the next MAJOR.
 *
 * Migration guide:
 *   - Replace `JudgeProvider` imports with `LLMJudge` from this module.
 *   - Replace `judge(req: JudgeRequest)` with `evaluate(opts)` — rubric is now string[].
 *   - Wrap prose rubric strings: `[myRubricString]` — never sentence-split (AC-5).
 *   - Adapters now also implement `describe(): { provider, model }`.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): interface + GenericOpenAI + Groq stubs.
 * SLICE-89 (FEAT-169 SLICE-B2): live dispatch.
 * SLICE-90 (FEAT-169 SLICE-B3): validate_with + Langfuse emit.
 * FEAT-184: adopt LLMJudge from gepa-core.
 */

export type { LLMJudge } from "@astragenie/gepa-core";

/**
 * @deprecated Use LLMJudge from @astragenie/gepa-core instead.
 * JudgeProvider will be removed in the next MAJOR version of hero-crew.
 *
 * Migration: replace `JudgeProvider` with `LLMJudge` and change the
 * `judge(req)` method to `evaluate(opts)` (rubric: string[], context?: {...}).
 */
export type JudgeProvider = import("@astragenie/gepa-core").LLMJudge;

/**
 * GenericOpenAIConfig: constructor shape for any /v1/chat/completions-compatible endpoint.
 * Adapter ships in evals/providers/generic-openai.ts; imported here only as a type reference
 * to avoid circular deps — registry uses factory functions.
 */
export interface GenericOpenAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
}

/**
 * Factory function type used by JUDGE_REGISTRY entries.
 * Returns an LLMJudge implementation (the canonical unified judge interface).
 */
export type JudgeFactory = (
  config?: Partial<
    GenericOpenAIConfig & {
      endpoint?: string;
      deployment?: string;
      apiVersion?: string;
      region?: string;
      maxTokens?: number;
    }
  >,
) => Promise<import("@astragenie/gepa-core").LLMJudge>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// Lazy imports to keep this file below 120 lines and avoid top-level await.
async function loadGeneric(): Promise<{
  GenericOpenAIJudge: new (
    c: GenericOpenAIConfig,
  ) => import("@astragenie/gepa-core").LLMJudge;
}> {
  return await import("../providers/generic-openai.ts");
}
async function loadGroq(): Promise<{
  GroqJudge: new (
    c?: Partial<GenericOpenAIConfig>,
  ) => import("@astragenie/gepa-core").LLMJudge;
}> {
  return await import("../providers/groq.ts");
}
async function loadClaudeP(): Promise<{
  ClaudePJudge: new () => import("@astragenie/gepa-core").LLMJudge;
}> {
  return await import("../providers/claude-p.ts");
}
async function loadOllama(): Promise<{
  OllamaJudge: new () => import("@astragenie/gepa-core").LLMJudge;
}> {
  return await import("../providers/ollama.ts");
}
async function loadGemini(): Promise<{
  GeminiJudge: new () => import("@astragenie/gepa-core").LLMJudge;
}> {
  return await import("../providers/gemini.ts");
}
async function loadAzureOpenAI(): Promise<{
  AzureOpenAIJudge: new (
    c?: Partial<
      GenericOpenAIConfig & {
        endpoint?: string;
        deployment?: string;
        apiVersion?: string;
      }
    >,
  ) => import("@astragenie/gepa-core").LLMJudge;
}> {
  return await import("../providers/azure-openai.ts");
}
async function loadBedrock(): Promise<{
  BedrockJudge: new (c?: {
    model?: string;
    region?: string;
    maxTokens?: number;
    temperature?: number;
  }) => import("@astragenie/gepa-core").LLMJudge;
}> {
  return await import("../providers/bedrock.ts");
}

/**
 * JUDGE_REGISTRY: maps provider id → async factory returning LLMJudge.
 * AC-3 (FEAT-184): all 7 adapters implement LLMJudge including describe().
 */
export const JUDGE_REGISTRY: Record<
  string,
  (
    config?: Partial<
      GenericOpenAIConfig & {
        endpoint?: string;
        deployment?: string;
        apiVersion?: string;
        region?: string;
        maxTokens?: number;
      }
    >,
  ) => Promise<import("@astragenie/gepa-core").LLMJudge>
> = {
  "generic-openai": async (config) => {
    const { GenericOpenAIJudge } = await loadGeneric();
    return new GenericOpenAIJudge({
      baseUrl: config?.baseUrl ?? "https://api.openai.com",
      apiKey: config?.apiKey ?? "",
      model: config?.model ?? "gpt-4o-mini",
      temperature: config?.temperature ?? 0.0,
    });
  },
  groq: async (config) => {
    const { GroqJudge } = await loadGroq();
    return new GroqJudge(config);
  },
  "claude-p": async () => {
    const { ClaudePJudge } = await loadClaudeP();
    return new ClaudePJudge();
  },
  ollama: async () => {
    const { OllamaJudge } = await loadOllama();
    return new OllamaJudge();
  },
  gemini: async () => {
    const { GeminiJudge } = await loadGemini();
    return new GeminiJudge();
  },
  azure: async (config) => {
    const { AzureOpenAIJudge } = await loadAzureOpenAI();
    return new AzureOpenAIJudge(config);
  },
  bedrock: async (config) => {
    const { BedrockJudge } = await loadBedrock();
    return new BedrockJudge(config);
  },
};
