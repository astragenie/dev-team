# Audit: agents/ prompts (crew v0.67.0), read-only

Scope: 23 first-party agents, 9 vendored `agents/3rdparty/`, `docs/governance.md`, `scripts/validate-agents.ts`, `validate-agent-refs.ts`, `validate-dispatch-graph.ts`, `skills/universal/builder-mindset/SKILL.md`, plus the dispatcher side (`commands/build.md`, `skills/workflow/builder-ceremony/`).
Method: Grep/Glob/wc, a script that extracts every path reference from agent bodies and checks it on disk, line-level duplication scripts, and running the three validators. All three validators pass today, which is itself a finding (F3, F10).
No repo file was edited. Items marked SUSPECTED could not be fully verified.

## Measurements

| Metric | Value |
|---|---|
| First-party agent files | 23 files, 5,002 lines, 301,512 bytes (~75k tokens if all were loaded) |
| Largest by bytes | verifier 25.1 KB, architect 23.5 KB, backend-dev 23.3 KB, release-engineer 19.7 KB, aiplugin-dev 19.6 KB |
| Within 24 lines of the 350 cap | architect 346, verifier 343, backend-dev 335, release-engineer 326 |
| bytes per line | reviewer 85, verifier 73, aiplugin-dev 73, investigator 38 (long lines evade a line cap) |
| Long lines (>40 chars) appearing verbatim in 3+ agents | 425 occurrences, ~33.9 KB (~8.5k tokens) across files. backend-dev 55, frontend-dev 52, fullstack-dev 50, aiplugin-dev 37 |
| Pairwise shared lines (>25 chars) | fullstack~backend 47% of fullstack; backend~frontend 44% of frontend; csharp~typescript reviewer 39%/37%; qa-expert~performance-engineer 34%/32% |
| `## Peer dispatch` sections | ~384 lines over 11 agents (~7.7% of all agent lines) |
| Same heading in many agents | Report contract 18, Memory (astramem) 17, HARD OUTPUT CONTRACT 13, Custom instructions 12, Integration with Other Agents 10, Peer dispatch 13 (two heading spellings), Context efficiency 6 |
| 3rdparty | 9 files, 3,000+ lines (database-architect 694, expert-react 746). Descriptions total 13,090 chars vs 7,036 chars for all 23 first-party descriptions |
| Shouting markers | low overall (53 hits of HARD/MANDATORY/CRITICAL/IMPORTANT). Worst is verifier with 13. Ordering and contradictions hurt more than caps. |

## Ranked findings

### HIGH

**F1 [HIGH] Builders and dispatcher disagree about how a builder reports.**
- `agents/fullstack-dev.md:203-241`, `backend-dev.md:42-46,266-298`, `frontend-dev.md:193-225`, `aiplugin-dev.md:48,229-258`: post a PR comment via `report-to-pr.ts`, then `SendMessage` to `main`. "NEVER invoke write-handoff". "The dispatcher reads `gh pr view --json body,comments`".
- `commands/build.md:168-170`: `size: standard` tasks "REQUIRE a `write-handoff` artifact"; "read its full report from the artifact path it returned".
- `skills/workflow/builder-ceremony/SKILL.md:14`: "Builders return inline. No handoff artifacts".
- Nothing in `commands/` or `skills/` reads the `<!-- dev-team:report -->` comment. Only `skills/workflow/fix-pr` uses `gh pr view`, for another purpose. Three contracts, one real consumer path (inline text).
- Fix: pick one. Recommended: the inline 4-line STATUS return is the contract. `report-to-pr` becomes an optional truncation backstop run by a hook, not instructions in four prompts. Delete the contradicting build.md sentence for builders.

**F2 [HIGH] `report-to-pr.ts` is a repo-relative path in a plugin.**
- `fullstack-dev.md:218`, `backend-dev.md:277`, `frontend-dev.md:204`, `aiplugin-dev.md:237` run `node ./scripts/report-to-pr.ts`. Every other agent uses `"${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts"`. In a consumer repo the cwd is the consumer, so this file does not exist. The bare `mark-badge ...` calls in those four files also never show a full invocation.
- Result: the "report before the risky tail" rule, created after 4 reports were lost (dev-team#227), cannot run in consumers.
- Fix: use `node "${CLAUDE_PLUGIN_ROOT}/scripts/report-to-pr.ts"` or expose it as a `crew.ts` subcommand.

**F3 [HIGH] The peer-dispatch lint never fires for any agent.**
- `scripts/validate-agents.ts:207-208` returns early unless `tools:` contains `Agent`. None of the 10 allowlisted agents declares `tools:` (they inherit everything). Proof it is dead: `fullstack-dev.md:260` says "No tight per-slice budget", which violates the required "max N per slice" line, and validation still passes.
- The comment at `validate-agents.ts:166-168` claims "backend-dev and frontend-dev carry `disallowedTools: Agent`". Their frontmatter has no `disallowedTools`.
- Consequence: whitelists, blacklists and budgets are prose only. Reviewers, verifier, researcher, qa-expert have no `disallowedTools: Agent` either, so "gates are orchestrator-only" is also prose only.
- Fix: enforce in frontmatter (`tools:` allowlist, or `disallowedTools: Agent` on every non-dispatching agent) and make the validator check that, or delete the feature (S3).

**F4 [HIGH] Architect has four conflicting dispatch rules, one violating the constitution.**
- `architect.md:39`: last call may be `Agent` dispatching "database-architect, cloud-architect, architect-reviewer, researcher".
- `architect.md:128-138` (Delegation map): may dispatch `agents/3rdparty/database-architect.md`, `cloud-architect`, `architect-reviewer`, `3rdparty/critical-thinking`.
- `architect.md:294-321` (Peer dispatch, the only section validators parse): whitelist is `researcher` and `investigator`; "All `3rdparty:*` agents" are forbidden.
- `architect.md:338-343` (Final-tool-call invariant): last call must be Write/Edit or write-handoff, not Agent. Contradicts line 39.
- `.claude/crew/constitution.md`: "No agent may dispatch its own reviewer". Architect dispatches `architect-reviewer` on its own design, and `GATE_AGENTS` (`scripts/lib/dispatch/peer-dispatch-allowlist.ts`) omits architect-reviewer so nothing catches it.
- Fix: one dispatch section. Decide whether architect-reviewer is a gate (orchestrator dispatches it) and remove it from architect's list.

**F5 [HIGH] Dead mandatory skill path in the primary reviewer.**
- `agents/reviewer.md:100`: "Always load `docs/workflow/reviewing-code/`". That directory does not exist; the skill is `skills/workflow/reviewing-code/`. It is the one skill the reviewer must always load.
- `validate-agent-refs.ts` reports OK because it only checks `crew:<name>` tokens, not backticked repo paths.
- Fix: correct the path and extend the ref validator to check path references.

**F6 [HIGH, SUSPECTED] Final-step wording is wrong or self-contradictory.**
- All four builders: "Your last action MUST be a `SendMessage` to `main`... the dispatcher does not see your final text." For a foreground `Agent` call the final text is what the dispatcher receives; `SendMessage` to `main` is for background teammates. Separately, `fullstack-dev.md:226-229` calls SendMessage "the fast-path backstop... never depends on this message arriving", then `:235-241` calls it MANDATORY.
- Fix: one runtime-neutral sentence: "Return the STATUS block as your final message."

### MEDIUM

**F7 [MED] Peer-dispatch whitelists name non-agents.**
- `fullstack-dev.md:269` whitelists `database-architect` (a 3rdparty agent; its own blacklist at `:272` forbids all `3rdparty:*`). `:270` and `frontend-dev.md:257` whitelist `security-advisory`, which is a skill. `backend-dev.md:327-331` has the corrected "Not Agent-tool dispatches" wording.
- `validate-dispatch-graph.ts` parses these as graph nodes. Blacklists in architect, document-writer, refactor name `parallel-runner`, which is not an agent (only `commands/parallel.md` exists).
- Heading drift: "## Peer dispatch" vs "## Peer dispatch — when to use the Agent tool".

**F8 [MED] `verifier.md` carries an injected block of other plugins' skills.**
- `verifier.md:18-54` (`pre-loaded-universals`) injects superpowers `using-superpowers` ("ABSOLUTELY MUST invoke the skill... not negotiable"), `verification-before-completion`, and loop `loop-discipline` HARD-GATE ("must NOT stop because... a crew soft `blocked` badge is set") before the verifier's identity. That conflicts with the verifier's own blocked/failed exit and pushes its "read first" contract down to line 73.
- Rollout stalled at one agent (`validate-agents.ts:504-508`: "SLICE-77 will expand this"). The hash check shells out to `render-universal-skills.ts --print-hash`, which reads `~/.claude/plugins/cache/...`; if absent it silently skips (`:495-497`), so drift is only detected on machines with that cache.
- Fix: remove the block from verifier, or reference universals in one line.

**F9 [MED] "HARD OUTPUT CONTRACT (read first)" is often not first and collides with other first-action rules.**
- Position (line of total): fullstack-dev 203/274, verifier 73/343, aiplugin-dev 48/266, backend-dev 42/335; the other nine sit at lines 23-39.
- The reviewer family says "Exactly one FIRST tool call", but `## Custom instructions` (line 20) says read two files "before starting work" and `## Memory` says invoke a skill "after the mandatory scaffold call". That is three competing first actions.
- The last-call rule is restated as a second "Final-tool-call invariant (HARD)" in 8 agents (architect:338, cloud-architect:195, document-writer:239, performance-engineer:179, qa-expert:162, release-engineer:320, test-automator:164, uxdesigner:243).
- Fix: one rule at the top of every prompt, generated.

**F10 [MED] Backlog-id and stale-path debt in shipped prompts.**
- `.claude/artifacts/loop/backlog/in-progress/FEAT-161.md` is cited in architect:46, document-writer:36, integrator:47, verifier:89. It is a dev-team-internal path that does not exist in a consumer install and has moved out of `in-progress`. 32 FEAT-/DEC-/SLICE-/dev-team# ids remain across 15 agents.
- `validate-agents.ts:396-421` forbids ids for 5 agents only (`NO_BACKLOG_IDS_REQUIRED`, "expand as each agent is cleaned"), never expanded. `NO_LEAD_REF_REQUIRED` (`:436`) omits test-automator, cloud-architect, architect-reviewer. Hard-coded name lists let new agents escape silently.
- Other stale refs: `document-writer.md:98-106` points to `agents/3rdparty/{api-documenter,diagram-architect,markdown-syntax-formatter}.md` (none exist); `:55` `docs/releases/v0.7.0.md`; `researcher.md:157-158` `scripts/lib/cost-advisor.mjs` (now `.ts`); `investigator.md:87-91` example uses `hooks/caveman-*.js` (not in this repo); `test-automator.md:158` says "the inspector" (renamed reviewer).

**F11 [MED] Naming drift between agents, docs and custom-instruction files.**
- `verifier.md:58-59` reads `crew/validator.md`; `release-engineer.md:22-23` reads `crew/deployer.md`. The other 20 read `crew/<agent-name>.md`, so a consumer's `.claude/crew/verifier.md` is ignored.
- `docs/governance.md:127-134` lists `agents/copywriter.md` (does not exist), `(removed v0.41)`, and "builder, validator, deployer" as agents. It cites `validate-agents.mjs`, `validate-skills.mjs`, `workflow-state.mjs` (none exist; `.ts` or moved). `README.md:315` still says 3rdparty is delegated to by "copywriter".

**F12 [MED] The line cap is the wrong lever and is already gamed.**
- `validate-agents.ts:123-129` counts raw lines including 20-26 lines of YAML metadata. 7 agents set `maxLines` above what they use: performance-engineer 300 vs 186, test-automator 280 vs 166, cloud-architect 250 vs 199, csharp/typescript-reviewer 200 vs 161/163, frontend-dev 290 vs 263. `builder-mindset/SKILL.md` calls "cap-bump to defeat a gate (`maxLines: 200 -> 300`)" an anti-pattern.
- Lines understate cost: reviewer is 206 lines but 17.6 KB. A builder dispatch also loads builder-mindset (8.0 KB), builder-ceremony (12.7 KB), self-verify-gate (6.9 KB). fullstack-dev is 17.9 KB plus 27.6 KB of auto-loaded skills, ~11k tokens before the first tool call.
- Fix: cap body bytes excluding metadata, and cap agent plus auto-loaded skills together.

**F13 [MED] Memory is loaded twice by different mechanisms.**
- Dispatcher: `commands/build.md:159-166` prepends a `recall-block` and `profile-block` to the builder prompt.
- Agent: 17 prompts say `Skill(astramem:using-memory)` at start. `builder-mindset/SKILL.md` "Memory discipline" instead says load `memory-keeper` and call `recall_memory`/`remember`, while agents say "this agent does not name memory tools directly".
- `astramem:using-memory` is an external-plugin skill with no "if unavailable, skip" clause. The astramem MCP failed to connect in the session that produced this audit.
- Fix: one path (dispatcher-injected blocks) and drop the per-agent Memory sections.

**F14 [MED] Verdict vocabularies differ by agent.**
- Builders `DONE|BLOCKED|HELP|IN-PROGRESS`; `build.md:92` says "builder returns PASS"; reviewers `approved|approved_with_notes|rejected`; verifier `passed|passed_with_notes|failed`; integrator PASS/FAIL; qa-expert `gaps_found`.
- Global `workflow.md` requires a 9-field handoff (objective, owner, allowed/forbidden scope, deliverable, files, confidence, risks, next). Builders return 4 lines with no owner, scope or confidence.
- `reviewer-lite.md:83-85` returns `rejected` for "scope exceeded", a routing signal encoded as a quality verdict that `build.md:35` must special-case.

### LOW

**F15 [LOW] Metadata nothing reads.** `maxMinutes`, `warnAtTurns`, `warnAtMinutes` appear in 12 agents; the files admit "advisory headroom, not runtime-enforced" and no script under `scripts/`, `src/`, `hooks/` consumes them. `model_pinned` duplicates `model`. `version` is hand-bumped. fullstack-dev's `description` embeds implementation detail ("SendMessage is the fast-path backstop") that goes to every dispatcher session. document-writer's description is 843 chars.

**F16 [LOW] Prose claims enforcement that does not exist.** `reviewer.md`: "`disallowedTools` blocks Write/Edit and no dispatch prompt can override that", yet Bash is allowed so `sed -i` works. cloud-architect "Write boundary (HARD)" is prose over unrestricted Write/Edit.

**F17 [LOW] Repeated low-value sections.** "Integration with Other Agents" x10 (variants of "receives scope from the dispatcher"), "Context efficiency" x6 (researcher 32 lines, architect 22, release-engineer 22) restating Grep-before-Read and batching that the harness and `context-curation` skill cover, "Workflow badges" x5.

## Near-duplicate analysis (is the split earning its keep?)

Governance three-test rule (`docs/governance.md`, "Specialist agent admission"): different tool surface AND different output contract AND independence needed.

| Group | Verdict |
|---|---|
| reviewer / reviewer-lite | Fails test 2 and weakly test 1. Same model (sonnet), same `write-review-result` contract, same independence. Lite differs by `effort: medium`, `maxTurns 30` and a diff-size precheck. Fold into reviewer with a light mode. |
| csharp-reviewer / typescript-reviewer | Fail tests 1 and 2: identical tools and contract, 37-39% shared lines, same template with different checklist. The checklists are skills already (`skills/domain/backend/dotnet/*`, `typescript-pro`) that `reviewer.md:100-101` already loads by trigger. Replace with reviewer plus stack skill via the existing `Review lens:` parameter. |
| architect-reviewer | Different artifact (design, not diff), opus. Passes test 2. Keep, but orchestrator-dispatched only (F4). |
| qa-expert / performance-engineer | Both read-only advisory, 32-34% shared lines, a special bidirectional dispatch exception. Weakest justification on the roster. Merge into one advisor with a lens, or demote to skills. |
| researcher / investigator | Keep. 1-2% shared lines, different model (haiku vs sonnet), different contract (no artifact vs graded evidence). The real overlap is the built-in Explore agent. |
| fullstack / backend / frontend / aiplugin-dev | Four builders share 33-47% of lines and the same ceremony. fullstack-dev `capabilities.surfaces` duplicates aiplugin-dev's (agent-prompts, hooks, commands, plugin-manifest, scripts) at priority 5 vs 10. Split by stack is fine; the shared ~40% should be one skill (S1). |
| refactor (opus), dev-lite (sonnet/low), "fullstack owns refactor" (routing yaml line 46), 3rdparty/refactoring-specialist | Four refactor paths. `refactor` is described "mechanical" yet runs opus/high; dev-lite does mechanical edits on sonnet/low. |
| cloud-architect | No `crew:cloud-architect` dispatch site in commands/skills, 3 commits since May, opus. SUSPECTED unused; reachable only via architect's delegation map. |

Local telemetry (`.claude/logs/payloads/*subagent_stop.json`, one machine, mixed repos, incomplete): reviewer 32, investigator 16, fullstack-dev 16, researcher 10, architect-reviewer 4, architect 2, plus legacy `crew:builder` 34 and `crew:validator` 2 (old names still in use somewhere). No sampled dispatch of cloud-architect, performance-engineer, qa-expert, test-automator, integrator, csharp/typescript-reviewer, dev-lite, reviewer-lite. SUSPECTED low usage; confirm with a wider log.

## agents/3rdparty/

- 9 vendored files, 3,000+ lines. Descriptions total 13,090 chars (frontend-developer 3,045, database-architect 3,019, mobile-developer 2,925), padded with `<example>` transcripts. If plugin discovery registers them (the `crew:3rdparty:<name>` token convention suggests it, SUSPECTED), they add ~1.9x the description text of all 23 first-party agents to the dispatcher's agent listing every session.
- Provenance: `docs/operations/3rdparty-source-list.md` covers skills only. No source, version or licence for any agent except `ui-ux-designer.md:14-24` (CC BY 4.0, attribution kept). Repo `LICENSE` is MPL-2.0, `.claude-plugin/plugin.json` says MIT, `package.json` has no `license` field. Upstream licences of the vendored agents are unverified: SUSPECTED compliance gap.
- Maintenance: last real touches were SLICE-198 (strip foreign peer boilerplate) and the v0.58 audit. Validation is light (`validate-agents.ts:553-600`: frontmatter, filename, no VS Code tool names).
- Usage: the only wiring found is `dispatcher-routing/SKILL.md:45` (`crew:3rdparty:critical-thinking` as tie-breaker) and architect's delegation map (database-architect, critical-thinking). expert-react-frontend-engineer, flutter-ui-developer, frontend-developer, mobile-developer, playwright-tester, refactoring-specialist, ui-ux-designer have no dispatch site in commands, skills or the routing table. `refactoring-specialist` and `frontend-developer` duplicate first-party `refactor` and `frontend-dev`.
- Recommendation: keep `database-architect` and `critical-thinking` only if architect really dispatches them; move the other seven to an opt-in pack and add a NOTICE with sources and licences.

## Model and effort choices

- opus: architect, architect-reviewer, cloud-architect, refactor. `refactor` on opus for "mechanical" work is the odd one.
- haiku: document-writer. It authors ADRs, retrospectives, SPEC bodies and agent/skill prompts, and the dispatch graph lets it spawn the opus architect. That is a cost inversion, and the weakest model writes the text governance marks human-reviewed.
- sonnet at effort low: verifier, the final behavior gate, with the longest prompt (343 lines). Reviewer is effort high. Gate effort is inverted relative to risk.
- Good: investigator (haiku, 12 turns, explicit read-only tool list) is the cleanest prompt in the repo.

## Drastic improvements

**S1. One shared agent harness, generated into prompts.** Move report contract, scaffold/last-call rule, custom-instructions lookup, memory, badges, peer-dispatch rules and context-efficiency into one canonical block rendered at build time (the `render-universal-skills.ts` mechanism already exists), with the contract first. Evidence: 425 duplicated long lines (~34 KB), 12-18 copies of each section, ~384 peer-dispatch lines. Impact: roughly 1,200-1,500 fewer lines (25-30% of 5,002), F1/F2/F6/F9 fixed in one place, contradictions impossible by construction.

**S2. Collapse the reviewer family into one `reviewer` with parameters.** Merge reviewer-lite, csharp-reviewer, typescript-reviewer into reviewer via `mode: light|full` and a stack lens that loads existing stack skills. Governance's own rule says to author skills here. Impact: 3 fewer agents, ~460 fewer lines, one verdict contract (fixes F14), fewer routing rows.

**S3. Decide whether peer dispatch exists.** Today: ~384 prompt lines, three allowlists, a cycle detector, and a lint that never fires (F3). Subagents often cannot spawn subagents (SUSPECTED for this runtime; backend-dev itself says "and Agent tool is available in the runtime"). Either enforce it in frontmatter for the two or three agents that need it (architect, document-writer) and delete the rest, or remove it and let the dispatcher mediate via `--next`. Impact: ~300 fewer prompt lines, no more F4/F7 drift.

**S4. Replace the line cap with a byte or token budget on body plus auto-loaded skills, and make validators deny-by-default.** Cap body bytes excluding frontmatter and include the skills each "load on every dispatch" line pulls in. Replace hard-coded name lists (`NO_LEAD_REF_REQUIRED`, `NO_BACKLOG_IDS_REQUIRED`, `UNIVERSALS_DRIFT_REQUIRED`, `EVALS_REQUIRED_AGENT_NAMES`) with rules applied to every agent plus an explicit exempt list. Extend `validate-agent-refs.ts` to check backticked repo paths. Impact: catches F5, F10, F11-type rot in CI, and makes the ~45 KB fullstack-dev dispatch visible.

**S5. Prune the roster to what is dispatched.** Move vendored agents without dispatch sites out of the plugin, add a NOTICE with provenance and licences, and re-evaluate cloud-architect, performance-engineer, qa-expert, integrator, test-automator against a wider dispatch log. Impact: 7 fewer vendored agents (~10 KB of always-on descriptions if registered) and a first-party roster of roughly 13-15 instead of 23.

## Files referenced
C:\work\mega\dev-team\agents\*.md, C:\work\mega\dev-team\agents\3rdparty\*.md, C:\work\mega\dev-team\docs\governance.md, C:\work\mega\dev-team\scripts\validate-agents.ts, C:\work\mega\dev-team\scripts\validate-agent-refs.ts, C:\work\mega\dev-team\scripts\validate-dispatch-graph.ts, C:\work\mega\dev-team\scripts\lib\dispatch\peer-dispatch-allowlist.ts, C:\work\mega\dev-team\scripts\render-universal-skills.ts, C:\work\mega\dev-team\skills\universal\builder-mindset\SKILL.md, C:\work\mega\dev-team\skills\workflow\builder-ceremony\SKILL.md, C:\work\mega\dev-team\commands\build.md
