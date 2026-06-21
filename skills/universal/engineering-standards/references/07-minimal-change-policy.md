# Minimal Change Policy

# Purpose

Prevent unnecessary rewrites, architecture churn, and instability.

AI-assisted engineering must prioritize:
- stability
- maintainability
- incremental evolution

---

# Core Principle

- Prefer the smallest safe change that solves the problem.
- Reuse existing architecture.
- Modify smallest possible scope.
- Avoid massive refactors.
- Preserve compatibility.
- Incremental migration preferred.

---

# Required Workflow

Before modifying code:

1. inspect existing implementation
2. inspect architecture patterns
3. inspect reusable components
4. inspect existing abstractions
5. evaluate minimal change path

---

# Preferred Changes

Prefer:
- additive changes
- extension points
- reusable components
- incremental migration
- compatibility preservation

---

# Forbidden Behaviors

Avoid:
- rewriting entire modules
- changing architecture without ADR
- introducing frameworks without approval
- unnecessary abstractions
- premature optimization

---

# Refactoring Rules

Refactor only if:
- duplication is harmful
- readability improves
- maintainability improves
- architecture becomes simpler

---

# UI Rules

Prefer:
- extending design system
- reusing existing components
- preserving layout consistency

Avoid:
- redesigning unrelated screens
- changing visual language unexpectedly

---

# Database Rules

Avoid:
- destructive migrations
- schema churn
- unnecessary table redesigns

Prefer:
- additive migrations
- backward compatibility
- gradual evolution
