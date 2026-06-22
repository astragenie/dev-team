# Build / Fix / Ship Workflow Overhaul — Design

**Date:** 2026-06-22
**Status:** draft pending user review

## Goal

Reshape `/crew:build`, `/crew:fix`, `/crew:ship` around three principles:

1. **Build and fix never run verifier.** Verifier moves to ship (and to a synchronous pre-push hook).
2. **Build and fix fan out two parallel inspectors** — one stack-specific (e.g. `crew:c-sharp-reviewer`), one generalist (`crew:inspector`) with lens chosen by FEAT concern tag.
3. **Ship is an auto-fix loop.** QA + verifier dispatched in parallel; on FAIL, the dispatcher routes to the most-suitable builder for up to N retries (default N=2, configurable), then files a PR or escalates with `ship_blocked`.

## Architecture

### Build

```
/crew:build
   ↓ FEAT tag routing (already in commands/build.md)
specialist builder (frontend-dev / backend-dev / fullstack-dev / aiplugin-dev)
   ↓ PASS (builder writes handoff)
   ↓
   ↓ parallel fan-out (single Agent-tool message with N=2 invocations)
   ↓
Inspector A: stack-quality                Inspector B: generalist + lens
  diff has .cs → crew:c-sharp-reviewer      crew:inspector with lens =
  diff has .ts → crew:typescript-reviewer       FEAT concern:* tag mapped to:
    (when first-party variant exists)         concern:security → security
  no stack reviewer match → SKIP A,           concern:perf → performance
    promote B to "code-quality" lens          concern:correctness (default)
   ↓                                       ↓
   └────────────┬──────────────────────────┘
                ↓ both review-result artifacts written
                ↓
       mark-badge build_complete (only if BOTH approved / approved_with_notes)
       mark-badge inspected
       on any rejected: stop, escalate to user
```

### Fix

```
/crew:fix
   ↓
crew:investigator (root cause analysis, read-only)
   ↓ investigator returns finding artifact
   ↓
specialist builder (per FEAT tag, same routing as build)
   ↓ PASS
   ↓ same parallel inspector fan-out as build
Inspector A + Inspector B
   ↓
   mark-badge fix_complete (both approved)
   QA dispatched ONLY if Inspector B raises a test-coverage finding
   (signaled via review-result `next` field naming a tests-adequacy gap)
```

NO verifier. Verifier always defers to ship.

### Ship

```
/crew:ship
   ↓ parallel
   ┌─────────────┐
   ↓             ↓
crew:qa-expert   crew:verifier
   ↓             ↓
   └──────┬──────┘
          ↓ aggregate both decisions
          ↓
   both PASS? ─── yes ──→ gh pr create → mark-badge pr_filed → exit
          ↓ either FAIL
          ↓
   read FEAT tag → dispatch specialist builder with fix scope from FAIL findings
          ↓ builder returns
          ↓ retry counter += 1
          ↓
   retry < N (default 2)? ─── yes ──→ goto parallel QA+verifier
          ↓ N exhausted
          ↓
   mark-badge ship_blocked --note "<aggregated FAIL summary>"
   write deployment-check --decision blocked
   halt → escalate to user
```

### Pre-push hook

`hooks/pre-push-verifier.ts` registered in `hooks/hooks.json` for the `PrePush` event (or `PreToolUse` filtered on `git push` and `gh pr create` if `PrePush` is not a Claude Code event — fall back to the closest event).

Behavior:

1. Synchronously dispatch `crew:verifier` via `node scripts/crew.ts dispatch-verifier --repo "$PWD"` (new CLI subcommand TBD or inline `Agent` call from hook script — pick whichever the runtime supports).
2. Read returned `validation-result` artifact `decision` field.
3. If `decision = passed` (or `approved`) → exit 0, push proceeds.
4. If `decision = failed` (or `rejected`) → exit 1 with stderr message naming the artifact path + FAIL summary. Push blocked.
5. Cache hit: if a `.claude/artifacts/crew/validations/*.md` newer than HEAD~1 commit timestamp shows PASS, skip dispatch and exit 0 (avoids re-running verifier on every push within a single ship session).

## New badges

| Badge | Set by | Meaning |
|---|---|---|
| `build_complete` | build.md | Builder PASS + both inspectors approved/approved_with_notes |
| `inspected` | build.md / fix.md | Both inspectors completed (any decision) |
| `fix_complete` | fix.md | Investigator + builder + inspectors all PASS |
| `qa_passed` | ship.md | crew:qa-expert returned PASS |
| `verifier_passed` | hook / ship.md | crew:verifier returned PASS |
| `pr_filed` | ship.md | `gh pr create` succeeded |
| `ship_blocked` | ship.md | N retry attempts exhausted, escalated to user |

All badges emit via existing `node scripts/crew.ts mark-badge --repo "$PWD" --badge <badge>` CLI — no schema change needed if `crew.ts` accepts arbitrary badge strings (verify in implementation; fall back to schema extension if it whitelists).

## Inspector A skip rule (stack reviewer fallback)

When the diff stack doesn't match a first-party stack reviewer:

| Diff signal | Inspector A |
|---|---|
| `.cs` files present | `crew:c-sharp-reviewer` |
| `.ts` files present, no `.cs` | `crew:typescript-reviewer` (when added — currently `crew:3rdparty:typescript-reviewer` until promoted) |
| Other stacks (Python, Go, Rust, etc.) | SKIP A — only Inspector B fans out |

When A is skipped, Inspector B's lens is set to `code-quality` (covers generalist quality + stack-agnostic correctness) and `build_complete` requires only B to approve.

## Files changing

| File | Change |
|---|---|
| `agents/c-sharp-reviewer.md` | Already promoted from 3rdparty/ to first-party in this slice |
| `agents/3rdparty/c-sharp-reviewer.md` | Deleted (already done) |
| `commands/build.md` | Append parallel inspector fan-out block, badge emissions, FEAT-tag → builder mapping kept |
| `commands/fix.md` | Full rewrite — investigator-first, builder, parallel inspectors, conditional QA |
| `commands/ship.md` | Full rewrite — parallel QA+verifier, retry loop, PR file, badges |
| `hooks/pre-push-verifier.ts` | NEW hook |
| `hooks/hooks.json` | Register new hook on `PrePush` (or closest supported event) |
| `.claude/crew/deployment.md` | Add `ship.fix_retry_limit: 2` config row (consumer-overridable) |
| `docs/routing-table.md` | Add Inspector A/B routing rules + new badge column |
| `scripts/validate-agents.ts` | `c-sharp-reviewer` already in `NO_LEAD_REF_REQUIRED` set |
| `tests/agent-topology.test.ts` | `c-sharp-reviewer` already in `EXPECTED_AGENTS` |

## Risks

| Risk | Mitigation |
|---|---|
| `typescript-reviewer` still in 3rdparty/ — pattern mismatch with c-sharp-reviewer | Follow-up FEAT: promote typescript-reviewer same way. For this slice, document `crew:3rdparty:typescript-reviewer` as the .ts choice in routing table. |
| Pre-push hook event name (`PrePush`) may not exist in Claude Code hook events | Verify against `hooks/hooks.json` schema; if not supported, attach to `PreToolUse` filtered on git push / gh pr create command strings. |
| Concurrent inspector dispatch writes review-result artifacts — path collision | Each inspector passes `--reviewer <name>` to CLI; CLI must include reviewer in artifact filename. Verify CLI supports this (likely already does given `--reviewer` flag seen in c-sharp-reviewer prompt). |
| Auto-fix loop could thrash if QA + verifier disagree | N=2 hard cap. After N, halt with `ship_blocked`. User can override via `.claude/crew/deployment.md` `ship.fix_retry_limit`. |
| Hook dispatching subagent synchronously may be slow / not supported | If `Agent`-tool dispatch from a hook isn't supported, the hook reads recent validation artifacts only (warn if missing, but rely on ship.md to populate them). |

## Acceptance criteria

- `commands/build.md` ends with the parallel inspector fan-out block + emits `build_complete` + `inspected` badges on success
- `commands/fix.md` opens with investigator dispatch + same parallel inspector pattern + emits `fix_complete`
- `commands/ship.md` dispatches QA + verifier in parallel, retries up to N on FAIL, files PR on success, emits the badge set
- `hooks/pre-push-verifier.ts` exists, is registered, blocks push on verifier FAIL, honors cache rule
- All validators (`validate-agents`, `validate-skills`, `validate-manifests`, typecheck, lint) green
- `bun test` slice-scoped suite green
- CHANGELOG entry added under `[Unreleased]`

## Out of scope (deferred)

- Promote `typescript-reviewer` to first-party (follow-up FEAT)
- New CLI subcommands for hook (`dispatch-verifier`, etc.) — use existing dispatch surface
- Migrate ship retry loop to a generic `crew:loop` skill — current inline implementation is simpler
- Docs migration of historical artifacts mentioning the old workflow
