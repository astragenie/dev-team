# Spec pre-flight: spec-readiness rubric

How researcher output feeds the SPEC → FEAT → slice pipeline. The consumer is
the architect writing a contracts artifact (`/crew:architect-feature`), then PM
decomposition. Findings that don't meet this bar bounce back as re-dispatch.

## Output blocks

Each block cited per the evidence ladder, using real identifiers (type names,
route paths, field names, file paths) — never placeholders:

- `FINDING` — what is true in the codebase today. One claim per block.
- `CONSTRAINT` — what limits solution shape: hard dependency, architectural
  boundary, backward-compat obligation, license/platform limit.
- `EDGE CASE` — scenario a naive implementation would miss; phrase it so it
  converts directly to an acceptance criterion (Given/When/Then-able).
- `DEPENDENCY` — what must exist or be available before implementation:
  external service, schema migration, upstream release, credential.
- `NFR` — performance, security, compliance implications observed in the
  current code (e.g. "endpoint is on the hot path — p95 budget applies").

## Spec-readiness checks

A pre-flight report is ready when:

1. **Self-contained** — readable without this session's context; acronyms and
   repo-specific terms defined at first use.
2. **Facts vs options separated** — findings (graded evidence) never blended
   with recommendations (clearly-labeled options with trade-offs).
3. **Testable framing** — every EDGE CASE and behavioral FINDING is phrased so
   an acceptance criterion can quote it.
4. **Dependencies surfaced** — anything that gates slice 1 is a DEPENDENCY
   block, not a sentence buried in prose.
5. **Open questions isolated** — unknowns that BLOCK the spec listed separately
   from nice-to-knows, each with what evidence would settle it and where to
   look.

## Anti-patterns

- Recommending an architecture — that is the architect's call; supply
  constraints and trade-offs, not the decision.
- "Should be straightforward" — effort judgments without evidence; if sizing
  matters, cite the blast radius (files, call sites, tests touched).
- Restating the FEAT body as findings — pre-flight exists to add evidence the
  FEAT author didn't have.
- Unbounded option lists — two or three viable options with a comparison
  beats five unevaluated ones.

## Handoff mapping

`write-handoff` flags carry the rubric: blocks go in the body via
`--deliverable`/`--scope`; blocking unknowns go in `--risks`; `--confidence`
reflects the lowest-graded load-bearing claim, not the average.
