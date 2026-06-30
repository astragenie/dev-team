# Reviewer Rename — Design

**Date:** 2026-06-30
**Status:** draft pending user review
**Companion PR:** follow-up to PR #131 (cloud-architect + architect-reviewer promotion)
**Risk tier:** HIGH (breaking change to slash-command namespace, ~50 file edits, validator hard-coded sets)

## Goal

Normalize the code-review agent names so the public surface matches the role taxonomy:

| Today | Target | Reason |
| --- | --- | --- |
| `inspector` | `reviewer` | Constitution names the role `reviewer`. `inspector` is a synonym carried for historical reasons (name/role collision avoidance) — no longer needed once the stack-specific reviewers normalize. |
| `inspector-lite` | `reviewer-lite` | Same rename rationale; LOW-tier variant. |
| `c-sharp-reviewer` | `csharp-reviewer` | Single-segment kebab-case parity with `typescript-reviewer`. The `c-sharp-` form was a transitional name from the earliest TypeScript-only era. |

`typescript-reviewer` stays unchanged — already in the target form.

## Non-goals

- No prompt content changes. This is a pure rename + cross-ref sweep.
- No new validator gates.
- No marketplace.json or plugin.json schema changes.
- No `architect-reviewer` rename (already first-party; "architect-reviewer" is descriptive of what it reviews, not the role).

## Blast radius (from PR #131 investigation)

### Validator hard-coded sets in `scripts/validate-agents.ts`

Each set referencing `inspector`, `inspector-lite`, or `c-sharp-reviewer` needs the entry renamed:

| Set | inspector | inspector-lite | c-sharp-reviewer |
| --- | --- | --- | --- |
| `PEER_DISPATCH_ALLOWLIST` | indirectly — n/a today | n/a | n/a |
| `EVALS_REQUIRED_AGENT_NAMES` | yes | no | no |
| `TASK_UPDATE_BATCHING_REQUIRED` | yes | no | no |
| `BASH_COALESCING_REQUIRED` | yes | no | no |
| `NO_BACKLOG_IDS_REQUIRED` | yes | no | no |
| `NO_LEAD_REF_REQUIRED` | yes | yes | yes |
| `UNIVERSALS_DRIFT_REQUIRED` | yes | no | no |

Plus: rename the agent files themselves and `name:` + `prompt_id:` frontmatter.

### Test pins

- `tests/agent-topology.test.ts` → `EXPECTED_AGENTS`: rename three entries.
- `tests/agent-registry.test.ts` → check + update if it pins names.

### Slash commands (BREAKING for callers)

- `crew:inspector` → `crew:reviewer`
- `crew:inspector-lite` → `crew:reviewer-lite`
- `crew:c-sharp-reviewer` → `crew:csharp-reviewer`

### Routing tables + skills (live tree only)

- `docs/routing-table.md` — multiple rows.
- `skills/workflow/risk-tier/SKILL.md`
- `skills/workflow/fan-out-review/SKILL.md`
- `skills/workflow/dispatcher-routing/SKILL.md`
- `skills/workflow/reviewing-code/SKILL.md` + its `references/*.md` (typescript, sql, rust, python checklists)
- `skills/workflow/review-gates/` if it references inspector
- `skills/meta/` — any meta skill that routes on inspector

### Agent peer-integration sections

Every active agent that mentions `crew:inspector` in its body. Grep target:
```
rg "crew:inspector|crew:c-sharp-reviewer|crew:inspector-lite" \
   --type md --glob 'agents/**' --glob '!CHANGELOG.md'
```

Known carriers (from PR #131 grep): `architect.md`, `release-engineer.md`, `typescript-reviewer.md`, `c-sharp-reviewer.md` itself, and probably most builder prompts.

### Evals tree

- `evals/agents/inspector.yaml` → `evals/agents/reviewer.yaml` (rename file + update internal `agent:` field).
- `evals/agents/c-sharp-reviewer.yaml` → `evals/agents/csharp-reviewer.yaml` if present.
- `inspector-lite` may not have an eval file — verify.

### Slice-linker dispatch lib

- `src/scripts/lib/slice-linker/dispatch.mts` — any dispatch helper that hardcodes the inspector name.

### Pre-rendered universals

- `inspector.md` carries the `pre-loaded-universals:BEGIN hash=...` marker block. After file rename, re-run:
  ```
  bun scripts/render-universal-skills.ts --inject agents/reviewer.md
  ```

### Companion `runner-plugin`

- Confirm whether `runner-plugin` references `crew:inspector` / `crew:c-sharp-reviewer`. Per PR #131 investigation, runner-plugin has `agents/3rdparty/code-reviewer.md` (separate concern) but uses generic role labels in its own routing. Spot-grep to confirm — if any refs land, they ship in a paired PR.

### Immutable history (DO NOT touch)

- `CHANGELOG.md`
- `docs/superpowers/specs/*.md` (except this new spec)
- `.claude/artifacts/loop/{slices,backlog,grades,plans,trajectories}/**`
- `.claude/artifacts/crew/{handoffs,reviews,validations,bundles,agents,runs,designs}/**`
- `tests/agent-eval/fixtures/captured-traces/**`

## Plan

### Phase 1 — flat rename (mechanical, one commit)

1. `git mv agents/inspector.md agents/reviewer.md`
2. `git mv agents/inspector-lite.md agents/reviewer-lite.md`
3. `git mv agents/c-sharp-reviewer.md agents/csharp-reviewer.md`
4. Update `name:` + `prompt_id:` in each renamed file.
5. Update validator sets in `scripts/validate-agents.ts` (7 sets above).
6. Update `tests/agent-topology.test.ts` `EXPECTED_AGENTS`.
7. Update `evals/agents/*.yaml` filenames + internal `agent:` field.
8. Update `src/scripts/lib/slice-linker/dispatch.mts` if applicable.
9. Re-inject pre-loaded-universals hash on `reviewer.md`.
10. Run validator + lint + format + typecheck + topology test. All green before the cross-ref sweep.

### Phase 2 — cross-ref sweep (one commit)

Mechanical find-and-replace across the live tree (exclude immutable paths):

```
rg -l "crew:inspector\b|crew:inspector-lite\b|crew:c-sharp-reviewer\b" \
   --glob '!CHANGELOG.md' \
   --glob '!docs/superpowers/specs/**' \
   --glob '!.claude/artifacts/**' \
   --glob '!tests/agent-eval/fixtures/**'
```

For each file: replace `crew:inspector` → `crew:reviewer`, `crew:inspector-lite` → `crew:reviewer-lite`, `crew:c-sharp-reviewer` → `crew:csharp-reviewer`. Use word-boundary regex to avoid eating substrings.

Also sweep prose mentions: `inspector` → `reviewer` only where the word refers to the agent. Many uses of "inspect" / "inspection" are not agent references — review-by-line, do not blanket replace.

### Phase 3 — version bump + CHANGELOG (one commit)

- Bump `package.json` minor (this is a breaking slash-command change → SemVer pre-1.0 still allows minor for breaking, but flag explicitly).
- Bump `.claude/plugin.json` minor to match.
- CHANGELOG entry under unreleased:
  ```
  ### Breaking
  - Slash commands renamed: crew:inspector -> crew:reviewer,
    crew:inspector-lite -> crew:reviewer-lite,
    crew:c-sharp-reviewer -> crew:csharp-reviewer. Update any external
    scripts that invoke these by old name. No prompt-content change.
  ```
- Skip the astra-marketplace bump until the release is tagged.

### Phase 4 — release ceremony

Standard release flow per `CLAUDE.md` "Release workflow":

1. CI green.
2. Tag `vX.Y.0`.
3. Push tag.
4. Bump central registry `astra-marketplace/marketplace.json` for `crew` to the new version (per the HARD RULE exception for astra family plugins).

## Risks

| Risk | Mitigation |
| --- | --- |
| External user scripts hard-code `/crew:inspector` | Document breaking change loudly in CHANGELOG. Optional follow-up: ship a one-version shim that warns on old name. |
| Pre-loaded-universals hash drift after rename | Re-inject in Phase 1 step 9; validator catches drift. |
| Cross-ref sweep misses a file outside the standard tree | Run validator + full test suite after Phase 2. Pre-merge dispatch `crew:architect-reviewer` for independent gate. |
| In-flight slice references old name in `.claude/state/` | Per playbook: grep `.claude/artifacts/loop/backlog/{pending,triaged,in-progress}/` before Phase 1. Pause if a slice is mid-dispatch on inspector. |
| Lint reformats unrelated lines on touched files | Run `bun run format` per phase before committing. |

## Rollback

Each phase is a single commit. Revert in reverse order:

1. Revert Phase 3 (version bump).
2. Revert Phase 2 (cross-ref sweep) → all callers see the old names but agent files are still renamed → broken state.
3. Revert Phase 1 (rename) → fully back to current.

If only Phase 2 has shipped (Phase 3 not tagged), `git revert` Phase 2 + Phase 1 in one PR.

## Open questions

1. Does `runner-plugin` reference `crew:inspector` in its own agents? Need to grep before Phase 2.
2. Do any consumer repos pin specific slash commands in `.claude/settings.json` permission allowlists? If yes, ship the shim.
3. Should `inspector-verifier` (combined LOW-tier agent name) follow into `reviewer-verifier`? Out of scope for this PR but worth flagging — leaving it inconsistent ages poorly.

## Acceptance criteria

- All slash commands rename in commands/, agents/, skills/, scripts/.
- Validator green (`node ./scripts/validate-agents.ts`).
- Topology test green (`bun test tests/agent-topology.test.ts`).
- Full test suite green (`bun run test`).
- Lint zero warnings.
- CHANGELOG documents the breaking change.
- No active backlog item references the old slash command.
- `crew:architect-reviewer` ADR-style review attached to the PR before merge.
