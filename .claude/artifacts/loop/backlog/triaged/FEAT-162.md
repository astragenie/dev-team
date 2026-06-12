---
id: FEAT-162
status: pending
priority: P2
category: quality
target_release: null
created: 2026-06-12
updated: 2026-06-12
depends_on: []
slices: []
derived_from: null
autonomous_safe: false
tags: [testing, agent-eval, dev-infra, ci, subscription-billed]
---
# FEAT-162: Subscription-billed agent eval harness (`claude -p` + Bun fixtures)

## Description

The repo today has **no behavioral test layer for agents**. Structural validators (`scripts/validate-agents.ts`, `validate-skills.ts`, `validate-manifests.ts`, `validate-slices.ts`) catch line-cap drift, frontmatter shape, and routing-table staleness. `scripts/e2e-smoke.ts` exercises **script and skill logic** against a temp sample repo but does NOT send a real prompt to a real subagent — it runs CLI scenarios (SPLIT_BUILD classification, write-build-bundle, scaffold-then-update, light-tier, validation-stale-flow), then asserts on emitted artifacts.

The gap: when an agent prompt changes (recent example: v0.35.3 added `## Integration with Other Agents` to all 18 first-party agents; v0.35.2 fixed identity-anchor leak in dispatched-subagent prompts) we have **no automated way to verify the change actually produces the intended behavior**. Regressions like the `Agent`-tool-misroute pattern (v0.35.2) reach prod and are observed in the field one slice at a time, costing ~150k tokens per recurrence.

**Why not external eval frameworks (promptfoo, Inspect AI, DeepEval, Anthropic Evals SDK):** all of them hit `api.anthropic.com` directly and consume **separate per-token API budget**. The user runs this plugin on a Claude Code Pro/Max subscription — adding API spend purely to test agent prompts is a bad trade.

**Subscription-billed alternative**: the Claude Code CLI (`claude -p "<prompt>" --output-format stream-json`) and the Claude Agent SDK both authenticate via the same OAuth flow as the interactive CLI. Running them inside CI on a runner with a pre-auth'd OAuth session counts against the subscription's rate limit only — zero API spend. Stream-json output exposes every tool call, every subagent dispatch, every artifact write, parseable line-by-line. That trace is the unit of assertion for an "agent unit test".

## Acceptance hints

### Scope

- Add `tests/agent-eval/` tree containing:
  - `lib/run-claude.ts` — spawns `claude -p`, captures stream-json, returns `{events, finalText, exitCode, cwd}`
  - `lib/assert-trace.ts` — helpers: `toolCallsOf`, `hasToolCall`, `dispatchedAgent`, `findArtifact`, `artifactContains`
  - `lib/types.ts` — `Fixture` interface (`name`, `prompt`, `agent?`, `timeoutMs?`, `setup?`, `expect`)
  - `fixtures/01-builder-handoff.fixture.ts` — builder writes a handoff artifact for a 1-file edit
  - `fixtures/02-reviewer-pass-fail.fixture.ts` — reviewer emits a verdict artifact (PASS or FAIL)
  - `fixtures/03-lead-dispatches-builder.fixture.ts` — lead invokes Agent tool with `subagent_type: crew:builder*`
  - `run.test.ts` — Bun `describe.skipIf(!process.env.CREW_AGENT_EVAL)` loop over fixtures
  - `README.md` — usage, prereqs, rate-limit math, troubleshooting
- Add `test:agents` script to `package.json` (`CREW_AGENT_EVAL=1 bun test tests/agent-eval/`)
- Add nightly GH Actions workflow `.github/workflows/agent-eval.yml` (cron `0 7 * * *`, manual-trigger via `workflow_dispatch`, **skipped on PRs** to protect rate budget)

### Design constraints

- **No API key** required. Auth = `claude login` OAuth, inherited from the runner's CC install.
- **Serial only** — no parallel — to respect subscription rate limit. `bun test` with concurrency 1 inside this dir.
- **Env-gated** — default `bun run test` continues to skip `tests/agent-eval/`. Opt-in via env flag so contributors aren't surprised by quota burn.
- **Isolated cwd per fixture** — `mkdtemp` + seed via fixture's `setup` callback. Never write inside the repo's own `.claude/artifacts/`.
- **Fuzzy assertions only** — real LLM = nondeterministic. `regex.contains`, `artifact.exists`, `field-shape check`. No exact-string asserts on free text.
- **Timeout per fixture** — default 180s, fixture can override. Hard kill on overrun.
- **Plugin discovery prerequisite** — runner must have `crew` plugin installed (either via `claude plugin install` from local path OR via the central `astra-marketplace` entry). Document in README.

### Per-slice decomposition suggestion

- **SLICE-A** (foundation, no LLM yet): scaffold `tests/agent-eval/lib/` + types + one **dry-run fixture** that records a captured trace JSON and replays it (no actual `claude -p` call). Asserts the `assert-trace.ts` helpers work. Pure unit-level. **Autonomous-safe = true**.
- **SLICE-B**: add real `runClaude` subprocess wrapper + one live fixture (`01-builder-handoff`). Gate behind `CREW_AGENT_EVAL=1`. Document local-dev workflow (`claude login` → `claude plugin link <repo>` → `bun run test:agents`). Local-only — no CI yet. **Autonomous-safe = false** (touches CLI process spawning + auth assumptions).
- **SLICE-C**: add `02-reviewer-pass-fail` + `03-lead-dispatches-builder` fixtures. Tune timeouts, document failure modes.
- **SLICE-D**: nightly GH Action. Needs (a) self-hosted runner with persistent CC OAuth OR (b) `anthropic-ai/claude-code-action` GH Action if/when it supports OAuth tokens for non-issue contexts. Decide between (a)/(b) in a SLICE-D pre-research step. **Autonomous-safe = false** — touches CI + secrets.

### Out of scope

- API-billed eval providers (promptfoo, Inspect AI, etc.) — separate FEAT if subscription path proves infeasible.
- `agents/3rdparty/` agents — upstream imports; not first-party.
- Multi-turn user-in-the-loop scenarios — initial harness is single-prompt-to-completion.
- Replacing `scripts/e2e-smoke.ts` — the smoke tests cover script logic (fast, deterministic), the eval harness covers agent behavior (slow, LLM-driven). Both stay.

## Notes

- Discussion captured in session 2026-06-12 after v0.35.3 release. User explicitly asked for subscription-billed path; rejected per-token API spend.
- Reference sketch: see session transcript for `lib/run-claude.ts`, `lib/assert-trace.ts`, and `fixtures/03-lead-dispatches-builder.fixture.ts` skeletons. SLICE-A picks up from there.
- Open Q for SLICE-B: does current Claude Code CLI accept `--agent crew:backend-dev` to bind a session to a specific subagent? If yes, fixtures can target individual agents directly. If no, fixtures must prompt main-thread Claude to invoke the Agent tool with the desired `subagent_type` — coarser but still useful.
- Rate-limit math: Max plan ≈ 200–800 messages per 5h window depending on tier. A fixture suite of 10 scenarios × ~30 tool calls/turns each fits comfortably nightly but would burn ~half a Pro window — hence the nightly-only stance.
- Naming: `agent-eval` not `agent-test` to avoid collision with the structural-test pattern. Renaming costs nothing later.
- Future hook: if SLICE-D lands, retire `docs/sop/specialist-pause-handling.md` once the harness catches the pattern as a fixture failure.
