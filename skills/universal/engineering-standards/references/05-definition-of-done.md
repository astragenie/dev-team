# Definition of Done

High-level launch checklist. A feature is NOT complete until every applicable bullet is satisfied — depth on each lives in the sibling references.

## Implementation

- Feature implemented; code compiles; lint + typecheck clean.
- Existing architecture + patterns reused (see `06-change-quality-standards.md`).
- Behavior verified end-to-end (not just unit-tested in isolation).
- No dead code, no commented-out blocks, no debug spam in the diff.

## Testing

- Unit tests for net-new logic.
- Integration tests where boundaries are crossed.
- Regression test for any bug fix.
- Evaluation tests for AI workflows (where applicable).
- Skipped tests carry a documented reason + follow-up id. See `08-testing-standards.md`.

## Error handling + observability

- Failures are safe, structured (RFC 7807), and user-actionable.
- Required logs / spans / metrics emitted per `09-api-error-contract-standards.md` + `11-observability-standards.md`.
- Correlation id propagated through every outbound call.

## UX (when surface is user-facing)

- Loading state, empty state, error state, success state all handled.
- Responsive layout verified.
- Accessibility checks pass (keyboard nav, ARIA, contrast, focus order).
- No hardcoded user-facing strings when i18n is in play.

## Security

- No secrets / tokens / connection strings committed or logged.
- Input validation at the boundary.
- Authorization enforced; multi-tenant isolation preserved.
- Pre-completion secret grep passed (see `skills/workflow/builder-ceremony/`).

## Documentation

- Update the PRD if behavior changed.
- Update / add an ADR if architecture changed.
- Update README if setup or run instructions changed.
- CHANGELOG entry for user-visible change.

## Deployment

- Migrations expand-contract + reversible + safe under load. See `19-devops-deployment-standards.md`.
- Env vars + secrets registered.
- Health endpoints exercised by smoke test for new services.
- Rollback path verified.

## AI-specific (when AI surfaces ship)

- Outputs preserve citations / grounding metadata.
- Hallucination guards in place where the contract requires.
- Memory writes preserve traceability + version history.
- Eval suite green on the new prompt + model combination.

## Final completion checklist

Before marking complete:

- Tests pass (slice-scoped at minimum; full suite for risky changes).
- Logs validated against expected shape.
- UI reviewed manually if user-facing changed.
- Docs updated.
- Edge cases reviewed (boundary, null, concurrent, idempotent retry, error path).
- Performance reviewed against documented budget; regressions surfaced in Risks.
- Self-verify gates green or BLOCKED surfaced.
