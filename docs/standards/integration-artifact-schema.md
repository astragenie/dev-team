# Integration artifact schema

Written by `crew:integrator` to `.claude/artifacts/crew/integrations/<SLICE-NN>-integration.md`.

## Mandatory sections

| Section | Required content |
|---|---|
| `# Integration smoke — SLICE-NN` | Title with the SLICE id |
| `## Outcome: PASS \| FAIL \| SKIP` | Verbatim — reviewer's `Integration Conformance` reads this line |
| `## Happy-path AC exercised` | The full AC text the integrator was dispatched to exercise |
| `## Versions` | OpenAPI `info.version`, FE/BE handoff paths |
| `## Evidence` | BE/FE startup times, HTTP trace (status + ms + schema-valid flag), UI snapshot path if `surface:ui`, BE log tail |
| `## Drift detected` | `none` OR specific FE-expected-vs-BE-returned field paths |
| `## Next` | `pass: reviewer` OR `fail: /crew:fix --target integration --reason "<one-line>"` |

## SKIP cases

- `Outcome: SKIP — SPLIT_BUILD false` — integrator was dispatched in error; orchestrator bug
- `Outcome: SKIP — explicit override` — slice frontmatter `skip: ["integrator"]`

Other sections (Versions, Evidence, Drift, Next) may be empty for SKIP — only Outcome + the SKIP reason are required.
