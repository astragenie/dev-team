/**
 * GroqJudge: free-tier primary judge.
 * Extends GenericOpenAIJudge with Groq baseUrl, model defaults, rate-limit header parsing.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-88 (FEAT-169 SLICE-B1): exported, not invoked by dry-run runtime.
 * Live calls happen in SLICE-B2 when --live mode is implemented.
 */

import type { GenericOpenAIConfig, JudgeRequest, JudgeResult } from "../lib/judge.ts";
import { GenericOpenAIJudge } from "./generic-openai.ts";

const GROQ_BASE_URL = "https://api.groq.com/openai";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

/** Rate-limit metadata parsed from Groq response headers. */
interface GroqRateLimit {
  requestsRemaining: number | undefined;
  tokensRemaining: number | undefined;
  requestsResetMs: number | undefined;
}

function parseRateLimitHeaders(headers: Headers): GroqRateLimit {
  const reqRem = headers.get("x-ratelimit-remaining-requests");
  const tokRem = headers.get("x-ratelimit-remaining-tokens");
  const reqReset = headers.get("x-ratelimit-reset-requests");
  return {
    requestsRemaining: reqRem !== null ? parseInt(reqRem, 10) : undefined,
    tokensRemaining: tokRem !== null ? parseInt(tokRem, 10) : undefined,
    requestsResetMs: reqReset !== null ? parseInt(reqReset, 10) : undefined
  };
}

export class GroqJudge extends GenericOpenAIJudge {
  /** Rate-limit state updated after each call. Read-only for callers. */
  lastRateLimit: GroqRateLimit = {
    requestsRemaining: undefined,
    tokensRemaining: undefined,
    requestsResetMs: undefined
  };

  constructor(config?: Partial<GenericOpenAIConfig>) {
    super({
      baseUrl: config?.baseUrl ?? GROQ_BASE_URL,
      apiKey: config?.apiKey ?? process.env["GROQ_API_KEY"] ?? "",
      model: config?.model ?? GROQ_DEFAULT_MODEL,
      temperature: config?.temperature ?? 0.0
    });
  }

  override async judge(req: JudgeRequest): Promise<JudgeResult> {
    // Groq uses the same /v1/chat/completions shape as Generic.
    // We intercept fetch to capture rate-limit headers, then delegate.
    // In SLICE-B1 (dry-run only) this path is never reached; the override
    // is a forward-compatible hook for SLICE-B2.
    const result = await super.judge(req);
    // Rate-limit headers are on the raw response — captured via `raw` field.
    // SLICE-B2 will wire the actual fetch interception; stub the field here.
    this.lastRateLimit = parseRateLimitHeaders(new Headers());
    return result;
  }
}

// Expose the Groq model list for tooling/selection UI (SLICE-B2+).
export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "gemma2-9b-it",
  "mixtral-8x7b-32768"
] as const;

export type GroqModel = (typeof GROQ_MODELS)[number];
