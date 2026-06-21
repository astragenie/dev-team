# engineering-standards — maintainer notes

This README is for repo maintainers. Agents do not read it; consult `SKILL.md`.

## Source of truth

`references/*.md` is vendored from `kb/08-engineering/*.md`. The vendored copy exists so agents can load the standards portably regardless of which machine the agent runs on (no hardcoded `C:/work/mega/kb/` path).

## Sync discipline

- `last_reviewed` in `SKILL.md` frontmatter = last sync date with the kb source. Bump when copying updated files from `kb/08-engineering/`.
- `references/*.md` here should match `kb/08-engineering/*.md` byte-for-byte. Drift = real bug.
- Future: a CI job that diff-checks the references against the kb source, gated by a `KB_ENGINEERING_ROOT` env var. Not yet wired.

## Adding a new reference

1. Write the canonical version in `kb/08-engineering/NN-name.md` first.
2. Copy verbatim into `references/NN-name.md`.
3. Add a router row to `## Reference router` in `SKILL.md`.
4. Decide whether the new concern needs a `## Fast path` checklist — add inline if the slice shape is common; route to reference if depth-only.
5. Bump `last_reviewed` and `version` in `SKILL.md` frontmatter.

## Naming

The skill name `engineering-standards` reads as enforcement; the actual role is **index + fast paths**, with the references carrying depth. The description in `SKILL.md` frontmatter calls this out; renaming would orphan four downstream prompt references for marginal naming gain.
