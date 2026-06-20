---
feature: FEAT-142
status: active
---
# Run Brief: FEAT142 SLICE87: FEAT-142 SLICE-A — Adversarial design lenses (architect + architect-reviewer)

- Created: 2026-06-20T09:40:48.781Z
- Tier: full
- Goal: -
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - 1. Edit `agents/architect.md` (cap 350) — append ADR template requirements + reference the new validator. Net add ≤30 LOC.
2. Edit `agents/3rdparty/architect-reviewer.md` (130 LOC cap
  - currently 57) — add `## Adversarial review` section + reject-criteria. Net add ~50 LOC.
3. New `scripts/validate-adr-template.ts` — Markdown scanner. Walks `docs/architecture/decisions/ADR-*.md`. For each: extract `## Options Considered`
  - count `### Option N:` H3s
  - check each non-chosen option has `Why rejected:` line. Returns exit code 2 if any ADR fails (CI gate).
4. New `tests/validate-adr-template.test.ts` — fixture ADRs (well-formed
  - single-option
  - options-without-rationale) + assertions.
- Out Of Scope:
  - - Pushing specifics into new `skills/domain/architecture-advisory/` — defer until cap squeeze. Current architect.md has headroom.
- Wiring the validator into `.github/workflows/test.yml` — separate micro-PR after validator stabilizes on real ADRs.
- Migrating existing ADRs to the new template — validator runs advisory at first.
- Eval fixtures asserting architect actually produces ≥3 options (woul
- Planned Files: -
- Next Step: Begin implementation

