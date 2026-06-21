#!/usr/bin/env bash
# Bisects a test suite to find which test creates an unwanted file or state.
#
# Usage:
#   ./find-polluter.sh <pollution_path> <test_root> [glob]
#
# Args:
#   pollution_path   File or directory to watch for (e.g. ".git", "/tmp/leak").
#   test_root        Directory to scan for test files (e.g. "src", "tests").
#   glob             Optional filename glob (default: "*.test.ts").
#                    Examples: "*.spec.ts" "*.test.tsx" "*_test.go" "test_*.py"
#
# Examples:
#   ./find-polluter.sh '.git' src '*.test.ts'
#   ./find-polluter.sh '/tmp/lock-leak' tests
#   ./find-polluter.sh '.cache' . '*.spec.js'
#
# Notes:
# - We use `find -name <glob>` (single-segment match) rather than `-path` so
#   that ordinary file globs work intuitively. If you need to restrict to a
#   subdirectory pattern, narrow <test_root> instead of using a path glob.
# - Default runner is `bun test --parallel`. Set TEST_CMD to override.

set -euo pipefail

if [ $# -lt 2 ] || [ $# -gt 3 ]; then
  echo "Usage: $0 <pollution_path> <test_root> [glob]"
  echo ""
  echo "Examples:"
  echo "  $0 '.git' src '*.test.ts'"
  echo "  $0 '/tmp/leak' tests"
  echo "  $0 '.cache' . '*.spec.js'"
  exit 1
fi

POLLUTION_CHECK="$1"
TEST_ROOT="$2"
TEST_GLOB="${3:-*.test.ts}"
RUNNER="${TEST_CMD:-bun test --parallel}"

if [ ! -d "$TEST_ROOT" ]; then
  echo "Error: test root '$TEST_ROOT' is not a directory." >&2
  exit 1
fi

echo "🔍 Searching for the test that creates: $POLLUTION_CHECK"
echo "    test_root: $TEST_ROOT"
echo "    glob:      $TEST_GLOB"
echo "    runner:    $RUNNER"
echo ""

mapfile -t TEST_FILES < <(find "$TEST_ROOT" -type f -name "$TEST_GLOB" | sort)
TOTAL="${#TEST_FILES[@]}"

if [ "$TOTAL" -eq 0 ]; then
  echo "No test files matched: find '$TEST_ROOT' -type f -name '$TEST_GLOB'"
  exit 1
fi

echo "Found $TOTAL test files"
echo ""

# If pollution already exists at start, the runner can't be blamed for creating it.
if [ -e "$POLLUTION_CHECK" ]; then
  echo "⚠️  Pollution path already exists BEFORE any test ran: $POLLUTION_CHECK"
  echo "    Clean it up and rerun, or this script can't isolate the polluter."
  exit 1
fi

COUNT=0
for TEST_FILE in "${TEST_FILES[@]}"; do
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] Testing: $TEST_FILE"

  # Run the single test (ignore failures — we care about pollution side effect).
  $RUNNER "$TEST_FILE" > /dev/null 2>&1 || true

  if [ -e "$POLLUTION_CHECK" ]; then
    echo ""
    echo "🎯 FOUND POLLUTER!"
    echo "   Test:    $TEST_FILE"
    echo "   Created: $POLLUTION_CHECK"
    echo ""
    echo "Pollution details:"
    ls -la "$POLLUTION_CHECK"
    echo ""
    echo "To investigate:"
    echo "  $RUNNER $TEST_FILE    # rerun just this test"
    echo "  cat $TEST_FILE        # read the test code"
    exit 1
  fi
done

echo ""
echo "✅ No polluter found — all tests left $POLLUTION_CHECK absent."
exit 0
