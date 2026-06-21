# Engineering OS Constitution

This repository uses the Engineering OS harness for structured software work inside Claude Code.

## Core Rules

1. Keep one owner per task. Shared ownership creates merge conflicts and confused accountability that cost the user time.
2. Keep task scope explicit. Ambiguous scope leads to wasted effort and work that has to be redone.
3. Retrieve bounded repo context before substantial work. Starting without it means paying for rediscovery that was already done.
4. Structured handoffs protect the user from lost context. Without them, the next agent or session starts blind.
5. Treat review as a gate, not a courtesy. Unreviewed code reaching the user's repo is a quality risk they cannot easily undo.
6. Treat validation and deployment evidence as separate gates when behavior or environments are involved. The user needs to know that changed behavior works, not just that code looks correct.
7. Leave durable artifacts and repo memory behind when work would matter later. Skipping them means the next session has no record of what happened or why.

## Team Roles

- lead: planning, delegation, synthesis
- builder: bounded implementation
- reviewer: independent change review
- validator: behavior and scenario verification
- deployer: deployment and environment evidence
- researcher: read-only investigation

## Peer dispatch (v0.36+)

As of FEAT-163 (DEC-022, DEC-023), 10 agents carry the `Agent` tool and may dispatch peers within a declared whitelist. Peer dispatch is opt-in and scoped: each agent's `## Peer dispatch` section names exactly which peers it may call and which it must never call.

Review and validation gates (`crew:inspector`, `crew:inspector-verifier`, `crew:verifier`) remain orchestrator-only per the hard rule in FEAT-163 line 40. No agent may dispatch its own reviewer. The loop walker (autonomous path) or the lead (interactive path) dispatches review and validation gates after the builder's handoff lands.

Lead-as-sole-orchestrator remains supported for the interactive `/crew:build` path. The autonomous loop uses `slice-build` dispatch (lives in `src/scripts/lib/slice-linker/dispatch.mts`) as the live orchestrator — peer dispatch reduces the orchestrator's routing burden by letting each agent fetch upstream dependencies and hand off downstream artifacts without a central relay.

## Memory And Artifact Habit

The user depends on artifacts to resume work after compaction, across sessions, or when context is lost.

Substantial work should start from bounded repo memory:

- `CLAUDE.md`
- `.claude/crew/*.md`
- latest relevant wake-up context and artifacts

Substantial work should leave inspectable artifacts under:

- `.claude/artifacts/crew/runs/`
- `.claude/artifacts/crew/handoffs/`
- `.claude/artifacts/crew/reviews/`
- `.claude/artifacts/crew/validations/`
- `.claude/artifacts/crew/deployments/`

For shipping work, keep durable repo deployment guidance in:

- `.claude/crew/deployment.md`

## Scope Discipline

These situations create merge conflicts, wasted effort, or confused ownership that costs the user time. Stop and re-scope if:

- two agents need the same file
- the assignment boundary is unclear
- the work needs a broader refactor than assigned

## Commit Discipline

Baseline: do not create commits unless the user explicitly asks. Unrequested commits in the user's repo are a quality and trust risk they cannot easily undo.

Exception — `dev.stable: true` worktree carve-out (revised 2026-06-21):

If `.claude/crew/deployment.md` has `dev.stable: true` AND the builder is on a feature branch or worktree (NOT `main` / `master`), the builder MAY commit autonomously when ALL of:

- **Slice-scoped tests pass** — the tests that actually exercise the changed files. Mandatory.
- **Pre-completion secret grep passed** — no credentials in diff. Mandatory.
- **No `help_request` badge open.** Mandatory.
- **Commit is local-only** — never a release tag, never a force-push, never a production deploy.

NOT required to block the commit (deferred to the orchestrator's review cycle):

- typecheck (`tsc --noEmit` for TS; `dotnet build` for C#) — fast on TS (~1s), slow on C# (5-30s+). Advisory.
- lint (Biome / Roslyn analyzers). Advisory.
- format:check. Advisory.

Rationale: slice-scoped tests catch functional regressions. typecheck / lint / format catch style + type drift — those are cheap to fix later and run as part of the orchestrator's review + validation dispatch. Blocking the autonomous commit on every full-suite gate kills slice velocity, especially on C# / large solutions where build + analyzers take 30s+ per cycle.

Branch protection: if the current branch is `main` or `master`, fall back to baseline (ask first) — `dev.stable` does NOT unlock commits to mainline.

The user may override at any time by saying "do not commit" or equivalent during the session. Session-level instruction always beats the repo flag.

Production promotion, tag pushes, and force-pushes are NEVER unlocked by `dev.stable` — they still require explicit user approval per the deployer rules.

See `agents/release-engineer.md` → Deployment guidance schema for the field definition.

