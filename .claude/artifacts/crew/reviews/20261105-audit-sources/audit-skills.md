# Audit: skills/ library (crew v0.67.0) - read-only

Method: grep of agents/, commands/, skills/, docs/, scripts/, hooks/ per skill name (worktrees, logs, artifacts excluded); line counts; ran validate-skills.ts (OK, 10 warnings) and validate-routing-table --coverage-only (OK). No repo file modified (git status unchanged).

## Facts
- Real count: 71 SKILL.md (universal 6, workflow 29, domain 35, meta 1), 138 .md files, 15,900 md lines (8,465 in SKILL.md). README.md:49 and AGENTS.md:4,71 say "49 skills", which is wrong.
- 28 of 71 skills carry `source:` (21 aitmpl, 6 davila7): vendored third-party content.
- 17 skills split into references; 6 have maxLines overrides.

## Ranked findings
1. HIGH - Fake tooling shipped as "automated" capability. skills/workflow/reviewing-code/scripts/{pr_analyzer,code_quality_checker,review_report_generator}.py and skills/domain/architecture/architecture-advisory/scripts/*.py are the same 114-line template; analyze() sets `findings = []` and prints "Completed successfully". reviewing-code/SKILL.md:27-45 advertises "Automated analysis", "Expert-level automation". A reviewer following it gets a green no-op.
2. HIGH - Dangling script references. backend-advisory SKILL.md:30,110 -> scripts/api_scaffolder.py, database_migration_tool.py, api_load_tester.py; fullstack-advisory -> project_scaffolder.py, code_quality_analyzer.py; security-advisory -> threat_modeler.py, security_auditor.py, pentest_automator.py. None exist. Quote: "python scripts/security_auditor.py <target-path>". Fix: delete the Quick Start / Core Capabilities blocks.
3. HIGH (SUSPECTED) - Skills referenced by relative path, not resolvable from consumer repos. 22 agents say "Load `skills/universal/builder-mindset/`" with no ${CLAUDE_PLUGIN_ROOT} (the 41 agents/commands that use the var use it for scripts only); no agent uses Skill() for crew skills. In a consumer repo cwd that path does not exist. Also .claude-plugin/plugin.json has no `skills` path and skills nest 2-3 levels (skills/domain/backend/dotnet/...); Claude Code discovery expects skills/<name>/SKILL.md, so tiered skills are probably not auto-discoverable, which would make description quality moot. Crew is not enabled in this user's settings and no crew skill appears in this session's skill list. Needs a live check in an installed consumer.
4. HIGH - "Universal" tier is not injected universally. scripts/render-universal-skills.ts:75-85 renders a 35-line block from superpowers:using-superpowers, superpowers:verification-before-completion and loop:loop-discipline, none of which are crew universals. Only agents/verifier.md contains the pre-loaded-universals marker (1 of 23 agents). Crew's 6 universal skills reach agents only through prose "Load ..." lines.
5. MED - Orphans. Zero references in agents/commands/hooks/scripts/docs/other skills: dispatcher-orchestration, dispatcher-routing, fix-pr, writing-claude-md, writing-task-handoffs. risk-tier is referenced only by the orphan dispatcher-orchestration. The two dispatcher skills describe the retired `lead` role (CLAUDE.md: "there is no lead agent role"). Routing-table-only (no agent or command loads them): using-crew, context-curation, webapp-testing.
6. MED - Stale external wiring. docs/routing-table.yaml:185,309 route to `microsoft-docs:*`; no microsoft-docs plugin exists in plugins/cache (only `azure`). docs/routing-table.yaml:306 tells agents to call `context7.get-library-docs`; the current tool is `query-docs` (mcp__context7__query-docs). plugin-dev and context7 do exist.
7. MED - Duplicate skills. task-decomposition (domain/architecture) and spec-decomposition (workflow): same aitmpl lineage, 123 vs 128 lines, same purpose. security-advisory (144, generic OWASP template with fake scripts) vs security-sweep (109, real, scan.ts runs). frontend-design duplicates the official frontend-design plugin. skill-creator (1,506 lines, 9 files) duplicates the official skill-creator plugin and superpowers:writing-skills. universal/using-memory duplicates astramem:using-memory (same name, same purpose).
8. MED - commit skill mandates emoji ("conventional commit format with emoji", SKILL.md:6,29) while the repo's own history is plain `chore(release): ...` / `fix(hooks): ...`. The skill contradicts the repo it ships from.
9. MED - Line cap is gamed by moving bulk into references, not by brevity. Cap is 200 per SKILL.md, but totals are skill-creator 1,506, devops-engineering 1,019, react-engineering 986, root-cause-discipline 786, engineering-standards 672, reviewing-code 544. maxLines overrides: release-engineer-reference 350 (actual 116), typescript-pro 250 (189), root-cause-discipline 250 (186), builder-ceremony 250 (233), builder-mindset and memory-keeper 200 (no-ops). 5 SKILL.md sit at 185-199 lines. Nothing caps total loaded bytes.
10. MED - Domain thinness. python-pro (131 lines, 0 code fences, checklist bullets only), ai-engineering (134, 0 fences), flutter-conventions (134, 2 fences), mobile-design (120 + refs). mcp-integration (138, 8 fences) is adequate but overlaps plugin-dev's MCP skill (SUSPECTED). infra (16 files, 2,185 lines) and ui (19 files, 2,236 lines) are substantive; mobile (5 files, 623 lines) moderate.
11. LOW - Frontmatter drift: fullstack-cross-layer lacks owner/last_reviewed/triggers; builder-ceremony lacks owner/last_reviewed; 10 validator warnings tolerated. last_reviewed dates cluster 2026-05/06 and begin crossing the 180-day stale threshold around 2026-11-18 (STALE_REVIEW_DAYS in validate-skills.ts).
12. LOW - Architecture rule "Skills do not load other skills" (docs/architecture/architecture.md:37) is violated: root-cause-discipline is referenced by 7 other skills; incident-response, release-recovery, react-engineering and others cross-reference too.
13. LOW - Stale `.claude/worktrees/*` full repo copies sit under the repo and make repo-wide grep exceed 120s.

## Hot list (>=3 consumers; noisy words excluded)
using-memory (17 agents), root-cause-discipline (10 agents, 7 skills), security-advisory (9 agents, 4 skills), react-engineering (8, 5), self-verify-gate (7), builder-ceremony (7), typescript-pro (7), backend-advisory (6), builder-mindset (6), csharp-conventions (5), reviewing-code / aspnetcore-patterns / ef-core-patterns / engineering-standards / architecture-advisory / database-architecture (4 each). `commit` matches 12 agents only because the word is common.

## Worst 10 descriptions (not trigger-grade)
1. reviewing-code: "Comprehensive code review skill for TypeScript, JavaScript, Python, Swift, Kotlin, Go. Includes automated code analysis..." Generic, advertises fake features, collides with every review skill.
2-4. backend-advisory, fullstack-advisory, architecture-advisory: "Comprehensive ... skill for ... ReactJS, NextJS, NodeJS, Express, React Native, Swift, Kotlin, Flutter, Postgres, GraphQL, Go, Python". Keyword soup that matches nearly every coding turn.
5. security-advisory: "Comprehensive security engineering skill ... penetration testing". Overbroad.
6. prompt-engineering: "World-class prompt engineering skill ...". Marketing, no trigger.
7. ai-engineering: "End-to-end AI system engineering ... Consult when building or shipping AI/ML systems". Vague.
8. builder-mindset: states who loads it, not when it applies.
9. context-curation: "Curate per-agent context briefings and pre-compaction checkpoints during multi-agent workflows". No trigger phrase.
10. spec-decomposition / task-decomposition / research-coordination / diagram-methodology: no "Use when" phrase; 19 skills in total lack one.
Description lengths 78-478 chars, within the 1,536-char limit.

## Overlap clusters (merge candidates)
- Review pipeline: reviewing-code (checklists), review-gates, fan-out-review (45 lines), validator-gate (39), self-verify-gate (129). Merge fan-out-review + validator-gate + review-gates into one review-pipeline skill; keep self-verify-gate (builder side); reduce reviewing-code to real checklists, drop scripts.
- builder-mindset (125) + builder-ceremony (233) + engineering-standards (672 with refs): merge mindset + ceremony; keep standards as reference.
- code-investigation vs root-cause-discipline: fold investigation into root-cause-discipline/investigation.md (already exists).
- typescript-pro / backend-advisory / fullstack-advisory / fullstack-cross-layer: keep typescript-pro; delete the two generic advisory packs; fold cross-layer routing into the routing table.
- security-advisory vs security-sweep: keep sweep; cut advisory to a short OWASP / threat-model checklist.

## Overlap with superpowers 7.0.0 (14 skills) and other installed plugins
| crew skill | installed equivalent | note |
| root-cause-discipline (find-polluter.sh and condition-based-waiting-example.ts are edited forks of superpowers files) | systematic-debugging | ~70% concept overlap |
| builder-mindset TDD policy | test-driven-development | partial |
| self-verify-gate | verification-before-completion | crew adds scoped typecheck/lint |
| reviewing-code, review-gates | requesting-code-review, receiving-code-review, code-review, coderabbit, pr-review-toolkit | heavy |
| fix-pr (orphan) | receiving-code-review | full |
| spec-decomposition, task-decomposition, slice-sizing | writing-plans | heavy |
| dispatcher-orchestration (orphan) | subagent-driven-development | heavy |
| using-crew | using-superpowers | structural |
| fan-out-review | dispatching-parallel-agents | partial |
| skill-creator | writing-skills, official skill-creator plugin | full |
| using-memory | astramem:using-memory | full |
| frontend-design | official frontend-design plugin | full |
| webapp-testing | playwright plugin / gstack qa | full |

No crew equivalent of using-git-worktrees, brainstorming, finishing-a-development-branch. About 16-18 of 71 crew skills (~25%) duplicate an installed skill. render-universal-skills.ts already depends on superpowers being installed, so the dependency exists anyway.

## DEC-025 executable canonical entry
Only two skills ship real executables: security-sweep/scripts/scan.ts (194 lines) and test-quality/scripts/analyze.ts (157). scan.ts ran (ignored --help, scanned cwd, printed "0 findings"); analyze.ts ran silently. They execute, but neither supports --help (minor). All other "scripts" are the stub template (finding 1).

## Taxonomy
Tier model is sound on paper (architecture.md:8-12) but "universal-skills: always discoverable" is true only by prose. meta/skill-creator is referenced by 2 agents and duplicates installed tooling.

## Drastic improvements
1. Cut 71 -> ~35 skills: delete 5 orphans, 2 generic advisory packs, task-decomposition, security-advisory body, skill-creator, using-memory, frontend-design; merge review cluster (5 -> 2) and builder trio (3 -> 2). Impact: about -5,000 lines, removes all fake scripts, fewer trigger collisions.
2. Delegate to superpowers and installed plugins: declare superpowers as a dependency; replace root-cause-discipline, fix-pr, plan-writing, TDD policy with pointers; keep only the crew-specific delta (badges, artifacts, risk tiers). Impact: 16 fewer skills of duplicated guidance, upstream fixes for free.
3. Make loading real: flatten to skills/<name>/SKILL.md (or declare paths in plugin.json), have agents call Skill() or use ${CLAUDE_PLUGIN_ROOT}/skills/..., verify in a consumer repo. Rewrite the 19 descriptions lacking "Use when <symptom>". Impact: skills actually trigger.
4. Replace the line cap with a payload budget (SKILL.md + loaded references) and add CI checks: every skill referenced by at least one agent, command or routing row; every script path named in SKILL.md exists. Impact: mechanically catches findings 1, 2, 5.
5. Fix inventory truth: generate skill counts for README/AGENTS from the tree; add a check of routing-table external rows (microsoft-docs, context7 tool name) against installed plugins.
