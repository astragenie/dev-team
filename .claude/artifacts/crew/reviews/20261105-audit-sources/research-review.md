# AI code review / quality gates, May-Nov 2026: research for crew
Date: 2026-11-05. Verified = primary page fetched. UNVERIFIED = secondary/blog only.

## Verified primary sources
- https://code.claude.com/docs/en/code-review (managed Code Review service)
- https://code.claude.com/docs/en/code-review-local (/code-review command)
- https://code.claude.com/docs/en/ultrareview (/code-review ultra)
- https://code.claude.com/docs/en/code-review-customize.md (REVIEW.md)
- https://cursor.com/blog/bugbot-learning (Bugbot learned rules, resolution rate)
- https://github.com/spencermarx/open-code-review (382 stars; creation date not stated)
- https://www.qodo.ai/academy/ai-code-review-tools-comparison-and-benchmarks/ (vendor claims, no raw numbers on page)

## Findings by topic

### (a) Finding verification
- Managed Code Review: Find (parallel agents) -> Verify (checks candidates against code, drops false positives) -> Rank (dedupe + severity) -> Post. Never approves or blocks; check run never fails. Read-only; does not build or run code.
- Local /code-review: low = only the findings it is most confident in; medium..max broaden coverage. "Verify every finding" at medium+ and fresh-context finder/verifier subagents at high come from Anthropic X post and secondary summaries (UNVERIFIED on the docs page). Runs as a forked background subagent. Flags: --fix, --comment, --max-findings n|all|default (findings-tool cap 32). Effort level is sticky across runs.
- ultra: fleet of reviewers in a cloud sandbox; "every reported finding is independently reproduced and verified". 5-15 min; ~$5-25 after 3 free runs. `claude ultrareview` subcommand for CI (--json, --timeout 45, exit codes 0/1/130). Diff cap 500 files / 8000 lines.
- REVIEW.md goes to BOTH finder and verifier agents; the final-writer step consults it before settling severity. Docs suggest an evidence rule: behavior claims need a file:line citation, not inference from naming.
- Open Code Review: reviewers debate with AGREE/CHALLENGE/CONNECT/SURFACE; aggregation merges redundant reviewer instances; synthesis dedups. No measured results.
- CodeRabbit (UNVERIFIED, blog teasers only): Deep Scan "verifies findings independently, shows evidence"; Runtime Verification turns a finding into a Reproducer Guide and runs it.

### (b) Noise control
- Severity tiers (Important / Nit). REVIEW.md can redefine Important, cap nits ("at most five"), skip generated/lock files and anything CI already enforces, raise the bar per path ("only if near-certain and severe").
- Default posture: correctness only, not style or missing test coverage.
- Codex (UNVERIFIED): P0-P3 scale; reportedly only P0/P1 shown by default; guidance in AGENTS.md / code_review.md. Check developers.openai.com/codex/integrations/github.
- Bugbot: rules with consistent negative feedback are auto-disabled.

### (c) Review of tests / test presence
- No tool enforces tests by default; Anthropic default explicitly excludes missing coverage. Pattern is rule-based via REVIEW.md ("new API routes have an integration test"). CodeRabbit generates unit tests (UNVERIFIED, one Japanese article). No published test-quality reviewer with metrics.

### (d) Fan-out and dedup
- Managed service: parallel finders -> verification -> one dedupe+rank stage. Open Code Review: same-persona instances merged in an aggregation phase; matching method undocumented.

### (e) Auto-fix loops
- /code-review --fix applies findings once via permission mode; no documented apply -> re-review -> stop loop. Service resolves its own earlier comment threads and may keep an earlier result after some pushes. CodeRabbit Autofix and CI-failure fix (beta, Jul 16 2026) push to branch or stacked PR (UNVERIFIED). Bugbot Autofix only on substantial findings (UNVERIFIED). No source documents termination criteria; crew's repair-signature dedup is ahead of published practice.

### (f) Learnings
- Bugbot Learned Rules (Apr 2026; mechanism verified on cursor.com blog): signals = downvote reactions, reply explanations, human reviewer comments that catch missed bugs. Candidate -> promoted to active as signal builds -> disabled on consistent negative signal. User can edit/delete. >110k repos, >44k rules.
- CodeRabbit Learnings: editable/deletable store (2024 origin; no 2026 change verified).

### (g) Published numbers (all vendor-authored or secondary)
- Cursor resolution rate (LLM judge, public repos, "comment addressed by merge"): Bugbot 78.13% (50,310 PRs), Greptile 63.49%, CodeRabbit 48.96%, Copilot 46.69%, Codex 45.07%, Gemini 30.93%. Metric rewards getting fixed, not true-positive rate.
- Qodo benchmark: 100 PRs, 580 injected defects, 8 repos, 7 languages (verified on page); figures Precise 74.5% P / 44.2% R, Exhaustive 56.7% R are UNVERIFIED (secondary). Claim: +12 F1 over Claude Code Review at identical precision.
- Martian Code Review Bench: page not retrievable. Secondary: Greptile 60.8% F1 / 76.2% P / 50.6% R (Jul 30 2026); CodeRabbit 51.2% F1 (Jan-Feb). UNVERIFIED, sources conflict.
- Anthropic max vs single agent 23/27 vs 21/27 serious bugs, ~$21 vs $0.11, 56 min vs 40 s: third-party blog, UNVERIFIED.
- Anthropic docs publish no precision/recall for own service.
- Not covered / UNVERIFIED: Greptile, Graphite, Sourcery, Ellipsis, Macroscope, Baz, Korbit, Bito, DeepSource internals; Kodus (no verifier stage found); PR-Agent v0.42. No >1k-star 2026 open-source review repo found; best found is open-code-review (382 stars).
- Copilot (UNVERIFIED): agentic tool-calling architecture since Mar 2026; Sep 18 2026 review-experience update (github.blog changelog not fetched).

## Top 5 for crew (ranked)
1. Evidence-required verdicts in reviewer-verifier. Mechanism: Anthropic gives the verifier the same rules as finders and demands file:line citations. Steal: every finding carries file:line evidence and a CONFIRMED / PLAUSIBLE / REJECTED verdict; uncited = demoted or dropped. Effort S.
2. A REVIEW.md-style calibration file (.claude/crew/review.md) read by generalist, stack reviewers and the verifier. Defines blocking vs nit, nit cap (5), skip list (anything CI enforces, generated files), per-path raised bars. Read from base branch only, never the PR's own changes. Effort S-M.
3. Learned suppression rules from review outcomes (Bugbot). Record per-finding outcome (fixed / dismissed / false positive); promote repeated dismissals to candidate rule, activate after N confirmations, auto-disable on contradiction, human-editable. Reuses repair-signature data. Effort M-L.
4. Effort tiers plus findings cap. low = single generalist + verifier, high-confidence only; deep = both reviewers + verifier incl. uncertain findings. Default max-findings (e.g. 10) with severity-ranked truncation; sticky level. Effort M.
5. Single post-verify dedupe+rank point across generalist and stack reviewer outputs, tagging new-in-diff vs pre-existing; optional ultra-style reproduction for high-severity findings (verifier produces a failing test/command). Effort S (merge point) / M (reproduction).

Cautions: nobody documents auto-fix termination, keep crew's own cap. Resolution-rate numbers are vendor-authored; do not adopt as targets.
