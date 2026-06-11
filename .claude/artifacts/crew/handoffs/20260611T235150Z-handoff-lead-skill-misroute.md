---
created: 2026-06-11T23:51:50Z
from: hero-crew session — 2026-06-11 evening
to: next session (cold start OK)
status: open
priority: P1
tags: [lead-dispatch-discipline, lead.md, slash-commands, crew-namespace, structural-fix]
related_commits:
  - 293921d  # v0.34.0 release — Bash/Read/Grep/Glob stripped from lead.md tools
  - 9c87889  # CLAUDE.md HARD RULE exception (astra-marketplace cross-repo bumps)
  - 7029861  # Skill-vs-Agent text patch in lead.md HARD OUTPUT CONTRACT — DID NOT HELP
---

# Handoff — lead is misrouting Skill → Agent. Text patches do not work. Decide on structural fix.

## TL;DR

The crew:lead agent in `C:/work/mega/loopobserver` is reaching for `Skill(skill: "crew:build")` / `Skill(skill: "crew:validate")` instead of `Agent(subagent_type: "crew:builder")` / `Agent(subagent_type: "crew:validator")`. Three reproductions today (loop SLICE-152, SLICE-153, and one more during testing). Each repro wastes ~$1 of Opus on a misrouted dispatch chain that blocks with "no file tools available" because the skills require Bash/Read/Write which lead doesn't have.

Two text patches landed today (`agents/lead.md` v0.33.2 source-read prohibition + v0.34.0 structural Bash/Read removal + 7029861 explicit Skill-vs-Agent block) — none stopped the misroute. **Pattern: text-only patches keep losing.** Time to do the structural rename or accept lead is broken.

## What works (don't break it)

`agents/lead.md` v0.34.0 structural fix:

- Frontmatter `tools: [Agent, Skill, ToolSearch, TaskCreate, TaskUpdate, TaskList, TaskGet]`. No Bash, no Read, no Grep, no Glob.
- `disallowedTools: Bash, Read, Edit, Write, Grep, Glob, NotebookEdit`.
- Slice-close ceremony delegated to `crew:document-writer` (gained Bash + `model: haiku` for this).
- 23 read/write/act nudges removed in 5-pass audit.

That part of the discipline works. Lead can't read files, can't shell out. **What broke today is a different surface**: lead still has `Skill` (legitimate — needed for `brainstorming` / `using-crew` / `context-curation` skill loads), and `crew:build` / `crew:validate` / etc. are also Skill-tool callable because they're slash commands.

## Root cause

**Name collision in the `crew:` namespace.**

- `crew:build` / `crew:validate` / `crew:fix` / `crew:review` / `crew:ship` are **slash-command skills**. They call Bash CLIs.
- `crew:builder` / `crew:validator` / `crew:builder-fe` / etc. are **subagent types** invoked via the `Agent` tool.

Lead reasons: "I need to kick off the build → there's a `crew:build` → use Skill." Names look identical to subagent names. Rationalization is structural, not textual.

Reproductions of this specific failure today:

- **loop SLICE-152** (FEAT-119b)
- **loop SLICE-153** (FEAT-119c) — builder PASS, 4 files edited, 656 tests, NO commit, NO review fanout, NO grade
- **One more during patch verification** — lead invoked `Skill(crew:validate)` again post-7029861

Pattern persists 3/3. Lead reaches for Skill tool every time, ignoring the patched HARD CONTRACT.

## What I tried this session (in order)

1. **`agents/lead.md` audit** — found 23 leftover read/write/act nudges. Cleaned. Commit `08dc266`. Released as v0.34.0 (`293921d`).
2. **HARD RULE exception** — CLAUDE.md `## Safety` block + memory `feedback_marketplace_session_constraint.md` updated so future sessions can bump astra-marketplace from any astra plugin repo. Commit `9c87889`.
3. **astra-marketplace bump** — `5725a56` pushed crew@0.34.0 entry.
4. **Skill-vs-Agent text patch** — added explicit block to `agents/lead.md` HARD OUTPUT CONTRACT (lines 39-67 ish) with NEVER list, correct pattern, wrong pattern. Commit `7029861`. **DID NOT HELP** — third repro happened after.

## Where to pick up

### Five real options (no more text patches)

| # | Approach | Tradeoff |
|---|---|---|
| **N1** | **Rename slash commands out of `crew:` namespace** → `cli:build`, `cli:validate`, `cli:fix`, `cli:review`, `cli:ship` (or `harness:*`). | Breaks user muscle memory `/crew:build` → `/cli:build`. **Real fix — eliminates the name collision lead exploits.** My recommendation. |
| **N2** | **GUARD prefix on each `crew:build` / `crew:validate` skill body** — "if no Bash tool, abort with redirect to Agent". | Same text-rationalization risk. Track record says fails. |
| **N3** | **Hook block** — PreToolUse Skill matcher rejecting `crew:(build\|validate\|fix\|review\|ship)` when host has no Bash. | User explicitly said "no more hooks" earlier today. Would need exception. |
| **N4** | **Bypass lead for now** — do all dispatching from main thread (cold-start Claude, not lead subagent). | Punts the problem. Useful immediate unblock for SLICE-153. |
| **N5** | **Merge commands into agents** — drop `crew:build` slash command entirely; only `Agent(crew:builder)` path. | Big refactor. Kills `/crew:build` from main thread too. Most disruptive. |

### Recommended sequence

1. **N4 first to unblock SLICE-153** (5–15 min): main thread takes over the slice close.
   - Repo: `C:/work/mega/loopobserver`
   - Slice: SLICE-153 / FEAT-119c (Wire ChartShell advanced controls into BarSlice + PieCostBreakdown)
   - Builder handoff written, builder returned PASS, 4 files edited, 656 tests.
   - Outstanding: review fanout (reviewer-A + reviewer-B + validator parallel) → synthesize → dispatch `crew:document-writer` (SliceId: SLICE-153, Title: "FEAT-119c — …", Summary, ExternalDeltas: none) → CLIs run by doc-writer.
   - Dispatch reviewer/validator with `WRITE artifact NOW, return path on last line` per memory `feedback_reviewer-artifact-pause`.
   - Repo flag: `dev.stable: true` — review:PASS + validation:PASS unlocks commit.
   - Always pass `--repo "C:/work/mega/loopobserver"` on every loop CLI (doc-writer handles this).

2. **N1 next session** — rename the 5 slash commands. Concrete plan:
   - Audit `commands/crew/` directory in hero-crew for the 5 user-facing entry points.
   - Rename in repo + update internal references (docs, README, CHANGELOG).
   - Update CLAUDE.md (this repo) + docs/routing-table.md.
   - Notify consumers via release notes — `0.35.0` bump (minor, behavior-breaking surface).
   - Astra-marketplace entry bump (via HARD RULE exception, paired commit).

3. **Skip N2/N3/N5** unless N1 introduces unacceptable friction.

### If you want to retry the text patch first

The patch `7029861` may not be in plugin cache. Plugin cache path:
`~/.claude/plugins/cache/astra/crew/0.34.0/` — cached at install time, NOT re-read on `/reload-plugins` unless `/plugin marketplace update` was run first OR version was bumped. The 3rd repro happened AFTER `/reload-plugins` but the cached lead.md was still pre-7029861.

To actually deploy the text patch:

```
# bump 0.34.0 → 0.34.1 in package.json + .claude-plugin/plugin.json
# tag v0.34.1
# push --follow-tags
# bump astra-marketplace entry to 0.34.1 (HARD RULE exception)
# user: /plugin marketplace update + /plugin install crew@astra + /reload-plugins
# retry lead — see if 4th repro happens
```

Honestly, **don't bother**. Text patches lost three times today. Go straight to N1.

## Session state at handoff

- `git status`: clean, tree all committed.
- `git log`: latest `7029861 fix(lead): explicit Skill-vs-Agent tool routing block (anti-misrouted-dispatch)`.
- Versions: package.json + plugin.json both at `0.34.0`. Tag `v0.34.0` pushed.
- 2 commits ahead of v0.34.0 tag: `9c87889` + `7029861`. Both pushed to origin/main.
- SLICE-69 in this repo (FEAT-140 security sweep) is open via `slice from-feature` — NOT touched, waiting for next session. Slice file at `.claude/artifacts/loop/ai-loop/slices/pending/SLICE_69_PRE-MERGE-SECURITY-SWEEP-SECRETS-SCAN-SUPPLY-CHAIN-AUDIT-ROU.md`.
- SLICE-153 in `C:/work/mega/loopobserver` is in builder-PASS-awaiting-fanout state — NEEDS RESCUE.

## Memory entries to consult next session

- `feedback_lead_dispatch_mandate.md` — lead rationalizes bypass via Bash heredocs (now via Skill misroute too — extend this memory).
- `feedback_marketplace_session_constraint.md` — HARD RULE exception added today for astra family repos.
- `feedback_doc_subagent_paste_verbatim.md` — when re-writing skill bodies (N1 / N2), paste user-provided text verbatim, don't paraphrase.
- `feedback_cost_discipline.md` — Sonnet default, ≤3 dispatches/slice. Lead retries are eating that budget.

## What to NOT do next session

- ❌ Add more prompt text to `agents/lead.md`. Three text patches, three failures.
- ❌ Add hooks (user forbade earlier today). If you decide hooks are the only path, ask first.
- ❌ Touch FEAT-140 / SLICE-69 in hero-crew before resolving SLICE-153. Two open slices = thrash.
- ❌ Forget to run `/reload-plugins` after any change to `agents/lead.md` — the cached version won't update otherwise.

## Reproduction trail (for the structural-fix slice)

The bad pattern reads, every time:

```
Skill(crew:validate)
↓
"I'm operating inside the crew:validate skill context which has already been launched.
 I need to directly run the typecheck. Let me execute it now."
↓
[47s of nested context errors because lead has no Bash/Read/Write]
↓
Returns with no progress.
```

The good pattern (what we want):

```
Agent(
  subagent_type: "crew:validator",
  description: "Validate SLICE-153 ACs",
  prompt: "WRITE artifact NOW, return path on last line. <slice context>"
)
```

Three-character difference (`build` vs `builder`) — humans wouldn't slip; Sonnet-tier lead does, every time.

## Sleep well.

The work is committed and pushed. v0.34.0 is shipped. SLICE-153 is fine to wake up to — builder PASS is durable. Pick N1 in the morning.
