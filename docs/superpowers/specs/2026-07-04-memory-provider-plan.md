# MemoryProvider — Capture/Recall Learning Loop Plan

**Date:** 2026-07-04
**Status:** proposed (from architecture review section 15)
**Source:** `docs/superpowers/specs/2026-07-04-crew-architecture-review-REPORT.md` §15
**Risk tier:** MEDIUM (new subsystem, but zero behavior change when unconfigured)

## Problem

Agents have no awareness of recent failures, lessons, decisions, or standards at
dispatch time. The raw material exists but is broken at every stage:

1. **Capture is leaking.** `.claude/artifacts/loop/learnings.jsonl` has 3 entries,
   newest 2026-06-11 — the entire GEPA cluster shipped afterwards with zero repo-level
   capture. Operational lessons landed in the operator's personal cross-session memory
   instead of the repo. Any recall layer built today would surface almost nothing.
2. **Capture is not enforced — quantified.** Of 78 grade files: 21 (27%) still contain
   the literal unfilled placeholder `"- bullet"`, 16 (21%) have all-zero scores, and 2
   of the 5 most-recent grades are themselves unfilled templates. `runner:lessons-recent`
   (digest of last 5 grades' Lessons/Surprises/Followups) would therefore return
   placeholder noise as 2 of its 5 entries TODAY — the already-shipping digest is
   actively polluted, not hypothetically at risk. The "grade-template-rot" lesson was
   recorded ~3 weeks ago and did not stop it.
3. **Decisions are hidden.** 28 well-formed DEC entries live in
   `.claude/artifacts/loop/decisions/`; the discoverable `docs/decisions/` has only a
   README + template.
4. **No recall path.** Nothing injects lessons/failures/standards into builder,
   reviewer, or verifier context at dispatch.

## Design principles

- **Mirror the proven TrialStore pattern** (gepa-core: `fileStore` default,
  `astramemStore` lights up when astramem present). Same shape here:
  `noopProvider` (unconfigured — today's behavior, zero deps) →
  `fileProvider` (JSONL on disk, free default) →
  `astramemProvider` (adapter over installed astramem MCP/CLI).
- **Capture before recall.** A provider over an empty corpus is worthless. S1 repairs
  capture and is the prerequisite for everything else.
- **Orchestrator-side injection**, not agent-side retrieval: the dispatch instruction
  block is already assembled centrally (runner slice-linker `dispatch.mts`, crew
  `/crew:build`); injecting there keeps agents provider-unaware and the token budget
  centrally enforced.
- **Standards ≠ memory.** Durable standards (`docs/standards/`, Astragenie.Standards)
  stay in skills/docs routing. Memory holds the *episodic* layer: failures, lessons,
  decisions, standard-*violations*. A recurring violation may graduate into a standard
  (human decision), at which point the memory entries are superseded.
- **Crew-local first.** Interface lives in this repo (`src/lib/memory/`), NOT gepa-core,
  until a second consumer exists — same extraction-trigger discipline as `evals/`.

## Memory entry schema (Zod)

```ts
const MemoryEntrySchema = z.object({
  id: z.string(),                    // ulid
  ts: z.string().datetime(),
  kind: z.enum(["failure", "lesson", "decision", "standard_violation"]),
  severity: z.enum(["critical", "high", "medium", "low"]),
  agent: z.string().optional(),      // agent the lesson applies to, if scoped
  tags: z.array(z.string()),         // stack:*, surface:*, freeform
  summary: z.string().max(280),      // one-line, injected verbatim
  detail: z.string().optional(),     // full text, fetched only on demand
  source: z.string(),                // artifact path or DEC id — provenance mandatory
  supersedes: z.string().optional(), // id of entry this replaces
});
```

## Provider interface

```ts
interface MemoryProvider {
  describe(): { provider: "noop" | "file" | "astramem" };
  capture(entry: MemoryEntry): Promise<void>;          // fire-and-forget, ≤2s cap (GEPA capture precedent)
  recall(query: {
    agent?: string;
    tags?: string[];
    topK: number;                                       // default 5
    maxTokens: number;                                  // default 800
  }): Promise<MemoryEntry[]>;                           // ranked recency × severity
  supersede(id: string, replacement: MemoryEntry): Promise<void>;
  invalidate(id: string): Promise<void>;
}
```

Config block (in `.claude/loop.json` or `crew.json`, follow cost-config precedent):

```json
{
  "memory": {
    "provider": "file",              // "none" | "file" | "astramem" — absent = "none"
    "recall": { "topK": 5, "maxTokens": 800 },
    "capture": { "events": ["slice_close", "review_fail", "validation_fail", "incident_close"] }
  }
}
```

## Slices

### S1 — Capture repair (prerequisite; no new interface yet)
- Hook `runner:close` (slice-close ceremony) to auto-append a learnings entry when the
  slice grade contains non-empty lessons/surprises fields.
- Hook review-FAIL and validation-FAIL artifact writes to auto-append a `failure` entry
  (agent, severity from finding, summary from verdict).
- Also capture: incident-close (`/crew:incident`), `runner:pr-fix` circuit-breaker trips
  (categorized unfixed issues are exactly the "recent failures" recall wants), and
  retrospective decisions (`runner:retrospective` output).
- Enforce grade completeness: extend `validate-syntheses.ts`'s existing placeholder
  rejection to grade files (fixes two consumers at once — the future MemoryProvider AND
  the already-shipping `runner:lessons-recent` digest, which today returns 2/5
  placeholder entries). `runner:close` refuses (or flags `grade_incomplete`) on
  unfilled templates.
- Surface decision log: `docs/decisions/README.md` points at
  `.claude/artifacts/loop/decisions/` as the authoritative store (one-line fix).
- AC: next slice close writes a learnings entry with zero operator action;
  unfilled grade cannot close silently.

### S2 — MemoryProvider interface + noop/file providers
- `src/lib/memory/` — schema, interface, `noopProvider`, `fileProvider` (JSONL,
  atomic O_APPEND writes + torn-line discard, per GEPA fileStore precedent).
- `fileProvider` reads BOTH the new capture stream and legacy
  `.claude/artifacts/loop/learnings.jsonl` (adapter for the 3 legacy entries).
- Config parsing + validation (unknown provider = hard error; absent = noop).
- AC: unit tests for ranking (recency × severity), token-budget truncation, supersede
  chain resolution; absent config = zero behavior change (golden test on dispatch output).

### S3 — Recall injection at dispatch
- One injection helper, called from EVERY dispatch assembly point — full site matrix:
  1. runner `src/scripts/lib/slice-linker/dispatch.mts` (autonomous slice-build)
  2. `/crew:build` (interactive single-slice)
  3. `/crew:fix` (highest value — fix loops repeat known failure classes)
  4. `/crew:ship` retry dispatches (specialist builder on FAIL)
  5. `commands/orchestrate-slice.md` step-3 builder prompts + reviewer/verifier gate prompts
  6. runner wave runner (parallel worktree dispatches)
- Injected block: `## Recent lessons (top-K)`, one line per entry
  (`[severity] summary — source`).
- Hard token cap; entries scoped by agent + slice tags when available.
- Completeness fitness function: a test greps the dispatch-assembly modules for the
  injection-helper call so a new dispatch path cannot silently skip memory.
- AC: golden dispatch-trace test with and without memory context; cap never exceeded;
  noop provider produces byte-identical dispatch instruction to today.

### S4 — astramemProvider
- Adapter over installed astramem surface (recall/remember/supersede/invalidate);
  auto-detect presence like `astramemStore`, fall back to file when absent.
- AC: contract test parity between fileProvider and astramemProvider on the same
  entry set (same ranking, same truncation).

### S5 — Eval interaction + hygiene
- Capture-parity golden test (mirror GEPA `captureParityGoldenTest`, incl. SIGKILL case).
- Eval fixtures with/without memory block for one GEPA v1 agent — measures whether
  injected lessons shift judge scores (this is a GEPA context variable now).
- Staleness policy: entries older than N days (default 45) decay out of default recall
  unless severity=critical; superseded/invalidated entries never recalled.
- AC: eval run demonstrates the with/without delta is measured and reported.

## Sequencing + dependencies

S1 → S2 → S3 → (S4 ∥ S5). S1 is standalone value even if nothing else ships.
S3 depends on the routing/dispatch cleanup (routing-table.yaml work) only weakly —
coordinate but don't block.

## Open questions

1. Should `capture()` also tee into astramem when BOTH file and astramem configured
   (dual-write), or is provider exclusive? Recommend exclusive + one-shot migration cmd.
2. Cross-worktree recall: sibling worktrees have separate `.claude/state` but shared
   repo artifacts — fileProvider path must live under committed artifacts
   (`.claude/artifacts/loop/memory/`) not `.claude/state/`, so lessons survive
   machine changes (consistent with artifacts-committed policy).
3. Does the recall block count against the ≤350-line agent prompt cap? No — it is
   dispatch-instruction content, not agent-file content. Confirm validator ignores it.
