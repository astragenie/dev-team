---
name: architect-rubric
version: 1.0.0
agent: architect
criteria:
  - non_goals_explicit
  - failure_modes_named
  - dependencies_graphed
  - interfaces_typed
  - test_strategy_present
  - tradeoffs_articulated
weights:
  non_goals_explicit: 0.15
  failure_modes_named: 0.20
  dependencies_graphed: 0.20
  interfaces_typed: 0.15
  test_strategy_present: 0.15
  tradeoffs_articulated: 0.15
scoring: 0-3 per criterion; multiply by weight; sum to 0..3; normalize to 0..1
---

# Architect Eval Rubric

LLM-neutral scoring rubric for the `architect` agent's design outputs.
Any scoring model (not just Claude) can apply these criteria and anchors.

## How to score

Score each criterion 0, 1, 2, or 3 using the anchors below.
A score of 2 on all six criteria = 2.0 raw = ~0.67 normalized (solid work).
A score of 3 on all six = 3.0 raw = 1.0 normalized (exceptional).
Pass threshold for the agent eval pipeline: normalized score >= 0.60.

---

## Criterion 1 — non_goals_explicit

**What is being measured:** Does the response draw a clear boundary around what the design does NOT address? Explicit non-goals prevent scope creep and reviewer confusion.

| Score | Anchor |
|---|---|
| 0 | No non-goals mentioned. The response implies the design covers everything, or omits scope boundaries entirely. |
| 1 | Non-goals alluded to but not clearly stated (e.g. "this doesn't handle X" buried in a paragraph with no summary). |
| 2 | Non-goals explicitly listed in a dedicated section or clearly-headed bullet list. At least one concrete exclusion (e.g. "does not address cross-repo work"). |
| 3 | Non-goals list is complete and calibrated: each exclusion is tied to a concrete constraint or prior decision that explains *why* it is out of scope. A reader can verify the exclusion without reading the full context. |

---

## Criterion 2 — failure_modes_named

**What is being measured:** Does the response enumerate concrete ways the design could fail at runtime, at deployment, or under adversarial conditions? Generic risks ("it might break") do not count.

| Score | Anchor |
|---|---|
| 0 | No failure modes mentioned. |
| 1 | One or two failure modes mentioned but described vaguely (e.g. "race condition could occur"). |
| 2 | At least three specific, named failure modes with enough detail to reproduce the failure scenario (e.g. "git worktree add fails on Windows with paths exceeding 260 chars"). |
| 3 | Three or more failure modes named with: (a) the trigger condition, (b) the observable symptom, and (c) a mitigation strategy or explicit "unmitigated — operator responsibility" note for each. |

---

## Criterion 3 — dependencies_graphed

**What is being measured:** Does the response make the design's dependencies explicit — what systems, modules, or external contracts the design relies on, and how they compose?

| Score | Anchor |
|---|---|
| 0 | Dependencies not mentioned. The design appears to exist in isolation. |
| 1 | Dependencies mentioned in prose but not structured (scattered references, no summary of what connects to what). |
| 2 | Dependencies listed with names and the relationship (e.g. "uses git worktree add via child_process.spawnSync"; "reads .claude/state/ per worktree"). |
| 3 | Dependencies graphed: each dependency names its source module/system, the interface or protocol consumed, and the failure behaviour if the dependency is absent or returns an error. |

---

## Criterion 4 — interfaces_typed

**What is being measured:** Does the response define the key data shapes flowing across system boundaries? TypeScript-style type sketches, JSON schemas, or equivalent structured notation all count.

| Score | Anchor |
|---|---|
| 0 | No interfaces or data shapes defined. Shapes are described in prose only ("returns an object with some fields"). |
| 1 | At least one interface sketched but incomplete or informal (missing field types, nullable markers, or discriminated union tags where needed). |
| 2 | Key boundary interfaces typed with field names and types. At least the primary input and output shapes are specified. |
| 3 | All cross-boundary shapes typed: input, output, error/edge-case shapes, and discriminated unions where status varies. Field optionality explicitly marked. No inference required from context. |

---

## Criterion 5 — test_strategy_present

**What is being measured:** Does the response describe how the design will be verified? The strategy must be proportional to the design scope — a spike can cite a single deterministic test; a greenfield service should name multiple test layers.

| Score | Anchor |
|---|---|
| 0 | No test strategy mentioned. |
| 1 | "We will add tests" or equivalent — no specifics on what will be tested or at what layer (unit / integration / e2e). |
| 2 | At least one concrete test scenario described: what the test sets up, what it exercises, and what assertion it makes. Layer (unit/integration) named. |
| 3 | Test strategy names at least two layers or scenarios, identifies what property each test is verifying (correctness, idempotency, failure recovery), and notes any test limitations (e.g. "no live LLM calls — synthetic data only"). |

---

## Criterion 6 — tradeoffs_articulated

**What is being measured:** Does the response compare the chosen approach against at least one alternative, and explain why the alternative was not chosen using concrete constraints from the task?

| Score | Anchor |
|---|---|
| 0 | No alternatives mentioned. The design is presented as the only option. |
| 1 | An alternative is mentioned but dismissed without reasoning ("Option B was considered but rejected"). |
| 2 | At least one alternative compared on at least two dimensions (e.g. startup overhead, operational complexity, observability). The chosen option is preferred with a stated reason tied to the task constraints. |
| 3 | Two or more alternatives compared on three or more dimensions. Each alternative has a clear "why rejected" tied to a specific named constraint from the task. The chosen option's weaknesses are acknowledged. |
