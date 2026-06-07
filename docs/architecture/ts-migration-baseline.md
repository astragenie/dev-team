# TS Migration Baseline — 2026-06-07

Captured at Phase 0 close, before any `.mjs` rename. Subsequent phase plans update this doc with their post-phase numbers.

**Machine spec:** Windows 11, NVMe SSD, Node v24.16.0.

**Commit at baseline:** Phase 0 foundation (post-SLICE-16 commit).

## Code metrics

| Metric | Value |
|---|---|
| `.mjs` LoC under `scripts/`, `hooks/`, `tests/` | 20,180 |
| ESLint problems | 0 errors, 0 warnings |
| `.ts` files | 3 (`scripts/lib/result.ts`, `scripts/lib/ids.ts`, `scripts/lib/schemas.ts`) |
| Tests | 414 total (414 pass, 0 fail) |

## Performance — brief-me

5 sequential runs. p50 = median, p95 = second-to-max.

| Scenario | p50 | p95 |
|---|---|---|
| brief-me (5 runs) | 154ms | 163ms |

Note: Windows does not expose a userspace FS cache flush, so all 5 runs are "warm-ish" (OS cache primed after first). Cold timing not separately measurable without restart.

## Cost discipline

- Recent slice cost average: ~$80/slice (last 5 reports).
- Sonnet share of model spend: improving (user switched default to Sonnet 4.6 mid-session).
- `costStopThreshold` raised to 10 to allow autonomous loop to proceed past legacy Opus-heavy alert window.

## Notes

- `tsconfig.json`: `strict: true, checkJs: false` — only `.ts` files type-checked. Existing `.mjs` files migrate one-by-one in subsequent phases.
- `allowImportingTsExtensions: true` — required for `--experimental-strip-types` import resolution.
- `validate:typegraph` is advisory (`continue-on-error: true` in CI); becomes blocking in Phase 5.
- Node minimum: 22.6+ (strip-types stable). Tested on v24.16.0.
- Subsequent phase plans append a new row to each table at phase close.
