# Definition of Done

# Purpose

Prevent incomplete AI-generated engineering work.

A feature is NOT complete until all required engineering, UX, observability, and documentation work is finished.

---

# Mandatory Completion Requirements

## Implementation

Feature is complete only if:

- feature implemented
- code compiles
- architecture preserved
- existing patterns reused
- implementation works
- tests added
- logging added
- loading states exist
- error handling exists
- responsive behavior works
- docs updated

---

## Testing

Required:
- unit tests
- integration tests where appropriate
- evaluation tests for AI workflows

---

## Error Handling

Must include:
- safe failures
- user-friendly messages
- structured errors
- logging

---

## UX

Required:
- loading states
- empty states
- responsive behavior
- accessibility checks
- keyboard navigation

---

## Observability

Required:
- structured logs
- tracing
- metrics
- correlation IDs

---

## Documentation

Required:
- update PRD if behavior changed
- update ADR if architecture changed
- update README if setup changed

---

# AI-Specific Requirements

## Grounding

All AI outputs must:
- preserve citations
- avoid hallucinations
- expose confidence where appropriate

---

## Memory Integration

Features touching memory must:
- preserve traceability
- preserve version history
- support evaluation

---

# Security Requirements

- no secrets exposed
- validation added
- authorization respected

---

# Deployment Requirements

- migrations validated
- environment-safe configuration
- rollback-safe deployment

---

# Completion Checklist

Before marking complete:
- tests pass
- logs validated
- UI reviewed
- docs updated
- edge cases reviewed
- performance reviewed
