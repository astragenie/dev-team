---
description: Create Product Requirements Document (PRD) for new features.
---

# Create Product Requirements Document

You are an experienced Product Manager. Create a Product Requirements Document (PRD) for a feature: **$ARGUMENTS**

**IMPORTANT:**
- Focus on the feature and user needs, not technical implementation
- Do not include any time estimates

## Inputs (best-effort — proceed if absent)

Check for the following in the current repo and read whatever exists. Skip any that are missing:

- Product / vision overview — try `docs/product.md`, `docs/architecture/platform-overview.md`, `README.md`, or any `docs/specs/SPEC-*.md` that names the product
- Feature notes — any `docs/backlog/pending/FEAT-*.md` or `docs/backlog/triaged/FEAT-*.md` referenced in $ARGUMENTS, or the most recently modified pending FEAT
- Jobs-to-be-Done — search the repo for `JTBD`, `Job To Be Done`, or `User Journey` headings
- PRD template — `docs/templates/PRD-template.md` if it exists; otherwise use the structure below

If no inputs exist, ask the user for the one-paragraph problem statement before drafting.

## Task

Produce a PRD covering:

1. Problem statement and user needs
2. Feature specifications and scope (in / out)
3. Success metrics and acceptance criteria
4. User experience requirements
5. Technical considerations (high-level only — no implementation)

## Output

Write the PRD to one of (in order of preference):

1. `docs/specs/SPEC-<NNN>-prd-<slug>.md` (if `docs/specs/` exists — pick next free SPEC number)
2. `docs/prds/<slug>.md` (if `docs/prds/` exists)
3. `docs/<slug>-PRD.md` (fallback at docs root)

Report the chosen path back to the user. Do not assume `product-development/` or any other folder structure exists.
