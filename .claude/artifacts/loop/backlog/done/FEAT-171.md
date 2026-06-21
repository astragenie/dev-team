---
id: FEAT-171
status: done
priority: P2
category: quality
target_release: null
created: 2026-06-21
completed_at: 2026-06-21
depends_on: [FEAT-169]
slices: []
slices_complete: []
derived_from: FEAT-170
pm_customer_impact: 0.55
pm_effort_estimate: 0.25
pm_strategic_alignment: 0.7
pm_technical_risk: 0.3
pm_dependency_depth: 0.2
composite_score: 0.6
autonomous_safe: false
tags: [agent-eval, candidate-dispatch, behavioral-eval, claude-cli]
triage_notes: "Single-slice FEAT closing the framework gap surfaced in SLICE-93 post-shrink diagnostic. evals/lib/run-eval.ts previously treated fixture text directly as candidate output; behavioral asserts (does fullstack-dev reject lead-leak, surface SPLIT signal, respect Forbidden) were therefore impossible to verify. SLICE shipped inline 2026-06-21 alongside SLICE-94 — adds evals/lib/candidate-dispatch.ts (spawns claude -p with the agent prompt prepended to fixture as input, captures real response), plumbs --candidate-live CLI flag through to runEval, gates default test suite away from real subprocess via test.skipIf(CREW_EVAL_LIVE!=1). No new npm deps. Subscription-billed (claude CLI subscription, $0 over plan). Pre-mortem: claude -p subprocess × N tests × per-prompt sweep can hit rate-limit budget; default off behind --candidate-live opt-in. Risk band 0.3: subprocess auth + claude CLI shape stability + stream-json parsing fragility (reused ClaudePJudge parser)."
---

# FEAT-171: Candidate dispatch in eval framework — close the behavioral-eval gap

## Description

The eval framework shipped in FEAT-169 (SLICE-88/89/90) configures `candidate.runner: claude-p` in spec YAML but the runner never actually dispatches a `claude -p` subprocess. It treats fixture text directly as candidate output for asserts. For structural asserts (artifact-exists, pattern presence in pre-authored clean responses) this works. For behavioral asserts — does fullstack-dev reject a lead-leak phrase, does it surface a SPLIT_BUILD signal, does it respect a `Forbidden` block — the framework was useless because the agent never actually ran.

Surfaced explicitly in `docs/diagnostics/fullstack-dev-postshrink-2026-06-21.md` after SLICE-93: prompt-shrink improvements landed structurally but could not be verified dynamically.

This FEAT closes the gap.

## Acceptance criteria

1. New module `evals/lib/candidate-dispatch.ts` exporting `dispatchCandidate(opts)` that spawns `claude -p` with the target agent's prompt prepended to fixture content as the dispatch input, captures stream-json output, returns the parsed assistant text.
2. `evals/lib/run-eval.ts` `liveTest()` calls `dispatchCandidate` when `--candidate-live` flag is set AND `candidate.runner === "claude-p"` in spec. Returns test-level error (not crash) when dispatch fails.
3. `evals/cli.ts` adds `--candidate-live` flag separate from `--live`. `--live` runs judge live; `--candidate-live` runs candidate live; they compose.
4. Default `bun run evals --live` keeps SLICE-89 behavior (fixture as candidate). `--candidate-live` opts into the new behavior.
5. `bun run evals --dry-run` unchanged (no live anything).
6. Boundary lint rule still passes — `candidate-dispatch.ts` lives in `evals/lib/` and may not import from `agents/`, `scripts/`, `src/`, `hooks/`, `commands/`. It reads `agents/<prompt_id>.md` via raw `fs.readFile` from a path computed at runtime — that is data access, not module import.
7. Live integration test in `tests/evals-providers.test.ts` gated behind `CREW_EVAL_LIVE=1` to prevent default suite from spawning real subprocess calls.
8. `bun run lint`, `bun run typecheck`, `bun run format:check`, all eval tests pass.

## Implementation shape

`evals/lib/candidate-dispatch.ts`:

```ts
export interface CandidateDispatchOptions {
  agentPromptPath: string;
  fixtureContent: string;
  model?: string;
  timeoutMs?: number;
}

export interface CandidateDispatchResult {
  candidateOutput: string;
  rawStdout: string;
}

export async function dispatchCandidate(opts: CandidateDispatchOptions): Promise<CandidateDispatchResult>;
```

Strategy: read the agent prompt file (`agents/<prompt_id>.md`), wrap it as system-context before the fixture content with delimiters, spawn `claude -p` with `--output-format stream-json`, parse the result event (or aggregate message events as fallback), return the captured assistant text. Reuses the stream-json parsing pattern from `evals/providers/claude-p.ts`.

`evals/lib/run-eval.ts` updates:
- Extend `liveTest()` signature with `candidateLive: boolean`, `candidateCfg: EvalSpec["candidate"]`, `promptId: string`.
- Add `candidateLive` option to `runEval()`.
- When `candidateLive && candidateCfg?.runner === "claude-p" && fixtureText.length > 0`, dispatch candidate before running asserts.

`evals/cli.ts` updates:
- New CLI flag: `--candidate-live`.
- Parse + plumb through to `runEval`.
- Help text describes the difference between `--live` (judge live) and `--candidate-live` (candidate live).

## Constraints

- **No new npm dependencies.** Native `child_process` for subprocess.
- **Subscription-billed.** Uses claude CLI auth, no API key, no Anthropic per-token spend.
- **Default-safe.** New flag is opt-in. Default `bun run test` does NOT spawn `claude -p`.
- **Module boundary preserved.** New file in `evals/lib/`, reads agent prompt as data not import.

## Out of scope

- Caching candidate outputs across runs — every `--candidate-live` invocation re-dispatches (acceptable for prompt-change verification flow).
- Parallel candidate dispatch — serial only to respect rate limits.
- Non-claude candidate runners (e.g. dispatching via OpenAI / Gemini as candidate). Add later if needed.
- Re-running SLICE-93 baseline with `--candidate-live` to verify the prompt-shrink improvements — that's a SLICE-95 or follow-up activity.

## Notes

- Trigger: 2026-06-21 session SLICE-93 post-shrink diagnostic identified the gap explicitly.
- Single-slice FEAT — implementation + CLI flag + test gating shipped together.
- Sister FEAT: 169 (eval framework foundation), 170 (fullstack-dev fix consuming framework).
- Memory pattern: [[project-eval-framework-state-2026-06-21]] documents the framework state before this FEAT closes the candidate dispatch gap; that memory should be updated once this lands.
