---
id: FEAT-188
status: done
priority: P1
category: platform
target_release: v0.54.0
created: 2026-07-04
depends_on: []
slices: [S1a, S1b, S2, S3a, S3b, S4, S5, S6]
derived_from: docs/superpowers/specs/2026-07-04-memory-provider-plan.md
pm_customer_impact: 0.85
pm_effort_estimate: 0.65
pm_strategic_alignment: 0.85
pm_technical_risk: 0.5
pm_dependency_depth: 0.3
composite_score: 0.7
autonomous_safe: false
tags: ["stack:typescript", "surface:plugin", "concern:memory", "concern:dispatch"]
triage_notes: "Free-text intake 2026-07-04 (PM-scored at intake, FEAT-277 mode). Architecture review §15 found the capture/recall loop broken at every stage: learnings.jsonl stale since 2026-06-11 (zero capture through the entire GEPA cluster), 27% of 78 grade files are unfilled placeholders, 21% all-zero scores, and 2 of runner:lessons-recent's already-shipping top-5 digest entries are placeholder noise today. P1 reflects user-flagged importance plus quantified, already-materializing operational damage balanced against real multi-slice effort. autonomous_safe=false because S3 touches dispatch prompts across every builder/reviewer/verifier gate; S1/S2/S4/S5 could individually qualify as safe but the FEAT is gated as a whole."
started_at: 2026-07-06
updated: 2026-07-07
slices_landed_dev_team: [S1a, S2, S3a, S4, S5, S6]
slices_remaining: []  # dev-team scope complete; S1b shipped runner-plugin f2803af9 (#361); S3b re-homed to runner-plugin#368 + dev-team FEAT-195
closed: 2026-07-08
closure: "dev-team scope complete (S1a/S2/S3a/S4/S5/S6 merged, v0.54.0). Cross-repo remainder S3b re-homed to runner-plugin#368 + tracked in dev-team FEAT-195; S1b already shipped runner-plugin f2803af9 (#361). Split-close: FEAT-188 closes on dev-team deliverable; runner-plugin S3b closes independently."
revision: "2026-07-06 rev2 — reconciled against runner-plugin's existing memory-bridge + astramem plugin v0.6 (3-agent research fan-out + architect review). See docs/research/2026-07-06-memory-bridge-reconciliation.md."
---

## Progress note (2026-07-07 — S5 landed)

**dev-team side is now complete: S1a, S2, S3a, S4, S5, S6 are all merged to
main.** S5 (eval interaction + memory hygiene) merged at `79bc2e44` (`Merge
FEAT-188 S5 — eval interaction + memory hygiene`), closing the S4
astramem<->JSONL drift/completeness gap (`scripts/lib/memory/drift-check.ts`),
the S2 tail-read MEDIUM note (`file-provider.ts`, 64KB → 16MB/unbounded
window), 45-day recall decay with critical-exempt (`ranking.ts`), and the
with/without-memory GEPA judge-score-delta fixture (`evals/memory-delta.ts`,
`--live` gated per the SLICE-107/FEAT-184 AC-3 pattern). Independent review:
approved_with_notes
(`.claude/artifacts/crew/reviews/20260707T075143Z-review-result-feat-188-s5-review.md`).
Full suite green on merged main: 1715 pass / 0 fail / 117 skip; lint clean.
Slice-close ceremony run retroactively — see
`.claude/artifacts/loop/slices/completed/FEAT-188-S5_eval-interaction-memory-hygiene.md`,
`.claude/artifacts/loop/grades/20260707T081133Z-feat188s5-grade.md`, and
`.claude/artifacts/crew/runs/20260707T080727Z-final-synthesis-feat-188-s5-eval-interaction-memory-hygiene.md`.

**Closed 2026-07-08 (split-close).** dev-team scope is complete — all six
dev-team slices merged to main and shipping in **v0.54.0**. S1b already shipped
runner-plugin `f2803af9` (#361). The last cross-repo slice **S3b is re-homed**
to **runner-plugin#368** (actionable spec) + dev-team **FEAT-195** (dev-team-side
tracking) so it closes on runner-plugin's own cadence rather than holding this
FEAT open. FEAT-188 closes on the dev-team deliverable.

**Follow-up (deferred, non-blocking):** `evals/memory-delta.ts`'s live-judge
AC needs an operator to run `bun evals/memory-delta.ts --live` with a judge
credential (e.g. `GROQ_API_KEY`) to capture the actual measured delta —
tracked the same way as the FEAT-184/SLICE-107 AC-3 deferral.
# FEAT-188: MemoryProvider — capture/recall learning loop

## Revision note (2026-07-06 rev2 — READ FIRST)

Original plan assumed a greenfield MemoryProvider mirroring gepa-core's TrialStore.
Reconciliation (3-agent research + architect review, `docs/research/2026-07-06-memory-bridge-reconciliation.md`)
found **~60-65% of the capture+recall+astramem transport already exists** in
runner-plugin's `memory-bridge.mts` / `memory-recall.mts` — dormant only on a STALE
premise. Corrections baked into this revision:

1. **astramem is LIVE at plugin v0.6** (`C:\work\mega\astramemory-plugin`). The bridge's
   "dormant until v0.4" is wrong (runner-plugin#324). **Interface = astramem plugin
   commands `/astramem:remember` / `/astramem:recall` (or MCP tools), NOT the raw CLI** —
   the plugin's provider selector routes SaaS-or-local. Do NOT shell `resolveCli()`.
   Memory `astramem-live-v06-interface`.
2. **Store-of-truth (operator decision):** astramem DB is the **single source of truth**
   for lessons/failures, viewable in its SaaS dashboard ("runner web"). The GEPA trial
   JSONL is a **derived duplicate**. Operator accepts **2 parallel providers now**
   (astramem + JSONL dual-write), converging to astramem-only once gepa-core ships an
   `astramemStore` (today gepa-core has ONLY `fileStore`; `astramemStore` is an unbuilt
   config enum — so the JSONL stays). Memory `prompt-improvement-corpus-architecture`.
3. **Config collision must be resolved before S2** — see unified schema below.
4. **SLICE-109 is a placeholder blob** covering S1-S5 — decompose into the slices below
   before any dispatch (architect review, blocking).

## Description

Make agents aware of recent failures, lessons, and decisions at dispatch time, and make
the capture that feeds that recall actually fire (it is broken today: `learnings.jsonl`
stale, 27% grade-placeholder rot). This is the capture+recall INFRA; FEAT-193 (GEPA
consumption) rides on top and is not collapsed into it (the bridge writes to astramem,
never to the GEPA trial store — verified).

## Unified config schema (mandatory — resolves the collision)

Both the live bridge and the original FEAT-188 draft target top-level `memory` in the
same `.claude/loop.json`. Merge, do not duplicate:

```json
{
  "memory": {
    "enabled": "auto",        // KEEP (bridge) — gates emit/recall active
    "provider": "astramem",   // NEW — backend: none|file|astramem (orthogonal to enabled)
    "dualWrite": true,        // NEW — when provider=astramem, ALSO append to the local JSONL duplicate (operator's "2 parallel providers"; astramem = source of truth, JSONL = derived). Ignored for provider=file|none.
    "project": "dev-team",    // KEEP (bridge) — cortex project (never featId; DEC-065/066)
    "recall": {
      "enabled": true,        // KEEP (bridge) — shared kill-switch
      "k": 5,                 // KEEP bridge name (FEAT-188 draft's `topK` → `k`)
      "timeoutMs": 5000,      // KEEP (bridge)
      "maxTokens": 800        // NEW — additive
    },
    "capture": { "events": ["slice_close","review_fail","validation_fail","inline_return_warn","subagent_incomplete","incident_close"] }  // NEW, additive
  }
}
```
S2's Zod parser MUST read `recall.k` (not `topK`), MUST NOT repurpose `enabled`, and MUST
tolerate the bridge's existing keys (not hard-error them).

## Slices (decomposed — replaces the SLICE-109 blob)

- **S1a — Capture repair (dev-team, net-new, no astramem dependency, BUILD FIRST):**
  extend `validate-syntheses.ts` placeholder rejection to grade files; auto-capture a
  `failure` entry on review-FAIL / validation-FAIL artifact writes (`scripts/crew.ts`
  write paths) AND on `inline_return_warn` (`hooks/lib/check-subagent-return.ts`) and
  `subagent_incomplete`; point `docs/decisions/README.md` at `.claude/artifacts/loop/decisions/`.
  Carries standalone value; works today independent of astramem/v0.6.
- **S1b — Capture repair (runner-plugin, cross-repo):** `runner:close` lessons/surprises
  capture, `runner:pr-fix` circuit-breaker trips, retrospective-decision capture. Must be
  built in a runner-plugin session/worktree. ∥ S1a (disjoint repos).
- **S2 — MemoryProvider interface + noop/file providers:** `scripts/lib/memory/` (dev-team convention — NOT a new `src/` dir; extend S1a's `scripts/lib/memory/capture-learning.ts`) — Zod entry
  schema (kind/severity/tags/summary≤280/provenance/supersedes), `MemoryProvider` interface,
  atomic O_APPEND JSONL, legacy `learnings.jsonl` adapter, the **unified config parser above**.
  `learnings.mts` already ≈ fileProvider — wrap/consolidate, don't reinvent.
- **S3a — Recall injection (dev-team sites):** one injection helper + wiring into
  `/crew:build`, `/crew:fix`, `/crew:ship` retries, `orchestrate-slice`, and the plan
  generator's output shape (`dispatch.mts` is a pure plan generator — extend its emitted
  shape to carry a memory block; the runtime consumer applies it). Reconcile format with
  the bridge's existing `## Prior context (from astramem)` block — extend, don't fork.
- **S3b — Recall injection (runner-plugin sites):** wave runner + confirm the vendored
  consumer applies S3a's memory field at the live dispatch call. **Retire the bridge's own
  `runRecallHook` at slice-start** and route it through the unified helper (else that site
  double-injects). ∥ S3a once the helper interface stabilizes.
- **S4 — astramemProvider (via plugin/MCP, NOT resolveCli):** implement `astramemProvider`
  over the astramem **plugin commands / MCP tools** (`/astramem:remember`, `/astramem:recall`,
  or `search_memory`/`recall_memory`/`remember`) — the provider selector routes SaaS-or-local.
  Do NOT wrap the bridge's CLI-shelling `resolveCli()` (stale, runner-plugin#324).
  **This is the source-of-truth writer.** Contract-parity test vs fileProvider (the dual-write duplicate).
- **S6 — Deliberate-`remember` enforcement (dev-team, prompt/skill):** make good memories
  get *written on purpose* rather than left to the auto-distiller (which emits low-signal
  fragments — status snapshots, git trivia, vacuous negatives; see distiller-quality tickets
  astramem-local#119 / astragenie/memory#659 / astramem-plugin#28). Add a slice-close
  `remember` step to the dispatcher close ceremony (`document-writer` slice-close path /
  `runner:close`) that captures the slice's load-bearing decision/lesson in the **durable
  shape** (why + how-to-apply + `{project, repo, agent, importance, confidence}`), and
  tighten `skills/universal/memory-keeper/SKILL.md` to require that shape + recall-before-deciding
  at real decision points. Complements B (daemon-side gate): A ensures signal is *produced*
  well; B stops the distiller from *polluting*. Prompt/skill only — no runtime store change.
  `autonomous_safe: false` (dispatch/skill prompt edits → human-in-loop review).
- **S5 — Eval interaction + hygiene:** capture-parity golden test (incl. SIGKILL),
  with/without-memory GEPA judge-score-delta fixture, 45-day decay (except critical),
  superseded/invalidated never recalled. **Also (S2 review MEDIUM note):** `fileProvider.recall()`
  reads only the last 64KB of `learnings.jsonl` (`tailReadJsonl` default window) — accepted-risk
  in S2, but S5 must either raise/override the window or add full-file ranking so `recall()`
  cannot silently miss entries older than the tail in a large store. (Mirrors the S4 dual-write drift note.)

## Acceptance criteria

### S1a — Capture repair (dev-team)
- GIVEN a grade file contains the literal placeholder `"- bullet"` or an unfilled AC, WHEN `validate-syntheses.ts` runs, THEN it is rejected (or `runner:close` flags `grade_incomplete`) and the slice cannot close silently.
- GIVEN a review-FAIL / needs_fix or validation-FAIL artifact is written (`scripts/crew.ts`), WHEN the write completes, THEN a `failure`-kind entry is captured with agent, severity, and summary derived from the verdict.
- GIVEN the EXISTING `inline-return-warn` signal fires (`hooks/lib/check-subagent-return.ts` emits `subagent-return:inline-return-warn` — note hyphenated name, not `inline_return_warn`), WHEN it fires, THEN a `failure`-kind entry is captured. (Wire capture onto the existing event.)
- GIVEN a subagent returns without a terminal state (no completion artifact / dirty worktree), WHEN detected, THEN a NEW `subagent_incomplete` signal is **defined and emitted** (it does not exist today — grep-confirmed; S1a owns creating it, not just capturing it) and a `failure`-kind entry is captured. Overlaps issue #162 Fix A (idle-without-terminal-state) — coordinate, do not build a second detector. FEAT-193 S1 depends on both signals existing.
- GIVEN `docs/decisions/README.md` is read, WHEN a contributor looks for the decision log, THEN it points at `.claude/artifacts/loop/decisions/`.
- GIVEN astramem is unpaired/absent, WHEN S1a capture fires, THEN it degrades to the local provider without error (no hard dependency on astramem being live).

### S1b — Capture repair (runner-plugin, cross-repo)
- GIVEN a slice closes via `runner:close` with non-empty lessons/surprises, WHEN the ceremony completes, THEN a learnings entry is auto-appended with zero operator action.
- GIVEN a `runner:pr-fix` circuit-breaker trip or a retrospective decision, WHEN each completes, THEN a corresponding entry is captured.

### S2 — MemoryProvider interface + noop/file
- GIVEN `.claude/loop.json` has no `memory` block, WHEN any provider is constructed, THEN `noopProvider` is selected and dispatch output is byte-identical to pre-S2 (golden test).
- GIVEN the unified schema above, WHEN config is parsed, THEN the bridge's existing keys (`enabled`, `recall.k`, `recall.timeoutMs`, `project`) are accepted and `recall.topK` is NOT a recognized key; an unknown `provider` value is a hard error.
- GIVEN the `enabled` × `provider` matrix, WHEN resolved, THEN precedence is explicit: `provider: "none"` forces effective-disabled regardless of `enabled` (no capture, no recall); `enabled: "never"` disables emit/recall regardless of `provider`; `provider: "file"|"astramem"` with `enabled: "auto"` is active. (Two-switch ambiguity resolved — documented, unit-tested.)
- GIVEN `provider: "astramem"` AND `dualWrite: true`, WHEN an entry is captured, THEN it is written to astramem (source of truth) AND appended to the local JSONL duplicate; GIVEN `dualWrite: false` or `provider: "file"`, THEN only the single store is written. The dual-write fan-out is best-effort per store — see the drift note in S4.
- GIVEN `provider: "file"`, WHEN entries are captured concurrently, THEN writes are atomic (O_APPEND) and torn lines discarded on read.
- GIVEN the legacy `learnings.jsonl`, WHEN `fileProvider.recall()` runs, THEN those entries are included via the adapter.
- GIVEN mixed recency/severity entries, WHEN `recall()` is called, THEN ranking is recency × severity with token-budget truncation + supersede-chain resolution (unit tests).

### S3a / S3b — Recall injection
- GIVEN any dispatch-assembly site builds an instruction with memory configured, WHEN assembled, THEN a recall block is injected (one line per entry, scoped by agent/tags, ≤ `recall.maxTokens`), reusing/extending the bridge's existing block format — not a second parallel format.
- GIVEN `provider: none` or `recall.enabled: false`, WHEN assembled, THEN output is byte-identical to today (golden dispatch-trace test).
- GIVEN S3b ships, WHEN a slice starts, THEN recall is injected exactly once (the bridge's own `runRecallHook` is retired/routed through the unified helper — no double-injection).
- GIVEN a new dispatch-assembly path added without the helper, WHEN the completeness fitness test runs, THEN it fails.

### S4 — astramemProvider (plugin/MCP)
- GIVEN a paired astramem provider (v0.6), WHEN `provider: "astramem"` and an entry is captured, THEN it is written via the plugin command / MCP tool (`remember`), NOT a shelled `resolveCli()` binary, and the provider selector routes SaaS-or-local transparently.
- GIVEN astramem is unpaired, WHEN `provider: "astramem"` resolves, THEN it falls back to `fileProvider` without error.
- GIVEN the same entry set in `fileProvider` and `astramemProvider`, WHEN `recall()` runs with identical params, THEN ranking + token-truncation match (contract-parity test).
- GIVEN a capture with `provider: "astramem"` AND `dualWrite: true`, WHEN it fires, THEN the entry lands in BOTH astramem (source of truth) and the local JSONL (derived duplicate) — the operator's "2 parallel providers" mode.
- **Accepted-risk + drift note (architect Q4):** astramem writes are fire-and-forget (errors logged, not propagated); the JSONL append is synchronous/atomic. So a silent astramem failure can leave the "derived duplicate" MORE complete than the "source of truth." This is an ACCEPTED best-effort-MVP risk for now. S5 MUST add a drift-detection/backfill check (compare JSONL entries not present in astramem over a window) so the SoT can be reconciled; until then, treat the JSONL as the completeness fallback, not astramem alone.
- **S4 transport (resolved — option c):** import the provider layer from `@astragenie/astramem-plugin` (`./providers/local`, `./providers/saas` — exports map added in astramem-plugin#23) and route through its provider selector. Do NOT shell the CLI, do NOT hand-roll an MCP client. Add the dependency in S4 (file/workspace/npm per the release path). Blocked until #23 merges + a version is consumable.
- **DEC (dev-team#172, 2026-07-06) — single astramem transport = plugin/MCP.** All FEAT-188 astramem access (capture + recall, BOTH repos) standardizes on the astramem **plugin provider layer / local MCP tools** (`remember`, `recall_memory`, `search_memory`, `get_health`). The two alternatives are **retired**: (a) CLI-shell to `bin/astramem` via `resolveCli()` (stale — runner-plugin#324); (b) a reimplemented in-process HTTP client. This supersedes any earlier framing that *allowed* CLI-shell / hand-rolled HTTP. Rationale + evidence in dev-team#172. Compliance status: dev-team S4 production already imports the plugin provider layer (aligned); the #170 fix removed the in-process `http.Server` from tests (in-memory fake via `__resolveRemote` seam — aligned with "no per-test fake daemon"); runner-plugin S1b/S3b (#357/#358) already framed MCP-only.

### S5 — Eval interaction + hygiene
- GIVEN the capture-parity golden test incl. a SIGKILL case, WHEN a capture is issued, THEN it is captured or safely dropped without corruption.
- GIVEN one GEPA v1 agent's eval fixture run with vs without the injected memory block, WHEN judge scores are compared, THEN the delta is measured and reported.
- GIVEN an entry older than 45 days and not `critical`, WHEN `recall()` runs, THEN it is excluded; GIVEN superseded/invalidated, THEN never returned regardless of age.

### S6 — Deliberate-`remember` enforcement (dev-team, prompt/skill)
- GIVEN a slice closes (dispatcher close ceremony / `runner:close`), WHEN the ceremony runs, THEN it captures the slice's key decision/lesson via a deliberate `remember` in the durable shape — `type ∈ {decision, lesson, fact}`, non-empty *why* AND *how-to-apply*, `metadata {project, repo, agent, importance, confidence}` — instead of relying on the auto-distiller.
- GIVEN an agent makes a constraining decision or fixes a non-obvious error mid-slice, WHEN it resolves, THEN `memory-keeper` directs a durable `remember`, and `recall`-before-deciding is invoked at task start (recall → act → record loop).
- GIVEN a memory written via the enforced path, WHEN inspected, THEN it is distinguishable from a distiller fragment: carries why + how-to-apply and `importance ≥ 0.6` (not an ephemeral status snapshot / git-derivable fact / bare todo).
- GIVEN the enforcement wording is added to `memory-keeper/SKILL.md` + the dispatcher slice-close path, WHEN `validate-skills.ts` / `validate-agents.ts` run, THEN they pass (tier/description/≤line-cap intact) — pure prompt/skill change, no source or config-runtime edit.
- GIVEN astramem is unpaired/absent, WHEN the enforced `remember` fires, THEN it degrades to the local provider without error (consistent with S1a/S4).
- GIVEN the distiller-quality gate (B: astramem-local#119) is NOT yet shipped, WHEN S6 lands, THEN good memories are still produced (A is independent of B — A improves the signal source, B stops pollution; neither blocks the other).

## Dependency order

S1a ∥ S1b (disjoint repos) → S2 → S3a ∥ S3b → S4 ∥ S5. **S6 ∥ S3a/S3b/S4/S5** — independent of the provider/transport work (prompt/skill only; depends only on S1a's capture + astramem MCP being reachable, both true today). FEAT-193 depends on **S1a** specifically (the capture events), not S1b.

## Refs

- `docs/research/2026-07-06-memory-bridge-reconciliation.md` — the reconciliation this rev is built on.
- memory `astramem-live-v06-interface`, `prompt-improvement-corpus-architecture`.
- runner-plugin#324 (bridge staleness), #322 (AC-deriver).
- `docs/superpowers/specs/2026-07-04-memory-provider-plan.md` — original design (pre-reconciliation).
- runner-plugin `memory-bridge.mts` / `memory-recall.mts` / `memory-sink.mts` / `learnings.mts` — existing infra to reconcile with, not reinvent.
