/**
 * GeminiJudge: cross-model judge via Google Gemini API.
 * Native Google API shape (NOT OpenAI-compatible). Native fetch, no npm deps.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-89 (FEAT-169 SLICE-B2).
 * SLICE-107 (FEAT-184 S2): implements LLMJudge.evaluate() + describe();
 *   judge() retained as @deprecated shim for one minor version.
 *   Maps usageMetadata.promptTokenCount/candidatesTokenCount → tokens: { in, out }.
 */

import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";
import type { LLMJudge } from "@astragenie/gepa-core";

export interface GeminiConfig {
  /** Gemini API key (default: GEMINI_API_KEY env var). */
  apiKey?: string;
  /** Model name (default: gemini-2.5-flash). */
  model?: string;
  /** Sampling temperature (default: 0.0). */
  temperature?: number;
  /** Max output tokens (default: 256). */
  maxOutputTokens?: number;
  /** Request timeout in ms (default: 60000). */
  timeoutMs?: number;
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TEMPERATURE = 0.0;
const DEFAULT_MAX_TOKENS = 256;
const DEFAULT_TIMEOUT_MS = 60_000;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
}

function parseJudgeText(text: string): { pass: boolean; score: number; rationale: string } {
  const pass = /^yes/i.test(text.trim());
  const firstBreak = text.indexOf("\n");
  const rationale = firstBreak !== -1 ? text.slice(firstBreak + 1).trim() : text.trim();
  return { pass, score: pass ? 1 : 0, rationale };
}

async function callGemini(
  model: string,
  apiKey: string,
  prompt: string,
  temperature: number,
  maxOutputTokens: number,
  timeoutMs: number
): Promise<GeminiResponse> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens }
  };

  const signal = AbortSignal.timeout(timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`GeminiJudge: fetch failed: ${msg}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GeminiJudge: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return (await res.json()) as GeminiResponse;
}

export class GeminiJudge implements JudgeProvider {
  readonly id: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;
  private readonly timeoutMs: number;

  constructor(config?: GeminiConfig) {
    this.apiKey = config?.apiKey ?? process.env["GEMINI_API_KEY"] ?? "";
    this.model = config?.model ?? DEFAULT_MODEL;
    this.temperature = config?.temperature ?? DEFAULT_TEMPERATURE;
    this.maxOutputTokens = config?.maxOutputTokens ?? DEFAULT_MAX_TOKENS;
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.id = `gemini:${this.model}`;
  }

  describe(): { provider: string; model: string } {
    return { provider: "gemini", model: this.model };
  }

  async evaluate(opts: Parameters<LLMJudge["evaluate"]>[0]): ReturnType<LLMJudge["evaluate"]> {
    if (!this.apiKey) {
      throw new Error("GeminiJudge: GEMINI_API_KEY is not set");
    }
    const start = Date.now();
    const rubric = opts.rubric.join("\n");
    const candidateStr =
      typeof opts.candidateOutput === "string"
        ? opts.candidateOutput
        : JSON.stringify(opts.candidateOutput);

    const prompt =
      `Did this response satisfy the following criterion?\n\n` +
      `Criterion: ${rubric}\n\n` +
      `Response:\n${candidateStr}\n\n` +
      `Answer with YES or NO followed by a one-sentence rationale.`;

    const data = await callGemini(
      this.model,
      this.apiKey,
      prompt,
      this.temperature,
      this.maxOutputTokens,
      this.timeoutMs
    );

    const judgeText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const { pass, score, rationale } = parseJudgeText(judgeText);

    return {
      pass,
      score,
      rubricScores: { default: score },
      rationale,
      cost_usd: 0,
      latency_ms: Date.now() - start,
      tokens: {
        in: data.usageMetadata?.promptTokenCount ?? 0,
        out: data.usageMetadata?.candidatesTokenCount ?? 0
      },
      raw: data
    };
  }

  /** @deprecated Use `evaluate(opts)` instead. Shim retained for one minor version. */
  async judge(req: JudgeRequest): Promise<JudgeResult> {
    if (!this.apiKey) {
      throw new Error("GeminiJudge: GEMINI_API_KEY is not set");
    }

    const prompt =
      `Did this response satisfy the following criterion?\n\n` +
      `Criterion: ${req.rubric}\n\n` +
      `Response:\n${req.candidateOutput}\n\n` +
      `Answer with YES or NO followed by a one-sentence rationale.`;

    const data = await callGemini(
      this.model,
      this.apiKey,
      prompt,
      this.temperature,
      this.maxOutputTokens,
      this.timeoutMs
    );

    const judgeText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const { pass, score, rationale } = parseJudgeText(judgeText);

    return {
      pass,
      score,
      rationale,
      raw: data,
      providerCost: {
        tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0
      }
    };
  }
}
