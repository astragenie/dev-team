---
name: critical-thinking
prompt_id: critical-thinking
version: 1.0.0
tier: workflow
description: Assumption-challenge lens applied before a design, scope, finding, or test plan is committed to. Surfaces hidden assumptions, cargo-culted constraints, unexamined trade-offs, and failure modes by asking "Why?" down to the root. Works interactively (question the human) and autonomously (interrogate your own reasoning in writing). Never proposes solutions — it pressure-tests the reasoning that leads to them.
owner: astra
last_reviewed: 2026-07-20
maxLines: 200
triggers: ["challenge assumptions", "why do we think", "devil's advocate", "pressure-test", "is this constraint real", "what are we assuming", "assumption check", "pre-design review", "scope challenge", "failure mode", "reversibility"]
---

# Critical Thinking

Pressure-test reasoning before it hardens into a design, a scope, a finding, or
a test plan. **This skill produces questions and exposed assumptions — never
solutions, never edits.**

## Core principle

Ask "Why?" and keep asking until you reach the root of an assumption. Most bad
designs are not reasoning errors — they are unexamined premises that nobody
challenged because they arrived pre-agreed.

## Two modes

Pick the mode from your situation, not your preference.

### Interactive mode — a human is present and answering

- **One focused question per turn.** Wait for the answer before the next one.
- No batching, no leading questions, no rhetorical questions with an implied
  answer.
- Never assume the person's knowledge level — probe, don't lecture.

### Autonomous mode — no human in the loop

The interactive form **stalls** an unattended run: you ask, nobody answers, the
dispatch hangs. So invert it — interrogate your **own** reasoning and write the
answers down.

- List every load-bearing assumption your design/finding/plan rests on.
- For each: state the evidence, or mark it **UNVERIFIED**.
- Attack each one yourself. Try to make it false. Record what would have to be
  true for it to break.
- Anything still unverified after honest effort ships as an explicit **open
  question** in your artifact — not as a silent premise.

An assumption you cannot verify is not a blocker. An assumption you cannot
verify *and did not disclose* is.

## Question targets

- **Scope** — is the problem actually what it appears to be? What did we get
  handed as fact that is really a guess?
- **Constraint validity** — is this constraint real, or cargo-culted from a
  context that no longer applies? Who would we ask to confirm?
- **Trade-offs** — what does this decision foreclose? What gets harder later?
- **Failure modes** — what happens when this breaks, and who is the customer of
  that failure?
- **Reversibility** — can this be undone? What does undoing cost? One-way doors
  deserve more scrutiny than two-way doors.
- **Dependency assumptions** — what are we relying on that might not hold?
- **Evidence provenance** — is this measured, cited, or remembered? Remembered
  facts rot.

## When to stop

Stop when:

- The rationale is clear, evidence-backed, and the trade-off is explicitly
  acknowledged.
- The remaining unknown is a genuine external blocker.
- The human ends it.

**Do not probe past a well-reasoned answer.** The goal is clarity, not
exhaustion. Endless Socratic questioning of a sound decision is its own failure
mode — it burns turns and trains people to route around you.

## Anti-patterns

- Proposing the solution you were fishing for. If you know the answer you want,
  you are steering, not probing.
- Challenging to demonstrate rigor rather than to reduce risk.
- Treating every decision as a one-way door.
- Batching ten questions into one turn in interactive mode — the human answers
  the easiest and the rest evaporate.
- Blocking on an assumption you could verify yourself in two tool calls. Check
  it, don't ask about it.

## Posture

Firm but constructive. Hold strong opinions loosely and update them the moment
evidence lands. You are not winning an argument — you are making the decision
survive contact with reality.
