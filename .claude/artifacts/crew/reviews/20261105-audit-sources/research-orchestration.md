# Multi-agent coding orchestration landscape (May-Nov 2026) and what crew should adopt
Date: 2026-11-05. Method: WebSearch (extended) + WebFetch of primary pages. VERIFIED = fetched primary page. UNVERIFIED = secondary blog or search snippet only.
Star counts are as shown on fetched GitHub pages (no dates shown; recency often not shown).

## A. Measured results (papers)
- CooperBench, arXiv 2601.13295 (Jan 2026, VERIFIED abstract): 600+ tasks, 12 libs, 4 langs. Two agents coordinating do about 30% worse than one agent doing both tasks alone. Causes: vague communication, broken commitments, wrong assumptions about the peer's plan.
- AgenticFlict, arXiv 2604.03551 (Apr/May 2026, VERIFIED): 142K agent PRs, 107K merge-simulated, 27.67% have textual merge conflicts.
- Xu et al., arXiv 2607.04697 (Jul 2026, VERIFIED): 33,596 agent PRs, 2,807 repos. Textual conflict 41.7% for cross-agent pairs vs 19.8% same-agent. 84.4% of conflicted files are source code; about 42% structural (modify/delete, add/add).
- BulkPR-Bench, arXiv 2608.02685 (Aug 2026; numbers from a secondary blog summary, so UNVERIFIED at source): 581 PRs, 18 repos. Best model 66.6% relation-discovery score; only 2.5% of runs gave a correct merge queue; 69.8% ended with unsafe commits. Agents obey relations they find (98-100%); discovering them is the bottleneck. Supplying gold relations lifts score 22-50 points. Lesson: declare dependencies explicitly.
- OrchBench, arXiv 2607.25656 (Jul 2026, VERIFIED): deterministic simulator of orchestration plans, r=0.816 vs real Claude Code runs at about 1.3% of the tokens. Preserving task-critical information across dependent tasks matters more than agent count; parallel gains diminish as coordination failures accumulate.
- Anthropic multi-agent research system (2025, VERIFIED, outside the window but the best-measured source): orchestrator-worker beat single agent by 90.2% on an internal eval; token use explains about 80% of variance; multi-agent costs about 15x chat tokens; subagents write outputs to external store and return lightweight references; delegation prompts need objective, output format, tool guidance, boundaries; effort-scaling rules embedded in the prompt.
- Not found: a 2026 METR multi-agent coding result or a SWE-bench multi-agent leaderboard result. "Passes Alone, Fails Together" arXiv 2609.25396: only a reference list seen, ID/date look inconsistent. UNVERIFIED.

## B. Tools

### Anthropic Agent Teams - https://code.claude.com/docs/en/agent-teams (VERIFIED)
Experimental, env CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1. Lead plus teammates (full sessions); shared task list (pending/in-progress/completed, dependency blocking with auto-unblock); self-claim with FILE LOCKING; JSON mailbox per agent at ~/.claude/teams/{team}/inboxes/{agent}.json; plan-approval handshake; graceful shutdown. Quality hooks: TeammateIdle, TaskCreated, TaskCompleted (exit 2 blocks and returns feedback). Guidance: 3-5 teammates, 5-6 tasks each, each teammate owns a distinct file set. No nested teams, no resume. Teammates cannot approve permissions for each other; auto-mode classifier screens inter-agent messages. Subagent definitions reusable as teammate roles.
Steal for crew: (1) enforce "review PASS + validation PASS" with TaskCompleted-style exit-2 hooks rather than prose in the command. Effort S-M. (2) dependency-blocked task list with auto-unblock for the wave runner. Effort M. (3) plan-approval step before builder edits on risky slices. Effort S.

### Bernstein - https://github.com/sipyourdrink-ltd/bernstein (VERIFIED, 1.2k stars, beta, solo maintainer)
One LLM call decomposes a goal into tasks with role, OWNED FILES, completion signals; then plain Python schedules (no LLM tokens for coordination). YAML DAG workflows with depends_on, max_attempts and until conditions, gate nodes on failure. A "janitor" checks tests, files, lint, types before merge. Worktree per coding task; atomic backlog claim; failed tasks retried or routed to a different model.
Steal for crew: deterministic janitor script as pre-review gate; per-task owned_files declared in handoff and checked mechanically against the git diff. Effort S-M. Retry-with-different-model escalation after N failed builder attempts. Effort S.

### Gas Town - https://github.com/gastownhall/gastown (VERIFIED, about 18.7k stars, MIT)
Mayor coordinator -> convoys of "beads" (git-backed issues) -> polecats (persistent identity, ephemeral sessions). Hooks = worktree-based state surviving crashes. Refinery = merge queue: batches completed work, runs verification gates, BISECTING queue isolates failing merges; polecats never push to main. scheduler.max_polecats caps concurrency. Witness/Deacon watchdogs detect stuck agents (nudge or handoff). No dollar budget cap found.
Steal for crew: merge-queue step after a parallel wave: serialize merges, rebase each onto updated main, rerun slice tests on the merged result, bisect on failure. Biggest gap vs the wave runner. Effort M. Stall watchdog (no artifact write in N minutes -> nudge or handoff). Effort S-M.

### Agent Orchestrator (Untrivial-ai) - https://github.com/Untrivial-ai/agent-orchestrator (from Augment roundup; repo not fetched; Apache-2.0)
Worktree+PR per session; CI failures, review comments and merge conflicts routed BACK to the originating session; auto-restart on crash.
Steal: route reviewer/validator findings and rebase conflicts back to the same builder context. Effort S.

### Baton - https://github.com/mraza007/baton (Augment roundup, MIT)
Poller/Dispatcher/Reconciler loop, worktree per GitHub issue, concurrency limit in WORKFLOW.md, reconciler detects stale runs; no gates. Steal: reconciler pass that scans runs/ for stale in-progress artifacts. Effort S.

### vibe-kanban (BloopAI) - https://github.com/BloopAI/vibe-kanban (Apache-2.0)
Worktree per task attempt, kanban cards, inline diff review, MCP planning ticket generates downstream cards; weak dependency support. Bloop reportedly announced shutdown Apr 10, 2026; community-maintained (secondary sources, UNVERIFIED). Steal: "attempt" model (several tries of one task, pick best). Effort M.

### Claude Squad - https://github.com/smtg-ai/claude-squad (VERIFIED 8.7k stars, AGPL-3.0)
tmux + worktree per session, TUI, manual handoff, no task graph, --autoyes experimental. Nothing to steal; crew is ahead on gates.

### ccmanager (kbwo/ccmanager), cmux, Conductor (conductor.build), ryanmac/code-conductor, microsoft/conductor
ccmanager: MIT, worktree sessions, no tmux, about 810 stars (one comparison; UNVERIFIED). cmux: macOS native terminal, GPL. Conductor (Melty Labs): proprietary macOS, workspace per agent. code-conductor: MIT, agents claim GitHub issues by label, Claude only. microsoft/conductor: MIT, YAML workflows with static and dynamic parallel groups, conditional routing WITHOUT an LLM in the loop, terminate steps. All from comparison pages only (UNVERIFIED beyond that).
Steal from microsoft/conductor: declarative parallel groups and non-LLM routing for the wave runner. Effort M.

### ruvnet/claude-flow - https://github.com/ruvnet/claude-flow (VERIFIED page, about 81k stars)
Swarm / "Queen-led hierarchy (Raft, Byzantine, Gossip)", vector memory, 27 hooks, cost-tracker plugin with budgets and alerts. The page itself says demos are "not evidence of completed swarm work"; headline claims (89% routing accuracy, sub-ms retrieval) lack methodology; counts inconsistent (98 vs 100+ agents). No hard spend cap or loop termination documented. Marketing-heavy. Steal: budget alert concept only. Effort S.

### Cursor 2.0 / 2.4 - https://cursor.com/blog/2-0
Up to 8 parallel agents per prompt in isolated worktrees or remote machines; same task on several models and keep the best; subagents with own context since v2.4 (secondary).
Steal: best-of-N builders for hard slices (2 builders, verifier picks). Effort M, 2x cost on those slices only.

### OpenAI Codex app - https://openai.com/index/introducing-the-codex-app/ (macOS Feb 2 2026, Windows Mar 4; official)
Built-in worktrees, scheduled automations (worktree per automation, secondary), subagents only when explicitly asked (secondary; GA date conflicts, UNVERIFIED).
Steal: scheduled sweeps for drift/validator checks. Effort S.

### GitHub Copilot Agent HQ / mission control - https://github.blog/news-insights/company-news/welcome-home-agents/
Single control plane for multi-vendor agents; policy, audit logs; agents commit only to designated branches.
Steal: per-role branch/path write allowlist enforced by hook. Effort S (gate-guard likely close).

### Antigravity 2.0 / Jules, Devin / Devin Desktop, Factory Droid, Amp, opencode
Antigravity: Agent Manager spawns subagents dynamically (93-subagent demo, single source). Devin: manager delegates to up to about 10 workers; Kanban Agent Command Center. Factory: enterprise droids across code/test/review/deploy. opencode: MIT, child sessions per subagent. Amp: cloud runners. All from comparison blogs only: UNVERIFIED, nothing concrete to steal.

### Roo Code / Kilo Code orchestrator
Roo Code shut down (announced Apr 21, archived May 15, 2026; secondary). Orchestrator (ex-Boomerang): child returns only a completion summary; orchestrator has no file/command tools by design. A Japanese article claims Kilo replaced Orchestrator with direct subagent calls: UNVERIFIED.
Steal: dispatcher without write tools (restrict /crew:* allowed-tools so it cannot implement inline). Effort S.

## C. Answers to the questions
(a) Splitting: LLM-planned task graph with owned files (Bernstein) then a deterministic scheduler; worktree per task is universal; Agent Teams uses a shared task list with dependency edges.
(b) Conflicts: worktrees stop textual conflicts during execution only; papers show 20-42% conflict at merge time and semantic conflicts remain. Real mitigations: owned-file declarations, serialized merge queue with bisect (Gas Town), conflicts routed back to the originating session (Agent Orchestrator), test the MERGED combination (BulkPR guidance). File-claim locks exist only in Agent Teams (task claim) and Bernstein (atomic backlog claim).
(c) Gates: mostly human diff review (claude-squad, vibe-kanban, emdash). Automated: Bernstein janitor, Gas Town refinery, Agent Teams exit-2 hooks. Crew's two parallel reviewers plus verifier is ahead of the field.
(d) Dispatcher patterns: lead-agent (Agent Teams, Mayor, Devin manager) vs one LLM planning call then deterministic code scheduler (Bernstein, microsoft/conductor). Evidence favors moving routing from prose into code once the plan exists.
(e) Handoff: filesystem references over relayed text (Anthropic), JSON mailboxes (Agent Teams), git-backed beads (Gas Town). Crew's structured handoff files match best practice.
(f) Cost/termination: weak field-wide. Concurrency caps (Gas Town, Baton), max_attempts (Bernstein), stall watchdogs (Gas Town), team size 3-5 (Anthropic). No tool documents repair-signature dedup; crew's is novel. Hard dollar budgets are rare.

## D. Top 5 adoptable mechanisms (ranked by impact)
1. Merge queue after each wave: serialize, rebase onto updated main, rerun slice tests on merged result, bisect on failure (Gas Town; BulkPR; papers show 20-42% conflicts). Effort M.
2. Declared depends_on and owned_files per slice, mechanically checked against the git diff and against other in-flight slices (Bernstein; BulkPR: discovery is the bottleneck, enforcement is about 100%). Effort S-M. Extends existing file-claim locks with a pre-wave overlap check and post-build diff-vs-claim check.
3. Deterministic janitor gate (tests/lint/types/owned-file check) before spawning LLM reviewers (Bernstein). Effort S.
4. Route review/validation failures and rebase conflicts back to the same builder context, bounded retries, then escalate to a different model (Agent Orchestrator, Bernstein). Effort S-M. Pairs with repair-signature dedup.
5. Gates enforced via task-completion hooks (Agent Teams exit-2 pattern) plus stall watchdog (Gas Town Witness). Effort S-M.
Honorable: best-of-N builders (Cursor); dispatcher without write tools (Roo); effort-scaling rules in dispatcher prompt (Anthropic). CooperBench suggests preferring disjoint ownership over chatty peer dispatch.

## E. Caveats
Most star counts and dates for secondary tools come from comparison blogs, some vendor-authored. arXiv 2609.25396 looks anomalous. No primary 2026 METR multi-agent coding study located. Several tools (Antigravity, Devin, Factory, Amp, opencode, Jules) have only blog-level evidence.
