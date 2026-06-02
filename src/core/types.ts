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
}

export interface NotificationChannel {
  name: string;
  isAvailable(): Promise<boolean>;
  send(intent: NotificationIntent): Promise<void>;
}

export const DEFAULT_APP_ID = "Claude.Code.CLI";
