---
name: diagram-review
tier: workflow
description: Review Mermaid/PlantUML/ASCII diagrams for syntax validity, slop patterns, and communicative clarity — catches overloaded boxes, missing labels, and structural anti-patterns before diagrams reach documentation.
triggers: ["review diagram", "check diagram", "diagram lint", "mermaid review", "diagram quality", "validate mermaid", "diagram feedback"]
owner: hero-crew
last_reviewed: 2026-06-08
---

# Diagram Review

Lint and review technical diagrams for syntax validity, slop patterns, and communicative clarity.

## When to use

Consult this skill when:
- A diagram has been authored or modified and needs quality review before merging into documentation
- An architect or document-writer requests post-authoring lint on a Mermaid, PlantUML, or ASCII diagram
- A reviewer needs a structured checklist to evaluate diagram quality in a PR

## Issue categories

### Category 1: Syntax errors

- Unclosed blocks or missing `end` in Mermaid flowchart/sequence
- Invalid node IDs (spaces, reserved words)
- Missing `%%` comment prefix causing parse errors
- Wrong arrow syntax (`->` instead of `-->` in sequence diagrams)

**Check:** paste diagram into a Mermaid live editor or validate with `npx mmdc --input file.mmd --output /dev/null`.

### Category 2: Slop patterns

| Pattern | Signal | Fix |
|---|---|---|
| Overloaded box | >2 responsibilities in one node label | Split into two nodes |
| Missing edge labels | Arrows with no label on ambiguous paths | Add `-- label -->` |
| God node | One node connects to >5 others | Introduce an intermediary or grouping |
| Duplicate paths | Two arrows between same nodes going same direction | Merge or label to distinguish |
| Orphan node | Node declared but not connected | Remove or connect |

### Category 3: Communicative clarity

- **No title** — every diagram must have a title (Mermaid `title:` or comment header)
- **Inconsistent naming** — same concept labelled differently across nodes
- **Wrong diagram type** — using flowchart for a time-sequence concern (use sequenceDiagram instead)
- **Too many nodes** — >12 nodes in one diagram; split into overview + detail pair
- **Missing legend** — non-obvious edge labels or node shapes with no explanation

## Review checklist

```
[ ] Syntax: renders without error
[ ] Each node has one responsibility
[ ] All edges have labels on ambiguous paths
[ ] Title present
[ ] Naming consistent
[ ] Diagram type matches concern
[ ] <= 12 nodes (or justified split)
[ ] No orphan nodes
```

## Output format

Return findings as:
- `PASS` — diagram is clean
- `PASS_WITH_NOTES` — minor issues (cosmetic labels, naming suggestions)
- `FAIL` — syntax error or blocking slop pattern; include line reference and fix suggestion

## Done / Acceptance

A diagram review is complete when:
- All checklist items have been evaluated
- A verdict (`PASS`, `PASS_WITH_NOTES`, or `FAIL`) is returned with supporting evidence
- `FAIL` verdicts include line reference and specific fix suggestion
- `PASS_WITH_NOTES` verdicts list all minor findings clearly
