---
id: FEAT-164
status: triaged
priority: P2
category: bugfix
target_release: null
created: 2026-06-14
updated: 2026-06-20
triaged_at: 2026-06-20
depends_on: []
slices: []
derived_from: null
autonomous_safe: false
tags: [crew-parallel, worktree, cleanup, dx, windows]
pm_customer_impact: 0.80
pm_effort_estimate: 0.65
pm_strategic_alignment: 0.75
pm_technical_risk: 0.70
pm_dependency_depth: 0.30
composite_score: 0.61
proposed_slices:
  - id_suffix: -SLICE-A
    title: Dry-run inventory phase — list orphan worktrees + branch deltas, no destructive ops
    points: 2
  - id_suffix: -SLICE-B
    title: Destructive teardown — cherry-pick handoffs, remove worktrees, prune branches, Windows handle-leak hint
    points: 3
triage_notes: |
  via=pm triage 2026-06-20 (FEAT-164).

  Demand: Cited from FEAT body — loopobserver 2026-06-13→14 accumulated 22 worktrees (~5 GB), 22 stale branches, 5 orphan handoff artifacts, 1 lost test-infra fix (IApiMarker.cs / IntegrationFixture<IApiMarker> on wave-1/feat-163b-tenancy), and 4 worktree dirs still stuck on Windows due to VS Code TS server holding tailwindcss-oxide.win32-x64-msvc.node mmap'd. Manual cleanup = ~$1.50 / ~30 min per cycle. Single stakeholder (maintainer) but recurring every parallel wave; workaround is tolerable but accrues debt linearly with autonomous-loop adoption.

  customer_impact 0.80: concrete disk/cost/lost-work numbers in body — not "users would like"; recurring daily-frequency pain during active autonomous-loop use; tolerable manual workaround caps it below 0.9.

  effort 0.65: 5 AC, multi-file, destructive git ops with safety prompts, cherry-pick logic, Windows handle-leak detection, structured operator prompts. Natural implementation home is the loop plugin's `dispatch finalize` (per agents/parallel-runner.md L47-48: "Worktree creation/cleanup or merge logic delegated to loop dispatch since v0.32.0"), so cross-plugin touch (hero-crew skill text + loop CLI). Cost analog: FEAT-148 builder-scoped self-verify (cross-module contract-shape) = $25.27 / 38 msgs (20260610T200000Z aggregate). FEAT-163 SLICE-71+73 destructive-orchestration analog suggests $35-60 across 2 slices. No exact cost analog — scored from rubric.

  strategic_alignment 0.75: unblocks autonomous parallel-runner adoption (every wave currently leaves debt the operator must clean by hand); aligns with constitution Core Rule 7 (leave durable artifacts, don't lose work). Not roadmap centerpiece (observability bridge / workflows / agent eval are) — this is a reliability foothill that gates parallel-runner expansion.

  technical_risk 0.70: destructive git ops (`git worktree remove --force`, `git branch -D`) on production worktrees + branches — can erase unmerged work. Mitigations in AC (pre-remove inventory + auto-cherry-pick for `.claude/artifacts/crew/handoffs/` + default-keep prompt for WIP + preserve-on-BLOCKED) move risk band from "very high" to upper-end of 0.6-0.8 ("new pattern OR schema/data-shape change; rollback needs migration or state cleanup"). Cross-plugin contract change (hero-crew skill + loop dispatch CLI) is a published-artifact reach but `git revert` of the teardown patch cleanly restores prior leak-prone-but-safe behavior. Not 0.9+: no irreversible artifact contract; the irreversible scenario (auto-delete unmerged work) is exactly what AC-3 and AC-5 prohibit.

  dependency_depth 0.30: no upstream FEAT blockers. Cross-plugin coordination (loop `dispatch finalize` + hero-crew `commands/parallel.md`) is sequencing, not dependency. Latent SPEC-time question: per memory `feedback_never_fan_out_lead` (HARD RULE) and grade SLICE-79 lesson ("Nested crew:lead as subagent is fundamentally broken … fabricated a complete-looking success report"), DEC-015's Path A (crew:lead per worktree) is contradicted by lived experience — but this is orthogonal to teardown and belongs in a separate FEAT or the SPEC for whichever specialist replaces lead.

  Weak-dimension check (last 5 grades): observability 0.776 and product_completeness 0.75 are weak. FEAT-164's AC must surface (a) a single grep-able stderr line per teardown step (per memory `project_plugin_observability_ceiling` — plugin obs ceiling = one line, not JSON/ULID) covering "inventory done", "worktree removed", "branch pruned", "WIP-kept" events; and (b) a completeness AC requiring the run summary artifact (`.claude/artifacts/crew/runs/<ts>-parallel.md`) to list per-worker teardown outcome (clean | wip-kept | rmdir-stuck | preserved-on-blocked) so the operator can audit without running git commands. Both gaps must be closed by spec-writer.

  Pre-mortem (mandatory at P2 because risk >= 0.6):

  1. Two weeks later, most likely failure cause: silent default-discard regression on uncommitted WIP because the operator prompt UX was wired but the "default: keep" branch was inverted in code; review missed it because there is no integration test that asserts "WIP file present then file survives teardown when prompt is auto-answered yes/keep". Coverage gap so AC must require an integration test that creates a worktree, writes a WIP file, runs teardown with prompt auto-answered default, and asserts the file is still readable from the recovered location.

  2. Rollback path if merged and broke loop: per-slice git revert of the destructive slice (SLICE-B) only; SLICE-A (inventory dry-run) is purely additive and stays. Coordinated revert across hero-crew + loop plugin if dispatch finalize is the implementation home — bump loop to a hotfix patch version that no-ops teardown and pin hero-crew skill to the prior loop version. NO migration needed because no state schema changes; only git/filesystem side effects, which are absorbed by rolling back the code that triggers them.

  3. Existing test that would NOT catch a regression here: scripts/e2e-smoke.ts does not exercise parallel-runner or worktree teardown at all; agent-prompt-content.test.ts only checks markdown shape. The destructive ops live below the test horizon. The slice's AC MUST add a multi-worktree integration test under tests/ that exercises: (a) clean PASS so 0 worktrees + 0 stale branches remaining; (b) WIP present so kept (default); (c) handoff-only diff so auto-cherry-picked to main; (d) BLOCKED worker so preserved.

  Decomposition: maps to ~5 points (effort 0.65 below the 8-pt fan-out threshold). Recommend two slices: SLICE-A = read-only dry-run inventory phase (autonomous_safe: true, ships first as audit-only — no destructive ops, just lists what teardown WOULD do, plus the cherry-pick preview); SLICE-B = destructive teardown gated behind a second invocation (autonomous_safe: false — operator-in-loop on first 3 runs to validate prompt defaults, then revisit). proposed_slices block recorded above.

  autonomous_safe: false — destructive git ops on real branches + worktrees; AC-3 + AC-5 explicitly require operator prompts; loop cannot run unattended without bypassing those gates. SLICE-A can ship autonomous_safe: true (read-only inventory); SLICE-B must stay human-in-loop until a track record exists. Recommend operator-in-loop for the first 3 production runs of SLICE-B before flipping its autonomous_safe.

  Recommendations: (1) Open a SPEC via /runner:spec-writer so a single author can sequence SLICE-A then SLICE-B with the test plan above. (2) Reconcile DEC-015 (per-worktree crew:lead) against grade SLICE-79 lessons + memory feedback_never_fan_out_lead — likely a separate FEAT, but the SPEC-writer should reference this when writing the per-worker dispatch ceremony that teardown observes for "BLOCKED" detection. (3) Coordinate with loop plugin: bump loop minor when `dispatch finalize` learns teardown; pin hero-crew skill to that floor.
---

# FEAT-164: `/crew:parallel` leaves orphan worktrees + branches after merge — no auto-cleanup

## Description

`/crew:parallel` spawns N sibling worktrees under `.claude/worktrees/<slug>/`, dispatches a `crew:lead` agent per worktree, then merges DONE branches back to main. **It does not clean up the worktrees, branches, or supporting infrastructure when the work lands.**

### Observed failure (loopobserver, 2026-06-13 → 2026-06-14)

After ~22 parallel waves over a 24h period, the host repo accumulated:

- **22 worktree directories** under `.claude/worktrees/` (~5 GB on disk; each carries a full `node_modules/` + `bin/` + `obj/`)
- **22 stale branches** (all squash-merged into `main`, leaving each branch's last commit a docs-only handoff that never made it onto `main`)
- **5 orphan handoff artifacts** (`SLICE-NNN-handoff.md`, `SLICE-170-handoff.md`, etc.) that exist only on the worktree branches — not on `main`. Recovery required manual cherry-pick.
- **1 useful test-infra fix** (`IApiMarker.cs` + `IntegrationFixture<IApiMarker>` swap on `wave-1/feat-163b-tenancy`) that resolved a real `WebApplicationFactory<Program>` ambiguity bug — also never reached `main`. Recovery required manual diff + copy + commit.

Manual cleanup cost:
- 1 session (~30 min, ~$1.50) to audit, diff, cherry-pick, and prune
- 4 worktree dirs **still stuck** because VS Code's TS / Tailwind language servers hold `node_modules/@tailwindcss/oxide-win32-x64-msvc/tailwindcss-oxide.win32-x64-msvc.node` mmap'd. `rm -rf` returns `Access denied` on Windows until VS Code is restarted.

### Root cause hypotheses (need investigation)

1. **No teardown phase in `/crew:parallel`** — the orchestrator merges then exits. No `git worktree remove --force` / `git branch -d` per merged worker.
2. **No artifact-roll-forward** — `crew:lead` writes the slice's final handoff under the worktree's `.claude/artifacts/crew/handoffs/`. On squash-merge those files get squashed away, so the handoff lives only on the worker branch tip. Loop ceremony assumes the handoff is on `main`.
3. **No detection of useful uncommitted WIP** — if a `crew:lead` self-verify loop writes a fix but the final synthesis crashes mid-write, the fix sits as `?? working-tree` files on the worker branch. Without teardown audit, those files vanish when the worktree is later removed.

### Why this matters

- **Disk pressure** — each worktree is 100–400 MB (Win + node_modules). 20+ accumulate fast.
- **Branch sprawl** — `git branch` lists become unreadable. Hooks that iterate branches slow down.
- **Lost work** — useful incidental fixes captured during a slice (test-infra, gitignore, handoff docs) don't reach `main` unless the operator manually inspects every worker branch before deletion.
- **Windows handle-leak amplifier** — on Windows the longer worktrees sit, the more chance a long-lived language server (VS Code, JetBrains) attaches to their `node_modules`, blocking later cleanup.

## Acceptance hints

### Scope

- Audit `/crew:parallel` skill + supporting CLI for the existing merge-back path. Identify where teardown SHOULD hook in.
- After successful merge of a worker's branch to main, the orchestrator MUST:
  1. **Inventory the worker branch BEFORE remove** — log:
     - Any files present on the worker branch but not on `main` (paths + 1-line stat)
     - Any uncommitted WIP in the worker worktree (`git status --short`)
     - Surface this to the operator with `keep | cherry-pick | discard` choice (or auto-cherry-pick when path is under `.claude/artifacts/crew/handoffs/`)
  2. **Remove worktree** — `git worktree remove --force <path>` followed by directory rmdir; on Windows, attempt rmdir twice and warn loudly if a handle-leak blocks the second attempt (suggest restart of VS Code / TS server).
  3. **Delete branch** — `git branch -D <worker-branch>` after worktree removal succeeds.
  4. **Prune metadata** — `git worktree prune` regardless of rmdir outcome (so the worker is at least invisible to `git worktree list`).
- On worker FAILURE (`crew:lead` returns `BLOCKED` or `escalated_to_human`), do NOT auto-delete. Leave worktree + branch in place + emit a `worker-failed` artifact pointing the operator at the worktree path + last DEC log.

### Out of scope

- The Windows handle-leak itself (that's a VS Code / Tailwind upstream issue). Just detect it and surface a useful hint.
- Worktree pre-creation hygiene (this FEAT is about post-merge cleanup).

### Acceptance criteria (Given-When-Then sketch — needs spec-writer pass)

- **AC-1:** Given `/crew:parallel` dispatches 3 workers that all PASS and merge cleanly, when the orchestrator returns, then `git worktree list` shows only `main` and `git branch | grep <worker-prefix>` returns empty.
- **AC-2:** Given a worker branch has a file at `.claude/artifacts/crew/handoffs/SLICE-NN-handoff.md` not present on `main`, when the orchestrator merges and tears down, then that file is auto-cherry-picked onto `main` in a separate commit titled `docs(handoff): SLICE-NN — recovered from worker branch`.
- **AC-3:** Given a worker worktree has uncommitted WIP at remove time, when teardown runs, then the operator sees a structured summary (file paths + stat) and a `keep | discard` prompt (default: keep — never silently discard).
- **AC-4:** Given a worker worktree's rmdir fails (handle leak), when teardown runs, then `git worktree prune` still runs (metadata cleaned), the orphan dir is logged with explanation + suggested fix, and the orchestrator does NOT block subsequent worker teardowns.
- **AC-5:** Given a worker returned `BLOCKED`, when teardown runs, then the worktree + branch are preserved and a `worker-failed-N.md` artifact records the cause.

### Evidence required

- Repro recipe (clone loopobserver, run `/crew:parallel` 5 times in quick succession on different FEATs, count leftover worktrees → must be 0)
- Cross-platform behavior note for Windows handle-leak detection
