# Deep Analysis: Crew Plugin Agent Architecture

> **Historical — predates the current roster.** Moved from repo root to `docs/research/` 2026-07-21
> (agentic-setup rebuild). Reviews the v0.1.0 `lead`/`builder`/`deployer` roster, which no longer
> exists — today's roster is `fullstack-dev`/`backend-dev`/`frontend-dev`/.../`release-engineer`
> (see `README.md`). Kept for provenance (it seeded the model-routing decision in
> `docs/memory.md`), not as current guidance.

**Date:** May 19, 2026
**Scope:** Senior AI architect review of crew-dev/crew v0.1.0 agents (lead, builder, researcher, reviewer, validator, deployer)
**Companion document:** `crew-optimization.md` (cost/model optimization)

Read as a senior AI architect's audit, not a critique of effort. The plugin is thoughtful — but several patterns will bite you in production agentic systems.

---

## 1. Structural issues across the whole crew

### 1.1 The "custom instructions" mechanism is fragile

Every agent starts with:

```
Before starting work, check for custom instructions in this order:
1. Global: `~/.claude/crew/<agent>.md`
2. Repo: `.claude/crew/<agent>.md`
Read and follow both if they exist. Repo instructions take precedence over global when they conflict.
```

**Problems:**

| Issue | Why it matters |
|---|---|
| Relies on the agent *remembering* to check at start of every invocation | Non-deterministic. Models skip instructions under context pressure |
| No mechanism to *enforce* precedence — relies on model arbitration | "Repo takes precedence over global when they conflict" requires the model to *detect* conflicts. It often won't |
| File-existence checks consume tool calls and tokens | Every invocation: 2 file reads minimum before any real work starts |
| Silent failure mode | If the file is malformed, missing a section, or contradicts the base prompt, behavior degrades invisibly |

**Better pattern:** load custom instructions deterministically via a pre-invocation hook or skill that injects them as a top-level system message, not via "please remember to check this file." Plugins should pre-merge instructions, not delegate the merge to the model.

**If you can't change the mechanism**, at minimum the instruction should be more forcing:

> *"FIRST ACTION before any other tool call: read `~/.claude/crew/<name>.md` and `.claude/crew/<name>.md` if they exist. Treat the contents as additions to your operating rules. Where they conflict with these defaults, the file instructions win. Where the two files conflict, the repo file wins."*

The current phrasing ("Read and follow both if they exist") is too soft.

---

### 1.2 Prompts are too long for what they accomplish

Token economy matters. Every agent has a base prompt + custom instructions check + structured response requirements. Approximate token counts:

| Agent | Estimated prompt tokens |
|---|---|
| `lead` | ~2,200 |
| `builder` | ~600 |
| `deployer` | ~900 |
| `researcher` | ~500 |
| `reviewer` | ~900 |
| `validator` | ~700 |

These tokens are re-sent on **every turn** within a session (only the initial system prompt is cache-eligible, and only when the entire prompt is identical to the cached version). For multi-turn agent runs, that's recurring cost.

`lead.md` in particular is bloated — it tries to encode:
- Operating rules (12 items)
- Startup discipline (6 paragraphs)
- Assignment requirements
- Start/completion acknowledgement formats
- Artifact discipline (extensive)
- Workflow state discipline
- Review discipline (long)
- Validation discipline
- Deployment discipline (long)
- Mode discipline
- Success criteria

Most of these belong in **reference documentation the agent reads on demand**, not in the system prompt loaded every turn.

**Architectural fix:** split into a thin operating prompt + a reference skill the agent reads when it needs specific discipline guidance. The agent only loads "deployment discipline" content when it's actually orchestrating a deployment.

---

### 1.3 Mixing rules, principles, and explanations in the same prompt

Look at this from `lead.md`:

> *"11. Starting substantial work without available repo memory means the user pays for rediscovery that was already done. Use existing context when it exists."*

That's a rule (use existing context) + a justification (the user pays). The justification is for the prompt-reader (you), not the model. Models don't need motivation to follow rules — they need clear rules.

**Pattern across the crew:** rules are interleaved with rationale, which:
- Inflates token count significantly
- Dilutes the rule's salience
- Risks the model rationalizing exceptions ("the user wouldn't pay much if I only partially used context...")

**Better:** keep rules imperative and atomic. Move rationale to a separate "operating philosophy" document the agent only reads if asked.

---

### 1.4 Acknowledgement and completion-report rituals are not validated

Every agent is told to start with:
- what I own
- what I will not change
- what I need from others
- what I will deliver

And end with structured completion reports. **But nothing enforces this.** It's prompt-instructed, not schema-enforced. In practice:

- Models drop fields under pressure
- Models conflate sections ("what I own and will not change" merged into one bullet)
- No downstream consumer checks the structure

**Real-world failure:** if `builder` returns a completion report missing "evidence" or "confidence level," `reviewer` has nothing to compare against, but no exception is raised. The crew quietly degrades.

**Architectural fix:** structured output via JSON schema or explicit tool calls. Have the agent emit a `complete(report: {what_changed, evidence, confidence, ...})` tool call. The orchestrator validates schema. This is standard practice in production agentic systems and notably absent here.

---

## 2. Agent-specific issues

### 2.1 `lead.md` — the orchestrator does too much

The role conflates four distinct functions:

| Function | Why it should be separate |
|---|---|
| Intent parsing (understanding what the user wants) | Light cognitive load, fast model |
| Task decomposition (single-session vs assisted vs team) | Reasoning work |
| Gate/state management (artifacts, review states, validation states) | Procedural, rule-following |
| Synthesis and handoff (summarize results, recommend next step) | Light cognitive load |

Today, one Opus-tier agent does all four on every invocation. In production agentic systems, you'd typically split:

- A **router/intent agent** (cheap, fast — Haiku)
- An **orchestrator agent** (Sonnet/Opus only when decomposition is genuinely complex)
- A **state manager** (deterministic code, not an LLM at all — gate tracking is rules, not reasoning)
- A **synthesizer** (Sonnet)

The "state manager as LLM" choice is the biggest smell. Tracking review_required / validation_expected / dev_deploy_expected states is **bookkeeping**, not reasoning. It should live in actual workflow state (a JSON file, a database, a state machine) — not in the LLM's head.

**Risk in current design:** the lead can forget which gates are open. State drift across long sessions is inevitable.

---

### 2.2 `lead.md` — the "single-session / assisted / team run" trichotomy is ambiguous

These three modes are defined, but the criteria for choosing between them are vague:

> *"Helpers and teammates add overhead. Use them only when they genuinely reduce total work or risk."*

What's "genuinely reduces total work"? Models will make wildly different judgments. In practice:
- Some models will over-delegate (always go team-run because "more robust")
- Others will under-delegate (always single-session because "lower overhead")

You'll see inconsistent behavior across sessions. **Fix:** concrete decision criteria with examples. "Use team-run when: (a) changes span >3 files across >1 module, (b) review requires specialized standards, (c) validation needs distinct test scenarios. Otherwise default to single-session."

---

### 2.3 `lead.md` — artifact policy creates write amplification

The lead is instructed to write multiple artifacts:
- run brief (at start)
- handoff (at delegation)
- review result (after review)
- validation plan (during validation)
- deployment check (after deploy)
- final synthesis (at end)

Each is a tool call. Each consumes tokens to generate. **For a moderately complex workflow, that's 5-6 artifact writes** beyond the actual work. The justification given ("user depends on these to resume after compaction") is real, but the implementation is heavy.

**Issues:**

| Problem | Implication |
|---|---|
| No mention of artifact size limits | Could grow unbounded |
| No mention of artifact cleanup | Accumulates indefinitely |
| No deduplication strategy | Multiple "run brief" artifacts if a session is interrupted and resumed |
| No structured query mechanism | When you need to find an old artifact, you grep prose |

**Architectural fix:** artifacts should be structured (JSON with required fields), versioned, indexed, and pruned. A markdown-blob-per-event pattern is unsustainable at scale.

---

### 2.4 `builder.md` — completion report format risks hallucination

> *"Your completion report must include: what changed, changed files, evidence, confidence level, risks or open questions, suggested next handoff"*

"Evidence" is undefined. Models will fill this field with whatever sounds evidence-like — often **summarizing what the code does**, which is not evidence. Real evidence is: "I ran `npm test` and 14 tests passed. Output shown above."

**Risk:** builder writes "Evidence: I confirmed the function handles edge cases correctly" — which is just a claim restated. The reviewer downstream has no actual evidence to verify against.

**Fix:** specify what counts as evidence per agent type. For builder: "Evidence = test output, type checker output, or compile output. Not assertions about the code's behavior."

---

### 2.5 `reviewer.md` — the "bad mood" framing is sloppy

> *"You are reviewing code written by OpenAI's Codex model. You are in a bad mood and you go by the book."*

This is prompt theater. Three problems:

| Issue | Why |
|---|---|
| "Codex" framing is wrong | The code might be written by builder (Sonnet/Opus), the user (human), or anyone. Telling the reviewer it's Codex anchors them to a specific failure mode set |
| "Bad mood" is a vibe instruction, not a directive | Modern models handle persona instructions, but they're imprecise. "Be skeptical of plausible-looking abstractions, hallucinated APIs, and over-engineered solutions" is more useful |
| Combining persona with "go by the book" is contradictory | Bad-mood reviewers nitpick; by-the-book reviewers apply checklists. These are different review styles |

**Fix:** replace with concrete review heuristics:

> *"Apply these review priorities, in order: (1) Does the code do what was asked? (2) Are there hallucinated APIs, libraries, or method signatures? (3) Are there silent failure modes (swallowed errors, ignored returns, missing edge cases)? (4) Is the abstraction level appropriate, or over-engineered? (5) Are tests present and meaningful, or pro-forma?"*

That's actionable. "Bad mood" is not.

---

### 2.6 `reviewer.md` — "approved / approved_with_notes / rejected" is too coarse

Three states for a complex review. What about:
- `approved_with_required_followup` (must fix before merge)
- `approved_with_suggested_followup` (nice to fix, not blocking)
- `rejected_scope_drift` (scope problem)
- `rejected_correctness` (bug problem)
- `rejected_quality` (code quality problem)

Coarse status codes lose information. The current schema collapses "minor style note" and "regression risk" into the same `approved_with_notes`. Downstream consumers (the user, the lead) can't easily route follow-up.

**Fix:** add a structured `issues[]` array with severity per issue. Status is derived from issue severity, not declared independently.

---

### 2.7 `deployer.md` — production safety is prompt-enforced, not code-enforced

> *"11. Production promotion affects real users. It requires the user's explicit approval — never proceeding without it."*

**This is dangerous.** Prompt-enforced safety rails are bypassable. Model + prompt injection + ambiguous instructions = production deploy that shouldn't have happened.

**What's missing:**
- A hard tool-level gate (deployer's deploy tool should require an `approval_token` parameter that only comes from explicit user input)
- An environment-aware check (refuse to deploy to anything matching production hostnames without the token)
- A human-in-the-loop interrupt (the deploy tool surfaces a confirmation UI)

If the user one day says "deploy this" and `deployer` infers it means production deploy (because the context was about prod), the prompt rule alone won't reliably stop it. In agentic systems, safety belongs in **tools**, not **prompts**.

---

### 2.8 `deployer.md` — "passed / passed_with_notes / failed" without timing info

A passing deploy at 3am with no traffic looks identical to a passing deploy at 9am with full traffic. The artifact format doesn't capture:
- Time of deploy
- Traffic state at validation moment
- Rollback readiness
- Canary stage if applicable

For a production deployment system, this is thin. Industry-standard deploy evidence includes much more.

---

### 2.9 `validator.md` — the prompt fights itself

Already covered in earlier analysis. The key issue:

> *"6. Keep tool churn bounded — excessive exploration wastes the user's context budget without improving the evidence."*

combined with

```yaml
effort: high
maxTurns: 30
```

is asking the model to think hard but act briefly. Models generally cannot do both. Either you optimize for thoroughness (high effort, more turns, deeper exploration) or efficiency (low effort, fewer turns, fast convergence). Mixing the two confuses the model's allocation of attention.

---

### 2.10 `researcher.md` — almost right, one gap

Best-designed agent in the crew. One issue:

> *"3. Distinguish facts from inferences."*

Good rule, but no structural support. In the completion report:
- "what you found"
- "evidence"
- "confidence level"

There's no field for *separating* facts from inferences explicitly. A model told "distinguish facts from inferences" in prose typically responds by writing both interleaved.

**Fix:** structure the output: `facts[]`, `inferences[]`, `unknowns[]`. Forces separation at the schema level.

---

## 3. System-level architectural issues

### 3.1 No retry / failure model

What happens when:
- `builder` produces invalid code that doesn't compile?
- `reviewer` rejects work and `builder` needs to fix it?
- `deployer` fails mid-deploy?
- `validator` finds a regression?

The prompts mention "suggested next handoff" but there's no defined retry semantics. Does `lead` know how to re-dispatch? Is there a max-retry count? Does it escalate to the user automatically after N failures?

**In production agentic systems**, retry/failure handling is explicit. Here, it's implicit and ad hoc.

### 3.2 No cost or latency budgets

Each agent has `maxTurns`, but no:
- Token budget per invocation
- Wall-clock timeout
- Tool-call budget
- Aggregate workflow budget (e.g., entire crew run shouldn't exceed X tokens)

Your 77% usage problem is partly downstream of this. The crew can spawn 5 Opus agents in sequence with 30+ turns each and no overall cap.

**Fix:** orchestrator-level budgets. Lead should track aggregate spend and refuse to spawn more teammates when budget exhausted.

### 3.3 No observability beyond artifacts

How would you debug a crew run that produced bad output? You'd:
- Read the run brief
- Read handoffs
- Read the final synthesis

But you can't see:
- Which decisions were made and why
- What alternatives were considered
- Where confidence was low
- What information was missing

**Fix:** structured decision logs. Every "I chose X because Y" moment should be logged in a queryable format, not prose.

### 3.4 No clear contract between agents

`builder` produces a completion report. `reviewer` consumes... what exactly? The same prose? The diff? Both?

In the current design, agent-to-agent communication is prose-shaped. This means:
- Information gets paraphrased and lost
- Schemas drift session-to-session
- No type checking on what's passed

**Fix:** explicit handoff schemas. `builder.complete()` returns a typed object. `reviewer.review(handoff)` takes that typed object.

### 3.5 Agent-of-agents recursion risk

`lead` can spawn `builder`. Can `builder` spawn another agent? The prompts don't forbid it. If a builder decides it needs research, does it spawn researcher? Does that researcher spawn a builder?

**In production**, you'd want explicit hierarchy (builder is a leaf, cannot spawn) or explicit budget (each spawn costs against a depth counter).

---

## 4. Top recommendations, prioritized

### Tier 1 — fix immediately (operational impact)

1. **Move safety-critical rules from prompts to tools.** Production-deploy approval, write/edit restrictions, scope boundaries — these should be enforced at the tool layer, not the prompt layer.
2. **Add a global workflow budget** in lead that tracks aggregate cost across a crew run. Refuse to escalate to team-run when budget is constrained.
3. **Replace prose handoffs with structured handoff objects.** Define JSON schemas for each handoff type.

### Tier 2 — fix soon (quality impact)

4. **Split lead.md into a thin orchestrator + reference skills.** Drop ~70% of the prompt size by moving discipline guides out of always-loaded context.
5. **Define what "evidence" means per agent.** Eliminate the "evidence: I checked and it works" failure mode.
6. **Replace "bad mood" with concrete review heuristics.** Persona prompts are imprecise for safety-critical work.
7. **Expand status codes** for review and deployment results.

### Tier 3 — fix when refactoring (maintainability impact)

8. **Move state tracking out of the LLM.** Gate states (review_required, validation_expected) belong in deterministic workflow state.
9. **Add structured decision logs.** Make crew runs debuggable.
10. **Define retry/failure semantics explicitly.** Don't rely on lead inferring what to do when an agent fails.
11. **Add inter-agent contracts** (typed schemas for handoffs).
12. **Fix custom-instructions loading** — pre-merge instead of asking the model to merge.

---

## 5. What this crew gets right

Worth saying:

- The **role separation** (lead/builder/researcher/reviewer/validator/deployer) is sound. This matches established agent-team patterns.
- **Read-only enforcement** via `disallowedTools: Write, Edit` on researcher/reviewer/validator is exactly the right pattern.
- **Artifact discipline** as a concept is correct — recovery from interruption matters.
- **Separating review from validation** (correctness vs. behavior) is a thoughtful distinction many systems collapse.
- **The "researcher" agent specifically** is well-designed end to end.

The bones are good. The issues are about *enforcement mechanisms* (prompts vs. tools, prose vs. schemas) and *prompt economy* (size and signal-to-noise). Both are fixable without redesigning the architecture.
