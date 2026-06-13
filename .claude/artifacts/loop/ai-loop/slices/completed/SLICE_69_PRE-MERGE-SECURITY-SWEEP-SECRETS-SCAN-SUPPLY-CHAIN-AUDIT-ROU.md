---
id: SLICE-69
title: Pre-merge security sweep — secrets scan + supply-chain audit routing
status: completed
feature: FEAT-140
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-11
updated: 2026-06-13
developer_type: mixed
estimated_complexity: medium
languages: [markdown, typescript]
autonomous_safe: false
completed_at: 2026-06-13
badges: [serial-reviewer-warning]
---
# SLICE-69: Pre-merge security sweep — secrets scan + supply-chain audit routing

Implements **all 3** deliverables from FEAT-140. See [feature file](../../../../backlog/in-progress/FEAT-140.md) for product context.

`autonomous_safe: false` per FEAT-140 frontmatter — security domain + skill+agent prompt authorship require human-in-loop review before merge. The skill authorship + routing-table rows + test fixture are agent-appropriate; the `agents/inspector.md` prompt edit (trigger condition + evidence expectation) needs the human gate.

## Objective

Lift the security grade dimension (avg 0.77, below the 0.80 bar) by promoting the inspector's existing _manual_ secrets-grep + CVE-audit pre-flight (`agents/inspector.md` lines 103-104) into a structured, evidence-bearing security-sweep skill invocation that:

1. Reports findings as `[SEVERITY] file:line — description` blocks matching the inspector's existing Finding format (lines 154-160).
2. Emits one observable structured-log entry per scan invocation so the loop can grade `observability` independently of `security`.
3. Auto-fires on `dependency/lockfile` diffs and `auth-touching` diffs, not only when a human thinks to ask for `/cso`.

## In scope

### Deliverable 1 — New domain skill `skills/domain/security-sweep/SKILL.md`

- File path: `skills/domain/security-sweep/SKILL.md` (directory name must equal frontmatter `name: security-sweep` per `scripts/validate-skills.ts:checkDirectoryName`).
- Tier: `domain`. Required frontmatter: `name`, `tier`, `description`. Recommended: `owner`, `last_reviewed: 2026-06-13`, `triggers: secrets, supply chain, dependency audit, lockfile, npm audit, pip-audit, cargo audit, govulncheck, dependency confusion, typosquatting`.
- Body MUST include `## When to use` (or `## Trigger`) heading AND `## Done` (or `## Acceptance` / `## Stop when`) heading per validator's `checkSectionHeadings` warnings.
- ≤ 200 lines hard cap per `scripts/validate-skills.ts:MAX_LINES`.
- Required sections:
  1. **When to use** — auth-touching diff, dependency/lockfile change, CI-workflow change.
  2. **Secrets scan procedure** — pattern set (API keys, DB creds, certs, tokens, config leaks); scoped to `git diff --name-only "$SLICE_BASE"`; emits `[SEVERITY] file:line — short description` per finding.
  3. **Supply-chain audit procedure** — ecosystem detection (`package.json` → `bun audit`; `requirements.txt`/`pyproject.toml` → `pip-audit`; `Cargo.toml` → `cargo audit`; `go.mod` → `govulncheck`; `*.csproj` → `dotnet list package --vulnerable`); lockfile integrity; install-script/hook scan; typosquatting + dependency-confusion checks.
  4. **Severity tiering** — `CRITICAL` (active leak, RCE-capable CVE, install hook to attacker-controlled host) · `HIGH` (high-severity CVE, lockfile drift on direct dep) · `MEDIUM` (medium CVE on transitive, license drift) · `LOW` (advisory, outdated but not vulnerable).
  5. **Remediation commands** — one ecosystem-native command per finding (`bun update <pkg>@<safe-version>`, `pip install --upgrade <pkg>==<safe-version>`, `cargo update -p <pkg>`).
  6. **Observability emit** — ONE stderr line per scan invocation in the form `SECURITY-SWEEP scan complete: <N> findings (C=<n> H=<n> M=<n> L=<n>)`. Plugin context: no JSON schema, no ULID, no events.jsonl wiring — single grep-able line is sufficient.
  7. **Done / Acceptance** — exit conditions: zero `CRITICAL` findings unmerged, every `HIGH` finding either fixed or carries an accepted-risk note in the review-result `--risks` field.

### Deliverable 2 — Two new routing-table rows in `docs/routing-table.md`

Both go under the **Review + quality gates** section table (the section between lines 35-50 in the current file). Format must match the existing 3-column `| Signal | Route to | Notes |` shape used in that section.

- **Row A — Signal:** `**Dependency / lockfile change** (diff touches `package.json`, `bun.lock`, `requirements.txt`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.csproj`)` · **Route to:** `inspector via **\`skills/domain/security-sweep/\`**` · **Notes:** `Inspector loads security-sweep alongside the existing per-language reviewer. Pre-flight CVE audit (inspector.md lines 103-104) is replaced by the structured procedure in the skill — same commands, but findings emitted as \`[SEVERITY] file:line\` blocks and counted in the review-result \`--findings\` count.`
- **Row B — Signal:** `**Auth-touching diff** (diff touches files matching \`(auth|login|signin|signup|jwt|oauth|session|token|password|crypto|secret|credential)\`, or path under \`*/auth/*\`, \`*/security/*\`)` · **Route to:** `inspector via **\`skills/domain/security-sweep/\`** + **\`skills/domain/security-advisory/\`**` · **Notes:** `Co-load with security-advisory for OWASP / threat-model context. Secrets-scan pattern set in security-sweep runs file:line emission on the diff; security-advisory handles OWASP-shape questions. Replaces the implicit "remember to invoke /cso" path with an auto-trigger.`

Both rows must pass the routing-table lint already in CI (`CREW_VALIDATE_ROUTING_TABLE=1 node ./scripts/validate-routing-table.ts`). Existing "Security-sensitive change" row at line 48 stays — security-sweep complements it, does not replace it.

### Deliverable 3 — Inspector prompt edit in `agents/inspector.md`

- Add ONE row to the skill-consultation table (currently at lines 78-89): `| Dependency/lockfile change OR auth-touching diff | \`skills/domain/security-sweep/\` (auto-fires on the routing-table triggers; emits observability log per scan) |`.
- Update line 103 (`Hardcoded secrets`) and line 104 (`Dependency CVE audit`) pre-flight bullets to add: `When security-sweep is loaded, this pre-flight is the entry point to its procedure — emit findings via the skill's \`[SEVERITY] file:line\` format and increment the review-result \`--findings\` counters.`
- Add ONE sentence to the **Review artifact** section (around line 220-244) listing the evidence expectation: `For security-sweep invocations, \`--evidence\` MUST include the scan-end log line's \`{scanId, durationMs, findingsBySeverity}\` JSON object inline, and \`--findings\` MUST reflect security-sweep severity counts merged with other gate findings.`
- Stay under `agents/inspector.md` frontmatter `maxLines: 330` cap (file is currently 329 lines — budget is +1 net after the changes above; restructure existing prose if needed). Validator: `scripts/validate-agents.ts`.

### Deliverable 4 (test asset, in-scope per triage-notes Test Gap) — Planted-secret fixture

- Path: `tests/fixtures/security-sweep/planted-secret.txt` (one file, one literal fake secret matching the skill's pattern set, e.g. `AWS_SECRET_ACCESS_KEY="AKIAIOSFODNN7EXAMPLEFAKE0000000000"`).
- Path: `tests/security-sweep-integration.test.ts` — Bun test that:
  1. Stages the fixture under a temp git worktree.
  2. Invokes `bun skills/domain/security-sweep/scripts/scan.ts --diff-base HEAD --target <tmp>` (the canonical entry from Deliverable 5).
  3. Asserts stdout contains exactly one `[CRITICAL]` finding with the fixture file path + line `1`.
  4. Asserts the stderr stream contains exactly one line matching `/^SECURITY-SWEEP scan complete: 1 findings \(C=1 H=0 M=0 L=0\)$/`.

### Deliverable 5 — Bun helper script `skills/domain/security-sweep/scripts/scan.ts`

Canonical entry point that SKILL.md points at. Owns the executable behavior so test + skill prose share one source of truth (avoids the `security-advisory/SKILL.md` orphan-script anti-pattern).

- Path: `skills/domain/security-sweep/scripts/scan.ts` (Bun + TypeScript per repo standard).
- CLI surface: `bun scan.ts --diff-base <ref> [--target <path>]`. No interactive prompts. No network calls beyond what `bun audit` / `pip-audit` / etc. already do.
- Responsibilities:
  1. Resolve diff via `git diff --name-only <ref>` (tolerate unset `$SLICE_BASE` — fall back to `HEAD~1`).
  2. Apply the secrets-pattern set to each diff line; emit one `[SEVERITY] file:line — description` block per finding to stdout.
  3. Detect ecosystem from manifest paths (`package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `*.csproj`); invoke the ecosystem-native audit; merge severity-tiered findings into stdout.
  4. Emit exactly ONE stderr line at scan end: `SECURITY-SWEEP scan complete: <N> findings (C=<n> H=<n> M=<n> L=<n>)`.
  5. Exit code: `0` if zero CRITICAL findings, `1` if any CRITICAL, `2` if scan itself failed (e.g. audit tool missing).
- Hard cap: ≤ 200 lines TS. No `any` casts, no floating promises (Bun test runner + typescript-reviewer lens). One file — no submodule split unless code grows past the cap.
- SKILL.md MUST cite this script as the canonical entry, not just "you can also write one yourself".

### Observability emit shape (used by Deliverables 1 + 4)

Plugin observability ceiling is low — no runtime, no log pipeline. Single grep-able stderr line per scan:

```
SECURITY-SWEEP scan complete: <N> findings (C=<n> H=<n> M=<n> L=<n>)
```

No JSON, no ULID, no timestamps — those are service concerns, not plugin concerns.

## Out of scope

- Live CVE-database fetches at scan time beyond what `bun audit` / `pip-audit` / `cargo audit` / `govulncheck` already query — no new HTTP clients, no new API keys.
- Runtime hooks (`hooks/` directory) — security-sweep is invoked by the inspector at review time, not by a hook on every tool call.
- Signing infrastructure (SLSA, Sigstore, code-signing key management) — separate FEAT if needed.
- A new `skills/domain/observability/` skill — that is FEAT-141 SLICE-B territory. Observability here is the single structured-log line per scan, not a generic emit-helper.
- Replacing or removing the existing `skills/domain/security-advisory/` skill — security-sweep is the auto-fire scan procedure; security-advisory remains the OWASP / threat-model knowledge base.
- Replacing the `/cso` gstack invocation row in `docs/routing-table.md` line 48 — that row stays for explicit "deep audit" requests; security-sweep handles the auto-fire pre-merge sweep.
- Any change to `validator.md` / `agents/verifier.md` — verifier still runs the full gate; security-sweep is an inspector concern.
- False-positive tuning beyond the v1 pattern set — accepted risk per triage-notes pre-mortem (1). Tuning lands in a follow-up SLICE if the first week of usage shows the dial is wrong.

## Acceptance criteria

- [ ] AC-1: **Skill file + helper script exist and validate.** Given the repo at HEAD, When `node ./scripts/validate-skills.ts` runs, Then exit code is `0` AND stdout includes the line `Skills OK: N skill(s) checked.` where N is one greater than the count before the slice. Pass-fail: `test -f skills/domain/security-sweep/SKILL.md && test -f skills/domain/security-sweep/scripts/scan.ts && [ $(wc -l < skills/domain/security-sweep/SKILL.md) -le 200 ] && [ $(wc -l < skills/domain/security-sweep/scripts/scan.ts) -le 200 ] && node ./scripts/validate-skills.ts; echo $?` returns `0`.
- [ ] AC-2: **Skill frontmatter shape.** Given `skills/domain/security-sweep/SKILL.md`, When parsed as YAML frontmatter, Then `name == "security-sweep"`, `tier == "domain"`, `description` non-empty, `triggers` field contains at minimum the strings `secrets`, `supply chain`, `dependency audit`. Pass-fail: `grep -E "^name: security-sweep$" skills/domain/security-sweep/SKILL.md` returns 1 match AND `grep -E "^tier: domain$"` returns 1 match AND `grep -E "^triggers:.*secrets.*supply chain.*dependency audit"` matches in any order.
- [ ] AC-3: **Routing rows added with concrete trigger phrase + skill name + path.** Given `docs/routing-table.md`, When grepped, Then both new signal phrases are present AND both reference the skill by relative path. Pass-fail: `grep -c "Dependency / lockfile change" docs/routing-table.md` ≥ 1 AND `grep -c "Auth-touching diff" docs/routing-table.md` ≥ 1 AND `grep -c "skills/domain/security-sweep/" docs/routing-table.md` ≥ 2 AND `CREW_VALIDATE_ROUTING_TABLE=1 node ./scripts/validate-routing-table.ts` exits 0.
- [ ] AC-4: **Inspector prompt mentions trigger conditions + evidence expectation and validates.** Given `agents/inspector.md`, When grepped, Then it cites the new skill, the auto-fire trigger, AND the evidence expectation. Pass-fail: `grep -c "skills/domain/security-sweep/" agents/inspector.md` ≥ 1 AND `grep -c "scanId" agents/inspector.md` ≥ 1 AND `[ $(wc -l < agents/inspector.md) -le 330 ]` AND `node ./scripts/validate-agents.ts` exits 0.
- [ ] AC-5: **Integration smoke — planted fake-secret fixture caught with file:line.** Given the fixture at `tests/fixtures/security-sweep/planted-secret.txt` containing the literal `AKIAIOSFODNN7EXAMPLEFAKE0000000000`, When `bun test tests/security-sweep-integration.test.ts --parallel --timeout 30000` runs, Then exit code is `0` AND test assertion confirms the scan output contains exactly one `[CRITICAL]` finding referencing `tests/fixtures/security-sweep/planted-secret.txt:1`. Pass-fail: `bun test tests/security-sweep-integration.test.ts; echo $?` returns `0`.
- [ ] AC-6: **Observability — one grep-able stderr line per scan invocation.** Given the integration test in AC-5, When the scan completes, Then exactly one line is emitted to stderr matching `/^SECURITY-SWEEP scan complete: \d+ findings \(C=\d+ H=\d+ M=\d+ L=\d+\)$/`. Plugin context: no JSON, no timestamps, no event-stream wiring. Pass-fail: the integration test asserts `stderr.split("\n").filter(l => /^SECURITY-SWEEP scan complete:/.test(l)).length === 1`.
- [ ] AC-7: **Severity-tiered findings with ecosystem-native remediation in the skill body.** Given `skills/domain/security-sweep/SKILL.md`, When read, Then all four severity tiers are defined AND each ecosystem (`npm`, `pip`, `cargo`, `go`, `dotnet`) has at least one remediation command example. Pass-fail: `grep -cE "^(- )?\*\*(CRITICAL|HIGH|MEDIUM|LOW)\*\*" skills/domain/security-sweep/SKILL.md` ≥ 4 AND `grep -cE "bun audit|pip-audit|cargo audit|govulncheck|dotnet list package --vulnerable" skills/domain/security-sweep/SKILL.md` ≥ 5.
- [ ] AC-8: **Full local gate green — no regressions in unrelated suites.** Given the post-slice tree, When `bun run lint && bun run format:check && bun run typecheck && bun test --parallel --timeout 30000` runs, Then exit code is `0`. Pass-fail: the chained command returns `0`.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass (`bun test --parallel`, `bun run lint`, `node ./scripts/validate-manifests.ts`, `node ./scripts/validate-skills.ts`)
- feature FEAT-140 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- `requires_validation: true` retained — the integration smoke (AC-5/AC-6) is behavior verification and must be executed by the verifier independently of the inspector pre-flight; do NOT waive

## Reviewer ladder

- **Reviewer A (`crew:inspector`):** correctness + regression focus. Does the skill body match the existing inspector pre-flight commands (lines 103-104) so the manual path stays a valid fallback? Do the routing-table rows fire only on the intended diff shapes (no false positives on, e.g., `docs/auth-flow.md`)? Does the inspector prompt edit keep the file under the 330-line `maxLines` cap? Is the stderr observability line grep-able and bounded (no PII, no full file paths beyond the diff scope)? Skills to consult per the inspector's own table: `skills/workflow/reviewing-code/`, `skills/domain/security-advisory/` (concern:security), `plugin-dev:skill-reviewer` (skill shape changed).
- **Reviewer B (`crew:3rdparty:typescript-reviewer`):** TypeScript + supply-chain hygiene + banned-libraries lens. Review `skills/domain/security-sweep/scripts/scan.ts` (Deliverable 5) for: no `any` casts, no floating Promises, exhaustive switch on ecosystems, exit codes match the AC, stderr emit is exactly one line. Verify the supply-chain audit procedure in Deliverable 1 covers the same ground as `skills/domain/typescript/ts-conventions/`'s supply-chain section AND does not contradict it. Verify the integration test in Deliverable 4 uses `bun test` (not `node:test`) per repo convention. Flag if the skill body or scan.ts recommends an npm/yarn command — repo standard is `bun`.
