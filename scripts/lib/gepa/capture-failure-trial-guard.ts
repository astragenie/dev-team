// capture-failure-trial-guard.ts — timeout-guarded, fire-and-forget wrapper
// around captureFailureTrial (FEAT-193 S1 fix-forward).
//
// Root cause of the regression this module fixes: @astragenie/gepa-core's
// installed package points main/exports at raw .ts source (not a compiled
// dist/), so the FIRST time a process dynamically imports anything that
// transitively imports "@astragenie/gepa-core", Node has to parse/type-strip
// the whole provider tree (ollama/generic-openai/groq/gemini/azure-openai)
// cold. On a cold disk-cache machine this can take multiple seconds — long
// enough to blow a CLI command's or a hook's expected latency budget (caught
// via tests/crew-write-review-result.test.ts timing out at 5s when
// captureFailureTrial's OWN dynamic import of "@astragenie/gepa-core" raced
// a cold load inside the `write-review-result` CLI path).
//
// This module exists as its OWN file — it has no static (or even dynamic,
// eagerly-evaluated) dependency on capture-failure-trial.ts or
// "@astragenie/gepa-core" at its own module-evaluation time (the import
// below is `import type`, which is erased entirely by type-stripping/
// transpilation — it costs nothing at runtime). That means importing THIS
// module is always fast; the slow part is isolated inside the raced dynamic
// import in captureFailureTrialGuarded(), so a cold gepa-core load can never
// hold a caller (a CLI command, a hook) open for longer than
// DEFAULT_TIMEOUT_MS. Matches the operator decision: astramem is the source
// of truth, this JSONL corpus is a derived duplicate — a trial dropped
// because the load was slow/cold is an acceptable trade for never blocking
// the gate/hook/CLI this rides on.
//
// Upstream fix recommended (tracked as a FEAT-193 S1 follow-up, cross-repo):
// @astragenie/gepa-core should publish/resolve to its compiled dist/*.js as
// main/exports, not raw src/*.ts — that removes the cold-parse cost for
// every consumer, not just this guard.
import type { FailureTrialInput } from "./capture-failure-trial.ts";

const DEFAULT_TIMEOUT_MS = 1500;

function timeoutAfter(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => setTimeout(() => resolve("timeout"), ms));
}

/**
 * Best-effort, timeout-guarded sibling of captureFailureTrial. Never throws,
 * never blocks the caller beyond `timeoutMs` — on timeout OR error, the
 * trial is simply dropped (silently, matching the fire-and-forget contract
 * every capture point in this codebase already follows).
 */
export async function captureFailureTrialGuarded(
  repoPath: string,
  entry: FailureTrialInput,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<void> {
  try {
    await Promise.race([
      (async () => {
        const { captureFailureTrial } = await import("./capture-failure-trial.ts");
        await captureFailureTrial(repoPath, entry);
      })(),
      timeoutAfter(timeoutMs)
    ]);
  } catch {
    // Fire-and-forget: never propagate.
  }
}
