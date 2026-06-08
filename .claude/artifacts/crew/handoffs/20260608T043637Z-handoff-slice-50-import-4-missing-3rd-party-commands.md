# Task Handoff: SLICE-50: Import 4 missing 3rd-party commands

- Created: 2026-06-08T04:36:37.622Z
- From: builder
- To: lead
- Objective: 4 new command files created under commands/3rdparty/ (create-prd, refactor-code, architecture-review, create-architecture-documentation), all gates pass, FEAT-126 ready for close.
- Allowed Scope:
  - commands/3rdparty/{create-prd
  - refactor-code
  - architecture-review
  - create-architecture-documentation}.md — new files only; no existing files touched
- Forbidden Scope: -
- Deliverable: 4 command files at commands/3rdparty/ with normalized frontmatter (description: only), sourced from davila7/claude-code-templates via gh api + base64 decode; all self-verify gates pass (446 tests, 0 failures)
- Changed Files:
  - commands/3rdparty/create-prd.md
  - commands/3rdparty/refactor-code.md
  - commands/3rdparty/architecture-review.md
  - commands/3rdparty/create-architecture-documentation.md
- Confidence: high
- Risks: none
- Suggested Next Handoff: slice-complete ceremony for SLICE-50 (moves FEAT-126 to done); reviewer ladder A+B per slice file

## Command Imports Detail

| Command | Target path | Source URL | Fetch method |
|---|---|---|---|
| create-prd | `commands/3rdparty/create-prd.md` | `https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/commands/project-management/create-prd.md` | `gh api repos/davila7/claude-code-templates/contents/cli-tool/components/commands/project-management/create-prd.md` + base64 decode |
| refactor-code | `commands/3rdparty/refactor-code.md` | `https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/commands/utilities/refactor-code.md` | `gh api repos/davila7/claude-code-templates/contents/cli-tool/components/commands/utilities/refactor-code.md` + base64 decode |
| architecture-review | `commands/3rdparty/architecture-review.md` | `https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/commands/team/architecture-review.md` | `gh api repos/davila7/claude-code-templates/contents/cli-tool/components/commands/team/architecture-review.md` + base64 decode |
| create-architecture-documentation | `commands/3rdparty/create-architecture-documentation.md` | `https://github.com/davila7/claude-code-templates/blob/main/cli-tool/components/commands/documentation/create-architecture-documentation.md` | `gh api repos/davila7/claude-code-templates/contents/cli-tool/components/commands/documentation/create-architecture-documentation.md` + base64 decode |

Source layout confirmed: flat `<category>/<name>.md` (not nested `<name>/COMMAND.md`).

## Frontmatter Normalization

Source commands had richer frontmatter: `allowed-tools:` and `argument-hint:` keys were present. These were stripped per repo convention (only `description:` retained). Body content kept verbatim from source. No `arguments:` key added — source commands use `$ARGUMENTS` inline placeholder but do not define a structured arguments schema.

## Deferred Items Disposition (FEAT-126 Clean Trail)

Three "confirm-vs-existing" items were flagged in FEAT-126 and are **SKIPPED** per user decision:

| Item | Decision | Rationale |
|---|---|---|
| `senior-fullstack` skill | SKIP | Duplicate of existing `skills/domain/fullstack-advisory/SKILL.md` which already sources `aitmpl/development/senior-fullstack` |
| `ui-design-system` skill | SKIP | Duplicate coverage already in `skills/domain/ux-methodology/references/design-systems.md` |
| `marketing-ideas` + `executing-marketing-campaigns` skills | SKIP | Researcher role; repo focus is engineering tooling — out of repo scope |

## Self-Verify Gates

| Gate | Command | Result |
|---|---|---|
| Manifest validator | `node scripts/validate-manifests.ts` | PASS — crew@0.20.0 aligned across plugin.json + package.json + marketplace.json |
| Skills validator | `node scripts/validate-skills.ts` | PASS — 47 skills checked, no regression |
| Agents validator | `node scripts/validate-agents.ts` | PASS — 11 agents checked, no regression |
| Lint | `npm run lint` | PASS — zero warnings |
| Format check | `npm run format:check` | PASS — all matched files use Prettier code style |
| Test suite | `node --test` | PASS — 446 tests, 0 failures, 0 skipped |

## TDD Note

TDD skipped: this slice is a pure content-import task (new `.md` command files with no TypeScript behavior). No new public functions or runtime code were introduced. The existing test suite is the full regression contract; no new tests warranted.

## AC Verification

- AC-1: 4 files exist at `commands/3rdparty/{create-prd,refactor-code,architecture-review,create-architecture-documentation}.md` — PASS
- AC-2: `node scripts/validate-manifests.ts` — PASS
- AC-3: Each command has a clear `description:` frontmatter value — PASS
- AC-4: `npm run lint` + `npm run format:check` — PASS (zero warnings)
- AC-5: `npm test` — PASS (446/446)
- AC-6: No duplicate command names across `commands/` tree — PASS (3rdparty/ subdirectory isolates names; no top-level collision)
- AC-7: FEAT-126 to done — pending slice-complete ceremony (out of builder scope)

