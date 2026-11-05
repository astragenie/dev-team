# Community Claude Code plugin/skill collections, May-Nov 2026 (as of 2026-11-05)

Method: GitHub REST API via `gh` (stars, pushed_at, release notes, file contents) plus README/source reads. Every URL below was fetched through the GitHub contents API in this session unless marked UNVERIFIED. WebSearch was not used; discovery was via GitHub repo search (`claude code plugin`, `topic:claude-code-plugin`).

Caveat on star counts: several figures are implausibly high for repo age (ECC 297k in 9.5 months, ponytail 185k, i-have-adhd 60k, ruflo README shows an "illustrative download counter"). Treat stars as a popularity signal only, not a quality signal. Content-level evidence is given instead.

## Table

| Repo | Stars | Last push | Novel idea | Adopt? |
|---|---|---|---|---|
| obra/superpowers (v7.0.2, 2026-11-03) | 312.9k | 2026-11-03 | Skills must stay under 20,000 bytes because Claude Code re-attaches skills truncated at 20k chars after compaction; CI test enforces it; overflow goes to `references/` read at the step that needs it. Fresh implementer subagent per task, one combined spec+quality task reviewer, then whole-branch review. `diagnosing-superpowers` session forensics skill ("no citation, no finding"). Blind-graded behavioral A/B for skill changes. | Y, S/M |
| garrytan/gstack (v1.96.0.0, 2026-11-05) | 139.8k | 2026-11-05 | `SKILL.md.tmpl` plus generated SKILL.md (`gen:skill-docs`), shared "preamble" pieces as toggleable modules, per-model `model-overlays/*.md`, per-model "loadouts" (full/lite) only changed after a preregistered eval, tiered E2E tests (gate vs periodic) selected by `git diff` touchfiles, `runaway-stopper`, `verify` loop with `UNMAPPED`/`ZERO_RUN` verdicts, ship "review army" + adversarial pass. | Y (selective), M/L |
| affaan-m/ECC | 297.7k | 2026-11-02 | 71 agents, 314 skills, 98 commands. `continuous-learning-v2`: PreToolUse/PostToolUse observation, background Haiku analysis, atomic "instincts" with 0.3-0.9 confidence, project-scoped, promoted to global when seen in 2+ projects. `context-budget` skill that refuses to scan and routes to native `/context`. GateGuard hooks. `pi/core` curated 123-skill profile. | Partial, M |
| wshobson/agents | 42.2k | 2026-11-05 | Single Markdown source, adapters generate 7 harness formats. Invariants: AGENTS.md capped about 150 lines, skill bodies about 8 KB, "mechanical enforcement with remediation hints" on every lint finding. `plugin-eval` static scorer with a committed score snapshot keyed by sha256 of skill files; LLM-judge layers explicitly labelled unvalidated. Trace-based eval program (error analysis first). | Y, S/M |
| anthropics/skills | 187.7k | 2026-10-28 | Reference skill layout (`skills/`, `spec/`, `template/`); `skill-creator` skill (evals, description tuning); `claude-api` skill kept current each model release. | Y (reference), S |
| google/elephant-goldfish-model (EGM) | 12.3k (created 2026) | 2026-11-04 | "Design with an elephant, review with a goldfish": zero-context reviewer subagents (`agents/`: comprehension, design_critic, implementation_readiness, structural, style, synthesizer, zoom_out) review a spec without the conversation. `egm-review-loop`, `egm-drift-report`. | Y, M |
| openai/codex-plugin-cc | 34.9k | 2026-07-08 | Cross-model review: `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`, background jobs `status/result/cancel`. | Maybe, M |
| mksglu/context-mode | 33.5k | 2026-11-05 | Tool output goes to a local SQLite sandbox index; agent gets only what it queries ("Thinking in Code": write a script, only printed output enters context). Claims 99.4% output-byte savings (vendor benchmark, UNVERIFIED independently). Source-available (ELv2), not MIT. | N for now, L |
| OthmanAdi/planning-with-files | 27.9k | 2026-11-04 | `task_plan.md`/`findings.md`/`progress.md` on disk, hook injects plan every turn, survives `/clear` and compaction. Claims blind A/B 3 of 3 (UNVERIFIED). | N (crew artifacts already cover this) |
| tamaratran/fast-jev-compaction | 7.9k | 2026-09-18 | Replaces compaction summary with verbatim retention: score every tool call/result, delete stale ones, never rewrite text. | Watch, M |
| tigerless-labs/autoharness | 10.7k | 2026-11-04 | Self-maintaining skill layer: learn from sessions, merge same-scenario skills, prune unused, touch only skills it wrote, per-skill evidence ledger. "Validated in use" = adherence in later turns. | Idea only, M |
| revfactory/harness | 9.3k | 2026-09-28 | Meta-skill that generates agent teams; 6 architecture patterns; tier-per-agent model policy (fable/opus/sonnet) forbidding blanket pins; with-skill vs without-skill A/B. | Idea only |
| DietrichGebert/ponytail | 185.1k | 2026-10-29 | Anti-overbuilding skill with published agentic benchmark (39 tasks, 5 runs each, with/without skill). Claims -53% code, 98% risky logic tested. | Idea only (benchmark method), S |
| thedotmack/claude-mem | 113.4k | 2026-11-05 | Capture tool observations, compress, inject next session. | N (we have astramem) |
| davila7/claude-code-templates | 33.1k | 2026-11-05 | About 1,900-component catalog, one-line installer. Catalog not design. | N |
| hesreallyhim/awesome-claude-code | 57.3k | 2026-11-05 | Curated list, bot-updated. Discovery source only. | N |
| VoltAgent/awesome-claude-code-subagents | 26.4k | 2026-11-02 | 161+ subagent prompts, sponsor-funded. Breadth, little structural novelty seen. | N |
| ruvnet/ruflo (ex claude-flow) | 81.0k | 2026-11-05 | "Agent meta-harness"; README is marketing-heavy (illustrative counters). Not read deeply. | N (UNVERIFIED depth) |
| SuperClaude-Org/SuperClaude_Framework | 23.9k | 2026-09-27 (last release v4.3.0, 2026-03-22) | 30 commands, 20 agents, 7 modes. Slowing. | N |
| Pimzino/claude-code-spec-workflow | 3.9k | 2025-09-07 | Stale for 14 months. Spec to tasks workflow. | N |
| centminmod/my-claude-code-setup | 2.7k | 2026-10-08 | CLAUDE.md templates (dual memory, progressive disclosure) updated May 2026. | N |

## Findings by question

### (a) Keeping prompts short
- superpowers: hard 20,000-byte ceiling per SKILL.md, tested in `tests/skill-size/test-skill-size.sh`. Reason is a platform behavior, not style: after compaction Claude Code re-attaches each skill cut at 20,000 chars. A reported run lost its "five-round limit" and ran 18 fix rounds. Fix: move rarely needed procedure into `references/*.md`, read at the step that needs it. https://github.com/obra/superpowers/releases/tag/v7.0.1
- wshobson: AGENTS.md about 150 lines, skills about 8 KB, detail in `references/details.md`; adapters enforce body-size caps. https://github.com/wshobson/agents/blob/main/ARCHITECTURE.md
- gstack: skills generated from `.tmpl` plus `sections/` fragments; per-model "lite" loadout drops ten preamble modules for Opus 5.5 only after measurement. https://github.com/garrytan/gstack/blob/main/docs/loadouts.md and https://github.com/garrytan/gstack/blob/main/modules/loadouts.json
- gstack model overlays tell each model family how to read instructions (Sonnet 5: "instructions are read literally", re-baseline holdover style directives). https://github.com/garrytan/gstack/blob/main/model-overlays/sonnet-5.md
- superpowers v6.4.2: `writing-plans` records decisions not code; plans took a quarter of the time and a third of tokens. https://github.com/obra/superpowers/releases/tag/v6.4.2

### (b) Review and verification structure
- superpowers SDD: implementer per task, one task reviewer returning two verdicts (spec compliance, then quality) from a pre-generated diff file the reviewer reads once and may not re-crawl, `re-review-prompt.md` for fix rounds, capped fix loop, whole-branch final review. https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/task-reviewer-prompt.md
- Model selection is mandatory in the reviewer template ("an omitted model silently inherits the session's most expensive one").
- "Rulings, not stalls": autonomous runs decide and log `Ruling: what, why, cost if wrong` rather than pausing; only four stop conditions (destructive, security-sensitive, outside-worktree side effect, plan so broken every path is a guess). https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md
- EGM: zero-context "goldfish" reviewers on specs. https://github.com/google/elephant-goldfish-model
- gstack `/verify`: deterministic `gstack-checks detect/run` emits `CHECK <name> <VERDICT>`; verdicts `UNMAPPED` (touched file with no covering test), `ZERO_RUN`, `TOO_BROAD`; "a changed file breaking an untouched test is your bug" unless red before first edit. Repo commands require explicit trust. https://github.com/garrytan/gstack/blob/main/verify/SKILL.md.tmpl
- gstack ship review army: a review plan script picks specialists and depth, with a pinned adversarial pass. https://github.com/garrytan/gstack/blob/main/ship/sections/review-army.md
- codex-plugin-cc: foreign-model adversarial review as a second opinion. https://github.com/openai/codex-plugin-cc

### (c) Parallel subagents / worktrees
- superpowers: `dispatching-parallel-agents` and `using-git-worktrees` skills; v7.0.2 helper scripts take `-C DIR` and refuse to run outside a repo (they previously wrote workspaces into the plugin cache). Absolute-path invocation with a test that fails on relative helper paths.
- revfactory/harness v2 maps six team patterns to three execution modes (workflow script, persistent named agents with SendMessage, one-shot delegation). https://github.com/revfactory/harness
- gstack: `runaway-stopper` scans for runaway threads/subagents and rotates them (Capy-specific tooling). https://github.com/garrytan/gstack/blob/main/runaway-stopper/SKILL.md.tmpl

### (d) Agent memory / learnings
- ECC `continuous-learning-v2`: instincts as small YAML files with trigger/confidence/domain/scope, observed through Pre/PostToolUse hooks, analyzed by a background Haiku agent, project-scoped by git remote hash, promoted global at 2+ projects. https://github.com/affaan-m/ECC/blob/main/skills/continuous-learning-v2/SKILL.md
- autoharness: merge same-scenario skills, prune unused, only touch self-authored skills, ledger per skill. https://github.com/tigerless-labs/autoharness
- claude-mem / planning-with-files: session capture and on-disk plan; overlap with crew artifacts and astramem.
- superpowers `diagnosing-superpowers`: reads session transcripts on disk and reports with `path:line` citations. https://github.com/obra/superpowers/blob/main/skills/diagnosing-superpowers/SKILL.md

### (e) Measuring skill quality
- superpowers: blind-graded multi-run scenario tests quoted in release notes (e.g. 8/8 vs 0/8 option-with-recommendation; skipped design doc 24/24 before, 3/24 after). Pressure-test prompts moved out of the installed skill dir to `tests/` so agents cannot find them mid-task (v7.0.2). Skill-size and skill-layout tests exist.
- wshobson `plugin-eval`: static lint (deterministic), committed snapshot keyed by content hash; LLM-judge and Monte Carlo layers flagged unvalidated; trace-based evals via error analysis first. https://github.com/wshobson/agents/blob/main/evals/README.md and https://github.com/wshobson/agents/blob/main/plugins/plugin-eval/README.md
- gstack: tests classified gate vs periodic (`E2E_TIERS`), test selection from git diff via touchfiles, hermetic env for every E2E child.
- ponytail: with/without-skill benchmark, 39 tasks x 5 runs. https://github.com/DietrichGebert/ponytail (numbers self-reported, UNVERIFIED)

## Top 7 steal list for crew

1. **Compaction-safe skill size cap (20,000 bytes) plus references split.** Add a check to `scripts/validate-skills.ts` that fails when any SKILL.md (and agent prompt) reaches 20,000 bytes, alongside the existing 200-line cap; move late-stage procedure into `references/` read at that step. Source: https://github.com/obra/superpowers/blob/main/tests/skill-size/test-skill-size.sh . Effort S. Crew's 200-line skill cap is probably under it already, but agent prompts and command files are not covered; verify.
2. **Single combined task reviewer fed a pre-built diff file.** Generate one diff file (commit list, stat, full diff with context) and tell the reviewer to read it once and not re-crawl; return two verdicts in one pass. Cuts reviewer token cost. Make `model:` mandatory in the dispatch template. Source: https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/task-reviewer-prompt.md . Effort S/M.
3. **Zero-context (goldfish) reviewer for specs and plans.** Dispatch a reviewer that receives only the artifact and referenced source, never the conversation, and returns "what would I still need to ask". Fits `/crew:build` pre-flight. Source: https://github.com/google/elephant-goldfish-model and superpowers v7.0.0 "builder check". Effort M.
4. **Verdict taxonomy for validation: UNMAPPED / ZERO_RUN / TOO_BROAD.** Make the validator report when a changed file has no covering test or a selected test run nothing, instead of passing. Source: https://github.com/garrytan/gstack/blob/main/verify/SKILL.md.tmpl . Effort M.
5. **"Rulings, not stalls" log line in autonomous runs.** Standardize `Ruling: <decision> - <why> - <cost if wrong>` in handoffs, plus a short named list of true stop conditions. Maps onto crew's `help_request` badge. Source: https://github.com/obra/superpowers/blob/main/skills/subagent-driven-development/SKILL.md . Effort S.
6. **Remediation hint on every validator failure, and a content-hash score snapshot.** Each `validate-*.ts` finding prints the fix string; add a committed snapshot of static skill scores keyed by file hash so scoring-code changes are visible. Source: https://github.com/wshobson/agents/blob/main/ARCHITECTURE.md and https://github.com/wshobson/agents/blob/main/evals/README.md . Effort S/M.
7. **Session-forensics skill with mandatory citations.** A `crew:diagnose-run` skill that reads transcripts and `.claude/artifacts`, answers "why was this run expensive", and requires `path:line` for every finding. Directly supports the cost-trajectory concern in the loop snapshot. Source: https://github.com/obra/superpowers/blob/main/skills/diagnosing-superpowers/SKILL.md . Effort M.

Honorable mentions: per-model overlays and lite loadouts (gstack, L, only with eval harness first); test tiers gate vs periodic (gstack, M); scope-by-project learning promotion (ECC, M, overlaps astramem agent-profile work already in progress); hide pressure-test fixtures from the installed skill directory (superpowers, S).

## Not worth copying
- Giant catalogs (ECC 314 skills, claude-code-templates 1,900, VoltAgent 161): breadth over quality; crew's three-test rule for specialist agents is the stronger stance.
- Vendor benchmarks without raw data (context-mode 99.4%, ponytail %, planning-with-files A/B): UNVERIFIED.
- ruflo/claude-flow: marketing-heavy; not evaluated in depth (UNVERIFIED).
- Pimzino spec workflow and SuperClaude: stale or slowing.
