---
feature: FEAT-140
status: active
---
# Run Brief: FEAT140 SLICE69: Pre-merge security sweep — secrets scan + supply-chain audit routing

- Created: 2026-06-13T16:38:53.927Z
- Tier: full
- Goal: Lift the security grade dimension (avg 0.77, below the 0.80 bar) by promoting the inspector's existing _manual_ secrets-grep + CVE-audit pre-flight (`agents/inspector.md` lines 103-104) into a structured, evidence-bearing security-sweep skill invocation that:  1. Reports findings as `[SEVERITY] file:line — description` blocks matching the inspector's existing Finding format (lines 154-160). 2. Emits one observable structured-log entry per scan invocation so the loop can grade `observability` ind
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - ### Deliverable 1 — New domain skill `skills/domain/security-sweep/SKILL.md`

- File path: `skills/domain/security-sweep/SKILL.md` (directory name must equal frontmatter `name: security-sweep` per `scripts/validate-skills.ts:checkDirectoryName`).
- Tier: `domain`. Required frontmatter: `name`
  - `tier`
  - `description`. Recommended: `owner`
  - `last_reviewed: 2026-06-13`
  - `triggers: secrets
  - supply chain
  - dependency audit
  - lockfile
  - npm audit
  - pip-audit
  - cargo audit
  - govulncheck
  - dependency confusion
  - typosquatting`.
- Body MUST include `## When to use` (or `## Trigger`) heading AND `## Done` (or `## Acceptance` / `## Stop when`) heading per validator's `checkSectionHeadings` warnings.
- ≤ 200 lines hard cap per `scripts/validate-skills.ts:MAX_LINES`.
- Required sections:
  1. **When to use** —
- Out Of Scope:
  - - Live CVE-database fetches at scan time beyond what `bun audit` / `pip-audit` / `cargo audit` / `govulncheck` already query — no new HTTP clients
  - no new API keys.
- Runtime hooks (`hooks/` directory) — security-sweep is invoked by the inspector at review time
  - not by a hook on every tool call.
- Signing infrastructure (SLSA
  - Sigstore
  - code-signing key management) — separate FEAT if needed.
- A n
- Planned Files: -
- Next Step: Begin implementation

