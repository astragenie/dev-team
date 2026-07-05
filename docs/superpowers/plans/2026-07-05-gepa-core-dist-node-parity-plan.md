# Plan — gepa-core ships compiled `dist/` for Node consumer parity (FEAT-191)

**Date:** 2026-07-05
**Status:** draft — awaiting architect-review + pm scope
**Relates:** ADR-003 (Option C), FEAT-190 (full Bun sweep — deferred alternative)
**Repos touched:** `astragenie/gepa-core` (owner), `astragenie/dev-team` (consumer)

## Problem

7 GEPA slash-commands hard-fail for consumers, and GEPA capture silently dies,
whenever crew scripts run under **Node** — because `@astragenie/gepa-core` ships
raw `.ts` and Node refuses to type-strip anything under `node_modules` (all
versions, incl. 24 — a permanent design guard).

Evidence:
- `node scripts/crew.ts gepa-optimize reviewer` → `Stripping types is currently
  unsupported for files under node_modules`.
- 8 **value** imports of gepa-core across `scripts/lib/gepa/*` break under Node.
  (7 `import type` imports are erased at strip-time → already safe; the cost path
  is therefore unaffected.)
- `writeArtifact` → dynamic-import `capture-tee.ts` → value-imports gepa-core →
  throws under Node → caught by `fireCaptureTeeSilent` → **trial silently
  dropped.** Capture only works when the write happens under Bun (hooks). This is
  why the trial corpus is near-empty.

## Root cause

gepa-core `package.json` `exports` point at raw TypeScript source:
```json
"exports": { ".": "./src/index.ts", "./providers/ollama": "./src/providers/ollama/index.ts", … }
```
Node cannot execute TS from `node_modules`. Bun can. Hence the split-runtime
breakage is localized entirely to the GEPA surface.

## Fix (one idea, minimal)

gepa-core builds a compiled `dist/` (JS + `.d.ts`) and flips its `exports` to
point at the built JS. **No crew logic changes** — the 8 value imports stay
byte-identical; they simply resolve to JS instead of TS. Runs on Node *and* Bun.

Target exports after the fix:
```json
"exports": {
  ".":                       { "types": "./dist/index.d.ts",                 "default": "./dist/index.js" },
  "./providers/ollama":      { "types": "./dist/providers/ollama/index.d.ts","default": "./dist/providers/ollama/index.js" },
  "./providers/generic-openai": { … },
  "./providers/groq":        { … },
  "./providers/gemini":      { … },
  "./providers/azure-openai":{ … }
}
```

## Design detail

### gepa-core repo (SLICE-A — owner side)

**Build-config gotcha (architect-review HIGH, confirmed on disk):** gepa-core's
`src/*` uses **`.ts`-extension relative imports** (`export * from
"./types/index.ts"`), which is only legal because its `tsconfig.json` pairs
`allowImportingTsExtensions: true` with `noEmit: true`. TypeScript forbids
`allowImportingTsExtensions` alongside real emit (`noEmit: false`). Naively
flipping `noEmit:false` → `tsc` hard-errors (or, if the flag is dropped, every
relative import throws TS2691). **The build config MUST set
`rewriteRelativeImportExtensions: true`** (TS 5.7+) — it keeps `.ts` specifiers in
source (for Bun/native runs) and rewrites them to `.js` in emitted output. This is
the single load-bearing detail; without it the whole plan fails at build.

1. Add `tsconfig.build.json` extending the base: `outDir: dist`, `rootDir: src`,
   `declaration: true`, `noEmit: false`, **`rewriteRelativeImportExtensions:
   true`**, `sourceMap: true`, `declarationMap: true`, exclude `tests/`.
   Keep `module`/`moduleResolution: nodenext`.
2. Bump `devDependencies.typescript` `^5.5.0 → ^5.7.0` (floor for
   `rewriteRelativeImportExtensions`). Add `"build": "tsc -p
   tsconfig.build.json"`.
3. Flip all 6 `exports` entries src→dist (table above), preserving the separate
   provider entry points so peer-dep SDKs (`@azure/openai`,
   `@google/generative-ai`, groq) stay lazily loaded per entry. **Also flip the
   legacy root fields** `"main": "./src/index.ts" → "./dist/index.js"` and add
   root `"types": "./dist/index.d.ts"` — resolvers ignoring the `exports` map
   (classic/node10 moduleResolution) fall back to `main` and would silently
   re-land on raw `.ts`.
4. `"files": ["dist"]` + `.npmignore` for `src/`, `tests/`, configs — published
   tarball ships JS only.
5. `"prepublishOnly": "bun run build"` so a publish can never ship stale/absent
   dist. **Add a PR-time CI gate** in gepa-core: `bun run build && node -e
   "import('./dist/index.js')"` — catches a `src/` change that type-checks under
   the dev `noEmit:true` config but breaks the real build, at merge time not at
   the publish ceremony.
6. Fix the pre-existing inert `peerDependenciesMeta` (architect MED): it lists
   `@azure/openai` + `@google/generative-ai` with **no matching
   `peerDependencies` block**, so npm/pnpm silently ignore it. Add the
   `peerDependencies` block (or accept the provider-isolation risk knowingly).
   Cheap to fix while already editing this file.
7. Bump `0.6.0 → 0.7.0` (MINOR — packaging change, public API unchanged;
   deep-imports of `/src/*` would break but none are sanctioned). CHANGELOG entry
   noting the src→dist flip + the no-deep-`/src/*` caveat.
8. Publish 0.7.0 (new version — no unpublish-lockout risk). **Rollback is
   migration-class, not revert:** npm publish is irreversible; a broken 0.7.0 is
   forward-fixed with 0.7.1, never unpublished (cf. the v0.2.0 24h-lockout scar).

### crew repo (SLICE-B — consumer side)

1. Bump gepa-core dep to `0.7.0` in `package.json`. **Pin EXACT `0.7.0`** (not
   `^0.7.0`) until the dist build has proven stable in crew — architect MED:
   an exact pin blocks a surprise 0.7.x from re-introducing a packaging
   regression before confidence is established. Loosen to `^0.7.0` after.
2. `bun install` (regenerates `bun.lock`).
3. Verify parity: `node scripts/crew.ts gepa-optimize reviewer --artifact-only`
   exits 0 (AC-3); a Node-path artifact write now yields a `source:"captured"`
   trial (AC-4); **and `bun run typecheck` passes** against the new exports shape
   (crew's `moduleResolution: Bundler` must still resolve gepa-core — CLI exit-0
   alone doesn't prove TS resolution).
4. Confirm Bun path still green (AC-6).
5. (Optional, opportunistic) remove `package-lock.json` to end dual-lockfile
   drift — or defer to FEAT-190.

## Independence from ADR-003 outcome

gepa-core shipping `dist/` is valid **regardless** of whether the full Bun sweep
(FEAT-190 / ADR-003 Option A) ever lands. Even in a Bun-only crew, gepa-core as a
*reusable library* should ship runnable JS for any future non-Bun consumer (per
ADR-003's own "Revisit conditions"). So SLICE-B re-validating the `node
scripts/crew.ts …` path is not wasted work if ADR-003 later retires that path —
the dist artifact is the durable win; the crew Node-path check is just this
FEAT's acceptance proof.

## Acceptance criteria

- **AC-1:** Given gepa-core, When `bun run build` runs, Then `dist/index.js` +
  `dist/index.d.ts` and all 5 provider `dist/providers/*/index.{js,d.ts}` exist.
- **AC-2:** Given the published 0.7.0 tarball, When `npm pack` is inspected, Then
  it contains `dist/` and **no** `src/` or `tests/`.
- **AC-3:** Given crew on gepa-core 0.7.0, When `node scripts/crew.ts
  gepa-optimize reviewer --artifact-only` runs, Then exit 0 with an
  `OptimizationResult` JSON and **no** `Stripping types … node_modules` error.
- **AC-4:** Given crew on Node, When a slice writes a dispatch artifact for an
  allowlisted agent, Then a `source:"captured"` trial is appended (capture no
  longer silently drops under Node).
- **AC-5:** Given the Bun path, When `bun test` + `bun scripts/crew.ts gepa-*`
  run, Then all remain green (no regression from the format change).
- **AC-6:** Given the release, Then gepa-core is `0.7.0` with a CHANGELOG entry
  and crew `package.json` pins `^0.7.0`.

## Slice plan + ETA

| Slice | Repo | Scope | ETA |
|---|---|---|---|
| SLICE-A | gepa-core | tsconfig.build + build script + exports flip + files/.npmignore + prepublishOnly + 0.7.0 + CHANGELOG + publish | 0.5 d |
| SLICE-B | dev-team (crew) | dep bump ^0.7.0 + bun install + Node/Bun parity verify + optional lockfile consolidation | 0.25 d |

**Engineering ~0.75 day. Calendar ~1–2 days** (gepa-core publish ceremony +
cross-repo dep propagation). SLICE-B blocks on SLICE-A being published.

## Risks + mitigations

| Risk | Sev | Mitigation |
|---|---|---|
| Publish ceremony friction (2FA, @astragenie scope → npmjs vs GH Packages) | Med | New version 0.7.0 (no unpublish lockout); scope override already pinned (`.npmrc`) |
| Stale/absent dist shipped | Med | `prepublishOnly: bun run build` + `files: ["dist"]` + `npm pack` inspection in AC-2 |
| Provider entry points lose lazy peer-dep isolation after dist flip | Med | Keep 1:1 entry-point mapping; verify importing a provider without its SDK still throws the clean install error |
| Windows CRLF / biome on gepa-core build | Low | `.gitattributes` LF pin already in gepa-core; build emits LF |
| Deep-import consumers of `/src/*` break | Low | None sanctioned; note in CHANGELOG as the only surface affected |

## Alternatives (rejected here; see ADR-003)

- **Full Bun sweep (FEAT-190):** larger (~4 d), reverses ADR-002 across all
  surfaces. Deferred — this plan is the narrow unblock.
- **Require Node 24:** does not help — node_modules TS guard is version-independent.
- **Vendor/bundle gepa-core into crew:** duplicates the library, defeats the
  shared-lib intent; rejected.

## Cross-repo execution note

gepa-core edits must run in a **gepa-core session/worktree**, not from the crew
checkout (per repo cross-repo-edit rule). This plan hands SLICE-A to that session
as a ready spec; SLICE-B lands in crew after 0.7.0 publishes.
