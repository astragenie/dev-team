/**
 * GenericOpenAIJudge shim — dev-team adapter layer.
 *
 * Delegates to the relocated GenericOpenAIJudge implementation in
 * @astragenie/gepa-core/providers/generic-openai.
 *
 * SLICE-108 (FEAT-185 SLICE-A): core logic relocated to gepa-core 0.3.0.
 * This file re-exports the class and its config type so JUDGE_REGISTRY
 * and all existing callers continue to work without changes.
 *
 * GenericOpenAIConfig.apiKey is always caller-supplied (no env default here
 * — callers like GroqJudge handle their own env reads before constructing).
 *
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 */

import {
  GenericOpenAIJudge as _GenericOpenAIJudge,
  type GenericOpenAIConfig,
} from "@astragenie/gepa-core/providers/generic-openai";
import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";
import type { LLMJudge } from "@astragenie/gepa-core";

export type { GenericOpenAIConfig };

/**
 * Shim: wraps the gepa-core GenericOpenAIJudge, preserving the constructor
 * signature `new (config: GenericOpenAIConfig) => JudgeProvider` that
 * JUDGE_REGISTRY expects.
 * exactOptionalPropertyTypes: omit context when undefined.
 */
export class GenericOpenAIJudge implements JudgeProvider {
  private readonly _inner: _GenericOpenAIJudge;
  readonly id: string;

  constructor(config: GenericOpenAIConfig) {
    this._inner = new _GenericOpenAIJudge(config);
    const d = this._inner.describe();
    this.id = `generic-openai:${d.model}`;
  }

  describe(): { provider: string; model: string } {
    return this._inner.describe();
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
