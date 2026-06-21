---
name: root-cause-discipline
prompt_id: root-cause-discipline
version: 1.1.0
tier: workflow
model_pinned: sonnet
maxLines: 250
description: Root-cause-first discipline for debugging work. Refuse band-aids (anti-pattern taxonomy) + investigate root cause before fixing (four-phase procedure). Loaded ON-DEMAND for bug fixes, test failures, flakes, regressions, and suspicious patches — NOT on every builder dispatch. Builders carry the band-aid mini-contract in builder-ceremony; this skill loads when debugging.
source: aitmpl/development/systematic-debugging
source_version: 2026-06-04
last_reviewed: 2026-06-21
owner: hero-crew
triggers: ["bug fix", "test failure", "flaky test", "regression", "intermittent failure", "unknown root cause", "band-aid", "try/catch swallow", "magic constant", "disable test", "hardcode fallback", "bump timeout", "cap bump", "TODO fix"]
---

# Root-cause discipline — refuse band-aids + find the cause

## Trigger

Load when:

- Fixing a bug or addressing a reported failure.
- A test fails unexpectedly (yours or someone else's).
- Root cause of a behavior is unclear after a normal read.
- A bug is intermittent / flaky / non-deterministic.
- You're tempted to write a band-aid: swallow an error, disable a test, bump a timeout / cap, hardcode a fallback, or apply a magic constant.
- A regression appeared and the introducing commit is unknown.

DO NOT load on routine feature work. Builders carry the short band-aid mini-contract in `skills/workflow/builder-ceremony/` and only escalate to this skill when debugging.

ESPECIALLY load when: under time pressure, "just one quick fix" seems obvious, you've already tried multiple fixes, or you don't fully understand the issue.

## The iron law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure. Patches over root-cause fixes are the most expensive regression source in this codebase.

If you haven't completed Phase 1 (Root Cause Investigation), you cannot propose fixes.

## Band-aid policy

When you spot a symptom of a deeper issue:

1. **Investigate before patching.** Perform enough investigation to identify the likely root cause — a shallow grep is rarely enough for a real bug. Run Phase 1 below.
2. **If root cause is IN the slice scope** — fix it at the source. The patch IS the fix.
3. **If root cause is OUT of slice scope** — write the patch + surface a `Risks` entry: `band-aid: <patch>: root cause = <X>`. Reference an existing follow-up id when one exists; never let a band-aid land without explicit, named tech debt.
4. **Never silently paper over.** Silent patches become hidden regressions when the next slice touches the area.

## The four phases

### Phase 1: Root cause investigation

**BEFORE attempting ANY fix:**

1. **Read error messages carefully** — don't skip past errors, read stack traces completely, note line numbers and error codes.
2. **Reproduce consistently** — can you trigger it reliably? Not reproducible → gather more data, don't guess.
3. **Check recent changes** — `git diff`, recent commits, new dependencies, config changes, environmental differences.
4. **Gather evidence in multi-component systems** — add diagnostic instrumentation at each component boundary; log what data enters and exits each layer; run once to gather evidence showing WHERE it breaks.
5. **Trace data flow backward** — where does bad value originate? Keep tracing UP until you find the source. Fix at source, not at symptom. See `investigation.md` Part 1 for the complete backward-tracing technique.

### Phase 2: Pattern analysis

1. **Find working examples** — locate similar working code in the same codebase.
2. **Compare against references** — read reference implementations COMPLETELY before applying.
3. **Identify differences** — list every difference, however small.
4. **Understand dependencies** — what other components, settings, config, environment does this need?

### Phase 3: Hypothesis and testing

1. **Form single hypothesis** — "I think X is the root cause because Y." Write it down. Be specific.
2. **Test minimally** — make the SMALLEST possible change. One variable at a time.
3. **Verify before continuing** — worked? → Phase 4. Didn't work? Form a NEW hypothesis. Don't stack fixes.
4. **When you don't know** — say "I don't understand X." Don't pretend. Ask for help.

### Phase 4: Implementation

1. **Create failing test case** — simplest possible reproduction, automated if possible. Use `superpowers:test-driven-development`.
2. **Implement single fix** — address the root cause identified. ONE change. No bundled refactoring.
3. **Verify fix** — test passes? No other tests broken? Issue actually resolved?
4. **If fix doesn't work** — stop. If <3 fixes tried: return to Phase 1 with new information. If ≥3 fixes failed: STOP and question the architecture.
5. **If 3+ fixes failed** — each fix reveals new shared state / coupling / problem? Discuss with the human partner before attempting more fixes. This is a wrong architecture, not a failed hypothesis.

## Anti-patterns — refuse + surface

When you catch yourself about to do one of these, STOP and either fix the root cause or surface the band-aid explicitly:

| Anti-pattern | Why it's wrong |
|---|---|
| `catch { /* ignore */ }` blocks that swallow errors without logging or surfacing | Hides the failure; next on-call has no signal. At minimum log + re-throw or return a typed error. |
| `// TODO: fix this properly` without a linked follow-up | TODO without an owner rots forever. Either fix now or open a follow-up and cite it in the comment. |
| Magic constants tuned to make a test pass (especially in tests) | Couples the test to the implementation accident rather than the contract. The right number falls out of the math; if it doesn't, the math is wrong. |
| Disabling a failing test (`.skip`, `xit`, removing the file) instead of fixing broken behavior | Test was telling you something. Skipping silences the signal. Either fix the bug, fix the test, or document `t.skip("known flake on Windows perf hooks")`. |
| Wrapping symptoms in `try/catch` without understanding why the call throws | Hides the failure mode. Either prevent the throw or handle the specific case (`catch (err) { if (err.code !== "ENOENT") throw; }`). |
| Hardcoded fallback (`?? "default"`, `?? []`) that masks the real failure mode | The empty/null result meant something — falling back silently loses the signal. |
| Bumping a cap / threshold / timeout to defeat a gate instead of addressing the cause | The cap existed because something broke at that threshold. Bumping = the next break will be worse. Investigate first. |
| "It works on my machine" — environment-dependent fixes | Patches that hide platform divergence land regressions for the next OS / runtime. |
| Skipping a validation gate (`--no-verify`, `--force`, `continue-on-error`) without a written reason | The gate existed for a reason. Skipping requires documentation of WHY this case is the exception. |
| Patching a derived value at the consumer when the source is wrong | Fixes one consumer; the next consumer of the same source repeats the bug. |
| Copy-paste of a "working" file/config to "match" without understanding the diff | Now you have two implementations of the same broken pattern. |

## Red flags — STOP and follow process

If you catch yourself thinking any of the following, STOP and return to Phase 1:

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "I don't fully understand but this might work"
- "One more fix attempt" (when already tried 2+)
- Each fix reveals a new problem in a different place

See `investigation.md` Part 3 for common rationalizations and partner signals.

## Decision tree (in-slice vs out-of-slice)

```
You spot a symptom.
  ↓
Phase 1 — investigate root cause.
  ↓
Is the root cause IN slice scope?
  ├─ YES → fix it. Patch IS the fix. Note in Risks/Next.
  └─ NO  → Is a quick patch safe (read-only / non-load-bearing)?
            ├─ YES → write the patch + surface in Risks:
            │         "band-aid: <patch>: root cause = <X>"
            │       Open a follow-up if not already tracked.
            │       Cite the follow-up id in the patched code as a comment.
            └─ NO  → halt + `mark-badge blocked --note "root cause out of
                     scope, patch unsafe: <reason>"`. Dispatcher re-scopes.
```

## What to write in the return

When a band-aid is genuinely necessary, the `Risks` field MUST include:

```
band-aid: <one-line description of the patch>
root cause: <one-line description of the underlying issue>
follow-up: <id or "open follow-up" if not yet tracked>
```

Reviewer + verifier treat any `band-aid:` line without a follow-up as a `needs_fix` rejection.

## Quick reference

| Phase | Key activities | Success criteria |
|---|---|---|
| **1. Root cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

## When the process reveals "no root cause"

If systematic investigation reveals a truly environmental, timing-dependent, or external issue:

1. Document what you investigated.
2. Implement appropriate handling (retry, timeout, error message).
3. Add monitoring / logging for future investigation.

Treat the "environmental" verdict with skepticism — most "no root cause" calls turn out to be incomplete investigation. Try Phase 1 again before settling for handling-without-root-cause.

## Done / Acceptance

- Root cause is explicitly stated before any fix is applied.
- A failing test case or repro script exists that confirms the bug.
- The fix resolves the failing test and no other tests regress.
- Fix is targeted at the root cause; no unrelated changes are bundled.
- Any necessary band-aid is surfaced in `Risks` with named follow-up.

## Supporting techniques + related skills

Load these depth files only when SKILL.md isn't enough:

- `investigation.md` — backward stack tracing + `git bisect` for unknown-commit regressions + anti-pattern rationalizations.
- `flake-and-hardening.md` — condition-based waiting (kill timing flakes) + defense-in-depth validation (make the bug structurally impossible).
- `find-polluter.sh` — bisects a test suite to find which test pollutes shared state.
- `condition-based-waiting-example.ts` — generic `waitFor` utility implementation.

Related skills (consult on demand):

- `superpowers:test-driven-development` — for creating the failing test case (Phase 4 Step 1).
- `superpowers:verification-before-completion` — verify fix worked before claiming success.
- `agents/inspector.md` — review lens for band-aid detection rules.
