# Audit: scripts/, scripts/lib, evals, deps, config (dev-team v0.67.0)

Read-only. Experiments ran on a copy in scratchpad/nm-test (hooks/, scripts/, package.json, no node_modules). Unverified items are marked SUSPECTED.

## Size and shape

- 170 .ts/.mjs/.mts files under scripts/. Non-test source is 32,969 lines. Tests: 42,600 lines in tests/ plus 824 co-located. Tests outweigh source 1.3x.
- "Runtime-light" claim is false. scripts/lib alone is ~17k lines across 200 files incl. hooks/evals. Biggest dirs: gepa 6,286 | briefing 1,781 | installer 1,279 | artifacts 1,225 | memory 1,212 | telemetry 927 | cost-hygiene 790.
- Largest files: crew.ts 1,819 | e2e-smoke.ts 1,029 | artifacts/write.ts 990 | gepa/candidate-generator-aiplugin.ts 715 | validate-agents.ts 686 | workflow-state.ts 673 | gepa-optimize-cmd.ts 583 | render-universal-skills.ts 559 | installer/templates.ts 540.
- crew.ts has 54 subcommands (COMMANDS table, crew.ts:833+). Usage text still prints `node scripts/crew.mjs` (crew.ts:409) though the file is .ts.
- Subcommands with zero references in commands/agents/skills/hooks/docs: show-workflow-state, agent-route (also zero tests), gepa-corpus-sync, gepa-corpus-report, gepa-corpus-optimize, gepa-eval (only a commands/*.md), gepa-mine-reviewer, memory-drift-check (only CI drift.yml + e2e). features-list and gepa-thaw have 1 ref.
- Orphan lib modules (no non-test importer): branch-cleanup.ts, brief-me/cost-aggregator.ts, cost/asymmetry-detector.ts, ids.ts (branded IDs, unused), parallel-gates.ts, schemas.ts (zod WorkflowStateSchema, test-only), slice-linker/dispatch.mts (367 lines, its header says live orchestrator for runner; no importer here). ~960 lines.
- GEPA (6.3k lines, 7 slash commands, ~50 refs in crew.ts) is the single biggest subsystem. Judge config defaults to ollama/gemini. It sits on the artifact write path (see F7).

## Ranked findings

### F1 CRITICAL: CLI and hooks crash if node_modules is absent (plugin-cache installs)
- Evidence (my run, no node_modules): `Cannot find package '@astragenie/plugin-std' imported from scripts/lib/wakeup.mjs`. Same for brief-me, show-claims, show-approvals, cost-watch, profile-block (memory-provider), gepa-history (gepa-core), write-handoff (result.ts).
- Hooks run with `bun --no-install`: otel-stop exits 1 (`Cannot find package 'zod'` from scripts/lib/telemetry/hook-input.ts:7), pre-tool-use-agent and check-subagent-return exit 1 (`@astragenie/plugin-std/jsonl` from scripts/lib/dispatch-timing.ts:4).
- Plain `bun hooks/x.ts` without `--no-install` silently auto-installs (measured 1.4s warm, 4.2s for otel-stop). So hooks "work" only via network + bun auto-install; offline or cold they fail or stall.
- CHANGELOG 1498-1506 documents the same bug fixed three times (otel v0.37.2, #185, #194). artifact-schemas.ts:1-18 says "plugin-cache ships source only, no node_modules". The plugin-std adoption (result.ts:16, wakeup.mjs:5, approvals.ts:4) reintroduced it.
- Mitigation on this machine: ~/.claude/plugins/cache/astra/crew/0.67.0/node_modules exists (240 entries, installed manually Jul 20). A fresh consumer has none. SUSPECTED: Claude Code plugin loader does not run install; consistent with the CHANGELOG's own claim.
- package.json misdeclares: zod and yaml are devDependencies but imported by hooks at runtime (telemetry/config.ts, hook-input.ts). @opentelemetry/resources and sdk-trace-base are imported (otel-bridge.ts) but not declared.
- Fix: bundle each hook and crew.ts to single JS files (`bun build --target=node --outfile dist/crew.js`, commit dist or build in release CI), or vendor plugin-std's 130KB dist. Add a CI job that runs every hook and the top 10 subcommands from a node_modules-free copy (what I did here).

### F2 HIGH: cost reports have unbounded windows and are re-emitted; the snapshot's "$2433/iteration" is not a per-iteration measurement
- emit-cost-report.ts:132-165: window is `currentRun.startedAt .. now`. If /loop:slice start did not rotate currentRun, the window spans days.
- Evidence (.claude/artifacts/crew/cost/): the "slice" report 20260707T080727Z has Window 2026-06-29 to 2026-07-07 (11,323 min), 12 sessions, $4026.67. The identical 4026.6668 appears 3 times (080727, 081101, 081121). The "aggregate" sibling (aggregate_all: true, emit-cost-report.ts:87-90) sums 193 sessions across every project on the box: $32,101.
- Across 218 reports: sum $119k, mean $547. 81 are `source_project: aggregate`. The last report pair (20260708T172610, 092048) is $0 with Sessions Scanned 0 because source_project is a worktree dir (`...-wt-review-cost-levers`) that has no matching ~/.claude/projects slug.
- So the number is real tokens priced, but divided wrongly: it averages slice and aggregate-all reports, duplicates, and multi-day windows. The snapshot generator lives in runner-plugin (not here), SUSPECTED it does not filter kind or dedupe.
- cost-report writes are not idempotent. #178 (write.ts:764) only guards against clobbering, not against a wide window.
- Fix: refuse to emit if window > N hours or run.startedAt older than the last slice-complete; emit aggregate-all only on request; add `run_id` to frontmatter and dedupe by it; resolve source project from git common dir for worktrees.

### F3 HIGH: pricing table misprices all Claude 5 models and likely Opus 4.5+
- scripts/lib/pricing.json has only claude-opus-4 / sonnet-4 / haiku-4; fallback claude-sonnet-4. Models in this very session's transcripts are `claude-fable-5-1` and `claude-sonnet-5-5`, both fall to sonnet-4 rates ($3/$15). session-cost.ts:27-34 prefix-matches silently, no warning on fallback.
- Prefix `claude-opus-4` also catches opus-4-5+ at $15/$75. SUSPECTED these later models are cheaper, which would overstate cost ~3x. Verify against the current price list.
- Fix: emit `unpriced_models` in the report and fail the cost-advisor verdict when non-zero; add Claude 5 keys; unit-test model-id matching.

### F4 HIGH (Windows): path-with-spaces breaks pricing load
- scripts/lib/session-cost.ts:21 `new URL(import.meta.url).pathname.replace(...)` leaves `%20` encoded (verified: `C:/Users/John%20Smith/x/a.ts`). Any Windows user with a space in their profile path loses all cost reports (errors swallowed as "non-fatal"). 20 other files correctly use fileURLToPath. validate-syntheses.ts:262 comment even warns about this pattern.
- Fix: `fileURLToPath(new URL("./pricing.json", import.meta.url))`, or import the JSON.

### F5 MEDIUM (Windows, SUSPECTED): log_event.sh writes invalid JSON for backslash paths
- scripts/log_event.sh:~22 interpolates `$project_dir` and `$payload_path` into printf JSON unescaped. With CLAUDE_PROJECT_DIR=C:\work\x the line is invalid JSON (verified with node JSON.parse: "Bad escaped character"). I did not confirm what value Claude Code sets on this OS. Also relies on bash being on PATH for 10+ hooks; scripts/windows/ is untracked.
- Fix: replace with a bun/node one-liner using JSON.stringify, or escape backslashes and quotes.

### F6 MEDIUM: state files, non-atomic writes and weak lock
- workflow-state.ts:208, claims.ts:185, approvals.ts:80, artifacts/write.ts:968 use plain `fs.writeFile` (truncate then write). loadWorkflowState (workflow-state.ts:121-142) reads with no lock, so hooks (gate-guard, artifact-lock) can read a torn file and `JSON.parse` throws; state is "trusted shape", no schema_version, no validation (comment line 133).
- Lock (workflow-state.ts:150-193): `wx` lock file, no owner token, steals after 10s while timeout is 5s. A writer slower than 10s (or two waiters both unlinking) can lose mutual exclusion. Read-modify-write sections are inside the lock (good).
- write.ts:80 timestamp has 1-second resolution and `writeFile` is not `wx`: two artifacts of same kind and title in the same second overwrite (parallel gates).
- Fix: write tmp + rename; lock holds pid+nonce and is removed only by owner; add `schemaVersion` to workflow-state.json; use `wx` + counter suffix for artifacts.

### F7 MEDIUM: duplication against plugin-std, contrary to Never-do
- parseFrontmatter hand-rolled ~10 times: artifact-cache.ts/.mjs, build-bundle/inline.ts:20, briefing/collect-cost-parser.ts:33, orchestrate-slice-classify.ts:152, validate-agents.ts:27, validate-skills.ts:28, validate-bundles.ts:65, validate-ux-spec.ts:47, validate-syntheses.ts:151, agent-stats-aggregator.ts:58. plugin-std exports parseFrontmatter.
- git wrappers: branch-cleanup.ts:12, briefing/git.ts:48, gepa-killswitch-cmds.ts:54, worktree-manager.ts:30, assemble.ts:39 despite plugin-std/git runGit (also used in 5 files).
- jsonl.mjs tailReadJsonl vs plugin-std jsonl `tail`; agent-stats-aggregator.ts:35 readJsonlFile vs `readSafe`; 10 local `nowIso`.
- Parallel `.ts` and `.mjs` copies: dir-cache, artifact-cache, fs-utils (the .mjs set exists so wakeup.mjs runs without type stripping; now pointless).
- Hot-path coupling: writeArtifact (write.ts:968-985) fires three detached captures (GEPA tee, failure trial, memory credit). The crew.ts exit path and hooks pay for it (guarded-fire.ts, capture-failure-trial-guard.ts with 1.5s race). Test-only hooks (`__guardTimeoutMs`, `__creditMemoriesUsedLoader`) are in the production signature.

### F8 MEDIUM: dependency hygiene
| dep | actual use | verdict |
|---|---|---|
| @astragenie/astramem-plugin (git URL pin e851f19c, 2.4MB) | no import anywhere; only a comment (inject-recall.ts:24) | orphan, remove; git-URL dep also breaks `npm ci` offline/without SSH (CHANGELOG 548) |
| @aws-sdk/client-bedrock-runtime (+@smithy, 11MB) | only evals/providers/bedrock.ts | devDependency/optional |
| @opentelemetry/* (29MB) | dynamic import in otel-bridge.ts, opt-in | optionalDependencies or user-installed |
| @redocly/cli (18MB), openapi-typescript | only validate-contracts.ts (CI) | devDeps ok, correct |
| @biomejs 77MB, typescript 24MB | dev | ok |
- node_modules 290MB / 293 packages; the installed cache copy also ships tests/ (168 files), evals/, docs/, langfuse/. No `files`/ignore trimming. Plugin source repo size-pack 13MB, 2,060 tracked files under .claude/artifacts.
- npm and bun lockfiles both committed (package-lock.json + bun.lock), drift already caused CHANGELOG #168.
- `lint` script covers scripts/ hooks/ only; biome.json includes tests/ evals/, so evals/ and tests/ are never linted.

### F9 LOW/MEDIUM: runtime split and FEAT-190
- 153 prompt lines invoke `node`, 28 invoke `bun`; hooks.json runs 14+ hooks on bun while their shebang says node. Both runtimes are de facto required.
- FEAT-190's stated root trigger is stale. It says gepa-core ships raw .ts and Node refuses to strip types under node_modules. Installed @astragenie/gepa-core 0.10.1 ships dist/index.js; `node -e "import('@astragenie/gepa-core')"` succeeds (31 exports) and `node crew.ts gepa-history` runs. Comments in capture-failure-trial-guard.ts:3-8 and hooks/lib/check-subagent-return.ts:24 are obsolete, and the 1.5s timeout race around gepa import may be unneeded (SUSPECTED, not measured cold).
- Recommendation: re-scope FEAT-190. The real remaining problem is F1 (distribution), which bundling fixes regardless of runtime. Pick bun for hooks/CLI only if the bundle is built for it; otherwise a single node-targeted bundle removes the choice.

### F10 LOW: error handling
- 233 `catch {` blocks in scripts/hooks, ~112 followed immediately by return null/undefined/false/{} or an empty body. Many justified for hooks (fail-open) but cost/telemetry paths hide real failures (F2, F4 went unnoticed because "non-fatal").
- process.exit in library code: lib/memory/drift-check.ts:260 (runner), lib/parallel-gates.ts:157 (guarded by isMainEntry, but this module has no importer). installer/templates.ts:405-434 are inside a template string for a generated hook, not library code. Never-do largely respected.
- 110 dynamic `await import(` calls used as lazy-load workaround; 18 `as unknown as`; ts-ignore is 1.

### F11 LOW: tests
- 43k lines of tests; only 4 test files use mock APIs, so mock-only testing is not the problem. Gaps: no direct test importing session-cost.ts (501 lines, the cost math), installer/templates.ts (540), briefing/render.ts (517), wakeup.mjs (413), preflight/checks.ts (248). Many are covered indirectly via CLI spawns; none covers F3/F4/F5.
- Missing test class: run hooks and CLI from a copy without node_modules (F1).

## Drastic improvements

1. Bundle: build dist/crew.js and one bundle per hook (bun build, target node, externalize opentelemetry/aws). Kills F1 permanently, makes hooks ~10ms faster via fewer resolves, lets you ship a plugin without node_modules and without tests/evals/docs (set `.claude-plugin` file list or use a release branch). Impact: removes the #1 install-failure class; cache install goes from ~290MB to <2MB.
2. Split the repo: move GEPA (6.3k lines, 7 commands), evals/, langfuse/, apply-model-profile, render-* and cost-advisor into a separate "crew-lab" plugin or into plugins-common. Core crew keeps artifacts, workflow-state, hooks, wakeup. Impact: ~-9k lines and 3 heavy deps (@aws-sdk, @opentelemetry, gepa-core) from the consumer path; removes the detached tee from every artifact write.
3. Dedupe onto plugin-std: delete ~10 parseFrontmatter, 5 git wrappers, tailReadJsonl, .mjs twins, ids.ts, schemas.ts, parallel-gates.ts, branch-cleanup.ts, cost/asymmetry-detector.ts. Impact: ~-1.5k lines, one behavior per primitive.
4. Prune the CLI: drop or fold dead subcommands (show-workflow-state, agent-route, gepa-corpus-*, gepa-eval, gepa-mine-reviewer) and split crew.ts (1,819 lines) into per-command modules. Impact: -400 lines; clearer help.
5. Fix cost telemetry end-to-end: bounded window, idempotent by run_id, pricing with unpriced warning, worktree-aware project slug, and a single `cost-summary` that excludes aggregate_all. Impact: the loop's cost-advisor stops acting on a number inflated ~100x by double counting.
