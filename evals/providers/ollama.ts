/**
 * OllamaJudge shim — dev-team adapter layer.
 *
 * Reads OLLAMA_HOST from the environment and delegates to the relocated
 * OllamaJudge implementation in @astragenie/gepa-core/providers/ollama.
 *
 * SLICE-108 (FEAT-185 SLICE-A): core logic relocated to gepa-core 0.3.0.
 * This file is now a thin env-reading shim that satisfies the zero-arg
 * `new () => JudgeProvider` shape expected by JUDGE_REGISTRY.
 *
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 */

import {
  OllamaJudge as _OllamaJudge,
  type OllamaConfig,
} from "@astragenie/gepa-core/providers/ollama";
import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";
import type { LLMJudge } from "@astragenie/gepa-core";

export type { OllamaConfig };

/**
 * Shim: zero-arg constructor reads OLLAMA_HOST from the environment, then
 * delegates all logic to the gepa-core OllamaJudge.
 * exactOptionalPropertyTypes: pass only fields that are defined.
 */
export class OllamaJudge implements JudgeProvider {
  private readonly _inner: _OllamaJudge;
  readonly id: string;

  constructor(config?: OllamaConfig) {
    const resolved: OllamaConfig = {};
    const host = config?.host ?? process.env["OLLAMA_HOST"];
    if (host !== undefined) resolved.host = host;
    if (config?.model !== undefined) resolved.model = config.model;
    if (config?.temperature !== undefined) resolved.temperature = config.temperature;
    if (config?.timeoutMs !== undefined) resolved.timeoutMs = config.timeoutMs;
    this._inner = new _OllamaJudge(resolved);
    this.id = `ollama:${this._inner.describe().model}`;
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
