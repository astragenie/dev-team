/**
 * GeminiJudge: cross-model judge via Google Gemini API.
 * Implements LLMJudge (FEAT-184 unified interface).
 * Native Google API shape (NOT OpenAI-compatible). Native fetch, no npm deps.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-89 (FEAT-169 SLICE-B2).
 * FEAT-184: migrated from JudgeProvider to LLMJudge.
 */

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

function parseJudgeText(
  text: string,
  raw: unknown,
): Pick<
  Awaited<ReturnType<LLMJudge["evaluate"]>>,
  "pass" | "score" | "rationale" | "raw"
> {
  const pass = /^yes/i.test(text.trim());
  const firstBreak = text.indexOf("\n");
  const rationale = firstBreak !== -1 ? text.slice(firstBreak + 1).trim() : text.trim();
  return { pass, score: pass ? 1 : 0, rationale, raw };
}

export class GeminiJudge implements LLMJudge {
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
  }

  describe(): { provider: string; model: string } {
    return { provider: "gemini", model: this.model };
  }

  async evaluate(
    opts: Parameters<LLMJudge["evaluate"]>[0],
  ): ReturnType<LLMJudge["evaluate"]> {
    if (!this.apiKey) {
      throw new Error("GeminiJudge: GEMINI_API_KEY is not set");
    }

    const { candidateOutput, rubric, context } = opts;

    // AC-5: rubric is string[]; join for multi-criterion, single-element preserved verbatim
    const rubricText = rubric.join("\n");
    const candidateText =
      typeof candidateOutput === "string" ? candidateOutput : JSON.stringify(candidateOutput);

    const prompt =
      `Did this response satisfy the following criterion?\n\n` +
      `Criterion: ${rubricText}\n\n` +
      `Response:\n${candidateText}\n\n` +
      `Answer with YES or NO followed by a one-sentence rationale.` +
      (context?.fixture ? `\n\nFixture context: ${context.fixture}` : "");

    const url = `${GEMINI_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens,
      },
    };

    const signal = AbortSignal.timeout(this.timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`GeminiJudge: fetch failed: ${msg}`);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GeminiJudge: HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const start = Date.now();
    const data = (await res.json()) as GeminiResponse;
    const latency_ms = Date.now() - start;
    const judgeText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const { pass, score, rationale, raw } = parseJudgeText(judgeText, data);

    return {
      pass,
      score,
      rubricScores: { [rubricText]: score },
      rationale,
      cost_usd: 0,
      latency_ms,
      tokens: {
        in: data.usageMetadata?.promptTokenCount ?? 0,
        out: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
      raw,
    };
  }
}
