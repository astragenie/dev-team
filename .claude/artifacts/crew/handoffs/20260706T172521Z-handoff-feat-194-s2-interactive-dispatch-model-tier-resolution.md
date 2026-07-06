# Task Handoff: FEAT-194 S2 — interactive dispatch model-tier resolution

- Created: 2026-07-06T17:25:21.665Z
- From: aiplugin-dev
- To: dispatcher
- Objective: Interactive /crew:build, /crew:fix, /crew:orchestrate-slice now resolve+pass the builder model tier explicitly via a new crew resolve-model CLI subcommand, instead of inheriting the session model.
- Allowed Scope:
  - scripts/lib/models/resolve-model.ts (pure resolver
  - mirrors runner-plugin model-router semantics: phase lookup + default fallback + trivial-shape override table); scripts/crew.ts resolve-model subcommand (reads .claude/loop.json loop.modelRouting); commands/build.md
  - commands/fix.md
  - commands/orchestrate-slice.md dispatcher instructions to run resolve-model before every builder Agent-tool dispatch and pass model: explicitly
- Forbidden Scope:
  - S1 (feature-flag toggle for model routing)
  - S3 (reconcile agents model_pinned)
  - S4 (cost/token telemetry) — separate FEAT-194 slices
  - not touched. No hook-level enforcement (S2b) built — the resolution is orchestrator-honored prose only.
- Deliverable: crew resolve-model --phase <phase> [--shape <shape>] [--repo <path>] prints the resolved model string; 3 command files updated with concrete, hard-to-miss dispatch instructions + an explicit honest-limitation note each
- Changed Files:
  - scripts/lib/models/resolve-model.ts
  - tests/resolve-model.test.ts
  - scripts/crew.ts
  - commands/build.md
  - commands/fix.md
  - commands/orchestrate-slice.md
- Confidence: high
- Risks: No hook enforces the interactive-path instruction (unlike the autonomous wave path's programmatic model-router) — relies on the dispatcher LLM actually running resolve-model and passing model: explicitly; flagged in every command file as a possible S2b PreToolUse-hook follow-up, not built here. resolve-model is a deliberate self-contained mirror of runner-plugin's model-router (no shared package boundary between the two plugin repos today) — if runner-plugin's resolveModel/resolveShapeTier semantics change, this copy needs a matching update; noted in the module's file-header comment.
- Suggested Next Handoff: S2b: PreToolUse hook on Agent that injects the resolved model when model: is absent, closing the enforcement gap noted above. FEAT-194 S1/S3/S4 remain separate pending slices.

