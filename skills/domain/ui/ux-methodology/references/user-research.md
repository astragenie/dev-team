# User Research and Persona Modeling

Practical guidance for conducting, synthesizing, and applying user research to design decisions.

## Research philosophy

All design decisions should be traceable to user behavior data or usability research. When no
primary data exists, cite the closest applicable NN Group or academic study and flag the
assumption explicitly. Opinion-based guidance is acceptable as a starting point but must be
validated before shipping.

## Research methods

### Qualitative methods

- **Contextual inquiry** — observe users in their environment; what they do > what they say.
- **Usability testing** — 5 users reveal ~85% of critical usability issues (Nielsen 1993;
  still valid for formative testing). Record sessions; take time-on-task measurements.
- **Cognitive walkthrough** — evaluate each step against: does the user know what to do?
  Does the UI communicate progress? Are errors recoverable?
- **Card sorting** — open sort to discover mental models for IA; closed sort to validate
  proposed navigation groupings.

### Quantitative methods

- **A/B testing** — requires sufficient traffic (typically >1,000 conversions per variant)
  for statistical significance; avoid stopping tests early.
- **Heatmaps and session recordings** — eye-tracking studies show F-pattern on text-heavy
  pages; heatmaps approximate this at scale.
- **Funnel analysis** — identify drop-off steps; quantify the impact of proposed changes
  before investing in redesign.
- **SUS (System Usability Scale)** — 10-question post-test survey; score >68 is above average.

## Persona modeling

### When personas are useful

Personas focus design discussions on real behavior clusters rather than hypothetical users.
They are most useful when the team lacks direct access to users or when multiple user types
have conflicting needs.

### Persona construction

1. Conduct research first — personas built without data are "marketing personas" and often
   harmful (they embed assumptions without a feedback loop).
2. Group by behavior patterns, not demographics — age and job title predict behavior far
   less than task goals, frequency of use, and technical proficiency.
3. Include anti-patterns — what the persona does NOT do matters as much as what they do.
4. Limit to 2–3 primary personas — more than 3 typically indicates scope creep; prioritize.

### Persona template (minimal)

```
Name: <fictional name>
Role: <job title or context>
Primary goal: <what they are trying to accomplish>
Frequency: <how often they encounter this task>
Tech proficiency: <novice / intermediate / expert>
Pain points: [3 bullet points from research]
Mental model: [how they expect the system to work, based on prior experience]
Anti-patterns: [what they will NOT do — e.g., won't read tooltips, won't call support]
```

## Research synthesis

1. **Affinity mapping** — cluster raw observations into themes before drawing conclusions.
2. **Jobs-to-be-done framing** — "When I [situation], I want to [motivation], so I can
   [outcome]." Strips out assumed solutions and focuses on underlying goals.
3. **Severity scoring** — rate each usability issue on: frequency × impact × persistence.
   Use this to populate the must-fix / should-fix / nice-to-have priority tiers.

## Feedback on AI-generated output

AI-generated designs and prototypes must be validated against real user behavior, not just
reviewed by the design team. AI tools can generate visually polished outputs that violate
usability principles. Apply standard usability testing methods to AI-generated UI before
treating it as validated.

## Evidence citation format

For every usability recommendation, cite the source:

```
**[Principle name]**
- Claim: [what the principle says]
- Source: [NN Group article URL, study name + year, or stated heuristic]
- Application: [how it applies to this specific design decision]
```
