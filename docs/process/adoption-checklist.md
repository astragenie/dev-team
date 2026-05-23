# Adoption Checklist

Run through this before pointing the Crew harness at a new repository or
re-running `/crew:adopt` on a repo that already has a pre-P3.1 install.

## What `/crew:adopt` will change

The bootstrap is **content-preserving** but **structurally destructive** —
no file data is lost, but the legacy `engineering-os/` directory tree is
removed once its contents have been migrated forward into `crew/`.

### Created or refreshed

- `.claude/crew/constitution.md` — framework rules
- `.claude/crew/workflow.md` — preferred sequence and gate policy
- `.claude/crew/protocol.md` — artifact shape documentation
- `.claude/state/crew/{claims,history,approvals}.{json,jsonl}` — fresh seeds, only written if missing
- `.claude/state/crew/{workflow-state,sprint}.json` — only written if missing
- `.claude/artifacts/crew/{runs,handoffs,reviews,validations,deployments}/`
- `.claude/state/crew/README.md`, `.claude/artifacts/crew/README.md`
- `.claude/hooks/log_event.sh`, `.claude/hooks/check_git_gate.sh`
- `.claude/settings.json` — hook entries with the `crew:*` description prefix,
  merged with any existing entries the user has

### Migrated (content moves forward, source unlinked)

For every file under each of these legacy directories, the file is moved into
the corresponding `crew/` path. When both sides have the same filename, the
newer `mtime` wins (`crew/` wins on tie). The empty legacy directories are
then removed.

- `.claude/engineering-os/` → `.claude/crew/`
- `.claude/state/engineering-os/` → `.claude/state/crew/`
- `.claude/artifacts/engineering-os/` → `.claude/artifacts/crew/`

### Modified in place

- `CLAUDE.md`:
  - If the legacy marker block `<!-- engineering-os:start --> ... <!-- engineering-os:end -->`
    is present, it is replaced with the new `<!-- crew:start --> ... <!-- crew:end -->`
    block (which imports `@.claude/crew/constitution.md`).
  - If neither marker is present, the new block is appended to the end.
  - All other CLAUDE.md content is preserved.

## Pre-flight checks per repo

Run through this list before invoking `/crew:adopt`:

1. **Back up `.claude/`.** Cheap insurance, easy to discard:
   ```bash
   cp -r .claude .claude.backup.$(date -u +%Y%m%dT%H%M%SZ)
   ```

2. **Hand-authored content in `.claude/engineering-os/`?** Anything besides
   `deployment.md` (which the runtime already manages) — e.g. a hand-written
   `slice-notes.md` — will be moved into `.claude/crew/` with the same filename.
   If `.claude/crew/<same-filename>` already exists, newer mtime wins. Verify
   you're OK with that before running.

3. **Active workflow run in `state/engineering-os/workflow-state.json`?** It
   is preserved (moved to `state/crew/` if missing, newer mtime if both
   exist). No data loss, but worth knowing the gate badges will still be in
   place after migration.

4. **CLAUDE.md is fully under your control?** The marker-block insertion is
   idempotent and additive, but if you have strong opinions about CLAUDE.md
   ordering, decide before running whether to let the installer append at
   the end or whether you want to position the block manually afterward.

5. **`.gitignore` treatment of `.claude/`?** Decide whether to:
   - Commit `.claude/{crew,hooks,settings.json}` so the harness is reproducible
   - Commit only `.claude/artifacts/crew/` for the historical record
   - Gitignore everything (treat the harness as per-clone runtime state)

   Runtime files that should always be gitignored regardless:
   `.claude/logs/`, `.claude/state/crew/workflow-state.json` (changes constantly).

## After `/crew:adopt`

Verify with `audit`:

```bash
node "$HOME/.claude/plugins/cache/astra/crew/0.3.0/scripts/crew.mjs" audit --repo "$PWD"
```

Look for:

- `hasHarnessLayer: true`
- `hasStateLayer: true`
- `hasWorkflowState: true`
- `global.hasGlobalMemory: true`, `global.globalMemoryStale: false`

Inspect the repo tree:

```bash
find .claude/engineering-os .claude/state/engineering-os .claude/artifacts/engineering-os 2>/dev/null
# should print nothing — legacy dirs gone
ls .claude/crew/    # constitution.md, workflow.md, protocol.md, deployment.md if migrated
ls .claude/state/crew/    # workflow-state.json, claims.json, history.jsonl, approvals.jsonl, sprint.json, README.md
```

## Rollback

If something goes wrong:

1. Restore the `.claude/` backup directory from step 1
2. Restore CLAUDE.md from git: `git checkout HEAD -- CLAUDE.md`
3. File an issue or note what surprised you so the checklist can absorb it

## Repos that should NOT adopt

- Throwaway scratch repos — the harness overhead is not worth it
- Repos already on a strict in-house methodology that won't tolerate
  parallel artifact bookkeeping
- Repos where you can't commit `.claude/` and don't want every contributor
  to bootstrap independently
