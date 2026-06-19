---
name: ux-methodology
prompt_id: ux-methodology
version: 1.0.0
tier: domain
description: Research-backed UX methodology covering user research, information architecture, interaction design, accessibility, and design-systems governance.
source: aitmpl/development-team/ui-ux-designer
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: ["ux", "ui", "user research", "persona", "interaction design", "information architecture", "accessibility", "WCAG", "design system", "design token", "usability", "wireframe", "prototype", "heuristic", "user flow", "A/B test", "eye-tracking", "mobile design", "AI interface", "copilot UI"]
---

# UX Methodology

Evidence-based UX guidance grounded in Nielsen Norman Group research, usability heuristics,
and real user behavior data. Covers the full design stack from discovery through accessibility
compliance and design-system governance.

## When to use

Consult this skill when:
- Conducting user research or synthesizing research findings
- Designing information architecture, navigation patterns, or user flows
- Making interaction design decisions (states, transitions, error handling)
- Reviewing a UI for usability heuristic violations
- Performing an accessibility audit (WCAG 2.1 / 2.2 AA)
- Evaluating or building a design system (tokens, components, governance)
- Critiquing AI chat interfaces, copilot UIs, or prompt-driven surfaces
- Making typography, color, or layout choices backed by conversion or engagement data

## Core principles

- **Research over opinions** — every recommendation cites NN Group studies, eye-tracking data,
  A/B results, or academic usability research.
- **Distinctive over generic** — push back on cookie-cutter SaaS aesthetics; generic choices
  signal low design investment (credibility judgments form in 50ms).
- **Evidence-based critique** — identify issues with data, explain the why, provide a specific
  fix; no vague "consider using…" recommendations.
- **Practical over aspirational** — prioritize by impact × effort; favor implementable fixes
  with measurable ROI over perfect-but-never-shipped.
- **Accessibility is non-negotiable** — WCAG 2.2 AA is the floor; keyboard navigation, screen
  reader support, and 44×44px touch targets are defaults, not options.
- **F-pattern and left-side bias** — 79% of users scan; front-load key content; left-aligned
  navigation outperforms centered (NN Group 2024: 69% more time on left half of screen).
- **Mobile-first is data-driven** — 54%+ of global web traffic is mobile (StatCounter 2024);
  design for mobile constraints first, enhance for desktop.

## Subtopics

Detailed guidance lives in `references/`. Load a reference when the work matches its scope:

| Reference | Load when |
|---|---|
| [references/user-research.md](references/user-research.md) | Conducting user research, persona modeling, interview synthesis, or validating design decisions with data |
| [references/interaction-design.md](references/interaction-design.md) | Information architecture, navigation patterns, Fitts's / Hick's Law application, AI interface patterns |
| [references/accessibility.md](references/accessibility.md) | WCAG 2.1/2.2 AA compliance, keyboard navigation, ARIA, touch targets, reduced-motion |
| [references/design-systems.md](references/design-systems.md) | Design tokens, typography choices, color palette governance, motion principles, component library patterns |

Each reference is self-contained — no prior context from this SKILL.md is required to use it.

## Cross-references

- Frontend implementation of design decisions → `skills/domain/frontend-advisory/`
- React component architecture for UX patterns → `skills/domain/react-engineering/`
- Prompt and AI UX patterns (beyond visual design) → `skills/domain/prompt-engineering/`

## Done / Acceptance

A UX design or review is ready when:
- Every recommendation cites a specific study, principle, or data source
- Accessibility compliance is explicitly addressed (WCAG 2.2 AA checklist covered)
- Issues are prioritized by impact × effort with a "must fix" tier identified
- Typography, color, and layout choices are justified — not just aesthetic preferences
- Mobile experience is explicitly reviewed alongside desktop
- A specific implementation (CSS, code snippet, or design spec) accompanies each fix
