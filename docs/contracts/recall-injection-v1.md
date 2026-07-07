# Recall-injection interface — v1 (FROZEN)

**Status:** frozen 2026-07-06 · **Version:** v1 · **Source:** `scripts/lib/memory/inject-recall.ts` (dev-team FEAT-188 S3a)
**Consumers:** dev-team dispatch sites (`commands/build.md`, `fix.md`, `ship.md` retries, `orchestrate-slice.md`) + **runner-plugin S3b** (runner-plugin#358).

This is the cross-repo contract that closes dev-team#173 decision #3. runner-plugin S3b MUST adopt this interface + emitted block format and retire its own `runRecallHook` (`start-slice.mts:450`) — it must NOT fork a second recall-block format. Any change to the signature or block shape is a **breaking change → v2** (bump this doc + notify runner-plugin), not an in-place edit.

## Public API (frozen)

```ts
interface InjectRecallOptions {
  repoPath: string;         // repo root; config loaded from <repoPath>/.claude/loop.json
  agent?: string;           // scope recall to one agent (entries with no agent apply to all)
  tags?: string[];          // scope to entries carrying >=1 of these tags
  rawConfig?: unknown;      // optional pre-loaded `memory` config block; omitted -> loaded from loop.json
}

// Recall-and-append. Returns dispatchText UNCHANGED (byte-identical) when
// provider:none, recall.enabled:false, no matches, or ANY failure.
async function injectRecall(dispatchText: string, opts: InjectRecallOptions): Promise<string>

// Build only the block (no append). "" when disabled/empty/failed.
async function buildRecallBlock(opts: InjectRecallOptions): Promise<string>

// Pure formatter over already-recalled entries. "" for empty input.
function formatRecallBlock(entries: MemoryEntry[]): string

// Load the top-level `memory` block from <repoPath>/.claude/loop.json. Never throws.
async function loadMemoryConfig(repoPath: string): Promise<unknown>
```

## Emitted block format (frozen)

Header is the shared `## Prior context (from astramem)` (reused from the runner bridge's `recall-injector.mts` `formatRecallBlock` — same header both sides). One Markdown line per entry:

```
## Prior context (from astramem)
- **[<kind> <severity>]** <source? + " "><summary>
```

- `kind` ∈ MemoryEntry kinds (decision|lesson|fact|failure|…), `severity` ∈ low|medium|high|critical.
- `source` prefix present only when the entry has a `source`, followed by one space.
- Per-line shape differs from the bridge's `RecallResult` (type/score/slice_id/content) because `MemoryEntry` carries kind/severity/source/summary — **same header, adapted line**. That divergence is intentional and frozen.
- Appended to dispatch text as `\n\n<block>`.

## Invariants (frozen — S3b relies on these)

1. **Best-effort, never throws.** Config parse error, provider error, or timeout → omit the block, never block/alter dispatch.
2. **Byte-identical when off.** `provider:none` or `recall.enabled:false` → `injectRecall` returns `dispatchText` unchanged. (Golden dispatch-trace test.)
3. **Empty → "".** No entries → empty string, no header, no injected whitespace (so callers can `if (!block)`).
4. **Scoping.** `agent`/`tags` filter recall; entries with no agent apply to everyone. `k` + `maxTokens` from the resolved `recall.*` config bound the result.

## S3b adoption checklist (runner-plugin#358)

1. Consume `injectRecall` / `buildRecallBlock` (or replicate the frozen block format exactly if importing across the plugin boundary isn't viable) at the runner dispatch sites.
2. Retire `runRecallHook` (`start-slice.mts:450`) — route slice-start recall through this helper so there is exactly one injection per dispatch (no double-inject with `buildMemoryContext` @ `post-builder-fanout.mts:97`).
3. Golden test: `provider:none`/`recall.enabled:false` → dispatch byte-identical to today.

## Refs
- dev-team#173 (decision #3), dev-team#172 (transport = MCP), runner-plugin#358 (S3b), #338 (recall parse fix already shipped runner-side).
- `docs/research/2026-07-06-memory-bridge-reconciliation.md`.
