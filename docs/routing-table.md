# Routing Table

Prescriptive heuristic map that the dispatcher consults at session start to classify incoming work and dispatch to the right role(s). Each row maps an observed signal (task type, pattern, or condition) to a destination role and workflow guidance.

Anything ambiguous, blocked, or spanning multiple tiers routes to **the dispatcher** (re-scope inline; no agent involved) for re-scoping.

## Builder routing matrix (FEAT-170 SLICE-C)

`commands/orchestrate-slice.md` Step 3 dispatch consults the slice classifier (`scripts/orchestrate-slice-classify.ts`) which now exposes `SPLIT_BUILD`, `FE_ONLY`, `BE_ONLY` signals from FEAT/slice frontmatter `tags`:

| Tags resolve to | Changed-file signal | Builder dispatch |
| --- | --- | --- |
| `surface:ui` OR `stack:react` only | any | `crew:frontend-dev` (+ `crew:uxdesigner` if `NEEDS_UX`) |
| `surface:api` / `surface:schema` / `stack:csharp` / `stack:node` / `stack:python` only | any | `crew:backend-dev` |
| BOTH FE + BE tags | any | `crew:frontend-dev` + `crew:backend-dev` + `crew:uxdesigner` parallel (SPLIT_BUILD) |
| No FE/BE tags (untagged) | `TS_TOOLING_ONLY = true` (all files are `.ts` / `scripts/` / `tests/` / `evals/`, none are `.tsx` / `.css` / `src/components/`) | `crew:backend-dev` (pure-TS tooling default) |
| No FE/BE tags (untagged) | `TS_TOOLING_ONLY = false` (agent, skill, hook, doc, or mixed edits) | `crew:fullstack-dev` (legitimate generalist) |
| Cross-layer with `skip: ["split-build"]` | any | `crew:fullstack-dev` (explicit override) |

Rationale: `crew:fullstack-dev` previously ate every untagged + every single-stack slice. The generalist agent paid every dispatch cost including specialist-territory slices. SLICE-C routes specialists when FEAT declares stack/surface tags. For untagged slices, `classifyChangedFiles()` in `scripts/orchestrate-slice-classify.ts` detects pure-TS-tooling work (script/test/eval edits) and routes to `backend-dev`, reserving fullstack-dev for genuine generalist use cases (agent/skill/hook/doc edits that lack surface/stack tags). See `commands/orchestrate-slice.md` "Builder routing" section for the full dispatch matrix.

---

### Workflow signals

_New work, bugs, chores, ambiguous scope, release, and session-start routing._

| Signal | Route to | Notes |
| --- | --- | --- |
| **New feature request** (FEAT-\*, `feat:` in title) | dispatcher + fullstack-dev | Dispatcher refines scope, sketches acceptance; fullstack-dev picks up bounded implementation. Pair with `/crew:build` to auto-select bounded skills. |
| **Urgent bug fix** (`fix:` commits, production-impacting) | dispatcher + verifier | Dispatcher triages and scopes; fullstack-dev fixes in isolation; verifier confirms behavior before merge. May skip reviewer if fix is trivial, but document the decision. |
| **Code quality / simplification** (refactor, lint, complexity cuts) | reviewer + fullstack-dev | Fullstack-dev owns refactor; reviewer gates the changes. Tests must stay green. No behavioral change expected. |
| **Standalone quality sweep** (stale-ref cleanup, complexity cap enforcement, manifest consistency) | `crew:refactor` | Dispatch as a standalone slice. Agent scans repo (or scoped path), fixes directly, writes `.claude/artifacts/crew/quality/` artifact before committing. Reviewer gates the artifact + diff. Hard stop at >20 files affected. |
| **Documentation-only change** (docs, README, guides) | dispatcher (optional review) | No behavioral change; minimal quality gate needed. Helpful to spot gaps but not blocking. |
| **Dependency updates / chore** (chore:, version bump, marketplace sync) | release-engineer + reviewer | Release-engineer or dispatcher owns the change; reviewer validates no silent breakage. Post-merge, release-engineer confirms artifact/plugin registration is live. |
| **Ambiguous scope** (unclear where to start, spans multiple modules) | dispatcher | Re-scope task, define boundaries, then dispatch to fullstack-dev. Use `/crew:using-crew` to frame the work. |
| **Cross-module / architectural refactor** (touches 5+ files, changes public API) | dispatcher | Too large for single fullstack-dev. Dispatcher shapes the plan; consider splitting into smaller FEATs or slices. |
| **Validation or behavior verification needed** (user-facing behavior changed, or tests added) | verifier | Run the app, verify user-visible behavior, document evidence. Pair with `/verify` skill. |
| **Ship or release** (merge, promote to production, tag release) | release-engineer + dispatcher approval | Release-engineer owns the push; the dispatcher explicitly approves production-bound changes. Validation must be complete. |
| **Production promotion** (any deployment to prod, customer environments, live traffic) | dispatcher (explicit human approval required) | **Always** require explicit human sign-off before production-bound work merges or ships. No automation here. |
| **Session start / work planning** (new task, unclear next steps) | dispatcher | Retrieve bounded context with `/crew:brief-me`. Define scope, assign to role, set pace. Avoid ambiguity at start. |
| **Blocked work or escalation** (dependency unmet, config broken, ambiguous requirements) | dispatcher | Unblock by re-scoping, deferring, or escalating to stakeholder. Document the blocker in repo memory. |
| **New feature scope unclear or ambitious** (large FEAT, cross-cutting concern, product direction question) | dispatcher via **gstack `/office-hours`** + **`/plan-ceo-review`** | Dispatcher uses `/office-hours` (6 forcing questions) then `/plan-ceo-review` (CEO scope challenge) before writing the slice or dispatching fullstack-dev. Reduces scope drift before implementation starts. |
| **Pre-compaction or multi-agent handoff context prep** (≥3 compactions observed, agent handoff with heavy context, session checkpoint at milestone) | dispatcher | Load `skills/workflow/context-curation/`. Use Quick / Full / Archived formats per the skill's size budgets. Pair with `/loop:snapshot-memory` for durable cross-session memory. |
| **SPEC authoring or large-scope FEAT decomposition** (multi-FEAT spec, multi-week project, multi-stack capability) | dispatcher / architect | Load `skills/workflow/spec-decomposition/` for structured WBS + dependency graph + parallelism map + risk register. Pair with `/loop:spec-decompose` for FEAT-NNN derivation. |
| **Slice sizing / dispatch-budget estimation** (estimating turns before dispatch, deciding whether to split) | dispatcher | Load `skills/workflow/slice-sizing/` for 8/80-hour atomic action rule + fullstack-dev cap-budget evidence. Pairs with `skills/workflow/spec-decomposition/`. |
| **Parallel autonomous-safe feature execution** (run multiple triaged FEATs simultaneously in isolated worktrees) | `/crew:parallel` skill (Path A, FEAT-136) | Use `/crew:parallel [--max-features N]`. Creates one git worktree per FEAT, resolves the loop CLI path, calls `loop dispatch prepare` to spawn worktrees, then dispatches `crew:build` per worktree **in one parallel Agent block** (no `parallel-runner` agent involved—Path A avoids hook conflicts). Each `crew:build` runs the per-worktree slice ceremony inline. After all agents return, calls `loop dispatch finalize` to merge DONE children to main in priority order. Conflicted branches left alive for manual resolution. |
| **Quick-win chore lane** (small doc / comment / artifact-hygiene wins to harvest alongside an active wave/slice, disjoint from its files) | `/crew:quickwin` skill (#163) | Spawns or reuses a date-keyed `chore/quickwins-<date>` worktree (`crew quickwin-lane spawn`) so wins commit + PR + merge independently of the active wave branch. Verify the file set is disjoint from the active wave lane first (`crew claim-check`) — overlapping files route onto the wave branch instead; claim only the disjoint set. Docs-only pushes skip the verifier gate (pre-push-verifier docs-only early-allow). Batch the day's wins into one PR. |
| **Light-tier mechanical build** (≤2 files, ≤50 LOC diff, no new abstractions, no public-surface change — typos, mechanical renames, comment removal, format tweaks, single-function bug fix) | `crew:dev-lite` | Surgical editor; escalates back to fullstack-dev if scope grows past the cap. Pairs with the light-tier review row below. |
| **Light-tier fast review** (reviewing a `dev-lite`-scoped diff — ≤2 files, ≤50 lines, semantically trivial) | `crew:reviewer-lite` | Single review pass with one stack skill auto-loaded from diff extensions. Returns `review_decision` only — validation stays owned by the pre-push hook + `/crew:ship`. |
| **Test suite build-out or flaky-suite fix** (missing coverage identified by `qa-expert`, explicit AC list needs a test harness, flaky suite needs stabilizing) | `crew:test-automator` | Consumes `qa-expert` gap reports or explicit AC lists; builds suites/fixtures/harnesses and CI wiring. Test code only — never edits product source to make a test pass. |

### Review + quality gates

_Code review, quality enforcement, TDD, security, model-selection, and validation-skip decisions._

| Signal | Route to | Notes |
| --- | --- | --- |
| **Reviewer feedback / code quality gate** (PR review needed, lint check, "review this PR", "review my diff") | **`crew:reviewer` agent** (exact name) | Reviewer gates all code-bearing changes before merge. Feedback written as inline PR comments when possible. **Do not dispatch `code-reviewer` or other generically-named review agents for crew review phase** — they have overlapping trigger phrases ("review this PR") but do not honor the Crew review-artifact contract or `agents/reviewer.md` policy. Use them only for ad-hoc spot-checks outside `/crew:review`. |
| **Review or validate dispatch for a slice** (`/crew:review` or `/crew:validate` invoked for a slice) | `commands/review.md`, `commands/validate.md` → `scripts/lib/build-bundle/inline.ts` | Before the reviewer / verifier subagent is dispatched, the command resolves the current slice id from `.claude/state/crew/workflow-state.json` and calls `inlineLatestBundle({ sliceId })` to preload the fullstack-dev's working set (handoff body, `git diff`, touched + Read file contents) under a `## Fullstack-dev context (preloaded — do not re-Read these files)` header inlined before the role-specific task body. Empty return when no bundle exists — non-blocking, dispatch proceeds with today's handoff-only prompt. Schema: `docs/standards/build-bundle-schema.md`. |
| **Plugin shape change** (diff touches `.claude-plugin/marketplace.json`, `plugin.json`, `agents/`, `commands/`, `hooks/`, or `.mcp.json`) | reviewer via **`plugin-dev:plugin-validator`** | Reviewer invokes `plugin-dev:plugin-validator` for manifest + structure review _alongside_ the local CI gate `node ./scripts/validate-manifests.ts` (the latter is hard-fail). Cite both in the review-result artifact. |
| **Skill shape change** (diff touches any `skills/**/SKILL.md`) | reviewer via **`plugin-dev:skill-reviewer`** | Reviewer invokes `plugin-dev:skill-reviewer` for triggering-effectiveness + best-practice feedback, plus `node ./scripts/validate-skills.ts` for the structural quality bar (tier, ≤200 lines, required headings). Both required when skills change. |
| **TDD / test-adequacy enforcement on review** | `agents/reviewer.md` TDD gate + `scripts/crew.ts` hard-gate in `write-review-result` | reviewer must populate `--test-summary` for approved code-bearing diffs; CLI exits non-zero otherwise. |
| **Code-bearing slice completed (build → review → validate)** | dispatcher → always `crew:verifier` | Builders run only affected-class tests + typecheck (scoped fast inner loop); the verifier owns the mandatory full gate — whole-repo `npm run lint`, the format check, the complete test suite, and the full verifier suite (`scripts/validate-all.ts`). **No skip path, even for code-only diffs** (supersedes the former FEAT-030 reviewer-bundled-validation skip). Only an explicit environment-blocked `validation_skipped` is permitted. |
| **Slice opens (subagent dispatch ahead)** | dispatcher | apply model-selection gate per `docs/standards/model-selection.md` — recommend Sonnet for spec-framed mechanical slices, Opus only for ambiguous architecture / hard refactor / design choice; surface recommendation in run-brief; track via `cost-report.modelMix` (FEAT-031) |
| **Security-sensitive change** (auth, crypto, input handling, secrets, RBAC, token management) | reviewer via **gstack `/cso`** | Reviewer invokes `/cso` (OWASP + STRIDE audit) alongside normal review for security-bearing diffs. Complements crew review artifacts with security-specific findings. Co-cite: `skills/domain/security-advisory/` for subject-area discipline guide. |
| **Dependency / lockfile change** (diff touches `package.json`, `bun.lock`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.csproj`) | reviewer via **`skills/domain/security-sweep/`** | Reviewer loads security-sweep alongside the existing per-language reviewer. Pre-flight CVE audit (reviewer.md lines 103-104) is replaced by the structured procedure in the skill — same commands, but findings emitted as severity-tagged path+line blocks and counted in the review-result `--findings` count. |
| **Auth-touching diff** (diff touches files matching `(auth\|login\|signin\|signup\|jwt\|oauth\|session\|token\|password\|crypto\|secret\|credential)`, or path under `*/auth/*`, `*/security/*`) | reviewer via **`skills/domain/security-sweep/`** + **`skills/domain/security-advisory/`** | Co-load with security-advisory for OWASP / threat-model context. Secrets-scan pattern set in security-sweep runs severity-tagged path+line emission on the diff; security-advisory handles OWASP-shape questions. Replaces the implicit "remember to invoke /cso" path with an auto-trigger. |
| **Diff under review (any code-bearing change)** (reviewing a PR, diff, or completed implementation) | reviewer | Load `skills/workflow/reviewing-code/` for review procedure — correctness, regressions, scope drift, test-gap checks. Pairs with `plugin-dev:plugin-validator` and `plugin-dev:skill-reviewer` when the diff touches plugin shape or skills. |
| **Test suite quality questioned** (coverage looks adequate but `test_confidence` grade < 0.80 across recent slices, or reviewer suspects flaky / anti-pattern / weak-assertion tests) | `qa-expert` via **`skills/workflow/test-quality/`** | Loads the test-quality lens — flaky-test regex set (timer/sleep/wall-clock/non-seed-random/shared-state), anti-pattern scan (assertion-free, tautological assert, over-mocking), and mutation-testing advisory for critical-path modules. Findings emitted as `[SEVERITY] file:line` blocks parallel to security-sweep. Advisory tier — does NOT auto-block merge; qa-expert applies judgment via the `quality_concerns` verdict. |
| **Architecture design review before build** (an ADR, design proposal, or system topology needs independent evaluation before builders start) | `crew:architect-reviewer` | Assesses service boundaries, scalability, technical debt, integration patterns, and modernization risks. Distinct from `crew:reviewer` (code-change review) and `crew:architect` (design authoring). |
| **C# / .NET stack-quality fan-out review** (`stack:csharp` slice needs deep .NET idiom review) | `crew:csharp-reviewer` (alongside `crew:reviewer`) | Read-only fan-out — async correctness, EF Core patterns, ASP.NET Core wiring, null safety, production readiness. Returns `[SEVERITY] file:line` findings. |
| **TypeScript / Node stack-quality fan-out review** (`stack:typescript` slice needs deep TS idiom review) | `crew:typescript-reviewer` (alongside `crew:reviewer`) | Read-only fan-out — compiler compliance, type safety, Zod boundaries, async correctness, React rules, banned libraries, supply chain. Returns `[SEVERITY] file:line` findings. |

### Code & language

_Language- and framework-specific build signals._

| Signal | Route to | Notes |
| --- | --- | --- |
| **Building / editing Microsoft SDK code** (Azure SDKs, .NET libs, M365 APIs, anything namespaced `Microsoft.*` / `Azure.*`) | fullstack-dev via **`microsoft-docs:microsoft-code-reference`** | Verify method signatures + parameter shapes against official MS docs before committing. Catches hallucinated APIs that pass type-check but fail at runtime. Reviewer cross-checks on the way in. |
| **Backend code change, untagged slice** (server-side logic, API handlers, data layer, service orchestration; no surface:*/stack:* tags — tagged slices follow the Builder routing matrix above) | fullstack-dev | Load `skills/domain/architecture/backend-advisory/` for backend patterns and quality bar. Tagged backend slices route to `crew:backend-dev` per the Builder routing matrix — this generalist row is the untagged fallback only. |
| **Frontend code change, untagged slice** (UI components, client-side logic, CSS, browser-rendered output; no surface:*/stack:* tags — tagged slices follow the Builder routing matrix above) | fullstack-dev | Load `skills/domain/ui/react-engineering/` for frontend patterns and quality bar. Tagged UI slices route to `crew:frontend-dev` per the Builder routing matrix — this generalist row is the untagged fallback only. |
| **Full-stack change spanning both frontend and backend, untagged slice** (shared data shape, API + UI wired end-to-end; tagged cross-layer slices follow the Builder routing matrix above) | fullstack-dev | Load `skills/domain/architecture/fullstack-advisory/` for cross-layer coherence checks. Pairs with backend and frontend advisory rows when the diff touches both surfaces separately. |
| `tags include surface:ui or stack:react AND (tags include surface:api/schema OR stack:csharp/node/python)` | dispatch `crew:frontend-dev` for FE diff + `crew:backend-dev` for BE diff in parallel (orchestrate-slice Step 2+3); integrator gates afterward | <!-- routing-lint:ignore --> |
| `tags include surface:ui or stack:react AND NOT (any backend stack tag)` | dispatch `crew:frontend-dev` only | <!-- routing-lint:ignore --> |
| `tags include (surface:api or surface:schema or any backend stack:*) AND NOT (surface:ui or stack:react)` | dispatch `crew:backend-dev` only | <!-- routing-lint:ignore --> |
| **Python code change** (`*.py` file edit, FastAPI/Django/Flask service, data pipeline) | fullstack-dev | Load `skills/domain/python-pro/` for type-safe, async, Pythonic patterns and quality bar. |
| **TypeScript / TSX code change** (`*.ts` / `*.tsx` file edit, any framework or runtime) | fullstack-dev | Load `skills/domain/typescript-pro/` for advanced type system patterns, full-stack type safety, and build tooling guidance. |
| **AI app / LLM SDK code** (Anthropic / OpenAI SDK imports, prompt engineering infra, agent frameworks, model training or inference code) | fullstack-dev | Load `skills/domain/ai-engineering/` for end-to-end AI system guidance. Co-cite `skills/domain/prompt-engineering/` for prompt-authoring concerns. |
| **React-specific code** (hooks, state management, Server Components, Suspense, concurrent rendering, performance, React Testing Library, Next.js App Router) | fullstack-dev | Load `skills/domain/ui/react-engineering/`. Co-cite `skills/domain/ui/react-engineering/` for general frontend concerns. Co-cite `skills/domain/typescript-pro/` for `*.tsx` type patterns. |
| **Tailwind CSS change** (utility-class styling, responsive variants, `tailwind.config.*`, dark-mode tokens, plugin authoring) | fullstack-dev | Load `skills/domain/ui/tailwind-patterns/` for utility-first patterns, responsive design, and anti-patterns. Co-cite `skills/domain/frontend-design/` for visual layout context. |
| **Frontend visual / creative design** (CSS layout, color systems, typography, visual hierarchy, design-to-code) | fullstack-dev / uxdesigner | Load `skills/domain/frontend-design/` for visual design patterns and CSS best practices — `references/structural-dna.md` for page structure, `references/style-selection.md` for direction/palette/fonts per product type. Co-cite `skills/domain/ui/tailwind-patterns/` when stack uses Tailwind. |
| **UI design quality complaint** ("looks generic", "AI slop", low visual polish, template feel) | uxdesigner | Load `skills/domain/frontend-design/` end-to-end: run the reference-research + structural-DNA process, produce a UX spec with explicit `## Visual direction`, and gate the rebuild against `references/react-ui-quality.md`. |
| **Mobile app code change** (React Native, Flutter, iOS Swift, Android Kotlin, mobile-specific APIs) | fullstack-dev via `agents/3rdparty/mobile-developer.md` | Delegate implementation to `mobile-developer`. Co-cite `skills/domain/mobile/mobile-design/` for mobile UX constraints. |
| **MCP server authoring or debugging** (Model Context Protocol server, tool definitions, resource handlers, Claude extension) | fullstack-dev | Load `skills/domain/mcp-integration/` for config format, security, and integration patterns. |

### Architecture

_ADR authoring, system design, database, cloud infra, API contract decisions._

| Signal | Route to | Notes |
| --- | --- | --- |
| **Architecture sketch / system design** (ADR drafting, system design, capacity or topology decisions) | `agents/architect.md` | Load `skills/domain/architecture/architecture-advisory/`. Architect handles backend service architecture inline (see `## Backend architecture` section). Delegates to `agents/cloud-architect.md` via Agent tool for cloud concerns; DB concerns handled inline by architect. For API contract work load `skills/domain/architecture/api-architecture/` inline; for diagrams load `skills/domain/architecture/diagram-methodology/` inline. |
| **Schema design / migration planning / database performance tuning** (ER modeling, schema evolution, index strategy, technology selection, multi-tenancy, sharding, CQRS, event sourcing) | architect / fullstack-dev | Load `skills/domain/backend/database-architecture/`. PostgreSQL-specific query tuning (EXPLAIN analysis, index strategy, replication) is handled inline with that skill loaded. |
| **Cloud infra design** (multi-region, landing zone, IAM, network topology, multi-cloud, disaster recovery, cost optimization, FinOps) | architect / release-engineer | Load `skills/domain/infra/cloud-architecture/`. For IaC specifics, co-cite `skills/domain/infra/devops-engineering/references/iac.md`. |

### Infra & ops

_CI/CD, IaC, Terraform, incident response, performance benchmarks, web UI validation._

| Signal | Route to | Notes |
| --- | --- | --- |
| **CI/CD pipeline change** (`.github/workflows/*.yml`, `azure-pipelines.yml`, `Jenkinsfile`, `*.gitlab-ci.yml`, build-system config) | release-engineer | Load `skills/domain/infra/devops-engineering/` + `references/ci-cd.md` for pipeline-specific patterns (stages, artifact management, deployment strategies, anti-patterns). |
| **IaC change** (Terraform, Bicep, Helm, Ansible) | release-engineer + fullstack-dev | Co-cite alongside the Terraform HCL row: load `skills/domain/infra/devops-engineering/references/iac.md` for module patterns, state management, and multi-env variable isolation. For provisioner timing, multi-env drift, and TLS/ACME failures, also load `skills/domain/infra/terraform-ops-traps/`. |
| **Terraform operational issue** (state drift, multi-env config drift, container `Restarting` after `apply`, TLS/ACME failure, fresh-instance bootstrap) | researcher + fullstack-dev via **`crew:terraform-ops-traps`** ops-traps body + `references/{provisioner-traps,multi-env-isolation,zero-to-deploy}.md` | Operator-incident patterns with copy-paste fixes. Load `references/*.md` on demand for full HCL examples — the main skill body stays ≤200 lines. |
| **Incident response / production troubleshooting** (deployment failure, CrashLoopBackOff, service 503, postmortem) | release-engineer + verifier | Load `skills/domain/infra/devops-engineering/references/troubleshooting.md` for structured gather-facts → diagnose → fix → verify → postmortem procedure. Pairs with `skills/workflow/root-cause-discipline/` for root-cause tracing. |
| **Rollback-readiness assessment / rollback-vs-forward-fix call under active incident** | release-engineer | Load `skills/domain/infra/deployment-patterns/` → `## Rollback decision matrix`. Match severity × data impact × time-to-fix; cite the matched matrix cell + applicable tie-breaker in `--evidence`. Default to rollback when blast radius is growing or diagnosis confidence < 70%. |
| **Silent-failure risk on runnable change** (server / worker / hook / CLI entry / scheduled job) | reviewer | Load `skills/workflow/review-gates/` → `### Silent-failure hunt`. Scan for swallowed errors, catch-then-continue without telemetry, dropped promise rejections, inadequate fallbacks, missing health-check tiers (liveness / readiness / startup), and `process.exit()` from library functions. |
| **Performance-sensitive change shipped** (latency-critical path, throughput regression risk, bundle size impact) | release-engineer / verifier via **gstack `/benchmark`** | Gather perf evidence alongside deployment evidence. Run before and after to produce delta metrics. |
| **Web UI behavior changed** (frontend components, user-visible flows, browser-rendered output) | verifier (local browser harness only — **gstack `/qa` DISABLED**: Playwright path was unstable + could exit current repo context) | Verifier runs `bun test --parallel <ui-test.test.ts>` locally and records `gstack: unavailable — fell back to local harness` in `--evidence`. Do NOT invoke `/qa`. Re-enable only after the cross-repo stability issue is resolved. |
| **Web app E2E / integration testing** (end-to-end browser tests, integration smoke, API contract validation at runtime) | verifier / integrator | Load `skills/workflow/webapp-testing/` for structured test scenario design and evidence requirements. **gstack `/qa` DISABLED** (Playwright path unstable across repos) — use local browser harness; screenshot evidence will be missing. |
| **Docker containerization** (Dockerfile authoring, multi-stage builds, docker-compose, image optimization, registry management) | fullstack-dev / release-engineer | Load `skills/domain/infra/docker-expert/` for container patterns, security hardening, and optimization. Co-cite `skills/domain/infra/devops-engineering/` for pipeline integration. |
| **Performance regression risk on a slice** (latency-critical path, N+1 risk, throughput regression, needs benchmark evidence before merge) | `crew:performance-engineer` | Analyzes latency, throughput, Core Web Vitals, and query optimization. Complements the **Performance-sensitive change shipped** row (release-engineer / verifier via gstack `/benchmark`) — the engineer produces the analysis, verifier/release-engineer gathers deployment-time evidence. |

### Research

_Library lookups, MS docs, bug root cause, multi-source synthesis._

| Signal | Route to | Notes |
| --- | --- | --- |
| **Library / API uncertainty** ("is method X still supported?", "current docs for Y", touching unfamiliar npm package, unsure of signature) | researcher / fullstack-dev / reviewer via **context7 MCP** | Call `context7.resolve-library-id` then `context7.get-library-docs` before recommending or editing. Reviewer also consults context7 when verifying API claims in the diff under review. If context7 has no coverage for the library, fall back to general web docs rather than retrying. Pairs with `microsoft-docs:microsoft-code-reference` for MS-tech. Server pinned in `.mcp.json`. |
| **Microsoft tech concept question** ("how does Cosmos partitioning work?", limits, quotas, configs, capabilities) | researcher via **`microsoft-docs:microsoft-docs`** | Authoritative MS lookup before web search. Use for understanding ("what is X") rather than code ("how do I call X" — that's microsoft-code-reference). |
| **Bug root cause unclear after initial triage** (intermittent failure, multi-layer interaction, repro-resistant) | researcher via **gstack `/investigate`** | Escalation path when `/crew:fix` hits a wall. gstack's `/investigate` applies structured debugging methodology. |
| **Bug root cause / intermittent failure** (root cause not clear after first triage, multi-layer interaction, repro-resistant) | verifier or researcher | Load `skills/workflow/root-cause-discipline/` for structured root-cause tracing. Complements gstack `/investigate` as an escalation path. |
| **Multi-source research / synthesis** (claim verification across sources, contradictory sources, primary vs secondary source analysis, multi-domain research coordination) | researcher | Load `skills/workflow/research-coordination/` for complexity assessment, specialist allocation, iteration strategy, and source quality heuristics. |
| **Codebase investigation** (tracing behavior/dependencies in C#/.NET, TypeScript/React, or plugin internals; "where is X", "what calls Y", impact or option analysis) | researcher | Load `skills/workflow/code-investigation/` for the clarity gate, evidence ladder, and per-mode output formats; pull the matching `references/{csharp,typescript-react,plugin-dev}.md` for stack first-checks. Boundary: Explore/crew:investigator = cheap locate, no artifact; researcher = findings that must persist as a handoff with confidence + risks. |
| **Spec pre-flight research** (`/crew:architect-feature` step 1 — findings feeding a contracts artifact) | researcher | Load `skills/workflow/code-investigation/` → `references/spec-driven.md`. Output FINDING / CONSTRAINT / EDGE CASE / DEPENDENCY / NFR blocks with citations and real identifiers so the architect can write contracts directly from them. |

### Docs & comms

_API documentation, diagram authoring, commit messages, handoff CLI._

<!-- Migration note (FEAT-124, hero-crew v0.20.0, 2026-06-07 — TTL 2026-12-07):
     The prior hero-crew copywriter agent (subagent identifier: crew + colon
     + copywriter) was hard-removed in v0.20.0. Any external workflow still
     dispatching that identifier should migrate to subagent identifier
     loop + colon + document-writer. Loop v0.29.0 is the minimum required
     version (scope-extended to cover API docs + diagram captions). -->

| Signal | Route to | Notes |
| --- | --- | --- |
| **API documentation authoring** (OpenAPI specs, SDK reference guides, integration guides, error documentation, versioning, deprecation notices) | `crew:document-writer` | Load `skills/workflow/api-documentation/`. Co-cite `skills/domain/architecture/backend-advisory/` for API design concerns. |
| **Diagram authoring** (architecture diagrams, flowcharts, sequence diagrams, ERDs, state machines, dependency graphs, Mermaid / PlantUML / Draw.io / ADR diagrams) | `crew:document-writer` + `loop:architect` | Document-writer owns Markdown authoring; architect selects diagram type via auto-pick decision tree. Both consult `skills/domain/architecture/diagram-methodology/` (format selection, auto-pick, templates) and `skills/workflow/diagram-review/` (post-authoring lint). |
| **Authoring a git commit message** (after a code change is complete and staged) | fullstack-dev | Load `skills/workflow/git-commit/` for commit-message format, conventional-commit style, and co-author footers. |
| **Subagent completion report** (any role finishing a delegated task) | role via `write-handoff` CLI | Agent calls `node ... crew.ts write-handoff` via Bash; returns path + 1–3 sentence headline. The dispatcher reads the full report from the path on demand. Inline returns re-inflate dispatcher context. |
| **Fullstack-dev completion — build bundle** (fullstack-dev or frontend-dev / backend-dev finishes a slice and writes handoff) | fullstack-dev via `scripts/crew.ts write-build-bundle` | After `write-handoff`, fullstack-dev calls `node scripts/crew.ts write-build-bundle --slice <id> --builder <name> --run <runId> --handoff <path> --files <a,b> --files-read <c,d>` to persist a structured bundle (handoff body, `git diff`, full contents of touched + Read files) under `.claude/artifacts/crew/bundles/{slice}/`. Non-blocking on failure — log the error and continue. Applies to `crew:fullstack-dev`, `crew:backend-dev`, `crew:frontend-dev`. Schema: `docs/standards/build-bundle-schema.md`. |

### UX

_UX design, interaction design, accessibility._

| Signal | Route to | Notes |
| --- | --- | --- |
| **UX / UI design** (layout decisions, user flows, interaction design, component wireframes) | `agents/uxdesigner.md` | Load `skills/domain/ui/react-engineering/`. UXDesigner delegates to `agents/3rdparty/{ui-ux-designer,expert-react-frontend-engineer,frontend-developer}.md` via Agent tool. |
| **UX research / persona work / interaction design / accessibility audit** (user interviews, persona modeling, IA, heuristic evaluation, WCAG compliance, AI interface patterns) | uxdesigner | Load `skills/domain/ui/ux-methodology/`. For research synthesis, co-cite `skills/workflow/research-coordination/`. For implementation, co-cite `skills/domain/ui/react-engineering/` or `skills/domain/ui/react-engineering/`. |
| **Mobile app design** (iOS/Android UX, React Native layouts, Flutter widgets, mobile interaction patterns, touch targets, platform conventions) | uxdesigner / fullstack-dev | Load `skills/domain/mobile/mobile-design/`. For implementation, delegate to `agents/3rdparty/mobile-developer.md`. |

### Crew internals

_Plugin authoring, agent edits, cost analysis, model selection, autonomous_safe flags._

| Signal | Route to | Notes |
| --- | --- | --- |
| **Cost analysis or optimization** (expensive operations, token burn investigation) | researcher (read-only) + dispatcher decision | Researcher investigates and reports; the dispatcher decides on action (optimize, accept, defer). |
| **Editing this plugin's own `agents/*.md`** (any change to dispatcher/builder/reviewer/validator/deployer/researcher prompts) | fullstack-dev via **`plugin-dev:agent-development`** | Catches frontmatter weakness, tool over-scope, weak `description:` triggers. Downstream reviewer gate: see existing **Plugin shape change** row — do **not** skip the reviewer step. Co-cite: `skills/domain/prompt-engineering/` for prompt-authoring discipline. |
| **Editing this plugin's own `skills/**/SKILL.md`\*\* (authoring new skills or modifying existing ones) | fullstack-dev via **`plugin-dev:skill-development`** | Builder-side complement to FEAT-017's reviewer-side wiring. Pairs with `scripts/validate-skills.ts` (CI gate, hard-fail) + downstream reviewer via **Skill shape change** row — do **not** skip the reviewer step. Co-cite: `skills/meta/skill-creator/` for skill-authoring methodology. |
| **Specialist-agent prompt edit** (any change to `agents/{architect,uxdesigner}.md`) | fullstack-dev + human-in-loop review | All three are `autonomous_safe: false` — changes require human-in-loop review before merging. See `docs/governance.md` autonomous_safe policy section. |
| **Plugin-internals implementation** (agent prompts, skills, slash commands, hooks, MCP integrations, plugin manifests, plugin-scoped TypeScript scripts) | `crew:aiplugin-dev` | Senior Claude Code plugin specialist; consumes the `plugin-dev:*` skill suite plus prompt-engineering + ai-engineering. Complements the neighboring **Editing this plugin's own agents/*.md** and skill-editing rows above. |

---

## Usage

1. **At session start**: Dispatcher or verifier retrieves bounded context with `crew:brief-me`.
2. **Incoming work**: Classify the signal using the table above.
3. **Route to role**: Dispatch with clear scope boundary; cite this table in the handoff.
4. **Ambiguous or cross-cutting**: Route to the dispatcher (re-scope inline) for re-scoping instead of improvising scope.
5. **Production-bound**: Always escalate to explicit human approval before promoting.

## Design principles

- **One role per task** except for brief handoffs (dispatcher + fullstack-dev, reviewer + release-engineer).
- **Explicit is better than implicit** — ambiguous signal always goes to dispatcher.
- **No LLM router** — use heuristics + human judgment.
- **Humans stay in control of production** — no automation for live-customer promotions.
