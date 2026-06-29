/**
 * GeminiJudge shim — dev-team adapter layer.
 *
 * Reads GEMINI_API_KEY from the environment (when not supplied in config) and
 * delegates to the relocated GeminiJudge implementation in
 * @astragenie/gepa-core/providers/gemini.
 *
 * SLICE-108 (FEAT-185 SLICE-A): core logic relocated to gepa-core 0.3.0.
 * This file is now a thin env-reading shim that satisfies the zero-arg
 * `new () => JudgeProvider` shape expected by JUDGE_REGISTRY.
 *
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 */

import {
  GeminiJudge as _GeminiJudge,
  type GeminiConfig,
} from "@astragenie/gepa-core/providers/gemini";
import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";
import type { LLMJudge } from "@astragenie/gepa-core";

export type { GeminiConfig };

/**
 * Shim: zero-arg constructor reads GEMINI_API_KEY from the environment, then
 * delegates all logic to the gepa-core GeminiJudge.
 * exactOptionalPropertyTypes: pass only fields that are defined.
 *
 * Pre-refactor behavior preserved: evaluate() throws a descriptive
 * "GEMINI_API_KEY is not set" error when the key is empty, matching the
 * assertion in tests/evals-providers.test.ts.
 */
export class GeminiJudge implements JudgeProvider {
  private readonly _inner: _GeminiJudge;
  private readonly _resolvedApiKey: string;
  readonly id: string;

  constructor(config?: GeminiConfig) {
    this._resolvedApiKey = config?.apiKey ?? process.env["GEMINI_API_KEY"] ?? "";
    const geminiConfig: GeminiConfig = {
      apiKey: this._resolvedApiKey,
    };
    if (config?.model !== undefined) geminiConfig.model = config.model;
    if (config?.temperature !== undefined) geminiConfig.temperature = config.temperature;
    if (config?.maxOutputTokens !== undefined) geminiConfig.maxOutputTokens = config.maxOutputTokens;
    if (config?.timeoutMs !== undefined) geminiConfig.timeoutMs = config.timeoutMs;
    this._inner = new _GeminiJudge(geminiConfig);
    this.id = `gemini:${this._inner.describe().model}`;
  }

  describe(): { provider: string; model: string } {
    return this._inner.describe();
  }

  async evaluate(opts: Parameters<LLMJudge["evaluate"]>[0]): ReturnType<LLMJudge["evaluate"]> {
    // Preserve pre-refactor behavior: fail fast with a descriptive error when
    // the API key is empty rather than letting the HTTP call return 403.
    if (!this._resolvedApiKey) {
      throw new Error("GeminiJudge: GEMINI_API_KEY is not set");
    }
    return this._inner.evaluate(opts);
  }

  /** @deprecated Use `evaluate(opts)` instead. Shim retained for one minor version. */
  async judge(req: JudgeRequest): Promise<JudgeResult> {
    const evalOpts: Parameters<LLMJudge["evaluate"]>[0] = {
      candidateOutput: req.candidateOutput,
      expected: { id: "shim", input: {}, expected_output: {}, held_out: false },
      rubric: [req.rubric],
    };
    if (req.context !== undefined) evalOpts.context = req.context;
    const result = await this.evaluate(evalOpts);
    return {
      pass: result.pass,
      score: result.score,
      rationale: result.rationale,
      raw: result.raw,
      providerCost: {
        tokensIn: result.tokens?.in ?? 0,
        tokensOut: result.tokens?.out ?? 0,
      },
    };
  }
}
