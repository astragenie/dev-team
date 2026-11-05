# Validation: devcrew 1.1.0 consumer-install smoke baseline (pre-remediation)

- Date: 2026-11-05
- Validator: dispatcher (main session)
- Target: installed plugin cache `~/.claude/plugins/cache/astra/devcrew/1.1.0` (the artifact a consumer actually gets)
- Method: fresh `git init` consumer repo in scratchpad; invoke each hook with a sample PreToolUse payload via `bun --no-install`; invoke CLI subcommands; grep source for the audit's gate/CI claims.
- Decision: **FAIL** (baseline; this is what the remediation plan must turn green)

## Results

| Check | Result | Evidence |
|---|---|---|
| `node_modules` present in plugin cache | absent | `ls .../devcrew/1.1.0/node_modules` → no such file |
| `crew/hooks/pre-tool-use-bash-gate.mts` | PASS rc=0 | |
| `crew/hooks/check-redundant-read.mts` | PASS rc=0 | |
| `crew/hooks/pre-tool-use-agent.mts` | FAIL rc=1 | `Cannot find module '@astragenie/plugin-std/jsonl'` |
| `crew/hooks/otel-post-tool-use.mts` | FAIL rc=1 | `Cannot find package 'zod'` |
| `crew/hooks/subagent-gate-guard.mts` (enforcement) | FAIL rc=1 | `Cannot find module '@astragenie/plugin-std'` |
| `hooks/pre-push-gate.mts` (enforcement) | FAIL rc=1 | `Cannot find module '@astragenie/plugin-std/git'` |
| `hooks/{guard-feat-dispatch,bootstrap-context,report-gate,emit-astrarunner-event}.mjs` | PASS rc=0 | self-contained |
| `crew/scripts/crew.mts brief-me` | FAIL rc=1 | `Cannot find module '@astragenie/plugin-std'` |
| `crew/scripts/crew.mts show-workflow-state` | FAIL rc=1 | same |
| `crew/scripts/crew.mts write-review-result --help` | PASS rc=0 | |
| `src/scripts/loop.mts` under Node | refuses | "requires the Bun runtime"; commands invoke it with `bun` (37 refs), consistent |
| Hook `timeout` fields | present (11) | `.claude-plugin/hooks/hooks.json` — dev-team finding #12 is fixed here; `onFailure` still absent |
| CI docs-only exemption includes `\.md$` | present | `.github/workflows/ci.yml:112` — agents/commands/skills changes skip validators |
| CI `changes` job on empty diff | fail-safe | `ci.yml:106-109` sets `code=true`; but `gate` at `ci.yml:348` passes on `code != "true"`, so a failed `changes` job (empty output) passes the gate |
| `write-review-result` without `--decision` | accepted | `crew/scripts/crew.mts:566-567` returns `undefined`; `crew/scripts/lib/workflow-state.mts:426-431` applies `review_passed` |
| Two reviewers, reject then approve | last writer wins | `workflow-state.mts:424-446` has one `reviewResult` slot and `applyBadge` per call; no per-reviewer aggregation |
| `/devcrew:parallel` dispatch target | nonexistent agent | `commands/parallel.md:40` `subagent_type: devcrew:build`; no `agents/build.md` |
| `/devcrew:fix` badge | invalid | `commands/fix.md:36` `mark-badge inspected` |
| Light path on clean tree | eligible | `commands/build.md:14-22` grep over `git diff HEAD` before any work |
| Reviewer mandatory skill path | missing dir | `agents/reviewer.md:100` `docs/workflow/reviewing-code/` |
| Stub analyzers | 6 present | `skills/workflow/reviewing-code/scripts/*.py`, `skills/domain/architecture/architecture-advisory/scripts/*.py` print "Completed successfully" with `findings = []` |
| Skill discovery | undeclared | `.claude-plugin/plugin.json` has no `skills` key; 79 SKILL.md at depth 2 to 5 |
| Plugin cache size | 44 MB | ships `crew/tests` (179 test files) and `src/tests` (336) |

## Conclusion

Four of six crew hooks and the two most-used CLI subcommands crash in the shipped artifact. Both enforcement hooks (gate guard, pre-push gate) are among them, so the "block" flags enforce nothing for a consumer. Remediation plan: `docs/superpowers/plans/2026-11-05-devcrew-audit-remediation.md`.
