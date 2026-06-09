# Lead — repo-local override (hero-crew)

Read after the framework baseline lead instructions. Repo rules win on conflict.

## Reviewer agent dispatch (disambiguation)

When running `/crew:review` or otherwise dispatching the review-phase agent for code-bearing work in this repo:

- Dispatch **`crew:reviewer`** by its **exact name**. Always.
- Do **not** dispatch any other agent whose description claims trigger phrases like "review this PR", "review my diff", or "audit this file". Specifically: `code-reviewer`, generic project review agents, etc.

### Why

Multiple installed plugins ship review-flavored agents. Some declare broad trigger phrases in their description ("review this PR", "review my diff") that match the Crew review phase exactly. A skill-priority router that picks the agent with the closest description match will route the Crew review gate to the wrong agent.

`crew:reviewer` is the only agent that:

- honors the Crew review-artifact contract (`write-review-result` JSON shape, gates, standards-checked list);
- reads `agents/reviewer.md` policy (TDD gate, plugin-/skill-shape reviewer skills, repo + global override files);
- writes the artifact under `.claude/artifacts/crew/reviews/`.

Generic review agents return one-line findings only and do not produce a Crew review artifact. They are useful for ad-hoc spot-checks **outside** `/crew:review` — never as the Crew review-phase gate.

### Pattern to apply

When the user says "review this", "review the PR", "/crew:review", or otherwise enters the review phase, dispatch with subagent_type literally:

```
crew:reviewer
```

Cite this override in the review-result artifact under "configured review skills consulted" so the user can see the disambiguation was honored.

### History

The original collision source (`caveman:cavecrew-reviewer`, shipped from this repo's `agents/caveman/`) was removed 2026-06-10; its locator sibling was promoted to `agents/investigator.md`. The exact-name rule stays as durable defense against other installed plugins' review-flavored agents. Origin: FEAT-016 / FEAT-017 ship discovery.

## Shell pre-check

Before any chained Bash with `cd` / path-touching commands, verify with `pwd` (POSIX) or `Get-Location` + `Test-Path` (PowerShell). On Windows, prefer the PowerShell tool for cmdlet operations and reserve Bash for POSIX-style scripts. Use `$env:NAME` in PS, `$NAME` in bash. Quote paths with spaces.

## Waiting on external state (CI runs, deploys, remote queues)

The harness blocks foreground sleeps (`Start-Sleep`, `sleep N`) chained before a check — they freeze the session lane. Do not chain shorter sleeps to work around the block. Instead:

- **One notification when done** (CI run finishes, deploy completes) → run the blocking command via `run_in_background: true`, e.g. `gh run watch <id> --exit-status`. The harness notifies on exit.
- **Repeated events / polling** → the `Monitor` tool with an until-loop (`until <check>; do sleep 2; done` — Monitor runs bash and owns its sleeps).
- **Instant check, no wait** → just run the status query directly (`gh run view <id> --json status,conclusion`) without a leading sleep.

Caveat on `gh run watch | Select-Object -Last N`: the pipeline's exit code is Select-Object's, not gh's — don't infer pass/fail from it; confirm with `gh run view --json conclusion`. Advisory `continue-on-error` steps print ✗ annotations while the run still concludes `success`.

## Shell cheatsheet (PS vs bash)

| Operation       | PowerShell               | Bash                     |
| --------------- | ------------------------ | ------------------------ |
| Env var read    | `$env:NAME`              | `$NAME`                  |
| Env var set     | `$env:NAME = 'val'`      | `export NAME=val`        |
| List files      | `Get-ChildItem`          | `ls`                     |
| Current dir     | `Get-Location`           | `pwd`                    |
| File exists     | `Test-Path path`         | `[ -f path ]`            |
| Path with space | `"C:\Program Files\..."` | `"/path with space/..."` |
