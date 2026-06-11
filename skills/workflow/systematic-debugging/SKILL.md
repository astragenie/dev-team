---
name: systematic-debugging
tier: workflow
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
source: aitmpl/development/systematic-debugging
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: bug, test failure, unexpected behavior, intermittent failure, root cause, repro
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue: test failures, bugs in production, unexpected behavior, performance problems, build failures, integration issues.

**Use ESPECIALLY when:** under time pressure, "just one quick fix" seems obvious, you've already tried multiple fixes, or you don't fully understand the issue.

## The Four Phases

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully** — don't skip past errors, read stack traces completely, note line numbers and error codes.
2. **Reproduce Consistently** — can you trigger it reliably? If not reproducible → gather more data, don't guess.
3. **Check Recent Changes** — git diff, recent commits, new dependencies, config changes, environmental differences.
4. **Gather Evidence in Multi-Component Systems** — add diagnostic instrumentation at each component boundary; log what data enters and exits each layer; run once to gather evidence showing WHERE it breaks.
5. **Trace Data Flow** — see `root-cause-tracing.md` for the complete backward tracing technique. Where does bad value originate? Keep tracing up until you find the source. Fix at source, not at symptom.

### Phase 2: Pattern Analysis

1. Find working examples — locate similar working code in same codebase.
2. Compare against references — read reference implementations COMPLETELY before applying.
3. Identify differences — list every difference, however small.
4. Understand dependencies — what other components, settings, config, environment does this need?

### Phase 3: Hypothesis and Testing

1. **Form single hypothesis** — "I think X is the root cause because Y." Write it down. Be specific.
2. **Test minimally** — make the SMALLEST possible change. One variable at a time.
3. **Verify before continuing** — worked? → Phase 4. Didn't work? Form NEW hypothesis. DON'T add more fixes on top.
4. **When you don't know** — say "I don't understand X." Don't pretend. Ask for help.

### Phase 4: Implementation

1. **Create failing test case** — simplest possible reproduction, automated if possible. Use `superpowers:test-driven-development`.
2. **Implement single fix** — address the root cause identified. ONE change. No bundled refactoring.
3. **Verify fix** — test passes? No other tests broken? Issue actually resolved?
4. **If fix doesn't work** — stop. If < 3 fixes tried: return to Phase 1 with new information. If ≥ 3 fixes failed: STOP and question the architecture (see below).
5. **If 3+ fixes failed** — each fix reveals new shared state/coupling/problem? Discuss with human partner before attempting more fixes. This is a wrong architecture, not a failed hypothesis.

## Red Flags — STOP and Follow Process

If you catch yourself thinking any of the following, STOP and return to Phase 1:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "I don't fully understand but this might work"
- "One more fix attempt" (when already tried 2+)
- Each fix reveals new problem in different place

See `references/debugging-anti-patterns.md` for common rationalizations and partner signals.

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

## When Process Reveals "No Root Cause"

If systematic investigation reveals truly environmental, timing-dependent, or external issue:
1. Document what you investigated.
2. Implement appropriate handling (retry, timeout, error message).
3. Add monitoring/logging for future investigation.

Note: 95% of "no root cause" cases are incomplete investigation.

## Supporting Techniques

- **`root-cause-tracing.md`** — Trace bugs backward through call stack to find original trigger
- **`defense-in-depth.md`** — Add validation at multiple layers after finding root cause
- **`condition-based-waiting.md`** — Replace arbitrary timeouts with condition polling
- **`references/debugging-anti-patterns.md`** — Common rationalizations and partner signals
- **`references/git-bisect.md`** — Regression with unknown introducing commit: auto-detect test command, run `git bisect`, retry-before-verdict for flaky tests

**Related skills:**
- **superpowers:test-driven-development** — For creating failing test case (Phase 4, Step 1)
- **superpowers:verification-before-completion** — Verify fix worked before claiming success

## Real-World Impact

- Systematic approach: 15-30 minutes to fix
- Random fixes approach: 2-3 hours of thrashing
- First-time fix rate: 95% vs 40%
- New bugs introduced: Near zero vs common

## Done / Acceptance

- Root cause is explicitly stated before any fix is applied
- A failing test case or repro script exists that confirms the bug
- The fix resolves the failing test and no other tests regress
- Fix is targeted at the root cause; no unrelated changes are bundled
