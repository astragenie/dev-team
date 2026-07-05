# Agent Prompt Optimization — operating prompt

Self-prompt for the main-thread session. Invoke with: "optimize agent prompts
per docs/prompts/agent-prompt-optimization.md" (optionally naming specific
agents). Goal: improve each `agents/*.md` through **gradual, surgical
improvement** — never wholesale rewrites — until **no high-impact issues
remain**. ≥ 9.8/10 is the expected side effect, not the target: scores are
descriptive, not goals. Never raise a score unless the underlying prompt
measurably improved.

## Mission

Analyze existing agent prompts, grade them against the rubric below to
establish a benchmark, then eliminate defects through targeted edits in key
areas. Ground every change in: prior decisions (DEC log, `docs/governance.md`),
session memories (`~/.claude/projects/C--work-mega-dev-team/memory/`),
operational learnings (`.claude/artifacts/loop/learnings.jsonl`), past review
feedback (`.claude/artifacts/crew/reviews/`), and industry prompt-engineering
best practices (`skills/domain/prompt-engineering/`,
`plugin-dev:agent-development`).

## Hard rules

1. **Edit, don't rewrite.** Use surgical `Edit` calls on the weakest sections.
   `Write` (full-file replacement) is forbidden unless the user explicitly
   approves a version-major rewrite. Preserve voice, structure, and every rule
   that already works.
2. **One agent at a time.** Grade → fix top gaps → regrade → next agent. No
   batch rewrites across the fleet.
3. **Never lose validator compliance.** After every agent's edits run
   `node ./scripts/validate-agents.ts`. Structural requirements it enforces:
   - `## Report contract` section present
   - `## Peer dispatch` needs: at least one whitelist bullet (`- \`peer\`:`),
     a "MUST NOT dispatch" blacklist, and budget lines in the exact shape
     "Dispatch budget per slice: max N" / "per turn: max N"
   - line cap 350 default; per-agent `maxLines:` frontmatter overrides
4. **Bump `version:`** in frontmatter per change set (minor for section
   additions, patch for wording). Never bump without an actual edit.
5. **No commits without the user's word.** Open the edited file in Sublime
   (`"/c/Program Files/Sublime Text/subl.exe" <path>`) after each agent and
   wait for review. Commit only on explicit "commit".
6. **Fleet consistency beats local perfection.** Before changing a shared
   convention (time budgets, handoff shape, dispatch purity, stub-on-entry),
   grep the fleet — if 5+ agents share the pattern, either change all (with
   user approval) or none. Known uniform baselines: implementers run
   `maxTurns: 60 / maxMinutes: 12` (test-automator deviates to 25 min —
   wall-clock-bound rerun evidence, deliberate). Before introducing any NEW
   convention, decide where it belongs: governance doc, shared skill, or the
   individual prompt — prefer shared guidance whenever multiple agents would
   benefit.
7. **Every edit must earn its place.** Each edit must remove a defect, improve
   determinism, improve safety, reduce ambiguity, improve fleet consistency,
   or remove duplication. No new sections merely because they are fashionable
   or appeared in another prompt. No cargo-culting: never copy a section from
   a high-scoring prompt unless it improves the receiving prompt's role —
   role fit beats uniformity. If no qualifying improvement exists, leave the
   prompt unchanged.

## Grading rubric (0–10 per category, overall = weighted mean)

| Category | Weight | What 10 looks like |
|---|---|---|
| Role clarity / focus | 2× | One responsibility, stated once; no orchestrator-in-disguise |
| Scope boundaries | 2× | Explicit allowed/forbidden edit scope; changed-code-first discipline |
| Safety | 2× | No silent repo mutation; commit/tag/push rules explicit; escalation deterministic |
| Determinism | 1.5× | Tiered/enumerated rules (verdict enums, escalation triggers, confidence calibration) — not vibes |
| Evidence discipline | 1.5× | Claims require pasted output; measured/static/hypothesis tagging where applicable |
| Duplication | 1× | Each rule stated once; shared mechanics point to skills (`builder-ceremony`, `self-verify-gate`) |
| Skill/infra parity | 1× | Loads the common set siblings load (builder-mindset, ceremony, self-verify, security-advisory where role-appropriate) |
| Realism | 1× | Budgets (turns/minutes/maxLines) match the work; no impossible constraints |

Grade honestly. A prompt that merely "reads well" but has a contradiction
(e.g. "never @flaky" + "@flaky bucket immediately") caps at 8.

Calibration: do not compare prompts to an imagined ideal. Compare against
other prompts in this repo, repo governance, validator requirements, and the
agent's stated role — the same standard across all agents. Score changes need
evidence: every increase must reference the edits that justify it; every
unchanged score notes why the remaining gap was not addressed.

## Known defect classes (from this repo's history — check every prompt)

- **Stale-ref leftovers** — broken prose like `(dispatcher role removed),` in
  lists; references to renamed/removed agents, commands, or paths.
- **Count drift** — "three concern areas" when four are defined.
- **Wrong constants** — line caps, budgets, or paths that disagree with
  `scripts/validate-agents.ts`, `docs/governance.md`, or CI.
- **Contradictions** — a rule and its exception stated as two absolutes.
- **Inconsistent CLI style** — relative `node scripts/crew.ts` vs the canonical
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" ... --repo "$PWD"`.
- **Version-sync direction unstated** — canonical: `package.json` →
  `.claude-plugin/plugin.json` → `.claude-plugin/marketplace.json`.
- **Over-broad missions** — reviewer prompts doing implementer work or vice
  versa; check `tools:` list matches the claimed role (no Edit/Write ⇒
  reviewer posture must be explicit).
- **Dangerous autonomy** — repo-wide dead-code removal, auto-commit, invented
  numbers (growth projections without data), unsafe caching advice without
  correctness caveats.
- **Missing reuse-first** — implementers that may create duplicate
  fixtures/helpers without searching first.

## Industry best-practice patterns (consider where they improve the prompt — NOT universal requirements)

Some roles genuinely do not need confidence calibration or evidence tags —
apply only where the pattern fits the role.

- Tiered action confidence (always-safe / needs-static-proof / report-only)
- Deterministic escalation triggers (>N files, public symbol, <90% confidence)
- Evidence tags on findings (measured / static / hypothesis)
- Confidence calibration definitions (high/medium/low mapped to evidence type)
- Quality-over-quantity framing (coverage/count = health metric, not objective)
- Reuse-first + idempotency (same dispatch twice → no duplicate artifacts)
- Prefer-real-systems hierarchy for test/verification work
- Correctness → simplicity → maintainability → optimization priority order
- Snapshot/cache/consistency recommendations must carry invalidation +
  authz + staleness caveats

## Workflow per agent

1. **Read** the agent file + its routing-table rows + any review artifacts
   naming it.
2. **Recall** relevant memories/learnings/decisions (grep learnings.jsonl for
   the agent name; check MEMORY.md index).
3. **Grade** against the rubric. Record in `docs/grades/agent-prompt-scores.md`
   (create the benchmark table on first run: agent | prompt version | date |
   reviewer | per-category | overall | rationale | key edits | top gaps).
   This file is the audit log — keep superseded rows for history.
4. **Fix** the 3–5 highest-impact gaps ONLY — surgical edits. Stop editing
   once the remaining issues are low-impact or require governance decisions
   (log those as needs-human in the benchmark table); do not gold-plate or
   make cosmetic changes to chase a number.
5. **Regrade**, update the benchmark row (keep the old row for history),
   run the validator, open in Sublime, summarize gap → fix mapping in a table.
6. **Pause** for user review before the next agent unless told to run
   continuously.
7. On "commit": conventional commit
   (`refactor(agents): harden <agent> prompt per optimization pass`),
   one agent (or one reviewed batch) per commit.

## Order of attack

Priority = (impact × dispatch frequency). Default order: implementers
(fullstack-dev, backend-dev, frontend-dev) → gates (reviewer, verifier,
reviewer-lite) → specialists (qa-expert, architect, release-engineer,
document-writer, researcher, investigator, integrator, uxdesigner,
dev-lite, aiplugin-dev) → already-hardened this cycle (refactor 3.0.0,
test-automator 2.2.0, performance-engineer 1.2.0 — regrade only).

## Done criteria

- Every agent has a benchmark row with per-category scores.
- Every agent has **no remaining high-impact issues** (score reflects this
  descriptively), or a recorded reason why the residual gap requires a
  decision above this workflow's pay grade (needs-human in the table).
- `node ./scripts/validate-agents.ts` PASS fleet-wide.
- All changes reviewed in Sublime and committed with user approval.
