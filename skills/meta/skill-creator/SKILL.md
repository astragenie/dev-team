---
name: skill-creator
prompt_id: skill-creator
version: 1.0.0
tier: meta
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
source: aitmpl/development/skill-creator
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: SKILL.md, skill quality bar, new skill, skill description, skill eval, skill triggering
---

# Skill Creator

## When to use

- Authoring a new SKILL.md from scratch
- Editing or improving an existing skill's body or description
- Running evals to measure skill triggering accuracy
- Optimizing the skill description for better routing
- Reviewing a skill against the quality bar (tier, description, line cap)

A skill for creating new skills and iteratively improving them.

The process of creating a skill:

1. Decide what the skill should do and roughly how it should work.
2. Write a draft of the skill.
3. Create a few test prompts and run claude-with-access-to-the-skill on them.
4. Help the user evaluate results (qualitative and quantitative). Draft evals while runs are in progress, then show results via `eval-viewer/generate_review.py`.
5. Rewrite the skill based on feedback from the user's evaluation.
6. Repeat until satisfied, then expand the test set.

Figure out where the user is in this process and jump in. They might say "I want to make a skill for X" (start from scratch) or "I already have a draft" (go straight to eval/iterate). Be flexible — if the user says "just vibe with me", skip the formal eval loop.

After the skill is done, offer to run the description improver to optimize triggering.

## Communicating with the user

Pay attention to context cues for technical familiarity. Default middle-ground: "evaluation" and "benchmark" are OK; explain "JSON" and "assertion" unless you see clear cues the user knows them.

## Creating a skill

### Capture Intent

1. What should this skill enable Claude to do?
2. When should this skill trigger? (what user phrases/contexts)
3. What's the expected output format?
4. Should we set up test cases to verify the skill works?

### Interview and Research

Ask about edge cases, input/output formats, example files, success criteria, and dependencies before writing test prompts. Check available MCPs for research.

### Write the SKILL.md

Fill in:
- **name**: Skill identifier
- **description**: When to trigger + what it does. Include both "what" and "when". Make it slightly pushy to combat Claude's under-triggering tendency.
- **compatibility**: Required tools, dependencies (optional, rarely needed)
- **the rest of the skill**

#### Anatomy of a Skill

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown instructions
└── Bundled Resources (optional)
    ├── scripts/    - Executable code for deterministic/repetitive tasks
    ├── references/ - Docs loaded into context as needed
    └── assets/     - Files used in output (templates, icons, fonts)
```

#### Progressive Disclosure

1. **Metadata** (name + description) — always in context
2. **SKILL.md body** — in context whenever skill triggers (<500 lines ideal)
3. **Bundled resources** — as needed (scripts can execute without loading)

Keep SKILL.md under 500 lines. Reference files clearly with guidance on when to read them. For domain-variant skills, organize by variant under `references/`.

### Writing Style

Explain *why* things matter rather than heavy-handed MUSTs. Use theory of mind. Start with a draft, look at it with fresh eyes, improve it.

### Test Cases

After the draft, come up with 2-3 realistic test prompts. Share with user for confirmation. Save to `evals/evals.json` (prompts only; add assertions in the next step while runs are in progress).

For the full test-running sequence, grading, benchmark aggregation, and eval viewer steps — see `references/running-evals.md`.

## Running and evaluating test cases

See `references/running-evals.md` for the complete sequence (spawn runs, draft assertions, capture timing, grade, aggregate, launch viewer).

## Improving the skill

See `references/improving-skills.md` for the improvement loop (how to generalize feedback, keep prompts lean, explain the why, look for repeated work, iteration cycle).

## Description Optimization

See `references/description-optimization.md` for the full optimization process (generate trigger eval queries, review with user, run optimization loop, apply result).

## Platform notes

See `references/platform-notes.md` for Claude.ai-specific and Cowork-specific adaptations.

## Reference files

- `agents/grader.md` — how to evaluate assertions against outputs
- `agents/comparator.md` — how to do blind A/B comparison between two outputs
- `agents/analyzer.md` — how to analyze why one version beat another
- `references/schemas.md` — JSON structures for evals.json, grading.json, etc.
- `references/running-evals.md` — full test-running and grading sequence
- `references/improving-skills.md` — the improvement loop
- `references/description-optimization.md` — description optimization loop
- `references/platform-notes.md` — Claude.ai and Cowork adaptations

## Done / Acceptance

- Skill has required frontmatter: name, tier, description, triggers
- SKILL.md body is under the repo line cap (≤200 lines for domain/workflow/meta)
- At least 2 eval prompts are confirmed with the user and saved to `evals/evals.json`
- Description optimization has been run and triggering accuracy is satisfactory
