# Token-burn patch plan — 150k → 500k regression

**Date:** 2026-07-06
**Trigger:** dev-team #165 (agent burned 496k tokens / 13 min / zero shippable output on an 82-file mechanical rename) + #164 (pre-push-verifier friction) + #162 (fork double-work) + 6 builder cut-offs observed live in the FEAT-188/193 session (all ~180-220k, all triggered reaching for a full-suite run).

## Root-cause synthesis

Token burn inflated because **long single-dispatch tasks hit the harness cutoff, then idle→resume re-loads the entire context** (re-reads files, re-derives state) with **no checkpoint commit to resume from**. Amplifiers, in ROI order:

1. **Wrong approach for mechanical work** — 82-file identifier rename done as per-file LLM Read+Edit. A rename is a scripted `rg | sed` job; LLM-per-file is ~all cost, ~no value. This alone was most of #165's 496k.
2. **No checkpoint commits** — every resume re-derives from scratch (O(re-read-everything)) instead of resuming from a commit (O(1)). Multiplied by every cut-off.
3. **Uncontrolled blast radius** — no wire-compat decision up front (JsonPropertyName vs breaking) → the rename cascaded into SDK/contracts/consumers mid-task.
4. **Full-solution build→fix→build loops** — rebuilding all N projects to surface one error at a time; each build dumps large output into context.
5. **Nested background delegation** (parent → subagent) — each layer re-loads context on every resume.
6. **Fork double-work (#162)** — idle-without-terminal-state + nudge spawns a second copy doing the same work = double tokens.

"Something changed recently" verdict: **#165 is a bad-approach case, not proof of a harness regression.** But the baseline creep (150k→500k) is real, and the binding amplifier is **cut-off frequency × resume-reload-tax**. If cut-offs got more frequent (bigger tasks, or grown per-dispatch prompt context from the agent-prompt hardening pass), every task now pays the reload tax repeatedly.

---

## Patch plan (prioritized)

### P0-0 — THE biggest single lever: fix model routing (config, near-zero risk)

**Finding (verified 2026-07-06):** dev-team `.claude/loop.json` has **no `loop.modelRouting` block**, so runner-plugin's `model-router` (`resolveModel`) hits `FALLBACK_MODEL = "opus"` for every non-trivial build phase. Only trivial shapes (`doc-update`/`config-tweak`/`test-only`/`single-module-edit`, `SHAPE_TIER_MAP`) get sonnet; real builds → **opus**. The intended default split (architect=opus, **editor=sonnet**) never shipped because the config is absent. Separately, **interactive `/crew:build` (Agent-tool dispatch) bypasses the router entirely** and inherits the session model (this session: `claude-opus-4-8[1m]`, 1M context). So both the autonomous-wave path and the interactive path run Opus on builds; the agents' `model_pinned: sonnet` is vestigial (the router never reads it).

**Patch:**
1. Add to dev-team `.claude/loop.json`:
   ```json
   "loop": { "modelRouting": { "architect": "opus", "build": "sonnet", "default": "sonnet" } }
   ```
   Routes the editor/build pass to sonnet (the intended cheap tier), keeps architect/design on opus. Optionally `byShape` overrides.
2. **Interactive dispatch must pass the model explicitly** — `/crew:build` / the Agent-tool dispatch should resolve the builder's tier (sonnet) and pass `model: "sonnet"`, not inherit the session model. Otherwise interactive builds stay on Opus regardless of `modelRouting`.
3. Reconcile `model_pinned` — either make the router honor it, or drop it from agent frontmatter to stop implying an inert guarantee.

**Impact:** opus→sonnet on the build pass is the single largest cost cut available (Opus-4.8-1M is multiples of sonnet per token, and builds are the token-heaviest phase). Verify quality holds on a sample slice before making it the default.

### P0 — cheap, biggest ROI (builder-prompt + default changes)

| # | Patch | Where | Fixes |
|---|---|---|---|
| P0-1 | **Checkpoint-commit rule:** "commit incrementally after each bounded sub-task. A task touching > ~30 files OR > ~150k tokens MUST checkpoint + report progress, not plow on to a red-build stall." | `agents/{backend,frontend,fullstack}-dev.md`, `agents/dev-lite.md` guardrails | #165 #2/#5, all 6 session cut-offs |
| P0-2 | **Mechanical-work → scripted, not per-file LLM:** identifier renames / find-replace / format sweeps use `rg -l Old \| xargs sed -i 's/Old/New/g'` + ONE build; LLM only for the non-mechanical residue (migrations, JsonPropertyName decisions, ambiguous refs). | same builder prompts + a `skills/` note | #165 #1 (most of the 496k) |
| P0-3 | **`isolation: worktree` default for substantial builders** — a cut-off becomes a clean resume from a worktree commit, not a working-tree gamble. Proven live this session (S2/S1b/193/S3a all recovered clean; S1a in main-tree was the messy one). | dispatch defaults (`dispatch.mts` / crew:build) | resume-tax, #162 fork surface |

### P1 — structural (real engineering)

| # | Patch | Where | Fixes |
|---|---|---|---|
| P1-1 | **Contract-strategy gate before mechanical cascades** — before a rename/refactor that can reach public contracts, decide wire-stable (`JsonPropertyName`/alias) vs breaking. Blast-radius is set by this decision. | architect/dispatch pre-flight | #165 #3 |
| P1-2 | **One-agent-one-context for a single bounded task** — avoid nested background delegation (parent→subagent) that re-loads context on every cut-off. | dispatch policy | #165 #4 |
| P1-3 | **Build-one-project-iteratively, full-solution build once at the end** — don't loop full-solution builds dumping output into context. (C#/large-solution acute.) | builder prompts | #165 #6 |
| P1-4 | **pre-push-verifier worktree-aware fix** — resolve target repo from the command's cwd (`git rev-parse --show-toplevel` relative to the `cd` prefix), scan THAT repo's validations dir; branch-scope artifacts (`branch:` frontmatter) so lane A's PASS can't unlock lane B. | `hooks/pre-push-verifier.ts` | #164 defects 1-3 |

### P2 — measurement + enforcement (close the loop)

| # | Patch | Where | Fixes |
|---|---|---|---|
| P2-1 | **Per-dispatch token/file telemetry + guardrail** — emit spent tokens; a dispatch crossing 150k tokens or 30 files without a commit surfaces a warning. Ride the `subagent-incomplete` signal (FEAT-188 S1a, merged) to capture these as failure trials → measurable, GEPA-optimizable. | telemetry + S1a signal | measurement gap |
| P2-2 | **#162 dispatch-identity lockfile** — task-id-keyed, worktree-root-hashed lock (extend gepa-core `fileLockManager`) so a nudge/resume can't fork a second worker doing duplicate work. | new lock lib | #162 (fork double-tokens) |
| P2-3 | **Post-triage validation gate** (runner-plugin #322 enhancement) — reject a FEAT/slice as un-sliceable if ACs are placeholder, story-points absent, or a slice is oversized (>30 files / would blow one dispatch). Catches the oversized-task-before-dispatch case. | triage gate | prevents oversized dispatch at source |

---

## Sequencing

1. **P0-1 + P0-2 + P0-3 first, same PR** — pure prompt-text + a dispatch default. Zero-to-low risk, immediately cuts the two biggest amplifiers (wrong-approach + resume-tax). Measurable: mean tokens/task and cut-off frequency should drop.
2. **P1-4** (pre-push-verifier) next — it's causing active retry-burn in wave sessions today.
3. **P2-1** telemetry — so the effect of P0 is measurable and regressions are caught.
4. **P1-1/2/3, P2-2/3** as follow-on.

**Do not** chase a "harness regression" fix first — the evidence points at approach + resume-tax, both fixable in prompt/policy space without harness changes.
