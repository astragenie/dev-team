/**
 * AzureOpenAIJudge: validation-tier judge using Azure OpenAI Service.
 * Implements LLMJudge (FEAT-184 unified interface).
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * Auth: `api-key` header (NOT `Authorization: Bearer`).
 * URL:  ${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}
 *
 * Required env: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT
 * Optional env: AZURE_OPENAI_DEPLOYMENT (default: gpt-4o)
 *
 * Fires only on judge disagreement or --validate flag. Default runs skip.
 *
 * SLICE-90 (FEAT-169 SLICE-B3).
 * FEAT-184: migrated from JudgeProvider to LLMJudge.
 */

import type { LLMJudge } from "@astragenie/gepa-core";

const DEFAULT_API_VERSION = "2024-10-21";
const DEFAULT_DEPLOYMENT = "gpt-4o";

export interface AzureOpenAIConfig {
  endpoint?: string;
  deployment?: string;
  apiKey?: string;
  apiVersion?: string;
  temperature?: number;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatChoice {
  message: { role: string; content: string };
  finish_reason: string;
}

interface ChatResponse {
  choices: ChatChoice[];
  usage?: { prompt_tokens: number; completion_tokens: number };
}

function buildPrompt(
  rubric: string[],
  candidateOutput: string,
  context?: { fixture?: string },
): ChatMessage[] {
  const rubricText = rubric.join("\n");
  return [
    {
      role: "system",
      content:
        "You are an expert evaluator. Given a rubric and a candidate response, " +
        "decide if the candidate PASSES. Reply with JSON: " +
        '{"pass": true|false, "score": 0.0..1.0, "rationale": "<one sentence>"}',
    },
    {
      role: "user",
      content:
        `Rubric: ${rubricText}\n\nCandidate output:\n${candidateOutput}` +
        (context?.fixture ? `\n\nFixture context: ${context.fixture}` : ""),
    },
  ];
}

export class AzureOpenAIJudge implements LLMJudge {
  private readonly endpoint: string;
  private readonly deployment: string;
  private readonly apiKey: string;
  private readonly apiVersion: string;
  private readonly temperature: number;

  constructor(config?: AzureOpenAIConfig) {
    this.endpoint = (config?.endpoint ?? process.env["AZURE_OPENAI_ENDPOINT"] ?? "").replace(
      /\/$/,
      "",
    );
    this.deployment =
      config?.deployment ?? process.env["AZURE_OPENAI_DEPLOYMENT"] ?? DEFAULT_DEPLOYMENT;
    this.apiKey = config?.apiKey ?? process.env["AZURE_OPENAI_API_KEY"] ?? "";
    this.apiVersion = config?.apiVersion ?? DEFAULT_API_VERSION;
    this.temperature = config?.temperature ?? 0.0;
  }

  describe(): { provider: string; model: string } {
    return { provider: "azure", model: this.deployment };
  }

  async evaluate(
    opts: Parameters<LLMJudge["evaluate"]>[0],
  ): ReturnType<LLMJudge["evaluate"]> {
    if (!this.apiKey) {
      throw new Error(
        "AzureOpenAIJudge: AZURE_OPENAI_API_KEY is required. Set the env var or pass apiKey in config.",
      );
    }
    if (!this.endpoint) {
      throw new Error(
        "AzureOpenAIJudge: AZURE_OPENAI_ENDPOINT is required. Set the env var or pass endpoint in config.",
      );
    }

    const { candidateOutput, rubric, context } = opts;
    const candidateText =
      typeof candidateOutput === "string" ? candidateOutput : JSON.stringify(candidateOutput);
    const rubricText = rubric.join("\n");

    const url =
      `${this.endpoint}/openai/deployments/${this.deployment}` +
      `/chat/completions?api-version=${this.apiVersion}`;

    const body = {
      model: this.deployment,
      temperature: this.temperature,
      messages: buildPrompt(rubric, candidateText, context),
    };

    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AzureOpenAIJudge HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as ChatResponse;
    const latency_ms = Date.now() - start;
    const content = data.choices[0]?.message.content ?? "{}";

    let parsed: { pass?: boolean; score?: number; rationale?: string };
    try {
      parsed = JSON.parse(content) as { pass?: boolean; score?: number; rationale?: string };
    } catch {
      parsed = {
        pass: false,
        score: 0,
        rationale: `failed to parse judge response: ${content.slice(0, 100)}`,
      };
    }

    const pass = parsed.pass ?? false;

    return {
      pass,
      score: parsed.score ?? (pass ? 1 : 0),
      rubricScores: { [rubricText]: parsed.score ?? (pass ? 1 : 0) },
      rationale: parsed.rationale ?? "",
      cost_usd: 0,
      latency_ms,
      tokens: {
        in: data.usage?.prompt_tokens ?? 0,
        out: data.usage?.completion_tokens ?? 0,
      },
      raw: data,
    };
  }
}
