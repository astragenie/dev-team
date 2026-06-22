---
name: code-investigation
prompt_id: code-investigation
version: 1.0.0
tier: workflow
description: Structured codebase investigation — clarity gate, sub-question briefs, evidence grading, hypothesis grids, and stack-specific first-check lists for C#/.NET, TypeScript/React, and plugin internals. Use when dispatched to trace behavior, find root cause, compare options, or run spec pre-flight research.
source: davila7/claude-code-templates/cli-tool/components/agents/{deep-research-team,expert-advisors}
source_version: 2026-06-10
last_reviewed: 2026-06-10
owner: hero-crew
triggers: investigate, trace, root cause, where is, what calls, impact analysis, option analysis, spec pre-flight, dependency question, code reading, evidence
---

# Code Investigation

Methodology for read-only codebase investigation. The output of an investigation
is a decision input — its value is measured by whether the dispatcher, architect, or
builder can act on it without re-verifying, not by how much ground it covers.

## When to Use

- Dispatched as researcher to trace behavior, dependencies, or architecture.
- Root-cause evidence gathering before `/crew:fix` dispatches a builder.
- Option analysis (library, approach, or design comparison) feeding a decision.
- Spec pre-flight: findings feeding `/crew:architect-feature`'s contracts artifact.

Not for: editing code (builder), judging a diff (reviewer), running scenarios
(validator), or pure web research with no repo component (research-coordination).

## Phase 1 — Clarity gate

A question is investigable when it names the **subject**, the **unknown**, and
the **decision it feeds**. Test: can you state what evidence would settle it?

- Clear ("which DI lifetime does the cache service use, and is it captured by a singleton?") → proceed.
- Vague ("audit performance") → return 1–3 clarifying questions: which layer, what baseline, what is out of scope. Do not guess at scope; a wrong guess burns the whole turn budget.

## Phase 2 — Investigation brief

Before the first Grep, decompose into a short brief (3–6 lines, in your head or
the handoff draft):

- **Main question** restated in one sentence.
- **Sub-questions** (2–5): independently answerable pieces.
- **Search terms**: identifiers, route paths, error strings — plus exclusions.
- **Scope bounds**: which modules are in; which are explicitly out.
- **Done test**: what answered-state looks like.

Findings outside scope get one line in `--risks` as a flagged gap — not a detour.

## Phase 3 — Evidence ladder

Grade every factual claim; carry the grade into the handoff:

| Grade              | Meaning                         | Citation                                                     |
| ------------------ | ------------------------------- | ------------------------------------------------------------ |
| `verified-in-code` | You read the live code          | file:line + short quote                                      |
| `test-confirmed`   | A test asserts it               | test file:line                                               |
| `doc-claimed`      | README / comment / docs say so  | doc location — verify against live code before relying on it |
| `inferred`         | Reasoned from adjacent evidence | the evidence chain, labeled as inference                     |

Rules:

- Trace claims to their primary source: bug report → changelog → comment → the
  actual implementation line. Cite the end of the chain, not the middle.
- Conflicting evidence (doc says X, code does Y) is itself a finding — report
  both sides with citations; do not silently pick one.
- `UNVERIFIED` / "not found" is a valid answer. Report what was checked and
  return `--confidence low`. Never stretch thin evidence into a conclusion.

## Phase 4 — Output by mode

### Root cause (bugs, intermittent failures)

Hypothesis grid; disproven rows stay in (they save the next investigator):

| Hypothesis | Likelihood | Evidence for | Evidence against | How to verify |
| ---------- | ---------- | ------------ | ---------------- | ------------- |

Each verification method must be executable without code changes (log, trace,
targeted test run). Note whether similar defects likely exist elsewhere.

### Option analysis (library / approach comparison)

Trade-off matrix over decision-relevant criteria (coupling, performance,
testability, maintenance status, migration cost) plus a **long-term risk**
column. End with ONE explicit recommendation and the condition under which it
flips. Verify library versions against the lockfile/csproj, not memory — use
context7 / microsoft-docs per the routing table.

### Spec pre-flight (`/crew:architect-feature`)

Structured blocks, each cited, using real type names, route paths, field names:

- `FINDING` — what is true in the codebase today.
- `CONSTRAINT` — what limits solution shape (dependency, architecture, compat).
- `EDGE CASE` — scenarios a naive implementation would miss.
- `DEPENDENCY` — what must exist/be available before implementation.
- `NFR` — performance, security, compliance implications observed.

Close with **Open questions** — unknowns that block the spec, distinct from
nice-to-knows.

## Stack first-checks

Load only the reference matching the code under investigation:

- C#/.NET → `references/csharp.md` (TFMs, nullability context, sync-over-async, DI lifetimes, CancellationToken propagation)
- TypeScript/React → `references/typescript-react.md` (tsconfig strictness, assertion escapes, ref-identity re-renders, hook deps)
- Claude Code plugin internals → `references/plugin-dev.md` (manifest, frontmatter triggers, routing consistency, skill tiers)
- Spec-driven pipeline → `references/spec-driven.md` (spec-readiness rubric for pre-flight output)

## Stop when

- Every sub-question in the brief is answered at `doc-claimed` grade or better,
  or explicitly marked `UNVERIFIED` with what was checked.
- New reads stop changing the recommended action.
- The grid/matrix/blocks for the active mode are complete and cited.

Past that point, write the handoff with `--risks` naming any residual gap. The
the dispatcher can re-dispatch for the gap if it matters — another N turns of marginal
detail cannot be un-spent.
