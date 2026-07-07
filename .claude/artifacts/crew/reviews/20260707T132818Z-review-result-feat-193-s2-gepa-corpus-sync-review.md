---
findings: "🔴:2,🟡:2,❓:2"
status: completed
decision: rejected
---
# Review Result: Review Result

- Created: 2026-07-07T13:36:21.140Z
- Reviewer: reviewer
- Decision: rejected
- Status: completed
- Summary: needs_fix: gepa-corpus-sync's engine (syncCorpus + AC-1..5 dedup logic) is correct and well-tested, but the shipped CLI is broken for both documented flags and the sync engine throws uncaught on one realistic schema-drift case, contradicting its own robustness claims.
- Evidence Checked:
  - Reproduced live: 'node scripts/crew.ts gepa-corpus-sync --sibling /tmp/foo --json --repo .' -> 'Unknown argument: --sibling' (crashes before runCorpusSyncCmd runs) because --sibling/--json are absent from FLAG_SPEC (scripts/crew.ts:22-133) and applyFlagToken throws on any unrecognized '--' token (scripts/crew.ts:282-284). Reproduced via script: a schema-valid-JSON-but-Trial-schema-invalid sibling row (missing required fields) causes syncCorpus() itself to throw an uncaught ZodError from fileStore().put()'s internal TrialSchema.parse (node_modules/@astragenie/gepa-core/dist/store/file-store.js:42-45)
  - aborting the whole run -- readTrials()'s try/catch (corpus-sync.ts:90-94) only guards JSON.parse syntax errors
  - not schema validation
  - so the code comment 'never throw on a corrupt corpus' is only half true. Byte-level inspection (python) confirmed a literal NUL (0x00) control byte embedded in corpus-sync.ts:65's template literal (Read tool renders it as an invisible space) which causes git to classify the file as binary ('git show --stat' printed 'Bin 0 -> 9452 bytes' instead of a line diff). 5/5 unit tests pass (bun test)
  - typecheck clean
  - biome lint/format clean on the file.
- Files Reviewed:
  - scripts/lib/gepa/corpus-sync.ts
  - tests/gepa-corpus-sync.test.ts
  - scripts/crew.ts
- Test Adequacy: 5 tests cover AC-1..5 against syncCorpus() directly and are non-tautological (real dedup/idempotency/enumeration/marker/read-only assertions with meaningful data). Coverage gaps: zero tests for runCorpusSyncCmd/CLI wiring (would have caught the --sibling/--json crash), zero test for a corrupt/schema-invalid JSONL row (would have caught the uncaught ZodError abort), and no test for the hub's own non-eligible-trial rationale colliding with a new eligible trial's dedup key.
- Risks: 1) Every documented CLI entry point except bare auto-discovery is non-functional today: an operator or the future FEAT-193 S3 gepa-corpus-report automation cannot use --json (needed for machine consumption) or --sibling (needed to override auto-discovery, e.g. in CI/sandboxed environments without real sibling checkouts) without a hard crash. 2) A single sibling repo pinned to a slightly different @astragenie/gepa-core schema version (very plausible given the FEAT's own cross-repo-at-different-times topology) will abort the entire sync run via an uncaught ZodError, losing the whole run's report/remaining-sibling scan even though already-put() trials from earlier in the loop stay persisted. 3) NUL byte makes this file effectively invisible to line-level git tooling (GitHub PR diff view, git blame) going forward -- low functional risk, real reviewability risk.
- Required Follow-up: (a) Register --sibling (repeatable value) and --json (boolean) in FLAG_SPEC and rewire the gepa-corpus-sync handler to actually receive them (mirror how gepa-eval reconstructs rawArgs), plus add a CLI-level regression test exercising both flags. (b) Wrap ingestTrial's hubStore.put() (or syncSibling's loop) in a try/catch that skips-and-counts a schema-invalid trial the same way readTrials skips a JSON-syntax-invalid line, add a report field/log for schema-rejected rows, and add a regression test with a schema-invalid-but-JSON-valid row. (c) Replace the literal NUL byte at corpus-sync.ts:65 with the \0 escape sequence so git stops treating the file as binary. (d) Optional: filter hubExistingKeys() by isProductionFailure for consistency with sibling ingestion, and add a test for the corrupt-JSONL-line skip path already claimed in the code comment.

