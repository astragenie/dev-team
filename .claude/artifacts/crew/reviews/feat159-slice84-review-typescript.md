---
kind: review-result
slice: SLICE-84
reviewer: crew:3rdparty:typescript-reviewer
verdict: APPROVED_WITH_NOTES
---

# TypeScript Quality Review - SLICE-84 (FEAT-159 Part A)

## Summary

Two MEDIUM findings and two LOW findings. No HIGH or CRITICAL issues. The exported
contract is structurally sound and future-extensible. The main concern worth tracking
before follow-up consumer slices land: verbatimModuleSyntax is disabled in tsconfig.json,
so type-only import discipline is unenforced by the compiler. Three as-casts in the
aggregator are individually justified but lack inline comments per convention.

---

## Findings
[MEDIUM] tsconfig.json:17 - verbatimModuleSyntax: false disables type-import enforcement

Risk: Violates the repo declared compiler baseline (ts-conventions skill: non-negotiable).
Authors of follow-up consumer slices who omit the type modifier on imports of AgentStatsRow
and WindowSpec will receive no diagnostic. Type-only re-exports can also bloat bundles if a
bundler later processes these files.

Fix: Enable verbatimModuleSyntax: true in tsconfig.json. The new files already use correct
import forms (aggregator line 5: import { type DispatchRow }; test line 23:
import type { WindowSpec }) and will compile cleanly once the flag is enabled. Raise as a
separate follow-up issue if the repo-wide flag change surfaces errors in pre-existing files.
Do not block this slice on it.

---

[MEDIUM] scripts/lib/agent-stats-aggregator.ts:98 - unguarded cast after partial field check

Code: if (g?.slice && g?.graded_at) grades.push(g as unknown as GradeRecord);

The cast asserts the full GradeRecord shape after confirming only that slice and graded_at
are truthy. The scores field (Record<string, number>) is not validated -- the cast would
succeed even if scores were a string or array, silently producing NaN in avgScores().
This violates the no-as-without-prior-runtime-validation rule.

Risk: Malformed grade files produce silently wrong pass_rate and mean values with no error
surfaced. The failure mode is invisible arithmetic corruption, not a thrown error.

Fix: (a) Validate scores shape before cast -- at minimum: typeof g.scores === object --
or (b) replace with Zod safeParse against a GradeRecordSchema (preferred for follow-up
slice). At minimum add an inline justification comment.

---

[LOW] scripts/lib/agent-stats-aggregator.ts:39 - generic as T JSONL cast lacks comment

Code: try { return [JSON.parse(line) as T]; } catch { return []; }

readJsonlFile<T> casts parsed JSON to T without validation. Matches the pre-existing pattern
in dispatch-timing-reader.ts and is acceptable for internal JSONL helpers where callers own
the file format. However the convention requires either a Zod parse or a justifying comment
when reproducing an unguarded cast.

Risk: Low -- callers own the file format; test fixtures exercise the actual shape.
No runtime external boundary is crossed.

Fix: Add a one-line comment: Caller-owned format; Zod validation deferred to boundary consumer.

---

[LOW] scripts/lib/agent-stats-aggregator.ts:188 - as string cast safe but replaceable

Code: .map((a) => a.slice as string)

ArtifactDecision.slice is string | null. The filter guard confirms a.slice is truthy, so the
cast is logically valid. A type-predicate filter eliminates the cast entirely:
  .filter((a): a is ArtifactDecision and { slice: string } =>
    a.slice != null && ws.has(a.slice) && re.test(a.decision))
  .map((a) => a.slice)

Risk: Functionally correct. A future edit to the filter that no longer guarantees non-null
would not produce a type error at the cast site.

Fix: Convert to type-predicate filter. LOW -- current code is correct.
---

## Focus-area verdicts (per dispatch brief)

### 1. WindowSpec discriminated union (line 7)

PASS. { kind: last_n_slices; n: number } is a correct union arm. Adding a last_n_days
variant is a pure additive change -- no existing narrowing will break because windowSlug()
and selectWindow() access w.n structurally, not via a kind-switch. If selectWindow is later
extended for last_n_days, TypeScript will flag unhandled arms. The union is correctly open.

### 2. AgentStatsRow exported contract (lines 9-19)

PASS. All nine fields are required (no ?), all primitive types (string or number). The window
field is string (the slug, not WindowSpec -- intentional per spec). Zero-fill semantics
honoured: computeRow always assigns concrete values (0 as default for empty slices). The
contract is stable for follow-up consumers.

### 3. AggregateOpts test-injection fields (lines 23-31)

APPROVED WITH NOTE. The test-injection fields (dispatchTimingPath, grades, reviewsDir,
validationsDir) exported in the public type are acceptable for test ergonomics in a Node.js
plugin. Design note: if this module gains a public npm consumer, those fields should move to
an internal overload to avoid leaking test seams into the public API.

### 4. exactOptionalPropertyTypes compliance

PASS. All optional fields in AggregateOpts and GradeRecord use ?: consistently. No field
uses field: T | undefined. computeRow returns a fully required object with no optional slots.

### 5. DispatchRow import form (line 5)

PASS. import { type DispatchRow } from ./dispatch-timing-reader.ts uses the inline type
modifier correctly. No runtime value is imported from that module.

### 6. No any

PASS. No unqualified any in agent-stats-aggregator.ts. The three as casts each have a
traceable reason covered under Findings.

### 7. Zod absence on write-only path

PASS FOR THIS SLICE. The aggregator reads internal JSONL files written by the same plugin,
not a user-facing HTTP or form boundary. Zod validation on the read path is deferred per
spec. Known gap: when a future slice exposes the artifact JSON to an external consumer,
an AgentStatsArtifactSchema Zod schema should be added.

---

## Node.js-specific checklist

- process.exit(2) at scripts/crew.ts:940 is inside a COMMAND handler, not a library
  function. This matches the existing convention for all commands in crew.ts. The aggregator
  library has no process.exit. PASS.
- All imports use ESM syntax (no require). PASS.
- No streams, no raw on(data) event listeners. PASS.
- No floating Promises in the aggregator. PASS.
- unhandledRejection handler absence in crew.ts: pre-existing gap outside this slice scope.

---

## Size budgets

| File | Lines | Budget | Status |
|------|-------|--------|--------|
| scripts/lib/agent-stats-aggregator.ts | 230 | 250 | PASS |
| tests/agent-stats-aggregator.test.ts | 300 | 300 | PASS (at ceiling) |
| scripts/crew.ts net add | 72 | 80 | PASS |

Note: test file is at the 300-line ceiling. Future AC additions must be offset by compression.

---

## Verdict

approved_with_notes

The two MEDIUM findings (unguarded GradeRecord cast at line 98, verbatimModuleSyntax
disabled in tsconfig.json) should be addressed before or alongside the follow-up consumer
slices that depend on AgentStatsRow. The two LOW findings are safe to defer to a later
cleanup pass. No HIGH or CRITICAL findings. The exported contract (AgentStatsRow,
WindowSpec, AggregateOpts) is stable and correctly shaped for downstream consumers.