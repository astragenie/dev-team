# Decisions

Retrospective architecture decisions captured during slice work. ADR-style
files at `.claude/artifacts/loop/decisions/DEC-NNN.md` — **this is the
authoritative decision store** (FEAT-188 S1a AC-5). `docs/decisions/` (this
directory) keeps only the template and this pointer; it no longer holds the
DEC-NNN files themselves. Distinct from `docs/specs/` (type=adr) which are
forward-looking design decisions made BEFORE work begins; decisions here
are ones that emerged DURING implementation.

## How they're created

Decisions originate in grade files (`.claude/artifacts/loop/grades/*.md`)
under the `## Decisions` section as `### DEC-TBD: <title>` blocks. When the
agent runs `/loop:slice grade-write`, the plugin:

1. Allocates the next `DEC-NNN` id
2. Writes a full ADR file at `.claude/artifacts/loop/decisions/DEC-NNN.md` from `decision-template.md`
3. Updates the grade body to replace `DEC-TBD` with `DEC-NNN`
4. Appends the id to the grade frontmatter `decisions: [...]`

Idempotent — only blocks still marked `DEC-TBD` are extracted on re-run.

## Lifecycle

- `status: accepted` — current valid decision
- `status: superseded` — newer decision replaces this; `superseded_by: DEC-NNN`
- `status: reverted` — decision rolled back; usually paired with a `surprises`
  entry in the next grade file explaining what went wrong

## Inspecting

- `/loop:decisions list [--status accepted|superseded|reverted]`
- `/loop:decisions show --id DEC-NNN`
