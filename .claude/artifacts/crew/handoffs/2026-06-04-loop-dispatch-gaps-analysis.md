# Handoff — Loop Dispatch Gaps Analysis

- **Date:** 2026-06-04
- **From:** lead (analysis session)
- **To:** lead (next session)
- **Type:** advisory / no code changes
- **Confidence:** high (sources cited from `loop` plugin cache 0.7.0 and local `commands/`, `agents/`)

## Objective

Map the current `/loop:slice start` → implementation dispatch path, identify
where `crew:lead` and `loop:architect` are bypassed, and recommend a fix
sequence the next session can implement.

## Findings

### Dispatch flow today

Loop's `scripts/lib/slice-linker/dispatch.mjs:32` emits text starting with
`Dispatch /crew:build subagent with this prompt:`. Caller spawns
`crew:builder` subagent type per `templates/loop-rules.md:54` ("hand it to a
`crew:builder` subagent"). The `/crew:build` slash-command body (`Act as the
lead for a bounded feature delivery run.`) only executes when the user
invokes `/crew:build` interactively — not when the loop dispatches.

### Gap 1 — Lead bypass

- Lead framing (frame → in-scope → out-of-scope → single-session vs team run
  → run-brief → badges → synthesis) is encoded in `commands/build.md` body.
- That body never runs in autonomous loop. Builder inherits the workflow
  prose in its prompt but cannot perform real lead coordination.
- Result: roles conflate. Builder does implementation + dispatches sub-review
  / sub-validate + writes synthesis.

### Gap 2 — Architect bypass

- `/loop:architect` (Opus pre-flight, FEAT-005 two-model split) is opt-in
  manual. `slice-start.mjs` does not call it.
- Non-trivial structural slices reach builder with no design artifact.
- `loop:architect` agent prompt itself defers implementation to crew:builder
  but is not auto-invoked.

### `/crew:fix` routing

- Called by **parent orchestrator** on pivot triggers (review needs_fix,
  validation fail, PR lint/test/CI failures via `/loop:pr-fix`). Not called
  from inside `/crew:build`.
- No mid-slice escalation path: builder eats complex bugs inline. Recurring
  "builder mid-cleanup stop" pattern noted in
  `.claude/artifacts/loop/grades/20260604T150244Z-feat030-slice27-grade.md`
  across SLICE-23/25/26/27.

## Recommended fix sequence

| # | Option | Effort | Gain | Notes |
|---|--------|--------|------|-------|
| 1 | **D + E** — auto-architect on `autonomous_safe: false` OR slice `requires_design: true` | Small | High — risk-gated design pre-flight | Ship first |
| 2 | **A** — change dispatch subagent type to `crew:lead` | Small | Restores lead workflow | Measure cost delta first |
| 3 | **G** — builder emits `escalate: needs_fix` badge for mid-slice pivot | Medium | Closes recurring stuck-builder pattern | Conditional on grade data |

Options B (lead-lite), C (builder lead-shim skill), F (heuristic architect
trigger) considered and deprioritised.

## Concrete first PR (Option D)

Smallest viable change. Single slice. Estimated 1-2 file edits + 1 test +
1 doc line.

```
1. scripts/lib/slice-linker/start-slice.mjs
   - Read FEAT frontmatter `autonomous_safe`
   - If false → call runArchitectPreflight() before buildDispatchInstruction
   - Pass planPath into dispatchInstruction template

2. scripts/lib/slice-linker/dispatch.mjs
   - Add planPath param to buildDispatchInstruction
   - Emit "Design pre-flight at: <planPath>. Read before implementing." line

3. tests/slice-start.test.mjs
   - Assert planPath emitted when autonomous_safe=false
   - Assert no architect call when autonomous_safe=true

4. .claude/loop/rules.md
   - Add "Architect pre-flight auto-fires on autonomous_safe:false slices"
```

Both `start-slice.mjs` and `dispatch.mjs` live in the `loop` plugin repo
(`https://github.com/sergeymilashico/loop`), not this `hero-crew` repo —
the PR is against loop, not crew.

## Files referenced (read-only this session)

- `commands/build.md`, `commands/fix.md`
- `~/.claude/plugins/cache/astra/loop/0.7.0/scripts/lib/slice-linker/dispatch.mjs`
- `~/.claude/plugins/cache/astra/loop/0.7.0/commands/slice-start.md`
- `~/.claude/plugins/cache/astra/loop/0.7.0/commands/architect.md`
- `~/.claude/plugins/cache/astra/loop/0.7.0/templates/loop-rules.md`
- `~/.claude/plugins/cache/astra/loop/0.7.0/.claude/loop/rules.md`

## Risks / open questions

- Option D adds Opus pre-flight cost (~$2-5/slice on risk-flagged slices). Worth
  validating against cost-advisor before defaulting on.
- Slice files must carry FEAT linkage for autonomous_safe lookup to work.
  Authoring discipline already required by loop, but worth a CI check.
- Option A (dispatch to crew:lead) may double-count "frame" with the prose
  already embedded in dispatchInstruction. Lead-lite mode (Option B) may end
  up needed anyway.

## Next handoff suggestion

Next session: open `loop` repo, draft FEAT for Option D, run
`/loop:spec-add` and `/loop:spec-decompose` to wire the slice, then dispatch
the implementation via the very loop being fixed (eat own dog food). Measure
cost delta vs prior slices to validate the recommendation in this handoff.
