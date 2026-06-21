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
  /** Per-dispatch timeout in ms (default: 90_000 — 90s; override via CREW_EVAL_CANDIDATE_TIMEOUT_MS). */
  timeoutMs?: number;
}

export interface CandidateDispatchResult {
  /** Captured assistant response text from the candidate dispatch. */
  candidateOutput: string;
  /** Raw stdout for debugging. */
  rawStdout: string;
}

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = (() => {
  const env = process.env["CREW_EVAL_CANDIDATE_TIMEOUT_MS"];
  const parsed = env ? Number.parseInt(env, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180_000;
})();

interface StreamEvent {
  type: string;
  result?: string;
  role?: string;
  content?: Array<{ type: string; text?: string }> | string;
}

/**
 * Parse stream-json NDJSON output from `claude -p`.
 *
 * Strategy (FEAT-174 fix — capture assistant response, not session noise):
 *   1. Prefer the final `event: "result"` if present (clean canonical text).
 *   2. Else aggregate ALL assistant message text blocks in order (max-turns
 *      cap can prevent a result event from firing).
 *   3. Else return empty string — caller will surface as "candidate produced
 *      no parseable response" rather than dumping raw NDJSON (which includes
 *      session-start hook noise + the original fixture echoed in user events).
 */
function parseStreamJson(stdout: string): string {
  const lines = stdout.split("\n").filter((l) => l.trim().length > 0);
  let resultText = "";
  const messageTexts: string[] = [];

  for (const line of lines) {
    let event: StreamEvent;
    try {
      event = JSON.parse(line) as StreamEvent;
    } catch {
      continue;
    }

    if (event.type === "result" && typeof event.result === "string") {
      resultText = event.result;
    } else if (
      event.type === "message" &&
      event.role === "assistant" &&
      Array.isArray(event.content)
    ) {
      const parts = event.content
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text ?? "");
      if (parts.length > 0) {
        messageTexts.push(parts.join(""));
      }
    }
  }

  if (resultText.trim().length > 0) return resultText.trim();
  if (messageTexts.length > 0) return messageTexts.join("\n\n").trim();
  return "";
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

  // Never fall back to raw stdout — it contains session-start hook noise +
  // the original fixture echoed in user events. Surface explicit error
  // marker so asserts treat it as no-response rather than matching against noise.
  return {
    candidateOutput:
      candidateOutput.length > 0
        ? candidateOutput
        : "[candidate produced no parseable response — likely hit max-turns or timed out mid-stream]",
    rawStdout: stdout
  };
}

function runSubprocess(prompt: string, model: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Stream prompt via stdin to avoid Windows 32KB command-line length limit.
    // --verbose required by `claude -p` when using --output-format stream-json.
    // --dangerously-skip-permissions: candidate dispatch is read-only eval — no
    // file writes should occur; permission prompts would stall the subprocess.
    // --max-turns 3: constrain candidate to single-response (acknowledge +
    // produce handoff-shaped output) rather than multi-turn investigation
    // loops that blow eval timeout budget. Eval measures the FIRST response
    // pattern, not the agent's full work.
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
      "--max-turns",
      "3",
      "--model",
      model
    ];
    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
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

    // Write prompt to stdin
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
