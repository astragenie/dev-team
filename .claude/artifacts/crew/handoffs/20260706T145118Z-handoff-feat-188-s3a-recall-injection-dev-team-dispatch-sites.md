# Task Handoff: FEAT-188 S3a — Recall injection (dev-team dispatch sites)

- Created: 2026-07-06T14:51:18.935Z
- From: builder
- To: dispatcher
- Objective: One injection helper (scripts/lib/memory/inject-recall.ts) reusing the bridge's ## Prior context (from astramem) format, wired into commands/build.md, fix.md, ship.md retries, orchestrate-slice.md via a new recall-block CLI surface, plus dispatch.mts's emitted DispatchPhase.memory scoping hint. All best-effort (try/catch, never blocks dispatch); byte-identical output confirmed when memory unconfigured (existing golden dispatch-trace fixtures pass unmodified).
- Allowed Scope:
  - S3a only (dev-team dispatch-assembly sites). Explicitly out of scope: S3b (runner-plugin wave runner
  - retiring the bridge's runRecallHook)
  - S4 (astramemProvider)
  - S5 (eval hygiene).
- Forbidden Scope: -
- Deliverable: scripts/lib/memory/inject-recall.ts (buildRecallBlock/injectRecall/formatRecallBlock/loadMemoryConfig), recall-block CLI command in scripts/crew.ts, DispatchMemoryHint field on dispatch.mts's DispatchPhase, wiring in 4 command markdown files, 4 new test files (33 tests total, all passing).
- Changed Files:
  - scripts/lib/memory/inject-recall.ts
  - scripts/lib/memory/index.ts
  - scripts/lib/slice-linker/dispatch.mts
  - scripts/crew.ts
  - commands/build.md
  - commands/fix.md
  - commands/ship.md
  - commands/orchestrate-slice.md
  - tests/memory-inject-recall.test.ts
  - tests/cli-recall-block.test.ts
  - tests/scripts/lib/slice-linker/dispatch.memory-hint.test.ts
  - tests/memory-recall-injection-completeness.test.ts
- Confidence: high
- Risks: autonomous_safe=false per FEAT-188 frontmatter — this handoff is for review, not self-approval. Markdown wiring (build.md/fix.md/ship.md/orchestrate-slice.md) is prose instructing an LLM dispatcher to call the CLI and prepend output — not independently unit-testable the way TS code is; the completeness fitness test greps for the recall-block/DispatchMemoryHint marker string as a proxy. dispatch.mts's memory field is a scoping HINT only (tags+agent) per the pure-plan-generator contract — S3b still owns actually calling injectRecall() at the live dispatch call; until S3b lands, the hint is inert (emitted but unconsumed).
- Suggested Next Handoff: S3b (runner-plugin): wire the loop-plugin's live dispatch call to read DispatchPhase.memory and call injectRecall(); retire the bridge's own runRecallHook at slice-start so it routes through this unified helper (else double-injection).

