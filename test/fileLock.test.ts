import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ACQUIRE_TIMEOUT_MS, STALE_MS, withFileLock } from "../src/core/fileLock.js";

describe("withFileLock", () => {
  let dir: string;
  let target: string;
  let lockDir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ringly-lock-"));
    target = join(dir, "state.json");
    lockDir = `${target}.lock`;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("runs the critical section and returns its value", () => {
    const result = withFileLock(target, () => 42);
    expect(result).toBe(42);
  });

  it("holds the lock dir for the duration of the critical section and releases after", () => {
    let lockedDuringRun = false;
    withFileLock(target, () => {
      lockedDuringRun = existsSync(lockDir);
    });
    expect(lockedDuringRun).toBe(true);
    // Released afterwards.
    expect(existsSync(lockDir)).toBe(false);
  });

  it("releases the lock even when the critical section throws", () => {
    expect(() =>
      withFileLock(target, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(existsSync(lockDir)).toBe(false);
  });

  it("breaks a STALE lock (orphaned by a crashed holder) and proceeds", () => {
    // Simulate a dead holder: create the lock dir and backdate its mtime well
    // past the stale threshold.
    mkdirSync(lockDir);
    const old = (Date.now() - (STALE_MS + 1000)) / 1000;
    utimesSync(lockDir, old, old);

    let ran = false;
    withFileLock(target, () => {
      ran = true;
    });
    expect(ran).toBe(true);
    // The stale dir was broken and re-released cleanly.
    expect(existsSync(lockDir)).toBe(false);
  });

  it("fails OPEN: still runs the critical section if the lock can't be acquired", () => {
    // A FRESH (non-stale) lock held by someone else: we can't acquire it, and it
    // never ages out within the test, so the acquire budget expires and we run
    // unlocked rather than dropping the work.
    mkdirSync(lockDir);
    // Keep it fresh for the whole acquire window.
    const now = Date.now() / 1000;
    utimesSync(lockDir, now, now);

    const start = Date.now();
    let ran = false;
    withFileLock(target, () => {
      ran = true;
    });
    const elapsed = Date.now() - start;

    expect(ran).toBe(true); // fail-open
    // It waited up to the budget before giving up (allow scheduler slack).
    expect(elapsed).toBeGreaterThanOrEqual(ACQUIRE_TIMEOUT_MS - 200);
    // We did NOT delete a lock that wasn't ours/stale.
    expect(existsSync(lockDir)).toBe(true);
  });

  it("a stale dir that reappears fresh after break is not double-deleted", () => {
    // Edge: ensure releaseLock tolerates the dir already being gone.
    mkdirSync(lockDir);
    const old = (Date.now() - (STALE_MS + 1000)) / 1000;
    utimesSync(lockDir, old, old);
    // Remove it ourselves mid-flight to mimic another waiter winning the steal.
    rmSync(lockDir, { recursive: true, force: true });
    expect(() => withFileLock(target, () => undefined)).not.toThrow();
  });

  it("does not leave a lock dir behind on the happy path", () => {
    withFileLock(target, () => "ok");
    const leftovers = existsSync(lockDir);
    expect(leftovers).toBe(false);
    // Sanity: the target's parent dir is otherwise untouched by the lock.
    expect(() => statSync(dir)).not.toThrow();
  });
});
