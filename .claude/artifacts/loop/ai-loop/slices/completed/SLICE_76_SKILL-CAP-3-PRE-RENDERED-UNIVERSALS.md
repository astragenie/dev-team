---
id: SLICE-76
title: Pre-rendered universals render script + hash gate + verifier pilot inject
status: completed
feature: FEAT-153
phase: null
priority: P2
target_release: null
requires_validation: true
developer_type: agent
estimated_complexity: medium
autonomous_safe: false
created: 2026-06-13
updated: 2026-06-13
completed_at: 2026-06-13
badges: [serial-reviewer-warning]
---
# SLICE-76: Pre-rendered universals render script + hash gate + verifier pilot inject

Implements FEAT-153 Part 2. See [feature file](../../../backlog/in-progress/FEAT-153.md) for product context. Part 1 (skill cap = 3 in all primary agent prompts) **already shipped** per FEAT-153 body — do NOT touch that surface.

## Objective

Ship the `scripts/render-universal-skills.ts` build-time CLI that emits a deterministic ≤35-line "essentials" block extracted from three external universal skills (`superpowers:using-superpowers`, `superpowers:verification-before-completion`, `loop:loop-discipline`), inlines that block into ONE pilot agent prompt under a hash-marked anchor, and wires a hash-drift gate into `scripts/validate-agents.ts` so CI fails when the source skills change without re-rendering. The remaining 16 agent injections land in a follow-up slice (multi-doc fan-out) once the marker/render contract proves out under the gate. Pilot agent: **`agents/verifier.md`** (303 / 350 lines = 47 lines of headroom under its default cap — only agent in the frequently-dispatched gate role with comfortable room for a 35-line block).

## Scope decision (Option B — Recommended)

Of the two options the spec writer evaluated:

- **Option A** (full fan-out): render script + hash gate + inject all 17 primary agents in one slice. Diff size: ~600 LOC + 17 prompt edits. Risk: builder cutoff in the middle of multi-doc fan-out (pattern observed in SLICE-69 fix bundle, SLICE-74, SLICE-75). Inspector + verifier review surface becomes 17 file conformance checks.
- **Option B** (pilot + follow-up — this slice): render script + hash gate + inject ONE pilot. Diff size: ~250 LOC + 1 prompt edit. Builder ships clean. Marker contract + idempotency + drift gate prove out before the wide fan-out. Follow-up slice mechanically applies the same `--inject` invocation to the remaining 16 agents.

**Choice: Option B.** Justification: three consecutive SLICE-cutoff incidents make the 17-prompt diff a measurable risk. Option B preserves architectural payoff (a render contract + hash gate working end-to-end) while keeping the diff inside the cutoff-safe envelope. Follow-up slice id and AC are sketched under "Follow-up scope (separate slice)" below.

## In scope

### 1. New file: `scripts/render-universal-skills.ts` (Bun TS CLI, ≤200 lines)

Bun TS CLI following the `skills/workflow/test-quality/scripts/analyze.ts` style anchor (DEC-027 default-mode pattern, narrow `unknown`, no `process.exit` from library functions, `await main().catch()` at module bottom).

**Exports (importable):**

- `renderUniversals(opts: { sources: SourcePaths }): { body: string; hash: string }`
  - `SourcePaths = { usingSuperpowers: string; verificationBeforeCompletion: string; loopDiscipline: string }` (absolute paths to three SKILL.md files)
  - `body`: ≤ 35 lines of Markdown, deterministic across runs given identical sources.
  - `hash`: SHA-256 hex digest (lowercase, 64 chars) computed over the canonical concatenation of source contents joined by `"\n---SKILL-BOUNDARY---\n"` (excludes the `body` itself — hash represents the source-of-truth, not the rendered output).
- `checkUniversalsHash(agentPath: string, expectedHash: string): { drift: boolean; expected: string; found: string | null }`
  - `drift = true` when no marker found OR `found !== expected`.
  - `found = null` when the agent file has no marker block at all (treated as drift).

**CLI flags:**

| Flag | Behavior | Side effects |
|---|---|---|
| `--check <glob>` | DEFAULT mode (DEC-027 principle: safest invocation is default). For each agent matching the glob, print one stderr line per drifted file: `RENDER-UNIVERSALS drift: <path> expected=<hash:0-8> found=<hash:0-8 \| none>`. Exit 0 if no drift, exit 1 if any drift. No file writes. | None (read-only). |
| `--inject <glob>` | For each agent matching the glob, idempotently write/replace the rendered block. Re-running with no source change MUST produce zero diff (idempotency contract). Print one stderr line per file written: `RENDER-UNIVERSALS injected: <path> hash=<hash:0-8>`. Exit 0 on success. | Writes to agent `.md` files. |
| `--render-only` | Print the rendered body to stdout + one stderr line `RENDER-UNIVERSALS rendered: hash=<hash> lines=<N>`. No file IO beyond the source SKILL.md reads. | None. |
| `--sources-root <path>` | Override default search root for the three source SKILL.md files (see "Source path resolution" below). | None. |

Default `<glob>` for `--check` / `--inject` when omitted: `agents/*.md` (relative to repo root, excluding `agents/3rdparty/**`).

**Source path resolution (open-question resolution):**

The three source skills live in the plugin cache, NOT in this repo:

- `superpowers:using-superpowers` → search `~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/using-superpowers/SKILL.md`
- `superpowers:verification-before-completion` → search `~/.claude/plugins/cache/claude-plugins-official/superpowers/*/skills/verification-before-completion/SKILL.md`
- `loop:loop-discipline` → search `~/.claude/plugins/cache/claude-plugins-official/loop/*/skills/loop-discipline/SKILL.md` (probable; if loop ships under a different cache namespace, builder discovers it via `find ~/.claude/plugins/cache -type d -name loop-discipline -path '*/skills/*' | head -1`)

Resolution strategy in `renderUniversals()`:

1. Honor `--sources-root <path>` if provided (used in tests + CI to inject fixture paths deterministically).
2. Else, glob `~/.claude/plugins/cache/claude-plugins-official/{superpowers,loop}/*/skills/<skill-name>/SKILL.md` — if multiple versions match, pick the lexicographically highest (newest version).
3. If a source is missing, throw a typed error `SourceSkillNotFoundError` carrying the missing skill name + searched paths. The CLI catches this in `main().catch()`, prints `RENDER-UNIVERSALS source missing: <skill-name> (searched: <paths>)` to stderr, exits 3.

**Compression rule (v1 — explicit so builder doesn't guess):**

For each source SKILL.md, after stripping the frontmatter block, keep ONLY lines matching the regex `/\b(MUST|HARD|Iron Law|cannot|never|always)\b/i` PLUS the immediately-preceding section heading (`^## `). Drop blank lines except one between sections. Cap each source's contribution at ≤ 12 lines (if more match, take the first 12 after a deterministic stable sort by source-file line number — keeps order). Concatenate the three sources separated by `### <skill-name>` headers. If the final body exceeds 35 lines, throw `RenderedBodyTooLargeError` so the contract is failed loudly rather than silently truncated. **v2 auto-tuning is explicitly out of scope** — see "Out of scope" below.

**Stderr observability (DEC-024):** one grep-able line per significant event (drift detected, injection performed, render emitted, source missing). No JSON. Format: `RENDER-UNIVERSALS <verb>: <details>`. No stdout writes except `--render-only`'s body output.

**Marker syntax (open-question resolution):**

Use HTML comments so the markers render as invisible in any Markdown viewer + survive trivial editor rewraps. Block fence:

```markdown
<!-- pre-loaded-universals:BEGIN hash=<64-char-sha256> -->
## Pre-loaded universals

<rendered body lines here>
<!-- pre-loaded-universals:END -->
```

Justification for HTML over `#` line: HTML comments are invisible when rendered (`#` lines render as headings and would pollute the agent's actual section TOC). Idempotent injection must match `<!-- pre-loaded-universals:BEGIN .* -->` through `<!-- pre-loaded-universals:END -->` (multiline, lazy) and replace the entire span.

**Injection placement:** insert/replace the marker block immediately AFTER the agent's `---` frontmatter close line. New agents (no existing marker) get the block inserted there; existing markers get replaced in place. This keeps the block before the `## Custom instructions` / identity intro so it loads as universal context first.

### 2. Edit: `scripts/validate-agents.ts` (add hash-drift gate)

Add `checkUniversalsDrift()` function and wire it into `validateAgents()` after the existing checks:

- For each agent in the same `PEER_DISPATCH_ALLOWLIST`-style scope (initially: **only `verifier`** — the pilot. Empty allowlist guard for the other 16 until the follow-up slice; passing them is the no-op default).
- Import `renderUniversals()` from `./render-universal-skills.ts`, compute `expectedHash` once at validator start (sources read once, cached for the run).
- For each in-scope agent, call `checkUniversalsHash(filePath, expectedHash)`. If drift, push error: `${label}: pre-loaded universals drift (expected=${exp:0-8}, found=${fnd:0-8 \| 'none'}). Re-render: bun run scripts/render-universal-skills.ts --inject agents/${name}.md`.
- New const `UNIVERSALS_DRIFT_REQUIRED = new Set(["verifier"])` mirrors the existing `PEER_DISPATCH_ALLOWLIST` pattern (lines 121-132). Follow-up slice expands this set to all 17.
- If sources are missing (e.g. plugin cache absent in CI), push a single advisory error (not per-agent): `pre-loaded universals: source skills not found at <searched paths>. Run \`bun run scripts/render-universal-skills.ts --check agents/\` locally to confirm setup.` Justification: CI must not red-fail on a missing source — that's an environment issue, not an agent-file issue. **Builder: confirm with reviewer A whether this should be hard fail or advisory; default to advisory unless reviewer says otherwise.**

### 3. Edit: `agents/verifier.md` (pilot inject)

Run `bun run scripts/render-universal-skills.ts --inject agents/verifier.md` once and commit the resulting block. Expected diff: +37 lines (35-line block + 2 marker lines), placed after the frontmatter close at line 13. Post-inject line count: 303 → 340, well under the 350 default cap (still 10 lines of headroom).

### 4. Tests

Co-located under `tests/render-universal-skills.test.ts`:

- **Determinism:** `renderUniversals()` called twice with the same fixture sources returns identical `body` + `hash`.
- **Compression rule:** fixture source with 50 MUST-bearing lines yields a body where each source section contains ≤ 12 lines.
- **Body cap:** fixture source crafted to produce > 35 rendered lines throws `RenderedBodyTooLargeError`.
- **Idempotency:** call `--inject` twice on a temp agent file; second run produces zero file change (compare bytes).
- **Drift detection:** inject, then manually mutate one line inside the marker span, then `checkUniversalsHash()` returns `{drift: true, ...}`.
- **No-marker case:** `checkUniversalsHash()` on an agent with no marker returns `{drift: true, found: null}`.
- **Source missing:** `renderUniversals()` with a non-existent `--sources-root` throws `SourceSkillNotFoundError`.

Co-located under `tests/validate-agents.test.ts` (extend existing file):

- **Validator catches drift:** inject the pilot, manually mutate inside the marker, run `validateAgents()` → returns `ok: false` with the re-render command in the error message.
- **Validator passes clean:** inject the pilot fresh, run `validateAgents()` → returns `ok: true`.
- **Sources-missing advisory:** override `sources-root` to a non-existent path, validator returns `ok: false` with single advisory error (not 17 per-agent errors).

## Out of scope

- **Re-shipping Part 1.** Skill cap = 3 already lives in primary agent prompts per FEAT-153 body (architect / reviewer / validator carry `max 3 per <phase>`; inspector.md line 70-72 confirms). Do NOT touch the skill-table sections.
- **Authoring new skill files.** Per DEC-025, this slice's canonical entry IS the executable script (`scripts/render-universal-skills.ts`). No `skills/**/SKILL.md` created or modified.
- **Modifying the 3 source universal skills.** Read-only consumers — the contract is "track upstream", not "edit upstream".
- **Auto-tuning the compression rule (v2).** Static MUST/HARD/Iron-Law/cannot/never/always regex is v1. v2 (semantic compression, LLM summarization, etc.) is a separate FEAT — file as a triage item only if the v1 hand-tuned body proves too lossy in practice.
- **Injecting the remaining 16 primary agents.** See "Follow-up scope" below — separate slice using multi-doc fan-out.
- **Touching `agents/3rdparty/*.md`.** Third-party agents are vendored prompts; out of pre-rendered universals scope (they don't dispatch within this team).
- **`lead.md`.** Lead is dispatched at session top, not via subagent dispatch; pre-loading universals there has no Skill round-trip savings to recover. Re-evaluate in v2.
- **Changing skill cap from 3 → other value.** Locked at 3 by Part 1.

## Acceptance criteria

- [ ] **AC-1: Render script exists and gates clean.** Given the repo at `main` HEAD, When `bun run lint scripts/render-universal-skills.ts && bun run typecheck && bun run scripts/validate-skills.ts` runs, Then exit code is 0 and no warnings emitted.

- [ ] **AC-2: `renderUniversals()` returns deterministic body and hash.** Given three fixture SKILL.md files under `tests/fixtures/universals/`, When `renderUniversals({sources: fixturePaths})` is called twice in the same test, Then both calls return identical `body` (byte-equal) and identical `hash` (64-char lowercase hex), and `body.split("\n").length <= 35`.

- [ ] **AC-3: `--inject` is idempotent.** Given a temp copy of `agents/verifier.md` with no marker block, When `bun run scripts/render-universal-skills.ts --inject <temp> --sources-root tests/fixtures/universals/` is invoked twice in succession, Then the file bytes after run 2 are identical to the bytes after run 1 (verified via `fs.readFile` + `Buffer.compare === 0`), and the file contains exactly one `<!-- pre-loaded-universals:BEGIN .* -->` line.

- [ ] **AC-4: `--check` detects drift and exits non-zero.** Given a temp agent file with an injected marker block AND one line inside the block mutated (e.g. one character flipped), When `bun run scripts/render-universal-skills.ts --check <temp> --sources-root tests/fixtures/universals/` runs, Then process exit code is 1 and stderr contains the literal substring `RENDER-UNIVERSALS drift: <temp>` followed by `expected=` and `found=`.

- [ ] **AC-5: `validate-agents.ts` integrates the drift check.** Given the pilot `agents/verifier.md` freshly injected via `--inject` (committed state), When `bun run scripts/validate-agents.ts` runs, Then exit code is 0 and stdout contains `Agents OK:`. AND, When the marker block in `agents/verifier.md` is mutated and `validate-agents.ts` is re-run, Then exit code is 1 and stderr contains both the drifted agent path AND the literal substring `Re-render: bun run scripts/render-universal-skills.ts --inject agents/verifier.md`.

- [ ] **AC-6: Verifier pilot carries the injected block under the agreed marker.** Given the slice's final commit, When `grep -c '<!-- pre-loaded-universals:BEGIN' agents/verifier.md` runs, Then output is exactly `1`; AND `grep -c '<!-- pre-loaded-universals:END' agents/verifier.md` is exactly `1`; AND `wc -l agents/verifier.md` reports ≤ 350 (under the default cap with margin).

- [ ] **AC-7: Other 16 primary agents remain untouched.** Given the slice's final commit, When `grep -l 'pre-loaded-universals:BEGIN' agents/*.md | sort` runs, Then output is exactly the single line `agents/verifier.md` (no other agent gained or lost the marker as a side effect).

- [ ] **AC-8: Sources-missing path emits one advisory, not 17 errors.** Given a CI-like environment where `~/.claude/plugins/cache/claude-plugins-official/` does NOT contain the three source skills (simulated via `--sources-root /nonexistent` in the validator test), When `validateAgents()` runs, Then it returns `ok: false` with exactly ONE error string matching `/pre-loaded universals: source skills not found/`, NOT one error per agent.

- [ ] **AC-9: Full local gate green.** Given the slice's final commit, When `bun run lint && bun run format:check && bun run typecheck && bun run test && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts && node ./scripts/validate-agents.ts && node ./scripts/validate-slices.ts` runs, Then every command exits 0.

## Done When

- All AC PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`.
- Build / test commands per `.claude/loop.json` pass.
- Feature FEAT-153 stays `in-progress` (use `/loop:slice complete --keep-feature-open` per DEC-020 — follow-up slice for the 16-agent fan-out still owes a close).
- Crew `final-synthesis` artifact written.
- Inspector + verifier review-results both filed with `approved` or `approved_with_notes`.

## Reviewer ladder

- **Reviewer A: `crew:inspector`** — correctness, regression risk, scope discipline. Specific gates to weight heavily:
  - Hash gate accuracy: does the validator reliably fail on real drift and pass on clean state?
  - Idempotency proof: confirm the test fixture covers byte-equality (not just "no error"). A "passes 99% of the time" idempotency check is a latent bug under random-order edits.
  - Allowlist scope discipline: confirm `UNIVERSALS_DRIFT_REQUIRED` contains only `verifier`. A larger set silently fails this slice's scope.
  - Marker placement: confirm the block sits AFTER frontmatter close, BEFORE first body section.

- **Reviewer B: `crew:3rdparty:typescript-reviewer`** — TS quality on the render script. Carry-over bans from SLICE-69 / SLICE-75:
  - No `process.exit(N)` from library functions (`renderUniversals`, `checkUniversalsHash`) — only `main()` may set `process.exitCode`.
  - Narrow `unknown` properly (no `any`, no unchecked `as`); errors in `main().catch()` typed via `instanceof`.
  - No floating Promises; every `await` either awaited or `.catch()`'d.
  - SHA-256 via `node:crypto`'s `createHash("sha256")` (no third-party hash library; no synchronous read of arbitrary blobs into memory if a source ever grows huge — though SKILL.md files are bounded).
  - File globbing via `fs.glob` (Node 22+) or `node:fs/promises` walk — not a third-party glob library (repo convention).

## Follow-up scope (separate slice — NOT this one)

- New slice: `SLICE-77-PRE-RENDERED-UNIVERSALS-FAN-OUT` (id contingent on slice ceremony state at time of file).
- Scope: extend `UNIVERSALS_DRIFT_REQUIRED` to all 16 remaining primary agents (`agents/inspector.md`, `agents/architect.md`, `agents/fullstack-dev.md`, `agents/backend-dev.md`, `agents/frontend-dev.md`, `agents/refactor.md`, `agents/uxdesigner.md`, `agents/release-engineer.md`, `agents/document-writer.md`, `agents/integrator.md`, `agents/researcher.md`, `agents/parallel-runner.md`, `agents/performance-engineer.md`, `agents/qa-expert.md`, `agents/investigator.md`, `agents/inspector-verifier.md`). Run `--inject` against each. Multi-doc fan-out pattern (one fullstack-dev subagent per agent in single parallel message, deterministic transform per memory `feedback_doc_subagent_paste_verbatim.md`).
- **Pre-condition:** before the fan-out slice opens, bump `maxLines:` in `agents/inspector.md` (330 → 365), `agents/lead.md` (305 → 345), `agents/fullstack-dev.md` (400 → 440), `agents/architect.md` (350 → 385 — only 10 headroom today). Note: lead is currently excluded from the fan-out (see "Out of scope"); the inspector + fullstack-dev + architect cap bumps land in the fan-out slice's prep step. Per DEC-026 (preserved-section floor rule), MEASURE FIRST — confirm exact post-inject line counts in fan-out spec before deciding cap bumps.

## Open questions (flagged for builder; defaults provided so this is buildable)

1. **Source path discoverability in CI.** The plugin cache may not exist in GitHub Actions (CI doesn't install plugins). The validator currently treats missing sources as one advisory error (see AC-8). **Open:** should CI's `validate-agents.ts` step skip the universals check entirely (env flag `CREW_SKIP_UNIVERSALS_DRIFT=1`)? Default in this spec: NO env flag; the advisory error path is the contract; CI passes because there's only one advisory error and it's the same path on every run. Reviewer A may request a hard env-flag carve-out — accept their call.
2. **Marker hash truncation in stderr.** Spec uses 8-char hash prefix (`hash:0-8`) in observability lines for grep-friendliness. **Open:** is 8 chars enough collision-resistance for drift telemetry? Default: yes (collision probability at 8 hex chars is ~1 in 4 billion; sufficient for a build-time observability line). Reviewer B may request 12 chars — accept.
3. **`agents/3rdparty/*.md` exclusion in default glob.** Spec says `agents/*.md` default glob excludes `agents/3rdparty/**`. **Open:** is the implicit glob single-level (Bun `glob("agents/*.md")` doesn't descend) sufficient, or does the CLI need explicit `--exclude 3rdparty/` defense? Default: single-level glob is sufficient. Test fixture should NOT include a `3rdparty/` shape.
4. **lead.md re-evaluation.** Spec excludes lead from this slice AND the follow-up (no Skill round-trip savings — lead is the orchestrator, loaded once per session). **Open:** confirm during follow-up planning. If FEAT-153 telemetry shows lead-side Skill loads in cost reports, revisit.

## Notes for the builder

- Open `agents/verifier.md` and confirm the frontmatter close is at line 13 (current state) before writing the injection placement logic.
- Test fixtures (`tests/fixtures/universals/*.SKILL.md`) should be small (10-20 lines each) and contain at least 5 MUST-bearing lines each — enough to exercise the cap-at-12 rule without exceeding it.
- The render script's `main()` signature: `async function main(): Promise<void>` followed by `await main().catch(err => { ... })` at module bottom — mirror `skills/workflow/test-quality/scripts/analyze.ts` lines 128 + 154-157 exactly.
- Do NOT import from `scripts/validate-agents.ts` into `scripts/render-universal-skills.ts` (one-way dependency: validate-agents imports render-universal-skills, not vice versa).
- The slice MUST close with `/loop:slice complete --id SLICE-76 --keep-feature-open` because FEAT-153 still owes the fan-out follow-up (DEC-020).

## Verification commands (run before declaring done)

```bash
# AC-1
bun run lint scripts/render-universal-skills.ts
bun run typecheck

# AC-2 / AC-3 / AC-4 / AC-7 (test path)
bun test tests/render-universal-skills.test.ts

# AC-5 / AC-8
bun test tests/validate-agents.test.ts
bun run scripts/validate-agents.ts

# AC-6
grep -c '<!-- pre-loaded-universals:BEGIN' agents/verifier.md
grep -c '<!-- pre-loaded-universals:END' agents/verifier.md
wc -l agents/verifier.md

# AC-7
grep -l 'pre-loaded-universals:BEGIN' agents/*.md | sort

# AC-9 (full gate)
bun run lint && bun run format:check && bun run typecheck && bun run test \
  && node ./scripts/validate-manifests.ts && node ./scripts/validate-skills.ts \
  && node ./scripts/validate-agents.ts && node ./scripts/validate-slices.ts
```
