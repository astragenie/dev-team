// Generic condition-based waiting utilities.
//
// Drop-in for any TS/JS test suite. The original Lace-specific versions
// (waitForEvent / waitForEventCount / waitForEventMatch typed against
// LaceEvent / ThreadManager) were generalized in v1.1.0.
//
// Pattern: pass a closure that returns the value when ready, undefined /
// null / false otherwise. The poller resolves with the value on first
// success, or rejects with a clear error after timeoutMs.

/**
 * Wait for a condition to become truthy and return its value.
 *
 * @param condition - Closure returning the awaited value, or undefined / null / false while not ready.
 * @param description - Human-readable description used in the timeout error.
 * @param timeoutMs - Maximum wait in milliseconds (default 5000ms).
 * @param pollMs - Polling interval in milliseconds (default 10ms). Don't go below 5ms; CPU waste.
 *
 * Example — wait for an item in a queue:
 *   const job = await waitFor(() => queue.find(j => j.id === wantId), 'job ' + wantId);
 *
 * Example — wait for state:
 *   await waitFor(() => machine.state === 'ready', 'machine ready');
 *
 * Example — wait for file presence:
 *   await waitFor(() => fs.existsSync(path) ? path : undefined, 'file ' + path);
 */
export async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000,
  pollMs = 10
): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = condition();
    if (result) return result as T;

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for ${description} after ${timeoutMs}ms`);
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/**
 * Wait until a collection contains at least `count` items matching the predicate.
 * Resolves with the matching subset.
 *
 * Example — wait for 2 results to arrive:
 *   const results = await waitForCount(() => store.results.filter(r => r.type === 'OK'), 2, '2 OK results');
 */
export async function waitForCount<T>(
  collect: () => readonly T[],
  count: number,
  description: string,
  timeoutMs = 5000,
  pollMs = 10
): Promise<T[]> {
  const startTime = Date.now();

  while (true) {
    const matches = collect();
    if (matches.length >= count) return matches.slice(0, count);

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Timeout waiting for ${count} ${description} after ${timeoutMs}ms (got ${matches.length})`
      );
    }

    await new Promise((r) => setTimeout(r, pollMs));
  }
}

// Real-world usage shape (from the original debugging session that motivated
// this utility — names anonymized):
//
// BEFORE (flaky — 60% pass rate, random failures):
//   const messagePromise = client.send('Execute tools');
//   await new Promise(r => setTimeout(r, 300)); // hope tools start in 300ms
//   client.abort();
//   await messagePromise;
//   await new Promise(r => setTimeout(r, 50));  // hope results arrive in 50ms
//   expect(toolResults.length).toBe(2);
//
// AFTER (deterministic — 100% pass rate, 40% faster):
//   const messagePromise = client.send('Execute tools');
//   await waitForCount(() => events.filter(e => e.type === 'TOOL_CALL'), 2, 'TOOL_CALL events');
//   client.abort();
//   await messagePromise;
//   await waitForCount(() => events.filter(e => e.type === 'TOOL_RESULT'), 2, 'TOOL_RESULT events');
//   expect(toolResults.length).toBe(2);
