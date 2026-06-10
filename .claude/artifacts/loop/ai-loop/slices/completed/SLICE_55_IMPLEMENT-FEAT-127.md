---
id: SLICE-55
status: completed
feature: FEAT-127
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-08
updated: 2026-06-10
completed_at: 2026-06-08
---
# SLICE-55: Implement FEAT-127

Implements FEAT-127. See [feature file](../../../backlog/in-progress/FEAT-127.md) for product context.

## Objective

`countFiles()` (lines 57–71) and `listFilesNewestFirst()` (lines 78–93) in `scripts/lib/wakeup.mjs` call `await fs.stat()` inside serial loops — N syscalls per directory.

## In scope

- `scripts/lib/wakeup.mjs` — `countFiles()` and `listFilesNewestFirst()` only

## Out of scope

- Any other files in wakeup.mjs
- Other wakeup modules

## Acceptance criteria

- [ ] AC-1: `countFiles(dir)` uses `readdir(dir, {withFileTypes:true})` + `entry.isFile()` — no `stat()` call inside a loop
- [ ] AC-2: `listFilesNewestFirst(dir)` uses `readdir+withFileTypes` then `Promise.all` for mtime batch — no serial `stat()` loop
- [ ] AC-3: Existing tests for these functions pass unchanged
- [ ] AC-4: `node --test --experimental-strip-types` passes, `npm run lint` zero warnings

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-127 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
