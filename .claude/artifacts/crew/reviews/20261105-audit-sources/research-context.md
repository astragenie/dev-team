# Context engineering research for crew (2026-11-05)

Legend: V = fetched and read; S = secondary only; UNVERIFIED = not confirmed.

## Local baseline (measured in this repo)
- Always-on chain bytes: CLAUDE.md 11,080; AGENTS.md 6,517; project constitution 5,359; global constitution 3,692 (near-duplicate); global workflow 2,124; loop-snapshot 1,713; .claude/loop/rules.md 12,441. Total about 43 KB, roughly 10-12k tokens before any command.
- commands: build 212 lines, fix 223, orchestrate-slice 651. Agents up to 346 lines (cap 350). 5,002 agent lines and 4,943 skill lines in total.
- Emphasis tokens across instructions, commands, agents, skills: MUST 85, CRITICAL 43, NEVER 32, HARD RULE 15, MANDATORY 4.

## 1. Official docs: CLAUDE.md under 200 lines, imports do not save context (V)
https://code.claude.com/docs/en/memory
- "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence." Imports "don't reduce its context cost". Memory is "context, not enforced configuration"; to block an action use a PreToolUse hook. "The more specific and concise your instructions, the more consistently Claude follows them."
- Block-level HTML comments in CLAUDE.md are stripped before injection.
- Path-scoped rules (.claude/rules with `paths:` frontmatter) and subdirectory CLAUDE.md load on demand. Root CLAUDE.md and unscoped rules are re-injected after compaction; path-scoped ones are summarized away (https://code.claude.com/docs/en/context-window).
- Subagents inherit the full CLAUDE.md hierarchy including AGENTS.md unless `omitClaudeMd: true`; Explore and Plan skip it. Skills in a subagent `skills:` list are injected in full (https://code.claude.com/docs/en/sub-agents). Invoked skill bodies are re-injected after compaction, capped at 5k tokens each and 25k total.
- `/context` shows a live breakdown. The `InstructionsLoaded` hook logs which instruction files load and why.
Steal for crew:
- Cut always-on content to under 200 lines and dedupe global versus project constitution (M).
- Move loop rules into path-scoped rules or a skill (M).
- Set `omitClaudeMd: true` on self-contained agents such as reviewer, verifier, researcher (S).
- Put maintainer prose in HTML comments (S).
- Convert "must" prose to hooks, as gate-guard already does (M).

## 2. Do context files help? Mixed evidence (V abstracts)
- Gloaguen et al., ETH, https://arxiv.org/abs/2602.11988: context files do not generally improve success; cost up over 20% on average; useful for non-standard practices; repo overviews did not help. Secondary summary says LLM-written files about -3% and human-written about +4% (UNVERIFIED).
- Lulla et al., https://arxiv.org/abs/2601.20404: curated AGENTS.md linked to about 28.6% less runtime and 16.6% fewer output tokens on 124 PRs (figures via secondary description).
- Probe-and-Refine, https://arxiv.org/abs/2606.20512: SWE-bench Verified, Qwen3.5-35B, 33.0% refined versus 28.3% static versus 25.5% none. Gain came from finding the right file, precision flat near 59%. How guidance is produced matters.
- Factorial study, https://arxiv.org/abs/2605.10039: 1,650 Claude Code sessions, mainly Sonnet 4.6. File size, instruction position, file architecture, and contradictions showed no detectable effect on adherence to one trivial annotation rule. The main signal was within-session drift, about 5.6% lower odds of compliance per generated function. Caveat: single trivial instruction.
Steal for crew:
- Delete repo-overview prose and structure tours; keep only non-inferable rules (S).
- Run an A/B eval of the same slice tasks with and without the always-on chain, measuring pass rate, tokens, wall-clock (M).
- Counter drift with short sessions and a small re-injected rules reminder (test it, UNVERIFIED benefit) (M).

## 3. Instruction count versus compliance (V)
- IFScale, https://arxiv.org/abs/2507.11538 (2025): best model 68% at 500 keyword instructions; earlier instructions favored; omissions dominate.
- Arize replication on 2026 frontier models, https://github.com/Arize-ai/instruction-budget/blob/main/IFSCALE_REPLICATION.md: Opus 4.7 98% at N=500, 91% at 750, 77% at 2000 (refusal caveats); GPT-5.5 near 100% through 5000; DeepSeek V4 Pro 86% at 500. Judge was a tested model.
- The "150-200 instruction budget" claim has no primary source (UNVERIFIED).
- Anthropic prompting guide (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices): newer models are more responsive to system prompts; "CRITICAL: You MUST use this tool when..." now overtriggers; "soften any aggressive language"; "Tune anti-laziness prompting".
- Fable 5 guide (https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5): "Skills developed for prior models are often too prescriptive ... can degrade output quality"; steer "with a brief instruction rather than enumerating each behavior"; fresh-context verifier subagents beat self-critique.
Steal for crew:
- Emphasis diet: remove most of the 143 emphasis tokens, keep a handful for irreversible actions and enforce those via hooks (M).
- Add a lint failing when a file exceeds an emphasis budget (S).
- Re-evaluate old prescriptive skills against default behavior per model (M).

## 4. Always-on versus on-demand split (V + S)
- Anthropic engineering post, https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents: right altitude; just-in-time retrieval by lightweight identifiers; hybrid upfront plus exploration; compaction with recall first; tool-result clearing; note-taking; sub-agents return condensed summaries.
- Skill descriptions are a permanent cost. One 7-hour anecdote put dormant descriptions at 11% of tokens (S, https://dev.to/kenimo49/claude-code-skills-cost-tokens-even-when-they-dont-fire-i-measured-5-skills-across-7-hours-the-8jo).
- Vendor claims: 41% overhead cut from path-scoped rules; 3,847 to 312 token CLAUDE.md (S, https://www.firecrawl.dev/blog/claude-code-token-efficiency); about 8,000 tokens of docs to a 336-token CLAUDE.md (S, https://github.com/nadimtuhin/claude-token-optimizer).
Steal for crew:
- Tier 0: under 60 lines (identity, five never-dos, index). Tier 1: path-scoped rules. Tier 2: skills and docs on demand (M).
- Cap skill descriptions near 200 characters and lint them (S).
- Split orchestrate-slice (651 lines) and build into a short router plus step files read when that step starts (L).

## 5. Hook-injected just-in-time context (V docs, no benchmark)
Hooks can inject on PostToolUse and SessionStart (source `compact`) per the context-window docs. I found no benchmark comparing hook-injected versus static context. Fable 5 guide warns that showing remaining-token countdowns triggers premature wrap-up.
Steal for crew: inject the release checklist only when a tag or version command runs, the review-gate reminder only at commit time, and loop ceremony rules only when `/loop:slice` runs (M).

## 6. Measuring context cost (V + S)
- `/context` and `InstructionsLoaded` are official (V). Per-turn `usage` fields in transcripts are the practical attribution method (S).
- ccusage context and rtk: not opened, UNVERIFIED.
Steal for crew: add `scripts/measure-context.ts` computing static token estimates per command, agent, skill, and include chain with CI budgets, plus transcript attribution of first-turn input tokens per subagent type, joined with existing cost reports (M).

## 7. Compaction and long autonomous runs (V + S)
- Compact-Bench, https://arxiv.org/abs/2610.31710: across 14 summarizers, summary-only continuation damaged 5-64% of repairs that full history solved; LLM summaries keep at most 16.0% of recurring details versus 79.1% for mechanical extraction.
- Amp replaced compaction with Handoff, citing an OpenAI Codex internal finding of degradation from repeated compaction (S, https://tessl.io/blog/amp-retires-compaction-for-a-cleaner-handoff-in-the-coding-agent-context-race).
- Anthropic recommends progress files, tests.json, and git as state across windows, and one-lesson-per-file memory (V, prompting guides above).
- Self-Compacting 2606.23525, AutoCompact 2610.02163, 2608.06503: seen only in search (UNVERIFIED).
Steal for crew: generate the next-slice state file mechanically (slice id, acceptance pass/fail table, changed files, open risks), run each slice in a fresh session, re-inject via SessionStart(compact) (M).

## 8. Context rot (V)
Chroma, July 14 2025, 18 models: https://www.trychroma.com/research/context-rot. Distractors hurt beyond length; focused 300-token prompts beat 113k-token full prompts on LongMemEval. Similar-but-irrelevant text (many skill descriptions, unrelated loop rules) is the costly kind.

## Top-5 ranked
1. Shrink and dedupe the always-on chain under about 200 lines; drop repo overviews; move the rest to path-scoped rules and skills (S-M).
2. Emphasis diet plus hook enforcement, with an emphasis-budget lint (M).
3. `omitClaudeMd: true` on self-contained agents; cap skill descriptions (S).
4. Context-budget CI script with per-file and per-agent token attribution (M).
5. Mechanical state-file handoff between slices; fresh session per slice (M).

## Caveats
- Upsun -3%/+4%, Firecrawl 41%, and the 150-200 instruction budget are unverified.
- The factorial null on file size used one trivial instruction; do not over-read it.
- Docs say adherence drops past 200 lines but give no number.
