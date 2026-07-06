---
findings: "🔴:0,🟡:3,❓:0"
status: completed
decision: approved_with_notes
---
# Review Result: Review Result

- Created: 2026-07-06T21:36:19.218Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Status: completed
- Summary: FEAT-188 S4 astramemProvider approved with notes; the merge-blocker question is resolved -- npm ci and bun install are CI-clean both with and without SSH (verified by reproduction), pinned commit e851f19c has the #23 exports map, provider wiring/dual-write/fallback logic is correct and covered by a fake-daemon test harness, and all claimed gates (8/8, 64/64, typecheck, lint, format) reproduce clean.
- Evidence Checked:
  - Reproduced npm ci (exit 0
  - ~2m21s warm / ~3m cold) and bun install (exit 0
  - ~68s) from a clean node_modules with GIT_SSH_COMMAND=false
  - GIT_SSH=false
  - and SSH_AUTH_SOCK unset -- both installs succeeded because npm/bun resolve GitHub-hosted git deps via the anonymous HTTPS codeload.github.com tarball endpoint (confirmed in verbose logs: 'npm http fetch GET 200 https://codeload.github.com/astragenie/astramem-plugin/tar.gz/e851f19...')
  - independent of the ssh:// protocol recorded in package-lock.json resolved field. node_modules/@astragenie/astramem-plugin/package.json confirms exports map {.
  - ./providers/local
  - ./providers/saas
  - ./contracts} and version 0.6.0 at the pinned SHA. bun test --timeout 30000 tests/memory-provider-astramem.test.ts = 8 pass/0 fail; memory cluster (7 memory-*.test.ts files + dispatch.memory-hint.test.ts) = 64 pass/0 fail; bun run typecheck clean; bun run lint clean (192 files); bun run format:check clean (374 files). Verified MemoryProvider/IngestPayload/RecallHit contract shapes against node_modules source match astramem-provider.ts usage exactly (remember/recall/health signatures
  - IngestPayloadSchema/RecallHitSchema fields). Two paired tests spin up a real http.Server fake daemon (GET /health
  - POST /remember) and assert dualWrite:true mirrors to local JSONL while dualWrite:false does not; unpaired tests point MEMORY_API_URL_LOCAL at an unreachable port. Cross-checked FEAT-188 backlog file S4 ACs -- no S5 (decay/drift-detection/SIGKILL golden test) content present in the diff.
- Files Reviewed:
  - package.json
  - package-lock.json
  - bun.lock
  - scripts/lib/memory/astramem-provider.ts (new
  - 297 lines)
  - scripts/lib/memory/resolve-provider.ts
  - scripts/lib/memory/index.ts
  - tests/memory-provider-astramem.test.ts (new
  - 335 lines)
- Test Adequacy: 8/8 astramem-provider tests + 64/64 memory-cluster tests reproduced green; paired-daemon (fake HTTP server) and unpaired-fallback branches both exercised with real network calls, not mocks -- adequate coverage for S4 AC scope.
- Risks: MEDIUM: package-lock.json 'resolved' field records git+ssh://git@github.com/... for the astramem-plugin dep while package.json declares git+https://... -- almost certainly produced by an insteadOf git rewrite on the machine that generated the lockfile. Verified harmless against npm/GitHub today (tarball-fallback resolution ignores the recorded protocol) but would behave differently against a private registry proxy or an npm mirror that lacks GitHub's hosted-git shortcut -- recommend regenerating package-lock.json in a clean environment (no url.insteadOf rewrites) before merge, or documenting the discrepancy. LOW: package-lock.json diff carries ~1400 lines of incidental version churn on unrelated floating-semver deps (aws-sdk client-bedrock-runtime, several @opentelemetry/* packages) beyond the new astramem entry -- expected npm-install noise given package.json's existing ^-ranges, not a defect, but inflates the reviewable diff. LOW: astramem-provider.ts:137 probeSaas() presence-check only inspects MEMORY_API_URL_SAAS/MEMORY_API_URL, omitting the ASTRAMEMORY_API_URL alias astramem-plugin's own env-specs.ts also treats as SaaS-capable -- a narrow false-negative pairing-detection gap if an operator sets only that alias. LOW (informational, not a defect): the dynamic import() -> Promise<any> workaround for providers/local.ts and providers/saas.ts is well-justified and runtime-verified by the fake-daemon tests, but the 'as LocalProviderModule/SaasProviderModule' casts are not compiler-enforced -- a future astramem-plugin signature change would only surface as a runtime failure, not a type error.
- Required Follow-up: Before merge: regenerate package-lock.json in a clean shell (unset any git url.insteadOf rewrites) and confirm the resolved field switches to https, OR add a one-line comment in package.json/README noting the ssh resolved field is a harmless artifact. Optional follow-up (non-blocking): extend probeSaas()'s presence check to include ASTRAMEMORY_API_URL, or note the gap as accepted scope for S4. No other action required -- CI-cleanliness, exports-map pinning, and provider correctness are all confirmed.

