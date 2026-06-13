# Deployment Guidance — hero-crew

This plugin has no server, no container, and no hosted runtime.
"Deploying" means **cutting a versioned release that consumers can pin to**.

## Settings

- `dev.stable: false` — no auto-continue from build to dev ship. Releases are manual and user-triggered.

  When `dev.stable: true` is set, the lead and builder MAY create commits without asking after each edit,
  provided ALL of the following hold:
  - the change came from a `/crew:build` flow, a `/crew:fix` flow, **or** the autonomous loop's `slice-build`
    flow (the `slice-build` path was a known gap per the SLICE-104 audit notes, resolved in FEAT-163 SLICE-D)
  - the latest review artifact for the run is `PASS` (or `review_skipped` with explicit reason)
  - the latest validation artifact for the run is `PASS` (or `validation_skipped` with explicit reason)
  - no `help_request` workflow badge is open
  - the work is local commits only — not a release tag, not a force-push, not a production deploy

  See `agents/deployer.md` → Deployment guidance schema for the authoritative field definition.
  Production promotion, tag pushes, and force-pushes are NEVER unlocked by `dev.stable`.

## Prerequisites

All 9 CI gates must pass on `main`:

1. `npm ci`
2. `node ./scripts/validate-manifests.mjs`
3. `node ./scripts/validate-skills.mjs`
4. `node ./scripts/validate-slices.mjs`
5. `npm run lint` (zero warnings)
6. `npm run format:check`
7. `npm run typecheck`
8. `node --test`
9. `node ./scripts/e2e-smoke.mjs`

## Release steps

1. Confirm CI green on `main`.
2. Update `CHANGELOG.md` — new top section, dated, grouped by FEAT.
3. Bump `version` in three places:
   - `package.json`
   - `.claude-plugin/plugin.json`
   - `.claude-plugin/marketplace.json` → `plugins[name=crew].version`
4. Update `README.md` pinned-release callout to the new tag.
5. Commit: `chore(release): vX.Y.Z — <one-line summary>`.
6. Tag annotated: `git tag -a vX.Y.Z -m "vX.Y.Z"`.
7. Push both: `git push origin main --follow-tags`.
8. Verify the tag appears on GitHub.

## Versioning

Pre-1.0 semver-ish:

- **Minor** (`0.X.0`): closes a backlog phase or introduces new commands/skills.
- **Patch** (`0.X.Y`): bugfix, doc polish, skill quality bar updates.
- Bumping `package.json` without bumping `plugin.json` or `marketplace.json` is a release bug.

## Companion plugin (loop)

Separate repo: `sergeymilashico/loop`.
Referenced here by version only in `marketplace.json → plugins[name=loop].version`.
To pick up a loop release: bump that version and commit under `chore(marketplace): bump loop to <ver>`.

## Hard rules

- Never force-push `main`. Never delete tags. Never skip hooks.
- Never publish a release with failing CI, even locally green.
- No auto-publish hook; releases are user-triggered.
