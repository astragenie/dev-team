# Task Handoff: SLICE-10 builder complete — preflight-shell hook

- Created: 2026-06-02T12:08:28.481Z
- From: builder
- To: lead
- Objective: Implements the tool-failure preflight hook for Bash and PowerShell: four checks (env-var shape, chained-cd ENOENT, unquoted Windows path with space, unterminated heredoc) wired via two new PreToolUse matchers, 22 tests all green, all 8 CI gates pass.
- Allowed Scope:
  - hooks/preflight-shell.mjs
  - scripts/lib/preflight/checks.mjs
  - hooks/hooks.json (two new PreToolUse matchers)
  - tests/preflight-shell.test.mjs
  - CHANGELOG.md (v0.4.0 entry)
- Forbidden Scope: -
- Deliverable: Five files changed/created; 22 new tests; full test suite 155/155 pass; lint/format/typecheck/validators/e2e all green
- Changed Files:
  - hooks/preflight-shell.mjs
  - scripts/lib/preflight/checks.mjs
  - hooks/hooks.json
  - tests/preflight-shell.test.mjs
  - CHANGELOG.md
- Confidence: high
- Risks: AC-8 tmpdir on Windows has no spaces so the cd-missing test uses a non-existent path that works cross-platform. Regex false-positive guard for heredoc uses both real \n and escaped \n — covers both raw and shell-wrapped invocations. No version bump (deferred per spec).
- Suggested Next Handoff: Review + CI gate run; then loop:slice-complete for SLICE-10 close ceremony

## AC-by-AC Status

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 | PASS | `hooks/preflight-shell.mjs` exists; parseInput validates session_id/cwd/tool_name/tool_input.command shape |
| AC-2 | PASS | `scripts/lib/preflight/checks.mjs` exports checkEnvVarShape, checkChainedCdPaths, checkUnquotedWindowsPathSpace, checkUnterminatedHeredoc, runChecks |
| AC-3 | PASS | `hooks/hooks.json` has Bash + PowerShell PreToolUse matchers; validate-manifests passes |
| AC-4 | PASS | test "AC-4: output is always decision=approve, never decision=block" — 3 warn-triggering cases all approve |
| AC-5 | PASS | test "AC-5: CREW_TOOL_PREFLIGHT=0 short-circuits" |
| AC-6 | PASS | tests "AC-6" + "AC-6b" — empty and unset env var both let hook run |
| AC-7 | PASS | tests "AC-7a" (Bash $env:HOME warns) + "AC-7b" (PowerShell $HOME warns) |
| AC-8 | PASS | test "AC-8" (non-existent path warns + names it) + "AC-8b" (existing path silent) |
| AC-9 | PASS | test "AC-9a" (unquoted space warns) + "AC-9b" (quoted silent) |
| AC-10 | PASS | test "AC-10a" (unterminated warns) + "AC-10b" (terminated silent) |
| AC-11 | PASS | tests "AC-11" + "AC-11b" — clean Bash + PowerShell commands produce zero stdout |
| AC-12 | PASS | tests "AC-12", "AC-12b", "AC-12c" — malformed JSON, missing command, null bytes all exit 0 |
| AC-13 | PASS | lint: 0 warnings; format:check: all files clean; typecheck: 0 errors; node --test: 155/155 pass; validate-manifests/skills/slices: OK; e2e-smoke: OK |
| AC-14 | PASS | CHANGELOG.md v0.4.0 section added with FEAT-033 tag, four checks described, opt-out documented |

## Self-Verify Gate Results

1. `npm run lint` — exit 0, 0 warnings
2. `npm run format:check` — exit 0, all files use Prettier code style
3. `npm run typecheck` — exit 0, 0 errors
4. `node --test tests/preflight-shell.test.mjs` — 22/22 pass
5. `node --test` (full suite) — 155/155 pass
6. `node ./scripts/validate-manifests.mjs` — Manifests OK
7. `node ./scripts/validate-skills.mjs` — Skills OK: 12 checked
8. `node ./scripts/validate-slices.mjs` — exit 0
9. `node ./scripts/e2e-smoke.mjs` — all checks true, PreToolUse configured

## Spec Ambiguity Resolved

- **Heredoc terminator detection**: spec says `\nEOF\b` — but commands passed via Claude Code tool_input may use literal `\n` (two-char escape) rather than real newlines. Check handles both patterns.
- **Windows path check false-positive with quotes**: used odd-quote-count prefix heuristic to detect quoted context reliably for both double and single quotes.
- **AC-8 test path**: used `os.tmpdir() + random suffix` (never created) as the missing path — avoids OS-specific path separator issues.
