# Task Handoff: SLICE-10 review complete — rejected (PS false positives)

- Created: 2026-06-02T12:13:34.741Z
- From: reviewer
- To: lead
- Objective: SLICE-10 preflight-shell hook rejected: hook structure, exception safety, and test suite are sound, but the PowerShell env-var regex produces critical false positives on $_, $LASTEXITCODE, $NULL/$TRUE/$FALSE, $HOME, and partial matches on $PSVersionTable/$PSScriptRoot — common automatic variables that appear in normal PowerShell commands.
- Allowed Scope:
  - Code review of hooks/preflight-shell.mjs
  - scripts/lib/preflight/checks.mjs
  - hooks/hooks.json
  - tests/preflight-shell.test.mjs
  - CHANGELOG.md; bundled Reviewer B (behavior/integration) per cost-discipline rule #3
- Forbidden Scope: -
- Deliverable: Review result artifact at .claude/artifacts/crew/reviews/20260602T121322Z-review-result-slice-10-preflight-shell-hook-code-behavior-review.md; decision: rejected; 4 required follow-up items for builder fix pass
- Changed Files:
  - .claude/artifacts/crew/reviews/20260602T121322Z-review-result-slice-10-preflight-shell-hook-code-behavior-review.md
- Confidence: high
- Risks: If the PS regex is shipped as-is, hook warnings will fire on routine PowerShell pipeline patterns ($_ in ForEach-Object) and common built-ins, training the agent to ignore preflight warnings.
- Suggested Next Handoff: Route back to builder: fix PowerShell automatic-variable exclusions in checkEnvVarShape, add regression tests for $_/$LASTEXITCODE/$NULL/$TRUE/$FALSE, fix CHANGELOG test count, clean up AC-12c assert. Then re-review.

