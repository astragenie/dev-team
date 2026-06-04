---
kind: handoff
created_at: 2026-06-04
scope: terraform-references-removal
status: awaiting-user-decision
gate: option-selection
related_commits:
  - 7c03173 (routing-table consistency validator — surfaced 6 unresolved external-plugin IDs)
---
# Handoff — terraform references in routing-table (decision gate)

## Objective

Decide what to do about 6 unresolved external-plugin skill IDs (`terraform-code-generation:*`, `terraform-module-generation:*`) flagged by the new routing-table validator (commit `7c03173`). These plugins are not installed locally and are not declared as crew dependencies in `marketplace.json`.

## Owner

Lead. Read-only audit done this turn. Decision required before any change.

## What's audited

**KEEP — local skill is safe:**
- `skills/domain/terraform-ops-traps/` (135 lines, vendored from daymade/claude-code-skills) — well-integrated, used by builder, deployer, devops-engineering skill cross-refs, agent blocks, routing-table rows 33, 36, 57. Zero external dependency.

**CANDIDATES FOR REMOVAL — external plugin references in routing-table.md only:**
- Row 33 cites `terraform-code-generation:{terraform-style-guide, terraform-test, azure-verified-modules}` (3 IDs)
- Row 34 cites `terraform-module-generation:{refactor-module, terraform-stacks}` (2 IDs)
- Row 35 cites `terraform-code-generation:terraform-search-import` (1 ID)

Total: 6 external plugin skill IDs.

**No other references:** zero agent prompt citations (only `skills/<tier>/<name>/` paths show up in agent blocks; plugin-namespaced IDs do not). Zero code references. Zero spec references except the design doc that introduced FEAT-019 wiring.

## Three options presented in chat

| Option | What | Effort | Trade-off |
|---|---|---|---|
| **A. Validator carve-out** (recommend) | Add `terraform-code-generation` + `terraform-module-generation` to `CARVEOUT_PLUGIN` regex in `scripts/validate-routing-table.mjs` (same pattern as existing `context7` carve-out) | 5 min | Routing-table content unchanged; capability preserved if user installs plugins later; Pass 1 stops failing; won't catch typos in plugin IDs |
| **B. Per-row routing-lint:ignore markers** | Add `<!-- routing-lint:ignore -->` HTML comments to rows 33, 34, 35 | 2 min | Targeted; cosmetic clutter; if plugins installed later, markers are wrong |
| **C. Remove rows 33, 34, 35** | Delete the 3 rows entirely. Row 36 (terraform ops issue, local-only) stays | 1 min | Cleanest signal — repo doesn't pretend to support terraform; smallest routing-table; can't be reversed without re-authoring |

## Recommendation

**Option A** if user does any terraform work and might install HashiCorp's terraform plugins later.
**Option C** if terraform is firmly out of scope for this repo.
Skip B (rarely the right answer — markers either need carve-out logic or removal).

## What's next

1. User picks A / B / C.
2. Lead applies the change (single small commit).
3. Re-run `CREW_VALIDATE_ROUTING_TABLE=1 node scripts/validate-routing-table.mjs` to confirm zero errors (or document remaining acceptable carve-out behavior).

## Risks

- Option A masks typos in plugin IDs (low — there are only 6 well-known ones).
- Option C removes documented capability — would require re-authoring those rows if terraform work resumes.
- Pre-session WIP `skills/agents-skils-comp.md` typo'd file still untracked, untouched.

## References

- Routing-table rows 33, 34, 35: `docs/routing-table.md`
- Local terraform skill: `skills/domain/terraform-ops-traps/`
- Validator with carve-out pattern: `scripts/validate-routing-table.mjs` (search for `CARVEOUT_PLUGIN`)
- Consistency validator commit: `7c03173`
- Local installed plugins: `~/.claude/plugins/installed_plugins.json` (confirmed no terraform-* entries)
