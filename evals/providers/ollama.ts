/**
 * OllamaJudge: local/offline judge via Ollama /api/chat endpoint.
 * Native fetch — no npm dependencies.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-89 (FEAT-169 SLICE-B2).
 * SLICE-107 (FEAT-184 S2): implements LLMJudge.evaluate() + describe();
 *   judge() retained as @deprecated shim for one minor version.
 *   Maps prompt_eval_count/eval_count → tokens: { in, out } in evaluate().
 */

import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";
import type { LLMJudge } from "@astragenie/gepa-core";

export interface OllamaConfig {
  /** Ollama base URL (default: http://localhost:11434). */
  host?: string;
  /** Model name (default: llama3.3). */
  model?: string;
  /** Request timeout in ms (default: 120000). */
  timeoutMs?: number;
}

const DEFAULT_HOST = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.3";
const DEFAULT_TIMEOUT_MS = 120_000;

interface OllamaChatResponse {
  message: { role: string; content: string };
  done: boolean;
  eval_count?: number;
  prompt_eval_count?: number;
}

function parseJudgeText(
  text: string
): { pass: boolean; score: number; rationale: string } {
  const pass = /^yes/i.test(text.trim());
  const firstBreak = text.indexOf("\n");
  const rationale = firstBreak !== -1 ? text.slice(firstBreak + 1).trim() : text.trim();
  return { pass, score: pass ? 1 : 0, rationale };
}

async function callOllama(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<OllamaChatResponse> {
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
    throw new Error(
      `OllamaJudge: connection to ${url} failed — is Ollama running? (${msg})`
    );
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OllamaJudge: HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return (await res.json()) as OllamaChatResponse;
}

export class OllamaJudge implements JudgeProvider {
  readonly id: string;
  private readonly host: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config?: OllamaConfig) {
    this.host = (config?.host ?? process.env["OLLAMA_HOST"] ?? DEFAULT_HOST).replace(/\/$/, "");
    this.model = config?.model ?? DEFAULT_MODEL;
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.id = `ollama:${this.model}`;
  }

  describe(): { provider: string; model: string } {
    return { provider: "ollama", model: this.model };
  }

  async evaluate(opts: Parameters<LLMJudge["evaluate"]>[0]): ReturnType<LLMJudge["evaluate"]> {
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

    const url = `${this.host}/api/chat`;
    const data = await callOllama(
      url,
      { model: this.model, messages: [{ role: "user", content: prompt }], stream: false },
      this.timeoutMs
    );

    const { pass, score, rationale } = parseJudgeText(data.message?.content ?? "");

    return {
      pass,
      score,
      rubricScores: { default: score },
      rationale,
      cost_usd: 0,
      latency_ms: Date.now() - start,
      tokens: {
        in: data.prompt_eval_count ?? 0,
        out: data.eval_count ?? 0
      },
      raw: data
    };
  }

  /** @deprecated Use `evaluate(opts)` instead. Shim retained for one minor version. */
  async judge(req: JudgeRequest): Promise<JudgeResult> {
    const prompt =
      `Did this response satisfy the following criterion?\n\n` +
      `Criterion: ${req.rubric}\n\n` +
      `Response:\n${req.candidateOutput}\n\n` +
      `Answer with YES or NO followed by a one-sentence rationale.`;

    const url = `${this.host}/api/chat`;
    const data = await callOllama(
      url,
      { model: this.model, messages: [{ role: "user", content: prompt }], stream: false },
      this.timeoutMs
    );

    const { pass, score, rationale } = parseJudgeText(data.message?.content ?? "");

    return {
      pass,
      score,
      rationale,
      raw: data,
      providerCost: {
        tokensIn: data.prompt_eval_count ?? 0,
        tokensOut: data.eval_count ?? 0
      }
    };
  }
}
