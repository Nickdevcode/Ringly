/**
 * Cross-process file lock for read-modify-write on the small JSON state files
 * that several hook processes share (`session-progress.json`,
 * `event-throttle.json`).
 *
 * Why this exists: every Claude Code hook fires a *separate* Node process (the
 * plugin's `dispatch.mjs` spawns `dist/hook.js` per event). When a user
 * completes tasks in quick succession, those processes run concurrently and
 * each does read → modify → write on the same file. `atomicWriteFileSync` keeps
 * any single write from tearing, but it does NOT serialize the read-modify-write
 * as a whole: two processes read the same state, both write, and the last one
 * silently clobbers the other's update ("lost update"). That surfaced as a
 * task counter that skipped/repeated numbers (e.g. "1/4, 1/4, 2/4" instead of
 * "1/4, 2/4, 3/4") and as the first toast sometimes being swallowed.
 *
 * Strategy: `mkdir` as the lock primitive. `mkdirSync` is atomic on every file
 * system (NTFS and POSIX alike) and fails when the directory already exists, so
 * exactly one process can hold `<target>.lock` at a time — this is the same
 * primitive `proper-lockfile` uses, and it avoids the `O_EXCL` pitfalls. We
 * deliberately do NOT pull in an npm lock library: this module must stay on the
 * hook hot path and import only `node:fs` + `node:path` (both already bundled),
 * keeping a second heavy dependency chain out of `dist/hook.{js,cjs}`.
 *
 * Robustness:
 *  - A waiter retries with a short busy-wait (our critical section is a few-KB
 *    JSON write — sub-millisecond — so blocking briefly is cheaper than
 *    dropping the update).
 *  - A crashed holder would otherwise wedge the lock forever, so a lock dir
 *    older than `STALE_MS` is treated as orphaned and broken. Stealing is itself
 *    raced safely: we re-acquire via `mkdir` after removing it, so if two
 *    waiters both try to steal, only one wins the subsequent `mkdir`.
 *  - Fail-open: if the lock genuinely can't be acquired within the budget, the
 *    critical section still runs (unlocked) rather than dropping the work — a
 *    rare lost update is strictly better than a dropped notification.
 */
import { mkdirSync, rmdirSync, statSync } from "node:fs";

/** Lock dir suffix appended to the file being protected. */
const LOCK_SUFFIX = ".lock";

/**
 * How long a lock dir may exist before it's considered orphaned (holder
 * crashed). Our critical sections are sub-millisecond, so anything this old is
 * certainly a dead process, not a slow one.
 */
export const STALE_MS = 3000;

/** Total time a waiter will keep trying to acquire before giving up (fail-open). */
export const ACQUIRE_TIMEOUT_MS = 2000;

/** Busy-wait granularity between acquisition attempts. */
const RETRY_SLEEP_MS = 5;

/**
 * Synchronous sleep. Lock contention here is between short-lived hook processes,
 * and the whole module is on a synchronous read-modify-write path (mirroring
 * `atomicWrite`/`throttle`), so a brief blocking spin is appropriate — there is
 * no event loop work to yield to in the per-event hook process.
 */
function sleepSync(ms: number): void {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // Busy-wait. Intervals are tiny (RETRY_SLEEP_MS) and total time is bounded
    // by ACQUIRE_TIMEOUT_MS, so this can't spin meaningfully long.
  }
}

/** Tries to claim the lock dir once. Returns true if this call created it. */
function tryAcquire(lockDir: string): boolean {
  try {
    mkdirSync(lockDir);
    return true;
  } catch {
    return false;
  }
}

/** Best-effort removal of a lock dir we believe is stale or our own. */
function releaseLock(lockDir: string): void {
  try {
    rmdirSync(lockDir);
  } catch {
    /* already gone / not ours — nothing to do */
  }
}

/** Whether an existing lock dir is older than the stale threshold. */
function isStale(lockDir: string, now: number): boolean {
  try {
    const age = now - statSync(lockDir).mtimeMs;
    return age > STALE_MS;
  } catch {
    // Vanished between checks — treat as not-stale; the next acquire attempt
    // will simply succeed.
    return false;
  }
}

/**
 * Runs `fn` while holding an exclusive cross-process lock on `targetPath`.
 * Returns whatever `fn` returns. The lock is always released, even if `fn`
 * throws (the error propagates to the caller).
 *
 * If the lock can't be acquired within `ACQUIRE_TIMEOUT_MS` (e.g. pathological
 * contention or an undeletable stale dir), `fn` runs WITHOUT the lock — callers
 * here are already fail-open and a missed update beats a dropped toast.
 */
export function withFileLock<T>(targetPath: string, fn: () => T): T {
  const lockDir = `${targetPath}${LOCK_SUFFIX}`;
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
  let held = false;

  while (Date.now() <= deadline) {
    if (tryAcquire(lockDir)) {
      held = true;
      break;
    }
    // Couldn't claim it — someone holds it. If that holder looks dead, break the
    // stale lock and retry immediately; otherwise back off briefly.
    if (isStale(lockDir, Date.now())) {
      releaseLock(lockDir);
      continue;
    }
    sleepSync(RETRY_SLEEP_MS);
  }

  if (!held) {
    // Fail-open: proceed unlocked rather than dropping the caller's work.
    return fn();
  }

  try {
    return fn();
  } finally {
    releaseLock(lockDir);
  }
}
