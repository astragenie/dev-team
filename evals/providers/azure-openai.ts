/**
 * AzureOpenAIJudge: validation-tier judge using Azure OpenAI Service.
 * Extends GenericOpenAIJudge with Azure auth + deployment-name URL shape.
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
 * SLICE-107 (FEAT-184 S2): implements LLMJudge.evaluate() + describe();
 *   judge() retained as @deprecated shim for one minor version.
 *   Maps usage.prompt_tokens/completion_tokens → tokens: { in, out }.
 */

import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";
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

function buildPrompt(rubric: string, candidateOutput: string, fixture?: string): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are an expert evaluator. Given a rubric and a candidate response, " +
        "decide if the candidate PASSES. Reply with JSON: " +
        '{"pass": true|false, "score": 0.0..1.0, "rationale": "<one sentence>"}'
    },
    {
      role: "user",
      content:
        `Rubric: ${rubric}\n\nCandidate output:\n${candidateOutput}` +
        (fixture ? `\n\nFixture context: ${fixture}` : "")
    }
  ];
}

function parseChatResponse(
  data: ChatResponse
): { pass: boolean; score: number; rationale: string } {
  const content = data.choices[0]?.message.content ?? "{}";
  let parsed: { pass?: boolean; score?: number; rationale?: string };
  try {
    parsed = JSON.parse(content) as { pass?: boolean; score?: number; rationale?: string };
  } catch {
    parsed = {
      pass: false,
      score: 0,
      rationale: `failed to parse judge response: ${content.slice(0, 100)}`
    };
  }
  return {
    pass: parsed.pass ?? false,
    score: parsed.score ?? (parsed.pass ? 1 : 0),
    rationale: parsed.rationale ?? ""
  };
}

export class AzureOpenAIJudge implements JudgeProvider {
  readonly id: string;
  private readonly endpoint: string;
  private readonly deployment: string;
  private readonly apiKey: string;
  private readonly apiVersion: string;
  private readonly temperature: number;

  constructor(config?: AzureOpenAIConfig) {
    this.endpoint = (config?.endpoint ?? process.env["AZURE_OPENAI_ENDPOINT"] ?? "").replace(
      /\/$/,
      ""
    );
    this.deployment =
      config?.deployment ??
      process.env["AZURE_OPENAI_DEPLOYMENT"] ??
      DEFAULT_DEPLOYMENT;
    this.apiKey = config?.apiKey ?? process.env["AZURE_OPENAI_API_KEY"] ?? "";
    this.apiVersion = config?.apiVersion ?? DEFAULT_API_VERSION;
    this.temperature = config?.temperature ?? 0.0;
    this.id = `azure:${this.deployment}`;
  }

  describe(): { provider: string; model: string } {
    return { provider: "azure", model: this.deployment };
  }

  private buildUrl(): string {
    return (
      `${this.endpoint}/openai/deployments/${this.deployment}` +
      `/chat/completions?api-version=${this.apiVersion}`
    );
  }

  private validateCredentials(): void {
    if (!this.apiKey) {
      throw new Error(
        "AzureOpenAIJudge: AZURE_OPENAI_API_KEY is required. Set the env var or pass apiKey in config."
      );
    }
    if (!this.endpoint) {
      throw new Error(
        "AzureOpenAIJudge: AZURE_OPENAI_ENDPOINT is required. Set the env var or pass endpoint in config."
      );
    }
  }

  private async callAzure(messages: ChatMessage[]): Promise<ChatResponse> {
    const res = await fetch(this.buildUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": this.apiKey
      },
      body: JSON.stringify({
        model: this.deployment,
        temperature: this.temperature,
        messages
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AzureOpenAIJudge HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    return (await res.json()) as ChatResponse;
  }

  async evaluate(opts: Parameters<LLMJudge["evaluate"]>[0]): ReturnType<LLMJudge["evaluate"]> {
    this.validateCredentials();
    const start = Date.now();
    const rubric = opts.rubric.join("\n");
    const candidateStr =
      typeof opts.candidateOutput === "string"
        ? opts.candidateOutput
        : JSON.stringify(opts.candidateOutput);
    const fixture = opts.context?.fixture;

    const data = await this.callAzure(buildPrompt(rubric, candidateStr, fixture));
    const parsed = parseChatResponse(data);

    return {
      pass: parsed.pass,
      score: parsed.score,
      rubricScores: { default: parsed.score },
      rationale: parsed.rationale,
      cost_usd: 0,
      latency_ms: Date.now() - start,
      tokens: {
        in: data.usage?.prompt_tokens ?? 0,
        out: data.usage?.completion_tokens ?? 0
      },
      raw: data
    };
  }

  /** @deprecated Use `evaluate(opts)` instead. Shim retained for one minor version. */
  async judge(req: JudgeRequest): Promise<JudgeResult> {
    this.validateCredentials();

    const data = await this.callAzure(
      buildPrompt(req.rubric, String(req.candidateOutput), req.context?.fixture)
    );
    const parsed = parseChatResponse(data);

    return {
      pass: parsed.pass,
      score: parsed.score,
      rationale: parsed.rationale,
      raw: data,
      providerCost: {
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0
      }
    };
  }
}
