# Error Handling Standards

# Purpose

Ensure failures are understandable, observable, and recoverable.

---

# Core Principle

Users should understand:
- what failed
- why it failed
- whether retry is safe
- Errors must be actionable.
- Never expose secrets.
- Preserve correlation IDs.
- Prefer typed errors.
- Avoid generic messages.

---

# Forbidden Behaviors

Avoid:
- generic "Something went wrong"
- swallowed exceptions
- leaking internal stack traces
- silent failures

---

# Required Error Structure

Errors must include:
- error code
- user-safe message
- correlation id
- retry guidance

---

# Logging Rules

All important failures must log:
- exception
- context
- notebook id
- user id if safe
- workflow state

---

# AI Workflow Errors

AI failures must distinguish:
- retrieval failure
- grounding failure
- provider failure
- evaluation failure
- parsing failure

---

# Retry Rules

Retry only:
- transient network failures
- temporary provider failures
- retry-safe workflows

Avoid:
- retry storms
- duplicate side effects

---

# UX Rules

Users must see:
- useful errors
- recovery actions
- retry options
- preserved work state
