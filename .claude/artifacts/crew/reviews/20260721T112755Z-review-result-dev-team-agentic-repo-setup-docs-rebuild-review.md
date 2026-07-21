---
findings: "LOW: AGENTS.md CI-gates list (\"in order\") undercounts actual validators in .github/workflows/test.yml by roughly 10 items plus the advisory-validators block and e2e:smoke:ux; self-caveated as non-authoritative and still an improvement over the pre-rebuild list.\nLOW: docs/README.md (new docs map) omits docs/ci-fast-path.md, a root-level docs/ file."
status: completed
decision: approved_with_notes
judge_id: crew:reviewer
---
# Review Result: Review Result

- Created: 2026-07-21T11:40:11.179Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Status: completed
- Summary: docs-only agentic-repo-setup rebuild (AGENTS.md/CLAUDE.md/README.md/docs/memory.md/docs/README.md/deployment.md/two moved research docs) is accurate, well-scoped, and correctly preserves marker blocks; 2 LOW documentation-completeness gaps found, no blockers.
- Evidence Checked:
  - ## Scope

Reviewed the docs/instruction-layer-only rebuild of `C:\work\mega\dev-team` per `../kb/05-patterns/agentic-repo-setup.md`
  - diffed `f50616c1..working-tree` for: `CLAUDE.md`
  - `README.md`
  - `AGENTS.md` (new)
  - `docs/memory.md` (new)
  - `docs/README.md` (new)
  - `docs/research/2026-05-19-crew-{architecture-analysis
  - optimization}.md` (moved from root)
  - `.claude/crew/deployment.md`. Confirmed out-of-scope surfaces (`agents/`
  - `commands/`
  - `skills/`
  - `.claude-plugin/`)
show a byte-identical `git diff --stat` (empty) against `f50616c1`.
## Evidence re-verified independently (not trusted from the audit artifact)

- Skill count: universal 6 + workflow 29 + domain 13 + meta 1 = 49 -- matches on-disk find
  - matches corrected
  README.md (was wrongly "69" at L40 and "34" at L313 pre-rebuild; both now say 49
  - confirmed via grep -- no
  stray "69 skill"/"34 skill" left anywhere in the five touched docs).
- package.json and .claude-plugin/plugin.json both 0.67.0 -- README.md pinned-release line now matches
  (was stale v0.65.0; that string only remains inside docs/memory.md's own "known drift fixed" changelog
  entry
  - which is correct and intentional).
- Moved research docs: diffed each new `docs/research/2026-05-19-crew-*.md` against
  `git show f50616c1:crew-*.md` (the correct base -- an earlier unrelated commit `de3461e1` had already
  rewritten `engineering-os` paths to `crew` paths in these files before this rebuild touched them
  - which
  initially looked like unauthorized body edits until diffed against the right base). Against `f50616c1`
  - the only diff in each file is the new 6-line "Historical -- predates the current roster" header block --
  body content is verbatim. Root originals (`crew-architecture-analysis.md`
  - `crew-optimization.md`) are
  confirmed gone via `ls` (not duplicated).
[LOW] `AGENTS.md:29-36` -- "CI gates" section lists 9 sequential validators "in order" plus lint/format/
typecheck/test/e2e:smoke
  - but `.github/workflows/test.yml`'s `checks` job actually runs about 16 validators
(also `validate-badges.ts`
  - `validate-loop-state.ts`
  - `validate-bundles.ts`
  - `validate-configs.ts`
  - `validate-org-refs.ts`
  - `validate-routing-table.ts --coverage-only`
  - plus fixture-driven
`validate-contracts.ts`/`validate-ux-spec.ts` loops)
  - a separate 4-item `advisory-validators` block
  - and
`linux-only-commands` runs both `e2e-smoke.ts` and `e2e:smoke:ux` (AGENTS.md names only the first). The
"in order" phrasing overclaims completeness for a paragraph whose whole job (per the altitude model) is
being the tool-agnostic command reference. Not a regression: the pre-rebuild CLAUDE.md CI-gate list was more
incomplete (11 items
  - missing `validate-tool-baseline.ts`/`validate-agent-refs.ts`/`validate-dispatch-graph.ts`/
`validate-workflows.ts` that AGENTS.md now correctly includes) and had no self-caveat; AGENTS.md adds "This
list is re-verified against `.github/workflows/test.yml` on every audit pass -- that workflow file is the
source of truth
  - not this paragraph
  - " which is the right honesty pattern even though the list itself is still
short a few validators.

- `.claude-plugin/marketplace.json` confirmed absent (ls fails) -- supports the deployment.md rewrite's claim.
- scripts/*.ts top-level count is 32
  - 0 .mjs anywhere under scripts/ -- matches AGENTS.md/deployment.md claims.
  (Recursive count including scripts/lib/ is 171 .ts files -- the "32" figure specifically means top-level
  - which is what both docs actually say; not a discrepancy.)
- agents/*.md top-level count is 23 -- matches README.md's "23 first-party agents" claim.
- CLAUDE.md marker blocks: diffed crew:start/end and loop:start/end blocks byte-for-byte against
  git show f50616c1:CLAUDE.md -- both IDENTICAL. The trailing @.claude/artifacts/loop/loop-snapshot.md
  auto-generated-state include (after loop:end) is also untouched and the referenced file exists.
- Link check: every ](path) in all 8 touched/new files (CLAUDE.md
  - AGENTS.md
  - docs/memory.md
  - docs/README.md
  - README.md
  - deployment.md
  - both moved research docs) resolves -- including all 8 ../kb/... machine-local
  links (verified each target file exists on disk) and README.md's repo-relative links (LICENSE
  - docs/architecture/architecture.md
  - skills/universal/using-memory/SKILL.md
  - etc.).
- README.md duplicate ## Install header confirmed collapsed to one (grep -n "^## Install" returns a single
  hit at line 58)
  - with the old second-install-flow content correctly folded into a new ### Local development
  subsection.
- CLAUDE.md's stale "Read first" self-contradiction (docs/backlog/product-backlog.md claimed both current and
  superseded in the same file) is resolved -- replaced with an "Authority documents" list that does not restate
  the backlog-location claim; the accurate backlog-location fact now lives once
  - in AGENTS.md's Structure
  section.

## CLAUDE.md length judgment (rubric asks: justified overage or padding?)

166 lines total
  - but lines 139-166 (28 lines) are entirely pre-existing
  - untouched crew:start/end +
loop:start/end + auto-generated-state marker blocks that the pattern's own field-lessons section says must
be preserved byte-for-byte
  - not counted against the "~130 max" target. Authored content is lines 1-138 (~138
lines) against a ~130 target -- roughly 6% overage explained by three genuinely new sections the pattern
prescribes for this altitude (Session protocol
  - Cross-repo coordination
  - Ecosystem canon) that the old file
had none of. Judgment: justified
  - not padding.

## Findings

[LOW] AGENTS.md:29-36 -- "CI gates" section lists 9 sequential validators "in order" plus lint/format/
typecheck/test/e2e:smoke
  - but .github/workflows/test.yml's checks job actually runs about 16 validators
(also validate-badges.ts
  - validate-loop-state.ts
  - validate-bundles.ts
  - validate-configs.ts
  - validate-org-refs.ts
  - validate-routing-table.ts --coverage-only
  - plus fixture-driven
validate-contracts.ts/validate-ux-spec.ts loops)
  - a separate 4-item advisory-validators block
  - and
linux-only-commands runs both e2e-smoke.ts and e2e:smoke:ux (AGENTS.md names only the first). The
"in order" phrasing overclaims completeness for a paragraph whose whole job (per the altitude model) is
being the tool-agnostic command reference. Not a regression: the pre-rebuild CLAUDE.md CI-gate list was more
incomplete (11 items
  - missing validate-tool-baseline.ts/validate-agent-refs.ts/validate-dispatch-graph.ts/
validate-workflows.ts that AGENTS.md now correctly includes) and had no self-caveat; AGENTS.md adds "This
list is re-verified against .github/workflows/test.yml on every audit pass -- that workflow file is the
source of truth
  - not this paragraph
  - " which is the right honesty pattern even though the list itself is still
short a few validators.
Risk: an agent trusting the "in order" claim as literally exhaustive could miss that other validators exist.
Fix (non-blocking
  - follow-up): either drop "in order" (imply "notable gates
  - " not the full list) or actually
enumerate all current validators; low cost either way.

[LOW] docs/README.md -- the new file's entire purpose is "one-screen guide to what lives where
  - " and its
table enumerates 17 subdirs plus 3 root files (governance.md
  - routing-table.md/.yaml
  - memory.md) but
omits a 4th root file that exists in docs/: docs/ci-fast-path.md (5 lines
  - dated 2026-07-09
  - describes the
docs-only CI fast path also referenced in AGENTS.md's CI-gates paragraph). Minor content
  - but it is exactly
the kind of gap this file exists to prevent.
Risk: negligible (tiny file
  - low traffic) but ironic given the file's stated purpose.
Fix (non-blocking
  - follow-up): add one row for ci-fast-path.md.

[Not a finding
  - noted for context] .claude/crew/deployment.md:1 still titles itself "Deployment Guidance --
hero-crew" (stale rename artifact -- repo/plugin was renamed dev-team/crew a while ago). Pre-existing:
confirmed via git show f50616c1:.claude/crew/deployment.md that this line predates the rebuild and was not
part of the claimed diff/scope. Flagging only so it is not lost; does not affect this review's verdict.

## Not checked

- Did not independently verify every fact inside docs/architecture/architecture.md
  - docs/governance.md
  - docs/routing-table.md etc. that CLAUDE.md/AGENTS.md/docs/README.md now point to -- spot-checked existence
  and a few cross-references only (validation-loop.md
  - product-roadmap.md
  - architecture.md
  - governance.md
  - rebrand-migration.md
  - decisions/README.md
  - backlog/README.md all resolve).
- Did not re-run CI (bun run test
  - bun run lint
  - etc.) -- docs-only change
  - no code touched
  - no runtime
  behavior to validate.
- Did not review .gitleaks.toml
  - the untracked handoff file
  - or scripts/windows/ -- confirmed these belong
  to a concurrent/other-workstream session per the audit's own note and the task's explicit scope list; left
  untouched
  - correctly out of this review.

## Risks

- The two LOW findings are pure documentation-completeness gaps with no operational blast radius (self-caveated
  CI list; a 5-line ci-fast-path.md omitted from a map). Neither blocks merge.
- General risk inherent to any "memory file" pattern: docs/memory.md's facts will re-drift over time exactly
  like the old CLAUDE.md baseline did -- mitigated by the new mandatory Session protocol in CLAUDE.md requiring
  write-back
  - but that is a process control
  - not a technical one; only future sessions' discipline will prove
  it out.

## Confidence

high -- full diff read end to end
  - marker blocks byte-diffed against the pre-rebuild commit
  - moved-file content
byte-diffed against the correct base commit (caught and corrected an initial wrong-base comparison)
  - 4 of the
audit's evidentiary claims independently reproduced from scratch (skill count
  - versions
  - marketplace.json
absence
  - .ts/.mjs count)
  - every relative link in every touched file resolved on disk
  - and out-of-scope
surfaces (agents/
  - commands/
  - skills/
  - .claude-plugin/) confirmed untouched via git diff --stat.
- Files Reviewed:
  - CLAUDE.md
  - README.md
  - AGENTS.md
  - docs/memory.md
  - docs/README.md
  - .claude/crew/deployment.md
  - docs/research/2026-05-19-crew-architecture-analysis.md
  - docs/research/2026-05-19-crew-optimization.md
- Test Adequacy: N/A - docs/instruction-layer-only change, no runtime behavior; verified via link-resolution checks, byte-diffs of marker blocks and moved-file bodies against the correct base commit, and independent reproduction of 4 audit evidence claims (skill count, versions, marketplace.json absence, .ts/.mjs script counts).
- Non-Code Review: yes
- Judge: crew:reviewer
- Risks: Two LOW documentation-completeness gaps (AGENTS.md CI-gates list undercounts real validator set though self-caveated; docs/README.md's map omits docs/ci-fast-path.md). Neither has operational blast radius. Longer-term: docs/memory.md re-drifting over time is a process risk mitigated only by the new mandatory Session protocol in CLAUDE.md, not a technical control.
- Required Follow-up: Optional follow-up (non-blocking): (1) soften AGENTS.md's 'in order' CI-gates claim or fully enumerate all ~16 validators + advisory-validators + e2e:smoke:ux; (2) add a docs/README.md row for docs/ci-fast-path.md. Pre-existing, out-of-scope nit for a future pass: .claude/crew/deployment.md:1 still titled 'Deployment Guidance — hero-crew' (stale rename, predates this diff).

