/**
 * GenericOpenAIJudge: base adapter for any /v1/chat/completions-compatible endpoint.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * Covers: Cerebras, DeepSeek, Mistral, Together, OpenRouter, GitHub Models,
 *         xAI, SambaNova, vLLM, LM Studio — any OpenAI-compatible API.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): exported but NOT invoked by dry-run runtime.
 * Live HTTP calls happen when a test runs in --live mode (SLICE-B2).
 * SLICE-107 (FEAT-184 S2): implements LLMJudge.evaluate() + describe();
 *   judge() retained as @deprecated shim for one minor version.
 */

import type {
  JudgeProvider,
  JudgeRequest,
  JudgeResult,
  GenericOpenAIConfig
} from "../lib/judge.ts";
import type { LLMJudge } from "@astragenie/gepa-core";

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

async function callChatCompletions(
  url: string,
  authHeader: string,
  model: string,
  temperature: number,
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader
    },
    body: JSON.stringify({ model, temperature, messages })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GenericOpenAI judge HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as ChatResponse;
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

export class GenericOpenAIJudge implements JudgeProvider {
  readonly id: string;
  private readonly config: Required<GenericOpenAIConfig>;

  constructor(config: GenericOpenAIConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0.0
    };
    this.id = `generic-openai:${this.config.model}`;
  }

  describe(): { provider: string; model: string } {
    return { provider: "generic-openai", model: this.config.model };
  }

  async evaluate(opts: Parameters<LLMJudge["evaluate"]>[0]): ReturnType<LLMJudge["evaluate"]> {
    const start = Date.now();
    // Rubric is a single-element array per AC-4 (spec.rubric wrapped in [oneString]).
    // Join with newline if multiple entries are provided.
    const rubric = opts.rubric.join("\n");
    const candidateStr =
      typeof opts.candidateOutput === "string"
        ? opts.candidateOutput
        : JSON.stringify(opts.candidateOutput);
    const fixture = opts.context?.fixture;

    const url = `${this.config.baseUrl}/v1/chat/completions`;
    const messages = buildPrompt(rubric, candidateStr, fixture);
    const data = await callChatCompletions(
      url,
      `Bearer ${this.config.apiKey}`,
      this.config.model,
      this.config.temperature,
      messages
    );

    const parsed = parseChatResponse(data);
    const latency_ms = Date.now() - start;

    return {
      pass: parsed.pass,
      score: parsed.score,
      rubricScores: { default: parsed.score },
      rationale: parsed.rationale,
      cost_usd: 0,
      latency_ms,
      tokens: {
        in: data.usage?.prompt_tokens ?? 0,
        out: data.usage?.completion_tokens ?? 0
      },
      raw: data
    };
  }

  /**
   * @deprecated Use `evaluate(opts)` instead. Shim retained for one minor version.
   * Converts JudgeRequest → evaluate() and maps result to JudgeResult shape.
   */
  async judge(req: JudgeRequest): Promise<JudgeResult> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;
    const messages = buildPrompt(req.rubric, String(req.candidateOutput), req.context?.fixture);
    const data = await callChatCompletions(
      url,
      `Bearer ${this.config.apiKey}`,
      this.config.model,
      this.config.temperature,
      messages
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
