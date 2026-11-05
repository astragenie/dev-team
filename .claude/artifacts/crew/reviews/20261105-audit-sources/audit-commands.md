# Audit: commands/ dispatchers (crew v0.67.0)

Read-only. Evidence verified against repo at C:\work\mega\dev-team. Items I could not run or prove are marked SUSPECTED.

## 0. Surface and size

- 35 top-level commands plus 4 vendored `commands/3rdparty/*` (3135 lines total, 2850 top-level).
- Heavy prompts (lines / bytes): orchestrate-slice 651 / 38 KB (~9.5k tokens), fix 223 / 19 KB, build 212 / 21 KB, architect-feature 192, ship 181 / 9 KB, incident 142 / 9 KB, gepa-optimize 113.
- Tiny prompts (20-60 lines): 17 commands.
- README lists 9 of 35 commands (brief-me, build, fix, review, validate, ship, adopt, init, install). Not in README: incident, design, parallel, orchestrate-slice, architect-feature, quickwin, cost-setup, all 7 gepa-*, all claims/approvals commands.
- Reference counts (files under .claude/artifacts + repo docs/skills/agents/README/hooks/scripts/tests that mention `crew:<name>`):
  - Actively used: review (39 artifacts), build (30), fix (28), parallel (24), orchestrate-slice (22), brief-me (19), validate (12), gepa-eval (12), ship (7), adopt (7), gepa-optimize (6), init (5).
  - Essentially dead (0 artifact references): wake-up-brief, show-conflicts, show-claims, show-approvals, resolve-approval, request-approval, release-files, claim-files, parallel-review, audit-repo, quickwin, cost-setup (0 repo refs too). Another 7 have 1-3: incident (1), design (1), prune-artifacts (1), gepa-thaw/history/revert/resume/invalidate (2-3).
  - 8 of the 12 dead ones are descriptions like "Internal/debug/Advanced internal coordination" wrappers over `crew.ts` subcommands that already exist as CLI verbs.

## 1. Ranked findings

### HIGH

**H1. `/crew:parallel` dispatches a slash command as an agent.**
`commands/parallel.md:38` — "invoke N parallel Agent calls with `subagent_type: crew:build`". There is no `agents/build.md`; `crew:build` is a command. Verified: `ls agents | grep build` is empty, and `crew:build` resolved as COMMAND, not agent, in a name cross-check. Likely to fail or fall back to general-purpose with none of the build ladder. Fix: dispatch `general-purpose` (or a real agent) with a prompt that says "run the /crew:build ladder", or add a thin `agents/slice-runner.md`. Add a `validate-agent-refs` rule that `subagent_type: crew:X` must exist in agents/.

**H2. Light path measures a diff that does not exist yet (fails open to "eligible").**
`commands/build.md:15-27`, `commands/fix.md:15-24` — "Size: `git diff --stat HEAD` -> <=2 files AND <=50 lines" and marker grep, run *before* implementation. On a clean tree the diff is empty, grep gets empty input and exits 1, which the doc defines as "light path eligible". Untracked new files are also invisible to `git diff HEAD`. So a fresh `/crew:build <big feature>` matches the light path by default and gets `dev-lite` plus `reviewer-lite` with no validation. The only backstop is reviewer-lite rejecting *after* the work is done (`agents/reviewer-lite.md:83-85`). Also the marker regex is C#/React-specific (`IQueryable|Include|use[A-Z]`) and `git` failure also yields "eligible". Fix: decide light path from the *task* (user text, named files) or from a builder-produced diff, and treat empty diff / git error as "not eligible".

**H3. `mark-badge --badge inspected` is not a valid badge; light-path fix cannot finish cleanly.**
`commands/fix.md:34` — "mark-badge inspected". I ran `crew.ts mark-badge --badge inspected` in a temp repo: `Unsupported workflow badge: inspected`. The valid list is at `scripts/crew.ts:422` / `scripts/lib/workflow-state.ts` and has no `inspected`. Fix: delete the line or add the badge to BADGE_TABLE.

**H4. Several commands use cwd-relative script paths, so they only work inside the dev-team repo.**
- `commands/review.md:29`, `commands/validate.md:19`: `node -e 'import("./scripts/lib/build-bundle/inline.ts")...'`
- `commands/gepa-{history,invalidate,resume,revert,thaw}.md`: `node scripts/crew.ts ...`
- `commands/gepa-eval.md:28`: `bun run evals` (needs `evals/` in cwd)
- `commands/orchestrate-slice.md:122,125,320,482,587`: `./scripts/validate-contracts.ts`, `validate-ux-spec.ts`, `orchestrate-slice-classify.ts`, `node scripts/crew.ts mark-badge`
All other commands correctly use `${CLAUDE_PLUGIN_ROOT}`. In any consumer repo the relative ones resolve against the consumer cwd and fail. For review/validate the failure is documented as "non-blocking", so the bundle preload is silently never applied outside this repo. Also single-quoted `node -e '...'` breaks under PowerShell. Fix: expose `crew.ts inline-bundle --slice` (function already exists in `scripts/lib/build-bundle/inline.ts`, no CLI verb) and use `${CLAUDE_PLUGIN_ROOT}` everywhere. The 7 gepa commands (and the evals tooling) are maintainer-only and should not ship in the consumer plugin surface at all.

**H5. `jq` is a silent hard dependency and is not installed on the maintainer's machine.**
`which jq` on this box: not found. Consequences:
- `build.md:51`, `fix.md:53` collision pre-flight: jq failure is swallowed (`2>/dev/null`) and the doc says fail-open ("treat it as no collision"). The WS-4 collision protection is silently off.
- `orchestrate-slice.md:161-172, 210-217, 240-247`: `... 2>/dev/null | jq -r '.block // empty'` yields "" for skills block, recall block, and profile block. The whole memory/skills injection is silently dead on this machine, with no warning.
Fix: have crew.ts print the raw block (`--raw`) or `--field block` so jq is not needed; if jq stays, preflight it and warn once.

**H6. Review/validation gate semantics contradict across docs: LOW-risk slices skip the validator, yet docs say "always".**
- `commands/orchestrate-slice.md:517`: RISK_GATE=false -> "dispatch exactly one crew:reviewer ... Do not dispatch a dedicated crew:verifier", validation delegated to CI + "satisfiedByReview".
- `docs/routing-table.md:64`: "dispatcher -> always `crew:verifier` ... No skip path, even for code-only diffs".
- `skills/workflow/dispatcher-routing/SKILL.md:41`: "LOW-tier slices run crew:reviewer + crew:verifier concurrently".
- Constitution rule 6: behavior change => validation gate. `BEHAVIOR_CHANGED` defaults to `true` (orchestrate-slice.md:53), and the default path then validates nothing in-run. CI is not evidenced inside the run, so "validation_passed" is never produced; the gate is waived by design. Also /crew:fix says "No verifier dispatch. Verifier defers to /crew:ship" (fix.md:114), so a bug fix never gets behavioral validation inside its own flow.
Fix: pick one policy and record `validation_skipped --note "delegated to CI"` explicitly on RISK_GATE=false instead of silently omitting; update the three docs from one source.

### MEDIUM

**M1. `/crew:fix` contradicts itself on investigation and on rejection.**
- `fix.md:91` says dispatching `crew:investigator` for root cause is the "common mistake"; `fix.md:166` (Workflow step 4) says "Dispatch `crew:investigator`" unconditionally and "Read the returned finding artifact" (investigator writes none per fix.md:86).
- `fix.md:199`: "If either reviewer returns rejected, stop. Surface the findings to the user" vs the Auto-fix retry loop at `fix.md:116-140` that says re-dispatch on rejected. An LLM follows whichever it reads last (the numbered Workflow, i.e. stop).
- `build.md` has no retry loop at all (rejected -> escalate, `build.md:109`) while fix/incident/ship loop. Intentional or not, undocumented.

**M2. Ship has no entry preconditions and no failure handling around `gh`.**
`commands/ship.md` — description says "from reviewed, local-commit-ready work" but never checks `review_passed`, a clean tree, being off `main`, or that the branch is pushed. `gh pr create` (ship.md:82) has no error branch; step 3 then writes a `passed` deployment-check with `--url "<PR URL>"` regardless. Aggregation only models `passed/failed` (ship.md:63-64) while `agents/verifier.md:67` returns `passed_with_notes`, which has no defined branch. Fix: add a precondition block (read gates from `show-workflow-state`), handle `passed_with_notes`, make the deployment-check conditional on `gh` exit 0.

**M3. Stale doc/path references.**
- `orchestrate-slice.md:62-63` names `scripts/orchestrate-slice-classify.mjs`; the file is `.ts`.
- `orchestrate-slice.md:330,337,361,368,393,400`: "recall block from Step 2.6" but 2.6 is model tier; recall is 2.7.
- `orchestrate-slice.md:452`: tells the user to run `/crew:fix --target integration`; fix.md has no `--target` flag.
- `architect-feature.md:22-25`: looks for FEATs in `docs/backlog/{triaged,in-progress,pending,done}/`; `docs/backlog/` now holds only README + templates (CLAUDE.md: authoritative tree is `.claude/artifacts/loop/backlog/`). Command halts with "not found" on every real FEAT.
- `orchestrate-slice.md:13-16`: first two slice globs (`docs/ai-loop/...`) do not exist; only the third (`.claude/artifacts/loop/ai-loop/slices/**`) resolves.
- Eight commands (build, fix, incident, review, validate, design, adopt, init, parallel-review) say "see `constitution.md` (`What "Substantial" Means`)". Grep across repo constitution and ~/.claude/crew/constitution.md: that section does not exist (only appears in the same command text and a worktree copy). The definition the gate depends on is missing.
- `build.md:90`, `fix.md:156`, `orchestrate-slice.md:200` "Honest limitation ... a PreToolUse hook on Agent ... not built". `hooks/pre-tool-use-model-enforce.ts` exists and is registered at `hooks/hooks.json:129`. The paragraph is false and wastes ~150 tokens x3.
- `build.md:118` "Run /crew:ship gates only on explicit user approval" vs `build.md:192` step 24a auto-continue into ship when `dev.stable: true`.

**M4. Hand-copied routing tables despite "do not hand-copy".**
`build.md:78` and `fix.md:144` correctly point at the generated matrix. But `ship.md:101-107` and `incident.md:93-100` still embed their own FEAT-tag -> builder tables, and they already differ from the yaml-rendered matrix (no `stack:node/python/surface:api` rows, no `TS_TOOLING_ONLY` rule, `.cs -> backend-dev` only). `docs/routing-table.yaml` renders only to `docs/routing-table.md`; no command prompt is generated from it.

**M5. orchestrate-slice has no retry cap or repair-check, and nests /crew:fix.**
`orchestrate-slice.md:583-594`: needs_fix -> "Re-dispatch builder (run /crew:fix flow)" -> re-run gates -> repeat. No counter, no `repair-check`. /crew:fix has its own loop (N=2), so the effective bound is nested and unclear. The vocabulary also differs: `needs_fix` / `passed_with_notes` here vs `rejected` / `approved_with_notes` elsewhere (CLI accepts `needs_fix` as an alias, `crew.ts:627`, but badge-driven checks and humans see two dialects).

**M6. Hard coupling to the `loop` plugin, undeclared and unprobed.**
- `orchestrate-slice.md:7` "Run this after `/loop:slice start`"; `:650` ends with `/loop:slice complete`. Slice file globs and layout are loop's.
- `parallel.md:24-26`: hand-builds `~/.claude/plugins/cache/loop/loop/<version>/scripts/loop.mjs`. On this machine `~/.claude/plugins/cache/loop/` does not exist and `installed_plugins.json` has no loop entry, so `/crew:parallel` cannot run here; the command has no "loop not installed" stop, only a path guess. `orchestrate-slice.md:147` uses a `find ... | sort -V | tail -1` variant (and `$HOME`), a different lookup than parallel.md. `${HOME}` is unset in plain PowerShell.
- `plugin.json` declares no dependency on loop.
Fix: one `crew.ts loop-root` helper (env, then installed_plugins.json, then cache scan), non-zero exit with an install hint.

**M7. Collision pre-flight can mis-trigger and breaks on spaced paths.**
`build.md:43-59` / `fix.md:45-61`: any `currentRun.status != completed` on the branch triggers creating a new worktree. A crashed or abandoned run, or a continuation of the same workstream in the same session, forces worktree sprawl every time (the doc even says it covers the "current dir is the only worktree" case). `awk '{wt=$2}'` truncates worktree paths with spaces. 38 lines duplicated verbatim in two files.

**M8. `prune-artifacts` conflicts with the repo's retention policy.**
`commands/prune-artifacts.md` deletes `.claude/artifacts/crew/**` older than 90 days by default; CLAUDE.md says those artifacts are committed durable cross-machine history. Destructive pass is only guarded by prose ("run dry-run first"). Fix: require `--yes` after a dry-run listing, and default to archive.

### LOW

- L1. `--full` (build/fix light-path opt-out) is the only flag parsed from `$ARGUMENTS`, but build/fix/ship/incident/review/validate/design never reference `$ARGUMENTS` or declare `argument-hint`; only 8 of 35 commands have `argument-hint`. Flags are inconsistent across the surface: `--full`, `--auto-start`, `--dry-run`, `--max-features`, `--target`, `--environment`; none shares a parser.
- L2. `incident.md:126` "`crew:verifier` with `--environment staging`": verifier is an agent prompt, not a CLI; there is no such flag. Convention is prose in the dispatch prompt.
- L3. `build.md` is ordered ladder-first, workflow-second. The numbered Workflow (step 1 `pwd`, step 2 wake-up) is at the bottom, after the dispatch instructions, so a model can dispatch before it has verified the workspace. `fix.md` has the same structure.
- L4. `review.md` and `validate.md` produce artifacts that auto-apply badges (`workflow-state.ts:429,468`); `build.md`/`fix.md` then run an additional `mark-badge review_passed` as well (build.md:112, fix.md:204). Redundant and a second path to set the gate without an artifact.
- L5. `quickwin.md` relies on textual `$ARGUMENTS` substitution into `read -ra`, so paths with spaces or quotes split wrongly (bash-only, fine in Git Bash).
- L6. Commands call `node ".../crew.ts"` without `--experimental-strip-types`. AGENTS.md says Node >= 22.6 needs the flag; unflagged type stripping arrives in 22.18 / 23.6. SUSPECTED break on 22.6-22.17. Maintainer has v24.15.0, fine locally.
- L7. SUSPECTED: `crew.ts` imports `@astragenie/*`, `zod`, `yaml`, which are npm deps; `hooks.json` has no install step. A plugin installed into the cache from git may lack `node_modules`, in which case every `node crew.ts` call in every command fails. I did not verify how the marketplace install handles dependencies.
- L8. `.claude/worktrees/inherited-yawning-puppy/` contains a full stale copy of `commands/` (committed? it is under the ignored `.claude/worktrees/`); greps and validators that walk `.claude/` double-count. Not a bug, but it polluted my reference counts until excluded.

## 2. Duplication (quantified)

- Of the five main dispatchers, exact-line overlap (lines >40 chars appearing in 2+ files): build 39 of 125 (31%), fix 44 of 129 (34%), incident 11 of 78, review 6 of 32, validate 6 of 25. There are 50 distinct duplicated long lines, plus many near-duplicates differing by one variable.
- Blocks repeated by copy-paste:
  - Collision pre-flight bash + peer-dispatch isolation section: build.md and fix.md (~45 lines each, byte-identical bash).
  - Model-tier resolution + "Honest limitation": build, fix, orchestrate-slice.
  - Recall-block + profile-block + credit-loop injection (CLI + prose): build (2 steps), fix (1 big step), ship (2 steps), orchestrate-slice (8 mentions, 3 variants x 2 blocks). Roughly 12 lines each x 4 files, every one with the same "if non-empty prepend, else omit" sentence.
  - `repair-check` retry protocol: fix, ship, incident (4 mentions each, ~12 lines).
  - Reviewer A/B fan-out routing (.cs/.ts/lens mapping): build, fix, incident, and referenced from review.
  - Reviewer-idle watchdog paragraph: build, fix, review (identical).
  - write-review-result / write-handoff / write-final-synthesis command lines with the apostrophe-quoting caveat: build, fix, incident, review.
- Estimated reducible: ~35-40% of build + fix + incident + ship (~300 of ~760 lines) with no loss of behavior. orchestrate-slice's 651 lines are mostly unique but contain ~120 lines of copy-pasted prompt templates (3 builder prompts nearly identical, 2 doc-writer prompts nearly identical).

## 3. Windows safety summary

- Everything is bash + `jq`/`awk`/`find`/`sort -V`/`read -ra`/process substitution. Works in Git Bash, not PowerShell. Acceptable if Claude Code's Bash tool is always Git Bash, but nothing in the commands says so, and the session default shell here is PowerShell.
- `${CLAUDE_PLUGIN_ROOT}` paths with spaces are quoted correctly in all crew.ts calls (good).
- Missing: `jq` (H5), cwd-relative paths (H4), single-quoted `node -e` (H4), `${HOME}` (M6).
- All `crew.ts` subcommands called from commands exist (checked all 30 distinct subcommands against `scripts/crew.ts` handlers). All `crew:<agent>` references resolve except `crew:build` in parallel.md (H1). All referenced skills and contracts exist.

## 4. Gate fail-open inventory

1. Light path default-eligible on empty diff (H2).
2. Collision check fail-open on missing jq/git/state (H5, M7).
3. RISK_GATE=false skips validator, no explicit skip record (H6).
4. /crew:fix never validates behavior (H6).
5. ship has no review/validation precondition (M2).
6. `write-review-result` without `--decision` still defaults to approve for "legacy" callers (`workflow-state.ts:421-430`: "historical default-approve behavior unchanged"). Commands always pass `--decision`, so this is a CLI-level trap rather than a command bug; worth a `--require-decision` default.
7. Recall/profile/skills injection failures are silent by design (fine for memory, but there is no "degraded" signal anywhere).
8. Positive: unknown verdicts fail closed (exit 2), `blocked` after repair-check `shouldStop`, hard cap on retries in fix/ship/incident.

## 5. Drastic improvements

1. **Collapse 35 commands to ~9 public + 1 `/crew:admin`.**
   Public: `build`, `fix`, `ship`, `review`, `validate`, `incident`, `design`, `brief-me`, `setup` (merging init, adopt, install, audit-repo, cost-setup). Fold the 7 gepa-* into one maintainer-only `gepa <sub>` that does not ship to consumers; fold claim-files/release-files/show-claims/show-conflicts/request-approval/resolve-approval/show-approvals/wake-up-brief/quickwin/parallel-review into one `/crew:admin <sub>` (or just let the model call `crew.ts` directly, as it already does). Delete `parallel-review` (39 lines of advice, no steps). Impact: 35 -> ~10 entries in the slash menu; README can list them all; ~600 lines of near-empty files go away.

2. **Extract a shared "dispatcher kernel" and generate the ladders.**
   Move collision pre-flight, model-tier resolve, recall/profile injection, reviewer fan-out + watchdog, repair-check retry loop, and gate-write commands into one include (a skill `dispatcher-kernel`, or `commands/_kernel.md` inlined at build time by a render script, same pattern as `render-routing-table.ts`). build/fix/incident/ship then become 60-90-line deltas (light path, triage table, badge names). Impact: build+fix+incident+ship drop from ~760 to ~380 lines (about -50% tokens per invocation, ~5k tokens saved per /crew:build), and the stale-copy drift (M3, M4) cannot recur.

3. **Move the whole recall/profile/model-tier/collision preamble into the CLI.**
   Add `crew.ts dispatch-prep --agent X --tags T --phase build [--run-id]` that returns one JSON: `{model, recallBlock, profileBlock, skillsBlock, collisionWorktree}` with its own jq-free logic and a `degraded: [...]` array. Impact: removes jq (H5), the cwd bugs (H4), the 3x duplicated prose, and gives a real signal when memory is down. The dispatcher prompt becomes "run dispatch-prep, pass `model`, prepend the two blocks".

4. **Make routing single-source and machine-rendered into the prompts.**
   `docs/routing-table.yaml` should also render the builder-matrix and the reviewer A/B lens table into ship/incident/fix/build (between HTML-comment fences, per DEC-028), and the validate step in `validate-routing-table.ts --coverage-only` should fail CI when a command embeds an unfenced FEAT-tag table. Impact: kills the ship/incident drift and the three-way contradiction on the validation gate (H6).

5. **Make gates data, not prose: one `crew.ts gate-status` and a preflight in every flow.**
   Each flow starts with `gate-status --require review` (ship) or `--expect validation` and records an explicit `*_skipped --note` whenever a branch (light path, RISK_GATE=false, fix) bypasses a gate. The light-path decision moves into `crew.ts classify-light --task "<text>"` (testable, unit-tested, fail-closed) instead of a bash grep over a nonexistent diff. Impact: closes the fail-open list in section 4 and makes the gates testable; the CI already has validators, so this is where they should extend.

6. (Bonus) Declare the loop dependency: a `requires: loop` capability check at the top of orchestrate-slice and parallel (`crew.ts loop-root`), with a clear "install loop or use /crew:build" message. Consider moving orchestrate-slice + parallel + architect-feature (all loop-shaped, ~920 lines) into the loop plugin, since they assume its layout and CLI.

## 6. Not verified (SUSPECTED)

- Whether Claude Code substitutes `${CLAUDE_PLUGIN_ROOT}` inside command markdown bodies on this version (all commands depend on it; other plugins do the same, so likely yes).
- Whether marketplace installs of crew run `npm/bun install` (L7).
- Whether `reviewer-lite` artifacts satisfy the same gate checks as `reviewer` when the light path runs (it uses `write-review-result`, so the badge path should work).
- Real invocation counts: `.claude/logs/` is machine-local and I did not parse `events.jsonl`; usage numbers are artifact/doc references only, which understate interactive use of tiny commands (brief-me, review).
