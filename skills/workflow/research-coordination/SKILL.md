---
name: research-coordination
prompt_id: research-coordination
version: 1.0.0
tier: workflow
description: Strategic planning for multi-source research tasks — complexity assessment, specialist allocation, iteration strategy, source cross-validation, and synthesis planning.
source: aitmpl/deep-research-team/research-coordinator
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: ["research", "multi-source", "synthesis", "claim verification", "contradictory sources", "primary vs secondary", "literature review", "findings", "academic", "cross-validate"]
---

# Research Coordination

Strategic guidance for planning and executing complex research tasks across multiple sources and specialist researchers.

## When to use

Consult this skill when:
- Research spans multiple knowledge domains (academic, current news, technical, quantitative)
- Claims need cross-validation across independent sources
- Primary and secondary source distinctions matter (e.g. peer-reviewed vs blog posts)
- Multiple specialist researchers must be coordinated without redundant effort
- A topic requires discovery → deep dive → synthesis across multiple iterations
- Research output will be used to make architectural or product decisions

## Complexity assessment

Before allocating tasks, classify the research:

| Complexity | Characteristics | Iteration count |
|---|---|---|
| Low | Single domain, clear answer, factual lookup | 1 pass |
| Medium | 2–3 domains, requires depth + breadth | 2 iterations |
| High | Cross-domain, contradictory evidence, evolving topic | 3 iterations |

Signals that complexity is higher than it appears: "comprehensive", "compare", "evaluate options", "current best practice", any topic where expert opinion diverges.

## Specialist allocation

| Researcher | Best for |
|---|---|
| academic-researcher | Theoretical foundations, peer-reviewed evidence, historical context, methodologies |
| web-researcher | Current events, industry trends, public opinion, breaking developments |
| technical-researcher | Code repositories, documentation, architecture patterns, implementation details |
| data-analyst | Statistical evidence, trend analysis, quantitative comparisons, metric definitions |

Assignment rules:
- Assign academic-researcher when claims need peer-reviewed backing or theoretical grounding
- Assign web-researcher for recency (anything where "current" matters)
- Assign technical-researcher when implementation details or code are in scope
- Assign data-analyst when the research question is quantitative or requires trend comparison
- Multiple researchers can run in parallel; define explicit boundaries to prevent overlap

## Task definition principles

Each researcher task must include:
- **Objective**: what question to answer (measurable outcome)
- **Focus areas**: explicit domains or sub-topics to investigate
- **Constraints**: what NOT to cover (prevents overlap and scope drift)
- **Priority**: high / medium / low (determines iteration order)

Anti-pattern: vague tasks like "research AI and healthcare". Better: "Find peer-reviewed studies from 2020–2024 on AI diagnostic accuracy in radiology; exclude drug discovery; target 5+ sources."

## Iteration strategy

### Single pass
Use for well-defined, focused questions with clear sources. Researcher returns findings; no follow-up needed.

### 2 iterations
- Iteration 1: broad exploration — identify key themes, gaps, and primary sources
- Iteration 2: deep dive on gaps identified in iteration 1

### 3 iterations
- Iteration 1: discovery — map the landscape, identify contradictions
- Iteration 2: analysis — resolve contradictions, gather quantitative evidence
- Iteration 3: synthesis — integrate findings, produce final report

## Integration planning

Define before research begins — not after — how findings will be combined:

| Mode | When to use |
|---|---|
| **Complementary** | Researchers cover different aspects of the same topic |
| **Comparative** | Multiple researchers cover the same topic from different perspectives (enables triangulation) |
| **Sequential** | Researcher B uses Researcher A's output as input |
| **Validating** | Researcher B independently verifies Researcher A's key claims |

For high-stakes decisions, always include at least one validating assignment to catch hallucinated or outdated claims.

## Source quality heuristics

Primary vs secondary:
- **Primary**: original research, raw data, first-hand accounts, official documentation
- **Secondary**: summaries, reviews, analyses of primary sources
- Prefer primary sources for factual claims; secondary for synthesis and context

Source freshness:
- Technical documentation: use sources < 2 years old for rapidly-evolving stacks
- Academic: peer-reviewed within 5 years is typical; foundational theory can be older
- News/industry: last 6 months for "current state" claims

Contradictory sources: when two credible sources contradict, escalate to data-analyst for quantitative resolution or note the contradiction explicitly rather than picking one side.

## Quality gates

Minimum quality bar before declaring research complete:
- Minimum source count met (specify at task creation: typically 3+ for low, 5+ for medium, 8+ for high)
- Each coverage requirement has at least one primary source
- Contradictions are either resolved or explicitly flagged
- Claims are traceable to specific sources (no "research shows that…" without citation)

## Output plan

The research plan output should specify:
```json
{
  "strategy": "explanation of approach and researcher selection rationale",
  "iterations_planned": 1,
  "researcher_tasks": {
    "academic-researcher": {
      "assigned": true,
      "priority": "high",
      "tasks": ["Find peer-reviewed studies on X from 2020–2024"],
      "focus_areas": ["radiology AI", "diagnostic accuracy"],
      "constraints": ["exclude drug discovery", "no conference papers only — journals preferred"]
    }
  },
  "integration_plan": "Complementary: academic covers evidence base; web covers recent industry adoption",
  "success_criteria": {
    "minimum_sources": 8,
    "coverage_requirements": ["historical context", "current implementations", "quantitative results"],
    "quality_threshold": "thorough"
  },
  "contingency": "If academic sources are sparse, expand to technical-researcher covering preprint servers"
}
```

## Done / Acceptance

Research task is complete when:
- All assigned researcher tasks returned findings
- Success criteria met (source count, coverage requirements, quality threshold)
- Contradictions resolved or explicitly noted with both sides cited
- Integration plan executed: findings synthesized into a coherent output
- Key claims traceable to sources; no unsupported assertions in the final report
