---
name: durability-discipline
prompt_id: durability-discipline
version: 1.0.0
tier: workflow
model_pinned: sonnet
description: Refuse band-aids — investigate root cause before patching, surface deferred fixes as `--risks` with FEAT id. Loaded by every builder dispatch (backend-dev, frontend-dev, fullstack-dev). Eliminates quick-fix-instead-of-root-cause regression source.
triggers: ["band-aid", "try/catch swallow", "magic constant", "disable test", "TODO fix", "quick fix", "hardcode"]
---

# Durability discipline — refuse band-aids

## Trigger

Load on every builder dispatch (backend-dev / frontend-dev / fullstack-dev). The skill is short, cheap, and the refusal patterns are uniform across stacks.

## The rule

Patches over root-cause fixes are the most expensive regression source in this codebase. When you spot a symptom of a deeper issue:

1. **Investigate root cause BEFORE writing the patch.** One Read or Grep, not zero.
2. **If root cause is IN the slice scope** — fix it at the source. The patch is the fix.
3. **If root cause is OUT of slice scope** — write the patch + surface a `--risks` entry like `band-aid: <patch>: root cause = <X> needs FEAT-NNN follow-up`. Open the follow-up FEAT or reference an existing one. Never let a band-aid land without explicit, named tech debt.
4. **Never silently paper over.** Silent patches become hidden regressions when the next slice touches the area.

## Anti-patterns — refuse + surface

When you catch yourself about to do one of these, STOP and either fix the root cause or surface the band-aid explicitly:

| Anti-pattern | Why it's wrong |
|---|---|
| `catch { /* ignore */ }` blocks that swallow errors without logging or surfacing | Hides the failure; next on-call has no signal. At minimum log + re-throw or return a typed error. |
| `// TODO: fix this properly` without a linked FEAT id | TODO without an owner rots forever. Either fix now or open a FEAT and cite it in the comment. |
| Magic constants tuned to make a test pass (especially in tests) | Couples the test to the implementation accident rather than the contract. The right number falls out of the math; if it doesn't, the math is wrong. |
| Disabling a failing test (`.skip`, `xit`, removing the file) instead of fixing the broken behavior | Test was telling you something. Skipping silences the signal. Either fix the bug, fix the test, or document with `t.skip("FEAT-NNN — known flake on Windows perf hooks")`. |
| Wrapping symptoms in `try/catch` without understanding why the call throws | Hides the failure mode. Either prevent the throw or handle the specific case (`catch (err) { if (err.code !== "ENOENT") throw; }`). |
| Hardcoded fallback (`?? "default"`, `?? []`) that masks the real failure mode | The empty/null result was supposed to mean something — falling back silently loses that signal. |
| Bumping a cap / threshold / timeout to defeat a gate instead of addressing the cause | The cap existed because something broke at that threshold. Bumping = the next break will be worse. Investigate first. |
| "It works on my machine" — environment-dependent fixes | Patches that hide platform divergence land regressions for the next OS / runtime. |
| Skipping a validation gate (`--no-verify`, `--force`, `continue-on-error`) without a written reason | The gate existed for a reason. Skipping requires documentation of WHY this case is the exception. |
| Patching a derived value at the consumer when the source is wrong | Fixes one consumer; the next consumer of the same source repeats the bug. |
| Copy-paste of a "working" file/config to "match" without understanding the diff | Now you have two implementations of the same broken pattern. |

## How to apply (decision tree)

```
You spot a symptom.
  ↓
Is the root cause IN scope?
  ├─ YES → fix it. Patch IS the fix. Note this in handoff `--deliverable`.
  └─ NO  → Is a quick patch safe (read-only / non-load-bearing)?
            ├─ YES → write the patch + surface in `--risks`:
            │         "band-aid: <patch>: root cause = <X> needs FEAT-NNN"
            │       Open follow-up FEAT if not already tracked.
            │       Cite the FEAT id in the patched code as a comment.
            └─ NO  → halt + `mark-badge blocked --note "root cause out of
                     scope, patch unsafe: <reason>"`. Let lead re-scope.
```

## Examples (this repo)

| Past incident | Band-aid temptation | Durability action taken |
|---|---|---|
| FEAT-171 candidate dispatch Windows 32KB limit | "wrap in try/catch and retry" | Fixed at source — switched to stdin pipe. Documented in commit. |
| FEAT-176 Langfuse 404 spam | "ignore stderr" | Truncated HTML response + added LANGFUSE_DISABLE env. Both flagged as follow-up needed (proper endpoint detection FEAT). |
| Round 5 parser fallback returning raw stdout | "the asserts pass, ship it" | Investigated — found NDJSON noise. Rewrote parser to aggregate message events + never fall back to raw. |
| SLICE-79 fullstack-dev bundle truncation | "raise size cap" | Investigated — identified prompt as bloat source. Shrunk via SLICE-93 instead. |

## What to write in the handoff

When a band-aid is genuinely necessary, the `--risks` field MUST include:

```
band-aid: <one-line description of the patch>
root cause: <one-line description of the underlying issue>
follow-up: FEAT-NNN (link or open if missing)
```

Reviewer + verifier are instructed to treat any `band-aid:` line without a follow-up FEAT id as a `needs_fix` rejection.

## Cross-references

- See `agents/inspector.md` review lens for the band-aid detection rules.
- See `skills/workflow/systematic-debugging/` for root-cause investigation procedure.
- See past `--risks` entries in `.claude/artifacts/crew/handoffs/` for examples of well-formed band-aid surfaces.
