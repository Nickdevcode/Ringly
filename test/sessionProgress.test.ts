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
function entry(completedIds: number[], maxId: number, updatedAt = 0) {
  return { completedIds, maxId, updatedAt };
}

describe("applyTask (pure)", () => {
  it("raises maxId and records a completed id", () => {
    const next = applyTask(entry([], 0), 3, true, 1000);
    expect(next).toEqual({ completedIds: [3], maxId: 3, updatedAt: 1000 });
  });

  it("dedupes a repeated completed id", () => {
    const once = applyTask(entry([], 0), 2, true, 1000);
    const twice = applyTask(once, 2, true, 2000);
    expect(twice.completedIds).toEqual([2]);
    expect(twice.updatedAt).toBe(2000);
  });

  it("raises maxId without completing when completed=false", () => {
    const next = applyTask(entry([1], 1), 5, false, 1000);
    expect(next.maxId).toBe(5);
    expect(next.completedIds).toEqual([1]);
  });

  it("never lowers maxId", () => {
    const next = applyTask(entry([], 10), 4, false, 1000);
    expect(next.maxId).toBe(10);
  });

  it("ignores a non-finite or non-positive id", () => {
    expect(applyTask(entry([], 0), Number.NaN, true, 1000)).toEqual({
      completedIds: [],
      maxId: 0,
      updatedAt: 1000,
    });
    expect(applyTask(entry([], 0), 0, true, 1000).completedIds).toEqual([]);
  });

  it("does not mutate the input entry", () => {
    const base = entry([1], 1);
    applyTask(base, 2, true, 1000);
    expect(base).toEqual({ completedIds: [1], maxId: 1, updatedAt: 0 });
  });
});

describe("deriveProgress (pure)", () => {
  it("returns exact completed and maxId as total", () => {
    expect(deriveProgress(entry([1, 2, 3], 10))).toEqual({ completed: 3, total: 10 });
  });

  it("clamps total to never be below completed", () => {
    expect(deriveProgress(entry([1, 2, 3], 2))).toEqual({ completed: 3, total: 3 });
  });

  it("is zero for a fresh entry", () => {
    expect(deriveProgress(entry([], 0))).toEqual({ completed: 0, total: 0 });
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
    recordTask(dataDir, "s1", "1", false);
    recordTask(dataDir, "s1", "2", false);
    const progress = recordTask(dataDir, "s1", "1", true);
    expect(progress).toEqual({ completed: 1, total: 2 });
  });

  it("dedupes a repeated completion of the same id", () => {
    recordTask(dataDir, "s1", "1", true);
    const again = recordTask(dataDir, "s1", "1", true);
    expect(again).toEqual({ completed: 1, total: 1 });
  });

  it("keeps separate sessions independent", () => {
    recordTask(dataDir, "s1", "1", true);
    recordTask(dataDir, "s1", "2", true);
    const other = recordTask(dataDir, "s2", "1", true);
    expect(other).toEqual({ completed: 1, total: 1 });
  });

  it("returns undefined for a non-numeric task id", () => {
    expect(recordTask(dataDir, "s1", "abc", true)).toBeUndefined();
  });

  it("writes the state file atomically (no .tmp leftovers)", () => {
    recordTask(dataDir, "s1", "1", true);
    const files = readdirSync(dataDir);
    expect(files).toContain(PROGRESS_FILE);
    expect(files.some((f) => f.includes(".tmp."))).toBe(false);
  });

  it("tolerates a corrupted state file (fails open to a fresh count)", () => {
    writeFileSync(join(dataDir, PROGRESS_FILE), "{ not json", "utf8");
    const progress = recordTask(dataDir, "s1", "1", true);
    expect(progress).toEqual({ completed: 1, total: 1 });
  });

  it("prunes a session whose last update is older than the TTL", () => {
    const old = 1_000_000;
    recordTask(dataDir, "stale", "1", true, old);
    // A later write past the TTL window should evict the stale session.
    recordTask(dataDir, "fresh", "1", true, old + DEFAULT_SESSION_TTL_MS + 1);
    const record = readProgressRecord(dataDir);
    expect(record.sessions.stale).toBeUndefined();
    expect(record.sessions.fresh).toBeDefined();
  });
});
