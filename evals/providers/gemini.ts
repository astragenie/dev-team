/**
 * GeminiJudge: cross-model judge via Google Gemini API.
 * Native Google API shape (NOT OpenAI-compatible). Native fetch, no npm deps.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-89 (FEAT-169 SLICE-B2).
 */

import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";

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
  raw: unknown
): Pick<JudgeResult, "pass" | "score" | "rationale" | "raw"> {
  const pass = /^yes/i.test(text.trim());
  const firstBreak = text.indexOf("\n");
  const rationale = firstBreak !== -1 ? text.slice(firstBreak + 1).trim() : text.trim();
  return { pass, score: pass ? 1 : 0, rationale, raw };
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

  async judge(req: JudgeRequest): Promise<JudgeResult> {
    if (!this.apiKey) {
      throw new Error("GeminiJudge: GEMINI_API_KEY is not set");
    }

    const prompt =
      `Did this response satisfy the following criterion?\n\n` +
      `Criterion: ${req.rubric}\n\n` +
      `Response:\n${req.candidateOutput}\n\n` +
      `Answer with YES or NO followed by a one-sentence rationale.`;

    const url = `${GEMINI_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens
      }
    };

    const signal = AbortSignal.timeout(this.timeoutMs);
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

    const data = (await res.json()) as GeminiResponse;
    const judgeText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    return {
      ...parseJudgeText(judgeText, data),
      providerCost: {
        tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0
      }
    };
  }
}
