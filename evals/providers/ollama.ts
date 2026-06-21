/**
 * OllamaJudge: local/offline judge via Ollama /api/chat endpoint.
 * Native fetch — no npm dependencies.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-89 (FEAT-169 SLICE-B2).
 */

import type { JudgeProvider, JudgeRequest, JudgeResult } from "../lib/judge.ts";

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
  raw: unknown
): Pick<JudgeResult, "pass" | "score" | "rationale" | "raw"> {
  const pass = /^yes/i.test(text.trim());
  const firstBreak = text.indexOf("\n");
  const rationale = firstBreak !== -1 ? text.slice(firstBreak + 1).trim() : text.trim();
  return { pass, score: pass ? 1 : 0, rationale, raw };
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

  async judge(req: JudgeRequest): Promise<JudgeResult> {
    const prompt =
      `Did this response satisfy the following criterion?\n\n` +
      `Criterion: ${req.rubric}\n\n` +
      `Response:\n${req.candidateOutput}\n\n` +
      `Answer with YES or NO followed by a one-sentence rationale.`;

    const url = `${this.host}/api/chat`;
    const body = {
      model: this.model,
      messages: [{ role: "user", content: prompt }],
      stream: false
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
      throw new Error(
        `OllamaJudge: connection to ${this.host} failed — is Ollama running? (${msg})`
      );
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OllamaJudge: HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as OllamaChatResponse;
    const judgeText = data.message?.content ?? "";

    return {
      ...parseJudgeText(judgeText, data),
      providerCost: {
        tokensIn: data.prompt_eval_count ?? 0,
        tokensOut: data.eval_count ?? 0
      }
    };
  }
}
