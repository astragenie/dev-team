import { test, expect } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  persistDispatchHandle,
  loadAndDeleteDispatchHandle
} from "../hooks/lib/dispatch-handle-store.ts";

test("persist + load returns the handle and deletes the file", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-store-"));
  try {
    const handle = {
      runId: "run-1",
      sliceId: "SLICE-99",
      agent: "crew:fullstack-dev",
      model: "sonnet",
      startMs: 1234
    };
    await persistDispatchHandle("session-A", handle, tmp);
    const stateFile = path.join(
      tmp,
      ".claude",
      "state",
      "crew",
      "dispatch-timing",
      "session-A.json"
    );
    const stat = await fs.stat(stateFile);
    expect(stat.isFile(), "state file should exist after persist").toBeTruthy();

    const loaded = await loadAndDeleteDispatchHandle("session-A", tmp);
    expect(loaded).toEqual(handle);

    await expect(fs.stat(stateFile)).rejects.toThrow();
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("loadAndDelete returns null when no handle persisted", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-store-"));
  try {
    const loaded = await loadAndDeleteDispatchHandle("nonexistent", tmp);
    expect(loaded).toBe(null);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("persist with empty session_id is a no-op", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-store-"));
  try {
    await persistDispatchHandle(
      "",
      {
        runId: "r",
        sliceId: "s",
        agent: "a",
        model: "m",
        startMs: 0
      },
      tmp
    );
    const dir = path.join(tmp, ".claude", "state", "crew", "dispatch-timing");
    await expect(fs.stat(dir)).rejects.toThrow();
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});

test("sanitizes session_id with unsafe characters", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dispatch-store-"));
  try {
    const handle = {
      runId: "r",
      sliceId: "s",
      agent: "a",
      model: "m",
      startMs: 100
    };
    const unsafe = "session/with\\unsafe:chars";
    await persistDispatchHandle(unsafe, handle, tmp);

    const loaded = await loadAndDeleteDispatchHandle(unsafe, tmp);
    expect(loaded).toEqual(handle);
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
