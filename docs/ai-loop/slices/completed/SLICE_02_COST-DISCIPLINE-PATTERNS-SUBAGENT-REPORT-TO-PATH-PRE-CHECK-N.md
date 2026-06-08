---
id: SLICE-02
status: completed
feature: FEAT-018
priority: P2
target_release: v0.3.2
created: 2026-05-23
updated: 2026-05-23
completed_at: 2026-05-23
github_issue: 33
github_url: "https://github.com/sergeymilashico/hero-crew/issues/33"
---
# SLICE-02: cost-discipline patterns — subagent report-to-path + pre-check + no-reReread

Implements **all of FEAT-018** (single-slice feature). See [feature file](../../../backlog/in-progress/FEAT-018.md) for the full SLICE-61 post-mortem context, rule rationale, and out-of-scope clarifications.

## Objective

Bundle three cost-discipline rules from the SLICE-61 $77 post-mortem into the agent + command prompts so the crew workflow stops bleeding tokens on report-inlining, blind chained Bash, and verification re-Reads.

## In scope

- **Rule 2 (Report contract)** — add identical 5-line "Report contract" section to `agents/builder.md`, `agents/reviewer.md`, `agents/validator.md`, `agents/deployer.md`, `agents/researcher.md`. Section instructs agents to call `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-handoff …` via Bash and return only path + 1–3 sentence headline.
- **Rule 2 (Lead supervision)** — add "read agent reports from path, not from inline return" reminder to `commands/build.md` + `commands/fix.md`.
- **Rule 2 (Routing-table row)** — new row "Subagent completion report" → `write-handoff` CLI path.
- **Rule 5 (Pre-check)** — 2-line rule in `agents/builder.md` + `.claude/engineering-os/lead.md`. Verify `pwd` / `Get-Location` + `Test-Path` before chained `cd`/path ops. Append PS-vs-bash shell cheatsheet table once to `.claude/engineering-os/lead.md`.
- **Rule 6 (No re-Read after Edit/Write)** — one-line rule in `agents/builder.md`, `agents/reviewer.md`, `agents/validator.md`.

## Out of scope

- PreToolUse hook for chained Bash gating (Rule 5 Option B) — deferred per FEAT-018.
- Codifying rules into `skills/workflow/cost-discipline/SKILL.md` — deferred.
- Frontmatter `disallowedTools` changes — CLI path makes this unnecessary.
- Rule 1 (Sonnet default) — already done out-of-band per commit `4e101c3`.
- Rules 3 + 4 — user-side discipline, not prompt-fixable.

## Acceptance criteria

- [ ] **AC-1** All 5 agent prompts contain a "Report contract" section naming `write-handoff` exactly and forbidding inline full reports. Grep: `grep -l "write-handoff" agents/{builder,reviewer,validator,deployer,researcher}.md` returns all 5 paths.
- [ ] **AC-2** `commands/build.md` + `commands/fix.md` contain a "read-report-from-path" reminder. Grep verifiable.
- [ ] **AC-3** `docs/routing-table.md` has a new row for "Subagent completion report" → `write-handoff`.
- [ ] **AC-4** `.claude/engineering-os/lead.md` contains the pre-check rule + PS-vs-bash shell cheatsheet table.
- [ ] **AC-5** `agents/builder.md`, `agents/reviewer.md`, `agents/validator.md` each contain the "no re-Read after Edit/Write" rule. Grep verifiable.
- [ ] **AC-6** No prompt exceeds the ≤200-line HARD cap. `wc -l agents/*.md` shows all under 200.
- [ ] **AC-7** No regressions: `npm run lint && npm run format:check && npm run typecheck && npm test && node ./scripts/validate-manifests.mjs && node ./scripts/validate-skills.mjs` all pass.

## Done When

- AC-1..7 PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`.
- Reviewer A verdict = pass (or approved_with_notes with notes folded same-pass).
- Crew `final-synthesis` artifact written via `loop:slice-complete`.
- Slice file moved to `slices/completed/`.
- FEAT-018 auto-moves to `backlog/done/` (single-slice feature — auto-close is the desired behavior here, in contrast to FEAT-019's multi-slice gotcha).

## Reviewer ladder

- **Reviewer A**: `crew:reviewer` — correctness review against FEAT-018 spec + agent-prompt line-count check + cross-prompt consistency (same Report contract text across all 5 agents).
- **Reviewer B**: `plugin-dev:plugin-validator` — triggered by `agents/` diff per existing "Plugin shape change" routing row. Manifest + structure sanity check.
