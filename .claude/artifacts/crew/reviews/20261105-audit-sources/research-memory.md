# Coding-agent memory landscape (research as of 2026-11-05)

Method: WebSearch extended/standard, then WebFetch on primary pages. VERIFIED = page fetched and read. Vendor benchmark numbers are self-reported.

## 1. Claude Code native memory - VERIFIED
URLs: https://code.claude.com/docs/en/memory ; https://code.claude.com/docs/en/sub-agents
- Auto memory: Claude writes notes itself; per repo, shared across worktrees; first 200 lines or 25KB of MEMORY.md loaded each session; machine-local; toggle autoMemoryEnabled or env CLAUDE_CODE_DISABLE_AUTO_MEMORY; /memory opens it.
- CLAUDE.md: under 200 lines target; @import max 4 hops (imports do NOT reduce context cost); .claude/rules/*.md with `paths:` frontmatter load only on matching files; claudeMdExcludes; managed-policy CLAUDE.md; AGENTS.md read in place of CLAUDE.md; `/doctor prompt-audit` audits CLAUDE.md, rules, skills, subagents.
- Subagent persistent memory: frontmatter `memory: user|project|local` -> ~/.claude/agent-memory/<name>/, .claude/agent-memory/<name>/ (VCS-shareable, recommended default), .claude/agent-memory-local/<name>/. First 200 lines/25KB of that agent's MEMORY.md injected into its system prompt; Read/Write/Edit auto-enabled. Dead if auto memory is off.
- Steal: crew agents get astramem lessons via SubagentStart. Add a git-native fallback: agents with `memory: project` read a committed .claude/agent-memory/<agent>/MEMORY.md exported from astramem top-N lessons. Works when astramem is down (it returned 401 this session). Effort M.
- Steal: cap injected lesson text to the same 200 lines/25KB envelope. Effort S.
- Steal: move per-area guidance from CLAUDE.md into .claude/rules/*.md with `paths:` rather than @imports. Effort S.
- Steal: run `/doctor prompt-audit` over agents/skills in a docs pass. Effort S.

## 2. Anthropic memory tool + context editing + compaction - VERIFIED
URL: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool
- Stable (no beta header), client-side, type memory_20250818; commands view/create/str_replace/insert/delete/rename on /memories. API auto-injects "ALWAYS VIEW YOUR MEMORY DIRECTORY FIRST ... ASSUME INTERRUPTION". Security guidance: path-traversal validation, strip sensitive data before write, cap file size, expire unused files.
- Documented multisession software pattern: initializer session creates progress log + feature checklist + init script; each session reads at start and updates at end; mark a feature complete only after end-to-end verification. Companion post https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents is referenced, not fetched (UNVERIFIED content).
- Compaction = server-side summarizer; docs recommend memory + compaction together. Context editing (clear_tool_uses_20250919) current status UNVERIFIED (only secondary mirror read; original beta header context-management-2025-06-27).
- Steal: crew run-brief/handoff/final-synthesis already match this pattern. Add the "complete only after e2e verification" check to /loop:slice complete. Effort S.
- Steal: memory expiration - lessons never recalled or never marked helpful in N runs get demoted. Effort M.

## 3. Letta Context Repositories (MemFS) - VERIFIED (blog, 2026-02-12)
URL: https://www.letta.com/blog/context-repositories
- Memory = markdown files in a git repo; file tree always in system prompt, each file has frontmatter description; system/ dir = always loaded, agents move files in/out to control context; each memory subagent gets its own git worktree and merges back; background reflection (sleep-time) and defragmentation (split big files, merge dupes, restructure to 15-25 files). No quantitative results published.
- Steal: recall payload as "index + descriptions always, bodies on demand". Dispatch injects top-K one-line lesson titles + ids (~300 tokens); agent expands via astramem recall(id). Effort M.
- Steal: scheduled defrag of agent-profile lessons (merge dupes, cap per agent ~25) with snapshot first. Effort M.

## 4. Beads (steveyegge/beads) - VERIFIED (README)
URL: https://github.com/steveyegge/beads (28.5k stars)
- Dolt-backed (version-controlled SQL), hash IDs avoid merge collisions, hierarchical IDs, `bd ready`, `bd update --claim` (atomic), `bd dep add`, compaction ("memory decay": summarize old closed tasks), `bd prime` (prints workflow context + stored memories), `bd remember "insight"`, sync via `bd dolt push/pull` on refs/dolt/data of a git remote. issues.jsonl is only an export.
- Steal: hash-based ids for lessons/FEATs created in parallel worktrees. Effort S-M.
- Steal: decay by compaction - closed backlog items older than N days summarized to 3 lines at wake-up. Effort S.
- Do not adopt Dolt; the committed backlog tree already works.

## 5. ACE - Agentic Context Engineering - VERIFIED (repo + paper listing)
URLs: https://arxiv.org/abs/2510.04618 (ICLR 2026) ; https://github.com/ace-agent/ace (Apache-2.0)
- Generator / Reflector / Curator. Playbook = itemized bullets with id, helpful and harmful counters; delta updates only (avoids "context collapse"); deterministic merge with dedup (optional similarity 0.9) and pruning. Reported +10.6% agents, +8.6% finance.
- Steal (best fit): helpful/harmful counters per astramem lesson. Feedback-after-run already exists; make it update counters on exactly the lesson ids injected at SubagentStart. Rank and prune by (helpful - harmful), delta-only edits, supersede instead of rewrite. Effort M.
- Steal: similarity ~0.9 dedup gate on lesson write. Effort S.

## 6. claude-mem (thedotmack) - VERIFIED (README)
URL: https://github.com/thedotmack/claude-mem (~113k stars, v15.9.0 badge, Apache-2.0)
- 6 lifecycle hooks, AI-compressed observations, SQLite + FTS5 + Chroma hybrid search. Progressive disclosure: search (compact index ~50-100 tokens/result) -> timeline -> get_observations (~500-1000 tokens/result), claims ~10x saving. <private> tags exclude content from storage. No explicit token budget.
- Steal: 3-layer recall API on astramem (index / context / full); dispatch uses layer 1 only. Same change as Letta item. Effort M.
- Steal: <private> exclusion honored by feedback-save, plus secret-regex scrub (gitleaks config already staged in this repo). Effort S.

## 7. gbrain (garrytan) - VERIFIED (README)
URL: https://github.com/garrytan/gbrain
- Markdown repos canonical; DB (PGLite or Postgres+pgvector) is a rebuildable index. Hybrid search (vector+keyword, RRF, source-tier boost, optional reranker). Typed graph. Overnight "dream cycle": dedup, citation fixes, salience scoring, contradiction finding. `gbrain think` gives cited answers and flags stale/contradictory pages. BrainBench R@5 0.6626 -> 0.7241 with graph. `skillopt` optimizes SKILL.md against judges (~$1). Trust policy: source/operation grants and visibility filters; durable preferences shareable across agents, transient task state stays local; off-machine relay opt-in and redacted.
- Steal: markdown canonical, service is a rebuildable index. Export every astramem lesson to repo markdown so history is the audit trail and astramem can be rebuilt. Effort M.
- Steal: nightly contradiction/staleness report (report only). Effort M.
- Steal: visibility classes on lessons: durable-shareable vs task-transient-local. Effort S.

## 8. dream-skill (timoncool) - VERIFIED, tiny repo (3 stars)
URL: https://github.com/timoncool/dream-skill
- Read-only dream pass writes proposals only; evidence rule (nothing marked stale without test -e/grep, else [UNVERIFIED]); wake applies only checked or validator-approved items after snapshot; validator default is reject; soft delete to TRASH, 30-day purge; rollback command. Author reports validator rejected 2 of 18 proposals.
- Steal the pattern, not the dependency: propose -> independent validator -> apply with snapshot, never rm. Maps onto the reviewer gate. Effort M.

## 9. Mem0 - VERIFIED (vendor blog, dated 2026-11-02)
URL: https://mem0.ai/blog/state-of-ai-agent-memory-2026
- Vendor claims LoCoMo 92.5, LongMemEval 94.4, BEAM 1M 64.1 / 10M 48.6; ~6,956 tokens per retrieval call. April 2026 algorithm: single-pass add-only extraction; retrieval fuses semantic + BM25 + entity matching; external graph store replaced by built-in entity linking (relations field removed). OpenMemory MCP = local-first MCP server with dashboard. Page warns no single benchmark is universal; procedural-memory tooling "still early-stage".
- A separate paper (arXiv 2606.16707, search snippet only) reports Mem0 at 29.3% on full LoCoMo: UNVERIFIED, conflicts with vendor figure.
- Steal: multi-signal fusion (semantic + BM25 + entity match) for dispatch recall; entity = file paths, agent role, FEAT id. Effort M.
- Do not use LoCoMo to make decisions; it measures dialogue recall, not coding.

## 10. Benchmarks that matter more than LoCoMo
- AMA-Bench - VERIFIED via abstract/search: https://arxiv.org/abs/2602.22769 (ICLR/ICML 2026). Memory systems often lose to plain long-context on long-horizon agent trajectories because of lossy compression and similarity-only retrieval; they miss causality and objective details. AMA-Agent (causal graph + tool-based retrieval) 57.22%, +11.16 over best memory baseline. Lesson: keep objective facts (commands, paths, results) and cause links, not only LLM summaries.
- DolphinBench - PARTIAL: https://arxiv.org/abs/2609.24971. Task-completion benchmark, 200 tasks per persona each verified to pass with history and fail without; mandates cost and latency reporting. No results read.
- "Skill Issue" - VERIFIED abstract: https://arxiv.org/abs/2609.12742. Tasks mined from reverted merged PRs at frozen base commit; score = same agent with vs without document. GEPA-optimized repo docs +4.9pp avg (not separable from run variance on 3 repos); SkillOpt +0.1pp. Easy synthetic tasks give no signal.
- Steal (memory-delta evals): build the eval set from our own reverted/fixed commits and review-fail artifacts at a frozen base commit; metric = pass rate with astramem recall vs without; at least 5 repeats for variance; report cost and latency; include a no-memory baseline in every GEPA run. Effort M-L.

## 11. Self-evolving / skill-learning
- Self-Evolving Coding Agents survey: https://arxiv.org/abs/2608.03392 (abstract only). Failure modes: feedback reliability, benchmark overfitting, reversibility, cost, safety.
- UniM0cha/self-improving-skills (curator merges skills into umbrellas, library cap, archive thresholds, approval) - search snippet only: UNVERIFIED.
- SkillGLoW 2609.02217, MemSkill (NeurIPS'26), Agent Skills Matter 2607.25560 - titles only: UNVERIFIED.
- Steal: every automated lesson edit must be snapshot-revertible. Effort S.

## 12. Cursor / Cline / Roo / Windsurf / others
- Cursor removed Memories in 2.1 (vendor blog only, UNVERIFIED primary): https://blog.memoryplugin.com/cursor-memory/ . Signal: opaque auto-memories dropped in favor of explicit rules.
- Cline Memory Bank = six markdown files (projectbrief, productContext, activeContext, systemPatterns, techContext, progress); community convention; no 2026 deprecation found (UNVERIFIED primary).
- Windsurf memories, Roo, Cognee, LangMem, Supermemory, Zep/Graphiti 2026 releases, Dynamic Cheatsheet: no primary page verified. Graphiti MCP server dates from 2025 (secondary). All UNVERIFIED.

## Answers to the six questions
(a) What to store: lessons (procedural, with trigger, evidence, counters) injected at dispatch; facts live in repo files (docs/memory.md, CLAUDE.md, rules); episodic (handoffs, run briefs) stays as artifacts retrieved by index. Keep objective details (AMA-Bench).
(b) Retrieval: index-first progressive disclosure (claude-mem, Letta), hard budget (Claude Code 200 lines/25KB), multi-signal ranking (Mem0), role + path scoping (paths: rules).
(c) Write-back: delta edits with helpful/harmful counters (ACE), similarity dedup gate, supersede not rewrite, snapshot + validator + soft delete (dream-skill), periodic defrag (Letta).
(d) Evals: with/without memory on real repo-history tasks, variance-aware, cost reported (Skill Issue, DolphinBench, AMA-Bench).
(e) Sharing/privacy: scope tiers user/project/local (Claude Code subagents), visibility classes (gbrain), <private> tags (claude-mem), strip secrets before write (Anthropic docs).
(f) Git-native vs service: converging on hybrid - markdown/git canonical, service is a rebuildable index (gbrain, Letta, Beads export). Pure service-backed has a single point of failure (astramem 401 this session).

## Top 5 for crew/astramem (ranked)
1. ACE-style helpful/harmful counters + delta/supersede on lessons (M).
2. Index-first budgeted recall at SubagentStart: titles + ids, expand on demand, hard cap (M).
3. Memory-delta eval rebuilt on real reverted/fixed commits with no-memory baseline, repeats, cost (M-L).
4. Markdown-canonical export of lessons + git-native fallback via .claude/agent-memory/<agent>/MEMORY.md (M).
5. Dream/defrag hygiene job: propose -> validator -> apply with snapshot, soft delete, 0.9 dedup (M).
Quick wins (S): paths-scoped rules instead of imports, /doctor prompt-audit, <private> + secret scrub on save, complete-only-after-e2e check, compact old closed backlog items.
