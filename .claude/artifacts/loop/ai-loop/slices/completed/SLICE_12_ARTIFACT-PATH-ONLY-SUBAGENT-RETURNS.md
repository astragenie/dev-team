---
id: SLICE-12
feature: FEAT-032
title: Artifact-path-only subagent returns — PostToolUse Agent hook
status: completed
priority: P1
autonomous_safe: true
created: 2026-06-02
completed_at: 2026-06-02
updated: 2026-06-02
github_issue: 44
github_url: "https://github.com/sergeymilashico/hero-crew/issues/44"
---
# SLICE-12: Artifact-path-only subagent returns — PostToolUse Agent hook

- **Priority**: P1
- **Status**: Pending
- **Author**: herolegion
- **Created**: 2026-06-02
- **Parent Feature**: FEAT-032
- **autonomous_safe**: true

## Objective

Add a PostToolUse hook on the `Agent` tool that inspects the subagent's
return body. When the body exceeds a configurable byte threshold AND
contains no `.claude/artifacts/crew/handoffs/*.md` path reference, emit
a soft-warn `systemMessage`. Never blocks. Targets the 34-compaction-
per-slice cost driver caused by subagents inlining multi-KB reports
into the lead's context. Default threshold 512 bytes; opt-out via
`CREW_SUBAGENT_INLINE_THRESHOLD=0`.

## Why now

- SLICE-08 cost report: 34 compactions, 49 subagent dispatches per
  slice. Each compaction re-derives the lead's full context. Inlined
  subagent reports are the largest avoidable contributor.
- Cost-discipline rule #2 (`feedback_cost_discipline.md`) already
  states the policy: subagents write reports to
  `.claude/artifacts/crew/handoffs/` and return only the absolute path.
- FEAT-030 (SLICE-11, just shipped) already added the policy to
  builder.md and reviewer.md prompts; this slice adds the
  *enforcement signal* via a soft-warn hook so the lead notices when
  a subagent violates the rule.
- Pairs with FEAT-030 for combined subagent + compaction reduction.
  No conflict with FEAT-033 preflight hook (different tool matchers).

## In scope

1. **`hooks/check-subagent-return.mjs`** (new) — PostToolUse hook on
   the `Agent` tool. Mirror `hooks/check-redundant-read.mjs` pattern:
   - read JSON from stdin (`session_id`, `cwd`, `tool_name`,
     `tool_response`)
   - env-var gate: `if (process.env.CREW_SUBAGENT_INLINE_THRESHOLD === "0") process.exit(0);`
     (default-ON; only "0" disables)
   - delegate detection logic to a pure check library
   - if violation detected, emit
     `{ decision: "approve", systemMessage: "<warn>" }` on stdout
   - NEVER `decision: "block"`
   - main wrapped in try/catch; exit 0 silently on any error
   - best-effort log to `.claude/logs/events.jsonl` with event prefix
     `subagent-return:`

2. **`scripts/lib/subagent-return/check.mjs`** (new) — pure check
   library. Export:
   - `parseThreshold(envValue, defaultBytes)` — return numeric byte
     threshold; default 512; `"0"` means disabled
   - `hasArtifactPath(body)` — regex-search for
     `.claude/artifacts/crew/handoffs/[^\s)]+\.md` (path token, not
     just substring)
   - `checkSubagentReturn({ body, threshold })` —
     returns `{ warnings: string[] }`. Logic:
     - body length ≤ threshold → no warn
     - body length > threshold AND `hasArtifactPath(body)` → no warn
     - body length > threshold AND no artifact path → one warn
       `"subagent return body is <N> bytes with no handoff artifact
       path; write the report to
       .claude/artifacts/crew/handoffs/ and return only the path
       (cost-discipline rule #2)"`

3. **`hooks/hooks.json`** — add ONE new PostToolUse matcher entry:
   ```
   { "matcher": "Agent",
     "hooks": [{ "type": "command",
                 "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/check-subagent-return.mjs\"" }] }
   ```
   Place AFTER the existing PostToolUse Read matcher. Do not modify
   existing matchers.

4. **`tests/subagent-return.test.mjs`** (new) — node-test suite.
   Mirror `tests/preflight-shell.test.mjs` pattern (spawn hook with
   stdin, assert stdout shape). Cover:
   - body ≤ threshold → silent
   - body > threshold + artifact path present → silent
   - body > threshold + no artifact path → warn with byte count + cost-
     discipline rule mention
   - `CREW_SUBAGENT_INLINE_THRESHOLD=0` → short-circuit (silent always)
   - `CREW_SUBAGENT_INLINE_THRESHOLD=2048` → respects custom threshold
   - malformed JSON on stdin → silent
   - missing `tool_response` → silent
   - artifact path inside JSON-quoted string → still detected (regex
     handles `"....handoffs/<file>.md"` form)
   - Windows-style path separator (`.claude\artifacts\crew\handoffs\`)
     ALSO detected (since the cost-discipline rule applies cross-platform
     — be lenient with the path regex)

5. **`CHANGELOG.md`** — append under the existing v0.5.0 section
   (FEAT-030). Add a FEAT-032 bullet group describing the new hook +
   env-var opt-out + threshold default.

## Out of scope

- Editing `agents/builder.md`, `agents/reviewer.md`, `agents/validator.md`,
  `agents/deployer.md`, `agents/researcher.md`. FEAT-030 already wired
  the policy into the prompts (handoff-write-then-return-path). This
  slice adds the soft-warn enforcement signal; it does NOT re-state the
  policy in prompts.
- Editing `hooks/preflight-shell.mjs`, `hooks/check-redundant-read.mjs`,
  `hooks/record-read-content.mjs` (FEAT-029, FEAT-033 territory).
- A v0.5.0 release tag — version bump + tag happens in a separate
  `chore(release)` commit after FEAT-034 also lands per the user's
  bundle-FEAT-032+034 plan.
- Modifying the threshold heuristic across multiple slices to optimize
  the warn rate. Ship with 512-byte default; tune via env var
  per-session if needed; tune the default in a follow-up slice if
  data shows it's wrong.
- Adding a `decision: "block"` path. Never blocks.

## Acceptance criteria

Each criterion must be testable per `01-loop-control/EVIDENCE_RULES.md`.

- [ ] AC-1: `hooks/check-subagent-return.mjs` exists and reads stdin
      per the PostToolUse hook contract (`session_id`, `cwd`,
      `tool_name`, `tool_response`). Evidence: file present + tests
      pass.
- [ ] AC-2: `scripts/lib/subagent-return/check.mjs` exports
      `parseThreshold`, `hasArtifactPath`, `checkSubagentReturn` as
      pure functions. Evidence: module shape + tests.
- [ ] AC-3: `hooks/hooks.json` has a new PostToolUse Agent matcher.
      Existing matchers unchanged. Evidence: file diff +
      `validate-manifests` passes.
- [ ] AC-4: Hook emits `{ decision: "approve", systemMessage: "<warn>" }`
      on detected violation, exit 0. Never `decision: "block"`.
      Evidence: stdin/stdout test assertions.
- [ ] AC-5: Opt-out `CREW_SUBAGENT_INLINE_THRESHOLD=0` short-circuits
      (exit 0, no stdout). Evidence: env-set test.
- [ ] AC-6: Default behavior is hook ON with 512-byte threshold; no
      env var required. Evidence: env-unset test confirms hook runs.
- [ ] AC-7: Body ≤ threshold → silent (no warn). Evidence: test with
      a 100-byte body.
- [ ] AC-8: Body > threshold WITH artifact path present → silent.
      Evidence: test with a 1000-byte body containing
      `.claude/artifacts/crew/handoffs/foo.md`.
- [ ] AC-9: Body > threshold WITHOUT artifact path → warn with byte
      count + cost-discipline rule #2 reference. Evidence: test
      with a 1000-byte body lacking the path, assert
      `systemMessage.includes("cost-discipline rule #2")` and a
      number ≥1000.
- [ ] AC-10: Custom threshold `CREW_SUBAGENT_INLINE_THRESHOLD=2048`
      respected (body 1500 + no path → silent; body 2500 + no path →
      warn). Evidence: two tests.
- [ ] AC-11: Hook exception-safe: malformed JSON / missing
      `tool_response` / empty stdin → exit 0 silently. Evidence:
      three tests.
- [ ] AC-12: Path detection regex matches both POSIX and Windows
      separators (`.claude/artifacts/crew/handoffs/` and
      `.claude\artifacts\crew\handoffs\`). Evidence: two assertions.
- [ ] AC-13: All 8 CI gates green (lint / format / typecheck / tests /
      validate-manifests / validate-skills / validate-slices /
      e2e-smoke). Evidence: builder Self-Verify Gates section in
      handoff body (new FEAT-030 rule).
- [ ] AC-14: `CHANGELOG.md` v0.5.0 section gets a FEAT-032 bullet
      group describing the new hook + env-var + default threshold.
      Evidence: file diff.

## Done When

- all acceptance criteria PASS with evidence
- build + test pass per `.claude/loop.json` `stack.build` / `stack.test`
- Crew `review-result` artifact written with `Test Adequacy` populated
  AND `Validation Evidence` section populated (this slice is the second
  canonical use of the FEAT-030 path: code-only, tests-already-green,
  no user-visible runtime change beyond the additive hook itself)
- Crew `final-synthesis` artifact written
- this slice file moved from `slices/pending/` → `slices/completed/`
- FEAT-032 moves from `docs/backlog/in-progress/` to `docs/backlog/done/`

## Reviewer ladder

- Reviewer A (bundled): code review + behavior validation. Per FEAT-030
  rule: since the diff is code-only + tests-green + the hook itself is
  an additive plugin internal (no user-visible runtime surface beyond
  what the hooks/hooks.json matcher exposes), the reviewer SHOULD
  populate `--validation-evidence` on the review-result and the lead
  SHOULD skip `crew:validator` dispatch.

## Risks

- **Path regex over-matches** — `.claude/artifacts/crew/handoffs/foo.md`
  embedded in a code block or quoted string still triggers the
  "has artifact path" exit. That's fine (false negatives on the warn
  are safer than false positives — better to under-warn than nag).
- **Body-length measurement** — measure UTF-8 byte length via
  `Buffer.byteLength(body, "utf8")`, not `body.length` (which counts
  UTF-16 code units). Common subagent reports include emoji + box-
  drawing characters that inflate byte length vs char length.
- **Threshold-edge churn** — 512 bytes is small; many legitimate one-
  line summaries with rich text approach it. Mitigation: combine with
  the artifact-path detector so well-disciplined subagents (already
  the FEAT-030 norm) silence the warn regardless of size.
- **`tool_response` shape** — Claude Code's exact shape for PostToolUse
  on the `Agent` tool is not documented in this repo. Builder MUST
  start by inspecting a real `Agent` PostToolUse payload from
  `.claude/logs/payloads/` (any prior subagent dispatch artifact)
  before locking the parseInput contract.

## Open questions

- Is the subagent's report body in `tool_response.content`,
  `tool_response.body`, `tool_response`, or somewhere else? Builder
  investigates `.claude/logs/payloads/` first.
- Should the warn include the suggested handoff path
  (`.claude/artifacts/crew/handoffs/<ts>-...`)? Default: yes — the
  full path makes the fix obvious. Builder uses a templated string.
- Should we count `.claude/artifacts/crew/reviews/<file>.md` or
  `.claude/artifacts/crew/validations/<file>.md` as "has artifact
  path" too? Default: YES — any `.claude/artifacts/crew/*/...md` is
  a valid persistent artifact reference. Broaden the regex.
