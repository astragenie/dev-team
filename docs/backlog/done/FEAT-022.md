---
id: FEAT-022
status: done
priority: P3
category: workflow
target_release: 0.3.5
created: 2026-05-24
updated: 2026-05-24
depends_on: [FEAT-018]
slices: []
resolution: "D2+D3 shipped (bf5eb55), D4 shipped (ead5401), D1 dropped per operator decision"
derived_from: null
autonomous_safe: true
phase: 2
trigger: "subagent pauses recur at maxTurns 40/35 (post-73aaf03 caps)"
---
# FEAT-022: Subagent pause root-cause investigation — 4 workflow drivers

## Description

This FEAT is **trigger-gated**: do not pick it up until subagent pauses
recur under the new maxTurns caps (builder 40, reviewer 35 per commit
`73aaf03`). When pauses recur, investigate the 4 suspected workflow
drivers per the table below, ship the targeted remediation for whichever
hypothesis confirms, and re-measure.

Background: this session saw 3 subagent pauses (reviewer SLICE-02 at
46 tool uses / cap 25; builder SLICE-03 at 36 tool uses / cap 30).
Operator declined to bump caps further than 40/35; if those caps are
also hit, the root cause is in workflow, not budget.

## Scope

In scope:

- For each of the 4 drivers below, run a 1-slice investigation:
  - Reproduce the pause with a tagged test slice.
  - Collect the measurement signal listed.
  - Ship the targeted remediation if hypothesis confirms; explicit
    "no signal" close if it does not.
- Each driver = independent slice. Run only the slices for drivers
  whose pauses actually occurred — do not pre-emptively investigate
  all 4.

### Driver matrix

| # | Driver | Hypothesis | Measurement signal | Remediation if confirmed |
|---|---|---|---|---|
| D1 | Builder Read→Edit→Read | Verification re-Reads burn 2–3 tool turns per file × N files = waste. Rule 6 in FEAT-018 should reduce this but may not catch every case. | Count `Read` tool calls within 2 turns of `Edit`/`Write` for the same file path. From `.claude/artifacts/crew/cost/<slice>-cost-report.md` tool-usage section. Threshold: >20% of Edit/Write calls followed by Read of same path = confirmed. | Strengthen the Rule 6 prompt wording in builder/reviewer/validator with a concrete anti-example block + add a cost-report dashboard line "Re-Read after Edit count: N (target: 0)". Prompt-only — **no PreToolUse hook** (operator decision: hard-block risk on legitimate verification reads outweighs the win). |
| D2 | Reviewer full-file Read | Reviewer Reads whole files (e.g. 500-line `slice-linker.mjs`) instead of grep-then-targeted-Read. Wastes context + turns. | From cost-report tool-usage: avg `bytes-per-Read` for reviewer agent. Threshold: avg > 5KB OR ratio of `Read` vs `Grep` tool uses > 2:1 = confirmed. | Add "grep before Read" rule to `agents/reviewer.md` Reviewer-skill-checklist section. Add concrete pattern example: `Grep "AC-1.*:" docs/ai-loop/slices/.../SLICE_NN_*.md` to find AC by name, then `Read offset:<line> limit:5` to inspect. |
| D3 | Multi-AC sequential Bash | Each AC fires its own `Bash` call instead of batched. N ACs × N Bash = N × 1.5s × turn-cost overhead. | From cost-report tool-usage: count of `Bash` tool calls per slice vs count of declared ACs in slice spec. Ratio > 1.5:1 = confirmed. | Add "batch grep ACs into single Bash" pattern to reviewer prompt + commit skill. Provide concrete one-liner: `for ac in AC-1 AC-2 ...; do echo "=== $ac ==="; grep "$pattern_$ac"; done`. |
| D4 | Subagent repo rediscovery | Subagent re-greps for repo layout (`ls scripts/`, `cat package.json`, `find skills/`) early in its run, burning 3–5 turns on context it could inherit from the handoff. | From cost-report tool-usage: count of layout-discovery Bash/Glob calls (matching patterns `ls`, `find .* -type`, `cat package.json`, etc.) in first 5 turns of a subagent run. Threshold: ≥2 = confirmed. | Extend `write-handoff` CLI to include a `--repo-context` flag that injects a pre-discovered layout block (scripts/ files, tests/ files, agents/ list) into the handoff. Subagent reads handoff first, skips rediscovery. |

## Out of scope

- Pre-emptive investigation of drivers that have not actually
  surfaced. Triage by signal, not speculation.
- Cap-bumping past 40/35. Per operator decision: if pauses recur,
  fix workflow not budget.
- Adding observability dashboards. Cost-report tool-usage section is
  sufficient ground truth.

## Acceptance hints

- A test slice tagged with the driver under investigation reproduces
  the pause condition (or proves the hypothesis wrong by NOT pausing).
- Measurement signal collected from `.claude/artifacts/crew/cost/`
  cost-report tool-usage section; values recorded in the slice grade.
- If hypothesis confirmed: remediation shipped in a focused slice;
  pause condition re-measured; should not recur on the same scenario.
- If hypothesis NOT confirmed: slice closes with `decision: not_confirmed`
  in the slice grade, no remediation shipped. Free up FEAT-022 backlog
  position for the next driver.
- No regressions: `npm run lint && npm test && validate-{manifests,
  skills,routing-table}` all pass.

## Risks / open questions

- **Trigger condition might never fire.** New 40/35 caps may be enough
  for routine work; FEAT-022 sits in pending forever. Mitigation: it
  is P3, deferred. No harm.
- **Multiple drivers may co-trigger.** Investigation order: pick the
  driver with the strongest measurement signal first. Often one
  remediation moves the needle enough that the others self-resolve.
- **Cost-report tool-usage granularity.** Current cost-report tracks
  tool name + count but not per-tool argument detail (e.g. "Read what
  file"). May need a small cost-report extension to track file paths
  for D1 + D2 measurements. Treat as a sub-task of whichever driver
  is investigated first.
- **PreToolUse hook explicitly out of scope.** Operator decision
  (this session): hard-block on Read carries too much risk vs prompt-
  only remediation. D1 stays prompt-only forever.

## Followups (not in this FEAT)

- If D4 confirmed, the `--repo-context` flag is a candidate for a
  `write-handoff` v2 (richer field set than FEAT-018 contract).
- If D2/D3 confirmed and the reviewer prompt addendums work, consider
  authoring a `skills/workflow/efficient-review/SKILL.md` that
  centralizes the patterns.
