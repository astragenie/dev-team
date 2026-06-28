/**
 * OllamaJudge: local/offline judge via Ollama /api/chat endpoint.
 * Implements LLMJudge (FEAT-184 unified interface).
 * Native fetch — no npm dependencies.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-89 (FEAT-169 SLICE-B2).
 * FEAT-184: migrated from JudgeProvider to LLMJudge.
 */

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

export class OllamaJudge implements LLMJudge {
  private readonly host: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config?: OllamaConfig) {
    this.host = (config?.host ?? process.env["OLLAMA_HOST"] ?? DEFAULT_HOST).replace(/\/$/, "");
    this.model = config?.model ?? DEFAULT_MODEL;
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  describe(): { provider: string; model: string } {
    return { provider: "ollama", model: this.model };
  }

  async evaluate(
    opts: Parameters<LLMJudge["evaluate"]>[0],
  ): ReturnType<LLMJudge["evaluate"]> {
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

    const url = `${this.host}/api/chat`;
    const body = {
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      stream: false,
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
      throw new Error(
        `OllamaJudge: connection to ${this.host} failed — is Ollama running? (${msg})`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OllamaJudge: HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const start = Date.now();
    const data = (await res.json()) as OllamaChatResponse;
    const latency_ms = Date.now() - start;
    const judgeText = data.message?.content ?? "";
    const { pass, score, rationale, raw } = parseJudgeText(judgeText, data);

    return {
      pass,
      score,
      rubricScores: { [rubricText]: score },
      rationale,
      cost_usd: 0,
      latency_ms,
      tokens: {
        in: data.prompt_eval_count ?? 0,
        out: data.eval_count ?? 0,
      },
      raw,
    };
  }
}
