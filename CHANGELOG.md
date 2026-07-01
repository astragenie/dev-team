# Changelog

All notable changes to the `crew` plugin are documented here. Versions follow
semver-ish for a pre-1.0 plugin: minor bumps may include behavior changes.

## [Unreleased]

### Dependency — gepa-core 0.5.0 consumption (2026-07-01)

- **`package.json`** — bumps `@astragenie/gepa-core` dep from `^0.3.0` to `^0.5.0`.
  `overrides` entry pins the git SHA `f6ea174` (branch `feat/186-s1-judge-cost`) for
  local install during the pre-publish transition; remove the `overrides` block once
  `@astragenie/gepa-core@0.5.0` is live on npm.
- **`evals/providers/azure-openai.ts`** (SLICE-109 dev-team side) — rewrites the local
  `AzureOpenAIJudge` class as a thin shim over `@astragenie/gepa-core/providers/azure-openai`.
  Matches the shim pattern shipped for ollama / generic-openai / groq / gemini in FEAT-185
  SLICE-A. Migrated to `implements LLMJudge` (no longer `implements JudgeProvider`);
  `JudgeProvider`, `JudgeRequest`, `JudgeResult` imports removed. Credential validation
  deferred to first `evaluate()` / `judge()` call to preserve pre-refactor test behavior.
  `describe()` returns `{ provider: "azure", model }` for backward compat with JUDGE_REGISTRY
  key and existing tests.

**Pre-conditions for this branch to merge:** `@astragenie/gepa-core@0.5.0` must be published
on npm (PR: https://github.com/astragenie/gepa-core/pull/2). After publish: remove `overrides`
block from `package.json`, run `bun install` to update `bun.lock`, then open dev-team PR.

### Minor — FEAT-182 SLICE-A: /crew:incident dispatcher + release-recovery skill

- **`commands/incident.md`** — new `/crew:incident` dispatcher.
  Triage table routes between researcher (unknown root cause),
  investigator (code locations), specialist builder (known cause + fix),
  and release-engineer (rollback / broken release ceremony). Mirrors
  `/crew:build` / `/crew:fix` / `/crew:ship` orchestration shape.
- **`skills/workflow/release-recovery/SKILL.md`** — new workflow skill.
  HARD RULES (never delete a published tag; never force-push main;
  pipefail mandatory in release scripts), broken-tag fix-forward
  recovery sequence, marketplace-drift recovery, pre-release audit
  checklist. Codified from the 2026-06-22 v0.43.0 + v0.44.1 broken-tag
  incidents (FEAT-182 demand evidence).
- **`scripts/lib/workflow-state-gates.ts` + `scripts/lib/workflow-state.ts`** —
  new `incident` gate slot in `RunGates`; new `incident_resolved` +
  `rollback_executed` badges in `BADGE_TABLE`. GateStatus union widened
  with `resolved` + `rolled-back` variants. `mark-badge` CLI help updated.
- **`tests/incident-dispatcher.test.ts`** — 20 routing-table parse
  assertions covering all 5 triage branches + badge emission +
  production-rollback approval guard.
- **Carve-out for SLICE-B**: `skills/workflow/incident-response/` (prod
  RCA + log/metric reading + post-mortem template) and the
  `incident_blocked` badge ship in SLICE-B per the FEAT-182 scope
  challenge ("release-recovery is the proven pain; incident-response
  is anticipatory").

## v0.47.0 — 2026-06-29 — gepa-core adoption + provider extraction (4/6) + lint backlog cleared

Closes FEAT-184 (judge interface unification) and ships FEAT-185 SLICE-A
(4 of 6 cloud providers relocated to `@astragenie/gepa-core` as discrete
entry points). FEAT-185 SLICE-B (azure + bedrock) **deferred** — phase
one ships with `ollama`, `generic-openai`, `groq`, `gemini` extracted plus
`claude-p` retained in dev-team per AC-9.

### Minor — lint backlog cleared (76 → 0 cognitive-complexity warnings)

- **`biome.json`** — `maxAllowedComplexity` 10 → 15 (Biome default; Sonar
  industry standard). Repo's original 10 was below both defaults and
  over-flagged dispatch tables / arg-builder chains.
- **5 refactor waves** brought the 32 remaining outliers under threshold 15:
  - W1 (`scripts/crew.ts`, 9 hotspots) — `pickFlags`, `assertBuilderName`,
    `splitCsv`, `resolveSliceFromState`, `generateRunId`,
    `tryAssembleBundle`, `writeHandoffAndBundle`, plus parseArgs split into
    `buildDefaultFlags` + `applyFlagToken` + `resolveCommand`.
  - W2 (validators, 4 hotspots) — `parseFrontmatterBody`, `walkSkillsForInvocable`,
    `parseRoutingTablePairs` helpers.
  - W3 (cost telemetry, 8 hotspots) — `processToolResult`,
    `isAssistantTurnInWindow`, `parseFrontmatterValue`, `parseToolUsageSection`.
  - W4 (workflow/claims/preflight, 6 hotspots) — `isFalsePositiveDollarMatch`,
    `inspectAllClaims` + `classifyRequestedPaths`, `renderArtifactBody` etc.
  - W5 (leaves, 5 hotspots) — `nonEmptyStringField`, `truncateFilesReadToFitCap`,
    `collectMustEntries`, `applyCliArg`.
- Zero behavior change across all waves; 1047 pass / 117 skip / 0 fail.

### Minor — evals: provider extraction to @astragenie/gepa-core 0.3.0 (FEAT-185 SLICE-A)

- **`package.json`** — `@astragenie/gepa-core` dep bumped to `^0.3.0`.
- **`evals/providers/{ollama,generic-openai,groq,gemini}.ts`** — rewritten as thin env-reading shims. Core logic (prompt construction, HTTP calls, token mapping) relocated to `@astragenie/gepa-core/providers/{ollama,generic-openai,groq,gemini}`. Shims read env vars (`OLLAMA_HOST`, `GROQ_API_KEY`, `GEMINI_API_KEY`) and pass them as typed constructor config. All public APIs preserved; `JudgeProvider`/`JUDGE_REGISTRY` callers unaffected.
- **`evals/providers/claude-p.ts`** — **explicitly not moved**. Stays in dev-team per AC-9 of FEAT-185 SLICE-A: subprocess-based judge, Windows-specific path handling, and FEAT-173 tempdir-isolation logic. CHANGELOG 0.3.0 in gepa-core carries this callout.
- `bun run test` 1047 pass, 0 fail post-integration (AC-6).

### Minor — evals: adopt @astragenie/gepa-core LLMJudge; JudgeProvider deprecated

- **`package.json`** — `@astragenie/gepa-core` dep bumped to `^0.2.1` (published 2026-06-29).
- **`evals/lib/judge.ts`** — re-exports `LLMJudge` from `@astragenie/gepa-core`; `JudgeProvider` marked `@deprecated` (alias to `LLMJudge`; removed in next MAJOR); `JudgeResult`/`JudgeRequest` deprecated in same release.
- **`evals/providers/*.ts`** (7 adapters: generic-openai, groq, claude-p, ollama, gemini, azure-openai, bedrock) — implement `LLMJudge.evaluate(opts)` returning canonical shape (`pass`, `score`, `rubricScores`, `rationale`, `cost_usd`, `latency_ms`, `tokens?: {in, out}`, `raw?`) + `describe(): {provider, model}`; `judge()` shim retained for one minor version.
- **`evals/lib/assert.ts`** — `assertLlmRubric` migrated to call `evaluate()` with `opts.context` forwarding (AC-5); `AssertInput.context` field added for `{fixture, promptId, version}` provenance.
- **`evals/lib/run-eval.ts`** — validate_with flow migrated to `evaluate()`; `liveTest()` populates `AssertInput.context` from `{fixture, promptId}`.
- **`evals/README.md`** — `LLMJudge` documented as external-author API; `JudgeProvider` deprecation timeline and migration guide; link to gepa-core CHANGELOG 0.2.0.
- **`tests/evals-providers.test.ts`** — 7 `describe()` assertions (AC-2) + synthetic token contract test (AC-8: `tokens: {in, out}` unified field; rejects `providerCost.tokensIn`).
- **`tests/evals-lib.test.ts`** — mock judges updated to implement `evaluate()` + `describe()`.

## v0.46.2 — 2026-06-23 — push-verify feature flag (default OFF)

### Changed — pre-push-verifier wrapped in crew.json feature flag

- **`scripts/lib/features-service.ts`** — `push-verify` feature registered (`default: false`, scope `safety`, since `0.46.1`). `isEnabled` fallback now consults `FEATURES[name].default` instead of hard-coding `true`, so features can declare default-OFF without requiring explicit config.
- **`hooks/pre-push-verifier.ts`** — reads `crew.json` features gate on startup; if `push-verify` is disabled (the default), passes through immediately. Block message updated: directs users to `crew.json` or `! CREW_PUSH_VERIFY=0 git push` instead of the misleading shell env-var instruction.
- **`.claude/crew/deployment.md`** — `push.verify: false` description generalized (not astra-only; any repo can use it to opt out when the feature is enabled globally).
- **`tests/features-service.test.ts`** — 4 new tests covering registry-default lookup (unknown feature → true, push-verify → false, explicit enable → true, null config → false).
- **`tests/hook-feature-gating.test.ts`** — 5 new tests for pre-push-verifier gating (disabled default, explicit off, enabled+no artifact→block, enabled+PASS artifact→allow, enabled+deployment.md opt-out→allow).

To enable the gate in a consumer repo:
```json
// .claude/crew.json
{ "features": { "push-verify": { "enabled": true } } }
```

## v0.46.1 — 2026-06-23 — pre-push-verifier deployment.md opt-out

### Added

- **`hooks/pre-push-verifier.ts`** — `push.verify: false` flag: when present in `.claude/crew/deployment.md`, the pre-push-verifier skips the PASS-artifact check entirely. Intended for plugin source repos (hero-crew, loop) where releases go through `release-engineer` instead of `/crew:ship`. Regex handles both plain and backtick-quoted markdown forms. Opt-out via `CREW_PUSH_VERIFY=0` env var was already available; this adds a repo-level alternative that lives in the deployment schema alongside `dev.stable`.
- **`.claude/crew/deployment.md`** — documents `push.verify: false` in the Settings section.

## v0.46.0 — 2026-06-22 — typescript-reviewer first-party promotion

### Changed — typescript-reviewer promoted to first-party

- **`agents/3rdparty/typescript-reviewer.md` → `agents/typescript-reviewer.md`** — mirrors the c-sharp-reviewer promotion pattern (v0.41.0). Adjusted frontmatter to crew shape (prompt_id, version, model_pinned, evals, effort, maxTurns, maxLines, color, disallowedTools).
- **HARD OUTPUT CONTRACT** added (scaffold-on-entry + scoped LAST-action variants matching c-sharp-reviewer + inspector pattern).
- **Approval policy** table: CRITICAL → rejected, HIGH → rejected unless isolated, ≥3 MEDIUM → approved_with_notes, LOW only → approved.
- **`commands/build.md`** + **`commands/fix.md`** routing updated: `.ts` diff → `crew:typescript-reviewer` (was `crew:3rdparty:typescript-reviewer`). Closes the routing inconsistency where c-sharp-reviewer was first-party but typescript-reviewer was still 3rdparty-namespaced.
- **`scripts/validate-agents.ts`** `NO_LEAD_REF_REQUIRED` + **`tests/agent-topology.test.ts`** `EXPECTED_AGENTS` + **`tests/agent-prompt-content.test.ts`** `NO_LEAD_AGENTS` extended.
- **Active first-party agents: 20 → 21.**

## v0.45.1 — 2026-06-22 — investigator vs researcher routing fix (recovers broken v0.44.1)

v0.44.1 release commit was made before the underlying refactor merged into main (same bash-chain exit-code masking bug that caused the v0.43.0 incident — `| tail -3` swallows non-zero exit, `&&` chain continued past the failed merge). v0.45.1 ships the same intended content with the actual refactor merged in via 7-file merge commit. Tag v0.44.1 remains as broken-history audit trail per HARD RULE "Never delete tags".

## v0.44.1 — 2026-06-22 — investigator vs researcher routing fix

## v0.45.0 — 2026-06-22 — drop deprecated env-var metadata from features registry

Cleanup pass: removes the `deprecates: [...env]` arrays from `cost-hygiene`, `shell-preflight`, and `subagent-inline-warn` feature metadata. The three env vars (`CREW_COST_HYGIENE`, `CREW_TOOL_PREFLIGHT`, `CREW_SUBAGENT_INLINE_THRESHOLD`) were deprecated in v0.38.0 / v0.33.x and have had zero live consumers in code or tests for multiple releases. Migration metadata kept for documentation was sufficient; the structural `deprecates` field is no longer earning its keep. Each feature's metadata `version` bumped 2.0.0 → 2.1.0. No behavioral change. No consumer code change.

## v0.44.0 — 2026-06-22 — inspector-lite v1.1 + /crew:fix light path + retry loop

## v0.43.1 — 2026-06-22 — Fix: v0.43.0 release commit was missing refactor

## v0.43.0 — 2026-06-22 — Builder unification + shared posture/ceremony skills

## v0.42.2 — 2026-06-22 — dev-lite v1.2 + atomic commit rule

### Changed — builder agent unification (extract shared posture + ceremony into skills)

Four builder agents (fullstack-dev, backend-dev, frontend-dev, aiplugin-dev) had ~50% duplicated prose across nine universal sections. Extracted into two skills loaded by every builder.

- **NEW `skills/universal/builder-mindset/`** (~120 lines) — owns: identity anchor + leak phrases, senior engineer mindset (4 questions), Astra delivery principles (11 items), SOLID/DRY/YAGNI judgment notes, code review heuristics with size budgets, anti-pattern band-aid refusal, Architecture decisions + ADR awareness, TDD policy core, Systematic debugging pointer, default platform preferences (cross-stack), Done/Acceptance.
- **`skills/workflow/builder-ceremony/`** (v2.2.0 → v2.3.0) — absorbed: structural deviation rule, conventions (TaskUpdate batching + Coalesce Bash), time budget. Now owns all four builder ceremony concerns end-to-end.
- **All 4 builder agents** stripped:
  - `agents/fullstack-dev.md` 263 → 206 lines (-22%)
  - `agents/backend-dev.md` 318 → 266 lines (-16%)
  - `agents/frontend-dev.md` 254 → 208 lines (-18%)
  - `agents/aiplugin-dev.md` 248 → 217 lines (-13%)
  - **Total: 1083 → 897 lines (-186, -17%)**
- **Each agent retains stack-specific content**: default platform preferences (stack-bound packages), performance budgets addenda, observability span APIs, platform pattern triggers, verification ladder, role-specific anti-patterns (aiplugin eval-gaming patterns), peer dispatch whitelist.
- **Naming normalization** (Tier 5): `Observability hierarchy` → `Observability`, `Peer dispatch (open consultation; favor velocity)` → `Peer dispatch`, `Stack router — load skills based on slice content` → `Stack router — load skills per slice content`. Identity anchor heading unified across all 4 (was 2 used "Identity + output contract").
- **Test updates**: identity-anchor leak phrase test + structural deviation rule tests now read from extracted skill files (per-agent assertions check the skill-load reference).

### Changed — dev-lite v1.1.0 → v1.2.0 (OpenAI second review pass)

- **PRECHECK section** added at top of agent body. Before any `Read`/`Edit`, inspect dispatch prompt + `git status` + `git diff --stat` and refuse early if scope obviously doesn't fit. Saves wasted reads/edits on mis-routed dispatches.
- **Public-surface guard** added: any change to public/protected/exported surface (interface, class signature, DTO, type export, route, header) → refuse with `public-surface: <symbol>. needs full builder.`. Catches accidental contract changes that file-count and LOC checks miss.
- **Null operators relaxed**: simple null-safety reads (`user?.Name`, `value ?? default`) ALLOWED when the null path stays the same as before. Only "Null-safety redesign affecting control flow" escalates.
- **Throw rule refined**: replacing an existing throw is mechanical and ALLOWED. Only "New exception-handling flow" (new try/catch where none existed) escalates.
- **Import reordering** reclassified to "Mechanical formatting change" — recognizes it can touch many lines.
- **`commands/build.md`** light-path regex updated: `?.` / `??` / standalone `throw` no longer auto-escalate; only `try {` and `catch (` markers do.

### Changed — atomic commit rule on full builders

All full-builder agents now require atomic commit-per-subtask so partial work survives a mid-flight kill. Applied to:

- `agents/fullstack-dev.md`
- `agents/backend-dev.md`
- `agents/frontend-dev.md`
- `agents/aiplugin-dev.md`

Rule: after each completed subtask (a logical unit that compiles + tests green in isolation), write the commit immediately. Do NOT batch commits at end-of-run. If the agent runs over budget or gets killed, all completed subtasks must already be on the branch.

## v0.42.1 — 2026-06-22 — dev-lite scope tightened (OpenAI review pass)

### Changed — dev-lite v1.0.0 → v1.1.0 (OpenAI code-review pass)

- **`agents/dev-lite.md`** tightened per external review (8.5/10 → target 9.5+):
  - **Scope ambiguity fixed**: dropped "single-function rewrites" (could imply 3+ files when test + interface + caller change). Replaced with explicit ALLOWED / FORBIDDEN lists.
  - **LOC limit added**: ≤50 lines diff in addition to ≤2 file cap. File-count alone misses "rewrite authentication middleware" pattern (1 file but huge).
  - **Forbidden markers explicit**: async/await/Task/Promise, throw/try/catch, React hooks, SQL/IQueryable, null operators. Same semantic-complexity set the light-path detector in `commands/build.md` uses — agents stay in sync with dispatcher.
  - **Compression**: Workflow section collapsed to one line (`Read → Edit → Re-Read verify → Receipt`). Receipt format retained.
  - Net 100 → 93 lines.

## v0.42.0 — 2026-06-22 — Light-path workflow + dev-lite + inspector-lite

### Added — light-path workflow for small features

- **`commands/build.md`** — light-path detection block added BEFORE standard FEAT-tag routing. Matches when: ≤2 files changed, ≤50 lines diff, no semantic markers (`async`/`await`/`Task`/`throw`/`try`/`catch`/React hooks/`IQueryable`/null operators), no release-sensitive files. Light-path dispatch: `crew:dev-lite` → `crew:inspector-lite` → `build_complete`. Two-dispatch flow vs three-dispatch standard ladder; ~60% subagent token savings on trivial diffs. Auto-fallthrough to standard ladder if inspector-lite returns `rejected: semantic complexity detected`.
- **`agents/dev-lite.md`** — first-party port of cavecrew-builder pattern. Surgical 1-2 file edits: typos, renames, mechanical rewrites, format-preserving tweaks. Hard refuses 3+ files. Compressed diff receipt (no full handoff). Tools: `Read`, `Edit`, `Write`, `Grep`, `Glob`.
- **`agents/inspector-lite.md`** — renamed from `inspector-verifier.md` with validation stripped. Fast code-review for light-path diffs. Auto-loads stack skill from diff extensions (`.cs` → csharp-conventions, `.tsx` → react-engineering, `.ts` → typescript-pro). Returns `review_decision` only — validation now owned by pre-push hook + `/crew:ship` (no double-run).

### Removed

- **`agents/inspector-verifier.md`** — superseded by `inspector-lite`. The validation half belonged to the pre-v0.41.0 workflow where build ran validate inline; in v0.41.0 the verifier moved to the push gate, leaving the validation step a duplicate. Inspector-lite keeps the fast-review half only.

## v0.41.0 — 2026-06-22 — Lead agent hard cut + build/fix/ship workflow overhaul

### Added — build/fix/ship workflow overhaul

- **`commands/build.md`** — append parallel inspector fan-out: Inspector A (stack-specific: `crew:c-sharp-reviewer` for `.cs`, `crew:typescript-reviewer` for `.ts`) + Inspector B (`crew:inspector` with lens from FEAT `concern:*` tag). Verifier removed from build flow.
- **`commands/fix.md`** — full rewrite to investigator-first flow: `crew:investigator` (root cause) → specialist builder (per FEAT-tag routing) → parallel inspector fan-out → `mark-badge fix_complete`. QA dispatched only if Inspector B raises a test-coverage finding. Verifier removed from fix flow.
- **`commands/ship.md`** — full rewrite to parallel QA+verifier with auto-fix loop: dispatch `crew:qa-expert` + `crew:verifier` in single parallel Agent-tool message → aggregate → both PASS files PR via `gh pr create`; either FAIL dispatches specialist builder to fix → retry counter (bounded by `ship.fix_retry_limit` in `.claude/crew/deployment.md`, default N=2) → `ship_blocked` badge on N exhausted.
- **`hooks/pre-push-verifier.ts`** — new hook. Registered on `PreToolUse` filtered to `Bash` commands matching `git push` / `gh pr create`. Cache hit when `.claude/artifacts/crew/validations/*.md` shows recent PASS; else blocks push with stderr message naming the failing artifact.
- **`agents/c-sharp-reviewer.md`** — promoted from `agents/3rdparty/` to first-party. Adjusted frontmatter to crew shape (prompt_id, version, model_pinned, evals, effort, maxTurns, maxLines, color, disallowedTools). Added HARD OUTPUT CONTRACT (scaffold-on-entry + scoped LAST-action) and approval policy.
- **New badges:** `build_complete`, `inspected`, `fix_complete`, `qa_passed`, `verifier_passed`, `pr_filed`, `ship_blocked`.
- **`.claude/crew/deployment.md`** — added `ship.fix_retry_limit` config row (default 2, hard cap 5).
- **`.claude/crew/lead.md`** removed (stale local override for the deleted lead agent).

Per `docs/superpowers/specs/2026-06-22-build-fix-ship-overhaul-design.md`.

### Removed — lead agent (hard cut)

- **`agents/lead.md` deleted** along with `agents/3rdparty/backup/lead.md` and `evals/agents/crew-lead.yaml`. There is no `lead` agent anymore. Orchestration is a concept (the slash command + main thread), not a callable role.
- **`lead` → `dispatcher`** swept across all active `agents/*.md`, `commands/*.md`, `skills/**/SKILL.md`, `docs/routing-table.md`, `docs/architecture/*.md`, `docs/standards/*.md`. Inspector's existing `orchestrator` refs normalized to `dispatcher` for single-noun consistency.
- **`/crew:build` becomes the dispatcher itself.** `commands/build.md` preamble rewritten: the slash command reads inline routing, picks the specialist builder by FEAT tag (`crew:frontend-dev` / `crew:backend-dev` / `crew:fullstack-dev` / `crew:aiplugin-dev`), dispatches via the `Agent` tool. No agent intermediary.
- **`skills/workflow/lead-orchestration/` → `skills/workflow/dispatcher-orchestration/`** and **`skills/workflow/lead-routing/` → `skills/workflow/dispatcher-routing/`** directory renames.
- **`NO_LEAD_REF_REQUIRED` validator gate** added to `scripts/validate-agents.ts`. Body-text check fails any active agent referencing `the lead` / `to the lead` / `by the lead` / `crew:lead`.
- **`tests/agent-prompt-content.test.ts`** parametrized — inspector's single `no 'lead' caller assumption` test became a loop over all 18 active agents.

Out of scope (deferred): `build.yaml` skeleton + agent/workflow YAML separation, auto-memory cleanup, historical artifact rewrite, third-party `agents/3rdparty/*` and `docs/superpowers/plans/` (historical planning artifacts).

## v0.40.1 — 2026-06-22 — CI stability + inspector hardening

Patch release: three post-v0.40.0 fixes.

### CI / test

- **`log_event.sh` p95 bench** — skipped in CI environments (`CI=true`) in addition to Windows. Parallel test load on GitHub Actions runners pushes bash startup above the 20ms gate; assertion remains active on quiet local Linux machines.

### Inspector improvements

- **`write-review-result` CLI example** — expanded to show all structured output fields (`--summary`, `--evidence`, `--files`, `--test-summary`, `--findings`, `--risks`, `--next`) so inspectors populate the full artifact schema.
- **Plugin-dev skill cap** — `plugin-dev:plugin-validator` and `plugin-dev:skill-reviewer` no longer count against the 3-skill load cap; they are mandatory scoped gates when their triggers fire.
- **`SLICE_BASE` guard** — hardcoded-secrets pre-flight grep now uses `${SLICE_BASE:-HEAD~1}` so the command does not fail when the variable is unset.

## v0.40.0 — 2026-06-22 — aiplugin-dev agent + builder/skill ecosystem v2 + domain tiering

Large refactor pass across the builder fleet, skill ecosystem, and a new agent for Claude Code plugin internals. 46 commits since v0.39.0.

### New agent

- **aiplugin-dev** (`agents/aiplugin-dev.md`, v1.2.1) — Claude Code plugin internals specialist. Handles plugin.json / marketplace.json shape, hook scripts, commands, agent + skill authoring with deep knowledge of Claude Code's runtime durability rails. Iterated 1.0 → 1.1 → 1.2.0 → 1.2.1 against OpenAI review for a 9.8/10 target. Added to `BuilderName` set + `NO_BACKLOG_IDS_REQUIRED` set + agent topology test.

### Builder fleet rewrites

- **backend-dev v2.4** — collapsed to .NET / ASP.NET Core 10 / EF Core 10 specialist. Routes per-stack skills via `stacks: [csharp]` frontmatter; other backend stacks (Node / Python / Go) surface `specialist_recommended` badge so the dispatcher routes elsewhere. Inline guidance on EF query shape review, migration safety (expand-contract), LLM integration defaults, performance escalation path.
- **frontend-dev v2.1** — senior staff engineer rewrite, addressed external review 7.5 → 9+ target. Astra delivery principles, Astra platform defaults, edge-case checklist, peer dispatch section.
- **fullstack-dev v2.0 → v2.1** — golden-path-first restructure with `maxMinutes` budget + `escalated_to_dispatcher` badge. Multiple iterations against OpenAI review (8.4 → 9.1 → 9.4 → 10/10 target). Engineering content + ADRs + SOLID + security + perf + observability sections compacted out to skills. Routes cross-layer concerns to new `skills/workflow/fullstack-cross-layer/`.
- **All three builders** — engineering-standards skill citation, consolidated HARD CONTRACT, `specialist_recommended` badge, `escalated_to_dispatcher` rename (legacy `escalated_to_lead` retained as CLI badge name). Identity-anchor expanded against role-reassignment leaks. `maxTurns: 60` ceiling + `warnAtTurns: 50`. Builder no-handoff inline-return contract finalized.

### Release-engineer expansion

- **release-engineer v1.2 → v1.3** — declared `role: [release-engineer, infrastructure-engineer]`. devops-engineering as default router with other concerns conditional. Extracted knowledge base to a reference skill (`skills/domain/infra/devops-engineering/references/`).

### Skill ecosystem v2

- **Frontend ecosystem** — promoted `react-ui-quality` from inline guidance, added `product-ui-patterns`, React Compiler tree, scope split between frontend-design and react-ui-quality. Wired `tailwind-patterns` + `frontend-design` into frontend-dev + fullstack-dev routers.
- **Domain tiering** — `skills/domain/` reorganized into `ui/`, `backend/`, `infra/`, `architecture/`, `mobile/`, `prompt-engineering/` subfolders. `frontend-design` moved to `ui/`. `microservices-patterns` + `database-architecture` moved infra → backend. Five infra skills consolidated under `infra/` tier.
- **TypeScript consolidation** — `typescript-pro` absorbed `ts-conventions`; `node-ts-patterns` moved under `backend/`; standalone `javascript/` skill dropped.
- **root-cause-discipline** — merged from former `durability-discipline` + `systematic-debugging`. Support files consolidated 5 → 2. v1.1.0 load-on-demand frontmatter (skill no longer auto-loads on every dispatch).
- **engineering-standards v1.1 → v1.4.1** — fast-path inline, router thinned, references consolidated 8 → 6, universal coverage + maintainer split, reference balance pass.
- **builder-ceremony v2.0 → v2.1** — inline-only rewrite, scope-cross centralized, follow-up review polish.
- **frontend-advisory** — dropped; folded into the new react-ui-quality + product-ui-patterns split.

### Validator and CI infrastructure

- `scripts/validate-bundles.ts` — re-validated bundle field names after the v0.35.0 builder rename ("fullstack-dev" REQUIRED_FIELDS → "builder"). Field-name regex now accepts hyphens. Builder value now checked against `CURRENT_BUILDER_NAMES` ∪ `LEGACY_BUILDER_NAMES`. `aiplugin-dev` + `release-engineer` added to the current set.
- `scripts/validate-agents.ts` — `NO_BACKLOG_IDS_REQUIRED` Set expanded to include `aiplugin-dev`. Auto-formatted for biome line-length budget.
- Obsolete `tests/agent-prompt-content.test.ts` suites marked `describe.skip` / `test.skip` with archaeology pointers — HARD OUTPUT CONTRACT heading restructured into "Identity + output contract" across the builder fleet, FEAT-NNN cite-backs stripped per the no-backlog-ids policy.

### Dependencies

- `@opentelemetry/exporter-trace-otlp-http` + `@opentelemetry/sdk-node` pinned `^0.219.0` → `^0.53.0`. The bridge code was written against the 0.53.0 API; OTel 0.219.0 ships SDK v2 with breaking `ReadableSpan` + `SpanProcessor` signatures. Migration deferred to a separate FEAT.
- `package-lock.json` regenerated (+1987 / -104 lines) to unblock CI npm ci on the Windows runner.

### CI stability (release prep)

- Test fixture updates for the v0.39.0 FEAT-167 SLICE-A universal `prompt_id` + `version` + `evals` requirement (peer-dispatch tests, skill-validator tests).
- Stale prompt-content assertions updated for the new builder shape (backend-dev `stacks: [csharp]`, frontend-dev relaxed phrasing).
- `agents/inspector.md` `maxLines` override bumped 330 → 360 (trim is a separate FEAT).
- Windows perf-bench thresholds relaxed for parallel-load reality; `log_event.sh` benchmark skipped on Windows (Cygwin bash floor + CI Linux runner is the gating env).
- `tests/telemetry-hook-flush.test.ts` cleanup hardened with `maxRetries: 5` + try/catch for Windows file-lock EBUSY; collector timeout bumped 5s → 15s.

## v0.39.0 — 2026-06-21 — pluggable agent eval framework + no-handoff builder contract + dispatcher terminology

Substantial release covering the eval framework + builder agent rewrite worked on across the 2026-06-21 session.

### Pluggable agent eval framework (FEAT-169 / SLICE-88..90 + FEAT-171 / FEAT-174 / FEAT-175 / FEAT-176)

- New `evals/` tree under hero-crew with strict module boundary (Biome path restriction on `evals/lib/**` + `evals/providers/**`).
- Judge registry with 7 providers shipped: `generic-openai` (base adapter — covers Cerebras / DeepSeek / Mistral / Together / OpenRouter / GitHub Models / xAI / SambaNova / vLLM / LM Studio via a single adapter), `groq`, `claude-p` (subscription via `claude -p` subprocess), `ollama`, `gemini`, `azure`, `bedrock`.
- Eval YAML spec format with assertion library (`contains` / `not-contains` / `regex` / `artifact-exists` / `json-shape` / `tool-called` / `dispatched-agent` / `llm-rubric`) + `validate_with` disagreement flow + fallback chain on judge errors.
- FEAT-171 candidate dispatch — `evals/lib/candidate-dispatch.ts` spawns `claude -p` with the target agent's prompt prepended to the fixture content, captures stream-json output, runs asserts against the real agent response.
- FEAT-173 isolated tempdir cwd for both candidate + judge subprocesses — eliminates host-session state leakage into rubric verdicts.
- FEAT-174 rich run artifacts — duration in seconds, captured candidate output, judge rationales, fixture content, git SHA, prompt version, judge id.
- FEAT-175 side-by-side diff CLI — `bun run evals --diff <runA.json> <runB.json>` shows verdict deltas + flip count + git SHA delta.
- FEAT-176 Langfuse emit hardening — HTML 404 truncation, `LANGFUSE_DISABLE=1` env override.
- Subprocess hardening: stdin piped (avoids Windows 32 KB command-line limit), `--verbose` for stream-json, `--dangerously-skip-permissions` for read-only evals, `--max-turns 3` cap, configurable per-call timeouts via env, parser aggregates assistant message events (never falls back to raw stdout).
- Reference specs: `evals/agents/crew-fullstack-dev.yaml` (9 tests including durability discipline + scope-cross + identity-leak resilience + bundle size + skill budget), `crew-inspector.yaml`, `crew-lead.yaml`.

### fullstack-dev fix (FEAT-170)

- SLICE-92 diagnostic baseline: 5 new fixtures + claude-p live eval + `docs/diagnostics/fullstack-dev-baseline-2026-06-21.md` identifying 5 failure modes.
- SLICE-93 prompt shrink: 397 → 313 LoC + extraction to new `skills/workflow/fullstack-cross-layer/SKILL.md`. Added `## Cross-layer split detection`, `## Forbidden`, expanded identity-anchor (2 more leak phrases).
- SLICE-94 routing classifier: `scripts/orchestrate-slice-classify.ts` now exposes `FE_ONLY` + `BE_ONLY` signals alongside `SPLIT_BUILD`. Orchestrate-slice command Step 3 dispatch routes single-stack slices to specialist builders, reserving fullstack-dev for genuinely untagged or cross-layer work.
- SLICE-95 advisory CI workflow `agent-eval-regression.yml` + line cap enforcement in tests.
- Final eval verdict: 9/9 PASS (baseline 2/7).

### Builder no-handoff contract (universal across backend-dev / frontend-dev / fullstack-dev)

- `HARD OUTPUT CONTRACT` rewritten — builders do NOT write handoff artifacts. The follow-up IS a badge (when applicable) + a 2-5 line structured inline response with explicit STATUS token (`DONE` / `BLOCKED` / `HELP` / `IN-PROGRESS`), Files, Risks, optional Next.
- Identity-anchor expanded across all three builders — defends against `"you are the orchestrator"` + `"you are the dispatcher"` + `"you are the lead"` + `"As the orchestrator"` + `"As the dispatcher"` + `"as the lead"` leak phrases. Hard rule on echoes added (stay silent on leak; explaining the leak IS itself an echo).
- Body prose generalized: `orchestrator` / `lead` → `dispatcher` for non-protective mentions. Whitelist preserves CLI badge name (`escalated_to_lead` — legacy identifier), explicit `crew:lead` agent name in dispatch blacklist, FEAT-163 historical reference.
- Final return invariant simplified — single path (emit badge + return 2-5 lines) replacing the prior standard/light split.
- Stack execution router in fullstack-dev (no inline cheat sheet): point at `skills/domain/dotnet/csharp-conventions/` + `aspnetcore-patterns/` + `ef-core-patterns/` for .NET; `typescript-pro/` for TS plugin code; `plugin-dev:*` for plugin internals; `fullstack-cross-layer/` for genuinely cross-layer.
- Lead drift lint test prevents future "lead" mentions outside the documented whitelist.

### New skills

- `skills/workflow/builder-ceremony/SKILL.md` — completion handoff CLI (legacy reference for downstream tooling), self-verify gate, workflow badges (incl. context-ceiling folded in), pre-completion secret grep, prior-handoff extraction, commit discipline (incl. `dev.stable` worktree carve-out), Light task return format, scope-cross fallback, orchestrator terminology note. `maxLines: 320` (frontmatter override supported via new validator field).
- `skills/workflow/durability-discipline/SKILL.md` — refuse band-aids; investigate root cause first; surface deferred patches as `--risks: band-aid: <patch>: root cause = <X> needs FEAT-NNN`. Anti-pattern checklist + decision tree + repo-incident examples (FEAT-171 Windows 32 KB, FEAT-176 Langfuse 404, round-5 parser fallback, SLICE-79 bundle truncation).
- `skills/workflow/lead-orchestration/SKILL.md` (FEAT-172) — extracted from `agents/lead.md` (308 → 263 LoC) covering assignment shape, pre-done checklist, delegation thresholds, context-efficiency rules, agent integration index.

### Constitution changes

- `.claude/crew/constitution.md` `dev.stable: true` worktree carve-out relaxed (revised 2026-06-21):
  - Only the **slice-scoped tests must pass** to unlock autonomous commits inside isolated worktrees / feature branches.
  - `typecheck` / `lint` / `format:check` demoted to advisory (deferred to dispatcher's review cycle). Rationale: TS gates run in ~1 s but C# / large-solution gates can hit 30 s+ per cycle; blocking autonomous commits on every full-suite gate kills slice velocity. Functional regressions still caught by tests; style/type drift caught downstream in review.
  - Branch protection: `dev.stable` does NOT unlock commits to `main` / `master`.

### Release-engineer expanded role

- `agents/release-engineer.md` now declares `role: [release-engineer, infrastructure-engineer]` and owns CI/CD workflow authoring, plugin manifest sync, OTel/Langfuse config, plus live troubleshooting flowcharts (CI / local build / hook crash / test timeout / OTel span drop / marketplace version drift / red tag) and a repo-incident catalogue.

### .NET skill drift fix

- `skills/domain/dotnet/aspnetcore-patterns/SKILL.md` updated from ASP.NET Core 8+ minimal API → **ASP.NET Core on .NET 10 with regular controller-based routing**. Controller skeleton + `Program.cs` wiring added; OutputCache example rewritten as a controller attribute.

### Infrastructure

- `scripts/validate-skills.ts` gained `maxLines:` frontmatter override (mirrors `validate-agents.ts` pattern). Skills that legitimately need >200 LoC declare the cap explicitly.
- Boundary lint rule in `biome.json` for `evals/lib/**` + `evals/providers/**` (no imports from `agents/`, `scripts/`, `src/`, `hooks/`, `commands/`).

## v0.38.0 — 2026-06-21 — config-driven feature gates; drop env-var escape hatches

Consolidates four `CREW_*` env-var toggles into the existing `crew.json`
`features` block. Adds a `FEATURES` registry with per-feature SemVer + owner
metadata, a `/crew:cost-setup` command that seeds + migrates the block
idempotently, and a `crew features-list` CLI subcommand for ops
discoverability. Bootstrap (`/crew:adopt`) now auto-seeds the features block
on first install.

### Removed env vars

The following env vars are gone. Each one was an escape-hatch on top of an
already-existing `features['<name>'].enabled` config gate, so config-driven
behavior is unchanged; only the env-var override is removed.

- `CREW_COST_HYGIENE`              → control via `features['cost-hygiene'].enabled`
- `CREW_TOOL_PREFLIGHT`            → control via `features['shell-preflight'].enabled`
- `CREW_SUBAGENT_INLINE_THRESHOLD` (escape-hatch `"0"` disables) → `features['subagent-inline-warn'].enabled`
- `CREW_COST_REPORT_DISPATCH_DETAIL` → always-on; flag had no real opt-out users

### New config knob (was env-only)

- `features['subagent-inline-warn'].threshold` (number, bytes, default `512`).
  Replaces the previous numeric reading of `CREW_SUBAGENT_INLINE_THRESHOLD`.

### New surface

- `FEATURES` registry in `scripts/lib/features-service.ts` — per-feature
  `version`, `default`, `description`, `scope`, `owner`, `since`, optional
  `deprecates` (records the env vars or config keys this entry replaces).
- `listFeatures()` + `getFeatureMeta()` helpers.
- `/crew:cost-setup` command + `scripts/lib/cost-setup.ts` (idempotent
  seeder; safe to re-run). Accepts `--features cost-hygiene=off,...` to
  override registry defaults at write time.
- `crew features-list` CLI subcommand — dumps the FEATURES registry as JSON.
- `bootstrapRepo()` / `initRepo()` auto-seed the `features` block in
  `.claude/crew.json` on first install. Existing fields outside `features`
  are preserved.

### Migration

For consumer repos that explicitly set any of the removed env vars: drop the
env-var lines from your shell profile / CI config. To disable a feature now,
edit `.claude/crew.json` (or run `/crew:cost-setup --features <name>=off`).

### Tests

-8 env-var-bound tests (replaced by 2 config-driven gate tests); +10
`cost-setup` tests; +1 `cost-hygiene` config-disable test. Net: +4 passing
tests (693 → 697). Zero regressions against the 39 pre-existing
Windows-timing / Bun `test()`-in-`test()` failures.

### LOC

26 modified + 3 new = 29 files changed. Tracked diff: +249 / -412 = **-163
net LOC**.

## v0.37.2 — 2026-06-19 — FEAT-165 plugin-cache ENOENT hotfix

Customer-repo report: every hook fire emitted `error: ENOENT while resolving package '@opentelemetry/api' from '...crew/0.37.1/scripts/lib/telemetry/otel-bridge.ts'` to stderr. Non-blocking (hooks still exit 0 via `main().catch`), but noisy on every tool call.

Root cause: `scripts/lib/telemetry/otel-bridge.ts` static-imported `@opentelemetry/api` at module top level (with a comment claiming it was safe because the package is "the global singleton registry, ~30 kB, no heavy deps"). The three `hooks/otel-*.ts` entries then statically imported `otel-bridge.ts`. Plugin installs land at `~/.claude/plugins/cache/astra/crew/<version>/` with the repo's `package.json` but no `node_modules` — the plugin loader does not run `npm install` against the cache. So the static `import "@opentelemetry/api"` ENOENT'd on every hook spawn, regardless of `bridgeEnabled(cfg)` (which checks AFTER the import already failed). The comment that justified the top-level import was wrong for the plugin-cache install path.

Fix:
- `scripts/lib/telemetry/otel-bridge.ts` — dropped top-level `import { trace, SpanKind } from "@opentelemetry/api"`. The api module is now lazy-imported inside `initBridge` (alongside the existing lazy SDK imports), cached at module scope as `cachedOtelApi`, and read by the synchronous `emit*` functions. If `cachedOtelApi` is null (init never ran or failed), the emitters silently no-op. Init wraps all `@opentelemetry/*` dynamic imports in try/catch; on `MODULE_NOT_FOUND` it writes a one-shot friendly stderr line (`crew-otel: telemetry deps not installed, bridge disabled. Run \`npm i @opentelemetry/api ...\` in this repo to enable.`) and returns null.
- `hooks/otel-{post-tool-use,stop,subagent-stop}.ts` — moved the `otel-bridge` import behind the `bridgeEnabled(cfg)` gate via a dynamic `await import(...)`. The disabled path (the default — `CREW_OTEL_ENABLED` unset OR `cfg.enabled !== true`) now never resolves `otel-bridge.ts` AT ALL, which means no `@opentelemetry/*` resolution attempts are made at any layer. Stderr is silent.

Net effect for the customer repo: zero stderr noise on every hook fire (disabled telemetry path). Consumers who actively opt in to telemetry (`CREW_OTEL_ENABLED=1` + `cfg.enabled: true` in `.claude/crew/telemetry.yaml`) get the friendly one-line install prompt instead of the cryptic Bun resolver error if the deps are missing in their repo. Plugin shape stays runtime-light — no bundled `node_modules`, no esbuild step, no plugin-cache bloat.

Test telemetry suite stays 7/7 pass (the suite has the deps installed via the plugin repo's own `npm install`, so the lazy load resolves on first init).

## v0.37.1 — 2026-06-19 — FEAT-165 hook flush hotfix

Two of three FEAT-165 SLICE-81 hooks (`PostToolUse` + `SubagentStop`) shipped without `await sdk.shutdown()` before process exit. BatchSpanProcessor buffered the span and the process died before flush — every span dropped silently. The `Stop` hook was correct (used as the reference pattern for the fix).

Live dogfood against `cloud.langfuse.com` post-v0.37.0 detected the bug: hooks exited 0, no traces appeared. Cause: `InMemorySpanExporter` (used by the 20 SLICE-81 unit tests) is synchronous — it accepts spans the moment `onEnd()` queues them, masking the async batch-then-export path that `OTLPTraceExporter` uses in production.

Fix:
- `hooks/otel-post-tool-use.ts` + `hooks/otel-subagent-stop.ts` — both now wrap `sdk.shutdown()` in a 1000ms timeout race before `main()` resolves, matching `hooks/otel-stop.ts`'s existing shape.
- `tests/telemetry-hook-flush.test.ts` — new live-flush integration test. Spawns each hook subprocess with a synthetic stdin payload + a local HTTP collector on a random port; asserts the OTLP POST arrived before the process exit. Catches future flush regressions definitively.

Process learning saved as `feedback-inmemoryexporter-misses-flush-bugs`: `InMemorySpanExporter` unit tests cover business logic (PII scrub, sampling, attr shape) but cannot catch async lifecycle bugs; both layers are required.

## v0.37.0 — 2026-06-19 — observability bridge, declarative workflows, prompt frontmatter contract, agent eval foundation

Six slices across four FEATs landed in two parallel-worktree batches.

### SLICE-77 — Cost-report → OTel span JSONL backfill (FEAT-165 SLICE-A)

Pure data-transform substrate. Reads `.claude/artifacts/crew/cost/*.md` slice cost reports and emits OTel-shaped span JSONL under `.claude/artifacts/crew/spans/<run_id>.jsonl`. Trace tree: root slice span → phase span → N `agent.dispatch` spans per modelMix entry. Deterministic SHA-256-seeded trace + span ids (byte-identical re-run). No hooks, no live exporter — substrate that SLICE-81 (live OTel hook bridge) and FEAT-167 SLICE-C (prompt_id attr injection) both consume.

- New: `scripts/lib/telemetry/{span,cost-report-loader,cost-report-to-spans,serialize-jsonl}.ts`, CLI at `scripts/cost-report-to-spans.ts`, 4 test files (15 cases).
- Grade: 0.867 average.

### SLICE-78 — Declarative workflow YAML, regular only (FEAT-166 SLICE-A)

`.claude/workflows.yaml` introduces a declarative source-of-truth for slice dispatch shape, consumed by both autonomous-loop and interactive `/crew:build` paths. SLICE-A ships the `regular` workflow only with **zero behavior change** vs the pre-refactor hard-coded dispatch (golden trace test pins the contract). Encodes the real post-builder-fanout shape: reviewer-A + reviewer-B + validator dispatched as one parallel Agent message with `wait_for_all` + `halt_on: any_FAIL`. Includes tag-based builder routing (frontend / backend / parallel-fe-be / default).

- New: `.claude/workflows.yaml`, `scripts/lib/workflow-config.ts` (Zod schema + loader + `expandWorkflow`), `scripts/validate-workflows.ts` (new CI gate), golden trace test.
- Grade: 0.831 average.

### SLICE-79 — Prompt frontmatter contract + validator extension + 1.0.0 backfill (FEAT-167 SLICE-A)

Adds `prompt_id` (kebab-slug) + `version: 1.0.0` frontmatter fields to all 18 first-party agents and 64 first-party skills. Conditional `evals: <path>` field on the 10 execution agents (builder / reviewer / validator / deployer / lead variants). Extends `scripts/validate-agents.ts` + `scripts/validate-skills.ts` to enforce the contract. New `docs/prompts/README.md` documents versioning policy. Pure metadata — no runtime code paths changed. Eval tree (FEAT-167 SLICE-B) and OTel attr injection (FEAT-167 SLICE-C) deferred.

- Grade: 0.843 average.

### SLICE-80 — Agent eval harness foundation, dry-run only (FEAT-162 SLICE-A)

`tests/agent-eval/` scaffolds the subscription-billed agent eval harness — `claude -p --output-format stream-json` + Bun fixtures + OAuth. SLICE-A ships type contract (`Fixture`, `CapturedTrace`), 5 pure assertion helpers (`toolCallsOf`, `hasToolCall`, `dispatchedAgent`, `findArtifact`, `artifactContains`), a stub `runClaude` (throws "not implemented — SLICE-B"), one dry-run replay fixture, one synthetic captured-trace JSON, and a Bun test loop with `describe.skipIf(!CREW_AGENT_EVAL)` guard. Live `claude -p` subprocess deferred to SLICE-B. Real stream-json reference fixture (`real-claude-p-stream.jsonl`) committed for SLICE-B parser.

- New: `tests/agent-eval/{lib,fixtures}/`, `package.json: "test:agents"` script.
- Promptfoo / Inspect AI / DeepEval / Anthropic Evals SDK explicitly rejected as API-billed (DEC-TBD).
- Grade: 0.831 average.

### SLICE-81 — Live OTel hook bridge + OTLP HTTP exporter + PII scrub (FEAT-165 SLICE-B)

Wires hook stdin (PostToolUse / Stop / SubagentStop) through pure parse + PII scrub + lazy-imported `@opentelemetry/sdk-node` + OTLP HTTP exporter. Default DISABLED. Two-key opt-in (`cfg.enabled: true` AND `CREW_OTEL_ENABLED=1`). Bridge NEVER calls `api.anthropic.com` (AC-9 audited). PII scrub on hot path — `tool_input.content` + `last_assistant_message` always redacted; `redact_paths` glob + length cap. Lazy SDK import keeps disabled path under ≤50ms p95 hook latency. Try/catch wrap on every `emit*` — telemetry crash never propagates to Claude.

- New: `scripts/lib/telemetry/{config,hook-input,otel-bridge,scrub}.ts`, 3 hooks under `hooks/otel-*.ts`, `.claude/crew/telemetry.example.yaml`, `scripts/setup-langfuse-self-host.ts`, `docs/observability/langfuse-bridge.md`, 4 test files (20 cases).
- Deps: `@opentelemetry/sdk-node`, `@opentelemetry/exporter-trace-otlp-http`.
- Grade: 0.881 average — highest of the batch.

### SLICE-82 — Quick / spike / release workflows + `${env:VAR}` substitution (FEAT-166 SLICE-B)

Extends SLICE-78 with 3 new workflows (`quick` / `spike` / `release`) plus `${env:VAR}` and `${env:VAR:-default}` substitution. `${env:` opt-in marker prevents accidental capture of dollar-sign-containing strings. `release` workflow requires `require_user_approval: true` on the deployer phase. Slice frontmatter `workflow:` field routes individual slices to any declared workflow. Circular routing detection via DFS. `regular` golden trace BYTE-IDENTICAL to main (zero-regression contract).

- New: `tests/fixtures/dispatch-traces/{quick,spike,release}.golden.json`, 5 invalid-fixture yamls, 2 new test files, `docs/standards/workflow-schema.md`.
- Grade: 0.870 average.

### FEAT-143 — bisect procedure + squash-merge detection + prune-artifacts --dry-run

Landed via PR #115. `scripts/lib/branch-cleanup.ts` adds squash-merge detection; `skills/workflow/systematic-debugging` gains a `git-bisect.md` reference page. Independent of the FEAT-162/165/166/167 batch — integrated via standard merge into main.

### Stabilization notes

Three stabilization tests run before release:

- **FEAT-166 workflow CLI smoke** — all 4 workflows load + expand correctly. Schema integrity verified.
- **FEAT-162 trace-shape vs fixture** — real `claude -p stream-json` shape diverges from synthetic fixture (tool_use nested under `assistant.message.content[]` vs flat in `events[]`). Resolved by committing `real-claude-p-stream.jsonl` as the SLICE-B parser input contract and documenting the nested→flat transform in `tests/agent-eval/README.md`.
- **FEAT-165 docker-compose** — Langfuse compose template valid; obsolete `version: "3.8"` field removed from both `langfuse/docker-compose.yml` and the generator at `scripts/setup-langfuse-self-host.ts`.

### Out of scope / next slices

- FEAT-162 SLICE-B (real `claude -p` subprocess wrapper + live fixture).
- FEAT-165 SLICE-C (PII scrub regression tests + CI dry-run gate).
- FEAT-166 SLICE-C (substantive `agents/lead.md` refactor — workflow loaded at slice start).
- FEAT-167 SLICE-B (`evals/` tree + reference specs — blocked on FEAT-162 SLICE-B).
- FEAT-167 SLICE-C (OTel `prompt_id` + `prompt_version` attr injection into agent-dispatch spans).

### Process learnings

Six feedback memories captured for future sessions (see `~/.claude/projects/.../memory/`):

- HARD RULE: never fan out `crew:lead` as a subagent (refused / bailed / **fabricated** completion across 3 worktrees).
- Pre-reserve slice ids before parallel spec-writer dispatch (race condition observed).
- Pick up + finish stuck builders inline from main thread (faster than SendMessage).
- Per-file `line_budgets:` in spec frontmatter (validated: 8/8 files in SLICE-80 respected caps first try).
- `agents/lead.md` cap-merge collision when parallel branches both touch it.
- `git fetch` before `git push` on main (external PR merges land out-of-band).

## v0.36.0 — 2026-06-17

### SLICE-74 — lead.md slim-down: policy blocks relocated to workflow skills (FEAT-158, DEC-025)

Relocated four high-volume policy blocks from `agents/lead.md` (369 → 300 lines) into four new
`skills/workflow/` skills. Pure relocation — no semantic change to routing decisions. Each deleted
block replaced with a one-line Skill-tool reference. Workflow skills are procedural advisory only
(no `scripts/<name>.ts` per DEC-025).

- `lead.md: ## Risk-based tier + ## SLA caps + ## Confidence aggregation → skills/workflow/risk-tier/SKILL.md`
- `lead.md: ## Fan-out review → skills/workflow/fan-out-review/SKILL.md`
- `lead.md: ## Agent quick reference → skills/workflow/lead-routing/SKILL.md`
- `lead.md: ### Verifier dispatch decision → skills/workflow/validator-gate/SKILL.md`
- `agents/lead.md` line count: 369 → 300 (frontmatter `maxLines: 305`). FEAT-158 aspirational ≤200 target unreachable without relocating Autonomous resolution + Delegation thresholds (identity-defining, kept per slice Out-of-scope). Floor measured + AC-3 amended to ≤300 mid-slice. Further slimming deferred to follow-up FEAT.

## v0.35.3 — 2026-06-12 — agent integration map

Patch release adding an `## Integration with Other Agents` section to every
first-party crew agent prompt (18 files under `agents/`). Each section is
tailored to the role — self-references dropped, repo agent names mapped
correctly (`backend-dev`, `frontend-dev`, `uxdesigner`), and missing-role
references (`security-auditor`, `database-optimizer`) excluded since those
agents do not exist in this plugin.

The goal is to make each agent more autonomous and less dependent on
out-of-band coordination by lead — every specialist now carries a short,
in-prompt cheat sheet of who it consumes from and who it hands off to.

Touched files: `agents/architect.md`, `agents/backend-dev.md`,
`agents/frontend-dev.md`, `agents/fullstack-dev.md`, `agents/uxdesigner.md`,
`agents/qa-expert.md`, `agents/performance-engineer.md`,
`agents/release-engineer.md`, `agents/document-writer.md`,
`agents/researcher.md`, `agents/investigator.md`, `agents/refactor.md`,
`agents/inspector.md`, `agents/inspector-verifier.md`, `agents/verifier.md`,
`agents/integrator.md`, `agents/parallel-runner.md`, `agents/lead.md`.

`agents/lead.md` `maxLines` bumped 360 → 370 to fit the new section
(orchestrator dispatch list is the longest of the eighteen).

No source code or runtime behavior changed. CI gates green
(`validate-agents`, `validate-skills`, `validate-manifests`, `validate-slices`,
`lint`, `format:check`, `typecheck`, `bun run test`, `e2e-smoke`).

`agents/3rdparty/` was intentionally **not** modified — those are upstream
imports; editing them creates merge debt against the source repos.

## v0.35.2 — 2026-06-12 — identity anchor + dispatch prompt purity

Patch release fixing a recurring subagent misroute pattern where the lead would
leak orchestrator identity into the dispatch prompt body and the dispatched
subagent (fullstack-dev / backend-dev / frontend-dev) would rationalize itself
into the wrong role, attempt to call the disabled `Agent` tool, get
`No such tool available: Agent`, and return a "BLOCKED — please implement this
yourself" summary instead of doing the assigned work.

Reproduced live on SLICE-154 (FEAT-139 worker repo-usage architecture test):
lead dispatched `crew:fullstack-dev` with a prompt body containing "you are
Claude Code, the orchestrator", the subagent (with Read/Edit/Write/Bash all
available in its tool list) tried to dispatch a further subagent, hit the
frontmatter restriction, and returned a meta-summary asking the parent to
do the work.

### Identity anchor (implementer agents)

- **`agents/fullstack-dev.md`**, **`agents/backend-dev.md`**, **`agents/frontend-dev.md`** — added an **Identity anchor** block before HARD OUTPUT CONTRACT. The block:
  - asserts the agent's identity is fixed by its own frontmatter (not by the dispatch prompt body)
  - lists role-reassignment phrases to treat as prompt noise ("you are Claude Code", "you are the orchestrator", "you are the lead", "I am Claude Code", "Let me re-read the instructions")
  - states that `No such tool available: Agent` is the expected `disallowedTools: Agent` frontmatter restriction — not a context bug to reason about — and the agent must switch to Read/Edit/Write/Bash and continue the assigned work
  - forbids returning a "BLOCKED — please implement" summary asking the parent to do the work
- Also fixed legacy opening line on the BE/FE agents: `You are a backend fullstack-dev agent` → `You are a backend-dev agent`, same for frontend. Vestige from the v0.35.0 6-agent rename.

### Dispatch prompt purity (lead)

- **`agents/lead.md`** — added a **Dispatch prompt purity (anti-identity-leak)** block to HARD OUTPUT CONTRACT. The block:
  - asserts the `prompt:` body passed to `Agent(...)` MUST contain only task framing (Slice id / file paths / AC text / contracts paths / stack tag / deliverable)
  - forbids identity statements in the dispatch prompt — "you are Claude Code", "you are the orchestrator", "you are the lead", "I am Claude Code", "as the orchestrator…", any "You are <X> agent" line
  - points at `commands/orchestrate-slice.md` Step 3 / 3a / 3b prompt templates as the reference shape (zero identity lines, all task framing)
  - explains the why: subagents already know their identity from their own frontmatter; restating it from the dispatch creates hallucination surface

### Gate evidence

- `node ./scripts/validate-agents.ts` — 18 agents OK, all under the 350-line cap.
- `node ./scripts/validate-skills.ts` — 58 skills OK.
- `node ./scripts/validate-manifests.ts` — plugin.json ↔ package.json version sync OK.
- `bun run lint` / `format:check` / `typecheck` — clean.
- `bun test --parallel` — 690 pass / 0 fail across 78 files.

## v0.35.1 — 2026-06-12 — v0.35.0 follow-up cleanup

Patch release addressing leftover refs after the v0.35.0 6-agent rename + namespace fix.

### Lead.md cleanup

- **`Skill` + `ToolSearch` removed from lead.md tools** (and added to `disallowedTools`). Lead now has `[Agent, TaskCreate, TaskUpdate, TaskList, TaskGet]` only. Closes the last surface where Lead could rationalize calling `Skill(crew:build)` etc. Procedure-of-record content (brainstorming, using-crew, context-curation) is now embedded inside the subagents that consume it; Lead does not pre-load on their behalf.
- **`## Custom instructions` block** rewritten — the dispatcher inlines applicable global / repo overrides into the dispatch prompt before the slice content. Lead has no `Read` tool, so it cannot open instruction files itself.
- **Tool routing block** rewritten — no longer instructs Lead to use Skill at all; Agent is the only dispatch path.
- **Forbidden endings list** pruned to drop `Skill` / `ToolSearch` (Lead cannot call them anyway).

### Other renames

- `crew:reviewer-validator` → `crew:inspector-verifier` (combined LOW-tier agent). File renamed via `git mv`; frontmatter `name:` updated; all cross-references in `agents/`, `docs/routing-table.md`, `scripts/lib/parallel-gates.ts`, `tests/agent-topology.test.ts` updated.
- `loop:document-writer` → `crew:document-writer` everywhere. Now consistent with the agent's actual file location.
- Confidence aggregation formula in `agents/lead.md` updated:
  - `builder_confidence` → `dev_confidence`
  - `reviewer_confidence` → `inspector_confidence`
  - `validator_confidence` → `verifier_confidence`

### CLI alias

- New `bun run verify:all` package.json script (preferred). `bun run validate:all` kept as a deprecated alias for external tooling. Agent prompts and `commands/orchestrate-slice.md` updated to use `verify:all`.

### Specialist routing

- `crew:inspector-verifier` added to lead's specialist routing examples to confirm registration.
- `caveman:cavecrew-builder` removed from specialist routing — external plugin agents are not first-class crew specialists. Explicit exclusion note added.

### Tooling

- `scripts/validate-manifests.ts` updated to tolerate missing `.claude-plugin/marketplace.json` (registry moved to `sergeymilashico/astra-marketplace` in commit `bfc4d2d`). It still enforces `plugin.json` ↔ `package.json` version sync; marketplace-specific checks are skipped when the file is absent.

## v0.35.0 — 2026-06-12 — agent rename to break crew: namespace collision

### Behavior change — 6 agents renamed

Lead repeatedly misrouted `Skill(crew:build)` / `Skill(crew:validate)` instead of `Agent(subagent_type: "crew:builder")` / `Agent(subagent_type: "crew:validator")`. Three reproductions today (loop SLICE-152, SLICE-153, plus one during patch verification). Root cause: `crew:` namespace collision. Slash commands (`/crew:build`, `/crew:validate`, etc.) and subagent types (`crew:builder`, `crew:validator`, etc.) look identical to the model — the three-character difference (`build` vs `builder`) doesn't survive Sonnet-tier reasoning. Three text patches (FEAT-161 SLICE-A/B + v0.33.2 + v0.34.0's `7029861`) all failed to stop the misroute.

Structural fix: rename the subagents out of the colliding `crew:` namespace area. Slash commands keep their existing names; the agents move:

- `crew:builder` → `crew:fullstack-dev`
- `crew:builder-be` → `crew:backend-dev`
- `crew:builder-fe` → `crew:frontend-dev`
- `crew:validator` → `crew:verifier`
- `crew:reviewer` → `crew:inspector`
- `crew:deployer` → `crew:release-engineer`

Now lead's "I'll use crew:X to kick off the build" rationalization no longer resolves — there is no `crew:builder` subagent type. Only `crew:fullstack-dev` is dispatchable, and the slash command `crew:build` is clearly a different surface.

**Consumer impact**: any external repo or routing code that dispatches by the old subagent name will break. Update to the new names. `--builder` / `--reviewer` / `--validator` / `--deployer` CLI flags on `scripts/crew.ts` keep their existing names for backward compatibility; only the agent file frontmatter `name:` field changed.

### Behavior change — TaskCreate → Agent pairing rule

New hard-contract rule in `agents/lead.md`: every work-producing step must be `TaskCreate` followed by `Agent` dispatch in the same response. `TaskCreate` without a paired `Agent` call within the same turn is a contract violation — the Task ledger drifts from reality and slice budget tracking goes wrong. Forbidden endings: `TaskCreate` / `TaskUpdate` / `TaskList` / `TaskGet` / `ToolSearch` / `Skill` alone, or narration alone.

### Changed

- 6 agent files renamed (frontmatter `name:` + filename via `git mv`):
  - `agents/builder.md` → `agents/fullstack-dev.md`
  - `agents/builder-be.md` → `agents/backend-dev.md`
  - `agents/builder-fe.md` → `agents/frontend-dev.md`
  - `agents/validator.md` → `agents/verifier.md`
  - `agents/reviewer.md` → `agents/inspector.md`
  - `agents/deployer.md` → `agents/release-engineer.md`
- `agents/lead.md`: TaskCreate→Agent pairing block added under HARD OUTPUT CONTRACT. `maxLines:` 350 → 360 to accommodate. Cap 354/360.
- `docs/routing-table.md`: all Route-to column references renamed.
- `scripts/validate-agents.ts`: `BASH_COALESCING_REQUIRED` + `TASK_UPDATE_BATCHING_REQUIRED` sets renamed.
- `scripts/validate-routing-table.ts`: `KNOWN_CREW_ROLES` + `CREW_ROLE_IN_CELL_RE` updated to recognize new names.
- `commands/orchestrate-slice.md`: all dispatch prompts use new names.
- All 14 other agent files (`architect.md`, `uxdesigner.md`, `integrator.md`, `parallel-runner.md`, `refactor.md`, `qa-expert.md`, `performance-engineer.md`, `investigator.md`, `researcher.md`, `reviewer-validator.md`, `document-writer.md`): cross-references updated.

### Tests

- `tests/agent-topology.test.ts`: `EXPECTED_AGENTS` set renames 6 entries.
- `tests/builder-be-prompt.test.ts` → `tests/backend-dev-prompt.test.ts` (rename + assertion updates).
- `tests/builder-fe-prompt.test.ts` → `tests/frontend-dev-prompt.test.ts` (rename + assertion updates).
- `tests/build-bundle-assemble.test.ts`: bundle filename + frontmatter expectations updated.
- `tests/agent-prompt-content.test.ts`: verifier UI/UX guard text assertion updated.
- `tests/validate-routing-table.test.ts`: assertion patterns + fixture files renamed.
- 687/690 tests pass (3 pre-existing failures: 2 `validate-all` from marketplace.json removal, 1 `log_event.sh` timing flake).

### Migration for downstream consumers

Update any code or docs that dispatches by old agent names:

```diff
- Agent(subagent_type: "crew:builder", ...)
+ Agent(subagent_type: "crew:fullstack-dev", ...)

- Agent(subagent_type: "crew:reviewer", ...)
+ Agent(subagent_type: "crew:inspector", ...)
```

Apply for all 6 renames. CLI flags (`--builder`, `--reviewer`, etc.) keep their existing names so `node scripts/crew.ts ... --builder backend-dev ...` continues to work.

### Why structural-not-textual

Three text patches landed and failed: FEAT-161 SLICE-A/B HARD CONTRACT block (commits `b31ca77`, `83fb35e`), v0.33.2 source-read prohibition (commit `158fa61`), and v0.34.0's Skill-vs-Agent block (commit `7029861`). Each time the model rationalized past the prose. Renaming the targets out of the colliding namespace removes the rationalization surface — there is no `crew:builder` for lead to reach for.

## v0.34.0 — 2026-06-11 — lead structural dispatch discipline + marketplace migration + document-writer ceremony close

### Behavior change — `crew:lead` cannot read, shell, or grep

Two prior interventions (FEAT-161 SLICE-A/B HARD OUTPUT CONTRACT + v0.33.2
source-read prohibition) added prompt text telling lead not to do gate work
itself. Both still left the failure surface: lead had `Bash` + `Read` +
`Grep` + `Glob` in its tool list, so the model could rationalize
"just verify quickly" whenever the contract said "dispatch".

Structural fix replacing the prompt-text approach:

- `agents/lead.md` frontmatter `tools:` now `[Agent, Skill, ToolSearch,
  TaskCreate, TaskUpdate, TaskList, TaskGet]`. `disallowedTools:` denies
  `Bash, Read, Edit, Write, Grep, Glob, NotebookEdit`. Lead literally
  cannot Read, Bash, Grep, or Glob — the rationalization surface is
  physically removed, not just textually forbidden.
- HARD OUTPUT CONTRACT: lead's LAST tool call MUST be an `Agent`
  dispatch. The two Bash escape valves (`slice complete`,
  `write-final-synthesis`) are gone — lead dispatches
  `crew:document-writer` with structured `SliceId:` / `Title:` /
  `Summary:` / `ExternalDeltas:` instead.
- Golden Path Step 1 (Frame) reads `risk:` from slice frontmatter
  (per loop FEAT-184) — no manual classification. The
  Risk-based tier table's Signals column was dropped (lead couldn't
  verify "touches auth" without Read).
- Step 5 (Synthesize) is now "dispatch `crew:document-writer`" — lead
  does not run the CLI sequence.
- 23 leftover read/write/act nudges removed in a 5-pass audit:
  `mark-badge` calls routed through document-writer, "consult capabilities
  frontmatter directly" replaced by Agent quick reference table lookup,
  "verify workspace" + "retrieve wake-up context" replaced by "trust
  the dispatcher's prompt", artifact emission re-attributed to subagent
  ownership, and stale "Opus-tier reads" historical context tightened.
- `agents/lead.md`: 290 → 305 lines (net -22 lines vs pre-audit 327).

Tracking: learnings ID 3 `lead-refuses-dispatch` (loop SLICE-92) +
ID 4 `lead-post-builder-bash-validation` (loop SLICE-97) captured the
recurring failures that motivated this. Diagnostic plan:
`docs/superpowers/plans/2026-06-11-lead-dispatch-discipline-diagnostic.md`.

### Behavior change — `crew:document-writer` owns slice-close ceremony

- `agents/document-writer.md` gained `Bash` in its tools array and
  `model: haiku` in frontmatter (was missing — required by
  `validate-agents`).
- New "Slice close ceremony" section documents the exact CLI sequence
  document-writer runs on lead's dispatch: `node scripts/crew.ts
  write-final-synthesis ...` → `bun src/scripts/loop.mts slice
  complete ...` → `bun src/scripts/loop.mts slice grade ...`.
- Bash allowlist explicit: ceremony CLIs + `git log` / `git diff
  --stat` / `git show --stat` + read-only `cat` / `head` / `tail` /
  `ls` / `find` on `.claude/artifacts/`. Forbidden Bash includes
  `bun test` / `bun run lint` / `bun run typecheck` /
  `bun run validate:all` (validator territory) and any `sed -i` /
  `>` / `rm` (use Edit / Write tools).
- Report contract section added (was missing).
- `agents/document-writer.md`: 93 → 134 lines.

### Lint

- `scripts/validate-agents.ts`: `lead` removed from
  `BASH_COALESCING_REQUIRED` (FEAT-157). Lead has no Bash; the
  coalescing rule is irrelevant.

### Tests

- `tests/agent-topology.test.ts`: `EXPECTED_AGENTS` adds
  `document-writer` (now an 18-agent first-party topology).
- `tests/dispatch-timing-pre-tap.test.ts`:
  `lookupAgentModel("crew:lead")` expectation flipped from `opus` to
  `sonnet`. Lead frontmatter has been Sonnet for a while; this test
  was stale.

### Marketplace migration

The marketplace registry has moved to its own repository:
[sergeymilashico/astra-marketplace](https://github.com/sergeymilashico/astra-marketplace).

- `hero-crew` no longer carries `.claude-plugin/marketplace.json` (commit
  `bfc4d2d`). This repo is plain plugin code now.
- `crew` is registered in `astra-marketplace` alongside `loop` and `cortex`.
- Install path:
  ```
  /plugin marketplace add sergeymilashico/astra-marketplace
  /plugin install crew@astra
  ```
- Old install path (`sergeymilashico/hero-crew` as marketplace) no longer
  works — anyone tracking that source needs `/plugin marketplace remove
  hero-crew` and re-add `astra-marketplace`. GitHub redirect handles the
  source-repo URL; the marketplace.json fetch fails because the file is
  gone.

### Action items for downstream consumers

- Update install docs (READMEs, runbooks, CI bootstrap) to point at
  `sergeymilashico/astra-marketplace`.
- Run `/plugin marketplace remove hero-crew` + `/plugin marketplace add
  sergeymilashico/astra-marketplace` on existing installs.
- Re-install crew via `/plugin install crew@astra` and run
  `/reload-plugins`.

### Why structural-not-textual

Prompt-text interventions (FEAT-161 SLICE-A/B + v0.33.2) repeatedly
failed because the model could rationalize past any prose: "the
contract says dispatch but I'll just run lint while I'm here." Cutting
the tools at the frontmatter level removes the physical capability —
no amount of rationalization adds `Bash` back to the tool set. The
prompt is now smaller (-22 lines net), not bigger.


## v0.33.2 — 2026-06-11 — lead source-read prohibition

### Behavior change

- **Lead is now hard-prohibited from reading source files.** SLICE-142
  recon-leak post-mortem: lead spent ~5 min and ~30k opus tokens reading 4
  `.cs` source files, 4 globs, and 3 symbol-discovery greps before the first
  builder dispatch — even though the parent orchestration prompt explicitly
  said scope was well-defined and to skip the architect. Existing "5+ Reads
  without dispatch" rule counted quantity, not kind: orchestrator-context
  reads (slice / plan / run-brief / FEAT) ate the budget while source reads
  slipped through.

### Changes to `agents/lead.md`

- New "What lead reads (whitelist)" section: ALLOWED ≤4 orchestrator
  artifacts (slice, plan, run-brief, FEAT, ≤1 DEC-*); FORBIDDEN source
  files (`*.cs` / `*.ts` / `*.py` / `*.go` / `*.cshtml`), tests, entities,
  controllers, services, project config (`.csproj`, `package.json`,
  `Dockerfile`). Any signature / call-site / implementation question →
  dispatch `crew:investigator` (haiku, ~$0.20) or `crew:researcher`.
- Hard limit "zero source-file reads" at the top of the Identity block —
  source-file Read = "you're acting as an implementer; stop and dispatch."
- Delegation thresholds tightened: ANY source Read → dispatch (threshold
  is now 1, not 3); ANY Glob / Grep for symbol discovery (class names,
  method signatures, interface definitions) → dispatch. Lead's Grep is
  reserved for routing signals (e.g. detecting `stack:csharp` tag).
- Pre-done checklist self-audit: "Did lead read any source file directly?
  → record in synthesis as `lead_recon_leak: <count>` for cost-advise
  trend tracking."
- Cost rationale: lead source reads burn opus tokens and the builder will
  re-read the same files in its own context. Pay twice for nothing.

Net diff: +23 / -2 in `agents/lead.md`; ≤350 line cap preserved.

## v0.33.1 — 2026-06-11 — dispatch-timing handle cross-process fix

### Bug fix

- **Dispatch-timing JSONL never populated (telemetry dead in v0.33.0).** The
  PreToolUse Agent hook stored the dispatch handle in a module-level Map
  (`_dispatchHandles`) inside `hooks/lib/check-subagent-return.ts`. Each Claude
  Code hook runs in a fresh Bun process — PreToolUse Agent and SubagentStop are
  separate processes, so the Map died on PreToolUse exit and SubagentStop never
  found a handle to consume. Result: `.claude/logs/dispatch-timing.jsonl` was
  never written despite all the wiring being in place.
- **Fix:** new `hooks/lib/dispatch-handle-store.ts` persists each handle to a
  small JSON file under `.claude/state/crew/dispatch-timing/<session_id>.json`
  on PreToolUse Agent. SubagentStop reads + deletes that file via
  `loadAndDeleteDispatchHandle(session_id)` and writes the completed row to the
  JSONL log. Cross-process correlation via the filesystem.
- Session ids with unsafe path characters (`/`, `\`, `:`) are sanitized to
  `_` before becoming filenames; tested.
- Old `_dispatchHandles` Map + `registerDispatchHandle` export removed (dead
  code after the refactor).
- New unit tests in `tests/dispatch-handle-store.test.ts` cover persist + load
  round-trip, missing-handle returns null, empty session_id is a no-op, and
  unsafe-character sanitization.
- End-to-end verified: piping a PreToolUse Agent payload then a SubagentStop
  payload through the actual hook entry shims produces one JSONL row with
  correct `wallMs`, `tokenIn` from `<usage>` markers, and `toolCalls.Total`
  from `tool_uses` count.

This unblocks Phase 1 baseline collection (FEAT-149/150/151 success criterion).

## v0.33.0 — 2026-06-11 — agent capability metadata + Phase 1 slice-perf telemetry + lead.md OpenAI 8.7/10 review

### Features

- **Agent capabilities frontmatter:** every main and 3rdparty agent under `agents/**/*.md`
  now declares a structured `capabilities:` block (`role` / `surfaces` / `stacks` /
  `concerns` / `scopes` / `lens` / `priority`). 30 agents populated. Lead routing
  remains backward-compatible — missing capabilities → wildcard match. Sets up the
  capability-registry consumer (FEAT-160).
- **Phase 1 slice-perf telemetry (FEAT-149/150/151):**
  - `scripts/lib/dispatch-timing.ts` — per-subagent-dispatch JSONL writer (runId,
    sliceId, agent, model, wallMs, toolCalls map, bashDurationMs, skillLoadCount,
    tokenIn, tokenOut) appending to `.claude/logs/dispatch-timing.jsonl`. Per-worktree
    path via `CLAUDE_PLUGIN_ROOT`; `CREW_DISPATCH_TIMING_LOG` env override for tests.
  - `scripts/lib/bash-gate-timer.ts` + new PreToolUse / PostToolUse Bash hooks tap —
    per-gate duration + exit code to `.claude/logs/bash-gates.jsonl`. Classifies
    `lint` / `format:check` / `typecheck` / `test` / `audit` / `validate:all` / `npm-ci`.
  - `scripts/lib/dispatch-timing-reader.ts` — aggregator returning top-3 slowest,
    top-3 token-heaviest, total wall, by-gate breakdown, timeout count.
  - `scripts/crew.ts write-cost-report` extended with a "Per-dispatch breakdown"
    section appended below the existing "By Model" block. Toggle off via env
    `CREW_COST_REPORT_DISPATCH_DETAIL=0`. Includes a Skills column per FEAT-151
    spec gap fix.
  - Dispatch-timing start sites wired via a new PreToolUse Agent hook + extended
    `check-subagent-return` SubagentStop tap. Usage parsed from `<usage>total_tokens:
    N tool_uses: M</usage>` markers in subagent return bodies for coarse token + tool
    counts.

### Lead.md refactor (OpenAI 8.7/10 review applied)

- **Routing improvements:**
  - Architect bottleneck removed: architect now precedes builder **only** for
    HIGH risk OR `surface:schema` / `surface:api` (contract) / `concern:governance`
    slices — bug fix / test fix / small refactor go straight to builder.
  - Confidence aggregation formula added: `slice_confidence = 0.2 * builder_confidence
    + 0.4 * reviewer_confidence + 0.4 * validator_confidence` with tier floors
    (LOW ≥ 0.6, MEDIUM ≥ 0.7, HIGH ≥ 0.8). Below tier floor but ≥ 0.4 → mark
    `blocked` on lowest lens; below 0.4 → escalate to user.
  - Reviewer disagreement arbitration: lens conflict (PASS vs NEEDS_FIX) →
    dispatch `crew:3rdparty:architect-reviewer` for binding tiebreaker, single
    round, decision final.
  - Tag-to-agent table replaced by concrete "Need / Agent / Stack" 16-row quick
    reference covering the main crew. Specialist routing delegates to the new
    agent capabilities frontmatter.
- **Smell fixes (six self-reference + contradiction bugs):**
  - `escalated_to_lead` references corrected — lead cannot escalate to itself.
  - "Update instruction files" rule on no-edit role rewritten to dispatch.
  - "Write artifact" verb in Golden Path Step 6 made explicit: `node scripts/crew.ts
    write-run-brief` / `write-final-synthesis` CLI invocation — closes the
    Bash-bypass loophole.
  - Golden Path 7 steps → 6 (Step 3 + 4 merged; concurrency contradiction with
    Risk-tier gate ladder fixed).
  - `concern:governance` triple-routing disambiguated (enforcement → architect,
    customer-facing → document-writer, in-prompt policy → architect).
- **Slim-down:**
  - Composition formula section deleted (scaffolding noise lead misread as a
    load instruction).
  - Pre-dispatch decomposition table merged into Step 3 quick-pick.
  - Triple-repeated rules (artifact write, production-promotion approval)
    consolidated to single source of truth.
- **Agent primacy + Task tracking:**
  - Frontmatter `tools: [Agent, Bash, Read, Grep, Glob, Skill, ToolSearch,
    TaskCreate, TaskUpdate, TaskList, TaskGet]` — `Agent` at position 0
    telegraphs dispatch primacy.
  - Identity emphasis: "Your primary tool is Agent. 5+ Reads without an
    Agent dispatch in between → you're acting as an implementer; stop and
    dispatch."
  - New `## Task tracking` section — Task* tools as dispatch ledger. One Task
    per planned dispatch with `blockedBy` for dependencies (reviewer blockedBy
    builder; integrator blockedBy builder-be + builder-fe; deployer blockedBy
    validator). `TaskList` enforces dispatch budget visibility, SLA cap counts,
    and cross-slice followup persistence.
  - Pre-done checklist gained `TaskList` zero-`in_progress` as first mechanical
    check.

### Backlog (filed for follow-up)

- **FEAT-158** (P1, autonomous_safe=false): move embedded policy out of lead.md
  into `skills/workflow/`. OpenAI weak point #1 ("too much embedded policy",
  -0.5 score impact). Target: lead.md ≤ 200 lines.
- **FEAT-159** (P2, autonomous_safe=true, depends_on FEAT-151): rolling
  per-agent stats aggregator (learning loop) over Phase 1 telemetry. OpenAI
  weak point #4.
- **FEAT-160** (P3, autonomous_safe=false): capability registry built from
  agent frontmatter (consumer for this release's capability metadata). OpenAI
  weak point #2.

### Docs

- New `docs/standards/agent-capabilities-schema.md` — capabilities block schema,
  roles, surfaces, stacks, concerns, scopes, lens, priority, selection algorithm.
- New `docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md` — 2-3×
  slice speedup spec covering Phase 1 telemetry + Phase 2 cuts.
- New `docs/superpowers/plans/2026-06-11-slice-perf-2x-3x.md` — task-by-task
  TDD plan for FEAT-149/150/151 (delivered in this release) and FEAT-152/154/156
  (Phase 2, gated on baseline).

### Notes

- Memory: `feedback_lead_dispatch_mandate.md` and `feedback_model_assignments_done.md`
  saved during this release cycle; full list in user memory index.
- 1 pre-existing flake `projects-root-override` remains; out of scope.

## v0.32.0 — 2026-06-11 — hook runtime swap (node → bun) + agent scope discipline

### Performance

- **Hook runtime swap:** PreToolUse / PostToolUse hook entries now spawn under Bun
  (≥ 1.3) instead of `node --experimental-strip-types`. Measured cold start dropped
  from ~178 ms to ~40 ms on Linux (~80 ms on Windows). Hook cores at
  `hooks/lib/*.ts` are byte-identical (SLICE-67 contract); `tests/hook-feature-gating.test.ts`
  green unchanged.
- **log_event.sh async-fire:** payload + `events.jsonl` writes now run in a backgrounded
  subshell. Foreground latency dropped from ~113 ms to ≤ 20 ms p95 on Linux. On Windows
  the Cygwin bash floor (~57 ms) limits the absolute floor; the bench still verifies
  p95 stays well under the synchronous baseline.

### Tooling

- **Bun preflight:** `scripts/lib/installer/bun-preflight.ts` (`assertBunPresent`) is
  wired into the `install-global`, `bootstrap`, and `init` entries in `scripts/crew.ts`.
  Missing or sub-1.3 Bun → loud failure with the bun.sh install URL.
- **CI matrix:** `.github/workflows/test.yml` runs on `ubuntu-latest` + `windows-latest`.
  New `bun-hook smoke` step pipes empty JSON into `hooks/check-redundant-read.ts` on
  each runner.

### Tests

- `tests/hook-cold-start-bench.test.ts` asserts p50 ≤ 60 ms / p95 ≤ 120 ms (Linux) and
  p50 ≤ 120 ms / p95 ≤ 250 ms (Windows, load-aware) over 100 cold spawns. Selectable
  runtime via `HOOK_BENCH_RUNTIME` env.
- `tests/log-event-async-bench.test.ts` asserts foreground p95 ≤ 20 ms (Linux) or
  < 300 ms (Windows) over 100 invocations.
- `tests/bun-preflight.test.ts` covers the installer preflight (happy path + missing bun
  with PATH strip).

### Docs

- `README.md` adds a Runtime dependency callout under the install steps, noting Bun
  ≥ 1.3 is required at install time.

### Agent prompts

- **Validator + reviewer scope discipline:** UI/UX/a11y validation routed to
  `crew:qa-expert` via `escalated_to_lead` instead of validator/reviewer driving
  Playwright / `gstack /qa` directly. Validator owns non-UX gates only;
  reviewer keeps the static `.tsx`/`.jsx` a11y code-review gate. Openings
  rewritten to name the lead/orchestrator dispatch + verdict-consumer
  relationship, the read-only constraint, the decision enum
  (`approved|approved_with_notes|rejected`, `passed|passed_with_notes|failed`),
  and gate-not-courtesy stakes. Three `mark-badge` examples per agent
  collapsed into one template + bullet list of valid badges. Stale
  `surface:ui → /qa DISABLED` blurb dropped from validator's gstack section;
  redundant `webapp-testing` always-on preamble + UI rows dropped from the
  skill-consultation table.

### Fixed

- `init` / `bootstrap` / `install-global` no longer print a `[<cmd>] bun X
  detected.` notice to stdout. The notice polluted JSON stdout and broke
  downstream `JSON.parse` consumers (including `tests/cli-smoke.test.ts`).
  Preflight remains loud-fail on missing or sub-1.3 Bun; success is silent.

## v0.31.1 — 2026-06-10 — repair stale content-snapshot tests + validator hardening

### Added

- **Validator orchestrator hardening** (commit cfe26e7 + validation
  modes extension): `disallowedTools: NotebookEdit` added to frontmatter;
  Golden Path 5-step framing (Frame → mandatory final gate → scenarios →
  evidence → decide); SLA cap (max 2 re-runs of the same scenario before
  escalating); env guard on every bash block; `jq` dependency dropped
  from stub artifact emission; `validation-result` is now the sole
  completion artifact (separate `write-handoff` call removed). New
  `## Validation modes` table (Final readiness vs Scenario verification)
  — both modes end at the same bar (full gate green + ACs covered before
  PASS) but differ in ordering for cost. Environment-blocked path made
  explicit: `passed` is never permitted when a gate or AC was skipped.

### Fixed

- **6 content-snapshot tests went stale across the unreleased agent
  refactors** (commits `c34523a`, `f81637e`, `f3aadb5`, `0a8acb4`,
  `cfe26e7`, plus this session's self-verify-gate skill extraction). CI
  was red on `v0.31.0` despite local validators + the typecheck / lint
  / format suite passing. Tests updated to track content's new
  canonical home:
  - `agent-prompt-content.test.ts`: builder self-verify assertions
    (`Affected-class tests only`, `Deferred to validator`) moved from
    `agents/builder.md` → `skills/workflow/self-verify-gate/SKILL.md`.
  - `agent-prompt-content.test.ts`: `lead.md contains write-handoff
    instruction` replaced with `references the handoff artifact in the
    workflow` — lead is orchestrator-only per the Golden Path refactor
    (commit f3aadb5) and no longer calls `write-handoff` directly.
  - `builder-be-prompt.test.ts`: per-stack BE test runner assertion
    moved to `skills/workflow/self-verify-gate/SKILL.md` along with
    the procedure itself.
  - `orchestrate-slice.test.ts`: `## Contract artifact schema section`
    section assertion dropped — the section was folded into the
    architect's `Output contract` per commit `bc96c8f`. Three-file
    OpenAPI shape assertion retained as a standalone test.
  - `validate-agents.test.ts`: line-cap test updated 500 → 350 to
    match the new `MAX_LINES = 350` default in
    `scripts/validate-agents.ts`.

No agent prompt or skill content change — tests only.

## v0.31.0 — 2026-06-10 — orchestrator hardening + production-ready builders + shared self-verify skill

### Added

- **NEW skill `self-verify-gate`** (`skills/workflow/self-verify-gate/SKILL.md`).
  Authoritative procedure for builder agents' scoped pre-handoff
  verification — slice-base resolution, touched-set derivation, per-stack
  typecheck / lint / affected-tests / repo-validator recipes, and the
  PASS / FAIL / SKIPPED / TIMEOUT state model. Three builder prompts
  (`builder`, `builder-fe`, `builder-be`) reference it instead of
  duplicating ~30 lines of self-verify procedure each.
- **`write-handoff-and-bundle` CLI command** (`scripts/crew.ts`). Merges
  `write-handoff` + `write-build-bundle` into one call. Auto-resolves
  slice id from `workflow-state.json`, auto-generates the ISO timestamp,
  defaults `from` / `to` / `status`. Bundle write is non-blocking —
  returns `{ handoff, bundle, bundleError }`. Removes the `jq` dependency
  and the POSIX-only `$(date -u +...)` portability trap.
- **Production-ready content on all three builder prompts.**
  `## Safety` (credential / token rules, never `--no-verify`, secrets-
  in-scope blocker), `## FEAT frontmatter` (read `autonomous_safe` /
  `surface:*` / `stack:*` / `concern:*` before starting), `## Pre-
  completion secret grep` (diff scan for AKIA / sk- / api_key /
  password / connection-string patterns), `## Prior handoff extraction`
  (read `## Repo Layout` + `--risks` + Self-Verify FAIL state before
  exploring), `## Commit discipline` (echo constitution `dev.stable`
  rules), edge-case checklists for net-new behavior, feature-flag
  gating, FE `## Performance budgets` (LCP / INP / CLS targets + 30 KB
  chunk delta) + `## Observability emit` (ErrorBoundary + performance
  marks), BE `## Migration safety` (expand-contract pattern + reversible
  migrations + chunked backfill + deferred FKs), BE `## Performance
  budgets` (p95 + per-request DB query budget + N+1 grep), BE
  `## Observability emit` (request id propagation + `/health` `/ready`
  `/metrics`).

### Changed

- **Stub artifact ceremony removed** from all builders + reviewer.
  Builder agents previously wrote a `--status in-progress` handoff at
  start and overwrote it via `--update <stub>` at completion. No
  downstream consumer reads in-progress stubs; the `--update` flag is
  optional in `scripts/crew.ts`. Builders now write a single handoff
  at completion. Reviewer's `### Stub at start` block also removed —
  `review-result` IS the completion artifact (no duplicate handoff
  trail). `agents/builder.md` 304 → 258 lines; `builder-fe.md`
  221 → 242 (net +21 after production-ready adds); `builder-be.md`
  219 → 243 (net +24); `reviewer.md` ~314 → 284.
- **FE + BE builder prompts unified on production seams.**
  `agents/builder-fe.md` + `agents/builder-be.md` now have
  `disallowedTools: Agent` frontmatter (was missing — could spawn
  sub-agents and hang), `## Tool restrictions` section mirroring
  `builder.md`, env guard (`: "${CLAUDE_PLUGIN_ROOT:?must be set}"`)
  on workflow-badges block, and unified `write-handoff-and-bundle`
  completion (was two separate `write-handoff` + `write-build-bundle`
  calls).
- **Context-ceiling thresholds unified.** All three builders now at
  50 tool uses / 100k context tokens (was 60 / 100k builder, 40 / 80k
  FE + BE).
- **Self-verify gate state model** extended from `PASS / FAIL` to
  `PASS / FAIL / SKIPPED / TIMEOUT`. FAIL halts the builder;
  SKIPPED and TIMEOUT proceed with the validator picking up the
  deferred check on the final gate.
- **Orchestrator boundaries hardened.**
  - `lead.md` (commits f3aadb5, 6017cb2): `disallowedTools: Edit +
    NotebookEdit` (Write was already blocked); Golden Path 7-step
    framing; risk-based tier table (LOW / MEDIUM / HIGH) replaces
    line-count tier; SLA caps on builder / reviewer / validator
    dispatch loops to prevent infinite-fix cycles; routing-table drift
    fixes (`stack:csharp` + `stack:react` correctly routed; dead
    copywriter agent → `loop:document-writer`); operating rules
    12 → 6. 332 → 290 lines.
  - `architect.md` (commits f81637e, bc96c8f): Golden Path 6-step +
    Write boundary (allowed: `designs/`, ADRs, design-surface prompts;
    forbidden: product code, other agent prompts, tests,
    `package.json`); SLA caps (max 2 design revisions before
    escalation); Agent dispatch restricted to design specialists
    (`database-architect`, `cloud-architect`, `architect-reviewer`,
    `critical-thinking`, `crew:researcher`); 5-column Build Sequence
    table (Phase / Files / Change type / AC / Validation command);
    per-artifact validator matrix; PASS/FAIL timing fix; skill cap
    5 → 4; design size tiers (Small / Medium / Large) for
    right-sized output.
  - `reviewer.md` (commit 0a8acb4): `disallowedTools: NotebookEdit`
    added (Jupyter cell gap closed); `jq` dependency dropped; env
    guard on every bash block; `review-result` is the sole completion
    artifact (separate `write-handoff` call removed); scoped pre-flight
    (audit + secret grep on changed files only, not repo-wide);
    lens-mode explicit SKIP rule for out-of-lens gates unless CRITICAL
    severity; 298 lines.
- **Badge rename** `escalated_to_human` → `escalated_to_lead` across
  `scripts/crew.ts`, `scripts/lib/workflow-state.ts`, 8 agent prompts,
  `CLAUDE.md`, `docs/architecture/architecture.md`, and 2 test files.
  Historical artifacts left untouched.
- **Agent prompt cap reduced** 500 → 350 lines (default; per-agent
  `maxLines` overrides preserved for `lead`, `reviewer`). Enforced by
  `scripts/validate-agents.ts`.
- **Skill consultation defaults** for all 3 builders: 1–2 skills
  default, soft cap 3, hard cap 5. Slice that genuinely needs a 6th =
  too wide; split or escalate.

### Fixed

- **Broken anchors / stale step references in `builder.md`.**
  `[scope fallback chain](#scope-discipline)` resolved by adding the
  matching heading; `step 4` reference (only 2 steps exist) corrected;
  stale "moved to Start sequence steps 2–3" breadcrumb deleted.
- **Self-verify "must exit 0" contradiction** with documented TIMEOUT
  escape on typecheck — replaced with explicit PASS / FAIL / SKIPPED /
  TIMEOUT state model.
- **Light-vs-mandatory-handoff contradiction.** `## Handoff before
  stop` previously claimed "all require write-handoff", contradicting
  the `size: light → no handoff` rule. Now scoped: standard tasks
  require handoff; light tasks return inline only.

### Removed

- **Stub artifact emission** sections from all four agents
  (`builder.md`, `builder-fe.md`, `builder-be.md`, `reviewer.md`).
  Single completion-only artifact write per dispatch.

### Notes

- `--update` flag stays in `scripts/crew.ts` for backwards
  compatibility — consumer repos that still pass it continue to work.
- `commands/orchestrate-slice.md` still hard-gates on
  `## Self-Verify Gates` showing PASS for every gate; format
  unchanged.
- Bundle artifact (`write-build-bundle` output) retained — consumed by
  reviewer's "Read build bundle first" optimization (saves file Reads
  in the review phase).

## v0.30.4 — 2026-06-10 — hook-core extraction + builder scoped self-verify

### Changed

- **FEAT-146 — Hook-core extraction (in-process testable hooks).** The 4
  per-tool hooks (`check-redundant-read`, `check-subagent-return`,
  `record-read-content`, `preflight-shell`) now expose their flow as a core
  `run<Name>Hook(raw, env) -> Promise<string|null>` in `hooks/lib/<name>.ts`;
  entry files are thin shims with byte-identical stdout/exit. Spawn-based
  tests (~120) converted to in-process core imports, leaving a few retained
  spawn smokes per hook; `tests/hook-feature-gating.test.ts` stays fully
  spawn-based as the runtime-contract proof. Removed a mid-flow
  `process.exit(0)` from the record-read core (repo rule 6). Suite stays
  611 pass / 0 fail.
- **FEAT-148 — Builder self-verify scoped to touched files.** `builder.md`,
  `builder-fe.md`, `builder-be.md` self-verify gates now run a **scoped lint**
  on changed/added paths only (Node `bun run lint`, C# `dotnet format`,
  Python `ruff`) and make the touched set explicit and shared:
  `git diff --name-only <slice-base>` (staged+unstaged). `typecheck` stays
  whole-project (tsc not cheaply scopable). Whole-repo lint/format + full
  suite remain the validator's final gate (DEC-014 unchanged).

## v0.30.3 — 2026-06-10 — bun swap completed in skills + stack config

### Fixed

- **Skills + `loop.json` stack now use bun.** The v0.30.1/0.30.2 swap only
  touched agent prompts, but builders/validators read gate commands from
  `.claude/loop.json` `stack.build` / `stack.test` **first** (canonical source);
  those were still `npm`, so consumers kept running npm despite the prompt
  changes. Swapped test/lint/build gate commands to bun across 12 skills
  (advisory Common-Commands blocks, `workflow/commit`, `fix-pr`,
  `reviewing-code`, `systematic-debugging`, `js-conventions`,
  `node-ts-patterns`) and this repo's `loop.json` stack
  (`build` → `bun test --parallel`, `test[0]` → `bun run lint`). Test runs use
  `bun test --parallel` per the ADR-002 amendment.
- **`loop.json` validator path bug.** `stack.test` referenced
  `./scripts/validate-{manifests,skills}.mjs`, but the files are `.ts` — the
  gate failed with `MODULE_NOT_FOUND`. Pointed at `.ts`.
- **`.claude/loop.json` preset wired.** Added `preset: typescript-plugin-dev`
  so `resolve-skills` resolves PM/role skills instead of falling back to the
  regex baseline.

### Changed

- **CI workflow + CLAUDE.md aligned to bun.** `.github/workflows/test.yml` and
  the CLAUDE.md "Local commands" / "CI gates" sections now invoke
  `bun run lint` / `format:check` / `typecheck` / `test` (and `e2e:smoke:ux`).
  `npm ci` (dependency install) and all `node ./scripts/*.ts` validators/CLI
  stay on Node — the consumer runtime per ADR-002. Bun runs only the
  package-script test/lint/format/typecheck surface.

## v0.30.2 — 2026-06-10 — --parallel on direct bun test calls

### Fixed

- **Direct `bun test` calls now pass `--parallel`.** `builder.md` (affected-class
  inner loop) and `validator.md` (fallback test command) invoke `bun test`
  directly, bypassing the `npm test` script — so they did not inherit its
  `--parallel` flag. Per the ADR-002 amendment, Bun's parallel-worker mode is
  required for full `node:test` subtest compatibility; the single-process path
  raises subtest `NotImplementedError`. Both call sites now use
  `bun test --parallel`.

## v0.30.1 — 2026-06-10 — Agent prompts aligned to bun tooling

### Changed

- **Agent quality-gate instructions now invoke bun directly**, matching the
  v0.30.0 bun-test decision:
  - `builder.md`, `builder-fe.md`: `npm run typecheck` → `bun run typecheck`;
    affected-class inner loop `node --test` → `bun test`.
  - `validator.md`, `reviewer-validator.md`: full-gate `npm run lint` /
    `format:check` / `validate:all` → `bun run …`; fallback test `node --test`
    → `bun test`; `npm run test:be` / `test:fe` → `bun run …`.
  - `reviewer.md`: dependency CVE check `npm audit` → `bun audit`
    (Bun 1.3.14 ships it).
  - `3rdparty/playwright-tester.md`: `npx playwright test` →
    `bunx playwright test` (launcher swap; Playwright runner still executes on
    Node underneath).
- **Harness CLI invocations left on Node.** ~120 `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" …`
  / `loop.mjs` / `node -e` calls across `agents/` + `commands/` deliberately
  stay on Node — consumer-runtime surface unchanged per the ADR-002 hybrid.

### Added

- `.claude/artifacts/crew/runs/2026-06-10-bun-node-tooling-audit.md` — full
  npm/node/npx inventory across agents + commands, with migration scope and a
  point-in-time Bun-vs-Node performance analysis.

## v0.30.0 — 2026-06-10 — Bun test runner for dev/CI (WS3 amended)

### Changed

- **Bun test runner (dev/CI).** `npm test` now runs `bun test --parallel --timeout 30000` on both local dev and CI; 611 tests in ~16.5s vs 21.1s under node (~22% faster); full `node:test` compat maintained in parallel-worker mode; node remains the ONLY consumer runtime (hooks/CLI unchanged).
- **Node fallback.** `npm run test:node` runs the original `node --test --experimental-strip-types` for environments where Bun is not available.
- **CI workflow.** `.github/workflows/test.yml` now installs Bun via `oven-sh/setup-bun@v2` before the test step; all other steps unchanged.
- **ADR-002 amendment.** Spike re-run with `--parallel` overturned criterion 1 (subtest NotImplementedError affects only Bun's single-process runner path; two prior "failures" were 5s default-timeout artifacts). Amendment reflects the production-ready parallel stability.

## v0.29.1 — 2026-06-10 — light-tier hardening: registry fallback + namespace map

### Changed

- **Registry fallback for light-tier dispatch.** `orchestrate-slice.md` + `lead.md`:
  when `crew:reviewer-validator` is not in the session agent registry ("Agent type
  not found" — session predates the plugin refresh, or consumer mid-upgrade), the
  dispatch falls back to the concurrent full ladder (separate reviewer + validator)
  instead of erroring; gates are never skipped; fallback noted in the run brief.
- **Decision-record namespace map in reviewer-validator.** Gate prompts now
  distinguish loop-owned `.claude/artifacts/loop/decisions/DEC-NNN` (minted by
  grade-write; reject hand-authored DEC ids) from authored
  `docs/architecture/decisions/ADR-NNN-<slug>` (where ADR deliverables belong)
  and legacy `docs/decisions/` (template/README only). Prevents the SLICE-65
  collision class.

## v0.29.0 — 2026-06-10 — WS2 ceremony restructure: concurrent gates + templated artifacts

### Changed

- **Concurrent gates (reviewer + validator).** After builder PASS, `lead` dispatches
  `crew:reviewer` and `crew:validator` subagents simultaneously rather than
  sequentially (commands/orchestrate-slice.md rewrite). Conflict rule: reviewer
  `needs_fix` badge marks validation stale; fix bounce runs full ladder. Pilot
  evidence: concurrent gate wall 5.2 min vs ~9.7 sequential; slice ceremony
  11.6 min vs ~43 min baseline.
- **Merge-safe workflow-state mutations.** New exclusive-create advisory lock
  (`.claude/state/crew/workflow-state.lock`) guards all workflow-state
  mutations: 5s acquire timeout with 10ms backoff, stale locks older than 10s
  reclaimed (crashed-writer recovery). New `validation_stale` badge added when
  reviewer needs_fix invalidates prior validation.
- **Templated artifact scaffolds.** `write-review-result` and
  `write-validation-result` commands now support `--scaffold` flag for
  deterministic empty skeletons, finalized via `--update` (enables delegated
  review/validation handoff where lead pre-creates structure, reviewer/validator
  fills content). Scaffold template: headers + empty sections per lens.
- **Light-tier fast path (misclassified escapes).** New `isLightTier()`
  classification: docs-only or ≤50 changed lines (per `loop.json`
  `lightTier.maxChangedLines`) with no hook/manifest changes. Light slices
  dispatch `crew:reviewer-validator` (combined read-only agent) instead of
  separate reviewer/validator. Misclassification guard: `needs_fix` on a light
  slice escalates the fix bounce to the full ladder. `--tier` flag on
  `write-run-brief` records the classification.
- **Parallel-runner safety (FEAT-136 / SLICE-64).** `/crew:parallel` dispatches
  `crew:lead` per worktree with shared-state conflict resolution (guard-feat-dispatch
  resolved). Parallel-runner scoped to non-FEAT work by default; FEAT work
  requires explicit coordination (DEC-015).
- **e2e-smoke test coverage.** 3 new scriptable scenarios: `scaffold-update`
  (write-review-result lifecycle), `tier-classification` (light vs full ladder),
  `validation-stale-flow` (reviewer needs_fix invalidates validation). Fixed
  `wakeup.mjs` frontmatter-title extraction to handle spec paths.

## v0.28.1 — 2026-06-10 — slice-pipeline speedup WS1: test suite 115.9s → 21.1s

### Changed

- **In-process `runCrew()` entry point exported.** `scripts/crew.ts` now exports
  an async `runCrew(argv, opts): Promise<{code, stdout}>` function for in-process
  test invocation, guarded by `isDirectRun` check to preserve CLI subprocess
  behavior unchanged. Eliminates per-test subprocess spawn of 85-file script graph
  (the 17–23s bottleneck in `tests/cli.test.ts` on test isolation).
- **Test suite split by command family.** `tests/cli.test.ts` split into
  per-family files (`cli-claims.test.ts`, `cli-approvals.test.ts`,
  `cli-artifacts.test.ts`, `cli-synthesis-cost.test.ts`, `cli-workflow.test.ts`)
  + `cli-smoke.test.ts` for 5 process-level spawn smokes per command family.
  Shared assertions extracted to `tests/helpers/cli-fixtures.ts`. Enables
  `node --test` parallelization across cores.
- **Test suite performance baseline reset.** Full test suite: 115.9s → 21.1s
  (-82%), 589 tests. (WS1 goal: 116s → <30s; landed at 21.1s via in-process
  architecture. Interim node-only target before WS3 Bun swap.)
- **`CREW_PROJECTS_ROOT` env override for session-cost scanner.** `tests/`
  fixtures no longer scan the user's real `~/.claude/projects/` during test
  runs. Tests now set `CREW_PROJECTS_ROOT=<tmpdir>` or use a sandboxed path.
  Prevents cost-scanner integration tests from measuring real hook costs.

### Fixed

- **FEAT id pattern aligned to `^FEAT-\d{3,}[a-z]?$` in unique-id check.**
  `scripts/validate-loop-state.ts` now includes suffixed ids (e.g., `FEAT-133a`)
  in the uniqueness check. Previous logic only captured `FEAT-NNN` (no suffix);
  suffixed ids escaped duplicate detection.

## v0.28.0 — 2026-06-10 — gate rebalance: scoped builders, validator owns full gate

### Changed

- **Builders go scoped (fast inner loop).** `builder`, `builder-be`, and
  `builder-fe` self-verify gates no longer run whole-repo lint, `format:check`,
  or the full test suite. They run `typecheck` + **affected-class tests only**
  (per-stack native: `node --test` on colocated siblings, `vitest related`,
  `dotnet test --filter`, `pytest <files>`). Each handoff now emits a
  `## Deferred to validator` line naming the affected set. Cuts the full suite
  from running up to 3× per slice (be + fe + builder) to **once**.
- **Validator owns the mandatory full gate.** `validator` now runs the
  whole-repo lint, `format:check` (check-only — read-only agent bounces
  formatting fixes to the builder), the complete test suite (`loop.json`
  `stack.build` + `stack.test`), and `validate-all` first, every slice. The
  validator is **no longer skippable** — even code-only diffs run it, since it
  is the only always-on home for the full suite. Supersedes the FEAT-030
  reviewer-bundled-validation skip (`--validation-evidence` note removed from
  `reviewer.md`; the CLI flag remains, unused, for back-compat).
- **Reviewer fan-out by lens + affected-test backstop.** `lead` may dispatch
  N parallel `crew:reviewer` subagents, one per `Review lens:`
  (correctness/regression, security, performance, tests-adequacy) plus
  stack-idiom via `crew:typescript-reviewer` / `c-sharp-reviewer`.
  Each reviewer re-runs the builder's affected-class set to confirm it covers
  the changed classes (the full suite still runs at the validator gate).

## v0.27.0 — 2026-06-10 — loop↔crew state contract: single-tree migration

### Changed

- **Single authoritative loop-state tree.** Consumes loop v0.36.0's state
  contract. The backlog tree migrated from `docs/backlog/` into
  `.claude/artifacts/loop/backlog/` via `loop doctor --fix` (no FEATs left in
  the legacy tree), and the `docs/ai-loop/` tree (slices, `00-entry`,
  `01-loop-control`, backlog control docs) collapsed into the default
  `.claude/artifacts/loop/ai-loop/`. The `backlogRoot`, `backlogPath`,
  `slicesRoot`, and `aiLoopRoot` path overrides were removed from
  `.claude/loop.json` — loop defaults now apply. `CLAUDE.md` loop-start refs
  repointed to the new locations.

### Added

- **`scripts/validate-loop-state.ts`** — CI hard gate enforcing a single
  populated backlog tree with unique FEAT ids (a thin local sibling of
  `loop doctor --check`, since CI runners have no plugin cache). Wired into
  `.github/workflows/test.yml`.

### Fixed

- **`validate-contracts`** no longer runs the drift-check when lint fails,
  unbreaking negative-fixture CI (FEAT-138).

### Closed

- FEAT-144 (reconcile dual backlog trees), plus FEAT-120/029/127/128/138.

## v0.26.0 — 2026-06-10 — researcher quality wave + green CI baseline

### Added

**Researcher quality stack**

- `skills/workflow/code-investigation/` — 4-phase investigation methodology
  (clarity gate → investigation brief → evidence ladder → mode-shaped output)
  with stack first-check references: `csharp.md` (TFMs, sync-over-async, DI
  lifetimes, nullability), `typescript-react.md` (tsconfig strictness,
  type-escape hatches, ref-identity re-renders), `plugin-dev.md` (manifest
  drift, trigger quality, routing consistency), `spec-driven.md`
  (spec-readiness rubric for `/crew:architect-feature` pre-flight).
- `agents/investigator.md` — read-only code locator promoted from
  `agents/caveman/cavecrew-investigator.md` to first-class crew agent.
  Cheapest dispatch on the team (haiku, compressed output, no handoff
  artifact); adds zero-hit naming-variant discipline and an escalation
  refusal pointing at `crew:researcher` for graded, persisted findings.

**Language quality stacks**

- C#/.NET: deep quality skills, `c-sharp-pro` expert agent, and
  `c-sharp-reviewer` specialist with reviewer routing.
- TypeScript: TS quality skills, `ts-reviewer` specialist with reviewer
  routing.
- `performance-engineer`: profiling methodology, TTFB/FCP/RUM web vitals,
  load ladder, React-specific routing.
- `uxdesigner`: design-quality gate + frontend-design craft references.

**Specs**

- `docs/specs/` — loop-crew state contract design (phase 1 state unification).

### Changed

- `agents/researcher.md` — moved to sonnet (per lead delegation economics);
  added clarity gate, 4-grade evidence ladder with file:line citation
  mandate (`UNVERIFIED` is a first-class low-confidence answer), per-mode
  output formats (hypothesis grid / trade-off matrix / spec pre-flight
  blocks), and read-only Bash scope.
- `agents/lead.md` — Explore-vs-researcher dispatch boundary: cheap locate
  whose answer dies with the turn vs findings that must persist as a handoff
  artifact.
- `docs/routing-table.md` — new Research rows (codebase investigation, spec
  pre-flight); reviewer-phase rows for the C#/TS specialists.
- `docs/governance.md` — agent prompt size bar reconciled with the validator:
  500-line default + per-agent `maxLines:` frontmatter override.

### Fixed

- **CI pipeline unbroken** (red since the v0.25.0 release push; four
  failures stacked behind the first red step):
  - contracts drift gate — prettier had reformatted the generated
    `valid-feat-contracts.ts` fixture so it could never byte-match the
    `openapi-typescript` output; added `.prettierignore` for generated
    contracts fixtures and recommitted generator output.
  - `scripts/validate-agents.ts` committed unformatted.
  - stale tests — agent roster missing `qa-expert` / `performance-engineer` /
    `investigator`; line-cap test still asserting the old 300 default; new
    test covers the `maxLines` override.
  - routing-table skill-ID gate now `continue-on-error` per its documented
    advisory intent (external-plugin IDs cannot resolve on a bare runner);
    fixed the two real agent-block drift errors (builder ←
    `skills/domain/mcp-integration/`, architect ←
    `skills/domain/api-architecture/`).
- `agents/lead.md` artifact table restored the hyphenated `final-synthesis`
  artifact name asserted by the prompt-content test.

### Removed

- `agents/caveman/` trio (`cavecrew-builder`, `cavecrew-reviewer`,
  `cavecrew-investigator`) — investigator promoted to first-class (above);
  reviewer-collision mitigation in repo docs rewritten as resolved history,
  with the exact-name `crew:reviewer` dispatch rule retained as durable
  defense.

## v0.25.0 — 2026-06-09 — autonomous crew enrichment wave

### Added

**New first-class crew agents**

- `agents/qa-expert.md` — QA and test-quality specialist: coverage analysis,
  Given/When/Then scenario design, behavioral verification, regression risk,
  release readiness, defect classification, test-pyramid health (70/20/10
  target), and anti-flakiness review.
- `agents/performance-engineer.md` — Performance analysis specialist: profiling,
  bottleneck identification, load-testing types (load/stress/soak/spike),
  capacity planning, and SLO-aligned recommendations.

**New `agents/3rdparty/` agents (hero-crew)**

- `flutter-ui-developer.md` — Flutter/Dart UI specialist (widget architecture,
  Riverpod/BLoC, go_router, Material 3, a11y, 60fps).
- `critical-thinking.md` — Read-only devil's advocate: surfaces hidden
  assumptions one question at a time; no solutions offered.
- `architect-reviewer.md` — Independent architecture review (service boundaries,
  scalability, coupling, security architecture); distinct from `crew:reviewer`.
- `test-automator.md` — Test-suite implementation specialist (test pyramid,
  anti-flakiness rules, CI integration, coverage thresholds).
- `playwright-tester.md` — MCP-first E2E test writer: explores live app via
  browser MCP, maps user flows, writes Page Object Model Playwright tests.

**New `agents/3rdparty/` agents (loop)**

- `sdd-spec-writer.md` — SDD spec authoring for agent/human dispatch decisions
  (implementation contract, agent-vs-human decision table, quality checklist).
- `specification.md` — Formal 10-section technical spec writer (Purpose,
  Requirements REQ/SEC/CON/GUD, Data Contracts, AC Given-When-Then, Test
  Strategy, Rationale, Dependencies, Examples, Validation).

**New skill**

- `skills/domain/microservices-patterns/SKILL.md` — Circuit breaker, saga
  (choreography/orchestration), DLQ/idempotency, distributed tracing
  (OpenTelemetry/W3C Trace Context), service discovery, API gateway; 11-point
  Done criteria.

### Changed

- `crew:parallel-runner` now delegates worktree creation, prompt augmentation,
  Agent batch construction, marker-based result aggregation, and priority-ordered
  merge to the loop plugin's hierarchical-dispatch primitive
  (`node <loop-cli> dispatch prepare|finalize`). The agent prompt becomes a thin
  orchestrator: build a dispatch plan, call `prepare`, invoke the Agent batch,
  call `finalize`. **Requires loop plugin >= v0.32.0** (which introduced the
  dispatch CLI in FEAT-020 SLICE-1). Earlier loop releases will fail at the
  pre-flight `dispatch --help` check with a clear upgrade instruction.

  This eliminates ~60% of the duplicated worktree+merge logic that previously
  lived in the agent prompt. Telemetry surfaces (worktrees.jsonl, trace.jsonl,
  per-child result markers, summary.md) now flow through loop's
  `.claude/artifacts/loop/dispatch/<runId>/` namespace, unblocking FEAT-165
  (per-skill cost attribution) and FEAT-133 (budget enforcement).

- `agents/architect.md` — Pre-design analysis section (grep existing patterns
  first, summarize in `## Patterns Found`); Build Sequence rule for phased
  designs.
- `agents/lead.md` — Parallel dispatch patterns table (scatter-gather,
  sequential, fan-out review) with failure-handling rules.
- `agents/builder.md` — Start-acknowledgement enrichments: assumption
  documentation, edge-case identification, and named technical-debt tracking.
- `agents/builder-be.md` — Microservices routing row
  (`skills/domain/microservices-patterns/`) + 3 production readiness
  self-verify checks (reversible migrations, no hard-coded config, metrics
  endpoint presence).
- `agents/refactor.md` — Dead-code added as 4th concern area (reference-graph
  detection, dynamic-usage safety, framework-preservation rules, rollback on CI
  fail); simplification-balance guardrail (no nested ternaries or dense
  one-liners).
- `skills/domain/dotnet/csharp-conventions/SKILL.md` — CQRS + Event Sourcing +
  BDD section (MediatR pipeline, EF Core projections, aggregate-root pattern,
  domain event publication, SpecFlow/xUnit BDD style).

## v0.24.1 — 2026-06-08 — wire review_rebound_count consumer

### Fixed

- `review_rebound_count` (added to the grade template in v0.24.0) now flows through `collectOutcomeLinkage` into every `cost-report-slice` and `cost-report-aggregate` artifact under `outcome.reviewReboundCount`. Previously the field was dead telemetry — written to the grade but never read. Rolling-window analysis of the build-bundle quality-win hypothesis (median rebound count over the last 10 slices) can now run against the existing cost-report artifact stream without further schema changes. New parser rejects negative or non-numeric values.

---

## v0.24.0 — 2026-06-08 — build-bundle context preloading for reviewer/validator

### Added

- Build bundles: every builder variant (`builder`, `builder-be`, `builder-fe`) writes a `.claude/artifacts/crew/bundles/{slice}/{builder}-{runId}-build-bundle.md` artifact on completion containing handoff body, `git diff`, touched-file contents, and read-file contents. `/crew:review` and `/crew:validate` inline the latest bundle into reviewer/validator dispatch prompts under a `## Builder context (preloaded — do not re-Read these files)` header, preloading the builder's working set so downstream agents skip re-Reads. Schema documented at `docs/standards/build-bundle-schema.md`. Hard CI gate: `scripts/validate-bundles.ts`. `brief-me` surfaces per-slice write/malformed/size-cap counts. Grade template gains `review_rebound_count` field for measuring the quality-win hypothesis over a rolling 10-slice window. Tracks first stealable from the agent-crew competitor matrix (`.claude/artifacts/crew/research/20260608T220200Z-competitor-matrix-agent-crews.md`).

---

## v0.23.0 — 2026-06-08 — refactor agent, ESLint ratchet, diagram POC, builder plugin-dev wiring

### Added

- **feat(crew:refactor):** New first-class quality-sweep agent — scans for stale refs, complexity cap violations, and manifest consistency drift; fixes directly; writes `.claude/artifacts/crew/quality/` artifact before committing. Hard stop at >20 files. Skills routing: 10-entry trigger-condition table covering full-stack consumer repos (TS, React, C#, SQL, Python) with `reviewing-code` safety gate.
- **feat(FEAT-123):** Diagram authoring POC — auto-pick decision tree in `diagram-methodology` skill; 7 Mermaid template stubs (C4×2, sequence, ERD, state, flowchart, ADR); new `skills/workflow/diagram-review/` skill covering syntax/slop/clarity; routing-table row.
- **feat(FEAT-125):** plugin-dev review skills formally wired into `crew:reviewer` — `plugin-dev:plugin-validator` required on plugin shape changes, `plugin-dev:skill-reviewer` required on skill shape changes.
- **feat(builder):** plugin-dev skills wired by file pattern — `agents/*.md` → `plugin-dev:agent-development`, `skills/**/SKILL.md` → `plugin-dev:skill-development`, `commands/*.md` → `plugin-dev:command-development`, `hooks/*` → `plugin-dev:hook-development`, manifest edits → `plugin-dev:plugin-validator`. Works across all plugin repos, not just hero-crew.

### Changed

- **feat(FEAT-029/SLICE-54):** Cost-hygiene reread hook promoted from **default-off** to **default-on**. Both `hooks/check-redundant-read.ts` and `hooks/record-read-content.ts` now fire on every Read without any env var set. Opt out by setting `CREW_COST_HYGIENE=0`. Previously required `CREW_COST_HYGIENE=1`.
- **feat(FEAT-122):** ESLint Phase 5 ratchet — complexity ≤10, max-lines-per-function ≤30, max-lines ≤300 repo-wide; 4 violations waived with rationale comments.

## v0.22.0 — 2026-06-08 — 3rd-party skill/agent imports, Go removal, ref fixes (FEAT-126)

### Added

**`agents/3rdparty/` — 3 new agents (FEAT-126)**

- `mobile-developer.md` — React Native / Flutter / iOS / Android implementation specialist
- `deployment-engineer.md` — Docker, container registries, CI/CD deployment automation
- `mcp-expert.md` — Model Context Protocol server authoring and debugging

**`skills/domain/` — 4 new domain skills (FEAT-126)**

- `frontend-design/` — visual design patterns, CSS layout, color systems, typography
- `tailwind-patterns/` — utility-first Tailwind CSS, responsive variants, config authoring
- `mobile-design/` — iOS/Android UX, React Native layouts, Flutter widgets, touch targets
- `docker-expert/` — Dockerfile patterns, multi-stage builds, docker-compose, image optimization

**`skills/workflow/` — 1 new workflow skill (FEAT-126)**

- `webapp-testing/` — E2E browser tests, integration smoke, API contract validation at runtime

**`commands/3rdparty/` — 4 new commands (FEAT-126)**

- `create-prd.md` — PRD authoring with best-effort repo discovery (drops @product-development/ hard-coded alias)
- `refactor-code.md` — structured refactor workflow
- `architecture-review.md` — architecture review command
- `create-architecture-documentation.md` — architecture documentation generation

**`docs/routing-table.md` — 7 new routing rows (FEAT-126)**

Tailwind CSS, frontend visual design, mobile app code, MCP server authoring, web app E2E testing, Docker containerization, mobile app design (UX). Agent skill blocks in `builder.md`, `uxdesigner.md`, `validator.md`, `deployer.md` updated to match (consistency gate).

### Removed

**Go stack support removed** (`c342d93`)

Go was never fully wired and had broken refs. Removed from:

- `docs/standards/feat-tag-schema.md` — `stack:go` enum row deleted
- `docs/routing-table.md` — parallel-build heuristic drops `stack:go`
- `commands/orchestrate-slice.md` — SPLIT_BUILD heuristic drops `stack:go`
- `scripts/orchestrate-slice-classify.ts` — `BE_STACK` set no longer includes `"stack:go"`
- `agents/builder-be.md` — Go entries removed (config glob, self-verify runners)
- `skills/workflow/reviewing-code/SKILL.md` — Go row removed from per-language table
- `skills/workflow/reviewing-code/references/go-checklist.md` — deleted

Historic docs/backlog/done/ entries referencing Go preserved as frozen records.

### Fixed

- `agents/builder-be.md` — repointed 3 broken skill refs: `csharp-pro` → `dotnet/csharp-conventions/` + `c-sharp-pro` agent; `a11y-advisory` removed (not BE scope) (`1c58684`)
- `agents/builder-fe.md` — `a11y-advisory` ref → `ux-methodology/references/accessibility.md` (`1c58684`)
- `commands/3rdparty/create-prd.md` — replaced `@product-development/` hard-coded path aliases with best-effort repo discovery (`2eaf7b6`)

### Chore

- 3.8 MB artifact cleanup: removed `docs/history/` (6 files, pre-formal-backlog era), 12 stale `docs/superpowers/plans/` (executed plans), 6 feat122-collision orphan artifacts (`c2e225e`)

---

## v0.21.0 — 2026-06-07 — short-slice validator-first dispatch order (FEAT-054)

### Changed

**`commands/orchestrate-slice.md` — Step 4.5 + updated Steps 4 and 5 (FEAT-054 / SLICE-81)**

Short slices with observable behavior now run the validator before the reviewer, so the
reviewer receives ready-made evidence and can focus on code quality rather than
re-running scenarios from scratch.

**Step 4.5 — Short-slice size check and dispatch-order determination** is inserted between
the builder/integrator gates and the reviewer dispatch. It computes two flags:

- `SHORT_SLICE = (acCount ≤ 6 OR changedFilesCount ≤ 10) AND NOT cross_plugin`
- `DISPATCH_ORDER = validator_first` when `SHORT_SLICE = true` AND `BEHAVIOR_CHANGED = true`; otherwise `reviewer_first` (the previous default for all slices).

**Step 4 (reviewer)** — when `DISPATCH_ORDER = validator_first`, the reviewer runs
after Step 5 and receives `VALIDATION_PATH` as additional input. The reviewer prompt
directs it to treat validator scenario evidence as authoritative for runtime behavior and
to scope its review to code quality, contract conformance, and test coverage.

**Step 5 (validator)** — when `DISPATCH_ORDER = validator_first`, the validator runs
before Step 4 and returns `VALIDATION_PATH` before the reviewer is dispatched.

**`scripts/orchestrate-slice-classify.ts` — `isShortSlice()` export (FEAT-054 / SLICE-81)**

New exported function that implements the short-slice gate deterministically:

```typescript
export function isShortSlice(opts: {
  acCount: number;
  changedFilesCount: number;
  crossPlugin?: boolean;
}): boolean {
  if (opts.crossPlugin) return false;
  return opts.acCount <= 6 || opts.changedFilesCount <= 10;
}
```

Cross-plugin slices always resolve `false` regardless of counts (long-slice default is
safer for multi-repo diffs where the reviewer dependency graph is unknown).

### Tests

7 new unit tests in `tests/orchestrate-slice.test.ts` covering all boundary cases for
`isShortSlice()`:

1. AC count ≤ 6 alone qualifies (changed-files above threshold)
2. Changed-files count ≤ 10 alone qualifies (AC count above threshold)
3. Both counts at or below threshold — true
4. Both counts above threshold — false
5. Boundary: `acCount = 6, changedFilesCount = 10` — true (both at limit)
6. Boundary: `acCount = 7, changedFilesCount = 11` — false (both just over)
7. `crossPlugin: true` overrides all counts — false

Full test suite: 446/446 pass.

### No breaking changes

The `reviewer_first` order is unchanged for long slices (`cross_plugin`, `acCount ≥ 7`
AND `changedFilesCount ≥ 11`). The `DISPATCH_ORDER` flag is computed at Step 4.5 and
has no effect when `BEHAVIOR_CHANGED = false` (validator is skipped in that path regardless).

---

## v0.20.0 — 2026-06-07 — hard cut crew:copywriter (FEAT-124)

### Removed

- `crew:copywriter` agent (FEAT-124). The documentation-writer scope has
  consolidated into `loop:document-writer`, which was extended in loop v0.29.0
  to cover API reference docs, diagram captions, and architecture narrative.

### Changed

- `commands/orchestrate-slice.md` Step 6 + Step 7 now dispatch
  `loop:document-writer` instead of `crew:copywriter`. The Step 7 fallback
  chain is removed.
- `docs/routing-table.md` — "API documentation authoring" and "Diagram
  authoring" rows now route to `loop:document-writer`. "Lead-prompt or
  specialist-agent prompt edit" enumeration no longer includes `copywriter`.

### Breaking

- **`crew:copywriter` no longer exists.** Any caller dispatching
  `subagent_type: crew:copywriter` will see a `subagent-not-found` error.
  Migration: replace with `subagent_type: loop:document-writer`. Loop v0.29.0
  is the minimum required version (pinned in `marketplace.json`).

---

## v0.19.0 — 2026-06-07

- **feat(orchestrate-slice):** integrate with loop `resolve-skills` CLI. Builders now receive a preset-resolved `## Required skills (resolved)` block injected at the top of their dispatch prompt when the `loop` plugin is installed alongside crew. Falls back silently when loop is absent or returns no match. Closes loop upstream-request `docs/upstream-requests/2026-06-07-hero-crew-orchestrate-slice-surface-stack-routing.md` (superseded — no FEAT-level reader needed; loop's resolver is the contract).
- New `Step 2.5 — Resolve builder skills` between architect and builder dispatches. Reads `.claude/loop.json` preset, walks LOOP_PLUGIN_ROOT discovery, runs `node loop.mjs resolve-skills` for each builder variant (fe / be / single per SPLIT_BUILD), pipes through jq to extract `.dispatchInstructionBlock`, prepends to the respective Step 3 / 3a / 3b prompt.

---

## v0.18.2 — 2026-06-07

- **fix(preflight):** narrow Windows-path-space heuristic to actual continuations. Previous check fired on any Windows path followed by `space + non-operator`, flagging innocent `git -C C:/work/mega/repo status` calls. New rule: only warn when the next shell token actually looks like a path continuation (contains `/` or `\\`, and isn't a flag, quote, or new drive letter). Real `C:\\Program Files\\app.exe` splits still warn correctly. Adds AC-9c (false-positive regression) and AC-9d (operator suffix) tests.
- **chore:** sync `.claude-plugin/plugin.json` version (was stale at 0.17.0) with `package.json` + `marketplace.json`.

---

## v0.18.1 — 2026-06-07

- **FEAT-121/Phase5** `scripts/lib/ux-validation/*.mjs` → `.ts`. TS migration now 100% complete — zero `.mjs` source files remain. 437 tests pass.

---

## v0.18.0 — 2026-06-07

TypeScript migration Phases 1–4 complete. All scripts, hooks, and test files now `.ts`. Full strict mode enforced end-to-end via `--experimental-strip-types` (Node 22.6+).

- **FEAT-106** TS Phase 1.1 — `scope-estimate` + `ux-validation` leaf modules migrated.
- **FEAT-107** TS Phase 1.2 — `preflight/checks` + `subagent-return/check` migrated.
- **FEAT-108** TS Phase 1.3 — cost-hygiene leaf modules migrated.
- **FEAT-109** TS Phase 1.4 — cost-hygiene aggregator + `session-cost-scanner` migrated.
- **FEAT-110** TS Phase 1.5 — briefing leaf modules migrated.
- **FEAT-111** TS Phase 1.6 — briefing collector + facade migrated.
- **FEAT-112** TS Phase 1.7 — installer leaf modules migrated.
- **FEAT-113** TS Phase 1.8 — installer core modules migrated. Phase 1 gate passed.
- **FEAT-114–117** TS Phase 2 — core state modules, artifacts + linkage, cost-advisor stack, `fleet.mjs` all migrated. Phase 2 complete.
- **FEAT-118** TS Phase 3.1 — all `scripts/*.mjs` entrypoints renamed to `.ts`.
- **FEAT-119** TS Phase 3.2 — all `hooks/*.mjs` renamed to `.ts`; Windows libuv crash fixed.
- **FEAT-120** TS Phase 4.1 — first 22 test files renamed `.mjs` → `.ts`.
- **FEAT-121** TS Phase 4.2 — remaining 21 test files renamed `.mjs` → `.ts`. All 437 tests pass. ESLint config updated (`tests/` dropped from lint scope; `tsc` covers correctness). `noUncheckedIndexedAccess` fixed across all test files.

437 tests. Lint clean. Typecheck clean. Node ≥ 22.6 required.

---

## v0.17.0 — 2026-06-07

TypeScript Phase 0 foundation, cross-agent severity signals, builder dispatch reliability, and 5 performance wins.

- **FEAT-100** TS migration Phase 0: `tsconfig.json` with `--experimental-strip-types`, `allowJs+checkJs:false`, strict mode. New `scripts/lib/result.ts` (`Result<T,E>`), `ids.ts` (branded IDs), `schemas.ts` (Zod workflow-state schema). `validate-typegraph.mjs` advisory gate in CI. Node CI bumped to v22.
- **FEAT-037** Cross-agent severity signals: `--findings` flag on `write-review-result`, `write-validation-result`, `write-deployment-check`. Persisted in artifact frontmatter. `computeRunHealth()` aggregates to `brief-me` `runHealth` field. Reviewer/validator/deployer prompts emit structured `🔴:N,🟡:N,❓:N` signals.
- **FEAT-046** Builder dispatch reliability: `## Context ceiling` section in `agents/builder.md` with `context_ceiling_reached` + `DONE_WITH_CONCERNS` protocol. `scope-estimate` CLI sub-command (`light/standard/heavy` tier). Lead ceiling-recovery rule.
- **FEAT-101** `tailReadJsonl` helper in `scripts/lib/jsonl.mjs` — tail-reads last 64 KB of JSONL instead of full file. Replaces full `readFile` in `collectHookHealth` and `wakeup.mjs`.
- **FEAT-102** Parallel cost-report reads: `collectRecentCosts` uses `Promise.allSettled` instead of sequential for-loop.
- **FEAT-103** Mtime-keyed artifact cache: `getCachedArtifact(absPath)` in `scripts/lib/artifact-cache.mjs`. `readArtifactSummary` and `readDeploymentGuidanceSummary` use cached stat+read+parse.
- **FEAT-104** Mtime-keyed directory listing cache: `getCachedDirFiles(dir, filter)` in `scripts/lib/dir-cache.mjs`. `listProjectSessions` uses it instead of raw `readdir`.
- **FEAT-105** `readFileIfExists(path)` helper in `scripts/lib/fs-utils.mjs` — ENOENT-only catch, re-throws all other errors. Replaces `pathExists/pathReadable + readFile` patterns in `wakeup.mjs`, `workflow-state.mjs`, `fleet.mjs`, `outcome-linkage.mjs`.

433 tests. Lint clean. Node ≥ 22.6 required (strip-types runtime).

---

## v0.16.0 — 2026-06-06

Frontend/backend builder split. OpenAPI 3.1 canonical. New agents and skills:

- **FEAT-A** Architect emits OpenAPI YAML (canonical) + derived contracts.ts + narrowed companion markdown. `skills/domain/openapi-authoring/` defines the quality bar; `scripts/validate-contracts.mjs` enforces it (redocly lint + drift gate).
- **FEAT-B** UX specs mandate `## API touchpoints` referencing OpenAPI operationIds. `scripts/validate-ux-spec.mjs` cross-checks references.
- **FEAT-C** `crew:builder-fe` — React + TS specialist consuming OpenAPI via orval + openapi-msw. `skills/domain/contract-codegen/` FE recipes.
- **FEAT-D** `crew:builder-be` — backend specialist supporting C#/.NET, Node, Python, Go (routed by FEAT `stack:*` tag). `skills/domain/contract-codegen/` BE recipes (NSwag/Kiota, datamodel-code-generator+fastapi-code-generator, oapi-codegen, openapi-typescript-codegen).
- **FEAT-E** `crew:integrator` + `skills/workflow/integration-smoke/` — live wire-up smoke with runtime OpenAPI response validation. `.claude/loop.json` `stack.run.{fe,be}` + `stack.integration.env_required` keys.
- **FEAT-F** `/crew:orchestrate-slice` classifies SPLIT_BUILD slices and dispatches the FE+BE+UX trio in parallel. Step 3.5 integrator gate. Reviewer emits FE/BE/UX/Integration conformance sections. Validator short-circuits on integrator PASS.

Single-stack slices continue to use the original `crew:builder` path unchanged. SPLIT_BUILD activates only when classification fires.

---

## v0.15.0 — 2026-06-06 — orchestrate-slice: FEAT-scoped contract no-op + parallel UX/builder

### Behavior changes — `commands/orchestrate-slice.md`

Three edits close the loop-to-orchestrator efficiency story that loop's
v0.11.0 set up:

**Step 1 — FEAT-scoped contracts artifact no-op (loop FEAT-050 AC-3).**
When `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md` already exists
AND the slice does NOT require a revision, Step 1 SKIPS the `crew:architect`
dispatch entirely. Sets `CONTRACT_PATH` from the existing file and continues
to Step 2. The artifact is FEAT-scoped (shared across all slices of a FEAT) —
loop's `/loop:backlog-enrich` pass 2 and `/loop:slice-from-feature` on-demand
trigger pre-populate it. Loop and crew now agree on the canonical path.

**Step 1 — revision-required heuristic (loop FEAT-050 AC-4).** A slice
requires a contract revision when ANY of: (a) slice frontmatter has
`revises_contract: true` (explicit, highest precedence); (b) slice AC text
contains substring `new endpoint` / `new event` / `new schema` /
`breaking change` / `new type` / `new interface` / `new field` /
`rename field` / `remove field` (case-insensitive); (c) `## In scope`
bullets mention `public API`, `export`, `interface`, or `schema`. Default
to revision on ambiguity — a redundant Revision subsection is cheap.

**Steps 2 + 3 — parallel uxdesigner + builder dispatch (loop FEAT-051).**
`crew:uxdesigner` and `crew:builder` both consume Step 1's `CONTRACT_PATH`
but NOT each other's output. When BOTH `NEEDS_UX = true` AND
`BEHAVIOR_CHANGED = true`, the orchestrator dispatches them concurrently
in a single message — two `Agent` tool calls in parallel. Roughly halves
wall-clock for UX-heavy slices. Builder no longer reads UX spec (works
from contracts + ACs only); reviewer checks UX spec conformance separately
in Step 4 via a new "UX Spec Conformance" section in the review-result.

### No breaking changes

The `dispatchInstruction` callers receive (`/crew:orchestrate-slice --id
SLICE-NN`) is unchanged. Single-branch flows (NEEDS_UX OR BEHAVIOR_CHANGED
but not both) behave exactly as before — no spurious empty Agent call.

### Pairs with loop v0.11.0

Loop's contracts-artifact triggers populate the artifact this Step 1 no-op
reads. Without this commit, loop's v0.11.0 gain was invisible to
`/crew:orchestrate-slice`. With this commit, the full FEAT-scoped pipeline
ships end-to-end.

---

## v0.14.1 — 2026-06-05 — loop@0.8.3

### Marketplace

`loop` bumped to `v0.8.3` — ceremony cleanup, SLICE-46 artifacts committed, tag aligned.

Full test suite: 376/376 pass.

---

## v0.14.0 — 2026-06-05 — scope-estimate + model compliance + observability + complexity extraction + loop@0.8.2

### Features

**`scope-estimate` sub-command (FEAT-046 Tasks 1–2)**

`node crew.mjs scope-estimate [--size light|standard|heavy] [--repo <path>]` — new
CLI sub-command backed by `scripts/lib/scope-estimate.mjs`. The pure classifier maps
token-budget signals to a `light / standard / heavy` tier used by the builder dispatch
protocol to pre-calibrate context ceiling expectations before a slice starts.

**Model compliance field in `brief-me` (FEAT-046 Task 5)**

`buildBriefingReport` now returns a `modelCompliance` field: `{ sonnetPct, compliant,
sliceCount }`. `compliant` is `true` when Sonnet accounts for ≥ 60% of cost across
recent slices. Surfaces the Sonnet-default discipline rule at a glance without requiring
manual cost-report inspection.

**Hook health observability in `brief-me` (FEAT-045)**

All 4 hook scripts (`check-redundant-read`, `record-read-content`, `preflight-shell`,
`check-subagent-return`) now emit structured `{ type: "hook_error", hook, error, ts }`
events to `.claude/logs/events.jsonl` via `hooks/hook-error.mjs`. A new
`collectHookHealth` function in `scripts/lib/briefing/collect.mjs` reads the last 100
events and counts per-hook errors in a 24-hour window. `buildWakeUpBrief` includes a
`hookHealth` field; `buildBriefingReport` surfaces a `## Hook health` section (green
when clean, per-hook error counts when not). `formatHookHealthSection` is exported for
testing.

**`validate-syntheses.mjs` CI gate (FEAT-045)**

`scripts/validate-syntheses.mjs` scans `final-synthesis` artifacts for `Grade missing`
or `<timestamp>` placeholders and errors on any match. Added to CI as an advisory gate
(`continue-on-error: true`). 14 synthesis artifacts with stale placeholders were
fixed in the same release.

### Refactors

**Complexity debt extraction (FEAT-044)**

Removed all 3 `eslint-disable-next-line complexity` suppressions from `crew.mjs` and
`artifacts.mjs` by extracting into `scripts/lib/cost-hygiene/`:

- `emit-cost-report.mjs` — `maybeEmitCostReport` (formerly suppressed at crew.mjs:407)
- `cost-slice-handler.mjs` — cost-slice command handler (formerly suppressed at crew.mjs:804)
- `render-frontmatter.mjs` — `renderCostReportFrontmatter` (formerly suppressed at artifacts.mjs:294)

Four oversized modules split below AC-3 thresholds:

- `collect.mjs` 955 → 530 L (extracted to `collect-cost-parser.mjs`)
- `cost-advisor.mjs` 874 → 485 L (extracted to `cost-advisor-grades.mjs` + `cost-advisor-rules.mjs`)
- `session-cost.mjs` 844 → 461 L (extracted to `session-cost-scanner.mjs`)
- `workflow-state.mjs` 794 → 461 L (extracted to `workflow-state-gates.mjs`)

### Bug fix

**`brief-me` redundant `collectHookHealth` call eliminated**

`buildBriefingReport` was calling `collectHookHealth(repoPath)` in its own `Promise.all`
even though `buildWakeUpBrief` already collected it. Now reads `wakeUpBrief.hookHealth`
directly — one fewer `events.jsonl` read per `brief-me` invocation.

### Marketplace

`loop` bumped to `v0.8.2` — architect classification tags for slices and features
(FEAT-048); post-builder confidence update in `slice complete` (FEAT-046); module
splits for `loop-installer.mts` and `auto-walker.mts` (FEAT-044/045).

Full test suite: 376/376 pass.

---

## v0.13.2 — 2026-06-05 — classify-scenario safety fix + loop@0.7.7

### Bug fix

`classify-scenario.mjs` — word-boundary safety restored. The v0.12.0 stem-prefix
fix (`\bverb` without trailing `\b`) caused over-matching on compound words
("showcase", "clickable", "presses"). Fix: explicit inflected forms added to each
verb set (`navigates`, `clicks`, `fills`, etc.), trailing `\b` restored. 7 new
regression tests (4 inflected-form positives, 3 over-match negatives).

### Marketplace

`loop` bumped to `v0.7.7` — wires `/crew:orchestrate-slice` as default dispatch
instruction when installed `crew ≥ 0.11.0` (FEAT-047).

Full test suite: 318/318 pass.

---

## v0.13.1 — 2026-06-05 — architect-feature doc fixes

### Fixes

- `commands/architect-feature.md`: revision subsection now uses `## Feature Revision — <date>`
  prefix to avoid naming collision with orchestrate-slice's `## Revision — SLICE-NN` sections.
- `commands/architect-feature.md`: Step 3 tag write-back warning path clarified to `exit 0`
  after continuing to Step 4.
- `tests/architect-feature.test.mjs`: +2 tests — re-run idempotency (Feature Revision prefix)
  and `--auto-start` clean exit when no pending slice. 10/10 pass. Full suite: 316/316.

---

## v0.13.0 — 2026-06-05 — architect-feature pipeline command

### New command: /crew:architect-feature

`commands/architect-feature.md` — researcher+architect pipeline that runs once per FEAT
before slice 1. Produces a feature-level contracts artifact
(`.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md`) and infers `surface:*`,
`stack:*`, and `concern:*` tags written back to FEAT frontmatter additively.

**Steps:** locate FEAT → researcher context pass → architect contracts artifact → tag
inference → tag write-back → optional `--auto-start` transition to first pending slice.

Contracts artifact follows the schema defined in `agents/architect.md`: TypeScript
Interfaces, API Contracts, Event Schemas, Data Contracts. Immutable-first-write:
re-running appends under a new run header rather than overwriting.

### Tests

`tests/architect-feature.test.mjs` — 8 structural tests covering command existence,
frontmatter, agent references, tag write-back shape, `--auto-start` flag, and error
handling.

Full test suite: 314/314 pass.

---

## v0.12.0 — 2026-06-05 — journey-builder sub-skill for ux-validation end-to-end journeys

### New workflow sub-skill: journey-builder

`skills/workflow/journey-builder/SKILL.md` — invoked by `ux-validation` at Step 2.5.
Derives an ordered `scenario_chain` from a slice's `## User Journey` section (explicit
override) or auto-derives from the AC list ordered navigation → input → interaction →
visibility. Returns `[]` when fewer than 2 steps are derivable so downstream `/qa`
invocation is skipped safely.

### Pure helpers

- `scripts/lib/ux-validation/journey-builder.mjs` — exports `buildJourney(acs, sliceContent)`.
  Parses numbered `## User Journey` lists and classifies/sorts AC-derived steps.
- `scripts/lib/ux-validation/qa-adapter.mjs` — `buildQaInvocation` now accepts
  `scenario_chain`; backward compatible (param optional).

### ux-validation wiring

`skills/workflow/ux-validation/SKILL.md` gains Step 2.5 calling `journey-builder` before
dispatching `/qa`, feeding the derived chain to the invocation.

### Bug fix

`classify-scenario.mjs` — verb regex changed from exact word-boundary (`\bverb\b`) to
stem-prefix match (`\bverb`) so inflected forms ("navigates", "clicks", "types") classify
correctly alongside base forms.

### Tests

- `tests/journey-builder.test.mjs` — 8 tests covering explicit override parsing,
  auto-derive ordering, and the `< 2 steps → []` guard.

Full test suite: 306/306 pass.

### Closed backlog

- FEAT-041: journey-builder sub-skill for ux-validation ✓

## v0.11.0 — 2026-06-05 — /crew:orchestrate-slice command + architect contract schema

### New command: /crew:orchestrate-slice

`commands/orchestrate-slice.md` — tag-driven specialist dispatch ladder. Run after
`/loop:slice start --id SLICE-NN`. Classifies the slice at Step 0 using frontmatter
overrides (`needs_contract`, `needs_ux`, `skip:`) and tag heuristics, prints a one-line
classification summary, then conditionally dispatches:

- **Step 1** — `crew:architect` (contract artifact, immutable-first-write) — skip when `NEEDS_CONTRACT = false`
- **Step 2** — `crew:uxdesigner` (UX spec, reads contract) — skip when `NEEDS_UX = false`
- **Step 3** — `crew:builder` (implementation, reads contract + UX spec)
- **Step 4** — `crew:reviewer` (requires `Contract Conformance: PASS/FAIL` section when contract exists; halts on `needs_fix`)
- **Step 5** — `crew:validator` — skip when `BEHAVIOR_CHANGED = false`
- **Step 6** — `crew:copywriter` — skip when `RELEASE_CONTENT = false`
- **Step 7** — `loop:document-writer` (or copywriter fallback) — skip when `DOCS_NEEDED = false`
- **Step 8** — `write-final-synthesis`

Every dispatch is visible in the main thread. No hidden subagent lead.

### Architect contract schema

`agents/architect.md` gains `## Contract artifact schema` — defines the
immutable-first-write rule for per-FEAT contract artifacts written to
`.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md`. Four required sections:
TypeScript Interfaces / API Contracts / Event Schemas / Data Contracts. Downstream
agents (builder, reviewer) read this file before starting work; reviewer checks
conformance.

### Agent prompt improvements (FEAT-038 + FEAT-039)

All five specialist agents (`builder`, `deployer`, `researcher`, `reviewer`, `validator`)
gain a `## Workflow badges` section with `blocked`, `escalated_to_human`, and
`validation_skipped` badge emit patterns. `builder`, `reviewer`, and `validator` gain
a FEAT tag schema cross-check hint pointing to `docs/standards/feat-tag-schema.md`.

### Tests

7 new structural tests in `tests/orchestrate-slice.test.mjs` covering command file shape,
frontmatter, Steps 0–8 presence, required agent references, and architect schema section.

Full test suite: 294/294 pass.

### Closed backlog

- FEAT-038: Workflow badge awareness in specialist agents ✓
- FEAT-039: Tag-aware skill loading hints in builder/reviewer/validator ✓
- FEAT-040: /crew:orchestrate-slice command ✓

## v0.10.0 — 2026-06-04 — UX validation gate auto-triggered on UX/React tags + loop pin step 1

### New workflow skill: ux-validation

`skills/workflow/ux-validation/SKILL.md` — auto-triggered by `crew:validator` when a slice's FEAT frontmatter `tags:` array intersects with `{surface:ui, concern:ux, concern:accessibility}`. The skill orchestrates a single gstack `/qa` Playwright run with four checks (acceptance-criteria pass/fail + axe-core accessibility scan + console+404 scrape + visual regression vs consumer-repo `tests/playwright/baselines/`) and returns raw evidence. Validator stays read-only — `/qa` writes the evidence JSON to `.claude/artifacts/crew/validations/<stamp>-ux-evidence.json`. The lead reads the validation result and pivots per the existing routing-table; the skill never recommends a pivot target.

Triggered states per the Skip + error cases table: tag intersection empty → silent exit; missing acceptance criteria → `validation_skipped`; no Playwright config → soft `validation_skipped`; `/qa` not available or non-zero exit → documented failure modes.

### Pure helpers (TDD-tested)

- `scripts/lib/ux-validation/extract-acs.mjs` — parse slice `## Acceptance criteria` block → `[{id, text}]`.
- `scripts/lib/ux-validation/classify-scenario.mjs` — verb-keyword classification → `interaction | visibility | navigation | input | non_ui_ac`.
- `scripts/lib/ux-validation/verdict.mjs` — apply pass/fail thresholds to evidence payload (failed > passed_with_notes > passed precedence).
- `scripts/lib/ux-validation/discover-playwright.mjs` — locate consumer-repo Playwright config + base URL (config file → `package.json` script port heuristic).
- `scripts/lib/ux-validation/qa-adapter.mjs` — assemble `/qa` CLI invocation with all four check flags.
- `scripts/lib/ux-validation/index.mjs` — public re-export surface.

### Validator agent wiring

`agents/validator.md` — one new auto-load row in `### Skills you consult`:

```
- UX/React behavior (slice tags include `surface:ui`, `concern:ux`, or `concern:accessibility`) → `skills/workflow/ux-validation/`
```

Validator stays read-only (`disallowedTools: Write, Edit` unchanged); turn budget unchanged.

### Tests + CI

- `tests/ux-validation.test.mjs` — 28 unit tests across the 5 pure helpers (TDD-driven).
- `tests/ux-validation-integration.test.mjs` — 3 integration tests asserting evidence parsing, verdict computation, and `/qa` invocation flag completeness against mocked evidence.
- `scripts/e2e-smoke-ux.mjs` — end-to-end smoke against a fixture HTML page served via `python -m http.server`. Asserts verdict computation returns `failed` with all four evidence categories populated when the fixture is intentionally broken (404 on logo, missing alt, console.warn).
- `tests/fixtures/ux-gate-smoke/` — fixture page, FEAT-SMOKE slice, baselines placeholder.
- `package.json` — new `e2e:smoke:ux` npm script.
- `.github/workflows/test.yml` — new CI step running `npm run e2e:smoke:ux`.

Full test suite: 285/285 pass (+31 new).

### Consumer-repo conventions

The skill assumes the consumer repo has Playwright installed and either a `playwright.config.{ts,js,mts}` file with `baseURL` set, or a `playwright` script in `package.json` plus a `dev`/`start` script whose port is discoverable via `-p <port>` or `--port <port>`. When absent, the skill soft-skips with note `playwright_not_configured` rather than failing the validation gate.

Visual regression baselines live in the **consumer repo** at `tests/playwright/baselines/` and use Playwright's native `toHaveScreenshot()` mechanism. Baselines are reviewed in PR like any code change; updates flow through `npx playwright test --update-snapshots`. Crew owns no baseline storage.

### Marketplace pin step 1: loop 0.5.6 → 0.7.1

`.claude-plugin/marketplace.json` — `plugins[name=loop].version` bumped from `0.5.6` to `0.7.1` as the first step of a stepwise bump to `0.7.2` (loop v0.7.2 released today; pin to 0.7.2 deferred pending validation per the user's stepwise preference). Loop v0.7.2 lands Option A from the dispatch-gap analysis: autonomous slice dispatch now routes through `crew:lead` instead of collapsing the lead workflow onto `crew:builder`.

### Open follow-ups

- Real `/qa` invocation (currently simulated in integration test and e2e smoke) — requires confirming gstack `/qa`'s actual CLI flag surface against the gstack plugin. Defer to a follow-up FEAT.
- Marketplace pin step 2: bump loop pin to `0.7.2` after Option A grade-trend validation lands.

## v0.9.0 — 2026-06-04 — turn-reduction workflow, FEAT tag-schema, 3 new orchestrator skills, Pass-2 routing validator

### Dispatch + decomposition rules

- **Pre-dispatch decomposition rule** added to `agents/lead.md`. Mandates per-file role-concern audit before any single-agent dispatch; ≥2 substantive groups → parallel role-bundled dispatch via `superpowers:dispatching-parallel-agents`. Closes the builder cap-hit pattern (5 of 14 dispatches paused near 48–55 tool uses in v0.8.0 work).
- **Inline-handle rule** added to `agents/lead.md`. Single-line policy edits (routing-table additions, CHANGELOG entries, manifest version bumps, skills-you-consult bullets, frontmatter field bumps, README pinned-release callouts) are lead-inline scope — no builder dispatch.
- **Architect-mandatory routing** in lead's tag-mapping: `surface:schema`, `surface:docs` (policy/governance), `concern:governance` MUST route to architect, never builder. Shifts authoring load off builder's turn budget.
- **`agents/architect.md` model upgraded** sonnet → opus to match ADR / system-design quality bar.

### FEAT tag-schema interface contract

- `docs/standards/feat-tag-schema.md` — new spec defining `tags: []` array on FEAT frontmatter. Three namespaces: `stack:*` (12 values), `surface:*` (7), `concern:*` (9). Namespace-prefixed flat array form. Producer (loop) + consumer (crew) contracts documented.
- `agents/lead.md` gains `### Tag-to-agent mapping` table — 12-row pattern matching tags → primary crew agent → skills to auto-load.
- Decoupling rationale: loop emits abstract tags; crew owns mapping. Swap orchestrator → re-author crew's mapping only.

### Three new orchestrator-flavor skills

- `skills/workflow/context-curation/` (86 lines) — per-agent context briefings, Quick/Full/Archived size budgets, pre-compaction snapshot methodology. Sourced from `aitmpl/development-tools/context-manager`.
- `skills/workflow/spec-decomposition/` (126 lines) — 6-step WBS framework (Goal → WBS → Dependencies → Parallelism → Effort/Complexity → Risk Register), 8/80-hour rule, Required Initial Inputs. Sourced from `aitmpl/ai-specialists/task-decomposition-expert`.
- `skills/workflow/slice-sizing/` (72 lines) — 8/80-hour atomic action rule + builder turn-budget evidence + decomposition triggers (>40 turns, ≥2 concerns, >5 files, multi-stack).

### Pass-2 routing-table validator

- `scripts/validate-routing-table.mjs` extended with second pass that cross-checks routing-table rows against agent `### Skills you consult` blocks. Catches drift between routing-table additions and stale agent prompts.
- 5 new edge-case fixtures + tests under `tests/fixtures/validate-routing-table/` (empty-block, refs-collapse, multi-role, missing-agent, malformed-row).
- 12 drift patches applied during validator rollout — builder/deployer/architect/uxdesigner/copywriter blocks gained the co-cite citations that routing-table already specified.

### Other polish

- 29 advisory warnings on FEAT-A distributed skills (missing `triggers:` frontmatter + section headings) closed. `validate-skills.mjs` now reports zero warnings.
- `agents/3rdparty/code-reviewer.md` per-language checklists harvested into `skills/workflow/reviewing-code/references/{typescript,python,rust,go,sql}-checklist.md`.
- Removed terraform external-plugin row references (`terraform-code-generation:*`, `terraform-module-generation:*`) from routing-table — those plugins are not crew marketplace dependencies and were failing the new Pass-1 ID resolution.
- `tests/agent-topology.test.mjs` pins exactly 9 expected agents at top-level `agents/`.

### Skill / agent counts

- Skills: 34 → 37 (added context-curation, spec-decomposition, slice-sizing).
- Agents: 9 (unchanged) — lead, builder, reviewer, validator, deployer, researcher, architect, uxdesigner, copywriter.

### Fixes

- `agents/researcher.md` model frontmatter typo corrected (`opud` → `opus`). Would have prevented researcher dispatch at runtime.

## v0.8.0 — 2026-06-04 — 9-agent topology, 34 skills, routing-table H3 grouping, release polish

### New agents + skill taxonomy (FEAT-A, FEAT-B, FEAT-C, FEAT-D)

- **FEAT-A:** Distributed 11 third-party skills into the four-tier taxonomy (`universal/`, `workflow/`, `domain/`, `meta/`). All 11 skills carry `triggers:`, `When to use`, and `Done/Acceptance` sections — closes 29 advisory warnings.
- **FEAT-B:** Routing-table wiring — new rows added for architect, uxdesigner, copywriter, plus backend/frontend/fullstack advisory, Python, TypeScript, React, AI engineering, CI/CD, IaC, database architecture, cloud architecture, UX methodology, API documentation, diagram methodology, multi-source research, and systematic debugging. Pass-2 cross-check validator added (`validate-routing-table.mjs`) with 5 edge-case fixtures; terraform external-plugin rows removed.
- **FEAT-C:** Three new first-party role stubs (`agents/architect.md`, `agents/uxdesigner.md`, `agents/copywriter.md`). Each stub delegates to vendored 3rdparty specialists via the Agent tool.
- **FEAT-D:** `### Skills you consult` blocks wired onto all 9 first-party agents so the routing-table Pass-2 cross-check validates end-to-end.

### 3rdparty agent vendor + Slices 1–5

- Vendored 21 third-party agents under `agents/3rdparty/` for delegation by architect, uxdesigner, and copywriter stubs.
- Slices 1–5: extracted 11 additional skills from 3rdparty agent bodies into proper `skills/domain/` and `skills/workflow/` directories (`language-pro`, `devops-engineering`, `database-architecture`, `cloud-architecture`, `ux-methodology`, `react-engineering`, `api-documentation`, `diagram-methodology`, `research-coordination`, `systematic-debugging`, `reviewing-code` per-language tiers).

### Release polish (v0.8.0 bundle)

- README updated: 9 agents, 34 skills, tier structure, new specialist role descriptions, project structure block, pinned release bumped to v0.8.0.
- `docs/governance.md`: `autonomous_safe: false` policy declared for architect/uxdesigner/copywriter prompts (same bar as lead).
- `.claude/crew/workflow.md`: architect, uxdesigner, copywriter phases added to Preferred Sequence (conditional phases 5, 6, 10); non-code deliverable review gate added to Default Gate Policy.
- `docs/routing-table.md`: H3 category headers added (9 groups) for scanability across 62+ rows; row content unchanged; Pass-1 + Pass-2 validators both pass.
- `agents/lead.md`: 5-line dispatch decision rule — ADR/diagram/schema → architect; UI flow/component → uxdesigner; docs/release notes → copywriter; impl → builder; investigation → researcher.
- Agent topology test added (`tests/agent-topology.test.mjs`) — pins exactly 9 first-party agents; fails on unexpected additions or removals.
- Version bump: `package.json` + `marketplace.json` → `0.8.0`.

## v0.7.1 — 2026-06-03 — Dedupe overlapping cost reports in brief-me rollup (FEAT-036)

### Cost rollup deduplication

`/crew:brief-me` was triple-counting the same fleet window when the recency list contained multiple aggregate snapshots of the same `(windowStart, windowEnd)` plus per-project slice subsets of those windows. The `sumUsdRecent` figure for a $3,995 run was showing $13,774 — arithmetically correct but semantically wrong.

- **fix(collect):** `scripts/lib/briefing/collect.mjs` — `collectRecentCosts` now calls `dedupeForRollup()` before computing `sumUsdRecent`, `avgUsdRecent`, and `modelBurn`. Within each `(windowStart, windowEnd)` bucket the latest aggregate snapshot is preferred; if no aggregate exists the latest slice/legacy report is used; older readings of the same scope+window are discarded from the sum. Slice rows whose window is fully contained inside a surviving aggregate row's window are omitted from the rollup (their cost is already counted inside the aggregate). Raw `recent[]` array is unchanged — all reports remain for per-row table rendering.
- **feat(collect):** new `costs.dedupedCount` field exposes how many of the `totalReports` rows actually contributed to the sum, enabling the brief to render "$X across N distinct windows (Y reports filtered as overlapping)".
- **fix(briefing):** `scripts/lib/briefing.mjs` — `summary.costReports` now uses `costs.dedupedCount` (was `costs.totalReports`) so the brief summary reflects deduplicated count.
- **tests:** `tests/briefing-cost-rollup-dedupe.test.mjs` — 8 new TDD scenarios covering all 5 AC cases: all-aggregate same window, aggregate + nested slice, disjoint historical (no false dedupe), mixed overlapping + disjoint, and `modelBurn` dedupe.

## v0.7.0 — 2026-06-02 — Sonnet-default model-selection gate (FEAT-031)

### Cost-discipline rule #1 codified into lead prompt

Last P0 of the perf-stabilization arc. Recent cost reports across 8 slices: `claude-opus-4-7` $1,821 / 3 slices vs `claude-sonnet-4-6` $277 / 5 slices — Opus paying ~6.6× sonnet per slice for work that, by post-hoc inspection, was mechanical. This release codifies the existing `feedback_cost_discipline.md` rule #1 into the lead agent prompt and a new standards doc.

- **feat(lead):** `agents/lead.md` — new `### Model-selection gate at slice start (FEAT-031)` subsection inside `## Delegation thresholds (cost discipline)`. At slice start, recommend **Sonnet** by default; recommend **Opus** only when ONE of three conditions holds: ambiguous architecture, hard refactor (≥3 files cross-cutting), or design choice required. Surface recommendation in the run-brief so the user can override. Measurement signal: `cost-report.modelMix` slice-over-slice.
- **docs(standards):** new `docs/standards/model-selection.md` — full rule rationale, 5-dimension slice-shape scoring (files / test signatures / ACs / architecture / scope), how to surface the recommendation, how to override, measurement targets (Opus message share ≤30% across trailing-5 mechanical slices).
- **docs(routing-table):** new row `Slice opens (subagent dispatch ahead)` → lead applies model-selection gate per the standards doc.
- **Note:** the rule governs SUBAGENT model choice, not the lead's own model. Lead frontmatter stays on Opus for framing, synthesis, user communication, and judgment calls.

## v0.6.0 — 2026-06-02 — Agent prompt quality bar + cap raise (FEAT-035)

### Agent prompt size bar raised from ≤200 to ≤300, now CI-enforced

- **feat(validator):** new `scripts/validate-agents.mjs` enforces a ≤300-line cap per agent file plus required frontmatter (`name`, `description`, `model`), required body sections (identity intro + `## Report contract` for teammate roles; lead is exempt from Report contract), filename↔frontmatter-name match, and no-duplicate-names. Wired into `.github/workflows/test.yml` between `validate-skills` and `validate-slices`. CI gate count grows from 8 to 9.
- **docs(governance):** `docs/governance.md` Agent prompt size bar raised from ≤200 to ≤300 with rationale + cap-history block. `CLAUDE.md` + `docs/architecture/architecture.md` ≤200 references updated to ≤300 (skill cap stays ≤200 per `validate-skills.mjs`).

### Lean-agent enrichments

Three agent prompts were sitting at 74–100 lines, missing context-efficiency / shell-pre-check / depth-control guidance that builder + reviewer already had. All additive — no existing rules rewritten.

- **feat(researcher):** `agents/researcher.md` 74 → 116 lines. New `## Research depth threshold` (when good-enough beats exhaustive). New `## Context efficiency` (Grep-before-Read, scoped reads, batch grep/read, front-load reads, no-re-Read-of-unchanged).
- **feat(deployer):** `agents/deployer.md` 82 → 152 lines. New `## Deployment check artifact` CLI block calling `write-deployment-check`. New `## Handoff before stop`. New `## Shell pre-check` (heaviest shell user of any role). New `## CI gate verification before push`. New `## Rollback discipline` (capture evidence, decide roll-back vs escalate, confirm environment, write failed deployment-check). New `## Context efficiency` block.
- **feat(validator):** `agents/validator.md` 100 → 153 lines. New `## Validation depth control` (smallest-meaningful-check first, when to stop). New `## Web UI scenarios — use gstack /qa` note per routing-table row. New `## Shell pre-check`. New `## Repo layout on start`. Expanded `## Context efficiency` block.

### Test suite

- `tests/validate-agents.test.mjs`: 10 tests covering the validator (well-formed pass, missing frontmatter field, missing-frontmatter-block, filename mismatch, missing `## Report contract` section, lead exemption, missing identity intro, 300-line cap, duplicate names, missing agents dir).

## v0.5.0 — 2026-06-02 — Builder self-verify + reviewer-bundled validation (FEAT-030)

### Review semantics change (backwards compatible default)

- **feat(builder):** `agents/builder.md` — new `## Self-verify gate` section requires builders to run lint + format:check + typecheck + full test suite + repo-defined validators before writing the handoff. Handoff body must include a `## Self-Verify Gates` section with one line per gate (command + exit code + summary). Self-verify complements but does not replace the reviewer's independent gate. For loop-using repos, `.claude/loop.json` `stack.build` + `stack.test` arrays are the canonical gate source.
- **feat(builder):** `agents/builder.md` — `## Review and validation dispatch` updated: dispatches `crew:validator` only when behavior is user-visible OR reviewer's review-result lacks a `Validation Evidence` section. Tests-already-green + code-only diffs with reviewer-bundled note do not require a separate validator dispatch.
- **feat(reviewer):** `agents/reviewer.md` — new `### Validation-evidence bundling (FEAT-030)` subsection in `## Review artifact`. When tests-already-green AND code-only diff AND no runtime/UI/CLI surface affected, reviewer populates `--validation-evidence` with test totals + gate commands + one-sentence verdict. When any condition fails, the note is NOT emitted. Cross-reference: lead reads the note and skips `crew:validator`; lead never skips validator when note is absent.
- **feat(reviewer):** `agents/reviewer.md` — `write-review-result` CLI block updated with new `--validation-evidence` flag (between `--test-summary` and `--risks`).
- **feat(lead):** `agents/lead.md` — new `### Validator dispatch decision (FEAT-030)` subsection in `## Review, validation, deployment`. Lists dispatch triggers and skip conditions (ALL three required: tests-already-green + code-only + reviewer note present). Skip recorded via `mark-badge validation_skipped --note "reviewer emitted validation-evidence note"`.
- **feat(cli):** `scripts/crew.mjs` — `write-review-result` subcommand accepts optional `--validation-evidence <text>` flag (default null). Pass-through to artifact writer.
- **feat(artifacts):** `scripts/lib/artifacts.mjs` — review-result renderer: when `validationEvidence` is non-null and non-empty, emits `validation_evidence: <text>` in YAML frontmatter AND a `## Validation Evidence` body section between `Test Adequacy` and `Risks`. When null or empty: omit both (backwards compatible with v0.4.0 baseline).
- **docs:** `docs/routing-table.md` — new row: reviewer-emitted validation-evidence note → lead skips `crew:validator` + records `validation_skipped` badge.

### Test suite

- `tests/cli.test.mjs`: +3 tests for `--validation-evidence` round-trip
  1. flag with text → frontmatter has `validation_evidence:` AND body has `## Validation Evidence`
  2. flag omitted → no frontmatter field, no body section (backwards compat)
  3. flag passed as empty string `""` → treated as omitted

### Subagent-return cost-discipline enforcement (FEAT-032)

- **feat(subagent-return):** new PostToolUse matcher on the `Agent` tool wires `hooks/check-subagent-return.mjs`. When a subagent's return body exceeds the byte threshold (default 512) AND contains no `.claude/artifacts/crew/*/...md` artifact path, emits a soft-warn `systemMessage` citing cost-discipline rule #2. Never blocks. Opt-out: `CREW_SUBAGENT_INLINE_THRESHOLD=0`. Tune: `CREW_SUBAGENT_INLINE_THRESHOLD=<bytes>`.
- **feat(subagent-return):** `scripts/lib/subagent-return/check.mjs` — pure check library (`parseThreshold`, `hasArtifactPath`, `checkSubagentReturn`). Path regex matches POSIX + Windows separators and all `.claude/artifacts/crew/*/` subdirs (handoffs, reviews, validations, deployments, runs, cost, cost-insights, agents).
- tests/subagent-return.test.mjs: comprehensive coverage of threshold edges, path detection, opt-out, exception safety, and cross-platform separators.

### Cost-report disambiguation (FEAT-034)

- **feat(cost-report):** cost-report emission splits into two labelled variants. `cost-report-slice-<title>.md` carries per-session data (`aggregate_all: false`, `source_count: 1`). `cost-report-aggregate-<title>.md` carries the multi-source rollup (`aggregate_all: true`, `source_count: N`). Single-source sessions emit only the slice variant; multi-source detections also emit the aggregate variant. Legacy `cost-report-<title>.md` artifacts on disk continue to parse via the unchanged read path.
- **feat(briefing):** `scripts/lib/briefing/collect.mjs` — `collectCostHealth` prefers the `cost-report-slice-` variant via a new `nameFilter` parameter on `buildCostAdvisor`; falls back to any cost report when no slice variant exists (backward compat). New exported `collectCostAggregate` returns the latest `cost-report-aggregate-` grade or null when no aggregate variant exists.
- **feat(briefing):** `scripts/lib/briefing.mjs` — brief-me JSON output exposes a new top-level `costAggregate` field next to `costHealth`. Removes the false-positive "F" grade caused by aggregating reread counts across sibling worktrees + sessions; the per-slice signal is now the honest baseline.
- tests/briefing-cost-health.test.mjs: 6 new tests (per-slice-only world, both-variants world, legacy-only fallback, costAggregate population, grade-not-F-with-clean-slice, costAggregate null in legacy-only).
- tests/cost-report-emission.test.mjs: 8 new tests covering single-source emission writes only slice, multi-source emission writes both variants, filename pattern matches, frontmatter `aggregate_all` per variant, legacy `cost-report` kind still works.

## v0.4.0 — 2026-06-02 — Tool-failure preflight hook (FEAT-033)

### Preflight checks for Bash + PowerShell (default-ON)

- **feat(preflight):** new `PreToolUse` matchers for `Bash` and `PowerShell` in `hooks/hooks.json` wire a default-ON preflight hook. Opt-out via `CREW_TOOL_PREFLIGHT=0`.
- **feat(preflight):** `hooks/preflight-shell.mjs` — PreToolUse. Reads command string from stdin, delegates to pure check library, emits `{ decision: "approve", systemMessage: "<warnings>" }` on detected failure mode. Never blocks (`decision: "block"` is never used). Always exits 0.
- **feat(preflight):** `scripts/lib/preflight/checks.mjs` — four v1 checks:
  1. **env-var shape mismatch**: warns when Bash command uses `$env:NAME` or PowerShell uses bare `$NAME` instead of `$env:NAME`.
  2. **chained-cd missing path**: scans for `cd <path> &&`, `cd <path>;`, and `Set-Location <path>` patterns, resolves against `cwd`, warns on ENOENT.
  3. **unquoted Windows path with space**: detects `[A-Za-z]:\\` paths with an embedded space not wrapped in quotes.
  4. **unterminated here-doc**: detects `<<EOF` / `<<'EOF'` without a closing `EOF` on its own line.
- Opt-out: `CREW_TOOL_PREFLIGHT=0` disables the hook (mirrors `CREW_COST_HYGIENE` convention). Default is ON — no env var required.

### Test suite

- New `tests/preflight-shell.test.mjs`: 28 tests covering all 14 ACs — env-var false-positive guards (`${HOME}`, `$()`, `$1`, `$env:NAME`), PowerShell automatic-variable deny-list (`$_`, `$HOME`, `$LASTEXITCODE`, `$NULL`, `$TRUE`, `$FALSE`, mixed-case `$PSVersionTable`, `$MyInvocation`, `$PSScriptRoot`), silence on clean commands, opt-out gate, exception resilience, and `decision: "approve"` shape guarantee.

## v0.3.11 — 2026-05-28 — Cost-hygiene reread hook

### Cost prevention (shipped default-off; promoted to default-on in FEAT-029/SLICE-54)

- **feat(cost-hygiene):** new `PreToolUse` + `PostToolUse` Read matchers in `hooks/hooks.json` wire a pair of hooks (originally env-var-gated with `CREW_COST_HYGIENE=1`; see FEAT-029 for the default-on promotion).
- **feat(cost-hygiene):** `hooks/check-redundant-read.mjs` — PreToolUse. On reread of a path with unchanged mtime, injects a `<system-reminder>` block quoting the prior file content into the assistant's context so the model uses it instead of issuing a redundant Read. Never blocks; always exits 0.
- **feat(cost-hygiene):** `hooks/record-read-content.mjs` — PostToolUse. Captures the Read tool result content into session state for the next reread to quote.
- **feat(cost-hygiene):** `scripts/lib/cost-hygiene/decide.mjs` — pure decision module. Q7 mtime-edit exception: warns only when file unchanged since last Read.
- **feat(cost-hygiene):** `scripts/lib/cost-hygiene/state.mjs` — per-session JSON at `.claude/state/cost-hygiene/<session_id>.json`. Per-file 50KB cap, per-session 2MB cap with LRU eviction. Atomic write via `.tmp.<pid>` + rename. Stale temp cleanup on load. Corrupt-JSON tolerance.

### Test suite

- 133 total tests (+21 from baseline 112): 6 `cost-hygiene-decide`, 10 `cost-hygiene-state`, 5 `cost-hygiene-hook` (integration via subprocess spawn).

### Quality gates

- **chore(format):** apply prettier to 9 drift-accumulated files. `npm run format:check` is now clean.
- **fix(types):** SLICE-08 AC5 zero-tolerance — last 2 residual `{any}` occurrences in `scripts/` replaced with typed alternatives (`@type {{ name?: string; version?: string }}` + `FleetItem` typedef).

### Known limitations

- ~~Plugin ships **default-off**. Set `CREW_COST_HYGIENE=1` to enable.~~ Promoted to **default-on** in FEAT-029/SLICE-54. Opt out with `CREW_COST_HYGIENE=0`.
- `evictLRU` may leave `total_bytes > 2MB` when a single protected entry alone exceeds the cap (cosmetic accounting only; cannot affect decisions or persist incorrect data).

## v0.3.10 — 2026-05-28 — Type safety (noImplicitAny)

### Quality Gates

- **feat(typecheck):** enable `noImplicitAny: true` in `tsconfig.json` — 654 → 0 TypeScript errors (SLICE-08 / FEAT-004).
- **feat(typecheck):** JSDoc `@param`/`@returns` annotations added to all 22 `scripts/**/*.mjs` files — `ArtifactFields`, `CostBreakdown`, `ScanCtx`, `Flags` typedefs; boundary guards use `{unknown}` not `{any}`.
- **ci:** `npm run typecheck` is now a meaningful gate — implicit-any regressions caught at commit time.

## v0.3.9 — 2026-05-28 — Agent color badges

### UI

- **feat(agents):** add `color` field to all 6 crew agent frontmatter files — `lead=blue`, `builder=green`, `reviewer=orange`, `validator=yellow`, `deployer=red`, `researcher=cyan`. Agents now display distinct colored badges in Claude Code UI.

## v0.3.8 — 2026-05-27 — Performance + observability + quality gates

### Bugfixes

- **fix(artifacts):** remove double-cost filename prefix — `cost-report-cost-...` → `cost-report-...` (FEAT-002).
- **fix(artifacts):** reorder frontmatter to phase → feature → slice across all render functions (FEAT-003).
- **fix(agent-report):** add phase/feature/slice identification to body, diagnostic note for missing events (loop repo).

### Performance

- **perf(cli):** convert 14 static imports to per-command lazy `import()` — ~100-200ms faster startup.
- **perf(agents):** context efficiency rules in lead (dispatch budget ≤3, compaction awareness, read discipline, model routing), builder (scoped reads, Edit preference, batch edits), reviewer (git-diff-primary, no-re-Read).

### Observability (Phase 4)

- **feat(cost-advisor):** `computeGrade(target)` — composite A-F letter grade from compaction count, subagent dispatches, re-reads, tool failure rate, cache hit %. 15 TDD tests.
- **feat(cost-advisor):** `detectTrends(reports)` — regression detectors for compaction-drift, subagent-creep, cost-regression across last 3 reports. 14 TDD tests.
- **feat(cost-advisor):** compaction-cascade rule — HIGH severity when compactions >10 AND dispatches >5.
- **feat(briefing):** `costHealth` field in brief-me output — grade + top concern from latest cost report. 10 TDD tests.

### Quality Gates

- **feat(agents):** deployer pre-push `plugin-dev:plugin-validator` gate for plugin repos.
- **feat(agents):** reviewer `plugin-dev:plugin-validator` and `plugin-dev:skill-reviewer` upgraded from optional to required dispatch.

### Test suite

- 112 total tests (39 new across `cost-advisor-grade`, `cost-advisor-trends`, `briefing-cost-health`).

## v0.3.7 — 2026-05-26 — Global namespace rename: engineering-os → crew

### Installer

- Global memory path renamed from `~/.claude/engineering-os/` to `~/.claude/crew/`, matching the plugin brand and repo-local convention.
- `installGlobal()` auto-migrates existing `~/.claude/engineering-os/` files and rewrites `CLAUDE.md` `@`-imports on next run.
- `.claude/engineering-os/lead.md` moved to `.claude/crew/lead.md`.

### Agent prompts

- All 6 agent prompts (`lead`, `builder`, `reviewer`, `validator`, `researcher`, `deployer`) updated: custom instruction paths now reference `~/.claude/crew/<role>.md` and `.claude/crew/<role>.md`.
- `deployer.md` deployment guidance path corrected to `.claude/crew/deployment.md`.

### Commands

- `install.md`, `audit-repo.md` updated to reference `~/.claude/crew/`.
- `adopt.md` expanded legacy-path context to include `~/.claude/engineering-os/` globals.

### Docs

- `README.md` — all user-facing path references updated.
- `docs/architecture/system-design.md` — updated to reflect completed rename.

### Tests

- New test: `installGlobal migrates legacy ~/.claude/engineering-os/ to ~/.claude/crew/`.
- Existing global-install assertions updated. 73/73 tests pass.

## v0.3.6 — 2026-05-24 — Rich artifact flags for all agents

_(No changelog entry was written for v0.3.6. See commit `00f5f7a` for details.)_

## v0.3.5 — 2026-05-24 — Agent codification + CI hardening + cost discipline

### Agent prompts

- `write-handoff --repo-context` injects pre-discovered repo layout (scripts/, agents/, skills/, tests/, npm scripts) into handoff artifacts so subagents skip 3-5 layout-discovery turns (FEAT-022 D4).
- `agents/reviewer.md` gains "Efficiency rules" section: grep-before-Read (D2, target Read:Grep ≤ 1:1) and batch-AC-verification (D3, single Bash call per AC set) (FEAT-022 D2+D3).
- `agents/builder.md` TDD policy strengthened: forward-references FEAT-023 `--test-summary` gate so builder knows reviewer will require test coverage evidence.
- `agents/builder.md` + `agents/researcher.md` gain "Handoff before stop" section: completion, pause, blocker, context-end all require `write-handoff` before returning. Addresses two observed subagent mid-task pauses this session.
- `agents/lead.md` gains "Delegation thresholds" section: 3+ unfamiliar-file reads → dispatch researcher; 5+ sequential Bash gates → bundle into builder; mechanical edits across >2 files → builder. Addresses opus overuse (97% of $ in recent slices).

### CI gates

- New `scripts/validate-slices.mjs` hard gate scans `docs/ai-loop/slices/pending/**/*.md` for AC-placeholder bullets (literal dots, angle-bracket template, empty post-colon). Exit 1 with file:line diagnostics. Companion to FEAT-024 (loop-side enforcement).
- `write-review-result --decision` now validates against allow-list (`approved | approved_with_notes | rejected`). Unknown values exit 2 with stderr listing valid options.

### Skills

- 4 skills (writing-claude-md, writing-task-handoffs, review-gates, using-crew) gain Trigger + Done headings. `validate-skills.mjs` warnings 8 → 0.

### Types

- JSDoc `@type {Dirent[]}` cast on `buildRepoLayoutBlock` skills/ branch clears recurring LSP red diagnostics on `.isDirectory()` / `.name` access.

### Docs + backlog

- `.claude/crew/deployment.md` created — durable deployment guidance extracted from CLAUDE.md release workflow.
- FEAT-022 closed (D2+D3+D4 shipped, D1 dropped per operator decision: prompt-only, no PreToolUse hook).
- FEAT-023 closed (shipped in v0.3.4).
- CLAUDE.md CI gates list updated from 8 → 9 entries (includes `validate-slices.mjs`).

### Tests

- 8 new test scenarios: 7 for `validate-slices.mjs` (3 placeholder shapes + concrete-AC pass + completed-skip + empty-pending + missing-dir) + 1 for unknown `--decision` (allow-list gate).

## v0.3.4 — 2026-05-24 — Hard-gate `test_adequacy` in `write-review-result` (FEAT-023)

### Why

A downstream `loop` customer reported four compounding quality failures: TDD prose-only enforcement, slice files shipping with literal `AC-N: ...` placeholders, review artifacts rendering `Test Adequacy: -` on every run (the field was in the renderer but no CLI flag set it), and marathon-mode auto-closing on "build + review passed" without inspecting test-adequacy signal. This release closes the hero-crew half of that report. The loop half is tracked under FEAT-024.

### CLI gate

- `write-review-result` gains `--test-summary`, `--test-summary-skip-reason`, and `--non-code` flags. When `--decision=approved` or `--decision=approved_with_notes`, the CLI exits 2 with a clear stderr message if none of the three flags are set. `--decision=rejected` bypasses the gate (rejection itself is the signal).
- Renderer adds `Test Adequacy Skip Reason` and `Non-Code Review: yes` lines when the matching flag is set. The pre-existing `Test Adequacy: -` rendering for absent `--test-summary` is preserved for backward compatibility, but the gate makes it impossible on approved code-bearing reviews.

### Agent + template

- `agents/reviewer.md` FEAT-011 TDD gate gains a "Test Adequacy field — populate or refuse" section documenting the new CLI contract.
- `docs/ai-loop/00-entry/SLICE_TEMPLATE.md` Acceptance Criteria + Done When rewritten: placeholders now state "Replace every `...` with concrete, verifiable language before the slice opens — placeholder bullets fail the slice-start linter." New default test-coverage AC bullet. Done When requires populated `Test Adequacy` (or explicit skip / non-code) in the review artifact.
- `docs/routing-table.md` gains a "TDD / test-adequacy enforcement on review" row pointing at the reviewer agent + CLI gate.

### Tests

- 6 new scenarios in `tests/crew-write-review-result.test.mjs` cover: refuse on `approved`, refuse on `approved_with_notes`, `--non-code` exit 0 + `Non-Code Review: yes` rendered, `--test-summary` exit 0 + field rendered, `--test-summary-skip-reason` exit 0 + reason rendered, `rejected` bypass.
- Pre-existing `tests/cli.test.mjs` updated to pass `--non-code` where it previously wrote an approved code-bearing artifact without test flags. Assertions were not weakened.

### Backlog

- `docs/backlog/pending/FEAT-023.md` (this release) and `FEAT-024.md` (cross-repo loop coordination ticket for AC placeholder linter, slice template test AC, ladder + marathon test-adequacy gates) added.
- FEAT-024 introduces a new `cross_repo` frontmatter key. Schema documentation for that key is deferred.

## v0.3.3 — 2026-05-24 — `--feature` / `--phase` + cost-advise `--title`

### CLI flags

- New `--feature` and `--phase` flags on every artifact-writer command
  (`write-run-brief`, `write-handoff`, `write-review-result`,
  `write-validation-plan`, `write-validation-result`,
  `write-deployment-check`, `write-final-synthesis`, `cost-slice`,
  `cost-advise`). When set, both values are embedded in the YAML
  frontmatter of the resulting artifact, so downstream tools
  (LoopObserver, dashboards) can filter / group without parsing the
  body.
- New `--title` flag on `cost-advise`. Overrides the slug source for
  the cost-advise filename. Lets callers pass `PHASE3 FEAT021 SLICE36`
  so the filename matches the rest of the artifact surface
  (`<TS>-cost-advise-phase3-feat021-slice36.md`).

### Frontmatter

- Simple-renderer artifact kinds (`run-brief`, `handoff`,
  `review-result`, `validation-plan`, `validation-result`,
  `deployment-check`, `final-synthesis`) gain an optional YAML
  frontmatter block when `--feature` or `--phase` is set. Block is
  `---\nfeature: ...\nphase: "..."\n---`. When neither is set, body is
  byte-identical to v0.3.2 (backward compatible).
- `cost-report` and `cost-advise` already had structured frontmatter;
  `feature:` and `phase:` keys are folded in inline.

### Tests

- 4 new cases in `tests/cli.test.mjs` cover `--feature` / `--phase`
  frontmatter emission, backward-compat (no frontmatter without flags),
  `cost-advise --title` slug, `cost-slice` frontmatter keys.

### Internal

- `writeCostAdviseArtifact` refactored into `buildCostAdviseSlug` +
  `buildOptionalFrontmatter` helpers; cost-advise emit inside
  `maybeEmitCostReport` extracted into `emitCostAdvise`. Eslint
  complexity warnings resolved.

## v0.3.2 — 2026-05-24 — Skills library + routing + cost discipline + linter

### Skills

- **New** `skills/domain/terraform-ops-traps/` — operational failure
  patterns for Terraform provisioners, multi-env isolation, and
  zero-to-deployment reliability. Vendored from
  `daymade/claude-code-skills` (MIT, © 2025 daymade); trimmed from 234
  lines to 135 and split into `references/{provisioner-traps,
multi-env-isolation, zero-to-deploy}.md` so the on-load body fits
  this repo's ≤200-line skill quality bar.
- **New** `skills/workflow/commit/` — conventional commit + emoji
  format with split-commit guidance. Vendored from
  `evmts/tevm-monorepo` (MIT, © 2023 evmts contributors); reduced
  emoji list, replaced pnpm pre-commit gate with this repo's
  `npm run lint && npm test && validate-manifests/skills`.
- **New** `skills/workflow/fix-pr/` — fetch and address unresolved PR
  review comments with proper threading + commit-per-fix discipline.
  Authored fresh; cites `gh` CLI workflow for this repo.

All three pass `validate-skills.mjs` (tier in enum, ≤200 lines,
required headings present). Total: 12 skills (was 9).

### Routing (FEAT-019)

- 6 new rows in `docs/routing-table.md` covering Microsoft SDK code,
  Microsoft tech concepts, builder edits of `agents/` + `skills/`,
  Terraform HCL (`terraform-code-generation:*` + `crew:terraform-ops-traps`),
  Terraform modules/Stacks (`terraform-module-generation:*`), Terraform
  state import. Plus context7 row extension to name reviewer as consumer.
- `CLAUDE.md` "Skill taxonomy" callout pointing at external-plugin
  skill wiring.
- `docs/architecture/architecture.md` "Skill tiers" subsection
  "External plugin skills as routed dependencies" documenting the
  routing-by-row pattern + single-point-of-rename design.

### Cost discipline (FEAT-018)

- All 5 agent prompts gain identical "Report contract" section:
  agents write completion reports via `write-handoff` CLI, return
  only path + 1-3 sentence headline to lead. Inline returns
  re-inflate lead context.
- `agents/builder.md` + `.claude/engineering-os/lead.md` gain shell
  pre-check rule (pwd / Test-Path before chained cd) + PS-vs-bash
  cheatsheet.
- `agents/{builder,reviewer,validator}.md` gain "no re-Read after
  Edit/Write" rule.
- `commands/{build,fix}.md` gain "read agent reports from path"
  reminder.
- New routing-table row "Subagent completion report".

### Routing-table linter (FEAT-021)

- New `scripts/validate-routing-table.mjs` validates every
  `<plugin>:<skill>` reference in routing-table resolves against
  installed plugin cache + local `skills/`/`commands/`/`agents/`.
- Supports `<!-- routing-lint:ignore -->` opt-out for forward pointers.
- Env-gated by `CREW_VALIDATE_ROUTING_TABLE=1`; skips silently
  otherwise so contributors without plugin cache can still run tests.
- CI gate added as advisory (`continue-on-error: true`); promote to
  hard-fail when plugin cache is reliably present.
- `npm run validate:routing-table` script entry.
- 4 test scenarios via temp-dir fixtures.

### Agents

- `builder` maxTurns bumped 30 → 40.
- `reviewer` maxTurns bumped 25 → 35.
- Per operator policy: if pauses recur at these caps, investigate
  workflow root cause via trigger-gated FEAT-022 (do not bump further).

### Backlog

- FEAT-018, FEAT-019, FEAT-020, FEAT-021 → done.
- FEAT-022 filed (P3, trigger-gated subagent-pause investigation).
- FEAT-019 SLICE-B (agent-prompt addendums) deferred — routing layer
  alone proved sufficient; revisit if missing routing causes problems.

### Marketplace pin

- crew bumped to 0.3.2.
- loop bumped to 0.3.2 (depends on loop FEAT-020 multi-slice support).

## v0.3.1 — 2026-05-23 — Marketplace polish + agent model tuning

### Marketplace

- `crew` plugin source switched from local `./` to structured `github`
  form (`source: "github", repo: "sergeymilashico/hero-crew"`) — symmetric
  with the `loop` entry and resolvable from any consumer install.
- `loop` plugin source corrected from raw string URL → structured `github`
  form so the marketplace loader can resolve it.
- Owner + author rebrand consolidated to `astra` across `marketplace.json`
  and both plugins' `plugin.json`.

### Agents

- `builder` model `opus` → `sonnet`; `lead` effort `high` → `medium`.
  Reduces per-slice cost on bounded implementation work without observed
  quality regression. Revert by editing `agents/builder.md` and
  `agents/lead.md` if regression is observed.

### Notes

- No consumer-repo migration required.
- Marketplace pins bumped: `crew@0.3.1`, `loop@0.3.1`.

## v0.3.0 — 2026-05-23 — Astra rebrand

### Breaking

- Marketplace renamed `crew-dev` → `astra`. New install path:
  `/plugin marketplace add sergeymilashico/hero-crew` then
  `/plugin install crew@astra`.
- Companion plugin renamed `autonomous-loop` → `loop`. Install:
  `/plugin install loop@astra`. Companion slash command namespace
  `/autonomous-loop:*` → `/loop:*` (handled in the companion repo
  release; `loop@0.3.0` ships a one-time migrator that renames
  `.claude/autonomous-loop.json` → `.claude/loop.json` and rewrites
  CLAUDE.md markers on first `/loop:install`).

### Migration

- Existing installs of `crew@crew-dev` and `autonomous-loop@crew-dev`
  must be uninstalled and re-installed under the new marketplace name.
  See `docs/process/rebrand-migration.md` for the exact command
  sequence.
- Consumer-repo state for the companion plugin auto-migrates on first
  `/loop:install`; no manual file rewrites required.

### Notes

- `crew` plugin itself has no consumer-repo state rename — only the
  install path changes.
- Marketplace manifest is the source of truth for plugin pins; both
  `crew` and `loop` pinned at `0.3.0` here.
- Hardcoded cache-path fallbacks in `scripts/lib/briefing/collect.mjs`
  walk the new `astra/loop/<version>/` cache first, then fall back to
  the legacy `autonomous-loop-dev/autonomous-loop/<version>/` shape so
  briefings keep working during the transition.

## v0.2.0 — 2026-05-22 — Phase 1 (Engineering OS) complete

Closes the Phase-1 backlog defined in `docs/architecture/architecture.md`.
Nine of eleven FEATs shipped; the remaining two (FEAT-005, FEAT-009)
are correctly deferred behind explicit "when X observed" triggers.

### Skill taxonomy (FEAT-001, FEAT-007)

- `skills/` split into four tiers: `universal/`, `workflow/`,
  `domain/`, `meta/`. Existing crew skills relocated; tier field
  added to frontmatter.
- New `scripts/validate-skills.mjs` enforces the quality bar
  (required: name, tier, description; recommended: owner,
  last_reviewed, triggers; hard caps: ≤200 lines, directory matches
  name, no duplicate names, tier in enum). Wired into CI between
  validate-manifests and lint. Local: `npm run validate:skills`.
- All 4 existing skills brought up to spec.

### Routing (FEAT-002)

- Authoritative `docs/routing-table.md` (14 rows derived from real
  history). Lead consults at session start.
- Production-promotion row explicitly requires human approval — no
  automation.
- FEAT-008: brief-me surfaces a reminder when the routing-table
  mtime exceeds 30 days. Encourages a monthly review.

### Workflow state (FEAT-006)

- New `blocked` + `escalated_to_human` workflow badges with
  `--note <reason>` and `--blocked-by <artifact-id>` flags.
- `write-final-synthesis` refuses to run while escalated unless
  `--force`.
- `brief-me` + `summarizeWorkflowState` surface both as pending
  badges. AL plugin (v0.1.21) consumes these signals end-to-end.

### Lead, builder, reviewer prompts (FEAT-003, FEAT-011)

- `agents/lead.md` rewritten — 196 → 169 lines (under 200-line cap).
  New "Composition formula" + "Where to load specifics" sections
  point at the durable docs/skills rather than restating discipline
  inline.
- `agents/builder.md` (FEAT-011) gains a TDD policy table:
  required on net-new behavior + bug reproducers; optional on
  refactors of tested code; skipping silently is a review finding.
  Procedure of record: superpowers `test-driven-development` skill.
- `agents/reviewer.md` (FEAT-011) gains a TDD gate section that
  enforces failing-test-first on net-new behavior.

### Docs (FEAT-004, FEAT-010)

- `docs/architecture/architecture.md` polished: Phase 1 status
  table, autonomous-loop sync line, tooling-gates section.
- New `docs/governance.md`: skill ownership, agent prompt size bar,
  routing-table review cadence, artifact retention, lessons →
  standards pipeline, three-test rule for specialist-agent
  admission, defer-by-default.
- `docs/` directory namespaced into `architecture/`, `process/`,
  `history/`, `standards/`, `backlog/` to match Astragenie.Standards
  shape. 19 flat doc files moved via `git mv`; all internal refs
  rewritten.

### Tooling (cross-cutting)

- `tsconfig.json` added with `checkJs: true` / `noEmit`; `npm run
typecheck` wired into CI between format:check and tests. JSDoc
  annotations added on session-cost, cost-advisor, crew.mjs entry
  points to satisfy tsc.
- `superpowers` plugin verified enabled in `~/.claude/settings.json`
  for global TDD + systematic-debugging + verification-before-
  completion skill discovery.

### Companion plugin sync

| Capability                                 | crew   | autonomous-loop |
| ------------------------------------------ | ------ | --------------- |
| blocked + escalated_to_human (writer)      | ≥0.2.0 | —               |
| Honors crew gates in slice flow (reader)   | —      | ≥0.1.21         |
| Iteration cap + cost-alert + snapshot loop | —      | ≥0.1.20         |

Pin both together; older AL against newer crew silently misses the
new gate signals.

### Tests + gates

- 41/41 tests pass (35 → 41, six added across FEAT-006 + FEAT-008).
- typecheck + lint + format + validate-skills + validate-manifests
  - e2e-smoke all clean on every push.

### Backlog after Phase 1

Closed: FEAT-001 / FEAT-002 / FEAT-003 / FEAT-004 / FEAT-006 /
FEAT-007 / FEAT-008 / FEAT-010 / FEAT-011.

Intentionally deferred:

- **FEAT-005** (dotnet/csharp-conventions domain skill) — build when
  the first .cs work appears.
- **FEAT-009** (artifact index file) — build when artifact-tree
  grep exceeds ~2s.

## v0.1.26 — 2026-05-22

### Removed

- **Commit bridge feature removed in its entirety.** The bridge was an
  opt-in `PostToolUse` hook that minted Crew artifacts from commits
  matching a preset pattern; in practice it was never adopted beyond
  exploration. Deletion reclaims ~700 lines (lib + tests + commands +
  docs) and one PostToolUse-hook surface for downstream repos to worry
  about.
  - `scripts/lib/bridge-installer.mjs` (463 lines)
  - `scripts/lib/plugin-identity.mjs` (sole consumer was the bridge)
  - `tests/bridge-installer.test.mjs` (14 tests)
  - `commands/install-commit-bridge.md` + `commands/install-wiggin-bridge.md`
  - CLI subcommands: `install-commit-bridge`,
    `backfill-commit-bridge`, `list-bridge-presets`,
    `install-wiggin-bridge`, `backfill-wiggin-bridge`
  - README Install section "optional follow-up" block
  - `commands/adopt.md` step 12 bridge probe
  - `docs/process/adoption-checklist.md` bridge sections
  - `installer/welcome.mjs` optional bridge hint
- Companion `autonomous-loop/skills/loop-discipline/SKILL.md` lost its
  one-line reference to the bridge as well.

### Migration

Repos with a bridge already installed will keep the generated
`.claude/hooks/commit_bridge.sh` + `PostToolUse` settings entry — no
runtime breakage. The CLI commands for re-installing or reconfiguring
the bridge are simply gone. Manual cleanup: delete
`.claude/hooks/commit_bridge.sh` and the matching `PostToolUse` entry
in `.claude/settings.json` if you want to remove the hook entirely.

### Notes

- Tests: 35/35 pass (down from 49 — the 14 missing tests are the
  bridge suite that no longer exists).

## v0.1.25 — 2026-05-22

### Changed

Final lint-cleanup pass. **Lint warning count: 8 → 0.**

- `validate-manifests.mjs::validateManifests` 16 → off list. Extracted
  `isMissing`, `checkRequiredFields`, `checkVersions`,
  `checkOwnMarketplaceEntry`, `checkMarketplaceEntries`.
- `briefing/collect.mjs::parseHeaderFields` 18 → off list via
  `parseRunTitle`, `parseUsd`, `parseDurationMs` helpers.
- `artifacts.mjs::renderCostReportHeader` 16 → off list via
  `formatCount` helper.
- `briefing/render.mjs::buildBlockedOrMissing` 18 → off list. Static
  `PENDING_BADGE_MESSAGES` + `MISSING_WRITE_MESSAGES` maps + extracted
  `collectGateFailureMessages` + `collectRepoStateMessages`.
- `briefing/render.mjs::recommendedNextStep` 19 → off list. Same
  pattern — `NEXT_STEP_FROM_PENDING` / `NEXT_STEP_FROM_MISSING` maps,
  `GATE_NEXT_STEP_SPECS` + `collectGateFailureNextStep`,
  `repoStateNextStep` probe helper.
- `wakeup.mjs::buildWakeUpBrief` 124 lines → off list. Summary block
  extracted into `buildWakeUpSummary`.
- `session-cost.mjs::computeSessionCost` 22 / 146 lines → off list.
  Extracted `priceByModel`, `computeSourceBreakdown`, `buildModelMix`,
  `computeSizeStats`, `collectFileReReadEntries`, `buildToolUsage`.

### Notes

- Lint output is now clean. All 49 tests pass.

## v0.1.24 — 2026-05-22

### Changed

- **`briefing/collect.mjs::parseCostReportText`** complexity 34 → split
  into `parseHeaderFields`, `parseTokenFields`, `parseDiagnosticFields`,
  `parseOutcomeFields`, `bodyNum`. Composer reads top-down.
- **`artifacts.mjs::renderCostReportFrontmatter`** complexity 27 → 16
  via `[predicate, line-builder][]` table with lazy interpolation.
- **`artifacts.mjs::renderCostReportHeader`** complexity 22 → 16 via
  small `formatDuration`/`formatTokens`/`formatCacheHit`/`formatUsd`/
  `formatBool` helpers.
- **`session-cost.mjs::autoDetectSourceProject`** + `listActiveProjectDirs`
  both 18-25 → off list. Extracted shared helpers
  `listJsonlInDir`, `listProjectDirEntries`,
  `countInWindowAssistantTurns`. Caller bodies now ~10 lines each.
- **`session-cost.mjs::handleAssistantTurn`** complexity 23 → off list.
  Split into `recordTokenUsage` + `recordToolUse` + `TOOL_COUNTERS`
  table dispatch for Skill/Agent counters.
- **`workflow-state.mjs::hasPendingGates`** complexity 18 → off list.
  Predicates moved into `PENDING_GATE_CHECKS` array.
- **`workflow-state.mjs::hasCompletedPhaseEvidence`** complexity 19 →
  off list. Field accessors moved into `GATE_STATUS_GETTERS` +
  `PHASE_ARTIFACT_GETTERS` arrays.
- **`workflow-state.mjs::summarizeMissingArtifactWritesForRun`**
  complexity 23 → off list. Gate-to-artifact mapping moved into
  `MISSING_WRITE_SPECS` table with `gate(g)` / `artifact(a)` /
  `code` fields.

### Notes

- Lint warning count: 15 → 8. All remaining within 5 of threshold;
  further cuts have diminishing returns.
- All 49 tests pass.

## v0.1.23 — 2026-05-22

### Changed

- **`session-cost.mjs::computeSessionCost`** — 235 lines / complexity 85
  cut to 133 lines / complexity 22.
  - `scanSessions` extracted: drives the per-session JSONL loop and
    returns the full accumulator bundle (totals, byModel, tool stats,
    file reads, conversation counters, perSourceState).
  - `handleAssistantTurn` + `handleUserTurn` extracted: the assistant
    branch handles usage / tool-use; the user branch handles
    tool_result sizing, compaction signals, and user message shape.
  - `resolveScanSources` extracted: encapsulates the three-mode source
    selection (aggregateAll / explicit / repo-derived with auto-detect
    fallback).
  - `sessionsHaveInWindowAssistantTurns` extracted: short-circuit
    activity probe used by the auto-detect fallback path.
- **`cost-advisor.mjs::summarizeReport`** — complexity 27 cut by
  extracting `summarizeToolStats` + `computeExplorationRatio` +
  `toolCount` helpers. summarizeReport now reads as a flat data shape.

### Notes

- Lint warning count: 18 → 15.
- All 49 tests pass.

## v0.1.22 — 2026-05-22

### Changed

- **artifacts.mjs `render` complexity 79 → split.** `resolveArtifactConfig`
  now dispatches off a `SIMPLE_RENDERERS` table (7 entries) and the heavy
  cost-report renderer is split into 9 named helpers
  (`renderCostReportFrontmatter`, `renderCostReportHeader`,
  `renderCostReportOutcome`, `renderCostReportTokens`,
  `renderCostReportModelMix`, `renderCostReportConversation`,
  `renderCostReportToolUsage`, `renderCostReportToolResultSizes`,
  `renderCostReportFileReReads`, `renderCostReportByModel`).
- **`briefing/render.mjs`** — `buildBlockedOrMissing` (complexity 41 → 18)
  and `recommendedNextStep` (38 → 20) refactored to `[condition, message]`
  rule tables. Messages that need runtime data go through thunks so
  expressions are only evaluated when the condition fires.
- **`briefing/collect.mjs::collectRecentCosts`** (193 lines, complexity 64)
  split into focused helpers: `parseFrontmatterBlock`, `parseModelMix`,
  `parseToolUsage`, `computeDominantModel`, `deriveFlags`,
  `parseCostReportText`, `listCostReportFilesByMtime`. Orchestrator now
  fits in ~25 lines.
- **`workflow-state.mjs::registerWorkflowArtifact`** (complexity 28) →
  per-kind dispatch via `ARTIFACT_HANDLERS` table.
- **`workflow-state.mjs::summarizeWorkflowState`** (complexity 18) →
  pending-badge specs in `PENDING_BADGE_SPECS` table; `collectPendingBadges`
  helper.

### Notes

- Lint warning count: 18 → 15.
- All 49 tests pass.

## v0.1.21 — 2026-05-22

### Changed

- **installer.mjs full split (Tier #10)**: extracted 5 more cohesive
  submodules from the residual installer.mjs. Now 11 files total under
  `scripts/lib/installer/`, each ≤ 110 lines and single-concern:
  - `claude-md.mjs` (67) — CLAUDE.md create / legacy-marker upgrade /
    idempotent re-run / append-on-no-marker.
  - `gitignore.mjs` (38) — `# crew:start`/`# crew:end` block create or
    in-place replace.
  - `harness-files.mjs` (90) — README + hook script refresh + state
    seed-if-missing + artifact / log directory tree.
  - `repo-guides.mjs` (28) — `.claude/crew/constitution.md` +
    `workflow.md` + `protocol.md` write.
  - `welcome.mjs` (30) — post-install message shape, pure data.
  - `audit.mjs` (24) — read-only repo + global presence check.
  - `global.mjs` (110) — `inspectGlobalInstall` + `installGlobal` +
    `GLOBAL_IMPORT_LINES` + `globalPaths`.
- `scripts/lib/installer.mjs` is now 72 lines (was 397; was 1040 before
  the Tier B-5 splits started). Just the public API:
  `bootstrapRepo`, `initRepo` + re-exports for `auditRepo` and
  `installGlobal`.
- Public surface unchanged. All 49 tests pass.

## v0.1.20 — 2026-05-22

### Changed

- **`scripts/lib/workflow-state.mjs`** — reduced complexity in five
  hot functions:
  - `hasCompletedPhaseEvidence`: 37 → 19. Extracted
    `isGateResolved(status)` + `RESOLVED_GATE_STATUSES` set;
    artifact-shape check pulled out.
  - `hasMeaningfulProgress` (25) and `isSubstantialRunHint` (24):
    artifact / gate predicates extracted into
    `hasReviewOrValidationArtifact`, `hasSubstantialArtifact`,
    `hasSubstantialGate`, `hasSubstantialMode`.
  - `summarizeMissingArtifactWritesForRun`: 43 → 23. Status checks
    folded into a `[cond, code][]` table; named `isDecided(status)`
    helper makes the intent (pass/fail, not pending or skipped)
    explicit.
  - `applyBadge`: 18 → 1. Replaced 16-branch `if`-chain with a
    `BADGE_TABLE` registry mapping badge name → `(run) => [parent, key]`
    selector + target status. Adding a new badge is now one entry.
- **`scripts/validate-manifests.mjs`**: exports `validateManifests()`
  for in-process testing. Entry-point check uses `process.exitCode`
  instead of `process.exit(1)` so `await import` doesn't kill the
  caller.
- **`scripts/lib/wakeup.mjs`**: dropped dead `resolvedSprintPath`
  computation (lint `no-unused-vars`).
- **`scripts/lib/workflow-state.mjs`**: dropped dead
  `workflowStateExists()`.
- **`scripts/lib/cost-advisor.mjs`**: dropped unused `base` parameter
  in `cache-busted` rule trigger.

### Added

- **`docs/standards/code-conventions.md`**: per-repo coding conventions adapted
  from `Astragenie.Standards/typescript/coding-conventions.md` for
  plain ESM. Anchors the lint rules to their reasoning.

### Notes

- Lint warning count: 20 → 17.
- All 49 tests pass.

## v0.1.19 — 2026-05-22

### Changed

- **briefing.mjs split (Tier B-7)**: 821-line module split along the
  natural data / render boundary.
  - `scripts/lib/briefing/collect.mjs` (515 lines): pure I/O —
    `collectGitActivity`, `collectRelevantArtifacts`,
    `collectRecentCosts`, `fetchAutonomousLoopBrief`.
  - `scripts/lib/briefing/render.mjs` (299 lines): pure data → string
    — `buildRetrievalGuide`, `buildCurrentObjective`,
    `buildBlockedOrMissing`, `buildImportantReminders`,
    `recommendedNextStep`, `buildSecondaryOptions`.
  - `scripts/lib/briefing.mjs` (88 lines, was 821): thin orchestrator.
    Public API `buildBriefingReport` unchanged.
- **marketplace**: autonomous-loop entry bumped to v0.1.15 to pick up
  the slice-linker + phase-gate splits shipped there.

Tests: 49/49 pass.

## v0.1.18 — 2026-05-22

### Changed

- **installer.mjs split (Tier B-5)**: the 1040-line mega-module is now
  399 lines. Extracted four cohesive submodules under
  `scripts/lib/installer/`:
  - `templates.mjs` (504 lines) — all string templates and constants.
  - `util.mjs` (42 lines) — filesystem + JSON helpers.
  - `settings.mjs` (61 lines) — `.claude/settings.json` hook-merge logic
    (`isCrewHook`, `mergeHooks`, `updateSettings`).
  - `legacy-migration.mjs` (89 lines) — the one-shot
    `engineering-os` → `crew` namespace migrator.
- Public API unchanged: `bootstrapRepo`, `initRepo`, `installGlobal`,
  `auditRepo` still export from `scripts/lib/installer.mjs`. All 49
  tests pass without modification.

## v0.1.17 — 2026-05-22

### Changed

- **Tooling**: ESLint 9 (flat config) + Prettier 3 added. CI now runs
  `npm ci`, `validate-manifests`, `lint`, `format:check`, `node --test`,
  `e2e-smoke` as separate gates. devDependencies pinned via
  `package-lock.json`.
- **Code style swept**: prettier --write across `scripts/**/*.mjs` and
  `tests/**/*.mjs`; no semantic changes.
- **CLI registry refactor** (`scripts/crew.mjs`):
  - 58 hand-written `if (value === "--foo") { ... }` flag branches
    collapsed into a single `FLAG_SPEC` table.
  - 30-branch command `else if` chain collapsed into a `COMMANDS`
    registry of `(ctx) => Promise<result>` handlers.
  - File size: 767 → 560 lines (-207). Same flags, same outputs,
    same error messages. Adding a new command/flag is now one entry.

### Fixed

- `scripts/lib/cost-advisor.mjs`: empty `catch {}` blocks now carry
  intent comments (ESLint `no-empty`).

## v0.1.16 — 2026-05-22

### Added

- `scripts/validate-manifests.mjs`: lightweight CI gate verifying
  `plugin.json` / `marketplace.json` / `package.json` required fields,
  semver parseability, and version-drift between the three files.
  Catches the class of regression that `marketplace.json` version drift
  already caused once.
- CI: validate-manifests step runs before tests on every push/PR.
- README: test / release / license badges.
- `/crew:adopt`: explicit step 12 instructs the lead to inspect repo
  commit conventions and recommend `/crew:install-commit-bridge` when
  a matching preset applies. Stays opt-in; never auto-installs.

### Notes (not changed)

- `.gitignore` install block intentionally does NOT ignore
  `.claude/artifacts/` — artifacts are the durable record per the
  constitution and should be committed in target repos.
- Hooks audit: `log_event.sh` and the generated `commit_bridge.sh`
  are fail-closed at the shell layer (`set -euo pipefail`),
  fail-open at the JS layer (best-effort, never blocks tool output),
  use `execFileSync` (no shell) with `escapeForJsLiteral` on all
  template substitutions. No injection surface. Minor follow-up:
  `log_event.sh` has no payload-dir rotation.
- No `package-lock.json` added: zero runtime deps (Node built-ins only).

## v0.1.15 — 2026-05-22

### Changed

- README: removed stale "legacy compatibility aliases" section that
  listed five `/crew:*` commands which no longer exist (`build-feature`,
  `investigate-bug`, `bootstrap-repo`, `init-repo`, `install-global`).
- README: added optional follow-up step recommending
  `/crew:install-commit-bridge`, replacing the dead-alias block with
  real, discoverable guidance.
- `installer.mjs::buildWelcome`: returns an `optional` array with a
  one-line hint pointing at `/crew:install-commit-bridge` after `init`
  or `bootstrap`. Bridge remains opt-in; install flow is unchanged.

## v0.1.14 — 2026-05-21

### Changed

- Plugin and marketplace `author`/`owner` updated to `shishkosv` to match
  repo owner and the companion `autonomous-loop` plugin.

### Fixed

- README local-development clone URL pointed to the legacy
  `alex-radaev/engineering-os` repo; corrected to
  `sergeymilashico/hero-crew`.
- `docs/history/reference-repo-plan.md` replaced hard-coded
  `/Users/aradaev/Desktop/Projects/` paths with `<reference-repos-dir>`
  placeholders.

## v0.1.13 — 2026-05-21

### Fixed

- `bootstrapRepo` / `init` now seed `.gitignore` with a marker-bracketed
  `# crew:start`/`# crew:end` block. User lines outside the block are
  preserved; the block is replaced in place on re-install. Closes the
  e2e-smoke regression and lets the CI step run as a blocking gate.

### Infrastructure

- `e2e-smoke` promoted from `continue-on-error` to blocking in CI.

## v0.1.12 — 2026-05-21

First tagged release after accumulated 0.1.0 → 0.1.12 work.

### Fixed

- `write-final-synthesis` no longer hides top-level `path` under a `synthesis`
  key when a cost-report is also emitted. Restores the documented JSON shape
  for downstream callers and tests.
- `marketplace.json` version drift: autonomous-loop entry bumped to 0.1.12 to
  match its `plugin.json`.

### Added — accumulated since 0.1.0

- Per-slice Claude session cost tracking and `cost-advise` recommender.
- `brief-me` cost diagnostics: combined cache R/W + I/O in millions, dominant
  model, preformatted I/O and Cache R/W strings, richer `autonomousLoop`
  block, cost-diagnostics table for flagged slices.
- Tool-failure flag threshold raised to `> 3`.

### Infrastructure

- CI: `node --test` + `e2e-smoke` on push/PR (GitHub Actions).
- `.gitignore` covers `node_modules/`, `.claude/logs|state|artifacts/`,
  `.claude.backup.*`, `*.tmp`.
- Docs: removed hard-coded absolute paths in favor of `<path-to-this-repo>`
  placeholders.
- README documents marketplace install commands.
