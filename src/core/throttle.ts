/**
 * Throttle/dedup for high-frequency ("verbose") notification events
 * (subagent start, task created/completed, compaction). Without this, a busy
 * session could fire dozens of toasts in seconds and bury the useful ones.
 *
 * Modeled on `updateCheck.ts`'s record pattern: a tiny JSON file in the
 * plugin data dir, written atomically, read defensively. Only verbose events
 * touch it — the original four events skip the throttle entirely, so the hot
 * path for the common case is unchanged.
 *
 * Hot-path note: this module imports only `node:fs` + `atomicWrite.js` (both
 * already in the hook bundle). It does NOT import `env-paths`; the caller
 * passes in the resolved data dir, keeping a second heavy dependency chain out
 * of `dist/hook.{js,cjs}`.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./atomicWrite.js";

const THROTTLE_FILENAME = "event-throttle.json";

/** Default minimum gap between two toasts sharing the same dedup key. */
export const DEFAULT_THROTTLE_WINDOW_MS = 8000;

interface ThrottleRecord {
  /** Map of dedup key → epoch-ms of the last fire. */
  events: Record<string, number>;
}

/**
 * Pure decision helper: should an event with `lastMs` as its last-fire time
 * fire again at `now`, given `windowMs`? Fires when there is no prior record
 * or the window has fully elapsed. Unit-testable without the filesystem
 * (mirrors `shouldCheckUpdate`).
 */
export function shouldFire(lastMs: number | undefined, now: number, windowMs: number): boolean {
  if (lastMs === undefined) return true;
  if (!Number.isFinite(lastMs)) return true;
  return now - lastMs >= windowMs;
}

/** Builds the dedup key for an event occurrence. */
export function throttleKey(
  event: string,
  projectName: string | null,
  agentType: string | null,
): string {
  return `${event}:${projectName ?? ""}:${agentType ?? ""}`;
}

export function readThrottleRecord(dataDir: string): ThrottleRecord {
  const path = join(dataDir, THROTTLE_FILENAME);
  if (!existsSync(path)) return { events: {} };
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "events" in parsed &&
      typeof (parsed as { events: unknown }).events === "object" &&
      (parsed as { events: unknown }).events !== null
    ) {
      return { events: { ...(parsed as ThrottleRecord).events } };
    }
  } catch {
    /* fall through to empty */
  }
  return { events: {} };
}

/**
 * Read+decide+write gate for a verbose event. Returns true when the event may
 * fire (and records the fire), false when it should be suppressed. Fail-open:
 * any filesystem error returns true so a broken throttle file never silently
 * swallows notifications. Verbose events only.
 */
export function throttleGate(
  dataDir: string,
  key: string,
  windowMs: number = DEFAULT_THROTTLE_WINDOW_MS,
  now: number = Date.now(),
): boolean {
  try {
    const record = readThrottleRecord(dataDir);
    if (!shouldFire(record.events[key], now, windowMs)) return false;

    record.events[key] = now;
    pruneStale(record, now, windowMs);
    atomicWriteFileSync(join(dataDir, THROTTLE_FILENAME), JSON.stringify(record));
    return true;
  } catch {
    return true;
  }
}

/** Drops entries older than 10× the window so the file can't grow unbounded. */
function pruneStale(record: ThrottleRecord, now: number, windowMs: number): void {
  const maxAge = windowMs * 10;
  for (const [key, ts] of Object.entries(record.events)) {
    if (!Number.isFinite(ts) || now - ts > maxAge) {
      delete record.events[key];
    }
  }
}
