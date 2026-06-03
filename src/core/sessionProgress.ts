/**
 * Per-session task progress tracking for the `TaskCompleted` toast counter
 * (e.g. "3/10"). Claude Code's hook payload carries a per-session sequential
 * `task_id` but NO task total, so we keep a tiny bit of state ourselves: how
 * many distinct task ids have completed in a session (the exact numerator) and
 * the highest task id seen (a best-effort denominator).
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
import type { TaskProgress } from "./types.js";

const PROGRESS_FILENAME = "session-progress.json";

/**
 * How long a session's progress is kept after its last update. Sessions can
 * run for hours, so this is generous; the prune only reclaims space from
 * sessions that are clearly done.
 */
export const DEFAULT_SESSION_TTL_MS = 6 * 60 * 60 * 1000;

interface SessionEntry {
  /** Distinct numeric task ids that have completed (the exact numerator). */
  completedIds: number[];
  /** Highest task id seen this session (the best-effort total/denominator). */
  maxId: number;
  /** Epoch-ms of the last update — drives TTL pruning. */
  updatedAt: number;
}

interface ProgressRecord {
  /** Map of session_id → its progress entry. */
  sessions: Record<string, SessionEntry>;
}

function emptyEntry(now: number): SessionEntry {
  return { completedIds: [], maxId: 0, updatedAt: now };
}

/**
 * Pure state transition (mirrors `throttle.ts`'s `shouldFire`): folds one task
 * event into a session entry, returning a NEW entry (no mutation). A finite,
 * positive `taskId` raises `maxId`; a completed task is added to `completedIds`
 * once (deduped) so re-fires of the same id never double-count. `updatedAt` is
 * always bumped to `now`. Non-finite ids are ignored entirely.
 */
export function applyTask(
  entry: SessionEntry,
  taskId: number,
  completed: boolean,
  now: number,
): SessionEntry {
  const hasValidId = Number.isFinite(taskId) && taskId > 0;
  const maxId = hasValidId ? Math.max(entry.maxId, taskId) : entry.maxId;

  let completedIds = entry.completedIds;
  if (completed && hasValidId && !completedIds.includes(taskId)) {
    completedIds = [...completedIds, taskId];
  }

  return { completedIds, maxId, updatedAt: now };
}

/**
 * Pure projection: turns a session entry into the `{ completed, total }` the
 * toast shows. `completed` is exact; `total` is clamped to never be below
 * `completed` (so deleted tasks can't produce a nonsensical "3/2").
 */
export function deriveProgress(entry: SessionEntry): TaskProgress {
  const completed = entry.completedIds.length;
  return { completed, total: Math.max(entry.maxId, completed) };
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
  completed: boolean,
  now: number = Date.now(),
  ttlMs: number = DEFAULT_SESSION_TTL_MS,
): TaskProgress | undefined {
  const taskId = Number.parseInt(taskIdRaw, 10);
  if (!Number.isFinite(taskId)) return undefined;

  try {
    const record = readProgressRecord(dataDir);
    const next = applyTask(record.sessions[sessionId] ?? emptyEntry(now), taskId, completed, now);
    record.sessions[sessionId] = next;
    pruneStale(record, now, ttlMs);
    atomicWriteFileSync(join(dataDir, PROGRESS_FILENAME), JSON.stringify(record));
    return deriveProgress(next);
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
