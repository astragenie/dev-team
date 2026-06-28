/**
 * GenericOpenAIJudge: base adapter for any /v1/chat/completions-compatible endpoint.
 * Implements LLMJudge (FEAT-184 unified interface).
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * Covers: Cerebras, DeepSeek, Mistral, Together, OpenRouter, GitHub Models,
 *         xAI, SambaNova, vLLM, LM Studio — any OpenAI-compatible API.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): exported but NOT invoked by dry-run runtime.
 * Live HTTP calls happen when a test runs in --live mode (SLICE-B2).
 * FEAT-184: migrated from JudgeProvider to LLMJudge.
 */

import type { LLMJudge } from "@astragenie/gepa-core";
import type { GenericOpenAIConfig } from "../lib/judge.ts";

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
  // AC-5: rubric is string[]; join with newline for multi-criterion, use as-is for single-element.
  // Single-element arrays (ported prose rubrics) preserve the original string verbatim.
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

export class GenericOpenAIJudge implements LLMJudge {
  private readonly config: Required<GenericOpenAIConfig>;

  constructor(config: GenericOpenAIConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ""),
      apiKey: config.apiKey,
      model: config.model,
      temperature: config.temperature ?? 0.0,
    };
  }

  describe(): { provider: string; model: string } {
    return { provider: "generic-openai", model: this.config.model };
  }

  async evaluate(
    opts: Parameters<LLMJudge["evaluate"]>[0],
  ): ReturnType<LLMJudge["evaluate"]> {
    const { candidateOutput, rubric, context } = opts;
    const url = `${this.config.baseUrl}/v1/chat/completions`;
    const body = {
      model: this.config.model,
      temperature: this.config.temperature,
      messages: buildPrompt(
        rubric,
        typeof candidateOutput === "string" ? candidateOutput : JSON.stringify(candidateOutput),
        context,
      ),
    };

    const start = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GenericOpenAI judge HTTP ${res.status}: ${text.slice(0, 200)}`);
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
      rubricScores: { [rubric.join("|")]: parsed.score ?? (pass ? 1 : 0) },
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
