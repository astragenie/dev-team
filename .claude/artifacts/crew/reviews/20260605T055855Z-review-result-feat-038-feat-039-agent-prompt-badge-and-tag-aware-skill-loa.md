# Review Result: FEAT-038 + FEAT-039: agent prompt badge and tag-aware skill-loading edits

- Created: 2026-06-05T05:58:55.156Z
- Reviewer: reviewer
- Decision: rejected
- Summary: Two hard findings block approval: deployer uses non-existent 'deployment_skipped' badge, and 3 out-of-scope files (agents/architect.md, commands/orchestrate-slice.md, tests/orchestrate-slice.test.mjs) were silently included in the commit.
- Evidence Checked:
  - 1. CLI badge enum (scripts/crew.mjs:302) lists dev_skipped and prod_skipped — 'deployment_skipped' does not exist; deployer.md teaches agents to call a CLI that will error. 2. git diff HEAD~1 --name-only shows 8 files changed; only 5 were in scope per the assignment. 3. validate-agents: 9 agents OK (all ≤300 lines). 4. npm run lint: exit 0. 5. npm run format:check: exit 0. 6. node --test: 294 pass / 0 fail. 7. Role-specific skip badges correct for builder (validation_skipped)
  - reviewer (review_skipped)
  - validator (validation_skipped)
  - researcher (no skip badge — correct). 8. feat-tag-schema.md exists and contains surface:ui. 9. mark-badge flag syntax (--badge
  - --note
  - --repo) matches CLI. 10. Workflow badge sections placed after artifact-write instructions in each agent — placement acceptable. 11. FEAT-039 tag-aware bullet added to builder
  - reviewer
  - validator only — consistent with scope. 12. Performance scenario section added to validator only — appropriate placement.
- Files Reviewed:
  - agents/builder.md
  - agents/reviewer.md
  - agents/validator.md
  - agents/deployer.md
  - agents/researcher.md
- Test Adequacy: -
- Non-Code Review: yes
- Risks: Deployer agents instructed to call a non-existent badge name will get a CLI error at badge-emit time, leaving the workflow state unpersisted and brief-me/wake-up with no badge signal. The out-of-scope commit bundles a new command (orchestrate-slice) and architect schema change that bypassed dedicated review.
- Required Follow-up: 1. Fix deployer.md: replace 'deployment_skipped' with either 'dev_skipped' or 'prod_skipped' (or both with distinct comments). 2. The out-of-scope changes (agents/architect.md, commands/orchestrate-slice.md, tests/orchestrate-slice.test.mjs) must be reviewed in a separate pass with their own scope statement and AC list before merging.

