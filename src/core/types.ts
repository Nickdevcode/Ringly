export type Platform = "windows" | "macos" | "linux" | "unknown";

export type SupportedLanguage = "pt-BR" | "en-US";

export type LanguageSetting = SupportedLanguage | "auto";

// The notification event union and config keys are derived from the event
// registry (`events.ts`) so that adding an event is a one-place change.
// Imported for local use here and re-exported because most modules import
// `ClaudeHookEventName` from `types.js`. This is a types-only cycle
// (`types` ↔ `events`); both sides are erased at runtime, so `dist/*.js` has
// no circular `import`.
import type { ClaudeHookEventName, EventConfigKey } from "./events.js";

export type { ClaudeHookEventName };

export type NotificationSeverity = "info" | "warning" | "error";

export interface ClaudeHookPayload {
  hook_event_name?: ClaudeHookEventName;
  cwd?: string;
  message?: string;
  agent_type?: string;
  error_type?: string;
  notification_type?: string;
  type?: string;
  error?: string;
  session_id?: string;
  transcript_path?: string;
  /** PreCompact/PostCompact: what triggered compaction (`manual` | `auto`). */
  trigger?: string;
  /** TaskCreated/TaskCompleted: human-readable task title (per docs, sent as `task_subject`). */
  task_subject?: string;
  /** TaskCreated/TaskCompleted: optional longer task description (`task_description`). */
  task_description?: string;
  /**
   * TaskCreated/TaskCompleted: session-global sequential task identifier ("1",
   * "2", …). It increments per creation and does NOT reset between checklists.
   * Claude Code sends no task total, so the progress counter (see
   * `TaskProgress`) derives one per checklist in `core/sessionProgress.ts`.
   */
  task_id?: string;
}

/**
 * Per-session task progress shown in the `TaskCompleted` toast (e.g. "3/6").
 * Both numbers describe the CURRENT checklist, not the whole session: `completed`
 * is exact (distinct ids completed in this checklist) and `total` is how many
 * items the checklist was created with. The hook payload carries no task total
 * and `task_id` never resets between checklists, so the checklist boundary is
 * inferred (a creation following a completion). See `core/sessionProgress.ts`.
 */
export interface TaskProgress {
  completed: number;
  total: number;
}

export interface NotificationIntent {
  event: ClaudeHookEventName;
  title: string;
  body: string;
  severity: NotificationSeverity;
  projectName: string | null;
  sound: boolean;
  soundName: ToastSoundName;
  /** Windows toast scenario derived from the event descriptor (optional). */
  scenario?: ToastScenario | undefined;
}

export type ToastSoundName =
  | "Notification.Default"
  | "Notification.IM"
  | "Notification.Mail"
  | "Notification.Reminder"
  | "Notification.SMS"
  | "Notification.Looping.Alarm"
  | "Notification.Looping.Alarm2"
  | "Notification.Looping.Call"
  | "silent";

export type ToastScenario = "default" | "reminder" | "alarm";

export interface ToastOptions {
  appId: string;
  title: string;
  body: string;
  sound: ToastSoundName;
  /** Absolute path to the app logo (appLogoOverride). Omitted/missing → no image. */
  iconPath?: string | undefined;
  /** Windows toast scenario. `default` is treated as "no scenario attribute". */
  scenario?: ToastScenario | undefined;
  /** ISO 8601 timestamp shown on the toast (overrides the OS receipt time). */
  displayTimestamp?: string | undefined;
}

/**
 * Where the context-usage meter sits in the status line:
 *  - `"end"`   — appended after the directory (default; the historical layout).
 *  - `"front"` — glued right after the model name, so the meter stays visible
 *                even in narrow terminals that truncate the right side.
 */
export type StatuslineContextPosition = "end" | "front";

/**
 * The status-line segment keys, in TUI order. Declared here (a runtime-free
 * module both the hot-path config reader and the settings writer can import
 * without a cycle) so the type, the default map, the env-override loop, and
 * the settings read/write paths all iterate the same set. Adding a segment is
 * a one-line change here plus `StatuslineSegments`.
 */
export const STATUSLINE_SEGMENT_KEYS = [
  "model",
  "task",
  "dirname",
  "context",
  "lastCommand",
  "git",
  "lines",
  "rateLimits",
] as const;

/**
 * Per-segment on/off switches for the status line. Each key toggles one visual
 * chunk; unlike the notification events these carry no extra metadata, so they
 * are a plain fixed record instead of a registry.
 *
 * The key set is locked to `STATUSLINE_SEGMENT_KEYS` via the `satisfies` check
 * below, so the array and this interface can never drift apart.
 */
export interface StatuslineSegments {
  /** Dim model display name (e.g. "Opus"). */
  model: boolean;
  /** The current in-progress todo task, shown bold (the "middle" segment). */
  task: boolean;
  /** Dim basename of the working directory. */
  dirname: boolean;
  /** The 10-block context-window usage meter. */
  context: boolean;
  /** The `last: /command` suffix read from the transcript. */
  lastCommand: boolean;
  /** Git branch + ahead/behind/dirty counters. */
  git: boolean;
  /** Session lines added/removed (`+N -M`). */
  lines: boolean;
  /** Claude.ai 5-hour / 7-day rate-limit meters. */
  rateLimits: boolean;
}

// Compile-time guarantee that the key array matches the interface exactly.
const _segmentKeysCheck: readonly (keyof StatuslineSegments)[] = STATUSLINE_SEGMENT_KEYS;
void _segmentKeysCheck;

/**
 * Status line configuration. `enabled` is the master switch: turning it on
 * installs Ringly's renderer into `~/.claude/settings.json`'s `statusLine`
 * key (backing up whatever was there); turning it off restores the backup.
 * `segments` and `position` only affect what the renderer prints.
 */
export interface StatuslineConfig {
  enabled: boolean;
  position: StatuslineContextPosition;
  segments: StatuslineSegments;
}

export interface RinglyConfig {
  schemaVersion: 1;
  language: LanguageSetting;
  // Keyed by the registry's `configKey`s (a closed literal union, so typos
  // are still compile errors) — the key set follows `events.ts`, not a
  // hand-written object, so a new event needs no change here.
  events: Record<EventConfigKey, boolean>;
  sound: boolean;
  debug: boolean;
  checkUpdates: boolean;
  appId: string;
  /** Status line feature — opt-in, off by default. See `StatuslineConfig`. */
  statusline: StatuslineConfig;
}

export interface NotificationChannel {
  name: string;
  isAvailable(): Promise<boolean>;
  send(intent: NotificationIntent): Promise<void>;
}

export const DEFAULT_APP_ID = "Claude.Code.CLI";
