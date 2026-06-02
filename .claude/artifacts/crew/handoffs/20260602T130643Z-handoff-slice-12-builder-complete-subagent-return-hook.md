# Task Handoff: SLICE-12 builder complete — subagent-return hook

- Created: 2026-06-02T13:06:43.708Z
- From: builder
- To: lead
- Objective: New PostToolUse Agent hook emits a soft-warn when subagent return body exceeds 512 bytes and contains no .claude/artifacts/crew artifact path, enforcing cost-discipline rule #2 without blocking.
- Allowed Scope:
  - 5 files: hooks/check-subagent-return.mjs
  - scripts/lib/subagent-return/check.mjs
  - hooks/hooks.json
  - tests/subagent-return.test.mjs
  - CHANGELOG.md
- Forbidden Scope: -
- Deliverable: hooks/check-subagent-return.mjs (PostToolUse Agent hook); scripts/lib/subagent-return/check.mjs (pure library: parseThreshold, hasArtifactPath, checkSubagentReturn); hooks/hooks.json (+1 PostToolUse Agent matcher); tests/subagent-return.test.mjs (40 tests, all pass); CHANGELOG.md (FEAT-032 bullet group under v0.5.0). ## Self-Verify Gates | Gate | Exit | Summary | |---|---|---| | npm run lint | 0 | zero warnings | | npm run format:check | 0 | clean after prettier auto-fix | | npm run typecheck | 0 | no implicit-any errors | | node --test tests/subagent-return.test.mjs | 0 | 40/40 pass | | node --test (full suite) | 1* | 202/204 pass; 2 pre-existing WSL bash failures in installer.test.mjs unrelated to SLICE-12 | | node ./scripts/validate-manifests.mjs | 0 | manifests OK | | node ./scripts/validate-skills.mjs | 0 | 12 skills OK | | node ./scripts/validate-slices.mjs | 0 | clean | | node ./scripts/e2e-smoke.mjs | 0 | smoke check passes |
- Changed Files:
  - hooks/check-subagent-return.mjs
  - scripts/lib/subagent-return/check.mjs
  - hooks/hooks.json
  - tests/subagent-return.test.mjs
  - CHANGELOG.md
- Confidence: high
- Risks: 2 pre-existing WSL installer test failures (bootstrap git gate hook tests) unrelated to SLICE-12; they fail because WSL /bin/bash is unavailable in this Windows environment and were failing before this change. Path regex over-matches are intentional (false negatives on warn are safer than false positives per spec). PostToolUse Agent payload body-field order: content > body > string-fallback — real-world field name unverified from live payloads (no PostToolUse payloads found in .claude/logs/payloads/), but spec says to be tolerant.
- Suggested Next Handoff: lead reviews handoff; bundled reviewer pass per FEAT-030; close slice

