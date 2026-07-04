# Crew Core Agents + Workflow Architecture Review

**Date:** 2026-07-04
**Reviewer:** senior AI-agent platform architect pass (repo-grounded, per mandatory inspection protocol)
**Scope:** `dev-team` repo, `crew` plugin v0.47.0, worktree `arch-review-2026-07-04`
**Method:** direct file reads + 4 parallel read-only research passes covering agents/, commands+skills+routing, evals+GEPA, and governance+CI+backlog, cross-verified against primary sources (I personally re-read `evals/lib/judge.ts`, `evals/lib/candidate-dispatch.ts`, the full GEPA design doc, `scripts/lib/gepa/auto-merge-gate.ts`, `scripts/lib/gepa/critical-agent-allowlist.ts`, both eval spec YAMLs, `evals/README.md`, `scripts/validate-agents.ts`, `package.json`, `biome.json`, `.claude/crew/deployment.md`, `docs/routing-table.md`, and the SLICE-106 backlog file directly rather than relying solely on sub-agent summaries).

Every finding below uses the required format. "Confidence: Low" is used only where I could not fully verify against primary source.

---

## 1. Current architecture summary

**What crew actually is.** A Claude Code plugin (`.claude-plugin/plugin.json`, `name: crew`, `version: 0.47.0`) — markdown agent prompts (`agents/*.md`), slash commands (`commands/*.md`), skills in four tiers (`skills/{universal,workflow,domain,meta}/`), and TypeScript CLI validators/helpers (`scripts/*.ts`). There is no `crew run <workflow>` runtime — the Claude Code harness resolves `model:` frontmatter aliases and dispatches agents; crew supplies prompts + data, not execution.

**Repo size (verified, 2026-07-04):** 23 core agents (`agents/*.md`, 4,501 total lines, avg 196/agent), 11 third-party agents (`agents/3rdparty/*.md`, unvalidated by CI), 70 `SKILL.md` files across 4 tiers, 37 command files, `docs/routing-table.md` at 188 lines, package.json version 0.47.0.

**Gate flow (build → review → validate → ship).** Two live orchestration paths:
- `/crew:build` and `/crew:fix` (`commands/build.md`, `commands/fix.md`): light-path (≤2 files/≤50 lines, no semantic markers) dispatches `crew:dev-lite` → `crew:inspector-lite`; standard path dispatches a specialist builder (`fullstack-dev`/`backend-dev`/`frontend-dev`/`aiplugin-dev`) then a parallel reviewer fan-out (`crew:inspector` + stack reviewer `crew:c-sharp-reviewer`/`crew:typescript-reviewer`).
- `/crew:orchestrate-slice` (553 lines, the largest command): full specialist ladder — classify → `architect` (contract) → `uxdesigner`+builder (parallel) → `integrator` (SPLIT_BUILD only) → tiered reviewer/validator → `document-writer` → final synthesis. Validation (`crew:verifier`) is mandatory on every code-bearing slice with **no skip path**, per `docs/routing-table.md:61` and `orchestrate-slice.md:434`. Review can be skipped only with an explicit `review_skipped --note` badge.
- `/crew:ship` runs an independent second QA+verify fan-out (`qa-expert` + `verifier`) before filing a PR, re-verifying from scratch rather than trusting the build-phase artifacts.

**Model choice at the three layers (verified):**
1. **Agent execution** — every agent's `model:` frontmatter is a Claude Code harness alias (`opus`/`sonnet`/`haiku`). No pinned model IDs found anywhere in `agents/*.md`. Confirmed via full read of all 23 core + 11 3rdparty files.
2. **Eval candidate runner** — `evals/lib/candidate-dispatch.ts:22,35`: `model?: string; /** default: claude-sonnet-4-6 */` and `const DEFAULT_MODEL = "claude-sonnet-4-6";`. Both existing eval specs (`evals/agents/crew-fullstack-dev.yaml:18`, `evals/agents/crew-inspector.yaml:18`) pin `candidate: { runner: claude-p, model: claude-sonnet-4-6 }` literally in YAML. This is the one genuinely hardcoded model spot in the repo, confirmed by direct read.
3. **Eval judge** — `evals/lib/judge.ts`'s `JUDGE_REGISTRY` (lines 139-183, directly read) has 7 real entries: `generic-openai`, `groq`, `claude-p`, `ollama`, `gemini`, `azure`, `bedrock`. Both live specs use `judge: { provider: groq, model: llama-3.3-70b-versatile }` with `fallback: [{ provider: gemini }]` and a `validate_with: [{ provider: gemini }]` cross-org triangulation tier. This layer is genuinely done and provider-agnostic.

**Where coupling already exists (good, load-bearing):** the `evals/lib/**` + `evals/providers/**` module boundary is enforced twice — a Biome `noRestrictedImports` rule (`biome.json:139-149`, verified) blocking imports from `agents/scripts/src/hooks/commands`, plus `evals/README.md:27-41`'s documented rationale (planned extraction to a standalone plugin). This is a genuinely well-built boundary.

**What already looks good:**
- The judge layer (7 providers, fallback chains, cross-org `validate_with` triangulation, daily budget cap via `dailyCapMeter`) is real, working, and matches the CLAUDE.md ground truth exactly.
- The GEPA design doc (`docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md`, 948 lines, read in full) is unusually rigorous: 25 "resolved concerns" from prior architect-reviewer/critical-thinking pushback, Zod-typed schemas for every cross-plugin contract, 6 documented kill-switches, and a real statistical soak-gate (dual clock+sample-floor, tail-risk floor, early-revert on 10pp regression).
- `scripts/validate-dispatch-graph.ts` does real cycle detection (three-color DFS) over the peer-dispatch graph with one documented bidirectional exception (`qa-expert`↔`performance-engineer`).
- ADR-002 (Bun/Node split) is a real, well-reasoned decision with alternatives considered, and the actual `package.json` scripts block matches it exactly (Bun for `test`/`test:agents`/`evals`; Node for every `validate:*` and `installer:*` script).
- The crew↔runner companion-plugin contract is genuinely loose coupling: file/CLI-based only (shared `.claude/loop.json`, shared `.claude/artifacts/loop/` tree, `node <loop-path> <subcommand>` shell-outs), zero code imports, and graceful degradation when the loop plugin isn't installed (`orchestrate-slice.md:166-171` treats an empty resolve-skills response as "no block").

---

## 2. Brutally honest problems (ranked by severity)

### Finding 2.1 — Six phantom agent names are actively dispatched or referenced, none exist on disk
**Severity:** Critical
**Confidence:** High
**Repository evidence:**
- `commands/review.md:31-32` dispatches `crew:reviewer` — `agents/reviewer.md` does not exist (`ls` confirms `No such file or directory`); the live review agent is `agents/inspector.md`.
- `commands/parallel.md:39` describes a ceremony using `crew:builder` and `crew:reviewer` — neither exists.
- `commands/orchestrate-slice.md:381,401,459` dispatch `crew:reviewer-validator` for the light tier — `agents/reviewer-validator.md` does not exist (the command has a defensive fallback at line 403, so it degrades to the full ladder, but the light-tier combined-agent path is dead code today).
- `skills/workflow/self-verify-gate/SKILL.md:122`, `skills/workflow/journey-builder/SKILL.md` (`owner: validator`), `skills/workflow/ux-validation/SKILL.md` (description says "Auto-triggered by crew:validator" ×2) all reference `agents/validator.md` / `crew:validator` — does not exist; live agent is `agents/verifier.md`.
- `.claude/crew/constitution.md` and `build.md:142`'s auto-continue gate cite `agents/deployer.md` rule 11 — does not exist; live agent is `agents/release-engineer.md`.
- **New in this pass:** `agents/inspector-verifier.md` does not exist, yet the name appears as a `MUST NOT dispatch` blacklist entry in at least 9 agent files (`architect.md:309`, `backend-dev.md:264`, `document-writer.md:173`, `frontend-dev.md:204`, `performance-engineer.md:93`, `qa-expert.md:93`, `refactor.md:217`, `release-engineer.md:275`, `uxdesigner.md:191`) and is a member of `scripts/validate-agents.ts:252-262`'s `EVALS_REQUIRED_AGENT_NAMES` set (a validator constant demanding an eval spec for an agent that doesn't exist).
**Why it matters:** this isn't stale documentation in a corner — it's load-bearing command logic (`review.md`, `parallel.md`, `orchestrate-slice.md`) and a validator constant referencing agents that were either renamed mid-flight (`docs/superpowers/specs/2026-06-30-reviewer-rename-design.md` shows a planned `inspector → reviewer` rename that was never executed) or never actually created (`inspector-verifier`, `reviewer-validator`). Anyone invoking `/crew:review` today gets an "Agent type not found" error. A new contributor reading `constitution.md`'s Team Roles table (reviewer/validator/deployer) would reasonably expect files that don't exist.
**Recommended fix:** either (a) finish the `inspector → reviewer` rename repo-wide in one atomic sweep (git mv + grep-replace every reference), or (b) revert every phantom reference back to the real names (`inspector`, `verifier`, `release-engineer`) and delete the abandoned rename-design doc. Add a CI check: every `crew:<name>` token appearing in `commands/*.md` or `skills/**/*.md` must resolve to a real `agents/<name>.md` file (this is a ~30-line addition to `scripts/validate-dispatch-graph.ts`, which already parses agent names).
**Estimated implementation effort:** S (the fix) / S (the fitness function)

### Finding 2.2 — Eval coverage for 6 of 8 declared agents is a dangling frontmatter pointer, not a missing file gap
**Severity:** High
**Confidence:** High
**Repository evidence:** `scripts/validate-agents.ts:252-262` (`EVALS_REQUIRED_AGENT_NAMES`) requires `fullstack-dev, backend-dev, frontend-dev, refactor, inspector, inspector-verifier, verifier, integrator, release-engineer` to carry an `evals:` frontmatter field. Direct grep confirms all 8 real agents declare one:
```
fullstack-dev:6:  evals: evals/agents/crew-fullstack-dev.yaml   (EXISTS)
backend-dev:6:    evals: evals/agents/backend-dev.yaml           (MISSING)
frontend-dev:6:   evals: evals/agents/frontend-dev.yaml          (MISSING)
refactor:6:       evals: evals/agents/refactor.yaml              (MISSING)
inspector:6:      evals: evals/agents/inspector.yaml             (MISSING — actual file is crew-inspector.yaml, a filename mismatch even for the "covered" agent)
verifier:6:       evals: evals/agents/verifier.yaml              (MISSING)
integrator:6:     evals: evals/agents/integrator.yaml            (MISSING)
release-engineer:6: evals: evals/agents/release-engineer.yaml    (MISSING)
```
Only `evals/agents/crew-fullstack-dev.yaml` and `evals/agents/crew-inspector.yaml` exist on disk (confirmed `ls evals/agents/`). The validator's own comment at line 284 admits this: `// TODO(FEAT-167 SLICE-B): enforce path existence here once evals/ tree lands` — it checks the field is *non-empty*, never that the path *resolves*.
**Why it matters:** the CI gate (`validate:agents`, hard-blocking per `.github/workflows/test.yml`) currently gives a false sense of eval coverage. A reviewer skimming frontmatter sees 8/9 GEPA-adjacent agents "have evals" when in reality only 2 do, and one of those two has a filename that doesn't even match its own declared pointer. This directly undermines Section 6 (Eval + GEPA analysis)'s premise that eval coverage can be assessed from frontmatter alone.
**Recommended fix:** finish FEAT-167 SLICE-B — add path-existence + YAML-parseability checks to `checkEvalsRequiredForRole` in `scripts/validate-agents.ts`. This turns a currently-cosmetic gate into a real one and will immediately fail CI until the 6 missing specs are authored (see Section 6 for what those specs should cover) or the requirement is descoped for agents that don't yet warrant a full spec.
**Estimated implementation effort:** S (validator fix) / M (authoring the 6 missing specs, tracked separately in Section 6)

### Finding 2.3 — GEPA statistical soundness: the entire live trial corpus is smaller than the design's own soak floor
**Severity:** High
**Confidence:** High
**Repository evidence:** `agents/architect/.gepa/eval/*.jsonl` = 8 files, 1 line each (8 hand-seed cases, confirmed via `wc -l`). `agents/inspector/.gepa/eval/*.jsonl` = 10 files, 1 line each (10 hand-seed cases). No other agent has a `.gepa/` directory anywhere (`find agents -type d -name ".gepa"` returns exactly these two). `.claude/artifacts/crew/gepa/trials/` — the path the design doc (line 219, 658) designates for the live `fileStore` trial log — **does not exist on disk at all** (`find` returns "No such file or directory"). The design's own `PromotionPolicy.minSoakTrials` default is **20** (design doc line 254, 311); `maxSoakDays` is 21.
**Why it matters:** the design is statistically honest on paper (dual clock+sample gate, tail-risk floor, early-revert) but the actual corpus available today (8 architect cases, 10 inspector cases, zero captured production trials) cannot supply a soak phase with 20 real trials in any reasonable window unless capture has been running silently and is simply not materialized yet — which the missing `trials/` directory rules out. A `+5%` PASS delta (`minPassDelta: 0.05`) is not reliably detectable at n=8–10 even in the eval phase (a single flipped case moves the pass rate by 10-12.5 percentage points), let alone at the n=20 soak floor for agents this low-volume. `architect` and `inspector` are also both on the **critical-agent allowlist** (draft-PR-only) — meaning even a "successful" optimization cycle for them, statistically shaky or not, never auto-merges; the risk is entirely in the eval-phase promotion signal used to decide whether to even generate a draft PR.
**Recommended fix:** (1) do not run `/crew:gepa-optimize` on `architect` or `inspector` until the hand-seed corpus grows past ~30 cases each (a single-case flip should move pass rate by <5pp to have any hope of detecting a 5pp true delta) — this is a sequential-testing problem, not a fixed-n problem; (2) adopt a sequential probability ratio test (SPRT) or a Bayesian credible-interval gate instead of a fixed +5pp/n=20 threshold, since GEPA cycles are rare/low-volume by construction; (3) treat "capture never populated `.claude/artifacts/crew/gepa/trials/`" as its own kill-switch check — `runOptimization` should refuse to soak an agent with zero captured trials rather than silently running on hand-seed data alone.
**Estimated implementation effort:** M (sequential test swap in gepa-core) / S (capture-empty guard)

### Finding 2.4 — Reviewer-cluster responsibility overlap: two files encode the same C# quality checklist under different trust postures
**Severity:** Medium
**Confidence:** High
**Repository evidence:** `agents/c-sharp-reviewer.md` (162 lines, `disallowedTools: Write, Edit, NotebookEdit`, `role: [reviewer]`) and `agents/3rdparty/c-sharp-pro.md` (87 lines, full `Write`/`Edit` access, `role: [implementer]`) both encode: no `.Result`/`.Wait()`, `CancellationToken` on every async method, no `#nullable disable`, the same banned-library list (`AutoMapper`, `Newtonsoft.Json`, `Moq`, `EFCore.InMemory`), and near-identical EF Core N+1 guidance. `docs/routing-table.md` (full read) never mentions either `c-sharp-reviewer` or `c-sharp-pro` — confirmed via grep, zero hits for either name. `c-sharp-pro.md` has zero external references anywhere in the repo outside its own file.
**Why it matters:** a `stack:csharp` review-tier slice has no documented disambiguation between the two, and one of them (`c-sharp-pro`, with write access) is unvalidated by `scripts/validate-agents.ts` (3rdparty tier is skipped entirely), meaning it could silently exceed the 350-line cap, skip the Report-contract requirement, or omit peer-dispatch discipline without CI ever noticing — and in fact its 87 lines contain no `## Report contract` section at all, which would fail validation if it were scanned.
**Recommended fix:** delete `agents/3rdparty/c-sharp-pro.md` (its checklist content is redundant with `c-sharp-reviewer.md`, and its implementer role with no CI validation is the riskier of the two duplicates) or explicitly fold its checklist into `skills/domain/backend/dotnet/` so both `c-sharp-reviewer` and `backend-dev` load the same source of truth instead of two independently-maintained copies.
**Estimated implementation effort:** S

### Finding 2.5 — Builder generalist boundaries are one-directional, not mutual contracts
**Severity:** Medium
**Confidence:** High
**Repository evidence:** `agents/fullstack-dev.md:175-182` ("Forbidden scope") explicitly carves out FE work it will NOT do and defers to `frontend-dev`, but `agents/frontend-dev.md` has no reciprocal acknowledgment that `fullstack-dev` exists or when a slice should route to it instead. `agents/dev-lite.md` has no `stacks:`/`surfaces:` capability tags at all — it cross-cuts all three stack-specific builders by size alone, meaning for any trivial edit there are up to 2 textually-valid dispatch targets (`dev-lite` vs. the matching full builder), and the actual disambiguation lives entirely in `commands/build.md`'s/`commands/fix.md`'s own routing table, copy-pasted in at least 3 places (`build.md:44-51`, `fix.md:100-107`, `orchestrate-slice.md:185-197`), only the last of which is backed by an executable classifier (`scripts/orchestrate-slice-classify.ts`).
**Why it matters:** boundary logic that exists in only one of two adjacent agents' prompts, or only in prose copied 3x, is exactly the kind of drift risk that produces silent scope creep — a future edit to `frontend-dev.md`'s scope won't be caught by anything reading `fullstack-dev.md`'s now-stale carve-out language, and a future FEAT-tag taxonomy change requires editing 3 files in lockstep with no cross-check.
**Recommended fix:** make `scripts/orchestrate-slice-classify.ts` (or a thin wrapper) the single source of truth, and have `build.md`/`fix.md` call it instead of maintaining a parallel prose copy of the same routing table (see Section 7 for the config-externalization version of this fix).
**Estimated implementation effort:** M

### Finding 2.6 — Imported 3rdparty agent-pack agents reference peers that don't exist in this repo, and one has non-Claude-Code tool names
**Severity:** Medium
**Confidence:** High
**Repository evidence:** `agents/3rdparty/frontend-developer.md`, `agents/3rdparty/mobile-developer.md`, `agents/3rdparty/refactoring-specialist.md`, and `agents/3rdparty/database-architect.md` all share an identical "Communication Protocol"/`context-manager` JSON boilerplate and reference peer agents that don't exist anywhere in this repo (`context-manager`, `postgres-pro`, `neon-database-architect`, `websocket-engineer`, `tech-lead`, `documentation-engineer`, `legacy-modernizer`, `code-reviewer`) — consistent with an unmodified drop-in from a community agent pack (e.g. `wshobson/agents`-style collections). Separately, `agents/3rdparty/expert-react-frontend-engineer.md`'s `tools:` frontmatter lists **VS Code Copilot Chat tool names** (`changes, codebase, edit/editFiles, extensions, fetch, findTestFiles, githubRepo, new, openSimpleBrowser, problems, runCommands, runTasks, runTests, search, searchResults, terminalLastCommand, terminalSelection, testFailure, usages, vscodeAPI, microsoft.docs.mcp`) — no `Read`/`Edit`/`Bash`/`Grep` at all.
**Why it matters:** if the Claude Code harness enforces the `tools:` allowlist literally, `expert-react-frontend-engineer` cannot actually read, write, or execute anything when dispatched — yet `uxdesigner.md`'s delegation map routes real React component work to it (§5 agent scorecard). This is a live routing target that may be silently non-functional. The peer-reference agents (`frontend-developer`, `mobile-developer`, `refactoring-specialist`) will produce handoff prose naming agents the dispatcher can't actually invoke, confusing whoever reads the transcript.
**Recommended fix:** audit `expert-react-frontend-engineer.md`'s actual tool access with a live smoke dispatch before trusting it in the delegation map; rewrite its `tools:` frontmatter to Claude Code names. For the peer-reference cluster, strip the foreign "Communication Protocol" boilerplate and replace invented peer names with this repo's real agents, or mark them clearly as reference-only / non-dispatchable in a header comment.
**Estimated implementation effort:** S (frontmatter fix) / M (full peer-reference cleanup across 4 files)

### Finding 2.7 — Routing table is stale relative to the live agent/skill roster, and its CI gate is advisory-only
**Severity:** Medium
**Confidence:** High
**Repository evidence:** `docs/routing-table.md` was last touched in commit `3232bf6` (2026-06-30); at least 4+ commits have landed since. Agents that exist but are never mentioned in the table: `aiplugin-dev`, `architect-reviewer`, `c-sharp-reviewer`, `dev-lite`, `inspector-lite`, `performance-engineer`, `typescript-reviewer` (7 of 23 core agents — 30%). Skill directories with zero mentions: `contract-codegen`, `builder-mindset`, `engineering-standards`, `writing-claude-md`, `writing-task-handoffs`, `builder-ceremony`, `dispatcher-orchestration`, `dispatcher-routing`, `fan-out-review`, `fix-pr`, `fullstack-cross-layer`, `integration-smoke`, `journey-builder`, `release-recovery`, `risk-tier`, `self-verify-gate`, `validator-gate`. `scripts/validate-routing-table.ts` only fires when `CREW_VALIDATE_ROUTING_TABLE=1` is set (confirmed: `.github/workflows/test.yml`'s `advisory-validators:` block), and even then it only validates that cited `plugin:skill` tokens resolve and that (role, skill) pairs match each agent's "### Skills you consult" block — it does **not** detect an agent that's simply absent from the table.
**Why it matters:** the prompt's own framing ("routing-table fragility — markdown parsed by an LLM") is confirmed, but the specific failure mode is *staleness*, not parse-fragility — the LLM dispatcher reads a table missing 30% of the current agent roster and has to fall back to "dispatcher judgment" (per `docs/architecture/architecture.md:97`) for anything not listed, silently, with no signal that the table is incomplete.
**Recommended fix:** see Section 7 (config externalization) — turn the routing table into a generated view over a machine-readable source, with a CI check that every `agents/*.md` basename appears in at least one row (cheap, mechanical, catches this exact staleness class).
**Estimated implementation effort:** S (staleness check) / M (generated-view migration)

### Finding 2.8 — `validate-typegraph.ts` is dead weight duplicating a real blocking gate
**Severity:** Low
**Confidence:** High
**Repository evidence:** `scripts/validate-typegraph.ts` always exits 0 regardless of type errors (comment: "advisory in Phase 0... does not fail the build yet"; "Becomes blocking in Phase 5 once every .mjs has migrated"). `package.json`'s `typecheck` script (`tsc --noEmit`) already runs as a **blocking** step in the `bun-commands` bucket of `.github/workflows/test.yml`. The repo has already fully migrated off `.mjs` to `.ts` (confirmed: `ls scripts/*.mjs` → none exist; every script is `.ts`).
**Why it matters:** this script's stated graduation condition ("once every .mjs has migrated") has already been met, but nobody flipped it to blocking or removed it — it's pure maintenance overhead that looks like a fitness function but does nothing.
**Recommended fix:** delete `scripts/validate-typegraph.ts` and its `advisory-bun-commands` CI entry; the real `bun run typecheck` already covers this.
**Estimated implementation effort:** S

### Finding 2.9 — `validate-adr-template.ts` exists, enforces nothing in CI, and would fail both existing ADRs if it ran
**Severity:** Low
**Confidence:** High
**Repository evidence:** `scripts/validate-adr-template.ts` (181 lines) is never referenced in `.github/workflows/test.yml` (confirmed via grep — zero hits) despite existing on disk and defaulting to `--advisory` mode. It expects a `## Options Considered` heading with `### Option N:` H3 sub-entries; both `docs/architecture/decisions/ADR-001-*.md` and `ADR-002-bun-runtime-no-go.md` use `## Alternatives considered` with a bullet-list style instead — a heading-name mismatch, not a content gap (both ADRs do have real alternatives-considered content).
**Why it matters:** a governance-track SLICE grade artifact (`.claude/artifacts/loop/grades/20260620T094433Z-slice87-grade.md:54,58`) already flagged this exact mismatch and proposed a ~30-minute backfill — that work was never done, and the validator was never wired into CI even in advisory mode, so the gap has been sitting silently for at least two weeks.
**Recommended fix:** either rename the validator's expected heading to `## Alternatives considered` (matches existing convention, zero-cost) or do the 30-minute backfill on both ADRs and standardize on `## Options Considered` going forward; wire the validator into `advisory-validators:` either way so future ADRs get real signal.
**Estimated implementation effort:** S

### Finding 2.10 — Marketplace/backlog process-discipline gap: most of the "triaged" backlog tree is actually already shipped
**Severity:** Medium
**Confidence:** High
**Repository evidence:** Of 14 files in `.claude/artifacts/loop/backlog/triaged/`, cross-referencing against `git log --oneline` shows FEAT-183, FEAT-186, and SLICE-100/101/102/109/110/111/112/113/114 all have matching "shipped" commits already landed (e.g. SLICE-111 commit `6b8c0d0`, SLICE-112 commit `c9912ff`, SLICE-113 commit `377041d`, SLICE-114 commit `3abef8f`) — only FEAT-181, FEAT-182, and the genuinely-partial FEAT-185 remainder represent real open work. `docs/superpowers/specs/2026-07-04-crew-architecture-review-prompt.md`'s own ground-truth section (line 59-61) correctly describes FEAT-185/186 as in-flight in prose, but the machine-readable `triaged/` tree disagrees with reality.
**Why it matters:** `scripts/validate-loop-state.ts` checks tree uniqueness/shape but not "is this file's status accurate" — nothing catches a slice-close ceremony that updates git but never moves/removes the backlog file. Anyone consulting `triaged/` programmatically (a future dashboard, a wave planner, the loop's `runner:auto`) will see 9 phantom "not yet done" items.
**Recommended fix:** run the proper close ceremony (`/loop:slice complete` + file move to `done/`) retroactively for every already-shipped triaged item; add a lightweight CI/cron check that diffs `triaged/`'s slice IDs against `git log --grep` hits for "close SLICE-NN" commit messages and flags mismatches.
**Estimated implementation effort:** S (retroactive cleanup) / S (drift-detection check)

### Architecture risk matrix

| Risk | Probability | Impact | Cost to fix | Priority |
|---|---|---|---|---|
| Phantom agent names (`crew:reviewer`, `crew:validator`, `crew:builder`, `crew:reviewer-validator`, `agents/deployer.md`, `inspector-verifier`) break live dispatch paths | High (already broken for `/crew:review`) | High | S | **P0** |
| Eval coverage gate is cosmetic (frontmatter-only, no path check) | High (confirmed today) | Medium | S | P1 |
| GEPA soak/promotion statistics run on n=8–10 corpus vs n=20 design floor | Medium (only fires when someone runs `/crew:gepa-optimize` on architect/inspector) | High (could promote/reject on noise) | M | P1 |
| Routing table 30% stale on agent roster | High (confirmed) | Medium (dispatcher falls back to judgment silently) | S–M | P1 |
| Reviewer/builder boundary duplication (c-sharp-reviewer/c-sharp-pro, fullstack-dev/frontend-dev) | Medium | Low–Medium | S–M | P2 |
| 3rdparty agent pack has non-functional tool names / foreign peer references | Low-Medium (only if actually dispatched) | Medium | S–M | P2 |
| Backlog `triaged/` tree drift from git reality | Medium | Low (confusing, not breaking) | S | P2 |
| Dead validator (`validate-typegraph.ts`) / unwired validator (`validate-adr-template.ts`) | Low | Low | S | P3 |

---

## 3. Architecture decision review

| Decision | Verdict | Reasoning |
|---|---|---|
| **Bun for test runner, Node for CLI/consumer runtime (ADR-002)** | **KEEP** | `docs/architecture/decisions/ADR-002-bun-runtime-no-go.md` gives a real alternatives-considered analysis; `package.json`'s scripts block matches it exactly today (verified). No drift found. |
| **Agent prompt cap ≤350 lines, CI-enforced (`validate-agents.ts`)** | **KEEP**, with a **MODIFY** on scope | The cap itself is sound and actively enforced (`MAX_LINES = 350`, confirmed). But it applies only to `agents/*.md`, not `agents/3rdparty/*.md` — `agents/3rdparty/database-architect.md` is 689 lines and `expert-react-frontend-engineer.md` is 746 lines, both nearly 2x the core cap, with zero CI visibility. Propose: either fold 3rdparty agents into the same validator (with a documented `role:` exemption if genuinely needed) or explicitly document that 3rdparty is "vendored, not maintained to repo standard" so nobody mistakes silence for a passing grade. |
| **Skill tier taxonomy (universal/workflow/domain/meta)** | **KEEP** | Clean, well-modeled, actively validated (`scripts/validate-skills.ts`, tier enum + line cap + frontmatter checks all confirmed real). The 4-tier precedence model in `docs/architecture/architecture.md:26-32` is coherent. |
| **Routing via markdown table + dispatcher judgment (no LLM classifier, no config map)** | **MODIFY** | The "no DSL, no classifier" call was right when the roster was small; at 23 agents / 70 skills the table is already 30% stale on agent coverage (Finding 2.7) and copy-pasted 3x for the builder-routing subset (Finding 2.5). Keep the "no LLM classifier" half; modify the "prose-only, hand-maintained" half toward a generated view over machine-readable source (Section 7). |
| **Peer-dispatch as prose in agent files + DAG-cycle validator only (FEAT-163)** | **MODIFY** | Cycle detection is real and works (`validate-dispatch-graph.ts`, confirmed). But the constitution's hard rule ("review/validation gates stay orchestrator-only, no agent may dispatch its own reviewer") has **zero automated enforcement** — nothing stops a future edit from adding `inspector`/`verifier` to some agent's whitelist; only a resulting cycle would be caught, and a one-way edge to a reviewer wouldn't necessarily create one. Propose adding an explicit "no whitelist may include a review/validation-gate agent" check alongside the existing cycle check — this is additive to code that already parses the whitelist. |
| **GEPA critical-agent allowlist hard-coded in `scripts/lib/gepa/critical-agent-allowlist.ts` (not configurable in v1)** | **KEEP** | Deliberate per design line 44 and the SLICE-106 backlog file's own risk note ("if operator's repo has different agents that should be treated as critical, they'd need a code change... document as v1.1 deferral"). This is a correct safety-first default — configurability here is exactly the kind of footgun that should require a code review, not a config edit. |
| **`.claude/artifacts/` committed as durable cross-machine history** | **KEEP** | Confirmed working as designed — 128 files in `done/`, real audit trail (SLICE-65 namespace-correction bounce referenced across multiple artifact kinds). The volume is manageable today; flag for revisit at 3-year scale (Section 14). |
| **Marketplace manifest lives in central `astra-marketplace` repo, not per-plugin** | **KEEP**, with a **gap flagged** | Confirmed no local `marketplace.json` (only `.claude-plugin/plugin.json`). The cross-repo version-sync invariant (dev-team version ↔ registry version) has **zero automated CI enforcement anywhere** — it's a manual "HARD RULE" process in CLAUDE.md only. This is a real governance gap, not a wrong decision — the centralization itself is fine, but nothing catches a forgotten registry bump. |
| **`docs/architecture/architecture.md` as the canonical architecture doc** | **DEPRECATE-then-refresh** | Confirmed stale in 3 places: (1) line 21 "five active roles" describes the pre-specialist-split Phase-1 baseline, not the current 23-agent roster; (2) line 11 cites a 300-line cap that contradicts both `governance.md`'s own cap-history and the code's actual `MAX_LINES = 350`; (3) lines 166-176's "Tooling gates" section describes a 2-validator `.mjs`-era CI setup that bears no resemblance to the current 15-validator `.ts` setup. Don't remove the doc — its composition formula, skill-tier table, and memory-tier table are still correct and valuable — but it needs a refresh pass, not a deprecation. |
| **`.claude/crew/deployment.md`'s 9-step CI gate list** | **MODIFY** (refresh) | Same staleness pattern: cites `.mjs` extensions, `npm run lint`/`node --test` (pre-Biome/pre-Bun), and a `marketplace.json` update step that references a file confirmed not to exist in this repo. Needs the same refresh as architecture.md. |
| **Reviewer-rename (`inspector` → `reviewer`) design doc** | **REMOVE or FINISH** | `docs/superpowers/specs/2026-06-30-reviewer-rename-design.md` proposed a rename that was partially wired into `commands/review.md`/`orchestrate-slice.md` but never executed on the agent file itself (Finding 2.1). This is the most urgent item in this whole review — pick a direction and execute atomically. |

---

## 4. Coupling analysis

**Agent → skill (hard references).** Verified via full-text agent reads: most core agents reference skills by directory path in a `### Skills you consult` section (this is also what `validate-routing-table.ts`'s Pass 2 cross-checks). Examples: `architect.md` → its own delegation-map skills; `uxdesigner.md` → `agents/3rdparty/expert-react-frontend-engineer.md` (cross-tier agent→agent reference, unusual); `verifier.md:18-54` carries a "pre-loaded-universals" hash-drift check unique to that agent (validated by `validate-agents.ts:464`). This coupling is load-bearing and intentional — keep it, but note it's currently the *only* agent with that drift check (an inconsistency: why not all agents that load universal skills?).

**Skill → command (skills assuming prior commands ran).** `skills/workflow/self-verify-gate/SKILL.md` explicitly assumes `commands/orchestrate-slice.md` gates on its "## Self-Verify Gates" output section — a skill authored with a specific command's consumption contract in mind, not generically reusable. `skills/workflow/validator-gate/SKILL.md` similarly assumes the `/crew:verifier` dispatch decision flow. This is acceptable coupling (workflow-tier skills are explicitly "phase-invoked" per the taxonomy) but should be documented as such rather than discovered by reading both files side by side.

**Command → routing (commands parsing/depending on routing-table content).** Confirmed: **none of the 34 crew-native commands directly parse `docs/routing-table.md`** (grep across `commands/` returns zero hits for "routing-table"). Instead, `build.md`/`fix.md`/`orchestrate-slice.md` each inline their own copy of the FEAT-tag → builder routing table (Finding 2.5) — meaning the markdown routing-table file is consumed by the human/LLM dispatcher reading it as prose context, not by any command's executable logic. This is actually a *positive* finding for fragility (no code path breaks if the table's prose format changes) but a *negative* finding for staleness detection (nothing mechanical notices when the table drifts from the 3 command-embedded copies).

**Routing → peer dispatch (routing rows assuming specific whitelists).** No direct coupling found — the routing table describes *what agent to dispatch for a signal*, while peer-dispatch whitelists describe *who that agent may itself dispatch afterward*. These are orthogonal today, which is good (a routing-table edit can't accidentally violate a peer-dispatch invariant), but it also means nobody has cross-validated that every routing-table destination agent's own peer-dispatch section is internally consistent with what the table row implies it should do next.

**Plugin → companion plugin (crew ↔ runner).** Confirmed loose: file/CLI contract only (`.claude/loop.json`, `.claude/artifacts/loop/`, `node <loop-path> <subcommand>` shell-outs, `dispatchInstructionBlock` JSON via `jq`). Zero code imports found. Graceful degradation confirmed (`orchestrate-slice.md:166-171`). This is the single cleanest coupling boundary in the whole repo — a template for how the eval-plugin extraction (Section 14) should eventually look.

**Single points of failure identified:**
1. `scripts/validate-agents.ts` and `scripts/validate-dispatch-graph.ts` each maintain an **independently hardcoded** agent allowlist (`PEER_DISPATCH_ALLOWLIST` in the former, a separate hardcoded walk in the latter) with a comment acknowledging they "must be kept in sync" — no automated cross-check exists. A future edit to one without the other silently desyncs.
2. `docs/routing-table.md` is a single monolithic file with no per-section ownership — at 500+ agents (Section 14) this becomes a merge-conflict hotspot.
3. `evals/agents/*.yaml` + `agents/*.md`'s `evals:` frontmatter pointer is a two-file contract with no existence check (Finding 2.2) — a single point of silent failure for the entire eval-coverage claim.

**Circular dependencies:** none found in the dispatch graph (the DAG validator's job, confirmed passing). No circular agent→skill→agent loops found either.

---

## 5. Agent scorecard

Scoring legend — Overlap: none/low/medium/high with named agent(s). Prompt quality: assessed against the agent's own stated scope + evidence of stale/dangling references. Model tier fit: does the assigned tier match the reasoning load implied by the role.

| Agent | Responsibility | Overlap (with whom) | Prompt quality | Eval coverage | Model tier fit | Recommendation |
|---|---|---|---|---|---|---|
| `architect.md` | Design/ADR authoring, delegation map | Low (clean split vs architect-reviewer/database-architect/critical-thinking) | High — near cap (343/350) but clean | None (dangling `evals:` pointer, Finding 2.2) | opus — fits (design reasoning) | keep; author real eval spec |
| `architect-reviewer.md` | Independent design review | None (explicitly self-scoped away from inspector/architect) | High, clean boundary language | None declared | opus — fits | keep |
| `backend-dev.md` | .NET/EF Core implementation | Low vs fullstack-dev (stack-disjoint) | High | Dangling pointer (Finding 2.2) | sonnet — fits | keep; author eval spec |
| `c-sharp-reviewer.md` | .NET stack-quality review | **High vs `3rdparty/c-sharp-pro.md`** (Finding 2.4) | Medium (duplication) | Not in required set | sonnet — fits | keep; delete or fold in c-sharp-pro |
| `cloud-architect.md` | Cloud infra design | Low | High (recently compressed per commit `3232bf6`) | None declared | opus — fits | keep |
| `dev-lite.md` | ≤2-file mechanical edits | Medium (size-tier overlap with all 3 builders, Finding 2.5) | High, tight scope | Not required | sonnet — arguably haiku-eligible given trivial scope | keep; consider haiku tier for cost |
| `document-writer.md` | Docs/CHANGELOG/ADR write-up | Low | High | Not required | haiku — fits (low-reasoning, high-volume) | keep |
| `frontend-dev.md` | React/TS implementation | Medium vs fullstack-dev (one-directional carve-out, Finding 2.5), vs `3rdparty/expert-react-frontend-engineer.md` (uxdesigner delegation) | High | Dangling pointer | sonnet — fits | keep; author eval spec |
| `fullstack-dev.md` | Astra-plugin-ecosystem generalist | Medium (see above) | High, has GEPA eval coverage (real) | **Real** (`crew-fullstack-dev.yaml`) | sonnet — fits | keep |
| `inspector-lite.md` | Light-tier single-pass review | By-design overlap with inspector (size-tiered variant) | High | Not required | sonnet — fits | keep |
| `inspector.md` | Full correctness/regression review | Medium vs typescript-reviewer/c-sharp-reviewer (by-design, documented disclaimers, Finding 2.4 residual overlap) | High, has GEPA eval + `.gepa/` corpus | **Real** (`crew-inspector.yaml`) but dangling frontmatter pointer names wrong file | sonnet — critical-agent, arguably opus-eligible given compounding blast radius | keep; consider opus tier given critical-agent status |
| `integrator.md` | Live FE/BE smoke wire-up | Low (explicit non-overlap w/ verifier, designed handoff) | High | Dangling pointer | sonnet — fits | keep; author eval spec |
| `investigator.md` | Cheapest read-only locator | Low vs researcher (depth/cost tier split, clean) | High | Not required | haiku — fits | keep |
| `parallel-runner.md` | N-worktree parallel dispatch | **Orphaned** — routing-table says Path A (`/crew:parallel`) supersedes it; only referenced as a blacklist entry elsewhere | Medium (has `Agent` tool + dispatches constantly but no `## Peer dispatch` section, not in validator's allowlist) | Not required | opus | **demote-to-skill or delete** — dead code per Finding evidence in agent-research pass |
| `performance-engineer.md` | Latency/perf analysis | Low (bidirectional w/ qa-expert, documented exception) | High | Not required | sonnet — fits | keep |
| `qa-expert.md` | Test-coverage gap analysis | Low (clean triangulation w/ inspector/verifier) | High | Not required | sonnet — fits | keep |
| `refactor.md` | Mechanical quality sweep | Medium vs `3rdparty/refactoring-specialist.md` (different scope tier, undocumented cross-reference, Finding pattern similar to 2.4) | High | **Required** (`EVALS_REQUIRED_AGENT_NAMES`) but dangling pointer | sonnet — fits | keep; author eval spec; add one-line cross-reference to refactoring-specialist for wide-scope escalation |
| `release-engineer.md` | Release ceremony, CI/CD, deploy | Low | High | Dangling pointer | sonnet — fits | keep; author eval spec |
| `researcher.md` | Persistent-artifact investigation | Low vs investigator (clean depth split) | High | Not required | sonnet — fits | keep |
| `typescript-reviewer.md` | TS/Node/React stack review | Low-medium vs inspector (by-design, documented) | High | Not required | sonnet — fits | keep |
| `uxdesigner.md` | UX/UI design, delegation | Low, but delegates to a possibly-nonfunctional 3rdparty agent (Finding 2.6) | High | Not required | sonnet — fits | keep; verify expert-react-frontend-engineer tool access |
| `verifier.md` | Mandatory full-repo validation gate | Low (clean vs integrator/qa-expert) | High, near cap (344/350) | **Required**, dangling pointer | sonnet — critical-agent, arguably opus-eligible | keep; author eval spec |
| `aiplugin-dev.md` | Meta: plugin/skill/agent authoring | Low | High | Not required (excluded from GEPA v1 by design, "recursive eval" deferred) | sonnet — fits | keep |

**3rdparty tier:**

| Agent | Responsibility | Overlap | Prompt quality | Eval coverage | Recommendation |
|---|---|---|---|---|---|
| `c-sharp-pro.md` | C# quality checklist (implementer) | **High vs c-sharp-reviewer** (Finding 2.4) | Low — no Report-contract, unvalidated | None | **delete** — fold checklist into a shared skill |
| `critical-thinking.md` | Pre-design Socratic challenger | None (clean, read-only) | High | None | keep |
| `database-architect.md` | DB design/DDL | None (clean subordinate to architect) | High but 689 lines, uncapped | None | keep, but consider a 3rdparty line-cap policy |
| `expert-react-frontend-engineer.md` | React component architecture | Medium vs frontend-dev (uxdesigner delegation target) | **Low** — VS Code tool names, may be non-functional (Finding 2.6) | None | **fix tool frontmatter or demote-to-skill** |
| `flutter-ui-developer.md` | Flutter/Dart UI | Shadowed by mobile-developer | Medium | None | **delete** — zero routing-table references, superseded |
| `frontend-developer.md` | Multi-framework (React/Vue/Angular) FE | Low-medium (breadth mostly unused) | Medium — foreign peer-reference boilerplate | None | demote-to-skill or trim to what's actually routed |
| `mobile-developer.md` | Cross-platform mobile | None (confirmed live routing target) | Medium — foreign peer references | None | keep, clean peer references |
| `playwright-tester.md` | MCP-driven E2E writer | None | High, tight scope | None | keep (zero refs today, but small/clean — low cost to retain) |
| `refactoring-specialist.md` | Deep architectural refactor | Medium vs refactor.md (different scope tier, Finding pattern) | Medium — foreign peer references | None | keep, clean peer references, add cross-ref from refactor.md |
| `test-automator.md` | Test implementation (post-qa-expert) | Low (clean downstream position) | Medium | None | keep — weak live-wiring, consider promoting to core if used more |
| `ui-ux-designer.md` | Community-licensed UI/UX critique | Low | High (explicit attribution, real import) | None | keep |

**Semantic prompt duplication estimate:**
- **High (>40%) — extraction mandatory:** `c-sharp-reviewer.md` ↔ `c-sharp-pro.md` (C# quality checklist, Finding 2.4) → extract to `skills/domain/backend/dotnet/quality-checklist` (new) or fold into existing `skills/domain/backend/dotnet/aspnetcore-patterns/SKILL.md`.
- **Medium (20-40%) — extraction recommended:** the FEAT-tag → builder routing table copy-pasted across `build.md`/`fix.md`/`orchestrate-slice.md` (Finding 2.5) → extract to the machine-readable routing source proposed in Section 7. Also: the 4 "communication protocol" 3rdparty agents (`frontend-developer`, `mobile-developer`, `refactoring-specialist`, `database-architect`) share near-identical foreign boilerplate → not worth a shared skill (they're vendored, not repo-native), but worth stripping.
- **Low (<20%) — acceptable:** the reviewer-disclaimer language ("Distinct from crew:inspector...") repeated near-verbatim across `typescript-reviewer.md`/`c-sharp-reviewer.md`/`architect-reviewer.md` — this is intentional boundary-documentation, low duplication cost, and arguably *should* be repeated for clarity at the point of use rather than extracted.

---

## 6. Eval + GEPA analysis

### Coverage gap

Of the 6 GEPA v1 target agents (design doc line 16: `fullstack-dev`, `backend-dev`, `frontend-dev`, `verifier`, `inspector`, `architect`), only **`fullstack-dev`** and **`inspector`** have a real, existing eval spec file (`evals/agents/crew-fullstack-dev.yaml`, `evals/agents/crew-inspector.yaml`, both read in full). `backend-dev`, `frontend-dev`, `verifier`, `architect` — 4 of 6 GEPA v1 targets — have **no** eval spec at all, despite `architect` and `inspector`/`verifier` additionally being on the GEPA critical-agent allowlist (the agents whose optimization cycles matter most for blast-radius reasons).

Beyond the 6 GEPA targets, `scripts/validate-agents.ts`'s broader `EVALS_REQUIRED_AGENT_NAMES` set (9 agents: adds `refactor`, `inspector-verifier` [phantom, Finding 2.1], `integrator`, `release-engineer`) is even less covered — 7 of 9 required agents have a dangling `evals:` frontmatter pointer with no backing file (Finding 2.2).

**Proposed fixtures per missing agent**, sized to match the existing two specs' pattern (identity-anchor + scope-boundary + adversarial-leak + domain-behavior tests):

| Agent | Proposed fixture set | Rationale |
|---|---|---|
| `backend-dev` | identity-anchor (`"backend-dev"` not `"Claude Code"`), FE-forbidden-scope-guard (mirrors fullstack-dev's, but for backend refusing to touch `.tsx`), N+1-detection-in-own-code (does it self-catch an EF Core N+1 it just wrote), lead-leak-resilience v2-v4 (reuse fullstack-dev's adversarial fixtures verbatim — the attack surface is identical) | Backend-dev shares fullstack-dev's builder-role attack surface; fixtures should be near-copies with agent-name substitution, cutting authoring time ~60%. |
| `frontend-dev` | identity-anchor, BE-forbidden-scope-guard (refuses `.cs`/API work), a11y-checklist-applied (does it flag missing `alt`/aria attributes in its own generated markup), lead-leak-resilience v2-v4 (reused) | Same pattern as backend-dev. |
| `verifier` | mandatory-full-gate-not-skipped (does it refuse a request to skip lint/typecheck/test), false-pass-detection (given a fixture where tests "pass" but assert nothing meaningful, does it flag `weak_assertion`), evidence-before-verdict (does it cite actual command output rather than asserting PASS from memory) | Verifier's core risk is false-pass, not identity leak — fixtures should target that directly rather than reusing the builder-cluster attack fixtures. |
| `architect` | design-vs-implementation-boundary (given a request that asks for code, does it produce a design artifact and defer implementation), ADR-quality (given a locked-decision scenario, does it produce a real "Options Considered" section, tying directly into Finding 2.9's template-conformance gap), delegation-map-correctness (given a DB-schema request, does it route to database-architect rather than designing the schema itself) | Architect already has 8 hand-seed cases in `.gepa/eval/` — these should be *promoted* into a real `evals/agents/architect.yaml` spec rather than left as GEPA-only seed data with no independent eval-CLI coverage. |

### Promotion policy — statistical honesty at current corpus size

Confirmed exact thresholds from the design doc (`docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md:307-316`, `250-259`): `minPassDelta: 0.05`, `minCaseScoreFloor: 0.6`, `soakPercent: 0.10`, `soakDays: 7`, `minSoakTrials: 20`, `maxSoakDays: 21`, `soakEpsilon: 0.02`.

Confirmed exact corpus size (direct `wc -l`): `agents/architect/.gepa/eval/*.jsonl` = 8 files × 1 line = **8 cases**. `agents/inspector/.gepa/eval/*.jsonl` = 10 files × 1 line = **10 cases**. No `.gepa/` directory exists for any other agent. `.claude/artifacts/crew/gepa/trials/` (the live captured-trial path per design doc line 219/658) **does not exist on disk** — zero captured production trials have accumulated.

**Is a +5% PASS delta detectable at n=20 soak trials?** Approximate binomial-proportion reasoning: at n=20, the standard error of a pass-rate estimate near p=0.7-0.8 is roughly √(p(1-p)/n) ≈ 0.09-0.10 (9-10 percentage points) — a full standard deviation *larger* than the 5pp effect size the gate is trying to detect. The `soakEpsilon: 0.02` tolerance and `minCaseScoreFloor: 0.6` tail-risk gate provide real protection against *catastrophic* regressions, but the headline "+5% PASS delta" claim is **not reliably detectable at n=20** in the statistical sense — you'd need roughly n≈150-300 per arm for a well-powered 5pp detection at typical pass rates, or you accept that the gate is really a **coarse regression screen** (catches ≥15-20pp swings reliably) dressed in "+5%" language. This is not a flaw unique to this design — it's a known tension in the design doc itself (Resolved Concern C13 already acknowledges "n=3 over 7 days is statistical theatre" and added the sample floor) — but the floor of 20 is still under-powered for the stated 5pp target, just less theatrical than n=3.

**Proposed fix — statistically honest threshold options (pick one):**
1. **Reframe the target, don't change the mechanism**: keep n=20 but relabel the gate's actual detectable effect size honestly (e.g. "catches ≥12-15pp regressions with 80% power at n=20"; keep 5pp as an aspirational target for high-volume agents where soak naturally accumulates more trials over the 7-21 day window).
2. **Sequential test**: replace the fixed dual-clock-and-sample gate with a Sequential Probability Ratio Test (SPRT) against H0: no improvement vs H1: ≥5pp improvement — this lets low-volume agents run longer (up to `maxSoakDays`) while still stopping early on a clear signal, and gives a real p-value/likelihood-ratio instead of a point-in-time percentage comparison. This is the statistically correct fix and fits cleanly into the existing `soakMonitor` interface (same inputs: rolling trial stream, two rates to compare) — an additive change, not a rewrite.
3. **For `architect`/`inspector` specifically** (both n<20 in eval phase already, both critical-agent-allowlisted so never auto-merge anyway): skip the auto-merge statistical question entirely — the promotion decision for these two only ever produces a **draft PR** for human review (per the critical-agent allowlist), so the statistical bar can be lower ("does this look plausibly better," reviewed by a human) rather than the auto-merge-grade bar. Document this explicitly so nobody mistakes the current n=8/n=10 corpus as inadequate for its *actual* use (human-reviewed draft PR signal) versus its *stated* use (auto-merge gate, which these two agents never reach).

### Judge triangulation

Confirmed from both live specs: primary judge = `groq` (`llama-3.3-70b-versatile`, temperature 0.0), fallback = `gemini` (`gemini-2.5-flash`), and a separate `validate_with: [{ provider: gemini, model: gemini-2.5-flash }]` cross-org triangulation tier that "fires on judge disagreement OR `--validate` flag. Off by default" (comment in both YAMLs, line 29). Notably the comment also documents a **removed** provider: "ollama-local removed 2026-06-29: llama3.1:8b too small for behavioral meta-rubrics (quote-to-refuse vs adopt)" and "claude-p removed from judge role to avoid Anthropic-family bias when judging a Claude candidate" — both are evidence of real operational learning already captured in the specs themselves.

**Correction to an earlier pass of this analysis:** per-test disagreement telemetry already exists and is more built-out than initially assessed. `evals/lib/run-eval.ts:87-90` defines `TestResult.disagreement?: boolean` ("present when disagreement flow ran"); `runValidateWith()` (run-eval.ts:176-243) computes it — `validate_with` only fires validation entries "when `forceValidate` OR there was a disagreement" (line 238-243) — and the result is threaded into `evals/lib/langfuse-emit.ts:43,144-145`, which passes `disagreement` into every Langfuse trace's metadata. So the primary-vs-validate agreement/disagreement signal is captured per-test-run today, real and wired to observability (Langfuse), not absent.

**What's still genuinely missing** is an *aggregated* disagreement-rate trigger across runs — nothing currently computes "trailing N-run disagreement rate for agent X" or uses it to change future behavior; each `disagreement` flag is per-test-run only. **Proposed addition:** a small aggregator (reads Langfuse trace history or a local rollup of `TestResult.disagreement` values) that computes a trailing-20-run disagreement rate per agent, and if it exceeds 15%, auto-flips that agent's `validate_with` from "off by default, fires on disagreement" (today's behavior, confirmed above) to "always on" until a human resets it. This is additive to already-working plumbing — only the trailing-rate aggregation and the auto-flip persistence are new.

### Cross-provider champion robustness (the model-agnostic eval question)

Confirmed: `evals/lib/candidate-dispatch.ts` has exactly one candidate runner (`claude -p` subprocess, `evals/providers/claude-p.ts`), with `DEFAULT_MODEL = "claude-sonnet-4-6"` hardcoded (line 35) and no `CREW_MODEL_PROFILE`-style env override anywhere in `evals/` (confirmed via grep — zero hits). This is the one spot in the whole model-tier analysis that's genuinely hardcoded, exactly as the ground-truth section predicted.

**Experiment design for "does a GEPA-evolved prompt optimized under a Claude candidate hold up under a Codex/GPT candidate":**
1. **Add a second candidate dispatcher** (`evals/lib/candidate-dispatch-openai.ts` or a generic `candidate-dispatch.ts` refactor taking a `runner: "claude-p" | "codex-p" | "generic-openai-p"` discriminant) that shells out to whatever CLI/API the target harness exposes, mirroring `dispatchCandidate`'s contract (`agentPromptPath`, `fixtureContent` in → `candidateOutput` out). The existing `parseStreamJson` logic is Claude-Code-specific (stream-json NDJSON shape) — a Codex-candidate adapter needs its own response-parsing function, not a shared one.
2. **Add `candidate.runner` as a first-class per-spec field already partially there** — both existing YAMLs already declare `runner: claude-p` (line 17); extending `JUDGE_REGISTRY`'s sibling concept to a `CANDIDATE_REGISTRY` with the same 3-step recipe pattern documented in `evals/README.md:95-131` is the natural, low-risk extension point (mirrors a pattern this repo has already proven works for judges).
3. **Champion-robustness test**: take a GEPA-promoted `fullstack-dev` champion prompt (once one exists — none has promoted yet per the empty trials directory), run the *same* eval spec's fixtures with `candidate.runner: codex-p` substituted, and diff pass rates. A champion prompt that was implicitly over-fit to Claude-specific phrasing/tool-call conventions during optimization should show a measurable pass-rate drop under the GPT candidate; a genuinely portable prompt should not. This is exactly the "prompt-portability audit" the mission's model-layer table calls for, operationalized as a concrete, runnable eval rather than a manual read-through.
4. **Cost note**: this doubles eval cost per cycle (2 candidate dispatches instead of 1) — gate it behind an opt-in flag (`--cross-provider`) rather than making it the default eval path, consistent with the existing `--dry-run`/live mode split.

### Metrics to track (proposed instrumentation, mapped to existing hooks)

| Metric | Where it would be captured | Existing hook to extend |
|---|---|---|
| Task completion rate | Verifier/inspector verdict already captured in `CrewArtifact.score_hint.pass` | `gepaCapture()` tee (already wired) |
| Schema compliance | Zod parse failures on any `CrewArtifactSchema`/handoff schema | Add a counter alongside existing Zod `.parse()` call sites |
| Tool-call correctness | Not currently captured — would need trace-level tool-call logging | New: extend `evals/lib/assert.ts`'s `tool-called` assert type (already exists) into a passive metric, not just a pass/fail assert |
| Handoff correctness | `scripts/validate-bundles.ts` already checks handoff artifact shape | Extend to log a rate, not just pass/fail per-file |
| Reviewer defect-detection rate | GEPA's `binaryScorer`/`rubricScorer` against bug-labeled fixtures (`inspector-null-deref.diff`, `inspector-clean-rename.diff` already exist) | This is exactly what the inspector `.gepa/eval/bug-*.jsonl` corpus is for — already the right shape, just needs the missing `evals/agents/inspector.yaml`-pointer fix (Finding 2.2) to actually run in CI |
| Validator false-pass rate | Proposed new fixture class: "tests pass but assert nothing" (see verifier fixture proposal above) | New |
| Cost and latency per slice | Already tracked (`.claude/artifacts/crew/cost/` per CLAUDE.md, `dailyCapMeter`/`sharedAstramemMeter` in gepa-core) | Already exists — no new work |
| Retry rate | `no_winner_streak` event already exists for GEPA optimize cycles; build-phase retry rate (fix-retry-limit in `ship.md`) is not currently aggregated anywhere | New: emit a `build_retry` event alongside existing `ship.fix_retry_limit` logic |
| Human override rate | No current instrumentation for "human manually overrode an agent verdict" | New — would need a lightweight badge/flag on artifacts when a human edits post-hoc |

---

## 7. Config externalization plan

**Not a workflow engine** — scoped strictly to making existing prose machine-readable where it's already acting like data.

### `routing-table.yaml` as machine-readable source

Proposed shape (Zod-validated, since the repo already standardizes on Zod for gepa-core's contracts):

```ts
// scripts/lib/routing/schema.ts
export const RoutingRowSchema = z.object({
  signal: z.string(),           // e.g. "surface:api AND stack:csharp"
  route_to: z.string(),         // agent or command id, must resolve (see fitness function, Section 8)
  notes: z.string().optional(),
  section: z.enum(["builder-matrix","workflow-signals","review-gates","code-language",
                    "architecture","infra-ops","research","docs-comms","ux","crew-internals"]),
});
export const RoutingTableSchema = z.object({
  version: z.string(),           // semver, bump on breaking row-shape changes
  generated_at: z.string().datetime().optional(),
  rows: z.array(RoutingRowSchema),
});
```

`docs/routing-table.md` becomes a **generated view** (a small script renders the YAML into the existing markdown table format for human/LLM-dispatcher reading — the actual runtime consumer, per Section 4's coupling analysis, is the dispatcher's own judgment reading prose, so the generated markdown must stay just as readable as today, not turn into raw YAML dumped in a code fence). This directly fixes Finding 2.5's triple-copy-paste problem: `build.md`/`fix.md`/`orchestrate-slice.md` all read from the same generated section instead of maintaining 3 independent prose copies.

**Migration path:** (1) write the Zod schema + a `routing-table.yaml` seeded from today's `docs/routing-table.md` content (mechanical, one-time transcription); (2) write the render script (`scripts/render-routing-table.ts`) that regenerates the `.md` file — CI checks the committed `.md` matches a fresh render (drift = fail, same pattern already used by `validate-contracts.ts`'s "regenerated contracts.ts matches committed copy" check); (3) flip `build.md`/`fix.md` to reference the generated file instead of their own inline copy — this is the highest-value single change in this whole plan since it kills Finding 2.5's triple-maintenance burden.

### Tier map / model profiles

As sketched in the mission brief, with one addition — a `resolveProfile(agent, tier)` helper that's the *only* sanctioned read path (mirrors the `judge_per_agent` "global default, per-agent replace, not extend" precedence rule already proven in gepa-core's `GepaConfigSchema`, design doc line 462):

```yaml
# models.yaml — resolved at install/build time, never at agent runtime
version: "1.0.0"
default_profile: claude
profiles:
  claude:
    reasoning: opus
    standard: sonnet
    light: haiku
  codex:
    reasoning: gpt-5.x-high
    standard: gpt-5.x
    light: gpt-5.x-mini
```

**Apply-profile script**: `scripts/apply-model-profile.ts --profile <name>` rewrites each `agents/*.md`'s `model:` frontmatter field from the neutral tier name to the resolved alias/ID, then re-runs `validate-agents.ts` as a post-condition. Reject unknown profile, reject missing tier, `claude` stays default, **no runtime dependency** — an agent file always carries a concrete `model:` value (today's behavior), the profile system only changes *how that value got written*, never how it's read at dispatch time. This satisfies the mission's non-negotiable constraints exactly.

**Prompt-portability audit**: grep every `agents/*.md` for Claude-Code-specific tool names (`Read`, `Edit`, `Write`, `Grep`, `Glob`, `Bash`, `NotebookEdit`, `Agent`, `ToolSearch`) and harness-specific assumptions (references to `claude -p`, `--dangerously-skip-permissions`, `.claude/` paths in prose instructions rather than as data). Produce a mapping table (pattern: superpowers `references/codex-tools.md`, referenced in the mission brief) — e.g. `Read → shell(cat)`, `Edit → shell(patch/sed) or native edit tool`, `Bash → shell`, `Agent → sub-process dispatch (if supported)`. Flag agents whose *prose* (not just frontmatter) assumes Claude Code specifics — `evals/lib/candidate-dispatch.ts`'s own combined-prompt wrapper already does something similar defensively ("Do NOT use any tools... Reply with TEXT ONLY"), which is a reasonable harness-neutral fallback pattern worth generalizing.

### Peer-dispatch whitelists as data

```ts
// scripts/lib/dispatch/schema.ts
export const PeerDispatchEntrySchema = z.object({
  agent: z.string(),
  may_dispatch: z.array(z.string()),
  must_not_dispatch: z.array(z.string()).optional(),  // documentation only; derived as complement in CI check
  max_per_slice: z.number().int().positive().optional(),
  max_per_turn: z.number().int().positive().optional(),
  bidirectional_with: z.array(z.string()).optional(),  // mirrors BIDIRECTIONAL_ALLOWED
});
```
Move `PEER_DISPATCH_ALLOWLIST` (currently duplicated between `validate-agents.ts` and `validate-dispatch-graph.ts`) to a single `dispatch-whitelist.yaml`, read by both validators — this closes the "two independently hardcoded lists" gap noted in the governance research pass. Keep the human-readable `## Peer dispatch` prose section in each agent file (it's genuinely useful in-context documentation for whoever is reading that one file), but generate it *from* the YAML at build time rather than hand-authoring both, the same generated-view pattern as the routing table.

### Schema validation library

**Zod**, per the mission's own steer and matching gepa-core's precedent (`TrialSchema`, `EvalCaseSchema`, `GepaConfigSchema` all Zod already) — no reason to introduce a second schema library into a repo that already has Zod as a direct dependency (`package.json`: `"zod": "^3.25.76"`).

### Versioning + migration path

Every new machine-readable config (`routing-table.yaml`, `models.yaml`, `dispatch-whitelist.yaml`) carries a `version: "MAJOR.MINOR.PATCH"` field per the schema above. Breaking shape changes bump MAJOR; a migration script (`scripts/migrate-config.ts <file> <from> <to>`) handles the transition, mirroring the semver discipline already proven for `gepa-core`'s exported interfaces. **Guard against "untyped mess"**: every config file's schema lives in one place (`scripts/lib/*/schema.ts`), every config file is validated at CI time (new `validate-configs.ts` wrapping all three schemas, added to the hard `validators:` bucket in `test.yml`), and the generated-markdown-view pattern means humans still read prose, never raw YAML, in the primary consumption path.

---

## 8. Architectural fitness functions

### EXISTS (verified against CI wiring)

| Fitness function | Evidence | CI status |
|---|---|---|
| Agent frontmatter shape + 350-line cap | `scripts/validate-agents.ts` | Hard gate |
| Duplicate agent name detection | `scripts/validate-agents.ts` | Hard gate |
| Skill frontmatter shape + tier enum + 200-line cap | `scripts/validate-skills.ts` | Hard gate |
| Peer-dispatch DAG acyclicity | `scripts/validate-dispatch-graph.ts` | Hard gate |
| Workflow YAML correctness (10 checks incl. cycle detection on `tag_routes`) | `scripts/validate-workflows.ts` | Hard gate |
| Slice AC-placeholder + workflow-field validity | `scripts/validate-slices.ts` | Hard gate |
| Single authoritative backlog tree + unique FEAT ids | `scripts/validate-loop-state.ts` | Hard gate |
| Build-bundle handoff schema shape | `scripts/validate-bundles.ts` | Hard gate |
| OpenAPI contract fixture validation (incl. one negative fixture) | `scripts/validate-contracts.ts` | Hard gate |
| UX-spec operationId cross-reference (incl. one negative fixture) | `scripts/validate-ux-spec.ts` | Hard gate |
| Manifest shape + version-field sync | `scripts/validate-manifests.ts` | Hard gate |
| Routing-table skill-ID resolution (Pass 1) + agent/skill-consultation consistency (Pass 2) | `scripts/validate-routing-table.ts` | **Advisory only** (`CREW_VALIDATE_ROUTING_TABLE=1`) |
| Synthesis-artifact placeholder sweep | `scripts/validate-syntheses.ts` | Advisory only |
| Typecheck (real) | `bun run typecheck` (`tsc --noEmit`) | Hard gate (in `bun-commands`) |
| evals:-field-non-empty for 9 required agents | `scripts/validate-agents.ts` (`checkEvalsRequiredForRole`) | Hard gate, but **cosmetic** (Finding 2.2 — doesn't check path existence) |

### MISSING (proposed, with CI hook point)

| Fitness function | Proposed implementation | CI hook |
|---|---|---|
| Every `crew:<name>` token in `commands/*.md`/`skills/**/*.md` resolves to a real `agents/<name>.md` | ~30-line addition to `scripts/validate-dispatch-graph.ts` (it already parses agent tokens for the DAG check — extend the token-collection pass to also check file existence) | New hard gate — directly fixes Finding 2.1 |
| `evals:` frontmatter path actually exists and parses as valid YAML | Finish `checkEvalsRequiredForRole`'s TODO in `scripts/validate-agents.ts` | Upgrade existing hard gate — fixes Finding 2.2 |
| Every `agents/*.md` basename appears in ≥1 `docs/routing-table.md` row | New ~20-line script (or extend `validate-routing-table.ts`), diff agent directory listing against table content | New hard gate — fixes Finding 2.7 |
| `PEER_DISPATCH_ALLOWLIST` (validate-agents.ts) and the agent-walk in validate-dispatch-graph.ts stay in sync | Extract both to the single `dispatch-whitelist.yaml` proposed in Section 7; both validators import from it | Removes the need for a *check* by removing the duplication itself |
| No agent's peer-dispatch whitelist includes a review/validation-gate agent (`inspector`, `verifier`, `inspector-lite`, and any future rename target) | ~15-line addition to `scripts/validate-dispatch-graph.ts` — after parsing each agent's whitelist, assert it has empty intersection with a hardcoded `GATE_AGENTS` set | New hard gate — operationalizes the FEAT-163 "orchestrator-only gates" rule (currently prose-only, Section 3) |
| Workflow determinism (same input → same dispatch plan) | Golden-file test: freeze a fixed set of FEAT-tag inputs, snapshot `scripts/orchestrate-slice-classify.ts`'s output, assert no diff on future runs unless the snapshot is explicitly updated | New — add to `bun run test` suite (cheap, no live LLM calls) |
| Handoff schema stability (golden contract tests) | Snapshot one real handoff artifact per producer agent (builder/reviewer/validator/architect), assert `validate-bundles.ts`'s schema still accepts it on every CI run | New — cheap, deterministic, catches accidental schema drift before it breaks a downstream consumer |
| Backward compatibility of `gepa-core` exported interfaces | `scripts/check-semver.ts` — mentioned in the GEPA design doc's "Implementation notes for plan-writing" (S1 section) as intended but not confirmed built in this pass | Confirm/build — flag as open verification item (Confidence: Low on whether this already exists; not directly observed) |
| Config schema validation (profiles/routing/whitelists) | New `validate-configs.ts` wrapping the 3 new Zod schemas from Section 7 | New hard gate, once Section 7 lands |
| 3rdparty agent minimum bar (Report-contract section, tool-name sanity) | Extend `scripts/validate-agents.ts` to scan `agents/3rdparty/` with a relaxed rule set (no line cap, no `prompt_id`/`version` requirement, but DO require a Report-contract section and DO reject non-Claude-Code tool names) | New — directly fixes the `c-sharp-pro.md`/`expert-react-frontend-engineer.md` blind spots (Findings 2.4, 2.6) |

---

## 9. Dead code and pruning

| Candidate | Evidence | Maintenance cost if kept | Removal risk | Priority |
|---|---|---|---|---|
| `agents/parallel-runner.md` | Zero live invocation sites; every reference is a "MUST NOT dispatch" blacklist entry in 11 other agents; routing-table row explicitly says current parallel path (`/crew:parallel`, Path A) "no `parallel-runner` agent involved" | Low upkeep cost today, but actively misleading (has `Agent` tool, dispatches per its own prompt, yet excluded from the whitelist validator) | Low — nothing currently depends on it being dispatchable | **High** (quick win) |
| `agents/3rdparty/c-sharp-pro.md` | Zero external references; full duplicate of `c-sharp-reviewer.md`'s checklist under a riskier (write-access, unvalidated) posture (Finding 2.4) | Low upkeep, but sits as an un-audited write-capable agent | Low | **High** (quick win) |
| `agents/3rdparty/flutter-ui-developer.md` | Zero routing-table references; shadowed entirely by `mobile-developer.md`'s broader Flutter+RN+Swift+Kotlin claim | Low | Low | Medium |
| `agents/3rdparty/playwright-tester.md` | Zero references outside itself | Low (small, clean file) | Low | Low — cheap to keep, cheap to remove; not urgent either way |
| `skills/workflow/dispatcher-routing/` | Zero live loader (only mentioned in a pending backlog item + CHANGELOG + a rename-design doc) | Low | Low | Medium |
| `skills/workflow/dispatcher-orchestration/` | Same pattern — no live `agents/`/`commands/` loader | Low | Low | Medium |
| `skills/workflow/fan-out-review/` | Only historical artifact hits, no live loader | Low | Low | Low |
| `skills/universal/writing-claude-md/` | Zero live wiring despite "always discoverable" universal tier | Low | Low | Medium — universal-tier skills with zero live use undermine the tier's own premise |
| `skills/universal/writing-task-handoffs/` | Same pattern | Low | Low | Medium |
| `scripts/validate-typegraph.ts` | Functionally redundant with the real blocking `bun run typecheck` (Finding 2.8) | Low, but pure noise | None — deleting it changes nothing observable | **High** (quick win, zero risk) |
| `scripts/validate-adr-template.ts` | Never wired into CI at all despite existing (Finding 2.9) | Low | None (wiring it in, not removing it, is the actual fix) | Medium |
| Phantom agent references (`agents/reviewer.md`, `agents/validator.md`, `agents/deployer.md`, `agents/builder.md`, `agents/reviewer-validator.md`, `agents/inspector-verifier.md`) | Scattered across ≥4 command files, ≥4 skill files, 2 top-level policy docs, 1 validator constant (Finding 2.1) | **High** — every reference is a landmine for whoever next edits that file expecting the name to resolve | Medium (requires a coordinated sweep, not a single-file delete) | **Highest** (Critical severity, see Finding 2.1) |
| Stale `docs/architecture/architecture.md` sections (5-role framing, 300-line cap claim, `.mjs`-era tooling-gates section) | Confirmed stale against `governance.md`, code, and CI reality | Medium — actively misleads new readers | Low (docs-only fix) | High |
| Stale `.claude/crew/deployment.md` 9-step CI list | Same pattern, `.mjs`-era, references nonexistent local `marketplace.json` | Medium | Low | High |
| `triaged/` backlog files for already-shipped SLICEs (Finding 2.10) | 9 of 14 triaged files have matching "shipped" commits | Low individually, but corrodes trust in the backlog tree as a whole | Low (mechanical close-ceremony replay) | Medium |

**Duplicated commands (crew vs runner vs gstack overlap):** not confirmed as a real problem in this pass — the crew↔runner boundary is cleanly file/CLI-based (Section 4), and gstack skills are explicitly routed as supplementary per the user's own CLAUDE.md routing rules ("gstack skills supplement crew phases, not replacements"). No evidence found of duplicated *command* logic across the three; this line item from the mission brief appears to be a non-issue in the current repo state (Confidence: Medium — I did not exhaustively diff every gstack skill against every crew command body).

---

## 10. Smoke test plan (CI, <2 min, no live LLM calls)

Proposed additions, all deterministic and cheap, building on patterns already proven in this repo (fixture-based validators like `validate-contracts.ts`/`validate-ux-spec.ts` already run negative-fixture checks in CI today):

1. **Model profile resolution** — load `models.yaml` default profile (`claude`), assert all 3 tiers resolve; load `codex` profile, assert all 3 tiers resolve; load a profile with a missing tier, assert rejection; load an unknown profile name, assert rejection. Pure function calls, no I/O beyond reading one YAML file — sub-second.
2. **Routing table load + validate** — parse `routing-table.yaml` (once Section 7 lands) against its Zod schema; malformed fixture (missing `route_to`, unknown `section` enum value) must reject. Mirrors the existing `validate-contracts.ts` positive/negative fixture pattern exactly.
3. **`bun run evals --dry-run` per spec** — already exists and is deterministic (confirmed: `--dry-run` mode skips the candidate subprocess entirely, per `evals/README.md:18-23`). Extend: add a CI step that runs `--dry-run` against every file in `evals/agents/*.yaml` (today just 2; grows as Section 6's missing specs are authored) and asserts non-zero exit on any assert failure. This is additive to existing infrastructure, not new infrastructure.
4. **Handoff payload shape stability (golden files)** — one frozen handoff JSON per producer role (builder/reviewer/validator/architect), re-validated against `validate-bundles.ts`'s schema on every run; a passing test today that starts failing signals an accidental schema-breaking change before it reaches a real dispatch.
5. **Profile switch must not change agent set, routing, or workflow structure** — snapshot `ls agents/*.md` + `docs/routing-table.md`'s row count + `.claude/workflows.yaml`'s phase list before and after running `apply-model-profile.ts --profile codex`; assert all three are byte-identical except the frontmatter `model:` field. This directly enforces the mission's "no runtime dependency, profile switch is cosmetic to dispatch structure" constraint.
6. **Dispatch-graph + phantom-reference check** (Section 8's two new fitness functions) — cheap, already have the parsing infrastructure in `validate-dispatch-graph.ts`.
7. **Wire-in order**: all 6 belong in the existing hard `validators:` bucket of `.github/workflows/test.yml` (they're all sub-second, no network, no LLM) except the golden-handoff-file check, which should live in the `bun-commands` `test` bucket alongside the existing Bun test suite (it's a Bun test file, not a standalone Node validator). **Runtime impact**: negligible — every proposed check is a local file parse + Zod validation or a string diff; total added CI time estimate <5 seconds, well within the "<2 min" budget for the whole smoke suite (the existing 15-validator suite already runs in well under that).

---

## 11. Implementation roadmap

### Phase 1 — quick wins (1 day)

- **Files touched:** `commands/review.md`, `commands/parallel.md`, `commands/orchestrate-slice.md`, `skills/workflow/self-verify-gate/SKILL.md`, `skills/workflow/journey-builder/SKILL.md`, `skills/workflow/ux-validation/SKILL.md`, `.claude/crew/constitution.md`, `agents/*.md` (whitelist comment cleanups), `scripts/validate-typegraph.ts` (delete), `docs/superpowers/specs/2026-06-30-reviewer-rename-design.md` (delete or execute), `agents/3rdparty/c-sharp-pro.md` (delete), `agents/3rdparty/flutter-ui-developer.md` (delete), `agents/parallel-runner.md` (demote/delete).
- **Risks:** the reviewer-rename decision (finish vs revert) touches the most files — must be done as one atomic commit, not incrementally, or the repo spends time in a worse-than-either-state limbo.
- **Tests to add:** the phantom-agent-reference fitness function (Section 8, item 1) should land *first*, so it immediately proves the fix worked and prevents regression.
- **Acceptance criteria:** `/crew:review` dispatches a real agent; grep for `agents/reviewer.md|agents/validator.md|agents/deployer.md|agents/builder.md|agents/reviewer-validator.md|agents/inspector-verifier.md` across `commands/`+`skills/`+`.claude/crew/` returns zero hits; `scripts/validate-typegraph.ts` no longer exists; `agents/3rdparty/c-sharp-pro.md` no longer exists; `bun run lint`/`typecheck`/`test` all still green.

### Phase 2 — model profile system + candidate-runner abstraction (3-5 days)

- **Files touched:** new `models.yaml` + `scripts/lib/models/schema.ts` + `scripts/apply-model-profile.ts`; new `evals/lib/candidate-registry.ts` (mirrors `JUDGE_REGISTRY` pattern) + at least one second candidate adapter, scoped to whatever CLI/API is realistically available; `evals/lib/candidate-dispatch.ts` refactored to take a `runner` discriminant instead of hardcoding `claude -p`.
- **Risks:** the `parseStreamJson` logic is tightly coupled to Claude Code's stream-json NDJSON shape — a second candidate runner needs its own parser, and getting the "does the candidate agent stay in character" evaluation criteria right for a non-Claude harness may surface prompt-portability issues the eval wasn't designed to catch (this is a feature, not a bug — it's exactly what Section 6's cross-provider experiment is for).
- **Tests to add:** the model-profile smoke tests from Section 10 (items 1, 5); a candidate-registry unit test mirroring the existing judge-registry pattern.
- **Acceptance criteria:** `apply-model-profile.ts --profile codex` produces a valid agent set that still passes `validate-agents.ts`; a `--dry-run` eval succeeds against a second candidate runner for at least one spec.

### Phase 3 — routing/config externalization (3-5 days)

- **Files touched:** new `routing-table.yaml` + `scripts/lib/routing/schema.ts` + `scripts/render-routing-table.ts`; new `dispatch-whitelist.yaml` + updates to both `scripts/validate-agents.ts` and `scripts/validate-dispatch-graph.ts` to read from it instead of their two independently-hardcoded lists; `commands/build.md`/`commands/fix.md` updated to reference the generated routing view instead of their inline copies.
- **Risks:** the generated-markdown-view must stay exactly as readable to the LLM dispatcher as today's hand-written prose. Validate this with a side-by-side dispatch-quality spot check before cutting over, not just a schema-passes check.
- **Tests to add:** CI drift check (committed `.md` must match a fresh render — same pattern as `validate-contracts.ts`); the "every agent basename appears in routing table" fitness function from Section 8.
- **Acceptance criteria:** zero agents missing from the generated table (fixes Finding 2.7 completely); `build.md`/`fix.md`/`orchestrate-slice.md` no longer contain 3 independently-maintained copies of the same routing subset.

### Phase 4 — eval coverage + GEPA hardening (5-8 days)

- **Files touched:** 7 new eval specs (`evals/agents/backend-dev.yaml`, `frontend-dev.yaml`, `verifier.yaml`, `architect.yaml`, `refactor.yaml`, `release-engineer.yaml`, `integrator.yaml`, correcting the frontmatter-pointer filenames to match, Finding 2.2) + matching fixtures per the table in Section 6; `scripts/validate-agents.ts`'s `checkEvalsRequiredForRole` upgraded to check path existence (finishes FEAT-167 SLICE-B); gepa-core's `soakMonitor` extended with a sequential-test option (Section 6) — cross-repo, requires a MINOR version bump; judge-agreement telemetry event added to `scripts/lib/gepa/observability-events.ts`.
- **Risks:** the gepa-core change is cross-repo (per CLAUDE.md's `dev.stable` exception for astra-family repos, doable in paired commits, but still requires the version-bump ceremony); authoring 7 new eval specs is genuine content work, not mechanical.
- **Tests to add:** all 7 new specs need `--dry-run` coverage in CI (Section 10, item 3) from day one.
- **Acceptance criteria:** all 9 `EVALS_REQUIRED_AGENT_NAMES` (once `inspector-verifier` is resolved per Phase 1) have a real, CI-validated eval spec; `validate-agents.ts`'s evals check fails loudly on any future dangling pointer.

### Phase 5 — cleanup: dead code + deprecated shims

- **Files touched:** `evals/lib/judge.ts`'s `JudgeProvider`/`JudgeRequest`/`JudgeResult` deprecated shim types — removal gated on gepa-core's next MAJOR per the existing deprecation notice (already documented, just needs the trigger); dead-code candidates from Section 9 (skills with zero references, `flutter-ui-developer.md`, `parallel-runner.md`); backfill or retitle the two ADRs' heading to satisfy `validate-adr-template.ts` and wire it into CI (Finding 2.9); retroactive backlog close-ceremony replay for the 9 already-shipped `triaged/` items (Finding 2.10).
- **Risks:** removing `JudgeProvider` before gepa-core's next MAJOR would break any external consumer plugin still on the old interface — must wait for the version gate.
- **Tests to add:** none new — this phase is subtractive; existing test suite passing after each removal is the acceptance bar.
- **Acceptance criteria:** `evals/lib/judge.ts` no longer exports `JudgeProvider` (post gepa-core MAJOR bump); zero dead-code candidates remain from Section 9's table; both ADRs pass `validate-adr-template.ts`; `triaged/` contains only genuinely-open items.

### Measurable success table

| Improvement | Current | Target | Metric | Measurement method | Owner | Acceptance criteria |
|---|---|---|---|---|---|---|
| Phantom agent references | 6 nonexistent agent names referenced across ≥10 files | 0 | Count of unresolvable `crew:<name>` tokens | Section 8's new dispatch-graph check | `validate-dispatch-graph.ts` CI gate | 0 hits, gate blocking |
| Eval coverage (declared vs real) | 2/9 real specs, 7 dangling pointers | 9/9 real specs | Path-existence pass rate | Upgraded `checkEvalsRequiredForRole` | `validate-agents.ts` CI gate | 100% resolve |
| Routing table staleness | 7/23 agents (30%) missing from table | 0% missing | Agent-basename-in-table coverage | New script diffing `agents/` vs table rows | Section 7's render pipeline + CI drift check | 0 missing, drift check green |
| GEPA promotion statistical power | n=8 (architect)/n=10 (inspector), below n=20 design floor | Either ≥30 cases per critical agent OR explicit "draft-PR-only, human-reviewed" bar documented | Corpus size per agent | `wc -l agents/*/.gepa/eval/*.jsonl` | GEPA design owner | Corpus ≥30 OR explicit lower-bar doc committed |
| Reviewer-cluster duplication | 2 files, ~50%+ overlapping C# checklist content | 1 canonical source | Line-level diff similarity | Manual diff | `refactor` agent / one-off cleanup dispatch | `c-sharp-pro.md` deleted or checklist extracted to shared skill |
| Dead validator noise | `validate-typegraph.ts` always-passes, `validate-adr-template.ts` never-runs | 0 dead validators, 1 more real gate | Validator file count vs CI-wired count | Diff `scripts/validate-*.ts` against `.github/workflows/test.yml` | CI workflow owner | Every validator file is either CI-wired or deleted |

---

## 12. Concrete recommended changes

| Path | What to change | Why | Difficulty | Risk | Test required |
|---|---|---|---|---|---|
| `commands/review.md:31-32` | Replace `crew:reviewer` with `crew:inspector` | Fixes broken `/crew:review` (Finding 2.1) | S | Low | Manual dispatch smoke test |
| `commands/parallel.md:39` | Rewrite ceremony description to match real `build.md` ladder, remove `crew:builder`/`crew:reviewer` | Doc/behavior mismatch (Finding 2.1) | S | Low | None (docs-only) |
| `commands/orchestrate-slice.md:62` | Fix `.mjs` → `.ts` extension reference | Stale reference | S | None | None |
| `skills/workflow/self-verify-gate/SKILL.md:122`, `journey-builder`, `ux-validation` frontmatter/description | Replace `crew:validator`/`agents/validator.md` with `crew:verifier`/`agents/verifier.md` | Finding 2.1 | S | Low | None (docs-only) |
| `.claude/crew/constitution.md`, `commands/build.md:142` | Replace `agents/deployer.md` reference with `agents/release-engineer.md` | Finding 2.1 | S | Low | None |
| 9 agent files' `## Peer dispatch` blacklists | Remove `inspector-verifier` (phantom) or replace with the real intended target | Finding 2.1 | S | Low | Fitness function from Section 8 |
| `scripts/validate-agents.ts:252-262` | Remove `inspector-verifier` from `EVALS_REQUIRED_AGENT_NAMES`, or add the agent if the intent was a real combined light-tier reviewer (may be the same intended agent as `orchestrate-slice.md`'s dead `crew:reviewer-validator` path under a different name) | Resolve the naming collision at its root | M (requires a decision, not just an edit) | Medium — touches CI gate behavior | Existing validator test suite |
| `scripts/validate-agents.ts:284-291` (`checkEvalsRequiredForRole`) | Add path-existence + YAML-parse check | Finding 2.2 | S | Low (will surface currently-hidden failures — expected) | New unit test with a dangling-pointer fixture |
| `agents/backend-dev.md:6`, `frontend-dev.md:6`, `refactor.md:6`, `inspector.md:6`, `verifier.md:6`, `integrator.md:6`, `release-engineer.md:6` | Point `evals:` at files that will actually exist post-Phase-4, fix the `inspector.md` → `crew-inspector.yaml` filename mismatch | Finding 2.2 | M (content authoring, Phase 4) | Low | `--dry-run` eval run per spec |
| `agents/3rdparty/c-sharp-pro.md` | Delete | Finding 2.4 | S | Low (zero external refs confirmed) | Grep confirms no residual references |
| `agents/3rdparty/flutter-ui-developer.md` | Delete | Shadowed by mobile-developer, zero refs | S | Low | Grep confirms no residual references |
| `agents/parallel-runner.md` | Demote to a skill or delete | Orphaned per Path A supersession | M | Low-Medium (verify nothing silently still dispatches it) | Grep + a live smoke check that `/crew:parallel` still works without it |
| `agents/3rdparty/expert-react-frontend-engineer.md` | Rewrite `tools:` frontmatter to Claude Code tool names | Finding 2.6 — may be non-functional today | S | Medium (verify via live dispatch) | Live smoke dispatch |
| `scripts/validate-typegraph.ts` + its CI reference | Delete | Finding 2.8, fully redundant | S | None | CI still green without it |
| `scripts/validate-adr-template.ts` | Rename expected heading to `## Alternatives considered` and wire into `advisory-validators:` | Finding 2.9 | S | Low | Run against both existing ADRs, confirm pass |
| `docs/architecture/architecture.md:11,21,166-176` | Refresh: cap to 350, role list to current roster, tooling-gates section to current reality | Stale doc (Section 3) | M | Low (docs-only) | None |
| `.claude/crew/deployment.md` (9-step CI list) | Refresh to match `.github/workflows/test.yml` reality | Stale doc | M | Low | None |
| `.claude/artifacts/loop/backlog/triaged/*` (9 already-shipped items) | Run retroactive close ceremony, move to `done/` | Finding 2.10 | S | Low | `validate-loop-state.ts` still green |
| `docs/routing-table.md` | Migrate to generated view over `routing-table.yaml` (Section 7) | Fixes Finding 2.7 and 2.5 simultaneously | L | Medium (must preserve LLM-dispatcher readability) | Side-by-side dispatch-quality spot check + CI drift check |

---

## 13. If starting from zero today (mid-2026)

**What would remain identical:**
- The core insight that this is a *plugin* (prompts + config + thin CLI helpers), not a runtime that owns LLM call sites.
- Markdown agent prompts with enforced line caps and required sections — version-controllable, diffable, reviewable without special tooling.
- The four-tier skill taxonomy (universal/workflow/domain/meta) — clean, well-modeled, actively validated.
- Zod for every typed config/contract boundary — proven out in gepa-core, should extend to every new machine-readable config (Section 7).
- The judge-registry pattern (`(config) => Promise<LLMJudge>` factories in a flat `Record`) — simple, composable, no DI container, matches the 3-step recipe already documented. Worth reusing for the candidate-registry (Phase 2).
- Loose file/CLI coupling to the companion `runner` plugin — zero code imports, graceful degradation.
- Critical-agent allowlist as a hardcoded, non-configurable safety rail — deliberately inflexible where inflexibility is the safety feature.

**What would be simplified:**
- **One routing source, not three.** Today's routing table (prose) + 3 inline command copies + peer-dispatch prose sections overlap. A from-scratch build has exactly one machine-readable routing/whitelist source with generated views for human/LLM reading.
- **One agent-name resolution path.** Today a reference can be wrong in a command, a skill, a validator constant, or a policy doc, and nothing catches it until a dispatch fails. A from-scratch build makes "does this name resolve" a build-time invariant — e.g. a generated TypeScript union type of valid agent names that every reference-emitting script imports, so a typo is a compile error.
- **3rdparty agent tier would carry a real (if lighter) validation bar from day one**, not "unvalidated until someone notices a 746-line VS Code Copilot agent slipped through."

**What would disappear:**
- The "five active roles" framing in `architecture.md` — already superseded by the specialist-split reality.
- The abandoned reviewer-rename design doc and its partial, unexecuted wiring.
- Foreign "Communication Protocol" boilerplate in vendored 3rdparty agents referencing peers that don't exist in this repo.

**What would be added:**
- A compile-time (not just CI-time) agent/skill/command name-resolution check.
- A cross-provider candidate runner from day one (Section 6) — judge pluggability had to prove out first for understandable sequencing reasons, but a from-scratch build would pair both halves of the pluggability story from the start.
- A sequential statistical test for GEPA promotion from day one, rather than a fixed dual-clock-and-sample gate that's under-powered for low-volume critical agents.

**ROI-gated scope:** every item above is reachable incrementally from the current repo (none require a rewrite) — the highest-ROI single item is the routing-source consolidation (Section 7), since it simultaneously fixes staleness (Finding 2.7), triple-maintenance (Finding 2.5), and the whitelist-sync gap (Section 8) as one migration.

---

## 14. Three-year maintainability

| Scale dimension | Current | Bottleneck | Where it breaks | Cheapest guard |
|---|---|---|---|---|
| **100 agents** (from 23) | 4,501 total lines across 23 agents, avg 196/agent | The 350-line per-file cap holds fine, but aggregate dispatcher-context cost scales linearly — at 100 agents and the same average, ~19,600 total lines of agent prompt exist (not all loaded per-dispatch, but routing table + peer-dispatch whitelist both need to reason across the full set) | Routing table row count (today 188 lines for 23 agents) becomes unwieldy as a single prose file a dispatcher reads in full each session | Section 7's generated-view migration: once routing is data, a 100-agent dispatcher can be handed a *filtered* view (by stack/surface tag) instead of the full table |
| **500 skills** (from 70) | 70 `SKILL.md` files across 4 tiers | The 200-line-per-skill cap holds; the real risk is *discoverability* — universal-tier skills are "always discoverable" by design, and at scale a flat universal tier becomes a context-budget problem even at today's 5-skill count | Breaks once universal-tier count grows past a handful | Explicit universal-tier population cap (~10 skills) mirroring the existing three-test admission rule; anything beyond promotes-or-splits into workflow-tier |
| **100 workflows/commands** (from 37) | 37 command files, 2,753 total lines | Command-level routing-table-copy duplication (Finding 2.5) already shows the failure mode at 3 copies; at 100 commands a hand-maintained per-command routing subset is unmaintainable | Breaks as soon as a 4th/5th command needs its own routing-aware logic | Section 7's single routing source — commands consume, never duplicate |
| **Multiple repos consuming the plugin** | `gepa-core` is a genuine multi-consumer library (crew + hypothetical future `sales-team`) | The crew↔runner file/CLI contract (Section 4) is the proven template, but assumes a shared filesystem — breaks the moment "multiple repos" means separate machines/CI runners, not sibling worktrees | Breaks if a dispatcher must reach a *remote* runner-plugin instance | Not urgent today (no evidence attempted) — if needed, formalize the JSON contract as a versioned, network-transportable schema, extending the Zod discipline already used for `CrewArtifact` |
| **Multiple providers/harnesses** | Claude Code only; 1 hardcoded candidate-runner spot | The judge layer already proves pluggability works (7 providers); agent-execution frontmatter aliases are Claude-Code-specific by construction | Breaks the moment someone runs these prompts under Codex CLI/Copilot without the profile system | Section 7's model-profile system + prompt-portability audit (already scoped as Phase 2) |
| **Multiple teams contributing agents** | Single team today; `governance.md`'s three-test admission rule is process-only, no automated gate | At multiple teams, a human-judgment-only bar gets inconsistently applied | Breaks when two teams independently add near-duplicate agents — already happened once at single-team scale (`c-sharp-reviewer`/`c-sharp-pro`, Finding 2.4) | A lightweight "does an agent covering this stack/surface/role already exist" pre-flight check (e.g. a queryable `capabilities:` frontmatter cross-index) |
| **Peer-dispatch whitelist maintenance** | 10 agents carry `Agent` tool + whitelist; 2 independently-hardcoded lists already risk desync today | At n=50+ dispatch-capable agents, hand-maintained prose whitelists become both a maintenance and security-review burden | Breaks well before 100 agents — the two-list desync risk is already live today | Section 7's `dispatch-whitelist.yaml` consolidation, done now rather than deferred |
| **GEPA trial storage** | Zero live trials today; JSONL append-only file store by design | JSONL-per-agent scales fine linearly — the real risk is whether the atomic-append/torn-line-discard path (`validateTrialCorpus`, `captureParityGoldenTest`) has actually been verified under real concurrent load before volume makes manual inspection impractical | Breaks not at a specific agent count but at the point capture goes from "designed but unpopulated" to "populated at volume, unverified" | Turn capture on for the 6 GEPA v1 target agents and run the SIGKILL-during-put golden test for real before trial volume grows |
| **Single marketplace manifest** | No local `marketplace.json`; central registry lives in `astra-marketplace`, shared across ≥3 plugin repos | Not directly inspectable in this pass (separate repo) — **Confidence: Low**, a real research gap | Would break at high plugin count if the central registry has no per-plugin ownership/locking | Cannot fully assess without inspecting `astra-marketplace` directly — recommend a dedicated follow-up pass before assuming either "fine" or "bottleneck" |

---

## 15. Memory & learning-loop integration

**Note on scope timing:** this section was added to the mission brief after the first 14 sections of this report were already delivered (the prompt file was revised mid-review to add a required "pluggable MemoryProvider" section, renumbering the former "Final verdict" section from 15 to 16). It is written with the same inspection discipline as the rest of the report — every claim below is verified against the repo, not inferred.

### Evidence: what exists today

- **`.claude/artifacts/loop/learnings.jsonl`** (written by `runner:learn`) — confirmed **exactly 3 entries** (`wc -l` = 3), spanning `2026-06-09` to `2026-06-11`. Content is real and useful where it exists — entry #2 documents "grade-template-rot" (18/53 grade files were unfilled templates dragging retrospective scores toward 0.5), entry #3 documents a live "lead-refuses-dispatch" incident with concrete fix anchors. But the file is **stale for roughly 3.5 weeks relative to this review's 2026-07-04 date**, despite the intervening period containing the entire FEAT-183 GEPA cluster (SLICE-96 through SLICE-114, 2026-06-27 through 2026-07-02) — a stretch of work that generated substantial real operational learning (an npm unpublish 24-hour lockout, a Windows CRLF/Biome formatter trap, a 2FA-blocked publish) which was captured instead in the *user's own cross-session Claude memory files* (visible in this session's system context as `MEMORY.md` entries like `gepa-core-v0.2.0-unpublish-lockout.md`), not in this repo's own `runner:learn` capture path. **The repo-local learning mechanism and the mechanism actually being used to retain real lessons are two different, unreconciled systems.**
- **`.claude/artifacts/loop/decisions/`** — confirmed **28 real, well-formed entries** (`DEC-001.md` through at least `DEC-028.md`), each with `id`/`title`/`status`/`introduced_by_slice`/`introduced_at`/`related_specs`/`superseded_by` frontmatter and a Context/Decision/Consequences body (verified by reading `DEC-001.md` in full — PowerShell automatic-variable deny-list pattern, `status: accepted`). This is a genuinely working piece of memory infrastructure, in sharp contrast to `learnings.jsonl`'s near-dormancy. **Separately confirmed:** `docs/decisions/` (a different, `docs/`-rooted directory) contains only `README.md` and `decision-template.md` — no real decision content at all. A reader who checks `docs/decisions/` first (the more discoverable, docs-tree location) would incorrectly conclude no decision log exists, when the real 28-entry log lives under `.claude/artifacts/loop/decisions/` instead. This is a discoverability gap worth fixing regardless of the memory-provider work.
- **`docs/retrospectives/`** — confirmed exactly **1 file** (`2026-06-29-v0.47.0-session-retro.md`). No retrospective has landed for the substantial GEPA-cluster work that followed (2026-06-30 through 2026-07-02), despite CLAUDE.md describing `/loop:retrospective` as the intended mechanism for this.
- **Slice-grade lessons (`.claude/artifacts/loop/grades/*.md`) + the `runner:lessons-recent` digest mechanism** — read directly from the installed companion plugin (`~/.claude/plugins/cache/astra/runner/0.58.0/commands/lessons-recent.md`): the command "pulls the last N grade files (default 5) and aggregates their `## Lessons`, `## Surprises`, `## Followups` sections into a markdown digest the researcher agent should read before drafting acceptance criteria for the next slice. Prevents repeating known mistakes." This is a real, well-designed feed-forward mechanism — but its input quality is compromised today: of **78 total grade files** in `.claude/artifacts/loop/grades/`, **21 (27%) still contain the literal unfilled placeholder text `- bullet`** under their Surprises/Followups headers, and **16 (21%) have all-7-scores-zero** (the exact "grade-template-rot" pattern `learnings.jsonl` entry #2 documented on 2026-06-10). Critically, **2 of the 5 most-recent grade files by mtime** (`20260629T170602Z-slice95-grade.md` and `20260629T170523Z-slice94-grade.md`, both 2026-06-29) are unfilled templates — meaning a `runner:lessons-recent` call made today, with its default `N=5`, would return literal `"- bullet"` placeholder strings as 2 of its 5 digest entries' "surprises"/"followups," directly undermining the command's own stated purpose. The documented lesson was never fixed at the tooling level: no validator rejects a placeholder grade at write time (`scripts/validate-syntheses.ts` only checks final-synthesis artifacts, not grade files, per Section 8's inventory).
- **`astramem` MCP plugin** — confirmed installed and available in this environment, with a rich op surface: `remember`, `recall_memory`, `search_memory`, `invalidate_memory`, `supersede_memory`, `promote_memory`, `why_memory`, `memory_history`, `session_digest`, `erase_memory`, `list_consolidation_proposals`, `resolve_consolidation_proposal`, `get_health`. **But crew's own agent prompts never reference it** — a grep for `astramem` across every `agents/*.md` file returns zero hits, and it's absent from `.claude/crew/*.md` and `CLAUDE.md` too. The *only* place astramem is currently wired into crew's world is GEPA's `TrialStore` interface (`astramemStore(cliPath?)`, lighting up automatically when the astramem CLI is present, chosen via `gepa.config.json`'s `storage.backend: "file" | "astramem"` field) — and that is a *different* integration (GEPA trial storage) than the decisions/lessons/standards recall this section is asking about. They would need two separate wirings (a `astramemStore` for GEPA trials, a `astramemProvider` for the new MemoryProvider), not a shared one, even though both ultimately call the same MCP surface.
- **GEPA's `TrialStore` pattern** (already read in full for Sections 6/7) is the directly-provable precedent to mirror: `interface TrialStore { put, recall, invalidate }`, built-ins `fileStore(root)` (default, JSONL append) and `astramemStore(cliPath?)` (optional, auto-detected), selected via config, with graceful fallback to `fileStore` if the astramem CLI is absent. This is proof that the exact pluggable-provider shape the mission asks for already works in this repo for a structurally similar problem (append-mostly, recall-by-filter, optional richer backend).
- **Standards vs memory boundary** — confirmed already cleanly drawn today: `docs/standards/*.md` (10 files: `agent-capabilities-schema`, `agent-playbook`, `build-bundle-schema`, `code-conventions`, `contract-artifact-schema`, `feat-tag-schema`, `integration-artifact-schema`, `loop-json-schema`, `model-selection`, `workflow-schema`) are durable and versioned, routed via skills/docs as expected; episodic content (`learnings.jsonl`, `decisions/`, `grades/`) lives entirely under `.claude/artifacts/loop/`. No boundary violation found in this pass — this is a positive finding, not a gap.

### Finding 15.1 — the repo-local learning capture path is nearly dormant while real learning happens elsewhere
**Severity:** Medium
**Confidence:** High
**Repository evidence:** `.claude/artifacts/loop/learnings.jsonl` has 3 entries total, none dated after 2026-06-11, despite the FEAT-183 GEPA cluster (2026-06-27–07-02) generating clearly-learnings-shaped operational incidents (npm unpublish lockout, Biome/CRLF trap) that were instead captured only in the user's personal cross-session memory files, external to this repo's own capture mechanism.
**Why it matters:** any `MemoryProvider.recall()` built naively on top of `learnings.jsonl` today would surface almost nothing from the last month of real work — the mechanism the mission wants agents to draw on at dispatch time is not the mechanism actually retaining knowledge right now.
**Recommended fix:** before building the provider abstraction, first close the capture gap — wire `runner:learn` (or an equivalent auto-extraction hook) into the same points already proven to generate real learnings in practice: slice-close ceremony, review `needs_fix` rationale, incident postmortems. Section "Capture path" below proposes exactly this.
**Estimated implementation effort:** S (wiring) — the mechanism (`runner:learn`) already exists; it's an adoption gap, not a missing feature.

### Finding 15.2 — a previously-documented lesson (grade-template-rot) is still unfixed three weeks later, and it actively degrades the `runner:lessons-recent` feed-forward digest today
**Severity:** Low-Medium
**Confidence:** High
**Repository evidence:** `learnings.jsonl` entry #2 (2026-06-10) documents grade-template-rot ("18/53 grade files were unfilled templates... dragging every retrospective dimension to ~0.5"). Direct count against the current 78 grade files confirms the pattern persists and has grown in absolute count: 21/78 (27%) contain the literal placeholder `- bullet`, 16/78 (21%) have all-zero scores, and 2 of the 5 most-recent-by-mtime files (`slice95`, `slice94`, both 2026-06-29) are unfilled. `~/.claude/plugins/cache/astra/runner/0.58.0/commands/lessons-recent.md` confirms the default consumption window is exactly N=5 most-recent grades — so today's default `runner:lessons-recent` call would surface placeholder noise in 2 of 5 entries.
**Why it matters:** this is direct, dated proof that capturing a lesson in `learnings.jsonl` has no automatic enforcement path back into the tooling that caused the problem — the lesson sat for three weeks (and the underlying rot rate held or worsened) without a validator or process change closing the loop, and it's actively corrupting a real downstream consumer (`lessons-recent`'s feed-forward digest to the next-slice planner) today, not just a hypothetical future MemoryProvider. Any memory-provider design must include an explicit "lesson → fitness function" pipeline, not just a "lesson → recall" one, or lessons will keep being captured and re-discovered instead of fixed.
**Recommended fix:** extend `scripts/validate-syntheses.ts`'s placeholder-detection pattern (already proven for final-synthesis artifacts, per Section 8) to grade files as well — reject a grade write where all scores are 0 and `decisions: []`/Surprises/Followups still contain the literal `- bullet` placeholder, unless explicitly marked `draft: true`. This closes the gap for both the new MemoryProvider's `fileProvider` and the already-shipping `runner:lessons-recent` command in one fix.
**Estimated implementation effort:** S

### Finding 15.3 — the real decision log is invisible at its most discoverable location
**Severity:** Low
**Confidence:** High
**Repository evidence:** `docs/decisions/` contains only `README.md` + `decision-template.md`; the real 28-entry DEC-log lives at `.claude/artifacts/loop/decisions/`, a different, less-discoverable path. `docs/governance.md` — checked directly for decision-log documentation as the mission brief specifically named it as an inspection target — contains no description of the decision log at all (grep for "decision" returns only two incidental, unrelated hits: a routing-decision reference at line 56 and a lead-removal note at line 127). `runner:decisions` (the command that manages this log) lives entirely in the companion `runner` plugin, not in this repo's own docs.
**Why it matters:** a new contributor (or a memory-provider implementer) checking the two most obvious `docs/`-rooted locations for "where are decisions recorded" — `docs/decisions/` and `docs/governance.md` — would conclude the log doesn't exist, when a real 28-entry log is one directory tree away.
**Recommended fix:** either add a one-line pointer in `docs/decisions/README.md` to the real path, or (better, consistent with this repo's `.claude/artifacts/` convention) rename `docs/decisions/` to make clear it holds only the template/README and the real log is elsewhere.
**Estimated implementation effort:** S

### Proposed design

**MemoryProvider interface** (mirrors `TrialStore` exactly, same three-verb shape):

```ts
// scripts/lib/memory/interface.ts
export interface MemoryEntry {
  id: string;
  kind: "lesson" | "decision" | "failure" | "grade_note";
  agent?: string;              // scoping — which agent this is most relevant to, if any
  text: string;
  severity?: "low" | "medium" | "high";
  created_at: string;           // ISO datetime
  superseded_by?: string;       // DEC-style supersession chain
}

export interface MemoryProvider {
  recall(filter: {
    agent?: string;
    kind?: MemoryEntry["kind"];
    limit?: number;
    sinceDays?: number;
  }): Promise<MemoryEntry[]>;
  remember(entry: Omit<MemoryEntry, "id" | "created_at">): Promise<void>;
  supersede(id: string, by: string): Promise<void>;
  invalidate(id: string, reason: string): Promise<void>;
}
```

- **`noopProvider`** — default when `memory.provider` is absent from config (mirrors `gepa.config.json`'s own default-to-off pattern). Zero behavior change from today: `recall()` always returns `[]`, `remember()`/`supersede()`/`invalidate()` are silent no-ops. This satisfies the mission's "absent config = today's behavior" constraint exactly.
- **`fileProvider`** — reads `learnings.jsonl` + `.claude/artifacts/loop/decisions/*.md` + recent non-placeholder grade lessons (gated on Finding 15.2's fix landing first, or the provider will surface template noise). Free, no external dependency, matches `fileStore`'s role as GEPA's default.
- **`astramemProvider`** — thin adapter over the already-installed MCP surface (`recall_memory`, `remember`, `supersede_memory`, `invalidate_memory` map directly onto the interface's four verbs almost 1:1) — lights up automatically when the astramem plugin is installed, exactly the same "peer-dep, optional, auto-detected" pattern already proven by `astramemStore`. This is the single biggest risk-reducer for this whole section: the pluggability shape isn't hypothetical, it's a working precedent in the same repo.

**Capture path.** Wire extraction into three points, prioritized by where real learning already demonstrably happens (per the evidence above):
1. **Slice-close ceremony** (`runner:close` / the loop's slice-completion flow) — already where grades + decisions get written today; add a `memoryCapture()` call alongside the existing grade/decision write, extracting from the slice's actual lessons/surprises fields (once Finding 15.2's placeholder-rejection lands, this becomes a reliable source).
2. **Review/validation FAIL rationale** — `inspector`/`verifier` verdicts already carry rationale text in their handoff artifacts; extract at handoff-write time (the same artifact-writer tee GEPA's `gepaCapture()` already hooks, per Section 6/7 — this should be a sibling tee, not a new interception point).
3. **Incident outcomes** (`crew:incident` flow) — postmortem-shaped content is exactly what a "recent important failures" recall needs; wire at incident-close time.

All three should use the same fire-and-forget, walltime-bounded pattern GEPA's capture path already uses (`Promise.race([store.put(trial), sleep(2000)])`, never propagate an exception, drop-and-log on miss) — proven safe, no reason to design a different safety pattern for memory capture.

**Recall path.** Bounded top-K injection (proposal: top 5 entries by `severity × recency` score, explicit token budget cap, e.g. 500 tokens) into builder/reviewer/verifier dispatch context. **Orchestrator-side injection**, not agent-self-retrieval — the dispatcher assembles the memory block once per dispatch and prepends it, mirroring exactly how `dispatchInstructionBlock` is already assembled orchestrator-side today for the loop-skill-resolution contract (Section 4's coupling analysis) rather than each agent independently querying. This keeps cost/latency predictable (one recall call per dispatch, not one per agent-initiated retrieval) and auditable (the injected block is visible in the dispatch prompt, not a hidden tool call an agent may or may not make).

**Standards vs memory boundary.** Already correctly drawn (see Evidence above) — document this explicitly as an invariant so the memory-provider work doesn't accidentally blur it: `docs/standards/*.md` stays routed via skills/docs (durable, versioned, reviewed on its own cadence); the `MemoryProvider` never ingests or serves standards content, only episodic lessons/decisions/failures. Flag this as a fitness-function candidate (a CI check that no `MemoryProvider` implementation reads from `docs/standards/`) if the boundary ever looks at risk of blurring during implementation.

**Hygiene.** Reuse astramem's existing `supersede`/`invalidate` operations directly for the `astramemProvider` (no new mechanism needed — the MCP surface already has them). For `fileProvider`, add simple age-based decay: entries older than ~90 days drop out of the top-K ranking by default (but stay on disk for audit, matching the repo's existing "artifacts are indefinite, never deleted" convention per `governance.md`'s retention table). Dedup on `remember()` via content hashing, mirroring the append-only-but-integrity-checked precedent already proven by GEPA's `fileStore` + `validateTrialCorpus`.

**Eval interaction.** Once memory injection lands, any eval spec touching a memory-aware agent needs to run twice per candidate cycle: once with `memory.provider: noop` (the capture-parity baseline — byte-identical to today) and once with the real provider, diffing pass rates. This directly mirrors the `captureParityGoldenTest` pattern GEPA already uses to prove capture has no side effects (Section 6/10) — the same test shape applies here almost unchanged, just swapping "capture on/off" for "memory injection on/off." Flag this explicitly in the GEPA design's eval-spec authoring guidance so a future memory-aware prompt candidate isn't scored against a baseline that silently didn't see the same context.

---

## 16. Final verdict

### Top 10 quick wins (ranked)

1. **Fix `commands/review.md`'s broken `crew:reviewer` dispatch** — `/crew:review` is broken today; highest-leverage one-line-scale fix in the review (Finding 2.1).
2. **Sweep all phantom agent references** (`validator`, `deployer`, `builder`, `reviewer-validator`, `inspector-verifier`) to their real counterparts in one atomic pass, then add the CI fitness function that prevents recurrence (Section 8).
3. **Delete `scripts/validate-typegraph.ts`** — zero risk, removes pure noise (Finding 2.8).
4. **Delete `agents/3rdparty/c-sharp-pro.md`** — zero external references, full duplicate of `c-sharp-reviewer.md` under a riskier posture (Finding 2.4).
5. **Delete or demote `agents/parallel-runner.md`** — orphaned, superseded by Path A (`/crew:parallel`).
6. **Wire `scripts/validate-adr-template.ts` into CI** (with the heading-name fix) — a purpose-built validator sitting unused for at least two known weeks (Finding 2.9).
7. **Finish `checkEvalsRequiredForRole`'s path-existence check** in `validate-agents.ts` — turns a cosmetic gate into a real one (Finding 2.2).
8. **Retroactively close the 9 already-shipped `triaged/` backlog items** — mechanical, restores trust in the backlog tree (Finding 2.10).
9. **Refresh `docs/architecture/architecture.md`'s three stale sections** (role count, line cap, tooling-gates) — cheap, high-confusion-reduction-per-line-changed.
10. **Fix `agents/3rdparty/expert-react-frontend-engineer.md`'s tool frontmatter** — may be silently non-functional despite being a live `uxdesigner.md` delegation target (Finding 2.6).

**Also worth quick-win status (surfaced by Section 15's memory-loop research, added after the initial top-10 was drafted):** extend the placeholder-rejection pattern already proven in `scripts/validate-syntheses.ts` to grade files, so the still-live "grade-template-rot" pattern (Finding 15.2 — a grade file dated 2026-06-29 is still an unfilled template despite the exact failure being documented three weeks earlier) finally gets closed at the tooling level instead of staying a recorded-but-unfixed lesson; and add a one-line pointer from `docs/decisions/README.md` to the real 28-entry decision log at `.claude/artifacts/loop/decisions/` (Finding 15.3), since the docs-tree location currently looks empty when a real decision log exists elsewhere.

### Top 5 architectural decisions to make now

1. **Finish or revert the `inspector → reviewer` rename** — the single most urgent decision; the current half-migrated state is strictly worse than either endpoint.
2. **Adopt the single-routing-source migration (Section 7)** — fixes Findings 2.5, 2.7, and the whitelist-desync risk in one piece of work, and is the foundation Phases 2-3 build on.
3. **Decide the GEPA statistical bar explicitly for low-volume critical agents** (architect, inspector) — grow the corpus, adopt a sequential test, or explicitly document "draft-PR-only, human-reviewed, lower bar is fine." Leaving this implicit risks a future promotion resting on noise dressed up as signal.
4. **Commit to the model-profile + candidate-registry pluggability work as the actual "model-agnostic" deliverable** — the judge layer already proves the pattern works; extending it answers the mission's core question with working code, not a design doc.
5. **Extend a relaxed validation bar to `agents/3rdparty/`** — today's "unvalidated by default" posture is how a 746-line VS Code-tooled agent and a full C# checklist duplicate both slipped in unnoticed.

### What NOT to do

- **Do not build an LLM classifier for routing.** The repo's own architecture doc correctly rejects this; nothing in this review argues for reversing that call — the actual problem is staleness/duplication of prose, not the absence of a smarter router.
- **Do not introduce a second schema-validation library.** Zod is already the proven, dependency-present choice.
- **Do not remove the `JudgeProvider` deprecated shim before gepa-core's next MAJOR.** The deprecation is already correctly staged.
- **Do not make the GEPA critical-agent allowlist configurable in v1.** A deliberate, correct safety-first call — configurability here should cost a code review, not a config edit.
- **Do not attempt the "multiple repos over a network" scenario speculatively.** No evidence this is needed today.
- **Do not do a big-bang rewrite of `agents/*.md` prompt structure.** Prompt quality across the core 23 agents is consistently high (Section 5's scorecard shows no "rewrite-prompt" recommendations) — the problems here are coordination/reference/coverage gaps, not prompt-content quality gaps.

### Minimal production-readiness definition for this agent system

A crew-shaped multi-agent system is "production ready" when:
1. **Every agent name referenced anywhere in the dispatch surface resolves to a real, loadable agent file**, verified by an automated gate (today: not met, Finding 2.1).
2. **Every claimed eval-coverage signal is backed by a file that actually exists and runs in CI** (today: not met, Finding 2.2).
3. **The routing source of truth is singular and mechanically kept in sync with the live agent/skill roster** (today: not met, Findings 2.5/2.7).
4. **Any automated promotion/merge decision is backed by a statistically honest gate at the corpus size that actually exists** (today: not fully met for low-volume critical agents, Finding 2.3).
5. **Every safety-critical hardcoded list has both code-level enforcement AND is genuinely hard to accidentally bypass** — the critical-agent allowlist meets this bar today; the orchestrator-only gate rule does not yet.
6. **Stale documentation claiming to describe current CI/architecture reality is either accurate or explicitly marked historical** — today, `architecture.md` and `deployment.md` both fail this bar.

The repo is closer to this bar than not — the underlying design decisions (plugin-not-runtime, Zod-typed contracts, judge pluggability, loose companion-plugin coupling, statistically-aware GEPA design) are sound and in most cases already well-executed. The gap to production-readiness is almost entirely in **reference integrity and coverage-claim honesty**, not in the core architecture — which is good news, because every fix above is additive, incremental, and reachable without a rewrite.
