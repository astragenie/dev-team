# Task Handoff: FEAT-188 pre-flight — runner-plugin memory-bridge capability map

- Created: 2026-07-06T11:55:23.525Z
- From: researcher
- To: dispatcher
- Objective: The dormant astramem memory-bridge (emit/recall/remember/doctor) is fully implemented, fail-silent, and config-gated; it only activates once astramem CLI ships, and the local runner-plugin checkout has two unreleased fixes not yet in the installed 0.61.0 cache.
- Allowed Scope:
  - Read-only reverse-engineering of memory-bridge.mts
  - memory-recall.mts
  - memory-sink.mts
  - memory-doctor.mts
  - memory-context.mts
  - start-slice.mts recall/emit wiring
  - docs/sop/memory-bridge.md
  - and all config.memory.* parsing sites in C:/work/mega/runner-plugin (commit 65c741d
  - 2026-07-05) vs installed cache ~/.claude/plugins/cache/astra/runner/0.61.0 (2026-07-04).
- Forbidden Scope: -
- Deliverable: Full findings returned inline to dispatcher: emit() GEPA payload contract, recallPrior() contract, exact astramem CLI argv for ingest/recall/remember/doctor, complete config.memory.* key inventory, dormancy gate, and the 4 lifecycle hook points.
- Changed Files:
  - src\scripts\lib\memory-bridge.mts
  - src\scripts\lib\memory-recall.mts
  - src\scripts\lib\memory-sink.mts
  - src\scripts\lib\memory-doctor.mts
  - src\scripts\lib\memory-context.mts
  - src\scripts\lib\slice-linker\start-slice.mts
  - docs\sop\memory-bridge.md (all in C;C:\Program Files\Git\work\mega\runner-plugin)
- Confidence: high
- Risks: Two unreleased fixes exist in source but not in installed 0.61.0 cache: (1) Windows CLI candidate resolution (astramem.exe/.cmd/.bat) — 0.61.0 only checks bare 'astramem', silently failing to resolve on Windows; (2) DEC-065/066 --project fix — 0.61.0 still passes featId as --project (a known bug per source comments), so recall against 0.61.0 would always return []. Any FEAT-188 plan built against the installed cache must account for this drift or require a runner-plugin bump first. astramem CLI itself does not exist yet anywhere (memory-plugin v0.4 unshipped) so none of this is live-testable today.
- Suggested Next Handoff: FEAT-188 architect should diff this capability map against the proposed FEAT-188 design to identify what's net-new vs already-built-but-dormant, and decide whether to pull in the unreleased runner-plugin fixes (Windows CLI resolution + DEC-065/066 project param) as a prerequisite bump.

