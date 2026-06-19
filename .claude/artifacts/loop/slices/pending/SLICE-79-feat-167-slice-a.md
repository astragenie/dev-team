---
id: SLICE-79
feat: FEAT-167
slice_letter: A
title: Prompt frontmatter contract + validator extension + 1.0.0 backfill
status: pending
autonomous_safe: false
parallel_safe_with: [FEAT-165-SLICE-A, FEAT-166-SLICE-A]
blocks: [FEAT-167-SLICE-B]
touches_files:
  - scripts/validate-agents.ts
  - scripts/validate-skills.ts
  - tests/scripts/validate-agents-frontmatter.test.ts
  - tests/scripts/validate-skills-frontmatter.test.ts
  - docs/prompts/README.md
  - agents/architect.md
  - agents/backend-dev.md
  - agents/document-writer.md
  - agents/frontend-dev.md
  - agents/fullstack-dev.md
  - agents/inspector-verifier.md
  - agents/inspector.md
  - agents/integrator.md
  - agents/investigator.md
  - agents/lead.md
  - agents/parallel-runner.md
  - agents/performance-engineer.md
  - agents/qa-expert.md
  - agents/refactor.md
  - agents/release-engineer.md
  - agents/researcher.md
  - agents/uxdesigner.md
  - agents/verifier.md
  - skills/universal/**/SKILL.md
  - skills/workflow/**/SKILL.md
  - skills/domain/**/SKILL.md
  - skills/meta/**/SKILL.md
touches_files_confidence: declared
---

# Spec: FEAT-167 SLICE-A — Prompt frontmatter contract + validator + 1.0.0 backfill

## Metadata
- developer_type: human (autonomous_safe=false — prompt authorship surface)
- estimated_complexity: medium
- languages: TypeScript, YAML, Markdown
- depends_on: none (parallel-safe with FEAT-165 SLICE-A, FEAT-166 SLICE-A)

## Objective

Add a stable `prompt_id` + `version` (+ optional `model_pinned`, `evals`,
`changelog`) frontmatter contract to every first-party agent (`agents/*.md`,
NOT `agents/3rdparty/`) and every first-party `skills/{universal,workflow,
domain,meta}/**/SKILL.md`. Extend `scripts/validate-agents.ts` +
`scripts/validate-skills.ts` to enforce the contract. Pure metadata —
**no eval runtime, no `evals/` tree, no Langfuse, no OTel** in this slice.

This slice unblocks SLICE-B (eval tree scaffold) and SLICE-C (OTel attr
injection) by giving them a stable `prompt_id` key to attach to.

## Context

### What exists today
- `scripts/validate-agents.ts` requires `name`, `description`, `model` in
  agent frontmatter; line-cap 350; Report-contract + identity-intro body
  checks; peer-dispatch + TaskUpdate-batching + Bash-coalescing rules
  gated by allowlist; universals-hash drift check.
- `scripts/validate-skills.ts` requires `name`, `tier`, `description`;
  line-cap 200; tier ∈ {universal, workflow, domain, meta}; directory
  name matches `name`; recommended-fields warnings for `owner`,
  `last_reviewed`, `triggers`.
- `parseFrontmatter` in both scripts is a flat key:value reader; nested
  YAML (e.g. `capabilities.role`) is NOT parsed today. **Role detection
  for this slice MUST NOT depend on nested YAML** — see Role detection
  logic below.
- 18 first-party agents in `agents/*.md` (top-level; `agents/3rdparty/`
  excluded). 64 first-party SKILL.md files across the four tiers.
- Zero agents and zero skills currently carry `prompt_id` or `version`
  (grepped). Clean-slate backfill.
- `docs/prompts/` directory does not exist.

### What FEAT-167 body promises this slice (lines 137–141)
> SLICE-A (autonomous_safe=false — prompt authorship): frontmatter
> contract + validator extension + `prompt_id` + `version: 1.0.0`
> backfilled on all 18 first-party agents + every SKILL.md. Pure
> metadata. No eval runtime.

### What sister FEAT-162 expects from this slice
Nothing direct. SLICE-B of FEAT-167 blocks on FEAT-162 SLICE-A landing
(it needs `lib/run-claude.ts`). This slice is independent.

## Implementation Contract

### 1. Frontmatter contract (additive, applies to agents AND skills)

```yaml
# REQUIRED (new — enforced by validator)
prompt_id: <kebab-slug>         # stable id; see derivation rule
version: <semver>               # initial backfill = 1.0.0

# OPTIONAL (new — validated as string-only this slice)
model_pinned: <model-string>    # carry from existing `model:` if present
evals: <path-string>            # e.g. evals/agents/inspector.yaml
changelog: <path-string>        # e.g. docs/prompts/CHANGELOG-inspector.md

# REQUIRED for agents whose role ∈ EVALS_REQUIRED_ROLES (see §3)
# In this slice the validator requires the FIELD to be a non-empty string;
# it does NOT check the path exists (eval tree lands in SLICE-B).
# Mark with `// TODO(FEAT-167 SLICE-B): enforce path existence`
```

#### Zod-ish shape (applied uniformly to agents + skills)
```ts
{
  prompt_id: string.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),  // kebab, non-empty
  version: string.regex(/^\d+\.\d+\.\d+$/),             // semver MAJOR.MINOR.PATCH
  model_pinned?: string,
  evals?: string,        // path-string; existence NOT checked this slice
  changelog?: string,    // path-string; existence NOT checked this slice
}
```

### 2. `prompt_id` kebab-slug derivation rule

Source: agent or skill frontmatter `name:` value.

1. Lowercase.
2. Replace any `:` with `-` (e.g. `crew:inspector` → `crew-inspector`).
3. Replace any character that is not `[a-z0-9-]` with `-`.
4. Collapse runs of `-` to a single `-`.
5. Trim leading/trailing `-`.

Backfilled examples:
| agent `name:`          | `prompt_id:`           |
|------------------------|------------------------|
| `inspector`            | `inspector`            |
| `inspector-verifier`   | `inspector-verifier`   |
| `parallel-runner`      | `parallel-runner`      |
| `release-engineer`     | `release-engineer`     |
| `document-writer`      | `document-writer`      |

For skills (`name:` is already kebab-cased today, e.g. `git-commit`,
`writing-claude-md`), the rule is a no-op idempotent pass — `prompt_id`
equals `name`. Validator MUST still enforce the regex; do not skip skills.

### 3. Role detection logic for the `evals:` requirement

FEAT-167 body line 63: `evals:` "required when the prompt is user-visible
behavior (builder, reviewer, validator, deployer, lead)".

The repo does not have a `builder` or `deployer` agent literally. Map by
agent `name:` (the simplest, non-nested-YAML signal — see Context
caveat).

```ts
const EVALS_REQUIRED_AGENT_NAMES = new Set([
  "lead",
  "fullstack-dev",       // builder (primary)
  "backend-dev",         // builder
  "frontend-dev",        // builder
  "refactor",            // builder (transform)
  "inspector",           // reviewer
  "inspector-verifier",  // reviewer + validator
  "verifier",            // validator
  "integrator",          // validator (merge gate)
  "release-engineer",    // deployer
]);
```

Excluded (not user-visible behavior in the sense the FEAT means):
`architect`, `uxdesigner`, `document-writer`, `investigator`,
`researcher`, `parallel-runner`, `qa-expert`, `performance-engineer`.

For SKILL.md the `evals:` field is OPTIONAL across the board this slice
(skills are invoked, not dispatched; eval coverage will be slice-targeted
in SLICE-B/C, not slice-A). Validator MUST NOT require `evals:` on any
skill.

### 4. Validator extension — `scripts/validate-agents.ts`

Add new checks, preserve all existing checks:

- `checkPromptIdAndVersion(fm, label, errors)`
  - missing `prompt_id` → error: `${label}: missing required frontmatter "prompt_id"`
  - `prompt_id` fails kebab regex → error: `${label}: prompt_id "${fm.prompt_id}" must be kebab-slug ([a-z0-9-]+, no leading/trailing -)`
  - missing `version` → error: `${label}: missing required frontmatter "version"`
  - `version` fails semver regex → error: `${label}: version "${fm.version}" must be semver MAJOR.MINOR.PATCH`
- `checkEvalsRequiredForRole(fm, label, errors)`
  - if `EVALS_REQUIRED_AGENT_NAMES.has(fm.name)` and `evals` is missing
    or empty → error: `${label}: agent name "${fm.name}" requires "evals" frontmatter field (FEAT-167 SLICE-A — path existence enforced in SLICE-B)`
  - NOTE: in source, mark with `// TODO(FEAT-167 SLICE-B): enforce path existence here once evals/ tree lands`
- Wire both into `validateAgents()` after `checkRequiredFields`.

### 5. Validator extension — `scripts/validate-skills.ts`

Add `checkPromptIdAndVersion(fm, label, errors)` (identical logic to
agents). Do NOT add an `evals:` requirement for any skill in this slice.
Wire after `checkRequiredFields`.

## Files to create / modify

### Modify (validators) — 2 files
- `scripts/validate-agents.ts` — add the two new check functions + wire-in.
- `scripts/validate-skills.ts` — add the one new check function + wire-in.

### Create (tests) — 2 files
- `tests/scripts/validate-agents-frontmatter.test.ts`
- `tests/scripts/validate-skills-frontmatter.test.ts`

### Create (docs) — 1 file
- `docs/prompts/README.md` — versioning policy + slug derivation +
  changelog convention; ≤ 120 lines.

### Modify (frontmatter backfill, agents) — 18 files
All under `agents/` top level (`agents/3rdparty/` excluded):
`architect.md`, `backend-dev.md`, `document-writer.md`, `frontend-dev.md`,
`fullstack-dev.md`, `inspector-verifier.md`, `inspector.md`,
`integrator.md`, `investigator.md`, `lead.md`, `parallel-runner.md`,
`performance-engineer.md`, `qa-expert.md`, `refactor.md`,
`release-engineer.md`, `researcher.md`, `uxdesigner.md`, `verifier.md`.

For each agent: insert these lines in the frontmatter block (preserving
ordering convention — place immediately after `name:`):
```yaml
prompt_id: <derived-slug>
version: 1.0.0
model_pinned: <existing model: value if present>  # OMIT the line if no `model:` field exists in current frontmatter
```
Add `evals: evals/agents/<prompt_id>.yaml` ONLY for the 10 agents in
`EVALS_REQUIRED_AGENT_NAMES`. Do NOT create the eval files. Do NOT add
`changelog:` in this slice.

### Modify (frontmatter backfill, skills) — 64 files
Every SKILL.md under `skills/{universal,workflow,domain,meta}/` (recursive).
Insert immediately after `name:`:
```yaml
prompt_id: <name>     # idempotent for already-kebab skill names
version: 1.0.0
```
Do NOT add `model_pinned`, `evals`, or `changelog` to skills in this slice.

Expected file list (matches grep `Get-ChildItem -Path skills -Recurse -Filter SKILL.md` = 64 files).

### Out-of-scope (DO NOT TOUCH)
- `agents/3rdparty/**` — upstream imports.
- `evals/` tree — does not exist; SLICE-B.
- OTel attr emission code paths — SLICE-C.
- Langfuse dataset code — SLICE-C.
- `docs/prompts/CHANGELOG-*.md` per-prompt files — created lazily on
  first prompt edit after this slice lands; not pre-generated.

## Required tests (≥3 per validator, concrete data)

### `tests/scripts/validate-agents-frontmatter.test.ts`
Uses `mkdtemp` + temp `agents/` fixture; calls `validateAgents(tempDir)`.

1. **AC-AT-1 happy path** — fixture agent file with frontmatter
   `name: foo`, `description: x`, `model: sonnet`, `prompt_id: foo`,
   `version: 1.0.0`. Identity intro + Report-contract present. Assert
   `result.ok === true`, no errors.
2. **AC-AT-2 missing prompt_id** — same fixture minus `prompt_id` line.
   Assert `result.ok === false` and errors include the substring
   `missing required frontmatter "prompt_id"`.
3. **AC-AT-3 bad version** — `version: 1.0` (two segments). Assert
   `result.ok === false` and errors include `must be semver`.
4. **AC-AT-4 non-kebab prompt_id** — `prompt_id: Foo_Bar`. Assert error
   substring `must be kebab-slug`.
5. **AC-AT-5 reviewer agent missing evals** — `name: inspector`,
   `prompt_id: inspector`, `version: 1.0.0`, NO `evals:` line. Assert
   error substring `requires "evals" frontmatter field`.
6. **AC-AT-6 non-required role agent without evals passes** —
   `name: architect`, `prompt_id: architect`, `version: 1.0.0`, no
   `evals:`. Assert `result.ok === true` (architect not in
   EVALS_REQUIRED_AGENT_NAMES).

### `tests/scripts/validate-skills-frontmatter.test.ts`
1. **AC-ST-1 happy path** — `name: foo-skill`, `tier: workflow`,
   `description: x`, `prompt_id: foo-skill`, `version: 1.0.0`. Body has
   `## When to Use` + `## Done` headings. Assert `result.ok === true`.
2. **AC-ST-2 missing version** — same fixture minus `version` line.
   Assert error substring `missing required frontmatter "version"`.
3. **AC-ST-3 skill never requires evals** — even if `name` matches a
   reserved word (`name: lead`), no `evals:` is required. Assert
   `result.ok === true` when prompt_id + version present.

### Live backfill smoke (no new test file — runs as part of CI)
After backfill, `bun run typecheck && node ./scripts/validate-agents.ts &&
node ./scripts/validate-skills.ts` MUST pass with zero errors against the
live tree. The slice is NOT done until both validators are clean.

## Acceptance Criteria (automatically verifiable)

- **AC-1** `node ./scripts/validate-agents.ts` exits 0 with all 18
  first-party agents carrying `prompt_id` + `version: 1.0.0` AND the 10
  EVALS_REQUIRED_AGENT_NAMES carrying a non-empty `evals:` string.
- **AC-2** `node ./scripts/validate-skills.ts` exits 0 with all 64
  first-party SKILL.md carrying `prompt_id` + `version: 1.0.0`.
- **AC-3** `bun test tests/scripts/validate-agents-frontmatter.test.ts`
  and `bun test tests/scripts/validate-skills-frontmatter.test.ts` pass
  (≥6 cases + ≥3 cases respectively).
- **AC-4** `agents/3rdparty/**` files are unchanged (diff verified).
- **AC-5** `evals/` directory does NOT exist after this slice (`test ! -d
  evals` returns 0).
- **AC-6** `docs/prompts/README.md` exists and is ≤ 120 lines.
- **AC-7** `bun run lint && bun run format:check && bun run typecheck`
  green.

## Verification commands

```bash
node ./scripts/validate-agents.ts
node ./scripts/validate-skills.ts
bun test tests/scripts/validate-agents-frontmatter.test.ts tests/scripts/validate-skills-frontmatter.test.ts
bun run typecheck
bun run lint
bun run format:check
# Backfill scope guard:
git diff --stat HEAD -- agents/3rdparty/  # MUST be empty
# Eval-tree absence guard:
test ! -d evals && echo "evals/ tree absent OK"
# Frontmatter coverage spot-check:
grep -lE '^prompt_id:' agents/*.md | wc -l   # expect 18
grep -rlE '^prompt_id:' skills/ --include=SKILL.md | wc -l   # expect 64
```

## Rollback strategy

Single-commit revert. The slice is metadata + validator extension; no
schema migration, no external state, no consumer-facing behavior change.

```bash
git revert <slice-77-commit-sha>
# validators return to pre-slice rules; agents/skills lose the new
# frontmatter lines harmlessly (no consumer reads them yet — SLICE-B/C
# haven't landed).
```

If the validator extension lands BUT the backfill is incomplete (e.g.
some agents flagged), the targeted recovery is to revert ONLY the
validator changes (`git checkout HEAD~1 -- scripts/validate-agents.ts
scripts/validate-skills.ts`) and re-cut a smaller slice. The frontmatter
lines on individual agents/skills are inert until the validator
enforces them — they will not break consumers.

Rollback risk floor: zero downstream consumers of `prompt_id` / `version`
exist as of this slice (SLICE-B/C add them). Safe to revert at any time
before SLICE-B merges.
