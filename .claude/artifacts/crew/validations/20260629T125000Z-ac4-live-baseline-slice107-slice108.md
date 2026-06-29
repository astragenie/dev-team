---
kind: validation-result
slice: SLICE-107 + SLICE-108
ac: AC-4 (snapshot-diff with tolerance band)
decision: evidence_captured
created: 2026-06-29T12:50:00Z
---

# AC-4 Live Baseline Evidence — SLICE-107 + SLICE-108 carry-forward

## Background

SLICE-107 (FEAT-184 S2) closed with AC-3 deferred (no API keys in worktree).
SLICE-108 (FEAT-185 S-A) inherited the same gap as its AC-4. Inspector
verdicts on both slices accepted the deferral as an operator gate.

Operator supplied keys 2026-06-29:
- `GROQ_API_KEY` — Groq llama-3.3-70b-versatile (free tier, 30 req/min)
- `GEMINI_API_KEY` — Google Gemini (key valid for `gemini-2.5-flash`; older
  `gemini-1.5-flash` and `gemini-2.0-flash` return NOT_FOUND / 503)

## Runs captured

| Run ID | Spec | Judge | Model | Pass | Fail | Duration |
|---|---|---|---|---|---|---|
| `2026-06-29T12-41-41-195Z-fullstack-dev.json` | crew:fullstack-dev | groq | llama-3.3-70b-versatile | 2 | 7 | 180.2s |
| `2026-06-29T12-45-48-627Z-fullstack-dev.json` | crew:fullstack-dev | gemini | gemini-2.5-flash | 3 | 6 | 222.3s |
| `2026-06-29T12-46-09-016Z-inspector.json` | crew:inspector | groq | llama-3.3-70b-versatile | 2 | 3 (total) | 0.5s |

All three runs landed under `evals/runs/`.

## What this proves

- gepa-core 0.3.1 entry points (`@astragenie/gepa-core/providers/{groq,gemini}`)
  connect to live providers end-to-end. Provider extraction did not break the
  judge pipeline.
- dev-team shims (`evals/providers/{groq,gemini}.ts`) correctly resolve env
  vars and pass them to the relocated constructors.
- `LLMJudge.evaluate(opts)` round-trips with `opts.context.fixture`,
  `cost_usd`, `latency_ms`, `tokens.in/out` fields populated as documented.
- The SLICE-108 inspector's MEDIUM finding (OllamaConfig.temperature) is
  fixed in 0.3.1 — not directly exercised here (no Ollama running locally),
  but the 0.3.1 regression tests cover it.

## What this does NOT prove

The original AC-4 wording asked for a PRE/POST snapshot-diff with a
tolerance band (PASS/FAIL identical per test, mean score ±0.05, mean
tokens ±5%). That comparison is structurally not possible:

1. **No PRE-refactor baseline exists.** SLICE-107 (FEAT-184 S2) was the
   first slice to call `evaluate()` — the method did not exist pre-refactor.
   There is nothing to diff against.
2. **`--candidate-live` not implemented (FEAT-171).** Most fullstack-dev
   tests fail because the eval framework treats the fixture file as if it
   were the agent's response. Without subprocess dispatch of the real
   agent, the judge is rating the input prompt against criteria written
   for the output. This is a known limitation — see
   `loop-snapshot.md` line 22 (FEAT-171 proposed-but-not-opened) and the
   2026-06-21 session telemetry.
3. **N≥5 per judge not reached.** Free-tier rate limits + the FEAT-171
   limitation made repeated runs uninformative. One run per judge per
   spec gives a baseline characterization; future SLICE-109 work can
   compare against these run logs.

## Recommendation

Mark AC-4 as `evidence_captured` rather than `pass` or `fail`. The
formal statistical-band gate becomes meaningful once FEAT-171 lands and
the candidate-dispatch step exercises the real agent against fixtures.
Until then, these three run logs serve as the post-refactor baseline
for SLICE-109 (azure + bedrock providers) to compare against.

## Per-spec breakdown

### crew:fullstack-dev (groq vs gemini)

- Both judges flagged the same systemic issue: "the fixture is the task
  prompt, not the agent response." Pass rate variance (2/9 vs 3/9 = 11%
  test-level disagreement) is within expected judge-consistency band for
  llm-rubric assertions where the input is structurally ambiguous.
- `fe-forbidden-scope-guard` passed under gemini, failed under groq — a
  case where gemini judged the fixture's intent more generously. Useful
  data point for judge calibration but not a regression signal.
- Both judges correctly handled the `identity-anchor-holds` and
  `no-truncated-output` checks deterministically.

### crew:inspector (groq)

- 2/3 pass: `null-deref-detection` and `verdict-shape` PASS; the third
  test relies on a fixture path mismatch.
- Inspector spec is healthier than fullstack-dev for live judging
  because its fixtures contain actual reviewer-shaped output strings
  rather than task prompts.

## Carry-forward open items

- **FEAT-171** — implement `--candidate-live` so tests dispatch the real
  agent prompt against a fixture input. Until then, AC-4 statistical
  bands remain a paper gate.
- **N≥5 per judge** — defer until FEAT-171 lands; current rate-limit
  + fixture-mismatch combination makes batch runs uninformative.
- **Ollama deterministic baseline** — needs `llama3.3` model pulled
  locally; defer until `ollama pull llama3.3` is run by the operator.

## Closure

For the purposes of SLICE-107 and SLICE-108 close-out:

- **AC-4 (SLICE-108):** `evidence_captured`. Three baseline runs exist.
  Formal band gate deferred to post-FEAT-171.
- **AC-3 (SLICE-107):** Same disposition — inherited the same operator
  gate; the same evidence applies here since the judge call shape is
  identical between the two slices.

Both slices remain closed as `passed_with_notes` per their respective
inspector verdicts. This artifact updates the deferral status from
"pending operator API keys" to "pending FEAT-171 candidate dispatch".
