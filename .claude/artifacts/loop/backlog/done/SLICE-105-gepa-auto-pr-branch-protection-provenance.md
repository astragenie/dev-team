---
id: SLICE-105
parent: FEAT-183
status: done
priority: P1
created: 2026-06-27
title: "FEAT-183 S8a — auto-PR via gh CLI on gepa/<agent>/<trial-id> branch + branch-protection presence check + champion provenance frontmatter writer"
stack: typescript + markdown
autonomous_safe: false
est_days: 2
depends_on: [SLICE-99, SLICE-104]
touches_files:
  - scripts/lib/gepa/auto-pr.ts
  - scripts/lib/gepa/branch-protection-check.ts
  - scripts/lib/gepa/champion-provenance-writer.ts
  - scripts/lib/gepa/optimize-runner.ts
  - commands/gepa-optimize.md
  - scripts/crew.ts
  - tests/gepa/auto-pr-shape.test.ts
  - tests/gepa/branch-protection-missing.test.ts
  - tests/gepa/champion-provenance.test.ts
---

# SLICE-105: FEAT-183 S8a — auto-PR + branch-protection check + champion provenance

## Scope

Land the PR scaffolding side of promotion. This slice does NOT enable auto-merge — that's S8b. Auto-merge gate stays OFF in `gepa.config.json` until S8b ships its 5-condition gate.

- `scripts/lib/gepa/branch-protection-check.ts` — calls `gh api repos/:owner/:repo/branches/main/protection`. Returns `{ enforced: boolean, requiredChecks: string[] }`. If endpoint returns 404 (no protection configured), returns `{ enforced: false }`. Operator-supplied repo via `gh repo view` or explicit `--repo owner/name` flag.
- `scripts/lib/gepa/champion-provenance-writer.ts` — given a winning candidate trial, writes the `gepa:` YAML frontmatter block on top of the agent prompt:
  ```yaml
  ---
  gepa:
    champion_from_trial: <trial-uuid>
    prior_prompt_hash: <sha256-of-prior-prompt-without-frontmatter>
    promoted_at: <iso-datetime>
  ---
  ```
  If a `gepa:` block already exists, replace it in place (idempotent). Prior frontmatter is preserved by reading-then-rewriting the entire file via `tmp + rename` atomic swap.
- `scripts/lib/gepa/auto-pr.ts` — creates branch `gepa/<agent>/<trial-id>`, commits the prompt edit + frontmatter, opens a PR via `gh pr create`. PR title: `chore(gepa): promote <agent> from cycle <cycle-id>`. PR body includes the OptimizationResult summary, Pareto rank chain, held-out metrics, cost/latency deltas, and a link to the eval artifact. If branch-protection check returns `enforced: false`, the PR is opened with `--draft` AND the `branch_protection_missing` label is applied via `gh pr edit --add-label`. `gepa_branch_protection_missing` is logged.
- `scripts/lib/gepa/optimize-runner.ts` extended: when a winner is found and `--artifact-only` is NOT passed, calls `auto-pr.ts`. Does NOT call `gh pr merge --auto` — that's S8b.
- `commands/gepa-optimize.md` updated to document the new PR-opening behavior + `--artifact-only` flag still being available for dry-run cycles.

## Acceptance criteria

AC-1: Given a winning candidate from a `fullstack-dev` cycle, When `auto-pr.ts` is invoked, Then a new branch `gepa/fullstack-dev/<trial-uuid>` is created from `main` (NOT force-pushed over an existing branch), the prompt edit + frontmatter are committed with message `chore(gepa): promote fullstack-dev from cycle <cycle-id>`, the branch is pushed to origin, AND `gh pr create` opens a PR whose body contains the literal strings `Pareto rank`, `held-out pass`, `cost delta`, and a markdown link to `.claude/artifacts/crew/gepa/opt/<run-id>.json`.

AC-2: Given the target repo's `main` branch has branch protection configured with at least 1 required status check, When `branch-protection-check.ts` runs against the repo, Then it returns `{ enforced: true, requiredChecks: [...] }` with the actual list of required check names, AND `auto-pr.ts` opens the PR WITHOUT the `--draft` flag.

AC-3: Given the target repo's `main` branch has NO protection configured (`gh api ... /protection` returns 404), When `auto-pr.ts` runs, Then the PR is opened with `--draft` flag, the `branch_protection_missing` label is applied via `gh pr edit --add-label`, the event `gepa_branch_protection_missing` is logged with the repo name, AND auto-merge MUST NOT be attempted in S8b for this PR (the label is a downstream signal).

AC-4: Given an agent prompt at `agents/fullstack-dev.md` has NO existing `gepa:` frontmatter, When `champion-provenance-writer.ts` writes the new frontmatter, Then the file's first 5 lines are exactly `---`, `gepa:`, `  champion_from_trial: <uuid>`, `  prior_prompt_hash: <sha256>`, `  promoted_at: <iso>`, followed by `---` and the original prompt body unchanged. `node scripts/validate-agents.ts` passes (per S2 exemption).

AC-5: Given an agent prompt already has a `gepa:` frontmatter block, When `champion-provenance-writer.ts` writes new frontmatter, Then the old block is replaced in place (not duplicated), `prior_prompt_hash` reflects the hash of the prompt body WITHOUT the prior `gepa:` frontmatter (so subsequent promotions can chain hashes), and `promoted_at` reflects the new timestamp.

AC-6: Given the writer is interrupted mid-write by SIGKILL, When recovery occurs, Then the agent prompt file is either fully unchanged (atomic swap completed last successful state) or fully new (swap completed) — never a half-written file with corrupt frontmatter. The `tmp + rename` pattern guarantees POSIX atomicity; on Windows the writer uses `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING` per design line 699.

AC-7: Given a winning candidate's prompt is the same SHA-256 as the current champion (a no-op promotion attempt), When `auto-pr.ts` runs, Then no branch is created, no PR is opened, and the cycle exits with a clean `no_op_promotion` artifact field set to `true` (defensive — this shouldn't happen if Pareto math is correct, but defends against generator returning the champion verbatim).

AC-8: Given a hypothetical race where the `gepa/fullstack-dev/<trial-uuid>` branch already exists on origin (e.g. from a prior failed cycle), When `auto-pr.ts` runs, Then the existing branch is NOT force-pushed over — the script either appends a suffix (`-retry-<n>`) to the branch name OR exits non-zero with `gepa_branch_collision` event; never `git push --force`. Confirm via `git reflog` no `forced-update` entry.

AC-9: Given `gh` CLI is not authenticated (`gh auth status` returns non-zero), When `auto-pr.ts` runs, Then it exits non-zero before any branch creation with stderr directing the operator to `gh auth login`, AND no partial branch / commit is left behind.

AC-10: Given `auto-pr.ts` completes successfully, When the operator inspects the PR on GitHub, Then the PR carries the labels `gepa`, `agent:fullstack-dev`, and either `branch_protection_present` or `branch_protection_missing` depending on the protection check result.

## Dependencies

- SLICE-99 (optimize-runner): provides the winner detection. Extended in this slice to call `auto-pr.ts`.
- SLICE-104 (promotion-gate + soak-monitor): the promotion gate from S7 must approve the candidate BEFORE auto-pr.ts is called. Branch-protection check is the second-stage gate (refuses auto-merge later in S8b if missing).

## Risks

- `gh` CLI may not be installed in all consumer environments — fall back to printing the manual `git push` + `gh pr create` commands to stdout if CLI absent (do not silently fail).
- Branch protection check requires `repo:status` scope on the gh token — document in the slice run-brief.
- Force-push prevention is a hard requirement (CLAUDE.md `Never force-push to main`). Test AC-8 must use a real-ish branch fixture (or mocked `git push --no-force`).
- Champion provenance frontmatter has 5 lines — combined with the 350-line cap exemption from S2 (SLICE-97), this is fine. But if S2 exemption isn't shipped, this slice's promotion would silently exceed the cap. Verify SLICE-97 AC-8 passes before this slice begins.
- `gh pr edit --add-label` requires the labels to exist in the repo — document operator setup step in the slice run-brief (`gh label create gepa --color blue`, etc.).
- Auto-PR is a code-bearing change; reviewer must be present in the workflow per repo gates. This slice is `autonomous_safe: false` — humans review prompt edits introduced by promotion before they merge (per design's critical-agent allowlist and lead-prompt-edit policy).

## References

- Design spec "Optimize (Phase 3, manual trigger)" diagram lines 601–625 — auto-merge sub-branch.
- Design spec "Resolved concerns → C21 Branch protection presence not gated before auto-merge" (line 78).
- Design spec "Resolved concerns → C22 Champion provenance frontmatter collides with 350-line cap" (line 79) — depends on S2 exemption.
- Design spec slice plan row S8a (line 866) — acceptance evidence: "one cycle on fullstack-dev writes branch + opens PR; missing branch protection forces draft + label".
- Design spec "Risk-weighted exit gates → Before S8a auto-merge enable" (line 898).
- Design spec "Kill-switches → Champion provenance" (lines 713–722) — frontmatter shape.
- Design spec "Failure modes" table rows: "Promote auto-merge attempt", "Promote branch protection NOT configured" (lines 701–702).
- Design spec "Testing strategy → crew integration tests" row: `branch-protection-missing-blocks-merge` (line 800).
