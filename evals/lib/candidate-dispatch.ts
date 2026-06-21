/**
 * Candidate dispatch — runs the target agent's prompt against fixture input via
 * `claude -p` subprocess and captures the response as the evaluation candidate.
 *
 * Module boundary: MUST NOT import from agents/, scripts/, src/, hooks/, commands/.
 *
 * FEAT-171 — closes the framework gap surfaced in SLICE-93 post-shrink diagnostic
 * where evals/lib/run-eval.ts treated fixture text directly as candidate output
 * instead of dispatching the candidate agent against the fixture as input.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

export interface CandidateDispatchOptions {
  /** Path to the candidate agent's prompt file, e.g. agents/fullstack-dev.md. */
  agentPromptPath: string;
  /** Fixture content to send as the dispatch prompt body. */
  fixtureContent: string;
  /** Claude model to use (default: claude-sonnet-4-6). */
  model?: string;
  /** Per-dispatch timeout in ms (default: 300_000 — 5 min). */
  timeoutMs?: number;
}

export interface CandidateDispatchResult {
  /** Captured assistant response text from the candidate dispatch. */
  candidateOutput: string;
  /** Raw stdout for debugging. */
  rawStdout: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = 300_000;

interface StreamEvent {
  type: string;
  result?: string;
  role?: string;
  content?: Array<{ type: string; text?: string }> | string;
}

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

    if (event.type === "result" && typeof event.result === "string") {
      finalText = event.result;
    } else if (
      event.type === "message" &&
      event.role === "assistant" &&
      Array.isArray(event.content)
    ) {
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
 * Dispatch the candidate agent against fixture input.
 *
 * Strategy: load the agent prompt body, prepend it as system-context to the
 * fixture, send the combined prompt to `claude -p`. The captured response IS
 * the candidate output that asserts then evaluate.
 *
 * Auth: inherited from local `claude` CLI install. No API key.
 */
export async function dispatchCandidate(
  opts: CandidateDispatchOptions
): Promise<CandidateDispatchResult> {
  const promptPath = path.isAbsolute(opts.agentPromptPath)
    ? opts.agentPromptPath
    : path.resolve(opts.agentPromptPath);

  let agentPrompt: string;
  try {
    agentPrompt = await fs.readFile(promptPath, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`candidate-dispatch: cannot read agent prompt at ${promptPath}: ${msg}`);
  }

  const combinedPrompt =
    `You are operating under the following agent definition. Read it before responding to the dispatch input below.\n\n` +
    `=== AGENT DEFINITION ===\n${agentPrompt}\n=== END AGENT DEFINITION ===\n\n` +
    `=== DISPATCH INPUT ===\n${opts.fixtureContent}\n=== END DISPATCH INPUT ===\n\n` +
    `Respond as the agent defined above. Produce the output the agent would produce when given the dispatch input — typically a handoff summary, identity-stable response, or scope-cross flag.`;

  const model = opts.model ?? DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const stdout = await runSubprocess(combinedPrompt, model, timeoutMs);
  const candidateOutput = parseStreamJson(stdout);

  return {
    candidateOutput: candidateOutput.length > 0 ? candidateOutput : stdout.trim(),
    rawStdout: stdout
  };
}

function runSubprocess(prompt: string, model: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ["-p", prompt, "--output-format", "stream-json", "--model", model];
    const child = spawn("claude", args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`candidate-dispatch: subprocess timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 && stdout.trim().length === 0) {
        reject(
          new Error(
            `candidate-dispatch: subprocess exited with code ${code ?? "null"}. stderr: ${stderr.slice(0, 300)}`
          )
        );
      } else {
        resolve(stdout);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`candidate-dispatch: failed to spawn claude: ${err.message}`));
    });
  });
}
