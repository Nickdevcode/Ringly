import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyTask,
  DEFAULT_SESSION_TTL_MS,
  deriveProgress,
  readProgressRecord,
  recordTask,
} from "../src/core/sessionProgress.js";

const PROGRESS_FILE = "session-progress.json";

// A SessionEntry literal for the pure helpers (kept inline to avoid exporting
// the internal type just for tests).
function entry(
  createdIds: number[],
  completedIds: number[],
  sawCompletion: boolean,
  updatedAt = 0,
) {
  return { createdIds, completedIds, sawCompletion, updatedAt };
}

describe("applyTask (pure)", () => {
  it("records a created id into the current checklist (no completion yet)", () => {
    const next = applyTask(entry([], [], false), 3, "created", 1000);
    expect(next).toEqual({
      createdIds: [3],
      completedIds: [],
      sawCompletion: false,
      updatedAt: 1000,
    });
  });

  it("records a completed id and flags sawCompletion", () => {
    const next = applyTask(entry([1, 2], [], false), 1, "completed", 1000);
    expect(next.completedIds).toEqual([1]);
    expect(next.sawCompletion).toBe(true);
    expect(next.updatedAt).toBe(1000);
  });

  it("dedupes a repeated completed id", () => {
    const once = applyTask(entry([2], [], false), 2, "completed", 1000);
    const twice = applyTask(once, 2, "completed", 2000);
    expect(twice.completedIds).toEqual([2]);
    expect(twice.updatedAt).toBe(2000);
  });

  it("dedupes a repeated created id within the same checklist", () => {
    const once = applyTask(entry([], [], false), 5, "created", 1000);
    const twice = applyTask(once, 5, "created", 2000);
    expect(twice.createdIds).toEqual([5]);
  });

  it("a completion ensures the id is also counted in the total (clamp source)", () => {
    // Completing an id we never saw created must still raise the total so the
    // counter can't read e.g. 1/0.
    const next = applyTask(entry([], [], false), 9, "completed", 1000);
    expect(next.createdIds).toEqual([9]);
    expect(next.completedIds).toEqual([9]);
  });

  it("a creation AFTER a completion starts a fresh checklist", () => {
    // Built up a first checklist with one completion.
    let e = applyTask(entry([], [], false), 1, "created", 1000);
    e = applyTask(e, 2, "created", 1001);
    e = applyTask(e, 1, "completed", 1002);
    expect(e).toMatchObject({ createdIds: [1, 2], completedIds: [1], sawCompletion: true });

    // A new creation now resets the group; only the new id remains.
    const fresh = applyTask(e, 7, "created", 2000);
    expect(fresh).toEqual({
      createdIds: [7],
      completedIds: [],
      sawCompletion: false,
      updatedAt: 2000,
    });
  });

  it("creations BEFORE any completion accumulate into one checklist", () => {
    let e = applyTask(entry([], [], false), 1, "created", 1000);
    e = applyTask(e, 2, "created", 1001);
    e = applyTask(e, 3, "created", 1002);
    expect(e.createdIds).toEqual([1, 2, 3]);
    expect(e.sawCompletion).toBe(false);
  });

  it("ignores a non-finite or non-positive id but still bumps updatedAt", () => {
    expect(applyTask(entry([1], [1], true), Number.NaN, "completed", 1000)).toEqual({
      createdIds: [1],
      completedIds: [1],
      sawCompletion: true,
      updatedAt: 1000,
    });
    expect(applyTask(entry([], [], false), 0, "completed", 1000).completedIds).toEqual([]);
  });

  it("does not mutate the input entry", () => {
    const base = entry([1], [1], true);
    applyTask(base, 2, "completed", 1000);
    expect(base).toEqual({ createdIds: [1], completedIds: [1], sawCompletion: true, updatedAt: 0 });
  });
});

describe("deriveProgress (pure)", () => {
  it("returns exact completed and created-count as total", () => {
    expect(deriveProgress(entry([1, 2, 3, 4, 5, 6], [1, 2, 3], false))).toEqual({
      completed: 3,
      total: 6,
    });
  });

  it("clamps total to never be below completed", () => {
    // Three completions but only two creations seen → total clamps up to 3.
    expect(deriveProgress(entry([1, 2], [1, 2, 3], true))).toEqual({ completed: 3, total: 3 });
  });

  it("is zero for a fresh entry", () => {
    expect(deriveProgress(entry([], [], false))).toEqual({ completed: 0, total: 0 });
  });
});

describe("recordTask (I/O)", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "ringly-progress-"));
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("counts a created/created/completed sequence as 1/2", () => {
    recordTask(dataDir, "s1", "1", "created");
    recordTask(dataDir, "s1", "2", "created");
    const progress = recordTask(dataDir, "s1", "1", "completed");
    expect(progress).toEqual({ completed: 1, total: 2 });
  });

  it("counts a full six-item checklist as 1/6 … 6/6", () => {
    for (const id of ["1", "2", "3", "4", "5", "6"]) {
      recordTask(dataDir, "s1", id, "created");
    }
    expect(recordTask(dataDir, "s1", "1", "completed")).toEqual({ completed: 1, total: 6 });
    expect(recordTask(dataDir, "s1", "2", "completed")).toEqual({ completed: 2, total: 6 });
    expect(recordTask(dataDir, "s1", "6", "completed")).toEqual({ completed: 3, total: 6 });
  });

  it("RESETS for a new checklist created later in the same session (the bug)", () => {
    // Replays the exact captured scenario: six tasks (ids 1-6), complete 1 & 2,
    // then a new batch (ids 7,8) created — completing #7 must read 1/2, NOT 3/8.
    for (const id of ["1", "2", "3", "4", "5", "6"]) recordTask(dataDir, "s1", id, "created");
    expect(recordTask(dataDir, "s1", "1", "completed")).toEqual({ completed: 1, total: 6 });
    expect(recordTask(dataDir, "s1", "2", "completed")).toEqual({ completed: 2, total: 6 });

    // New checklist begins on the next creation (ids keep climbing — they never
    // reset on Claude Code's side).
    recordTask(dataDir, "s1", "7", "created");
    recordTask(dataDir, "s1", "8", "created");
    expect(recordTask(dataDir, "s1", "7", "completed")).toEqual({ completed: 1, total: 2 });
    expect(recordTask(dataDir, "s1", "8", "completed")).toEqual({ completed: 2, total: 2 });
  });

  it("dedupes a repeated completion of the same id", () => {
    recordTask(dataDir, "s1", "1", "created");
    recordTask(dataDir, "s1", "2", "created");
    recordTask(dataDir, "s1", "1", "completed");
    const again = recordTask(dataDir, "s1", "1", "completed");
    expect(again).toEqual({ completed: 1, total: 2 });
  });

  it("keeps separate sessions independent", () => {
    recordTask(dataDir, "s1", "1", "created");
    recordTask(dataDir, "s1", "2", "created");
    recordTask(dataDir, "s1", "1", "completed");
    recordTask(dataDir, "s1", "2", "completed");
    const other = recordTask(dataDir, "s2", "1", "completed");
    expect(other).toEqual({ completed: 1, total: 1 });
  });

  it("returns undefined for a non-numeric task id", () => {
    expect(recordTask(dataDir, "s1", "abc", "completed")).toBeUndefined();
  });

  it("writes the state file atomically (no .tmp leftovers)", () => {
    recordTask(dataDir, "s1", "1", "completed");
    const files = readdirSync(dataDir);
    expect(files).toContain(PROGRESS_FILE);
    expect(files.some((f) => f.includes(".tmp."))).toBe(false);
  });

  it("tolerates a corrupted state file (fails open to a fresh count)", () => {
    writeFileSync(join(dataDir, PROGRESS_FILE), "{ not json", "utf8");
    const progress = recordTask(dataDir, "s1", "1", "completed");
    expect(progress).toEqual({ completed: 1, total: 1 });
  });

  it("persists the checklist boundary across separate calls (sawCompletion)", () => {
    // The reset depends on `sawCompletion` surviving in the JSON file between
    // hook invocations — guard against it being dropped on read/write.
    recordTask(dataDir, "s1", "1", "created");
    recordTask(dataDir, "s1", "1", "completed");
    const record = readProgressRecord(dataDir);
    expect(record.sessions.s1?.sawCompletion).toBe(true);
  });

  it("prunes a session whose last update is older than the TTL", () => {
    const old = 1_000_000;
    recordTask(dataDir, "stale", "1", "completed", old);
    // A later write past the TTL window should evict the stale session.
    recordTask(dataDir, "fresh", "1", "completed", old + DEFAULT_SESSION_TTL_MS + 1);
    const record = readProgressRecord(dataDir);
    expect(record.sessions.stale).toBeUndefined();
    expect(record.sessions.fresh).toBeDefined();
  });
});
