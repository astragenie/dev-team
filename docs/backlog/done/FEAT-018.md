---
id: FEAT-018
status: done
priority: P2
category: workflow
target_release: v0.3.1
created: 2026-05-23
updated: 2026-05-23
depends_on: []
slices: [SLICE-02]
derived_from: null
autonomous_safe: true
phase: 2
started_at: 2026-05-23
completed_at: 2026-05-23
---
# FEAT-018: cost-discipline patterns — subagent report-to-path + pre-check + no-reReread

## Description

Bundle three cost-discipline rules from the SLICE-61 post-mortem
($77 actual vs ~$15 well-run estimate) into the agent prompts so the
crew workflow stops bleeding tokens on avoidable patterns.

Source rules (see memory entry `feedback-cost-discipline`):

- **Rule 2** — subagent completion reports should be written to an
  artifact path; the agent returns only the path + a 1–3 sentence
  headline. Inline reports were the main driver of the 5 compaction
  events on SLICE-61.
- **Rule 5** — chained shell ops should pre-check `pwd` (and `Test-Path`
  on Windows) before `cd` / file ops. SLICE-61 had 17/171 tool failures
  (9.9%), most preventable with one extra check.
- **Rule 6** — agents should not Read a file immediately after a
  successful Edit / Write to "verify". The harness errored if the change
  did not apply.

Rule 1 (Sonnet by default) already handled out-of-band by the user
(`agents/builder.md` now `model: sonnet`). Not in scope here.

Rules 3 + 4 (subagent bundling, session repo scoping) are user-side
discipline rather than prompt fixes. Not in scope here.

## Scope

In scope (one bundled commit):

- **Rule 2 fix — Report contract.** New "Report contract" section in:
  - `agents/builder.md`
  - `agents/reviewer.md`
  - `agents/validator.md`
  - `agents/deployer.md`
  - `agents/researcher.md`

  Section content (uniform across all 5):

  > Write your full completion report by calling
  > `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-handoff
  >   --repo "$PWD" --title <short> --from <role> --to lead
  >   --summary <one-sentence headline> --evidence <comma list>`
  > via the Bash tool. The CLI persists the artifact under
  > `.claude/artifacts/crew/handoffs/`. Return to the lead ONLY the
  > resulting path + 1–3 sentence headline. Do NOT inline the full
  > report body — that re-inflates lead context and triggers
  > compactions.

  Constraint: `reviewer`, `validator`, and `researcher` have
  `disallowedTools: Write, Edit` in frontmatter. They cannot call
  `Write` directly. The CLI path (via Bash, which is allowed) is the
  reason this approach is chosen over "Write tool to a path." No
  frontmatter changes needed.

- **Rule 2 fix — Lead supervision.** Lines added to `commands/build.md`
  and `commands/fix.md` reminding the lead to read agent reports from
  the returned path rather than treating the inline return as the full
  report.

- **Rule 2 fix — Routing-table row.** New row "Subagent completion
  report" → agent writes via `write-handoff` CLI; lead reads from path
  on demand.

- **Rule 5 fix — Pre-check rule.** 2-line rule added to
  `agents/builder.md` and `.claude/engineering-os/lead.md`:

  > Before any chained Bash with `cd` / path-touching commands, verify
  > with `pwd` (POSIX) or `Get-Location` + `Test-Path` (PowerShell).
  > On Windows, prefer the PowerShell tool for cmdlet operations and
  > reserve Bash for POSIX-style scripts. Use `$env:NAME` in PS,
  > `$NAME` in bash. Quote paths with spaces.

  Shell cheatsheet table (PS vs bash) appended once to
  `.claude/engineering-os/lead.md` so it propagates to all roles via
  the lead override.

- **Rule 6 fix — No re-Read after Edit/Write.** One-line rule added to:
  - `agents/builder.md`
  - `agents/reviewer.md`
  - `agents/validator.md`

  > After a successful Edit / Write, do not Read the same file to
  > verify. The tool would have errored on failure. Re-Read only if
  > you need new context the edit revealed.

Out of scope:

- PreToolUse hook gating chained Bash ops (rule-5 option B). Defer to a
  follow-up FEAT if A+D don't drop tool-failure-rate below 5% on the
  next slice.
- Codifying the cost-discipline rules into a `skills/workflow/`
  always-discoverable skill. Memory entry covers cross-session recall
  for now. Promote later if rules drift.
- Frontmatter changes to add `Write` to the no-edit agents. The CLI
  path makes this unnecessary.

## Acceptance hints

- The 5 agent prompts each have a "Report contract" section that names
  `write-handoff` exactly and forbids inlining the full report.
- `commands/build.md` + `commands/fix.md` include the
  "read-report-from-path" reminder.
- `docs/routing-table.md` has the new row.
- `.claude/engineering-os/lead.md` has the pre-check rule + shell
  cheatsheet table.
- `agents/builder.md`, `agents/reviewer.md`, `agents/validator.md`
  each carry the "no re-Read after Edit/Write" rule.
- `node ./scripts/validate-manifests.mjs` passes.
- `node ./scripts/validate-skills.mjs` passes (no new warnings).
- `npm run lint` / `npm run format:check` / `npm run typecheck` clean.
- `npm test` passes (49+ tests).
- Smoke check: dispatch a trivial builder slice in a fresh session,
  observe the builder calls `write-handoff` and returns only the path
  + headline. Optional but valuable.

## Risks / open questions

- The `write-handoff` CLI signature is fixed; if a role needs richer
  fields than `--title / --from / --to / --files / --summary /
  --evidence`, the agent will degrade gracefully and the lead may need
  to re-synthesize. Acceptable for v1.
- Some prompts will tip over ≤200 line targets if every rule lands
  verbatim. Validate line counts after editing; trim phrasing to stay
  under 200 if needed.
- Rule-5 prompt nudges only catch what the agent reads. PreToolUse
  hooks are the harder-enforcement path — keep as a deferred FEAT.

## Followups (separate FEATs, not in this one)

- **FEAT-019 (provisional):** PreToolUse hook gating chained Bash ops
  if SLICE-N+1 tool-failure-rate stays above 5% after FEAT-018 lands.
- **FEAT-020 (provisional):** promote cost-discipline rules into a
  `skills/workflow/cost-discipline/SKILL.md` if the memory entry alone
  proves insufficient (rules drift, new sessions miss them).
- **Upstream:** PR to caveman to narrow `cavecrew-reviewer`'s
  description ("audit this file" / "spot-check this diff" only). Open
  follow-up from the reviewer-routing fix in commit `ab997f5`.
