# Spec-driven / autonomous-loop tooling landscape (as of 2026-11-05)
Verification: stars/releases via `gh api` (VERIFIED). Prose claims from blogs marked UNVERIFIED. Stale = no push in >3 months.

## Per-tool findings

### github/spec-kit  https://github.com/github/spec-kit  (VERIFIED)
- ~147.8k stars. Releases near-daily: v1.2.3 (10-22) .. v1.3.1 (2026-11-05). v1.3.0 removed core taskstoissues (moved to `github` extension).
- Flow: constitution -> specify -> clarify -> plan -> checklist -> tasks -> analyze -> implement -> **converge**. Extensions (hooks before_/after_<cmd> in .specify/extensions.yml, optional true|false = mandatory hooks), presets, workflows (prompts+commands+gates+shell), bundles.
- **converge** (templates/commands/converge.md): read-only assess of code vs spec/plan/tasks; APPEND-ONLY new "Phase N: Convergence" tasks to tasks.md; if satisfied, tasks.md left byte-for-byte unchanged; loop implement<->converge until it reports Converged. Constitution MUST violations = highest severity.
- Bug-fix extension "done" = `verified` verdict; assess extension ends go / needs-clarification / kill.
- Steal: (1) converge as post-FEAT spec-vs-code gap pass that appends slices (S-M). (2) Mandatory vs optional hooks with "must actually invoke and wait" wording (S). (3) go/needs-clarification/kill verdict for backlog triage (S).

### Fission-AI/OpenSpec  https://github.com/Fission-AI/OpenSpec  (VERIFIED)
- ~74k stars. v1.16.0 2026-10-30. Per change: proposal.md, specs/ (delta requirements+scenarios), design.md, tasks.md; archive merges deltas into main specs. No rigid phase gates by design.
- `openspec validate --strict`: scenarios must have WHEN/GIVEN and THEN steps; duplicate/misplaced requirements flagged; unreadable config exits 1 (fail closed).
- Steal: lintable scenario grammar (Given/When/Then required) enforced by a validator in CI, fail-closed on bad config (M). Delta-spec + archive-merge (L, skip).

### bmad-code-org/BMAD-METHOD + bmad-loop  (VERIFIED)
- BMAD ~55k stars, v6.12.4 (2026-10-14); v7 preview, README says ETA mid-Nov 2026. bmad-loop (https://github.com/bmad-code-org/bmad-loop): 178 stars, early open beta.
- **bmad-loop is the closest analog to our Wiggin Loop.** "No LLM in the control loop": plain Python picks story, spawns fresh-context session, completion only via agent Stop-hook event or session death, never model prose. Then VERIFY (spec status, baseline commit, non-empty diff, board in sync, user [verify] commands) -> fresh-context REVIEW (max_review_cycles default 3, can use a different CLI/model) -> VERIFY -> orchestrator commits. max_dev_attempts; plateau-deferred stories skipped and run continues; CRITICAL escalation pauses with ATTENTION file; env faults (exit 126/127, failing probe) pause without charging the attempt; deferred-work ledger (DW-n) + `sweep` triage; per-story spec_checkpoint / done_checkpoint for human approval; worktree isolation; cost-weighted token budgets; single serialized board writer.
- Steal: (1) env-fault vs real-failure distinction (S). (2) plateau-defer instead of halt (S-M). (3) deferred-work ledger + sweep (M). (4) per-slice optional spec_checkpoint/done_checkpoint (S). (5) orchestrator-owns-commit + non-empty-diff check (S).

### snarktank/ralph  https://github.com/snarktank/ralph  (VERIFIED)  22.1k stars, last push 2026-02-02 (quiet)
- bash loop; fresh instance per iteration; state = git history + progress.txt (append-only, "Codebase Patterns" at top) + prd.json (userStories[].passes, acceptanceCriteria always incl. "Typecheck passes", priority). Pick highest priority passes:false; commit only if checks pass; terminate on `<promise>COMPLETE</promise>` or max_iterations (default 10, exit 1). Archives prd/progress on branchName change.
- Sizing rule: every story must fit ONE context window; with split examples.
- Steal: Codebase Patterns consolidation section (S); "fits one context window" check in slice validator (S); archive-on-branch-change (S).

### ghuntley/how-to-ralph-wiggum  1.8k stars, last push 2026-01-11 (VERIFIED stats only).
Claude Code ralph-wiggum plugin: path under anthropics/claude-code returned 404 (not found at main). Blog claims (stop hook re-feeds prompt, exact-string promise match, jq dependency breaks Windows, built-in primitives now replace it) are UNVERIFIED.

### openai/codex /goal  https://github.com/openai/codex  (VERIFIED templates: codex-rs/ext/goal/templates/goals/)
- 133k stars, daily alpha releases. Goal mode experimental v0.128.0 (2026-04-30), default v0.133.0 (2026-05-21) per blogs (UNVERIFIED dates).
- Verified from continuation.md: persisted objective + token budget; **completion audit** (derive concrete requirements, map each to authoritative current-state evidence, uncertain/indirect evidence = not achieved, audit must prove completion not merely fail to find remaining work); **no-progress check** each turn (progress / verified wait / no progress); **blocked only after same blocker 3 consecutive turns**; never narrow scope to fit tests; separate budget_limit and objective_updated templates (objective treated as data).
- Steal: completion-audit block for slice complete / phase-gate (S, highest value); 3-consecutive-same-blocker rule and progress taxonomy for stall detection (S-M); per-goal token budget alongside cost ceiling (S).

### Kiro (AWS)  kiro.dev  (UNVERIFIED beyond launch coverage; closed IDE)
- Requirements as user stories with EARS acceptance criteria -> approval -> design -> linked tasks; agent hooks on file events. Property-based tests derived from requirements: single Aug-2026 secondary review, UNVERIFIED.
- Steal: EARS-form criteria + task->requirement traceability IDs (M).

### Others
- Pimzino/claude-code-spec-workflow: 3.9k stars, last push 2025-09-07, STALE. Skip.
- buildermethods/agent-os: 5.6k stars, v3.0.0 2026-01-20, pushed 2026-10-07. v3 narrowed to "establishing and injecting standards". Low priority (crew skills routing similar).
- eyaltoledano/claude-task-master: 28.3k stars, last release 0.43.1 2026-03-31, last push 2026-04-28, slowing. Steal: complexity score -> auto-expand oversized tasks (M).
- OpenHands: 92.7k stars, v1.35.0 2026-11-03. Resolver internals not verified. Only number found: SWE-bench Verified 53.0% (265/500), multi-file 25.3% in a 2025 study (arXiv 2509.13941, UNVERIFIED secondary).
- Aider 50k stars (last push 2026-05-22, slow). Plandex 15.9k (last push 2025-10-03, STALE). Roo-Code ARCHIVED. get-shit-done (gsd-build) 64k, ARCHIVED 2026-05-31. Cline 71k, v4.1.26 2026-10-26; memory-bank details UNVERIFIED.
- GitHub Copilot Agent HQ: Claude+Codex public preview Feb 2026, pre-share code-review step (blog-level, UNVERIFIED). Cursor plan mode: no usable results (UNVERIFIED).

## Cross-cutting answers
(a) Machine-checkable done: ralph = passes flag only after typecheck/tests; bmad-loop = orchestrator-run [verify] commands + diff/status checks, never model prose; Codex = requirement-by-requirement audit vs current state; OpenSpec = validate --strict; spec-kit = converge reports Converged.
(b) Sizing: ralph "one context window per story". Uvik benchmark: specs paid back only on tickets touching >=3 files; 1-2 file tickets: best spec arm 85% = control 85%.
(c) Termination/regression: max iterations (ralph 10; ours 25); review cycles cap 3 and dev attempts cap with plateau-defer (bmad-loop); blocked after 3 identical-blocker turns (Codex); token budgets (Codex, bmad-loop). Regression detection weak everywhere: bmad-loop re-runs VERIFY after review patches; converge re-assesses whole feature. No true regression-suite tracking found -> opportunity.
(d) State: ralph prd.json+progress.txt+git; bmad-loop resumable on-disk run state + single-writer sprint-status.yaml + deferred ledger; spec-kit append-only tasks.md + extensions.yml; OpenSpec changes/ + archive; Codex persisted thread goal. Git notes: none found. Issues: spec-kit `github` extension only.
(e) HITL: bmad-loop spec_checkpoint/done_checkpoint + ATTENTION file + resolve/confirm; spec-kit review-before-continuing, fleet extension gates; OpenSpec human reviews plan pre-code; Kiro phase approvals.
(f) Grading: none found publishing a rubric/LLM-judge grade like our 7-dimension grade. Benchmarks use blind senior human review (Uvik). bmad-loop uses adversarial fresh-context review.
(g) Metrics: Uvik SDD benchmark (uvik.net, vendor blog, Oct 2026, 50 brownfield Python tickets, claude-sonnet-5, noise band +/-10pp): merge rate Spec Kit 80%, Kiro 82%, BMAD 82%, OpenSpec 84%, no-spec 72%; cost/merged ticket $3.33/$2.35/$4.23/$2.71/$2.43; rework rounds/ticket 0.62/0.64/0.46/0.52/0.74; specs covering >=6 of 8 checklist items merged 89.3% vs 60.0%. NO success-vs-iteration-count data found anywhere.

## Top-5 adoptable mechanisms (ranked by value/effort)
1. Evidence-based completion audit prompt (Codex goal): add to /loop:slice complete and phase-gate. Effort S.
2. Deterministic orchestrator verification, no model prose (bmad-loop): loop script checks non-empty diff, baseline commit, slice status, runs verify commands; env-fault (126/127) does not consume attempts. Effort S-M.
3. Plateau-defer + stall taxonomy (bmad-loop, Codex): cap attempts per slice, defer to ledger and continue; block only after same blocker x3; classify iteration progress/wait/no-progress. Effort M.
4. Converge pass (spec-kit): append-only gap assessment after last slice of a FEAT; clean result leaves files byte-identical. Effort S-M.
5. Lintable acceptance grammar + sizing gate (OpenSpec, ralph, benchmark): require Given/When/Then and >=6/8 checklist items per slice; "fits one context window" check; skip spec ceremony for 1-2 file slices. Effort M.
Honorable: per-slice spec_checkpoint/done_checkpoint (S); deferred-work ledger + sweep (M); progress.txt Codebase Patterns (S).
