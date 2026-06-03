/**
 * Per-session task progress tracking for the `TaskCompleted` toast counter
 * (e.g. "3/6"). Claude Code's hook payload carries a per-session sequential
 * `task_id` but NO task total and NO grouping — and crucially `task_id` does
 * NOT reset between checklists: it keeps counting up across the whole session.
 * So a naive "highest id seen" total mixes unrelated checklists together (a
 * second checklist of 2 items, created after 6 earlier tasks, would show a
 * total of 8). We instead track the *current checklist* and reset it when a new
 * one begins.
 *
 * How a new checklist is detected: Claude Code creates a checklist as a burst
 * of `TaskCreated` events, then marks items complete one by one. A `TaskCreated`
 * that arrives *after* any completion in the session is the start of a NEW
 * checklist — so we reset the group's counters then. This makes the counter
 * track exactly the list the user sees on screen: it counts 1/6 … 6/6, and a
 * fresh batch restarts at 1/N. (Confirmed against real captured hook payloads:
 * `task_id` is a session-global sequential counter, never reset per checklist.)
 *
 * Modeled on `throttle.ts`: a small JSON file in the plugin data dir, written
 * atomically, read defensively, pruned by TTL so it can't grow unbounded.
 *
 * Hot-path note: this module imports only `node:fs` + `node:path` +
 * `atomicWrite.js` (all already in the hook bundle). It does NOT import
 * `env-paths`; the caller passes in the resolved data dir, keeping a second
 * heavy dependency chain out of `dist/hook.{js,cjs}`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./atomicWrite.js";
import { withFileLock } from "./fileLock.js";
import type { TaskProgress } from "./types.js";

const PROGRESS_FILENAME = "session-progress.json";

/** Which kind of task event we're folding in. */
export type TaskEventKind = "created" | "completed";

/**
 * How long a session's progress is kept after its last update. Sessions can
 * run for hours, so this is generous; the prune only reclaims space from
 * sessions that are clearly done.
 */
export const DEFAULT_SESSION_TTL_MS = 6 * 60 * 60 * 1000;

interface SessionEntry {
  /**
   * Distinct task ids CREATED in the current checklist (the denominator/total).
   * Reset when a new checklist begins (a creation after a completion).
   */
  createdIds: number[];
  /**
   * Distinct task ids COMPLETED in the current checklist (the exact numerator).
   * Reset alongside `createdIds`.
   */
  completedIds: number[];
  /**
   * Whether a completion has been seen since the current checklist began. The
   * next `TaskCreated` after a completion starts a fresh checklist (resets the
   * two id lists). Persisted so the detection survives across hook processes.
   */
  sawCompletion: boolean;
  /** Epoch-ms of the last update — drives TTL pruning. */
  updatedAt: number;
}

interface ProgressRecord {
  /** Map of session_id → its progress entry. */
  sessions: Record<string, SessionEntry>;
}

function emptyEntry(now: number): SessionEntry {
  return { createdIds: [], completedIds: [], sawCompletion: false, updatedAt: now };
}

function addUnique(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids : [...ids, id];
}

/**
 * Pure state transition (mirrors `throttle.ts`'s `shouldFire`): folds one task
 * event into a session entry, returning a NEW entry (no mutation).
 *
 *  - A `created` event that arrives after a completion (`sawCompletion`) starts
 *    a NEW checklist: both id lists reset before the new id is recorded. It then
 *    joins `createdIds` (raising the total).
 *  - A `completed` event records the id in `completedIds` once (deduped, so
 *    re-fires never double-count) and sets `sawCompletion`. It also ensures the
 *    id is in `createdIds` — a task can complete without our having seen its
 *    creation (e.g. created before the toast was enabled), and the total must
 *    never sit below the numerator.
 *
 * `updatedAt` is always bumped to `now`. Non-finite/non-positive ids are
 * ignored (the lists are unchanged) but still bump `updatedAt`.
 */
export function applyTask(
  entry: SessionEntry,
  taskId: number,
  kind: TaskEventKind,
  now: number,
): SessionEntry {
  const hasValidId = Number.isFinite(taskId) && taskId > 0;
  if (!hasValidId) {
    return { ...entry, updatedAt: now };
  }

  if (kind === "created") {
    // A creation following a completion marks the boundary of a new checklist.
    const startingNewGroup = entry.sawCompletion;
    const createdBase = startingNewGroup ? [] : entry.createdIds;
    return {
      createdIds: addUnique(createdBase, taskId),
      completedIds: startingNewGroup ? [] : entry.completedIds,
      sawCompletion: false,
      updatedAt: now,
    };
  }

  // kind === "completed"
  return {
    createdIds: addUnique(entry.createdIds, taskId),
    completedIds: addUnique(entry.completedIds, taskId),
    sawCompletion: true,
    updatedAt: now,
  };
}

/**
 * Pure projection: turns a session entry into the `{ completed, total }` the
 * toast shows for the CURRENT checklist. `completed` is exact; `total` is
 * clamped to never be below `completed` (so it can't produce a nonsensical
 * "3/2" if a completion outran the creations we saw).
 */
export function deriveProgress(entry: SessionEntry): TaskProgress {
  const completed = entry.completedIds.length;
  return { completed, total: Math.max(entry.createdIds.length, completed) };
}

export function readProgressRecord(dataDir: string): ProgressRecord {
  const path = join(dataDir, PROGRESS_FILENAME);
  if (!existsSync(path)) return { sessions: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "sessions" in parsed &&
      typeof (parsed as { sessions: unknown }).sessions === "object" &&
      (parsed as { sessions: unknown }).sessions !== null
    ) {
      return { sessions: { ...(parsed as ProgressRecord).sessions } };
    }
  } catch {
    /* fall through to empty */
  }
  return { sessions: {} };
}

/**
 * Read+update+write gate for a task event. Records the task into its session
 * and returns the resulting `{ completed, total }`. Fail-open: any filesystem
 * error (or a missing/invalid `task_id`) returns `undefined`, so the caller
 * simply notifies without a counter rather than dropping the toast. Verbose
 * task events only.
 */
export function recordTask(
  dataDir: string,
  sessionId: string,
  taskIdRaw: string,
  kind: TaskEventKind,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_SESSION_TTL_MS,
): TaskProgress | undefined {
  const taskId = Number.parseInt(taskIdRaw, 10);
  if (!Number.isFinite(taskId)) return undefined;

  const path = join(dataDir, PROGRESS_FILENAME);
  try {
    // Hold the lock across the WHOLE read-modify-write: hook events fire as
    // concurrent processes, so reading, folding in this event, and writing must
    // be one critical section or concurrent completions clobber each other's
    // ids (lost update → a counter that skips/repeats numbers).
    return withFileLock(path, () => {
      const record = readProgressRecord(dataDir);
      const next = applyTask(record.sessions[sessionId] ?? emptyEntry(now), taskId, kind, now);
      record.sessions[sessionId] = next;
      pruneStale(record, now, ttlMs);
      atomicWriteFileSync(path, JSON.stringify(record));
      return deriveProgress(next);
    });
  } catch {
    return undefined;
  }
}

/** Drops sessions whose last update is older than the TTL (or has a bad ts). */
function pruneStale(record: ProgressRecord, now: number, ttlMs: number): void {
  for (const [sessionId, entry] of Object.entries(record.sessions)) {
    if (!Number.isFinite(entry.updatedAt) || now - entry.updatedAt > ttlMs) {
      delete record.sessions[sessionId];
    }
  }
}
