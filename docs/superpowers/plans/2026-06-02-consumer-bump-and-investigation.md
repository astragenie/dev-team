# Consumer crew@0.7.0 bump + cost-hotspot investigation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two documents in `hero-crew` — an operations runbook for rolling out crew@0.7.0 + loop@0.5.6 to five consumer repos, and a read-only investigation of three cost-report hotspots (citylive tool-failure-rate, authentic cost-regression, hcal large-tool-output + reread emergency).

**Architecture:** Two standalone markdown documents. Operations doc is a runbook the user follows in a Claude Code session. Investigation doc is read-only triage: read cost reports + session-log directories in each consumer repo, write findings into the doc, do not edit anything in those repos.

**Tech Stack:** Markdown (no code). Bash for file inspection. The `crew` plugin's CLI for verification commands. The plan itself is executed by an engineer with file-read access across `C:\work\mega\<repo>\` and `C:\Users\serge\.claude\projects\`.

**Spec:** `docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md`.

---

### Task 1: Verify hero-crew working tree is clean before starting

**Files:**
- Read: `C:/work/mega/hero-crew/` (git status only)

- [ ] **Step 1: Confirm tree is clean**

Run:
```bash
cd C:/work/mega/hero-crew && git status --short
```
Expected: empty output (no uncommitted changes).

- [ ] **Step 2: If dirty, stop and report**

If `git status --short` shows any output, the plan must not proceed. Write a handoff at `.claude/artifacts/crew/handoffs/<ts>-handoff-plan-blocked-dirty-tree.md` listing the dirty files and return the path to the lead. Lead resolves before re-dispatching.

If clean, proceed to Task 2.

---

### Task 2: Write the operations doc — frontmatter + Purpose + Pre-check

**Files:**
- Create: `docs/operations/2026-06-02-consumer-crew-bump.md`

- [ ] **Step 1: Create the file with frontmatter + opening sections**

Write to `docs/operations/2026-06-02-consumer-crew-bump.md`:

```markdown
---
date: 2026-06-02
kind: operations-runbook
target_release: crew@0.7.0
loop_companion: loop@0.5.6
status: ready-to-execute
audience: user (runs the bump in Claude Code)
related_spec: docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md
---

# Consumer crew@0.7.0 + loop@0.5.6 bump — Runbook

## Purpose

Roll out the perf-stabilization arc (crew@0.4.0..0.7.0 + FEAT-035 quality bar) to the five consumer repos by bumping the user-global Claude Code plugin install. No per-repo file changes; all consumers pick up the new version on next session in their repo.

Target rollout: crew@0.7.0 + loop@0.5.6.

## Pre-check

Before running the bump commands, verify:

1. Claude Code is installed on this machine.
   - POSIX shell: `which claude`
   - PowerShell: `(Get-Command claude).Source`
2. The `v0.7.0` tag exists on the `hero-crew` remote:
   `gh release view v0.7.0 -R sergeymilashico/hero-crew`
3. The `v0.5.6` tag exists on the `hero-crew-autonomous-loop` remote:
   `gh release view v0.5.6 -R sergeymilashico/hero-crew-autonomous-loop`

If any pre-check fails, stop. Either install Claude Code, or wait for the missing release to be cut.

```

- [ ] **Step 2: Verify file shape**

Run:
```bash
wc -l docs/operations/2026-06-02-consumer-crew-bump.md
```
Expected: 30-40 lines so far (frontmatter + two sections written).

---

### Task 3: Write the operations doc — Bump commands + Verification per repo

**Files:**
- Modify: `docs/operations/2026-06-02-consumer-crew-bump.md` (append)

- [ ] **Step 1: Append Bump commands + Verification sections**

Append to `docs/operations/2026-06-02-consumer-crew-bump.md`:

```markdown
## Bump commands

In Claude Code, run these slash commands once at the user level:

```
/plugin marketplace add astra https://github.com/sergeymilashico/hero-crew
/plugin install crew@astra
/plugin install loop@astra
```

If already installed at an earlier version, use the upgrade form:

```
/plugin update crew@astra
/plugin update loop@astra
```

After install, restart any open Claude Code sessions so they pick up the new plugin binaries.

## Verification per repo

For each consumer repo, open a Claude Code session in the repo directory and run `/crew:brief-me`. Confirm output references crew@0.7.0 features:

- `validate-agents.mjs` mentioned in CI gate list (FEAT-035 marker)
- `--validation-evidence` flag or `Validation Evidence` section visible in reviewer guidance (FEAT-030 marker)
- `Recommended Model` or `model-selection gate` mentioned in lead workflow (FEAT-031 marker)

Repos to verify (in any order):

- `C:/work/mega/cortex`
- `C:/work/mega/authentic`
- `C:/work/mega/loopobserver`
- `C:/work/mega/citylive`
- `C:/work/mega/hero-crew-autonomous-loop` (hcal) — for hcal, also confirm `loop@0.5.6` reports clean from `node "$LOOP_CLI" status` (see the loop CLI 0.5.5 workaround note in your memory).

If `/crew:brief-me` in any repo still references a pre-0.7.0 feature set, the bump did not propagate to that session. Restart that Claude Code session and re-verify.
```

- [ ] **Step 2: Verify**

Run:
```bash
wc -l docs/operations/2026-06-02-consumer-crew-bump.md
```
Expected: 65-75 lines.

---

### Task 4: Write the operations doc — Rollback + Audit-trail

**Files:**
- Modify: `docs/operations/2026-06-02-consumer-crew-bump.md` (append)

- [ ] **Step 1: Append Rollback + Audit-trail sections**

Append:

```markdown
## Rollback

If a regression surfaces after the bump, pin to the prior version:

```
/plugin install crew@0.6.0
/plugin install loop@0.5.4
```

Notes:

- `loop@0.5.5` is the **known-broken** release (missing `presets/` directory; `slice` subcommands ENOENT). Do NOT roll back to 0.5.5. Roll directly to 0.5.4 or the latest 0.5.6.
- The hero-crew marketplace pin is currently `loop@0.5.6` and has been verified post-bump (see `.claude/artifacts/loop/retrospectives/2026-06-02-cross-repo-cost-efficiency.md`).
- Rolling back `crew` to 0.6.0 retains the agent-quality-bar CI gate + lean-agent enrichments but loses the Sonnet-default model gate (FEAT-031).

## Audit-trail

Append a single dated line each time someone runs this bump:

| Date | Operator | Pre-bump crew | Post-bump crew | Pre-bump loop | Post-bump loop | Notes |
|---|---|---|---|---|---|---|
| 2026-06-02 | (operator) | (note pre-version) | 0.7.0 | (note pre-version) | 0.5.6 | initial v0.7.0 rollout |
```

- [ ] **Step 2: Verify total size**

Run:
```bash
wc -l docs/operations/2026-06-02-consumer-crew-bump.md
```
Expected: 80-90 lines (spec target was ≤80; ~5 lines slack is fine).

- [ ] **Step 3: Commit operations doc alone**

Run:
```bash
git add docs/operations/2026-06-02-consumer-crew-bump.md
git commit -m "docs(operations): consumer crew@0.7.0 + loop@0.5.6 bump runbook"
```

---

### Task 5: Investigate citylive — gather evidence (read-only)

**Files:**
- Read-only: `C:/work/mega/citylive/.claude/artifacts/crew/cost/*.md` (latest 5)
- Read-only: `C:/work/mega/citylive/.claude/artifacts/crew/cost-insights/*.md` (latest 2)
- Read-only: `C:/Users/serge/.claude/projects/` (subdir matching citylive's sourceProject)

- [ ] **Step 1: List the latest 5 cost reports**

Run:
```bash
ls -t C:/work/mega/citylive/.claude/artifacts/crew/cost/ | grep '\.md$' | head -5
```

Capture the filenames into a scratch note for Task 8.

- [ ] **Step 2: Read the two most recent + the worst-case report**

For each of the 3 selected files, run:
```bash
head -30 C:/work/mega/citylive/.claude/artifacts/crew/cost/<filename>
```

Capture frontmatter values: `usd`, `cache_hit_pct`, `source_project`, `aggregate_all`, `tool_failure_rate` (or whatever fields are present).

Expected for citylive (per prior analysis): `usd=0`, no `messages`, no `compaction`, no `subagent`, no `reread`. Confirm this pattern.

- [ ] **Step 3: Read the latest cost-advise**

Run:
```bash
ls -t C:/work/mega/citylive/.claude/artifacts/crew/cost-insights/ | grep '\.md$' | head -1
```

Then `head -50` of that file. Capture what cost-advisor flagged (likely `tool-failure-rate`, `non-repo-dominant`, possibly `exploration-heavy`).

- [ ] **Step 4: Check the sourceProject directory existence**

If frontmatter shows `source_project: <slug>`, run:
```bash
ls C:/Users/serge/.claude/projects/<slug>/ 2>&1 | head -5
```

If the directory doesn't exist or contains no recent session JSON files, that explains the zero-emission cost reports — the cost reader is pointed at an empty source.

- [ ] **Step 5: Check whether ANY citylive cost report has non-zero usd**

Run:
```bash
grep -l "^usd: [^0]" C:/work/mega/citylive/.claude/artifacts/crew/cost/*.md 2>&1 | head -3
```

If zero files match, citylive's reporter has never emitted USD. If some match, the reporter is intermittently working.

- [ ] **Step 6: Write findings to a temp scratch file**

Write your findings (1 page max, plain text) to `C:/work/mega/hero-crew/.claude/artifacts/crew/handoffs/<ts>-investigation-citylive-scratch.md`. Include:

- 3 cost-report file paths cited
- Key field values (usd, source_project, tool_failure_rate)
- sourceProject directory state (exists / missing / empty)
- Non-zero-usd report count
- Root-cause hypothesis (1 sentence)
- Recommended fix path (1 sentence)

This scratch will feed into Task 8.

---

### Task 6: Investigate authentic — gather evidence (read-only)

**Files:**
- Read-only: `C:/work/mega/authentic/.claude/artifacts/crew/cost/*.md` (latest 5)
- Read-only: `C:/work/mega/authentic/.claude/artifacts/crew/cost-insights/*.md` (latest 2)

- [ ] **Step 1: List the latest 5 cost reports**

Run:
```bash
ls -t C:/work/mega/authentic/.claude/artifacts/crew/cost/ | grep '\.md$' | head -5
```

- [ ] **Step 2: Read the two most recent + one worst-case report**

Per Task 5 Step 2, but for authentic. Expected: 9 of 10 reports missing `usd` field; 1 of 10 has `usd: 591` (or similar). Confirm.

- [ ] **Step 3: Find one usd-present report + one usd-missing report**

Run:
```bash
grep -L "^usd:" C:/work/mega/authentic/.claude/artifacts/crew/cost/*.md | head -3
grep -l "^usd:" C:/work/mega/authentic/.claude/artifacts/crew/cost/*.md | head -3
```

Pick one of each; capture paths.

- [ ] **Step 4: Diff the frontmatter of the two reports**

Run:
```bash
diff <(head -30 <usd-present-file>) <(head -30 <usd-missing-file>)
```

The diff shows which frontmatter field is present in one but not the other. That's the divergent path in the cost reporter.

- [ ] **Step 5: Read the latest cost-advise to confirm cost-regression flag**

Run:
```bash
ls -t C:/work/mega/authentic/.claude/artifacts/crew/cost-insights/ | grep '\.md$' | head -1
```

Then `head -80` of that file. Look for `### [HIGH] cost-regression` block.

- [ ] **Step 6: Write findings to scratch file**

Write to `.claude/artifacts/crew/handoffs/<ts>-investigation-authentic-scratch.md` with the same shape as Task 5 Step 6.

---

### Task 7: Investigate hcal — gather evidence (read-only)

**Files:**
- Read-only: `C:/work/mega/hero-crew-autonomous-loop/.claude/artifacts/crew/cost/*.md` (latest 5)
- Read-only: `C:/work/mega/hero-crew-autonomous-loop/.claude/artifacts/crew/cost-insights/*.md` (latest 2)
- Read-only: `C:/Users/serge/.claude/projects/<hcal-slug>/` (recent session JSON files)

- [ ] **Step 1: List the latest 5 cost reports**

Run:
```bash
ls -t C:/work/mega/hero-crew-autonomous-loop/.claude/artifacts/crew/cost/ | grep '\.md$' | head -5
```

- [ ] **Step 2: Read the two most recent + the highest-reread report**

Expected from prior analysis: average `file_reread_count` ~32.7, max 315. Find the file with the highest reread count by running:

```bash
grep -E "^file_reread_count: " C:/work/mega/hero-crew-autonomous-loop/.claude/artifacts/crew/cost/*.md | sort -t: -k3 -n -r | head -3
```

Capture the top 3 paths + their reread counts.

- [ ] **Step 3: Check whether CREW_COST_HYGIENE env var appears in any recent hcal session log**

Run:
```bash
grep -l "CREW_COST_HYGIENE" C:/Users/serge/.claude/projects/<hcal-slug>/*.jsonl 2>&1 | head -3
```

If the grep returns no files, the FEAT-029 hook never ran in hcal sessions (env-var-gated and default-off). That's the obvious first lever per the spec.

If you don't know the hcal slug, list candidates:
```bash
ls C:/Users/serge/.claude/projects/ | grep -i 'hero-crew-autonomous-loop' | head -3
```

- [ ] **Step 4: Read the latest hcal cost-advise**

Run:
```bash
ls -t C:/work/mega/hero-crew-autonomous-loop/.claude/artifacts/crew/cost-insights/ | grep '\.md$' | head -1
```

Then `head -80` of that file. Look for `### [HIGH] file-rereads` and `### [LOW|MEDIUM] large-tool-output` blocks.

- [ ] **Step 5: Write findings to scratch file**

Write to `.claude/artifacts/crew/handoffs/<ts>-investigation-hcal-scratch.md` with the same shape as Task 5 Step 6.

---

### Task 8: Write the investigation doc — frontmatter + header + citylive section

**Files:**
- Create: `docs/investigations/2026-06-02-consumer-cost-hotspots.md`
- Read: 3 scratch files from Tasks 5-7

- [ ] **Step 1: Create the file with frontmatter + header**

Write to `docs/investigations/2026-06-02-consumer-cost-hotspots.md`:

```markdown
---
date: 2026-06-02
kind: investigation
source_repos:
  - citylive
  - authentic
  - hero-crew-autonomous-loop
related_retros:
  - .claude/artifacts/loop/retrospectives/2026-06-02-cross-repo.md
  - .claude/artifacts/loop/retrospectives/2026-06-02-cross-repo-cost-efficiency.md
related_spec: docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md
methodology: read-only triage, ≤5 cost reports per repo
---

# Consumer cost-hotspot investigation — 2026-06-02

Read-only triage of three cost-report hotspots surfaced in the cross-repo retrospective + cost-efficiency analysis dated 2026-06-02. Each section names specific cost-report files as evidence and lists a concrete next action. No changes were made in the investigated repos.

Related artifacts:
- Cross-repo retro: `.claude/artifacts/loop/retrospectives/2026-06-02-cross-repo.md`
- Cost-efficiency analysis: `.claude/artifacts/loop/retrospectives/2026-06-02-cross-repo-cost-efficiency.md`
- Top-10 cost-advise ranking: same cost-efficiency doc + the session synthesis at `.claude/artifacts/crew/runs/20260602T160653Z-final-synthesis-cross-repo-retrospective-cost-efficiency-cost-advise-analysi.md`
```

- [ ] **Step 2: Read the citylive scratch + write the citylive section**

Read `.claude/artifacts/crew/handoffs/<ts>-investigation-citylive-scratch.md`. Append a section to the investigation doc:

```markdown
## citylive — tool-failure-rate + zero-emission cost reports

**Symptom.** `tool-failure-rate` flagged LOW in 12 of 20 recent cost-advise reports (highest density across all consumer repos). Cost reports themselves emit `usd: 0`, no `messages`, no `compaction`, no `subagent_dispatches`, no `file_reread_count`.

**Evidence.** Three cost-report files reviewed:
- (cite filename from Task 5 Step 2 list #1)
- (cite filename from Task 5 Step 2 list #2)
- (cite filename from Task 5 Step 2 worst-case)

Frontmatter fields observed: (paste from scratch).

**Investigation steps.**
- (paste investigation steps from scratch)

**Root-cause hypothesis.** (paste from scratch — 1-2 sentences)

**Recommended fix path.** (paste from scratch — 1-2 sentences)

**Follow-up FEAT candidate.** If the recommended fix is non-trivial, propose FEAT-039 here with a one-sentence scope.
```

Replace bracketed `(cite filename ...)` with the actual file paths captured in Task 5. Replace `(paste from scratch)` with the actual content from the scratch file.

---

### Task 9: Write the investigation doc — authentic + hcal sections

**Files:**
- Modify: `docs/investigations/2026-06-02-consumer-cost-hotspots.md` (append)
- Read: scratch files from Tasks 6 + 7

- [ ] **Step 1: Append the authentic section**

```markdown
## authentic — cost-regression + USD-missing on 9 of 10 reports

**Symptom.** `cost-regression` flagged HIGH in 8 of 20 recent cost-advise reports (highest count across all consumer repos). Cost reports themselves drop the `usd` field on 9 of 10 recent emissions; one report carries `usd: $591` with full metrics.

**Evidence.** Three cost-report files reviewed:
- (cite filename from Task 6 Step 2 list #1)
- (cite filename from Task 6 Step 2 list #2)
- (cite worst-case filename)

Diff between a usd-present report and a usd-missing report (Task 6 Step 4): (paste diff summary from scratch).

**Investigation steps.**
- (paste from scratch)

**Root-cause hypothesis.** (paste from scratch)

**Recommended fix path.** (paste from scratch)

**Follow-up FEAT candidate.** If a new FEAT is warranted, propose FEAT-040.
```

- [ ] **Step 2: Append the hcal section**

```markdown
## hcal — large-tool-output + 32.7-reread average / 315-max

**Symptom.** `large-tool-output` flagged in 8 of 20 recent cost-advise reports. Average `file_reread_count` across last 10 cost reports is 32.7; maximum observed is 315. This is the worst reread profile across all consumer repos and the textbook target for FEAT-029 (cost-hygiene reread hook).

**Evidence.** Three cost-report files reviewed (highest-reread-first):
- (cite filename + reread count from Task 7 Step 2 entry #1)
- (cite filename + reread count from Task 7 Step 2 entry #2)
- (cite filename + reread count from Task 7 Step 2 entry #3)

CREW_COST_HYGIENE env var presence in hcal sessions (Task 7 Step 3): (paste from scratch — "present in N files" or "absent in all N recent sessions").

**Investigation steps.**
- (paste from scratch)

**Root-cause hypothesis.** (paste from scratch — most likely "FEAT-029 hook never runs because env var is unset; default-off keeps it dormant").

**Recommended fix path.** Promote FEAT-029 (cost-hygiene reread hook) from deferred to active. Run the dogfood A/B per `docs/backlog/done/FEAT-029.md` (note: file may be in `pending/` if not yet promoted) using hcal as the worst-case session and cortex as the healthy-case baseline. If the A/B PASSes, ship default-on directly in a v0.8.0 release.

**Follow-up FEAT candidate.** Existing FEAT-029 already covers this; no new FEAT needed.
```

---

### Task 10: Write the investigation doc — cross-cutting findings + done section

**Files:**
- Modify: `docs/investigations/2026-06-02-consumer-cost-hotspots.md` (append)

- [ ] **Step 1: Append cross-cutting findings**

Append:

```markdown
## Cross-cutting findings

Patterns that appeared in two or more of the three repos investigated.

- **Cost-reporter field drift.** Both citylive (all-zeros) and authentic (USD-missing on 9/10) show the same class of bug: cost reports emitting incomplete frontmatter. The proposed FEAT-036 (cost-report schema validator) would catch both cases at write time. Recommend promoting FEAT-036 to P0 after this investigation.

- **Per-slice session-scoping is the single biggest unaddressed lever.** Top-10 cost-advise ranking shows `many-sources` (75 hits) + `non-repo-dominant` (62 hits) combined for 137 hits across all repos. Both root-cause is the same: a slice's work spans multiple Claude Code sessions opened in different repo directories. The recommended documentation change (per-slice session-scoping rule in lead.md) addresses both.

- **The bundle release fixes ~half the symptoms automatically.** Of the 10 top issues, 5 (opus-overuse, subagent-overuse, trend-opus, exploration-heavy, tool-failure-rate) are addressed by features already shipped in crew@0.4.0..0.7.0. Once the consumer bump (per `docs/operations/2026-06-02-consumer-crew-bump.md`) propagates, half the cost-advise findings should regress on their own.

## Done

This document captures the read-only investigation. Each repo section above names at least one specific cost-report file as evidence and at least one concrete next action. Follow-up FEATs (if any) are proposed but not opened — opening backlog entries is out of scope for this investigation.

No edits were made in `citylive`, `authentic`, or `hero-crew-autonomous-loop` during this investigation. All findings live in this document.
```

- [ ] **Step 2: Verify the investigation doc total size**

Run:
```bash
wc -l docs/investigations/2026-06-02-consumer-cost-hotspots.md
```
Expected: 140-180 lines (spec target was ~150).

---

### Task 11: Self-review the investigation doc against the spec

**Files:**
- Read: `docs/investigations/2026-06-02-consumer-cost-hotspots.md`
- Read: `docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md`

- [ ] **Step 1: Check that each repo section cites at least one specific cost-report file path**

Run:
```bash
grep -E "\.md$|\.md '" docs/investigations/2026-06-02-consumer-cost-hotspots.md | grep -c "cost-report"
```

Expected: ≥3 (one citation per repo section minimum). If 0, the bracketed citation placeholders weren't filled in. Stop and fix.

- [ ] **Step 2: Check that each repo section has a Recommended fix path**

Run:
```bash
grep -c "^\*\*Recommended fix path" docs/investigations/2026-06-02-consumer-cost-hotspots.md
```

Expected: 3 (one per repo section).

- [ ] **Step 3: Check the cross-cutting findings section exists**

Run:
```bash
grep -c "^## Cross-cutting findings" docs/investigations/2026-06-02-consumer-cost-hotspots.md
```

Expected: 1.

- [ ] **Step 4: Check for placeholder text leftovers**

Run:
```bash
grep -nE "\(paste from scratch\)|\(cite filename" docs/investigations/2026-06-02-consumer-cost-hotspots.md
```

Expected: 0 matches. If any matches, the bracketed placeholders weren't filled in from the scratch files. Fix inline.

- [ ] **Step 5: If any of Steps 1-4 fail, fix inline, then re-run all 4**

Iterate until all 4 self-review checks pass.

---

### Task 12: Commit the investigation doc + push everything

**Files:**
- All previously edited files in `hero-crew`

- [ ] **Step 1: Stage the investigation doc**

Run:
```bash
git add docs/investigations/2026-06-02-consumer-cost-hotspots.md
```

- [ ] **Step 2: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
docs(investigation): consumer cost-hotspot triage — citylive, authentic, hcal

Read-only triage of three cost-report hotspots from the 2026-06-02
cross-repo cost-efficiency analysis. Each repo section cites specific
cost-report files as evidence and names a concrete next action.

- citylive: tool-failure-rate (12/20) + all-zeros cost reports
- authentic: cost-regression (8/20) + USD-missing on 9/10 reports
- hcal: large-tool-output (8/20) + 32.7-reread-avg / 315-max
  (textbook FEAT-029 target)

Cross-cutting: cost-reporter field drift (FEAT-036 candidate),
per-slice session-scoping as the single biggest unaddressed lever
(137 combined hits in top-10), and consumer crew@0.7.0 bump
(per docs/operations/2026-06-02-consumer-crew-bump.md) auto-fixes
5 of the top-10 symptoms.

No changes were made in the investigated repos.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Push both commits**

Run:
```bash
git push origin main
```

Expected: 2 commits pushed (`docs(operations)` from Task 4 + `docs(investigation)` from Task 12).

- [ ] **Step 4: Clean up scratch files**

The scratch files from Tasks 5-7 (`.claude/artifacts/crew/handoffs/<ts>-investigation-{citylive,authentic,hcal}-scratch.md`) served as intermediate scratch. They are valid artifacts under `.claude/artifacts/crew/handoffs/` per repo convention — keep them committed as the raw evidence trail.

Run:
```bash
git status --short
```

If the scratch files are untracked, add + commit them in a separate `chore(artifacts): investigation scratch files` commit + push.

If tree is clean, the plan is done.

---

### Task 13: Final synthesis + handoff

**Files:**
- Create: `.claude/artifacts/crew/runs/<ts>-final-synthesis-consumer-investigation.md`

- [ ] **Step 1: Write the final-synthesis artifact**

Run:
```bash
node ./scripts/crew.mjs write-final-synthesis \
  --repo "$PWD" \
  --title "Consumer bump runbook + cost-hotspot investigation shipped" \
  --summary "Two docs landed in hero-crew: operations runbook for crew@0.7.0 + loop@0.5.6 bump, and read-only investigation of three cost-report hotspots (citylive tool-failure-rate, authentic cost-regression, hcal large-tool-output + reread emergency)." \
  --files "docs/operations/2026-06-02-consumer-crew-bump.md, docs/investigations/2026-06-02-consumer-cost-hotspots.md" \
  --next "User runs the bump per the operations doc; updates the audit-trail row. Per-repo follow-ups: citylive cost-reporter zero-emission (likely FEAT-036), authentic USD-field drop (likely FEAT-036 too), hcal reread emergency (existing FEAT-029 promotion). Cross-cutting: per-slice session-scoping rule for lead.md is the biggest single lever (137 top-10 hits)." \
  --risks "Investigation findings are hypothesis-grade — confirmation requires follow-up slices not in this plan's scope. Bump itself is user-side; success depends on the user actually running it."
```

The CLI will emit a final-synthesis path + slice/aggregate cost reports + cost-advise. The cost report auto-emit is FEAT-034 working.

- [ ] **Step 2: Commit + push the synthesis artifacts**

Run:
```bash
git add .claude/artifacts/crew/
git commit -m "chore(artifacts): final-synthesis for consumer bump + investigation"
git push origin main
```

- [ ] **Step 3: Confirm tree is clean**

Run:
```bash
git status --short
```

Expected: empty output. Plan is complete.

---

## Self-review (engineer runs this against the spec)

After completing Task 13, re-read `docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md` and confirm:

1. **Doc 1 sections present:** Purpose / Pre-check / Bump commands / Verification per repo / Rollback / Audit-trail. All accounted for? Spec said ≤80 lines; actual size is whatever Task 4 Step 2 reported.
2. **Doc 2 per-repo sections complete:** each of citylive / authentic / hcal has Symptom / Evidence / Investigation steps / Root-cause hypothesis / Recommended fix path / Follow-up FEAT candidate.
3. **Cross-cutting findings section:** lists at least one pattern affecting two or more repos.
4. **No changes outside hero-crew:** confirm via reading the plan that no Task touches files outside `C:/work/mega/hero-crew/`.
5. **Read-only investigation:** confirm no `git add` or `git commit` runs in Tasks 5-7.

If any gap, add a follow-up task. If all pass, the plan is complete.
