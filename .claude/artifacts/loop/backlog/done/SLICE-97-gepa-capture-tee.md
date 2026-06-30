---
id: SLICE-97
parent: FEAT-183
status: triaged
priority: P1
created: 2026-06-27
title: "FEAT-183 S2 — gepa.config.json loader + gepaCapture() tee in fullstack-dev artifact writers + /crew:gepa-history + parity tests + capture-perf bench"
stack: typescript + markdown
autonomous_safe: false
est_days: 2
depends_on: [SLICE-96]
touches_files:
  - gepa.config.json
  - scripts/lib/gepa/load-config.ts
  - scripts/lib/gepa/capture-tee.ts
  - scripts/lib/artifact-writer.ts
  - commands/gepa-history.md
  - scripts/crew.ts
  - scripts/validate-agents.ts
  - tests/gepa/capture-parity.test.ts
  - tests/gepa/capture-perf.test.ts
  - tests/gepa/capture-absent-parity.test.ts
  - tests/gepa/gepa-history.test.ts
  - tests/fixtures/gepa/sample-config.json
  - .gitignore
  - package.json
---

# SLICE-97: FEAT-183 S2 — capture tee + gepa-history + parity tests

## Scope

Wire the crew side of Phase 1 (Capture):

- Add `@astragenie/gepa-core` as a dependency in `package.json` (pinned `^MAJOR.MINOR` per design spec invariant).
- `scripts/lib/gepa/load-config.ts` — reads `gepa.config.json` at repo root, validates via `GepaConfigSchema.parse()`, returns the typed config OR returns `null` if file absent (capture disabled by absence). Honors runtime override `capture.enabled: false`.
- `scripts/lib/gepa/capture-tee.ts` — wraps `gepaCapture()` from the library; called by `scripts/lib/artifact-writer.ts` after every artifact write under `.claude/artifacts/crew/{runs,handoffs,reviews,validations}/` for `crew:fullstack-dev` dispatches only (other agents wait for S5c). Bounded by `capture.walltime_ms` (default 2000 ms) via `Promise.race`. Fail-silent: walltime miss = log `gepa_capture_drop` to `.claude/logs/events.jsonl`, drop trial, dispatch continues. No exception escapes.
- `commands/gepa-history.md` + new `/crew:gepa-history <agent>` CLI subcommand wired in `scripts/crew.ts` — prints last N trials sorted by `created_at` descending; supports `--source eval|captured|soak` filter and `--limit N`.
- `scripts/validate-agents.ts` taught to: (1) skip `.gepa/` subdirs when enumerating agent files; (2) exempt the `gepa:` YAML frontmatter block from the ≤350-line cap on agent prompts.
- Add `.claude/artifacts/crew/gepa/locks/` and `.claude/artifacts/crew/gepa/candidates/` to `.gitignore`. Trials, eval, opt, and soak artifacts ARE committed (durable history per repo policy).
- Three new test files: `capture-parity.test.ts` (byte-diff with/without capture), `capture-perf.test.ts` (p50/p99/max latency bench), `capture-absent-parity.test.ts` (no `gepa.config.json` = zero side effects).

## Acceptance criteria

AC-1: Given `gepa.config.json` is absent from the repo root, When `/crew:build` dispatches `crew:fullstack-dev` and the dispatch writes its artifacts, Then no files appear under `.claude/artifacts/crew/gepa/`, no events with prefix `gepa_` appear in `.claude/logs/events.jsonl`, and `tests/gepa/capture-absent-parity.test.ts` passes by diffing the artifact tree against a control run captured before this slice landed.

AC-2: Given `gepa.config.json` with `capture.enabled: true` and `storage.backend: "file"`, When `/crew:build` dispatches `crew:fullstack-dev` and the dispatch completes successfully, Then within `capture.walltime_ms` (default 2000 ms) a JSONL line appears in `.claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl` that parses cleanly via `TrialSchema.parse()` with `source: "captured"`, `agent: "fullstack-dev"`, and `candidate_prompt_hash` equal to `sha256(agents/fullstack-dev.md)`.

AC-3: Given a scorer mock that sleeps 5 seconds (exceeds the 2000 ms walltime), When the capture tee races against the walltime in `capture-walltime.test.ts`, Then the dispatch artifact tree is byte-identical to a control run, no trial line is appended to the JSONL, and exactly one `gepa_capture_drop` event is logged to `.claude/logs/events.jsonl` with `trial_id` field present.

AC-4: Given `capture-parity.test.ts` runs two identical dispatches (mocked LLM, same seed) with `gepa.capture.enabled: true` and `gepa.capture.enabled: false` respectively, When the test diffs `.claude/artifacts/crew/{runs,handoffs,reviews,validations}/` excluding the `gepa/` subtree, Then the diff is empty (byte-identical artifacts).

AC-5: Given the SIGKILL-during-`put` case in `capture-parity.test.ts`, When a child process is SIGKILLed mid-`fileStore.put()` (during JSONL append), Then the parent's recovery run reports zero torn lines via `validateTrialCorpus`, the artifact tree under `runs/handoffs/reviews/validations` is byte-identical to a control run, and the trial JSONL either contains the line fully or doesn't contain it at all.

AC-6: Given `capture-perf.test.ts` runs the capture tee 1000 times against a fake artifact under `tmpdir`, When the test computes latency percentiles, Then `p50 ≤ 50 ms`, `p99 ≤ 200 ms`, and `max ≤ 2000 ms` (the walltime cap). Test fails (red CI) if any percentile is breached.

AC-7: Given the `fullstack-dev.jsonl` trial file contains 12 trials, When the operator runs `node scripts/crew.ts gepa-history fullstack-dev --limit 5`, Then stdout lists the 5 most recent trials (by `created_at` desc) one per line in tabular format with columns `trial_id | source | pass | score | cost_usd | latency_ms | created_at`, and exit code is 0.

AC-8: Given an agent prompt file with a 348-line body plus an 8-line `gepa:` YAML frontmatter block (total 356 lines), When `node scripts/validate-agents.ts` runs, Then validation passes (without exemption it would fail with `prompt exceeds 350-line cap`); given an agent prompt with a 360-line body and no frontmatter, validation still fails as expected.

AC-9: Given `agents/fullstack-dev/.gepa/eval/sample.jsonl` and `agents/fullstack-dev/.gepa/rubric.md` exist, When `node scripts/validate-agents.ts` enumerates agent files, Then the `.gepa/` subdir contents are NOT counted as agents and the validator exits 0.

AC-10: Given `gepa.config.json` declares `capture.exclude: ["inspector"]`, When `/crew:build` dispatches `crew:inspector` (post-S5c when inspector capture is wired), Then no trial is written for that dispatch and no `gepa_capture_drop` event is emitted (capture skipped entirely, not raced).

## Dependencies

- SLICE-96 must be complete and the `@astragenie/gepa-core` package must be installable (either via npm registry after S1 release, or via a local file path / npm pack during integration).

## Risks

- Capture latency budget (p50 ≤ 50 ms, p99 ≤ 200 ms) may be hard to hit on Windows CI runners with slow disk — mitigation: micro-bench runs against `tmpdir` to isolate from project FS noise.
- SIGKILL-during-put test is OS-dependent (POSIX `kill -9` vs Windows `taskkill /F`) — test must branch on platform.
- `validate-agents.ts` frontmatter-exemption logic must NOT exempt YAML blocks at random positions in the file — only the leading `---...---` document-start frontmatter. Otherwise agents could smuggle extra lines.
- `.gitignore` change must be additive — pre-existing rules for `.claude/state/` etc. must remain.

## References

- Design spec "Capture (Phase 1, every dispatch)" diagram (lines 467–500).
- Design spec "Capture parity invariant" (lines 730–744) — including SIGKILL-during-capture parity case and capture write-path latency budget.
- Design spec "Failure modes" table (lines 678–703) — relevant rows: "Capture tee `store.put()` exceeds 2 s walltime", "Capture tee throws", "Capture tee astramem CLI absent", "Capture tee SIGKILL mid-`put`".
- Design spec "Data location summary" (lines 656–671) — committed vs gitignored paths.
- Design spec "Kill-switches" (lines 705–722) — runtime capture disable, per-agent capture disable.
- Design spec "Implementation notes → S1 — gepa-core bootstrap → Lockfile directory committed vs ephemeral" (line 831).
- Design spec slice plan row S2 (line 858).
- CI integration test names: `capture-tee`, `capture-walltime`, `capture-absent-parity` (lines 785–787).
