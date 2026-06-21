# Testing Standards

What tests are owed for a change, how to pick the right layer, when skipping is acceptable.

## Test selection matrix

| Layer | Use when | Avoid when |
|---|---|---|
| **Unit** | Pure logic, single class / function, no I/O. Fast, deterministic, parallel-safe. | Behavior emerges from collaboration with infra. |
| **Integration** | Crosses a boundary (DB, HTTP, queue, file system). Verifies the wiring, not the unit. | Slow + brittle for logic that has no real boundary. |
| **Contract** | Verifies the API shape against an OpenAPI / proto / event schema. | When no machine-readable contract exists. |
| **End-to-end** | User-visible flow across the stack. Smoke level only. | Detailed branching — push down to unit / integration. |
| **AI evaluation** | Prompt / model / retrieval changes. Run against fixtures or live judge. | Pure code paths with no LLM. |

## What to test (by change shape)

- **Net-new behavior** → unit test FIRST (TDD). Add integration test if a boundary is crossed.
- **Bug fix** → regression test that fails on the bug + passes on the fix. Without it, the fix is not a fix.
- **Refactor** → existing tests must stay green; no new tests required if behavior unchanged.
- **API change** → contract test against the OpenAPI YAML; reject drift at boundary.
- **AI workflow change** → eval suite covering retrieval, grounding, hallucination, parsing.

## Edge-case coverage (every net-new handler)

Required scenarios:

- Boundary: 0, 1, max page size, min/max numeric.
- Null / empty / missing field.
- Concurrent: parallel requests, race on shared state.
- Idempotency: same write twice → same result (idempotency key where applicable).
- Error path: structured response with stable code; never leak stack traces.

Net-new endpoint without an edge-case test = half done.

## Regression test policy

- Bug fix MUST land with a regression test, even if the bug is "obvious."
- Test must demonstrably FAIL on the pre-fix code (verify by reverting the fix locally).
- Document the fixture name + assertion in the Risks line so reviewer can re-run.

## AI evaluation tests

Cover at minimum:

- Retrieval — does it surface the expected documents?
- Grounding — does the answer cite the retrieved evidence?
- Hallucination — does it refuse to answer when evidence is absent?
- Parsing — does structured output match the schema 100%?

## When tests may be skipped

Skipping is acceptable ONLY when:

- The change is doc-only / comment-only / mechanical rename.
- A pre-existing test already covers the new path (cite the fixture).
- The change is behind a feature flag default-off and the test is queued in a follow-up.

In every case, document the reason in the Risks line. Reviewer treats undocumented skip as `needs_fix`.

## Test hygiene

- Tests must be deterministic. Flake = `0` tolerance.
- Avoid arbitrary `sleep` / `setTimeout` — use condition-based waiting (see `skills/workflow/root-cause-discipline/flake-and-hardening.md`).
- Tests must clean up shared state (tempdir, DB rows, env vars).
- Parallel-safe by default; sequential only with documented reason.
- Snapshot tests acceptable for stable UI; not for evolving JSON contracts.

## Cross-reference

Flake debugging + test-pollution diagnosis: `skills/workflow/root-cause-discipline/`.
