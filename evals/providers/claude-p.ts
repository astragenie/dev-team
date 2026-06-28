/**
 * ClaudePJudge: self-judge via `claude -p` subprocess.
 * Implements LLMJudge (FEAT-184 unified interface).
 * Subscription-billed; no API key needed — auth inherited from claude CLI install.
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * SLICE-89 (FEAT-169 SLICE-B2).
 * FEAT-184: migrated from JudgeProvider to LLMJudge.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { LLMJudge } from "@astragenie/gepa-core";

export interface ClaudePConfig {
  /** Claude model to use (default: claude-sonnet-4-6). */
  model?: string;
  /** Request timeout in ms (default: 180000). */
  timeoutMs?: number;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = (() => {
  const env = process.env["CREW_EVAL_JUDGE_TIMEOUT_MS"];
  const parsed = env ? Number.parseInt(env, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
})();

/** NDJSON event emitted by `claude -p --output-format stream-json`. */
interface StreamEvent {
  type: string;
  // result event
  result?: string;
  // message event fields
  role?: string;
  content?: Array<{ type: string; text?: string }> | string;
}

/**
 * Parse NDJSON stream-json output from `claude -p`.
 * Returns the final assistant text.
 */
function parseStreamJson(stdout: string): string {
  const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
  let finalText = "";

  for (const line of lines) {
    let event: StreamEvent;
    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      continue;
    }

    // Prefer the top-level "result" field from the result event
    if (event.type === "result" && typeof event.result === "string") {
      finalText = event.result;
    } else if (
      event.type === "message" &&
      event.role === "assistant" &&
      Array.isArray(event.content)
    ) {
      // Aggregate text blocks
      const parts = event.content
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text ?? "");
      if (parts.length > 0) {
        finalText = parts.join("");
      }
    }
  }

  return finalText.trim();
}

/**
 * Parse the judge text (YES/NO + rationale) into evaluation fields.
 */
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

export class ClaudePJudge implements LLMJudge {
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(config?: ClaudePConfig) {
    this.model = config?.model ?? DEFAULT_MODEL;
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  describe(): { provider: string; model: string } {
    return { provider: "claude-p", model: this.model };
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

    const start = Date.now();
    const stdout = await this.runSubprocess(prompt);
    const latency_ms = Date.now() - start;
    const text = parseStreamJson(stdout);

    // If stream-json parsing yielded nothing, treat raw stdout as text
    const judgeText = text.length > 0 ? text : stdout.trim();
    const { pass, score, rationale, raw } = parseJudgeText(judgeText, { stdout });

    return {
      pass,
      score,
      rubricScores: { [rubricText]: score },
      rationale,
      cost_usd: 0,
      latency_ms,
      // ClaudePJudge cannot surface token counts from the subprocess
      tokens: { in: 0, out: 0 },
      raw,
    };
  }

  private async runSubprocess(prompt: string): Promise<string> {
    // FEAT-173: isolated tempdir cwd — prevents the judge subprocess from
    // reading the host repo's CLAUDE.md, git status, or memory. Eliminates
    // cross-contamination where the judge's rubric verdict was being
    // influenced by host-session state instead of the eval candidate output.
    const tempCwd = await fs.mkdtemp(path.join(os.tmpdir(), "crew-eval-judge-"));

    return new Promise((resolve, reject) => {
      const args = [
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--dangerously-skip-permissions",
        "--model",
        this.model,
      ];

      const child = spawn("claude", args, {
        cwd: tempCwd,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const cleanup = () => {
        fs.rm(tempCwd, { recursive: true, force: true }).catch(() => {
          /* best-effort tempdir cleanup */
        });
      };

      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        cleanup();
        reject(new Error(`ClaudePJudge: subprocess timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.on("close", (code) => {
        clearTimeout(timer);
        cleanup();
        if (code !== 0 && stdout.trim().length === 0) {
          reject(
            new Error(
              `ClaudePJudge: subprocess exited with code ${code ?? "null"}. stderr: ${stderr.slice(0, 300)}`,
            ),
          );
        } else {
          resolve(stdout);
        }
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        cleanup();
        reject(new Error(`ClaudePJudge: failed to spawn claude: ${err.message}`));
      });

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }
}
