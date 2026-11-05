# Research: prompt optimization + agent/skill evals (as of 2026-11-05)
Verified = page content fetched and read. Search-only claims are marked UNVERIFIED.

## Top-5 ranked (steal for crew)

1. claude plugin eval — https://code.claude.com/docs/en/plugin-evals.md (VERIFIED)
   - Cases = prompt + binary graders. Free deterministic graders: regex, tool_used, tool_order, file_exists. Judge graders: llm (PASS needs 2 of 3 votes), baseline (at least as good as a reference transcript). 3 runs per case by default, WITH vs W/OUT plugin delta, --threshold, --max-cost-usd, exit codes 0/1/2, aggregate-result.json (schemaVersion 1). Mock MCP servers with .replay/ recordings, scaffold_script fixtures, history_file resume. Eval dir configurable via plugin.json experimental.evals.
   - Steal: add evals/ cases per agent and skill with one outcome grader plus one trajectory grader (tool_used/tool_order). PR CI runs deterministic-only graders (--ablation none); judge graders nightly. Commit mocks/.replay. Effort M.

2. Binary rubric items + judge validated by fault injection — https://arxiv.org/abs/2609.00038 (VERIFIED abstract) and plugin-evals "concrete PASS/FAIL" guidance
   - A reply-only judge scored recall equal to its false-alarm rate (paired discrimination 0). Step-by-step instructions gave +1.00; all steps visible but reply-only question gave +0.69. Small 14B judge, synthetic support-desk testbed, so directional only.
   - Steal: replace the 7 continuous 0-1 axes with fraction-of-binary-items-passed, each anchored to a deterministic probe where possible; emit N/A when there is no evidence rather than defaulting near 0.5; validate the grader by injecting a known defect into a PASS run and requiring faulted > clean flag rate. Effort M.

3. GEPA 0.1.x features — https://github.com/gepa-ai/gepa/releases (VERIFIED)
   - 0.1.1 (16 Mar): top_k_pareto selector, gepa.gskill (repo-specific skills for coding agents), parallel eval default, atomic state saves, JSON run artifacts, HTML lineage tree. 0.1.2/0.1.3 (14 Jul): max_reflection_cost, unified LM layer, track_best_outputs default True, state schema v4->v5. 0.1.4 (15 Jul): sampling/selection strategies, ReflectionLM protocol, batch_evaluator; BREAKING: EngineConfig.num_parallel_proposals removed.
   - Steal: bump gepa-core in plugins-common; expose max_reflection_cost and per-task Pareto scores in /crew:gepa-optimize; save run JSON next to champion provenance. Effort M.

4. Cost-aware budgets and length cap — https://decagon.ai/blog/optimizing-gepa-for-production (VERIFIED; single classification task)
   - ~150 LLM calls baseline, ~20 training examples best, frontier reflector is only ~5-10% of cost but a cheap reflector leaves the prompt unchanged, uncapped prompts exceed 5000 chars and overfit, 1500-char cap lost 0.8%. GEPA blog uses 100-150 metric calls.
   - Steal: default 100-150 metric calls, mandatory held-out set, prompt length cap aligned with the 350-line agent cap, frontier reflector with cheap task model. Effort S.

5. CASD offline distillation — https://arxiv.org/abs/2609.26261 (VERIFIED abstract; preprint)
   - A coding agent analyses a static trajectory corpus and distills rules. Avg +16.6pp vs GEPA +10.9 vs SkillOpt +5.3 on ALFWorld, tau2-bench, SpreadsheetBench-Verified; ~$1.60 per run, 22x cheaper than validation-gated search.
   - Steal: use crew run/handoff/review artifacts as the corpus for a cheap failure-mining pass before any GEPA spend. Effort M.

## (a) Cheap agent-prompt eval in CI
- Deterministic graders cost nothing; keep llm graders for short outputs; pin models; set --max-cost-usd; exclude partial:true runs from trends. (VERIFIED)
- Replay via .replay mocks and history_file removes dependency model calls. (VERIFIED)
- Langfuse v4 GA 2026-08-17, Cloud v4-only 2026-11-16, code evaluators GA 2026-05-28 (https://langfuse.com/changelog/2026-08-17-langfuse-v4, VERIFIED). Crew emits to Langfuse: check the migration before 16 Nov. The langfuse/experiment-action GitHub Action and structured tool-call field come from search only (UNVERIFIED).
- Promptfoo CI docs https://www.promptfoo.dev/docs/integrations/ci-cd/ (search only). OpenAI acquisition (Mar 2026) and version numbers UNVERIFIED. Blog pattern (UNVERIFIED): freeze red-team findings into fixed regression tests instead of gating on freshly generated scans.
- Inspect AI: docker-dependent sandbox, poor fit for Windows CI; version/features UNVERIFIED. Not recommended.

## (b) Rubrics that do not collapse to 0.5
See item 2. Add: step visibility for the judge, N/A instead of default midpoint, deterministic anchors (security = secret-grep result, test_confidence = tests exist and ran, observability = emit calls present). The anchor suggestions are my inference.

## (c) Judge calibration
- Weak sources: practitioner guides (deepeval.com, futureagi.com) UNVERIFIED — both-order pairwise requiring same winner, cross-family judge vs generator, human-labeled calibration set, reference anchor.
- Verified mechanisms: 2-of-3 votes; baseline grader vs reference transcript; doc advises re-running with --judge-model sonnet when a small judge is suspect.
- Steal: fault-injection set per axis. Effort M.

## (d) Provenance/versioning
- GEPA writes JSON run artifacts, atomic state, lineage tree (VERIFIED).
- Self-Harness https://arxiv.org/abs/2606.09498 (VERIFIED abstract): mine failures from traces, minimal edits, accept only after regression testing; gains up to 132% relative on three open models.
- Steal: champion frontmatter records gepa version, state schema version, metric-call budget, seed hash, train/val split ids, eval-suite hash, judge model, reflector model. Effort S.

## (e) Cost-aware budgets
Item 4, plus https://arxiv.org/abs/2607.22585 (VERIFIED abstract): harness choice changed tokens per solved task up to 40x while pass-rate differences were 0-8pp. Steal: report tokens per pass and optimize a cost-penalized objective. Effort S.

## (f) Evidence GEPA helps coding-agent prompts
- Positive, vendor self-reported (VERIFIED page): https://gepa-ai.github.io/gepa/blog/2026/02/18/introducing-optimize-anything/ — learned skills 24%->93% and 55%->82% resolve rate on two repos; Bleve Haiku 4.5 79.3->98.3, Sonnet 4.5 94.8->100; 47% faster; held-out validation; transfers to Claude Code. No independent replication found.
- Core paper ICLR 2026 oral https://arxiv.org/pdf/2507.19457: beats GRPO avg 6pp with up to 35x fewer rollouts and MIPROv2 by 10pp+ (from search summary; paper not opened: partially UNVERIFIED).
- Mixed: IaC paper arXiv 2607.20478 found GEPA vs SIMBA not significantly different, p=0.059 (search snippet, UNVERIFIED). A search summary claimed FEM-Bench found no consistent GEPA gain; the FEM-Bench v2 abstract does not mention GEPA, so treat as UNVERIFIED and possibly misattributed.
- MAS-PromptBench https://arxiv.org/abs/2606.23664 (VERIFIED abstract): gains possible, but search space grows exponentially with agent count. Optimize one crew agent at a time.
- No clean ablation of system-prompt wording alone on Terminal-Bench or SWE-bench found. Net: evidence supports skills and repo-specific knowledge plus failure-grounded edits, not generic rewording.

## Other
- DSPy 3.4.1 (Oct 12 2026) making GEPA proposer default: UNVERIFIED (blog only).
- SWE-bench Pro V2 protocol changed Sep 2026 so scores are not comparable across versions; Terminal-Bench 2.1 numbers conflict across blogs: UNVERIFIED. Use own fixtures, not public leaderboards.
- skill-creator trigger evals: ~20 should/should-not-trigger queries; separate evals/evals.json format not shared with claude plugin eval (format difference VERIFIED via plugin-evals doc; SKILL.md at anthropics/claude-plugins-official not opened). Steal: trigger-eval set per skill description. Effort S.
