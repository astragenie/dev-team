---
id: FEAT-187
status: pending
priority: P1
category: chore
target_release: null
created: 2026-06-28
depends_on: []
slices: []
derived_from: null
autonomous_safe: false
tags: [npm, publish, gepa-core, resume, operator-blocker]
---

# FEAT-187: Resume — publish @astragenie/gepa-core@0.2.0 to npm + merge dev-team#127 + start Phase 6

## Description

End-of-session 2026-06-28 left FEAT-184 ceremony half-done. gepa-core@0.2.0 is built, tagged on main, and pushed but NOT published to npm. dev-team#127 CI is red until the package resolves from the npm registry. FEAT-185 (Phase 6) + FEAT-186 (Phase 7) sit behind both.

## Where we left off

### What is done

- gepa-core#1 MERGED to main (`2c2bab0`). Version 0.2.0 in `package.json`. Includes contract test + extended LLMJudge interface + CHANGELOG migration guide.
- gepa-core `package.json` carries `publishConfig.registry = https://registry.npmjs.org/` (commit `28af1be`).
- gepa-core ships a project `.npmrc` overriding the global `@astragenie → GH Packages` routing to npmjs (commit `adc68d7`).
- dev-team#127 (`refactor/evals-adopt-llm-judge-184`) carries the consumer-side changes:
  - 1 commit `60b8170` — main FEAT-184 refactor (7 adapters migrated, LLMJudge adopted, AC-5 wrap, AC-6 context)
  - 1 commit `7e940e4` — inspector MEDIUM fix (JudgeProvider → LLMJudge in run-eval.ts)
  - 1 commit `3562b15` — review artifacts (gepa-core#1 + #127 inspector verdicts)
- dev-team#124 (S2 capture tee) MERGED on `344ca4b` after lock-file fix + main merge + timestamp-flake normalization. Review artifact landed.
- 3 inspector verdicts complete (all approved / approved_with_notes). All notes addressed.

### What blocks (operator only — cannot auto-progress)

**npm publish of `@astragenie/gepa-core@0.2.0` failed at the auth gate.** Account `heroboec` has 2FA enforcement on publishes. The legacy automation token (`npm_vIP...` — already leaked in session log, must rotate) in `~/.npmrc` cannot accept OTP augmentation.

Two paths:

1. **Granular Access Token (durable, recommended):**
   - https://www.npmjs.com/settings/heroboec/tokens → **Generate New Token** → **Granular Access Token**
   - Expiration: 90 days
   - Permissions → Packages and scopes: read+write on `@astragenie`
   - **Bypass two-factor authentication when publishing: YES**
   - Replace `npm_vIP...` line in `~/.npmrc` with new token
   - Verify `npm whoami` → `heroboec`
   - Revoke the old leaked token in the same UI

2. **Interactive OTP (one-shot):**
   - `cd C:/work/mega/gepa-core && npm publish --otp=XXXXXX` (6-digit code from authenticator, ~30s window)

Same applies to also-leaked GitHub PAT `gho_SSE...` — revoke at https://github.com/settings/tokens, regenerate, re-paste into `~/.npmrc`.

## Acceptance criteria

- AC-1: `npm view '@astragenie/gepa-core' version` returns `0.2.0`.
- AC-2: Both leaked tokens (npm `npm_vIP...` + GitHub `gho_SSE...`) revoked. New tokens in `~/.npmrc`.
- AC-3: dev-team `package.json` bumped from `"@astragenie/gepa-core": "file:../gepa-core"` to `"^0.2.0"`. `package-lock.json` regenerated via `npm install`.
- AC-4: dev-team#127 CI green on both ubuntu + windows runners after the version bump.
- AC-5: dev-team#127 merged to main.
- AC-6: Phase 6 (FEAT-185 build) started: dispatch crew:fullstack-dev with the SLICE-A split (ollama + generic-openai + groq + gemini move to gepa-core first; azure + bedrock in SLICE-B).
- AC-7 (optional): AC-4 statistical-drift gate from FEAT-184 run pre/post against `crew-fullstack-dev.yaml` + `crew-inspector.yaml` with live API keys (groq, gemini, azure, bedrock) + ollama install. N≥5 runs. Bands: ±0.05 score, ±5% tokens, identical pass/fail per test.

## Resume command for the AI agent

When the operator gives the "go" signal, pick up auto-mode:

```
cd C:/work/mega/dev-team
git checkout refactor/evals-adopt-llm-judge-184
# bump dep
sed -i 's|"@astragenie/gepa-core": "file:../gepa-core"|"@astragenie/gepa-core": "^0.2.0"|' package.json
npm install
git add package.json package-lock.json
git commit -m "chore(deps): pin @astragenie/gepa-core ^0.2.0 after npm publish"
git push
# poll
gh pr checks 127
# if green
gh pr merge 127 --squash --delete-branch
# then Phase 6 — dispatch crew:fullstack-dev for FEAT-185 SLICE-A
```

## Risks / heads-up

- gepa-core's `bun.lock` was updated when adding the `file:` dep — operator will need to re-run `bun install` after the version bump if `bun.lock` is also consulted.
- The 2 leaked tokens are LIVE until rotated. Anyone reading the session transcript can publish to `@astragenie` scope or push to your GitHub repos under your identity. Rotation is mandatory, not optional.
- dev-team#127 branch is fresh — if main has moved during the gap, a `git pull --rebase origin main` may be needed before the dep bump commit.
- Open PRs still standing: none on dev-team (after #127 merges). gepa-core has none. Worktree `gepa-s2-exec` was cleaned at session end.

## Session-end status snapshot

- 4 dev-team PRs filed this session: #124 ✓ merged, #125 ✓ merged, #126 ✓ merged, #127 open (blocked)
- 1 gepa-core PR: #1 ✓ merged (not published)
- 3 FEATs landed in backlog triaged/: FEAT-184 (P1), FEAT-185 (P2), FEAT-186 (P2)
- 1 architect-review cycle: 2 parallel reviews on FEAT-184 + FEAT-185, all findings addressed in revision
- 1 PM-triage cycle: 5-dim scores on FEAT-184/185/186, surfaced + fixed depends_on inversion on FEAT-184
- 1 inspector cycle: 3 parallel inspector reviews on gepa-core#1 + #124 + #127, all approved with notes addressed
- 1 builder cycle: FEAT-184 cross-repo (gepa-core PR #1 + dev-team#127); main thread picked up inline after builder hit context cap mid-test-migration
- Phase 6 + Phase 7 (FEAT-185 + FEAT-186) NOT started. Both queued behind FEAT-184 merge.
