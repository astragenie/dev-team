# Review Result: FEAT-019 plan adequacy — wire context7/plugin-dev/azure/microsoft-docs into crew agents

- Created: 2026-05-23T21:10:12.383Z
- Reviewer: crew:reviewer
- Decision: needs_fix
- Summary: Planning artifact is format-conformant and risk-aware; two should-fix scope ambiguities must land before promotion. ≤200-line agent-prompt cap verified realistic against measured slack (lead 169/200, others ≥87 lines free). `autonomous_safe: false` correctly flagged. Slice dependency ordering (A → B/C parallel → D → E) sound.
- Evidence Checked: `docs/backlog/pending/FEAT-019.md`, `docs/backlog/done/FEAT-017.md`, `docs/backlog/done/FEAT-016.md`, `docs/routing-table.md` (18 existing rows), `docs/architecture/architecture.md`, `CLAUDE.md`, `.claude/crew/constitution.md`, `agents/{lead,builder,reviewer,validator,deployer,researcher}.md` (line counts measured).
- Files Reviewed: `docs/backlog/pending/FEAT-019.md`.
- Test Adequacy: TDD gate (FEAT-011) not applicable — planning doc, no code produced. SLICE-A…E will each face TDD assessment at slice review time per standard gate.
- Risks: Uncovered: SLICE-B may need CLAUDE.md edits that collide with SLICE-A's CLAUDE.md callout if run in parallel. FEAT should designate SLICE-A as exclusive owner of CLAUDE.md edits.
- Required Follow-up: Apply F1 + F2 sentence-level edits to FEAT-019.md, then re-review. F3 + F4 nits can fold into same pass or defer to slice-acceptance. Add CLAUDE.md ownership note. Once green, promote via `/loop:slice-from-feature`.

## Findings

| # | Severity | Location | Finding |
|---|---|---|---|
| F1 | should-fix | FEAT-019.md L116–117 (SLICE-C) | "validate-manifests support" is vague. Does not specify whether `scripts/validate-manifests.mjs` requires a schema change for `.claude/crew.json` `stack` field. Specify: (a) current validator behavior on unknown keys, (b) whether extension is needed, (c) which file + what change. Builder cannot scope SLICE-C without this. |
| F2 | should-fix | FEAT-019.md L49–55 (proposed routing row) | New builder routing row for "Editing this plugin's own agents/skills/hooks/commands" overlaps existing "Plugin shape change" reviewer row. No cross-reference. Builder reading new row may skip reviewer gate. Notes column must cite existing "Plugin shape change" row as downstream review gate. |
| F3 | nit | FEAT-019.md L87–88 (SLICE-E) | brief-me "Routed skills" surface does not name the file implementing it. Identifying it pre-flags `plugin-dev:plugin-validator` gate at SLICE-E review. |
| F4 | nit | FEAT-019.md L166 (SLICE-E acceptance) | Non-Azure sample-repo acceptance scenario does not identify the repo. Either name it or add a precondition that it must exist. |

## Standards checked

- `CLAUDE.md` — ≤200-line agent-prompt cap (verified via line count), `autonomous_safe` policy, `validate-manifests.mjs` + `validate-skills.mjs` hard CI gates.
- `.claude/crew/constitution.md` — one-owner-per-task, scope discipline.
- FEAT-017 format template — frontmatter fields, section order, depends_on linkage.
- Routing-table consistency — heading style, "Route to" naming, Notes phrasing (18 existing rows cross-checked).
- FEAT-011 TDD gate — n/a (planning doc).
- `plugin-dev:plugin-validator` — not triggered (no plugin-shape diff).
- `plugin-dev:skill-reviewer` — not triggered (no `skills/**/SKILL.md` diff).

## Agent prompt line-count budget (measured)

| Agent | Lines | Headroom vs 200-cap |
|---|---|---|
| `lead.md` | 169 | 31 |
| `builder.md` | 63 | 137 |
| `reviewer.md` | 113 | 87 |
| `validator.md` | 53 | 147 |
| `deployer.md` | 58 | 142 |
| `researcher.md` | 43 | 157 |

FEAT-019's "no edits to lead" decision (line 79) is correct given 31-line slack. Other five comfortably absorb bullet-style addendums.
