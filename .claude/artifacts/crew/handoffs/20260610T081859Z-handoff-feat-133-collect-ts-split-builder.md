# Task Handoff: FEAT-133 collect.ts split — builder

- Created: 2026-06-10T08:18:59.649Z
- From: builder
- To: lead
- Objective: Split 792-line collect.ts into git/cost/workflow/hook/bundle.ts + 27-line re-export barrel; behavior-preserving
- Allowed Scope:
  - scripts/lib/briefing/* split per reviewed slice-spec; no behavior change; collect-cost-parser.ts/briefing.ts/render.ts untouched
- Forbidden Scope: -
- Deliverable: 5 new modules (git 188, cost 243, workflow 221, hook 58, bundle 78), collect.ts barrel 27L, new tests/briefing-module-imports.test.ts
- Changed Files:
  - scripts/lib/briefing/{collect
  - git
  - cost
  - workflow
  - hook
  - bundle}.ts
  - tests/briefing-module-imports.test.ts
- Confidence: high
- Risks: New test mislabeled 'golden-snapshot' — actually an import/re-export guard; real no-output-change guard is the existing 535-test suite (all pass). No literal brief-me golden fixture created (spec-acceptable).
- Suggested Next Handoff: independent review: verify re-export completeness incl. type exports, verbatim code moves, no behavior drift

