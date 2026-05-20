# Crew Plugin Model Optimization — Decision Record

**Date:** May 19, 2026
**Context:** Hit 77% of weekly Claude Code quota mid-week. Diagnostics showed `crew` plugin = 28% of usage, `code-simplifier` skill = 34%. Root cause: most agents configured with `model: opus` regardless of actual task complexity.

---

## Changes applied

All overrides live at `~/.claude/agents/` to survive plugin updates. Original files at `~/.claude/plugins/cache/crew-dev/crew/0.1.0/agents/` left untouched.

| Agent | Original | New | Rationale |
|---|---|---|---|
| `code-simplifier` | opus, — | sonnet | Style refactoring, not deep reasoning. Plus autonomous trigger amplifies cost |
| `lead` | opus, high, 40 | sonnet, high, 30 | Orchestrator. Prompt is highly detailed — rule-following, not novel reasoning. Kept high effort for decomposition decisions |
| `builder` | opus, medium, 30 | sonnet, medium, 25 | Tightly scoped implementation. Sonnet writes code at near-Opus quality |
| `deployer` | opus, high, 30 | sonnet, medium, 20 | Execution + evidence gathering. Zero deep reasoning. High effort contradicted role |
| `researcher` | sonnet, medium, 25 | unchanged | Already correctly sized. Read-only investigation, well-fit |
| `reviewer` | opus, high, 30 | sonnet, high, 25 | Most defensible Opus case in crew, but marginal. Kept high effort for thorough gates. **Watch this one closely** |
| `validator` | opus, high, 30 | sonnet, low, 15 | Worst config-vs-prompt mismatch. Prompt says "bounded, don't churn" — config said "think hard." Could potentially go Haiku |

---

## Model selection heuristic (for future agents)

| Task type | Model |
|---|---|
| Architecture, complex debugging, novel decomposition | opus |
| Code generation, refactoring, code review, summarization with judgment | sonnet |
| Tool execution, classification, extraction, pattern matching, routing | haiku |

Three signals in an agent's prompt that tell you which:
- "Analyze tradeoffs / consider implications" → reasoning-heavy → sonnet floor, maybe opus
- "Generate / write / implement / refactor" → code production → sonnet
- "Extract / parse / classify / route / execute / verify" → mechanical → haiku

---

## Effort setting heuristic

- `high` — only for genuine judgment work (orchestration, critical review, architectural decisions)
- `medium` — default for most agents
- `low` — execution-heavy or "don't overthink" agents (validation, deployment evidence gathering)

Watch for **config-vs-prompt contradiction**: if prompt says "bounded tool churn" or "smallest meaningful check," effort should be low or medium, not high.

---

## maxTurns heuristic

- 10–15: simple/focused agents
- 15–25: standard worker agents
- 25–35: orchestrators with multi-step workflows
- 35+: rarely justified — usually indicates poor task scoping

Tighter caps force "stop and ask" behavior, which is usually what you want.

---

## Other contributors identified (not yet addressed)

| Issue | % of weekly burn | Status |
|---|---|---|
| `crew` plugin (now optimized) | 28% | Addressed |
| `/simplify` skill | 34% | Code-simplifier subagent addressed; check skill itself |
| 4+ parallel sessions | 75% of usage time | Behavioral — queue serially when possible |
| 8+ hour sessions | 48% | Verify no background watcher agents |
| >150k context | 16% | Use `/compact` mid-task, `/clear` between tasks |
| `superpowers` plugin | 2% | Audit if usage grows |
| `caveman` plugin | 1% | Audit if usage grows |

---

## Override pattern (reference)

User-level files at `~/.claude/agents/` win over plugin cache at `~/.claude/plugins/cache/.../agents/`. Resolution order:

1. `<project>/.claude/agents/<name>.md` (project-specific)
2. `~/.claude/agents/<name>.md` (user-level — where overrides live)
3. `~/.claude/plugins/cache/.../agents/<name>.md` (plugin default)

PowerShell to apply overrides:

```powershell
mkdir $env:USERPROFILE\.claude\agents -ErrorAction SilentlyContinue
$source = "$env:USERPROFILE\.claude\plugins\cache\crew-dev\crew\0.1.0\agents"
$dest = "$env:USERPROFILE\.claude\agents"
Get-ChildItem "$source\*.md" | ForEach-Object {
    Copy-Item $_.FullName "$dest\$($_.Name)"
}
```

Then edit files in `$dest`, restart Claude Code.

---

## Expected impact

- Crew weekly contribution: 28% → ~4-6%
- Code-simplifier subagent: 13% → ~2-3%
- Combined weekly burn rate reduction: ~30-40%
- Assumed quality impact: negligible for builder/deployer/validator/researcher; minor risk on reviewer (monitor); slight risk on lead's hardest decomposition calls

---

## Monitoring plan

After applying changes:
1. Run a few crew workflows over 2-3 days with normal tasks
2. Watch for quality regressions on `reviewer` specifically — most likely place for noticeable degradation
3. Check `/usage` weekly to confirm burn rate drop
4. If reviewer quality drops, revert just that one to opus
5. If everything holds, consider validator → haiku as next optimization

---

## Audit commands (re-run periodically)

```powershell
# Find every opus setting across all plugins
Get-ChildItem -Path $env:USERPROFILE\.claude\plugins -Recurse -Filter "*.md" |
    Select-String -Pattern "^model:\s*opus" |
    Select-Object Path, LineNumber, Line |
    Format-Table -AutoSize

# Find autonomous/proactive triggers (silent cost amplifiers)
findstr /s /i "autonomously proactively automatically" $env:USERPROFILE\.claude\plugins\*.md

# Find all effort settings to spot config-vs-role mismatches
Get-ChildItem -Path $env:USERPROFILE\.claude\plugins -Recurse -Filter "*.md" |
    Select-String -Pattern "^effort:" |
    Select-Object Path, LineNumber, Line |
    Format-Table -AutoSize
```

Run after installing new plugins. Default-to-opus is common; default-to-autonomous is worse.

---

## Key lesson

Plugin authors often default to opus + high effort for "important" agents without analyzing whether the role actually needs that capacity. The `researcher` agent in this crew was the outlier — correctly sized at sonnet — which suggests it got individual attention while the others got a default treatment. Always audit frontmatter on installed plugins.
