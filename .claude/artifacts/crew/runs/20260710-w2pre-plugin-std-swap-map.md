# W2-pre — plugin-std duplication map (dev-team ← @astragenie/plugin-std)

Read-only recon by w2pre-investigator, 2026-07-10. Input to P4/W2 adoption.

## SWAP-LIST (dev-team file:lines → plugin-std export, confidence)

**errors/result** (`@astragenie/plugin-std` root or `/errors`, `/result`)
- `scripts/lib/result.ts:10-22` (ok/err/map/flatMap) → `result.ts` same names — **exact-dup** (bodies char-identical; plugin-std adds `unwrap()` + defaults `E=PluginError`). dev-team's file is the cited seed for plugin-std's version.

**git** (`@astragenie/plugin-std/git` — `runGit`)
- `scripts/lib/briefing/git.ts:51-58` (local runGit, execFile→stdout-or-null) → `runGit()` — **near-dup**, plugin-std returns richer `{ok,stdout,stderr,status}` (superset).
- `scripts/lib/branch-cleanup.ts:15-22` — **exact-dup of briefing/git.ts** (byte-identical twin).
- `scripts/lib/gepa/gepa-killswitch-cmds.ts:51-69` (spawnSync variant, already `{ok,stdout,stderr,status}`) → **near-dup**, but sync→async ripples to ~6 unawaited call sites in that file.
- `scripts/e2e-smoke.ts` (ad hoc execFile git) — test bootstrap → **NO-TOUCH**.

**frontmatter** (`@astragenie/plugin-std/frontmatter` — parseFrontmatter/serializeFrontmatter) — biggest win, 5 CRLF-unsafe parsers + 4 serializers:
- Parsers (near-dup, → parseFrontmatter):
  - `scripts/lib/artifact-cache.ts:11-25` + byte-identical `artifact-cache.mjs:23` — colon-split, string-only, LF-only fence (CRLF-unsafe).
  - `scripts/lib/cost-advisor.ts:23-51` — regex parser, ad hoc coercion, LF-only.
  - `scripts/lib/wakeup.mjs:88-93` — strip-only, LF-only.
  - `scripts/lib/briefing/workflow.ts:101` — same strip-only one-liner, LF-only.
  - `scripts/lib/agent-registry.ts:43-46` (extractFrontmatter) — **best**: already CRLF-aware + real parseYaml. Closest to a rename.
- Serializers (near-dup, → serializeFrontmatter):
  - `scripts/lib/artifacts/write.ts:136` and `scripts/crew.ts:507` — identical `["---",...lines,"---",""].join("\n")`.
  - `scripts/lib/cost-hygiene/render-frontmatter.ts:64-88` and `scripts/lib/build-bundle/assemble.ts:135-151` — fixed-field-order builders → **partial** (preserve key ordering downstream parsers depend on).
- Domain-specific, leave local:
  - `scripts/lib/gepa/champion-provenance-writer.ts:69-90` (stripGepafrontmatter) and `gepa/gepa-killswitch-cmds.ts:75-95` (readGepafrontmatter) — gate on `gepa:` second line, domain rule.
  - `scripts/validate-agents.ts:108-118` (checkAgentLineCap) and `scripts/validate-slices.ts:45` — too narrow.

**jsonl** (`@astragenie/plugin-std/jsonl` — append/appendBatch/readSafe/tail/rotate)
- `scripts/lib/dispatch-timing.ts:45-48` — inline mkdir+appendFile, fire-and-forget → **near-dup of append()**, minus typed throw (swallows).
- `scripts/lib/approvals.ts:120` (append) + `:134` (split-read) → **near-dup of append()+readSafe()**.
- `scripts/lib/jsonl.mjs` tailReadJsonl (byte-offset tail, returns {} on malformed) → **near-dup of tail()**, but byte-seek vs full-read — real perf diff on large files (flag if adopted).
- `scripts/lib/gepa/observability-events.ts:87-113` (emitGepaEvent) → **partial**: custom event_id dedupe is domain logic; layer on top.
- `scripts/lib/telemetry/serialize-jsonl.ts` — batch **overwrite** (idempotent), different semantics → **NO-TOUCH**.

**http** (`@astragenie/plugin-std/http`) — **No dev-team caller** (zero `fetch(` in scripts/). → **N/A this repo, skip**.

## API-GAP list (plugin-std lacks vs dev-team needs)
1. No PluginError/Deterministic/Transient in dev-team today — adopting result.ts pulls errors.ts; migrating callers to branch on `.code`/`.transient` is new call-site work.
2. jsonl append() throws TransientError; dispatch-timing.ts + observability-events.ts intentionally swallow (fire-and-forget "MUST NOT throw") — need try/catch wrapper OR plugin-std non-throwing variant. **Decision needed before jsonl swap.**
3. jsonl has no event_id-dedupe primitive — observability-events idempotency gate stays local.
4. jsonl tail() is full-read+slice, not byte-seek — potential perf regression on large logs.
5. git runGit async-only — gepa-killswitch-cmds.ts sync variant needs await migration (~6 sites).
6. frontmatter generic — the two gepa:-scoped helpers need thin wrapper (parse then gate on `data.gepa !== undefined`).

## NO-TOUCH (leave local)
- e2e-smoke.ts git spawns; telemetry/serialize-jsonl.ts overwrite writer; gepa champion-provenance-writer + killswitch readGepafrontmatter (gepa:-gated); validate-agents checkAgentLineCap + validate-slices workflow regex; observability-events (event_id + never-throw contract).

## Caller-count sizing (rough grep hits)
- frontmatter-touching: 16 files (~9 real parse/serialize impls).
- .jsonl-referencing: 38 (~5 implement primitives).
- git-spawn implementers: 3 + e2e-smoke (NO-TOUCH).
- result.ts: `scripts/lib/claims.ts` imports {ok,err} directly — ≥1, more via re-export (not exhaustively traced).

## Swap-PR ordering recommendation
1. **frontmatter FIRST** — largest, highest-value, safest; fixes real CRLF bug class; ~9 sites mostly mechanical once the 2 gepa:-gated get thin wrappers.
2. **git** — smallest; async-migration wrinkle in gepa-killswitch-cmds.ts.
3. **jsonl** — medium; needs gap #2 (non-throwing wrapper) decision first.
4. **result** — exact-dup swap but drags errors.ts + call-site `.code` migration; scope carefully.
5. **http** — skip (zero surface).
