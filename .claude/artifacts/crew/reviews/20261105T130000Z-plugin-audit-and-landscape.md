# Crew plugin audit + GitHub landscape review

- Date: 2026-11-05
- Repo audited: `astragenie/dev-team` (crew v0.67.0, `main` @ 72d0b88c, matches `origin/main`)
- Successor cross-checked: `devcrew` 1.1.0 (installed at `~/.claude/plugins/cache/astra/devcrew/1.1.0`, released 2026-08-20). No local git checkout of `astragenie/dev-crew` exists.
- Method: 6 read-only audit agents (agents, commands, hooks, scripts, skills, tests/CI/docs/telemetry) + 10 research agents (platform, collections, orchestration, loops, review, evals, cost/observability, memory, guardrails, harnesses, context engineering). Dispatcher cross-checked top findings against devcrew 1.1.0 by grep. Full per-agent reports: scratchpad dir listed in Appendix A.
- No repo file was edited. Side effect: ~10 "x" rows appended to gitignored `.claude/logs/events.jsonl` by the hooks timing run.

## 0. Read this first

**This repo is archived (README banner, 2026-08-19).** The live product is `devcrew` 1.1.0, which subtree-imported this repo at `crew/`. The cross-check below shows devcrew carried almost every defect forward and made the hook fan-out worse. **Every finding here should be filed against `astragenie/dev-crew`.** Treat this document as the audit of devcrew's `crew/` half, with v0.67.0 as the evidence base.

**Headline:** the plugin is not "content-heavy, runtime-light" as CLAUDE.md claims. It is a ~33k-line TypeScript runtime that crashes without a `node_modules` the plugin cache never installs (#41), wrapped in ~8k lines of prompts, with 22 hooks spawning 4 to 6 processes per tool call, 71 skills (not 49), 23 + 9 agents, 35 commands, and ~51 KB of always-on instructions. The governance layer (13 hard validators, 73 directive words, 7 HARD RULE headings) passes green while the enforcement it describes is mostly prose: the peer-dispatch lint never fires, the light-path gate fails open on an empty diff, `/crew:parallel` dispatches a command as an agent, reviewers are told to load a path that does not exist, and the review skill ships three Python "analyzers" that return `findings = []` and print "Completed successfully".

## 1. Top findings (ranked, cross-repo)

Severity key: C = critical (breaks a core flow or silently waives a gate), H = high, M = medium. "devcrew" column: still present in devcrew 1.1.0 (Y), fixed (N), worse (W), not checked (?).

| # | Sev | Area | Finding | Evidence | devcrew |
|---|---|---|---|---|---|
| 1 | C | commands | Light path decides eligibility from `git diff HEAD` before any work exists; empty diff = "eligible", so a big feature on a clean tree gets `dev-lite` + `reviewer-lite` and no validation | `commands/build.md:15-27`, `fix.md:15-24` | Y (`build.md:18`, `fix.md:20`) |
| 2 | C | commands | `/crew:parallel` dispatches `subagent_type: crew:build`; no such agent, `build` is a command | `commands/parallel.md:38` | Y (`devcrew:build`, 20 refs, no `agents/build.md`) |
| 3 | C | hooks | 4 to 6 `bun` processes per tool call (Bash 6, Read/Edit 4, SubagentStop 5, every other tool 2). Measured cold start p50 214 ms, p95 265 ms on this Windows box (repo claims ~88 ms) | `hooks/hooks.json:84-205`, `tests/hook-cold-start-bench.test.ts` | W (PreToolUse 10, PostToolUse 6, SubagentStop 8; bun + node mixed) |
| 4 | C | skills | Fake tooling: 6 Python "analyzers" are one 114-line template with `findings = []`; `reviewing-code/SKILL.md:27-45` advertises "Expert-level automation" | `skills/workflow/reviewing-code/scripts/*.py`, `skills/domain/architecture/architecture-advisory/scripts/*.py` | Y (6 files, same template) |
| 5 | C | skills | 9 referenced scripts do not exist (three each in backend, fullstack, security advisory: `security_auditor.py`, `api_scaffolder.py`, `threat_modeler.py`, ...; audit originally said 8, Codex counted 9) | `skills/domain/{backend,fullstack,security}-advisory/SKILL.md:30` | Y |
| 6 | H | agents | Peer-dispatch lint never fires: `validate-agents.ts:207` returns early unless `tools:` contains `Agent`, and no allowlisted agent declares `tools:`. Whitelists, budgets, and "gates are orchestrator-only" are prose only | `scripts/validate-agents.ts:166-168,207-208`, `agents/fullstack-dev.md:260` | ? |
| 7 | H | agents | Builders have three contradictory report contracts (PR comment via `report-to-pr.ts` / `write-handoff` artifact / inline STATUS). Nothing reads the PR comment. `report-to-pr.ts` is invoked by repo-relative path so it cannot run in a consumer repo | `agents/{fullstack,backend,frontend,aiplugin}-dev.md`, `commands/build.md:168-170`, `builder-ceremony/SKILL.md:14` | Y (relative path in all 4 builders) |
| 8 | H | agents | Primary reviewer told to "Always load `docs/workflow/reviewing-code/`"; path does not exist (skill is under `skills/`). Ref validator only checks `crew:` tokens | `agents/reviewer.md:100` | Y (`reviewer.md:100`) |
| 9 | H | commands | `/crew:fix` runs `mark-badge --badge inspected`; CLI rejects it ("Unsupported workflow badge"). Reproduced in a temp repo | `commands/fix.md:34`, `scripts/crew.ts:422` | Y (`fix.md:36`) |
| 10 | H | commands | Validation-gate policy contradicts itself in 4 places: orchestrate-slice skips verifier for low risk, routing-table says "always, no skip path", dispatcher-routing says concurrent, fix.md never validates. No `validation_skipped` record is written | `orchestrate-slice.md:517`, `docs/routing-table.md:64`, `dispatcher-routing/SKILL.md:41`, `fix.md:114` | ? |
| 11 | H | hooks | Bash gate telemetry is dead: pre/post correlate through an in-memory `Map` across two processes. Costs 2 of 6 Bash spawns for nothing | `hooks/lib/bash-gate-timer-tap.ts:8-9` | ? (file moved to `.mts`) |
| 12 | H | hooks | No `timeout` and no `onFailure` on any hook entry; a hang blocks the tool call until the platform default | `hooks/hooks.json` | Y (0 `onFailure`) |
| 13 | H | commands | `jq` is a silent hard dependency, absent on the maintainer's machine: collision pre-flight and the recall/profile/skills injection return empty with no warning | `build.md:51`, `fix.md:53`, `orchestrate-slice.md:161-247` | Y |
| 14 | H | commands | 11 commands use cwd-relative script paths (`node -e 'import("./scripts/...")'`, `node scripts/crew.ts`) that only resolve inside dev-team; single-quoted `node -e` also breaks under PowerShell | `review.md:29`, `validate.md:19`, `gepa-*.md`, `orchestrate-slice.md:122-587` | ? |
| 15 | H | tests | Suite is non-deterministic: 3 failures run 1, 5 different failures run 2, all timing assertions (cold-start 272 ms vs 250 ms cap, capture-perf). e2e smoke is retried 3x in CI to hide the same class | `tests/hook-cold-start-bench.test.ts`, `tests/gepa/capture-perf.test.ts`, `.github/workflows/test.yml` | ? |
| 16 | H | telemetry | "$2433 per iteration" is a metering artifact: 81 of 218 cost reports are `aggregate_all` rows (one is $32,101 across 193 sessions and all projects) mixed with 137 per-slice reports (median $51). Latest report is $0 with "Sessions Scanned: 0" | `.claude/artifacts/crew/cost/`, `loop-snapshot.md` | ? |
| 17 | H | telemetry | Grade averages ~0.5 are two unfilled template stubs (`<fill title>`, five axes at 0) dragging the last-5 window; real grades average 0.65 to 0.80 | `.claude/artifacts/loop/grades/` SLICE-112, SLICE-113 | ? |
| 18 | H | docs | Session start loads ~51 KB (~12.7k tokens) before any task; global and project constitutions overlap ~70% and both load; `@imports` do not reduce cost. Loop rules point at `docs/backlog/` and `docs/ai-loop/` which do not exist, and say both "push" (line 7) and "never push" (line 127) | `CLAUDE.md`, `.claude/crew/constitution.md`, `~/.claude/crew/constitution.md`, `.claude/loop/rules.md` | Y (CLAUDE.md 12 KB + AGENTS.md 8 KB, 3 @includes incl. snapshot) |
| 19 | H | skills | "Universal" tier is not universal: `render-universal-skills.ts:75-85` injects superpowers + loop skills, not crew's six, and only `verifier.md` carries the block. 22 agents reference skills by relative path with no `${CLAUDE_PLUGIN_ROOT}`; `plugin.json` declares no `skills` path and skills nest 2 to 3 levels, so auto-discovery in a consumer repo is SUSPECTED broken | `scripts/render-universal-skills.ts`, `agents/*.md` | Y (6 agents relative path; 79 skills) |
| 20 | H | agents | Architect has four conflicting dispatch rules and dispatches `architect-reviewer` on its own design, violating the constitution's "no agent dispatches its own reviewer"; `GATE_AGENTS` omits architect-reviewer so nothing catches it | `agents/architect.md:39,128-138,294-321,338-343` | ? |
| 21 | M | commands | `ship` has no entry preconditions (review passed, off `main`, pushed); `gh pr create` failure still yields a `passed` deployment-check; `passed_with_notes` has no branch | `commands/ship.md:63-82` | ? |
| 22 | M | commands | `fix.md` contradicts itself: line 91 calls dispatching the investigator a mistake, line 166 dispatches it; line 199 says stop on rejected, lines 116-140 retry | `commands/fix.md` | ? |
| 23 | M | hooks | `pre-push-verifier` regex misses `git -C x push`, `git -c k=v push`; PowerShell tool not wired; "PASS" is any recent `.md` in `validations/` the agent can write itself; default OFF | `hooks/pre-push-verifier.ts:56-58` | ? (`hooks/pre-push-gate.mts` exists, not read) |
| 24 | M | hooks | `log_event.sh` writes one unscrubbed full-payload file per event, never pruned: 2,075 files / 8.2 MB already; requires Git Bash | `scripts/log_event.sh:10,24` | Y (`crew/scripts/log_event.sh` wired on 7 events) |
| 25 | M | hooks | OTel hooks: `cachedSdk` is dead (fresh process each call); when enabled every PostToolUse does SDK init + OTLP POST + up to 1 s flush; when disabled still imports zod + yaml. Scrub list omits `tool_input.command`, so Bash command lines (inline tokens) are exported as span attributes | `hooks/otel-post-tool-use.ts:18-52`, `scripts/lib/telemetry/scrub.ts:12-26` | Y (same hooks wired) |
| 26 | M | agents | Memory loaded twice (dispatcher recall block + per-agent `Skill(astramem:using-memory)`); no "if unavailable, skip" clause; astramem returned 401 this session | `commands/build.md:159-166`, 17 agents | ? |
| 27 | M | agents | Reviewer family fails governance's own three-test rule: `reviewer-lite`, `csharp-reviewer`, `typescript-reviewer` share 37 to 39% of lines, same tools and contract. `qa-expert` / `performance-engineer` 32 to 34% shared. `cloud-architect` has no dispatch site | `agents/*.md`, `docs/governance.md` | ? |
| 28 | M | agents | Model/effort inverted vs risk: `document-writer` on haiku authors ADRs and prompts and can spawn the opus architect; `verifier` (final behavior gate, longest prompt) runs sonnet at effort low; `refactor` ("mechanical") runs opus/high | agent frontmatter | ? |
| 29 | M | skills | 5 orphan skills (dispatcher-orchestration, dispatcher-routing, fix-pr, writing-claude-md, writing-task-handoffs); two describe the retired `lead` role. ~16 to 18 of 71 skills (~25%) duplicate an installed superpowers / official plugin skill | `skills/` | ? |
| 30 | M | skills | Routing table routes to `microsoft-docs:*` (not installed) and `context7.get-library-docs` (tool is now `query-docs`) | `docs/routing-table.yaml:185,306,309` | ? |
| 31 | M | commands | Hand-copied routing tables in `ship.md:101-107` and `incident.md:93-100` already differ from the YAML-rendered matrix | | ? |
| 32 | M | commands | Hard, undeclared coupling to the `loop` plugin (`/loop:slice start`, hand-built cache path to `loop.mjs`); `plugin.json` declares no dependency | `orchestrate-slice.md:7,147,650`, `parallel.md:24-26` | N/A (merged) |
| 33 | M | agents | `agents/3rdparty/`: 9 vendored agents, 13 KB of descriptions (1.9x all first-party), 7 with no dispatch site, no provenance or licence except one; repo `LICENSE` is MPL-2.0 while `plugin.json` says MIT | `agents/3rdparty/`, `LICENSE` | W (14 vendored) |
| 34 | M | docs | Facts drift: README/AGENTS/memory say 49 skills (disk: 71); `loop-snapshot.md` says pending 1 / done 130 / FEAT-188 in flight (disk: 4 / 165 / done); the named regenerator `src/scripts/loop.mts` does not exist in this repo; memory says model routing active, `loop.json` has `modelRouting.enabled:false` | `docs/memory.md`, `AGENTS.md`, `loop-snapshot.md` | ? |
| 35 | M | CI | Daily `drift.yml` cancelled after 24 h on every run seen (queued for a runner that never picked it up). Code-PR CI 7 to 30 min and trending up; likely queue wait on the self-hosted pool | `.github/workflows/drift.yml`, run history | N/A |
| 36 | M | artifacts | `.claude/artifacts/` is 2,062 files / ~12 MB and ~24% of line churn since July; cost, cost-insights, bundles, trajectories, agent-stats are derived, regenerable, and currently wrong. `prune-artifacts` deletes committed history older than 90 days, guarded by prose only | `.claude/artifacts/`, `commands/prune-artifacts.md` | ? |
| 37 | M | commands | 12 of 35 commands have zero references anywhere (claims/approvals wrappers, `audit-repo`, `quickwin`, `cost-setup`, `wake-up-brief`); the 7 `gepa-*` commands only work inside dev-team but ship to consumers; README lists 9 of 35 | `commands/` | partial (33 commands, 1 gepa) |
| 38 | M | agents | 32 backlog ids (FEAT-/DEC-/SLICE-/dev-team#) across 15 shipped prompts, incl. `in-progress/FEAT-161.md` cited in 4 agents; path does not exist in a consumer | `agents/*.md` | ? |
| 39 | M | tests | Prompt-text tests regex-match agent wording (`/FIRST step/i`), freezing phrasing and fighting GEPA | `tests/backend-dev-prompt.test.ts`, `agent-prompt-content.test.ts` | ? |
| 40 | M | hooks | `.claude/settings.json` duplicates plugin hooks; when crew is also installed they run twice (SUSPECTED) | `.claude/settings.json` | Y (`.claude/settings.json` present in devcrew too) |

Scripts / runtime findings (from the scripts audit, which landed last; ranked within itself):

| # | Sev | Area | Finding | Evidence | devcrew |
|---|---|---|---|---|---|
| 41 | C | scripts | CLI and hooks crash when `node_modules` is absent, which is the state of a fresh plugin-cache install. Reproduced on a copy: `Cannot find package '@astragenie/plugin-std'` from `wakeup.mjs`; `otel-stop`, `pre-tool-use-agent`, `check-subagent-return` exit 1 under `bun --no-install`; plain `bun hooks/x.ts` silently auto-installs over the network (1.4 to 4.2 s). CHANGELOG records the same bug fixed three times; the plugin-std adoption reintroduced it. `zod` and `yaml` are devDependencies but imported by hooks at runtime | `scripts/lib/wakeup.mjs:5`, `scripts/lib/result.ts:16`, `scripts/lib/telemetry/hook-input.ts:7`, `scripts/lib/dispatch-timing.ts:4`, `package.json` | Y (devcrew still imports `@astragenie/plugin-std`, `astramem-client`, `ajv`; cache dir has no `node_modules`) |
| 42 | H | scripts | Cost reports use unbounded windows (`currentRun.startedAt .. now`, one slice report spans 11,323 min / $4,026.67, emitted 3 times identically) and are not idempotent; aggregate-all rows (193 sessions, $32,101) sit beside per-slice rows; worktree project dirs resolve to no slug and emit $0. The "$2433/iteration" is a mean over this mixed set. Codex correction: current code prefers `run.completedAt` as the window end and already emits distinct slice/aggregate kinds; the gap is deduplication and bounding, not kind-mixing in the emitter | `scripts/lib/cost-hygiene/emit-cost-report.ts:134-152`, `scripts/lib/artifacts/write.ts:764` | ? |
| 43 | H | scripts | Pricing table has only `claude-{opus,sonnet,haiku}-4`; `claude-fable-5-1` and `claude-sonnet-5-5` (this session's models) silently fall to sonnet-4 rates, prefix `claude-opus-4` also catches 4.5+; no unpriced-model warning | `scripts/lib/pricing.json`, `scripts/lib/session-cost.ts:27-34` | ? |
| 44 | H | scripts | Windows: `new URL(import.meta.url).pathname` leaves `%20` in the pricing path, so any profile path with a space loses all cost reports (swallowed as "non-fatal"); `log_event.sh` interpolates `$project_dir` unescaped into JSON (backslash paths produce invalid lines) | `scripts/lib/session-cost.ts:21`, `scripts/log_event.sh:~22` | ? |
| 45 | M | scripts | State files written with plain `fs.writeFile` (truncate then write) and read without a lock by hooks; lock has no owner token and is stolen after 10 s; artifact filenames have 1 s resolution and no `wx`, so parallel gates can overwrite | `scripts/lib/workflow-state.ts:121-208`, `claims.ts:185`, `approvals.ts:80`, `artifacts/write.ts:80,968` | ? |
| 46 | M | scripts | "Runtime-light" is false: 170 files / ~33k non-test lines under `scripts/`; `crew.ts` is 1,819 lines with 54 subcommands, 8 with zero references; ~960 lines of orphan lib modules; GEPA is 6.3k lines + 7 commands on the artifact write path (three detached captures fire on every `writeArtifact`); `parseFrontmatter` hand-rolled ~10 times and git wrappers 5 times despite `plugin-std` exporting both; `.ts`/`.mjs` twin copies; `node_modules` 290 MB with an orphan 2.4 MB git-URL dep (`@astragenie/astramem-plugin`, never imported) and 29 MB of OTel for an opt-in feature; both npm and bun lockfiles committed; `evals/` and `tests/` never linted | `scripts/crew.ts`, `scripts/lib/**`, `package.json`, `biome.json` | partial (devcrew deps cut to 4; `src/` now 625 files / 124k lines, so the runtime grew) |
| 47 | L | scripts | FEAT-190 ("bun single runtime") rests on a stale trigger: `@astragenie/gepa-core` 0.10.1 ships `dist/index.js` and loads under Node fine; the real remaining distribution problem is #41, which bundling fixes regardless of runtime | `.claude/artifacts/loop/backlog/pending/FEAT-190-bun-single-runtime.md` | N/A |

Lower-severity items (legacy `decision:"block"` output shape, state-file read-modify-write races, stderr noise from feature flags, `maxMinutes`/`warnAtTurns` metadata nothing reads, `commit` skill mandating emoji the repo itself does not use, 200-line skill cap gamed via `references/` up to 1,506 lines, argument parsing inconsistency across commands) are in the per-area reports.

## 2. Measured numbers

| Metric | Value |
|---|---|
| Agent prompts | 23 files, 5,002 lines, ~75k tokens total; 425 long lines duplicated verbatim in 3+ agents (~34 KB); builders share 33 to 47% of lines pairwise |
| One `fullstack-dev` dispatch | ~45 KB (~11k tokens) before the first tool call, incl. auto-loaded skills |
| Commands | 35 + 4 vendored, 3,135 lines; `orchestrate-slice` 651 lines / 38 KB (~9.5k tokens per invocation); build+fix+incident+ship ~35 to 40% reducible |
| Skills | 71 (universal 6, workflow 29, domain 35, meta 1), 15,900 md lines; 28 vendored (`source:` aitmpl/davila7) |
| Hooks | 22 scripts, 4 to 6 processes per tool call; p50 214 ms / p95 265 ms cold start on Windows |
| Scripts | 170 files under `scripts/`, ~33k non-test lines; `crew.ts` 1,819 lines / 54 subcommands; GEPA 6.3k lines; `node_modules` 290 MB / 293 packages |
| Tests | 2,162 tests / 215 files, 330 s, 2,041 pass / 118 skip / 3 to 5 flaky fails; 42k test LOC (1.1:1) |
| Session start | ~30.5 KB via `@includes` + ~20.5 KB "read first" = ~51 KB (~12.7k tokens); 73 directive words; 7 HARD RULE headings |
| Artifacts | 2,062 files, ~12 MB committed; `.git` 30 MB |
| Cost reports | 218; 81 aggregate rows (sum $90.9k), 137 per-slice (sum $28.4k, median $51) |

## 3. What the landscape shipped (May to Nov 2026) and what to adopt

Each item: source (verified by fetch unless marked UNVERIFIED), mechanism, adoption, effort S/M/L. Full lists in the per-topic reports.

### 3.1 Platform (Claude Code 2.1.318, Agent SDK)
- **Hooks**: `onFailure:"block"` (2.1.295), `timeout`, `if: "Bash(git push*)"` filters, `async:true`, exec-form `args`, new events `PostToolBatch`, `PostCompact`, `StopFailure`, `PreModelSwitch`; `SubagentStop` carries `agent_transcript_path` + `last_assistant_message`; Stop-hook block cap of 8 since 2.1.143 (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`). Adopt S.
- **Agents**: plugin agents ignore `permissionMode`, `hooks`, `mcpServers` frontmatter (dead fields in crew); `omitClaudeMd`, `maxTurns`, `effort`, `isolation: worktree`, `memory: project` (`.claude/agent-memory/<agent>/MEMORY.md`, 200 lines / 25 KB cap). Adopt S.
- **Skills**: `claude plugin eval` (2.1.269; graders regex / tool_used / tool_order / file_exists / llm 2-of-3 / baseline; `--max-cost-usd`; mock MCP replay), `/skill-doctor` (2.1.252), `/doctor prompt-audit` (2.1.283), `claude plugin validate --strict`, skill `paths:` frontmatter, description cap 1,536 chars, skills re-attached truncated at 20k chars after compaction. Adopt S to M.
- **Workflow tool** (GA): `agent`/`pipeline`/`parallel` JS scripts in plugin `workflows/`, resumable, schema-validated outputs. This is the native form of crew's dispatcher fan-out + review/validate + fix-until-pass. Adopt L (prototype `/crew:build` as a workflow).
- **Built-in OTel** already attributes `cost_usd` per model/agent/skill/plugin/`query_source`; enable only from user/managed settings. Adopt M (replace `otel-*.ts`, keep slice mapping).
- **Breaking**: bypass mode now denies `rm`/`rmdir` immediately (2.1.309); Read "file unchanged" stub removed (2.1.317, check `check-redundant-read`); `${CLAUDE_PROJECT_DIR}` stays at the main checkout inside a worktree (per-worktree state attribution SUSPECTED broken).
- **Official plugin overlap**: `code-review`, `pr-review-toolkit`, `code-simplifier`, `security-guidance`, `feature-dev`, `commit-commands`, `hookify`, `plugin-dev`, `superpowers`, `skill-creator`, `ralph-loop`, `session-report`. What stays unique to crew: artifact gates, slice ceremony, GEPA, cost-advise, backlog tree.
- **Ignore**: Agent Teams (experimental, interactive-only), Managed Agents.

### 3.2 Community plugin collections
- obra/superpowers v7 (313k): 20 KB skill ceiling enforced in CI (a run lost its fix-round cap past 20k and ran 18 rounds); single reviewer fed a pre-built diff file, `model:` mandatory in dispatch; "Rulings, not stalls" (log `Ruling: decision, why, cost-if-wrong`, stop only on 4 named conditions). Adopt S.
- garrytan/gstack v1.96: validation verdicts `UNMAPPED` / `ZERO_RUN` / `TOO_BROAD` for changed files with no covering test; per-model overlays changed only after preregistered eval. Adopt M.
- google/elephant-goldfish-model: zero-context reviewer that sees only the artifact (spec/plan), never the conversation. Adopt as `/crew:build` pre-flight, M.
- wshobson/agents: remediation hint on every validator finding; committed score snapshot keyed by content hash. Adopt S.
- affaan-m/everything-claude-code: "instinct" learning with confidence + project scope. Partial, M.
- Not adopting: ruflo/claude-flow (marketing-heavy, own page says demos are not evidence), SuperClaude (stale), context-mode, claude-mem (overlaps astramem).

### 3.3 Multi-agent orchestration
- Measured: CooperBench (Jan 2026) two coordinating agents ~30% worse than one; agent PR merge conflicts 27.7%, cross-agent pairs 41.7%; Anthropic orchestrator-worker +90% quality at ~15x tokens; OrchBench: preserving information across dependent tasks beats adding agents.
- Gas Town (~18.7k): refinery merge queue batches finished work, runs gates, bisects failures; workers never push to main. Bernstein (1.2k): one LLM planning call emits tasks with `owned_files`, plain Python schedules; deterministic "janitor" (tests/lint/types) before merge; failed task retries on a different model. Anthropic Agent Teams: shared task list, file-locked claiming, `TaskCompleted` hooks exit 2.
- Adopt, ranked: (1) merge queue after each wave: rebase, rerun tests on merged result, bisect, M; (2) declared `depends_on` + `owned_files` per slice checked against diff and other in-flight slices, S-M; (3) deterministic janitor gate before reviewers, S; (4) route failures to the original builder with bounded retries then a different model, S-M; (5) stall watchdog + hook-enforced gate completion, S-M.

### 3.4 Spec-driven autonomous loops
- spec-kit v1.3.1 (147.8k): `converge` append-only gap pass, byte-identical when clean. OpenSpec v1.16 (74k): `validate --strict` requires Given/When/Then. bmad-loop (178, closest analog to Wiggin Loop): no LLM in the control loop, completion from a Stop-hook event never model prose, fresh-context review capped at 3 cycles, plateau-defer with ledger, env faults (exit 126/127) do not charge the attempt. Codex `/goal`: evidence-based completion audit, "blocked" only after the same blocker 3 turns.
- Only published metric: Uvik vendor benchmark (50 tickets, ±10 pp): spec arms merged 80 to 84% vs 72%; specs covering 6 of 8 checklist items merged 89% vs 60%. No success-vs-iteration data anywhere.
- Adopt, ranked: (1) completion-audit block at slice complete / phase gate (map each AC to evidence; indirect = not done), S; (2) orchestrator-run verification (non-empty diff, verify commands, env faults free), S-M; (3) plateau-defer + stall taxonomy, M; (4) converge pass post-FEAT, S-M; (5) lintable GWT acceptance grammar + "fits one context window" sizing gate, skip ceremony for 1 to 2 file slices, M.

### 3.5 Code review gates
- Anthropic managed review: parallel finders, verify step drops false positives, one dedupe + severity-rank, never blocks the PR; `REVIEW.md` read by finder and verifier from the base branch, with nit cap ("at most five"), skip list, evidence rule (file:line). `/code-review` effort levels sticky, `--max-findings`, `--fix` applies once; ultra ~$5 to 25 per run. Cursor Bugbot Learned Rules: downvotes/replies/misses become candidate rules, auto-disabled on negative signal. Vendor resolution rates (Bugbot 78.1%, Greptile 63.5%, CodeRabbit 49.0%) measure "comment addressed", not precision.
- Nobody documents an apply-re-review-stop loop; crew's repair-signature dedup is ahead of published practice. Keep it.
- Adopt: (1) reviewer-verifier requires file:line + CONFIRMED/PLAUSIBLE/REJECTED per finding, S; (2) `.claude/crew/review.md` rules file read by all reviewers + verifier from base branch, S-M; (3) learned suppression rules from fixed/dismissed/false-positive outcomes, M-L; (4) effort tiers + default findings cap ~10, M; (5) single post-verify dedupe/rank point tagging new vs pre-existing, S.

### 3.6 Prompt optimization and evals
- `claude plugin eval`: see 3.1. Binary rubrics with judge validation (arXiv 2609.00038): final-reply-only judges scored recall equal to false-alarm rate; step-level checking separates faulted runs. GEPA 0.1.1 to 0.1.4: top-K Pareto, `gepa.gskill` skill-learning for coding agents, `max_reflection_cost`, JSON run artifacts, lineage tree. Decagon production notes: ~150 metric calls and ~20 training examples suffice; cap prompt length (~1,500 chars lost 0.8%); frontier reflector + cheap task model. CASD (arXiv 2609.26261): offline failure distillation from a trajectory corpus beat GEPA (+16.6 vs +10.9) at ~$1.60/run. Harness choice moved tokens-per-solved-task up to 40x while pass rate moved 0 to 8 pp (arXiv 2607.22585).
- Langfuse Cloud becomes v4-only on 2026-11-16: check crew's emitter before then.
- Adopt: (1) `evals/` suite per agent and skill, deterministic graders on PRs, judge graders nightly, M; (2) replace 7 continuous axes with fraction-of-binary-items-passed anchored to deterministic probes, N/A when no evidence, M; (3) bump gepa-core, expose reflection-cost cap, store run JSON with champion provenance, M; (4) GEPA budget defaults (100 to 150 calls, held-out set, prompt length cap), S; (5) mine crew's own run/handoff/review artifacts for failure distillation before paying for GEPA search, M.

### 3.7 Cost and observability
- Claude Code telemetry: `subagent_completed.total_tokens` is the final request footprint, not a run total; `cost_usd` is an estimate; `cacheCreation` merges 5 m and 1 h writes (1.25x vs 2x). Current prices per MTok (in/out/cache-read): Fable 5.1 10/50/0.25, Opus 5.5 4/20/0.20, Sonnet 5.5 2/10/0.10, Haiku 5.5 0.10/0.50/0.01. Sonnet 5.5 beats Opus 5.5 on Terminal-Bench 4.0 (70.6 vs 66.4); architect-on-opus, build-on-sonnet remains reasonable. Prompt-prefix hygiene (stable prompt first, date/cwd/branch last) measured -7.6% on subagent prompt cost; blanket 1 h TTL on subagents measured worse (+8.6%). `claude -p --max-budget-usd` is the only official budget enforcement and stops background subagents. OTel GenAI semconv still "Development": map behind a layer.
- Adopt: (1) fix cost accounting with a known-transcript test, S; (2) prefix hygiene in dispatch templates, S-M; (3) per-run budget breaker via PreToolUse on Agent with spawn-tree ledger, plus `--max-budget-usd` as outer cap for unattended loops, M; (4) spool-and-batch telemetry at Stop, `async:true`, S; (5) `gen_ai.*` attribute names behind a mapping layer, S.

### 3.8 Memory
- ACE (arXiv 2510.04618): playbook bullets with helpful/harmful counters, delta edits only, dedup at ~0.9 similarity. claude-mem: index-first (~50 to 100 tokens per hit) then timeline then detail. Letta context repositories: always show a described file tree, load bodies on demand. "Skill Issue" (arXiv 2609.12742): +4.9 pp from docs, inseparable from run variance. AMA-Bench (arXiv 2602.22769): memory systems often lose to plain long context; blames lossy summaries and similarity-only retrieval. Beads (steveyegge): compact closed items. Claude Code `memory: project` for subagents.
- Adopt: (1) usefulness counters on injected lesson ids, rank/prune by helpful minus harmful, supersede not rewrite, M; (2) index-first budgeted recall (top-K titles + ids, expand by id), M; (3) memory-delta evals on real repo history (reverted/review-failed work, no-memory baseline, ≥5 repeats, report cost), M-L; (4) markdown as source of truth, astramem as rebuildable index, export top lessons to `.claude/agent-memory/` as fallback (astramem was 401 this session), M; (5) read-only hygiene proposals approved by an independent validator, soft delete only, M. Quick: `.claude/rules` with `paths:` instead of `@imports`; `/doctor prompt-audit`; `<private>` tag + secret scrub on save.

### 3.9 Hooks and guardrails
- Official docs: all matching hooks run in parallel; a timed-out PreToolUse hook does not block unless `onFailure:"block"`. cameronsjo/cadence-hooks PR #1008: merging checks into one process took Write from 12 to 2 processes, 14.6 to 6.0 ms wall, 45 to 11 ms CPU (Linux). ticpu Rust dispatcher: single binary, fails open on internal error. nizos/probity (successor to tdd-guard): reads the session transcript for evidence instead of trusting claims. Built-in sandbox does not support native Windows. Prompt-injection PostToolUse scanners showed 43% false positives: not blockers.
- Adopt: (1) single-process `crew-hook <event>` dispatcher importing each check as a module, `Promise.all` with per-check try/catch + timeout, exit 2 listing every blocker, hooks.json generated from one table; benchmark on Windows with hyperfine first, M-L; (2) `if` filters + tighter matchers, S; (3) Stop/SubagentStop hardening: honor `stop_hook_active` and the 8-block cap, after N blocks per `agent_id` record a help_request instead of looping, base "DONE:" check on transcript evidence, S-M; (4) evidence-based done check (last test run vs last edit, deleted/skipped tests from diff), M; (5) fail-mode policy table (secret scan, destructive guard, artifact-lock fail closed with `onFailure:"block"`; telemetry async fail open) + `crew hooks doctor`, S-M.

### 3.10 Competing harnesses
- gh-aw (GitHub agentic workflows): safe-outputs split, agent proposes read-only, a privileged job applies after threat + secret scan; per-workflow 24 h credit cap. Codex 0.166: dollar usage in status line, Guardian reviewer-as-approver with timeout, skill catalogs load incrementally without descriptions, approvals preserved across resume/fork. OpenCode: ordered allow/ask/deny with hard-deny; per-step snapshots. Hermes: LSP diagnostics after every edit + `/rollback`. Gemini CLI: fail-closed workspace trust (0.59), env sanitization (0.60), atomic state writes with backup (0.64); replaced by Antigravity CLI for unpaid tiers 2026-06-18. `gh skill` (2026-04-16): pin by tag/SHA, provenance in SKILL.md, immutable releases; agentskills.io reportedly 40+ clients (UNVERIFIED). MCP 2026-07-28: Tasks moved to extension; Roots, Sampling, Logging deprecated. Roo Code ended 2026-05-15; Kilo builds on OpenCode.
- Adopt: (1) safe-outputs split for the builder (propose, then gated apply), M; (2) hard per-run budget, S-M; (3) portable Agent Skills packaging (pure SKILL.md + per-harness bundles; agents/commands stay Claude-specific), M-L; (4) reviewer-as-approver + ordered policy rules, M; (5) post-edit LSP diagnostics as a cheap pre-review gate + checkpoints, M.

### 3.11 Context engineering
- Official memory docs: target under 200 lines per CLAUDE.md, longer files reduce adherence, `@imports` do not save context, root CLAUDE.md is re-injected after compaction but path-scoped rules are not. ETH (arXiv 2602.11988): AGENTS.md gave no general success gain, cost +20%, repo overviews did not help, non-standard practices do. arXiv 2606.20512: refined guidance 33.0% vs static 28.3% vs none 25.5% on SWE-bench Verified. Anthropic prompting guide: newer models overtrigger on "CRITICAL: You MUST"; Fable 5 guide says old skills are often too prescriptive. IFScale replication: Opus 4.7 98% at 500 instructions, 77% at 2,000; raw count is a weak predictor. Compact-Bench (arXiv 2610.31710): LLM summaries keep ≤16% of recurring details vs 79% for mechanical extraction; summary-only continuation damaged 5 to 64% of repairs.
- Adopt: (1) shrink always-on chain to <200 lines, one constitution, loop rules only inside the loop skill, S-M; (2) emphasis diet: keep a handful of hard tokens for irreversible actions, enforce those via hooks, add an emphasis-budget lint, M; (3) `omitClaudeMd: true` on self-contained subagents (reviewer, verifier, researcher) + cap skill descriptions, S; (4) context-budget CI script per command/agent/skill/include chain + `InstructionsLoaded` hook attribution, M; (5) mechanical state-file handoff between slices with a fresh session each, re-injected via `SessionStart` source `compact`, M.

## 4. Drastic improvement plan

Three horizons. Each item names the finding(s) it closes and the external evidence.

### Horizon 1 (weeks, S effort each): stop the bleeding
0. **Bundle the runtime** (`bun build --target=node` to `dist/crew.js` + one file per hook, externalize OTel/AWS; ship without `node_modules`, `tests/`, `evals/`, `docs/`). Add a CI job that runs every hook and the top 10 CLI subcommands from a `node_modules`-free copy. Closes #41 permanently; cache install drops from ~290 MB to under 2 MB. Fix pricing keys + `unpriced_models` warning, `fileURLToPath` for the pricing path, bounded cost windows with `run_id` dedupe. Closes #42 to #44.
1. **One hook dispatcher per event** (`crew-hook <event>`), hooks.json generated from a table, `timeout` + `onFailure` on every entry, `if` filters, telemetry spooled and exported at Stop. Delete the dead bash-gate pair and model-enforce no-op. Closes #3, #11, #12, #25. Evidence: cadence-hooks 12 to 2 processes.
2. **Fail the fail-opens.** Light path decided from task text / builder diff with empty diff = not eligible (#1); `crew.ts gate-status --require review` preflight in ship (#21); explicit `validation_skipped --note` whenever a branch bypasses a gate (#10); `jq`-free `--field block` output (#13); `${CLAUDE_PLUGIN_ROOT}` on every script path (#7, #14).
3. **Fix the six broken references**: `parallel.md` agent target (#2), `mark-badge inspected` (#9), `reviewer.md:100` path (#8), delete the 6 stub analyzers and 8 dangling script refs (#4, #5), `microsoft-docs`/`context7` rows (#30), `FEAT-161` and 31 other backlog ids in prompts (#38). Add CI rules: every `subagent_type: crew:X` exists; every backticked repo path in an agent/skill exists; every script named in a SKILL.md exists.
4. **Make telemetry mean something**: reject $0 / "Sessions Scanned: 0" cost reports and `<fill title>` / all-zero grades at write time; split aggregate from per-slice; add a known-transcript cost test; stop committing derived telemetry (cost, cost-insights, bundles, trajectories, agent-stats). Closes #16, #17, #36.
5. **Cut session start to ~12 KB**: one constitution, no snapshot `@include`, loop files loaded only by the loop skill, `omitClaudeMd` on gate agents, fix `rules.md` paths and the push contradiction. Closes #18. Evidence: official <200-line guidance, ETH +20% cost.
6. **Quarantine timing tests** into a non-gating `bench` script; drop the 3x e2e retry. Closes #15.

### Horizon 2 (1 to 2 months, M effort): make enforcement real and prompts small
7. **Shared agent harness rendered at build time** (report contract first, scaffold/last-call rule, custom-instructions lookup, memory, badges). Expected -1,200 to -1,500 agent lines (25 to 30%), contradictions impossible by construction. Closes #7, #20, #26.
8. **Collapse the roster**: reviewer-lite + csharp-reviewer + typescript-reviewer into `reviewer` with `mode:` and a stack lens; qa-expert + performance-engineer into one advisor or skills; drop cloud-architect and 7 unused vendored agents to an opt-in pack with licences. First-party roster 23 to ~14. Closes #27, #33.
9. **Decide peer dispatch**: enforce via `tools:` / `disallowedTools: Agent` for the 2 to 3 agents that need it and make the validator check frontmatter, or delete the ~384 lines. Closes #6.
10. **Collapse commands 35 to ~10** public + maintainer-only gepa; extract a dispatcher kernel (`crew.ts dispatch-prep` returning `{model, recallBlock, profileBlock, skillsBlock, collisionWorktree, degraded[]}`); render routing tables into prompts between DEC-028 fences and fail CI on unfenced tables. Closes #13, #14, #31, #37.
11. **Skills 71 to ~35**: delete orphans, generic advisory packs, duplicates of superpowers/official plugins; declare superpowers as a dependency; flatten or declare skill paths so discovery works in consumers; rewrite the 19 descriptions lacking "Use when"; replace the line cap with a loaded-bytes budget + 20 KB ceiling. Closes #19, #29.
12. **Review gate upgrades**: `.claude/crew/review.md` rules file, file:line + verdict per finding in reviewer-verifier, findings cap, effort tiers, single dedupe point; validator verdicts `UNMAPPED` / `ZERO_RUN` / `TOO_BROAD`.
13. **Loop upgrades**: completion-audit block mapping each AC to evidence; orchestrator-run verify commands with env-fault exemption; plateau-defer ledger; per-run budget breaker + `--max-budget-usd` outer cap; `depends_on` / `owned_files` per slice; merge queue after each wave with rebase + retest + bisect.
14. **Evals in CI**: `claude plugin eval` cases per agent and skill with deterministic graders on PRs; binary rubric replaces the 7 continuous grade axes; delete prompt-wording regex tests (#39).

### Horizon 3 (quarter, L effort): re-platform on native primitives
15. **Prototype `/crew:build` as a plugin Workflow script** (`agent`/`pipeline`/`parallel`, schema-validated outputs, resumable). If it holds, the dispatcher prose in build/fix/ship/orchestrate-slice (≈1,300 lines, ~25k tokens per full ladder) becomes code with tests.
16. **Replace hand-rolled OTel with built-in telemetry** (`cost_usd` per agent/skill/plugin already attributed), keep only the slice-to-run mapping and a fallback spool.
17. **Portable skills packaging**: pure SKILL.md with provenance + pinning, per-harness bundles, agents and commands stay Claude-specific. Opens Codex/Copilot/Gemini consumers for the skill layer.
18. **Memory v2**: usefulness counters, index-first recall under a hard budget, markdown canonical + astramem index, memory-delta evals on real reverted work.

## 4a. Independent review by Codex (gpt-6.1-sol, read-only, 355k tokens)

Full output: `20261105T132500Z-codex-review-of-plugin-audit.md` (same directory). Codex spot-checked 17 findings against the repo and critiqued the plan.

**Verification result:** 13 CONFIRMED (#1, #2, #4, #6, #8, #9, #10, #11, #12, #13, #41, #43, #44), 3 OVERSTATED, 1 WRONG (count).
- #3 overstated: SubagentStop is 4 bun + 1 shell, not 5 bun; the bench measures one hook's cold start only.
- #7 overstated: contracts do conflict, but "nothing reads the PR comment" exceeds the evidence (`fullstack-dev.md:205,227` says the dispatcher reads it).
- #12 narrowed: no `timeout` means the platform default applies, not an indefinite hang.
- #42 overstated and mis-cited: real path is `scripts/lib/cost-hygiene/emit-cost-report.ts`; code prefers `completedAt` and emits distinct kinds; the defect is missing dedupe.
- #41: imports confirmed, fresh-cache crash not independently reproduced by Codex (it was reproduced by the scripts auditor on a `node_modules`-free copy).

**Missed by the audit (all P1):**
- **#48 CI skips the product.** The `.md$` docs-only exemption in `.github/workflows/test.yml:36` includes `agents/`, `commands/`, `skills/`, so prompt-only changes bypass every validator and prompt test.
- **#49 Required CI gate fails open.** `test.yml:118` passes when change detection fails or yields no output (`code != true`). Require successful detection and explicit `code=false`.
- **#50 Omitted verdict means approval.** `crew.ts:634,667` accept a missing `--decision`; `workflow-state.ts:428,467` then mark review/validation passed and skip the test-summary requirement. (The commands auditor noted this in its fail-open inventory; the synthesis dropped it.)
- **#51 Parallel reviews are last-writer-wins.** Both reviewers overwrite one `reviewResult` (`workflow-state.ts:425`); an approval landing after a rejection turns the gate green. Aggregate required reviewers explicitly.
- **#52 Builders publish before review.** `fullstack-dev.md:213` mandates push + draft PR before reporting, bypassing `build.md:118`'s explicit-approval ship boundary.
- **#53 Consumer validation assumes this repo's CI.** `orchestrate-slice.md:517` waives the verifier in favour of CI without checking a consumer has an equivalent workflow or awaiting its result.

**Plan critique (accepted into the plan below):**
- Fix enforcement before architecture: CI defects (#48, #49), explicit aggregated verdicts (#50, #51), consumer-install test, before the hook dispatcher. "A faster false-green workflow is still broken."
- Bundling (H1 item 0) overpromises: externalized OTel/AWS still need deps when enabled; dropping `docs/` breaks shipped references (`build.md:78`); "under 2 MB" and "permanently" are unproven until the installed artifact is smoke-tested from an unrelated consumer directory.
- Do not delete `model-enforce` as a no-op: it injects a model when routing is configured and enabled (`model-routing-enforce.ts:119,135`); disabled config is not dead code.
- Workflow tool: bounded bet, not a re-platform. Prototype read-only review first. The runtime cannot access shell/files directly, has no mid-run sign-off, and can restart agents while retaining their file changes; schema-valid output does not prove the work succeeded. Require failure aggregation, replay tests and idempotent side effects before migrating builds.
- Reduction targets (23 to 14 agents, 71 to 35 skills) and "contradictions impossible by construction" lack behavioural evidence; zero internal references is not zero interactive users. Measure usage and failures first; do not add a mandatory superpowers dependency yet.
- Telemetry cleanup: reject missing observations, not legitimate $0 or genuinely failed grades. Diagnose the e2e retries before deleting them.
- Adoptions flagged as fashion for a solo-maintainer plugin: learned suppression rules, memory usefulness counters, emphasis-budget lint, cross-harness bundles, merge queue with bisection, safe-outputs split for local builders. Prioritize: deterministic checks before reviewers, bounded repairs, evidence per acceptance criterion, consumer-install tests, reject-then-approve ordering tests, absent-decision tests, cancellation/replay tests, and a single-agent baseline (accepted changes, escaped defects, cost, maintainer interventions).

**Codex verdict (verbatim):** "sufficient to open specific defect tickets; insufficient to adopt the roadmap wholesale." Three actions this week: (1) repair CI filtering and require explicit, aggregated gate verdicts; (2) produce a self-contained package and smoke-test it from a clean consumer repo; (3) fix routing/reporting references and remove mandatory pre-review publishing; defer re-platforming.

**Dispatcher position after cross-model review:** agree with all six missed items and the sequencing change. Disagree on one point: `model-enforce` should stay but move inside the single dispatcher, not remain a separate spawn. The Horizon ordering below is revised accordingly: Horizon 1 now starts with #48 to #53.

### Horizon 1, revised order (after Codex)
1. CI: remove `agents/|commands/|skills/` from the docs-only exemption; make the gate require `code=false` explicitly (#48, #49).
2. Gates: `--decision` mandatory (`--require-decision` default), per-reviewer aggregation with reject-wins ordering + tests (#50, #51); explicit `validation_skipped` records (#10); consumer-CI check before waiving the verifier (#53).
3. Builders: drop mandatory push + draft PR before review (#52); fix report contract and `${CLAUDE_PLUGIN_ROOT}` paths (#7, #14).
4. Packaging: self-contained bundle, smoke-tested from a clean consumer directory, keep `docs/` references intact (#41); pricing + path fixes (#43, #44).
5. Broken references batch (#2, #5, #8, #9, #30, #38) + CI rules for them.
6. Hook dispatcher with `timeout` / `onFailure` (#3, #11, #12, #25), keeping model-enforce as a module inside it.
7. Telemetry write-time validation of missing observations; cost dedupe by `run_id` (#16, #17, #42).
8. Session-start diet and timing-test quarantine (#15, #18), after diagnosing the e2e flake cause.

## 5. What crew already does better than the field (keep)
- Repair-signature dedup in retry loops: no published tool documents an apply / re-review / stop rule.
- Inspectable handoff / review / validation / deployment artifacts as gates: no official or community equivalent.
- Slice ceremony with cost attribution per slice (once the metering is fixed).
- GEPA champion provenance in frontmatter: ahead of most; add GEPA version, budget, seed, split ids, eval-suite hash.

## 6. Open questions for the owner
1. Is devcrew's `crew/` subtree the place to fix, or is a fresh plugin layout (Workflow-based) the goal? Horizon 3 assumes the latter is at least prototyped.
2. Does any consumer repo actually trigger crew skills by description? Nobody could verify skill discovery in an installed consumer (finding #19). One live check settles ~25 skill-description findings.
3. Which of the 12 zero-reference commands and 9 silent agents have interactive users the artifact grep cannot see? `.claude/logs/events.jsonl` on each machine has the answer.
4. Licence: repo `LICENSE` is MPL-2.0, `plugin.json` says MIT, vendored agents have no provenance. Pick one before the next release.

## Appendix A: source reports
Scratchpad: `C:\Users\milas\AppData\Local\Temp\claude\23a36889242caa23\b28390d5-9815-4859-a85a-0538de6d52b5\scratchpad\`
- `audit-agents.md`, `audit-commands.md`, `audit-hooks.md`, `audit-scripts.md`, `audit-skills.md`, `audit-tests-ci-docs.md`
- `research-platform.md`, `research-collections.md`, `research-orchestration.md`, `research-loops.md`, `research-review.md`, `research-evals.md`, `research-cost-obs.md`, `research-memory.md`, `research-guardrails.md`, `research-harnesses.md`, `research-context.md`

## Appendix B: unverified / not covered
- Skill auto-discovery in an installed consumer repo (needs a live test).
- Whether marketplace installs run `bun install` for the plugin (if not, every `node crew.ts` call in every command fails in consumers; devcrew trimmed deps to 4 but still imports `@astragenie/*`).
- Per-validator CI catch rates; cause of rising CI wall time.
- Research coverage gaps: Codex May to Sep changelog; Greptile/Graphite/Copilot review internals; Helicone/Portkey/LiteLLM; Codex approval policies; `if`-field spawn-skip behaviour; Bun cold start on Windows under `bun build --compile`.
- Star counts from GitHub API look inflated across the ecosystem (e.g. 297k in 10 months); treat as popularity only.
