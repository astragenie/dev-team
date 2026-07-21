# Deployment Guidance — hero-crew

This plugin has no server, no container, and no hosted runtime.
"Deploying" means **cutting a versioned release that consumers can pin to**.

## Settings

- `dev.stable: true` — the dispatcher, builder, and verifier MAY create local commits without per-edit user approval. Releases (tags, production promotion) remain manual and user-triggered.

- `push.verify: false` — disables the `crew:pre-push-verifier` hook for this repo even when the `push-verify` feature is enabled globally via `crew.json`. Use when a repo's release path does not go through `/crew:ship` (e.g. `release-engineer` path in plugin source repos).

  When `dev.stable: true` is set, the dispatcher and builder MAY create commits without asking after each edit,
  provided ALL of the following hold:
  - the change came from a `/crew:build` flow, a `/crew:fix` flow, **or** the autonomous loop's `slice-build`
    flow (the `slice-build` path was a known gap per the SLICE-104 audit notes, resolved in FEAT-163 SLICE-D)
  - the latest review artifact for the run is `PASS` (or `review_skipped` with explicit reason)
  - the latest validation artifact for the run is `PASS` (or `validation_skipped` with explicit reason)
  - no `help_request` workflow badge is open
  - the work is local commits only — not a release tag, not a force-push, not a production deploy

  See `agents/release-engineer.md` → Deployment guidance schema for the authoritative field definition.
  Production promotion, tag pushes, and force-pushes are NEVER unlocked by `dev.stable`.

## Prerequisites and release steps

**Superseded 2026-07-21** — this section previously listed `.mjs` CI scripts and a 3-manifest
version bump including `.claude-plugin/marketplace.json`. Neither matches current reality: the repo
has 32 `.ts` scripts and 0 `.mjs` (post-TS-migration), and `marketplace.json` is no longer in this
repo (registry lives in `astragenie/astra-marketplace`). `AGENTS.md` ("CI gates" and "Release
workflow" sections) is now the single source of truth for both — don't duplicate the list here
where it can drift again; read it there.

## Versioning

Pre-1.0 semver-ish (see `AGENTS.md` Release workflow for the authoritative rule and manifest list):

- **Minor** (`0.X.0`): closes a backlog phase or introduces new commands/skills.
- **Patch** (`0.X.Y`): bugfix, doc polish, skill quality bar updates.
- Bumping `package.json` without bumping `.claude-plugin/plugin.json` is a release bug
  (`validate-manifests.ts` hard-fails CI on the mismatch).

## Companion plugin (loop)

Separate repo: `astragenie/runner-plugin`, with its **own standalone marketplace** — this repo's
`marketplace.json` (which doesn't exist in-repo at all; see above) carries no `loop` entry. To pick
up a `loop` release, bump version in the loop repo's own `package.json` and its own
`marketplace.json`, tag and push there, then refresh the local plugin install.

## Hard rules

- Never force-push `main`. Never delete tags. Never skip hooks.
- Never publish a release with failing CI, even locally green.
- No auto-publish hook; releases are user-triggered.

- `ship.fix_retry_limit: <N>` — `/crew:ship` auto-fix loop retry cap. Default 2 if absent. Raises bound for repos with flaky QA / verifier dispatches. Hard cap: 5.

- `fix.retry_limit: <N>` — `/crew:fix` auto-fix retry cap when Reviewer rejects. Default 2 if absent. Hard cap: 5. Symmetric with `ship.fix_retry_limit`.
