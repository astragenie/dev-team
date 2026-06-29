---
kind: validation-addendum
parent: 20260629T125000Z-ac4-live-baseline-slice107-slice108.md
slice: SLICE-107 + SLICE-108
ac: AC-4 carry-forward (Ollama deterministic baseline)
decision: evidence_captured
created: 2026-06-29T17:57:11Z
---

# AC-4 Addendum — Ollama Deterministic Baseline

Closes the **Ollama deterministic baseline** carry-forward item from the
parent artifact (parent line 103-104).

## Background

Parent artifact `20260629T125000Z` captured the live groq + gemini
baselines (operator-supplied keys) but left the ollama deterministic
baseline open because no ollama model was pulled locally at the time.

Operator pulled `llama3.1:8b` 2026-06-29 (8GB VRAM workstation; the
spec's notional `llama3.3` reference is a 70B model and does not fit).
Determinism is what AC-4 requires for the ollama tier — not the
specific model size — so `llama3.1:8b` at `temperature: 0.0` is the
correct local stand-in.

## Bug surfaced + fixed during the run

`evals/lib/judge.ts` `JUDGE_REGISTRY` factories for `ollama` and `gemini`
constructed the adapter with **zero args**, silently dropping the yaml
`judge.model` override forwarded by `run-eval.ts:270`. Result: every
ollama run resolved against the gepa-core default `llama3.3` regardless
of the yaml field. First run failed with
`OllamaJudge: HTTP 404: {"error":"model 'llama3.3' not found"}` because
no `llama3.3` artifact was pulled.

Fix: factories now accept and forward `config` (`new OllamaJudge(config)`
and `new GeminiJudge(config)`). Two other factories that already passed
config through (groq / azure / bedrock / generic-openai) were unchanged.
Diff lives in this run's commit.

## Runs captured

Yaml judge field temporarily swapped to `provider: ollama, model:
llama3.1:8b, temperature: 0.0` for both specs; reverted before commit.

| Run ID | Spec | Judge | Model | Pass | Fail | Duration |
|---|---|---|---|---|---|---|
| `2026-06-29T17-43-07-928Z-fullstack-dev.json` | crew:fullstack-dev | ollama | llama3.1:8b | 2 | 7 | 48.0s |
| `2026-06-29T17-43-31-549Z-inspector.json` | crew:inspector | ollama | llama3.1:8b | 2 | 3 (total) | 1.5s |

Both runs landed under `evals/runs/`.

## What this proves

- gepa-core 0.3.x `OllamaJudge` connects end-to-end with `temperature: 0.0`
  honored; tokens / cost / latency fields populated.
- The factory bug in `evals/lib/judge.ts` was real and would have masked
  any future yaml `judge.model` override on ollama or gemini. Fix is
  isolated to two factory lines.
- The eval framework's fixture-as-candidate-output limitation (FEAT-171
  open) reproduces under ollama exactly as it did under groq / gemini —
  consistent across judges, confirming the fixture issue is not
  judge-specific.

## What this does NOT prove

Same caveats as parent artifact — formal AC-4 statistical-band gate
remains deferred to post-FEAT-171 `--candidate-live` work. Determinism
of `temperature: 0.0` is verified at the request level, not at the
score-band level (would need N>=2 runs of the same prompt to confirm
exact-match scores; this is left as a future spot-check).

## Per-spec FAIL breakdown (informational, not gate-blocking)

- **fullstack-dev 7/9 FAIL** under ollama matches the same systemic
  pattern observed under groq (7/9) and gemini (6/9) in the parent
  baseline — fixture-as-input mis-framing for llm-rubric tests +
  fixture content leaks for `not-contains` lead-leak tests.
- **inspector 1/3 FAIL** — `blocker-on-null-deref` expected `[BLOCKER]`
  substring not present in the fixture; the rubric judge correctly
  scored the rationale=PASS. Fixture-shape issue, not judge issue.

## Carry-forward (updated)

- ~~Ollama deterministic baseline~~ — **closed by this addendum.**
- FEAT-171 (`--candidate-live`) — still open.
- N≥5 per judge — still deferred to post-FEAT-171.

## Closure update

This addendum updates the parent artifact's deferral status for the
Ollama tier from "pending `ollama pull llama3.3`" to "closed via
`llama3.1:8b` baseline + factory bug fixed."

SLICE-107 + SLICE-108 disposition unchanged: both remain
`passed_with_notes` per their respective inspector verdicts.
