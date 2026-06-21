/**
 * Judge interface + registry for the pluggable agent eval framework.
 * Module boundary: this file MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): interface + GenericOpenAI + Groq stubs.
 * Live dispatch ships in SLICE-B2.
 */

export interface JudgeRequest {
  rubric: string;
  candidateOutput: string;
  context?: {
    fixture?: string;
    promptId?: string;
    version?: string;
  };
}

export interface JudgeResult {
  pass: boolean;
  score: number; // 0..1
  rationale: string;
  raw: unknown;
  providerCost?: {
    usd?: number;
    tokensIn: number;
    tokensOut: number;
  };
}

export interface JudgeProvider {
  id: string;
  judge(req: JudgeRequest): Promise<JudgeResult>;
}

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
 * SLICE-B1: factories return stub adapters (no live HTTP calls).
 * SLICE-B2: factories return real adapters backed by cloud endpoints.
 */
export type JudgeFactory = (config?: GenericOpenAIConfig) => JudgeProvider;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

// Lazy imports to keep this file below 120 lines and avoid top-level await.
async function loadGeneric(): Promise<{
  GenericOpenAIJudge: new (c: GenericOpenAIConfig) => JudgeProvider;
}> {
  return await import("../providers/generic-openai.ts");
}
async function loadGroq(): Promise<{
  GroqJudge: new (c?: Partial<GenericOpenAIConfig>) => JudgeProvider;
}> {
  return await import("../providers/groq.ts");
}
async function loadClaudeP(): Promise<{
  ClaudePJudge: new () => JudgeProvider;
}> {
  return await import("../providers/claude-p.ts");
}
async function loadOllama(): Promise<{
  OllamaJudge: new () => JudgeProvider;
}> {
  return await import("../providers/ollama.ts");
}
async function loadGemini(): Promise<{
  GeminiJudge: new () => JudgeProvider;
}> {
  return await import("../providers/gemini.ts");
}
async function loadAzureOpenAI(): Promise<{
  AzureOpenAIJudge: new (c?: Partial<GenericOpenAIConfig & { endpoint?: string; deployment?: string; apiVersion?: string }>) => JudgeProvider;
}> {
  return await import("../providers/azure-openai.ts");
}
async function loadBedrock(): Promise<{
  BedrockJudge: new (c?: { model?: string; region?: string; maxTokens?: number; temperature?: number }) => JudgeProvider;
}> {
  return await import("../providers/bedrock.ts");
}

/**
 * JUDGE_REGISTRY: maps provider id → async factory.
 * AC1 (SLICE-B3): Object.keys(JUDGE_REGISTRY).length >= 7 (adds azure + bedrock).
 */
export const JUDGE_REGISTRY: Record<
  string,
  (config?: Partial<GenericOpenAIConfig & { endpoint?: string; deployment?: string; apiVersion?: string; region?: string; maxTokens?: number }>) => Promise<JudgeProvider>
> = {
  "generic-openai": async (config) => {
    const { GenericOpenAIJudge } = await loadGeneric();
    return new GenericOpenAIJudge({
      baseUrl: config?.baseUrl ?? "https://api.openai.com",
      apiKey: config?.apiKey ?? "",
      model: config?.model ?? "gpt-4o-mini",
      temperature: config?.temperature ?? 0.0
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
  }
};
