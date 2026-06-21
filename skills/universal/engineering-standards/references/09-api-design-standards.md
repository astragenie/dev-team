# API Design Standards

# Purpose

Maintain consistent, scalable, predictable APIs.

---

# Core Principles

APIs must be:
- predictable
- observable
- versionable
- secure
- cancellation-aware

---

# API Style

Use:
- REST for CRUD
- streaming endpoints for AI generation
- async workflows for long-running operations
- Use REST for CRUD.
- Use streaming for AI generation.
- Use RFC7807 problem details.
- Version APIs.
- Support cancellation and pagination.

---

# Endpoint Naming

Use:
- nouns
- plural collections
- stable semantics

Examples:
- /api/notebooks
- /api/sources
- /api/memories

Avoid:
- verbs in endpoints
- inconsistent casing

---

# Versioning

Required:
- explicit API versioning
- backward compatibility strategy

---

# Error Format

Use:
- RFC7807 problem details

Errors must include:
- code
- message
- correlation id
- actionable detail

---

# Async Workflow Rules

Long-running operations must:
- return job ids
- support cancellation
- expose progress
- support retries

---

# Pagination Rules

Required:
- cursor pagination preferred
- deterministic ordering

---

# Validation Rules

All APIs must:
- validate inputs
- sanitize uploads
- reject invalid states

---

# AI Endpoint Rules

AI endpoints must expose:
- grounding metadata
- citation metadata
- evaluation metadata where applicable

---

# Security Rules

APIs must:
- validate authorization
- enforce notebook boundaries
- protect sensitive memory