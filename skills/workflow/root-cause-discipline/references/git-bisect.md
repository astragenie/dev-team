# Git Bisect — Regression, Unknown Commit

Use this procedure when `/crew:fix` surfaces a regression and the introducing
commit is unknown. Bisect narrows it to a single commit without manual
inspection of the full history.

## When to Use

- A test that was passing is now failing and you don't know which commit broke it.
- `git log --oneline` shows 5+ commits since the last known-good state.
- The bug is reliably reproducible (or near-reliably — see [Flaky tests](#flaky-tests) below).

## Prerequisites

- A failing test (or shell command) that exits 0 = good / nonzero = bad.
- A known-good commit SHA (or tag). If unknown, try `git log --oneline -20` to
  identify a plausible anchor, or use `HEAD~20` as a pessimistic guess.
- A clean working tree (`git status` should show nothing modified).

## Auto-Detect the Test Command

Before bisecting, resolve the test command to run for each candidate commit.

Priority order (stop at first match):

1. **Package.json `scripts.test`** — read with:
   ```bash
   node -e "const p=require('./package.json');console.log(p.scripts?.test||'')"
   ```
   Accept if non-empty and not the placeholder `"echo \"Error: no test specified\" && exit 1"`.

2. **Bun presence + `bun test`** — if `package.json` exists and the result of
   step 1 is empty, check for Bun:
   ```bash
   command -v bun && echo "bun test --timeout 30000"
   ```

3. **`npm test`** — fallback when neither of the above resolves:
   ```bash
   npm test
   ```

4. **Explicit override** — if the caller supplies `TEST_CMD` as an env var,
   use it directly and skip steps 1–3.

Store the resolved command in `TEST_CMD` for the steps below.

## Retry-Before-Verdict (Flaky Tests) {#flaky-tests}

A single failing run can be a timing fluke. Before declaring a commit "bad",
retry the test command up to `N=3` times. A commit is "bad" only when ALL
`N` runs exit nonzero.

Wrap the test command in a retry shell function:

```bash
run_with_retry() {
  local cmd="$1"
  local n="${BISECT_RETRIES:-3}"
  for attempt in $(seq 1 "$n"); do
    if eval "$cmd"; then
      return 0   # at least one pass → good commit
    fi
    echo "[bisect] attempt $attempt/$n failed — retrying..."
  done
  return 1       # all attempts failed → bad commit
}
```

Use `run_with_retry "$TEST_CMD"` as the bisect script command (see step 3
below).

## Bisect Procedure

### 1. Start bisect

```bash
git bisect start
git bisect bad                     # current HEAD is broken
git bisect good <KNOWN_GOOD_SHA>   # last known-good commit
```

Git prints the number of steps remaining and checks out the midpoint commit.

### 2. Create the bisect script

Create a temporary script so bisect can run automatically. The script exits 0
(good) or 1 (bad) for each candidate commit:

```bash
cat > /tmp/bisect-run.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

# Resolve test command (priority: env override > package.json > bun > npm)
if [ -z "${TEST_CMD:-}" ]; then
  _pkg_test=$(node -e "try{const p=require('./package.json');const s=p.scripts?.test||'';if(s&&!s.includes('no test specified'))console.log(s)}catch{}" 2>/dev/null || true)
  if [ -n "$_pkg_test" ]; then
    TEST_CMD="$_pkg_test"
  elif command -v bun &>/dev/null && [ -f package.json ]; then
    TEST_CMD="bun test --timeout 30000"
  else
    TEST_CMD="npm test"
  fi
fi

BISECT_RETRIES="${BISECT_RETRIES:-3}"

for attempt in $(seq 1 "$BISECT_RETRIES"); do
  if eval "$TEST_CMD"; then
    exit 0   # good commit
  fi
  echo "[bisect] attempt $attempt/$BISECT_RETRIES failed"
done
exit 1       # bad commit
EOF
chmod +x /tmp/bisect-run.sh
```

### 3. Run bisect automatically

```bash
git bisect run /tmp/bisect-run.sh
```

Git will:
- check out a midpoint commit,
- run the script,
- record good/bad,
- repeat until the first bad commit is found.

### 4. Record the result

When bisect finishes, it prints:

```
<sha> is the first bad commit
commit <sha>
Author: ...
Date:   ...
    <commit message>
```

Record this SHA in the `/crew:fix` investigation notes before proceeding.

### 5. Clean up

```bash
git bisect reset   # returns to the original HEAD
rm -f /tmp/bisect-run.sh
```

## Interpreting the Result

After identifying the introducing commit:

1. `git show <sha>` — read the full diff.
2. Trace which change in that diff is the root cause (see `root-cause-tracing.md`).
3. Document: "Regression introduced in `<sha>` by `<specific change>`."
4. Proceed to Phase 3 (Hypothesis) of the main root-cause-discipline flow.

## Edge Cases

| Situation | Action |
|-----------|--------|
| No known-good commit | Use `git log --oneline` to estimate; try a commit before the feature area changed. |
| Bisect finds a merge commit | Check both parents; the regression may be in one of the merged branches. |
| Build fails mid-bisect for unrelated reason | Mark as "skip": `git bisect skip`. Bisect works around skipped commits. |
| Test command itself changes between commits | Use `git bisect run` with a stable wrapper that re-installs deps each run (`npm ci && $TEST_CMD`). |
| Bisect terminates with "cannot bisect" | History is non-linear; run `git bisect log` to inspect, then resume manually. |

## Integration with `/crew:fix`

This procedure is the canonical path for the "regression, unknown commit" case
in `/crew:fix`. After bisect:

- The introducing commit SHA goes into the fix handoff under `--risks
  root-cause-commit: <sha>`.
- The test that bisect ran becomes the failing reproducer for Phase 4 TDD.
- No fix should be attempted until the root cause within that commit is
  identified per `root-cause-tracing.md`.
