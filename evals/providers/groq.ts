/**
 * GroqJudge shim — dev-team adapter layer.
 *
 * Reads GROQ_API_KEY from the environment (when not supplied in config) and
 * delegates to the relocated GroqJudge implementation in
 * @astragenie/gepa-core/providers/groq.
 *
 * SLICE-108 (FEAT-185 SLICE-A): core logic relocated to gepa-core 0.3.0.
 * This file bridges the registry's `Partial<GenericOpenAIConfig>` call
 * shape to gepa-core's `GroqConfig { apiKey, model?, temperature? }`.
 *
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 */

import {
  GroqJudge as _GroqJudge,
  GROQ_MODELS,
  type GroqConfig,
  type GroqRateLimit,
} from "@astragenie/gepa-core/providers/groq";
import type { GenericOpenAIConfig, JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";
import type { LLMJudge } from "@astragenie/gepa-core";

export type { GroqConfig, GroqRateLimit };
export type GroqModel = (typeof GROQ_MODELS)[number];
export { GROQ_MODELS };

/**
 * Shim: adapts the registry's `Partial<GenericOpenAIConfig>` constructor
 * signature to gepa-core's `GroqConfig`. Reads GROQ_API_KEY from the
 * environment when apiKey is not supplied in config.
 * exactOptionalPropertyTypes: pass only fields that are defined.
 */
export class GroqJudge implements JudgeProvider {
  private readonly _inner: _GroqJudge;
  readonly id: string;

  constructor(config?: Partial<GenericOpenAIConfig>) {
    const groqConfig: GroqConfig = {
      apiKey: config?.apiKey ?? process.env["GROQ_API_KEY"] ?? "",
    };
    if (config?.model !== undefined) groqConfig.model = config.model;
    if (config?.temperature !== undefined) groqConfig.temperature = config.temperature;
    this._inner = new _GroqJudge(groqConfig);
    this.id = `groq:${this._inner.describe().model}`;
  }

  describe(): { provider: string; model: string } {
    return this._inner.describe();
  }

  get lastRateLimit(): GroqRateLimit {
    return this._inner.lastRateLimit;
  }

  async evaluate(opts: Parameters<LLMJudge["evaluate"]>[0]): ReturnType<LLMJudge["evaluate"]> {
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
    const result = await this._inner.evaluate(evalOpts);
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
