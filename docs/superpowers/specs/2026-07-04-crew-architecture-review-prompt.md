# Prompt — Crew Core Agents + Workflow Architecture Review (revised v2)

You are a senior AI-agent platform architect reviewing the `crew` repo (`dev-team`).

Do not optimize for agreement. Your primary objective is to identify weaknesses, hidden
technical debt, scalability risks, and production-readiness gaps. Assume the repository
will support thousands of users and years of maintenance. Challenge existing assumptions
when evidence justifies it.

Goal: improve core agents, agent coordination, model selection, eval/GEPA machinery, and
optional model-agnosticism — without a rewrite. Deliver quick wins, production-readiness
improvements, and a staged plan.

## Mandatory inspection protocol

Before making ANY recommendation:

1. Inspect the repository — read the actual files, not just directory listings.
2. Verify the current implementation against every claim you make.
3. Reject outdated assumptions (including any in this prompt) when the repo contradicts them.
4. Explicitly state when an assumption could not be verified and mark the finding accordingly.

Never infer architecture from filenames alone. Never recommend before reading.

## Finding format — required for every finding in every section

- **Severity:** Critical / High / Medium / Low
- **Confidence:** High / Medium / Low (Low = could not fully verify in repo)
- **Repository evidence:** file path(s), line references where practical, quoted snippet if short
- **Why it matters**
- **Recommended fix**
- **Estimated implementation effort:** S / M / L

Findings without repository evidence are not findings — drop them or mark Confidence: Low
with an explicit note on what could not be verified.

## Ground truth — verified as of 2026-07-04. Re-verify; build on, don't re-propose.

- **crew is a Claude Code plugin, not a standalone framework.** Agents are markdown
  prompts under `agents/*.md` (≤350 lines, CI-enforced by `scripts/validate-agents.ts`).
  The Claude Code harness dispatches agents, executes tools, and resolves models. The
  plugin does NOT own an LLM API call site for agent execution. There is no
  `crew run <workflow>` runtime and you must not invent one.
- **Model tiers already exist.** All ~24 agents declare `model: opus|sonnet|haiku`
  frontmatter aliases. No pinned model IDs in `agents/`. The tier problem is naming
  (Claude-specific aliases) and lack of per-profile indirection — not hardcoded IDs.
- **The judge layer is already provider-agnostic.** Canonical interface: `LLMJudge` from
  `@astragenie/gepa-core` (FEAT-184, shipped). Seven adapters in `evals/providers/`
  (groq, gemini, ollama, generic-openai — covers OpenRouter/DeepSeek/Mistral/xAI/vLLM —
  azure-openai, bedrock, claude-p). Registry in `evals/lib/judge.ts`. Per-agent YAML
  specs in `evals/agents/*.yaml` with judge fallback chains, `validate_with`
  cross-org triangulation, and daily budget caps (`evals/lib/meter.ts`).
- **A GEPA prompt-optimization loop exists.** Capture → eval → candidate generation →
  Pareto selection → soak → promotion, with promotion policy (+5% PASS delta, tail-risk
  floor 0.6, ≥20 soak trials, ≤21-day cap), critical-agent allowlist (inspector,
  verifier, architect → draft PR only), six kill-switches, champion provenance
  frontmatter. Design: `docs/superpowers/specs/2026-06-27-gepa-skill-improvement-loop-design.md`.
  Trials land in `.claude/artifacts/crew/gepa/trials/`.
- **In-flight work you must align with, not fork:** FEAT-185 (migrate 6 judge providers
  into `gepa-core` 0.3.0/0.4.0), FEAT-186 (unified cost-aggregation contract). Check
  `.claude/artifacts/loop/backlog/` for current state before proposing overlapping work.
- **Workflows are commands + skills + dispatch, not code.** Orchestration =
  slash commands (`commands/`), skills (`skills/`, four tiers: universal/workflow/domain/meta),
  the companion `runner` plugin's slice ceremony, and peer-dispatch whitelists
  (FEAT-163: 10 agents may dispatch declared peers; review/validation gates stay
  orchestrator-only). Routing is `docs/routing-table.md` (markdown, parsed by the lead
  at session start).
- **Hard constraints:** `evals/lib/**` and `evals/providers/**` must not import from
  `agents/`, `scripts/`, `src/`, `hooks/`, `commands/` (Biome-enforced; protects the
  planned extraction to a standalone eval plugin). Bun runs tests/lint; Node runs CLI
  validators (ADR-002). Agent prompt cap 350 lines. CI gates in
  `.github/workflows/test.yml` are blocking; lint must stay zero-warning.

## Mission

Inspect the repo and produce a practical improvement plan for:

1. Core agent definitions (prompt quality, responsibility overlap, skill routing)
2. Agent-to-agent coordination (peer dispatch, handoff contracts, gate ordering, coupling)
3. Model tier indirection and optional provider profiles (three-layer model below)
4. Eval coverage + GEPA loop improvements
5. Machine-readable routing/config externalization
6. Architectural fitness functions, dead code, and long-term maintainability
7. Smoke tests and regression checks
8. Memory & learning loop — pluggable MemoryProvider (unset | file | astramem) for
   decisions/learnings/failures awareness at dispatch time
9. Quick wins vs deeper refactors

Prefer incremental changes. If something is unknown, inspect the repo instead of guessing.

## The three model layers — analyze each separately

| Layer | Owner | Current state | What to propose |
|---|---|---|---|
| **Agent execution** | Claude Code harness via frontmatter alias | `opus/sonnet/haiku` per agent | Tier indirection: neutral tier names (e.g. `reasoning/standard/light`) in a profile file, resolved into frontmatter by a build/install step, validated by `validate-agents.ts`. Plus a prompt-portability audit: find Claude-Code-specific tool names / harness assumptions in agent prompts; produce a tool-name mapping table (pattern: superpowers `references/codex-tools.md`) so prompts survive under Codex CLI / Copilot harnesses. |
| **Eval candidate runner** | Repo (`evals/agents/*.yaml` → `candidate:`) | Only `claude-p`; model pinned as `claude-sonnet-4-6` in both existing specs | The one genuinely hardcoded spot. Propose: parameterize `candidate.model` via profile/env (`CREW_MODEL_PROFILE`); add a `codex-p` or generic-openai candidate runner so the SAME agent prompt can be evaluated under a GPT candidate. This is the real Claude-vs-Codex comparison path. Mirror the judge-registry pattern (3-step recipe in `evals/README.md`). |
| **Eval judge** | Repo (`JUDGE_REGISTRY`) | Done — 7 providers, fallback, triangulation, budget | Do not redesign. Only propose: disagreement telemetry between primary and `validate_with` tiers, and alignment with FEAT-185/186. |

One possible profile shape is shown below. Improve or replace it if a better design
exists while preserving the stated constraints — do not treat this draft as the answer.

```yaml
# models.yaml — resolved at install/build time, never at agent runtime
default_profile: claude

profiles:
  claude:
    reasoning: opus      # harness alias; IDs allowed for non-alias harnesses
    standard: sonnet
    light: haiku
  codex:
    reasoning: gpt-5.x-high
    standard: gpt-5.x
    light: gpt-5.x-mini
```

Non-negotiable constraints regardless of shape: reject unknown profile, reject missing
tier, `claude` stays the default, no runtime dependency — a repo with no profile file
behaves exactly as today.

## What to inspect first

- `agents/*.md` — frontmatter, peer-dispatch sections, overlap between the three
  reviewer agents (inspector / typescript-reviewer / c-sharp-reviewer) and the builder
  generalists (fullstack-dev vs backend-dev/frontend-dev)
- `docs/routing-table.md` — routing signals (BE_ONLY / FE_ONLY / TS_TOOLING_ONLY), staleness risk
- `commands/` + `skills/` — duplicated orchestration logic, gate ordering
- `evals/` — specs, fixtures, providers, meter, budget; which agents lack specs
- GEPA design doc + trial corpus + promotion policy defaults
- `scripts/validate-*.ts` — what CI already enforces, where new validation should hook in
- `docs/governance.md`, ADRs, `docs/architecture/architecture.md` — recorded decisions
- `.claude/artifacts/loop/backlog/` — in-flight FEATs to avoid colliding with

## Required output

### 1. Current architecture summary
Main agents, responsibilities, gate flow (build → review → validate → ship), how model
choice happens at each of the three layers, where coupling exists, what already looks good.

### 2. Brutally honest problems (ranked by severity, finding format required)
Focus: agent responsibility overlap, handoff contract gaps, prompt duplication across
agents/skills, routing-table fragility (markdown parsed by an LLM), eval coverage gaps,
GEPA statistical soundness, places where a Codex candidate runner would get messy.

Close the section with an architecture risk matrix:

| Risk | Probability | Impact | Cost to fix | Priority |

### 3. Architecture decision review
Enumerate every significant recorded architectural decision (ADRs, `docs/governance.md`,
locked-decision tables in design specs, routing-table conventions, skill-tier taxonomy,
peer-dispatch model, Bun/Node split, artifact commit policy). For each, verdict:

- **KEEP** — still correct, say why
- **MODIFY** — correct intent, wrong parameters; propose the change
- **DEPRECATE** — schedule removal; propose migration path
- **REMOVE** — no longer justified; propose removal plan

Explain reasoning with repository evidence. This section exists to surface hidden
technical debt in decisions that were right when made.

### 4. Coupling analysis
Produce a coupling map with repository evidence per edge:

- agent → skill (which agents hard-reference which skills)
- skill → command (skills that assume specific commands ran first)
- command → routing (commands that parse or depend on routing-table content)
- routing → peer dispatch (routing rows that assume specific whitelists)
- plugin → companion plugin (crew ↔ runner contract surface)

Highlight unnecessary coupling, circular dependencies, and single points of failure.
Distinguish load-bearing coupling (keep, document) from accidental coupling (break).

### 5. Agent scorecard
Score every agent in `agents/` (including `3rdparty/`):

| Agent | Responsibility | Overlap (with whom) | Prompt quality | Eval coverage | Model tier fit | Recommendation |

Recommendation ∈ keep / merge-into-X / split / rewrite-prompt / demote-to-skill / delete.

Additionally, estimate semantic prompt duplication across agents:
- High: >40% — extraction into shared skills mandatory
- Medium: 20–40% — extraction recommended
- Low: <20% — acceptable

Name the specific duplicated blocks (evidence: file + section) and which skill each
should extract into.

### 6. Eval + GEPA analysis (mandatory — do not skip)
- Coverage gap: eval specs exist for which agents vs the 6 GEPA v1 targets
  (fullstack-dev, backend-dev, frontend-dev, verifier, inspector, architect)?
  List missing specs and propose fixtures per agent.
- Promotion policy: given the actual trial corpus size, is a +5% PASS delta detectable
  at ≥20 soak trials? Propose statistically honest thresholds or a sequential test.
- Judge triangulation: measure/propose telemetry for groq-primary vs gemini-validate
  agreement rate; define what disagreement rate should trigger the validation tier.
- Cross-provider champion robustness: does a GEPA-evolved prompt (optimized under a
  Claude candidate) hold up under a Codex candidate? Design the experiment — this is
  the model-agnostic eval question.
- Metrics to track: task completion rate, schema compliance, tool-call correctness,
  handoff correctness, reviewer defect-detection rate, validator false-pass rate,
  cost and latency per slice, retry rate, human override rate.

### 7. Config externalization plan
NOT a YAML workflow engine. Instead:
- `routing-table.yaml` as machine-readable source; markdown becomes generated view.
- Tier map / model profiles (constraints above) + apply-profile script.
- Peer-dispatch whitelists as data, validated in CI, rather than prose in agent prompts.
- Schema validation library recommendation (repo already uses Zod in gepa-core — prefer it
  unless evidence argues otherwise).
- Versioning + backward-compatible migration path; how to keep it from becoming an
  untyped mess.

### 8. Architectural fitness functions
List the fitness functions that should guarantee this architecture keeps working, split
into EXISTS (with evidence: which validator/CI gate) vs MISSING (with proposed
implementation + where it hooks into CI). Cover at minimum:

- dispatch invariants (peer-dispatch whitelist violations, gate-order violations)
- routing invariants (every routing row resolves to an existing agent/skill)
- prompt size (exists — verify) and prompt portability (harness-specific tool names)
- workflow determinism (same input → same dispatch plan)
- handoff schema stability (golden contract tests)
- backward compatibility of exported interfaces (gepa-core semver discipline)
- eval-spec ↔ agent parity (agent without eval spec = flagged)
- config schema validation (profiles, routing, whitelists)

### 9. Dead code and pruning
Find, with evidence:

- obsolete agents (never routed to, never dispatched in artifacts/logs)
- unused skills (no routing row, no agent reference)
- unused or stale routing rules
- deprecated prompts and legacy compatibility shims (e.g. `JudgeProvider`, deprecated
  frontmatter fields)
- duplicated commands (crew vs runner vs gstack overlap)

Estimate maintenance cost of keeping each, and the removal risk. Pruning candidates are
quick wins — rank them.

### 10. Smoke test plan (CI, <2 min, no live LLM calls)
- Load default profile; load codex profile; reject invalid profile; resolve all tiers.
- Load + validate routing-table.yaml; reject malformed.
- `bun run evals --dry-run` per spec (already deterministic — extend, don't reinvent).
- Handoff payload shape stability (golden files).
- Profile switch must not change agent set, routing, or workflow structure.
- Fitness functions from section 8 that can run cheaply belong here.
- Wire into existing CI gate order; note runtime impact.

### 11. Implementation roadmap
Phase 1 — quick wins (1 day). Phase 2 — model profile system + candidate-runner
abstraction. Phase 3 — routing/config externalization. Phase 4 — eval coverage + GEPA
hardening. Phase 5 — cleanup: dead code from section 9 + deprecated shims (e.g.
`JudgeProvider` removal at next MAJOR).

For each phase: files touched, risks, tests to add, acceptance criteria.

For every proposed improvement define measurable success:

| Improvement | Current | Target | Metric | Measurement method | Owner | Acceptance criteria |

(Owner = agent/gate/human responsible for keeping the metric green, not a person's name.)

### 12. Concrete recommended changes
File-level: path, what to change, why, difficulty S/M/L, risk, test required.

### 13. If starting from zero today (mid-2026)
Dedicated section, not an aside. If you were building Crew today:

- What would remain identical?
- What would you simplify?
- What would disappear?
- What would be added?

Limit yourself to changes with >20% long-term ROI. This is a modernization lens, not a
rewrite proposal — anything here must be reachable incrementally from the current repo
or explicitly marked unreachable.

### 14. Three-year maintainability
Will this architecture still scale with:

- 100 agents
- 500 skills
- 100 workflows/commands
- multiple repositories consuming the plugin
- multiple providers/harnesses
- multiple teams contributing agents

Name the specific bottlenecks (routing-table size? 350-line cap? single marketplace
manifest? eval runtime? GEPA trial storage? peer-dispatch whitelist maintenance?) and
at what scale each breaks. Propose the cheapest guard for each.

### 15. Memory & learning-loop integration
Goal: agents should be aware of recent important failures, lessons, decisions, and astra
code standards at dispatch time — via a pluggable MemoryProvider that may be unset
(today's behavior) or backed by the astramem plugin.

Inspect first (evidence required):
- `.claude/artifacts/loop/learnings.jsonl` (written by `runner:learn`) — what's actually in it
- Decision log (`runner:decisions`, `docs/governance.md`) and slice-grade lessons
  (`runner:lessons-recent` digest) — capture cadence and content quality
- Retrospectives under `docs/retrospectives/`
- astramem MCP plugin surface (recall/remember/supersede/invalidate ops) — optional install
- GEPA's `TrialStore` pattern (`fileStore` default + `astramemStore` lights up when
  astramem present) — the proven pluggable-store precedent to mirror

Then propose:
- **MemoryProvider interface** mirroring the TrialStore pattern: `noopProvider` when not
  configured (zero behavior change), `fileProvider` (learnings.jsonl + artifacts) as free
  default, `astramemProvider` adapter when the plugin is installed. No hard dependency.
- **Capture path:** which events auto-extract memories — review FAIL reasons, validation
  failures, slice-grade lessons/surprises, decision entries, incident outcomes — and where
  the extraction hook lives (slice-close ceremony? review-artifact write? both?).
- **Recall path:** how dispatched agents receive "recent most important failures /
  lessons / standards" — bounded injection (top-K by recency × severity) into
  builder/reviewer/verifier context at dispatch, with an explicit token budget cap; who
  injects (orchestrator at dispatch vs agent's own retrieval step) and why.
- **Standards vs memory boundary:** astra code standards (`docs/standards/`,
  Astragenie.Standards sibling) are durable → belong in skills/docs routing; failures and
  lessons are episodic → belong in memory. Draw the line explicitly; flag current
  violations of it.
- **Hygiene:** dedup, supersede, decay/staleness policy so memory doesn't rot (astramem
  already exposes supersede/invalidate — use them).
- **Eval interaction:** memory-injected context changes agent behavior — flag how GEPA
  evals should account for it (fixture with/without memory context; capture parity).

### 16. Final verdict
Top 10 quick wins; top 5 architectural decisions to make now; what NOT to do; minimal
production-ready definition for this agent system.

## Constraints

- No rewrite. No breaking existing evals or the evals module boundary.
- Claude stays the default profile; absent config = today's behavior.
- No live LLM calls in CI smoke tests.
- Respect the 350-line agent cap, Bun/Node split (ADR-002), zero-warning lint.
- Do not modify FEAT-185's provider files in ways that conflict with the gepa-core
  migration; check backlog state first.
- Prefer typed config (Zod) and incremental migration.
- Be specific and repo-grounded; inspect instead of guessing; every finding follows the
  finding format.
