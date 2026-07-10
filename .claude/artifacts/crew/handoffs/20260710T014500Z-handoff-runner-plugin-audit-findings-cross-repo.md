# Task Handoff: runner-plugin audit findings (cross-repo — apply in runner-plugin's own session/worktree)

- Created: 2026-07-10T01:45:00Z
- From: dispatcher (dev-team fresh-look audit session, worktree transient-dancing-wren)
- To: runner-plugin session
- Objective: Apply the runner-plugin half of the 2026-07-10 fresh-look audit. All findings verified read-only against `C:\work\mega\runner-plugin` source; no edits were made there per the cross-repo worktree rule.
- Confidence: high (each item file:line-grounded)

## P0 — guard-feat-dispatch blocks live reviewers (runner#404)

`hooks/guard-feat-dispatch.mjs:63-95`: `allowed[]` lists `crew:reviewer` but omits
`crew:architect-reviewer`, `crew:csharp-reviewer`, `crew:typescript-reviewer`, `crew:reviewer-lite`
— all live agents in dev-team. Any stack-reviewer fan-out on a FEAT-tagged prompt exits `BLOCKED 2`.
Fix: add the 4 names to `allowed[]`; test pattern exists in `src/tests/guard-feat-dispatch-hook.test.mts`.
Durable fix (recommended follow-up FEAT): stop hand-maintaining the allowlist — read agent ids from the
co-installed dev-team plugin's `agents/*.md` filenames, or share one generated manifest. The list already
carries 2 releases of stale aliases (lines 82-94) and re-breaks on every dev-team agent rename.

## P0 — brainstorming mandated in autonomous architect dispatch (dev-team#197 mechanism)

`agents/architect.md:64-69`: "Required skills (invoke at start of every dispatch) — no exceptions:
`superpowers:brainstorming`". Interactive elicitation skill + no human present = stall. This is the
confirmed #197 mechanism (66.7% pause rate over last 15 dispatches).
Fix: drop it from the required list, or gate to interactive `/crew:design` entry only. Also audit
`scripts/presets/typescript-plugin-dev.json` `roles.*` skill lists for other interactive skills.
Note: dev-team side is fixed — `skills/universal/brainstorming/SKILL.md` now has a DISPATCH-CONTEXT GATE
(subagent → skip question loop, state assumptions, `help_request` badge if blocking). Mirror that pattern
if runner keeps the skill in any dispatch block.

## P1 — runner:start re-dispatches shipped slices (runner#392)

`src/scripts/lib/paths.mts:85-112` (`locateSliceFile`) walks the whole slicesRoot including completed/;
`start-slice.mts` has zero git calls. Completion tracked 3 unreconciled ways (frontmatter slices[],
directory location, git history).
Fix: before emitting dispatchInstruction for a pre-existing sliceId, cross-check `touchesFiles`/branch
against `git log`/merge state; refuse or warn when already landed. Principle: directory state is a cache,
git is truth.

## P1 — no per-slice size cap (runner#393)

`agents/pm.md:114-135` Framework 6 + `src/scripts/lib/proposed-slices.mts`: `sum(points) >= effort_points`
with ≥2 entries, but no per-entry ceiling — `{13,1}` passes and produces the exact oversized slice the gate
exists to prevent. Fix: per-entry cap (points ≤ 5) in proposed-slices.mts validation + restate in pm.md.

## P2 — start.md role glossary omits specialist reviewers

`commands/start.md:110-111`: "reviewer A"/"reviewer B" both map to `crew:reviewer`; no mention of the
stack fan-out (architect-reviewer/csharp-reviewer/typescript-reviewer) dev-team routing wires in.
Compounds #404. Fix: list specialists as fan-out participants.

## P1 (upstream source) — `escalated_to_human` phantom badge in loop-discipline skill

dev-team `agents/verifier.md:52` carries a hash-stamped pre-loaded-universals block rendered from the
runner-side loop-discipline source: "only `escalated_to_human` is a hard external block". No such badge
exists in crew BADGE_TABLE (canonical: `escalated_to_dispatcher`, alias `escalated_to_lead`). Fix in the
loop-discipline source skill, then re-render dev-team's injected blocks (scripts/render-universal-skills.ts).

## Housekeeping

- runner#402 (featId vs featureId): ALREADY FIXED in code — `pm-apply.mts:127-148` normalizePmEntryAliases,
  landed PR #403, pinned by `pm-contract-field-names.test.mts`. Close the GH issue.
- dev-team side of this audit landed as commit `d4fd47ea` on branch `worktree-transient-dancing-wren`
  (new badges `help_request`/`help_resolved` now real in crew CLI — runner ceremony code that inspects
  badge states may want to learn the `gates.help` slot).
