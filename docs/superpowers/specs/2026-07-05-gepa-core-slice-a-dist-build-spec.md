# SLICE-A spec — gepa-core dist build (FEAT-191)

**Run this in a `astragenie/gepa-core` session/worktree, NOT from the crew checkout.**
Cross-repo edit rule: crew must not edit gepa-core's live checkout.

**Goal:** gepa-core builds compiled `dist/` (JS + `.d.ts`), flips `exports` +
`main` + `types` from `src/*.ts` → `dist/*.js`, publishes `0.7.0`. No API change.

Verified against `@astragenie/gepa-core@0.6.0` as installed 2026-07-05.

---

## Step 1 — new file `tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "rewriteRelativeImportExtensions": true
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*", "scripts/**/*"]
}
```

**Why `rewriteRelativeImportExtensions` is load-bearing:** src uses `.ts`-extension
imports (`export * from "./types/index.ts"`). The base tsconfig pairs
`allowImportingTsExtensions: true` with `noEmit: true`. Real emit (`noEmit:false`)
is illegal with `allowImportingTsExtensions` **unless** this flag is set — it keeps
`.ts` in source (Bun/native) and rewrites to `.js` in emitted JS. Without it `tsc`
hard-fails. (`verbatimModuleSyntax: true` + `isolatedModules: true` in the base
config are compatible with this flag on TS 5.7+.)

`allowImportingTsExtensions` stays `true` (inherited) — required alongside the
rewrite flag.

## Step 2 — `package.json` edits

Before → after (only changed keys shown):

```jsonc
// version
"version": "0.6.0",              →  "version": "0.7.0",

// legacy root fields (node10 resolvers bypass `exports` and hit these)
"main": "./src/index.ts",        →  "main": "./dist/index.js",
//  (add)                            "types": "./dist/index.d.ts",

// exports — every entry: string → { types, default }
"exports": {
  ".":                        "./src/index.ts",
  "./providers/ollama":       "./src/providers/ollama/index.ts",
  "./providers/generic-openai":"./src/providers/generic-openai/index.ts",
  "./providers/groq":         "./src/providers/groq/index.ts",
  "./providers/gemini":       "./src/providers/gemini/index.ts",
  "./providers/azure-openai": "./src/providers/azure-openai/index.ts"
}
   ↓
"exports": {
  ".":                         { "types": "./dist/index.d.ts",                  "default": "./dist/index.js" },
  "./providers/ollama":        { "types": "./dist/providers/ollama/index.d.ts", "default": "./dist/providers/ollama/index.js" },
  "./providers/generic-openai":{ "types": "./dist/providers/generic-openai/index.d.ts", "default": "./dist/providers/generic-openai/index.js" },
  "./providers/groq":          { "types": "./dist/providers/groq/index.d.ts",   "default": "./dist/providers/groq/index.js" },
  "./providers/gemini":        { "types": "./dist/providers/gemini/index.d.ts", "default": "./dist/providers/gemini/index.js" },
  "./providers/azure-openai":  { "types": "./dist/providers/azure-openai/index.d.ts","default": "./dist/providers/azure-openai/index.js" }
}

// add publish allowlist — ships JS only, no src/tests/configs
"files": ["dist"],

// scripts — add build + prepublish guard
"scripts": {
  ...existing,
  "build": "tsc -p tsconfig.build.json",
  "prepublishOnly": "bun run build"
}

// devDependencies — floor for rewriteRelativeImportExtensions (TS 5.7)
"typescript": "^5.5.0",          →  "typescript": "^5.7.0",

// add peerDependencies to make the existing peerDependenciesMeta actually work
//  (meta with no matching peerDependencies block is silently ignored by npm/pnpm)
"peerDependencies": {
  "@azure/openai": "*",
  "@google/generative-ai": "*"
}
// keep the existing peerDependenciesMeta { optional: true } for both
```

`types` order-before-`default` in each export entry is required by TS resolution.
Single `default` condition is correct — `"type": "module"` is already set, no CJS
build.

## Step 3 — build + local verify (before publish)

```bash
bun install                       # picks up typescript ^5.7
bun run build                     # emits dist/
# AC-1 runtime smoke — emitted specifiers must resolve under Node ESM:
node -e "import('./dist/index.js').then(()=>{console.log('ok');process.exit(0)}).catch(e=>{console.error(e);process.exit(1)})"
# AC-2 tarball check — dist only, zero src/tests:
npm pack --dry-run 2>&1 | grep -E 'src/|tests/' && echo "LEAK" || echo "clean: dist only"
bun test                          # AC-6 gepa-core suite still green
bun run typecheck                 # base config (noEmit) still passes
```

Expect: `ok`, `clean: dist only`, green tests.

## Step 4 — provider isolation check (AC-5)

In a throwaway dir WITHOUT `@azure/openai` installed:
```bash
node -e "import('@astragenie/gepa-core/providers/azure-openai').catch(e=>console.log(e.message))"
```
Expect the existing clean install-instruction error, NOT a module-resolution
crash. Confirms the dist flip didn't hoist the peer SDK across entry points.

## Step 5 — CI gate (add to gepa-core's own workflow)

Add a **blocking PR step** so a src change that type-checks under the dev
`noEmit:true` config but breaks the real build is caught at merge, not publish:
```yaml
- run: bun run build && node -e "import('./dist/index.js')"
```

## Step 6 — CHANGELOG + version + publish

1. `CHANGELOG.md` — new `## 0.7.0` dated entry:
   - "Packaging: `exports`/`main`/`types` now point at compiled `dist/` (was raw
     `src/*.ts`). Fixes Node consumers — Node cannot type-strip TS under
     node_modules. No public API change."
   - Caveat: "Deep imports of `@astragenie/gepa-core/src/*` are no longer
     resolvable (never sanctioned)."
2. Version already `0.7.0` from Step 2.
3. Publish:
   ```bash
   npm publish            # prepublishOnly runs bun run build automatically
   ```
   - 2FA token if prompted. New version → no unpublish-lockout risk.
   - If publish ships broken: **forward-fix 0.7.1, never unpublish** (cf. v0.2.0
     24h-lockout scar).

## Handoff to crew (SLICE-B, separate)

After 0.7.0 publishes, in the crew session:
- `package.json` dep → pin **exact `"0.7.0"`** (not `^`) until stable.
- `bun install`; verify AC-3 (`node scripts/crew.ts gepa-optimize reviewer
  --artifact-only` exit 0, no strip-types error), AC-4 (captured trial appended
  under Node), AC-6 (`bun run typecheck` + Bun path green).

## Done-when

AC-1..AC-7 in `.claude/artifacts/loop/backlog/pending/FEAT-191-gepa-core-dist-node-parity.md`
all green.
