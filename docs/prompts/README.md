# Prompt Frontmatter Contract

Every first-party agent (`agents/*.md`, excluding `agents/3rdparty/`) and every
first-party skill (`skills/{universal,workflow,domain,meta}/**/SKILL.md`) carries
a stable frontmatter contract introduced in FEAT-167 SLICE-A.

## Required fields

```yaml
prompt_id: <kebab-slug>   # stable identifier; see derivation rule below
version: <semver>         # initial backfill = 1.0.0
```

Both fields are enforced by:
- `scripts/validate-agents.ts` (agents)
- `scripts/validate-skills.ts` (skills)

CI gates on both validators. A missing or malformed field fails the build.

## Optional fields (agents only)

```yaml
model_pinned: <model-string>   # mirrors existing model: value; explicit pin for eval harness
evals: <path-string>           # e.g. evals/agents/inspector.yaml — required for EVALS_REQUIRED agents
changelog: <path-string>       # e.g. docs/prompts/CHANGELOG-inspector.md — created lazily
```

Skills do not carry `model_pinned`, `evals`, or `changelog` in this slice.

## `prompt_id` kebab-slug derivation

Source: the frontmatter `name:` field value.

1. Lowercase everything.
2. Replace `:` with `-` (e.g. `crew:inspector` → `crew-inspector`).
3. Replace any character outside `[a-z0-9-]` with `-`.
4. Collapse consecutive `-` to a single `-`.
5. Trim leading and trailing `-`.

The result must match `/^[a-z][a-z0-9-]*$/`. For most agents and skills
whose `name:` is already kebab-cased, the rule is a no-op.

Examples:

| `name:`              | `prompt_id:`         |
|----------------------|----------------------|
| `inspector`          | `inspector`          |
| `inspector-verifier` | `inspector-verifier` |
| `release-engineer`   | `release-engineer`   |
| `git-commit`         | `git-commit`         |

## Versioning policy

- Initial backfill: `1.0.0` for all prompts.
- Increment `MINOR` (e.g. `1.1.0`) when substantive behavior changes — new
  rules, new gates, restructured sections.
- Increment `PATCH` (e.g. `1.0.1`) for wording polish, typo fixes, whitespace.
- Increment `MAJOR` (e.g. `2.0.0`) for a breaking structural change — section
  renamed, identity statement changed, tool list fundamentally altered.
- The `changelog:` field (optional) points to a per-prompt CHANGELOG file under
  `docs/prompts/`. These files are created lazily on the first substantive edit
  after this slice lands; they are not pre-generated.

## `evals:` field — agents only

The `evals:` field is **required** for agents whose role participates in the
eval harness (EVALS_REQUIRED set). It holds a path string pointing to the
agent's eval definition file; path existence is not enforced in this slice
(the eval tree lands in SLICE-B).

EVALS_REQUIRED agent names:
`lead`, `fullstack-dev`, `backend-dev`, `frontend-dev`, `refactor`,
`inspector`, `inspector-verifier`, `verifier`, `integrator`, `release-engineer`.

All other agents may omit the field.

Skills never require `evals:` — they are invoked, not dispatched as
user-visible behavior.

## Validator scripts

| Validator                        | Enforces                                      |
|----------------------------------|-----------------------------------------------|
| `scripts/validate-agents.ts`     | `prompt_id`, `version`, `evals` (EVALS_REQUIRED) |
| `scripts/validate-skills.ts`     | `prompt_id`, `version`                        |

Run locally:
```bash
node ./scripts/validate-agents.ts
node ./scripts/validate-skills.ts
```

Both run as hard CI gates in `.github/workflows/test.yml`.
