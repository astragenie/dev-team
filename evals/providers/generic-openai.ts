/**
 * GenericOpenAIJudge: base adapter for any /v1/chat/completions-compatible endpoint.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * Covers: Cerebras, DeepSeek, Mistral, Together, OpenRouter, GitHub Models,
 *         xAI, SambaNova, vLLM, LM Studio — any OpenAI-compatible API.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): exported but NOT invoked by dry-run runtime.
 * Live HTTP calls happen when a test runs in --live mode (SLICE-B2).
 */

import type {
  JudgeProvider,
  JudgeRequest,
  JudgeResult,
  GenericOpenAIConfig
} from "../lib/judge.ts";

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

function buildPrompt(req: JudgeRequest): ChatMessage[] {
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
        `Rubric: ${req.rubric}\n\nCandidate output:\n${req.candidateOutput}` +
        (req.context?.fixture ? `\n\nFixture context: ${req.context.fixture}` : "")
    }
  ];
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

  async judge(req: JudgeRequest): Promise<JudgeResult> {
    const url = `${this.config.baseUrl}/v1/chat/completions`;
    const body = {
      model: this.config.model,
      temperature: this.config.temperature,
      messages: buildPrompt(req)
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GenericOpenAI judge HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as ChatResponse;
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
      rationale: parsed.rationale ?? "",
      raw: data,
      providerCost: {
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0
      }
    };
  }
}
