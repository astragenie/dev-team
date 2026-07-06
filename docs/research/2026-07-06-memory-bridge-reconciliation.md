# Memory-bridge reconciliation — FEAT-188/193 vs runner-plugin's existing (dormant) memory system

**Date:** 2026-07-06
**Type:** Read-only research synthesis (3-agent fan-out). No source edited.
**Trigger:** FEAT-188 architect review found runner-plugin already ships an astramem integration FEAT-188 didn't reference. This doc reconciles the two.

> **CORRECTION (2026-07-06, operator):** the researchers (and the runner-plugin bridge's own comments) claimed astramem is "dormant until memory-plugin v0.4 ships the CLI." **This is STALE.** astramem is **live at plugin v0.6.0** (`C:\work\mega\astramemory-plugin`). The correct interface is **plugin commands `/astramem:remember` / `/astramem:recall` (or MCP tools), NOT the raw CLI** — the plugin's provider selector routes SaaS-or-local internally. So: the astramem-write path is **available today**, not blocked; and the bridge's `resolveCli()` CLI-shelling is itself the stale bit that should move to the plugin/MCP routing. Read "dormant"/"CLI argv"/"v0.4" below as the pre-correction snapshot. See memory `astramem-live-v06-interface`.

**Sources:** runner-plugin `@65c741d` (source; ahead of installed `0.61.0` cache) — `memory-bridge.mts`, `memory-recall.mts`, `memory-sink.mts`, `learnings.mts`, `grade-writer.mts`, `slice-linker/start-slice.mts`, `recall-injector.mts`, `phase-gate/parallel-orchestrator.mts`, `docs/sop/memory-bridge.md`. dev-team — FEAT-188/193, `docs/superpowers/specs/2026-07-04-memory-provider-plan.md`, `scripts/lib/gepa/capture-tee.ts`, `gepa.config.json`, `@astragenie/gepa-core` `file-store.ts`/`interfaces.ts`.

---

## Bottom line

- **~60-65% of FEAT-188's capture+recall+astramem infra already exists** in runner-plugin's memory-bridge — **dormant only because the astramem CLI (memory-plugin v0.4) isn't shipped** (`github.com/astragenie/memory-plugin#8`). Flip that binary on and emit/recall activate.
- **~35-40% is genuinely new:** FEAT-188 S1's dev-team-side FAIL capture, S3's 5-of-6 unwired dispatch sites, all of S5.
- **The bridge feeds astramem, NOT the GEPA trial store — two disconnected stores.** So **FEAT-193 (failure → GEPA trial JSONL) is fully net-new, not collapsible.**
- **Mandatory before any S2 build: a config-schema reconciliation** — FEAT-188's proposed `memory` keys collide with the bridge's live ones in the same `.claude/loop.json`.

---

## 1. What the bridge already does (Facet 1)

- **`emit()`** (`memory-bridge.mts:147-163`) — GEPA-shaped `GepaPayload` (`ts, slice_id, feat_id, source, event, score, feedback, input, output, prompt_version`), fire-and-forget, 2s cap, swallows all errors. Fires at `slice_close` (pass+fail), `phase_gate_fail`, `slice_started`, `recall_used`.
- **`recallPrior()`** (`memory-recall.mts`) — queries astramem, injected at slice-start dispatch (`start-slice.mts:832-892`), 5s cap, fail-silent `[]`.
- **astramem CLI contract** (exact argv): `ingest --json <payload>`; `recall --query --k --project --repo --format json`; `remember --content --type <decision|lesson|note>`; `doctor --format json`.
- **`config.memory.*`** (from `.claude/loop.json`): `enabled` (`auto|never`), `recall.enabled/k/timeoutMs`, `project`.
- **Dormant gate:** `resolveCli()` returns null when the astramem binary is absent → every call no-ops. Single activation condition = memory-plugin v0.4 ships `astramem`.
- **Cache bugs (fixed in source, unreleased in 0.61.0):** (1) Windows CLI-path resolution only probes bare `astramem`; (2) `--project` passes `featId` → recall always returns `[]`. Both live in the installed cache.

## 2. Redundancy map (Facet 2)

| Slice | Verdict | Detail |
|---|---|---|
| S1 Capture | **PARTIAL** | slice_close + phase_gate capture built (`grade-writer.mts:541-652`). **review/validation-FAIL capture ABSENT** in dev-team `crew.ts`/commands (grep-confirmed) = the real new bit. incident-close/pr-fix/retrospective presumed absent. |
| S2 Interface | **PARTIAL + collision** | `learnings.mts`≈fileProvider, `resolveCli()`≈astramemProvider, `memory-sink`≈noop already exist. Unified `MemoryProvider` interface + Zod schema = new. |
| S3 Recall inject | **mostly NEW** | Helper exists but wired to 1 site (slice-start) — **not even one of FEAT-188's 6 named sites**. 5/6 have zero injection. |
| S4 astramemProvider | **mostly BUILT** | `resolveCli()` is it; only interface-wrapping + parity test missing. |
| S5 Eval/hygiene | **NEW** | No SIGKILL parity test, judge-delta fixture, decay, or supersede-aware recall. |

**Precedent correction:** FEAT-188 says it mirrors gepa-core `fileStore`/`astramemStore`. gepa-core has **only `fileStore`** — `astramemStore` is a config enum value, not a built store. The real astramem precedent is the bridge's `resolveCli()`, not gepa-core.

## 3. The two stores never touch (Facet 3)

- `emit()` → `spawn(astramem, ["ingest", ...])` → astramem's external backend.
- `.claude/artifacts/crew/gepa/trials/<agent>.jsonl` is written **only** by `capture-tee.ts:143` → gepa-core `fileStore.put()`. Never imports astramem.
- "GEPA-payload-shaped" = the JSON schema is trainset-ready, **not** that it lands in the trials JSONL. It lands in astramem.
- ⇒ **FEAT-193 S1 (failure → GEPA trial store) is genuinely undone**, not covered by the bridge.

## 4. Config collision + unified schema (mandatory pre-S2)

Live (bridge) vs proposed (FEAT-188) both target top-level `memory` in the same `.claude/loop.json`:

| Concept | Bridge (live) | FEAT-188 (proposed) | Resolution |
|---|---|---|---|
| on/off | `memory.enabled` (`auto\|never`) | `memory.provider` (`none\|file\|astramem`) | **orthogonal axes — keep both**; `enabled` gates emit, `provider` selects backend |
| recall size | `recall.k` | `recall.topK` | **rename FEAT-188 → `k`** (match live) |
| recall timeout | `recall.timeoutMs` | — | keep |
| recall budget | — | `recall.maxTokens` | additive, keep |
| kill switch | `recall.enabled` | — | shared kill-switch for both injectors |
| capture list | — | `capture.events` | additive, keep |

Rule: S2's Zod parser must read `recall.k` (not `topK`), must NOT repurpose `enabled`, and must tolerate the bridge's existing keys (not hard-error them as "unknown"). Otherwise every repo with a live `memory` block breaks.

## 5. Target architecture (3 layers)

```
Layer 1 — Episodic memory (FEAT-188, crew/dev-team)
  writers: runner:close, review-FAIL/validation-FAIL, incident-close, pr-fix, retrospective   (S1 net-new)
  MemoryProvider { capture/recall/supersede/invalidate }  noop | file | astramem              (S2 net-new)
  readers: 6 dispatch sites (dispatch.mts, /crew:build, /crew:fix, /crew:ship, orchestrate, wave) (S3 net-new = the value)
        │  S4 astramemProvider = THIN ADAPTER over the bridge's resolveCli(), not a reimpl
        ▼
Layer 3 — astramem transport (memory-plugin, external)   ingest / recall   (dormant until v0.4)
        ▲ emit() slice_close/phase_gate/slice_started/recall_used  (generic loop telemetry)

Layer 2 — GEPA trial corpus (crew/dev-team-local, EXISTING + FEAT-193)
  writer today: capture-tee.ts → gepa-core fileStore → gepa/trials/<agent>.jsonl
  writer NEW: FEAT-193 S1 consumes Layer-1 failures → failing Trials (source:production)
  aggregator NEW: FEAT-193 S2 gepa-corpus-sync (sibling-repo, agent-keyed)
  reader: candidate-generator (the brain) + FEAT-193 S3 analyze-report → human promote
```

## 6. Re-scope (net effort change)

- **S1** keep — net-new (bridge doesn't touch learnings.jsonl / grade-completeness / decisions README / FAIL capture).
- **S2** keep — new interface/schema/ranking. **Add config-reconciliation to its ACs (§4).**
- **S3** keep — highest value (5/6 sites unwired). **On ship, retire the bridge's `runRecallHook` at slice-start** and route it through S3's helper with `provider=astramem`, else that site double-injects.
- **S4** **re-scope DOWN** — thin adapter wrapping the bridge's `resolveCli()`/spawn/fail-silent, not a fresh astramem client. Only real effort reduction.
- **S5** keep.
- **FEAT-193** unchanged, not collapsible — bridge doesn't feed the trial store.
- **Add to FEAT-188 S1 ACs:** `inline-return-warn` + `subagent-incomplete` capture (FEAT-193 depends on them; FEAT-188 doesn't currently commit to producing them).

## 7. Mandatory pre-build actions

1. Reconcile the `memory` config schema (§4) — a design note the dispatcher/lead owns (spans both repos).
2. Decompose SLICE-109 (placeholder blob) → S1a/S1b/S2/S3a/S3b/S4/S5 real slices (per architect review).
3. Confirm the memory-plugin v0.4 / astramem-CLI timeline — Layer 1 recall + S4 are inert until it ships; S1 capture + S3 file-provider recall + all of FEAT-193 work without it.
4. Decide ownership of the Windows-path + `--project=featId` cache bugs — they block real astramem use once v0.4 lands.
