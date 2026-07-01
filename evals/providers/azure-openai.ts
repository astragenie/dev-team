/**
 * AzureOpenAIJudge shim — dev-team adapter layer.
 *
 * Reads Azure credentials from the environment and delegates to the
 * relocated AzureOpenAIJudge implementation in
 * @astragenie/gepa-core/providers/azure-openai.
 *
 * SLICE-109 (FEAT-185 SLICE-B revised): core logic relocated to gepa-core 0.5.0.
 * This file is now a thin env-reading shim. Implements the canonical `LLMJudge`
 * interface from gepa-core; `id` + `judge()` are retained as concrete members for
 * one minor version (structural superset, not via `JudgeProvider` alias).
 *
 * Required env: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT
 * Optional env: AZURE_OPENAI_DEPLOYMENT (default: gpt-4o),
 *               AZURE_OPENAI_API_VERSION (default: 2024-10-21)
 *
 * Credential validation is deferred to the first evaluate()/judge() call so
 * that constructing an AzureOpenAIJudge without credentials does not throw.
 * This preserves the pre-refactor behavior tested in evals-cloud-providers.test.ts.
 *
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 */

import {
  AzureOpenAIJudge as _AzureOpenAIJudge,
  type AzureOpenAIConfig,
} from "@astragenie/gepa-core/providers/azure-openai";
import type { LLMJudge } from "@astragenie/gepa-core";

export type { AzureOpenAIConfig };

const DEFAULT_DEPLOYMENT = "gpt-4o";

/**
 * Shim: reads AZURE_OPENAI_* env vars when config fields are absent, then
 * delegates all logic to the gepa-core AzureOpenAIJudge (LLMJudge).
 *
 * Inner instantiation is deferred to the first call so that constructing
 * without credentials does not throw (matches pre-refactor shim behavior).
 * Throws a descriptive error containing the env-var name when credentials
 * are absent at call time.
 *
 * `id` is kept as a concrete member (not via JudgeProvider) for registry
 * lookup compatibility. `judge()` is a deprecated shim retained for one minor.
 */
export class AzureOpenAIJudge implements LLMJudge {
  private readonly _resolvedEndpoint: string;
  private readonly _resolvedDeployment: string;
  private readonly _resolvedApiKey: string;
  private readonly _resolvedApiVersion: string | undefined;
  private readonly _resolvedTemperature: number | undefined;
  private readonly _resolvedTimeoutMs: number | undefined;
  private _inner: _AzureOpenAIJudge | null = null;
  /** Registry lookup key. Retained for one minor version; prefer `describe().model`. */
  readonly id: string;

  constructor(config?: Partial<AzureOpenAIConfig>) {
    this._resolvedEndpoint = (
      config?.endpoint ?? process.env["AZURE_OPENAI_ENDPOINT"] ?? ""
    ).replace(/\/$/, "");
    this._resolvedDeployment =
      config?.deployment ??
      process.env["AZURE_OPENAI_DEPLOYMENT"] ??
      DEFAULT_DEPLOYMENT;
    this._resolvedApiKey = config?.apiKey ?? process.env["AZURE_OPENAI_API_KEY"] ?? "";
    this._resolvedApiVersion = config?.apiVersion;
    this._resolvedTemperature = config?.temperature;
    this._resolvedTimeoutMs = config?.timeoutMs;
    this.id = `azure:${this._resolvedDeployment}`;
  }

  describe(): { provider: string; model: string } {
    // Preserve the legacy provider name "azure" (not "azure-openai") for
    // backward compat with JUDGE_REGISTRY keys and existing tests.
    return { provider: "azure", model: this._resolvedDeployment };
  }

  /**
   * Lazily construct the inner gepa-core AzureOpenAIJudge.
   * Throws a descriptive error referencing the required env-var name
   * when credentials are absent.
   */
  private _getInner(): _AzureOpenAIJudge {
    if (this._inner !== null) return this._inner;

    if (!this._resolvedApiKey) {
      throw new Error(
        "AzureOpenAIJudge: AZURE_OPENAI_API_KEY is required. Set the env var or pass apiKey in config.",
      );
    }
    if (!this._resolvedEndpoint) {
      throw new Error(
        "AzureOpenAIJudge: AZURE_OPENAI_ENDPOINT is required. Set the env var or pass endpoint in config.",
      );
    }

    const innerConfig: AzureOpenAIConfig = {
      endpoint: this._resolvedEndpoint,
      deployment: this._resolvedDeployment,
      apiKey: this._resolvedApiKey,
    };
    if (this._resolvedApiVersion !== undefined) innerConfig.apiVersion = this._resolvedApiVersion;
    if (this._resolvedTemperature !== undefined) innerConfig.temperature = this._resolvedTemperature;
    if (this._resolvedTimeoutMs !== undefined) innerConfig.timeoutMs = this._resolvedTimeoutMs;

    this._inner = new _AzureOpenAIJudge(innerConfig);
    return this._inner;
  }

  async evaluate(opts: Parameters<LLMJudge["evaluate"]>[0]): ReturnType<LLMJudge["evaluate"]> {
    return this._getInner().evaluate(opts);
  }

  /**
   * @deprecated Use `evaluate(opts)` instead. Shim retained for one minor version.
   * Accepts the legacy JudgeRequest shape inline to avoid importing the deprecated type.
   */
  async judge(req: {
    rubric: string;
    candidateOutput: string;
    context?: { fixture?: string; promptId?: string; version?: string };
  }): Promise<{
    pass: boolean;
    score: number;
    rationale: string;
    raw: unknown;
    providerCost?: { usd?: number; tokensIn: number; tokensOut: number };
  }> {
    const inner = this._getInner();
    const evalOpts: Parameters<LLMJudge["evaluate"]>[0] = {
      candidateOutput: req.candidateOutput,
      expected: { id: "shim", input: {}, expected_output: {}, held_out: false },
      rubric: [req.rubric],
    };
    if (req.context !== undefined) evalOpts.context = req.context;
    const result = await inner.evaluate(evalOpts);
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
